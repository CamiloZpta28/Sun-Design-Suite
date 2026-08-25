-- =============================================================
-- Sun Design Suite · Migración: plantillas de Canalizaciones
-- (zanjas para las líneas eléctricas/comunicaciones enterradas) y el
-- catálogo compartido de diámetros de tubería.
--
-- Este archivo es seguro de correr más de una vez (por ejemplo si ya
-- habías corrido una versión anterior): usa "if not exists" en las tablas
-- y "drop policy if exists" antes de cada política, así que no falla si
-- algo ya existía. Pégalo completo en el SQL Editor de Supabase y
-- presiona "Run".
-- =============================================================

-- "es_principal": dentro de un mismo tipo (ej. "Comunicaciones") puede haber
-- varias plantillas a través del tiempo, pero solo UNA se marca como la
-- vigente/más actualizada — es la que se sugiere primero al elegir en un
-- proyecto o al armar un cruce. La app garantiza que solo una quede en true
-- por tipo (al marcar una nueva, desmarca la anterior).
create table if not exists canalizacion_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  es_principal boolean not null default false,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table canalizacion_plantillas enable row level security;

drop policy if exists "Lectura de plantillas de canalizacion" on canalizacion_plantillas;
create policy "Lectura de plantillas de canalizacion" on canalizacion_plantillas
  for select using (auth.role() = 'authenticated');

drop policy if exists "Crear plantillas de canalizacion" on canalizacion_plantillas;
create policy "Crear plantillas de canalizacion" on canalizacion_plantillas
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Editar plantillas de canalizacion" on canalizacion_plantillas;
create policy "Editar plantillas de canalizacion" on canalizacion_plantillas
  for update using (auth.role() = 'authenticated');

drop policy if exists "Eliminar plantillas de canalizacion" on canalizacion_plantillas;
create policy "Eliminar plantillas de canalizacion" on canalizacion_plantillas
  for delete using (auth.role() = 'authenticated');

-- Catálogo compartido de diámetros de tubería (en pulgadas, admite
-- fracciones como '3/4"' o '1 1/4"') — mismo criterio que País/Ingeniero de
-- proyectos: empieza con los más comunes, cualquiera puede agregar otro.
create table if not exists diametros_tuberia (
  nombre text primary key,
  created_at timestamptz default now()
);

alter table diametros_tuberia enable row level security;

drop policy if exists "Lectura de diametros de tuberia" on diametros_tuberia;
create policy "Lectura de diametros de tuberia" on diametros_tuberia
  for select using (auth.role() = 'authenticated');

drop policy if exists "Crear diametros de tuberia" on diametros_tuberia;
create policy "Crear diametros de tuberia" on diametros_tuberia
  for insert with check (auth.role() = 'authenticated');
