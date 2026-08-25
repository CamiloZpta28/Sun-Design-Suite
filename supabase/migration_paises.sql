-- =============================================================
-- Sun Design Suite · Migración: lista de países
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
-- =============================================================

create table if not exists paises (
  nombre text primary key,
  created_at timestamptz default now()
);

alter table paises enable row level security;
drop policy if exists "Lectura de paises" on paises;
create policy "Lectura de paises" on paises
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear paises" on paises;
create policy "Crear paises" on paises
  for insert with check (auth.role() = 'authenticated');

insert into paises (nombre) values ('Colombia')
on conflict (nombre) do nothing;
