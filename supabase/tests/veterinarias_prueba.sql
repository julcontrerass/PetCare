-- Pruebas de la migración 20261126031509_veterinarias.sql. Usan las cuentas de prueba (prueba.*@ejemplo.invalid):
-- la veterinaria V, la recepcionista R (que ya era su recepción) y el dueño D; crean dentro de la transacción un
-- segundo veterinario V2 y una cuenta ajena X. Todo se deshace al final (el error con el resultado).
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V', 'd1000000-0000-4000-8000-000000000001'), ('R', 'd1000000-0000-4000-8000-000000000002'),
  ('D', 'd1000000-0000-4000-8000-000000000003'), ('V2', 'd1000000-0000-4000-8000-0000000000f1'),
  ('X', 'd1000000-0000-4000-8000-0000000000f2');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;
create temp table clin (clave text primary key, id uuid);
grant all on clin to authenticated;

-- V2 se registra como veterinario (le llega su veterinaria) y el administrador lo aprueba; X es un dueño cualquiera
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (pg_temp.id('V2'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.v2@ejemplo.invalid',
   '{"nombre":"Prueba V2","rol":"veterinario","matricula":"PRUEBA-V2","clinica":"Clínica V2"}'),
  (pg_temp.id('X'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.x@ejemplo.invalid', '{"nombre":"Prueba X"}');
set local petcare.sistema = 'on';
update public.profiles set estado = 'activo' where id = pg_temp.id('V2');
update public.veterinarios set estado_revision = 'activo' where profile_id = pg_temp.id('V2');
set local petcare.sistema = 'off';

insert into clin select 'V', clinica_id from public.clinica_miembros where cuenta_id = pg_temp.id('V') and 'titular' = any (roles) limit 1;
insert into clin select 'V2', clinica_id from public.clinica_miembros where cuenta_id = pg_temp.id('V2') limit 1;

insert into res (prueba, ok) values
  ('migración: la veterinaria tiene su veterinaria como titular', (select roles::text from public.clinica_miembros where cuenta_id = pg_temp.id('V')) = '{titular,veterinario}'),
  ('migración: la recepción pasó a ser miembro', (select roles::text || estado from public.clinica_miembros where cuenta_id = pg_temp.id('R')) = '{recepcion}activo'),
  ('migración: los lugares quedaron en la veterinaria', not exists (select 1 from public.sedes s where s.veterinario_id = pg_temp.id('V') and s.clinica_id is null)),
  ('registro: el veterinario nuevo recibe su veterinaria', (select nombre from public.clinicas where id = (select id from clin where clave = 'V2')) = 'Clínica V2'),
  ('la tabla vieja ya no existe', to_regclass('public.recepcionistas_vet') is null),
  ('authenticated NO vincula cuentas a mano', not has_function_privilege('authenticated', 'public.vincular_cuenta_a_clinica(uuid, uuid, text[], uuid)', 'execute'));

-- La recepción sigue funcionando sobre la veterinaria
select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('R maneja la agenda de V', private.es_recepcion_de(pg_temp.id('V'))),
  ('R ve los turnos de V', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) > 0),
  ('R ve al dueño', (select count(*) from public.profiles where id = pg_temp.id('D')) = 1),
  ('R NO ve historia clínica', (select count(*) from public.informes_clinicos) = 0),
  ('R ve su veterinaria', (select count(*) from public.mis_clinicas()) = 1),
  ('R tiene la agenda de V', (select count(*) from public.agendas_que_manejo() where veterinario_id = pg_temp.id('V')) = 1),
  ('R busca dueños', (select count(*) from public.buscar_dueno('prueba.dueno@ejemplo.invalid')) = 1);
do $$ begin
  perform public.invitar_a_clinica((select id from clin where clave = 'V'), 'prueba.x@ejemplo.invalid', array['recepcion']);
  insert into res (prueba, ok) values ('R (recepción) NO suma gente', false);
exception when others then insert into res (prueba, ok) values ('R (recepción) NO suma gente', true); end $$;

-- V suma a V2 como veterinario de su veterinaria
reset role; select pg_temp.como('V'); set role authenticated;
insert into res (prueba, ok) values
  ('V invita a V2 como veterinario', public.invitar_a_clinica((select id from clin where clave = 'V'), 'prueba.v2@ejemplo.invalid', array['veterinario']) = 'Prueba V2');
-- (en otra instrucción: la misma no ve lo que acaba de insertar)
insert into res (prueba, ok) values
  ('V ve su equipo (V, R y V2 pendiente)', (select count(*) from public.equipo_clinica((select id from clin where clave = 'V'))) = 3);
do $$ begin
  perform public.invitar_a_clinica((select id from clin where clave = 'V'), 'prueba.x@ejemplo.invalid', array['veterinario']);
  insert into res (prueba, ok) values ('NO se da el rol veterinario sin matrícula aprobada', false);
exception when others then insert into res (prueba, ok) values ('NO se da el rol veterinario sin matrícula aprobada', true); end $$;

reset role; select pg_temp.como('V2'); set role authenticated;
select public.responder_invitacion_clinica((select miembro_id from public.mis_clinicas() where id = (select id from clin where clave = 'V')), true);
insert into res (prueba, ok) values
  ('V2 está en dos veterinarias', (select count(*) from public.mis_clinicas() where estado = 'activo') = 2),
  ('V2 crea una tercera', public.crear_clinica('Otra de V2', 'Calle Falsa 100', '1144445555', '20-12345678-6', 'Prueba V2', '90000098', 'PRUEBA-V2') is not null),
  ('V2 NO maneja la agenda de V (es solo veterinario ahí)', not private.es_recepcion_de(pg_temp.id('V')));

reset role; select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('R ahora maneja la agenda de V2 (misma veterinaria)', private.es_recepcion_de(pg_temp.id('V2'))),
  ('R tiene dos agendas', (select count(*) from public.agendas_que_manejo()) = 2);

-- Roles: V hace administradora a R, que entonces puede sumar gente pero no tocar al titular
reset role; select pg_temp.como('V'); set role authenticated;
select public.cambiar_roles_clinica((select miembro_id from public.equipo_clinica((select id from clin where clave = 'V')) where cuenta_id = pg_temp.id('R')), array['recepcion', 'administrador']);
do $$ begin
  perform public.quitar_de_clinica((select miembro_id from public.equipo_clinica((select id from clin where clave = 'V')) where cuenta_id = pg_temp.id('V')));
  insert into res (prueba, ok) values ('el único titular NO se puede ir', false);
exception when others then insert into res (prueba, ok) values ('el único titular NO se puede ir', true); end $$;
reset role; select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values ('R administradora invita a X a recepción', public.invitar_a_clinica((select id from clin where clave = 'V'), 'prueba.x@ejemplo.invalid', array['recepcion']) = 'Prueba X');
do $$ begin
  perform public.quitar_de_clinica((select miembro_id from public.equipo_clinica((select id from clin where clave = 'V')) where cuenta_id = pg_temp.id('V')));
  insert into res (prueba, ok) values ('la administradora NO saca al titular', false);
exception when others then insert into res (prueba, ok) values ('la administradora NO saca al titular', true); end $$;
do $$ begin
  perform public.cambiar_roles_clinica((select miembro_id from public.equipo_clinica((select id from clin where clave = 'V')) where cuenta_id = pg_temp.id('R')), array['titular']);
  insert into res (prueba, ok) values ('la administradora NO se hace titular', false);
exception when others then insert into res (prueba, ok) values ('la administradora NO se hace titular', true); end $$;

-- Una cuenta ajena (con invitación pendiente) no ve nada todavía
reset role; select pg_temp.como('X'); set role authenticated;
insert into res (prueba, ok) values
  ('X ve su invitación', (select count(*) from public.mis_clinicas() where estado = 'pendiente') = 1),
  ('X NO ve el equipo antes de aceptar', (select count(*) from public.equipo_clinica((select id from clin where clave = 'V'))) = 0),
  ('X NO ve turnos de V', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0),
  ('X NO maneja agendas', (select count(*) from public.agendas_que_manejo()) = 0);

-- V saca a R: deja de ver la agenda
reset role; select pg_temp.como('V'); set role authenticated;
select public.quitar_de_clinica((select miembro_id from public.equipo_clinica((select id from clin where clave = 'V')) where cuenta_id = pg_temp.id('R')));
reset role; select pg_temp.como('R'); set role authenticated;
insert into res (prueba, ok) values
  ('después de sacarla, R NO maneja la agenda de V', not private.es_recepcion_de(pg_temp.id('V'))),
  ('después de sacarla, R NO ve turnos de V', (select count(*) from public.turnos where veterinario_id = pg_temp.id('V')) = 0);
reset role;
insert into res (prueba, ok) values ('el historial guarda todo', (select count(*) from public.clinica_historial where clinica_id = (select id from clin where clave = 'V')) >= 5);

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
