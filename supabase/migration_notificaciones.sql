-- =============================================================
-- Sun Design Suite · Migración: sistema de notificaciones.
-- Se generan 2 casos: (1) alguien más edita un proyecto donde yo estoy
-- asignado, (2) alguien agrega una actualización de diseño marcando como
-- interesado un rol que yo tengo. Solo necesitas correr este archivo si
-- YA habías ejecutado schema.sql antes de esta actualización. Pégalo en
-- el SQL Editor de Supabase y presiona "Run".
--
-- Es seguro correr este archivo más de una vez (usa "if not exists" y
-- "drop policy if exists" antes de cada política).
-- =============================================================

create table if not exists notificaciones (
  id text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null, -- 'proyecto' | 'actualizacion'
  mensaje text not null,
  proyecto_id text references projects(id) on delete cascade,
  actualizacion_id text references actualizaciones(id) on delete cascade,
  categoria_actualizacion_id text,
  leida boolean not null default false,
  created_at timestamptz default now()
);

alter table notificaciones enable row level security;

drop policy if exists "Lectura de mis notificaciones" on notificaciones;
create policy "Lectura de mis notificaciones" on notificaciones
  for select using (auth.uid() = usuario_id);

drop policy if exists "Crear notificaciones" on notificaciones;
create policy "Crear notificaciones" on notificaciones
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Marcar mis notificaciones como leidas" on notificaciones;
create policy "Marcar mis notificaciones como leidas" on notificaciones
  for update using (auth.uid() = usuario_id);
