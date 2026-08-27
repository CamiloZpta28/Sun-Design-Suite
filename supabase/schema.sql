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
  fecha_cumpleanos date,
  fecha_ingreso date,
  cedula text,
  ciudad_expedicion_cedula text,
  matricula_profesional text,
  celular text,
  direccion text,
  correo_personal text,
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

-- ---------- Funciones de guardado parcial (evitan que dos personas       ----------
-- ---------- editando el mismo proyecto a la vez se borren los cambios).  ----------
-- En vez de que la app lea todo el proyecto, lo modifique en el navegador
-- y reescriba la fila COMPLETA (lo que borraría cualquier cambio que otra
-- persona hubiera guardado mientras tanto), estas funciones hacen el
-- cambio directamente en la base de datos, tocando solo la pestaña,
-- documento, nota, archivo o rol que en verdad cambió. Así, si dos
-- personas editan cosas distintas (o incluso el mismo documento) casi al
-- mismo tiempo, ambos cambios quedan guardados.

-- Combina solo UNA pestaña/especialidad dentro de la columna "data" (ej. 'civil'),
-- sin tocar las demás pestañas que pudieran tener cambios de otra persona.
create or replace function merge_project_data_section(p_id text, p_section text, p_value jsonb)
returns void
language sql
as $$
  update projects
  set data = jsonb_set(coalesce(data, '{}'::jsonb), array[p_section], p_value, true),
      updated_at = now()
  where id = p_id;
$$;

-- Combina solo UN rol dentro de "equipo" (ej. 'civil' o 'lider_diseno'),
-- sin tocar las asignaciones de otros roles hechas por otro líder a la vez.
create or replace function merge_project_equipo_role(p_id text, p_role text, p_value jsonb)
returns void
language sql
as $$
  update projects
  set equipo = jsonb_set(coalesce(equipo, '{}'::jsonb), array[p_role], p_value, true),
      updated_at = now()
  where id = p_id;
$$;

-- Combina solo el estado/comentarios/observaciones de UN documento dentro
-- de "documentos" (ej. el código de un documento específico), sin tocar
-- los demás documentos que pudieran haber cambiado mientras tanto.
create or replace function merge_project_documento(p_id text, p_codigo text, p_patch jsonb)
returns void
language sql
as $$
  update projects
  set documentos = jsonb_set(
        coalesce(documentos, '{}'::jsonb),
        array[p_codigo],
        coalesce(documentos->p_codigo, '{}'::jsonb) || p_patch,
        true
      ),
      updated_at = now()
  where id = p_id;
$$;

-- Agrega una o varias notas nuevas al final del arreglo "notas", sin
-- reemplazar el arreglo completo (así no se pierde una nota que alguien
-- más haya agregado justo antes).
create or replace function append_project_nota(p_id text, p_nota jsonb)
returns void
language sql
as $$
  update projects
  set notas = coalesce(notas, '[]'::jsonb) || jsonb_build_array(p_nota),
      updated_at = now()
  where id = p_id;
$$;

-- Quita una nota por su id, sin tocar el resto del arreglo.
create or replace function remove_project_nota(p_id text, p_nota_id text)
returns void
language sql
as $$
  update projects
  set notas = coalesce((
        select jsonb_agg(elem) from jsonb_array_elements(coalesce(notas, '[]'::jsonb)) elem
        where elem->>'id' <> p_nota_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_id;
$$;

-- Agrega uno o varios archivos nuevos al final del arreglo "archivos".
create or replace function append_project_archivos(p_id text, p_nuevos jsonb)
returns void
language sql
as $$
  update projects
  set archivos = coalesce(archivos, '[]'::jsonb) || p_nuevos,
      updated_at = now()
  where id = p_id;
$$;

-- Quita un archivo por su id, sin tocar el resto del arreglo.
create or replace function remove_project_archivo(p_id text, p_archivo_id text)
returns void
language sql
as $$
  update projects
  set archivos = coalesce((
        select jsonb_agg(elem) from jsonb_array_elements(coalesce(archivos, '[]'::jsonb)) elem
        where elem->>'id' <> p_archivo_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_id;
$$;

grant execute on function merge_project_data_section(text, text, jsonb) to authenticated;
grant execute on function merge_project_equipo_role(text, text, jsonb) to authenticated;
grant execute on function merge_project_documento(text, text, jsonb) to authenticated;
grant execute on function append_project_nota(text, jsonb) to authenticated;
grant execute on function remove_project_nota(text, text) to authenticated;
grant execute on function append_project_archivos(text, jsonb) to authenticated;
grant execute on function remove_project_archivo(text, text) to authenticated;

create table if not exists links (
  id text primary key,
  descripcion text not null,
  url text not null,
  created_at timestamptz default now()
);

-- Instructivos: videos de YouTube (procesos de la etapa de diseño),
-- organizados en carpetas. Al borrar una carpeta se borran también sus
-- videos (on delete cascade).
create table if not exists instructivo_carpetas (
  id text primary key,
  nombre text not null,
  created_at timestamptz default now()
);

create table if not exists instructivo_videos (
  id text primary key,
  carpeta_id text references instructivo_carpetas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  url text not null,
  created_at timestamptz default now()
);

-- Lista de inversionistas (para el selector de "Inversionista" en General y
-- para saber qué lista de Control Documental usar). Cualquiera puede agregar
-- uno nuevo; queda registrado para todo el equipo. correo/telefono/nit/logo
-- son datos DEL INVERSIONISTA (no del proyecto) — se editan desde cualquier
-- proyecto que lo use, pero se reflejan en todos los demás.
create table if not exists inversionistas (
  nombre text primary key,
  correo text,
  telefono text,
  nit text,
  logo text,
  created_at timestamptz default now()
);

-- El operador de red de un proyecto (con su logo) — mismo criterio que
-- inversionistas: catálogo compartido, empieza vacío.
create table if not exists operadores_red (
  nombre text primary key,
  logo text,
  created_at timestamptz default now()
);

-- El instalador de un proyecto (con su NIT y logo). Empieza con "Solenium".
create table if not exists instaladores (
  nombre text primary key,
  nit text,
  logo text,
  created_at timestamptz default now()
);

-- Lista de países disponibles en el selector de "País" (General). Empieza
-- solo con Colombia; cualquiera puede agregar otro si se necesita para un
-- proyecto fuera del país.
create table if not exists paises (
  nombre text primary key,
  created_at timestamptz default now()
);

-- Lista de proveedores disponibles en el selector de "Proveedor" (Mecánica).
-- Empieza con Zentrack, TRINA y Antai; cualquiera puede agregar otro.
create table if not exists proveedores (
  nombre text primary key,
  created_at timestamptz default now()
);

-- Plantillas de cimentaciones reutilizables (sección "Cimentaciones" del
-- menú, separada de los proyectos). "tipo" es uno de: postes_mt,
-- luminarias, camaras, inversores, cerramiento, shelter. "datos" guarda
-- las dimensiones/despiece propios de cada tipo (estructura libre en
-- jsonb, para poder ir agregando tipos sin migrar la tabla cada vez).
create table if not exists cimentacion_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Plantillas reutilizables de equipos eléctricos (paneles, inversores,
-- transformadores, etc. — ver EQUIPO_TIPOS en src/App.jsx). A diferencia de
-- cimentacion_plantillas, aquí no hay cálculos: "datos" solo guarda
-- especificacion + atributos (texto libre) + una imagen opcional en base64.
-- Se siembra automáticamente con 68 plantillas de ejemplo la primera vez
-- que se abre la pestaña "Equipos eléctricos" (ver EQUIPO_SEED).
create table if not exists equipo_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Plantillas de canalizaciones (zanjas). "es_principal": dentro de un mismo
-- tipo solo una queda marcada como la vigente/más actualizada.
create table if not exists canalizacion_plantillas (
  id text primary key,
  tipo text not null,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  es_principal boolean not null default false,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Catálogo compartido de diámetros de tubería (en pulgadas) para las
-- plantillas de Canalizaciones. Empieza vacío; cualquiera puede agregar uno.
create table if not exists diametros_tuberia (
  nombre text primary key,
  created_at timestamptz default now()
);

-- Plantillas de "Cruces" (detalles de cruce entre 2 canalizaciones ya
-- creadas, según la Tabla 4 del documento de criterios).
create table if not exists cruce_plantillas (
  id text primary key,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- "Actualizaciones" — registro de actualizaciones de diseño por categoría
-- (global, no por proyecto). Las categorías empiezan con 6 iniciales, pero
-- cualquiera puede crear/renombrar/eliminar más desde la plataforma.
create table if not exists actualizacion_categorias (
  id text primary key,
  nombre text not null,
  orden integer default 0,
  created_at timestamptz default now()
);
create table if not exists actualizaciones (
  id text primary key,
  categoria_id text not null references actualizacion_categorias(id) on delete cascade,
  nombre text not null,
  descripcion text,
  interesados jsonb not null default '[]'::jsonb,
  ubicacion text,
  etiquetas jsonb not null default '[]'::jsonb,
  imagen text,
  creado_por text,
  created_at timestamptz default now()
);

-- Sistema de notificaciones: se generan cuando alguien más edita un
-- proyecto donde el usuario está asignado, o agrega una actualización de
-- diseño marcando como interesado un rol que el usuario tiene.
create table if not exists notificaciones (
  id text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null, -- 'proyecto' | 'actualizacion'
  mensaje text not null,
  proyecto_id text references projects(id) on delete cascade,
  actualizacion_id text references actualizaciones(id) on delete cascade,
  categoria_actualizacion_id text,
  leida boolean not null default false,
  created_at timestamptz default now()
);

-- Lista de tipos de malla electrosoldada disponibles en el selector de la
-- losa de Inversores (y de cualquier otra cimentación que use malla más
-- adelante). Empieza con D84; cualquiera puede agregar otra.
create table if not exists mallas (
  nombre text primary key,
  created_at timestamptz default now()
);

-- Constantes de ingeniería usadas en los cálculos de acero de las
-- cimentaciones (recubrimiento, ganchos y pesos por calibre, traslapos por
-- calibre/resistencia). Una sola fila global ('global'), editable solo por
-- el rol Desarrollador desde la "puerta trasera" de Cimentaciones — así se
-- pueden corregir sin necesitar un despliegue nuevo de la app.
create table if not exists parametros_ingenieria (
  id text primary key default 'global',
  datos jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
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
  categoria text default 'general',
  created_at timestamptz default now()
);

-- Ingenieros de proyectos: personas que NO tienen cuenta en la plataforma
-- (no inician sesión), pero se les asigna a un proyecto igual que cualquier
-- otro rol — solo que su "ficha" es nombre+matrícula en vez de una cuenta.
create table if not exists ingenieros_proyectos (
  nombre text primary key,
  matricula text,
  created_at timestamptz default now()
);

-- Registra la última vez que CADA usuario abrió CADA proyecto — solo para
-- poder ordenar "Mis proyectos" por el último con el que interactuó (no
-- afecta el historial de cambios de "activity_log", que es aparte).
create table if not exists project_last_view (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (usuario_id, project_id)
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
-- El Líder de Diseño (o un Desarrollador) también puede editar el perfil de
-- cualquier persona — lo necesita para poner fecha de cumpleaños/ingreso
-- desde la ficha de esa persona en "Equipo".
create policy "Lider de diseno edita cualquier perfil" on profiles
  for update using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_diseno','desarrollador')
    )
  );
-- Solo el Líder de Diseño puede eliminar cuentas de otras personas.
create policy "Solo lider de diseno elimina perfiles" on profiles
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_diseno','desarrollador')
    )
  );

create policy "Lectura de proyectos" on projects
  for select using (auth.role() = 'authenticated');
create policy "Crear proyectos" on projects
  for insert with check (auth.role() = 'authenticated');
create policy "Editar proyectos" on projects
  for update using (auth.role() = 'authenticated');
-- Solo un líder puede eliminar un proyecto.
create policy "Eliminar proyectos solo lideres" on projects
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

create policy "Lectura de enlaces" on links
  for select using (auth.role() = 'authenticated');
create policy "Crear enlaces" on links
  for insert with check (auth.role() = 'authenticated');
create policy "Editar enlaces" on links
  for update using (auth.role() = 'authenticated');
create policy "Eliminar enlaces" on links
  for delete using (auth.role() = 'authenticated');

alter table instructivo_carpetas enable row level security;
create policy "Lectura de carpetas de instructivos" on instructivo_carpetas
  for select using (auth.role() = 'authenticated');
create policy "Crear carpetas de instructivos" on instructivo_carpetas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar carpetas de instructivos" on instructivo_carpetas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar carpetas de instructivos" on instructivo_carpetas
  for delete using (auth.role() = 'authenticated');

alter table instructivo_videos enable row level security;
create policy "Lectura de videos de instructivos" on instructivo_videos
  for select using (auth.role() = 'authenticated');
create policy "Crear videos de instructivos" on instructivo_videos
  for insert with check (auth.role() = 'authenticated');
create policy "Editar videos de instructivos" on instructivo_videos
  for update using (auth.role() = 'authenticated');
create policy "Eliminar videos de instructivos" on instructivo_videos
  for delete using (auth.role() = 'authenticated');

alter table inversionistas enable row level security;
create policy "Lectura de inversionistas" on inversionistas
  for select using (auth.role() = 'authenticated');
create policy "Crear inversionistas" on inversionistas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar inversionistas" on inversionistas
  for update using (auth.role() = 'authenticated');

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

alter table paises enable row level security;
create policy "Lectura de paises" on paises
  for select using (auth.role() = 'authenticated');
create policy "Crear paises" on paises
  for insert with check (auth.role() = 'authenticated');

alter table proveedores enable row level security;
create policy "Lectura de proveedores" on proveedores
  for select using (auth.role() = 'authenticated');
create policy "Crear proveedores" on proveedores
  for insert with check (auth.role() = 'authenticated');

alter table cimentacion_plantillas enable row level security;
create policy "Lectura de plantillas de cimentacion" on cimentacion_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear plantillas de cimentacion" on cimentacion_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar plantillas de cimentacion" on cimentacion_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar plantillas de cimentacion" on cimentacion_plantillas
  for delete using (auth.role() = 'authenticated');

alter table equipo_plantillas enable row level security;
create policy "Lectura de plantillas de equipos" on equipo_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear plantillas de equipos" on equipo_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar plantillas de equipos" on equipo_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar plantillas de equipos" on equipo_plantillas
  for delete using (auth.role() = 'authenticated');

alter table canalizacion_plantillas enable row level security;
create policy "Lectura de plantillas de canalizacion" on canalizacion_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear plantillas de canalizacion" on canalizacion_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar plantillas de canalizacion" on canalizacion_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar plantillas de canalizacion" on canalizacion_plantillas
  for delete using (auth.role() = 'authenticated');

alter table diametros_tuberia enable row level security;
create policy "Lectura de diametros de tuberia" on diametros_tuberia
  for select using (auth.role() = 'authenticated');
create policy "Crear diametros de tuberia" on diametros_tuberia
  for insert with check (auth.role() = 'authenticated');

alter table cruce_plantillas enable row level security;
create policy "Lectura de cruces" on cruce_plantillas
  for select using (auth.role() = 'authenticated');
create policy "Crear cruces" on cruce_plantillas
  for insert with check (auth.role() = 'authenticated');
create policy "Editar cruces" on cruce_plantillas
  for update using (auth.role() = 'authenticated');
create policy "Eliminar cruces" on cruce_plantillas
  for delete using (auth.role() = 'authenticated');

alter table actualizacion_categorias enable row level security;
create policy "Lectura de categorias de actualizaciones" on actualizacion_categorias
  for select using (auth.role() = 'authenticated');
create policy "Crear categorias de actualizaciones" on actualizacion_categorias
  for insert with check (auth.role() = 'authenticated');
create policy "Editar categorias de actualizaciones" on actualizacion_categorias
  for update using (auth.role() = 'authenticated');
create policy "Eliminar categorias de actualizaciones" on actualizacion_categorias
  for delete using (auth.role() = 'authenticated');

alter table actualizaciones enable row level security;
create policy "Lectura de actualizaciones" on actualizaciones
  for select using (auth.role() = 'authenticated');
create policy "Crear actualizaciones" on actualizaciones
  for insert with check (auth.role() = 'authenticated');
create policy "Editar actualizaciones" on actualizaciones
  for update using (auth.role() = 'authenticated');
create policy "Eliminar actualizaciones" on actualizaciones
  for delete using (auth.role() = 'authenticated');

alter table notificaciones enable row level security;
create policy "Lectura de mis notificaciones" on notificaciones
  for select using (auth.uid() = usuario_id);
create policy "Crear notificaciones" on notificaciones
  for insert with check (auth.role() = 'authenticated');
create policy "Marcar mis notificaciones como leidas" on notificaciones
  for update using (auth.uid() = usuario_id);

alter table mallas enable row level security;
create policy "Lectura de mallas" on mallas
  for select using (auth.role() = 'authenticated');
create policy "Crear mallas" on mallas
  for insert with check (auth.role() = 'authenticated');

alter table parametros_ingenieria enable row level security;
create policy "Lectura de parametros de ingenieria" on parametros_ingenieria
  for select using (auth.role() = 'authenticated');
create policy "Solo desarrollador edita parametros de ingenieria (insert)" on parametros_ingenieria
  for insert with check (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'desarrollador')
  );
create policy "Solo desarrollador edita parametros de ingenieria (update)" on parametros_ingenieria
  for update using (
    exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'desarrollador')
  );

alter table activity_log enable row level security;

create policy "Lectura de historial" on activity_log
  for select using (auth.role() = 'authenticated');
create policy "Crear registros de historial" on activity_log
  for insert with check (auth.role() = 'authenticated');
-- A propósito no hay políticas de update/delete: el historial es inmutable.

alter table ingenieros_proyectos enable row level security;
create policy "Lectura de ingenieros de proyectos" on ingenieros_proyectos
  for select using (auth.role() = 'authenticated');
create policy "Crear ingenieros de proyectos" on ingenieros_proyectos
  for insert with check (auth.role() = 'authenticated');
create policy "Editar ingenieros de proyectos" on ingenieros_proyectos
  for update using (auth.role() = 'authenticated');

alter table project_last_view enable row level security;
create policy "Lectura de mis visitas" on project_last_view
  for select using (auth.role() = 'authenticated');
create policy "Registrar mi visita" on project_last_view
  for insert with check (auth.uid() = usuario_id);
create policy "Actualizar mi visita" on project_last_view
  for update using (auth.uid() = usuario_id);

alter table user_roles enable row level security;

create policy "Lectura de roles" on user_roles
  for select using (auth.role() = 'authenticated');

-- Cualquier líder puede otorgar/quitar roles técnicos o el de Control de
-- Calidad. Los roles de líder (incluido Líder de Diseño) solo los puede
-- otorgar o quitar el propio Líder de Diseño. Nadie puede autoasignarse
-- un rol de liderazgo desde la aplicación.
create policy "Asignar roles" on user_roles
  for insert with check (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno','desarrollador'))
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      )
    )
  );
create policy "Quitar roles" on user_roles
  for delete using (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno','desarrollador'))
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      )
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

-- ---------- Parámetros de ingeniería (recubrimiento, ganchos, pesos, traslapos) ----------

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
