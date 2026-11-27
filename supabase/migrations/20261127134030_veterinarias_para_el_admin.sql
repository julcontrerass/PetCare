-- Sección "Veterinarias" del panel del administrador: todas las veterinarias, en cualquier estado de revisión, con los
-- datos para verificarlas (los mismos que clinicas_para_revisar) y cuánta gente tienen. Solo para el administrador.
create function public.clinicas_admin()
returns table (id uuid, nombre text, direccion text, telefono text, created_at timestamptz,
               titular_id uuid, titular_nombre text, titular_email text, titular_telefono text, titular_dni text, logo_path text,
               cuit text, director_nombre text, director_dni text, director_matricula text, director_en_petcare boolean,
               habilitacion_comercial_path text, habilitacion_sanitaria_path text,
               revision text, motivo_revision text, revisada_at timestamptz, veterinarios integer, equipo integer)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.direccion, c.telefono, c.created_at, p.id, p.nombre, p.email, p.telefono, pp.dni, c.logo_path,
         c.cuit, c.director_nombre, c.director_dni, c.director_matricula,
         c.director_id is not null and private.es_vet_activo(c.director_id),
         c.habilitacion_comercial_path, c.habilitacion_sanitaria_path,
         c.revision, c.motivo_revision, c.revisada_at,
         (select count(*)::integer from public.clinica_miembros v
           where v.clinica_id = c.id and v.estado = 'activo' and 'veterinario' = any (v.roles)),
         (select count(*)::integer from public.clinica_miembros e where e.clinica_id = c.id and e.estado = 'activo')
  from public.clinicas c
  left join public.profiles p on p.id = c.creada_por
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where c.activa and private.es_admin()
  order by case c.revision when 'pendiente' then 0 when 'aprobada' then 1 else 2 end, c.nombre
$$;
revoke all on function public.clinicas_admin() from public, anon;
grant execute on function public.clinicas_admin() to authenticated;
