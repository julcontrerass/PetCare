-- Requisitos para abrir una veterinaria: CUIT, director técnico (un veterinario matriculado: nombre, DNI y
-- matrícula) y las habilitaciones comercial y sanitaria. Con eso el administrador verifica que la veterinaria exista.
--
-- - Toda veterinaria nueva los carga al registrarse y pasa por la revisión del administrador (también la que registra
--   un veterinario aprobado). El consultorio que recibe un veterinario al registrarse no cambia: ya lo respalda su
--   propia matrícula.
-- - Si el director técnico usa PetCare (veterinario aprobado con esa matrícula o ese DNI) queda vinculado y se lo
--   invita al equipo como veterinario.
-- - Las habilitaciones (PDF o imagen) van al bucket privado `credenciales`, en la carpeta de quien las sube: solo las
--   ven esa persona y el administrador.
-- - El administrador no puede aprobar si falta algo. Si la rechaza y el titular vuelve a subir una habilitación,
--   la veterinaria vuelve a revisión.

alter table public.clinicas
  add column cuit text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  add column director_nombre text check (director_nombre is null or length(director_nombre) between 3 and 120),
  add column director_dni text check (director_dni is null or director_dni ~ '^[0-9]{7,8}$'),
  add column director_matricula text check (director_matricula is null or length(director_matricula) between 2 and 30),
  add column director_id uuid references public.profiles (id) on delete set null,
  add column habilitacion_comercial_path text check (habilitacion_comercial_path is null or length(habilitacion_comercial_path) between 10 and 300),
  add column habilitacion_sanitaria_path text check (habilitacion_sanitaria_path is null or length(habilitacion_sanitaria_path) between 10 and 300);
create index clinicas_director on public.clinicas (director_id);

-- CUIT/CUIL: 11 dígitos y el dígito verificador (módulo 11).
create or replace function private.cuit_valido(p_cuit text)
returns boolean language plpgsql immutable set search_path to '' as $$
declare
  c text := regexp_replace(coalesce(p_cuit, ''), '[^0-9]', '', 'g');
  pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  suma int := 0;
  dv int;
begin
  if length(c) <> 11 then
    return false;
  end if;
  for i in 1..10 loop
    suma := suma + substr(c, i, 1)::int * pesos[i];
  end loop;
  dv := 11 - (suma % 11);
  if dv = 11 then
    dv := 0;
  elsif dv = 10 then
    return false;
  end if;
  return dv = substr(c, 11, 1)::int;
end $$;

-- ---------- Registrar una veterinaria ----------
drop function public.crear_clinica(text, text, text);
drop function private.nueva_clinica(uuid, text, text, text);

create function private.nueva_clinica(
  p_cuenta uuid, p_nombre text, p_direccion text, p_telefono text, p_cuit text,
  p_director_nombre text, p_director_dni text, p_director_matricula text
)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_id uuid;
  v_vet boolean := private.es_vet_activo(p_cuenta);
  v_quien text;
  v_cuit text := regexp_replace(coalesce(p_cuit, ''), '[^0-9]', '', 'g');
  v_dni text := regexp_replace(coalesce(p_director_dni, ''), '[^0-9]', '', 'g');
  v_matricula text := trim(coalesce(p_director_matricula, ''));
  v_director uuid;
begin
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Ingresá el nombre de la veterinaria' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_direccion, ''))) < 5 then
    raise exception 'Ingresá la dirección de la veterinaria' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g')) < 8 then
    raise exception 'Ingresá el teléfono de la veterinaria' using errcode = 'P0001';
  end if;
  if not private.cuit_valido(v_cuit) then
    raise exception 'El CUIT no es válido' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_director_nombre, ''))) < 3 or v_dni !~ '^[0-9]{7,8}$' or length(v_matricula) < 2 then
    raise exception 'Completá el nombre, el DNI y la matrícula del director técnico' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clinicas where creada_por = p_cuenta) >= 5 then
    raise exception 'Llegaste al máximo de veterinarias que podés registrar' using errcode = 'P0001';
  end if;

  -- ¿El director técnico usa PetCare? (veterinario aprobado con esa matrícula o ese DNI)
  select v.profile_id into v_director
  from public.veterinarios v
  left join public.perfiles_privados pp on pp.profile_id = v.profile_id
  where (lower(v.matricula) = lower(v_matricula) or pp.dni = v_dni) and private.es_vet_activo(v.profile_id)
  order by (lower(v.matricula) = lower(v_matricula)) desc
  limit 1;

  insert into public.clinicas (nombre, direccion, telefono, creada_por, revision, cuit, director_nombre, director_dni,
                               director_matricula, director_id)
  values (left(trim(p_nombre), 120), trim(p_direccion), trim(p_telefono), p_cuenta, 'pendiente', v_cuit,
          left(trim(p_director_nombre), 120), v_dni, left(v_matricula, 30), v_director)
  returning id into v_id;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
  values (v_id, p_cuenta,
          case when v_vet then array['titular', 'veterinario'] else array['titular'] end::public.rol_clinica[], 'activo', now());
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (v_id, p_cuenta, 'creacion', p_cuenta);

  -- El director técnico que usa PetCare queda invitado al equipo como veterinario
  if v_director is not null and v_director <> p_cuenta then
    insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, invitado_por)
    values (v_id, v_director, array['veterinario']::public.rol_clinica[], 'pendiente', p_cuenta)
    on conflict (clinica_id, cuenta_id) do nothing;
    insert into public.clinica_historial (clinica_id, cuenta_id, accion, detalle, actor)
    values (v_id, v_director, 'invitacion', 'director técnico', p_cuenta);
    perform private.notificar(v_director, 'cuenta', 'Te sumaron como director técnico',
      'Figurás como director técnico de ' || trim(p_nombre) || '. Aceptá la invitación desde tu Inicio para sumarte al equipo.');
  end if;

  select nombre into v_quien from public.profiles where id = p_cuenta;
  perform private.notificar_admins('Veterinaria para revisar',
    coalesce(v_quien, 'Una cuenta') || ' registró la veterinaria ' || trim(p_nombre) || '. Verificá el CUIT, el director técnico y las habilitaciones.');
  return v_id;
end $$;
revoke all on function private.nueva_clinica(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

create function public.crear_clinica(
  p_nombre text, p_direccion text, p_telefono text, p_cuit text,
  p_director_nombre text, p_director_dni text, p_director_matricula text
)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  return private.nueva_clinica(v_uid, p_nombre, p_direccion, p_telefono, p_cuit, p_director_nombre, p_director_dni, p_director_matricula);
end $$;
revoke all on function public.crear_clinica(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.crear_clinica(text, text, text, text, text, text, text) to authenticated;

-- Registro "Mi veterinaria": los datos vienen en los metadatos del alta
create or replace function private.veterinaria_del_registro()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)->'veterinaria';
begin
  if coalesce(jsonb_typeof(v), '') <> 'object' or coalesce(new.raw_user_meta_data->>'rol', '') = 'veterinario' then
    return new;
  end if;
  perform private.nueva_clinica(new.id, v->>'nombre', v->>'direccion', v->>'telefono', v->>'cuit',
    v->'director'->>'nombre', v->'director'->>'dni', v->'director'->>'matricula');
  return new;
end $$;
revoke all on function private.veterinaria_del_registro() from public, anon, authenticated;

-- ---------- Habilitaciones ----------
create or replace function public.cargar_habilitacion_clinica(p_clinica uuid, p_tipo text, p_path text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  c public.clinicas%rowtype;
begin
  if v_uid is null or not private.cuenta_activa() or not exists (
    select 1 from public.clinica_miembros m
    where m.clinica_id = p_clinica and m.cuenta_id = v_uid and m.estado = 'activo'
      and m.roles && array['titular', 'administrador']::public.rol_clinica[]
  ) then
    raise exception 'Solo el titular o la administración pueden cargar las habilitaciones' using errcode = '42501';
  end if;
  if p_tipo not in ('comercial', 'sanitaria') then
    raise exception 'Tipo de habilitación desconocido' using errcode = 'P0001';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_uid::text then
    raise exception 'La habilitación tiene que estar en tu carpeta' using errcode = 'P0001';
  end if;
  select * into c from public.clinicas where id = p_clinica;
  if p_tipo = 'comercial' then
    update public.clinicas set habilitacion_comercial_path = p_path where id = p_clinica;
  else
    update public.clinicas set habilitacion_sanitaria_path = p_path where id = p_clinica;
  end if;
  -- Rechazada por la documentación: al volver a subirla, vuelve a revisión
  if c.revision = 'rechazada' then
    update public.clinicas set revision = 'pendiente', motivo_revision = null where id = p_clinica;
    perform private.notificar_admins('Veterinaria para revisar de nuevo',
      c.nombre || ' volvió a subir su documentación. Revisala otra vez.');
  end if;
end $$;
revoke all on function public.cargar_habilitacion_clinica(uuid, text, text) from public, anon;
grant execute on function public.cargar_habilitacion_clinica(uuid, text, text) to authenticated;

-- ---------- Revisión del administrador ----------
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
  if p_aprobar and (c.cuit is null or c.director_matricula is null or c.habilitacion_comercial_path is null
                    or c.habilitacion_sanitaria_path is null) then
    raise exception 'Faltan datos para aprobarla: el CUIT, el director técnico o alguna habilitación' using errcode = 'P0001';
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

drop function public.clinicas_para_revisar();
create function public.clinicas_para_revisar()
returns table (id uuid, nombre text, direccion text, telefono text, created_at timestamptz,
               titular_id uuid, titular_nombre text, titular_email text, titular_telefono text, titular_dni text, logo_path text,
               cuit text, director_nombre text, director_dni text, director_matricula text, director_en_petcare boolean,
               habilitacion_comercial_path text, habilitacion_sanitaria_path text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, c.created_at, p.id, p.nombre, p.email, p.telefono, pp.dni, c.logo_path,
         c.cuit, c.director_nombre, c.director_dni, c.director_matricula,
         c.director_id is not null and private.es_vet_activo(c.director_id),
         c.habilitacion_comercial_path, c.habilitacion_sanitaria_path
  from public.clinicas c
  left join public.profiles p on p.id = c.creada_por
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where c.revision = 'pendiente' and c.activa and private.es_admin()
  order by c.created_at
$$;
revoke all on function public.clinicas_para_revisar() from public, anon;
grant execute on function public.clinicas_para_revisar() to authenticated;

-- mis_clinicas: el titular ve qué documentación le falta (cambia lo que devuelve: se vuelve a crear)
drop function public.mis_clinicas();
create function public.mis_clinicas()
returns table (id uuid, nombre text, direccion text, telefono text, miembro_id uuid, roles text[], estado text,
               invitado_por_nombre text, veterinarios integer, created_at timestamptz, revision text, motivo_revision text,
               logo_path text, director_nombre text, falta_habilitacion_comercial boolean, falta_habilitacion_sanitaria boolean)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, m.id, m.roles::text[], m.estado::text, ip.nombre,
         (select count(*)::integer from public.clinica_miembros v
           where v.clinica_id = c.id and v.estado = 'activo' and 'veterinario' = any (v.roles)),
         m.created_at, c.revision, c.motivo_revision, c.logo_path, c.director_nombre,
         c.habilitacion_comercial_path is null, c.habilitacion_sanitaria_path is null
  from public.clinica_miembros m
  join public.clinicas c on c.id = m.clinica_id and c.activa
  left join public.profiles ip on ip.id = m.invitado_por
  where m.cuenta_id = (select auth.uid()) and private.cuenta_activa()
  order by m.estado, c.nombre
$$;
revoke all on function public.mis_clinicas() from public, anon;
grant execute on function public.mis_clinicas() to authenticated;
