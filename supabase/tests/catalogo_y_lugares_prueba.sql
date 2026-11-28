-- Pruebas de catalogo_de_servicios y servicios_por_lugar. Usan las cuentas de prueba (V veterinario, D dueño de
-- Firulais M) y el primer administrador. Todo se deshace al final (el error con el resultado).
create temp table res (n serial, prueba text, ok boolean);
grant all on res to authenticated;
grant usage on sequence res_n_seq to authenticated;
create temp table ids (clave text primary key, id uuid);
insert into ids values ('V', 'd1000000-0000-4000-8000-000000000001'), ('D', 'd1000000-0000-4000-8000-000000000003'),
  ('M', 'e1000000-0000-4000-8000-000000000001');
grant select on ids to authenticated;
create or replace function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where clave = p $$;
create or replace function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, false)
$$;
grant execute on function pg_temp.id(text), pg_temp.como(text) to authenticated;
create temp table admin_id as select id from public.profiles where rol = 'admin' limit 1;
grant select on admin_id to authenticated;

insert into res (prueba, ok) values
  ('el catálogo tiene las 23 de siempre', (select count(*) from public.catalogo_servicios) = 23),
  ('es_especialidad lee la tabla', private.es_especialidad('Cardiología') and not private.es_especialidad('Cirugía 24hs')),
  ('la duración sale de la tabla', private.duracion_por_defecto('Cirugía 24hs') = 120 and private.duracion_por_defecto('Consulta') = 30);

-- Un dueño no cambia el catálogo (pero lo lee); el administrador sí
select pg_temp.como('D'); set role authenticated;
do $$ begin
  perform public.guardar_servicio_catalogo('Etología', 'especialidad', 60, true);
  insert into res (prueba, ok) values ('el dueño NO cambia el catálogo', false);
exception when others then insert into res (prueba, ok) values ('el dueño NO cambia el catálogo', true); end $$;
do $$ begin
  insert into res (prueba, ok) values ('el dueño lo lee', (select count(*) from public.catalogo_servicios) = 23);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from admin_id), 'role', 'authenticated')::text, false);
set role authenticated;
select public.guardar_servicio_catalogo('  Etología  ', 'especialidad', 60, true);
select public.guardar_servicio_catalogo('Tomografía', 'servicio', 90, false);
do $$ begin
  perform public.guardar_servicio_catalogo('Tomografía', 'especialidad', 90, true);
  insert into res (prueba, ok) values ('NO cambia el tipo', false);
exception when others then insert into res (prueba, ok) values ('NO cambia el tipo', sqlerrm like '%no se puede cambiar el tipo%'); end $$;
reset role;
insert into res (prueba, ok) values
  ('agrega una especialidad nueva', private.es_especialidad('Etología')),
  ('cambia duración y desactiva', (select duracion_min = 90 and not activo from public.catalogo_servicios where nombre = 'Tomografía')),
  ('la duración nueva se usa en los turnos', private.duracion_por_defecto('Tomografía') = 90);

-- Servicios por lugar: el lugar del veterinario solo atiende Cirugía; el dueño no saca Cardiología ahí
create temp table dia as
  select s.id as sede, d::date as fecha, s.hora_apertura as abre
    from public.sedes s, generate_series(current_date + 2, current_date + 9, interval '1 day') d
   where s.veterinario_id = pg_temp.id('V') and s.activa and extract(isodow from d)::smallint = any (s.dias_atencion)
   order by s.created_at, d limit 1;
grant select on dia to authenticated;
update public.veterinarios set tipos_animales = array(select distinct unnest(tipos_animales || array['Perro', 'Gato', 'Otro']))
 where profile_id = pg_temp.id('V');
select pg_temp.como('V'); set role authenticated;
update public.sedes set servicios = array['Cirugía 24hs'] where id = (select sede from dia);
reset role; select pg_temp.como('D'); set role authenticated;
do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, sede_id, categoria, fecha, hora, estado)
  select pg_temp.id('M'), pg_temp.id('V'), sede, 'Cardiología', fecha, abre, 'pendiente' from dia;
  insert into res (prueba, ok) values ('el dueño NO saca un servicio que el lugar no atiende', false);
exception when others then insert into res (prueba, ok) values ('el dueño NO saca un servicio que el lugar no atiende', sqlerrm like '%no se atiende Cardiología%'); end $$;
do $$ begin
  insert into public.turnos (mascota_id, veterinario_id, sede_id, categoria, fecha, hora, estado)
  select pg_temp.id('M'), pg_temp.id('V'), sede, 'Consulta', fecha, abre, 'pendiente' from dia;
  insert into res (prueba, ok) values ('una consulta general sí', true);
exception when others then insert into res (prueba, ok) values ('una consulta general sí: ' || sqlerrm, false); end $$;
reset role;

do $$ declare v text; begin
  select 'RESULTADO: ' || count(*) filter (where ok) || ' de ' || count(*) || ' bien'
    || coalesce(' | FALLARON: ' || string_agg(prueba, '; ') filter (where ok is not true), '') into v from res;
  raise exception '%', v;
end $$;
