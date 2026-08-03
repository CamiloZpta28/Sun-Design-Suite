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
  notas jsonb not null default '[]'::jsonb,
  documentos jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists links (
  id text primary key,
  descripcion text not null,
  url text not null,
  created_at timestamptz default now()
);

-- Roles de cada persona (puede tener varios a la vez, ej. Líder Civil +
-- Ing. Civil). Solo un líder puede otorgar o quitar roles — ver políticas
-- más abajo. Es una tabla aparte (no una columna en "profiles") para poder
-- controlar quién puede escribir aquí sin afectar la edición de nombre/foto.
create table if not exists user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  assigned_by uuid references auth.users(id),
  created_at timestamptz default now(),
  primary key (user_id, role_key)
);

-- Registro de trazabilidad: quién cambió qué y cuándo, por proyecto.
-- Es de solo lectura + inserción a propósito (nadie puede editar ni borrar
-- una entrada ya creada), para que el historial sea confiable.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  usuario_nombre text not null,
  accion text not null,
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

alter table activity_log enable row level security;

create policy "Lectura de historial" on activity_log
  for select using (auth.role() = 'authenticated');
create policy "Crear registros de historial" on activity_log
  for insert with check (auth.role() = 'authenticated');
-- A propósito no hay políticas de update/delete: el historial es inmutable.

alter table user_roles enable row level security;

create policy "Lectura de roles" on user_roles
  for select using (auth.role() = 'authenticated');

-- Solo alguien que YA tiene un rol de líder puede otorgar o quitar roles
-- (a sí mismo o a otra persona). Esto es intencional: nadie puede
-- autoasignarse un rol de liderazgo desde la aplicación.
create policy "Lideres asignan roles" on user_roles
  for insert with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
    )
  );
create policy "Lideres quitan roles" on user_roles
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
    )
  );

-- -------------------------------------------------------------
-- IMPORTANTE: cómo asignar el PRIMER líder
-- -------------------------------------------------------------
-- La política de arriba exige que quien otorga un rol de líder ya
-- tenga uno — así que la primera vez, nadie califica. Rómpelo así,
-- una sola vez, después de que la primera persona haya creado su
-- cuenta en la app:
--   1. Ve a Authentication > Users en el panel de Supabase y copia
--      el UUID de esa persona.
--   2. Corre (reemplazando el UUID):
--      insert into user_roles (user_id, role_key)
--      values ('PEGA-AQUI-EL-UUID', 'lider_diseno');
-- El SQL Editor corre con privilegios de administrador, así que
-- puede saltarse la política de arriba solo para este paso inicial.
-- Después de esto, esa persona ya puede asignar roles a todos los
-- demás desde la sección "Equipo" de la aplicación.

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
