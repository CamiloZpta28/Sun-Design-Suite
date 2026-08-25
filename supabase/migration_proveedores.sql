-- =============================================================
-- Sun Design Suite · Migración: lista de proveedores (Mecánica)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
-- =============================================================

create table if not exists proveedores (
  nombre text primary key,
  created_at timestamptz default now()
);

alter table proveedores enable row level security;
drop policy if exists "Lectura de proveedores" on proveedores;
create policy "Lectura de proveedores" on proveedores
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear proveedores" on proveedores;
create policy "Crear proveedores" on proveedores
  for insert with check (auth.role() = 'authenticated');

insert into proveedores (nombre) values
  ('Zentrack'), ('TRINA'), ('Antai')
on conflict (nombre) do nothing;
