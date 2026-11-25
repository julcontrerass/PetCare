-- Co-dueños de una mascota: el dueño invita a otra cuenta (por DNI o correo); cuando acepta, ve y maneja la misma
-- mascota. El dueño original (mascotas.dueno_id) es el único que puede eliminarla y quitar a otros co-dueños; un
-- co-dueño puede salir cuando quiera. Si el dueño original elimina su cuenta, la mascota pasa al co-dueño más antiguo.

-- ---------- Tabla ----------
create type public.estado_codueno as enum ('pendiente', 'activo');

create table public.coduenos_mascota (
  id uuid primary key default gen_random_uuid(),
  mascota_id uuid not null references public.mascotas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  invitado_por uuid references public.profiles (id) on delete set null,
  estado public.estado_codueno not null default 'pendiente',
  created_at timestamptz not null default now(),
  respondida_at timestamptz,
  unique (mascota_id, usuario_id)
);
create index coduenos_mascota_usuario on public.coduenos_mascota (usuario_id);
create index coduenos_mascota_invitado_por on public.coduenos_mascota (invitado_por);

alter table public.coduenos_mascota enable row level security;
revoke all on public.coduenos_mascota from anon, authenticated;
grant select on public.coduenos_mascota to authenticated;

-- ---------- Quién es dueño ----------
-- Dueño = el original o un co-dueño que ya aceptó. Casi todas las políticas pasan por acá.
create or replace function private.es_dueno_de(p_mascota uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.mascotas where id = p_mascota and dueno_id = (select auth.uid())
  ) or exists (
    select 1 from public.coduenos_mascota
    where mascota_id = p_mascota and usuario_id = (select auth.uid()) and estado = 'activo'
  )
$$;

create or replace function private.es_dueno_original(p_mascota uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.mascotas where id = p_mascota and dueno_id = (select auth.uid()))
$$;

-- Todas las cuentas dueñas de una mascota (para los avisos).
create or replace function private.duenos_de(p_mascota uuid)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select dueno_id from public.mascotas where id = p_mascota and dueno_id is not null
  union
  select usuario_id from public.coduenos_mascota where mascota_id = p_mascota and estado = 'activo'
$$;

-- p_cuenta es dueña (original o co-dueña) de p_mascota.
create or replace function private.cuenta_es_duena(p_mascota uuid, p_cuenta uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.mascotas where id = p_mascota and dueno_id = p_cuenta)
      or exists (select 1 from public.coduenos_mascota where mascota_id = p_mascota and usuario_id = p_cuenta and estado = 'activo')
$$;

revoke all on function private.es_dueno_original(uuid), private.duenos_de(uuid), private.cuenta_es_duena(uuid, uuid) from public, anon;

create policy coduenos_select on public.coduenos_mascota for select to authenticated
  using (usuario_id = (select auth.uid()) or private.es_dueno_de(mascota_id));
create policy solo_cuentas_activas on public.coduenos_mascota as restrictive for all to authenticated
  using ((select private.cuenta_activa()));

-- ---------- Políticas de mascotas ----------
drop policy mascotas_select on public.mascotas;
create policy mascotas_select on public.mascotas for select to authenticated using (
  (dueno_id = (select auth.uid()))
  or ((dueno_id is null) and (creada_por = (select auth.uid())))
  or private.es_dueno_de(id)
  or private.es_admin()
  or private.vet_puede_ver_mascota(id)
);

drop policy mascotas_update on public.mascotas;
create policy mascotas_update on public.mascotas for update to authenticated
  using ((dueno_id = (select auth.uid())) or ((dueno_id is null) and (creada_por = (select auth.uid()))) or private.es_dueno_de(id))
  with check ((dueno_id = (select auth.uid())) or ((dueno_id is null) and (creada_por = (select auth.uid()))) or private.es_dueno_de(id));

-- Un co-dueño no cambia de dueño a la mascota ni la elimina (dar de baja = activa pasa a false).
create or replace function private.proteger_dueno_original()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is null or current_setting('petcare.transferir_mascota', true) = '1' then
    return new;
  end if;
  if old.dueno_id is not null and new.dueno_id is distinct from old.dueno_id then
    raise exception 'No se puede cambiar el dueño de la mascota' using errcode = '42501';
  end if;
  if old.activa and not new.activa and old.dueno_id is distinct from (select auth.uid()) then
    raise exception 'Solo el dueño original puede eliminar la mascota' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger mascotas_proteger_dueno before update on public.mascotas
  for each row execute function private.proteger_dueno_original();

-- ---------- Invitaciones ----------
-- Invita a una cuenta (por correo o DNI) a ser co-dueña. Devuelve el nombre de la persona invitada.
create or replace function public.invitar_codueno(p_mascota uuid, p_dato text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_dato text := trim(coalesce(p_dato, ''));
  v_mascota text;
  v_invitado uuid;
  v_nombre text;
  v_quien text;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  if not private.es_dueno_de(p_mascota) then
    raise exception 'Solo un dueño de la mascota puede invitar a otra persona' using errcode = '42501';
  end if;
  select nombre into v_mascota from public.mascotas where id = p_mascota and activa and dueno_id is not null;
  if not found then
    raise exception 'La mascota no está disponible' using errcode = 'P0001';
  end if;
  if length(v_dato) < 6 then
    raise exception 'Ingresá un DNI o un correo válido' using errcode = 'P0001';
  end if;

  select p.id, p.nombre into v_invitado, v_nombre
  from public.profiles p
  left join public.perfiles_privados pp on pp.profile_id = p.id
  where p.rol in ('dueno', 'veterinario') and p.estado = 'activo'
    and (lower(p.email) = lower(v_dato) or pp.dni = v_dato)
  limit 1;
  if v_invitado is null then
    raise exception 'No encontramos una cuenta con ese DNI o correo. La otra persona tiene que registrarse primero en PetCare.' using errcode = 'P0001';
  end if;
  if v_invitado = v_uid then
    raise exception 'No podés invitarte a vos mismo' using errcode = 'P0001';
  end if;
  if private.cuenta_es_duena(p_mascota, v_invitado) then
    raise exception '% ya es dueño/a de %', v_nombre, v_mascota using errcode = 'P0001';
  end if;
  if (select count(*) from public.coduenos_mascota where mascota_id = p_mascota) >= 10 then
    raise exception 'Llegaste al máximo de dueños para esta mascota' using errcode = 'P0001';
  end if;

  insert into public.coduenos_mascota (mascota_id, usuario_id, invitado_por, estado)
  values (p_mascota, v_invitado, v_uid, 'pendiente')
  on conflict (mascota_id, usuario_id) do update
    set invitado_por = excluded.invitado_por, created_at = now();

  select nombre into v_quien from public.profiles where id = v_uid;
  perform private.notificar(v_invitado, 'mascota', 'Te invitaron a compartir una mascota',
    coalesce(v_quien, 'Alguien') || ' te invitó a ser dueño/a de ' || v_mascota || '. Aceptá la invitación desde tu Inicio.');
  return v_nombre;
end $$;

-- Invitaciones pendientes que recibió la cuenta (todavía no puede ver la mascota, por eso va por acá).
create or replace function public.mis_invitaciones_codueno()
returns table (id uuid, mascota_id uuid, mascota_nombre text, mascota_tipo text, mascota_foto_path text, invitado_por_nombre text, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select c.id, m.id, m.nombre, m.tipo, m.foto_path, p.nombre, c.created_at
  from public.coduenos_mascota c
  join public.mascotas m on m.id = c.mascota_id and m.activa
  left join public.profiles p on p.id = c.invitado_por
  where c.usuario_id = (select auth.uid()) and c.estado = 'pendiente' and private.cuenta_activa()
  order by c.created_at desc
$$;

create or replace function public.responder_invitacion_codueno(p_invitacion uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  c public.coduenos_mascota%rowtype;
  v_mascota text;
  v_quien text;
  v_dueno uuid;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into c from public.coduenos_mascota where id = p_invitacion and usuario_id = v_uid and estado = 'pendiente';
  if not found then
    raise exception 'La invitación ya no está disponible' using errcode = 'P0001';
  end if;
  select nombre into v_mascota from public.mascotas where id = c.mascota_id;
  select nombre into v_quien from public.profiles where id = v_uid;
  if p_aceptar then
    -- Avisa a los dueños de antes de sumarse
    for v_dueno in select private.duenos_de(c.mascota_id) loop
      perform private.notificar(v_dueno, 'mascota', 'Nuevo co-dueño', coalesce(v_quien, 'La persona invitada') || ' ahora también es dueño/a de ' || v_mascota || '.');
    end loop;
    update public.coduenos_mascota set estado = 'activo', respondida_at = now() where id = c.id;
  else
    delete from public.coduenos_mascota where id = c.id;
    perform private.notificar(c.invitado_por, 'mascota', 'Invitación rechazada', coalesce(v_quien, 'La persona invitada') || ' no aceptó ser dueño/a de ' || v_mascota || '.');
  end if;
end $$;

-- Dueños de una mascota (y las invitaciones pendientes), para la ficha.
create or replace function public.duenos_de_mascota(p_mascota uuid)
returns table (codueno_id uuid, usuario_id uuid, nombre text, email text, foto_path text, estado text, es_original boolean)
language sql stable security definer set search_path to '' as $$
  select null::uuid, p.id, p.nombre, p.email, p.foto_path, 'activo', true
  from public.mascotas m join public.profiles p on p.id = m.dueno_id
  where m.id = p_mascota and private.es_dueno_de(p_mascota)
  union all
  select c.id, p.id, p.nombre, p.email, p.foto_path, c.estado::text, false
  from public.coduenos_mascota c join public.profiles p on p.id = c.usuario_id
  where c.mascota_id = p_mascota and private.es_dueno_de(p_mascota)
  order by 7 desc, 6, 3
$$;

-- Quita un co-dueño o una invitación: el propio co-dueño (sale), el dueño original, o quien invitó si sigue pendiente.
create or replace function public.quitar_codueno(p_codueno uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  c public.coduenos_mascota%rowtype;
  v_mascota text;
  v_quien text;
  v_dueno uuid;
begin
  if v_uid is null or not private.cuenta_activa() then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  select * into c from public.coduenos_mascota where id = p_codueno;
  if not found then
    raise exception 'Ya no está en la lista de dueños' using errcode = 'P0001';
  end if;
  if not (c.usuario_id = v_uid or private.es_dueno_original(c.mascota_id)
          or (c.estado = 'pendiente' and c.invitado_por = v_uid)) then
    raise exception 'Solo el dueño original puede quitar a otro dueño' using errcode = '42501';
  end if;
  select nombre into v_mascota from public.mascotas where id = c.mascota_id;
  select nombre into v_quien from public.profiles where id = c.usuario_id;
  delete from public.coduenos_mascota where id = c.id;
  if c.estado = 'activo' then
    if c.usuario_id = v_uid then
      for v_dueno in select private.duenos_de(c.mascota_id) loop
        perform private.notificar(v_dueno, 'mascota', 'Un co-dueño salió', coalesce(v_quien, 'Un co-dueño') || ' dejó de ser dueño/a de ' || v_mascota || '.');
      end loop;
    else
      perform private.notificar(c.usuario_id, 'mascota', 'Ya no sos dueño/a', 'Te quitaron como dueño/a de ' || v_mascota || '.');
    end if;
  end if;
end $$;

revoke all on function public.invitar_codueno(uuid, text), public.mis_invitaciones_codueno(), public.responder_invitacion_codueno(uuid, boolean),
  public.duenos_de_mascota(uuid), public.quitar_codueno(uuid) from public, anon;
grant execute on function public.invitar_codueno(uuid, text), public.mis_invitaciones_codueno(), public.responder_invitacion_codueno(uuid, boolean),
  public.duenos_de_mascota(uuid), public.quitar_codueno(uuid) to authenticated;

-- ---------- Avisos para todos los dueños ----------
create or replace function private.avisos_turno()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_mascota text;
  v_actor uuid := (select auth.uid());
  v_cuando text := to_char(new.fecha, 'DD/MM/YYYY') || ' ' || to_char(new.hora, 'HH24:MI');
  v_titulo text;
  v_mensaje text;
  v_tipo public.tipo_notificacion;
  v_dueno uuid;
begin
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;

  if v_actor is not null and private.cuenta_es_duena(new.mascota_id, v_actor) and new.veterinario_id is not null
     and (tg_op = 'INSERT' or new.veterinario_id is distinct from old.veterinario_id) then
    insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por)
    values (new.mascota_id, new.veterinario_id, 'activo', 'dueno')
    on conflict (mascota_id, veterinario_id) do update set estado = 'activo';
  end if;

  if tg_op = 'INSERT' then
    v_tipo := 'turno'; v_titulo := 'Nuevo turno';
    v_mensaje := v_mascota || ': ' || new.categoria || ' el ' || v_cuando;
  elsif new.estado = 'completado' and old.estado <> 'completado' then
    v_tipo := 'completado'; v_titulo := 'Turno finalizado';
    v_mensaje := v_mascota || ': el turno de ' || new.categoria || ' del ' || v_cuando || ' fue completado. Ya podés ver el detalle en el historial.';
  elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
    v_tipo := 'cancelacion'; v_titulo := 'Turno cancelado';
    v_mensaje := v_mascota || ': se canceló el turno de ' || new.categoria || ' del ' || v_cuando;
  elsif new.estado = 'pendiente' and (new.fecha <> old.fecha or new.hora <> old.hora) then
    v_tipo := 'turno'; v_titulo := 'Turno modificado';
    v_mensaje := v_mascota || ': ' || new.categoria || ' pasó al ' || v_cuando;
  elsif new.estado = 'pendiente' and new.veterinario_id is distinct from old.veterinario_id then
    v_tipo := 'turno'; v_titulo := 'Nuevo turno';
    v_mensaje := v_mascota || ': ' || new.categoria || ' el ' || v_cuando;
  else
    return new;
  end if;

  if v_actor is null then return new; end if;
  for v_dueno in select private.duenos_de(new.mascota_id) loop
    perform private.notificar(v_dueno, v_tipo, v_titulo, v_mensaje);
  end loop;
  if new.veterinario_id is not null and new.veterinario_id <> v_actor and v_tipo <> 'completado' then
    perform private.notificar(new.veterinario_id, v_tipo, v_titulo, v_mensaje);
  end if;
  return new;
end $$;

create or replace function private.avisos_recordatorio()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_mascota text; v_vet text; v_dueno uuid;
begin
  if private.cuenta_es_duena(new.mascota_id, new.creado_por) then return null; end if;
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;
  select nombre into v_vet from public.profiles where id = new.creado_por;
  for v_dueno in select private.duenos_de(new.mascota_id) loop
    perform private.notificar(v_dueno, 'mascota', 'Recordatorio de tu veterinario',
      v_vet || ' te dejó un recordatorio para ' || v_mascota || ': ' || new.titulo || ' el ' || to_char(new.fecha, 'DD/MM/YYYY'));
  end loop;
  return null;
end $$;

create or replace function private.avisos_acceso()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_mascota text;
  v_vet text;
  v_actor uuid := (select auth.uid());
  v_dueno uuid;
begin
  if v_actor is null then return new; end if;
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;
  select nombre into v_vet from public.profiles where id = new.veterinario_id;

  if new.estado = 'pendiente' and (tg_op = 'INSERT' or old.estado is distinct from 'pendiente') then
    if new.iniciado_por = 'veterinario' then
      for v_dueno in select private.duenos_de(new.mascota_id) loop
        perform private.notificar(v_dueno, 'acceso', 'Solicitud de acceso', v_vet || ' pide acceso a ' || v_mascota);
      end loop;
    else
      perform private.notificar(new.veterinario_id, 'acceso', 'Nueva solicitud', 'Un dueño quiere compartirte a ' || v_mascota);
    end if;
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if private.cuenta_es_duena(new.mascota_id, v_actor) then
      perform private.notificar(new.veterinario_id, 'acceso', 'Acceso actualizado',
        'El acceso a ' || v_mascota || ' ahora está: ' || new.estado);
    else
      for v_dueno in select private.duenos_de(new.mascota_id) loop
        perform private.notificar(v_dueno, 'acceso', 'Acceso actualizado',
          v_vet || ' respondió: ' || new.estado || ' (' || v_mascota || ')');
      end loop;
    end if;
  end if;
  return new;
end $$;

create or replace function private.avisos_mascota()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_dueno uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.dueno_id is distinct from (select auth.uid()) then return new; end if;
    perform private.notificar(new.dueno_id, 'mascota', 'Agregaste una nueva mascota',
      'Agregaste a ' || new.nombre || ' (' || new.tipo || ') a tus mascotas.');
    return new;
  end if;
  if not private.cuenta_es_duena(new.id, (select auth.uid())) then return new; end if;
  if old.activa and not new.activa then
    update public.turnos set estado = 'cancelado' where mascota_id = new.id and estado = 'pendiente';
    update public.accesos_mascota set estado = 'inactivo' where mascota_id = new.id and estado in ('activo', 'pendiente');
    for v_dueno in select private.duenos_de(new.id) loop
      perform private.notificar(v_dueno, 'mascota', 'Mascota dada de baja', new.nombre || ' fue dada de baja de tus mascotas.');
    end loop;
  elsif old.estado = 'activa' and new.estado <> 'activa' then
    update public.turnos set estado = 'cancelado' where mascota_id = new.id and estado = 'pendiente';
    for v_dueno in select private.duenos_de(new.id) loop
      perform private.notificar(v_dueno, 'mascota',
        case new.estado when 'fallecida' then 'Mascota fallecida' else 'Mascota inactiva' end,
        new.nombre || ' pasó a estar ' || case new.estado when 'fallecida' then 'fallecida' else 'inactiva' end ||
        '. Se cancelaron los turnos pendientes.');
    end loop;
  elsif old.estado <> 'activa' and new.estado = 'activa' then
    for v_dueno in select private.duenos_de(new.id) loop
      perform private.notificar(v_dueno, 'mascota', 'Mascota activa', new.nombre || ' volvió a estar activa.');
    end loop;
  end if;
  return new;
end $$;

-- ---------- Veterinarios y dueños que se ven entre sí ----------
create or replace function private.dueno_ve_vet(p_vet uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.accesos_mascota a
    where a.veterinario_id = p_vet and private.es_dueno_de(a.mascota_id)
  )
$$;

create or replace function private.vet_ve_dueno(p_dueno uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
      from public.accesos_mascota a
     where private.cuenta_es_duena(a.mascota_id, p_dueno)
       and a.veterinario_id = (select auth.uid())
       and private.es_vet_activo(a.veterinario_id)
       and ((a.estado = 'activo' and private.acceso_vigente(a.vence_el))
            or (a.estado = 'pendiente' and a.iniciado_por = 'dueno'))
  )
$$;

create or replace function private.vet_con_pedido_al_dueno(p_dueno uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
      from public.accesos_mascota a
     where private.cuenta_es_duena(a.mascota_id, p_dueno)
       and a.veterinario_id = (select auth.uid())
       and a.estado in ('pendiente', 'activo')
  )
$$;

create or replace function public.solicitar_acceso(p_mascota uuid, p_turno jsonb default null::jsonb)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  a public.accesos_mascota%rowtype;
begin
  if not private.es_vet_activo(v_uid) then
    raise exception 'Solo un veterinario activo puede pedir acceso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.mascotas where id = p_mascota and dueno_id is not null and activa) then
    raise exception 'La mascota no está disponible' using errcode = 'P0001';
  end if;
  if private.es_dueno_de(p_mascota) then
    raise exception 'Esa mascota es tuya: la ves desde el modo dueño' using errcode = 'P0001';
  end if;
  select * into a from public.accesos_mascota where mascota_id = p_mascota and veterinario_id = v_uid;
  if not found then
    insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por, turno_propuesto)
    values (p_mascota, v_uid, 'pendiente', 'veterinario', p_turno);
    return 'pendiente';
  elsif a.estado in ('pendiente', 'activo') then
    if a.estado = 'pendiente' and p_turno is not null then
      update public.accesos_mascota set turno_propuesto = p_turno where id = a.id;
    end if;
    return a.estado::text;
  elsif a.updated_at > now() - interval '24 hours' then
    raise exception 'Esperá 24 horas para volver a pedir acceso a esta mascota' using errcode = 'P0001';
  end if;
  update public.accesos_mascota
     set estado = 'pendiente', iniciado_por = 'veterinario', turno_propuesto = p_turno
   where id = a.id;
  return 'pendiente';
end $$;

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
    and private.es_vet_activo((select auth.uid()))
    and length(trim(p_dato)) >= 6
    and (lower(p.email) = lower(trim(p_dato)) or pp.dni = trim(p_dato))
$$;

-- ---------- Baja de cuenta: la mascota compartida pasa al co-dueño ----------
-- Archivos que se borran con la cuenta: los de las mascotas que no pasan a otro dueño.
create or replace function public.rutas_archivos_cuenta()
returns table (bucket text, ruta text)
language sql stable security definer set search_path to '' as $$
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where (select auth.uid()) is not null
    and (
      (o.bucket_id in ('fotos', 'credenciales') and (storage.foldername(o.name))[1] = (select auth.uid())::text)
      or (o.bucket_id = 'archivos' and private.uuid_de_ruta(o.name) in (
            select m.id from public.mascotas m
            where m.dueno_id = (select auth.uid())
              and not exists (select 1 from public.coduenos_mascota c where c.mascota_id = m.id and c.estado = 'activo')))
    )
$$;

create or replace function public.eliminar_mi_cuenta()
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_rol public.rol_usuario;
  v_nombre text;
  r record;
begin
  select rol, nombre into v_rol, v_nombre from public.profiles where id = v_uid;
  if not found then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;
  if v_rol = 'admin' then
    raise exception 'Un administrador no puede eliminar su cuenta desde la app' using errcode = 'P0001';
  end if;

  -- las mascotas compartidas pasan al co-dueño más antiguo en vez de borrarse
  perform set_config('petcare.transferir_mascota', '1', true);
  for r in
    select distinct on (c.mascota_id) c.id, c.mascota_id, c.usuario_id, m.nombre
    from public.coduenos_mascota c join public.mascotas m on m.id = c.mascota_id
    where m.dueno_id = v_uid and c.estado = 'activo'
    order by c.mascota_id, c.respondida_at nulls last, c.created_at
  loop
    delete from public.coduenos_mascota where id = r.id;
    update public.mascotas set dueno_id = r.usuario_id where id = r.mascota_id;
    perform private.notificar(r.usuario_id, 'mascota', 'Ahora sos el dueño principal',
      v_nombre || ' eliminó su cuenta: ' || r.nombre || ' quedó a tu nombre.');
  end loop;
  perform set_config('petcare.transferir_mascota', '', true);

  -- como veterinario: se cancelan sus turnos pendientes (los dueños reciben el aviso)
  update public.turnos set estado = 'cancelado' where veterinario_id = v_uid and estado = 'pendiente';

  -- como dueño: se avisa a los veterinarios que tenían turnos pendientes con sus mascotas
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  select distinct t.veterinario_id, 'cancelacion'::public.tipo_notificacion, 'Turno cancelado',
         'El dueño de ' || m.nombre || ' eliminó su cuenta: se cancelan sus turnos.'
  from public.turnos t join public.mascotas m on m.id = t.mascota_id
  where m.dueno_id = v_uid and t.estado = 'pendiente' and t.veterinario_id is not null;

  insert into public.actividad_admin (tipo, texto) values ('baja', v_nombre || ' eliminó su cuenta');
  delete from auth.users where id = v_uid;
end $$;

-- Los cambios en la tabla llegan en vivo (invitaciones aceptadas, co-dueños que salen)
alter publication supabase_realtime add table public.coduenos_mascota;
