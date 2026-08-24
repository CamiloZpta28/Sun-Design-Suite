-- =============================================================
-- Sun Design Suite · Migración: Operador de red, Instalador, y
-- atributos de Inversionista (correo/teléfono/NIT/logo).
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
-- =============================================================

-- El operador de red de un proyecto (con su logo) — catálogo compartido,
-- igual criterio que "mallas": empieza vacío, cualquiera con permiso de
-- editar un proyecto puede agregar uno nuevo, y queda disponible para
-- cualquier otro proyecto que lo necesite.
create table if not exists operadores_red (
  nombre text primary key,
  logo text,
  created_at timestamptz default now()
);

-- El instalador de un proyecto (con su NIT y logo) — mismo criterio.
-- Empieza con "Solenium"; cualquiera puede agregar otro.
create table if not exists instaladores (
  nombre text primary key,
  nit text,
  logo text,
  created_at timestamptz default now()
);

-- El correo/teléfono/NIT/logo de un inversionista son datos DEL
-- INVERSIONISTA (no del proyecto): al elegir un inversionista para un
-- proyecto, estos datos se muestran/editan desde ahí, pero quedan
-- guardados en esta tabla y se reflejan en todos los proyectos de ese
-- mismo inversionista.
alter table inversionistas add column if not exists correo text;
alter table inversionistas add column if not exists telefono text;
alter table inversionistas add column if not exists nit text;
alter table inversionistas add column if not exists logo text;

alter table operadores_red enable row level security;
create policy "Lectura de operadores de red" on operadores_red
  for select using (auth.role() = 'authenticated');
create policy "Crear operadores de red" on operadores_red
  for insert with check (auth.role() = 'authenticated');
create policy "Editar operadores de red" on operadores_red
  for update using (auth.role() = 'authenticated');

alter table instaladores enable row level security;
create policy "Lectura de instaladores" on instaladores
  for select using (auth.role() = 'authenticated');
create policy "Crear instaladores" on instaladores
  for insert with check (auth.role() = 'authenticated');
create policy "Editar instaladores" on instaladores
  for update using (auth.role() = 'authenticated');

-- Ingenieros de proyectos: personas que NO tienen cuenta en la plataforma
-- (no inician sesión), pero se les asigna a un proyecto igual que cualquier
-- otro rol — solo que su "ficha" es nombre+matrícula en vez de una cuenta.
create table if not exists ingenieros_proyectos (
  nombre text primary key,
  matricula text,
  created_at timestamptz default now()
);

alter table ingenieros_proyectos enable row level security;
create policy "Lectura de ingenieros de proyectos" on ingenieros_proyectos
  for select using (auth.role() = 'authenticated');
create policy "Crear ingenieros de proyectos" on ingenieros_proyectos
  for insert with check (auth.role() = 'authenticated');
create policy "Editar ingenieros de proyectos" on ingenieros_proyectos
  for update using (auth.role() = 'authenticated');

-- Registra la última vez que CADA usuario abrió CADA proyecto — solo para
-- poder ordenar "Mis proyectos" por el último con el que interactuó (no
-- afecta el historial de cambios de "activity_log", que es aparte).
create table if not exists project_last_view (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (usuario_id, project_id)
);

alter table project_last_view enable row level security;
create policy "Lectura de mis visitas" on project_last_view
  for select using (auth.role() = 'authenticated');
create policy "Registrar mi visita" on project_last_view
  for insert with check (auth.uid() = usuario_id);
create policy "Actualizar mi visita" on project_last_view
  for update using (auth.uid() = usuario_id);

-- Antes solo se podía agregar un inversionista nuevo (insert); ahora también
-- hay que poder editar sus datos de contacto desde un proyecto.
drop policy if exists "Editar inversionistas" on inversionistas;
create policy "Editar inversionistas" on inversionistas
  for update using (auth.role() = 'authenticated');
