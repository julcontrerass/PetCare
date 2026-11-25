-- Recepcionistas: una cuenta trabaja para uno o varios veterinarios. Maneja sus agendas (sacar, mover y cancelar
-- turnos, marcar la llegada), responde los pedidos de acceso de los dueños y recibe los avisos importantes, pero no
-- ve nada clínico: informes, recetas, registros de salud ni estudios quedan solo para el veterinario.
--
-- El vínculo se arma desde cualquiera de los dos lados (el veterinario invita o el recepcionista pide) y siempre lo
-- acepta el otro. No pasa por el administrador: el veterinario responde por su recepción. Cualquiera de los dos
-- puede cortarlo cuando quiera.
--
-- La pieza central es private.es_recepcion_de(vet): las políticas que antes decían "veterinario_id = auth.uid()"
-- suman "o soy recepcionista activo de ese veterinario" solo donde corresponde.

-- ---------- Tablas ----------
create type public.estado_recepcion as enum ('pendiente', 'activo');
create type public.origen_recepcion as enum ('veterinario', 'recepcionista');

create table public.recepcionistas_vet (
  id uuid primary key default gen_random_uuid(),
  veterinario_id uuid not null references public.profiles (id) on delete cascade,
  recepcionista_id uuid not null references public.profiles (id) on delete cascade,
  estado public.estado_recepcion not null default 'pendiente',
  iniciado_por public.origen_recepcion not null,
  created_at timestamptz not null default now(),
  respondida_at timestamptz,
  unique (veterinario_id, recepcionista_id),
  check (veterinario_id <> recepcionista_id)
);
create index recepcionistas_vet_recepcionista on public.recepcionistas_vet (recepcionista_id);

-- Cada invitación, pedido, alta, rechazo y baja (la tabla de arriba solo guarda el estado actual).
create table public.recepcion_historial (
  id uuid primary key default gen_random_uuid(),
  veterinario_id uuid not null references public.profiles (id) on delete cascade,
  recepcionista_id uuid not null references public.profiles (id) on delete cascade,
  accion text not null check (accion in ('invitacion', 'pedido', 'alta', 'rechazo', 'baja')),
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index recepcion_historial_vet on public.recepcion_historial (veterinario_id, created_at desc);
create index recepcion_historial_recepcionista on public.recepcion_historial (recepcionista_id);
create index recepcion_historial_actor on public.recepcion_historial (actor);

alter table public.recepcionistas_vet enable row level security;
alter table public.recepcion_historial enable row level security;
-- Solo lectura desde la app: todos los cambios pasan por las funciones de abajo
revoke all on public.recepcionistas_vet, public.recepcion_historial from anon, authenticated;
grant select on public.recepcionistas_vet, public.recepcion_historial to authenticated;

create policy recepcionistas_select on public.recepcionistas_vet for select to authenticated
  using (veterinario_id = (select auth.uid()) or recepcionista_id = (select auth.uid()) or private.es_admin());
create policy solo_cuentas_activas on public.recepcionistas_vet as restrictive for all to authenticated
  using ((select private.cuenta_activa()));

create policy recepcion_historial_select on public.recepcion_historial for select to authenticated
  using (veterinario_id = (select auth.uid()) or recepcionista_id = (select auth.uid()) or private.es_admin());
create policy solo_cuentas_activas on public.recepcion_historial as restrictive for all to authenticated
  using ((select private.cuenta_activa()));

-- ---------- Quién atiende para quién ----------
-- La cuenta conectada es recepcionista activa de p_vet (y p_vet es un veterinario activo).
create or replace function private.es_recepcion_de(p_vet uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.recepcionistas_vet r
    where r.veterinario_id = p_vet and r.recepcionista_id = (select auth.uid()) and r.estado = 'activo'
  ) and private.es_vet_activo(p_vet) and private.cuenta_activa()
$$;

-- La cuenta conectada puede manejar la agenda de p_vet: es ese veterinario o su recepción.
create or replace function private.atiende_para(p_vet uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select (p_vet = (select auth.uid()) and private.es_vet_activo(p_vet)) or private.es_recepcion_de(p_vet)
$$;

-- Recepcionistas activas de un veterinario (para los avisos).
create or replace function private.recepcionistas_de(p_vet uuid)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select r.recepcionista_id
  from public.recepcionistas_vet r
  join public.profiles p on p.id = r.recepcionista_id and p.estado = 'activo'
  where r.veterinario_id = p_vet and r.estado = 'activo'
$$;

-- Como vet_tiene_acceso, pero para un veterinario dado (la recepción agenda en nombre de él).
create or replace function private.vet_tiene_acceso_de(p_vet uuid, p_mascota uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.accesos_mascota a
    where a.mascota_id = p_mascota and a.veterinario_id = p_vet and a.estado = 'activo'
      and private.acceso_vigente(a.vence_el) and private.es_vet_activo(a.veterinario_id)
  )
$$;

-- La recepción ve la ficha básica de las mascotas que su veterinario ve (no la historia clínica: esas tablas no la
-- incluyen en sus políticas).
create or replace function private.recep_puede_ver_mascota(p_mascota uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
    from public.accesos_mascota a
    join public.recepcionistas_vet r
      on r.veterinario_id = a.veterinario_id and r.recepcionista_id = (select auth.uid()) and r.estado = 'activo'
    where a.mascota_id = p_mascota and private.es_vet_activo(a.veterinario_id)
      and ((a.estado = 'activo' and private.acceso_vigente(a.vence_el))
           or (a.estado = 'pendiente' and a.iniciado_por = 'dueno'))
  )
$$;

-- La recepción ve el contacto de los dueños de esas mascotas.
create or replace function private.recep_ve_dueno(p_dueno uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
    from public.accesos_mascota a
    join public.recepcionistas_vet r
      on r.veterinario_id = a.veterinario_id and r.recepcionista_id = (select auth.uid()) and r.estado = 'activo'
    where private.cuenta_es_duena(a.mascota_id, p_dueno) and private.es_vet_activo(a.veterinario_id)
      and ((a.estado = 'activo' and private.acceso_vigente(a.vence_el))
           or (a.estado = 'pendiente' and a.iniciado_por = 'dueno'))
  )
$$;

-- El veterinario ve el perfil de quien está vinculado o pidió vincularse con él.
create or replace function private.vet_ve_recepcionista(p_cuenta uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.recepcionistas_vet
    where veterinario_id = (select auth.uid()) and recepcionista_id = p_cuenta
  )
$$;

revoke all on function
  private.es_recepcion_de(uuid), private.atiende_para(uuid), private.recepcionistas_de(uuid),
  private.vet_tiene_acceso_de(uuid, uuid), private.recep_puede_ver_mascota(uuid), private.recep_ve_dueno(uuid),
  private.vet_ve_recepcionista(uuid)
from public, anon;
grant execute on function
  private.es_recepcion_de(uuid), private.atiende_para(uuid), private.vet_tiene_acceso_de(uuid, uuid),
  private.recep_puede_ver_mascota(uuid), private.recep_ve_dueno(uuid), private.vet_ve_recepcionista(uuid)
to authenticated;

-- ---------- Turnos: llegada y quién hizo el último cambio ----------
alter table public.turnos
  add column llegada text check (llegada in ('en_espera', 'no_vino')),
  add column llegada_at timestamptz,
  add column gestionado_por uuid references public.profiles (id) on delete set null;
create index turnos_gestionado_por on public.turnos (gestionado_por);

grant select (llegada, llegada_at, gestionado_por) on public.turnos to authenticated;
grant update (llegada) on public.turnos to authenticated;

-- ---------- Políticas ----------
drop policy turnos_select on public.turnos;
create policy turnos_select on public.turnos for select to authenticated using (
  (veterinario_id = (select auth.uid())) or private.es_dueno_de(mascota_id) or private.es_recepcion_de(veterinario_id)
);

drop policy turnos_insert on public.turnos;
create policy turnos_insert on public.turnos for insert to authenticated with check (
  (creado_por = (select auth.uid())) and (
    private.es_dueno_de(mascota_id)
    or ((veterinario_id = (select auth.uid())) and private.vet_tiene_acceso(mascota_id))
    or (private.es_recepcion_de(veterinario_id) and private.vet_tiene_acceso_de(veterinario_id, mascota_id))
  )
);

drop policy turnos_update on public.turnos;
create policy turnos_update on public.turnos for update to authenticated
  using ((veterinario_id = (select auth.uid())) or private.es_dueno_de(mascota_id) or private.es_recepcion_de(veterinario_id))
  with check ((veterinario_id = (select auth.uid())) or private.es_dueno_de(mascota_id) or private.es_recepcion_de(veterinario_id));

drop policy mascotas_select on public.mascotas;
create policy mascotas_select on public.mascotas for select to authenticated using (
  (dueno_id = (select auth.uid()))
  or ((dueno_id is null) and (creada_por = (select auth.uid())))
  or private.es_dueno_de(id)
  or private.es_admin()
  or private.vet_puede_ver_mascota(id)
  or private.recep_puede_ver_mascota(id)
);

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  (id = (select auth.uid()))
  or private.es_admin()
  or private.es_vet_activo(id)
  or private.vet_ve_dueno(id)
  or private.dueno_ve_vet(id)
  or private.recep_ve_dueno(id)
  or private.vet_ve_recepcionista(id)
);

drop policy accesos_select on public.accesos_mascota;
create policy accesos_select on public.accesos_mascota for select to authenticated using (
  (veterinario_id = (select auth.uid())) or private.es_dueno_de(mascota_id) or private.es_admin()
  or private.es_recepcion_de(veterinario_id)
);

-- La recepción responde (acepta o rechaza) los pedidos que los dueños le hicieron a su veterinario
drop policy accesos_update on public.accesos_mascota;
create policy accesos_update on public.accesos_mascota for update to authenticated
  using (
    private.es_dueno_de(mascota_id)
    or (((veterinario_id = (select auth.uid())) or private.es_recepcion_de(veterinario_id))
        and (iniciado_por = 'dueno'::public.origen_solicitud) and (estado = 'pendiente'::public.estado_acceso))
  )
  with check (
    private.es_dueno_de(mascota_id)
    or (((veterinario_id = (select auth.uid())) or private.es_recepcion_de(veterinario_id))
        and (estado = any (array['activo'::public.estado_acceso, 'rechazado'::public.estado_acceso])))
  );

-- ---------- Validación de turnos ----------
-- Igual que antes, más: la recepción cuenta como el veterinario al cancelar, no puede completar un turno (eso es
-- de la consulta), la llegada solo la marca quien atiende y se anota quién hizo el último cambio.
create or replace function private.validar_turno()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v public.veterinarios%rowtype;
  s public.sedes%rowtype;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ahora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  v_uid uuid := (select auth.uid());
  v_es_recepcion boolean := private.es_recepcion_de(new.veterinario_id);
  v_actor_rol public.rol_usuario;
  v_tipo text;
  v_estado public.estado_mascota;
begin
  select case
           when p.rol = 'admin' then 'admin'
           when v_uid = new.veterinario_id or v_es_recepcion then 'veterinario'
           else 'dueno'
         end::public.rol_usuario
    into v_actor_rol
    from public.profiles p where p.id = v_uid;

  if v_uid is not null then
    new.gestionado_por := v_uid;
  end if;

  if tg_op = 'UPDATE' then
    if v_uid is not null and old.estado in ('completado', 'cancelado') and (
         new.estado is distinct from old.estado
         or new.fecha is distinct from old.fecha or new.hora is distinct from old.hora
         or new.veterinario_id is distinct from old.veterinario_id or new.sede_id is distinct from old.sede_id
         or new.mascota_id is distinct from old.mascota_id or new.categoria is distinct from old.categoria
         or new.motivo is distinct from old.motivo or new.notas is distinct from old.notas
         or new.llegada is distinct from old.llegada
       ) then
      raise exception 'Este turno ya fue %: no se puede modificar',
        case old.estado when 'completado' then 'completado' else 'cancelado' end
        using errcode = 'P0001';
    end if;
    if new.estado = 'completado' and old.estado <> 'completado' and v_uid is not null
       and v_uid is distinct from new.veterinario_id and v_es_recepcion then
      raise exception 'Solo el veterinario puede dar por completado un turno' using errcode = '42501';
    end if;
    if new.llegada is distinct from old.llegada then
      if v_uid is not null and v_uid is distinct from new.veterinario_id and not v_es_recepcion then
        raise exception 'Solo el veterinario o su recepción marcan la llegada' using errcode = '42501';
      end if;
      if new.llegada = 'en_espera' and new.fecha <> v_hoy then
        raise exception 'Solo se puede marcar la llegada de un turno de hoy' using errcode = 'P0001';
      end if;
      if new.llegada = 'no_vino' and new.fecha > v_hoy then
        raise exception 'Todavía no es el día del turno' using errcode = 'P0001';
      end if;
      new.llegada_at := case when new.llegada is null then null else now() end;
    end if;
    if new.estado = 'cancelado' and old.estado <> 'cancelado' then
      new.cancelado_por := v_actor_rol;
    end if;
    if new.estado <> 'pendiente' or (
         new.fecha = old.fecha and new.hora = old.hora
         and new.veterinario_id is not distinct from old.veterinario_id
         and new.sede_id is not distinct from old.sede_id
         and new.categoria = old.categoria
       ) then
      return new;
    end if;
    -- Si cambia el día o la hora, la llegada que se había marcado ya no vale
    new.llegada := null;
    new.llegada_at := null;
  elsif new.llegada is not null then
    raise exception 'La llegada se marca después de agendar el turno' using errcode = 'P0001';
  end if;

  if v_uid is null or new.veterinario_id is null then
    return new;
  end if;

  select estado into v_estado from public.mascotas where id = new.mascota_id;
  if v_estado is distinct from 'activa' then
    raise exception 'La mascota no está activa: no se pueden agendar turnos' using errcode = 'P0001';
  end if;

  select * into v from public.veterinarios where profile_id = new.veterinario_id;
  if not found or not private.es_vet_activo(new.veterinario_id) then
    raise exception 'El veterinario no está disponible' using errcode = 'P0001';
  end if;

  if new.fecha < v_hoy or (new.fecha = v_hoy and new.hora <= v_ahora) then
    raise exception 'No podés agendar un turno en una fecha u hora que ya pasó' using errcode = 'P0001';
  end if;

  if new.sede_id is not null then
    select * into s from public.sedes where id = new.sede_id and veterinario_id = new.veterinario_id and activa;
    if not found then
      raise exception 'Ese lugar de atención no está disponible' using errcode = 'P0001';
    end if;
  else
    select * into s from public.sedes
     where veterinario_id = new.veterinario_id and activa
       and extract(isodow from new.fecha)::smallint = any (dias_atencion)
       and new.hora >= hora_apertura
       and new.hora + make_interval(mins => new.duracion_min::integer) <= hora_cierre
     order by created_at limit 1;
    if found then
      new.sede_id := s.id;
    else
      select * into s from public.sedes where veterinario_id = new.veterinario_id
       order by activa desc, created_at limit 1;
      if not found then
        s.dias_atencion := v.dias_atencion;
        s.hora_apertura := v.hora_apertura;
        s.hora_cierre := v.hora_cierre;
      end if;
    end if;
  end if;

  if not (extract(isodow from new.fecha)::smallint = any (s.dias_atencion)) then
    raise exception 'El veterinario no atiende ese día en ese lugar' using errcode = 'P0001';
  end if;
  if new.hora < s.hora_apertura or new.hora + make_interval(mins => new.duracion_min::integer) > s.hora_cierre then
    raise exception 'El turno (% min) no entra en la atención del veterinario (% a %)',
      new.duracion_min, s.hora_apertura, s.hora_cierre
      using errcode = 'P0001';
  end if;

  -- Misma lista que TiposMascota en la app (y que la restricción de veterinarios.tipos_animales)
  select case lower(translate(trim(m.tipo), 'óÓ', 'oo'))
           when 'perro' then 'Perro' when 'gato' then 'Gato' when 'ave' then 'Ave'
           when 'reptil' then 'Reptil' when 'pez' then 'Pez' when 'roedor' then 'Roedor'
           when 'conejo' then 'Conejo' when 'huron' then 'Hurón' when 'caballo' then 'Caballo' when 'cerdo' then 'Cerdo'
           else 'Otro' end
    into v_tipo
    from public.mascotas m where m.id = new.mascota_id;
  if v_tipo is null or not (v_tipo = any (v.tipos_animales)) then
    raise exception 'Este veterinario no atiende ese tipo de mascota' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------- Avisos de turnos ----------
-- Igual que antes, más: la recepción recibe los mismos avisos que su veterinario, el veterinario se entera de quién
-- de la recepción hizo el cambio y la llegada a la sala de espera le avisa solo al veterinario.
create or replace function private.avisos_turno()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_mascota text;
  v_actor uuid := (select auth.uid());
  v_cuando text := to_char(new.fecha, 'DD/MM/YYYY') || ' ' || to_char(new.hora, 'HH24:MI');
  v_titulo text;
  v_mensaje text;
  v_tipo public.tipo_notificacion;
  v_dueno uuid;
  v_recepcion uuid;
  v_quien text;
  v_vet text;
begin
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;

  if v_actor is not null and private.cuenta_es_duena(new.mascota_id, v_actor) and new.veterinario_id is not null
     and (tg_op = 'INSERT' or new.veterinario_id is distinct from old.veterinario_id) then
    insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por)
    values (new.mascota_id, new.veterinario_id, 'activo', 'dueno')
    on conflict (mascota_id, veterinario_id) do update set estado = 'activo';
  end if;

  if tg_op = 'UPDATE' and new.llegada = 'en_espera' and old.llegada is distinct from 'en_espera'
     and new.estado = 'pendiente' then
    if new.veterinario_id is not null and new.veterinario_id is distinct from v_actor then
      perform private.notificar(new.veterinario_id, 'turno', 'Paciente en sala de espera',
        v_mascota || ' llegó para el turno de las ' || to_char(new.hora, 'HH24:MI') || ' (' || new.categoria || ')');
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_tipo := 'turno'; v_titulo := 'Nuevo turno';
    v_mensaje := v_mascota || ': ' || new.categoria || ' el ' || v_cuando;
  elsif new.estado = 'completado' and old.estado <> 'completado' then
    v_tipo := 'completado'; v_titulo := 'Turno finalizado';
    v_mensaje := v_mascota || ': el turno de ' || new.categoria || ' del ' || v_cuando || ' fue completado. Ya podés ver el detalle en el historial.';
  elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
    v_tipo := 'cancelacion'; v_titulo := 'Turno cancelado';
    v_mensaje := v_mascota || ': se canceló el turno de ' || new.categoria || ' del ' || v_cuando;
  elsif new.estado = 'pendiente' and (new.fecha <> old.fecha or new.hora <> old.hora) then
    v_tipo := 'turno'; v_titulo := 'Turno modificado';
    v_mensaje := v_mascota || ': ' || new.categoria || ' pasó al ' || v_cuando;
  elsif new.estado = 'pendiente' and new.veterinario_id is distinct from old.veterinario_id then
    v_tipo := 'turno'; v_titulo := 'Nuevo turno';
    v_mensaje := v_mascota || ': ' || new.categoria || ' el ' || v_cuando;
  else
    return new;
  end if;

  if v_actor is null then return new; end if;
  for v_dueno in select private.duenos_de(new.mascota_id) loop
    perform private.notificar(v_dueno, v_tipo, v_titulo, v_mensaje);
  end loop;
  if new.veterinario_id is not null and v_tipo <> 'completado' then
    if new.veterinario_id <> v_actor then
      if private.es_recepcion_de(new.veterinario_id) then
        select nombre into v_quien from public.profiles where id = v_actor;
        perform private.notificar(new.veterinario_id, v_tipo, v_titulo,
          v_mensaje || ' (recepción: ' || coalesce(v_quien, 'sin nombre') || ')');
      else
        perform private.notificar(new.veterinario_id, v_tipo, v_titulo, v_mensaje);
      end if;
    end if;
    select nombre into v_vet from public.profiles where id = new.veterinario_id;
    for v_recepcion in select private.recepcionistas_de(new.veterinario_id) loop
      if v_recepcion is distinct from v_actor then
        perform private.notificar(v_recepcion, v_tipo, v_titulo, coalesce(v_vet, 'Veterinario') || ' · ' || v_mensaje);
      end if;
    end loop;
  end if;
  return new;
end $$;

-- ---------- Avisos de accesos ----------
-- Igual que antes, más: los pedidos de los dueños también le llegan a la recepción del veterinario.
create or replace function private.avisos_acceso()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_mascota text;
  v_vet text;
  v_actor uuid := (select auth.uid());
  v_dueno uuid;
  v_recepcion uuid;
begin
  if v_actor is null then return new; end if;
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;
  select nombre into v_vet from public.profiles where id = new.veterinario_id;

  if new.estado = 'pendiente' and (tg_op = 'INSERT' or old.estado is distinct from 'pendiente') then
    if new.iniciado_por = 'veterinario' then
      for v_dueno in select private.duenos_de(new.mascota_id) loop
        perform private.notificar(v_dueno, 'acceso', 'Solicitud de acceso', v_vet || ' pide acceso a ' || v_mascota);
      end loop;
    else
      perform private.notificar(new.veterinario_id, 'acceso', 'Nueva solicitud', 'Un dueño quiere compartirte a ' || v_mascota);
      for v_recepcion in select private.recepcionistas_de(new.veterinario_id) loop
        perform private.notificar(v_recepcion, 'acceso', 'Nueva solicitud',
          'Un dueño quiere compartirle a ' || coalesce(v_vet, 'tu veterinario') || ' a ' || v_mascota);
      end loop;
    end if;
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if private.cuenta_es_duena(new.mascota_id, v_actor) then
      perform private.notificar(new.veterinario_id, 'acceso', 'Acceso actualizado',
        'El acceso a ' || v_mascota || ' ahora está: ' || new.estado);
    else
      for v_dueno in select private.duenos_de(new.mascota_id) loop
        perform private.notificar(v_dueno, 'acceso', 'Acceso actualizado',
          v_vet || ' respondió: ' || new.estado || ' (' || v_mascota || ')');
      end loop;
      if v_actor <> new.veterinario_id then
        perform private.notificar(new.veterinario_id, 'acceso', 'Acceso actualizado',
          'Tu recepción respondió el pedido de ' || v_mascota || ': ' || new.estado);
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------- Funciones que la recepción usa en nombre del veterinario ----------
-- Pedir acceso a una mascota: el veterinario para sí mismo o la recepción para su veterinario (p_veterinario).
drop function public.solicitar_acceso(uuid, jsonb);
create function public.solicitar_acceso(p_mascota uuid, p_turno jsonb default null, p_veterinario uuid default null)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_vet uuid := coalesce(p_veterinario, v_uid);
  a public.accesos_mascota%rowtype;
begin
  if v_vet = v_uid then
    if not private.es_vet_activo(v_uid) then
      raise exception 'Solo un veterinario activo puede pedir acceso' using errcode = '42501';
    end if;
  elsif not private.es_recepcion_de(v_vet) then
    raise exception 'No atendés para ese veterinario' using errcode = '42501';
  end if;
  if not exists (select 1 from public.mascotas where id = p_mascota and dueno_id is not null and activa) then
    raise exception 'La mascota no está disponible' using errcode = 'P0001';
  end if;
  if private.cuenta_es_duena(p_mascota, v_vet) then
    raise exception 'Esa mascota es del veterinario: la ve desde el modo dueño' using errcode = 'P0001';
  end if;
  select * into a from public.accesos_mascota where mascota_id = p_mascota and veterinario_id = v_vet;
  if not found then
    insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por, turno_propuesto)
    values (p_mascota, v_vet, 'pendiente', 'veterinario', p_turno);
    return 'pendiente';
  elsif a.estado in ('pendiente', 'activo') then
    if a.estado = 'pendiente' and p_turno is not null then
      update public.accesos_mascota set turno_propuesto = p_turno where id = a.id;
    end if;
    return a.estado::text;
  elsif a.updated_at > now() - interval '24 hours' then
    raise exception 'Esperá 24 horas para volver a pedir acceso a esta mascota' using errcode = 'P0001';
  end if;
  update public.accesos_mascota
     set estado = 'pendiente', iniciado_por = 'veterinario', turno_propuesto = p_turno
   where id = a.id;
  return 'pendiente';
end $$;

-- Solicitudes de un veterinario: las propias o, con p_veterinario, las de un veterinario para el que se atiende.
drop function public.mis_solicitudes();
create function public.mis_solicitudes(p_veterinario uuid default null)
returns table (id uuid, mascota_nombre text, mascota_tipo text, dueno_nombre text, estado text, iniciado_por text,
               created_at timestamptz, dueno_foto_path text)
language sql stable security definer set search_path to '' as $$
  select a.id, m.nombre, m.tipo, p.nombre, a.estado::text, a.iniciado_por::text, a.created_at, p.foto_path
    from public.accesos_mascota a
    join public.mascotas m on m.id = a.mascota_id
    left join public.profiles p on p.id = m.dueno_id
   where a.veterinario_id = coalesce(p_veterinario, (select auth.uid()))
     and (select auth.uid()) is not null
     and (p_veterinario is null or private.atiende_para(p_veterinario))
     and (a.iniciado_por = 'veterinario' or a.estado = 'pendiente')
   order by a.created_at desc
$$;

-- Buscar un dueño por DNI o correo: también lo puede hacer la recepción (para cargar dueños en el mostrador).
create or replace function public.buscar_dueno(p_dato text)
returns table (id uuid, nombre text, telefono text, email text, mascotas jsonb)
language sql stable security definer set search_path to '' as $$
  select p.id, p.nombre, p.telefono, p.email,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'tipo', m.tipo, 'raza', m.raza) order by m.nombre)
      from public.mascotas m where m.activa and private.cuenta_es_duena(m.id, p.id)
    ), '[]'::jsonb)
  from public.profiles p
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where p.rol in ('dueno', 'veterinario') and p.estado = 'activo'
    and p.id <> (select auth.uid())
    and (
      private.es_vet_activo((select auth.uid()))
      or exists (
        select 1 from public.recepcionistas_vet r
        where r.recepcionista_id = (select auth.uid()) and r.estado = 'activo' and private.es_vet_activo(r.veterinario_id)
      )
    )
    and length(trim(p_dato)) >= 6
    and (lower(p.email) = lower(trim(p_dato)) or pp.dni = trim(p_dato))
$$;

revoke all on function public.solicitar_acceso(uuid, jsonb, uuid), public.mis_solicitudes(uuid) from public, anon;
grant execute on function public.solicitar_acceso(uuid, jsonb, uuid), public.mis_solicitudes(uuid) to authenticated;

-- ---------- Armar y cortar el vínculo ----------
-- Busca una cuenta activa (dueño o veterinario) por correo o DNI; con p_con_matricula también por matrícula.
create or replace function private.cuenta_por_dato(p_dato text, p_con_matricula boolean)
returns uuid language sql stable security definer set search_path to '' as $$
  select p.id
  from public.profiles p
  left join public.perfiles_privados pp on pp.profile_id = p.id
  left join public.veterinarios v on v.profile_id = p.id
  where p.rol in ('dueno', 'veterinario') and p.estado = 'activo'
    and (lower(p.email) = lower(trim(p_dato)) or pp.dni = trim(p_dato)
         or (p_con_matricula and upper(v.matricula) = upper(trim(p_dato))))
  limit 1
$$;
revoke all on function private.cuenta_por_dato(text, boolean) from public, anon, authenticated;

-- Deja un vínculo pendiente (o lo activa si el otro ya lo había pedido). Devuelve 'pendiente' o 'activo'.
create or replace function private.proponer_vinculo_recepcion(p_vet uuid, p_recepcionista uuid, p_origen public.origen_recepcion)
returns text language plpgsql security definer set search_path to '' as $$
declare
  r public.recepcionistas_vet%rowtype;
  v_uid uuid := (select auth.uid());
  v_quien text;
  v_destino uuid := case p_origen when 'veterinario' then p_recepcionista else p_vet end;
  v_existe boolean;
begin
  select * into r from public.recepcionistas_vet where veterinario_id = p_vet and recepcionista_id = p_recepcionista;
  v_existe := found;
  if v_existe and r.estado = 'activo' then
    raise exception 'Ya están vinculados' using errcode = 'P0001';
  end if;
  select nombre into v_quien from public.profiles where id = v_uid;

  if v_existe and r.iniciado_por <> p_origen then
    -- El otro ya lo había pedido: esto es aceptar
    update public.recepcionistas_vet set estado = 'activo', respondida_at = now() where id = r.id;
    insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
    values (p_vet, p_recepcionista, 'alta', v_uid);
    perform private.notificar(v_destino, 'cuenta', 'Recepción vinculada',
      coalesce(v_quien, 'La otra persona') || ' aceptó el vínculo de recepción.');
    return 'activo';
  end if;

  if (p_origen = 'veterinario' and (select count(*) from public.recepcionistas_vet where veterinario_id = p_vet) >= 10)
     or (p_origen = 'recepcionista' and (select count(*) from public.recepcionistas_vet where recepcionista_id = p_recepcionista) >= 20) then
    raise exception 'Llegaste al máximo de vínculos de recepción' using errcode = 'P0001';
  end if;

  insert into public.recepcionistas_vet (veterinario_id, recepcionista_id, estado, iniciado_por)
  values (p_vet, p_recepcionista, 'pendiente', p_origen)
  on conflict (veterinario_id, recepcionista_id) do update set created_at = now();
  insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
  values (p_vet, p_recepcionista, case p_origen when 'veterinario' then 'invitacion' else 'pedido' end, v_uid);

  if p_origen = 'veterinario' then
    perform private.notificar(v_destino, 'cuenta', 'Te invitaron a una recepción',
      coalesce(v_quien, 'Un veterinario') || ' te invitó a manejar su agenda como recepcionista. Aceptá desde tu Inicio.');
  else
    perform private.notificar(v_destino, 'cuenta', 'Pedido de recepción',
      coalesce(v_quien, 'Alguien') || ' pide manejar tu agenda como recepcionista. Respondé desde Perfil → Recepción.');
  end if;
  return 'pendiente';
end $$;
revoke all on function private.proponer_vinculo_recepcion(uuid, uuid, public.origen_recepcion) from public, anon, authenticated;

-- El veterinario invita a una cuenta (por correo o DNI) a ser su recepcionista.
create or replace function public.invitar_recepcionista(p_dato text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cuenta uuid;
begin
  if v_uid is null or not private.es_vet_activo(v_uid) then
    raise exception 'Solo un veterinario activo puede invitar recepcionistas' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_dato, ''))) < 6 then
    raise exception 'Ingresá un DNI o un correo válido' using errcode = 'P0001';
  end if;
  v_cuenta := private.cuenta_por_dato(p_dato, false);
  if v_cuenta is null then
    raise exception 'No encontramos una cuenta con ese DNI o correo. La otra persona tiene que registrarse primero en PetCare.' using errcode = 'P0001';
  end if;
  if v_cuenta = v_uid then
    raise exception 'No podés ser tu propio recepcionista' using errcode = 'P0001';
  end if;
  return private.proponer_vinculo_recepcion(v_uid, v_cuenta, 'veterinario');
end $$;

-- Una cuenta pide ser recepcionista de un veterinario (lo busca por correo, DNI o matrícula).
create or replace function public.pedir_ser_recepcionista(p_dato text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_vet uuid;
begin
  if v_uid is null or not private.cuenta_activa()
     or not exists (select 1 from public.profiles where id = v_uid and rol in ('dueno', 'veterinario')) then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_dato, ''))) < 3 then
    raise exception 'Ingresá el correo, el DNI o la matrícula del veterinario' using errcode = 'P0001';
  end if;
  v_vet := private.cuenta_por_dato(p_dato, true);
  if v_vet is null or not private.es_vet_activo(v_vet) then
    raise exception 'No encontramos un veterinario activo con ese dato' using errcode = 'P0001';
  end if;
  if v_vet = v_uid then
    raise exception 'No podés ser tu propio recepcionista' using errcode = 'P0001';
  end if;
  return private.proponer_vinculo_recepcion(v_vet, v_uid, 'recepcionista');
end $$;

-- Acepta o rechaza un vínculo pendiente: solo el lado que no lo inició.
create or replace function public.responder_vinculo_recepcion(p_vinculo uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  r public.recepcionistas_vet%rowtype;
  v_quien text;
  v_otro uuid;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into r from public.recepcionistas_vet
   where id = p_vinculo and estado = 'pendiente'
     and ((iniciado_por = 'veterinario' and recepcionista_id = v_uid)
          or (iniciado_por = 'recepcionista' and veterinario_id = v_uid));
  if not found then
    raise exception 'El pedido ya no está disponible' using errcode = 'P0001';
  end if;
  if p_aceptar and not private.es_vet_activo(r.veterinario_id) then
    raise exception 'El veterinario no está activo' using errcode = 'P0001';
  end if;
  v_otro := case when v_uid = r.veterinario_id then r.recepcionista_id else r.veterinario_id end;
  select nombre into v_quien from public.profiles where id = v_uid;

  if p_aceptar then
    update public.recepcionistas_vet set estado = 'activo', respondida_at = now() where id = r.id;
    insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
    values (r.veterinario_id, r.recepcionista_id, 'alta', v_uid);
    perform private.notificar(v_otro, 'cuenta', 'Recepción vinculada',
      coalesce(v_quien, 'La otra persona') || ' aceptó el vínculo de recepción.');
  else
    delete from public.recepcionistas_vet where id = r.id;
    insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
    values (r.veterinario_id, r.recepcionista_id, 'rechazo', v_uid);
    perform private.notificar(v_otro, 'cuenta', 'Pedido de recepción rechazado',
      coalesce(v_quien, 'La otra persona') || ' no aceptó el vínculo de recepción.');
  end if;
end $$;

-- Corta un vínculo (activo o pendiente): cualquiera de los dos lados, o el administrador.
create or replace function public.quitar_vinculo_recepcion(p_vinculo uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  r public.recepcionistas_vet%rowtype;
  v_quien text;
  v_otro uuid;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into r from public.recepcionistas_vet
   where id = p_vinculo and (veterinario_id = v_uid or recepcionista_id = v_uid or private.es_admin());
  if not found then
    raise exception 'El vínculo ya no existe' using errcode = 'P0001';
  end if;
  delete from public.recepcionistas_vet where id = r.id;
  insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
  values (r.veterinario_id, r.recepcionista_id, 'baja', v_uid);

  select nombre into v_quien from public.profiles where id = v_uid;
  for v_otro in select unnest(array[r.veterinario_id, r.recepcionista_id]) loop
    if v_otro <> v_uid then
      perform private.notificar(v_otro, 'cuenta', 'Recepción desvinculada',
        coalesce(v_quien, 'La otra persona') || ' terminó el vínculo de recepción.');
    end if;
  end loop;
end $$;

-- Vínculos de la cuenta, de los dos lados: como veterinario (su recepción) y como recepcionista (sus veterinarios).
create or replace function public.mis_vinculos_recepcion()
returns table (id uuid, soy text, otra_cuenta_id uuid, nombre text, email text, telefono text, foto_path text,
               clinica text, estado text, iniciado_por text, me_toca_responder boolean, created_at timestamptz,
               respondida_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select r.id,
         case when r.veterinario_id = (select auth.uid()) then 'veterinario' else 'recepcionista' end,
         o.id, o.nombre, o.email, o.telefono, o.foto_path, v.clinica, r.estado::text, r.iniciado_por::text,
         r.estado = 'pendiente' and (
           (r.iniciado_por = 'veterinario' and r.recepcionista_id = (select auth.uid()))
           or (r.iniciado_por = 'recepcionista' and r.veterinario_id = (select auth.uid()))
         ),
         r.created_at, r.respondida_at
  from public.recepcionistas_vet r
  join public.profiles o
    on o.id = case when r.veterinario_id = (select auth.uid()) then r.recepcionista_id else r.veterinario_id end
  left join public.veterinarios v on v.profile_id = r.veterinario_id and r.veterinario_id <> (select auth.uid())
  where (r.veterinario_id = (select auth.uid()) or r.recepcionista_id = (select auth.uid()))
    and private.cuenta_activa()
  order by r.estado, r.created_at desc
$$;

revoke all on function
  public.invitar_recepcionista(text), public.pedir_ser_recepcionista(text),
  public.responder_vinculo_recepcion(uuid, boolean), public.quitar_vinculo_recepcion(uuid),
  public.mis_vinculos_recepcion()
from public, anon;
grant execute on function
  public.invitar_recepcionista(text), public.pedir_ser_recepcionista(text),
  public.responder_vinculo_recepcion(uuid, boolean), public.quitar_vinculo_recepcion(uuid),
  public.mis_vinculos_recepcion()
to authenticated;
