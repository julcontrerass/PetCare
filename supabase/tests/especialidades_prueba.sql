-- Pruebas de 20261126232920_certificados_de_especialidades.sql. Usan la cuenta de prueba del veterinario (V) y crean
-- dentro de la transacción un administrador (A) y un dueño (D2). Todo se deshace al final (el error con el resultado).
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values
  ('V', 'd1000000-0000-4000-8000-000000000001'), ('A', 'd1000000-0000-4000-8000-0000000000b1'),
  ('D2', 'd1000000-0000-4000-8000-0000000000b2');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (pg_temp.id('A'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.admin3@ejemplo.invalid', '{"nombre":"Prueba Admin"}'),
  (pg_temp.id('D2'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba.d2@ejemplo.invalid', '{"nombre":"Prueba D2"}');
set local petcare.sistema = 'on';
update public.profiles set rol = 'admin' where id = pg_temp.id('A');
set local petcare.sistema = 'off';

-- V elige Dermatología (una especialidad) además de lo que tenía: queda sin certificado
update public.veterinarios set especialidades = array_append(especialidades, 'Dermatología') where profile_id = pg_temp.id('V');
insert into res (prueba, ok) values
  ('al elegir una especialidad queda sin certificado', (select estado from public.especialidades_vet where veterinario_id = pg_temp.id('V') and especialidad = 'Dermatología') = 'sin_certificado'),
  ('los servicios no tienen fila', not exists (select 1 from public.especialidades_vet where especialidad = 'Chequeo médico integral')),
  ('no figura entre las aprobadas', (select not ('Dermatología' = any (especialidades_aprobadas)) from public.veterinarios where profile_id = pg_temp.id('V'))),
  ('las que ya existían quedaron sin certificado', not exists (select 1 from public.veterinarios v, unnest(v.especialidades) e where private.es_especialidad(e) and not exists (select 1 from public.especialidades_vet x where x.veterinario_id = v.profile_id and x.especialidad = e)));

select pg_temp.como('V'); set role authenticated;
insert into res (prueba, ok) values ('V ve su especialidad sin certificado', (select estado from public.mis_especialidades() where especialidad = 'Dermatología') = 'sin_certificado');
do $$ begin
  perform public.cargar_certificado_especialidad('Dermatología', 'Especialista', 'UBA', 2020, array['otra-carpeta/titulo.pdf']);
  insert into res (prueba, ok) values ('NO con archivos de otra carpeta', false);
exception when others then insert into res (prueba, ok) values ('NO con archivos de otra carpeta', true); end $$;
do $$ begin
  perform public.cargar_certificado_especialidad('Chequeo médico integral', 'Algo', 'UBA', 2020, array['d1000000-0000-4000-8000-000000000001/t.pdf']);
  insert into res (prueba, ok) values ('NO para un servicio', false);
exception when others then insert into res (prueba, ok) values ('NO para un servicio', true); end $$;
do $$ begin
  perform public.cargar_certificado_especialidad('Oncología', 'Algo', 'UBA', 2020, array['d1000000-0000-4000-8000-000000000001/t.pdf']);
  insert into res (prueba, ok) values ('NO para una especialidad que no eligió', false);
exception when others then insert into res (prueba, ok) values ('NO para una especialidad que no eligió', true); end $$;
do $$ begin
  perform public.cargar_certificado_especialidad('Dermatología', 'Especialista', 'UBA', 1800, array['d1000000-0000-4000-8000-000000000001/t.pdf']);
  insert into res (prueba, ok) values ('NO con un año imposible', false);
exception when others then insert into res (prueba, ok) values ('NO con un año imposible', true); end $$;
select public.cargar_certificado_especialidad('Dermatología', 'Especialista en Dermatología', 'UBA', 2020, array['d1000000-0000-4000-8000-000000000001/titulo.pdf']);
insert into res (prueba, ok) values ('mandado: queda en revisión', (select estado from public.mis_especialidades() where especialidad = 'Dermatología') = 'pendiente');

-- Un dueño no ve los títulos ni puede revisarlos
reset role; select pg_temp.como('D2'); set role authenticated;
insert into res (prueba, ok) values
  ('el dueño NO ve títulos para revisar', (select count(*) from public.especialidades_para_revisar()) = 0),
  ('el dueño NO ve la tabla', (select count(*) from public.especialidades_vet) = 0);
do $$ begin
  perform public.revisar_especialidad((select id from public.especialidades_vet limit 1), true, null);
  insert into res (prueba, ok) values ('el dueño NO aprueba', false);
exception when others then insert into res (prueba, ok) values ('el dueño NO aprueba', true); end $$;

-- El administrador la aprueba
reset role; select pg_temp.como('A'); set role authenticated;
insert into res (prueba, ok) values ('A ve el título para revisar', (select titulo from public.especialidades_para_revisar() where especialidad = 'Dermatología' and veterinario_id = pg_temp.id('V')) = 'Especialista en Dermatología');
do $$ begin
  perform public.revisar_especialidad((select id from public.especialidades_para_revisar() where especialidad = 'Dermatología' and veterinario_id = pg_temp.id('V')), false, ' ');
  insert into res (prueba, ok) values ('rechazar pide motivo', false);
exception when others then insert into res (prueba, ok) values ('rechazar pide motivo', true); end $$;
select public.revisar_especialidad((select id from public.especialidades_para_revisar() where especialidad = 'Dermatología' and veterinario_id = pg_temp.id('V')), true, null);
reset role;
insert into res (prueba, ok) values
  ('aprobada: figura entre las aprobadas', (select 'Dermatología' = any (especialidades_aprobadas) from public.veterinarios where profile_id = pg_temp.id('V'))),
  ('a V le llega el aviso', exists (select 1 from public.notificaciones where usuario_id = pg_temp.id('V') and titulo = 'Especialidad aprobada'));

-- V no puede marcarse especialidades aprobadas a mano
select pg_temp.como('V'); set role authenticated;
do $$ begin
  update public.veterinarios set especialidades_aprobadas = array['Oncología'] where profile_id = pg_temp.id('V');
  insert into res (prueba, ok) values ('V NO se aprueba especialidades a mano', false);
exception when others then insert into res (prueba, ok) values ('V NO se aprueba especialidades a mano', true); end $$;
reset role;

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
