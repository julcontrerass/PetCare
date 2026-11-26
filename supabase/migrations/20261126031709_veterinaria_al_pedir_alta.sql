-- Un dueño que pide sumarse como veterinario (solicitar_alta_veterinario) también tiene que recibir su veterinaria,
-- como el que se registra directamente como veterinario (handle_new_user). Se hace con un trigger diferido al final
-- de la transacción: si handle_new_user ya la creó, no hace nada.
create or replace function private.veterinaria_propia()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_clinica uuid;
  v_nombre text;
  v_tel text;
begin
  if exists (
    select 1 from public.clinica_miembros where cuenta_id = new.profile_id and 'titular' = any (roles)
  ) or not exists (select 1 from public.veterinarios where profile_id = new.profile_id) then
    return null;
  end if;
  select nombre, telefono into v_nombre, v_tel from public.profiles where id = new.profile_id;
  insert into public.clinicas (nombre, direccion, telefono, creada_por)
  values (left(coalesce(nullif(trim(new.clinica), ''), 'Consultorio de ' || coalesce(v_nombre, 'veterinario')), 120),
          new.direccion_clinica, v_tel, new.profile_id)
  returning id into v_clinica;
  insert into public.clinica_miembros (clinica_id, cuenta_id, roles, estado, respondida_at)
  values (v_clinica, new.profile_id, array['titular', 'veterinario']::public.rol_clinica[], 'activo', now());
  insert into public.clinica_historial (clinica_id, cuenta_id, accion, actor) values (v_clinica, new.profile_id, 'creacion', new.profile_id);
  update public.sedes set clinica_id = v_clinica where veterinario_id = new.profile_id and clinica_id is null;
  return null;
end $$;
revoke all on function private.veterinaria_propia() from public, anon, authenticated;

create constraint trigger veterinarios_veterinaria_propia
  after insert on public.veterinarios
  deferrable initially deferred
  for each row execute function private.veterinaria_propia();
