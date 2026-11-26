-- Logo de cada veterinaria: se ve en su vista (el menú y el inicio de la recepción) y en "Mis veterinarias".
-- La imagen va al bucket `fotos`, en la carpeta de quien la sube (titular o administración), así la ve todo el
-- equipo con las mismas reglas que las fotos de perfil. Se puede cargar aunque la veterinaria esté en revisión.
alter table public.clinicas
  add column logo_path text check (logo_path is null or length(logo_path) between 10 and 300);

create or replace function public.cambiar_logo_clinica(p_clinica uuid, p_path text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.cuenta_activa() or not exists (
    select 1 from public.clinica_miembros m join public.clinicas c on c.id = m.clinica_id and c.activa
    where m.clinica_id = p_clinica and m.cuenta_id = v_uid and m.estado = 'activo'
      and m.roles && array['titular', 'administrador']::public.rol_clinica[]
  ) then
    raise exception 'Solo el titular o la administración pueden cambiar el logo' using errcode = '42501';
  end if;
  if p_path is not null and split_part(p_path, '/', 1) <> v_uid::text then
    raise exception 'El logo tiene que estar en tu carpeta' using errcode = 'P0001';
  end if;
  update public.clinicas set logo_path = p_path where id = p_clinica;
end $$;
revoke all on function public.cambiar_logo_clinica(uuid, text) from public, anon;
grant execute on function public.cambiar_logo_clinica(uuid, text) to authenticated;

-- mis_clinicas y clinicas_para_revisar suman el logo (cambia lo que devuelven: se vuelven a crear)
drop function public.mis_clinicas();
create function public.mis_clinicas()
returns table (id uuid, nombre text, direccion text, telefono text, miembro_id uuid, roles text[], estado text,
               invitado_por_nombre text, veterinarios integer, created_at timestamptz, revision text, motivo_revision text,
               logo_path text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, m.id, m.roles::text[], m.estado::text, ip.nombre,
         (select count(*)::integer from public.clinica_miembros v
           where v.clinica_id = c.id and v.estado = 'activo' and 'veterinario' = any (v.roles)),
         m.created_at, c.revision, c.motivo_revision, c.logo_path
  from public.clinica_miembros m
  join public.clinicas c on c.id = m.clinica_id and c.activa
  left join public.profiles ip on ip.id = m.invitado_por
  where m.cuenta_id = (select auth.uid()) and private.cuenta_activa()
  order by m.estado, c.nombre
$$;
revoke all on function public.mis_clinicas() from public, anon;
grant execute on function public.mis_clinicas() to authenticated;

drop function public.clinicas_para_revisar();
create function public.clinicas_para_revisar()
returns table (id uuid, nombre text, direccion text, telefono text, created_at timestamptz,
               titular_id uuid, titular_nombre text, titular_email text, titular_telefono text, titular_dni text, logo_path text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, c.created_at, p.id, p.nombre, p.email, p.telefono, pp.dni, c.logo_path
  from public.clinicas c
  left join public.profiles p on p.id = c.creada_por
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where c.revision = 'pendiente' and c.activa and private.es_admin()
  order by c.created_at
$$;
revoke all on function public.clinicas_para_revisar() from public, anon;
grant execute on function public.clinicas_para_revisar() to authenticated;
