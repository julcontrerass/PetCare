-- Tipos de animal nuevos: Conejo, Hurón, Caballo y Cerdo (además de Perro, Gato, Ave, Reptil, Pez, Roedor y Otro).
-- Hasta ahora esos animales se cargaban como "Otro": los veterinarios que atendían "Otro" ya los atendían, así que se
-- les suman los tipos nuevos para que sus pacientes no se queden sin veterinario al cambiar de tipo.
alter table public.veterinarios drop constraint if exists veterinarios_tipos_animales_check;
alter table public.veterinarios add constraint veterinarios_tipos_animales_check check (
  tipos_animales <@ array['Perro', 'Gato', 'Ave', 'Reptil', 'Pez', 'Roedor', 'Conejo', 'Hurón', 'Caballo', 'Cerdo', 'Otro']::text[]
);

update public.veterinarios
   set tipos_animales = array(
         select distinct t from unnest(tipos_animales || array['Conejo', 'Hurón', 'Caballo', 'Cerdo']::text[]) as t
       )
 where 'Otro' = any (tipos_animales);
