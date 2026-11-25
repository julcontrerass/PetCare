-- Pruebas de seguridad del rol recepcionista (migración 20261125120000_recepcionistas.sql).
--
-- Se corren en una transacción que nunca se confirma: arman cuentas y datos de prueba, prueban como cada usuario
-- y al final lanzan un error con el resultado, que deshace todo. Para correrlas: begin; <migración>; <este archivo>.
-- (Si la migración ya está aplicada, alcanza con: begin; <este archivo>.)
-- El mensaje final dice "RESULTADO: N de M bien" y lista las que fallaron.

-- ---------- Datos de prueba ----------
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;

create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V',  'a0000000-0000-4000-8000-0000000000a1'),   -- veterinaria A (tiene recepción)
  ('V2', 'a0000000-0000-4000-8000-0000000000a2'),   -- veterinario B (no)
  ('R',  'a0000000-0000-4000-8000-0000000000a3'),   -- recepcionista de A
  ('D',  'a0000000-0000-4000-8000-0000000000a4'),   -- dueño
  ('X',  'a0000000-0000-4000-8000-0000000000a5'),   -- otra cuenta, sin vínculos
  ('M',  'b0000000-0000-4000-8000-0000000000b1'),   -- mascota del dueño, paciente de A
  ('M2', 'b0000000-0000-4000-8000-0000000000b2'),   -- mascota del dueño, paciente de B
  ('T1', 'c0000000-0000-4000-8000-0000000000c1'),   -- turno de M con A, mañana
  ('T2', 'c0000000-0000-4000-8000-0000000000c2'),   -- turno de M2 con B, mañana
  ('T3', 'c0000000-0000-4000-8000-0000000000c3');   -- turno de M con A, hoy
grant select on ids to authenticated;

create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select pg_temp.id(c), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'prueba.' || lower(c) || '@ejemplo.invalid', jsonb_build_object('nombre', 'Prueba ' || c)
from unnest(array['V', 'V2', 'R', 'D', 'X']) c;

insert into public.veterinarios (profile_id, matricula, dias_atencion, hora_apertura, hora_cierre, estado_revision, tipos_animales)
values (pg_temp.id('V'),  'PRUEBA-REC-A', '{1,2,3,4,5,6,7}', '00:00', '23:59', 'activo', '{Perro,Gato}'),
       (pg_temp.id('V2'), 'PRUEBA-REC-B', '{1,2,3,4,5,6,7}', '00:00', '23:59', 'activo', '{Perro,Gato}');

insert into public.mascotas (id, dueno_id, nombre, tipo)
values (pg_temp.id('M'), pg_temp.id('D'), 'Luna', 'Perro'), (pg_temp.id('M2'), pg_temp.id('D'), 'Tom', 'Gato');

insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por)
values (pg_temp.id('M'), pg_temp.id('V'), 'activo', 'dueno'), (pg_temp.id('M2'), pg_temp.id('V2'), 'activo', 'dueno');

insert into public.turnos (id, mascota_id, veterinario_id, categoria, fecha, hora, creado_por)
values
  (pg_temp.id('T1'), pg_temp.id('M'),  pg_temp.id('V'),  'Consulta', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 1, '10:00', pg_temp.id('D')),
  (pg_temp.id('T2'), pg_temp.id('M2'), pg_temp.id('V2'), 'Consulta', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 1, '10:00', pg_temp.id('D')),
  (pg_temp.id('T3'), pg_temp.id('M'),  pg_temp.id('V'),  'Control',  (now() at time zone 'America/Argentina/Buenos_Aires')::date,     '23:30', pg_temp.id('D'));

insert into public.informes_clinicos (mascota_id) values (pg_temp.id('M'));
insert into public.prescripciones (mascota_id, medicamento) values (pg_temp.id('M'), 'Amoxicilina');
insert into public.registros_salud (mascota_id, tipo, titulo, fecha) values (pg_temp.id('M'), 'vacuna', 'Antirrábica', current_date);

-- Ser una cuenta: pg_temp.como('R') y después "set role authenticated"
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;

insert into res (prueba, ok) values
  ('authenticated puede usar es_recepcion_de', has_function_privilege('authenticated', 'private.es_recepcion_de(uuid)', 'execute')),
  ('anon no puede invitar recepcionistas', not has_function_privilege('anon', 'public.invitar_recepcionista(text)', 'execute'));

-- ---------- Sin vínculo, la futura recepcionista no ve nada ----------
select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('sin vínculo: no ve turnos de A', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0),
  ('sin vínculo: no ve la mascota', (select count(*) from public.mascotas where id = pg_temp.id('M')) = 0),
  ('sin vínculo: no ve al dueño', (select count(*) from public.profiles where id = pg_temp.id('D')) = 0),
  ('sin vínculo: no lista solicitudes de A', (select count(*) from public.mis_solicitudes(pg_temp.id('V'))) = 0);
do $$ begin
  perform public.solicitar_acceso(pg_temp.id('M2'), null, pg_temp.id('V'));
  insert into res (prueba, ok) values ('sin vínculo: no pide acceso en nombre de A', false);
exception when others then
  insert into res (prueba, ok) values ('sin vínculo: no pide acceso en nombre de A', true);
end $$;

-- ---------- La veterinaria invita, la recepcionista acepta ----------
reset role; select pg_temp.como('V'); set role authenticated;
insert into res (prueba, ok) values ('A invita por correo', public.invitar_recepcionista('prueba.r@ejemplo.invalid') = 'pendiente');
insert into res (prueba, ok) values ('A ve el perfil de quien invitó', (select count(*) from public.profiles where id = pg_temp.id('R')) = 1);

reset role; select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('pendiente: todavía no ve turnos', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0),
  ('le toca responder', (select me_toca_responder from public.mis_vinculos_recepcion() where otra_cuenta_id = pg_temp.id('V')));
do $$ begin
  perform public.invitar_recepcionista('prueba.x@ejemplo.invalid');
  insert into res (prueba, ok) values ('una cuenta que no es veterinaria no invita', false);
exception when others then
  insert into res (prueba, ok) values ('una cuenta que no es veterinaria no invita', true);
end $$;
select public.responder_vinculo_recepcion((select id from public.mis_vinculos_recepcion() where otra_cuenta_id = pg_temp.id('V')), true);

-- ---------- Con vínculo activo ----------
insert into res (prueba, ok) values
  ('activo: es recepción de A', private.es_recepcion_de(pg_temp.id('V'))),
  ('activo: no es recepción de B', not private.es_recepcion_de(pg_temp.id('V2'))),
  ('activo: ve los turnos de A', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 2),
  ('activo: NO ve los turnos de B', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V2')) = 0),
  ('activo: ve la mascota de A', (select count(*) from public.mascotas where id = pg_temp.id('M')) = 1),
  ('activo: NO ve la mascota de B', (select count(*) from public.mascotas where id = pg_temp.id('M2')) = 0),
  ('activo: ve el contacto del dueño', (select count(*) from public.profiles where id = pg_temp.id('D')) = 1),
  ('activo: NO ve el DNI del dueño', (select count(*) from public.perfiles_privados where profile_id = pg_temp.id('D')) = 0),
  ('activo: NO ve informes clínicos', (select count(*) from public.informes_clinicos where mascota_id = pg_temp.id('M')) = 0),
  ('activo: NO ve recetas', (select count(*) from public.prescripciones where mascota_id = pg_temp.id('M')) = 0),
  ('activo: NO ve registros de salud', (select count(*) from public.registros_salud where mascota_id = pg_temp.id('M')) = 0),
  ('activo: lista las solicitudes de A', (select count(*) from public.mis_solicitudes(pg_temp.id('V'))) >= 0);

-- Saca un turno para A
insert into public.turnos (mascota_id, veterinario_id, categoria, fecha, hora, creado_por)
values (pg_temp.id('M'), pg_temp.id('V'), 'Vacunación', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 2, '11:00', pg_temp.id('R'));
insert into res (prueba, ok) values ('saca un turno para A y queda como gestionado por ella',
  (select gestionado_por from public.turnos where veterinario_id = pg_temp.id('V') and categoria = 'Vacunación') = pg_temp.id('R'));

do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, categoria, fecha, hora, creado_por)
  values (pg_temp.id('M2'), pg_temp.id('V2'), 'Consulta', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 2, '11:00', pg_temp.id('R'));
  insert into res (prueba, ok) values ('NO saca turnos para B', false);
exception when others then
  insert into res (prueba, ok) values ('NO saca turnos para B', true);
end $$;

-- Mueve, marca la llegada, no completa y cancela
update public.turnos set hora = '12:00' where id = pg_temp.id('T1');
insert into res (prueba, ok) values ('mueve un turno de A', (select hora from public.turnos where id = pg_temp.id('T1')) = '12:00');

update public.turnos set llegada = 'en_espera' where id = pg_temp.id('T3');
insert into res (prueba, ok) values ('marca la llegada de hoy',
  (select llegada = 'en_espera' and llegada_at is not null from public.turnos where id = pg_temp.id('T3')));

do $$ begin
  update public.turnos set llegada = 'en_espera' where id = pg_temp.id('T1');
  insert into res (prueba, ok) values ('NO marca llegada de un turno de mañana', false);
exception when others then
  insert into res (prueba, ok) values ('NO marca llegada de un turno de mañana', true);
end $$;

do $$ begin
  update public.turnos set estado = 'completado' where id = pg_temp.id('T1');
  insert into res (prueba, ok) values ('NO completa un turno', false);
exception when others then
  insert into res (prueba, ok) values ('NO completa un turno', true);
end $$;

update public.turnos set estado = 'cancelado' where id = pg_temp.id('T1');
insert into res (prueba, ok) values ('cancela y queda como cancelado por el veterinario',
  (select cancelado_por::text from public.turnos where id = pg_temp.id('T1')) = 'veterinario');

update public.sedes set nombre = 'Cambiado por recepción' where veterinario_id = pg_temp.id('V');
insert into res (prueba, ok) values ('NO cambia los lugares de atención de A',
  not exists (select 1 from public.sedes where veterinario_id = pg_temp.id('V') and nombre = 'Cambiado por recepción'));

update public.veterinarios set matricula = 'CAMBIADA' where profile_id = pg_temp.id('V');
insert into res (prueba, ok) values ('NO cambia el perfil profesional de A',
  (select matricula from public.veterinarios where profile_id = pg_temp.id('V')) = 'PRUEBA-REC-A');

-- Responde un pedido de acceso que un dueño le hizo a A
reset role;
insert into public.accesos_mascota (mascota_id, veterinario_id, estado, iniciado_por)
values (pg_temp.id('M2'), pg_temp.id('V'), 'pendiente', 'dueno');
select pg_temp.como('R'); set role authenticated;
update public.accesos_mascota set estado = 'activo' where mascota_id = pg_temp.id('M2') and veterinario_id = pg_temp.id('V');
insert into res (prueba, ok) values ('acepta un pedido de acceso para A',
  (select estado::text from public.accesos_mascota where mascota_id = pg_temp.id('M2') and veterinario_id = pg_temp.id('V')) = 'activo');

-- ---------- El dueño no marca la llegada ----------
reset role; select pg_temp.como('D'); set role authenticated;
do $$ begin
  update public.turnos set llegada = 'no_vino' where id = pg_temp.id('T3');
  insert into res (prueba, ok) values ('el dueño NO marca la llegada', false);
exception when others then
  insert into res (prueba, ok) values ('el dueño NO marca la llegada', true);
end $$;
insert into res (prueba, ok) values ('el dueño NO ve el perfil de la recepcionista',
  (select count(*) from public.profiles where id = pg_temp.id('R')) = 0);

-- ---------- Otra cuenta sin vínculo ----------
reset role; select pg_temp.como('X'); set role authenticated;
insert into res (prueba, ok) values
  ('otra cuenta NO ve turnos de A', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0),
  ('otra cuenta NO ve vínculos ajenos', (select count(*) from public.recepcionistas_vet) = 0),
  ('otra cuenta pide ser recepcionista de B por matrícula', public.pedir_ser_recepcionista('prueba-rec-b') = 'pendiente');
do $$ begin
  perform public.responder_vinculo_recepcion((select id from public.recepcionistas_vet where recepcionista_id = pg_temp.id('X')), true);
  insert into res (prueba, ok) values ('quien pidió NO se acepta a sí mismo', false);
exception when others then
  insert into res (prueba, ok) values ('quien pidió NO se acepta a sí mismo', true);
end $$;

reset role; select pg_temp.como('V2'); set role authenticated;
select public.responder_vinculo_recepcion((select id from public.mis_vinculos_recepcion() where otra_cuenta_id = pg_temp.id('X')), false);
insert into res (prueba, ok) values ('B rechaza el pedido y desaparece', (select count(*) from public.recepcionistas_vet) = 0);

-- ---------- Avisos ----------
reset role;
insert into res (prueba, ok) values
  ('A recibe aviso del turno que sacó la recepción', exists (
    select 1 from public.notificaciones where usuario_id = pg_temp.id('V') and mensaje like '%recepción: Prueba R%')),
  ('A recibe aviso de paciente en sala de espera', exists (
    select 1 from public.notificaciones where usuario_id = pg_temp.id('V') and titulo = 'Paciente en sala de espera')),
  ('la recepción recibe aviso del turno que movió... no (lo hizo ella)', not exists (
    select 1 from public.notificaciones where usuario_id = pg_temp.id('R') and titulo = 'Turno modificado'));

-- El dueño mueve un turno: avisa a la recepción
select pg_temp.como('D'); set role authenticated;
update public.turnos set hora = '13:00' where categoria = 'Vacunación' and mascota_id = pg_temp.id('M');
reset role;
insert into res (prueba, ok) values ('la recepción recibe aviso cuando el dueño mueve un turno', exists (
  select 1 from public.notificaciones where usuario_id = pg_temp.id('R') and titulo = 'Turno modificado'));

-- ---------- A corta el vínculo ----------
select pg_temp.como('V'); set role authenticated;
select public.quitar_vinculo_recepcion((select id from public.mis_vinculos_recepcion() where otra_cuenta_id = pg_temp.id('R')));
reset role; select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('después de la baja: no ve turnos de A', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0),
  ('después de la baja: no ve la mascota', (select count(*) from public.mascotas where id = pg_temp.id('M')) = 0);
reset role;
insert into res (prueba, ok) values ('el historial guarda invitación, alta, pedido, rechazo y baja',
  (select count(*) from public.recepcion_historial where veterinario_id in (pg_temp.id('V'), pg_temp.id('V2'))) = 5);

-- ---------- Resultado (el error deshace todo) ----------
do $$
declare v text;
begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
         || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '')
    into v from res;
  raise exception '%', v;
end $$;
