-- Pruebas de 20261126134535_veterinarias_con_revision.sql. Usan la cuenta de prueba del veterinario (V) y crean dentro
-- de la transacción a la dueña de un negocio (P, no es veterinaria), un administrador de la plataforma (A) y una
-- cuenta cualquiera (X). Todo se deshace al final (el error con el resultado).
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V', 'd1000000-0000-4000-8000-000000000001'), ('P', 'd1000000-0000-4000-8000-0000000000a1'),
  ('A', 'd1000000-0000-4000-8000-0000000000a2'), ('X', 'd1000000-0000-4000-8000-0000000000a3');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;
create temp table clin (clave text primary key, id uuid);
grant all on clin to authenticated;

-- P se registra con "Mi veterinaria"; A es administrador de la plataforma; X es una cuenta cualquiera
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (pg_temp.id('P'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.panda@ejemplo.invalid',
   '{"nombre":"Prueba Panda","rol":"dueno","veterinaria":{"nombre":"Panda","direccion":"Calle Falsa 742","telefono":"1144445555"}}'),
  (pg_temp.id('A'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.admin2@ejemplo.invalid', '{"nombre":"Prueba Admin"}'),
  (pg_temp.id('X'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.x2@ejemplo.invalid', '{"nombre":"Prueba X"}');
set local petcare.sistema = 'on';
update public.profiles set rol = 'admin' where id = pg_temp.id('A');
set local petcare.sistema = 'off';
insert into clin select 'P', clinica_id from public.clinica_miembros where cuenta_id = pg_temp.id('P');

insert into res (prueba, ok) values
  ('registro sin veterinaria: no crea ninguna', not exists (select 1 from public.clinicas where creada_por = pg_temp.id('X'))),
  ('registro: la veterinaria queda pendiente', (select revision from public.clinicas where id = (select id from clin where clave = 'P')) = 'pendiente'),
  ('registro: la dueña queda titular (sin rol de veterinario)', (select roles::text from public.clinica_miembros where cuenta_id = pg_temp.id('P')) = '{titular}'),
  ('las veterinarias que ya existían quedaron aprobadas', not exists (select 1 from public.clinicas where revision <> 'aprobada' and creada_por <> pg_temp.id('P')));

-- Mientras está pendiente no puede sumar a nadie
select pg_temp.como('P'); set role authenticated;
insert into res (prueba, ok) values
  ('P ve su veterinaria en revisión', (select revision from public.mis_clinicas()) = 'pendiente'),
  ('P ve su equipo aunque esté pendiente', (select count(*) from public.equipo_clinica((select id from clin where clave = 'P'))) = 1),
  ('P NO tiene permiso de equipo mientras está pendiente', not private.permiso_en((select id from clin where clave = 'P'), 'equipo'));
do $$ begin
  perform public.invitar_a_clinica((select id from clin where clave = 'P'), 'prueba.vet@ejemplo.invalid', array['veterinario']);
  insert into res (prueba, ok) values ('P NO invita mientras está pendiente', false);
exception when others then insert into res (prueba, ok) values ('P NO invita mientras está pendiente', true); end $$;
do $$ begin
  perform public.revisar_clinica((select id from clin where clave = 'P'), true, null);
  insert into res (prueba, ok) values ('P NO se aprueba sola', false);
exception when others then insert into res (prueba, ok) values ('P NO se aprueba sola', true); end $$;

-- X no ve las pendientes; A sí, y la aprueba
reset role; select pg_temp.como('X'); set role authenticated;
insert into res (prueba, ok) values ('X NO ve veterinarias para revisar', (select count(*) from public.clinicas_para_revisar()) = 0);
reset role; select pg_temp.como('A'); set role authenticated;
insert into res (prueba, ok) values
  ('A ve Panda para revisar con su titular', (select titular_nombre from public.clinicas_para_revisar() where nombre = 'Panda') = 'Prueba Panda');
do $$ begin
  perform public.revisar_clinica((select id from clin where clave = 'P'), false, '  ');
  insert into res (prueba, ok) values ('rechazar pide motivo', false);
exception when others then insert into res (prueba, ok) values ('rechazar pide motivo', true); end $$;
select public.revisar_clinica((select id from clin where clave = 'P'), true, null);
reset role;
insert into res (prueba, ok) values
  ('aprobada', (select revision from public.clinicas where id = (select id from clin where clave = 'P')) = 'aprobada'),
  ('a P le llega el aviso', exists (select 1 from public.notificaciones where usuario_id = pg_temp.id('P') and titulo = 'Veterinaria aprobada'));

-- Aprobada: P suma a V como veterinario y maneja su agenda
select pg_temp.como('P'); set role authenticated;
insert into res (prueba, ok) values ('P aprobada invita a V', public.invitar_a_clinica((select id from clin where clave = 'P'), 'prueba.vet@ejemplo.invalid', array['veterinario']) is not null);
reset role; select pg_temp.como('V'); set role authenticated;
select public.responder_invitacion_clinica((select miembro_id from public.mis_clinicas() where id = (select id from clin where clave = 'P')), true);
reset role; select pg_temp.como('P'); set role authenticated;
insert into res (prueba, ok) values
  ('P maneja la agenda de V', private.es_recepcion_de(pg_temp.id('V'))),
  ('P ve los turnos de V', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) > 0),
  ('P NO ve historia clínica', (select count(*) from public.informes_clinicos) = 0);

-- Una veterinaria creada por un veterinario aprobado queda aprobada al instante
reset role; select pg_temp.como('V'); set role authenticated;
insert into clin values ('V2', public.crear_clinica('Otra de V'));
insert into res (prueba, ok) values ('la de un veterinario aprobado no pasa por revisión', (select revision from public.clinicas where id = (select id from clin where clave = 'V2')) = 'aprobada');

-- Cuenta de veterinario creada por la veterinaria: en revisión, miembro y con un lugar en Panda
reset role;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('d1000000-0000-4000-8000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.vnuevo@ejemplo.invalid',
   '{"nombre":"Prueba Vet Nuevo","rol":"veterinario","dni":"90000099","matricula":"PRUEBA-NUEVA"}');
select public.vincular_cuenta_a_clinica('d1000000-0000-4000-8000-0000000000a4', (select id from clin where clave = 'P'), array['veterinario'], pg_temp.id('P'));
insert into res (prueba, ok) values
  ('el veterinario creado queda en revisión', (select estado_revision::text from public.veterinarios where profile_id = 'd1000000-0000-4000-8000-0000000000a4') = 'pendiente_revision'),
  ('y es miembro de Panda', exists (select 1 from public.clinica_miembros where cuenta_id = 'd1000000-0000-4000-8000-0000000000a4' and clinica_id = (select id from clin where clave = 'P') and 'veterinario' = any (roles))),
  ('y también tiene su propia veterinaria', exists (select 1 from public.clinica_miembros where cuenta_id = 'd1000000-0000-4000-8000-0000000000a4' and 'titular' = any (roles))),
  ('con un lugar de atención en Panda', exists (select 1 from public.sedes where veterinario_id = 'd1000000-0000-4000-8000-0000000000a4' and clinica_id = (select id from clin where clave = 'P'))),
  ('y tiene que cambiar la contraseña', (select debe_cambiar_password from public.profiles where id = 'd1000000-0000-4000-8000-0000000000a4'));
select pg_temp.como('P'); set role authenticated;
insert into res (prueba, ok) values ('P NO maneja la agenda del veterinario en revisión', not private.es_recepcion_de('d1000000-0000-4000-8000-0000000000a4'));
reset role;
set local petcare.sistema = 'on';
update public.profiles set estado = 'activo' where id = 'd1000000-0000-4000-8000-0000000000a4';
update public.veterinarios set estado_revision = 'activo' where profile_id = 'd1000000-0000-4000-8000-0000000000a4';
set local petcare.sistema = 'off';
insert into res (prueba, ok) values
  ('al aprobarlo, a P le llega el aviso', exists (select 1 from public.notificaciones where usuario_id = pg_temp.id('P') and titulo = 'Veterinario aprobado'));
select pg_temp.como('P'); set role authenticated;
insert into res (prueba, ok) values ('aprobado, P maneja su agenda', private.es_recepcion_de('d1000000-0000-4000-8000-0000000000a4'));
reset role;

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
