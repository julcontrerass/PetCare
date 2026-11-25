-- Un turno completado o cancelado ya no se modifica: ni fecha, hora, veterinario, lugar, tipo, motivo o notas, ni su
-- estado (no vuelve a pendiente). Antes validar_turno dejaba pasar cualquier cambio a un turno que no estuviera
-- pendiente, así que uno completado se podía mover de fecha sin ninguna validación.
-- Las tareas del servidor (sin usuario en sesión) no se ven afectadas.
-- También reconoce los tipos de animal nuevos (Conejo, Hurón, Caballo, Cerdo; ver 20261124120200_mas_tipos_animales).
create or replace function private.validar_turno()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  v public.veterinarios%rowtype;
  s public.sedes%rowtype;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ahora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  v_uid uuid := (select auth.uid());
  v_actor_rol public.rol_usuario;
  v_tipo text;
  v_estado public.estado_mascota;
begin
  select case
           when p.rol = 'admin' then 'admin'
           when v_uid = new.veterinario_id then 'veterinario'
           else 'dueno'
         end::public.rol_usuario
    into v_actor_rol
    from public.profiles p where p.id = v_uid;

  if tg_op = 'UPDATE' then
    if v_uid is not null and old.estado in ('completado', 'cancelado') and (
         new.estado is distinct from old.estado
         or new.fecha is distinct from old.fecha or new.hora is distinct from old.hora
         or new.veterinario_id is distinct from old.veterinario_id or new.sede_id is distinct from old.sede_id
         or new.mascota_id is distinct from old.mascota_id or new.categoria is distinct from old.categoria
         or new.motivo is distinct from old.motivo or new.notas is distinct from old.notas
       ) then
      raise exception 'Este turno ya fue %: no se puede modificar',
        case old.estado when 'completado' then 'completado' else 'cancelado' end
        using errcode = 'P0001';
    end if;
    if new.estado = 'cancelado' and old.estado <> 'cancelado' then
      new.cancelado_por := v_actor_rol;
    end if;
    if new.estado <> 'pendiente' or (
         new.fecha = old.fecha and new.hora = old.hora
         and new.veterinario_id is not distinct from old.veterinario_id
         and new.sede_id is not distinct from old.sede_id
         and new.categoria = old.categoria
       ) then
      return new;
    end if;
  end if;

  if v_uid is null or new.veterinario_id is null then
    return new;
  end if;

  select estado into v_estado from public.mascotas where id = new.mascota_id;
  if v_estado is distinct from 'activa' then
    raise exception 'La mascota no está activa: no se pueden agendar turnos' using errcode = 'P0001';
  end if;

  select * into v from public.veterinarios where profile_id = new.veterinario_id;
  if not found or not private.es_vet_activo(new.veterinario_id) then
    raise exception 'El veterinario no está disponible' using errcode = 'P0001';
  end if;

  if new.fecha < v_hoy or (new.fecha = v_hoy and new.hora <= v_ahora) then
    raise exception 'No podés agendar un turno en una fecha u hora que ya pasó' using errcode = 'P0001';
  end if;

  if new.sede_id is not null then
    select * into s from public.sedes where id = new.sede_id and veterinario_id = new.veterinario_id and activa;
    if not found then
      raise exception 'Ese lugar de atención no está disponible' using errcode = 'P0001';
    end if;
  else
    select * into s from public.sedes
     where veterinario_id = new.veterinario_id and activa
       and extract(isodow from new.fecha)::smallint = any (dias_atencion)
       and new.hora >= hora_apertura
       and new.hora + make_interval(mins => new.duracion_min::integer) <= hora_cierre
     order by created_at limit 1;
    if found then
      new.sede_id := s.id;
    else
      select * into s from public.sedes where veterinario_id = new.veterinario_id
       order by activa desc, created_at limit 1;
      if not found then
        s.dias_atencion := v.dias_atencion;
        s.hora_apertura := v.hora_apertura;
        s.hora_cierre := v.hora_cierre;
      end if;
    end if;
  end if;

  if not (extract(isodow from new.fecha)::smallint = any (s.dias_atencion)) then
    raise exception 'El veterinario no atiende ese día en ese lugar' using errcode = 'P0001';
  end if;
  if new.hora < s.hora_apertura or new.hora + make_interval(mins => new.duracion_min::integer) > s.hora_cierre then
    raise exception 'El turno (% min) no entra en la atención del veterinario (% a %)',
      new.duracion_min, s.hora_apertura, s.hora_cierre
      using errcode = 'P0001';
  end if;

  -- Misma lista que TiposMascota en la app (y que la restricción de veterinarios.tipos_animales)
  select case lower(translate(trim(m.tipo), 'óÓ', 'oo'))
           when 'perro' then 'Perro' when 'gato' then 'Gato' when 'ave' then 'Ave'
           when 'reptil' then 'Reptil' when 'pez' then 'Pez' when 'roedor' then 'Roedor'
           when 'conejo' then 'Conejo' when 'huron' then 'Hurón' when 'caballo' then 'Caballo' when 'cerdo' then 'Cerdo'
           else 'Otro' end
    into v_tipo
    from public.mascotas m where m.id = new.mascota_id;
  if v_tipo is null or not (v_tipo = any (v.tipos_animales)) then
    raise exception 'Este veterinario no atiende ese tipo de mascota' using errcode = 'P0001';
  end if;
  return new;
end $function$;
