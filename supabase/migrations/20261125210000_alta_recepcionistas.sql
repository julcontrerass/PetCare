-- Alta de cuentas de recepcionista, de las dos formas:
-- 1. Se registra sola ("Soy recepcionista" en Crear una cuenta): antes de crear la cuenta la app confirma el
--    veterinario con veterinario_para_recepcion (por correo o matrícula, sin sesión) y manda su dato en los metadatos
--    (recepcion_de). Al crearse el usuario, handle_new_user deja el pedido pendiente y le avisa al veterinario.
-- 2. La crea el veterinario desde Perfil → Recepción: la Edge Function crear-cuenta-recepcionista crea el usuario
--    con una contraseña temporal y llama a vincular_cuenta_recepcionista, que deja el vínculo activo y la cuenta
--    marcada para elegir su contraseña al primer ingreso.
-- En los dos casos la cuenta es de rol 'dueno': también puede cargar mascotas propias si alguna vez quiere.

-- ---------- Confirmar el veterinario antes de registrarse ----------
-- Solo por correo o matrícula (no por DNI) y solo devuelve el nombre y la clínica de un veterinario activo.
create or replace function public.veterinario_para_recepcion(p_dato text)
returns table (nombre text, clinica text)
language sql stable security definer set search_path to '' as $$
  select p.nombre, v.clinica
  from public.profiles p
  join public.veterinarios v on v.profile_id = p.id
  where length(trim(coalesce(p_dato, ''))) >= 3
    and (lower(p.email) = lower(trim(p_dato)) or upper(v.matricula) = upper(trim(p_dato)))
    and private.es_vet_activo(p.id)
  limit 1
$$;
revoke all on function public.veterinario_para_recepcion(text) from public;
grant execute on function public.veterinario_para_recepcion(text) to anon, authenticated;

-- ---------- Alta de usuarios ----------
-- Igual que antes, más: si los metadatos traen recepcion_de, queda pedido el vínculo con ese veterinario.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol public.rol_usuario := case m->>'rol' when 'veterinario' then 'veterinario' else 'dueno' end;
  v_dni text := nullif(trim(m->>'dni'), '');
  v_masc jsonb;
  v_chip text;
  v_sede jsonb;
  v_nombre text;
  v_ap time;
  v_ci time;
  v_vet uuid;
begin
  if v_dni is not null and v_dni !~ '^[0-9]{7,8}$' then
    raise exception 'El DNI debe tener 7 u 8 números' using errcode = 'P0001';
  end if;
  if v_dni is not null and exists (select 1 from public.perfiles_privados where dni = v_dni) then
    raise exception 'Ese DNI ya está registrado' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, rol, estado, nombre, email, telefono, direccion, terminos_version, terminos_aceptados_at)
  values (
    new.id, v_rol,
    case when v_rol = 'veterinario' then 'pendiente_revision' else 'activo' end::public.estado_cuenta,
    coalesce(nullif(trim(m->>'nombre'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(m->>'telefono', ''),
    nullif(m->>'direccion', ''),
    nullif(m->>'terminos_version', ''),
    case when nullif(m->>'terminos_version', '') is not null then now() end
  );
  insert into public.perfiles_privados (profile_id, dni) values (new.id, v_dni);

  if v_rol = 'veterinario' then
    insert into public.veterinarios (
      profile_id, matricula, clinica, direccion_clinica, dias_atencion, hora_apertura, hora_cierre,
      especialidades, tipos_animales, duraciones
    )
    values (
      new.id,
      coalesce(nullif(trim(m->>'matricula'), ''), 'SIN-' || left(new.id::text, 8)),
      nullif(m->>'clinica', ''),
      nullif(m->>'direccion_clinica', ''),
      case when jsonb_typeof(m->'dias_atencion') = 'array'
        then array(select jsonb_array_elements_text(m->'dias_atencion')::smallint)
        else '{1,2,3,4,5}'::smallint[] end,
      coalesce(nullif(m->>'hora_apertura', '')::time, '09:00'::time),
      coalesce(nullif(m->>'hora_cierre', '')::time, '18:00'::time),
      case when jsonb_typeof(m->'especialidades') = 'array'
        then array(select jsonb_array_elements_text(m->'especialidades'))
        else '{}'::text[] end,
      case when jsonb_typeof(m->'tipos_animales') = 'array'
        then array(select jsonb_array_elements_text(m->'tipos_animales'))
        else array['Perro','Gato','Ave','Reptil','Pez','Roedor','Otro'] end,
      case when jsonb_typeof(m->'duraciones') = 'object' then m->'duraciones' else '{}'::jsonb end
    );

    -- Los demás lugares de atención (el primero lo crea solo la fila de arriba)
    if jsonb_typeof(m->'sedes') = 'array' then
      for v_sede in select * from jsonb_array_elements(m->'sedes') limit 2 loop
        v_nombre := nullif(trim(v_sede->>'nombre'), '');
        v_ap := coalesce(nullif(v_sede->>'hora_apertura', '')::time, '09:00'::time);
        v_ci := coalesce(nullif(v_sede->>'hora_cierre', '')::time, '18:00'::time);
        if v_nombre is null or v_ci <= v_ap then
          continue;
        end if;
        insert into public.sedes (veterinario_id, nombre, direccion, dias_atencion, hora_apertura, hora_cierre)
        values (
          new.id, v_nombre, nullif(trim(v_sede->>'direccion'), ''),
          case when jsonb_typeof(v_sede->'dias_atencion') = 'array' and jsonb_array_length(v_sede->'dias_atencion') > 0
            then array(select jsonb_array_elements_text(v_sede->'dias_atencion')::smallint)
            else '{1,2,3,4,5}'::smallint[] end,
          v_ap, v_ci
        );
      end loop;
    end if;
  else
    for v_masc in
      select * from jsonb_array_elements(
        case when jsonb_typeof(m->'mascotas') = 'array' then m->'mascotas' else '[]'::jsonb end)
    loop
      v_chip := nullif(v_masc->>'microchip', '');
      insert into public.mascotas (dueno_id, nombre, tipo, raza, nacimiento, sexo, peso_kg, microchip, color, observaciones)
      values (
        new.id,
        v_masc->>'nombre',
        coalesce(nullif(v_masc->>'tipo', ''), 'Otro'),
        nullif(v_masc->>'raza', ''),
        nullif(v_masc->>'nacimiento', '')::date,
        nullif(lower(v_masc->>'sexo'), '')::public.sexo_mascota,
        private.parse_peso(v_masc->>'peso'),
        case when v_chip ~ '^[0-9]{15}$' then v_chip end,
        nullif(v_masc->>'color', ''),
        nullif(v_masc->>'observaciones', '')
      );
    end loop;

    -- Se registró como recepcionista: queda pedido el vínculo (si el veterinario ya no está, se registra igual)
    if nullif(trim(m->>'recepcion_de'), '') is not null then
      v_vet := private.cuenta_por_dato(m->>'recepcion_de', true);
      if v_vet is not null and v_vet <> new.id and private.es_vet_activo(v_vet) then
        insert into public.recepcionistas_vet (veterinario_id, recepcionista_id, estado, iniciado_por)
        values (v_vet, new.id, 'pendiente', 'recepcionista')
        on conflict (veterinario_id, recepcionista_id) do nothing;
        insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
        values (v_vet, new.id, 'pedido', new.id);
        perform private.notificar(v_vet, 'cuenta', 'Pedido de recepción',
          coalesce(nullif(trim(m->>'nombre'), ''), 'Una persona') ||
          ' se registró en PetCare y pide manejar tu agenda como recepcionista. Respondé desde Perfil → Recepción.');
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------- Cuenta creada por el veterinario ----------
-- Solo la usa la Edge Function crear-cuenta-recepcionista (con la clave de servicio), después de crear el usuario.
create or replace function public.vincular_cuenta_recepcionista(p_cuenta uuid, p_veterinario uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.es_vet_activo(p_veterinario) then
    raise exception 'El veterinario no está activo';
  end if;
  update public.profiles
     set debe_cambiar_password = true, creada_por_veterinario = p_veterinario
   where id = p_cuenta and rol = 'dueno';
  if not found then
    raise exception 'La cuenta no existe';
  end if;
  insert into public.recepcionistas_vet (veterinario_id, recepcionista_id, estado, iniciado_por, respondida_at)
  values (p_veterinario, p_cuenta, 'activo', 'veterinario', now())
  on conflict (veterinario_id, recepcionista_id) do update set estado = 'activo', respondida_at = now();
  insert into public.recepcion_historial (veterinario_id, recepcionista_id, accion, actor)
  values (p_veterinario, p_cuenta, 'alta', p_veterinario);
end $$;
revoke all on function public.vincular_cuenta_recepcionista(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vincular_cuenta_recepcionista(uuid, uuid) to service_role;
