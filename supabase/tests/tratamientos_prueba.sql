-- Pruebas de 20261127010607_tratamientos.sql: la primera dosis, la toma tildada tarde y la suspensión. Usan las cuentas de
-- prueba (V veterinario, D dueño de Firulais) y crean dentro de la transacción una receta y otro dueño (X). Todo se
-- deshace al final (el error con el resultado).
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V', 'd1000000-0000-4000-8000-000000000001'), ('D', 'd1000000-0000-4000-8000-000000000003'),
  ('M', 'e1000000-0000-4000-8000-000000000001'), ('R', 'e2000000-0000-4000-8000-000000000001'),
  ('X', 'd1000000-0000-4000-8000-0000000000c1');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (pg_temp.id('X'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.x4@ejemplo.invalid', '{"nombre":"Prueba X"}');

-- El veterinario receta Amoxicilina cada 24 hs durante 3 días, después de comer
select pg_temp.como('V'); set role authenticated;
insert into public.prescripciones (id, mascota_id, veterinario_id, medicamento, dosis, frecuencia_horas, duracion_dias, inicio, con_comida)
values (pg_temp.id('R'), pg_temp.id('M'), pg_temp.id('V'), 'Amoxicilina', '250 mg', 24, 3, current_date, 'despues');
reset role;
insert into res (prueba, ok) values
  ('recién recetada no empezó', (select empezo_at is null from public.prescripciones where id = pg_temp.id('R'))),
  ('guarda la comida', (select con_comida from public.prescripciones where id = pg_temp.id('R')) = 'despues'),
  ('las recetas de antes quedaron empezadas', not exists (select 1 from public.prescripciones where frecuencia_horas is not null and duracion_dias is not null and empezo_at is null and id <> pg_temp.id('R')));

-- Otro dueño no la puede empezar; el dueño no puede elegir una hora futura
select pg_temp.como('X'); set role authenticated;
do $$ begin
  perform public.empezar_tratamiento(pg_temp.id('R'), (now() at time zone 'America/Argentina/Buenos_Aires')::timestamp);
  insert into res (prueba, ok) values ('otro dueño NO la empieza', false);
exception when others then insert into res (prueba, ok) values ('otro dueño NO la empieza', true); end $$;
reset role; select pg_temp.como('D'); set role authenticated;
do $$ begin
  perform public.empezar_tratamiento(pg_temp.id('R'), (now() at time zone 'America/Argentina/Buenos_Aires')::timestamp + interval '2 hours');
  insert into res (prueba, ok) values ('NO con una hora futura', false);
exception when others then insert into res (prueba, ok) values ('NO con una hora futura', true); end $$;

-- El dueño se la dio hace una hora: arranca y la primera toma queda tildada
select public.empezar_tratamiento(pg_temp.id('R'), date_trunc('minute', (now() at time zone 'America/Argentina/Buenos_Aires')::timestamp) - interval '1 hour');
insert into res (prueba, ok) values
  ('empezó', (select empezo_at is not null from public.prescripciones where id = pg_temp.id('R'))),
  ('la primera toma quedó tildada', (select count(*) from public.tomas_medicacion where prescripcion_id = pg_temp.id('R')) = 1);

-- Toma tildada tarde con la hora real (dentro de lo razonable) y una con una hora absurda (queda la de ahora)
insert into public.tomas_medicacion (prescripcion_id, programada, dada_at)
values (pg_temp.id('R'), (select empezo_at + interval '24 hours' from public.prescripciones where id = pg_temp.id('R')), now() - interval '10 minutes');
insert into public.tomas_medicacion (prescripcion_id, programada, dada_at)
values (pg_temp.id('R'), (select empezo_at + interval '48 hours' from public.prescripciones where id = pg_temp.id('R')), now() + interval '1 day');
insert into res (prueba, ok) values
  ('la hora futura no se acepta (queda ahora)', (select dada_at <= now() from public.tomas_medicacion where prescripcion_id = pg_temp.id('R') and programada = (select empezo_at + interval '48 hours' from public.prescripciones where id = pg_temp.id('R'))));
do $$ begin
  perform public.empezar_tratamiento(pg_temp.id('R'), (now() at time zone 'America/Argentina/Buenos_Aires')::timestamp);
  insert into res (prueba, ok) values ('en curso NO se reinicia', false);
exception when others then insert into res (prueba, ok) values ('en curso NO se reinicia', true); end $$;
do $$ begin
  perform public.suspender_tratamiento(pg_temp.id('R'), 'por las dudas');
  insert into res (prueba, ok) values ('el dueño NO suspende', false);
exception when others then insert into res (prueba, ok) values ('el dueño NO suspende', true); end $$;

-- El veterinario lo suspende: al dueño le llega el aviso
reset role; select pg_temp.como('V'); set role authenticated;
select public.suspender_tratamiento(pg_temp.id('R'), 'Cambiamos de antibiótico');
reset role;
insert into res (prueba, ok) values
  ('suspendido con motivo', (select suspendida_at is not null and motivo_suspension = 'Cambiamos de antibiótico' from public.prescripciones where id = pg_temp.id('R'))),
  ('al dueño le llega el aviso', exists (select 1 from public.notificaciones where usuario_id = pg_temp.id('D') and titulo = 'Tratamiento suspendido'));

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
