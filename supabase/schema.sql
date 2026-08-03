-- =============================================================
-- Sun Design Suite · Esquema de base de datos para Supabase
-- Pega este archivo completo en Supabase > SQL Editor > New query
-- y presiona "Run".
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- Tablas ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  especialidad text not null,
  foto_url text,
  created_at timestamptz default now()
);

create table if not exists projects (
  id text primary key,
  nombre text not null,
  estado text not null default 'activo',
  equipo jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  archivos jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists links (
  id text primary key,
  descripcion text not null,
  url text not null,
  created_at timestamptz default now()
);

-- ---------- Seguridad a nivel de fila (RLS) ----------
-- Estas políticas asumen un equipo interno de confianza: cualquier
-- persona autenticada puede leer y escribir los datos compartidos
-- (proyectos y enlaces). Cada quien solo puede crear/editar su propio
-- perfil. Puedes endurecer esto más adelante si lo necesitas.

alter table profiles enable row level security;
alter table projects enable row level security;
alter table links enable row level security;

create policy "Lectura de perfiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "Crear mi propio perfil" on profiles
  for insert with check (auth.uid() = id);
create policy "Editar mi propio perfil" on profiles
  for update using (auth.uid() = id);

create policy "Lectura de proyectos" on projects
  for select using (auth.role() = 'authenticated');
create policy "Crear proyectos" on projects
  for insert with check (auth.role() = 'authenticated');
create policy "Editar proyectos" on projects
  for update using (auth.role() = 'authenticated');
create policy "Eliminar proyectos" on projects
  for delete using (auth.role() = 'authenticated');

create policy "Lectura de enlaces" on links
  for select using (auth.role() = 'authenticated');
create policy "Crear enlaces" on links
  for insert with check (auth.role() = 'authenticated');
create policy "Editar enlaces" on links
  for update using (auth.role() = 'authenticated');
create policy "Eliminar enlaces" on links
  for delete using (auth.role() = 'authenticated');

-- ---------- Bucket de almacenamiento para fotos de perfil ----------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Fotos de perfil son públicas para lectura"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Usuarios autenticados pueden subir su foto"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden reemplazar su foto"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
