-- Sin `veterinaria` en el alta, jsonb_typeof devuelve null y la condición quedaba en null: la cuenta seguía de largo
-- e intentaba crear una veterinaria sin nombre (el alta fallaba). Se compara contra un valor siempre definido.
create or replace function private.veterinaria_del_registro()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)->'veterinaria';
begin
  if coalesce(jsonb_typeof(v), '') <> 'object' or coalesce(new.raw_user_meta_data->>'rol', '') = 'veterinario' then
    return new;
  end if;
  perform private.nueva_clinica(new.id, v->>'nombre', v->>'direccion', v->>'telefono');
  return new;
end $$;
revoke all on function private.veterinaria_del_registro() from public, anon, authenticated;
