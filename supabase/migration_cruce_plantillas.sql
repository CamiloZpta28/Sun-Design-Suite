-- =============================================================
-- Sun Design Suite · Migración: plantillas de Cruces
-- (detalles de cruce entre 2 canalizaciones ya creadas, según la Tabla 4
-- del documento de criterios de zanjas). Solo necesitas correr este
-- archivo si YA habías ejecutado schema.sql antes de esta actualización.
-- Pégalo en el SQL Editor de Supabase y presiona "Run".
--
-- Es seguro correr este archivo más de una vez (usa "if not exists" y
-- "drop policy if exists" antes de cada política).
-- =============================================================

create table if not exists cruce_plantillas (
  id text primary key,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cruce_plantillas enable row level security;

drop policy if exists "Lectura de cruces" on cruce_plantillas;
create policy "Lectura de cruces" on cruce_plantillas
  for select using (auth.role() = 'authenticated');

drop policy if exists "Crear cruces" on cruce_plantillas;
create policy "Crear cruces" on cruce_plantillas
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Editar cruces" on cruce_plantillas;
create policy "Editar cruces" on cruce_plantillas
  for update using (auth.role() = 'authenticated');

drop policy if exists "Eliminar cruces" on cruce_plantillas;
create policy "Eliminar cruces" on cruce_plantillas
  for delete using (auth.role() = 'authenticated');
