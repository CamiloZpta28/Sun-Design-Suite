-- =============================================================
-- Sun Design Suite · Migración: plantillas de cimentaciones
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
-- =============================================================

create table if not exists cimentacion_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cimentacion_plantillas enable row level security;
drop policy if exists "Lectura de plantillas de cimentacion" on cimentacion_plantillas;
create policy "Lectura de plantillas de cimentacion" on cimentacion_plantillas
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear plantillas de cimentacion" on cimentacion_plantillas;
create policy "Crear plantillas de cimentacion" on cimentacion_plantillas
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Editar plantillas de cimentacion" on cimentacion_plantillas;
create policy "Editar plantillas de cimentacion" on cimentacion_plantillas
  for update using (auth.role() = 'authenticated');
drop policy if exists "Eliminar plantillas de cimentacion" on cimentacion_plantillas;
create policy "Eliminar plantillas de cimentacion" on cimentacion_plantillas
  for delete using (auth.role() = 'authenticated');
