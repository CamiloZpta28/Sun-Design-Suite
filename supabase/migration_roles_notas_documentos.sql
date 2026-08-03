-- =============================================================
-- Sun Design Suite · Migración: roles, notas y Control Documental
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql (y probablemente migration_historial.sql) antes de
-- esta actualización. Pégalo completo en el SQL Editor de Supabase
-- y presiona "Run".
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
-- =============================================================

-- 1) La especialidad ya no se auto-asigna al crear la cuenta (ahora
--    los roles viven en la tabla user_roles, ver más abajo), así que
--    la columna vieja "especialidad" de profiles debe dejar de ser
--    obligatoria para que los perfiles nuevos se puedan crear.
alter table profiles alter column especialidad drop not null;

-- 2) Nuevas columnas en projects: notas (bloc de notas) y documentos
--    (estado/comentarios de Control Documental).
alter table projects add column if not exists notas jsonb not null default '[]'::jsonb;
alter table projects add column if not exists documentos jsonb not null default '{}'::jsonb;

-- 3) Tabla de roles. Cada persona puede tener varios roles a la vez
--    (ej. Líder Civil + Ing. Civil). Es una tabla aparte (no una
--    columna en "profiles") para poder controlar quién puede
--    escribir aquí sin afectar la edición de nombre/foto de cada
--    quien sobre su propio perfil.
create table if not exists user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  assigned_by uuid references auth.users(id),
  created_at timestamptz default now(),
  primary key (user_id, role_key)
);

alter table user_roles enable row level security;

create policy "Lectura de roles" on user_roles
  for select using (auth.role() = 'authenticated');

-- Solo alguien que YA tiene un rol de líder puede otorgar o quitar
-- roles (a sí mismo o a otra persona). Nadie puede autoasignarse un
-- rol de liderazgo desde la aplicación.
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
-- una sola vez:
--   1. Asegúrate de que la persona que será el primer líder ya haya
--      iniciado sesión y creado su perfil (nombre + foto) en la app
--      al menos una vez.
--   2. Ve a Authentication > Users en el panel de Supabase y copia
--      el UUID de esa persona.
--   3. Corre (reemplazando el UUID):
--      insert into user_roles (user_id, role_key)
--      values ('PEGA-AQUI-EL-UUID', 'lider_diseno');
-- El SQL Editor corre con privilegios de administrador, así que
-- puede saltarse la política de arriba solo para este paso inicial.
-- Después de esto, esa persona ya puede asignar roles a todos los
-- demás desde la sección "Equipo" de la aplicación — no necesitas
-- volver a tocar el SQL Editor para futuras asignaciones de rol.
