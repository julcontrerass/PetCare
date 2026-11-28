-- Bloqueos de agenda: el veterinario (o su recepción) marca cuándo no atiende y la base no deja sacar turnos ahí.
--  - Pausa fija por lugar (por ejemplo de 13 a 14 todos los días que atiende ahí): sedes.pausa_desde / pausa_hasta.
--  - Bloqueos puntuales (cirugía, enfermedad, viaje, feriado...): tabla bloqueos_agenda, con hora local de Argentina.
--    Al crearlo se puede cancelar los turnos que caen adentro: a los dueños les llega el aviso con el motivo.
--  - Turnos que se pisan: la base ya no deja que dos turnos pendientes del mismo veterinario se superpongan, sea en el
--    lugar que sea (antes lo controlaba solo la app del veterinario).
--  - Lugares que se pisan: el veterinario no puede tener dos lugares activos con días y horarios superpuestos.

-- ---------- Pausa por lugar ----------
alter table public.sedes
  add column pausa_desde time,
  add column pausa_hasta time,
  add constraint sedes_pausa check (
    (pausa_desde is null) = (pausa_hasta is null)
    and (pausa_desde is null or (pausa_desde < pausa_hasta and pausa_desde >= hora_apertura and pausa_hasta <= hora_cierre))
  );

-- ---------- Bloqueos puntuales ----------
create table public.bloqueos_agenda (
  id uuid primary key default gen_random_uuid(),
  veterinario_id uuid not null references public.profiles (id) on delete cascade,
  desde timestamp not null,
  hasta timestamp not null,
  motivo text not null check (length(trim(motivo)) between 2 and 120),
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (hasta > desde),
  check (hasta - desde <= interval '366 days')
);
create index bloqueos_agenda_vet on public.bloqueos_agenda (veterinario_id, hasta);
create index bloqueos_agenda_creado_por on public.bloqueos_agenda (creado_por);
alter table public.bloqueos_agenda enable row level security;
-- Lo ven el veterinario, su recepción y el administrador; se crean y se quitan solo con las funciones de abajo
create policy bloqueos_select on public.bloqueos_agenda for select to authenticated
  using (veterinario_id = (select auth.uid()) or private.es_recepcion_de(veterinario_id) or private.es_admin());
grant select on public.bloqueos_agenda to authenticated;

-- La hora local de Argentina, como la usan los turnos
create function private.ahora_local() returns timestamp language sql stable set search_path to '' as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::timestamp
$$;

-- Crea un bloqueo y devuelve los turnos pendientes que caen adentro (con el contacto del dueño). Con p_cancelar los
-- cancela: el aviso de cancelación del dueño lleva el motivo.
create function public.crear_bloqueo(p_veterinario uuid, p_desde timestamp, p_hasta timestamp, p_motivo text, p_cancelar boolean)
returns table (turno_id uuid, mascota text, dueno text, telefono text, fecha date, hora time, cancelado boolean)
language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_ids uuid[];
begin
  if v_uid is null or not (v_uid = p_veterinario or private.es_recepcion_de(p_veterinario)) then
    raise exception 'Solo el veterinario o su recepción pueden bloquear su agenda' using errcode = '42501';
  end if;
  if length(v_motivo) < 2 then
    raise exception 'Escribí el motivo del bloqueo' using errcode = 'P0001';
  end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then
    raise exception 'El final del bloqueo tiene que ser posterior al comienzo' using errcode = 'P0001';
  end if;
  if p_hasta <= private.ahora_local() then
    raise exception 'Ese horario ya pasó' using errcode = 'P0001';
  end if;
  if p_hasta - p_desde > interval '366 days' then
    raise exception 'Un bloqueo puede durar hasta un año' using errcode = 'P0001';
  end if;

  insert into public.bloqueos_agenda (veterinario_id, desde, hasta, motivo, creado_por)
  values (p_veterinario, p_desde, p_hasta, left(v_motivo, 120), v_uid);

  -- Los turnos pendientes que todavía no pasaron y se pisan con el bloqueo
  select coalesce(array_agg(t.id), '{}') into v_ids
    from public.turnos t
   where t.veterinario_id = p_veterinario and t.estado = 'pendiente'
     and (t.fecha + t.hora) < p_hasta
     and (t.fecha + t.hora + make_interval(mins => t.duracion_min::integer)) > p_desde
     and (t.fecha + t.hora) > private.ahora_local();

  if p_cancelar and cardinality(v_ids) > 0 then
    -- El aviso de cancelación (private.avisos_turno) agrega este motivo
    perform set_config('petcare.motivo_cancelacion', left(v_motivo, 120), true);
    update public.turnos set estado = 'cancelado' where id = any (v_ids);
    perform set_config('petcare.motivo_cancelacion', '', true);
  end if;

  return query
    select t.id, m.nombre, d.nombre, d.telefono, t.fecha, t.hora, t.estado = 'cancelado'
      from public.turnos t
      join public.mascotas m on m.id = t.mascota_id
      left join public.profiles d on d.id = m.dueno_id
     where t.id = any (v_ids)
     order by t.fecha, t.hora;
end $$;
revoke all on function public.crear_bloqueo(uuid, timestamp, timestamp, text, boolean) from public, anon;
grant execute on function public.crear_bloqueo(uuid, timestamp, timestamp, text, boolean) to authenticated;

create function public.eliminar_bloqueo(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_vet uuid;
begin
  select veterinario_id into v_vet from public.bloqueos_agenda where id = p_id;
  if not found then
    return;
  end if;
  if v_uid is null or not (v_uid = v_vet or private.es_recepcion_de(v_vet)) then
    raise exception 'Solo el veterinario o su recepción pueden quitar el bloqueo' using errcode = '42501';
  end if;
  delete from public.bloqueos_agenda where id = p_id;
end $$;
revoke all on function public.eliminar_bloqueo(uuid) from public, anon;
grant execute on function public.eliminar_bloqueo(uuid) to authenticated;

-- ---------- Horarios ocupados (lo que ve el dueño al sacar un turno): turnos, bloqueos y pausas ----------
create or replace function public.horarios_ocupados(p_veterinario uuid, p_fecha date)
returns table (hora time, duracion_min integer)
language sql stable security definer set search_path to '' as $$
  select x.hora, x.duracion_min from (
    select t.hora, t.duracion_min::integer as duracion_min
      from public.turnos t
     where t.veterinario_id = p_veterinario and t.fecha = p_fecha and t.estado = 'pendiente'
    union all
    select greatest(b.desde, p_fecha::timestamp)::time,
           (extract(epoch from (least(b.hasta, p_fecha::timestamp + interval '1 day') - greatest(b.desde, p_fecha::timestamp))) / 60)::integer
      from public.bloqueos_agenda b
     where b.veterinario_id = p_veterinario and b.desde < p_fecha::timestamp + interval '1 day' and b.hasta > p_fecha::timestamp
    union all
    select s.pausa_desde, (extract(epoch from (s.pausa_hasta - s.pausa_desde)) / 60)::integer
      from public.sedes s
     where s.veterinario_id = p_veterinario and s.activa and s.pausa_desde is not null
       and extract(isodow from p_fecha)::smallint = any (s.dias_atencion)
  ) x
  where (select auth.uid()) is not null
  order by x.hora
$$;

-- ---------- Lugares que se pisan ----------
-- Cuando el veterinario carga o cambia un lugar. Al sumarlo a una veterinaria se le crea un lugar con el horario
-- general: ese no se frena (fallaría el alta), pero se le avisa para que lo acomode; igual nunca va a tener dos
-- turnos a la misma hora, porque eso lo controla validar_turno.
create function private.validar_sede() returns trigger language plpgsql security definer set search_path to '' as $$
declare
  o public.sedes%rowtype;
begin
  if not new.activa then
    return new;
  end if;
  select * into o from public.sedes
   where veterinario_id = new.veterinario_id and id <> new.id and activa
     and dias_atencion && new.dias_atencion
     and new.hora_apertura < hora_cierre and hora_apertura < new.hora_cierre
   order by created_at limit 1;
  if not found then
    return new;
  end if;
  if tg_op = 'INSERT' and new.clinica_id is not null then
    perform private.notificar(new.veterinario_id, 'cuenta', 'Revisá tus horarios',
      'Te sumaron en ' || new.nombre || ' con un horario que se pisa con ' || o.nombre
      || '. Entrá a tu perfil y acomodá los días y horarios de cada lugar.');
    return new;
  end if;
  raise exception 'Se pisa con % (% a % hs): un mismo día no podés atender a la misma hora en dos lugares',
    o.nombre, to_char(o.hora_apertura, 'HH24:MI'), to_char(o.hora_cierre, 'HH24:MI')
    using errcode = 'P0001';
end $$;
create trigger sedes_sin_superponer before insert or update of dias_atencion, hora_apertura, hora_cierre, activa
  on public.sedes for each row execute function private.validar_sede();

