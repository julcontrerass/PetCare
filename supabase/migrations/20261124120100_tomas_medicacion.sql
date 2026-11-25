-- Tomas de medicación: el dueño tilda cada toma de una receta (con frecuencia y duración) cuando se la da a la
-- mascota; queda guardado cuándo se dio y quién la marcó, y el veterinario con acceso lo ve en la receta.
-- Una fila = una toma dada. Destildar la borra.
create table public.tomas_medicacion (
  id uuid primary key default gen_random_uuid(),
  prescripcion_id uuid not null references public.prescripciones (id) on delete cascade,
  -- Se completa sola a partir de la receta (trigger): no se puede elegir a mano
  mascota_id uuid not null references public.mascotas (id) on delete cascade,
  -- La hora a la que tocaba la toma, en la hora local de la app (la misma con la que se programan los avisos)
  programada timestamp not null,
  dada_at timestamptz not null default now(),
  -- La completa el trigger con la cuenta en sesión
  registrada_por uuid references public.profiles (id) on delete set null,
  unique (prescripcion_id, programada)
);
create index tomas_medicacion_mascota on public.tomas_medicacion (mascota_id);
create index tomas_medicacion_registrada_por on public.tomas_medicacion (registrada_por);

create or replace function private.toma_de_receta()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  select mascota_id into new.mascota_id from public.prescripciones where id = new.prescripcion_id;
  if new.mascota_id is null then
    raise exception 'La receta no existe' using errcode = 'P0001';
  end if;
  new.registrada_por := (select auth.uid());
  new.dada_at := now();
  return new;
end $$;

create trigger tomas_medicacion_receta before insert on public.tomas_medicacion
  for each row execute function private.toma_de_receta();

alter table public.tomas_medicacion enable row level security;
revoke all on public.tomas_medicacion from anon, authenticated;
grant select, insert, delete on public.tomas_medicacion to authenticated;

create policy tomas_select on public.tomas_medicacion for select to authenticated
  using (private.es_dueno_de(mascota_id) or private.vet_tiene_acceso(mascota_id));
create policy tomas_insert on public.tomas_medicacion for insert to authenticated
  with check (private.es_dueno_de(mascota_id));
create policy tomas_delete on public.tomas_medicacion for delete to authenticated
  using (private.es_dueno_de(mascota_id));
create policy solo_cuentas_activas on public.tomas_medicacion as restrictive for all to authenticated
  using ((select private.cuenta_activa()));

alter publication supabase_realtime add table public.tomas_medicacion;
