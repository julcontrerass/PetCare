-- Catálogo de servicios y especialidades manejado por el administrador. Antes la lista estaba fija en la app y en dos
-- funciones de la base (es_especialidad y duracion_por_defecto); ahora sale de esta tabla.
--  - Servicio: lo ofrece cualquier veterinario. Especialidad: necesita el título aprobado por el administrador.
--  - El administrador agrega nuevos, cambia la duración por defecto y los activa o desactiva. No se renombran: los
--    veterinarios guardan el nombre en su perfil y los turnos en su categoría.
--  - Uno desactivado no se puede elegir ni se les ofrece a los dueños; los turnos que ya lo tienen siguen igual.
create table public.catalogo_servicios (
  nombre text primary key check (length(trim(nombre)) between 3 and 60 and nombre = trim(nombre)),
  tipo text not null check (tipo in ('servicio', 'especialidad')),
  duracion_min integer not null default 30 check (duracion_min between 15 and 480 and duracion_min % 15 = 0),
  activo boolean not null default true,
  orden integer not null default 1000,
  updated_at timestamptz not null default now()
);
alter table public.catalogo_servicios enable row level security;
-- Lo ve cualquiera (también el registro del veterinario, antes de tener cuenta); se cambia solo con la función de abajo
create policy catalogo_select on public.catalogo_servicios for select to anon, authenticated using (true);
grant select on public.catalogo_servicios to anon, authenticated;

insert into public.catalogo_servicios (nombre, tipo, duracion_min, orden) values
  ('Chequeo médico integral', 'servicio', 30, 10),
  ('Castraciones y limpieza dental', 'servicio', 90, 20),
  ('Cirugía 24hs', 'servicio', 120, 30),
  ('Laboratorio y diagnóstico por imágenes', 'servicio', 45, 40),
  ('Tomografía', 'servicio', 60, 50),
  ('Baño y peluquería', 'servicio', 60, 60),
  ('Oncología', 'especialidad', 60, 110),
  ('Cardiología', 'especialidad', 45, 120),
  ('Fisioterapia', 'especialidad', 45, 130),
  ('Gastroenterología', 'especialidad', 45, 140),
  ('Nutrición', 'especialidad', 30, 150),
  ('Dermatología', 'especialidad', 30, 160),
  ('Exóticos', 'especialidad', 45, 170),
  ('Oftalmología', 'especialidad', 30, 180),
  ('Nefrourología', 'especialidad', 45, 190),
  ('Endocrinología', 'especialidad', 30, 200),
  ('Neurología', 'especialidad', 60, 210),
  ('Homeopatía', 'especialidad', 45, 220),
  ('Medicina felina', 'especialidad', 30, 230),
  ('Hematología', 'especialidad', 30, 240),
  ('Parasitología', 'especialidad', 30, 250),
  ('Neumonología', 'especialidad', 45, 260),
  ('Medicina del dolor', 'especialidad', 45, 270);

-- Las dos funciones que tenían la lista escrita ahora leen la tabla (una especialidad desactivada sigue siendo
-- especialidad: los títulos ya cargados no se rompen)
create or replace function private.es_especialidad(p_nombre text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.catalogo_servicios where nombre = p_nombre and tipo = 'especialidad')
$$;

create or replace function private.duracion_por_defecto(p_categoria text)
returns integer language sql stable security definer set search_path to '' as $$
  select coalesce((select duracion_min from public.catalogo_servicios where nombre = p_categoria), 30)
$$;

-- El administrador agrega uno nuevo o cambia la duración y si está activo de uno que ya existe
create function public.guardar_servicio_catalogo(p_nombre text, p_tipo text, p_duracion integer, p_activo boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_actual public.catalogo_servicios%rowtype;
begin
  if not private.es_admin() then
    raise exception 'Solo un administrador puede cambiar el catálogo' using errcode = '42501';
  end if;
  if length(v_nombre) < 3 or length(v_nombre) > 60 then
    raise exception 'El nombre tiene que tener entre 3 y 60 letras' using errcode = 'P0001';
  end if;
  if p_tipo not in ('servicio', 'especialidad') then
    raise exception 'Elegí si es un servicio o una especialidad' using errcode = 'P0001';
  end if;
  if p_duracion is null or p_duracion < 15 or p_duracion > 480 or p_duracion % 15 <> 0 then
    raise exception 'La duración tiene que ser de 15 minutos a 8 horas, de a 15 minutos' using errcode = 'P0001';
  end if;

  select * into v_actual from public.catalogo_servicios where lower(nombre) = lower(v_nombre);
  if found then
    if v_actual.tipo <> p_tipo then
      raise exception '% ya existe como %: no se puede cambiar el tipo', v_actual.nombre,
        case v_actual.tipo when 'servicio' then 'servicio' else 'especialidad' end
        using errcode = 'P0001';
    end if;
    update public.catalogo_servicios
       set duracion_min = p_duracion, activo = coalesce(p_activo, true), updated_at = now()
     where nombre = v_actual.nombre;
  else
    insert into public.catalogo_servicios (nombre, tipo, duracion_min, activo, orden)
    values (v_nombre, p_tipo, p_duracion, coalesce(p_activo, true),
            (select coalesce(max(orden), 0) + 10 from public.catalogo_servicios where tipo = p_tipo));
  end if;
end $$;
revoke all on function public.guardar_servicio_catalogo(text, text, integer, boolean) from public, anon;
grant execute on function public.guardar_servicio_catalogo(text, text, integer, boolean) to authenticated;
