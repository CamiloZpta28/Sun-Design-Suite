-- =============================================================
-- Sun Design Suite · Migración: parámetros de ingeniería editables
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
-- =============================================================

create table if not exists parametros_ingenieria (
  id text primary key default 'global',
  datos jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table parametros_ingenieria enable row level security;
drop policy if exists "Lectura de parametros de ingenieria" on parametros_ingenieria;
create policy "Lectura de parametros de ingenieria" on parametros_ingenieria
  for select using (auth.role() = 'authenticated');
drop policy if exists "Solo desarrollador edita parametros de ingenieria (insert)" on parametros_ingenieria;
create policy "Solo desarrollador edita parametros de ingenieria (insert)" on parametros_ingenieria
  for insert with check (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'desarrollador')
  );
drop policy if exists "Solo desarrollador edita parametros de ingenieria (update)" on parametros_ingenieria;
create policy "Solo desarrollador edita parametros de ingenieria (update)" on parametros_ingenieria
  for update using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'desarrollador')
  );

-- Valores semilla — recubrimiento, ganchos/pesos por calibre (ya corregidos:
-- #3=0.10, #4=0.20, #5=0.25, #6=0.30) y traslapos por calibre/resistencia
-- (tabla NSR-10, redondeados hacia arriba al múltiplo de 0.05m más cercano).
insert into parametros_ingenieria (id, datos) values ('global', '{
  "recubrimiento": 0.075,
  "barras": {
    "#3": { "gancho": 0.10, "peso": 0.56 },
    "#4": { "gancho": 0.20, "peso": 0.994 },
    "#5": { "gancho": 0.25, "peso": 1.552 },
    "#6": { "gancho": 0.30, "peso": 2.235 }
  },
  "traslapos": {
    "#3": { "21 MPa": 0.55, "28 MPa": 0.50, "35 MPa": 0.45 },
    "#4": { "21 MPa": 0.75, "28 MPa": 0.65, "35 MPa": 0.60 },
    "#5": { "21 MPa": 0.95, "28 MPa": 0.80, "35 MPa": 0.70 },
    "#6": { "21 MPa": 1.10, "28 MPa": 0.95, "35 MPa": 0.85 }
  }
}'::jsonb)
on conflict (id) do nothing;
