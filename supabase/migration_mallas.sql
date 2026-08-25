-- =============================================================
-- Sun Design Suite · Migración: tipos de malla electrosoldada
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
-- =============================================================

create table if not exists mallas (
  nombre text primary key,
  created_at timestamptz default now()
);

alter table mallas enable row level security;
drop policy if exists "Lectura de mallas" on mallas;
create policy "Lectura de mallas" on mallas
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear mallas" on mallas;
create policy "Crear mallas" on mallas
  for insert with check (auth.role() = 'authenticated');

insert into mallas (nombre) values ('D84')
on conflict (nombre) do nothing;
