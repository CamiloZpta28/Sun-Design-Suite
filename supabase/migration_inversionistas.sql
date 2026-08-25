-- =============================================================
-- Sun Design Suite · Migración: lista de inversionistas
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
--
-- NOTA: no necesitas migrar nada por el cambio en el código del
-- proyecto (la "T" de terreno y la abreviatura automática de
-- departamento) — eso vive solo en el código de la app, no en la
-- base de datos. El campo "codigo_departamento" que ya no se usa
-- simplemente queda sin tocar en los proyectos existentes; no hace
-- falta borrarlo.
-- =============================================================

create table if not exists inversionistas (
  nombre text primary key,
  created_at timestamptz default now()
);

alter table inversionistas enable row level security;
drop policy if exists "Lectura de inversionistas" on inversionistas;
create policy "Lectura de inversionistas" on inversionistas
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear inversionistas" on inversionistas;
create policy "Crear inversionistas" on inversionistas
  for insert with check (auth.role() = 'authenticated');

-- Siembra los inversionistas iniciales (no falla si ya existen).
insert into inversionistas (nombre) values
  ('FENOGE'), ('CFM'), ('FMO'), ('Bancolombia')
on conflict (nombre) do nothing;
