-- Veterinarias registradas por alguien que no es veterinario (el dueño del negocio) y veterinarios dados de alta
-- por la veterinaria.
--
-- - Cualquier cuenta puede registrar una veterinaria y queda como titular. Si no la registra un veterinario
--   aprobado, la veterinaria queda "pendiente" hasta que el administrador de la plataforma verifica que existe;
--   mientras tanto no se puede sumar a nadie ni maneja agendas.
-- - El registro "Mi veterinaria" (metadatos `veterinaria` en el alta) crea la cuenta y la veterinaria pendiente.
-- - La veterinaria puede crearle la cuenta a un veterinario (Edge Function crear-cuenta-miembro): la cuenta queda en
--   revisión como cualquier veterinario nuevo (con su propia veterinaria) y ya es miembro de la que lo creó, con un
--   lugar de atención en su dirección. Su agenda aparece cuando el administrador aprueba la matrícula, y a la
--   veterinaria le llega el aviso.

-- ---------- Estado de revisión de cada veterinaria ----------
alter table public.clinicas
  add column revision text not null default 'aprobada' check (revision in ('pendiente', 'aprobada', 'rechazada')),
  add column motivo_revision text,
  add column revisada_at timestamptz,
  add column revisada_por uuid references public.profiles (id) on delete set null;
create index clinicas_revisada_por on public.clinicas (revisada_por);
create index clinicas_pendientes on public.clinicas (created_at) where revision = 'pendiente';

-- ---------- Los permisos solo valen en veterinarias aprobadas ----------
create or replace function private.permiso_en(p_clinica uuid, p_permiso text)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.cuenta_activa() and exists (
    select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa and c.revision = 'aprobada'
    where m.clinica_id = p_clinica and m.cuenta_id = (select auth.uid()) and m.estado = 'activo'
      and m.roles && case p_permiso
        when 'equipo' then array['titular', 'administrador']::public.rol_clinica[]
        when 'agenda' then array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
        when 'ventas' then array['titular', 'administrador', 'recepcion', 'veterinario']::public.rol_clinica[]
        when 'stock' then array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
        else array[]::public.rol_clinica[] end
  )
$$;

create or replace function private.es_recepcion_de(p_vet uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select p_vet is distinct from (select auth.uid()) and exists (
    select 1
    from public.clinica_miembros yo
    join public.clinicas c on c.id = yo.clinica_id and c.activa and c.revision = 'aprobada'
    join public.clinica_miembros v on v.clinica_id = yo.clinica_id
    where yo.cuenta_id = (select auth.uid()) and yo.estado = 'activo'
      and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
      and v.cuenta_id = p_vet and v.estado = 'activo' and 'veterinario' = any (v.roles)
  ) and private.es_vet_activo(p_vet) and private.cuenta_activa()
$$;

create or replace function private.recepcionistas_de(p_vet uuid)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select distinct yo.cuenta_id
  from public.clinica_miembros v
  join public.clinicas c on c.id = v.clinica_id and c.activa and c.revision = 'aprobada'
  join public.clinica_miembros yo on yo.clinica_id = v.clinica_id
  join public.profiles p on p.id = yo.cuenta_id and p.estado = 'activo'
  where v.cuenta_id = p_vet and v.estado = 'activo' and 'veterinario' = any (v.roles)
    and yo.estado = 'activo' and yo.cuenta_id <> p_vet
    and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
$$;

create or replace function public.agendas_que_manejo()
returns table (clinica_id uuid, clinica_nombre text, veterinario_id uuid)
language sql stable security definer set search_path to '' as $$
  select distinct c.id, c.nombre, v.cuenta_id
  from public.clinica_miembros yo
  join public.clinicas c on c.id = yo.clinica_id and c.activa and c.revision = 'aprobada'
  join public.clinica_miembros v on v.clinica_id = yo.clinica_id
  where yo.cuenta_id = (select auth.uid()) and yo.estado = 'activo'
    and yo.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
    and v.estado = 'activo' and 'veterinario' = any (v.roles) and v.cuenta_id <> (select auth.uid())
    and private.es_vet_activo(v.cuenta_id) and private.cuenta_activa()
$$;

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
        select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa and c.revision = 'aprobada'
        where m.cuenta_id = (select auth.uid()) and m.estado = 'activo'
          and m.roles && array['titular', 'administrador', 'recepcion']::public.rol_clinica[]
      )
    )
    and length(trim(p_dato)) >= 6
    and (lower(p.email) = lower(trim(p_dato)) or pp.dni = trim(p_dato))
$$;

-- mis_clinicas suma el estado de revisión (cambia lo que devuelve: se vuelve a crear)
drop function public.mis_clinicas();
create function public.mis_clinicas()
returns table (id uuid, nombre text, direccion text, telefono text, miembro_id uuid, roles text[], estado text,
               invitado_por_nombre text, veterinarios integer, created_at timestamptz, revision text, motivo_revision text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, m.id, m.roles::text[], m.estado::text, ip.nombre,
         (select count(*)::integer from public.clinica_miembros v
           where v.clinica_id = c.id and v.estado = 'activo' and 'veterinario' = any (v.roles)),
         m.created_at, c.revision, c.motivo_revision
  from public.clinica_miembros m
  join public.clinicas c on c.id = m.clinica_id and c.activa
  left join public.profiles ip on ip.id = m.invitado_por
  where m.cuenta_id = (select auth.uid()) and private.cuenta_activa()
  order by m.estado, c.nombre
$$;
revoke all on function public.mis_clinicas() from public, anon;
grant execute on function public.mis_clinicas() to authenticated;

-- ---------- Registrar una veterinaria ----------
-- Arma la veterinaria con su titular. Un veterinario aprobado la tiene aprobada al instante (y también atiende ahí);
-- cualquier otra cuenta la deja pendiente de revisión y se les avisa a los administradores.
create or replace function private.nueva_clinica(p_cuenta uuid, p_nombre text, p_direccion text, p_telefono text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_id uuid;
  v_vet boolean := private.es_vet_activo(p_cuenta);
  v_quien text;
begin
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Ingresá el nombre de la veterinaria' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clinicas where creada_por = p_cuenta) >= 5 then
    raise exception 'Llegaste al máximo de veterinarias que podés registrar' using errcode = 'P0001';
  end if;
  insert into public.clinicas (nombre, direccion, telefono, creada_por, revision)
  values (left(trim(p_nombre), 120), nullif(trim(coalesce(p_direccion, '')), ''), nullif(trim(coalesce(p_telefono, '')), ''),
          p_cuenta, case when v_vet then 'aprobada' else 'pendiente' end)
  returning id into v_id;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
  values (v_id, p_cuenta,
          case when v_vet then array['titular', 'veterinario'] else array['titular'] end::public.rol_clinica[], 'activo', now());
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (v_id, p_cuenta, 'creacion', p_cuenta);
  if not v_vet then
    select nombre into v_quien from public.profiles where id = p_cuenta;
    perform private.notificar_admins('Veterinaria para revisar',
      coalesce(v_quien, 'Una cuenta') || ' registró la veterinaria ' || trim(p_nombre) || '. Verificá que exista para darla de alta.');
  end if;
  return v_id;
end $$;
revoke all on function private.nueva_clinica(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.crear_clinica(p_nombre text, p_direccion text default null, p_telefono text default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  return private.nueva_clinica(v_uid, p_nombre, p_direccion, p_telefono);
end $$;

-- Registro "Mi veterinaria": corre después de handle_new_user (por el nombre del disparador) y arma la veterinaria
-- pendiente con los datos que vinieron en el alta.
create or replace function private.veterinaria_del_registro()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)->'veterinaria';
begin
  if jsonb_typeof(v) <> 'object' or coalesce(new.raw_user_meta_data->>'rol', '') = 'veterinario' then
    return new;
  end if;
  perform private.nueva_clinica(new.id, v->>'nombre', v->>'direccion', v->>'telefono');
  return new;
end $$;
revoke all on function private.veterinaria_del_registro() from public, anon, authenticated;
create trigger on_auth_user_created_veterinaria
  after insert on auth.users
  for each row execute function private.veterinaria_del_registro();

-- ---------- Revisión del administrador ----------
create or replace function public.clinicas_para_revisar()
returns table (id uuid, nombre text, direccion text, telefono text, created_at timestamptz,
               titular_id uuid, titular_nombre text, titular_email text, titular_telefono text, titular_dni text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, c.created_at, p.id, p.nombre, p.email, p.telefono, pp.dni
  from public.clinicas c
  left join public.profiles p on p.id = c.creada_por
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where c.revision = 'pendiente' and c.activa and private.es_admin()
  order by c.created_at
$$;

create or replace function public.revisar_clinica(p_clinica uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_admin uuid := (select auth.uid());
  c public.clinicas%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
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
  update public.clinicas
     set revision = case when p_aprobar then 'aprobada' else 'rechazada' end,
         motivo_revision = case when p_aprobar then null else v_motivo end, revisada_at = now(), revisada_por = v_admin
   where id = p_clinica;
  insert into public.actividad_admin (tipo, texto, actor_id, objetivo_id)
  values (case when p_aprobar then 'aprobacion' else 'rechazo' end::public.tipo_actividad,
          case when p_aprobar then 'Se dio de alta la veterinaria ' || c.nombre
               else 'Se rechazó la veterinaria ' || c.nombre || ': ' || v_motivo end,
          v_admin, c.creada_por);
  if c.creada_por is not null then
    if p_aprobar then
      perform private.notificar(c.creada_por, 'cuenta', 'Veterinaria aprobada',
        'Verificamos ' || c.nombre || '. Ya podés sumar a tus veterinarios y a tu equipo.');
    else
      perform private.notificar(c.creada_por, 'cuenta', 'Veterinaria rechazada',
        'No pudimos verificar ' || c.nombre || ': ' || v_motivo || '.');
    end if;
  end if;
end $$;

revoke all on function public.clinicas_para_revisar(), public.revisar_clinica(uuid, boolean, text) from public, anon;
grant execute on function public.clinicas_para_revisar(), public.revisar_clinica(uuid, boolean, text) to authenticated;

-- ---------- Cuentas que crea la veterinaria ----------
-- Ahora también veterinarios (la cuenta ya viene con su fila de veterinario, en revisión). La veterinaria tiene que
-- estar aprobada. Al veterinario se le arma un lugar de atención con la dirección de la veterinaria.
create or replace function public.vincular_cuenta_a_clinica(p_cuenta uuid, p_clinica uuid, p_roles text[], p_actor uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_roles public.rol_clinica[];
  c public.clinicas%rowtype;
begin
  select * into c from public.clinicas where id = p_clinica and activa and revision = 'aprobada';
  if not found then
    raise exception 'La veterinaria todavía no está aprobada';
  end if;
  if not exists (
    select 1 from public.clinica_miembros where clinica_id = p_clinica and cuenta_id = p_actor and estado = 'activo'
      and roles && array['titular', 'administrador']::public.rol_clinica[]
  ) then
    raise exception 'Quien crea la cuenta no administra esa veterinaria';
  end if;
  v_roles := array(select distinct r::public.rol_clinica from unnest(p_roles) r where r in ('administrador', 'recepcion', 'veterinario'));
  if cardinality(v_roles) = 0 then
    raise exception 'Las cuentas nuevas pueden ser de veterinario, administración o recepción';
  end if;
  if 'veterinario' = any (v_roles) and not exists (select 1 from public.veterinarios where profile_id = p_cuenta) then
    raise exception 'La cuenta no tiene los datos de veterinario';
  end if;
  update public.profiles set debe_cambiar_password = true where id = p_cuenta;
  if not found then
    raise exception 'La cuenta no existe';
  end if;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, invitado_por, respondida_at)
  values (p_clinica, p_cuenta, v_roles, 'activo', p_actor, now())
  on conflict (clinica_id, cuenta_id) do update set roles = excluded.roles, estado = 'activo', respondida_at = now();
  if 'veterinario' = any (v_roles) then
    insert into public.sedes (veterinario_id, nombre, direccion, clinica_id)
    values (p_cuenta, c.nombre, c.direccion, c.id);
  end if;
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, detalle, actor)
  values (p_clinica, p_cuenta, 'alta', 'cuenta creada por la veterinaria', p_actor);
end $$;
revoke all on function public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid) from public, anon, authenticated;
grant execute on function public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid) to service_role;

-- Cuando el administrador aprueba a un veterinario, se les avisa a las veterinarias donde ya está (salvo la suya).
create or replace function private.avisar_veterinario_aprobado()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  r record;
  v_nombre text;
begin
  if new.estado_revision <> 'activo' or old.estado_revision = 'activo' then
    return null;
  end if;
  select nombre into v_nombre from public.profiles where id = new.profile_id;
  for r in
    select distinct yo.cuenta_id, c.nombre
    from public.clinica_miembros v
    join public.clinicas c on c.id = v.clinica_id and c.activa and c.revision = 'aprobada'
    join public.clinica_miembros yo on yo.clinica_id = v.clinica_id and yo.estado = 'activo'
      and yo.roles && array['titular', 'administrador']::public.rol_clinica[]
    where v.cuenta_id = new.profile_id and v.estado = 'activo' and 'veterinario' = any (v.roles)
      and yo.cuenta_id <> new.profile_id
  loop
    perform private.notificar(r.cuenta_id, 'cuenta', 'Veterinario aprobado',
      coalesce(v_nombre, 'El veterinario') || ' ya está aprobado y su agenda aparece en ' || r.nombre || '.');
  end loop;
  return null;
end $$;
revoke all on function private.avisar_veterinario_aprobado() from public, anon, authenticated;
create trigger veterinarios_aviso_aprobado
  after update of estado_revision on public.veterinarios
  for each row execute function private.avisar_veterinario_aprobado();
