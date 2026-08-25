-- =============================================================
-- Sun Design Suite · Migración: plantillas de Canalizaciones
-- (zanjas para las líneas eléctricas/comunicaciones enterradas).
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
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
create policy "Lectura de plantillas de canalizacion" on canalizacion_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear plantillas de canalizacion" on canalizacion_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar plantillas de canalizacion" on canalizacion_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar plantillas de canalizacion" on canalizacion_plantillas
  for delete using (auth.role() = 'authenticated');
