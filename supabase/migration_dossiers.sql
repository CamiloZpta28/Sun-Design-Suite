-- =============================================================
-- Sun Design Suite · Migración: los dossiers salen del código
--
-- Crea las tablas de dossiers, las siembra con las tres listas de documentos
-- que hasta ahora vivían dentro de la aplicación (estándar, CFM y FENOGE, 254
-- documentos en total) y le pone su dossier a cada proyecto que ya existe con
-- la misma regla de antes. El día que entra, en pantalla no cambia nada.
--
-- Si NO la corres no se rompe nada: la sección Dossiers se ve vacía y cada
-- proyecto sigue sacando sus documentos de las listas que la aplicación trae
-- adentro, como hasta ahora.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

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

-- ---------- Los proyectos que ya existen se quedan como estaban ----------
-- Misma regla que usaba el código: CFM y FENOGE tienen la suya, el resto va
-- al estándar. Solo toca los que no tienen dossier, así correrlo otra vez no
-- le mueve nada a nadie.
update projects set dossier_id = case
    when upper(trim(coalesce(data->'general'->>'inversionista',''))) = 'CFM' then 'dossier-cfm-1'
    when upper(trim(coalesce(data->'general'->>'inversionista',''))) = 'FENOGE' then 'dossier-fenoge-1'
    else 'dossier-estandar-1'
  end
  where dossier_id is null;

update inversionistas set dossier_id = 'dossier-cfm-1'
  where upper(trim(nombre)) = 'CFM' and dossier_id is null;
update inversionistas set dossier_id = 'dossier-fenoge-1'
  where upper(trim(nombre)) = 'FENOGE' and dossier_id is null;
update inversionistas set dossier_id = 'dossier-estandar-1'
  where dossier_id is null;
