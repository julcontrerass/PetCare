-- Sala de espera: si el veterinario tiene recepción (alguien activo con el rol "recepcion" en una veterinaria aprobada
-- donde atiende), la llegada del dueño la marca la recepción y el veterinario solo ve quién está esperando. Sin
-- recepción, la marca él mismo. Esta función le dice a la app cuál de los dos casos es.
create function public.tengo_recepcion()
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
    from public.clinica_miembros v
    join public.clinicas c on c.id = v.clinica_id and c.activa and c.revision = 'aprobada'
    join public.clinica_miembros r on r.clinica_id = v.clinica_id
    join public.profiles p on p.id = r.cuenta_id and p.estado = 'activo'
    where v.cuenta_id = (select auth.uid()) and v.estado = 'activo' and 'veterinario' = any (v.roles)
      and r.estado = 'activo' and r.cuenta_id <> v.cuenta_id and 'recepcion' = any (r.roles)
  )
$$;
revoke all on function public.tengo_recepcion() from public, anon;
grant execute on function public.tengo_recepcion() to authenticated;
