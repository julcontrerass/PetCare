-- Bloqueos de agenda (segunda parte): validar_turno no deja sacar turnos en la pausa del lugar, en un bloqueo ni
-- encima de otro turno pendiente del mismo veterinario (en cualquier lugar), y el aviso de cancelación lleva el
-- motivo del bloqueo. La primera parte es 20261128023413_bloqueos_de_agenda.sql.

-- ---------- Validación de turnos: pausa, bloqueos y turnos que se pisan ----------
create or replace function private.validar_turno()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v public.veterinarios%rowtype;
  s public.sedes%rowtype;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ahora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  v_uid uuid := (select auth.uid());
  v_es_recepcion boolean := private.es_recepcion_de(new.veterinario_id);
  v_actor_rol public.rol_usuario;
  v_tipo text;
  v_estado public.estado_mascota;
  v_inicio timestamp;
  v_fin timestamp;
  v_motivo text;
begin
  select case
           when p.rol = 'admin' then 'admin'
           when v_uid = new.veterinario_id or v_es_recepcion then 'veterinario'
           else 'dueno'
         end::public.rol_usuario
    into v_actor_rol
    from public.profiles p where p.id = v_uid;

  if v_uid is not null then
    new.gestionado_por := v_uid;
  end if;

  if tg_op = 'UPDATE' then
    if v_uid is not null and old.estado in ('completado', 'cancelado') and (
         new.estado is distinct from old.estado
         or new.fecha is distinct from old.fecha or new.hora is distinct from old.hora
         or new.veterinario_id is distinct from old.veterinario_id or new.sede_id is distinct from old.sede_id
         or new.mascota_id is distinct from old.mascota_id or new.categoria is distinct from old.categoria
         or new.motivo is distinct from old.motivo or new.notas is distinct from old.notas
         or new.llegada is distinct from old.llegada
       ) then
      raise exception 'Este turno ya fue %: no se puede modificar',
        case old.estado when 'completado' then 'completado' else 'cancelado' end
        using errcode = 'P0001';
    end if;
    if new.estado = 'completado' and old.estado <> 'completado' and v_uid is not null
       and v_uid is distinct from new.veterinario_id and v_es_recepcion then
      raise exception 'Solo el veterinario puede dar por completado un turno' using errcode = '42501';
    end if;
    if new.llegada is distinct from old.llegada then
      if v_uid is not null and v_uid is distinct from new.veterinario_id and not v_es_recepcion then
        raise exception 'Solo el veterinario o su recepción marcan la llegada' using errcode = '42501';
      end if;
      if new.llegada = 'en_espera' and new.fecha <> v_hoy then
        raise exception 'Solo se puede marcar la llegada de un turno de hoy' using errcode = 'P0001';
      end if;
      if new.llegada = 'no_vino' and new.fecha > v_hoy then
        raise exception 'Todavía no es el día del turno' using errcode = 'P0001';
      end if;
      new.llegada_at := case when new.llegada is null then null else now() end;
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
    -- Si cambia el día o la hora, la llegada que se había marcado ya no vale
    new.llegada := null;
    new.llegada_at := null;
  elsif new.llegada is not null then
    raise exception 'La llegada se marca después de agendar el turno' using errcode = 'P0001';
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

  -- La pausa del lugar
  if s.pausa_desde is not null
     and new.hora < s.pausa_hasta and new.hora + make_interval(mins => new.duracion_min::integer) > s.pausa_desde then
    raise exception 'Ese horario es la pausa del veterinario (% a % hs)',
      to_char(s.pausa_desde, 'HH24:MI'), to_char(s.pausa_hasta, 'HH24:MI')
      using errcode = 'P0001';
  end if;

  -- Los bloqueos de agenda
  v_inicio := new.fecha + new.hora;
  v_fin := v_inicio + make_interval(mins => new.duracion_min::integer);
  select b.motivo into v_motivo from public.bloqueos_agenda b
   where b.veterinario_id = new.veterinario_id and b.desde < v_fin and b.hasta > v_inicio
   limit 1;
  if found then
    raise exception 'El veterinario no atiende en ese horario (%)', v_motivo using errcode = 'P0001';
  end if;

  -- Otro turno pendiente del mismo veterinario en ese horario, en cualquier lugar
  if exists (
    select 1 from public.turnos t
     where t.veterinario_id = new.veterinario_id and t.id <> new.id and t.estado = 'pendiente'
       and t.fecha = new.fecha
       and t.hora < new.hora + make_interval(mins => new.duracion_min::integer)
       and new.hora < t.hora + make_interval(mins => t.duracion_min::integer)
  ) then
    raise exception 'Ese horario ya está ocupado por otro turno del veterinario' using errcode = 'P0001';
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

-- ---------- El aviso de cancelación lleva el motivo del bloqueo ----------
create or replace function private.avisos_turno()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_mascota text;
  v_actor uuid := (select auth.uid());
  v_cuando text := to_char(new.fecha, 'DD/MM/YYYY') || ' ' || to_char(new.hora, 'HH24:MI');
  v_titulo text;
  v_mensaje text;
  v_tipo public.tipo_notificacion;
  v_dueno uuid;
  v_recepcion uuid;
  v_quien text;
  v_vet text;
  v_motivo text := nullif(current_setting('petcare.motivo_cancelacion', true), '');
begin
  select nombre into v_mascota from public.mascotas where id = new.mascota_id;

  if v_actor is not null and private.cuenta_es_duena(new.mascota_id, v_actor) and new.veterinario_id is not null
     and (tg_op = 'INSERT' or new.veterinario_id is distinct from old.veterinario_id) then
    insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por)
    values (new.mascota_id, new.veterinario_id, 'activo', 'dueno')
    on conflict (mascota_id, veterinario_id) do update set estado = 'activo';
  end if;

  if tg_op = 'UPDATE' and new.llegada = 'en_espera' and old.llegada is distinct from 'en_espera'
     and new.estado = 'pendiente' then
    if new.veterinario_id is not null and new.veterinario_id is distinct from v_actor then
      perform private.notificar(new.veterinario_id, 'turno', 'Paciente en sala de espera',
        v_mascota || ' llegó para el turno de las ' || to_char(new.hora, 'HH24:MI') || ' (' || new.categoria || ')');
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_tipo := 'turno'; v_titulo := 'Nuevo turno';
    v_mensaje := v_mascota || ': ' || new.categoria || ' el ' || v_cuando;
  elsif new.estado = 'completado' and old.estado <> 'completado' then
    v_tipo := 'completado'; v_titulo := 'Turno finalizado';
    v_mensaje := v_mascota || ': el turno de ' || new.categoria || ' del ' || v_cuando || ' fue completado. Ya podés ver el detalle en el historial.';
  elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
    v_tipo := 'cancelacion'; v_titulo := 'Turno cancelado';
    v_mensaje := v_mascota || ': se canceló el turno de ' || new.categoria || ' del ' || v_cuando
      || coalesce('. Motivo: ' || v_motivo || '. Podés sacar otro turno desde la app', '');
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
  if new.veterinario_id is not null and v_tipo <> 'completado' then
    if new.veterinario_id <> v_actor then
      if private.es_recepcion_de(new.veterinario_id) then
        select nombre into v_quien from public.profiles where id = v_actor;
        perform private.notificar(new.veterinario_id, v_tipo, v_titulo,
          v_mensaje || ' (recepción: ' || coalesce(v_quien, 'sin nombre') || ')');
      else
        perform private.notificar(new.veterinario_id, v_tipo, v_titulo, v_mensaje);
      end if;
    end if;
    select nombre into v_vet from public.profiles where id = new.veterinario_id;
    for v_recepcion in select private.recepcionistas_de(new.veterinario_id) loop
      if v_recepcion is distinct from v_actor then
        perform private.notificar(v_recepcion, v_tipo, v_titulo, coalesce(v_vet, 'Veterinario') || ' · ' || v_mensaje);
      end if;
    end loop;
  end if;
  return new;
end $function$;
