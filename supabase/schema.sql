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
  -- Si sus entregas pasan por Supervisión técnica (pestaña propia en cada
  -- uno de sus proyectos).
  supervision_tecnica boolean not null default false,
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
  leida_at timestamptz, -- cuándo se leyó: la aplicación la borra un día después
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

-- ---------- Dossiers: qué documentos lleva cada proyecto ----------
-- Antes las tres listas (estándar, CFM, FENOGE) vivían en el código y se
-- elegían con un "if" por el nombre del inversionista. Ahora viven aquí y se
-- gestionan desde la sección Dossiers.
--
-- Un dossier que ya use algún proyecto NO se modifica: se duplica y se cambia
-- la copia. El motivo es que projects.documentos guarda el trabajo de cada
-- documento con el CÓDIGO como llave, así que cambiar un código dejaría ese
-- trabajo huérfano en todos los proyectos. Eso lo cuida la interfaz; lo que
-- cuida la base es la llave foránea de projects.dossier_id, que impide borrar
-- un dossier en uso.
create table if not exists dossiers (
  id text primary key,
  nombre text not null,           -- la familia: 'CFM', 'FENOGE', 'Estándar'
  version int not null default 1, -- se muestran juntos como "CFM 2"
  archivado boolean not null default false, -- deja de ofrecerse al crear proyectos
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists dossier_documentos (
  id text primary key,
  dossier_id text not null references dossiers(id) on delete cascade,
  codigo text not null,        -- con el prefijo COLXXXXXXPX, que cada proyecto reemplaza
  nombre text not null,
  especialidad text not null,
  tipo text not null,
  orden int not null default 0,
  -- Quién responde por él, por ROL: { "delineante": "E", "civil": "R" }.
  -- E = lo elabora o lo dibuja, R = lo revisa. Alimenta los resúmenes
  -- semanales. A diferencia del resto, esto SÍ se puede cambiar aunque el
  -- dossier esté en uso: no es parte de lo que el proyecto guarda.
  responsables jsonb not null default '{}'::jsonb,
  unique (dossier_id, codigo)
);

-- El dossier de un proyecto se elige al crearlo y no cambia solo. Sin
-- "on delete cascade" a propósito: Postgres debe negarse a borrar un dossier
-- que algún proyecto esté usando.
alter table projects add column if not exists dossier_id text references dossiers(id);

-- El dossier que se preselecciona al crear un proyecto de este inversionista.
-- Es una sugerencia: manda lo que quede elegido en el proyecto.
alter table inversionistas add column if not exists dossier_id text references dossiers(id);

-- ---------- Resúmenes semanales: uno por persona y por semana ----------
create table if not exists resumenes_semanales (
  -- Determinista ('resumen-<usuario>-<lunes>') para que guardar dos veces la
  -- misma semana actualice la fila en vez de crear otra.
  id text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  semana date not null,          -- el lunes de esa semana
  hasta date,                    -- último día que cubre; normalmente el viernes
  -- { "lo_mejor": [...], "pendientes": [...], "dificultades": [...], "temas": [...] }
  bloques jsonb not null default '{}'::jsonb,
  -- La foto del avance: [{ id, nombre, total, porEstado, estados, nombres, cambios, avanzaron }]
  proyectos jsonb not null default '[]'::jsonb,
  -- Borrador mientras se escribe; al marcarlo como enviado la foto se congela.
  enviado boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (usuario_id, semana)
);

-- Para la vista del equipo, que pide una semana completa de un golpe.
create index if not exists resumenes_semanales_semana_idx on resumenes_semanales (semana);

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

alter table dossiers enable row level security;
alter table dossier_documentos enable row level security;

-- Todo el mundo los ve: son la referencia de qué documentos lleva un proyecto.
create policy "Lectura de dossiers" on dossiers
  for select using (auth.role() = 'authenticated');
create policy "Lectura de documentos de dossier" on dossier_documentos
  for select using (auth.role() = 'authenticated');

-- Solo líderes y desarrolladores los tocan. Esconder los botones no basta:
-- la regla tiene que estar también aquí.
create policy "Gestionar dossiers solo lideres" on dossiers
  for all using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );
create policy "Gestionar documentos de dossier solo lideres" on dossier_documentos
  for all using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

alter table resumenes_semanales enable row level security;

-- Los lee todo el equipo: la idea es justamente poder ver en qué va cada
-- quien y que los líderes analicen su área.
create policy "Lectura de resumenes semanales" on resumenes_semanales
  for select using (auth.role() = 'authenticated');

-- Pero cada quien escribe solo el suyo. Que la pantalla no ofrezca editar el
-- ajeno no basta: la regla tiene que estar aquí.
create policy "Crear mi resumen semanal" on resumenes_semanales
  for insert with check (auth.uid() = usuario_id);

create policy "Editar mi resumen semanal" on resumenes_semanales
  for update using (auth.uid() = usuario_id);

create policy "Borrar mi resumen semanal" on resumenes_semanales
  for delete using (auth.uid() = usuario_id);

alter table notificaciones enable row level security;
create policy "Lectura de mis notificaciones" on notificaciones
  for select using (auth.uid() = usuario_id);
create policy "Crear notificaciones" on notificaciones
  for insert with check (auth.role() = 'authenticated');
create policy "Marcar mis notificaciones como leidas" on notificaciones
  for update using (auth.uid() = usuario_id);
create policy "Borrar mis notificaciones" on notificaciones
  for delete using (auth.uid() = usuario_id);

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

-- ---------- Semilla: los tres dossiers que existían en el código ----------
-- Son exactamente las listas que la aplicación traía adentro, así que el día
-- que esto entra, en pantalla no cambia nada. Los responsables vienen con un
-- BORRADOR hecho con reglas gruesas (lo civil al ing. civil, los planos los
-- dibuja el delineante y los revisa el ingeniero de la especialidad, las
-- memorias de cimentación al estructural, inundabilidad y drenaje al
-- hidráulico, suelos y CBR al geotécnico). Está para corregirse desde la
-- sección Dossiers, no para darse por bueno.
insert into dossiers (id, nombre, version, archivado) values
  ('dossier-estandar-1', 'Estándar', 1, false),
  ('dossier-cfm-1', 'CFM', 1, false),
  ('dossier-fenoge-1', 'FENOGE', 1, false)
on conflict (id) do nothing;

insert into dossier_documentos (id, dossier_id, codigo, nombre, especialidad, tipo, orden, responsables) values
  ('doc-estandar-001', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-001', 'Layout General', 'CIVIL', 'Plano', 0, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-002', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-002', 'Topografia', 'CIVIL', 'Plano', 1, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-003', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-003', 'Vías de acceso', 'CIVIL', 'Plano', 2, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-004', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-004', 'Canalizaciones y redes', 'CIVIL', 'Plano', 3, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-005', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-005', 'Cerramiento', 'CIVIL', 'Plano', 4, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-006', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-006', 'Cortes en mesas', 'CIVIL', 'Plano', 5, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-007', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-007', 'Cimentaciones de Shelter', 'CIVIL', 'Plano', 6, '{"estructural": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-008', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-PL-008', 'Obras de drenaje (si aplica)', 'CIVIL', 'Plano', 7, '{"hidraulico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-009', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-001', 'Análisis de inundabilidad', 'CIVIL', 'Informe', 8, '{"hidraulico": "E"}'::jsonb),
  ('doc-estandar-010', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-002', 'Estudio de suelos', 'CIVIL', 'Informe', 9, '{"geotecnico": "E"}'::jsonb),
  ('doc-estandar-011', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-003', 'Topografía general', 'CIVIL', 'Informe', 10, '{"civil": "E"}'::jsonb),
  ('doc-estandar-012', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-004', 'Diseño Vial', 'CIVIL', 'Informe', 11, '{"civil": "E"}'::jsonb),
  ('doc-estandar-013', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-005', 'Cimentaciones de cerramiento', 'CIVIL', 'Informe', 12, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-014', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-006', 'Cimentaciones de inversores', 'CIVIL', 'Informe', 13, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-015', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-007', 'Cimentaciones Camaras - CCTV', 'CIVIL', 'Informe', 14, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-016', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-008', 'Cimentaciones luminarias', 'CIVIL', 'Informe', 15, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-017', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-INF-009', 'Cimentaciones de Shelter', 'CIVIL', 'Informe', 16, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-018', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-ESP-001', 'ET para estudio de suelos', 'CIVIL', 'Especificaciones tecnicas', 17, '{"geotecnico": "E"}'::jsonb),
  ('doc-estandar-019', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-ESP-002', 'ET para Topografía', 'CIVIL', 'Especificaciones tecnicas', 18, '{"civil": "E"}'::jsonb),
  ('doc-estandar-020', 'dossier-estandar-1', 'COLXXXXXXPX-CIV-LIS-001', 'Listado de obras y cantidades civiles', 'CIVIL', 'Listado', 19, '{"civil": "E"}'::jsonb),
  ('doc-estandar-021', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-LIS-001', 'BOM de estructura de módulos', 'MECANICA', 'Listado', 20, '{"civil": "E"}'::jsonb),
  ('doc-estandar-022', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-PL-001', 'Estructura Inversores', 'MECANICA', 'Plano', 21, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-023', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-PL-002', 'Estructura de módulos', 'MECANICA', 'Plano', 22, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-024', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-ESP-001', 'Ficha técnica estructura de paneles', 'MECANICA', 'Especificaciones tecnicas', 23, '{"civil": "E"}'::jsonb),
  ('doc-estandar-025', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-INF-001', 'Procedimiento de montaje', 'MECANICA', 'Informe', 24, '{"civil": "E"}'::jsonb),
  ('doc-estandar-026', 'dossier-estandar-1', 'COLXXXXXXPX-MEC-INF-002', 'Memoria de estructura de módulos y cimentación', 'MECANICA', 'Informe', 25, '{"estructural": "E"}'::jsonb),
  ('doc-estandar-027', 'dossier-estandar-1', 'COLXXXXXXPX-COM-LIS-001', 'BOM de comunicaciones', 'COMUNICACIONES', 'Listado', 26, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-028', 'dossier-estandar-1', 'COLXXXXXXPX-COM-LIS-002', 'Listado de obras de comunicación', 'COMUNICACIONES', 'Listado', 27, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-029', 'dossier-estandar-1', 'COLXXXXXXPX-COM-LIS-003', 'Listado de cables (Tags)', 'COMUNICACIONES', 'Listado', 28, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-030', 'dossier-estandar-1', 'COLXXXXXXPX-COM-LIS-004', 'Inventario de equipos', 'COMUNICACIONES', 'Listado', 29, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-031', 'dossier-estandar-1', 'COLXXXXXXPX-COM-INF-001', 'Informe de Comunicaciones', 'COMUNICACIONES', 'Informe', 30, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-032', 'dossier-estandar-1', 'COLXXXXXXPX-COM-PL-001', 'Arquitectura', 'COMUNICACIONES', 'Plano', 31, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-033', 'dossier-estandar-1', 'COLXXXXXXPX-COM-PL-002', 'Diagrama de conexiones', 'COMUNICACIONES', 'Plano', 32, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-034', 'dossier-estandar-1', 'COLXXXXXXPX-COM-PL-003', 'Comunicacion Inversores y ruta_CCTV', 'COMUNICACIONES', 'Plano', 33, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-035', 'dossier-estandar-1', 'COLXXXXXXPX-COM-PL-004', 'Cobertura de Camaras', 'COMUNICACIONES', 'Plano', 34, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-036', 'dossier-estandar-1', 'COLXXXXXXPX-COM-ESP-001', 'Ficha técnica de CCTV (Camaras, NVR)', 'COMUNICACIONES', 'Especificaciones tecnicas', 35, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-037', 'dossier-estandar-1', 'COLXXXXXXPX-COM-ESP-002', 'Ficha técnica de estación meteorológica', 'COMUNICACIONES', 'Especificaciones tecnicas', 36, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-038', 'dossier-estandar-1', 'COLXXXXXXPX-COM-ESP-003', 'Ficha técnica Equipos de Comunicaciones (Smartlogger, medidor, router, switch, starlink, AccessPoint)', 'COMUNICACIONES', 'Especificaciones tecnicas', 37, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-039', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-LIS-001', 'BOM eléctrico', 'ELECTRICA', 'Listado', 38, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-040', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-LIS-002', 'Listado de obras eléctrias', 'ELECTRICA', 'Listado', 39, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-041', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-LIS-003', 'Listado de Strings', 'ELECTRICA', 'Listado', 40, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-042', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-MEM-001', 'SSAA y respaldo', 'ELECTRICA', 'Memoria', 41, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-043', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-MEM-002', 'Cargabilidad CT´s y PT´s', 'ELECTRICA', 'Memoria', 42, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-044', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-001', 'Documento OR', 'ELECTRICA', 'Informe', 43, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-045', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-002', 'Declaración RETIE Diseñador y Constructor', 'ELECTRICA', 'Informe', 44, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-046', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-003', 'Proyecto especifico', 'ELECTRICA', 'Informe', 45, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-047', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-004', 'Coordinación de aislamiento', 'ELECTRICA', 'Informe', 46, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-048', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-005', 'Apantallamiento', 'ELECTRICA', 'Informe', 47, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-049', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-006', 'Riesgo Electrico', 'ELECTRICA', 'Informe', 48, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-050', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-007', 'Simulación PVsyst', 'ELECTRICA', 'Informe', 49, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-051', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-008', 'Sistema de puesta a tierra', 'ELECTRICA', 'Informe', 50, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-052', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-009', 'Arco eléctrico', 'ELECTRICA', 'Informe', 51, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-053', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-010', 'Estudio de conexión simplificado', 'ELECTRICA', 'Informe', 52, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-054', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-INF-011', 'Coordinación de protecciones B.T.', 'ELECTRICA', 'Informe', 53, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-055', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-001', 'Cableado DC', 'ELECTRICA', 'Plano', 54, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-056', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-002', 'Rutas DC Inversores', 'ELECTRICA', 'Plano', 55, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-057', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-003', 'Rutas AC BT/MT', 'ELECTRICA', 'Plano', 56, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-058', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-004', 'Diagrama Unifilar', 'ELECTRICA', 'Plano', 57, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-059', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-005', 'Sistema de puesta a tierra', 'ELECTRICA', 'Plano', 58, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-060', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-006', 'Conexion inversores', 'ELECTRICA', 'Plano', 59, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-061', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-007', 'Apantallamiento', 'ELECTRICA', 'Plano', 60, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-062', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-008', 'Distribución de equipos en SHELTER', 'ELECTRICA', 'Plano', 61, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-063', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-009', 'Tablero de frontera', 'ELECTRICA', 'Plano', 62, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-064', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-010', 'Servicios auxiliares en S/E', 'ELECTRICA', 'Plano', 63, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-065', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-PL-011', 'Tableros de baja tensión en S/E', 'ELECTRICA', 'Plano', 64, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-estandar-066', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-001', 'Ficha Técnica de Inversores', 'ELECTRICA', 'Especificaciones tecnicas', 65, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-067', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-002', 'Ficha Técnica de Paneles', 'ELECTRICA', 'Especificaciones tecnicas', 66, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-068', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-003', 'Ficha Técnica de Transformador', 'ELECTRICA', 'Especificaciones tecnicas', 67, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-069', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-004', 'Ficha Técnica del Shelter', 'ELECTRICA', 'Especificaciones tecnicas', 68, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-070', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-005', 'Ficha Técnica de Reconectador y Relé', 'ELECTRICA', 'Especificaciones tecnicas', 69, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-071', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-006', 'Ficha Técnica de TC y TP', 'ELECTRICA', 'Especificaciones tecnicas', 70, '{"electrico": "E"}'::jsonb),
  ('doc-estandar-072', 'dossier-estandar-1', 'COLXXXXXXPX-ELE-ESP-007', 'Ficha Técnica de Cableado DC, AC de BT y MT', 'ELECTRICA', 'Especificaciones tecnicas', 71, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-001', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-PL-001', 'Layout general del proyecto', 'GENERAL', 'Plano', 0, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-002', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-PL-002', 'Layout ubicación geografica del proyecto', 'GENERAL', 'Plano', 1, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-003', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-PL-003', 'Layout planta de instalaciones provisionales', 'GENERAL', 'Plano', 2, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-004', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-PL-004', 'Layout vías de acceso y salida circuito', 'GENERAL', 'Plano', 3, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-005', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-INF-001', 'Informe de visita - equipo de ingenieria', 'GENERAL', 'Informe', 4, '{"civil": "E", "electrico": "E"}'::jsonb),
  ('doc-cfm-006', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-INF-002', 'Estudio de ajuste y coordinación de protecciones', 'GENERAL', 'Informe', 5, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-007', 'dossier-cfm-1', 'COLXXXXXXPX-GEN-PL-005', 'Plano de señalizaciones y sistemas contra incendios', 'GENERAL', 'Plano', 6, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-008', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-001', 'Estudio geotecnico', 'CIVIL', 'Informe', 7, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-009', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-002', 'Estudio de CBR - vías', 'CIVIL', 'Informe', 8, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-010', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-003', 'Estudio de corrosividad', 'CIVIL', 'Informe', 9, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-011', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-004', 'Estudio de interferencia Catódica (Si aplica)', 'CIVIL', 'Informe', 10, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-012', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-ESP-001', 'Protocolo Pull Out - Proveedor de Estrructura', 'CIVIL', 'Especificaciones tecnicas', 11, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-013', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-005', 'Informe Pull Out', 'CIVIL', 'Informe', 12, '{"geotecnico": "E"}'::jsonb),
  ('doc-cfm-014', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-001', 'Layout Ubicación de las Pull Out Test', 'CIVIL', 'Plano', 13, '{"geotecnico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-015', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-006', 'Informe topográfico', 'CIVIL', 'Informe', 14, '{"civil": "E"}'::jsonb),
  ('doc-cfm-016', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-002', 'Plano o levantamiento topografico (con ortofoto)', 'CIVIL', 'Plano', 15, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-017', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-007', 'Estudio de resistividad electrica', 'CIVIL', 'Informe', 16, '{"civil": "E"}'::jsonb),
  ('doc-cfm-018', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-008', 'Estudio de hidrologia', 'CIVIL', 'Informe', 17, '{"hidraulico": "E"}'::jsonb),
  ('doc-cfm-019', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-003', 'Layout Movimiento de Tierra (con secciones por fila de mesas)', 'CIVIL', 'Plano', 18, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-020', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-009', 'Informe Movimiento de Tierra (Cantidades de corte y relleno)', 'CIVIL', 'Informe', 19, '{"civil": "E"}'::jsonb),
  ('doc-cfm-021', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-MEM-001', 'Memoria Descriptiva Vías (Incluye Materiales tipo Invias)', 'CIVIL', 'Memoria', 20, '{"civil": "E"}'::jsonb),
  ('doc-cfm-022', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-004', 'Layout de Vías - Planta General', 'CIVIL', 'Plano', 21, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-023', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-005', 'Plano de Vías - Perfiles y secciones transversales', 'CIVIL', 'Plano', 22, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-024', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-LIS-001', 'Cantidades de Material - Vías', 'CIVIL', 'Lista de materiales', 23, '{"civil": "E"}'::jsonb),
  ('doc-cfm-025', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-INF-0010', 'Informe Vía de Acceso - Adecuación de Ingreso', 'CIVIL', 'Informe', 24, '{"civil": "E"}'::jsonb),
  ('doc-cfm-026', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-006', 'Layout Vía de Acceso - Adecuación de Ingreso', 'CIVIL', 'Plano', 25, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-027', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-MEM-002', 'Memoria Descriptiva y Cálculo de Cerramiento', 'CIVIL', 'Memoria', 26, '{"civil": "E"}'::jsonb),
  ('doc-cfm-028', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-007', 'Plano Cerramiento Perimetral y Accesos - General y Detalles', 'CIVIL', 'Plano', 27, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-029', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-008', 'Plano Cajas con Despieces y Zanjas Eléctricas - Detalles Generales', 'CIVIL', 'Plano', 28, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-030', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-MEM-005', 'Memoria de cálculo de cajas y zanjas (Si aplica, en casos de que se modifique el diseño original del OR por condiciones del terreno)', 'CIVIL', 'Memoria', 29, '{"civil": "E"}'::jsonb),
  ('doc-cfm-031', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-009', 'Plano Cimentación Equipos y Despieces (CTs)', 'CIVIL', 'Plano', 30, '{"estructural": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-032', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-MEM-003', 'Memoria de Cálculo Cimentaciones (CTs)', 'CIVIL', 'Memoria', 31, '{"estructural": "E"}'::jsonb),
  ('doc-cfm-033', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-MEM-004', 'Memoria Cálculo Drenaje Aguas Lluvias (si aplica)', 'CIVIL', 'Memoria', 32, '{"hidraulico": "E"}'::jsonb),
  ('doc-cfm-034', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-010', 'Plano de Drenaje Aguas Lluvias - General y Detalles (Si aplica)', 'CIVIL', 'Plano', 33, '{"hidraulico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-035', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-PL-011', 'Plano Superposición de Zanjas, Vías, Drenajes y Cimentaciones.', 'CIVIL', 'Plano', 34, '{"hidraulico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-036', 'dossier-cfm-1', 'COLXXXXXXPX-CIV-LIS-002', 'Listado de obras civiles', 'CIVIL', 'Lista de materiales', 35, '{"civil": "E"}'::jsonb),
  ('doc-cfm-037', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-PL-001', 'Plano Esquemático Estructura de Mesas de Paneles', 'MECANICA', 'Plano', 36, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-038', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-MEM-001', 'Memoria de Cálculo Estructura de Mesas - Entregados por el Proveedor', 'MECANICA', 'Memoria', 37, '{"civil": "E"}'::jsonb),
  ('doc-cfm-039', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-PL-002', 'Plano Ubicación de Hincas - Estructura de Mesas de Paneles', 'MECANICA', 'Plano', 38, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-040', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-LIS-001', 'Listado de Elementos de Mesas de Paneles - Entregado por el Proveedor', 'MECANICA', 'Lista de materiales', 39, '{"civil": "E"}'::jsonb),
  ('doc-cfm-041', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-ESP-001', 'Ficha Técnica de Estructura de Mesas de Paneles', 'MECANICA', 'Especificaciones tecnicas', 40, '{"civil": "E"}'::jsonb),
  ('doc-cfm-042', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-PL-003', 'Plano Esquemático Estructura de Inversores', 'MECANICA', 'Plano', 41, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-043', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-MEM-002', 'Memoria de Cálculo Estructura de Inversores - Entregados por el Proveedor', 'MECANICA', 'Memoria', 42, '{"civil": "E"}'::jsonb),
  ('doc-cfm-044', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-LIS-002', 'Listado de Elementos de Estructura Inversores - Entregado por el Proveedor', 'MECANICA', 'Lista de materiales', 43, '{"civil": "E"}'::jsonb),
  ('doc-cfm-045', 'dossier-cfm-1', 'COLXXXXXXPX-MEC-ESP-002', 'Ficha Técnica de Estructura de Inversores', 'MECANICA', 'Especificaciones tecnicas', 44, '{"civil": "E"}'::jsonb),
  ('doc-cfm-046', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-MEM-001', 'Memoria de Cálculo Eléctrica', 'ELECTRICA', 'Memoria', 45, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-047', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-001', 'Esquema Unifilar General PSFV', 'ELECTRICA', 'Plano', 46, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-048', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-INF-001', 'Simulación de Generación PVSyst (PDF y ZIP)', 'ELECTRICA', 'Informe', 47, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-049', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-001', 'Ficha Técnica Panel con Certificado RETIE', 'ELECTRICA', 'Especificaciones tecnicas', 48, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-050', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-002', 'Ficha Técnica Inversor', 'ELECTRICA', 'Especificaciones tecnicas', 49, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-051', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-003', 'Manual de Instalación del Inversor', 'ELECTRICA', 'Especificaciones tecnicas', 50, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-052', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-004', 'Certificados del Inversor', 'ELECTRICA', 'Especificaciones tecnicas', 51, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-053', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-002', 'Diagrama Constructivo del Inversor', 'ELECTRICA', 'Plano', 52, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-054', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-003', 'Detalle Conexionado del Inversor', 'ELECTRICA', 'Plano', 53, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-055', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-MEM-002', 'Memoria de Cálculo Red MT (Línea o Subterráneo)', 'ELECTRICA', 'Memoria', 54, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-056', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-004', 'Plano de Planta Red MT y Cámaras de Inspección', 'ELECTRICA', 'Plano', 55, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-057', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-005', 'Ficha Técnica Centro de Transformación', 'ELECTRICA', 'Especificaciones tecnicas', 56, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-058', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-005', 'Detalle Conexionado del Centro de Transformación', 'ELECTRICA', 'Plano', 57, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-059', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-006', 'Manual del Centro de Transformación', 'ELECTRICA', 'Especificaciones tecnicas', 58, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-060', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-006', 'Planos Centro de Transformación - Proveedor o Fabricante', 'ELECTRICA', 'Plano', 59, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-061', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-MEM-003', 'Memoria de Cálculo Red BT DC y AC', 'ELECTRICA', 'Memoria', 60, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-062', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-007', 'Plano de Planta Red BT DC y AC y Cámaras de Inspección', 'ELECTRICA', 'Plano', 61, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-063', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-INF-002', 'Estudio Sistema Puesta Tierra', 'ELECTRICA', 'Informe', 62, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-064', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-008', 'Plano Sistema Puesta Tierra', 'ELECTRICA', 'Plano', 63, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-065', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-009', 'Plano Apantallamiento Equipos Mayores', 'ELECTRICA', 'Plano', 64, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-066', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-001', 'Listado de Cables DC, AC BT y AC MT', 'ELECTRICA', 'Lista de materiales', 65, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-067', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-010', 'Detalle Conexión Paneles Solares y Mesas', 'ELECTRICA', 'Plano', 66, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-068', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-011', 'Detalle Conexión Inversores y Strings', 'ELECTRICA', 'Plano', 67, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-069', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-012', 'Ubicación de Tableros AC y SSAA', 'ELECTRICA', 'Plano', 68, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-070', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-013', 'Esquema Unifilar Tableros AC y SSAA', 'ELECTRICA', 'Plano', 69, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-071', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-014', 'Detalle Conexionado Tableros AC y SSAA', 'ELECTRICA', 'Plano', 70, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-072', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-015', 'Plano Distribución Shelter y Listado de Materiales Tableros AC y SSAA', 'ELECTRICA', 'Plano', 71, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-073', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-007', 'Fichas Técnicas Celdas MT - SHELTER', 'ELECTRICA', 'Especificaciones tecnicas', 72, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-074', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-007', 'Listado de obras eléctricas', 'ELECTRICA', 'Lista de materiales', 73, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-075', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-002', 'FORMATO 1 - SOLICITUD PARA INCENTIVOS A LA INVERSIÓN EN PROYECTOS DE FNCE', 'ELECTRICA', 'Lista de materiales', 74, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-076', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-003', 'FORMATO 2 - GENERALIDADES DEL PROYECTO DE FNCE', 'ELECTRICA', 'Lista de materiales', 75, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-077', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-004', 'FORMATO 3 - ESPECIFICACIONES DE ELEMENTOS, EQUIPOS Y/O MAQUINARIA', 'ELECTRICA', 'Lista de materiales', 76, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-078', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-005', 'FORMATO 4 - ESPECIFICACIONES DE SERVICIOS', 'ELECTRICA', 'Lista de materiales', 77, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-079', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-006', 'Certificados de Conformidad Equipos UPME', 'ELECTRICA', 'Lista de materiales', 78, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-080', 'dossier-cfm-1', 'COLXXXXXXPX-COM-PL-001', 'Arquitectura de Comunicaciones', 'COMUNICACIONES', 'Plano', 79, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-081', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-001', 'Especificaciones Técnicas Equipos comunicación', 'COMUNICACIONES', 'Especificaciones tecnicas', 80, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-082', 'dossier-cfm-1', 'COLXXXXXXPX-COM-LIS-001', 'Listado de Elementos comunicación', 'COMUNICACIONES', 'Lista de materiales', 81, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-083', 'dossier-cfm-1', 'COLXXXXXXPX-COM-LIS-002', 'Listado de señales', 'COMUNICACIONES', 'Lista de materiales', 82, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-084', 'dossier-cfm-1', 'COLXXXXXXPX-COM-MEM-001', 'Memoria Descriptiva comunicaciones', 'COMUNICACIONES', 'Memoria', 83, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-085', 'dossier-cfm-1', 'COLXXXXXXPX-COM-PL-002', 'Plano Constructivo y Conexionado Rack comunicacione', 'COMUNICACIONES', 'Plano', 84, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-086', 'dossier-cfm-1', 'COLXXXXXXPX-COM-INF-001', 'Protocolo SAT comunicaciones', 'COMUNICACIONES', 'Informe', 85, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-087', 'dossier-cfm-1', 'COLXXXXXXPX-COM-PL-003', 'Plano de Ruta Cableado Comunicaciones', 'COMUNICACIONES', 'Plano', 86, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-088', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-002', 'Ficha Técnica Fibra Óptica o UTP', 'COMUNICACIONES', 'Especificaciones tecnicas', 87, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-089', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-003', 'Ficha Técnica Smart Logger', 'COMUNICACIONES', 'Especificaciones tecnicas', 88, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-090', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-004', 'Manual Smart Logger', 'COMUNICACIONES', 'Especificaciones tecnicas', 89, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-091', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-ESP-008', 'Especificaciones Técnicas equipos EEMM (Equipos Electrico de Maniobra y Medida)', 'ELECTRICA', 'Especificaciones tecnicas', 90, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-092', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-LIS-008', 'Listado de Equipos y accesorios de montaje', 'ELECTRICA', 'Lista de materiales', 91, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-093', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-INF-003', 'Protocolo SAT Equipos EM', 'ELECTRICA', 'Informe', 92, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-094', 'dossier-cfm-1', 'COLXXXXXXPX-ELE-PL-016', 'Montaje Equipos Meteorologicos', 'ELECTRICA', 'Plano', 93, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-095', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-005', 'Especificación Técnica Sistema de seguridad', 'COMUNICACIONES', 'Especificaciones tecnicas', 94, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-096', 'dossier-cfm-1', 'COLXXXXXXPX-COM-PL-004', 'Planta General y Detalles Equipos de Seguridad', 'COMUNICACIONES', 'Plano', 95, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-cfm-097', 'dossier-cfm-1', 'COLXXXXXXPX-COM-LIS-003', 'Listado de Señales Equipos de Seguridad', 'COMUNICACIONES', 'Lista de materiales', 96, '{"electrico": "E"}'::jsonb),
  ('doc-cfm-098', 'dossier-cfm-1', 'COLXXXXXXPX-COM-ESP-006', 'Ficha Técnica equipos sistema de seguridad', 'COMUNICACIONES', 'Especificaciones tecnicas', 97, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-001', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-LIS-001', 'Listado de cables AC y DC (con tags)', 'ELECTRICA', 'Listado', 0, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-002', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-LIS-002', 'BOM eléctrico', 'ELECTRICA', 'Listado', 1, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-003', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-LIS-003', 'Listado de obras eléctrias', 'ELECTRICA', 'Listado', 2, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-004', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-MEM-001', 'SSAA y respaldo', 'ELECTRICA', 'Memoria', 3, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-005', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-MEM-002', 'Sistema de puesta a tierra', 'ELECTRICA', 'Memoria', 4, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-006', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-MEM-003', 'Distancias mínimas y de seguridad', 'ELECTRICA', 'Memoria', 5, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-007', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-MEM-004', 'Cargabilidad CT´s y PT´s', 'ELECTRICA', 'Memoria', 6, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-008', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-001', 'Documento OR', 'ELECTRICA', 'Informe', 7, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-009', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-002', 'RETIE', 'ELECTRICA', 'Informe', 8, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-010', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-003', 'Proyecto especifico', 'ELECTRICA', 'Informe', 9, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-011', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-004', 'Etiqueta de cables', 'ELECTRICA', 'Informe', 10, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-012', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-005', 'Criterios de seleccion de MPPT', 'ELECTRICA', 'Informe', 11, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-013', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-006', 'Coordinación de aislamiento', 'ELECTRICA', 'Informe', 12, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-014', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-007', 'Apantallamiento', 'ELECTRICA', 'Informe', 13, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-015', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-008', 'Riesgo Electrico', 'ELECTRICA', 'Informe', 14, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-016', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-009', 'Simulación PVsyst', 'ELECTRICA', 'Informe', 15, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-017', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-010', 'Sistema de puesta a tierra', 'ELECTRICA', 'Informe', 16, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-018', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-INF-011', 'Arco eléctrico', 'ELECTRICA', 'Informe', 17, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-019', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-001', 'Disposición física', 'ELECTRICA', 'Plano', 18, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-020', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-002', 'Cableado DC', 'ELECTRICA', 'Plano', 19, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-021', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-003', 'Rutas DC-AC-MT', 'ELECTRICA', 'Plano', 20, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-022', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-004', 'Rutas DC Inversores', 'ELECTRICA', 'Plano', 21, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-023', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-005', 'Rutas ACBT-MT y AÉREA', 'ELECTRICA', 'Plano', 22, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-024', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-006', 'Diagrama Unifilar', 'ELECTRICA', 'Plano', 23, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-025', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-007', 'Diagrama unifilar SSAA', 'ELECTRICA', 'Plano', 24, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-026', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-008', 'Sistema de puesta a tierra', 'ELECTRICA', 'Plano', 25, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-027', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-009', 'Ruta de Evacuación', 'ELECTRICA', 'Plano', 26, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-028', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-001', 'Estructura Inversores', 'CIVIL', 'Plano', 27, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-029', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-010', 'Conexion inversores', 'ELECTRICA', 'Plano', 28, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-030', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-011', 'Apantallamiento', 'ELECTRICA', 'Plano', 29, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-031', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-012', 'Distribución de equipos en SHELTER', 'ELECTRICA', 'Plano', 30, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-032', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-013', 'Celda Frontera o medidor', 'ELECTRICA', 'Plano', 31, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-033', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-014', 'Soporte de bandeja en Inversores', 'ELECTRICA', 'Plano', 32, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-034', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-PL-015', 'Plano de diseño de la red MT', 'ELECTRICA', 'Plano', 33, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-035', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-001', 'Ficha Técnica de Inversores', 'ELECTRICA', 'Especificaciones tecnicas', 34, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-036', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-002', 'Ficha Técnica de Medidor', 'ELECTRICA', 'Especificaciones tecnicas', 35, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-037', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-003', 'Ficha Técnica de Paneles', 'ELECTRICA', 'Especificaciones tecnicas', 36, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-038', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-004', 'Ficha Técnica de Transformador', 'ELECTRICA', 'Especificaciones tecnicas', 37, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-039', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-005', 'Ficha Técnica de Tableros', 'ELECTRICA', 'Especificaciones tecnicas', 38, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-040', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-006', 'Ficha Técnica de Reconectador', 'ELECTRICA', 'Especificaciones tecnicas', 39, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-041', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-007', 'Ficha Técnica de TC y TP', 'ELECTRICA', 'Especificaciones tecnicas', 40, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-042', 'dossier-fenoge-1', 'COLXXXXXXPX-ELE-ESP-008', 'Ficha Técnica de Tracker', 'ELECTRICA', 'Especificaciones tecnicas', 41, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-043', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-LIS-001', 'BOM de comunicaciones', 'COMUNICACIONES', 'Listado', 42, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-044', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-LIS-002', 'Listado de obras de comunicación', 'COMUNICACIONES', 'Listado', 43, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-045', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-LIS-003', 'Listado de cables (Tags)', 'COMUNICACIONES', 'Listado', 44, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-046', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-LIS-004', 'Inventario de equipos', 'COMUNICACIONES', 'Listado', 45, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-047', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-LIS-005', 'Listado de señales', 'COMUNICACIONES', 'Listado', 46, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-048', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-INF-001', 'Comunicaciones', 'COMUNICACIONES', 'Informe', 47, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-049', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-PL-001', 'Arquitectura', 'COMUNICACIONES', 'Plano', 48, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-050', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-PL-002', 'Diagrama de conexiones', 'COMUNICACIONES', 'Plano', 49, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-051', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-PL-003', 'Comunicacion Inversores y ruta_CCTV', 'COMUNICACIONES', 'Plano', 50, '{"electrico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-052', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-001', 'Ficha técnica de camaras', 'COMUNICACIONES', 'Especificaciones tecnicas', 51, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-053', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-002', 'Ficha técnica de camaras en S/E', 'COMUNICACIONES', 'Especificaciones tecnicas', 52, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-054', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-003', 'Ficha técnica de smartlogger', 'COMUNICACIONES', 'Especificaciones tecnicas', 53, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-055', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-004', 'Ficha técnica de estación meteorológica', 'COMUNICACIONES', 'Especificaciones tecnicas', 54, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-056', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-005', 'Ficha técnica de medidor', 'COMUNICACIONES', 'Especificaciones tecnicas', 55, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-057', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-006', 'Ficha técnica de router', 'COMUNICACIONES', 'Especificaciones tecnicas', 56, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-058', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-007', 'Ficha técnica de switch', 'COMUNICACIONES', 'Especificaciones tecnicas', 57, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-059', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-008', 'Ficha técnica de camaras', 'COMUNICACIONES', 'Especificaciones tecnicas', 58, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-060', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-009', 'Ficha técnica de NVR', 'COMUNICACIONES', 'Especificaciones tecnicas', 59, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-061', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-010', 'Ficha técnica de starlink', 'COMUNICACIONES', 'Especificaciones tecnicas', 60, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-062', 'dossier-fenoge-1', 'COLXXXXXXPX-COM-ESP-011', 'Ficha técnica de AccessPoint', 'COMUNICACIONES', 'Especificaciones tecnicas', 61, '{"electrico": "E"}'::jsonb),
  ('doc-fenoge-063', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-002', 'Localizaciones y accesos', 'CIVIL', 'Plano', 62, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-064', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-003', 'Topografia del terreno', 'CIVIL', 'Plano', 63, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-065', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-004', 'Fijaciones mecánicas', 'CIVIL', 'Plano', 64, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-066', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-005', 'Caminos internos y vías perimetrales', 'CIVIL', 'Plano', 65, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-067', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-006', 'Áreas de circulación en el proyecto', 'CIVIL', 'Plano', 66, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-068', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-007', 'Canalizaciones de Baja y Media tensión; Redes', 'CIVIL', 'Plano', 67, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-069', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-008', 'Cerramiento y Especificaciones generales', 'CIVIL', 'Plano', 68, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-070', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-009', 'Cortes en mesas', 'CIVIL', 'Plano', 69, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-071', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-010', 'Cimentaciones de Shelter', 'CIVIL', 'Plano', 70, '{"estructural": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-072', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-011', 'Arquitectonico Shelter', 'CIVIL', 'Plano', 71, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-073', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-012', 'Plano de obras hidráulicas (Si aplica)', 'CIVIL', 'Plano', 72, '{"hidraulico": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-074', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-PL-013', 'Movimientos de tierras (si aplica)', 'CIVIL', 'Plano', 73, '{"civil": "R", "delineante": "E"}'::jsonb),
  ('doc-fenoge-075', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-INF-001', 'Informe hidrológico', 'CIVIL', 'Informe', 74, '{"hidraulico": "E"}'::jsonb),
  ('doc-fenoge-076', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-INF-002', 'Informe hidráulico (Si aplica)', 'CIVIL', 'Informe', 75, '{"hidraulico": "E"}'::jsonb),
  ('doc-fenoge-077', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-INF-003', 'Estudio de suelos', 'CIVIL', 'Informe', 76, '{"geotecnico": "E"}'::jsonb),
  ('doc-fenoge-078', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-INF-004', 'Topografía general', 'CIVIL', 'Informe', 77, '{"civil": "E"}'::jsonb),
  ('doc-fenoge-079', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-INF-005', 'Manual de instalación del tracker', 'CIVIL', 'Informe', 78, '{"civil": "E"}'::jsonb),
  ('doc-fenoge-080', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-ESP-001', 'ET para estudio de suelos', 'CIVIL', 'Especificaciones tecnicas', 79, '{"geotecnico": "E"}'::jsonb),
  ('doc-fenoge-081', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-ESP-002', 'ET para Topografía', 'CIVIL', 'Especificaciones tecnicas', 80, '{"civil": "E"}'::jsonb),
  ('doc-fenoge-082', 'dossier-fenoge-1', 'COLXXXXXXPX-CIV-LIS-001', 'Listado de obras y cantidades civiles', 'CIVIL', 'Listado', 81, '{"civil": "E"}'::jsonb),
  ('doc-fenoge-083', 'dossier-fenoge-1', 'COLXXXXXXPX-GEN-INF-001', 'Analisis de riesgo contra incendios (Si aplica)', 'GENERAL', 'Informe', 82, '{"civil": "E", "electrico": "E"}'::jsonb),
  ('doc-fenoge-084', 'dossier-fenoge-1', 'COLXXXXXXPX-GEN-PL-001', 'Sistema de detección de incendios (Si aplica)', 'GENERAL', 'Plano', 83, '{"civil": "R", "electrico": "R", "delineante": "E"}'::jsonb)
on conflict (id) do nothing;
