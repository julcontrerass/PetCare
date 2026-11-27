-- Actividad del administrador con destino: cada movimiento dice a qué apunta, para que tocarlo lleve ahí. Las cuentas
-- (veterinarios, dueños) ya van en objetivo_id; las veterinarias van en una columna propia, clinica_id.
alter table public.actividad_admin
  add column clinica_id uuid references public.clinicas (id) on delete set null;
create index actividad_admin_clinica on public.actividad_admin (clinica_id);

-- Registrar una veterinaria (desde el registro o desde la app) deja un movimiento que lleva a ella
create function private.actividad_clinica_nueva()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_quien text;
begin
  select nombre into v_quien from public.profiles where id = new.creada_por;
  insert into public.actividad_admin (tipo, texto, actor_id, objetivo_id, clinica_id)
  values ('registro', coalesce(v_quien, 'Una cuenta') || ' registró la veterinaria ' || new.nombre,
          new.creada_por, new.creada_por, new.id);
  return new;
end $$;
revoke all on function private.actividad_clinica_nueva() from public, anon, authenticated;
create trigger actividad_clinica_nueva after insert on public.clinicas
  for each row execute function private.actividad_clinica_nueva();

-- revisar_clinica: igual que antes, pero el movimiento apunta a la veterinaria; dar de baja una aprobada se anota
-- como baja (suspensión) y no como rechazo
create or replace function public.revisar_clinica(p_clinica uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_admin uuid := (select auth.uid());
  c public.clinicas%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_baja boolean;
begin
  if not private.es_admin() then
    raise exception 'Solo un administrador puede revisar veterinarias' using errcode = '42501';
  end if;
  select * into c from public.clinicas where id = p_clinica;
  if not found then
    raise exception 'La veterinaria ya no existe' using errcode = 'P0001';
  end if;
  if not p_aprobar and v_motivo is null then
    raise exception 'Escribí el motivo del rechazo' using errcode = 'P0001';
  end if;
  if p_aprobar and (c.cuit is null or c.director_matricula is null or c.habilitacion_comercial_path is null
                    or c.habilitacion_sanitaria_path is null) then
    raise exception 'Faltan datos para aprobarla: el CUIT, el director técnico o alguna habilitación' using errcode = 'P0001';
  end if;
  v_baja := not p_aprobar and c.revision = 'aprobada';
  update public.clinicas
     set revision = case when p_aprobar then 'aprobada' else 'rechazada' end,
         motivo_revision = case when p_aprobar then null else v_motivo end, revisada_at = now(), revisada_por = v_admin
   where id = p_clinica;
  insert into public.actividad_admin (tipo, texto, actor_id, objetivo_id, clinica_id)
  values (case when p_aprobar then 'aprobacion' when v_baja then 'suspension' else 'rechazo' end::public.tipo_actividad,
          case when p_aprobar then 'Se dio de alta la veterinaria ' || c.nombre
               when v_baja then 'Se dio de baja la veterinaria ' || c.nombre || ': ' || v_motivo
               else 'Se rechazó la veterinaria ' || c.nombre || ': ' || v_motivo end,
          v_admin, c.creada_por, c.id);
  if c.creada_por is not null then
    if p_aprobar then
      perform private.notificar(c.creada_por, 'cuenta', 'Veterinaria aprobada',
        'Verificamos ' || c.nombre || '. Ya podés sumar a tus veterinarios y a tu equipo.');
    elsif v_baja then
      perform private.notificar(c.creada_por, 'cuenta', 'Veterinaria dada de baja',
        c.nombre || ' dejó de estar habilitada en PetCare: ' || v_motivo || '.');
    else
      perform private.notificar(c.creada_por, 'cuenta', 'Veterinaria rechazada',
        'No pudimos verificar ' || c.nombre || ': ' || v_motivo || '.');
    end if;
  end if;
end $$;

-- Los movimientos de veterinarias que ya estaban: se les busca la veterinaria por el nombre en el texto
update public.actividad_admin a
   set clinica_id = c.id
  from public.clinicas c
 where a.clinica_id is null
   and (a.texto = 'Se dio de alta la veterinaria ' || c.nombre or a.texto like 'Se rechazó la veterinaria ' || c.nombre || ': %');
