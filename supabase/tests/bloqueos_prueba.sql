-- Pruebas de 20261127200000/1_bloqueos_de_agenda: pausa por lugar, bloqueos, turnos que se pisan y lugares que se pisan.
-- Usan las cuentas de prueba (V veterinario, D dueño de Firulais M) y una cuenta X creada acá. Todo se deshace al final.
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V', 'd1000000-0000-4000-8000-000000000001'), ('D', 'd1000000-0000-4000-8000-000000000003'),
  ('M', 'e1000000-0000-4000-8000-000000000001'), ('X', 'd1000000-0000-4000-8000-0000000000c2');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (pg_temp.id('X'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.x5@ejemplo.invalid', '{"nombre":"Prueba X"}');

-- Un día que el veterinario atiende (desde pasado mañana) en su primer lugar, y la hora de apertura
create temp table dia as
  select s.id as sede, d::date as fecha, s.hora_apertura as abre, s.hora_cierre as cierra
    from public.sedes s, generate_series(current_date + 2, current_date + 9, interval '1 day') d
   where s.veterinario_id = pg_temp.id('V') and s.activa and extract(isodow from d)::smallint = any (s.dias_atencion)
   order by s.created_at, d limit 1;
grant select on dia to authenticated;
-- Que el veterinario atienda a la mascota de prueba
update public.veterinarios set tipos_animales = array(select distinct unnest(tipos_animales || array['Perro', 'Gato', 'Otro']))
 where profile_id = pg_temp.id('V');

-- El dueño saca un turno a la apertura; otro que se pisa con ese no se puede
select pg_temp.como('D'); set role authenticated;
insert into public.turnos (id, mascota_id, veterinario_id, categoria, fecha, hora, estado)
select 'b10c0000-0000-4000-8000-0000000000b1', pg_temp.id('M'), pg_temp.id('V'), 'Control', fecha, abre, 'pendiente' from dia;
do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, categoria, fecha, hora, estado)
  select pg_temp.id('M'), pg_temp.id('V'), 'Control', fecha, abre + interval '15 minutes', 'pendiente' from dia;
  insert into res (prueba, ok) values ('dos turnos que se pisan NO', false);
exception when others then insert into res (prueba, ok) values ('dos turnos que se pisan NO', sqlerrm like '%ocupado por otro turno%'); end $$;

-- Otro dueño no puede bloquear la agenda del veterinario
reset role; select pg_temp.como('X'); set role authenticated;
do $$ begin
  perform public.crear_bloqueo(pg_temp.id('V'), (select fecha + abre from dia), (select fecha + abre + interval '2 hours' from dia), 'Cirugía', false);
  insert into res (prueba, ok) values ('otro NO bloquea', false);
exception when others then insert into res (prueba, ok) values ('otro NO bloquea', true); end $$;

-- El veterinario bloquea dos horas desde la apertura sin cancelar: devuelve el turno afectado, que sigue pendiente
reset role; select pg_temp.como('V'); set role authenticated;
create temp table afectados as
  select * from public.crear_bloqueo(pg_temp.id('V'), (select fecha + abre from dia), (select fecha + abre + interval '2 hours' from dia), 'Cirugía', false);
reset role;
insert into res (prueba, ok) values
  ('devuelve el turno afectado', (select count(*) from afectados) = 1),
  ('sin cancelar sigue pendiente', (select estado from public.turnos where id = 'b10c0000-0000-4000-8000-0000000000b1') = 'pendiente'),
  ('el dueño ve el bloqueo como ocupado', exists (
     select 1 from dia, lateral (select * from public.horarios_ocupados(pg_temp.id('V'), dia.fecha)) h where h.duracion_min = 120));

-- Con el bloqueo, el dueño no puede sacar un turno adentro
select pg_temp.como('D'); set role authenticated;
do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, categoria, fecha, hora, estado)
  select pg_temp.id('M'), pg_temp.id('V'), 'Control', fecha, abre + interval '60 minutes', 'pendiente' from dia;
  insert into res (prueba, ok) values ('turno en un bloqueo NO', false);
exception when others then insert into res (prueba, ok) values ('turno en un bloqueo NO', sqlerrm like '%no atiende en ese horario (Cirugía)%'); end $$;

-- Un segundo bloqueo cancelando: el turno se cancela y al dueño le llega el motivo
reset role; select pg_temp.como('V'); set role authenticated;
select * from public.crear_bloqueo(pg_temp.id('V'), (select fecha + abre from dia), (select fecha + abre + interval '30 minutes' from dia), 'Enfermedad', true);
reset role;
insert into res (prueba, ok) values
  ('cancelando, el turno queda cancelado', (select estado from public.turnos where id = 'b10c0000-0000-4000-8000-0000000000b1') = 'cancelado'),
  ('al dueño le llega el motivo', exists (
     select 1 from public.notificaciones where usuario_id = pg_temp.id('D') and titulo = 'Turno cancelado' and mensaje like '%Motivo: Enfermedad%'));

-- Pausa: no se puede fuera del horario; adentro, no se sacan turnos en la pausa
select pg_temp.como('V'); set role authenticated;
do $$ begin
  update public.sedes set pausa_desde = '05:00', pausa_hasta = '05:30' where id = (select sede from dia);
  insert into res (prueba, ok) values ('pausa fuera del horario NO', false);
exception when others then insert into res (prueba, ok) values ('pausa fuera del horario NO', true); end $$;
update public.sedes set pausa_desde = (select abre + interval '3 hours' from dia), pausa_hasta = (select abre + interval '4 hours' from dia)
 where id = (select sede from dia);
reset role; select pg_temp.como('D'); set role authenticated;
do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, categoria, fecha, hora, estado)
  select pg_temp.id('M'), pg_temp.id('V'), 'Control', fecha, abre + interval '3 hours 30 minutes', 'pendiente' from dia;
  insert into res (prueba, ok) values ('turno en la pausa NO', false);
exception when others then insert into res (prueba, ok) values ('turno en la pausa NO', sqlerrm like '%pausa del veterinario%'); end $$;

-- Un lugar nuevo que se pisa con el que ya tiene: no
reset role; select pg_temp.como('V'); set role authenticated;
do $$ begin
  insert into public.sedes (veterinario_id, nombre, dias_atencion, hora_apertura, hora_cierre)
  select pg_temp.id('V'), 'Otro lugar', s.dias_atencion, s.hora_apertura, s.hora_cierre from public.sedes s where s.id = (select sede from dia);
  insert into res (prueba, ok) values ('lugar que se pisa NO', false);
exception when others then insert into res (prueba, ok) values ('lugar que se pisa NO', sqlerrm like 'Se pisa con%'); end $$;

-- Quitar el bloqueo
select public.eliminar_bloqueo(id) from public.bloqueos_agenda where veterinario_id = pg_temp.id('V') and motivo = 'Cirugía';
reset role;
insert into res (prueba, ok) values
  ('se quita el bloqueo', not exists (select 1 from public.bloqueos_agenda where veterinario_id = pg_temp.id('V') and motivo = 'Cirugía'));

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
