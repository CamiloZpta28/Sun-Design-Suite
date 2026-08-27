-- =============================================================
-- Sun Design Suite · Migración: "Actualizaciones" (registro de
-- actualizaciones de diseño, organizado por categoría — global, no por
-- proyecto). Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor de
-- Supabase y presiona "Run".
--
-- Es seguro correr este archivo más de una vez (usa "if not exists" y
-- "drop policy if exists" antes de cada política).
-- =============================================================

-- Categorías de actualizaciones — empiezan con las 6 iniciales, pero
-- cualquiera puede crear/renombrar/eliminar más desde la plataforma.
create table if not exists actualizacion_categorias (
  id text primary key,
  nombre text not null,
  orden integer default 0,
  created_at timestamptz default now()
);

-- Las actualizaciones en sí. "interesados" es un arreglo de claves de rol
-- (ver ALL_ROLE_DEFS en la app). "imagen" es una imagen en base64 (como en
-- Equipos eléctricos), puede quedar vacía.
create table if not exists actualizaciones (
  id text primary key,
  categoria_id text not null references actualizacion_categorias(id) on delete cascade,
  nombre text not null,
  descripcion text,
  interesados jsonb not null default '[]'::jsonb,
  ubicacion text,
  imagen text,
  creado_por text,
  created_at timestamptz default now()
);
-- Si ya habías corrido una versión anterior de este archivo (sin
-- "etiquetas"), esta línea la agrega sin romper nada:
alter table actualizaciones add column if not exists etiquetas jsonb not null default '[]'::jsonb;

alter table actualizacion_categorias enable row level security;

drop policy if exists "Lectura de categorias de actualizaciones" on actualizacion_categorias;
create policy "Lectura de categorias de actualizaciones" on actualizacion_categorias
  for select using (auth.role() = 'authenticated');

drop policy if exists "Crear categorias de actualizaciones" on actualizacion_categorias;
create policy "Crear categorias de actualizaciones" on actualizacion_categorias
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Editar categorias de actualizaciones" on actualizacion_categorias;
create policy "Editar categorias de actualizaciones" on actualizacion_categorias
  for update using (auth.role() = 'authenticated');

drop policy if exists "Eliminar categorias de actualizaciones" on actualizacion_categorias;
create policy "Eliminar categorias de actualizaciones" on actualizacion_categorias
  for delete using (auth.role() = 'authenticated');

alter table actualizaciones enable row level security;

drop policy if exists "Lectura de actualizaciones" on actualizaciones;
create policy "Lectura de actualizaciones" on actualizaciones
  for select using (auth.role() = 'authenticated');

drop policy if exists "Crear actualizaciones" on actualizaciones;
create policy "Crear actualizaciones" on actualizaciones
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Editar actualizaciones" on actualizaciones;
create policy "Editar actualizaciones" on actualizaciones
  for update using (auth.role() = 'authenticated');

drop policy if exists "Eliminar actualizaciones" on actualizaciones;
create policy "Eliminar actualizaciones" on actualizaciones
  for delete using (auth.role() = 'authenticated');
