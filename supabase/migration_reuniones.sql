-- =============================================================
-- Sun Design Suite · Migración: Reuniones del lunes
--
-- Cada lunes hay tres reuniones —civil, eléctrica y delineantes—. En cada
-- una se revisan los pendientes de las anteriores, se tratan los temas que
-- la gente marcó en su resumen del viernes y salen pendientes nuevos.
--
-- Cinco tablas:
--   reuniones_sesiones   una por reunión y por semana: fecha y moderador.
--   reuniones_rotacion   el orden en que se modera, una lista por reunión.
--   reuniones_pendientes los compromisos que salen de la reunión. Son de la
--                        reunión, no de una sesión: se arrastran solos de
--                        lunes a lunes hasta que se finalizan.
--   reuniones_historial  cada cambio de estado con su justificación. Solo se
--                        escribe, nunca se edita ni se borra: un historial
--                        que se puede reescribir no le sirve a nadie.
--   reuniones_temas      qué se decidió de cada tema que llegó a la sesión.
--
-- Los invitados no ven nada de esto, ni en la pantalla ni en la base.
--
-- REQUIERE que ya esté corrida supabase/migration_rol_invitado.sql (usa su
-- función es_invitado()). Esta migración ya les pone a sus tablas la regla
-- de invitados, así que NO hace falta volver a correr aquella.
--
-- Si NO la corres no se rompe nada: la sección Reuniones aparece vacía y
-- avisa que falta la migración. El resto de la plataforma no se entera.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'es_invitado') then
    raise exception 'Falta correr primero supabase/migration_rol_invitado.sql';
  end if;
end $$;

begin;

create table if not exists reuniones_sesiones (
  -- 'sesion-<reunión>-<lunes>': determinista, para que dos personas que la
  -- abren a la vez no creen dos filas.
  id text primary key,
  serie text not null,           -- 'civil' | 'electrica' | 'delineantes'
  semana date not null,          -- el lunes de la semana
  fecha date,                    -- el día real; otro si el lunes era festivo
  moderador_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (serie, semana)
);

create table if not exists reuniones_rotacion (
  serie text primary key,
  -- Los ids de las personas, en el orden en que moderan.
  orden jsonb not null default '[]'::jsonb,
  actualizado_por text,
  updated_at timestamptz default now()
);

create table if not exists reuniones_pendientes (
  id text primary key,
  serie text not null,
  texto text not null,
  -- Los ids de los responsables: uno o más.
  responsables jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'finalizado')),
  -- La sesión donde nació, para el registro de esa sesión.
  sesion_origen text,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reuniones_historial (
  id text primary key,
  pendiente_id text not null references reuniones_pendientes(id) on delete cascade,
  accion text not null default 'actualizado'
    check (accion in ('creado', 'actualizado')),
  estado text not null,
  justificacion text,
  usuario_id uuid references auth.users(id) on delete set null,
  -- El nombre se guarda tal cual: si la persona sale del equipo, el
  -- historial tiene que seguir diciendo quién lo escribió.
  usuario_nombre text,
  created_at timestamptz default now()
);

create table if not exists reuniones_temas (
  id text primary key,
  sesion_id text not null,
  -- '<autor>:<texto>'. Lleva el texto y no la posición: si alguien reordena
  -- sus temas, la conclusión no puede quedar pegada al tema equivocado.
  clave text not null,
  autor_id uuid,
  -- Copia del texto: el registro tiene que leerse aunque el resumen cambie.
  texto text not null,
  resultado text not null check (resultado in ('pendiente', 'sin_compromiso')),
  conclusion text,
  pendiente_id text references reuniones_pendientes(id) on delete set null,
  usuario_id uuid,
  created_at timestamptz default now(),
  unique (sesion_id, clave)
);

create index if not exists reuniones_pendientes_serie_idx on reuniones_pendientes (serie);
create index if not exists reuniones_historial_pendiente_idx on reuniones_historial (pendiente_id);
create index if not exists reuniones_temas_sesion_idx on reuniones_temas (sesion_id);

alter table reuniones_sesiones enable row level security;
alter table reuniones_rotacion enable row level security;
alter table reuniones_pendientes enable row level security;
alter table reuniones_historial enable row level security;
alter table reuniones_temas enable row level security;

-- ---------- Lo que puede hacer el equipo ----------

drop policy if exists "Lectura de sesiones" on reuniones_sesiones;
create policy "Lectura de sesiones" on reuniones_sesiones
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear sesiones" on reuniones_sesiones;
create policy "Crear sesiones" on reuniones_sesiones
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Editar sesiones" on reuniones_sesiones;
create policy "Editar sesiones" on reuniones_sesiones
  for update using (auth.role() = 'authenticated');

-- La rotación la editan solo los líderes: decide a quién le toca cada lunes.
drop policy if exists "Lectura de la rotacion" on reuniones_rotacion;
create policy "Lectura de la rotacion" on reuniones_rotacion
  for select using (auth.role() = 'authenticated');
drop policy if exists "Rotacion solo lideres" on reuniones_rotacion;
create policy "Rotacion solo lideres" on reuniones_rotacion
  for all using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

drop policy if exists "Lectura de pendientes" on reuniones_pendientes;
create policy "Lectura de pendientes" on reuniones_pendientes
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear pendientes" on reuniones_pendientes;
create policy "Crear pendientes" on reuniones_pendientes
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Editar pendientes" on reuniones_pendientes;
create policy "Editar pendientes" on reuniones_pendientes
  for update using (auth.role() = 'authenticated');
-- Borrar un pendiente es solo de los líderes: es para corregir un error, no
-- para cerrar uno (para eso está "Finalizado").
drop policy if exists "Borrar pendientes solo lideres" on reuniones_pendientes;
create policy "Borrar pendientes solo lideres" on reuniones_pendientes
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

-- El historial solo se escribe, y cada quien firma con su propia cuenta.
-- No hay regla de editar ni de borrar: sin ella, la base lo rechaza.
drop policy if exists "Lectura del historial" on reuniones_historial;
create policy "Lectura del historial" on reuniones_historial
  for select using (auth.role() = 'authenticated');
drop policy if exists "Escribir en el historial" on reuniones_historial;
create policy "Escribir en el historial" on reuniones_historial
  for insert with check (usuario_id = auth.uid());

drop policy if exists "Lectura de temas tratados" on reuniones_temas;
create policy "Lectura de temas tratados" on reuniones_temas
  for select using (auth.role() = 'authenticated');
drop policy if exists "Crear temas tratados" on reuniones_temas;
create policy "Crear temas tratados" on reuniones_temas
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Editar temas tratados" on reuniones_temas;
create policy "Editar temas tratados" on reuniones_temas
  for update using (auth.role() = 'authenticated');
drop policy if exists "Borrar temas tratados" on reuniones_temas;
create policy "Borrar temas tratados" on reuniones_temas
  for delete using (auth.role() = 'authenticated');

-- ---------- Los invitados, fuera ----------
-- Se suman a lo de arriba como reglas "restrictivas": para un invitado dicen
-- que no, para los demás no cambian nada. Los nombres son los mismos que usa
-- migration_rol_invitado.sql, así que volver a correr aquella no las duplica.
do $$
declare
  t text;
begin
  foreach t in array array['reuniones_sesiones','reuniones_rotacion','reuniones_pendientes','reuniones_historial','reuniones_temas']
  loop
    execute format('drop policy if exists "Invitado no ve reuniones" on %I', t);
    execute format('create policy "Invitado no ve reuniones" on %I as restrictive for select to authenticated using (not es_invitado())', t);
    execute format('drop policy if exists "Invitado no crea" on %I', t);
    execute format('drop policy if exists "Invitado no edita" on %I', t);
    execute format('drop policy if exists "Invitado no borra" on %I', t);
    execute format('create policy "Invitado no crea" on %I as restrictive for insert to authenticated with check (not es_invitado())', t);
    execute format('create policy "Invitado no edita" on %I as restrictive for update to authenticated using (not es_invitado())', t);
    execute format('create policy "Invitado no borra" on %I as restrictive for delete to authenticated using (not es_invitado())', t);
  end loop;
end $$;

commit;
