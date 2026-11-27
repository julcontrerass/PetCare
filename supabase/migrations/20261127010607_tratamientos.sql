-- Tratamientos: el plan de tomas de una receta arranca cuando el dueño da la primera dosis, la receta dice si va con
-- la comida, y el veterinario lo puede suspender.
--
-- - prescripciones.empezo_at: la hora (local, como las tomas) de la primera dosis; de ahí se cuentan las demás cada
--   frecuencia_horas durante duracion_dias. Null = todavía no empezó. Las recetas que ya existían arrancan cuando se
--   recetaron (como hasta ahora), así no cambian sus tomas.
-- - prescripciones.con_comida: antes, durante o después de comer, o en ayunas (se ve destacado y va en el aviso).
-- - prescripciones.suspendida_at: el veterinario corta el tratamiento antes de tiempo; no hay más tomas desde ahí.
-- - tomas_medicacion.dada_at: si el dueño tilda una toma tarde puede decir a qué hora se la dio (entre unas horas antes
--   de la programada y ahora); si no, es la hora en que la tilda.

alter table public.prescripciones
  add column con_comida text check (con_comida is null or con_comida in ('antes', 'durante', 'despues', 'ayunas')),
  add column empezo_at timestamp,
  add column suspendida_at timestamptz,
  add column motivo_suspension text check (motivo_suspension is null or length(motivo_suspension) <= 300);

-- Las que ya existían: empiezan cuando se recetaron (misma cuenta que hacía la app, en la hora de Argentina)
update public.prescripciones
   set empezo_at = date_trunc('minute', created_at at time zone 'America/Argentina/Buenos_Aires')
 where frecuencia_horas is not null and duracion_dias is not null and empezo_at is null;

-- El dueño marca la primera dosis (o la corrige mientras no tildó otra): desde ahí se arma el plan
create or replace function public.empezar_tratamiento(p_prescripcion uuid, p_hora timestamp)
returns void language plpgsql security definer set search_path to '' as $$
declare
  p public.prescripciones%rowtype;
  v_ahora timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
  v_hora timestamp := date_trunc('minute', p_hora);
begin
  select * into p from public.prescripciones where id = p_prescripcion;
  if not found or not private.es_dueno_de(p.mascota_id) or not private.cuenta_activa() then
    raise exception 'La receta no existe' using errcode = 'P0001';
  end if;
  if p.frecuencia_horas is null or p.duracion_dias is null then
    raise exception 'Esta receta no tiene frecuencia ni duración: no hay tomas para seguir' using errcode = 'P0001';
  end if;
  if p.suspendida_at is not null then
    raise exception 'El veterinario suspendió este tratamiento' using errcode = 'P0001';
  end if;
  if v_hora > v_ahora + interval '5 minutes' or v_hora < v_ahora - interval '2 days' then
    raise exception 'Elegí la hora en que le diste la primera dosis (no puede ser más adelante)' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tomas_medicacion where prescripcion_id = p.id) > 1 then
    raise exception 'El tratamiento ya está en curso' using errcode = 'P0001';
  end if;
  -- Se vuelve a armar desde la primera dosis
  delete from public.tomas_medicacion where prescripcion_id = p.id;
  update public.prescripciones set empezo_at = v_hora where id = p.id;
  insert into public.tomas_medicacion (prescripcion_id, programada, dada_at)
  values (p.id, v_hora, v_hora at time zone 'America/Argentina/Buenos_Aires');
end $$;

-- El veterinario corta el tratamiento antes de tiempo (cambia la medicación, ya no hace falta...)
create or replace function public.suspender_tratamiento(p_prescripcion uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare
  p public.prescripciones%rowtype;
  v_mascota text;
  v_dueno uuid;
begin
  select * into p from public.prescripciones where id = p_prescripcion;
  if not found or not private.cuenta_activa()
     or not (p.veterinario_id = (select auth.uid()) or private.vet_tiene_acceso(p.mascota_id)) then
    raise exception 'Solo un veterinario de la mascota puede suspender el tratamiento' using errcode = '42501';
  end if;
  if p.suspendida_at is not null then
    return;
  end if;
  update public.prescripciones
     set suspendida_at = now(), motivo_suspension = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p.id;
  select nombre, dueno_id into v_mascota, v_dueno from public.mascotas where id = p.mascota_id;
  if v_dueno is not null then
    perform private.notificar(v_dueno, 'cuenta', 'Tratamiento suspendido',
      'El veterinario suspendió ' || p.medicamento || ' de ' || coalesce(v_mascota, 'tu mascota')
      || coalesce(': ' || nullif(trim(coalesce(p_motivo, '')), ''), '') || '. Ya no hace falta dárselo.');
  end if;
end $$;

revoke all on function public.empezar_tratamiento(uuid, timestamp), public.suspender_tratamiento(uuid, text) from public, anon;
grant execute on function public.empezar_tratamiento(uuid, timestamp), public.suspender_tratamiento(uuid, text) to authenticated;

-- La toma guarda la hora real en que se dio: la que dice el dueño si es razonable, si no la de ahora
create or replace function private.toma_de_receta()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_desde timestamptz;
begin
  select mascota_id into new.mascota_id from public.prescripciones where id = new.prescripcion_id;
  if new.mascota_id is null then
    raise exception 'La receta no existe' using errcode = 'P0001';
  end if;
  new.registrada_por := (select auth.uid());
  v_desde := (new.programada at time zone 'America/Argentina/Buenos_Aires') - interval '3 hours';
  if new.dada_at is null or new.dada_at > now() or new.dada_at < v_desde then
    new.dada_at := now();
  end if;
  return new;
end $$;
