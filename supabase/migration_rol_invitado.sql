-- =============================================================
-- Sun Design Suite · Migración: rol Invitado
--
-- Un invitado es alguien de Solenium que sigue los proyectos sin
-- trabajarlos: los ve todos, con todas sus pestañas, pero no edita nada.
--
-- Invitado no es un rol que se otorgue: es quien NO tiene ningún rol de
-- equipo. Toda cuenta nueva entra así, y deja de serlo cuando un líder o
-- un desarrollador le da un rol del equipo. Nunca se es invitado y otra
-- cosa a la vez.
--
-- OJO: las cuentas que HOY no tienen ningún rol quedan como invitadas en
-- cuanto corras esto. Hasta ahora esas cuentas podían escribir en
-- cualquier proyecto; si alguna es de alguien del equipo, dale su rol en
-- Equipo y vuelve a poder trabajar.
--
-- Hasta ahora la base de datos dejaba escribir a cualquier cuenta con
-- sesión iniciada; los permisos vivían solo en la pantalla, que no muestra
-- los botones. Para un invitado eso no basta: con la misma sesión se puede
-- escribir por fuera de la aplicación. Esta migración hace que la BASE
-- rechace cualquier escritura de un invitado, venga de donde venga.
--
-- Hace tres cosas:
--   1. Una función, es_invitado(), que dice si quien hace la petición no
--      tiene ningún rol de equipo.
--   2. Una regla "restrictiva" en cada tabla: se suma a las que ya hay y,
--      para un invitado, dice que no a crear, editar o borrar. Las reglas
--      de los demás no cambian.
--   3. Saca los datos personales (cédula, dirección, celular…) del perfil
--      a su propia tabla. El perfil lo lee cualquier cuenta, así que un
--      invitado los habría podido descargar aunque la pantalla no los
--      mostrara. En la tabla nueva, cada quien ve los suyos, y los de los
--      demás solo quien tiene un rol de equipo que no sea Invitado.
--
-- El invitado conserva lo que es SOLO suyo: su nombre y su foto, sus
-- datos personales, marcar como leídas y borrar sus notificaciones, y el
-- registro de su última visita a cada proyecto.
--
-- OJO para el futuro: la regla del punto 2 se pone en las tablas que
-- existen HOY. Si más adelante se crea una tabla nueva, hay que volver a
-- correr este archivo (se puede correr cuantas veces se quiera).
--
-- ORDEN: primero sube la versión nueva de la plataforma y DESPUÉS corre
-- este archivo. La versión nueva funciona con o sin él (mientras no esté,
-- sigue leyendo los datos personales del perfil); la anterior, en cambio,
-- los busca en el perfil y dejaría de verlos en cuanto esto los mueva.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- =============================================================

begin;

-- ---------- 1. ¿Es invitado quien hace la petición? ----------
-- Lo es quien no tiene ningún rol de equipo. Una fila con la clave
-- 'invitado' (no se crea desde la aplicación) tampoco cuenta como rol.
-- "security definer" para que la consulta a user_roles no dependa de las
-- reglas de esa misma tabla.
create or replace function es_invitado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from user_roles
    where user_id = auth.uid() and role_key <> 'invitado'
  );
$$;

grant execute on function es_invitado() to authenticated;


-- ---------- 2. Un invitado no escribe ----------
-- Quedan fuera de este bloque las tablas donde el invitado sí escribe lo
-- suyo; esas se tratan una por una más abajo.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tabla
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname not in ('profiles', 'notificaciones', 'project_last_view', 'datos_personales')
  loop
    execute format('drop policy if exists "Invitado no crea" on %I', t.tabla);
    execute format('drop policy if exists "Invitado no edita" on %I', t.tabla);
    execute format('drop policy if exists "Invitado no borra" on %I', t.tabla);
    execute format('create policy "Invitado no crea" on %I as restrictive for insert to authenticated with check (not es_invitado())', t.tabla);
    execute format('create policy "Invitado no edita" on %I as restrictive for update to authenticated using (not es_invitado())', t.tabla);
    execute format('create policy "Invitado no borra" on %I as restrictive for delete to authenticated using (not es_invitado())', t.tabla);
  end loop;

  -- Una tabla sin RLS no obedece ninguna regla, ni esta. Si aparece alguna
  -- aquí, el invitado podría escribir en ella: hay que activarle RLS.
  for t in
    select c.relname as tabla
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise notice 'La tabla % no tiene RLS activado: un invitado podría escribir en ella.', t.tabla;
  end loop;
end $$;

-- Perfiles: el invitado crea y edita el suyo (nombre, foto, fechas) y
-- nada más. Crear el suyo es lo primero que hace una cuenta nueva.
drop policy if exists "Invitado solo edita su perfil" on profiles;
create policy "Invitado solo edita su perfil" on profiles
  as restrictive for update to authenticated
  using (not es_invitado() or id = auth.uid());
drop policy if exists "Invitado no borra perfiles" on profiles;
create policy "Invitado no borra perfiles" on profiles
  as restrictive for delete to authenticated
  using (not es_invitado());

-- Notificaciones: las suyas las marca y las borra (eso ya lo limitan las
-- reglas de siempre a sus propias filas), pero no le crea avisos a nadie.
drop policy if exists "Invitado no crea notificaciones" on notificaciones;
create policy "Invitado no crea notificaciones" on notificaciones
  as restrictive for insert to authenticated
  with check (not es_invitado());

-- project_last_view no se toca: solo guarda la visita propia de cada quien.


-- ---------- 3. Datos personales, en su propia tabla ----------
create table if not exists datos_personales (
  user_id uuid primary key references profiles(id) on delete cascade,
  cedula text,
  ciudad_expedicion_cedula text,
  matricula_profesional text,
  celular text,
  direccion text,
  correo_personal text,
  updated_at timestamptz default now()
);

alter table datos_personales enable row level security;

-- Los ve la propia persona, y quien tenga algún rol de equipo. Un invitado
-- —toda cuenta recién creada, por ejemplo— solo ve los suyos.
drop policy if exists "Lectura de datos personales" on datos_personales;
create policy "Lectura de datos personales" on datos_personales
  for select to authenticated
  using (user_id = auth.uid() or not es_invitado());

-- Los edita la propia persona, o el Líder de Diseño / un Desarrollador,
-- igual que antes en el perfil.
drop policy if exists "Crear datos personales" on datos_personales;
create policy "Crear datos personales" on datos_personales
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or (
      not es_invitado()
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno', 'desarrollador'))
    )
  );
drop policy if exists "Editar datos personales" on datos_personales;
create policy "Editar datos personales" on datos_personales
  for update to authenticated
  using (
    user_id = auth.uid()
    or (
      not es_invitado()
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno', 'desarrollador'))
    )
  );

-- Se pasan los datos que ya había en los perfiles y se quitan de ahí: si
-- se quedaran, cualquier cuenta los seguiría pudiendo leer.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'cedula'
  ) then
    execute $copia$
      insert into datos_personales (user_id, cedula, ciudad_expedicion_cedula, matricula_profesional, celular, direccion, correo_personal)
      select id, cedula, ciudad_expedicion_cedula, matricula_profesional, celular, direccion, correo_personal
      from profiles
      where coalesce(cedula, ciudad_expedicion_cedula, matricula_profesional, celular, direccion, correo_personal) is not null
      on conflict (user_id) do nothing
    $copia$;

    alter table profiles
      drop column if exists cedula,
      drop column if exists ciudad_expedicion_cedula,
      drop column if exists matricula_profesional,
      drop column if exists celular,
      drop column if exists direccion,
      drop column if exists correo_personal;
  end if;
end $$;

commit;
