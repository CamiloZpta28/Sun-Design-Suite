-- =============================================================
-- Sun Design Suite · Migración: Instructivos (videos organizados
-- en carpetas)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
-- =============================================================

create table if not exists instructivo_carpetas (
  id text primary key,
  nombre text not null,
  created_at timestamptz default now()
);

create table if not exists instructivo_videos (
  id text primary key,
  carpeta_id text references instructivo_carpetas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  url text not null,
  created_at timestamptz default now()
);

alter table instructivo_carpetas enable row level security;
create policy "Lectura de carpetas de instructivos" on instructivo_carpetas
  for select using (auth.role() = 'authenticated');
create policy "Crear carpetas de instructivos" on instructivo_carpetas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar carpetas de instructivos" on instructivo_carpetas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar carpetas de instructivos" on instructivo_carpetas
  for delete using (auth.role() = 'authenticated');

alter table instructivo_videos enable row level security;
create policy "Lectura de videos de instructivos" on instructivo_videos
  for select using (auth.role() = 'authenticated');
create policy "Crear videos de instructivos" on instructivo_videos
  for insert with check (auth.role() = 'authenticated');
create policy "Editar videos de instructivos" on instructivo_videos
  for update using (auth.role() = 'authenticated');
create policy "Eliminar videos de instructivos" on instructivo_videos
  for delete using (auth.role() = 'authenticated');
