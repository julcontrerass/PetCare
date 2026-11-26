-- Veterinarias (clínicas) con miembros y roles. Reemplaza el vínculo directo recepcionista–veterinario.
--
-- - Una veterinaria tiene miembros; cada miembro tiene uno o varios roles: titular, administrador, veterinario y
--   recepción. Una cuenta puede estar en varias veterinarias (un veterinario que atiende en dos lugares, una
--   recepcionista que trabaja para dos clínicas).
-- - Permisos por rol (private.permiso_en): equipo (titular, administrador), agenda de todos los veterinarios de la
--   veterinaria (titular, administrador, recepción), ventas (todos) y stock (titular, administrador, recepción).
--   Ventas y stock quedan listos para las pantallas que vengan.
-- - El veterinario independiente es una veterinaria de un solo miembro: a cada veterinario existente se le crea la
--   suya (titular + veterinario) y los nuevos la reciben al registrarse.
-- - A la recepción la suma siempre una veterinaria (invitación o cuenta creada por ella): se quita el registro como
--   recepcionista y el pedido de vínculo.
-- - private.es_recepcion_de(vet) sigue existiendo con el mismo nombre (lo usan las políticas de turnos, mascotas,
--   accesos y perfiles) pero ahora significa: "la cuenta conectada maneja la agenda de una veterinaria en la que ese
--   veterinario atiende". La historia clínica no cambia: la recepción no la ve.

-- ---------- Tablas ----------
create type public.rol_clinica as enum ('titular', 'administrador', 'veterinario', 'recepcion');

create table public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 2 and 120),
  direccion text,
  telefono text,
  creada_por uuid references public.profiles (id) on delete set null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create index clinicas_creada_por on public.clinicas (creada_por);

create table public.clinica_miembros (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  cuenta_id uuid not null references public.profiles (id) on delete cascade,
  roles public.rol_clinica[] not null check (cardinality(roles) > 0),
  estado public.estado_recepcion not null default 'pendiente',
  invitado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  respondida_at timestamptz,
  unique (clinica_id, cuenta_id)
);
create index clinica_miembros_cuenta on public.clinica_miembros (cuenta_id);
create index clinica_miembros_invitado_por on public.clinica_miembros (invitado_por);

create table public.clinica_historial (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  cuenta_id uuid references public.profiles (id) on delete set null,
  accion text not null check (accion in ('creacion', 'invitacion', 'alta', 'rechazo', 'baja', 'roles')),
  detalle text,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index clinica_historial_clinica on public.clinica_historial (clinica_id, created_at desc);
create index clinica_historial_cuenta on public.clinica_historial (cuenta_id);
create index clinica_historial_actor on public.clinica_historial (actor);

-- Las sedes pasan a ser de la veterinaria (por ahora siguen atadas también al veterinario que atiende en ellas)
alter table public.sedes add column clinica_id uuid references public.clinicas (id) on delete set null;
create index sedes_clinica on public.sedes (clinica_id);

alter table public.clinicas enable row level security;
alter table public.clinica_miembros enable row level security;
alter table public.clinica_historial enable row level security;
-- Solo lectura desde la app: los cambios pasan por las funciones de abajo
revoke all on public.clinicas, public.clinica_miembros, public.clinica_historial from anon, authenticated;
grant select on public.clinicas, public.clinica_miembros, public.clinica_historial to authenticated;

-- ---------- Quién es quién en cada veterinaria ----------
-- La cuenta conectada es miembro activo de la veterinaria (cualquier rol).
create or replace function private.es_miembro(p_clinica uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa
    where m.clinica_id = p_clinica and m.cuenta_id = (select auth.uid()) and m.estado = 'activo'
  ) and private.cuenta_activa()
$$;

-- La cuenta conectada tiene ese permiso en la veterinaria: 'equipo', 'agenda', 'ventas' o 'stock'.
create or replace function private.permiso_en(p_clinica uuid, p_permiso text)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.cuenta_activa() and exists (
    select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa
    where m.clinica_id = p_clinica and m.cuenta_id = (select auth.uid()) and m.estado = 'activo'
      and m.roles && case p_permiso
        when 'equipo' then array['titular', 'administrador']::public.rol_clinica[]
        when 'agenda' then array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
        when 'ventas' then array['titular', 'administrador', 'recepcion', 'veterinario']::public.rol_clinica[]
        when 'stock' then array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
        else array[]::public.rol_clinica[] end
  )
$$;

-- La cuenta conectada maneja la agenda de una veterinaria en la que atiende p_vet (y p_vet es otra persona).
create or replace function private.es_recepcion_de(p_vet uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select p_vet is distinct from (select auth.uid()) and exists (
    select 1
    from public.clinica_miembros yo
    join public.clinicas c on c.id = yo.clinica_id and c.activa
    join public.clinica_miembros v on v.clinica_id = yo.clinica_id
    where yo.cuenta_id = (select auth.uid()) and yo.estado = 'activo'
      and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
      and v.cuenta_id = p_vet and v.estado = 'activo' and 'veterinario' = any (v.roles)
  ) and private.es_vet_activo(p_vet) and private.cuenta_activa()
$$;

-- Quienes manejan la agenda de p_vet en alguna de sus veterinarias (para los avisos).
create or replace function private.recepcionistas_de(p_vet uuid)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select distinct yo.cuenta_id
  from public.clinica_miembros v
  join public.clinicas c on c.id = v.clinica_id and c.activa
  join public.clinica_miembros yo on yo.clinica_id = v.clinica_id
  join public.profiles p on p.id = yo.cuenta_id and p.estado = 'activo'
  where v.cuenta_id = p_vet and v.estado = 'activo' and 'veterinario' = any (v.roles)
    and yo.estado = 'activo' and yo.cuenta_id <> p_vet
    and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
$$;

create or replace function private.recep_puede_ver_mascota(p_mascota uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.accesos_mascota a
    where a.mascota_id = p_mascota and private.es_recepcion_de(a.veterinario_id)
      and ((a.estado = 'activo' and private.acceso_vigente(a.vence_el))
           or (a.estado = 'pendiente' and a.iniciado_por = 'dueno'))
  )
$$;

create or replace function private.recep_ve_dueno(p_dueno uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.accesos_mascota a
    where private.cuenta_es_duena(a.mascota_id, p_dueno) and private.es_recepcion_de(a.veterinario_id)
      and ((a.estado = 'activo' and private.acceso_vigente(a.vence_el))
           or (a.estado = 'pendiente' and a.iniciado_por = 'dueno'))
  )
$$;

-- (Mismo nombre que antes, lo usa profiles_select.) La cuenta conectada es miembro activo de una veterinaria en la
-- que está p_cuenta: se ven los perfiles del equipo, también los invitados que todavía no aceptaron.
create or replace function private.vet_ve_recepcionista(p_cuenta uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
    from public.clinica_miembros yo
    join public.clinica_miembros otro on otro.clinica_id = yo.clinica_id
    where yo.cuenta_id = (select auth.uid()) and yo.estado = 'activo' and otro.cuenta_id = p_cuenta
  )
$$;

revoke all on function private.es_miembro(uuid), private.permiso_en(uuid, text) from public, anon;
grant execute on function private.es_miembro(uuid), private.permiso_en(uuid, text) to authenticated;

create policy clinicas_select on public.clinicas for select to authenticated using (
  exists (select 1 from public.clinica_miembros m where m.clinica_id = clinicas.id and m.cuenta_id = (select auth.uid()))
  or private.es_admin()
);
create policy solo_cuentas_activas on public.clinicas as restrictive for all to authenticated using ((select private.cuenta_activa()));
create policy clinica_miembros_select on public.clinica_miembros for select to authenticated using (
  cuenta_id = (select auth.uid()) or private.es_miembro(clinica_id) or private.es_admin()
);
create policy solo_cuentas_activas on public.clinica_miembros as restrictive for all to authenticated using ((select private.cuenta_activa()));
create policy clinica_historial_select on public.clinica_historial for select to authenticated using (
  private.permiso_en(clinica_id, 'equipo') or private.es_admin()
);
create policy solo_cuentas_activas on public.clinica_historial as restrictive for all to authenticated using ((select private.cuenta_activa()));

-- ---------- Datos que ya existían ----------
-- Cada veterinario recibe su veterinaria (con el nombre de su clínica o "Consultorio de ...") y queda como titular
insert into public.clinicas (nombre, direccion, telefono, creada_por)
select left(coalesce(nullif(trim(v.clinica), ''), 'Consultorio de ' || p.nombre), 120), v.direccion_clinica, p.telefono, p.id
from public.veterinarios v join public.profiles p on p.id = v.profile_id;

insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
select c.id, c.creada_por, array['titular', 'veterinario']::public.rol_clinica[], 'activo', now()
from public.clinicas c;

insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor)
select c.id, c.creada_por, 'creacion', c.creada_por from public.clinicas c;

update public.sedes s set clinica_id = c.id from public.clinicas c where c.creada_por = s.veterinario_id;

-- La recepción que ya existía pasa a ser miembro (con rol recepción) de la veterinaria de su veterinario
insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, invitado_por, created_at, respondida_at)
select c.id, r.recepcionista_id, array['recepcion']::public.rol_clinica[], r.estado,
       case r.iniciado_por when 'veterinario' then r.veterinario_id end, r.created_at, r.respondida_at
from public.recepcionistas_vet r join public.clinicas c on c.creada_por = r.veterinario_id
on conflict (clinica_id, cuenta_id) do nothing;

-- ---------- Lo que deja de usarse ----------
drop function public.invitar_recepcionista(text);
drop function public.pedir_ser_recepcionista(text);
drop function public.responder_vinculo_recepcion(uuid, boolean);
drop function public.quitar_vinculo_recepcion(uuid);
drop function public.mis_vinculos_recepcion();
drop function public.vincular_cuenta_recepcionista(uuid, uuid);
drop function public.veterinario_para_recepcion(text);
drop function private.proponer_vinculo_recepcion(uuid, uuid, public.origen_recepcion);
drop table public.recepcion_historial;
drop table public.recepcionistas_vet;
drop type public.origen_recepcion;

-- Buscar un dueño por DNI o correo: el veterinario o quien maneja la agenda de una veterinaria
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
        select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa
        where m.cuenta_id = (select auth.uid()) and m.estado = 'activo'
          and m.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
      )
    )
    and length(trim(p_dato)) >= 6
    and (lower(p.email) = lower(trim(p_dato)) or pp.dni = trim(p_dato))
$$;

-- ---------- Alta de usuarios ----------
-- Como antes (sin el pedido de recepción del registro); al veterinario nuevo se le crea su veterinaria.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol public.rol_usuario := case m->>'rol' when 'veterinario' then 'veterinario' else 'dueno' end;
  v_dni text := nullif(trim(m->>'dni'), '');
  v_masc jsonb;
  v_chip text;
  v_sede jsonb;
  v_nombre text;
  v_ap time;
  v_ci time;
  v_clinica uuid;
begin
  if v_dni is not null and v_dni !~ '^[0-9]{7,8}$' then
    raise exception 'El DNI debe tener 7 u 8 números' using errcode = 'P0001';
  end if;
  if v_dni is not null and exists (select 1 from public.perfiles_privados where dni = v_dni) then
    raise exception 'Ese DNI ya está registrado' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, rol, estado, nombre, email, telefono, direccion, terminos_version, terminos_aceptados_at)
  values (
    new.id, v_rol,
    case when v_rol = 'veterinario' then 'pendiente_revision' else 'activo' end::public.estado_cuenta,
    coalesce(nullif(trim(m->>'nombre'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(m->>'telefono', ''),
    nullif(m->>'direccion', ''),
    nullif(m->>'terminos_version', ''),
    case when nullif(m->>'terminos_version', '') is not null then now() end
  );
  insert into public.perfiles_privados (profile_id, dni) values (new.id, v_dni);

  if v_rol = 'veterinario' then
    insert into public.veterinarios (
      profile_id, matricula, clinica, direccion_clinica, dias_atencion, hora_apertura, hora_cierre,
      especialidades, tipos_animales, duraciones
    )
    values (
      new.id,
      coalesce(nullif(trim(m->>'matricula'), ''), 'SIN-' || left(new.id::text, 8)),
      nullif(m->>'clinica', ''),
      nullif(m->>'direccion_clinica', ''),
      case when jsonb_typeof(m->'dias_atencion') = 'array'
        then array(select jsonb_array_elements_text(m->'dias_atencion')::smallint)
        else '{1,2,3,4,5}'::smallint[] end,
      coalesce(nullif(m->>'hora_apertura', '')::time, '09:00'::time),
      coalesce(nullif(m->>'hora_cierre', '')::time, '18:00'::time),
      case when jsonb_typeof(m->'especialidades') = 'array'
        then array(select jsonb_array_elements_text(m->'especialidades'))
        else '{}'::text[] end,
      case when jsonb_typeof(m->'tipos_animales') = 'array'
        then array(select jsonb_array_elements_text(m->'tipos_animales'))
        else array['Perro','Gato','Ave','Reptil','Pez','Roedor','Otro'] end,
      case when jsonb_typeof(m->'duraciones') = 'object' then m->'duraciones' else '{}'::jsonb end
    );

    -- Su veterinaria: con el nombre de la clínica que cargó o "Consultorio de ..."
    insert into public.clinicas (nombre, direccion, telefono, creada_por)
    values (
      left(coalesce(nullif(trim(m->>'clinica'), ''), 'Consultorio de ' || coalesce(nullif(trim(m->>'nombre'), ''), split_part(new.email, '@', 1))), 120),
      nullif(m->>'direccion_clinica', ''), nullif(m->>'telefono', ''), new.id
    )
    returning id into v_clinica;
    insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
    values (v_clinica, new.id, array['titular', 'veterinario']::public.rol_clinica[], 'activo', now());
    insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (v_clinica, new.id, 'creacion', new.id);

    -- Los demás lugares de atención (el primero lo crea solo la fila de veterinarios)
    if jsonb_typeof(m->'sedes') = 'array' then
      for v_sede in select * from jsonb_array_elements(m->'sedes') limit 2 loop
        v_nombre := nullif(trim(v_sede->>'nombre'), '');
        v_ap := coalesce(nullif(v_sede->>'hora_apertura', '')::time, '09:00'::time);
        v_ci := coalesce(nullif(v_sede->>'hora_cierre', '')::time, '18:00'::time);
        if v_nombre is null or v_ci <= v_ap then
          continue;
        end if;
        insert into public.sedes (veterinario_id, nombre, direccion, dias_atencion, hora_apertura, hora_cierre)
        values (
          new.id, v_nombre, nullif(trim(v_sede->>'direccion'), ''),
          case when jsonb_typeof(v_sede->'dias_atencion') = 'array' and jsonb_array_length(v_sede->'dias_atencion') > 0
            then array(select jsonb_array_elements_text(v_sede->'dias_atencion')::smallint)
            else '{1,2,3,4,5}'::smallint[] end,
          v_ap, v_ci
        );
      end loop;
    end if;
    update public.sedes set clinica_id = v_clinica where veterinario_id = new.id;
  else
    for v_masc in
      select * from jsonb_array_elements(
        case when jsonb_typeof(m->'mascotas') = 'array' then m->'mascotas' else '[]'::jsonb end)
    loop
      v_chip := nullif(v_masc->>'microchip', '');
      insert into public.mascotas (dueno_id, nombre, tipo, raza, nacimiento, sexo, peso_kg, microchip, color, observaciones)
      values (
        new.id,
        v_masc->>'nombre',
        coalesce(nullif(v_masc->>'tipo', ''), 'Otro'),
        nullif(v_masc->>'raza', ''),
        nullif(v_masc->>'nacimiento', '')::date,
        nullif(lower(v_masc->>'sexo'), '')::public.sexo_mascota,
        private.parse_peso(v_masc->>'peso'),
        case when v_chip ~ '^[0-9]{15}$' then v_chip end,
        nullif(v_masc->>'color', ''),
        nullif(v_masc->>'observaciones', '')
      );
    end loop;
  end if;
  return new;
end $$;

-- ---------- Funciones de la app ----------
-- Veterinarias de la cuenta (también las invitaciones sin responder), con sus roles y cuántos veterinarios tienen.
create or replace function public.mis_clinicas()
returns table (id uuid, nombre text, direccion text, telefono text, miembro_id uuid, roles text[], estado text,
               invitado_por_nombre text, veterinarios integer, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, m.id, m.roles::text[], m.estado::text, ip.nombre,
         (select count(*)::integer from public.clinica_miembros v
           where v.clinica_id = c.id and v.estado = 'activo' and 'veterinario' = any (v.roles)),
         m.created_at
  from public.clinica_miembros m
  join public.clinicas c on c.id = m.clinica_id and c.activa
  left join public.profiles ip on ip.id = m.invitado_por
  where m.cuenta_id = (select auth.uid()) and private.cuenta_activa()
  order by m.estado, c.nombre
$$;

-- Equipo de una veterinaria (solo para sus miembros activos).
create or replace function public.equipo_clinica(p_clinica uuid)
returns table (miembro_id uuid, cuenta_id uuid, nombre text, email text, telefono text, foto_path text, roles text[],
               estado text, es_yo boolean)
language sql stable security definer set search_path to '' as $$
  select m.id, p.id, p.nombre, p.email, p.telefono, p.foto_path, m.roles::text[], m.estado::text, p.id = (select auth.uid())
  from public.clinica_miembros m join public.profiles p on p.id = m.cuenta_id
  where m.clinica_id = p_clinica and private.es_miembro(p_clinica)
  order by m.estado, (m.roles && array['titular']::public.rol_clinica[]) desc, p.nombre
$$;

-- Veterinarios cuya agenda maneja la cuenta, con la veterinaria por la que la maneja (modo recepción).
create or replace function public.agendas_que_manejo()
returns table (clinica_id uuid, clinica_nombre text, veterinario_id uuid)
language sql stable security definer set search_path to '' as $$
  select distinct c.id, c.nombre, v.cuenta_id
  from public.clinica_miembros yo
  join public.clinicas c on c.id = yo.clinica_id and c.activa
  join public.clinica_miembros v on v.clinica_id = yo.clinica_id
  where yo.cuenta_id = (select auth.uid()) and yo.estado = 'activo'
    and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
    and v.estado = 'activo' and 'veterinario' = any (v.roles) and v.cuenta_id <> (select auth.uid())
    and private.es_vet_activo(v.cuenta_id) and private.cuenta_activa()
$$;

-- Valida un conjunto de roles para p_cuenta: el rol veterinario pide matrícula aprobada y el titular solo lo da otro titular.
create or replace function private.roles_validos(p_clinica uuid, p_cuenta uuid, p_roles text[])
returns public.rol_clinica[] language plpgsql stable security definer set search_path to '' as $$
declare
  v public.rol_clinica[];
begin
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Elegí al menos un rol' using errcode = 'P0001';
  end if;
  begin
    v := array(select distinct r::public.rol_clinica from unnest(p_roles) r);
  exception when invalid_text_representation then
    raise exception 'Rol desconocido' using errcode = 'P0001';
  end;
  if 'veterinario' = any (v) and not private.es_vet_activo(p_cuenta) then
    raise exception 'Para el rol de veterinario la persona tiene que tener la matrícula aprobada en PetCare' using errcode = 'P0001';
  end if;
  if 'titular' = any (v) and not exists (
    select 1 from public.clinica_miembros where clinica_id = p_clinica and cuenta_id = (select auth.uid())
      and estado = 'activo' and 'titular' = any (roles)
  ) then
    raise exception 'Solo el titular puede sumar otro titular' using errcode = '42501';
  end if;
  return v;
end $$;
revoke all on function private.roles_validos(uuid, uuid, text[]) from public, anon, authenticated;

-- Un veterinario aprobado crea otra veterinaria (queda como titular y veterinario).
create or replace function public.crear_clinica(p_nombre text, p_direccion text default null, p_telefono text default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null or not private.es_vet_activo(v_uid) then
    raise exception 'Solo un veterinario con la matrícula aprobada puede crear una veterinaria' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Ingresá el nombre de la veterinaria' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clinicas where creada_por = v_uid) >= 5 then
    raise exception 'Llegaste al máximo de veterinarias que podés crear' using errcode = 'P0001';
  end if;
  insert into public.clinicas (nombre, direccion, telefono, creada_por)
  values (left(trim(p_nombre), 120), nullif(trim(coalesce(p_direccion, '')), ''), nullif(trim(coalesce(p_telefono, '')), ''), v_uid)
  returning id into v_id;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
  values (v_id, v_uid, array['titular', 'veterinario']::public.rol_clinica[], 'activo', now());
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (v_id, v_uid, 'creacion', v_uid);
  return v_id;
end $$;

-- Invita a una cuenta (por correo o DNI) a la veterinaria con esos roles. Devuelve el nombre de la persona.
create or replace function public.invitar_a_clinica(p_clinica uuid, p_dato text, p_roles text[])
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cuenta uuid;
  v_nombre text;
  v_clinica text;
  v_roles public.rol_clinica[];
  m public.clinica_miembros%rowtype;
begin
  if v_uid is null or not private.permiso_en(p_clinica, 'equipo') then
    raise exception 'Solo el titular o un administrador de la veterinaria puede sumar personas' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_dato, ''))) < 6 then
    raise exception 'Ingresá un DNI o un correo válido' using errcode = 'P0001';
  end if;
  v_cuenta := private.cuenta_por_dato(p_dato, false);
  if v_cuenta is null then
    raise exception 'No encontramos una cuenta con ese DNI o correo. Podés crearle la cuenta desde acá.' using errcode = 'P0001';
  end if;
  v_roles := private.roles_validos(p_clinica, v_cuenta, p_roles);
  select * into m from public.clinica_miembros where clinica_id = p_clinica and cuenta_id = v_cuenta;
  if found and m.estado = 'activo' then
    raise exception 'Esa persona ya es parte de la veterinaria' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clinica_miembros where clinica_id = p_clinica) >= 50 then
    raise exception 'Llegaste al máximo de personas en la veterinaria' using errcode = 'P0001';
  end if;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, invitado_por)
  values (p_clinica, v_cuenta, v_roles, 'pendiente', v_uid)
  on conflict (clinica_id, cuenta_id) do update set roles = excluded.roles, invitado_por = excluded.invitado_por, created_at = now();
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, detalle, actor)
  values (p_clinica, v_cuenta, 'invitacion', array_to_string(v_roles, ', '), v_uid);
  select nombre into v_nombre from public.profiles where id = v_cuenta;
  select nombre into v_clinica from public.clinicas where id = p_clinica;
  perform private.notificar(v_cuenta, 'cuenta', 'Te invitaron a una veterinaria',
    'Te invitaron a sumarte a ' || v_clinica || '. Aceptá la invitación desde tu Inicio.');
  return v_nombre;
end $$;

-- Acepta o rechaza una invitación a una veterinaria (solo la persona invitada).
create or replace function public.responder_invitacion_clinica(p_miembro uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  m public.clinica_miembros%rowtype;
  v_quien text;
  v_clinica text;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into m from public.clinica_miembros where id = p_miembro and cuenta_id = v_uid and estado = 'pendiente';
  if not found then
    raise exception 'La invitación ya no está disponible' using errcode = 'P0001';
  end if;
  select nombre into v_quien from public.profiles where id = v_uid;
  select nombre into v_clinica from public.clinicas where id = m.clinica_id;
  if p_aceptar then
    if 'veterinario' = any (m.roles) and not private.es_vet_activo(v_uid) then
      raise exception 'Para sumarte como veterinario necesitás la matrícula aprobada' using errcode = 'P0001';
    end if;
    update public.clinica_miembros set estado = 'activo', respondida_at = now() where id = m.id;
    insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (m.clinica_id, v_uid, 'alta', v_uid);
    perform private.notificar(m.invitado_por, 'cuenta', 'Se sumó a la veterinaria',
      coalesce(v_quien, 'La persona invitada') || ' aceptó sumarse a ' || v_clinica || '.');
  else
    delete from public.clinica_miembros where id = m.id;
    insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (m.clinica_id, v_uid, 'rechazo', v_uid);
    perform private.notificar(m.invitado_por, 'cuenta', 'Invitación rechazada',
      coalesce(v_quien, 'La persona invitada') || ' no aceptó sumarse a ' || v_clinica || '.');
  end if;
end $$;

-- Saca a alguien de la veterinaria (titular o administrador) o la cuenta se va sola. Siempre queda un titular.
create or replace function public.quitar_de_clinica(p_miembro uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  m public.clinica_miembros%rowtype;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into m from public.clinica_miembros where id = p_miembro;
  if not found then
    raise exception 'Esa persona ya no está en la veterinaria' using errcode = 'P0001';
  end if;
  if m.cuenta_id <> v_uid and not private.permiso_en(m.clinica_id, 'equipo') then
    raise exception 'Solo el titular o un administrador puede sacar a alguien' using errcode = '42501';
  end if;
  if 'titular' = any (m.roles) and m.estado = 'activo' then
    if m.cuenta_id <> v_uid and not exists (
      select 1 from public.clinica_miembros where clinica_id = m.clinica_id and cuenta_id = v_uid and estado = 'activo' and 'titular' = any (roles)
    ) then
      raise exception 'Solo otro titular puede sacar a un titular' using errcode = '42501';
    end if;
    if (select count(*) from public.clinica_miembros where clinica_id = m.clinica_id and estado = 'activo' and 'titular' = any (roles)) <= 1 then
      raise exception 'La veterinaria tiene que tener al menos un titular' using errcode = 'P0001';
    end if;
  end if;
  delete from public.clinica_miembros where id = m.id;
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (m.clinica_id, m.cuenta_id, 'baja', v_uid);
  if m.cuenta_id <> v_uid then
    perform private.notificar(m.cuenta_id, 'cuenta', 'Ya no estás en la veterinaria',
      'Te sacaron de ' || (select nombre from public.clinicas where id = m.clinica_id) || '.');
  end if;
end $$;

-- Cambia los roles de un miembro (titular o administrador). Siempre queda un titular.
create or replace function public.cambiar_roles_clinica(p_miembro uuid, p_roles text[])
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  m public.clinica_miembros%rowtype;
  v_roles public.rol_clinica[];
begin
  select * into m from public.clinica_miembros where id = p_miembro;
  if not found then
    raise exception 'Esa persona ya no está en la veterinaria' using errcode = 'P0001';
  end if;
  if v_uid is null or not private.permiso_en(m.clinica_id, 'equipo') then
    raise exception 'Solo el titular o un administrador puede cambiar roles' using errcode = '42501';
  end if;
  v_roles := private.roles_validos(m.clinica_id, m.cuenta_id, p_roles);
  -- Sacarle el titular a alguien también lo decide un titular, y no puede dejar la veterinaria sin titular
  if 'titular' = any (m.roles) and not 'titular' = any (v_roles) then
    if not exists (select 1 from public.clinica_miembros where clinica_id = m.clinica_id and cuenta_id = v_uid and estado = 'activo' and 'titular' = any (roles)) then
      raise exception 'Solo un titular puede cambiar a otro titular' using errcode = '42501';
    end if;
    if (select count(*) from public.clinica_miembros where clinica_id = m.clinica_id and estado = 'activo' and 'titular' = any (roles)) <= 1 then
      raise exception 'La veterinaria tiene que tener al menos un titular' using errcode = 'P0001';
    end if;
  end if;
  update public.clinica_miembros set roles = v_roles where id = m.id;
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, detalle, actor)
  values (m.clinica_id, m.cuenta_id, 'roles', array_to_string(v_roles, ', '), v_uid);
end $$;

-- Solo para la Edge Function crear-cuenta-miembro: deja la cuenta recién creada como miembro activo.
create or replace function public.vincular_cuenta_a_clinica(p_cuenta uuid, p_clinica uuid, p_roles text[], p_actor uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_roles public.rol_clinica[];
begin
  if not exists (
    select 1 from public.clinica_miembros where clinica_id = p_clinica and cuenta_id = p_actor and estado = 'activo'
      and roles && array['titular', 'administrador']::public.rol_clinica[]
  ) then
    raise exception 'Quien crea la cuenta no administra esa veterinaria';
  end if;
  v_roles := array(select distinct r::public.rol_clinica from unnest(p_roles) r where r in ('administrador', 'recepcion'));
  if cardinality(v_roles) = 0 then
    raise exception 'Las cuentas nuevas solo pueden ser de administración o recepción';
  end if;
  update public.profiles set debe_cambiar_password = true where id = p_cuenta and rol = 'dueno';
  if not found then
    raise exception 'La cuenta no existe';
  end if;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, invitado_por, respondida_at)
  values (p_clinica, p_cuenta, v_roles, 'activo', p_actor, now())
  on conflict (clinica_id, cuenta_id) do update set roles = excluded.roles, estado = 'activo', respondida_at = now();
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, detalle, actor)
  values (p_clinica, p_cuenta, 'alta', 'cuenta creada por la veterinaria', p_actor);
end $$;

revoke all on function
  public.mis_clinicas(), public.equipo_clinica(uuid), public.agendas_que_manejo(), public.crear_clinica(text, text, text),
  public.invitar_a_clinica(uuid, text, text[]), public.responder_invitacion_clinica(uuid, boolean),
  public.quitar_de_clinica(uuid), public.cambiar_roles_clinica(uuid, text[]), public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid)
from public, anon;
grant execute on function
  public.mis_clinicas(), public.equipo_clinica(uuid), public.agendas_que_manejo(), public.crear_clinica(text, text, text),
  public.invitar_a_clinica(uuid, text, text[]), public.responder_invitacion_clinica(uuid, boolean),
  public.quitar_de_clinica(uuid), public.cambiar_roles_clinica(uuid, text[])
to authenticated;
revoke execute on function public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid) from authenticated;
grant execute on function public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid) to service_role;
