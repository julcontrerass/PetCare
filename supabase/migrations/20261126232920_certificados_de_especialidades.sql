-- Certificados de especialidades: para ofrecer una especialidad (dermatología, cardiología...) el veterinario sube
-- el título o certificado que lo acredita y el administrador lo aprueba. Los servicios generales (chequeo,
-- castraciones, cirugía, laboratorio, tomografía, baño) no lo necesitan: alcanza con la matrícula.
--
-- - Cada especialidad elegida tiene su fila en especialidades_vet: sin certificado → pendiente (subió el título, la
--   institución, el año y uno o más archivos) → aprobada o rechazada (con motivo; puede volver a subirlo).
-- - veterinarios.especialidades_aprobadas guarda las aprobadas (la mantiene la base; el veterinario no la puede
--   tocar). La app les ofrece a los dueños y a la recepción solo los servicios y esas especialidades.
-- - Los archivos van al bucket privado `credenciales`, en la carpeta del veterinario: solo los ven él y el
--   administrador. Se pueden subir aunque la cuenta todavía esté en revisión (como el carnet).
-- - Las especialidades que los veterinarios ya tenían quedan sin certificado y se les avisa que lo suban.

-- Las mismas que CatalogoMedico.ESPECIALIDADES en la app
create or replace function private.es_especialidad(p_nombre text)
returns boolean language sql immutable set search_path to '' as $$
  select p_nombre = any (array[
    'Oncología', 'Cardiología', 'Fisioterapia', 'Gastroenterología', 'Nutrición', 'Dermatología', 'Exóticos',
    'Oftalmología', 'Nefrourología', 'Endocrinología', 'Neurología', 'Homeopatía', 'Medicina felina', 'Hematología',
    'Parasitología', 'Neumonología', 'Medicina del dolor'
  ])
$$;

create table public.especialidades_vet (
  id uuid primary key default gen_random_uuid(),
  veterinario_id uuid not null references public.profiles (id) on delete cascade,
  especialidad text not null check (private.es_especialidad(especialidad)),
  estado text not null default 'sin_certificado' check (estado in ('sin_certificado', 'pendiente', 'aprobada', 'rechazada')),
  titulo text check (titulo is null or length(titulo) between 3 and 200),
  institucion text check (institucion is null or length(institucion) between 2 and 200),
  anio smallint check (anio is null or anio between 1950 and 2100),
  archivos text[] not null default '{}' check (cardinality(archivos) <= 5),
  motivo text,
  enviada_at timestamptz,
  revisada_at timestamptz,
  revisada_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (veterinario_id, especialidad)
);
create index especialidades_vet_pendientes on public.especialidades_vet (enviada_at) where estado = 'pendiente';
create index especialidades_vet_revisada_por on public.especialidades_vet (revisada_por);

alter table public.especialidades_vet enable row level security;
revoke all on public.especialidades_vet from anon, authenticated;
grant select on public.especialidades_vet to authenticated;
create policy especialidades_vet_select on public.especialidades_vet for select to authenticated using (
  veterinario_id = (select auth.uid()) or private.es_admin()
);

-- Las aprobadas, a mano de la app (catálogo de veterinarios). No tiene permiso de escritura para nadie desde la app.
alter table public.veterinarios add column especialidades_aprobadas text[] not null default '{}';

create or replace function private.recalcular_especialidades_aprobadas(p_vet uuid)
returns void language sql security definer set search_path to '' as $$
  update public.veterinarios
     set especialidades_aprobadas = coalesce((
       select array_agg(e.especialidad order by e.especialidad) from public.especialidades_vet e
       where e.veterinario_id = p_vet and e.estado = 'aprobada'
     ), '{}')
   where profile_id = p_vet
$$;
revoke all on function private.recalcular_especialidades_aprobadas(uuid) from public, anon, authenticated;

create or replace function private.especialidades_vet_cambio()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  perform private.recalcular_especialidades_aprobadas(coalesce(new.veterinario_id, old.veterinario_id));
  return null;
end $$;
revoke all on function private.especialidades_vet_cambio() from public, anon, authenticated;
create trigger especialidades_vet_aprobadas
  after insert or update or delete on public.especialidades_vet
  for each row execute function private.especialidades_vet_cambio();

-- Cada especialidad que el veterinario elige (al registrarse o desde su perfil) queda pendiente de su certificado
create or replace function private.especialidades_elegidas()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.especialidades_vet (veterinario_id, especialidad)
  select new.profile_id, e from unnest(new.especialidades) e
  where private.es_especialidad(e)
  on conflict (veterinario_id, especialidad) do nothing;
  return null;
end $$;
revoke all on function private.especialidades_elegidas() from public, anon, authenticated;
create trigger veterinarios_especialidades_elegidas
  after insert or update of especialidades on public.veterinarios
  for each row execute function private.especialidades_elegidas();

-- Las que ya existían: sin certificado, y aviso a cada veterinario
insert into public.especialidades_vet (veterinario_id, especialidad)
select v.profile_id, e from public.veterinarios v, unnest(v.especialidades) e
where private.es_especialidad(e)
on conflict (veterinario_id, especialidad) do nothing;

do $$
declare r record;
begin
  for r in select distinct veterinario_id from public.especialidades_vet loop
    perform private.notificar(r.veterinario_id, 'cuenta', 'Subí los títulos de tus especialidades',
      'Para seguir ofreciendo tus especialidades, subí el título o certificado de cada una desde tu perfil. Mientras tanto ofrecés tus servicios generales.');
  end loop;
end $$;

-- ---------- El veterinario ----------
create or replace function public.mis_especialidades()
returns table (id uuid, especialidad text, estado text, titulo text, institucion text, anio smallint, archivos text[],
               motivo text, enviada_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select e.id, e.especialidad, e.estado, e.titulo, e.institucion, e.anio, e.archivos, e.motivo, e.enviada_at
  from public.especialidades_vet e
  join public.veterinarios v on v.profile_id = e.veterinario_id
  where e.veterinario_id = (select auth.uid()) and e.especialidad = any (v.especialidades)
  order by e.especialidad
$$;

-- Sube (o reemplaza) el certificado de una especialidad: queda pendiente de revisión. Funciona aunque la cuenta del
-- veterinario esté en revisión (lo puede adjuntar al registrarse).
create or replace function public.cargar_certificado_especialidad(
  p_especialidad text, p_titulo text, p_institucion text, p_anio integer, p_archivos text[]
)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nombre text;
begin
  if v_uid is null or not exists (select 1 from public.veterinarios where profile_id = v_uid) then
    raise exception 'Solo un veterinario puede cargar certificados' using errcode = '42501';
  end if;
  if not private.es_especialidad(p_especialidad) then
    raise exception 'Esa especialidad no necesita certificado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.veterinarios where profile_id = v_uid and p_especialidad = any (especialidades)) then
    raise exception 'Primero elegí la especialidad en tu perfil' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 or length(trim(coalesce(p_institucion, ''))) < 2 then
    raise exception 'Completá el título y la institución que lo otorgó' using errcode = 'P0001';
  end if;
  if p_anio is null or p_anio < 1950 or p_anio > extract(year from now())::int then
    raise exception 'Revisá el año del título' using errcode = 'P0001';
  end if;
  if p_archivos is null or cardinality(p_archivos) = 0 or cardinality(p_archivos) > 5 then
    raise exception 'Subí entre 1 y 5 archivos del título o certificado' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(p_archivos) a where split_part(a, '/', 1) <> v_uid::text) then
    raise exception 'Los archivos tienen que estar en tu carpeta' using errcode = 'P0001';
  end if;
  insert into public.especialidades_vet (veterinario_id, especialidad, estado, titulo, institucion, anio, archivos, motivo, enviada_at)
  values (v_uid, p_especialidad, 'pendiente', trim(p_titulo), trim(p_institucion), p_anio, p_archivos, null, now())
  on conflict (veterinario_id, especialidad) do update
    set estado = 'pendiente', titulo = excluded.titulo, institucion = excluded.institucion, anio = excluded.anio,
        archivos = excluded.archivos, motivo = null, enviada_at = now(), revisada_at = null, revisada_por = null;
  select nombre into v_nombre from public.profiles where id = v_uid;
  perform private.notificar_admins('Especialidad para revisar',
    coalesce(v_nombre, 'Un veterinario') || ' subió el certificado de ' || p_especialidad || '.');
end $$;

-- ---------- El administrador ----------
create or replace function public.especialidades_para_revisar()
returns table (id uuid, veterinario_id uuid, veterinario_nombre text, veterinario_email text, matricula text,
               cuenta_aprobada boolean, especialidad text, titulo text, institucion text, anio smallint, archivos text[],
               enviada_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select e.id, p.id, p.nombre, p.email, v.matricula, v.estado_revision = 'activo', e.especialidad, e.titulo, e.institucion,
         e.anio, e.archivos, e.enviada_at
  from public.especialidades_vet e
  join public.profiles p on p.id = e.veterinario_id
  join public.veterinarios v on v.profile_id = e.veterinario_id
  where e.estado = 'pendiente' and private.es_admin()
  order by e.enviada_at
$$;

create or replace function public.revisar_especialidad(p_id uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_admin uuid := (select auth.uid());
  e public.especialidades_vet%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_nombre text;
begin
  if not private.es_admin() then
    raise exception 'Solo un administrador puede revisar especialidades' using errcode = '42501';
  end if;
  select * into e from public.especialidades_vet where id = p_id;
  if not found or e.estado <> 'pendiente' then
    raise exception 'Ese certificado ya no está para revisar' using errcode = 'P0001';
  end if;
  if not p_aprobar and v_motivo is null then
    raise exception 'Escribí el motivo del rechazo' using errcode = 'P0001';
  end if;
  update public.especialidades_vet
     set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         motivo = case when p_aprobar then null else v_motivo end, revisada_at = now(), revisada_por = v_admin
   where id = p_id;
  select nombre into v_nombre from public.profiles where id = e.veterinario_id;
  insert into public.actividad_admin (tipo, texto, actor_id, objetivo_id)
  values (case when p_aprobar then 'aprobacion' else 'rechazo' end::public.tipo_actividad,
          case when p_aprobar then 'Se aprobó ' || e.especialidad || ' de ' || coalesce(v_nombre, 'un veterinario')
               else 'Se rechazó ' || e.especialidad || ' de ' || coalesce(v_nombre, 'un veterinario') || ': ' || v_motivo end,
          v_admin, e.veterinario_id);
  if p_aprobar then
    perform private.notificar(e.veterinario_id, 'cuenta', 'Especialidad aprobada',
      'Verificamos tu certificado de ' || e.especialidad || '. Ya la ofrecés a los dueños.');
  else
    perform private.notificar(e.veterinario_id, 'cuenta', 'Certificado rechazado',
      'No pudimos verificar tu certificado de ' || e.especialidad || ': ' || v_motivo || '. Podés subirlo de nuevo desde tu perfil.');
  end if;
end $$;

revoke all on function public.mis_especialidades(), public.cargar_certificado_especialidad(text, text, text, integer, text[]),
  public.especialidades_para_revisar(), public.revisar_especialidad(uuid, boolean, text) from public, anon;
grant execute on function public.mis_especialidades(), public.cargar_certificado_especialidad(text, text, text, integer, text[]),
  public.especialidades_para_revisar(), public.revisar_especialidad(uuid, boolean, text) to authenticated;
