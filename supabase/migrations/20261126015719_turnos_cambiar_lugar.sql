-- Permite cambiar el lugar de atención de un turno (turnos.sede_id).
--
-- La app manda sede_id al mover un turno (el dueño siempre, el veterinario y su recepción cuando el turno tiene
-- lugar), pero la columna no estaba entre las que authenticated puede modificar: mover un turno fallaba con
-- "permiso denegado". Es seguro abrirla: las políticas de turnos siguen decidiendo qué filas puede tocar cada uno y
-- private.validar_turno rechaza un lugar que no sea del veterinario del turno o que no esté activo.
grant update (sede_id) on public.turnos to authenticated;
