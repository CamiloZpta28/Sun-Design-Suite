-- =============================================================
-- Sun Design Suite · Migración: plantillas de equipos eléctricos
-- Corre este archivo UNA VEZ en el SQL Editor de Supabase para
-- habilitar la pestaña "Equipos eléctricos". La primera vez que
-- alguien abra esa pestaña, la app sembrará automáticamente las
-- 68 plantillas de ejemplo (ver EQUIPO_SEED en src/App.jsx).
-- =============================================================

create table if not exists equipo_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table equipo_plantillas enable row level security;
create policy "Lectura de plantillas de equipos" on equipo_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear plantillas de equipos" on equipo_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar plantillas de equipos" on equipo_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar plantillas de equipos" on equipo_plantillas
  for delete using (auth.role() = 'authenticated');
