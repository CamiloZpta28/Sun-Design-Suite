-- =============================================================
-- Sun Design Suite · Migración: historial de cambios (trazabilidad)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql anteriormente (es decir, tu proyecto de Supabase ya
-- existía antes de esta actualización). Pégalo en el SQL Editor y
-- presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye esta tabla.
-- =============================================================

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  usuario_nombre text not null,
  accion text not null,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;

drop policy if exists "Lectura de historial" on activity_log;
create policy "Lectura de historial" on activity_log
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear registros de historial" on activity_log;
create policy "Crear registros de historial" on activity_log
  for insert with check (auth.role() = 'authenticated');
-- A propósito no hay políticas de update/delete: el historial es inmutable,
-- así nadie (ni por error) puede alterar o borrar un registro pasado.
