import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard, FolderKanban, Layers, Link2, HardHat, Droplets,
  Building2, Zap, Cog, Mountain, PenTool, Plus, Search, X, Printer,
  Paperclip, Trash2, ChevronLeft, Pencil, Save, MapPin, Calendar,
  Users, ExternalLink, Check, FileText, UploadCloud, XCircle, ClipboardList,
  Loader2, RefreshCw, LogOut, ShieldCheck, Lock, History, ClipboardCheck, StickyNote, UserCog,
  Folder, FolderPlus, ChevronDown, ChevronRight, PlayCircle, Video, Code2,
  Bold, Italic, Underline, List, PartyPopper, MessageSquare, PieChart, AlertTriangle, Menu, UserPlus, Boxes,
  CircleDot, Lightbulb, Home, Wrench, KeyRound,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import logoMark from './assets/logo-s-mark.png';
import { isBlank, sumMetersFormatted } from './technical-notes/formatters.js';
import { CATEGORIES } from './technical-notes/catalog/categories/index.js';
import { optionsFor, selectableOptionsFor, STANDALONE_TECHNICAL_VALUES } from './technical-notes/repository.js';
import { allFieldGroups, allGroupedFieldKeys, requiresAccordion, groupToOpenFor, displayLabelFor } from './technical-notes/fieldGroups.js';
import { hasConfirmedDefault, effectiveDefaultFor } from './technical-notes/confirmedDefaults.js';
import { STRUCTURE_LABELS, getStructureType } from './technical-notes/index.js';
import SelectOrOtro from './technical-notes/SelectOrOtro.jsx';
import TechnicalNotesPanel from './technical-notes/TechnicalNotesPanel.jsx';

/* ============================================================================
   SUN DESIGN SUITE (versión autónoma, fuera de Claude)
   Gestión y Hoja de Vida de Minigranjas Fotovoltaicas
   ----------------------------------------------------------------------------
   - Autenticación real con Supabase (correo + contraseña). Cada ingeniero
     crea su cuenta (nombre y foto); un líder le asigna el/los rol(es) luego.
   - Proyectos, enlaces y perfiles se guardan en una base de datos de
     Supabase compartida por todo el equipo.
   - Estructura "schema-driven": los campos técnicos por especialidad viven en
     el arreglo SCHEMA. Agregar/quitar un campo ahí no rompe la UI.
   ============================================================================ */

/* --------------------------- 1. ROLES / ESPECIALIDADES --------------------- */
/* Cada persona puede tener VARIOS roles a la vez (ej. Líder Civil + Ing.     */
/* Civil). Los roles ya no se auto-asignan al crear la cuenta: solo un       */
/* líder puede otorgarlos (ver TeamRolesView), para que nadie pueda          */
/* entrar a proyectos que no le corresponden con solo elegir un rol.         */
const ROLES = [
  { key: 'civil', label: 'Ing. Civil', icon: HardHat },
  { key: 'hidraulico', label: 'Ing. Hidráulico', icon: Droplets },
  { key: 'estructural', label: 'Ing. Estructural', icon: Building2 },
  { key: 'electrico', label: 'Ing. Eléctrico', icon: Zap },
  { key: 'geotecnico', label: 'Ing. Geotécnico', icon: Mountain },
  { key: 'delineante', label: 'Delineante', icon: PenTool },
];

/* Estas especialidades admiten varias personas a la vez en el mismo        */
/* proyecto (ej. dos ingenieros civiles). Las demás siguen siendo de una    */
/* sola persona. En equipo, estos roles guardan un arreglo de nombres en    */
/* vez de un solo nombre.                                                   */
const MULTI_ROLE_KEYS = ['civil', 'electrico', 'delineante'];
function esRolMultiple(roleKey) {
  return MULTI_ROLE_KEYS.includes(roleKey);
}
/* Normaliza cualquier valor de equipo[role] (string viejo, array, vacío)   */
/* a un arreglo de nombres.                                                  */
function equipoComoArray(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  return valor ? [valor] : [];
}
/* Todos los nombres asignados a un proyecto, sin importar el rol.         */
function equipoNombres(equipo) {
  return Object.values(equipo || {}).flatMap(equipoComoArray);
}
/* Texto legible para un valor de equipo[role] (nombre único, varios       */
/* nombres separados por coma, o vacío).                                    */
function equipoTexto(valor) {
  return equipoComoArray(valor).join(', ');
}

/* Roles de liderazgo: los únicos que pueden asignar el equipo de un         */
/* proyecto, cambiar su estado, y otorgar roles a los demás. Un líder puede  */
/* tener también un rol técnico en paralelo (ej. Líder Civil + Ing. Civil).  */
const LEADER_ROLES = [
  { key: 'lider_civil', label: 'Líder Civil', icon: HardHat },
  { key: 'lider_electrico', label: 'Líder Eléctrico', icon: Zap },
  { key: 'lider_delineantes', label: 'Líder Delineantes', icon: PenTool },
  { key: 'lider_diseno', label: 'Líder de Diseño', icon: ShieldCheck },
];
const LEADER_ROLE_KEYS = LEADER_ROLES.map((r) => r.key);

/* Rol de Control de Calidad Interno: puede ser paralelo a cualquier otro    */
/* rol. Es el único que puede escribir comentarios en Control Documental.    */
const QA_ROLE = { key: 'control_calidad', label: 'Control de Calidad Interno', icon: ClipboardCheck };

/* Rol de Desarrollador: tiene TODOS los permisos habilitados (equivale a    */
/* Líder de Diseño + Control de Calidad + poder gestionar cualquier rol).   */
/* Pensado para quien mantiene la plataforma, no para el equipo de diseño.  */
const DEV_ROLE = { key: 'desarrollador', label: 'Desarrollador', icon: Code2 };

const ALL_ROLE_DEFS = [...ROLES, ...LEADER_ROLES, QA_ROLE, DEV_ROLE];
/* Roles que solo el Líder de Diseño (o un Desarrollador) puede otorgar.     */
const ROLES_DE_ALTO_NIVEL = [...LEADER_ROLE_KEYS, DEV_ROLE.key];

/* Agrupación de la pestaña "Equipo": una persona puede caer en varias        */
/* categorías a la vez si tiene varios roles (ej. Ing. Civil y Líder Civil). */
const EQUIPO_CATEGORIAS = [
  { id: 'ing_civiles', label: 'Ing. Civiles', icon: HardHat, roles: ['civil', 'hidraulico', 'estructural', 'geotecnico'] },
  { id: 'ing_electricos', label: 'Ing. Eléctricos', icon: Zap, roles: ['electrico'] },
  { id: 'delineantes', label: 'Delineantes', icon: PenTool, roles: ['delineante'] },
  { id: 'control_calidad', label: 'Control de Calidad', icon: ClipboardCheck, roles: [QA_ROLE.key] },
  { id: 'lideres', label: 'Líderes', icon: ShieldCheck, roles: LEADER_ROLE_KEYS },
  { id: 'desarrolladores', label: 'Desarrolladores', icon: Code2, roles: [DEV_ROLE.key] },
];

function roleLabel(key) {
  return ALL_ROLE_DEFS.find((r) => r.key === key)?.label || key;
}
function rolesLabel(perfil) {
  if (!perfil || !perfil.roles || perfil.roles.length === 0) return 'Sin rol asignado';
  return perfil.roles.map(roleLabel).join(' · ');
}
function isDeveloper(perfil) {
  return !!perfil && !!perfil.roles && perfil.roles.includes(DEV_ROLE.key);
}
function isLeader(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.some((k) => LEADER_ROLE_KEYS.includes(k)));
}
function isDesignLeader(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes('lider_diseno'));
}
function isQA(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes(QA_ROLE.key));
}
/* Los roles de líder y el de Desarrollador solo los puede otorgar o quitar */
/* el Líder de Diseño (o un Desarrollador). Los demás roles los puede       */
/* gestionar cualquier líder.                                                */
function canAssignRole(perfil, roleKey) {
  if (ROLES_DE_ALTO_NIVEL.includes(roleKey)) return isDesignLeader(perfil);
  return isLeader(perfil);
}
function isAssignedToProject(perfil, project) {
  return !!perfil && equipoNombres(project.equipo).includes(perfil.nombre);
}

/* --------------------- 2. ESQUEMA DE CAMPOS POR ESPECIALIDAD ---------------- */
/* Campo alimentado por un input del catálogo de Notas Técnicas
   (src/technical-notes/catalog/). Una sola fuente de verdad: el `default`,
   el `type` y las opciones del repositorio salen del catálogo, así que el
   select de esta pantalla y la nota técnica nunca pueden discrepar.

   - repository_select / repository_value / select -> desplegable. Los dos
     primeros admiten "Otro" (escribir cualquier especificación); un `select`
     cerrado (ej. unidad de planos) no lo admite, por definición del paquete.
   - project_value -> input libre. Su `default` es una REFERENCIA de la
     memoria fuente, no un valor universal: se muestra como sugerencia y
     jamás se guarda solo (regla F del encargo).
   Las opciones se piden con el scope de la estructura dueña del campo, para
   que el acero del portón nunca aparezca como opción del cerramiento. */
function catalogField(categoryId, inputKey, label, { structureScope } = {}) {
  const input = CATEGORIES[categoryId].inputs[inputKey];

  /* Inputs que el paquete fuente modela como project_value pero cuyo valor
     típico el equipo ya confirmó (ver confirmedDefaults.js): se comportan
     como cualquier otro desplegable de catálogo, con su default
     preseleccionado y "Otro" para apartarse de él. */
  if (hasConfirmedDefault(categoryId, inputKey)) {
    const valor = effectiveDefaultFor(categoryId, inputKey, input.default);
    return { label, type: 'select', opciones: [valor], defaultValue: valor, allowOther: true };
  }

  /* project_value = dato propio del proyecto. Se captura como texto libre y
     SIN sugerencias en la interfaz: el `default` del catálogo es una simple
     referencia documental de la memoria fuente, no un valor a proponer. */
  if (input.type === 'project_value') {
    return { key: undefined, label, type: 'text' };
  }
  return {
    label,
    type: 'select',
    opciones: selectableOptionsFor(input, categoryId, inputKey, structureScope),
    defaultValue: input.default,
    allowOther: input.type !== 'select',
  };
}
/* Campo de SCHEMA a partir del catálogo: `key` es la ruta real en
   projects.data (puede ser un campo que ya existía; ver regla "una sola
   fuente de verdad"). */
function catalogSchemaField(key, categoryId, inputKey, label, opts) {
  return { ...catalogField(categoryId, inputKey, label, opts), key };
}
/* Los campos que solo existen para alimentar el motor de Notas Técnicas se
   marcan con este grupo para poder plegarlos en la pestaña Estructural, que
   de otro modo quedaría dominada por ellos. Es únicamente presentación: el
   campo, su clave en projects.data y su comportamiento no cambian. */
const GRUPO_NOTAS_TECNICAS = { id: 'notas_tecnicas', label: 'Información para Notas Técnicas' };
function camposNotasTecnicas(fields) {
  return fields.map((f) => ({ ...f, grupo: GRUPO_NOTAS_TECNICAS.id }));
}

/* Campo alimentado por un valor técnico del repositorio que todavía no tiene
   placeholder en ninguna nota (ver STANDALONE_TECHNICAL_VALUES). Se comporta
   igual que cualquier otro desplegable de catálogo: opciones + "Otro" +
   default sugerido que nunca sobrescribe lo ya guardado. */
function repositoryField({ fieldKey, group, defaultValue }, label) {
  return {
    key: fieldKey,
    label,
    type: 'select',
    allowOther: true,
    opciones: optionsFor(group, null),
    defaultValue,
  };
}
/* Los campos de tipo 'boolean' guardan { valor: true|false|null, nota: '' }   */
/* para poder anexar una descripción a la respuesta Sí/No.                     */
const SCHEMA = [
  {
    id: 'general', label: 'General', icon: MapPin,
    fields: [
      { key: 'departamento', label: 'Departamento', type: 'departamento' },
      { key: 'municipio', label: 'Municipio', type: 'municipio' },
      { key: 'pais', label: 'País', type: 'pais' },
      { key: 'inversionista', label: 'Inversionista', type: 'inversionista' },
      { key: 'numero_minigranja', label: 'Número de minigranja (ej. 215)', type: 'text' },
      { key: 'numero_predio', label: 'Número de predio (ej. 1)', type: 'text' },
      { key: 'propietario_predio', label: 'Propietario de predio', type: 'text' },
      { key: 'telefono_propietario', label: 'Teléfono de propietario', type: 'text' },
      { key: 'magna_sirgas', label: 'Coord. MAGNA-SIRGAS (Bogotá)', type: 'text' },
      { key: 'lat_long', label: 'Coordenadas Lat/Long', type: 'text' },
      { key: 'altitud', label: 'Altitud (m.s.n.m.)', type: 'text' },
      { key: 'fecha_inicio', label: 'Fecha de Inicio', type: 'date' },
      { key: 'fecha_entrega', label: 'Fecha de Entrega', type: 'date' },
    ],
  },
  {
    id: 'civil', label: 'Civil', icon: HardHat,
    fields: [
      { key: 'arboles_intervenir', label: 'Árboles a intervenir', type: 'text' },
      { key: 'area_legal', label: 'Área legal (m²)', type: 'text' },
      { key: 'perimetro_legal', label: 'Perímetro legal (m)', type: 'text' },
      { key: 'descripcion_acceso', label: 'Descripción del acceso', type: 'textarea' },
      { key: 'mvtos_tierra', label: 'Movimientos de tierra', type: 'boolean' },
      { key: 'topografia_insumo', label: 'Topografía (insumo disponible)', type: 'boolean' },
      { key: 'es_insumo', label: 'Estudio de Suelos (insumo disponible)', type: 'boolean' },
      { key: 'zona_viento', label: 'Zona de viento', type: 'text' },
      { key: 'postes_cerca_predio', label: 'Postes en el predio (o cerca)', type: 'boolean' },
    ],
  },
  {
    id: 'mecanica', label: 'Mecánica', icon: Cog,
    fields: [
      { key: 'numero_mesas', label: 'Número de mesas', type: 'text' },
      { key: 'tipo_mesas', label: 'Tipo de mesas', type: 'select', opciones: ['Tracker', 'Mesa fija'] },
      { key: 'proveedor', label: 'Proveedor', type: 'proveedor' },
      { key: 'config_mesas', label: 'Configuración de las mesas', type: 'text' },
      { key: 'hincas_por_mesa', label: 'Hincas por mesa', type: 'text' },
      {
        key: 'numero_hincas', label: 'Número de hincas', type: 'computed',
        formula: (d) => String((parseFloat(d?.numero_mesas) || 0) * (parseFloat(d?.hincas_por_mesa) || 0)),
        ayuda: 'Se calcula solo: N.° de mesas × Hincas por mesa',
      },
      { key: 'numero_modulos', label: 'Número de módulos', type: 'text' },
      { key: 'especificacion_modulos', label: 'Especificación de módulos', type: 'text' },
      { key: 'inclinacion_modulos', label: 'Inclinación máxima de módulos (°)', type: 'text' },
      { key: 'altura_min_terreno', label: 'Altura mínima con terreno (m)', type: 'text' },
      { key: 'tolerancia_superior', label: 'Tolerancia superior (m)', type: 'text' },
      { key: 'tolerancia_inferior', label: 'Tolerancia inferior (m)', type: 'text' },
      { key: 'numero_inversores', label: 'Número de inversores', type: 'text' },
      { key: 'especificacion_inversores', label: 'Especificación de inversores', type: 'text' },
      { key: 'modulos_por_inversor', label: 'Módulos por inversor', type: 'text' },
      { key: 'referencia_inversores', label: 'Referencia de inversores', type: 'text' },
    ],
  },
  {
    id: 'geotecnia', label: 'Geotecnia', icon: Mountain,
    fields: [
      { key: 'tipo_suelo', label: 'Tipo de suelo', type: 'text' },
      { key: 'zona_amenaza_sismica', label: 'Zona de amenaza sísmica', type: 'text' },
      { key: 'cbr', label: 'CBR (%)', type: 'text' },
      { key: 'ensayos_quimicos', label: 'Ensayos químicos', type: 'textarea' },
      { key: 'coef_balasto', label: 'Coeficiente de balasto', type: 'text' },
      { key: 'nivel_freatico', label: 'Nivel freático', type: 'boolean' },
      { key: 'presencia_rocas', label: 'Presencia de rocas', type: 'boolean' },
      { key: 'cohesion_efectiva', label: "Cohesión efectiva (c')", type: 'text' },
      { key: 'angulo_friccion', label: "Ángulo de fricción efectiva (ø')", type: 'text' },
      { key: 'resistencia_corte', label: 'Resist. al corte no drenada (Cu)', type: 'text' },
      { key: 'modulo_elasticidad', label: 'Módulo de elasticidad (Es)', type: 'text' },
      { key: 'modulo_poisson', label: 'Módulo de Poisson (μ)', type: 'text' },
      { key: 'peso_unitario', label: 'Peso unitario', type: 'text' },
      { key: 'temperatura_suelo', label: 'Temperatura del suelo', type: 'text' },
      { key: 'clasificacion_suelo', label: 'Clasificación de suelo (NSR-10)', type: 'select', opciones: ['A', 'B', 'C', 'D', 'E', 'F'] },
      catalogSchemaField('capacidad_admisible_cerramiento', 'CERRAMIENTO_PERIMETRAL', 'CAPACIDAD_SUELO', 'Capacidad admisible del suelo (cimentación cerramiento)'),
      catalogSchemaField('capacidad_admisible_porton', 'PORTON_METALICO', 'CAPACIDAD_SUELO', 'Capacidad admisible del suelo (cimentación portón)'),
      catalogSchemaField('capacidad_portante_shelter', 'SHELTER_CIMENTACION', 'CAP_PORTANTE', 'Capacidad portante considerada (shelter)'),
    ],
  },
  {
    id: 'estructural', label: 'Estructural', icon: Building2,
    fields: [
      { key: 'dim_ciment_shelter', label: 'Dim. cimentación shelter', type: 'cimentacion', forma: 'rectangular', sobresale: 0.5 },
      { key: 'dim_ciment_inversores', label: 'Dim. cimentación inversores', type: 'cimentacion', forma: 'rectangular', sobresale: 0 },
      { key: 'dim_ciment_cerramiento', label: 'Dim. cimentación cerramiento', type: 'cimentacion', forma: 'cilindrica', sobresale: 0 },
      { key: 'dim_ciment_porton', label: 'Dim. cimentación portón', type: 'cimentacion', forma: 'zapata_pedestal', sobresale: 0 },
      { key: 'dim_ciment_luminarias', label: 'Dim. cimentación luminarias', type: 'cimentacion', forma: 'rectangular', sobresale: 0.1 },
      { key: 'dim_ciment_cctv', label: 'Dim. cimentación CCTV', type: 'cimentacion', forma: 'rectangular', sobresale: 0.05 },
      { key: 'dim_ciment_postes', label: 'Dim. cimentación postes MT', type: 'cimentacion', forma: 'cilindrica', sobresale: 0.05 },
      catalogSchemaField('tipo_galvanizado', 'METAL', 'GALVANIZADO', 'Tipo de galvanizado'),
      { key: 'esquema_puntado', label: 'Esquema de puntado', type: 'text' },
      { key: 'espec_aceros_pernos', label: 'Especificaciones de aceros y pernos', type: 'text' },
      { key: 'espec_refuerzo', label: 'Especificación de refuerzo', type: 'text' },
      { key: 'Aa', label: 'Aa', type: 'text' },
      { key: 'Av', label: 'Av', type: 'text' },

      /* Todo lo que sigue alimenta el motor de Notas Técnicas y se agrupa    */
      /* en una sección colapsable para no saturar la pestaña (ver           */
      /* GRUPO_NOTAS_TECNICAS y SectionFieldsGrid).                           */
      ...camposNotasTecnicas([
      /* ---- Concreto y metal (globales de Notas Técnicas: alimentan las    */
      /* notas CON-* y MET-* de TODAS las estructuras) ------------------- */
      catalogSchemaField('concreto_solado_fc', 'CONCRETO', 'FC_SOLADO', "Concreto de solado — f'c"),
      catalogSchemaField('concreto_solado_espesor', 'CONCRETO', 'ESPESOR_SOLADO', 'Concreto de solado — espesor'),
      catalogSchemaField('acero_refuerzo_fy', 'CONCRETO', 'ACERO_FY', 'Acero de refuerzo — fy'),
      /* La norma del acero de refuerzo todavía no tiene placeholder en el
         catálogo (CON-003 solo interpola fy), pero sí es un dato técnico
         reutilizable que los proyectos ya capturan: se maneja con el mismo
         patrón de desplegable + "Otro" que el resto de materiales. */
      repositoryField(STANDALONE_TECHNICAL_VALUES.ACERO_REFUERZO_NORMA, 'Acero de refuerzo — norma'),
      catalogSchemaField('agregado_tamano_max', 'CONCRETO', 'AGREGADO_MAX', 'Agregados — tamaño máximo nominal'),
      catalogSchemaField('relacion_agua_cemento_max', 'CONCRETO', 'RELACION_AC_MAX', 'Relación agua/cemento máxima'),
      catalogSchemaField('recubrimiento_tierra', 'CONCRETO', 'REC_TIERRA', 'Recubrimiento — en contacto con tierra'),
      catalogSchemaField('recubrimiento_no_tierra', 'CONCRETO', 'REC_NO_TIERRA', 'Recubrimiento — sin contacto con tierra'),
      catalogSchemaField('galvanizado_frio_zinc', 'METAL', 'ZINC_FRIO', 'Galvanizado en frío — zinc mínimo'),
      catalogSchemaField('galvanizado_frio_capas', 'METAL', 'CAPAS_REPARACION', 'Galvanizado en frío — capas de reparación'),

      /* ---- Cerramiento perimetral ------------------------------------- */
      catalogSchemaField('cerramiento_poste_diametro', 'CERRAMIENTO_PERIMETRAL', 'POSTE_DIAMETRO', 'Cerramiento — poste típico: diámetro nominal'),
      catalogSchemaField('cerramiento_poste_espesor', 'CERRAMIENTO_PERIMETRAL', 'POSTE_ESPESOR', 'Cerramiento — poste típico: espesor'),
      catalogSchemaField('cerramiento_poste_anclaje', 'CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO', 'Cerramiento — poste típico: anclaje/embebido (m)'),
      catalogSchemaField('cerramiento_poste_afloramiento', 'CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO', 'Cerramiento — poste típico: afloramiento (m)'),
      {
        key: 'cerramiento_poste_longitud_total', label: 'Cerramiento — poste típico: longitud total', type: 'computed',
        formula: (d) => sumMetersFormatted(d?.cerramiento_poste_anclaje, d?.cerramiento_poste_afloramiento) || '— (completa anclaje y afloramiento)',
        ayuda: 'Se calcula solo: anclaje + afloramiento del poste',
      },
      catalogSchemaField('cerramiento_poste_separacion', 'CERRAMIENTO_PERIMETRAL', 'POSTE_SEPARACION', 'Cerramiento — poste típico: separación'),
      catalogSchemaField('cerramiento_tubo_secundario_diametro', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_DIAMETRO', 'Cerramiento — diagonales y vientos: diámetro nominal'),
      catalogSchemaField('cerramiento_tubo_secundario_espesor', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_ESPESOR', 'Cerramiento — diagonales y vientos: espesor'),
      catalogSchemaField('cerramiento_diagonales_longitud', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_LONGITUD', 'Cerramiento — diagonales: longitud'),
      catalogSchemaField('cerramiento_diagonales_separacion', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_SEPARACION', 'Cerramiento — diagonales: separación'),
      catalogSchemaField('cerramiento_vientos_longitud', 'CERRAMIENTO_PERIMETRAL', 'VIENTO_LONGITUD', 'Cerramiento — vientos: longitud'),
      catalogSchemaField('cerramiento_vientos_separacion', 'CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', 'Cerramiento — vientos: separación'),
      catalogSchemaField('cerramiento_malla_especificacion', 'CERRAMIENTO_PERIMETRAL', 'MALLA', 'Cerramiento — malla eslabonada'),
      catalogSchemaField('cerramiento_bandit_calibre', 'CERRAMIENTO_PERIMETRAL', 'BANDIT', 'Cerramiento — cinta bandit: calibre'),
      catalogSchemaField('cerramiento_fijacion_separacion', 'CERRAMIENTO_PERIMETRAL', 'FIJACION', 'Cerramiento — separación máxima entre fijaciones'),
      catalogSchemaField('cerramiento_acero_norma', 'CERRAMIENTO_PERIMETRAL', 'ACERO', 'Cerramiento — perfilería: norma del acero'),
      catalogSchemaField('cerramiento_acero_fy', 'CERRAMIENTO_PERIMETRAL', 'FY', 'Cerramiento — perfilería: fy'),
      catalogSchemaField('cerramiento_acero_fu', 'CERRAMIENTO_PERIMETRAL', 'FU', 'Cerramiento — perfilería: fu'),
      catalogSchemaField('cerramiento_soldadura_espesor', 'CERRAMIENTO_PERIMETRAL', 'SOLDADURA', 'Cerramiento — soldadura: espesor mínimo'),
      { key: 'ambiente_corrosion_clase', label: 'Cerramiento — clase de ambiente de corrosión (ISO 9223)', type: 'select', opciones: ['C1', 'C2', 'C3', 'C4', 'C5'] },
      { key: 'galvanizado_perdida_zinc_proyectada', label: 'Cerramiento — pérdida de zinc proyectada (vida útil)', type: 'text' },

      /* ---- Portón metálico -------------------------------------------- */
      catalogSchemaField('porton_viga_amarre_seccion', 'PORTON_METALICO', 'VIGA_AMARRE', 'Portón — viga de amarre: sección'),
      catalogSchemaField('porton_reemplazo_granular', 'PORTON_METALICO', 'REEMPLAZO_GRANULAR', 'Portón — reemplazo de material granular'),
      catalogSchemaField('porton_perfil_embebido', 'PORTON_METALICO', 'PERFIL', 'Portón — perfil metálico embebido'),
      catalogSchemaField('porton_acero_norma', 'PORTON_METALICO', 'ACERO', 'Portón — norma del acero'),
      catalogSchemaField('porton_acero_fy', 'PORTON_METALICO', 'FY', 'Portón — fy'),
      catalogSchemaField('porton_acero_fu', 'PORTON_METALICO', 'FU', 'Portón — fu'),
      catalogSchemaField('porton_soldadura_espesor', 'PORTON_METALICO', 'SOLDADURA', 'Portón — soldadura: espesor mínimo'),

      /* ---- Cimentación de shelter (los sísmicos quedan EXCLUIDOS en esta */
      /* fase: no se crea campo para ellos — ver catálogo) --------------- */
      catalogSchemaField('shelter_cota_minima', 'SHELTER_CIMENTACION', 'COTA_MINIMA', 'Shelter — cota mínima'),
      catalogSchemaField('shelter_calado_estudio', 'SHELTER_CIMENTACION', 'CALADO_ESTUDIO', 'Shelter — calado que exige estudio hidráulico'),
      catalogSchemaField('shelter_borde_libre', 'SHELTER_CIMENTACION', 'BORDE_LIBRE', 'Shelter — borde libre adicional'),
      catalogSchemaField('shelter_micropilote_profundidad', 'SHELTER_CIMENTACION', 'MICROPILOTE_PROF', 'Shelter — micropilote: profundidad (m)'),
      catalogSchemaField('shelter_micropilote_sobresaliente', 'SHELTER_CIMENTACION', 'MICROPILOTE_SOBRE', 'Shelter — micropilote: sobresaliente (m)'),
      {
        key: 'shelter_micropilote_longitud_total', label: 'Shelter — micropilote: longitud total', type: 'computed',
        formula: (d) => sumMetersFormatted(d?.shelter_micropilote_profundidad, d?.shelter_micropilote_sobresaliente) || '— (completa profundidad y sobresaliente)',
        ayuda: 'Se calcula solo: profundidad + sobresaliente del micropilote',
      },
      catalogSchemaField('shelter_compactacion_minima', 'SHELTER_CIMENTACION', 'COMPACTACION', 'Shelter — compactación mínima'),
      catalogSchemaField('shelter_carga_mantenimiento', 'SHELTER_CIMENTACION', 'CV_MANT', 'Shelter — carga viva de mantenimiento'),
      catalogSchemaField('shelter_carga_sobrecarga', 'SHELTER_CIMENTACION', 'CV_SOBRE', 'Shelter — sobrecarga'),
      catalogSchemaField('shelter_carga_muerta_total', 'SHELTER_CIMENTACION', 'CM_TOTAL', 'Shelter — carga muerta total'),
      catalogSchemaField('shelter_carga_viento', 'SHELTER_CIMENTACION', 'VIENTO', 'Shelter — carga de viento'),

      /* ---- Soporte de inversores -------------------------------------- */
      catalogSchemaField('inversores_manual_cargas', 'SOPORTE_INVERSORES', 'MANUAL_CARGAS', 'Inversores — manual de cargas de referencia'),
      catalogSchemaField('inversores_fc_ciclopeo', 'SOPORTE_INVERSORES', 'FC_CICLOPEO', "Inversores — f'c del concreto ciclópeo"),
      ]),
    ],
  },
  {
    id: 'hidraulico', label: 'Hidráulico', icon: Droplets,
    fields: [
      { key: 'obras_hidraulicas', label: 'Obras hidráulicas requeridas', type: 'boolean' },
      { key: 'tipo_obras', label: 'Tipo de obras', type: 'text' },
      { key: 'inundabilidad', label: '¿Manchas mayores a 20cm Tr 25 años?', type: 'boolean' },
      { key: 'velocidades', label: '¿Velocidades de flujo mayores a 1m/s?', type: 'boolean' },
      { key: 'cuerpos_agua', label: 'Cuerpos de agua cercanos', type: 'boolean' },
      { key: 'medidas_erosion', label: '¿Requiere implementación de medidas para la erosión?', type: 'boolean' },
      { key: 'manejo_vegetacion', label: '¿Requiere manejo especial de vegetación?', type: 'boolean' },
      { key: 'estaciones_pluviometricas', label: 'Estaciones pluviométricas', type: 'stations' },
    ],
  },
  {
    id: 'electrico', label: 'Eléctrico', icon: Zap,
    fields: [
      { key: 'planta_fv', label: 'Planta FV', type: 'text' },
      { key: 'potencia_nominal', label: 'Potencia nominal', type: 'text' },
      { key: 'potencia_pico', label: 'Potencia pico', type: 'text' },
      { key: 'dc_ac_ratio', label: 'DC/AC ratio', type: 'text' },
      { key: 'factor_potencia', label: 'Factor de potencia (inversores)', type: 'text' },
      { key: 'tipo_estructura', label: 'Tipo de estructura', type: 'text' },
      { key: 'distancia_pitch', label: 'Distancia Pitch', type: 'text' },
      { key: 'modulos_por_string', label: 'Módulos por string', type: 'text' },
      { key: 'modulos_ev', label: 'Módulos EV', type: 'text' },
    ],
  },
];

/* Departamentos y municipios de Colombia (fuente: DIVIPOLA/DANE), para los
   selectores de Municipio/Departamento y para derivar la abreviatura de 3
   letras usada en el código documental (ej. Boyacá -> BOY).             */
const COLOMBIA = [
  { nombre: "Amazonas", municipios: ["El Encanto","La Chorrera","La Pedrera","La Victoria","Leticia","Mirití-Paraná","Puerto Alegría","Puerto Arica","Puerto Nariño","Puerto Santander","Tarapacá"] },
  { nombre: "Antioquia", municipios: ["Abejorral","Abriaquí","Alejandría","Amagá","Amalfi","Andes","Angelópolis","Angostura","Anorí","Anzá","Apartadó","Arboletes","Argelia","Armenia","Barbosa","Bello","Belmira","Betania","Betulia","Briceño","Buriticá","Cáceres","Caicedo","Caldas","Campamento","Cañasgordas","Caracolí","Caramanta","Carepa","Carmen de Viboral","Carolina del Príncipe","Caucasia","Chigorodó","Cisneros","Ciudad Bolívar","Cocorná","Concepción","Concordia","Copacabana","Dabeiba","Donmatías","Ebéjico","El Bagre","El Peñol","El Retiro","Entrerríos","Envigado","Fredonia","Frontino","Giraldo","Girardota","Gómez Plata","Granada","Guadalupe","Guarne","Guatapé","Heliconia","Hispania","Itagüí","Ituango","Jardín","Jericó","La Ceja","La Estrella","La Pintada","La Unión","Liborina","Maceo","Marinilla","Medellín","Montebello","Murindó","Mutatá","Nariño","Nechí","Necoclí","Olaya","Peque","Pueblorrico","Puerto Berrío","Puerto Nare","Puerto Triunfo","Remedios","Rionegro","Sabanalarga","Sabaneta","Salgar","San Andrés de Cuerquia","San Carlos","San Francisco","San Jerónimo","San José de la Montaña","San Juan de Urabá","San Luis","San Pedro de los Milagros","San Pedro de Urabá","San Rafael","San Roque","San Vicente Ferrer","Santa Bárbara","Santa Fe de Antioquia","Santa Rosa de Osos","Santo Domingo","Santuario","Segovia","Sonsón","Sopetrán","Támesis","Tarazá","Tarso","Titiribí","Toledo","Turbo","Uramita","Urrao","Valdivia","Valparaíso","Vegachí","Venecia","Yalí","Yarumal","Yolombó","Yondó","Zaragoza"] },
  { nombre: "Arauca", municipios: ["Arauca","Arauquita","Cravo Norte","Fortul","Puerto Rondón","Saravena","Tame"] },
  { nombre: "Atlántico", municipios: ["Baranoa","Barranquilla","Campo de la Cruz","Candelaria","Galapa","Juan de Acosta","Luruaco","Malambo","Manatí","Palmar de Varela","Piojó","Polonuevo","Ponedera","Puerto Colombia","Repelón","Sabanagrande","Sabanalarga","Santa Lucía","Santo Tomás","Soledad","Suan","Tubará","Usiacurí"] },
  { nombre: "Bogotá D.C.", municipios: ["Bogotá"] },
  { nombre: "Bolívar", municipios: ["Achí","Altos del Rosario","Arenal","Arjona","Arroyohondo","Barranco de Loba","Calamar","Cantagallo","Cartagena de Indias","Cicuco","Clemencia","Córdoba","El Carmen de Bolívar","El Guamo","El Peñón","Hatillo de Loba","Magangué","Mahates","Margarita","María La Baja","Mompox","Montecristo","Morales","Norosí","Pinillos","Regidor","Río Viejo","San Cristóbal","San Estanislao","San Fernando","San Jacinto","San Jacinto del Cauca","San Juan Nepomuceno","San Martín de Loba","San Pablo","Santa Catalina","Santa Rosa","Santa Rosa del Sur","Simití","Soplaviento","Talaigua Nuevo","Tiquisio","Turbaco","Turbana","Villanueva","Zambrano"] },
  { nombre: "Boyacá", municipios: ["Almeida","Aquitania","Arcabuco","Belén","Berbeo","Betéitiva","Boavita","Boyacá","Briceño","Buenavista","Caldas","Campohermoso","Cerinza","Chinavita","Chiquinquirá","Chíquiza","Chiscas","Chita","Chitaraque","Chivatá","Chivor","Ciénega","Cómbita","Coper","Corrales","Covarachía","Cubará","Cucaita","Cuítiva","Duitama","El Cocuy","El Espino","Firavitoba","Floresta","Gachantivá","Gámeza","Garagoa","Guacamayas","Guateque","Guayatá","Güicán","Iza","Jenesano","Jericó","La Capilla","La Uvita","La Victoria","Labranzagrande","Macanal","Maripí","Miraflores","Mongua","Monguí","Moniquirá","Motavita","Muzo","Nobsa","Nuevo Colón","Oicatá","Otanche","Pachavita","Páez","Paipa","Pajarito","Panqueba","Pauna","Paya","Paz de Río","Pesca","Pisba","Puerto Boyacá","Quípama","Ramiriquí","Ráquira","Rondón","Saboyá","Sáchica","Samacá","San Eduardo","San José de Pare","San Luis de Gaceno","San Mateo","San Miguel de Sema","San Pablo de Borbur","Santa María","Santa Rosa de Viterbo","Santa Sofía","Santana","Sativanorte","Sativasur","Siachoque","Soatá","Socha","Socotá","Sogamoso","Somondoco","Sora","Soracá","Sotaquirá","Susacón","Sutamarchán","Sutatenza","Tasco","Tenza","Tibaná","Tibasosa","Tinjacá","Tipacoque","Toca","Togüí","Tópaga","Tota","Tunja","Tununguá","Turmequé","Tuta","Tutazá","Úmbita","Ventaquemada","Villa de Leyva","Viracachá","Zetaquirá"] },
  { nombre: "Caldas", municipios: ["Aguadas","Anserma","Aranzazu","Belalcázar","Chinchiná","Filadelfia","La Dorada","La Merced","Manizales","Manzanares","Marmato","Marquetalia","Marulanda","Neira","Norcasia","Pácora","Palestina","Pensilvania","Riosucio","Risaralda","Salamina","Samaná","San José","Supía","Victoria","Villamaría","Viterbo"] },
  { nombre: "Caquetá", municipios: ["Albania","Belén de los Andaquíes","Cartagena del Chairá","Curillo","El Doncello","El Paujil","Florencia","La Montañita","Milán","Morelia","Puerto Rico","San José del Fragua","San Vicente del Caguán","Solano","Solita","Valparaíso"] },
  { nombre: "Casanare", municipios: ["Aguazul","Chámeza","Hato Corozal","La Salina","Maní","Monterrey","Nunchía","Orocué","Paz de Ariporo","Pore","Recetor","Sabanalarga","Sácama","San Luis de Palenque","Támara","Tauramena","Trinidad","Villanueva","Yopal"] },
  { nombre: "Cauca", municipios: ["Almaguer","Argelia","Balboa","Bolívar","Buenos Aires","Cajibío","Caldono","Caloto","Corinto","El Tambo","Florencia","Guachené","Guapí","Inzá","Jambaló","La Sierra","La Vega","López de Micay","Mercaderes","Miranda","Morales","Padilla","Páez","Patía","Piamonte","Piendamó","Popayán","Puerto Tejada","Puracé","Rosas","San Sebastián","Santa Rosa","Santander de Quilichao","Silvia","Sotará","Suárez","Sucre","Timbío","Timbiquí","Toribío","Totoró","Villa Rica"] },
  { nombre: "Cesar", municipios: ["Aguachica","Agustín Codazzi","Astrea","Becerril","Bosconia","Chimichagua","Chiriguaná","Curumaní","El Copey","El Paso","Gamarra","González","La Gloria","La Jagua de Ibirico","La Paz","Manaure","Pailitas","Pelaya","Pueblo Bello","Río de Oro","San Alberto","San Diego","San Martín","Tamalameque","Valledupar"] },
  { nombre: "Chocó", municipios: ["Acandí","Alto Baudó","Atrato","Bagadó","Bahía Solano","Bajo Baudó","Bojayá","Cantón de San Pablo","Carmen del Darién","Cértegui","Condoto","El Cantón del San Pablo","El Carmen de Atrato","El Litoral del San Juan","Istmina","Juradó","Lloró","Medio Atrato","Medio Baudó","Medio San Juan","Nóvita","Nuquí","Quibdó","Río Iró","Río Quito","Riosucio","San José del Palmar","San Juan","Sipí","Tadó","Unguía","Unión Panamericana"] },
  { nombre: "Córdoba", municipios: ["Ayapel","Buenavista","Canalete","Cereté","Chimá","Chinú","Ciénaga de Oro","Cotorra","La Apartada","Lorica","Los Córdobas","Momil","Montelíbano","Montería","Moñitos","Morales","Planeta Rica","Pueblo Nuevo","Puerto Escondido","Puerto Libertador","Purísima","Sahagún","San Andrés de Sotavento","San Antero","San Bernardo del Viento","San Carlos","San José de Uré","San Pelayo","Tierralta","Tuchín","Valencia"] },
  { nombre: "Cundinamarca", municipios: ["Agua de Dios","Albán","Almeidas","Anapoima","Apulo","Arbeláez","Arbeláez","Beltrán","Bituima","Bojacá","Cabrera","Cachipay","Cajicá","Caparrapí","Cáqueza","Carmen de Carupa","Chaguaní","Chía","Chipaque","Choachí","Chocontá","Cogua","Cota","Cucunubá","El Colegio","El Peñón","El Rosal","Facatativá","Fómeque","Fosca","Funza","Fúquene","Fusagasugá","Gachancipá","Girardot","Granada","Guaduas","Guasca","Guataquí","Guatavita","Guayabal de Síquima","Gutiérrez","Jerusalén","La Calera","La Mesa","La Palma","La Peña","La Vega","Lenguazaque","Machetá","Madrid","Manta","Medina","Mosquera","Nariño","Nemocón","Nilo","Nocaíma","Paime","Pandi","Paratebueno","Pasca","Puerto Salgar","Pulí","Quetame","Quipile","San Antonio del Tequendama","San Bernardo","San Cayetano","San Francisco","San Juan de Rioseco","Sasaima","Sesquilé","Sibaté","Silvania","Simijaca","Soacha","Sopó","Subachoque","Suesca","Supatá","Susa","Sutatausa","Tabio","Tausa","Tena","Tenjo","Tibirita","Tocaima","Tocancipá","Ubaque","Ubaté","Une","Útica","Venecia","Vergara","Vianí","Villa de San Diego de Ubaté","Villapinzón","Villeta","Villeta","Yacopí","Zipacón","Zipaquirá"] },
  { nombre: "Guainía", municipios: ["Barranco Minas","Cacahual","Inírida","La Guadalupe","Morichal Nuevo","Pana Pana","Puerto Colombia","San Felipe"] },
  { nombre: "Guaviare", municipios: ["Calamar","El Retorno","Miraflores","San José del Guaviare"] },
  { nombre: "Huila", municipios: ["Acevedo","Agrado","Aipe","Algeciras","Altamira","Baraya","Campoalegre","Colombia","Elías","Garzón","Gigante","Guadalupe","Hobo","Íquira","Isnos","La Argentina","La Plata","Nátaga","Neiva","Oporapa","Paicol","Palermo","Palestina","Pital","Pitalito","Rivera","Saladoblanco","San Agustín","Santa María","Suaza","Tarqui","Tello","Teruel","Tesalia","Timaná","Villavieja","Yaguará"] },
  { nombre: "La Guajira", municipios: ["Albania","Barrancas","Dibulla","Distracción","El Molino","Fonseca","Hatonuevo","La Jagua del Pilar","Maicao","Manaure","Riohacha","San Juan del Cesar","Uribia","Urumita","Villanueva"] },
  { nombre: "Magdalena", municipios: ["Algarrobo","Aracataca","Ariguaní","Cerro de San Antonio","Chivolo","Ciénaga","Concordia","El Banco","El Piñón","El Retén","Fundación","Guamal","Nueva Granada","Pedraza","Pijiño del Carmen","Pivijay","Plato","Puebloviejo","Remolino","Sabanas de San Ángel","Salamina","San Sebastián de Buenavista","San Zenón","Santa Ana","Santa Bárbara de Pinto","Santa Marta","Sitionuevo","Tenerife","Zapayán","Zona Bananera"] },
  { nombre: "Meta", municipios: ["Acacías","Barranca de Upía","Cabuyaro","Castilla la Nueva","Cubarral","Cumaral","El Calvario","El Castillo","El Dorado","Fuente de Oro","Granada","Guamal","La Macarena","La Uribe","Lejanías","Mapiripán","Mesetas","Puerto Concordia","Puerto Gaitán","Puerto Lleras","Puerto López","Puerto Rico","Restrepo","San Carlos de Guaroa","San Juan de Arama","San Juanito","San Martín","Villavicencio","Vista Hermosa"] },
  { nombre: "Nariño", municipios: ["Albán","Aldana","Ancuya","Arboleda","Barbacoas","Belén","Buesaco","Chachagüí","Colón","Consacá","Contadero","Córdoba","Cuaspud","Cumbal","Cumbitara","El Charco","El Peñol","El Rosario","El Tablón de Gómez","El Tambo","Francisco Pizarro","Funes","Guachucal","Guaitarilla","Gualmatán","Iles","Imués","Ipiales","La Cruz","La Florida","La Llanada","La Tola","La Unión","Leiva","Linares","Los Andes","Magüí Payán","Mallama","Mosquera","Nariño","Olaya Herrera","Ospina","Pasto","Policarpa","Potosí","Providencia","Puerres","Pupiales","Ricaurte","Roberto Payán","Samaniego","San Bernardo","San Juan de Pasto","San Lorenzo","San Pablo","San Pedro de Cartago","Sandona","Santa Bárbara","Santacruz","Sapuyes","Taminango","Tangua","Tumaco","Túquerres","Yacuanquer"] },
  { nombre: "Norte de Santander", municipios: ["Ábrego","Arboledas","Bochalema","Bucarasica","Cáchira","Cácota","Chinácota","Chitagá","Convención","Cúcuta","Cucutilla","Durania","El Carmen","El Tarra","El Zulia","Gramalote","Hacarí","Herrán","La Esperanza","La Playa de Belén","Labateca","Lourdes","Mutiscua","Ocaña","Pamplona","Pamplonita","Puerto Santander","Ragonvalia","Salazar de Las Palmas","San Calixto","San Cayetano","Santiago","Sardinata","Silos","Teorama","Tibú","Toledo","Villa Caro","Villa del Rosario"] },
  { nombre: "Putumayo", municipios: ["Colón","Mocoa","Mocoa","Orito","Puerto Asís","Puerto Caicedo","Puerto Guzmán","Puerto Leguízamo","San Francisco","San Miguel","Santiago","Sibundoy","Valle del Guamuez","Villagarzón"] },
  { nombre: "Quindío", municipios: ["Armenia","Buenavista","Calarcá","Circasia","Córdoba","Filandia","Génova","La Tebaida","Montenegro","Pijao","Quimbaya","Salento"] },
  { nombre: "Risaralda", municipios: ["Apía","Balboa","Belén de Umbría","Dosquebradas","Guática","La Celia","La Virginia","Marsella","Mistrató","Pereira","Pueblo Rico","Quinchía","Santa Rosa de Cabal","Santuario"] },
  { nombre: "San Andrés y Providencia", municipios: ["Providencia y Santa Catalina Islas","San Andrés"] },
  { nombre: "Santander", municipios: ["Aguada","Albania","Aratoca","Barbosa","Barichara","Barrancabermeja","Betulia","Bolívar","Bucaramanga","Cabrera","California","Capitanejo","Carcasí","Cepitá","Cerrito","Charalá","Charta","Chima","Chipatá","Cimitarra","Concepción","Confines","Contratación","Coromoro","Curití","El Carmen de Chucurí","El Guacamayo","El Peñón","El Playón","Encino","Enciso","Florián","Floridablanca","Galán","Gámbita","Girón","Guaca","Guadalupe","Guapotá","Guavatá","Güepsa","Hato","Jesús María","Jordán","La Belleza","La Paz","Landázuri","Lebrija","Los Santos","Macaravita","Málaga","Matanza","Mogotes","Molagavita","Ocamonte","Oiba","Onzaga","Palmar","Palmas del Socorro","Páramo","Piedecuesta","Pinchote","Puente Nacional","Puerto Parra","Puerto Wilches","Rionegro","Sabana de Torres","San Andrés","San Benito","San Gil","San Joaquín","San José de Miranda","San Miguel","San Vicente de Chucurí","Santa Bárbara","Santa Helena del Opón","Simacota","Socorro","Suaita","Sucre","Suratá","Tona","Valle de San José","Vélez","Vetas","Villanueva","Zapatoca"] },
  { nombre: "Sucre", municipios: ["Buenavista","Caimito","Chalán","Colosó","Corozal","Coveñas","El Roble","Galeras","Guaranda","La Unión","Los Palmitos","Majagual","Morroa","Ovejas","Palmito","Sampués","San Benito Abad","San Juan de Betulia","San Marcos","San Onofre","San Pedro","Santiago de Tolú","Sincelejo","Sucre","Tolú Viejo"] },
  { nombre: "Tolima", municipios: ["Alpujarra","Alvarado","Ambalema","Anzoátegui","Armero","Ataco","Cajamarca","Carmen de Apicalá","Casabianca","Chaparral","Coello","Coyaima","Cunday","Dolores","El Espinal","Falan","Flandes","Fresno","Guamo","Herveo","Honda","Ibagué","Icononzo","Lérida","Líbano","Mariquita","Melgar","Murillo","Natagaima","Ortega","Palocabildo","Piedras","Planadas","Prado","Purificación","Rioblanco","Roncesvalles","Rovira","Saldaña","San Antonio","San Luis","Santa Isabel","Suárez","Valle de San Juan","Venadillo","Villahermosa","Villarrica"] },
  { nombre: "Valle del Cauca", municipios: ["Alcalá","Andalucía","Ansermanuevo","Argelia","Bolívar","Buenaventura","Buga","Bugalagrande","Caicedonia","Cali","Calima","Candelaria","Cartago","Dagua","El Águila","El Cairo","El Cerrito","El Dovio","Florida","Ginebra","Guacarí","Jamundí","La Cumbre","La Unión","La Victoria","Obando","Palmira","Pradera","Restrepo","Riofrío","Roldanillo","San Pedro","Sevilla","Toro","Trujillo","Tuluá","Ulloa","Versalles","Vijes","Yotoco","Yumbo","Zarzal"] },
  { nombre: "Vaupés", municipios: ["Carurú","Mitú","Pacoa","Papunaua","Taraira","Yavaraté"] },
  { nombre: "Vichada", municipios: ["Cumaribo","La Primavera","Puerto Carreño","Santa Rosalía"] },
];

const DEPARTAMENTO_ABREVIATURA = {
  'Amazonas': 'AMA',
  'Antioquia': 'ANT',
  'Arauca': 'ARA',
  'Atlántico': 'ATL',
  'Bogotá D.C.': 'BOG',
  'Bolívar': 'BOL',
  'Boyacá': 'BOY',
  'Caldas': 'CAL',
  'Caquetá': 'CAQ',
  'Casanare': 'CAS',
  'Cauca': 'CAU',
  'Cesar': 'CES',
  'Chocó': 'CHO',
  'Córdoba': 'COR',
  'Cundinamarca': 'CUN',
  'Guainía': 'GUA',
  'Guaviare': 'GUV',
  'Huila': 'HUI',
  'La Guajira': 'LAG',
  'Magdalena': 'MAG',
  'Meta': 'MET',
  'Nariño': 'NAR',
  'Norte de Santander': 'NSA',
  'Putumayo': 'PUT',
  'Quindío': 'QUI',
  'Risaralda': 'RIS',
  'San Andrés y Providencia': 'SAP',
  'Santander': 'SAN',
  'Sucre': 'SUC',
  'Tolima': 'TOL',
  'Valle del Cauca': 'VAL',
  'Vaupés': 'VAU',
  'Vichada': 'VIC'
};

const STATUS_CONFIG = {
  activo: { label: 'Activo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pausa: { label: 'En Pausa', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  inactivo: { label: 'Inactivo', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  finalizado: { label: 'Finalizado', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
};

/* ------------------------------ 3. HELPERS ---------------------------------- */
const STATION_ROWS = 7;
function emptyStations() {
  return Array.from({ length: STATION_ROWS }, () => ({ nombre: '', dias: '', peso: '' }));
}

/* Estructura vacía de una cimentación según su forma:                       */
/* - rectangular (pedestal simple): ancho, profundo, desplante               */
/* - cilindrica (pilote): diámetro, desplante                                */
/* - zapata_pedestal (zapata con pedestal, ej. portón): A/B de la zapata,    */
/*   a/b del pedestal, y desplante                                           */
/* "desplante" es lo que digita cada quien (profundidad de fundación); lo    */
/* que sobresale sobre el terreno es fijo por tipo de elemento (ver SCHEMA). */
function emptyCimentacion(forma) {
  if (forma === 'cilindrica') return { diametro: '', desplante: '', resistencia: '' };
  if (forma === 'zapata_pedestal') {
    return { ancho_zapata: '', profundo_zapata: '', alto_zapata: '', ancho_pedestal: '', profundo_pedestal: '', desplante: '', resistencia: '' };
  }
  return { ancho: '', profundo: '', desplante: '', resistencia: '' };
}
/* Altura del pedestal en una zapata con pedestal: lo que queda del total    */
/* (desplante + lo que sobresale) después de restar el alto de la zapata.   */
function altoPedestal(v, sobresale) {
  const totalM = (parseFloat(v.desplante) || 0) + sobresale;
  const altoZapataM = parseFloat(v.alto_zapata) || 0;
  return Math.max(0, totalM - altoZapataM);
}

function emptySchemaData() {
  const obj = {};
  SCHEMA.forEach((section) => {
    obj[section.id] = {};
    section.fields.forEach((f) => {
      if (f.type === 'boolean') obj[section.id][f.key] = { valor: null, nota: '' };
      else if (f.type === 'stations') obj[section.id][f.key] = emptyStations();
      else if (f.type === 'cimentacion') obj[section.id][f.key] = emptyCimentacion(f.forma);
      else obj[section.id][f.key] = '';
    });
  });
  return obj;
}

function buildData(overrides) {
  const base = emptySchemaData();
  Object.entries(overrides).forEach(([sectionId, fields]) => {
    base[sectionId] = { ...base[sectionId], ...fields };
  });
  return base;
}

function bool(valor, nota = '') {
  return { valor, nota };
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Antepone https:// si a la URL le falta el protocolo (típico cuando         */
/* alguien pega solo "drive.google.com/..." sin más).                        */
function normalizeUrl(url) {
  const limpio = (url || '').trim();
  if (!limpio) return '';
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* Categorías del historial: coinciden con las pestañas del proyecto, para   */
/* poder separar los cambios de Civil, Notas, Control Documental, etc.       */
const HISTORIAL_CATEGORIAS = {
  general: 'General', civil: 'Civil', mecanica: 'Mecánica', geotecnia: 'Geotecnia',
  estructural: 'Estructural', hidraulico: 'Hidráulico', electrico: 'Eléctrico',
  documentos: 'Control Documental', notas: 'Notas', archivos: 'Archivos',
  notas_tecnicas: 'Notas Técnicas',
  estado: 'Estado del proyecto', nombre: 'Nombre del proyecto',
};
function categoriaLabel(cat) {
  return HISTORIAL_CATEGORIAS[cat] || 'General';
}
/* Medianoche del lunes de la semana de "fecha" (para separar "esta semana"  */
/* de cambios anteriores en el historial).                                   */
function inicioDeSemana(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo … 6 = sábado
  const diff = dia === 0 ? 6 : dia - 1; // días desde el lunes
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

/* --------------------- FORMATO DE TEXTO EN NOTAS (mini-sintaxis) ----------- */
/* **negrilla**, *cursiva*, __subrayado__ y líneas que empiezan con "- " para  */
/* viñetas. Se guarda como texto plano (no HTML) y se interpreta solo al       */
/* mostrarlo, para no tener que confiar en HTML crudo guardado por el usuario. */
function renderNoteInline(text, keyPrefix) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2] !== undefined) parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{match[2]}</strong>);
    else if (match[3] !== undefined) parts.push(<u key={`${keyPrefix}-u-${i++}`}>{match[3]}</u>);
    else if (match[4] !== undefined) parts.push(<em key={`${keyPrefix}-i-${i++}`}>{match[4]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
function renderNoteText(texto) {
  const lines = (texto || '').split('\n');
  const blocks = [];
  let currentList = null;
  lines.forEach((line) => {
    if (line.startsWith('- ')) {
      if (!currentList) currentList = [];
      currentList.push(line.slice(2));
    } else {
      if (currentList) {
        blocks.push({ type: 'ul', items: currentList });
        currentList = null;
      }
      blocks.push({ type: 'p', text: line });
    }
  });
  if (currentList) blocks.push({ type: 'ul', items: currentList });

  return blocks.map((b, i) => {
    if (b.type === 'ul') {
      return (
        <ul key={i} className="list-disc pl-5">
          {b.items.map((item, j) => <li key={j}>{renderNoteInline(item, `${i}-${j}`)}</li>)}
        </ul>
      );
    }
    return <p key={i}>{b.text ? renderNoteInline(b.text, `${i}`) : '\u00A0'}</p>;
  });
}

/* Compara los valores "antes" y "después" de una especialidad y devuelve una  */
/* lista de textos legibles, uno por cada campo que realmente cambió.         */
function diffSectionData(section, before, after) {
  const cambios = [];
  section.fields.forEach((field) => {
    const b = before ? before[field.key] : undefined;
    const a = after ? after[field.key] : undefined;
    if (field.type === 'boolean') {
      const bv = b && typeof b === 'object' ? b : { valor: null, nota: '' };
      const av = a && typeof a === 'object' ? a : { valor: null, nota: '' };
      if (bv.valor !== av.valor || (bv.nota || '') !== (av.nota || '')) {
        const fmt = (v) => (v.valor === true ? 'Sí' : v.valor === false ? 'No' : 'sin definir') + (v.nota ? ` (${v.nota})` : '');
        cambios.push(`${field.label}: ${fmt(bv)} → ${fmt(av)}`);
      }
    } else if (field.type === 'stations') {
      if (JSON.stringify(b || []) !== JSON.stringify(a || [])) {
        cambios.push(`${field.label}: se actualizó la tabla de estaciones`);
      }
    } else if (field.type === 'cimentacion') {
      if (JSON.stringify(b || {}) !== JSON.stringify(a || {})) {
        cambios.push(`${field.label}: se actualizaron las dimensiones`);
      }
    } else if ((b || '') !== (a || '')) {
      cambios.push(`${field.label}: "${b || '—'}" → "${a || '—'}"`);
    }
  });
  return cambios;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function findUserByName(directorio, nombre) {
  return directorio.find((u) => u.nombre === nombre) || null;
}

function initialsOf(nombre) {
  return (nombre || '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return prefix + '-' + crypto.randomUUID();
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/* Reconoce youtube.com/watch?v=, youtu.be/, /embed/ y /shorts/ y devuelve  */
/* solo el ID del video, o null si el link no se pudo reconocer.           */
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1].split('/')[0];
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1].split('/')[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}

function projectToRow(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    equipo: p.equipo,
    data: p.data,
    archivos: p.archivos,
    notas: p.notas || [],
    documentos: p.documentos || {},
  };
}
function rowToProject(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    estado: row.estado,
    equipo: row.equipo || {},
    data: row.data || emptySchemaData(),
    archivos: row.archivos || [],
    notas: row.notas || [],
    documentos: row.documentos || {},
  };
}
function rowToProfile(row, roles) {
  return {
    id: row.id,
    nombre: row.nombre,
    foto: row.foto_url,
    fecha_cumpleanos: row.fecha_cumpleanos || '',
    fecha_ingreso: row.fecha_ingreso || '',
    roles: roles || [],
  };
}

/* --------------------------- 4. DATOS SEMILLA -------------------------------- */
/* Se insertan en la base de datos SOLO la primera vez que las tablas están     */
/* vacías, a modo de ejemplo de cómo se ve la app con proyectos reales.        */
const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    nombre: 'Minigranja Solar Guacarí 5MW',
    estado: 'activo',
    equipo: { civil: [], hidraulico: '', estructural: '', electrico: [], geotecnico: '', delineante: [] },
    archivos: [],
    notas: [
      { id: 'nota-1-1', texto: 'Terreno con pendiente suave hacia el costado sur, cercano a canal de riego existente.', autor: 'Sistema', fecha: '2025-03-12T14:30:00.000Z' },
    ],
    documentos: {},
    data: buildData({
      general: {
        municipio: 'Guacarí', departamento: 'Valle del Cauca', pais: 'Colombia',
        inversionista: 'Fondo Energético Andino S.A.S.',
        numero_minigranja: '087', numero_predio: '1',
        magna_sirgas: 'N 923450.12 / E 1056220.44', lat_long: '3.7644 N / -76.3311 W',
        altitud: '1020',
        fecha_inicio: '2025-03-10', fecha_entrega: '2026-02-28',
      },
      civil: {
        arboles_intervenir: '14 (guaduales menores)', area_legal: '68.500', perimetro_legal: '1.120',
        descripcion_acceso: 'Vía terciaria destapada de 2.4 km desde la vía Guacarí - Ginebra, requiere adecuación puntual.',
        mvtos_tierra: bool(true, 'Nivelación general del predio y conformación de pendientes para evitar empozamientos de agua.'),
        topografia_insumo: bool(true), es_insumo: bool(true), zona_viento: 'Zona de viento 1 (Vs = 20 m/s)',
      },
      electrico: {
        planta_fv: '5.0 MWp', potencia_nominal: '4.4 MWac', potencia_pico: '5.0 MWp',
        dc_ac_ratio: '1.14', factor_potencia: '0.99', tipo_estructura: 'Fija inclinada',
      },
    }),
  },
  {
    id: 'proj-2',
    nombre: 'Minigranja El Espinal 3MW',
    estado: 'activo',
    equipo: { civil: [], hidraulico: '', estructural: '', electrico: [], geotecnico: '', delineante: [] },
    archivos: [],
    notas: [],
    documentos: {},
    data: buildData({
      general: {
        municipio: 'El Espinal', departamento: 'Tolima', pais: 'Colombia', inversionista: 'CFM',
        numero_minigranja: '203', numero_predio: '1',
        lat_long: '4.1517 N / -74.8834 W', altitud: '323',
        fecha_inicio: '2026-05-05', fecha_entrega: '2026-11-30',
      },
      civil: { mvtos_tierra: bool(true), topografia_insumo: bool(false), es_insumo: bool(false) },
    }),
  },
  {
    id: 'proj-3',
    nombre: 'Solar Montería 8MW',
    estado: 'pausa',
    equipo: { civil: [], hidraulico: '', estructural: '', electrico: [], geotecnico: '', delineante: [] },
    archivos: [],
    notas: [
      { id: 'nota-3-1', texto: 'Proyecto en pausa por ajustes en el cierre financiero.', autor: 'Sistema', fecha: '2025-09-15T09:00:00.000Z' },
    ],
    documentos: {},
    data: buildData({
      general: {
        municipio: 'Montería', departamento: 'Córdoba', pais: 'Colombia', inversionista: 'FENOGE',
        numero_minigranja: '142', numero_predio: '1',
        fecha_inicio: '2025-08-01', fecha_entrega: '2026-06-15',
      },
      hidraulico: {
        obras_hidraulicas: bool(true), inundabilidad: bool(true, 'Zona con inundaciones ocasionales reportadas por la comunidad en época de lluvias.'),
        cuerpos_agua: bool(true),
        estaciones_pluviometricas: [
          { nombre: 'Estación Montería IDEAM', dias: '210', peso: '100' },
          { nombre: '', dias: '', peso: '' },
          { nombre: '', dias: '', peso: '' },
          { nombre: '', dias: '', peso: '' },
          { nombre: '', dias: '', peso: '' },
          { nombre: '', dias: '', peso: '' },
          { nombre: '', dias: '', peso: '' },
        ],
      },
    }),
  },
];

const INITIAL_LINKS = [
  { id: 'l1', descripcion: 'RETIE - Reglamento Técnico de Instalaciones Eléctricas vigente en Colombia', url: 'https://www.minenergia.gov.co' },
  { id: 'l2', descripcion: 'NSR-10 - Reglamento Colombiano de Construcción Sismo Resistente', url: 'https://www.minvivienda.gov.co' },
  { id: 'l3', descripcion: 'Global Solar Atlas - irradiancia solar por ubicación', url: 'https://globalsolaratlas.info' },
  { id: 'l4', descripcion: 'PVsyst - software de simulación de plantas fotovoltaicas', url: 'https://www.pvsyst.com' },
  { id: 'l5', descripcion: 'IDEAM - datos hidroclimatológicos y estaciones pluviométricas', url: 'http://www.ideam.gov.co' },
  { id: 'l6', descripcion: 'Servicio Geológico Colombiano - amenaza sísmica y estudios geotécnicos', url: 'https://www.sgc.gov.co' },
];

/* ------------------- LISTAS DE CONTROL DOCUMENTAL (por inversionista) ------ */
const DOCS_ESTANDAR = [
  { nombre: 'Layout General', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Topografia', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Vías de acceso', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Canalizaciones y redes', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cerramiento', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cortes en mesas', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Obras de drenaje (si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Análisis de inundabilidad', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de suelos', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Topografía general', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Diseño Vial', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de cerramiento', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de inversores', codigo: 'COLXXXXXXPX-CIV-INF-006', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones Camaras - CCTV', codigo: 'COLXXXXXXPX-CIV-INF-007', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones luminarias', codigo: 'COLXXXXXXPX-CIV-INF-008', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-INF-009', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'ET para estudio de suelos', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'ET para Topografía', codigo: 'COLXXXXXXPX-CIV-ESP-002', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras y cantidades civiles', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Listado' },
  { nombre: 'BOM de estructura de módulos', codigo: 'COLXXXXXXPX-MEC-LIS-001', especialidad: 'MECANICA', tipo: 'Listado' },
  { nombre: 'Estructura Inversores', codigo: 'COLXXXXXXPX-MEC-PL-001', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Estructura de módulos', codigo: 'COLXXXXXXPX-MEC-PL-002', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Ficha técnica estructura de paneles', codigo: 'COLXXXXXXPX-MEC-ESP-001', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Procedimiento de montaje', codigo: 'COLXXXXXXPX-MEC-INF-001', especialidad: 'MECANICA', tipo: 'Informe' },
  { nombre: 'Memoria de estructura de módulos y cimentación', codigo: 'COLXXXXXXPX-MEC-INF-002', especialidad: 'MECANICA', tipo: 'Informe' },
  { nombre: 'BOM de comunicaciones', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de obras de comunicación', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de cables (Tags)', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Inventario de equipos', codigo: 'COLXXXXXXPX-COM-LIS-004', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Informe de Comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Arquitectura', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Diagrama de conexiones', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Comunicacion Inversores y ruta_CCTV', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Cobertura de Camaras', codigo: 'COLXXXXXXPX-COM-PL-004', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha técnica de CCTV (Camaras, NVR)', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de estación meteorológica', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica Equipos de Comunicaciones (Smartlogger, medidor, router, switch, starlink, AccessPoint)', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'BOM eléctrico', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de obras eléctrias', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de Strings', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'SSAA y respaldo', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Cargabilidad CT´s y PT´s', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Documento OR', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Declaración RETIE Diseñador y Constructor', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Proyecto especifico', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de aislamiento', codigo: 'COLXXXXXXPX-ELE-INF-004', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-INF-005', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Riesgo Electrico', codigo: 'COLXXXXXXPX-ELE-INF-006', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Simulación PVsyst', codigo: 'COLXXXXXXPX-ELE-INF-007', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-INF-008', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Arco eléctrico', codigo: 'COLXXXXXXPX-ELE-INF-009', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Estudio de conexión simplificado', codigo: 'COLXXXXXXPX-ELE-INF-010', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de protecciones B.T.', codigo: 'COLXXXXXXPX-ELE-INF-011', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Cableado DC', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC Inversores', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas AC BT/MT', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama Unifilar', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Conexion inversores', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Distribución de equipos en SHELTER', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Tablero de frontera', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Servicios auxiliares en S/E', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Tableros de baja tensión en S/E', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica de Inversores', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Paneles', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Transformador', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica del Shelter', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Reconectador y Relé', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de TC y TP', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Cableado DC, AC de BT y MT', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
];

const DOCS_CFM = [
  { nombre: 'Layout general del proyecto', codigo: 'COLXXXXXXPX-GEN-PL-001', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout ubicación geografica del proyecto', codigo: 'COLXXXXXXPX-GEN-PL-002', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout planta de instalaciones provisionales', codigo: 'COLXXXXXXPX-GEN-PL-003', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout vías de acceso y salida circuito', codigo: 'COLXXXXXXPX-GEN-PL-004', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Informe de visita - equipo de ingenieria', codigo: 'COLXXXXXXPX-GEN-INF-001', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Estudio de ajuste y coordinación de protecciones', codigo: 'COLXXXXXXPX-GEN-INF-002', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Plano de señalizaciones y sistemas contra incendios', codigo: 'COLXXXXXXPX-GEN-PL-005', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Estudio geotecnico', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de CBR - vías', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de corrosividad', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de interferencia Catódica (Si aplica)', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Protocolo Pull Out - Proveedor de Estrructura', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Informe Pull Out', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Ubicación de las Pull Out Test', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe topográfico', codigo: 'COLXXXXXXPX-CIV-INF-006', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Plano o levantamiento topografico (con ortofoto)', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Estudio de resistividad electrica', codigo: 'COLXXXXXXPX-CIV-INF-007', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de hidrologia', codigo: 'COLXXXXXXPX-CIV-INF-008', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Movimiento de Tierra (con secciones por fila de mesas)', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe Movimiento de Tierra (Cantidades de corte y relleno)', codigo: 'COLXXXXXXPX-CIV-INF-009', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Memoria Descriptiva Vías (Incluye Materiales tipo Invias)', codigo: 'COLXXXXXXPX-CIV-MEM-001', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Layout de Vías - Planta General', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano de Vías - Perfiles y secciones transversales', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cantidades de Material - Vías', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Lista de materiales' },
  { nombre: 'Informe Vía de Acceso - Adecuación de Ingreso', codigo: 'COLXXXXXXPX-CIV-INF-0010', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Vía de Acceso - Adecuación de Ingreso', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria Descriptiva y Cálculo de Cerramiento', codigo: 'COLXXXXXXPX-CIV-MEM-002', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano Cerramiento Perimetral y Accesos - General y Detalles', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano Cajas con Despieces y Zanjas Eléctricas - Detalles Generales', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria de cálculo de cajas y zanjas (Si aplica, en casos de que se modifique el diseño original del OR por condiciones del terreno)', codigo: 'COLXXXXXXPX-CIV-MEM-005', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano Cimentación Equipos y Despieces (CTs)', codigo: 'COLXXXXXXPX-CIV-PL-009', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Cimentaciones (CTs)', codigo: 'COLXXXXXXPX-CIV-MEM-003', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Memoria Cálculo Drenaje Aguas Lluvias (si aplica)', codigo: 'COLXXXXXXPX-CIV-MEM-004', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano de Drenaje Aguas Lluvias - General y Detalles (Si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-010', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano Superposición de Zanjas, Vías, Drenajes y Cimentaciones.', codigo: 'COLXXXXXXPX-CIV-PL-011', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Listado de obras civiles', codigo: 'COLXXXXXXPX-CIV-LIS-002', especialidad: 'CIVIL', tipo: 'Lista de materiales' },
  { nombre: 'Plano Esquemático Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-PL-001', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Estructura de Mesas - Entregados por el Proveedor', codigo: 'COLXXXXXXPX-MEC-MEM-001', especialidad: 'MECANICA', tipo: 'Memoria' },
  { nombre: 'Plano Ubicación de Hincas - Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-PL-002', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Listado de Elementos de Mesas de Paneles - Entregado por el Proveedor', codigo: 'COLXXXXXXPX-MEC-LIS-001', especialidad: 'MECANICA', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica de Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-ESP-001', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Plano Esquemático Estructura de Inversores', codigo: 'COLXXXXXXPX-MEC-PL-003', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Estructura de Inversores - Entregados por el Proveedor', codigo: 'COLXXXXXXPX-MEC-MEM-002', especialidad: 'MECANICA', tipo: 'Memoria' },
  { nombre: 'Listado de Elementos de Estructura Inversores - Entregado por el Proveedor', codigo: 'COLXXXXXXPX-MEC-LIS-002', especialidad: 'MECANICA', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica de Estructura de Inversores', codigo: 'COLXXXXXXPX-MEC-ESP-002', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Memoria de Cálculo Eléctrica', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Esquema Unifilar General PSFV', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Simulación de Generación PVSyst (PDF y ZIP)', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Ficha Técnica Panel con Certificado RETIE', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Manual de Instalación del Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Certificados del Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Diagrama Constructivo del Inversor', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexionado del Inversor', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Red MT (Línea o Subterráneo)', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Plano de Planta Red MT y Cámaras de Inspección', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Detalle Conexionado del Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Manual del Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Planos Centro de Transformación - Proveedor o Fabricante', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Red BT DC y AC', codigo: 'COLXXXXXXPX-ELE-MEM-003', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Plano de Planta Red BT DC y AC y Cámaras de Inspección', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Estudio Sistema Puesta Tierra', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Plano Sistema Puesta Tierra', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano Apantallamiento Equipos Mayores', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Listado de Cables DC, AC BT y AC MT', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Detalle Conexión Paneles Solares y Mesas', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexión Inversores y Strings', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ubicación de Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-012', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Esquema Unifilar Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-013', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexionado Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-014', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano Distribución Shelter y Listado de Materiales Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-015', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Fichas Técnicas Celdas MT - SHELTER', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras eléctricas', codigo: 'COLXXXXXXPX-ELE-LIS-007', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 1 - SOLICITUD PARA INCENTIVOS A LA INVERSIÓN EN PROYECTOS DE FNCE', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 2 - GENERALIDADES DEL PROYECTO DE FNCE', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 3 - ESPECIFICACIONES DE ELEMENTOS, EQUIPOS Y/O MAQUINARIA', codigo: 'COLXXXXXXPX-ELE-LIS-004', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 4 - ESPECIFICACIONES DE SERVICIOS', codigo: 'COLXXXXXXPX-ELE-LIS-005', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Certificados de Conformidad Equipos UPME', codigo: 'COLXXXXXXPX-ELE-LIS-006', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Arquitectura de Comunicaciones', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Especificaciones Técnicas Equipos comunicación', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de Elementos comunicación', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Listado de señales', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Memoria Descriptiva comunicaciones', codigo: 'COLXXXXXXPX-COM-MEM-001', especialidad: 'COMUNICACIONES', tipo: 'Memoria' },
  { nombre: 'Plano Constructivo y Conexionado Rack comunicacione', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Protocolo SAT comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Plano de Ruta Cableado Comunicaciones', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha Técnica Fibra Óptica o UTP', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica Smart Logger', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Manual Smart Logger', codigo: 'COLXXXXXXPX-COM-ESP-004', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Especificaciones Técnicas equipos EEMM (Equipos Electrico de Maniobra y Medida)', codigo: 'COLXXXXXXPX-ELE-ESP-008', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de Equipos y accesorios de montaje', codigo: 'COLXXXXXXPX-ELE-LIS-008', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Protocolo SAT Equipos EM', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Montaje Equipos Meteorologicos', codigo: 'COLXXXXXXPX-ELE-PL-016', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Especificación Técnica Sistema de seguridad', codigo: 'COLXXXXXXPX-COM-ESP-005', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Planta General y Detalles Equipos de Seguridad', codigo: 'COLXXXXXXPX-COM-PL-004', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Listado de Señales Equipos de Seguridad', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica equipos sistema de seguridad', codigo: 'COLXXXXXXPX-COM-ESP-006', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
];

const DOCS_FENOGE = [
  { nombre: 'Listado de cables AC y DC (con tags)', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'BOM eléctrico', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de obras eléctrias', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'SSAA y respaldo', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Distancias mínimas y de seguridad', codigo: 'COLXXXXXXPX-ELE-MEM-003', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Cargabilidad CT´s y PT´s', codigo: 'COLXXXXXXPX-ELE-MEM-004', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Documento OR', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'RETIE', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Proyecto especifico', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Etiqueta de cables', codigo: 'COLXXXXXXPX-ELE-INF-004', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Criterios de seleccion de MPPT', codigo: 'COLXXXXXXPX-ELE-INF-005', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de aislamiento', codigo: 'COLXXXXXXPX-ELE-INF-006', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-INF-007', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Riesgo Electrico', codigo: 'COLXXXXXXPX-ELE-INF-008', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Simulación PVsyst', codigo: 'COLXXXXXXPX-ELE-INF-009', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-INF-010', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Arco eléctrico', codigo: 'COLXXXXXXPX-ELE-INF-011', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Disposición física', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Cableado DC', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC-AC-MT', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC Inversores', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas ACBT-MT y AÉREA', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama Unifilar', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama unifilar SSAA', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ruta de Evacuación', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Estructura Inversores', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Conexion inversores', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Distribución de equipos en SHELTER', codigo: 'COLXXXXXXPX-ELE-PL-012', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Celda Frontera o medidor', codigo: 'COLXXXXXXPX-ELE-PL-013', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Soporte de bandeja en Inversores', codigo: 'COLXXXXXXPX-ELE-PL-014', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano de diseño de la red MT', codigo: 'COLXXXXXXPX-ELE-PL-015', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica de Inversores', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Medidor', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Paneles', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Transformador', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Tableros', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Reconectador', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de TC y TP', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Tracker', codigo: 'COLXXXXXXPX-ELE-ESP-008', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'BOM de comunicaciones', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de obras de comunicación', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de cables (Tags)', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Inventario de equipos', codigo: 'COLXXXXXXPX-COM-LIS-004', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de señales', codigo: 'COLXXXXXXPX-COM-LIS-005', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Arquitectura', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Diagrama de conexiones', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Comunicacion Inversores y ruta_CCTV', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha técnica de camaras', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de camaras en S/E', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de smartlogger', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de estación meteorológica', codigo: 'COLXXXXXXPX-COM-ESP-004', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de medidor', codigo: 'COLXXXXXXPX-COM-ESP-005', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de router', codigo: 'COLXXXXXXPX-COM-ESP-006', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de switch', codigo: 'COLXXXXXXPX-COM-ESP-007', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de camaras', codigo: 'COLXXXXXXPX-COM-ESP-008', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de NVR', codigo: 'COLXXXXXXPX-COM-ESP-009', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de starlink', codigo: 'COLXXXXXXPX-COM-ESP-010', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de AccessPoint', codigo: 'COLXXXXXXPX-COM-ESP-011', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Localizaciones y accesos', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Topografia del terreno', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Fijaciones mecánicas', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Caminos internos y vías perimetrales', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Áreas de circulación en el proyecto', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Canalizaciones de Baja y Media tensión; Redes', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cerramiento y Especificaciones generales', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cortes en mesas', codigo: 'COLXXXXXXPX-CIV-PL-009', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-PL-010', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Arquitectonico Shelter', codigo: 'COLXXXXXXPX-CIV-PL-011', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano de obras hidráulicas (Si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-012', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Movimientos de tierras (si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-013', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe hidrológico', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Informe hidráulico (Si aplica)', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de suelos', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Topografía general', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Manual de instalación del tracker', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'ET para estudio de suelos', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'ET para Topografía', codigo: 'COLXXXXXXPX-CIV-ESP-002', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras y cantidades civiles', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Listado' },
  { nombre: 'Analisis de riesgo contra incendios (Si aplica)', codigo: 'COLXXXXXXPX-GEN-INF-001', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Sistema de detección de incendios (Si aplica)', codigo: 'COLXXXXXXPX-GEN-PL-001', especialidad: 'GENERAL', tipo: 'Plano' },
];

/* Estados posibles de un documento en Control Documental. */
const DOC_ESTADOS = [
  'No aplica',
  'Pendiente',
  'En proceso',
  'Revisión interna',
  'Entregado',
  'Aprobado para construcción con comentarios (APCC)',
  'Aprobado para construcción (APC)',
];
const DOC_ESTADO_CONFIG = {
  'No aplica': { bg: 'bg-navy-50', text: 'text-navy-400', dot: 'bg-navy-300', border: 'border-navy-300', ring: 'ring-navy-300' },
  'Pendiente': { bg: 'bg-navy-100', text: 'text-navy-500', dot: 'bg-navy-400', border: 'border-navy-400', ring: 'ring-navy-400' },
  'En proceso': { bg: 'bg-lime-100', text: 'text-lime-700', dot: 'bg-lime-500', border: 'border-lime-500', ring: 'ring-lime-500' },
  'Revisión interna': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-500', ring: 'ring-orange-500' },
  'Entregado': { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-500', ring: 'ring-violet-500' },
  'Aprobado para construcción con comentarios (APCC)': { bg: 'bg-nashville-100', text: 'text-nashville-700', dot: 'bg-nashville-500', border: 'border-nashville-500', ring: 'ring-nashville-500' },
  'Aprobado para construcción (APC)': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500' },
};
/* Mismos colores que arriba, en hexadecimal, para el diagrama de torta (SVG). */
const DOC_ESTADO_HEX = {
  'No aplica': '#9BB0D4',
  'Pendiente': '#6487C4',
  'En proceso': '#C2E723',
  'Revisión interna': '#F97316',
  'Entregado': '#8B5CF6',
  'Aprobado para construcción con comentarios (APCC)': '#61A9D1',
  'Aprobado para construcción (APC)': '#10B981',
};
/* Nombre corto para las píldoras de filtro/resumen, sin el paréntesis largo. */
const DOC_ESTADO_CORTO = {
  'No aplica': 'No aplica',
  'Pendiente': 'Pendiente',
  'En proceso': 'En proceso',
  'Revisión interna': 'Rev. interna',
  'Entregado': 'Entregado',
  'Aprobado para construcción con comentarios (APCC)': 'APCC',
  'Aprobado para construcción (APC)': 'APC',
};

/* Según el inversionista del proyecto, se usa una lista de documentos u otra. */
function pickDocumentList(inversionista) {
  const v = (inversionista || '').trim().toUpperCase();
  if (v === 'CFM') return DOCS_CFM;
  if (v === 'FENOGE') return DOCS_FENOGE;
  return DOCS_ESTANDAR;
}

/* Progreso de Control Documental de un proyecto (conteo por estado), para   */
/* reutilizar en cualquier lado que necesite un resumen — ej. la ficha de    */
/* una persona en Equipo, mostrando el avance de cada proyecto asignado.    */
function computeProjectDocProgress(project) {
  const lista = pickDocumentList(project.data.general?.inversionista);
  const documentos = project.documentos || {};
  const conteoPorEstado = {};
  DOC_ESTADOS.forEach((e) => { conteoPorEstado[e] = 0; });
  lista.forEach((doc) => {
    const estado = (documentos[doc.codigo] && documentos[doc.codigo].estado) || 'Pendiente';
    conteoPorEstado[estado] = (conteoPorEstado[estado] || 0) + 1;
  });
  return { conteoPorEstado, total: lista.length };
}

/* Igual que arriba pero sumando VARIOS proyectos a la vez y separado por     */
/* especialidad — para el resumen por inversionista. "No aplica" se excluye  */
/* del conteo (no se cuenta en el seguimiento, igual que en cada proyecto).  */
function computeEspecialidadProgressMultiProyecto(proyectos) {
  const porEspecialidad = new Map();
  proyectos.forEach((p) => {
    const lista = pickDocumentList(p.data.general?.inversionista);
    const documentos = p.documentos || {};
    lista.forEach((doc) => {
      const estado = (documentos[doc.codigo] && documentos[doc.codigo].estado) || 'Pendiente';
      if (estado === 'No aplica') return;
      if (!porEspecialidad.has(doc.especialidad)) {
        const inicial = {};
        DOC_ESTADOS.forEach((e) => { inicial[e] = 0; });
        porEspecialidad.set(doc.especialidad, inicial);
      }
      porEspecialidad.get(doc.especialidad)[estado] += 1;
    });
  });
  return porEspecialidad;
}

/* Arma el prefijo de código del proyecto (ej. COLBOYT147P1) a partir de los  */
/* campos de General. El departamento ya no se escribe a mano: se busca su   */
/* abreviatura oficial de 3 letras en DEPARTAMENTO_ABREVIATURA según el      */
/* nombre elegido en el selector de Departamento, y siempre se le agrega una */
/* "T" (terreno) después. Si falta algún dato, devuelve '' y el código de     */
/* cada documento se muestra con el placeholder original (COLXXXXXXPX).      */
function buildProjectCode(general) {
  const abrev = DEPARTAMENTO_ABREVIATURA[general.departamento || ''];
  const num = (general.numero_minigranja || '').trim();
  const predio = (general.numero_predio || '').trim();
  if (!abrev || !num || !predio) return '';
  return `COL${abrev}T${num}P${predio}`;
}

/* Nombre del proyecto con el código documental al frente, ej.             */
/* "Confines Occidente - COLSANT215P1". Si el código aún no está completo  */
/* (faltan datos en General), se muestra solo el nombre.                   */
function projectDisplayName(project) {
  const codigo = buildProjectCode(project.data.general);
  return codigo ? `${project.nombre} - ${codigo}` : project.nombre;
}

/* ============================================================================
   5. COMPONENTES DE PRESENTACIÓN
   ============================================================================ */
function StatusBadge({ estado, size = 'md' }) {
  const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.inactivo;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

/* Animación de celebración (confeti + 🎉) cuando un proyecto pasa a         */
/* "Finalizado". Puramente visual y pasajera — no aparece en la hoja de vida */
/* imprimible (usa .no-print).                                              */
const CONFETTI_COLORES = ['#E2FF65', '#8CC3E1', '#152644', '#10B981', '#C2E723', '#61A9D1', '#F59E0B'];
function Confetti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORES[i % CONFETTI_COLORES.length],
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        size: 6 + Math.random() * 6,
        redondo: Math.random() > 0.5,
      })),
    []
  );

  return (
    <div className="no-print fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {piezas.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.redondo ? 1 : 0.4),
            backgroundColor: p.color,
            borderRadius: p.redondo ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl animate-pop-in">🎉</span>
      </div>
    </div>
  );
}

function Avatar({ name, foto, title, size = 'md' }) {
  if (!name) return null;
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-28 h-28 text-3xl' : 'w-9 h-9 text-sm';
  if (foto) {
    return <img src={foto} alt={name} title={title ? `${title}: ${name}` : name} className={`${sizeClass} rounded-full object-cover border-2 border-white shrink-0`} />;
  }
  return (
    <div title={title ? `${title}: ${name}` : name} className={`${sizeClass} rounded-full bg-navy-700 text-white flex items-center justify-center font-bold border-2 border-white shrink-0`}>
      {initialsOf(name)}
    </div>
  );
}

function ReadOnlyValue({ label, value, mono = true }) {
  const isEmpty = value === '' || value === null || value === undefined;
  return (
    <div className="py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${isEmpty ? 'text-navy-300 italic' : 'text-navy-700'} whitespace-pre-wrap break-words`}>
        {isEmpty ? 'Sin definir' : value}
      </p>
    </div>
  );
}

function AddableSelect({ value, opciones, onChange, onAddNew, placeholderNuevo, etiquetaAgregar }) {
  const [showAdd, setShowAdd] = useState(false);
  const [nuevo, setNuevo] = useState('');

  function confirmarNuevo() {
    const nombre = nuevo.trim();
    if (!nombre) {
      setShowAdd(false);
      return;
    }
    onAddNew(nombre);
    onChange(nombre);
    setNuevo('');
    setShowAdd(false);
  }

  const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  if (showAdd) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmarNuevo();
            }
            if (e.key === 'Escape') setShowAdd(false);
          }}
          placeholder={placeholderNuevo}
          className={baseInput}
        />
        <button type="button" onClick={confirmarNuevo} title="Guardar" className="text-emerald-600 hover:text-emerald-700 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setShowAdd(false)} title="Cancelar" className="text-navy-400 hover:text-navy-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const registrado = !value || opciones.includes(value);
  return (
    <select
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === '__nuevo__') {
          setShowAdd(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={baseInput}
    >
      <option value="">Sin definir</option>
      {opciones.map((op) => (
        <option key={op} value={op}>{op}</option>
      ))}
      {!registrado && <option value={value}>{value} (no registrado)</option>}
      <option value="__nuevo__">{etiquetaAgregar}</option>
    </select>
  );
}

function InversionistaPicker({ value, inversionistas, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={inversionistas}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo inversionista"
      etiquetaAgregar="+ Agregar nuevo inversionista…"
    />
  );
}

function PaisPicker({ value, paises, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={paises}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo país"
      etiquetaAgregar="+ Agregar nuevo país…"
    />
  );
}

function ProveedorPicker({ value, proveedores, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={proveedores}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo proveedor"
      etiquetaAgregar="+ Agregar nuevo proveedor…"
    />
  );
}

function MallaPicker({ value, mallas, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={mallas}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo tipo de malla"
      etiquetaAgregar="+ Agregar nuevo tipo de malla…"
    />
  );
}

/* Resistencias de concreto más usadas + opción de escribir otra, compartida  */
/* por TODAS las cimentaciones (shelter, inversores, cerramiento, portón,     */
/* luminarias, CCTV, postes) — sin valor por defecto a propósito, para no     */
/* afectar especialidades fuera del alcance de esta funcionalidad.            */
const RESISTENCIA_OPCIONES = ['21 MPa', '24 MPa', '28 MPa', '31 MPa', '35 MPa'];
function ResistenciaSelect({ value, onChange, className }) {
  return (
    <SelectOrOtro
      value={value}
      opciones={RESISTENCIA_OPCIONES}
      onChange={onChange}
      className={className}
      placeholder="Ej. 28 MPa"
    />
  );
}

/* Calibre de barra de refuerzo. Las 4 opciones con datos conocidos de       */
/* gancho/peso (ver BARRA_ACERO) + "otro" para casos fuera de tabla — en ese */
/* caso los cálculos de peso simplemente no se pueden hacer (se muestra —). */
function CalibreSelect({ value, onChange, className }) {
  return (
    <SelectOrOtro
      value={value}
      opciones={CALIBRES_DISPONIBLES}
      onChange={onChange}
      className={className}
      placeholder="Ej. #4"
    />
  );
}

/* Los 6 tipos de cimentación de la sección "Cimentaciones" (plantillas       */
/* reutilizables entre proyectos), ordenados de menos a más complejo. Se van  */
/* construyendo de a uno — "disponible: false" muestra un aviso de "muy      */
/* pronto" en vez del formulario, sin quitar el tipo de la lista.            */
const CIMENTACION_TIPOS = [
  { id: 'postes_mt', label: 'Postes MT', icon: CircleDot, disponible: true },
  { id: 'luminarias', label: 'Luminarias', icon: Lightbulb, disponible: true },
  { id: 'camaras', label: 'Cámaras', icon: Video, disponible: true },
  { id: 'inversores', label: 'Inversores', icon: Zap, disponible: true },
  { id: 'cerramiento_postes', label: 'Cerramiento · Postes', icon: CircleDot, disponible: true },
  { id: 'cerramiento_porton', label: 'Cerramiento · Portón', icon: Building2, disponible: true },
  { id: 'cerramiento_paso_fauna', label: 'Cerramiento · Paso de fauna', icon: Home, disponible: true },
  { id: 'shelter_ct', label: 'Shelter · Centro de Transformación', icon: Zap, disponible: true },
  { id: 'shelter_trampa_aceite', label: 'Shelter · Trampa de aceite', icon: Home, disponible: true },
];

/* Parámetros fijos de acero de refuerzo para TODAS las cimentaciones:        */
/* recubrimiento siempre 7.5cm, y por calibre — longitud de gancho estándar  */
/* y peso por metro (usados para calcular longitudes y pesos de barras).     */
/* Estas son las constantes de acero POR DEFECTO (usadas si el desarrollador */
/* aún no ha guardado sus propios valores en Supabase — ver                 */
/* "aplicarParametrosIngenieria" más abajo, que sobreescribe su CONTENIDO   */
/* en tiempo real cuando cargan los datos reales). "let" en el recubrimiento */
/* y mutación de los objetos (no reasignación) es justamente para que TODO  */
/* el código que ya usa estas constantes vea el valor actualizado sin tener */
/* que tocar cada función que las usa.                                     */
let RECUBRIMIENTO_CIMENTACION = 0.075;
const BARRA_ACERO = {
  '#3': { gancho: 0.10, peso: 0.56 },
  '#4': { gancho: 0.20, peso: 0.994 },
  '#5': { gancho: 0.25, peso: 1.552 },
  '#6': { gancho: 0.30, peso: 2.235 },
};
/* Traslapos tipo B a tensión (NSR-10), por calibre y resistencia del        */
/* concreto — ya redondeados hacia arriba al múltiplo de 0.05 m más         */
/* cercano. Solo cubre 21/28/35 MPa (los valores de la tabla oficial); si    */
/* la plantilla usa otra resistencia, el traslapo simplemente no se puede   */
/* calcular (se muestra "—").                                               */
const TRASLAPO_TABLE = {
  '#3': { '21 MPa': 0.55, '28 MPa': 0.50, '35 MPa': 0.45 },
  '#4': { '21 MPa': 0.75, '28 MPa': 0.65, '35 MPa': 0.60 },
  '#5': { '21 MPa': 0.95, '28 MPa': 0.80, '35 MPa': 0.70 },
  '#6': { '21 MPa': 1.10, '28 MPa': 0.95, '35 MPa': 0.85 },
};
const CALIBRES_DISPONIBLES = Object.keys(BARRA_ACERO);

/* Sobreescribe el CONTENIDO (no la referencia) de las constantes de acero   */
/* con lo que el desarrollador haya guardado en Supabase — así todo el      */
/* código que ya las usa (calcularLongitudinales, calcularEstribos, etc.)   */
/* ve el valor actualizado sin necesidad de tocar cada función.            */
function aplicarParametrosIngenieria(datos) {
  if (!datos) return;
  if (typeof datos.recubrimiento === 'number') RECUBRIMIENTO_CIMENTACION = datos.recubrimiento;
  if (datos.barras) {
    Object.keys(BARRA_ACERO).forEach((k) => delete BARRA_ACERO[k]);
    Object.assign(BARRA_ACERO, datos.barras);
  }
  if (datos.traslapos) {
    Object.keys(TRASLAPO_TABLE).forEach((k) => delete TRASLAPO_TABLE[k]);
    Object.assign(TRASLAPO_TABLE, datos.traslapos);
  }
}

/* Traslapo (m) para el calibre y resistencia dados, o null si no hay dato   */
/* en la tabla para esa combinación (resistencia fuera de 21/28/35 MPa, o    */
/* "Otro").                                                                  */
function obtenerTraslapo(calibre, resistencia) {
  const fila = TRASLAPO_TABLE[calibre];
  if (!fila) return null;
  const valor = fila[resistencia];
  return typeof valor === 'number' ? valor : null;
}

/* Barras longitudinales de un pedestal: longitud = altura - 2×recubrimiento */
/* + (N.° de ganchos × longitud de gancho de ese calibre). Devuelve null si  */
/* falta algún dato o el calibre no está en la tabla (ej. "Otro").          */
function calcularLongitudinales({ altura, cantidad, calibre, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const alturaNum = parseFloat(altura);
  const cantidadNum = parseFloat(cantidad);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !alturaNum || !cantidadNum) return null;
  const longitud = alturaNum - 2 * RECUBRIMIENTO_CIMENTACION + ganchosNum * info.gancho;
  const pesoBarra = longitud * info.peso;
  const pesoPedestal = pesoBarra * cantidadNum;
  return { longitud, pesoBarra, pesoPedestal, pesoTotal: pesoPedestal * 2, cantidad: cantidadNum };
}

/* Estribos de un pedestal: cantidad = altura/separación + 1 (redondeando    */
/* hacia arriba). Longitud = 2×(ancho+profundo−4×recubrimiento) + 2×gancho.  */
function calcularEstribos({ altura, ancho, profundo, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const alturaNum = parseFloat(altura);
  const anchoNum = parseFloat(ancho);
  const profundoNum = parseFloat(profundo);
  const separacionNum = parseFloat(separacion);
  if (!info || !alturaNum || !anchoNum || !profundoNum || !separacionNum) return null;
  const cantidad = Math.ceil((alturaNum - 2 * RECUBRIMIENTO_CIMENTACION) / separacionNum);
  const longitud = 2 * (anchoNum + profundoNum - 4 * RECUBRIMIENTO_CIMENTACION) + 2 * info.gancho;
  const pesoEstribo = longitud * info.peso;
  const pesoPedestal = pesoEstribo * cantidad;
  return { cantidad, longitud, pesoEstribo, pesoPedestal, pesoTotal: pesoPedestal * 2 };
}

/* Parrilla de acero de la zapata del Portón: barras en las dos direcciones, */
/* cada una con 2 ganchos hacia arriba. La CANTIDAD ya no se digita — se     */
/* calcula sola con la misma fórmula que diste: techo[(x−2a)/b)], SIN +1.   */
/* Convención: las barras "longitudinales" corren a lo largo de "largo" y   */
/* se reparten a lo ANCHO de la zapata; las "transversales" corren a lo     */
/* ancho y se reparten a lo LARGO. Cada barra lleva 2 ganchos (uno en cada  */
/* extremo, apuntando hacia arriba).                                        */
function calcularParrillaZapata({ ancho, largo, longitudinal, transversal }) {
  const anchoNum = parseFloat(ancho);
  const largoNum = parseFloat(largo);
  const resultado = {};

  const infoLong = BARRA_ACERO[longitudinal?.calibre];
  const sepLong = parseFloat(longitudinal?.separacion);
  if (anchoNum && largoNum && infoLong && sepLong) {
    const cantidad = Math.ceil((anchoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepLong);
    const longitudBarra = largoNum - 2 * RECUBRIMIENTO_CIMENTACION + 2 * infoLong.gancho;
    const pesoBarra = longitudBarra * infoLong.peso;
    resultado.longitudinal = { cantidad, longitud: longitudBarra, pesoBarra, pesoTotal: pesoBarra * cantidad };
  }

  const infoTrans = BARRA_ACERO[transversal?.calibre];
  const sepTrans = parseFloat(transversal?.separacion);
  if (anchoNum && largoNum && infoTrans && sepTrans) {
    const cantidad = Math.ceil((largoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepTrans);
    const longitudBarra = anchoNum - 2 * RECUBRIMIENTO_CIMENTACION + 2 * infoTrans.gancho;
    const pesoBarra = longitudBarra * infoTrans.peso;
    resultado.transversal = { cantidad, longitud: longitudBarra, pesoBarra, pesoTotal: pesoBarra * cantidad };
  }

  return resultado;
}

/* Barras longitudinales de la viga de amarre: 8 piezas en total (4 líneas —  */
/* 2 arriba, 2 abajo en las esquinas de la sección — cada línea formada por  */
/* 2 piezas traslapadas a la mitad del recorrido). El acero va de centro a   */
/* centro de zapata, por eso cada pieza mide (separación + traslapo)/2. El   */
/* traslapo sale de la tabla NSR-10 según calibre y resistencia.            */
/* Traslapo de las barras superiores/inferiores a TERCIOS del recorrido —    */
/* no a la mitad — y con el traslapo de arriba y de abajo en tercios         */
/* distintos (arriba en L/3, abajo en 2L/3) para no debilitar la misma       */
/* sección con dos empalmes encimados. Con esto, cada línea (2 arriba +      */
/* 2 abajo = 4 líneas) queda formada por UNA pieza corta (≈L/3) y UNA pieza  */
/* larga (≈2L/3), cada una con medio traslapo de más para poder solaparse.  */
function calcularBarrasVigaAmarre({ separacionCentros, calibre, resistencia, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const L = parseFloat(separacionCentros);
  const traslapo = obtenerTraslapo(calibre, resistencia);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !L || traslapo === null) return null;
  const extraGancho = ganchosNum * info.gancho; // el gancho va en el extremo que ancla en la zapata, no en el del traslapo
  const piezaCorta = L / 3 + traslapo / 2 + extraGancho;
  const piezaLarga = (2 * L) / 3 + traslapo / 2 + extraGancho;
  const pesoCorta = piezaCorta * info.peso;
  const pesoLarga = piezaLarga * info.peso;
  // 4 líneas (2 arriba + 2 abajo), cada una con 1 pieza corta + 1 larga = 8 piezas en total.
  const piezasPorTipo = 4;
  return {
    traslapo,
    piezaCorta,
    piezaLarga,
    piezasPorTipo,
    piezas: piezasPorTipo * 2,
    pesoTotal: (pesoCorta + pesoLarga) * piezasPorTipo,
  };
}

/* Volúmenes combinados de TODO el conjunto Portón (2 zapatas + viga que las */
/* une + 2 pedestales encima). El pedestal no aporta a excavación ni a      */
/* solado — su tramo enterrado ya queda dentro de la excavación/solado de   */
/* la zapata; solo aporta su propio concreto (la parte que sobresale de la  */
/* zapata).                                                                  */
function calcularVolumenesPorton({ zapata, viga, pedestal, separacionZapatas, desplante, espesorSolado }) {
  const zAncho = parseFloat(zapata.ancho) || 0;
  const zLargo = parseFloat(zapata.largo) || 0;
  const zEspesor = parseFloat(zapata.espesor) || 0;
  const vAncho = parseFloat(viga.ancho) || 0;
  const vAlto = parseFloat(viga.alto) || 0;
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const desp = parseFloat(desplante) || 0;
  const pAltura = Math.max(0, desp - zEspesor); // altura del pedestal = desplante − espesor de zapata
  const separacion = parseFloat(separacionZapatas) || 0;
  const esp = parseFloat(espesorSolado) || 0;
  if (!zAncho || !zLargo || !separacion) return null;

  const distanciaCarasInternas = Math.max(0, separacion - zLargo);
  const longitudViga = separacion - zLargo; // la viga corre entre las caras internas de las zapatas

  const concretoZapatas = zAncho * zLargo * zEspesor * 2;
  const concretoViga = longitudViga > 0 ? vAncho * vAlto * longitudViga : 0;
  const concretoPedestales = pAncho * pProfundo * pAltura * 2;

  const huellaConjunto = zAncho * zLargo * 2 + distanciaCarasInternas * vAncho;
  const profundidad = desp + esp;

  return {
    concreto: concretoZapatas + concretoViga + concretoPedestales,
    excavacion: huellaConjunto * profundidad,
    solado: huellaConjunto * esp,
    longitudViga,
  };
}

/* ============================================================ */
/* SHELTER · CENTRO DE TRANSFORMACIÓN (CT) — 4 pedestales iguales */
/* + 4 vigas (2 largas, 2 cortas) formando un marco. Sin zapata.  */
/* ============================================================ */

/* Barras longitudinales de una viga del CT: son CONTINUAS (sin traslapo,    */
/* a diferencia del Portón) — van de cara externa a cara externa de los     */
/* pedestales, para asegurar el cruce del acero en las esquinas. La         */
/* "dimensión del pedestal" que se suma es la que corre en la MISMA         */
/* dirección que la viga (así, para una viga larga se suma el profundo del  */
/* pedestal; para una corta, el ancho).                                     */
function calcularBarrasVigaCT({ longitudCentros, dimensionPedestalMismaDireccion, cantidad, calibre, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const L = parseFloat(longitudCentros);
  const dimPed = parseFloat(dimensionPedestalMismaDireccion);
  const cantidadNum = parseFloat(cantidad);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !L || !cantidadNum) return null;
  const longitud = L + (dimPed || 0) + ganchosNum * info.gancho;
  const pesoBarra = longitud * info.peso;
  return { longitud, pesoBarra, pesoTotal: pesoBarra * cantidadNum, cantidad: cantidadNum };
}

/* Volúmenes del conjunto CT: 4 pedestales (con su propio solado, como los   */
/* de Postes MT/Inversores — sin zapata) + 4 vigas (2 largas + 2 cortas,     */
/* corriendo entre las caras INTERNAS de los pedestales — su propio         */
/* concreto no incluye lo que ya cuenta el pedestal). Solo los pedestales    */
/* se excavan; las vigas quedan al nivel del terreno natural (su parte de    */
/* arriba coincide con el N.T.N.), igual que la losa de Inversores.         */
function calcularVolumenesCT({ ancho, largo, pedestal, viga, desplante, sobresaliente, espesorSolado }) {
  const anchoNum = parseFloat(ancho) || 0;
  const largoNum = parseFloat(largo) || 0;
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const vAncho = parseFloat(viga.ancho) || 0;
  const vAlto = parseFloat(viga.alto) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesorSolado) || 0;
  if (!anchoNum || !largoNum || !pAncho || !pProfundo) return null;

  const alturaPedestal = desp + sobre; // el N.T.N. coincide con la parte de arriba de la viga
  const areaPedestal = pAncho * pProfundo;
  const concretoPedestales = areaPedestal * alturaPedestal * 4;

  const longitudLibreLarga = Math.max(0, largoNum - pProfundo);
  const longitudLibreCorta = Math.max(0, anchoNum - pAncho);
  const concretoVigas = vAncho * vAlto * (longitudLibreLarga * 2 + longitudLibreCorta * 2);

  return {
    concreto: concretoPedestales + concretoVigas,
    excavacion: areaPedestal * (desp + esp) * 4, // solo los pedestales
    solado: areaPedestal * esp * 4,
    alturaPedestal,
    longitudLibreLarga,
    longitudLibreCorta,
  };
}

/* Perímetro de acero "centrado" en el espesor de pared — no el exterior ni  */
/* el interior, sino el que realmente recorre la barra dentro del muro.    */
function perimetroCentradoTrampa(ancho, profundo, espesorPared) {
  return 2 * (ancho - espesorPared) + 2 * (profundo - espesorPared);
}

/* Anillos horizontales de la trampa de aceite: continuos, con un gancho a  */
/* 180° en CADA extremo. La cantidad se calcula igual que los estribos      */
/* (altura − 2×recubrimiento, entre la separación).                        */
function calcularAnillosTrampa({ ancho, profundo, alto, espesorPared, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const anchoNum = parseFloat(ancho);
  const profundoNum = parseFloat(profundo);
  const altoNum = parseFloat(alto);
  const espPared = parseFloat(espesorPared);
  const sepNum = parseFloat(separacion);
  if (!info || !anchoNum || !profundoNum || !altoNum || !espPared || !sepNum) return null;
  const cantidad = Math.ceil((altoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepNum);
  const perimetro = perimetroCentradoTrampa(anchoNum, profundoNum, espPared);
  const longitud = perimetro + 2 * info.gancho;
  const pesoAnillo = longitud * info.peso;
  return { cantidad, longitud, pesoAnillo, pesoTotal: pesoAnillo * cantidad };
}

/* Barras verticales en "U" de la trampa de aceite: bajan por una pared,     */
/* cruzan la losa y suben por la pared opuesta, con gancho a 180° en cada   */
/* extremo de arriba. "direccion" define cuál par de paredes conectan       */
/* (largo → paredes largas, separadas por el ancho; corto → paredes         */
/* cortas, separadas por el profundo) — la cantidad de piezas se reparte a  */
/* lo largo de la dirección PERPENDICULAR, con la misma fórmula que la      */
/* parrilla de la zapata del Portón.                                       */
function calcularUTrampa({ dimensionTransversal, dimensionReparto, alto, espesorPared, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const dimTrans = parseFloat(dimensionTransversal);
  const dimRep = parseFloat(dimensionReparto);
  const altoNum = parseFloat(alto);
  const espPared = parseFloat(espesorPared);
  const sepNum = parseFloat(separacion);
  if (!info || !dimTrans || !dimRep || !altoNum || !espPared || !sepNum) return null;
  const cantidad = Math.ceil((dimRep - 2 * RECUBRIMIENTO_CIMENTACION) / sepNum);
  const pata = altoNum - RECUBRIMIENTO_CIMENTACION; // una sola pata: el otro "extremo" continúa hacia la losa, no lleva recubrimiento doble
  const tramoInferior = dimTrans - espPared; // centrado en el espesor de las paredes que conecta
  const longitud = 2 * pata + tramoInferior + 2 * info.gancho;
  const pesoBarra = longitud * info.peso;
  return { cantidad, longitud, pesoBarra, pesoTotal: pesoBarra * cantidad };
}

/* Volúmenes de la trampa de aceite: una caja de concreto (4 paredes + losa  */
/* inferior, sin losa superior) — se calcula como el bloque sólido exterior */
/* menos el hueco interior (que empieza encima de la losa).                */
function calcularVolumenesTrampa({ ancho, profundo, alto, espesorPared, espesorLosa, espesorSolado }) {
  const anchoNum = parseFloat(ancho) || 0;
  const profundoNum = parseFloat(profundo) || 0;
  const altoNum = parseFloat(alto) || 0;
  const espPared = parseFloat(espesorPared) || 0;
  const espLosa = parseFloat(espesorLosa) || 0;
  const espSolado = parseFloat(espesorSolado) || 0;
  if (!anchoNum || !profundoNum || !altoNum) return null;

  const volSolido = anchoNum * profundoNum * altoNum;
  const anchoHueco = Math.max(0, anchoNum - 2 * espPared);
  const profundoHueco = Math.max(0, profundoNum - 2 * espPared);
  const altoHueco = Math.max(0, altoNum - espLosa);
  const volHueco = anchoHueco * profundoHueco * altoHueco;

  return {
    concreto: volSolido - volHueco,
    excavacion: anchoNum * profundoNum * (altoNum + espSolado),
    solado: anchoNum * profundoNum * espSolado,
  };
}

/* Volúmenes (concreto, excavación, solado) de un elemento CILÍNDRICO         */
/* (Postes MT): concreto = área × altura total; excavación = área ×          */
/* desplante (solo la parte enterrada); solado = área × su espesor. El       */
/* solado tiene la MISMA sección que el elemento (sin sobresalir).          */
function calcularVolumenesCilindro({ diametro, desplante, sobresaliente, espesor_solado }) {
  const d = parseFloat(diametro) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesor_solado) || 0;
  if (!d) return null;
  const areaSeccion = Math.PI * (d / 2) * (d / 2);
  const alturaTotal = desp + sobre;
  return {
    areaSeccion,
    concreto: areaSeccion * alturaTotal,
    excavacion: areaSeccion * (desp + esp), // la excavación llega hasta el fondo del solado, no solo el desplante
    solado: areaSeccion * esp,
  };
}

/* Lo mismo, pero para un elemento de sección RECTANGULAR (Luminarias,       */
/* Cámaras, y los pedestales de Inversores).                                 */
function calcularVolumenesPrisma({ ancho, profundo, desplante, sobresaliente, espesor_solado }) {
  const a = parseFloat(ancho) || 0;
  const p = parseFloat(profundo) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesor_solado) || 0;
  if (!a || !p) return null;
  const areaSeccion = a * p;
  const alturaTotal = desp + sobre;
  return {
    areaSeccion,
    concreto: areaSeccion * alturaTotal,
    excavacion: areaSeccion * (desp + esp), // la excavación llega hasta el fondo del solado, no solo el desplante
    solado: areaSeccion * esp,
  };
}

/* Panel de resumen de volúmenes (concreto, excavación, solado), reutilizado */
/* en todas las plantillas de cimentación.                                  */
/* Volúmenes de Inversores: 2 pedestales iguales + 1 losa. La losa va sobre  */
/* el nivel de terreno natural, así que NO cuenta en la excavación — esa    */
/* solo se calcula con los pedestales.                                      */
function calcularVolumenesInversores({ pedestal, losa }) {
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const desplante = parseFloat(pedestal.desplante) || 0;
  const sobresaliente = parseFloat(pedestal.sobresaliente) || 0;
  const espSolado = parseFloat(pedestal.espesor_solado) || 0;
  const lAncho = parseFloat(losa.ancho) || 0;
  const lLargo = parseFloat(losa.largo) || 0;
  const lEspesor = parseFloat(losa.espesor) || 0;
  if (!pAncho || !pProfundo) return null;

  const areaPedestal = pAncho * pProfundo;
  const alturaPedestal = desplante + sobresaliente;
  const volConcretoPedestales = areaPedestal * alturaPedestal * 2;
  const volConcretoLosa = lAncho && lLargo && lEspesor ? lAncho * lLargo * lEspesor : 0;

  return {
    concreto: volConcretoPedestales + volConcretoLosa,
    excavacion: areaPedestal * (desplante + espSolado) * 2, // solo los pedestales (hasta el fondo del solado) — la losa no se excava
    solado: areaPedestal * espSolado * 2,
  };
}

function ResumenVolumenes({ volumenes, pesoAcero, titulo = 'Cantidades de obra' }) {
  if (!volumenes) return null;
  return (
    <div className="mt-4 bg-lime-50 border border-lime-200 rounded-lg px-4 py-3">
      <p className="text-sm font-semibold text-navy-700 mb-2">{titulo}</p>
      <div className={pesoAcero !== undefined ? 'grid grid-cols-1 sm:grid-cols-4 gap-2' : 'grid grid-cols-1 sm:grid-cols-3 gap-2'}>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de concreto</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.concreto.toFixed(3)} m³</span>
        </div>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de excavación</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.excavacion.toFixed(3)} m³</span>
        </div>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de solado</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.solado.toFixed(3)} m³</span>
        </div>
        {pesoAcero !== undefined && (
          <div className="flex items-center justify-between sm:block">
            <span className="text-xs text-navy-500">Peso de acero</span>
            <span className="font-mono font-bold text-navy-800 sm:block">{pesoAcero.toFixed(2)} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Lienzo y escala COMPARTIDOS por las 3 vistas de Postes MT, para que se     */
/* vean alineadas entre sí (mismo tamaño en pantalla = mismo tamaño real).   */
const POSTE_VB_W = 200;
const POSTE_VB_H = 195;
const POSTE_M2PX = 80;
const POSTE_CSS_SIZE = 'w-56 h-56';

/* Dibujo tipo plano técnico (líneas negras, sin relleno de color) de un      */
/* poste MT: cilindro + solado de limpieza (mismo cilindro, más corto) +     */
/* cotas de diámetro y altura + nivel de terreno natural (como un plano      */
/* elíptico, coherente con la perspectiva del cilindro). No es a escala      */
/* exacta, solo ilustrativo.                                                 */
function PostesMtPreview({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const diamPx = clamp((diametro || 0.3) * POSTE_M2PX, 28, 85);
  const rx = diamPx / 2;
  const ry = rx * 0.32;
  const alturaPx = clamp((altura || 0.3) * POSTE_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * POSTE_M2PX, 5, 11);

  const cx = POSTE_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;
  const groundRx = rx + 20;
  const groundRy = ry + (ry / rx) * 20;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      {/* Solado de limpieza: misma huella (mismo diámetro), solo más corto */}
      <g>
        <line x1={cx - rx} y1={botY} x2={cx - rx} y2={soladoBotY} stroke="#152644" strokeWidth="1.1" />
        <line x1={cx + rx} y1={botY} x2={cx + rx} y2={soladoBotY} stroke="#152644" strokeWidth="1.1" />
        <ellipse cx={cx} cy={soladoBotY} rx={rx} ry={ry} fill="#F6F7F9" stroke="#152644" strokeWidth="1.1" />
      </g>
      {/* Cuerpo del cilindro (poste) */}
      <line x1={cx - rx} y1={topY} x2={cx - rx} y2={botY} stroke="#152644" strokeWidth="1.3" />
      <line x1={cx + rx} y1={topY} x2={cx + rx} y2={botY} stroke="#152644" strokeWidth="1.3" />
      <ellipse cx={cx} cy={botY} rx={rx} ry={ry} fill="none" stroke="#152644" strokeWidth="1.3" />
      <ellipse cx={cx} cy={topY} rx={rx} ry={ry} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Nivel de terreno natural: un plano (elipse) que atraviesa el poste, no una línea recta */}
      <ellipse cx={cx} cy={groundY} rx={groundRx} ry={groundRy} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - groundRx - 4} y={groundY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de diámetro */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - rx} y1={soladoBotY + ry + 18} x2={cx + rx} y2={soladoBotY + ry + 18} />
        <line x1={cx - rx} y1={soladoBotY + ry + 14} x2={cx - rx} y2={soladoBotY + ry + 22} />
        <line x1={cx + rx} y1={soladoBotY + ry + 14} x2={cx + rx} y2={soladoBotY + ry + 22} />
      </g>
      <text x={cx} y={soladoBotY + ry + 35} textAnchor="middle" fontSize="10" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + rx + 40} y1={topY} x2={cx + rx + 40} y2={botY} />
        <line x1={cx + rx + 36} y1={topY} x2={cx + rx + 44} y2={topY} />
        <line x1={cx + rx + 36} y1={botY} x2={cx + rx + 44} y2={botY} />
      </g>
      <text
        x={cx + rx + 50}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + rx + 50}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D, sin perspectiva): un rectángulo   */
/* — ancho = diámetro, alto = altura total — con el solado, el nivel de     */
/* terreno (aquí sí una línea recta, porque es una vista plana real) y las   */
/* cotas de ancho y alto. Usa el mismo lienzo/escala que el isométrico para  */
/* que las tres vistas se vean alineadas entre sí.                          */
function PostesMtSeccionLongitudinal({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((diametro || 0.3) * POSTE_M2PX, 30, 100);
  const alturaPx = clamp((altura || 0.3) * POSTE_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * POSTE_M2PX, 5, 11);

  const cx = POSTE_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      {/* Solado */}
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Cuerpo (vista frontal) */}
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Nivel de terreno natural (línea recta: aquí sí es correcto, es una vista plana) */}
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho (diámetro) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
      {/* Cota de alto */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un círculo con la cota del      */
/* diámetro. Mismo lienzo/escala que las otras dos vistas.                  */
function PostesMtSeccionTransversal({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rr = clamp((diametro || 0.3) * POSTE_M2PX, 28, 85) / 2;

  const cx = POSTE_VB_W / 2;
  const cy = POSTE_VB_H / 2 - 10;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      <circle cx={cx} cy={cy} r={rr} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - rr} y1={cy} x2={cx + rr} y2={cy} stroke="#152644" strokeWidth="1" />
      <line x1={cx - rr} y1={cy - 5} x2={cx - rr} y2={cy + 5} stroke="#152644" strokeWidth="1" />
      <line x1={cx + rr} y1={cy - 5} x2={cx + rr} y2={cy + 5} stroke="#152644" strokeWidth="1" />
      <text x={cx} y={cy + rr + 20} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas (isométrico + las 2 secciones 2D) lado a lado, cada     */
/* una con su etiqueta — así se ve como un plano técnico real.              */
function PostesMtVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <PostesMtPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <PostesMtSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <PostesMtSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

function PostesMtForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { diametro: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesCilindro(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Postes MT
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <PostesMtVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Poste MT Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Diámetro (m)</label>
            <input value={datos.diametro} onChange={(e) => set('diametro', e.target.value)} placeholder="0.30" className={cellInput} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="1.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* Lienzo y escala compartidos por las 3 vistas de Luminarias — mismo         */
/* criterio que Postes MT, pero con sección cuadrada (isométrico con caja    */
/* rectangular en vez de cilindro).                                          */
const LUMI_VB_W = 200;
const LUMI_VB_H = 195;
const LUMI_M2PX = 80;
const LUMI_CSS_SIZE = 'w-56 h-56';

/* Isométrico de una cimentación de sección rectangular (o cuadrada, si       */
/* ancho = profundo): caja + solado (misma forma, un poco más ancha y corta) */
/* + plano de terreno natural (un paralelogramo coherente con la perspectiva) */
/* + cotas independientes de ancho y profundo (una en cada borde visible de   */
/* la base) + cota de altura.                                                */
function LuminariasPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 26, 65);
  const profundoPx = clamp((profundo || 0.3) * LUMI_M2PX, 26, 65);
  const alturaPx = clamp((altura || 0.3) * LUMI_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * LUMI_M2PX, 5, 11);
  const groundFrac = altura > 0 ? desplante / altura : 0;

  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const bodyZ0 = soladoPx;
  const bodyZ1 = soladoPx + alturaPx;
  const groundZ = soladoPx + groundFrac * alturaPx;

  const ox = LUMI_VB_W / 2;
  const oy = 18 + Math.max(halfW, halfD) + bodyZ1;

  const soladoHalfW = halfW;
  const soladoHalfD = halfD;
  const groundHalfW = halfW + 16;
  const groundHalfD = halfD + 16;

  const [groundLeftX, groundLeftY] = isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy);
  const groundPlane = poly([
    isoPt(-groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, groundHalfD, groundZ, ox, oy),
    isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy),
  ]);

  // Los puntos reales de la base que nos importan: la esquina más cercana
  // (donde se juntan los dos bordes visibles) y sus dos vecinas.
  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], bodyZ0, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], bodyZ0, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], bodyZ0, ox, oy);

  // Cada cota se dibuja PARALELA a su propio borde, desplazada hacia afuera
  // en el eje del modelo correspondiente (no en pantalla) — así una queda
  // "hacia el frente" (ancho) y la otra "hacia la derecha" (profundo), sin
  // que sus etiquetas choquen entre sí.
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, bodyZ0, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, bodyZ0, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], bodyZ0, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], bodyZ0, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, bodyZ0, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, bodyZ0, ox, oy);

  // Cota de altura, con la esquina superior/inferior derecha del cuerpo.
  const [rightTopX, rightTopY] = isoPt(halfW, -halfD, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(halfW, -halfD, bodyZ0, ox, oy);

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      {/* Solado: misma forma, un poco más ancho y corto */}
      <IsoBoxLineArt x0={-soladoHalfW} y0={-soladoHalfD} w={soladoHalfW * 2} d={soladoHalfD * 2} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Cuerpo (pedestal) */}
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano que atraviesa el cuerpo */}
      <polygon points={groundPlane} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={groundLeftX - 4} y={groundLeftY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho: paralela al borde frontal-izquierdo, desplazada "hacia el frente" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo: paralela al borde frontal-derecho, desplazada "hacia la derecha" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {profundo || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 34} y1={rightTopY} x2={rightBotX + 34} y2={rightBotY} />
        <line x1={rightTopX + 30} y1={rightTopY} x2={rightTopX + 38} y2={rightTopY} />
        <line x1={rightBotX + 30} y1={rightBotY} x2={rightBotX + 38} y2={rightBotY} />
      </g>
      <text
        x={rightTopX + 46}
        y={(rightTopY + rightBotY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${rightTopX + 46}, ${(rightTopY + rightBotY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D): un rectángulo — ancho = ancho,    */
/* alto = altura total — igual estilo que Postes MT.                        */
function LuminariasSeccionLongitudinal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 28, 85);
  const alturaPx = clamp((altura || 0.3) * LUMI_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * LUMI_M2PX, 5, 11);

  const cx = LUMI_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un rectángulo (o cuadrado, si   */
/* ancho = profundo) con AMBAS cotas — horizontal (ancho) y vertical         */
/* (profundo) — porque la sección puede no ser cuadrada.                    */
function LuminariasSeccionTransversal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 28, 85);
  const profundoPx = clamp((profundo || 0.3) * LUMI_M2PX, 28, 85);

  const cx = LUMI_VB_W / 2;
  const cy = LUMI_VB_H / 2 - 14;

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={cy - profundoPx / 2} width={anchoPx} height={profundoPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota horizontal: ancho, debajo */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 14} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 14} />
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx - anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
        <line x1={cx + anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
      </g>
      <text x={cx} y={cy + profundoPx / 2 + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota vertical: profundo, a la derecha */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 14} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 14} y2={cy + profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy - profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy + profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy + profundoPx / 2} />
      </g>
      <text
        x={cx + anchoPx / 2 + 30}
        y={cy}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 30}, ${cy})`}
      >
        {profundo || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas de Luminarias lado a lado, cada una con su etiqueta.   */
function LuminariasVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <LuminariasPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <LuminariasSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <LuminariasSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

/* Formulario de crear/editar una plantilla de Luminarias: lado (sección      */
/* cuadrada), altura (desplante + sobresaliente) y espesor de solado.       */
function LuminariasForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesPrisma(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Luminarias
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <LuminariasVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Luminaria Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 italic">Si la sección es cuadrada, usa el mismo valor en ambos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.10" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* Formulario de crear/editar una plantilla de Cámaras (CCTV): mismo         */
/* esquema que Luminarias (ancho, profundo, desplante, sobresaliente,       */
/* espesor de solado).                                                       */
function CamarasForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesPrisma(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cámaras
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <CamarasVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Cámara Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 italic">Si la sección es cuadrada, usa el mismo valor en ambos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.10" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* ============================================================ */
/* CÁMARAS (CCTV) — misma estructura que Luminarias, sección       */
/* rectangular/cuadrada.                                            */
/* ============================================================ */

const CAM_VB_W = 200;
const CAM_VB_H = 195;
const CAM_M2PX = 80;
const CAM_CSS_SIZE = 'w-56 h-56';

/* Isométrico de una cimentación de sección rectangular (o cuadrada, si       */
/* ancho = profundo): caja + solado (misma forma, un poco más ancha y corta) */
/* + plano de terreno natural (un paralelogramo coherente con la perspectiva) */
/* + cotas independientes de ancho y profundo (una en cada borde visible de   */
/* la base) + cota de altura.                                                */
function CamarasPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 26, 65);
  const profundoPx = clamp((profundo || 0.3) * CAM_M2PX, 26, 65);
  const alturaPx = clamp((altura || 0.3) * CAM_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * CAM_M2PX, 5, 11);
  const groundFrac = altura > 0 ? desplante / altura : 0;

  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const bodyZ0 = soladoPx;
  const bodyZ1 = soladoPx + alturaPx;
  const groundZ = soladoPx + groundFrac * alturaPx;

  const ox = CAM_VB_W / 2;
  const oy = 18 + Math.max(halfW, halfD) + bodyZ1;

  const soladoHalfW = halfW;
  const soladoHalfD = halfD;
  const groundHalfW = halfW + 16;
  const groundHalfD = halfD + 16;

  const [groundLeftX, groundLeftY] = isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy);
  const groundPlane = poly([
    isoPt(-groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, groundHalfD, groundZ, ox, oy),
    isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy),
  ]);

  // Los puntos reales de la base que nos importan: la esquina más cercana
  // (donde se juntan los dos bordes visibles) y sus dos vecinas.
  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], bodyZ0, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], bodyZ0, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], bodyZ0, ox, oy);

  // Cada cota se dibuja PARALELA a su propio borde, desplazada hacia afuera
  // en el eje del modelo correspondiente (no en pantalla) — así una queda
  // "hacia el frente" (ancho) y la otra "hacia la derecha" (profundo), sin
  // que sus etiquetas choquen entre sí.
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, bodyZ0, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, bodyZ0, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], bodyZ0, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], bodyZ0, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, bodyZ0, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, bodyZ0, ox, oy);

  // Cota de altura, con la esquina superior/inferior derecha del cuerpo.
  const [rightTopX, rightTopY] = isoPt(halfW, -halfD, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(halfW, -halfD, bodyZ0, ox, oy);

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      {/* Solado: misma forma, un poco más ancho y corto */}
      <IsoBoxLineArt x0={-soladoHalfW} y0={-soladoHalfD} w={soladoHalfW * 2} d={soladoHalfD * 2} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Cuerpo (pedestal) */}
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano que atraviesa el cuerpo */}
      <polygon points={groundPlane} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={groundLeftX - 4} y={groundLeftY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho: paralela al borde frontal-izquierdo, desplazada "hacia el frente" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo: paralela al borde frontal-derecho, desplazada "hacia la derecha" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {profundo || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 34} y1={rightTopY} x2={rightBotX + 34} y2={rightBotY} />
        <line x1={rightTopX + 30} y1={rightTopY} x2={rightTopX + 38} y2={rightTopY} />
        <line x1={rightBotX + 30} y1={rightBotY} x2={rightBotX + 38} y2={rightBotY} />
      </g>
      <text
        x={rightTopX + 46}
        y={(rightTopY + rightBotY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${rightTopX + 46}, ${(rightTopY + rightBotY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D): un rectángulo — ancho = ancho,    */
/* alto = altura total — igual estilo que Postes MT.                        */
function CamarasSeccionLongitudinal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 28, 85);
  const alturaPx = clamp((altura || 0.3) * CAM_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * CAM_M2PX, 5, 11);

  const cx = CAM_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un rectángulo (o cuadrado, si   */
/* ancho = profundo) con AMBAS cotas — horizontal (ancho) y vertical         */
/* (profundo) — porque la sección puede no ser cuadrada.                    */
function CamarasSeccionTransversal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 28, 85);
  const profundoPx = clamp((profundo || 0.3) * CAM_M2PX, 28, 85);

  const cx = CAM_VB_W / 2;
  const cy = CAM_VB_H / 2 - 14;

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={cy - profundoPx / 2} width={anchoPx} height={profundoPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota horizontal: ancho, debajo */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 14} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 14} />
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx - anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
        <line x1={cx + anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
      </g>
      <text x={cx} y={cy + profundoPx / 2 + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota vertical: profundo, a la derecha */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 14} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 14} y2={cy + profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy - profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy + profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy + profundoPx / 2} />
      </g>
      <text
        x={cx + anchoPx / 2 + 30}
        y={cy}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 30}, ${cy})`}
      >
        {profundo || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas de Luminarias lado a lado, cada una con su etiqueta.   */
function CamarasVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <CamarasPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <CamarasSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <CamarasSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

/* ============================================================ */
/* INVERSORES — 2 pedestales rectangulares iguales + 1 losa con  */
/* malla electrosoldada, con despiece de acero (barras + estribos). */
/* ============================================================ */
const INV_VB_W = 260;
const INV_VB_H = 240;
const INV_M2PX = 55;
const INV_CSS_SIZE = 'w-72 h-60';
const INV_REF_CSS_SIZE = 'w-56 h-56';

/* Isométrico del conjunto: solado corrido + 2 pedestales + losa encima,      */
/* con cotas de la losa (ancho/largo/espesor) y de un pedestal (ancho/       */
/* profundo/altura) — igual estilo de líneas que los demás tipos.           */
function InversoresIsometrico({ datos }) {
  const p = datos.pedestal || {};
  const l = datos.losa || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const pDesplante = parseFloat(p.desplante) || 0;
  const pSobresaliente = parseFloat(p.sobresaliente) || 0;
  const pSolado = parseFloat(p.espesor_solado) || 0;
  const pSeparacion = parseFloat(p.separacion) || 0;
  const pAltura = pDesplante + pSobresaliente;

  const lAncho = parseFloat(l.ancho) || 0;
  const lLargo = parseFloat(l.largo) || 0;
  const lEspesor = parseFloat(l.espesor) || 0;

  const pAnchoPx = clamp((pAncho || 0.3) * INV_M2PX, 18, 45);
  const pProfundoPx = clamp((pProfundo || 0.3) * INV_M2PX, 18, 45);
  const pAlturaPx = clamp((pAltura || 0.5) * INV_M2PX, 40, 85);
  const pSoladoPx = clamp((pSolado || 0.05) * INV_M2PX, 4, 9);
  const pSepPx = clamp((pSeparacion || 0.6) * INV_M2PX, 20, 90);

  const lAnchoPx = clamp((lAncho || 1.6) * INV_M2PX, pAnchoPx * 2 + pSepPx, 190);
  const lLargoPx = clamp((lLargo || 1.0) * INV_M2PX, pProfundoPx + 20, 110);
  const lEspesorPx = clamp((lEspesor || 0.15) * INV_M2PX, 6, 16);

  const halfPed = pAnchoPx / 2;
  const halfProf = pProfundoPx / 2;
  const centroX = (pAnchoPx + pSepPx) / 2;

  const bodyZ0 = pSoladoPx;
  const bodyZ1 = pSoladoPx + pAlturaPx;
  const losaZ1 = bodyZ1 + lEspesorPx;

  const ox = INV_VB_W / 2;
  const oy = 55 + Math.max(halfProf, lLargoPx / 2) + losaZ1;


  // Altura del pedestal: esquina trasera-derecha, hacia la derecha.
  const [rightTopX, rightTopY] = isoPt(centroX + halfPed, -halfProf, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(centroX + halfPed, -halfProf, bodyZ0, ox, oy);

  // Espesor de la losa: frente-izquierda, hacia la izquierda.
  const [espTopX, espTopY] = isoPt(-lAnchoPx / 2, lLargoPx / 2, losaZ1, ox, oy);
  const [espBotX, espBotY] = isoPt(-lAnchoPx / 2, lLargoPx / 2, bodyZ1, ox, oy);

  // Ancho y largo de la losa: arriba, paralelos a los dos bordes que se ven
  // desde la esquina trasera (la que queda más arriba en la proyección),
  // desplazados aún más arriba para no chocar con la losa ni entre sí.
  const dimPushLosa = 26;
  const backModel = [-lAnchoPx / 2, -lLargoPx / 2];
  const rightBackModel = [lAnchoPx / 2, -lLargoPx / 2];
  const frontLeftModel = [-lAnchoPx / 2, lLargoPx / 2];
  const backPt = isoPt(backModel[0], backModel[1], losaZ1, ox, oy);
  const rightBackPt = isoPt(rightBackModel[0], rightBackModel[1], losaZ1, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], losaZ1, ox, oy);
  const lAnchoP1 = isoPt(backModel[0], backModel[1] - dimPushLosa, losaZ1, ox, oy);
  const lAnchoP2 = isoPt(rightBackModel[0], rightBackModel[1] - dimPushLosa, losaZ1, ox, oy);
  const lLargoP1 = isoPt(backModel[0] - dimPushLosa, backModel[1], losaZ1, ox, oy);
  const lLargoP2 = isoPt(frontLeftModel[0] - dimPushLosa, frontLeftModel[1], losaZ1, ox, oy);
  const lAnchoLabel = isoPt((backModel[0] + rightBackModel[0]) / 2, backModel[1] - dimPushLosa - 14, losaZ1, ox, oy);
  const lLargoLabel = isoPt(backModel[0] - dimPushLosa - 14, (backModel[1] + frontLeftModel[1]) / 2, losaZ1, ox, oy);

  return (
    <svg viewBox={`0 0 ${INV_VB_W} ${INV_VB_H}`} className={INV_CSS_SIZE}>
      {/* Solado: uno por cada pedestal, con su misma huella (no una franja continua) */}
      <IsoBoxLineArt x0={-centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={0} z1={pSoladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={0} z1={pSoladoPx} ox={ox} oy={oy} />
      {/* Pedestal izquierdo */}
      <IsoBoxLineArt x0={-centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Pedestal derecho */}
      <IsoBoxLineArt x0={centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Losa encima de ambos */}
      <IsoBoxLineArt x0={-lAnchoPx / 2} y0={-lLargoPx / 2} w={lAnchoPx} d={lLargoPx} z0={bodyZ1} z1={losaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      {/* Cota de altura del pedestal (a la derecha) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 20} y1={rightTopY} x2={rightBotX + 20} y2={rightBotY} />
        <line x1={rightTopX + 16} y1={rightTopY} x2={rightTopX + 24} y2={rightTopY} />
        <line x1={rightBotX + 16} y1={rightBotY} x2={rightBotX + 24} y2={rightBotY} />
      </g>
      <text x={rightTopX + 30} y={(rightTopY + rightBotY) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${rightTopX + 30}, ${(rightTopY + rightBotY) / 2})`}>
        {pAltura ? pAltura.toFixed(2) : '—'} m
      </text>
      {/* Cota de espesor de losa (a la izquierda) */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={espTopX - 20} y1={espTopY} x2={espBotX - 20} y2={espBotY} />
        <line x1={espTopX - 16} y1={espTopY} x2={espTopX - 24} y2={espTopY} />
        <line x1={espBotX - 16} y1={espBotY} x2={espBotX - 24} y2={espBotY} />
      </g>
      <text x={espTopX - 30} y={(espTopY + espBotY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${espTopX - 30}, ${(espTopY + espBotY) / 2})`}>
        {lEspesor ? lEspesor.toFixed(2) : '—'} m
      </text>
      {/* Cota de ancho de losa: arriba, paralela al borde trasero */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={lAnchoP1[0]} y2={lAnchoP1[1]} />
        <line x1={rightBackPt[0]} y1={rightBackPt[1]} x2={lAnchoP2[0]} y2={lAnchoP2[1]} />
        <line x1={lAnchoP1[0]} y1={lAnchoP1[1]} x2={lAnchoP2[0]} y2={lAnchoP2[1]} />
      </g>
      <text x={lAnchoLabel[0]} y={lAnchoLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA">
        {lAncho || '—'} m
      </text>
      {/* Cota de largo de losa: arriba, paralela al borde trasero-izquierdo */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={lLargoP1[0]} y2={lLargoP1[1]} />
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={lLargoP2[0]} y2={lLargoP2[1]} />
        <line x1={lLargoP1[0]} y1={lLargoP1[1]} x2={lLargoP2[0]} y2={lLargoP2[1]} />
      </g>
      <text x={lLargoLabel[0]} y={lLargoLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA">
        {lLargo || '—'} m
      </text>
    </svg>
  );
}

/* Elevación ("Vista Posterior") del despiece de acero de UN pedestal        */
/* (los dos son iguales): barras longitudinales verticales + estribos       */
/* horizontales, con las etiquetas típicas de un plano de despiece.        */
function InversoresRefuerzoElevacion({ datos }) {
  const p = datos.pedestal || {};
  const b = datos.barras || {};
  const e = datos.estribos || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const pAncho = parseFloat(p.ancho) || 0.3;
  const altura = (parseFloat(p.desplante) || 0) + (parseFloat(p.sobresaliente) || 0);
  const cantidadBarras = Math.max(2, parseInt(b.cantidad, 10) || 2);
  const ganchosBarra = parseFloat(b.ganchos) || 0;
  const infoBarra = BARRA_ACERO[b.calibre];
  const estribos = calcularEstribos({ altura, ancho: p.ancho, profundo: p.profundo, separacion: e.separacion, calibre: e.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionM = parseFloat(e.separacion) || 0;

  const w = clamp(pAncho * 130, 45, 100);
  const h = clamp((altura || 0.5) * 130, 90, 190);
  const cx = 90;
  const topY = 30;
  const botY = topY + h;
  const recubPx = 7;
  const escala = altura > 0 ? h / altura : 130;

  // En una vista posterior/elevación, las barras que comparten la misma
  // posición "x" (una al frente, otra atrás) se dibujan como UNA sola línea
  // — por eso solo se ven la mitad de las barras totales (redondeando
  // hacia arriba), no las 4 de un arreglo típico en las esquinas.
  const posicionesVisibles = Math.max(1, Math.ceil(cantidadBarras / 2));
  const barX = [];
  for (let i = 0; i < posicionesVisibles; i++) {
    const frac = posicionesVisibles === 1 ? 0.5 : i / (posicionesVisibles - 1);
    barX.push(cx - w / 2 + recubPx + frac * (w - 2 * recubPx));
  }
  // Los ganchos apuntan hacia el centro (como se doblan de verdad, hacia
  // adentro del núcleo de concreto) — se limita su largo a una fracción de
  // la distancia entre barras para que nunca se crucen entre sí.
  const distanciaEntreBarras = barX.length > 1 ? barX[barX.length - 1] - barX[0] : w;
  const ganchoMaximoSinChoque = (distanciaEntreBarras / 2) * 0.6;
  const ganchoPx = infoBarra ? clamp(Math.min(infoBarra.gancho * escala, ganchoMaximoSinChoque), 5, 13) : Math.min(10, ganchoMaximoSinChoque);

  // Los estribos se dibujan CENTRADOS en la altura del pedestal (no
  // pegados abajo), con su separación real a escala, así la cantidad que
  // se ve corresponde a la cantidad real calculada.
  const separacionPx = separacionM > 0 ? separacionM * escala : (h - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
  const totalSpanEstribos = (cantidadEstribos - 1) * separacionPx;
  const inicioEstribos = topY + recubPx + Math.max(0, (h - 2 * recubPx - totalSpanEstribos) / 2);
  const estriboY = [];
  for (let i = 0; i < cantidadEstribos; i++) {
    estriboY.push(inicioEstribos + i * separacionPx);
  }

  const ganchosLabel = ganchosBarra > 0 ? 'L'.repeat(Math.min(ganchosBarra, 2)) : '';
  const ganchoLongitud = infoBarra ? infoBarra.gancho : null;

  return (
    <svg viewBox="0 0 190 250" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboY.map((y, i) => (
        <rect key={i} x={cx - w / 2 + recubPx} y={y - 2} width={w - 2 * recubPx} height="4" fill="none" stroke="#2563EB" strokeWidth="1" />
      ))}
      {barX.map((x, i) => {
        const dir = x < cx ? 1 : x > cx ? -1 : 1; // hacia el centro
        return (
          <g key={i}>
            <line x1={x} y1={topY + 2} x2={x} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />
            {ganchosBarra >= 1 && <line x1={x} y1={botY - 2} x2={x + dir * ganchoPx} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />}
            {ganchosBarra >= 2 && <line x1={x} y1={topY + 2} x2={x + dir * ganchoPx} y2={topY + 2} stroke="#059669" strokeWidth="1.6" />}
          </g>
        );
      })}
      <text x={cx} y={topY - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {cantidadBarras}{b.calibre || '#—'} {ganchosLabel}{ganchoLongitud !== null ? ganchoLongitud.toFixed(2) : ''}
      </text>
      <text x={cx + w / 2 + 8} y={(topY + botY) / 2} fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${(topY + botY) / 2})`} textAnchor="middle">
        {cantidadEstribos || '—'} E{e.calibre || '#—'} @{e.separacion || '—'}
      </text>
      {/* Cota de ancho (abajo, paralela a la base) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={botY + 14} x2={cx + w / 2} y2={botY + 14} />
        <line x1={cx - w / 2} y1={botY + 10} x2={cx - w / 2} y2={botY + 18} />
        <line x1={cx + w / 2} y1={botY + 10} x2={cx + w / 2} y2={botY + 18} />
      </g>
      <text x={cx} y={botY + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {pAncho || '—'} m
      </text>
      {/* Cota de altura (izquierda, paralela al lado) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={topY} x2={cx - w / 2 - 16} y2={botY} />
        <line x1={cx - w / 2 - 12} y1={topY} x2={cx - w / 2 - 20} y2={topY} />
        <line x1={cx - w / 2 - 12} y1={botY} x2={cx - w / 2 - 20} y2={botY} />
      </g>
      <text x={cx - w / 2 - 26} y={(topY + botY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${(topY + botY) / 2})`}>
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal (planta) del pedestal: el estribo como un rectángulo    */
/* inscrito, con las 4 barras de esquina.                                   */
function InversoresRefuerzoCorte({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const pAncho = parseFloat(p.ancho) || 0.3;
  const pProfundo = parseFloat(p.profundo) || 0.3;
  const w = clamp(pAncho * 130, 40, 100);
  const d = clamp(pProfundo * 130, 40, 100);
  const cx = 85, cy = 80;
  const recubPx = 7;

  return (
    <svg viewBox="0 0 180 190" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      {/* Ganchos del estribo: siempre dos, en dos esquinas distintas (cada uno en su propia diagonal, para que no se vean como una sola línea) */}
      <line
        x1={cx - (w / 2 - recubPx) * 0.6}
        y1={cy + (d / 2 - recubPx) * 0.6}
        x2={cx - (w / 2 - recubPx) * 0.15}
        y2={cy + (d / 2 - recubPx) * 0.15}
        stroke="#2563EB"
        strokeWidth="1.3"
      />
      <line
        x1={cx - (w / 2 - recubPx) * 0.6}
        y1={cy - (d / 2 - recubPx) * 0.6}
        x2={cx - (w / 2 - recubPx) * 0.15}
        y2={cy - (d / 2 - recubPx) * 0.15}
        stroke="#2563EB"
        strokeWidth="1.3"
      />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={cx + sx * (w / 2 - recubPx)} cy={cy + sy * (d / 2 - recubPx)} r="2.6" fill="#059669" />
      ))}
      {/* Cota de ancho (abajo) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {pAncho || '—'} m
      </text>
      {/* Cota de profundo (izquierda) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={cy - d / 2} x2={cx - w / 2 - 16} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy - d / 2} x2={cx - w / 2 - 20} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy + d / 2} x2={cx - w / 2 - 20} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 26} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${cy})`}>
        {pProfundo || '—'} m
      </text>
    </svg>
  );
}

/* Planta de la losa con la malla electrosoldada representada como una       */
/* cuadrícula simple, etiquetada con el tipo elegido.                       */
function InversoresLosaPlanta({ datos }) {
  const l = datos.losa || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ancho = parseFloat(l.ancho) || 0;
  const largo = parseFloat(l.largo) || 0;
  const w = clamp((ancho || 1.6) * 60, 60, 140);
  const d = clamp((largo || 1.0) * 60, 50, 100);
  const cx = 95, cy = 80;
  const cols = 5, rows = 4;

  return (
    <svg viewBox="0 0 200 190" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`v${i}`} x1={cx - w / 2 + ((i + 1) * w) / cols} y1={cy - d / 2} x2={cx - w / 2 + ((i + 1) * w) / cols} y2={cy + d / 2} stroke="#2563EB" strokeWidth="0.6" />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`h${i}`} x1={cx - w / 2} y1={cy - d / 2 + ((i + 1) * d) / rows} x2={cx + w / 2} y2={cy - d / 2 + ((i + 1) * d) / rows} stroke="#2563EB" strokeWidth="0.6" />
      ))}
      {/* Cota de ancho (abajo) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de largo (izquierda) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={cy - d / 2} x2={cx - w / 2 - 16} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy - d / 2} x2={cx - w / 2 - 20} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy + d / 2} x2={cx - w / 2 - 20} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 26} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${cy})`}>
        {largo || '—'} m
      </text>
      <text x={cx} y={cy - d / 2 - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#2563EB">
        Malla {l.malla || '—'}
      </text>
    </svg>
  );
}

/* Junta las 4 vistas de Inversores (isométrico general + las 3 de despiece  */
/* de acero) con sus etiquetas.                                            */
function InversoresVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <InversoresIsometrico datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico del conjunto</p>
      </div>
      <div className="text-center">
        <InversoresRefuerzoElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Refuerzo · vista posterior</p>
      </div>
      <div className="text-center">
        <InversoresRefuerzoCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Refuerzo · corte transversal</p>
      </div>
      <div className="text-center">
        <InversoresLosaPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Losa · planta con malla</p>
      </div>
    </div>
  );
}

/* Fila de resumen numérico (longitud/peso) dentro de la tabla de despiece.  */
function FilaResumenAcero({ label, valor }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-navy-100 last:border-0">
      <span className="text-navy-500">{label}</span>
      <span className="font-mono font-semibold text-navy-700">{valor}</span>
    </div>
  );
}

/* Formulario de crear/editar una plantilla de Inversores: 2 pedestales      */
/* iguales (con su despiece de barras + estribos) y 1 losa con malla.      */
function InversoresForm({ plantilla, onCancel, onSave, mallas, onAddMalla }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || {
      pedestal: { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', separacion: '' },
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
      losa: { ancho: '', largo: '', espesor: '', malla: '' },
      resistencia: '',
    }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  const alturaPedestal = (parseFloat(datos.pedestal.desplante) || 0) + (parseFloat(datos.pedestal.sobresaliente) || 0);
  const longitudinales = calcularLongitudinales({ altura: alturaPedestal, cantidad: datos.barras.cantidad, calibre: datos.barras.calibre, ganchos: datos.barras.ganchos });
  const estribos = calcularEstribos({ altura: alturaPedestal, ancho: datos.pedestal.ancho, profundo: datos.pedestal.profundo, separacion: datos.estribos.separacion, calibre: datos.estribos.calibre });
  const pesoTotalAcero = (longitudinales?.pesoTotal || 0) + (estribos?.pesoTotal || 0);
  const volumenes = calcularVolumenesInversores(datos);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Inversores
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <InversoresVistas datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Inversores Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pedestales */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestales (2 iguales)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.pedestal.desplante} onChange={(e) => setGrupo('pedestal', 'desplante', e.target.value)} placeholder="0.60" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.pedestal.sobresaliente} onChange={(e) => setGrupo('pedestal', 'sobresaliente', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Altura total: <span className="font-mono text-navy-600">{alturaPedestal.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
              <input value={datos.pedestal.espesor_solado} onChange={(e) => setGrupo('pedestal', 'espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación entre pedestales (m)</label>
              <input value={datos.pedestal.separacion} onChange={(e) => setGrupo('pedestal', 'separacion', e.target.value)} placeholder="0.60" className={cellInput} />
            </div>
          </div>
        </div>

        {/* Losa */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Losa</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.losa.ancho} onChange={(e) => setGrupo('losa', 'ancho', e.target.value)} placeholder="1.60" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Largo (m)</label>
              <input value={datos.losa.largo} onChange={(e) => setGrupo('losa', 'largo', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-navy-500 mb-1">Espesor (m)</label>
            <input value={datos.losa.espesor} onChange={(e) => setGrupo('losa', 'espesor', e.target.value)} placeholder="0.15" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Tipo de malla electrosoldada</label>
            <MallaPicker value={datos.losa.malla} mallas={mallas || []} onChange={(val) => setGrupo('losa', 'malla', val)} onAddNew={onAddMalla} />
          </div>
        </div>

        {/* Barras longitudinales */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Barras longitudinales (por pedestal)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">N.° de barras</label>
              <input value={datos.barras.cantidad} onChange={(e) => setGrupo('barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">Calibre</label>
              <CalibreSelect value={datos.barras.calibre} onChange={(val) => setGrupo('barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">N.° de ganchos</label>
              <input value={datos.barras.ganchos} onChange={(e) => setGrupo('barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {longitudinales ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2">
              <FilaResumenAcero label="Longitud por barra" valor={`${longitudinales.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Peso por barra" valor={`${longitudinales.pesoBarra.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso por pedestal" valor={`${longitudinales.pesoPedestal.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso total (2 pedestales)" valor={`${longitudinales.pesoTotal.toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa altura, cantidad y calibre para calcular.</p>
          )}
        </div>

        {/* Estribos */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Estribos (por pedestal)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.estribos.calibre} onChange={(val) => setGrupo('estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.estribos.separacion} onChange={(e) => setGrupo('estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {estribos ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2">
              <FilaResumenAcero label="Cantidad por pedestal" valor={`${estribos.cantidad}`} />
              <FilaResumenAcero label="Longitud por estribo" valor={`${estribos.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Peso por estribo" valor={`${estribos.pesoEstribo.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso por pedestal" valor={`${estribos.pesoPedestal.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso total (2 pedestales)" valor={`${estribos.pesoTotal.toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa altura, dimensiones, separación y calibre para calcular.</p>
          )}
        </div>
      </div>

      <ResumenVolumenes volumenes={volumenes} pesoAcero={(longitudinales || estribos) ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* PASO DE FAUNA — bloque simple de concreto, sin acero.          */
/* ============================================================ */
const FAUNA_VB_W = 200;
const FAUNA_VB_H = 195;
const FAUNA_M2PX = 90;
const FAUNA_CSS_SIZE = 'w-56 h-56';

function PasoFaunaPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.4) * FAUNA_M2PX, 30, 90);
  const profundoPx = clamp((profundo || 0.2) * FAUNA_M2PX, 20, 70);
  const altoPx = clamp((alto || 0.2) * FAUNA_M2PX, 20, 80);
  const soladoPx = clamp((espesorSolado || 0.05) * FAUNA_M2PX, 4, 9);
  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const ox = FAUNA_VB_W / 2;
  const oy = 30 + halfW + altoPx + soladoPx;

  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], soladoPx, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], soladoPx, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], soladoPx, ox, oy);
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, soladoPx, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, soladoPx, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], soladoPx, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], soladoPx, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, soladoPx, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, soladoPx, ox, oy);
  const [topX, topY] = isoPt(halfW, -halfD, soladoPx + altoPx, ox, oy);
  const [botX, botY] = isoPt(halfW, -halfD, soladoPx, ox, oy);

  return (
    <svg viewBox={`0 0 ${FAUNA_VB_W} ${FAUNA_VB_H}`} className={FAUNA_CSS_SIZE}>
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={soladoPx} z1={soladoPx + altoPx} ox={ox} oy={oy} />
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">{ancho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">{profundo || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={topX + 20} y1={topY} x2={botX + 20} y2={botY} />
        <line x1={topX + 16} y1={topY} x2={topX + 24} y2={topY} />
        <line x1={botX + 16} y1={botY} x2={botX + 24} y2={botY} />
      </g>
      <text x={topX + 30} y={(topY + botY) / 2} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${topX + 30}, ${(topY + botY) / 2})`}>
        {alto || '—'} m
      </text>
    </svg>
  );
}

function PasoFaunaForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(plantilla?.datos || { ancho: '', profundo: '', alto: '', espesor_solado: '' });

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const volumenes = ancho && profundo && alto
    ? { concreto: ancho * profundo * alto, excavacion: ancho * profundo * (alto + espesorSolado), solado: ancho * profundo * espesorSolado }
    : null;
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cerramiento · Paso de fauna
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <PasoFaunaPreview datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Paso de fauna Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Base / Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto (m)</label>
              <input value={datos.alto} onChange={(e) => set('alto', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <p className="text-xs text-navy-400 italic">
            Bloque macizo sin acero — la excavación usa el alto más el espesor de solado.
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* ============================================================ */
/* PORTÓN — 2 zapatas + viga de amarre + 2 pedestales.             */
/* ============================================================ */
const PORTON_VB_W = 300;
const PORTON_VB_H = 220;
const PORTON_M2PX = 45;
const PORTON_CSS_SIZE = 'w-72 h-56';
const PORTON_PLANTA_CSS_SIZE = 'w-56 h-56';
const PORTON_VIGA_ELEV_CSS_SIZE = 'w-[26rem] h-40';

/* Isométrico del conjunto: 2 zapatas + viga que las une + 2 pedestales      */
/* encima. No dibuja el acero (demasiado detalle para una sola vista) — el  */
/* despiece se documenta con números en el formulario.                     */
function PortonIsometrico({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const p = datos.pedestal || {};
  const clamp = (v_, min, max) => Math.max(min, Math.min(max, v_));

  const zAncho = parseFloat(z.ancho) || 0;
  const zLargo = parseFloat(z.largo) || 0;
  const zEspesor = parseFloat(z.espesor) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const pAltura = Math.max(0, desplante - zEspesor); // desplante − espesor de zapata
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const zAnchoPx = clamp((zAncho || 1) * PORTON_M2PX, 30, 70);
  const zLargoPx = clamp((zLargo || 1) * PORTON_M2PX, 30, 70);
  const zEspesorPx = clamp((zEspesor || 0.35) * PORTON_M2PX, 8, 22);
  const soladoPx = clamp((espesorSolado || 0.05) * PORTON_M2PX, 4, 9);
  const sepPx = clamp((separacion || 5) * PORTON_M2PX, 90, 210);
  const pAnchoPx = clamp((pAncho || 0.4) * PORTON_M2PX, 14, 34);
  const pProfundoPx = clamp((pProfundo || 0.4) * PORTON_M2PX, 14, 34);
  const pAlturaPx = clamp((pAltura || 0.7) * PORTON_M2PX, 25, 70);
  const vAnchoPx = clamp((vAncho || 0.3) * PORTON_M2PX, 10, 20);
  const vAltoPx = clamp((vAlto || 0.35) * PORTON_M2PX, 10, 22);

  const halfZ = zLargoPx / 2;
  const halfZAncho = zAnchoPx / 2;
  const centroX = sepPx / 2;
  // z=0 es el fondo del solado. La zapata va encima del solado; la viga y el
  // pedestal arrancan juntos desde la parte de ARRIBA de la zapata.
  const zapataZ0 = soladoPx;
  const zapataZ1 = soladoPx + zEspesorPx;
  const vigaZ0 = zapataZ0; // la viga va a la misma profundidad que la zapata, justo encima del solado
  const vigaZ1 = zapataZ0 + vAltoPx;
  const pedestalZ0 = zapataZ1;
  const pedestalZ1 = zapataZ1 + pAlturaPx;
  const ntnZ = pedestalZ1; // el N.T.N. queda en la parte de ARRIBA del pedestal

  const ox = PORTON_VB_W / 2;
  const oy = 30 + Math.max(halfZAncho, 40) + pedestalZ1;

  const distanciaCarasInternas = Math.max(0, sepPx - zLargoPx);

  // Cota de altura del pedestal (derecha)
  const [alturaTopX, alturaTopY] = isoPt(centroX + pAnchoPx / 2, -pProfundoPx / 2, pedestalZ1, ox, oy);
  const [alturaBotX, alturaBotY] = isoPt(centroX + pAnchoPx / 2, -pProfundoPx / 2, zapataZ1, ox, oy);

  return (
    <svg viewBox={`0 0 ${PORTON_VB_W} ${PORTON_VB_H}`} className={PORTON_CSS_SIZE}>
      {/* Solado bajo cada zapata (misma huella) */}
      <IsoBoxLineArt x0={-centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Solado bajo el tramo de la viga, uniendo los dos anteriores */}
      {distanciaCarasInternas > 0 && (
        <IsoBoxLineArt x0={-centroX + halfZ} y0={-vAnchoPx / 2} w={distanciaCarasInternas} d={vAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      )}
      {/* Zapata izquierda: se dibuja ANTES que la viga, así la viga queda      */}
      {/* ENCIMA de ella (visible, la tapa donde se cruzan).                   */}
      <IsoBoxLineArt x0={-centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={zapataZ0} z1={zapataZ1} ox={ox} oy={oy} />
      {/* Viga de amarre, a la misma profundidad que las zapatas */}
      {distanciaCarasInternas > 0 && (
        <IsoBoxLineArt x0={-centroX + halfZ} y0={-vAnchoPx / 2} w={distanciaCarasInternas} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      )}
      {/* Zapata derecha: se dibuja DESPUÉS que la viga, así queda ENCIMA y la */}
      {/* tapa donde se cruzan — esto imita la profundidad real: desde este    */}
      {/* ángulo isométrico, la zapata izquierda queda "detrás" (la viga pasa  */}
      {/* por encima) y la derecha queda "adelante" (tapa a la viga).         */}
      <IsoBoxLineArt x0={centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={zapataZ0} z1={zapataZ1} ox={ox} oy={oy} />
      {/* Pedestales, también arrancando desde la parte de arriba de la zapata */}
      <IsoBoxLineArt x0={-centroX - pAnchoPx / 2} y0={-pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - pAnchoPx / 2} y0={-pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano a la altura de la PARTE DE ARRIBA de los pedestales */}
      <polygon
        points={poly([
          isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy),
          isoPt(centroX + pAnchoPx / 2 + 16, -halfZAncho - 20, ntnZ, ox, oy),
          isoPt(centroX + pAnchoPx / 2 + 16, halfZAncho + 20, ntnZ, ox, oy),
          isoPt(-centroX - pAnchoPx / 2 - 16, halfZAncho + 20, ntnZ, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy)[0] - 4}
        y={isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      {/* Cota de altura del pedestal, a la derecha, paralela a su borde */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={alturaTopX + 18} y1={alturaTopY} x2={alturaBotX + 18} y2={alturaBotY} />
        <line x1={alturaTopX + 14} y1={alturaTopY} x2={alturaTopX + 22} y2={alturaTopY} />
        <line x1={alturaBotX + 14} y1={alturaBotY} x2={alturaBotX + 22} y2={alturaBotY} />
      </g>
      <text x={alturaTopX + 28} y={(alturaTopY + alturaBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${alturaTopX + 28}, ${(alturaTopY + alturaBotY) / 2})`}>
        {pAltura > 0 ? pAltura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Planta de UNA zapata (las dos son iguales) con la parrilla de acero en    */
/* las dos direcciones — cada barra con sus 2 ganchos hacia arriba          */
/* representados como un punto en cada extremo.                            */
function PortonZapataPlanta({ datos }) {
  const z = datos.zapata || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ancho = parseFloat(z.ancho) || 0;
  const largo = parseFloat(z.largo) || 0;
  const w = clamp((ancho || 1) * 90, 60, 140);
  const d = clamp((largo || 1) * 90, 60, 140);
  const cx = 100, cy = 90;
  const recubPx = 6;

  const parrilla = calcularParrillaZapata({
    ancho: z.ancho,
    largo: z.largo,
    longitudinal: z.parrilla_longitudinal,
    transversal: z.parrilla_transversal,
  });
  const nLong = Math.min(parrilla.longitudinal?.cantidad || 3, 10);
  const nTrans = Math.min(parrilla.transversal?.cantidad || 3, 10);

  return (
    <svg viewBox="0 0 200 210" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Barras longitudinales: corren verticalmente en el dibujo (a lo largo de "largo"), repartidas en el ancho */}
      {Array.from({ length: nLong }, (_, i) => {
        const frac = nLong === 1 ? 0.5 : i / (nLong - 1);
        const x = cx - w / 2 + recubPx + frac * (w - 2 * recubPx);
        return <line key={`l${i}`} x1={x} y1={cy - d / 2 + recubPx} x2={x} y2={cy + d / 2 - recubPx} stroke="#059669" strokeWidth="1.3" />;
      })}
      {/* Barras transversales: corren horizontalmente (a lo largo de "ancho"), repartidas a lo largo */}
      {Array.from({ length: nTrans }, (_, i) => {
        const frac = nTrans === 1 ? 0.5 : i / (nTrans - 1);
        const y = cy - d / 2 + recubPx + frac * (d - 2 * recubPx);
        return <line key={`t${i}`} x1={cx - w / 2 + recubPx} y1={y} x2={cx + w / 2 - recubPx} y2={y} stroke="#2563EB" strokeWidth="1.3" />;
      })}
      <text x={cx} y={cy - d / 2 - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {parrilla.longitudinal ? `${parrilla.longitudinal.cantidad}${z.parrilla_longitudinal?.calibre || '#—'} @${z.parrilla_longitudinal?.separacion || '—'}` : 'Long. —'}
      </text>
      <text x={cx + w / 2 + 8} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${cy})`}>
        {parrilla.transversal ? `${parrilla.transversal.cantidad}${z.parrilla_transversal?.calibre || '#—'} @${z.parrilla_transversal?.separacion || '—'}` : 'Trans. —'}
      </text>
      <text x={cx} y={cy + d / 2 + 22} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        Zapata {ancho || '—'} × {largo || '—'} m
      </text>
    </svg>
  );
}

/* Vista en planta (desde arriba) de TODO el conjunto: las 2 zapatas y la    */
/* viga que las une, con la cota de separación entre centros.               */
function PortonPlanta({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const zAncho = parseFloat(z.ancho) || 0;
  const zLargo = parseFloat(z.largo) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const scale = 40;
  const zAnchoPx = clamp((zAncho || 1) * scale, 30, 70);
  const zLargoPx = clamp((zLargo || 1) * scale, 30, 70);
  const vAnchoPx = clamp((vAncho || 0.3) * scale, 6, 16);
  const sepPx = clamp((separacion || 5) * scale, 110, 220);

  const cx = 150, cy = 100;
  const x1 = cx - sepPx / 2;
  const x2 = cx + sepPx / 2;

  return (
    <svg viewBox="0 0 300 190" className={PORTON_CSS_SIZE}>
      <rect x={x1 - zLargoPx / 2} y={cy - zAnchoPx / 2} width={zLargoPx} height={zAnchoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={x2 - zLargoPx / 2} y={cy - zAnchoPx / 2} width={zLargoPx} height={zAnchoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {sepPx - zLargoPx > 0 && (
        <rect x={x1 + zLargoPx / 2} y={cy - vAnchoPx / 2} width={sepPx - zLargoPx} height={vAnchoPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.2" />
      )}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={cy - zAnchoPx / 2 - 16} x2={x2} y2={cy - zAnchoPx / 2 - 16} />
        <line x1={x1} y1={cy - zAnchoPx / 2 - 20} x2={x1} y2={cy - zAnchoPx / 2 - 12} />
        <line x1={x2} y1={cy - zAnchoPx / 2 - 20} x2={x2} y2={cy - zAnchoPx / 2 - 12} />
      </g>
      <text x={cx} y={cy - zAnchoPx / 2 - 26} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {separacion || '—'} m (centro a centro)
      </text>
    </svg>
  );
}

/* Vista en elevación (de frente) de TODO el conjunto: las 2 zapatas abajo,  */
/* la viga entre ellas, y los 2 pedestales subiendo desde cada zapata.      */
function PortonElevacion({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const zLargo = parseFloat(z.largo) || 0;
  const zEspesor = parseFloat(z.espesor) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const pAltura = Math.max(0, desplante - zEspesor);
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const scale = 30;
  const zLargoPx = clamp((zLargo || 1) * scale, 26, 55);
  const zEspesorPx = clamp((zEspesor || 0.35) * scale, 8, 18);
  const soladoPx = clamp((espesorSolado || 0.05) * scale, 4, 9);
  const vAltoPx = clamp((vAlto || 0.35) * scale, 8, 18);
  const pAnchoPx = clamp((pAncho || 0.4) * scale, 16, 30);
  const pAlturaPx = clamp((pAltura || 0.7) * scale, 25, 70);
  const sepPx = clamp((separacion || 5) * scale, 110, 220);

  const cx = 150;
  const groundY = 40; // N.T.N. — a la altura de la parte de ARRIBA de los pedestales
  const pBotY = groundY + pAlturaPx; // = parte de arriba de la zapata
  const zBotY = pBotY + zEspesorPx; // = parte de abajo de la zapata
  const soladoBotY = zBotY + soladoPx;
  const x1 = cx - sepPx / 2;
  const x2 = cx + sepPx / 2;

  return (
    <svg viewBox="0 0 300 210" className={PORTON_CSS_SIZE}>
      <line x1={x1 - 30} y1={groundY} x2={x2 + 30} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={x1 - 34} y={groundY - 4} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Solado bajo cada zapata, y bajo el tramo de la viga entre ellas */}
      <rect x={x1 - zLargoPx / 2} y={zBotY} width={zLargoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      <rect x={x2 - zLargoPx / 2} y={zBotY} width={zLargoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      {x2 - zLargoPx / 2 - (x1 + zLargoPx / 2) > 0 && (
        <rect x={x1 + zLargoPx / 2} y={zBotY} width={x2 - zLargoPx / 2 - (x1 + zLargoPx / 2)} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      )}
      {/* Zapatas */}
      <rect x={x1 - zLargoPx / 2} y={pBotY} width={zLargoPx} height={zEspesorPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={x2 - zLargoPx / 2} y={pBotY} width={zLargoPx} height={zEspesorPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Viga, entre las caras internas de las zapatas (no penetra en ellas), */}
      {/* a la misma profundidad (su base coincide con el fondo de la zapata, */}
      {/* justo encima del solado).                                          */}
      {x2 - zLargoPx / 2 - (x1 + zLargoPx / 2) > 0 && (
        <rect
          x={x1 + zLargoPx / 2}
          y={zBotY - vAltoPx}
          width={x2 - zLargoPx / 2 - (x1 + zLargoPx / 2)}
          height={vAltoPx}
          fill="#EAF1FF"
          stroke="#152644"
          strokeWidth="1.2"
        />
      )}
      {/* Pedestales */}
      <rect x={x1 - pAnchoPx / 2} y={groundY} width={pAnchoPx} height={pAlturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <rect x={x2 - pAnchoPx / 2} y={groundY} width={pAnchoPx} height={pAlturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota de separación, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={groundY - 14} x2={x2} y2={groundY - 14} />
        <line x1={x1} y1={groundY - 18} x2={x1} y2={groundY - 10} />
        <line x1={x2} y1={groundY - 18} x2={x2} y2={groundY - 10} />
      </g>
      <text x={cx} y={groundY - 22} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        Separación (centro a centro): {separacion || '—'} m
      </text>
      {/* Cota de altura del pedestal, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - pAnchoPx / 2 - 14} y1={groundY} x2={x1 - pAnchoPx / 2 - 14} y2={pBotY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={groundY} x2={x1 - pAnchoPx / 2 - 18} y2={groundY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pBotY} x2={x1 - pAnchoPx / 2 - 18} y2={pBotY} />
      </g>
      <text x={x1 - pAnchoPx / 2 - 24} y={(groundY + pBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${x1 - pAnchoPx / 2 - 24}, ${(groundY + pBotY) / 2})`}>
        {pAltura > 0 ? pAltura.toFixed(2) : '—'} m
      </text>
      {/* Cota de espesor de zapata, a la derecha */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={x2 + zLargoPx / 2 + 14} y1={pBotY} x2={x2 + zLargoPx / 2 + 14} y2={zBotY} />
        <line x1={x2 + zLargoPx / 2 + 10} y1={pBotY} x2={x2 + zLargoPx / 2 + 18} y2={pBotY} />
        <line x1={x2 + zLargoPx / 2 + 10} y1={zBotY} x2={x2 + zLargoPx / 2 + 18} y2={zBotY} />
      </g>
      <text x={x2 + zLargoPx / 2 + 24} y={(pBotY + zBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${x2 + zLargoPx / 2 + 24}, ${(pBotY + zBotY) / 2})`}>
        {zEspesor || '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal del pedestal (planta): estribo con sus 2 ganchos y las  */
/* barras de esquina — igual criterio que en Inversores.                    */
/* Reparte "cantidad" barras alrededor del perímetro de un rectángulo：      */
/* siempre 4 en las esquinas, y las que sobren repartidas parejo entre los  */
/* 4 lados (ej. cantidad=8 → 4 esquinas + 1 a la mitad de cada lado).       */
function puntosPerimetroRectangulo(halfW, halfD, cantidad) {
  const puntos = [
    [-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD],
  ];
  const extra = Math.max(0, cantidad - 4);
  const porLado = Math.floor(extra / 4);
  const restante = extra % 4;
  const lados = [
    { fijo: 'y', valor: -halfD, min: -halfW, max: halfW }, // lado superior
    { fijo: 'x', valor: halfW, min: -halfD, max: halfD }, // lado derecho
    { fijo: 'y', valor: halfD, min: halfW, max: -halfW }, // lado inferior (invertido)
    { fijo: 'x', valor: -halfW, min: halfD, max: -halfD }, // lado izquierdo (invertido)
  ];
  lados.forEach((lado, li) => {
    const n = porLado + (li < restante ? 1 : 0);
    for (let i = 1; i <= n; i++) {
      const frac = i / (n + 1);
      const val = lado.min + frac * (lado.max - lado.min);
      puntos.push(lado.fijo === 'y' ? [val, lado.valor] : [lado.valor, val]);
    }
  });
  return puntos;
}

function PortonPedestalCorte({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.4;
  const pProfundo = parseFloat(p.profundo) || 0.4;
  const cantidad = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const w = clamp(pAncho * 130, 40, 100);
  const d = clamp(pProfundo * 130, 40, 100);
  const cx = 85, cy = 80;
  const recubPx = 7;
  const puntos = puntosPerimetroRectangulo(w / 2 - recubPx, d / 2 - recubPx, cantidad);

  return (
    <svg viewBox="0 0 180 190" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <line x1={cx - (w / 2 - recubPx) * 0.6} y1={cy + (d / 2 - recubPx) * 0.6} x2={cx - (w / 2 - recubPx) * 0.15} y2={cy + (d / 2 - recubPx) * 0.15} stroke="#2563EB" strokeWidth="1.3" />
      <line x1={cx - (w / 2 - recubPx) * 0.6} y1={cy - (d / 2 - recubPx) * 0.6} x2={cx - (w / 2 - recubPx) * 0.15} y2={cy - (d / 2 - recubPx) * 0.15} stroke="#2563EB" strokeWidth="1.3" />
      {puntos.map(([px, py], i) => (
        <circle key={i} cx={cx + px} cy={cy + py} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{pAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{pProfundo || '—'} m</text>
    </svg>
  );
}

/* Vista posterior (elevación) del despiece del pedestal: mismo criterio que */
/* Inversores — solo la mitad de las barras se ven (front+back se encimarían */
/* en la proyección), con ganchos hacia el centro, estribos centrados y con */
/* la separación real, y la altura que incluye el empotramiento en la       */
/* zapata (el acero llega hasta allá, aunque el concreto visible no).      */
function PortonPedestalElevacion({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.4;
  const pProfundo = parseFloat(p.profundo) || 0.4;
  const alturaTotal = Math.max(0, (parseFloat(datos.desplante) || 0) - (parseFloat(datos.zapata?.espesor) || 0)) + (parseFloat(p.empotramiento_zapata) || 0);
  const cantidadBarras = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const ganchosBarra = parseFloat(p.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[p.barras?.calibre];
  const estribos = calcularEstribos({ altura: alturaTotal, ancho: p.ancho, profundo: p.profundo, separacion: p.estribos?.separacion, calibre: p.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionM = parseFloat(p.estribos?.separacion) || 0;

  const w = clamp(pAncho * 130, 45, 100);
  const h = clamp((alturaTotal || 0.5) * 130, 90, 190);
  const cx = 90, topY = 30, botY = topY + h, recubPx = 7;
  const escala = alturaTotal > 0 ? h / alturaTotal : 130;

  // Las posiciones visibles en una elevación son las X ÚNICAS de las barras
  // repartidas en el perímetro — no la mitad de la cantidad total. Con 8
  // barras (4 esquinas + 4 a mitad de lado), solo hay 3 X distintas:
  // izquierda, centro (las de los lados frontal/posterior caen ahí) y derecha.
  const puntos = puntosPerimetroRectangulo(1, pProfundo / pAncho || 1, cantidadBarras);
  const xUnicas = Array.from(new Set(puntos.map(([px]) => Math.round(px * 1000) / 1000))).sort((a, b) => a - b);
  const barX = xUnicas.map((frac) => cx + (frac * (w - 2 * recubPx)) / 2);
  const distanciaEntreBarras = barX.length > 1 ? barX[barX.length - 1] - barX[0] : w;
  const ganchoMaximoSinChoque = (distanciaEntreBarras / 2) * 0.6;
  const ganchoPx = infoBarra ? clamp(Math.min(infoBarra.gancho * escala, ganchoMaximoSinChoque), 5, 13) : Math.min(10, ganchoMaximoSinChoque);

  const separacionPx = separacionM > 0 ? separacionM * escala : (h - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
  const totalSpanEstribos = (cantidadEstribos - 1) * separacionPx;
  const inicioEstribos = topY + recubPx + Math.max(0, (h - 2 * recubPx - totalSpanEstribos) / 2);
  const estriboY = [];
  for (let i = 0; i < cantidadEstribos; i++) estriboY.push(inicioEstribos + i * separacionPx);

  const ganchosLabel = ganchosBarra > 0 ? 'L'.repeat(Math.min(ganchosBarra, 2)) : '';
  const ganchoLongitud = infoBarra ? infoBarra.gancho : null;

  return (
    <svg viewBox="0 0 190 250" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboY.map((y, i) => (
        <line key={i} x1={cx - w / 2 + recubPx} y1={y} x2={cx + w / 2 - recubPx} y2={y} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {barX.map((x, i) => {
        const dir = x < cx ? 1 : x > cx ? -1 : 1;
        return (
          <g key={i}>
            <line x1={x} y1={topY + 2} x2={x} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />
            {ganchosBarra >= 1 && <line x1={x} y1={botY - 2} x2={x + dir * ganchoPx} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />}
            {ganchosBarra >= 2 && <line x1={x} y1={topY + 2} x2={x + dir * ganchoPx} y2={topY + 2} stroke="#059669" strokeWidth="1.6" />}
          </g>
        );
      })}
      <text x={cx} y={topY - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {cantidadBarras}{p.barras?.calibre || '#—'} {ganchosLabel}{ganchoLongitud !== null ? ganchoLongitud.toFixed(2) : ''}
      </text>
      <text x={cx + w / 2 + 8} y={(topY + botY) / 2} fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${(topY + botY) / 2})`} textAnchor="middle">
        {cantidadEstribos || '—'} E{p.estribos?.calibre || '#—'} @{p.estribos?.separacion || '—'}
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={topY} x2={cx - w / 2 - 16} y2={botY} />
        <line x1={cx - w / 2 - 12} y1={topY} x2={cx - w / 2 - 20} y2={topY} />
        <line x1={cx - w / 2 - 12} y1={botY} x2={cx - w / 2 - 20} y2={botY} />
      </g>
      <text x={cx - w / 2 - 26} y={(topY + botY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${(topY + botY) / 2})`}>
        {alturaTotal ? alturaTotal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal de la viga de amarre: 4 barras de esquina (2 arriba +   */
/* 2 abajo — las que luego se ven "duplicadas" en pares por el traslapo) +  */
/* el estribo con sus 2 ganchos.                                            */
function PortonVigaCorte({ datos }) {
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const vAncho = parseFloat(v.ancho) || 0.3;
  const vAlto = parseFloat(v.alto) || 0.35;
  const w = clamp(vAncho * 150, 40, 110);
  const d = clamp(vAlto * 150, 40, 110);
  const cx = 90, cy = 80;
  const recubPx = 7;

  return (
    <svg viewBox="0 0 180 190" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <line x1={cx - (w / 2 - recubPx) * 0.6} y1={cy + (d / 2 - recubPx) * 0.6} x2={cx - (w / 2 - recubPx) * 0.15} y2={cy + (d / 2 - recubPx) * 0.15} stroke="#2563EB" strokeWidth="1.3" />
      <line x1={cx - (w / 2 - recubPx) * 0.6} y1={cy - (d / 2 - recubPx) * 0.6} x2={cx - (w / 2 - recubPx) * 0.15} y2={cy - (d / 2 - recubPx) * 0.15} stroke="#2563EB" strokeWidth="1.3" />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={cx + sx * (w / 2 - recubPx)} cy={cy + sy * (d / 2 - recubPx)} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{vAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{vAlto || '—'} m</text>
    </svg>
  );
}


/* Vista posterior (elevación) de la viga a lo largo de su longitud: la      */
/* línea de arriba y la de abajo (cada una representa las 2 barras de esa    */
/* capa, que en elevación se ven encimadas) con la marca del traslapo en su  */
/* tercio correspondiente (arriba en L/3, abajo en 2L/3), los ganchos en el  */
/* extremo que ancla en cada zapata, y los estribos con su separación real.  */
function PortonVigaElevacion({ datos }) {
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const vAlto = parseFloat(v.alto) || 0.35;
  const longitudViga = (parseFloat(datos.separacion_zapatas) || 0) - (parseFloat(datos.zapata?.largo) || 0);
  const separacionEstribos = parseFloat(v.estribos?.separacion) || 0;
  const estribos = calcularEstribos({ altura: longitudViga > 0 ? longitudViga : undefined, ancho: v.ancho, profundo: v.alto, separacion: v.estribos?.separacion, calibre: v.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const ganchosBarra = parseFloat(v.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[v.barras?.calibre];

  const w = clamp((longitudViga || 5) * 40, 260, 420);
  const h = clamp(vAlto * 160, 40, 75);
  const cx = 220, topY = 50, leftX = cx - w / 2, rightX = cx + w / 2, botY = topY + h;
  const recubPx = 6;
  const escala = longitudViga > 0 ? w / longitudViga : 40;
  const ganchoPx = infoBarra ? clamp(infoBarra.gancho * escala, 8, 18) : 12;

  const estriboX = [];
  if (cantidadEstribos > 0) {
    const separacionPx = separacionEstribos > 0 ? separacionEstribos * escala : (w - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
    const totalSpan = (cantidadEstribos - 1) * separacionPx;
    const inicio = leftX + recubPx + Math.max(0, (w - 2 * recubPx - totalSpan) / 2);
    for (let i = 0; i < cantidadEstribos; i++) estriboX.push(inicio + i * separacionPx);
  }

  const tercio1 = leftX + w / 3;
  const tercio2 = leftX + (2 * w) / 3;

  return (
    <svg viewBox="0 0 440 170" className={PORTON_VIGA_ELEV_CSS_SIZE}>
      <rect x={leftX} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboX.map((x, i) => (
        <line key={i} x1={x} y1={topY + recubPx} x2={x} y2={botY - recubPx} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {/* Barra superior: gancho en AMBOS extremos (ancla en cada zapata), empalme marcado en L/3 */}
      <line x1={leftX + 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={topY + recubPx} x2={leftX + 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      <circle cx={tercio1} cy={topY + recubPx} r="2.8" fill="white" stroke="#059669" strokeWidth="1.3" />
      <text x={tercio1} y={topY - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">empalme 1/3</text>
      {/* Barra inferior: gancho en AMBOS extremos (ancla en cada zapata), empalme marcado en 2L/3 */}
      <line x1={leftX + 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={botY - recubPx} x2={leftX + 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      <circle cx={tercio2} cy={botY - recubPx} r="2.8" fill="white" stroke="#059669" strokeWidth="1.3" />
      <text x={tercio2} y={botY + 16} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">empalme 2/3</text>
      {/* Cota de longitud, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={leftX} y1={topY - 20} x2={rightX} y2={topY - 20} />
        <line x1={leftX} y1={topY - 24} x2={leftX} y2={topY - 16} />
        <line x1={rightX} y1={topY - 24} x2={rightX} y2={topY - 16} />
      </g>
      <text x={cx} y={topY - 28} textAnchor="middle" fontSize="9" fontWeight="600" fill="#152644">
        Longitud (entre caras internas) {longitudViga > 0 ? longitudViga.toFixed(2) : '—'} m
      </text>
      <text x={cx} y={botY + 32} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#2563EB">
        {cantidadEstribos || '—'} E{v.estribos?.calibre || '#—'} @{v.estribos?.separacion || '—'}
      </text>
    </svg>
  );
}

function PortonVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <PortonIsometrico datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico del conjunto</p>
      </div>
      <div className="text-center">
        <PortonPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Planta del conjunto</p>
      </div>
      <div className="text-center">
        <PortonElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Elevación del conjunto</p>
      </div>
      <div className="text-center">
        <PortonZapataPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección de zapata (con parrilla)</p>
      </div>
      <div className="text-center">
        <PortonPedestalCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · corte transversal</p>
      </div>
      <div className="text-center">
        <PortonPedestalElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · vista posterior</p>
      </div>
      <div className="text-center">
        <PortonVigaCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga · corte transversal</p>
      </div>
      <div className="text-center">
        <PortonVigaElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga · vista posterior</p>
      </div>
    </div>
  );
}

/* Garantiza que TODA la estructura anidada de datos exista, sin importar    */
/* qué tan vieja sea la plantilla guardada (por ejemplo, si se creó antes   */
/* de que existiera el campo "ganchos" de la viga, o antes de que la altura */
/* del pedestal se calculara sola). Sin esto, abrir una plantilla vieja      */
/* para editarla podía reventar con una pantalla en blanco.                */
function normalizarDatosPorton(datos) {
  const base = {
    zapata: {
      ancho: '', largo: '', espesor: '',
      parrilla_longitudinal: { calibre: '', separacion: '' },
      parrilla_transversal: { calibre: '', separacion: '' },
    },
    viga: {
      ancho: '', alto: '',
      barras: { calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    pedestal: {
      ancho: '', profundo: '', empotramiento_zapata: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    separacion_zapatas: '',
    desplante: '',
    espesor_solado: '',
    resistencia: '',
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    zapata: {
      ...base.zapata,
      ...datos.zapata,
      parrilla_longitudinal: { ...base.zapata.parrilla_longitudinal, ...datos.zapata?.parrilla_longitudinal },
      parrilla_transversal: { ...base.zapata.parrilla_transversal, ...datos.zapata?.parrilla_transversal },
    },
    viga: {
      ...base.viga,
      ...datos.viga,
      barras: { ...base.viga.barras, ...datos.viga?.barras },
      estribos: { ...base.viga.estribos, ...datos.viga?.estribos },
    },
    pedestal: {
      ...base.pedestal,
      ...datos.pedestal,
      barras: { ...base.pedestal.barras, ...datos.pedestal?.barras },
      estribos: { ...base.pedestal.estribos, ...datos.pedestal?.estribos },
    },
  };
}

function PortonForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosPorton(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }
  function setSubgrupo(grupo, subgrupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [subgrupo]: { ...prev[grupo][subgrupo], [key]: val } } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  const parrilla = calcularParrillaZapata({
    ancho: datos.zapata.ancho,
    largo: datos.zapata.largo,
    longitudinal: datos.zapata?.parrilla_longitudinal,
    transversal: datos.zapata?.parrilla_transversal,
  });
  const vigaBarras = calcularBarrasVigaAmarre({
    separacionCentros: datos.separacion_zapatas,
    calibre: datos.viga?.barras?.calibre,
    resistencia: datos.resistencia,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const longitudViga = (parseFloat(datos.separacion_zapatas) || 0) - (parseFloat(datos.zapata.largo) || 0);
  const vigaEstribos = calcularEstribos({
    altura: longitudViga > 0 ? longitudViga : undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });
  const alturaPedestal = Math.max(0, (parseFloat(datos.desplante) || 0) - (parseFloat(datos.zapata?.espesor) || 0));
  const alturaTotalPedestal = alturaPedestal + (parseFloat(datos.pedestal.empotramiento_zapata) || 0);
  const pedestalLongitudinales = calcularLongitudinales({
    altura: alturaTotalPedestal || undefined,
    cantidad: datos.pedestal?.barras?.cantidad,
    calibre: datos.pedestal?.barras?.calibre,
    ganchos: datos.pedestal?.barras?.ganchos,
  });
  const pedestalEstribos = calcularEstribos({
    altura: alturaTotalPedestal || undefined,
    ancho: datos.pedestal.ancho,
    profundo: datos.pedestal.profundo,
    separacion: datos.pedestal?.estribos?.separacion,
    calibre: datos.pedestal?.estribos?.calibre,
  });
  const volumenes = calcularVolumenesPorton({
    zapata: datos.zapata,
    viga: datos.viga,
    pedestal: datos.pedestal,
    separacionZapatas: datos.separacion_zapatas,
    desplante: datos.desplante,
    espesorSolado: datos.espesor_solado,
  });

  const pesoTotalAcero =
    (parrilla.longitudinal?.pesoTotal || 0) * 2 + // ×2 porque son 2 zapatas iguales
    (parrilla.transversal?.pesoTotal || 0) * 2 +
    (vigaBarras?.pesoTotal || 0) +
    (vigaEstribos?.pesoTotal ? vigaEstribos.pesoEstribo * vigaEstribos.cantidad : 0) +
    (pedestalLongitudinales?.pesoTotal || 0) +
    (pedestalEstribos?.pesoTotal || 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cerramiento · Portón
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <PortonVistas datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Portón Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
          <p className="text-xs text-navy-400 mt-1">Se usa para buscar el traslapo de la viga en la tabla NSR-10 (solo cubre 21/28/35 MPa).</p>
        </div>
      </div>

      <div className="border border-navy-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Datos compartidos del conjunto</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-navy-500 mb-1">Separación entre zapatas (centro a centro, m)</label>
            <input value={datos.separacion_zapatas} onChange={(e) => set('separacion_zapatas', e.target.value)} placeholder="5.27" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Profundidad de desplante (m)</label>
            <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="1.15" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2 italic">
          Estos 3 valores son de todo el conjunto (zapatas + viga) — la excavación se calcula con la huella completa (2 zapatas + el tramo de la viga entre ellas) por (desplante + espesor de solado).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Zapata */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Zapata (2 iguales)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.zapata.ancho} onChange={(e) => setGrupo('zapata', 'ancho', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Largo (m)</label>
              <input value={datos.zapata.largo} onChange={(e) => setGrupo('zapata', 'largo', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor (m)</label>
              <input value={datos.zapata.espesor} onChange={(e) => setGrupo('zapata', 'espesor', e.target.value)} placeholder="0.35" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-2">"Largo" es la dirección a lo largo del eje de la viga.</p>

          <p className="text-xs font-semibold text-navy-600 mb-2">Parrilla — dirección longitudinal (corre a lo largo de "Largo")</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.zapata.parrilla_longitudinal.calibre} onChange={(val) => setSubgrupo('zapata', 'parrilla_longitudinal', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.zapata.parrilla_longitudinal.separacion} onChange={(e) => setSubgrupo('zapata', 'parrilla_longitudinal', 'separacion', e.target.value)} placeholder="0.12" className={cellInput} />
            </div>
          </div>
          {parrilla.longitudinal ? (
            <p className="text-xs text-navy-500 mb-3">
              → <span className="font-mono font-semibold text-navy-700">{parrilla.longitudinal.cantidad}</span> barras de{' '}
              <span className="font-mono font-semibold text-navy-700">{parrilla.longitudinal.longitud.toFixed(2)} m</span> c/u (2 ganchos arriba) — {parrilla.longitudinal.pesoTotal.toFixed(2)} kg por zapata
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa ancho, largo, calibre y separación.</p>
          )}

          <p className="text-xs font-semibold text-navy-600 mb-2">Parrilla — dirección transversal (corre a lo largo de "Ancho")</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.zapata.parrilla_transversal.calibre} onChange={(val) => setSubgrupo('zapata', 'parrilla_transversal', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.zapata.parrilla_transversal.separacion} onChange={(e) => setSubgrupo('zapata', 'parrilla_transversal', 'separacion', e.target.value)} placeholder="0.24" className={cellInput} />
            </div>
          </div>
          {parrilla.transversal ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{parrilla.transversal.cantidad}</span> barras de{' '}
              <span className="font-mono font-semibold text-navy-700">{parrilla.transversal.longitud.toFixed(2)} m</span> c/u (2 ganchos arriba) — {parrilla.transversal.pesoTotal.toFixed(2)} kg por zapata
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa ancho, largo, calibre y separación.</p>
          )}
        </div>

        {/* Viga de amarre */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Viga de amarre</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho de sección (m)</label>
              <input value={datos.viga.ancho} onChange={(e) => setGrupo('viga', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto de sección (m)</label>
              <input value={datos.viga.alto} onChange={(e) => setGrupo('viga', 'alto', e.target.value)} placeholder="0.35" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Longitud (entre caras internas de las zapatas): <span className="font-mono text-navy-600">{longitudViga > 0 ? longitudViga.toFixed(2) : '—'} m</span>
          </p>
          <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales (8 en total: 4 líneas traslapadas en pares)</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.barras.calibre} onChange={(val) => setSubgrupo('viga', 'barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° de ganchos por pieza</label>
              <input value={datos.viga.barras.ganchos} onChange={(e) => setSubgrupo('viga', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {vigaBarras ? (
            <p className="text-xs text-navy-500 mb-3">
              → Traslapo de <span className="font-mono font-semibold text-navy-700">{vigaBarras.traslapo.toFixed(2)} m</span> (arriba a 1/3, abajo a 2/3) · pieza corta{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaBarras.piezaCorta.toFixed(2)} m</span> · pieza larga{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaBarras.piezaLarga.toFixed(2)} m</span> · {vigaBarras.piezas} piezas en total — {vigaBarras.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa separación entre zapatas, resistencia y calibre.</p>
          )}
          <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.estribos.calibre} onChange={(val) => setSubgrupo('viga', 'estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.viga.estribos.separacion} onChange={(e) => setSubgrupo('viga', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {vigaEstribos ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{vigaEstribos.cantidad}</span> estribos de{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaEstribos.longitud.toFixed(2)} m</span> c/u — {(vigaEstribos.pesoEstribo * vigaEstribos.cantidad).toFixed(2)} kg en total
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa ancho, alto, separación y calibre.</p>
          )}
        </div>

        {/* Pedestal */}
        <div className="border border-navy-200 rounded-lg p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestal (2 iguales, van sobre la zapata)</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Empotramiento en zapata (m)</label>
              <input value={datos.pedestal.empotramiento_zapata} onChange={(e) => setGrupo('pedestal', 'empotramiento_zapata', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Altura del pedestal (desplante − espesor de zapata): <span className="font-mono text-navy-600">{alturaPedestal > 0 ? alturaPedestal.toFixed(2) : '—'} m</span>
          </p>
          <p className="text-xs text-navy-400 mb-3 italic">
            El pedestal se apoya ENCIMA de la zapata, va enterrado (el nivel de terreno natural queda a la altura de su parte superior) — no tiene solado propio ni cuenta aparte en la excavación. El "empotramiento" es solo para saber hasta dónde llega el acero dentro de la zapata.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° barras</label>
                  <input value={datos.pedestal.barras.cantidad} onChange={(e) => setSubgrupo('pedestal', 'barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.barras.calibre} onChange={(val) => setSubgrupo('pedestal', 'barras', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° ganchos</label>
                  <input value={datos.pedestal.barras.ganchos} onChange={(e) => setSubgrupo('pedestal', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
                </div>
              </div>
              {pedestalLongitudinales ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalLongitudinales.longitud.toFixed(2)} m</span> c/u — {pedestalLongitudinales.pesoTotal.toFixed(2)} kg (2 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa altura, empotramiento, cantidad y calibre.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.estribos.calibre} onChange={(val) => setSubgrupo('pedestal', 'estribos', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
                  <input value={datos.pedestal.estribos.separacion} onChange={(e) => setSubgrupo('pedestal', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
                </div>
              </div>
              {pedestalEstribos ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.cantidad}</span> estribos de{' '}
                  <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.longitud.toFixed(2)} m</span> — {pedestalEstribos.pesoTotal.toFixed(2)} kg (2 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa altura, empotramiento, dimensiones, separación y calibre.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {pesoTotalAcero > 0 && (
        <div className="mt-4 bg-white border border-navy-200 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-navy-700 mb-2">Peso de acero por elemento</p>
          <FilaResumenAcero label="Zapata — parrilla longitudinal (2 zapatas)" valor={`${((parrilla.longitudinal?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Zapata — parrilla transversal (2 zapatas)" valor={`${((parrilla.transversal?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Viga — barras longitudinales (8 piezas)" valor={`${(vigaBarras?.pesoTotal || 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Viga — estribos" valor={`${(vigaEstribos ? vigaEstribos.pesoEstribo * vigaEstribos.cantidad : 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Pedestal — barras longitudinales (2 pedestales)" valor={`${(pedestalLongitudinales?.pesoTotal || 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Pedestal — estribos (2 pedestales)" valor={`${(pedestalEstribos?.pesoTotal || 0).toFixed(2)} kg`} />
        </div>
      )}
      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* SHELTER · CENTRO DE TRANSFORMACIÓN (CT) — 4 pedestales +       */
/* 4 vigas (2 largas, 2 cortas) formando un marco. Sin zapata.    */
/* ============================================================ */
const CT_VB_W = 320;
const CT_VB_H = 260;
const CT_M2PX = 42;
const CT_CSS_SIZE = 'w-80 h-64';

/* Garantiza que toda la estructura anidada exista, sin importar qué tan     */
/* vieja sea la plantilla guardada — mismo motivo que en Portón: sin esto,   */
/* abrir una plantilla vieja para editarla puede reventar con pantalla en   */
/* blanco.                                                                   */
function normalizarDatosCT(datos) {
  const base = {
    ancho: '', largo: '',
    desplante: '', sobresaliente: '0.50',
    espesor_solado: '', resistencia: '',
    pedestal: {
      ancho: '', profundo: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    viga: {
      ancho: '', alto: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    pedestal: {
      ...base.pedestal,
      ...datos.pedestal,
      barras: { ...base.pedestal.barras, ...datos.pedestal?.barras },
      estribos: { ...base.pedestal.estribos, ...datos.pedestal?.estribos },
    },
    viga: {
      ...base.viga,
      ...datos.viga,
      barras: { ...base.viga.barras, ...datos.viga?.barras },
      estribos: { ...base.viga.estribos, ...datos.viga?.estribos },
    },
  };
}

/* Isométrico del marco completo: 4 pedestales en las esquinas + 4 vigas     */
/* (2 largas + 2 cortas) uniéndolos. Las vigas se dibujan ANTES que los      */
/* pedestales — en las 4 esquinas, el pedestal siempre tapa el extremo de   */
/* la viga que llega a él (la viga "entra" al pedestal), así que este orden */
/* funciona en las 4 esquinas a la vez (a diferencia del Portón, que solo   */
/* tenía 2 esquinas con relación de profundidad opuesta entre sí).          */
function CTIsometrico({ datos }) {
  const p = datos.pedestal || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const anchoCT = parseFloat(datos.ancho) || 0;
  const largoCT = parseFloat(datos.largo) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const alturaPedestal = desplante + sobresaliente;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;

  const anchoPx = clamp((anchoCT || 2) * CT_M2PX, 70, 160);
  const largoPx = clamp((largoCT || 3) * CT_M2PX, 90, 200);
  const pAnchoPx = clamp((pAncho || 0.3) * CT_M2PX, 12, 26);
  const pProfundoPx = clamp((pProfundo || 0.3) * CT_M2PX, 12, 26);
  const pAlturaPx = clamp((alturaPedestal || 1) * CT_M2PX, 30, 75);
  const vAnchoPx = clamp((vAncho || 0.3) * CT_M2PX, 8, 18);
  const vAltoPx = clamp((vAlto || 0.3) * CT_M2PX, 8, 18);
  const soladoPx = clamp((espesorSolado || 0.05) * CT_M2PX, 4, 9);

  const halfAncho = anchoPx / 2;
  const halfLargo = largoPx / 2;
  const soladoZ0 = 0;
  const soladoZ1 = soladoPx;
  const pedestalZ0 = soladoPx;
  const pedestalZ1 = soladoPx + pAlturaPx;
  const ntnZ = soladoPx + clamp((desplante || 0.5) * CT_M2PX, 20, 60);
  const vigaZ1 = ntnZ;
  const vigaZ0 = ntnZ - vAltoPx;

  const ox = CT_VB_W / 2;
  const oy = 30 + halfLargo + pedestalZ1;

  // Las 4 esquinas, en coordenadas de centro de pedestal
  const esquinas = [
    [-halfAncho, -halfLargo],
    [halfAncho, -halfLargo],
    [halfAncho, halfLargo],
    [-halfAncho, halfLargo],
  ];

  return (
    <svg viewBox={`0 0 ${CT_VB_W} ${CT_VB_H}`} className={CT_CSS_SIZE}>
      {/* Solado bajo cada pedestal */}
      {esquinas.map(([ex, ey], i) => (
        <IsoBoxLineArt key={`sol${i}`} x0={ex - pAnchoPx / 2} y0={ey - pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={soladoZ0} z1={soladoZ1} ox={ox} oy={oy} />
      ))}
      {/* Vigas cortas (conectan esquinas del mismo lado "ancho", corriendo en X) */}
      <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={-halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      {/* Vigas largas (conectan esquinas del mismo lado "largo", corriendo en Y) */}
      <IsoBoxLineArt x0={-halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      <IsoBoxLineArt x0={halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      {/* Los 4 pedestales, dibujados AL FINAL para que tapen los extremos de las vigas */}
      {esquinas.map(([ex, ey], i) => (
        <IsoBoxLineArt key={`ped${i}`} x0={ex - pAnchoPx / 2} y0={ey - pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
      ))}
      <text x={ox} y={CT_VB_H - 10} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {anchoCT || '—'} × {largoCT || '—'} m (centro a centro) · Altura pedestal {alturaPedestal ? alturaPedestal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

function CTForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosCT(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }
  function setSubgrupo(grupo, subgrupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [subgrupo]: { ...prev[grupo][subgrupo], [key]: val } } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  const alturaPedestal = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const pedestalLongitudinales = calcularLongitudinales({
    altura: alturaPedestal || undefined,
    cantidad: datos.pedestal?.barras?.cantidad,
    calibre: datos.pedestal?.barras?.calibre,
    ganchos: datos.pedestal?.barras?.ganchos,
  });
  const pedestalEstribos = calcularEstribos({
    altura: alturaPedestal || undefined,
    ancho: datos.pedestal.ancho,
    profundo: datos.pedestal.profundo,
    separacion: datos.pedestal?.estribos?.separacion,
    calibre: datos.pedestal?.estribos?.calibre,
  });

  const vigaLarga = calcularBarrasVigaCT({
    longitudCentros: datos.largo,
    dimensionPedestalMismaDireccion: datos.pedestal.profundo,
    cantidad: datos.viga?.barras?.cantidad,
    calibre: datos.viga?.barras?.calibre,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const vigaCorta = calcularBarrasVigaCT({
    longitudCentros: datos.ancho,
    dimensionPedestalMismaDireccion: datos.pedestal.ancho,
    cantidad: datos.viga?.barras?.cantidad,
    calibre: datos.viga?.barras?.calibre,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const longitudLibreLarga = Math.max(0, (parseFloat(datos.largo) || 0) - (parseFloat(datos.pedestal.profundo) || 0));
  const longitudLibreCorta = Math.max(0, (parseFloat(datos.ancho) || 0) - (parseFloat(datos.pedestal.ancho) || 0));
  const vigaLargaEstribos = calcularEstribos({
    altura: longitudLibreLarga || undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });
  const vigaCortaEstribos = calcularEstribos({
    altura: longitudLibreCorta || undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });

  const volumenes = calcularVolumenesCT({
    ancho: datos.ancho,
    largo: datos.largo,
    pedestal: datos.pedestal,
    viga: datos.viga,
    desplante: datos.desplante,
    sobresaliente: datos.sobresaliente,
    espesorSolado: datos.espesor_solado,
  });

  const pesoTotalAcero =
    (pedestalLongitudinales?.pesoTotal || 0) * 4 +
    (pedestalEstribos?.pesoTotal || 0) * 4 +
    (vigaLarga?.pesoTotal || 0) * 2 +
    (vigaCorta?.pesoTotal || 0) * 2 +
    (vigaLargaEstribos ? vigaLargaEstribos.pesoEstribo * vigaLargaEstribos.cantidad * 2 : 0) +
    (vigaCortaEstribos ? vigaCortaEstribos.pesoEstribo * vigaCortaEstribos.cantidad * 2 : 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Shelter · Centro de Transformación
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <CTIsometrico datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. CT Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="border border-navy-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Datos compartidos del conjunto</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-navy-500 mb-1">Ancho (centro a centro, m)</label>
            <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="2.10" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Largo (centro a centro, m)</label>
            <input value={datos.largo} onChange={(e) => set('largo', e.target.value)} placeholder="2.90" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Desplante (m)</label>
            <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.90" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Sobresaliente (m)</label>
            <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.50" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2">
          Altura del pedestal: <span className="font-mono text-navy-600">{alturaPedestal.toFixed(2)} m</span> (desplante + sobresaliente — el N.T.N. coincide con la parte de arriba de la viga)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestal (4 iguales)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° barras</label>
                  <input value={datos.pedestal.barras.cantidad} onChange={(e) => setSubgrupo('pedestal', 'barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.barras.calibre} onChange={(val) => setSubgrupo('pedestal', 'barras', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° ganchos</label>
                  <input value={datos.pedestal.barras.ganchos} onChange={(e) => setSubgrupo('pedestal', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
                </div>
              </div>
              {pedestalLongitudinales ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalLongitudinales.longitud.toFixed(2)} m</span> c/u — {(pedestalLongitudinales.pesoTotal * 4).toFixed(2)} kg (4 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa altura, cantidad y calibre.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.estribos.calibre} onChange={(val) => setSubgrupo('pedestal', 'estribos', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
                  <input value={datos.pedestal.estribos.separacion} onChange={(e) => setSubgrupo('pedestal', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
                </div>
              </div>
              {pedestalEstribos ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.cantidad}</span> de{' '}
                  <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.longitud.toFixed(2)} m</span> — {(pedestalEstribos.pesoTotal * 4).toFixed(2)} kg (4 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa dimensiones, separación y calibre.</p>
              )}
            </div>
          </div>
        </div>

        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Viga (4 iguales en sección, 2 largas + 2 cortas)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho de sección (m)</label>
              <input value={datos.viga.ancho} onChange={(e) => setGrupo('viga', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto de sección (m)</label>
              <input value={datos.viga.alto} onChange={(e) => setGrupo('viga', 'alto', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales (continuas, sin traslapo — de cara externa a cara externa de pedestales)</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° de barras</label>
              <input value={datos.viga.barras.cantidad} onChange={(e) => setSubgrupo('viga', 'barras', 'cantidad', e.target.value)} placeholder="6" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.barras.calibre} onChange={(val) => setSubgrupo('viga', 'barras', 'calibre', val)} className={cellInput} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-navy-500 mb-1">N.° de ganchos por barra</label>
            <input value={datos.viga.barras.ganchos} onChange={(e) => setSubgrupo('viga', 'barras', 'ganchos', e.target.value)} placeholder="1" className={`${cellInput} max-w-[120px]`} />
          </div>
          {vigaLarga && vigaCorta ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2 mb-3">
              <FilaResumenAcero label="Vigas largas (2) — longitud c/u" valor={`${vigaLarga.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Vigas largas (2) — peso total" valor={`${(vigaLarga.pesoTotal * 2).toFixed(2)} kg`} />
              <FilaResumenAcero label="Vigas cortas (2) — longitud c/u" valor={`${vigaCorta.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Vigas cortas (2) — peso total" valor={`${(vigaCorta.pesoTotal * 2).toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa ancho/largo del conjunto, dimensiones del pedestal, cantidad y calibre.</p>
          )}
          <p className="text-xs font-semibold text-navy-600 mb-2">Estribos (dentro del tramo libre entre pedestales)</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.estribos.calibre} onChange={(val) => setSubgrupo('viga', 'estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.viga.estribos.separacion} onChange={(e) => setSubgrupo('viga', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {vigaLargaEstribos && vigaCortaEstribos ? (
            <p className="text-xs text-navy-500">
              → Largas: <span className="font-mono font-semibold text-navy-700">{vigaLargaEstribos.cantidad}</span> de {vigaLargaEstribos.longitud.toFixed(2)} m ·
              Cortas: <span className="font-mono font-semibold text-navy-700">{vigaCortaEstribos.cantidad}</span> de {vigaCortaEstribos.longitud.toFixed(2)} m
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, separación y calibre.</p>
          )}
        </div>
      </div>

      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* SHELTER · TRAMPA DE ACEITE — caja de concreto (4 paredes +     */
/* losa inferior, sin losa superior), con anillos horizontales   */
/* y barras verticales en "U".                                   */
/* ============================================================ */
const TRAMPA_VB_W = 260;
const TRAMPA_VB_H = 220;
const TRAMPA_M2PX = 90;
const TRAMPA_CSS_SIZE = 'w-64 h-56';

function TrampaAceitePreview({ datos }) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;

  const anchoPx = clamp((ancho || 1.5) * TRAMPA_M2PX, 50, 110);
  const profundoPx = clamp((profundo || 1.2) * TRAMPA_M2PX, 40, 100);
  const altoPx = clamp((alto || 0.85) * TRAMPA_M2PX, 30, 80);
  const soladoPx = clamp((espesorSolado || 0.05) * TRAMPA_M2PX, 4, 9);
  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const ox = TRAMPA_VB_W / 2;
  const oy = 26 + halfW + altoPx + soladoPx;

  return (
    <svg viewBox={`0 0 ${TRAMPA_VB_W} ${TRAMPA_VB_H}`} className={TRAMPA_CSS_SIZE}>
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={soladoPx} z1={soladoPx + altoPx} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#F6F7F9" />
      <text x={ox} y={TRAMPA_VB_H - 12} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {ancho || '—'} × {profundo || '—'} × {alto || '—'} m
      </text>
    </svg>
  );
}

function TrampaAceiteForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || {
      ancho: '', profundo: '', alto: '',
      espesor_pared: '', espesor_losa: '', espesor_solado: '',
      resistencia: '',
      anillos: { calibre: '', separacion: '' },
      u_largo: { calibre: '', separacion: '' },
      u_corto: { calibre: '', separacion: '' },
    }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  const anillos = calcularAnillosTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: datos.alto,
    espesorPared: datos.espesor_pared,
    separacion: datos.anillos?.separacion, calibre: datos.anillos?.calibre,
  });
  const uLargo = calcularUTrampa({
    dimensionTransversal: datos.ancho, dimensionReparto: datos.profundo,
    alto: datos.alto, espesorPared: datos.espesor_pared,
    separacion: datos.u_largo?.separacion, calibre: datos.u_largo?.calibre,
  });
  const uCorto = calcularUTrampa({
    dimensionTransversal: datos.profundo, dimensionReparto: datos.ancho,
    alto: datos.alto, espesorPared: datos.espesor_pared,
    separacion: datos.u_corto?.separacion, calibre: datos.u_corto?.calibre,
  });
  const volumenes = calcularVolumenesTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: datos.alto,
    espesorPared: datos.espesor_pared, espesorLosa: datos.espesor_losa,
    espesorSolado: datos.espesor_solado,
  });
  const pesoTotalAcero = (anillos?.pesoTotal || 0) + (uLargo?.pesoTotal || 0) + (uCorto?.pesoTotal || 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Shelter · Trampa de aceite
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <TrampaAceitePreview datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 280 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Trampa de aceite Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho exterior (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="1.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo exterior (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="1.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto (m)</label>
              <input value={datos.alto} onChange={(e) => set('alto', e.target.value)} placeholder="0.85" className={cellInput} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de pared (m)</label>
              <input value={datos.espesor_pared} onChange={(e) => set('espesor_pared', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de losa (m)</label>
              <input value={datos.espesor_losa} onChange={(e) => set('espesor_losa', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
              <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">Anillos horizontales</p>
          <p className="text-xs text-navy-400 mb-3">Continuos, gancho a 180° en ambos extremos.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.anillos.calibre} onChange={(val) => setGrupo('anillos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.anillos.separacion} onChange={(e) => setGrupo('anillos', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {anillos ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{anillos.cantidad}</span> anillos de{' '}
              <span className="font-mono font-semibold text-navy-700">{anillos.longitud.toFixed(2)} m</span> — {anillos.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">U · lado largo</p>
          <p className="text-xs text-navy-400 mb-3">Patas suben por las paredes largas; se reparte a lo largo.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.u_largo.calibre} onChange={(val) => setGrupo('u_largo', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.u_largo.separacion} onChange={(e) => setGrupo('u_largo', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {uLargo ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{uLargo.cantidad}</span> de{' '}
              <span className="font-mono font-semibold text-navy-700">{uLargo.longitud.toFixed(2)} m</span> — {uLargo.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">U · lado corto</p>
          <p className="text-xs text-navy-400 mb-3">Patas suben por las paredes cortas; se reparte a lo ancho.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.u_corto.calibre} onChange={(val) => setGrupo('u_corto', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.u_corto.separacion} onChange={(e) => setGrupo('u_corto', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {uCorto ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{uCorto.cantidad}</span> de{' '}
              <span className="font-mono font-semibold text-navy-700">{uCorto.longitud.toFixed(2)} m</span> — {uCorto.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
      </div>

      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* Registro por tipo: qué formulario/vista/resumen usar en la lista según el */
/* tipo de cimentación activo. Se va llenando a medida que construimos cada  */
/* uno — los que faltan simplemente no aparecen aquí (CimentacionesView ya   */
/* filtra por "disponible" antes de llegar a este punto).                   */
const CIMENTACION_COMPONENTES = {
  postes_mt: {
    Form: PostesMtForm,
    Preview: PostesMtPreview,
    resumen: (d) => `Ø ${d.diametro || '—'} m · ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  },
  luminarias: {
    Form: LuminariasForm,
    Preview: LuminariasPreview,
    resumen: (d) => `${d.ancho || '—'} × ${d.profundo || '—'} m · ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  },
  camaras: {
    Form: CamarasForm,
    Preview: CamarasPreview,
    resumen: (d) => `${d.ancho || '—'} × ${d.profundo || '—'} m · ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  },
  inversores: {
    Form: InversoresForm,
    Preview: InversoresIsometrico,
    resumen: (d) => {
      const p = d.pedestal || {};
      const l = d.losa || {};
      return `Losa ${l.ancho || '—'}×${l.largo || '—'} m · Pedestales ${p.ancho || '—'}×${p.profundo || '—'} m`;
    },
  },
  cerramiento_postes: {
    Form: PostesMtForm,
    Preview: PostesMtPreview,
    resumen: (d) => `Ø ${d.diametro || '—'} m · ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  },
  cerramiento_porton: {
    Form: PortonForm,
    Preview: PortonIsometrico,
    resumen: (d) => `Zapatas ${d.zapata?.ancho || '—'}×${d.zapata?.largo || '—'} m · Separación ${d.separacion_zapatas || '—'} m`,
  },
  cerramiento_paso_fauna: {
    Form: PasoFaunaForm,
    Preview: PasoFaunaPreview,
    resumen: (d) => `${d.ancho || '—'} × ${d.profundo || '—'} × ${d.alto || '—'} m`,
  },
  shelter_ct: {
    Form: CTForm,
    Preview: CTIsometrico,
    resumen: (d) => `${d.ancho || '—'} × ${d.largo || '—'} m · 4 pedestales ${d.pedestal?.ancho || '—'}×${d.pedestal?.profundo || '—'} m`,
  },
  shelter_trampa_aceite: {
    Form: TrampaAceiteForm,
    Preview: TrampaAceitePreview,
    resumen: (d) => `${d.ancho || '—'} × ${d.profundo || '—'} × ${d.alto || '—'} m`,
  },
};

/* Vista principal de "Cimentaciones": elige el tipo (6 en total, hoy solo   */
/* Postes MT está construido) y administra sus plantillas (crear, editar,   */
/* eliminar). Las que no están listas muestran un aviso de "muy pronto".    */
/* Lista de fórmulas usadas en Cimentaciones, en texto plano — parte de la   */
/* "puerta trasera" de solo lectura para que un Desarrollador pueda          */
/* auditarlas sin tener que leer el código fuente. Se va ampliando a medida */
/* que se agregan más tipos de cimentación.                                */
const FORMULAS_REFERENCIA = [
  { titulo: 'Longitud de barra longitudinal (pedestales)', formula: 'longitud = altura − 2×recubrimiento + (N.° de ganchos × gancho del calibre)' },
  { titulo: 'Peso de una barra', formula: 'peso = longitud × peso por metro del calibre' },
  { titulo: 'Cantidad de estribos (pedestales)', formula: 'cantidad = techo[ (altura − 2×recubrimiento) / separación ]' },
  { titulo: 'Longitud de un estribo', formula: 'longitud = 2×(ancho + profundo − 4×recubrimiento) + 2×gancho del calibre' },
  { titulo: 'Volumen de concreto — sección circular (Postes MT)', formula: 'concreto = π×(diámetro/2)² × (desplante + sobresaliente)' },
  { titulo: 'Volumen de concreto — sección rectangular (Luminarias, Cámaras, pedestales)', formula: 'concreto = ancho × profundo × (desplante + sobresaliente)' },
  { titulo: 'Volumen de excavación', formula: 'excavación = área de la sección × (desplante + espesor de solado)' },
  { titulo: 'Volumen de solado', formula: 'solado = área de la sección × espesor de solado' },
  { titulo: 'Inversores — volumen de excavación', formula: 'excavación = área de UN pedestal × (desplante + espesor de solado) × 2 — la losa no se excava, va sobre el nivel de terreno natural' },
  { titulo: 'Traslapo de barras (viga de amarre, Cerramiento)', formula: 'se busca en la tabla de traslapos por calibre y resistencia del concreto (NSR-10, redondeada hacia arriba al múltiplo de 0.05m más cercano) — no es una fórmula, es una tabla' },
  { titulo: 'Cantidad de barras de la parrilla (zapata del Portón)', formula: 'cantidad = techo[ (dimensión perpendicular − 2×recubrimiento) / separación ]  —  SIN sumar 1' },
  { titulo: 'Longitud de barra de la parrilla', formula: 'longitud = dimensión paralela − 2×recubrimiento + 2×gancho del calibre (2 ganchos, uno en cada extremo, hacia arriba)' },
  { titulo: 'Piezas de barra longitudinal (viga de amarre)', formula: 'traslapo a tercios, no a la mitad — arriba en L/3, abajo en 2L/3 (nunca en el mismo tercio). Pieza corta = L/3 + traslapo/2; pieza larga = 2L/3 + traslapo/2. Cada una de las 4 líneas (2 arriba + 2 abajo) usa 1 pieza corta + 1 larga = 8 piezas en total.' },
  { titulo: 'Longitud de barra del pedestal (Portón, sobre zapata)', formula: 'longitud = (altura sobre la zapata + empotramiento en la zapata) − 2×recubrimiento + (N.° de ganchos × gancho del calibre)' },
  { titulo: 'Volumen de excavación del conjunto Portón', formula: 'excavación = [2×(ancho×largo de zapata) + (separación entre zapatas − largo de zapata)×ancho de la viga] × (desplante + espesor de solado) — el pedestal no aporta, ya queda incluido' },
];

/* "Puerta trasera": solo el rol Desarrollador puede ver y editar estos       */
/* números (recubrimiento, gancho/peso por calibre, traslapos), y ver         */
/* (sin poder editar) las fórmulas que los combinan. Los números se guardan  */
/* en Supabase y se aplican de inmediato en toda la app sin necesitar un      */
/* despliegue nuevo.                                                         */
function ParametrosIngenieriaView({ parametros, onGuardar }) {
  const [recubrimiento, setRecubrimiento] = useState(String(parametros.recubrimiento));
  const [barras, setBarras] = useState(() => JSON.parse(JSON.stringify(parametros.barras)));
  const [traslapos, setTraslapos] = useState(() => JSON.parse(JSON.stringify(parametros.traslapos)));
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const resistenciasTraslapo = ['21 MPa', '28 MPa', '35 MPa'];
  const cellInput = 'w-full rounded-md border border-navy-300 px-2 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-lime-400';

  function setBarraCampo(calibre, campo, val) {
    setBarras((prev) => ({ ...prev, [calibre]: { ...prev[calibre], [campo]: val } }));
  }
  function setTraslapoCampo(calibre, resistencia, val) {
    setTraslapos((prev) => ({ ...prev, [calibre]: { ...(prev[calibre] || {}), [resistencia]: val } }));
  }

  async function guardar() {
    setGuardando(true);
    const datosLimpios = {
      recubrimiento: parseFloat(recubrimiento) || 0,
      barras: Object.fromEntries(Object.entries(barras).map(([cal, v]) => [cal, { gancho: parseFloat(v.gancho) || 0, peso: parseFloat(v.peso) || 0 }])),
      traslapos: Object.fromEntries(
        Object.entries(traslapos).map(([cal, v]) => [cal, Object.fromEntries(Object.entries(v).map(([r, val]) => [r, parseFloat(val) || 0]))])
      ),
    };
    await onGuardar(datosLimpios);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-lime-600 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Parámetros de Ingeniería</h1>
          <p className="text-navy-500 text-sm">
            Solo visible para el rol Desarrollador. Estos valores alimentan todos los cálculos de acero de Cimentaciones.
          </p>
        </div>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Recubrimiento (m)</p>
        <input value={recubrimiento} onChange={(e) => setRecubrimiento(e.target.value)} className={`${cellInput} max-w-[140px]`} />
        <p className="text-xs text-navy-400 mt-1">Se usa igual en todas las cimentaciones (postes, zapatas, vigas, pedestales, estribos).</p>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5 overflow-x-auto">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Gancho y peso por calibre</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-navy-400 text-left">
              <th className="pb-2 pr-3">Calibre</th>
              <th className="pb-2 pr-3">Gancho (m)</th>
              <th className="pb-2">Peso (kg/m)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(barras).map((cal) => (
              <tr key={cal}>
                <td className="py-1 pr-3 font-mono font-semibold text-navy-700">{cal}</td>
                <td className="py-1 pr-3 w-32">
                  <input value={barras[cal].gancho} onChange={(e) => setBarraCampo(cal, 'gancho', e.target.value)} className={cellInput} />
                </td>
                <td className="py-1 w-32">
                  <input value={barras[cal].peso} onChange={(e) => setBarraCampo(cal, 'peso', e.target.value)} className={cellInput} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5 overflow-x-auto">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-1">Traslapos (m) por calibre y resistencia</p>
        <p className="text-xs text-navy-400 mb-3">Tabla de traslapos tipo B a tensión (NSR-10). Solo cubre 21/28/35 MPa.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-navy-400 text-left">
              <th className="pb-2 pr-3">Calibre</th>
              {resistenciasTraslapo.map((r) => (
                <th key={r} className="pb-2 pr-3">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(barras).map((cal) => (
              <tr key={cal}>
                <td className="py-1 pr-3 font-mono font-semibold text-navy-700">{cal}</td>
                {resistenciasTraslapo.map((r) => (
                  <td key={r} className="py-1 pr-3 w-28">
                    <input value={traslapos[cal]?.[r] ?? ''} onChange={(e) => setTraslapoCampo(cal, r, e.target.value)} className={cellInput} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={guardar}
        disabled={guardando}
        className="bg-lime-500 hover:bg-lime-600 disabled:opacity-60 text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-lg mb-8 transition-colors"
      >
        {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      <div className="bg-navy-50 border border-navy-200 rounded-xl p-5">
        <p className="text-sm font-bold text-navy-700 mb-1">Fórmulas usadas (solo lectura)</p>
        <p className="text-xs text-navy-400 mb-3">Para corregir una fórmula (no solo un número) hay que pedir un cambio de código — esto es solo para verificarlas.</p>
        <div className="space-y-3">
          {FORMULAS_REFERENCIA.map((f, i) => (
            <div key={i} className="border-b border-navy-200 pb-2.5 last:border-0">
              <p className="text-xs font-semibold text-navy-700 mb-0.5">{f.titulo}</p>
              <p className="text-xs font-mono text-navy-600">{f.formula}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CimentacionesView({ plantillas, onAdd, onUpdate, onDelete, mallas, onAddMalla, perfil, parametrosIngenieria, onGuardarParametros }) {
  const [tipoActivo, setTipoActivo] = useState('postes_mt');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [mostrandoParametros, setMostrandoParametros] = useState(false);

  const tipoDef = CIMENTACION_TIPOS.find((t) => t.id === tipoActivo);
  const plantillasDelTipo = plantillas.filter((p) => p.tipo === tipoActivo);
  const componentes = CIMENTACION_COMPONENTES[tipoActivo];

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
  }

  if (mostrandoParametros) {
    return (
      <div>
        <div className="px-4 md:px-8 pt-4 md:pt-8 max-w-4xl mx-auto">
          <button onClick={() => setMostrandoParametros(false)} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-700 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver a Cimentaciones
          </button>
        </div>
        <ParametrosIngenieriaView parametros={parametrosIngenieria} onGuardar={onGuardarParametros} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Cimentaciones</h1>
          <p className="text-navy-500 text-sm mt-1">
            Plantillas reutilizables de dimensiones y despiece — se crean una vez y se usan en cualquier proyecto sin volver a digitarlas.
          </p>
        </div>
        {isDeveloper(perfil) && (
          <button
            onClick={() => setMostrandoParametros(true)}
            title="Solo Desarrollador: ver y editar los números que alimentan los cálculos de acero"
            className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 hover:text-navy-600 border border-navy-200 hover:border-navy-300 rounded-lg px-3 py-2 shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" /> Parámetros de ingeniería
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CIMENTACION_TIPOS.map((t) => {
          const TIcon = t.icon;
          const activo = tipoActivo === t.id;
          const cantidad = plantillas.filter((p) => p.tipo === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => { setTipoActivo(t.id); cerrarFormulario(); }}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
                activo ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-600 border-navy-200 hover:border-navy-400'
              }`}
            >
              <TIcon className="w-4 h-4" />
              {t.label}
              {t.disponible && <span className={activo ? 'text-navy-300' : 'text-navy-400'}>({cantidad})</span>}
              {!t.disponible && <span className="text-xs italic opacity-70">(pronto)</span>}
            </button>
          );
        })}
      </div>

      {!tipoDef.disponible ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center">
          <tipoDef.icon className="w-8 h-8 text-navy-300 mx-auto mb-3" />
          <p className="text-navy-600 font-semibold">"{tipoDef.label}" todavía no está disponible</p>
          <p className="text-sm text-navy-400 mt-1">Vamos construyendo las 6 cimentaciones de a una — esta sigue en la fila.</p>
        </div>
      ) : (
        <div>
          {!creando && !editandoId && (
            <button
              onClick={() => setCreando(true)}
              className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg mb-5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva plantilla de {tipoDef.label}
            </button>
          )}

          {(creando || editandoId) && (
            <componentes.Form
              plantilla={editandoId ? plantillasDelTipo.find((p) => p.id === editandoId) : null}
              onCancel={cerrarFormulario}
              onSave={(nombre, datos) => {
                if (editandoId) onUpdate(editandoId, { nombre, datos });
                else onAdd(tipoActivo, nombre, datos);
                cerrarFormulario();
              }}
              mallas={mallas}
              onAddMalla={onAddMalla}
            />
          )}

          {!creando && !editandoId && (
            plantillasDelTipo.length === 0 ? (
              <p className="text-sm text-navy-400 italic text-center py-10">Aún no hay plantillas de {tipoDef.label}.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plantillasDelTipo.map((p) => (
                  <div key={p.id} className="bg-white border border-navy-200 rounded-xl p-4">
                    <div className="flex items-center justify-center mb-2">
                      <componentes.Preview datos={p.datos} />
                    </div>
                    <p className="font-semibold text-navy-800 text-sm text-center mb-1">{p.nombre}</p>
                    <p className="text-xs text-navy-400 text-center mb-3">
                      {componentes.resumen(p.datos)}
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => setEditandoId(p.id)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      {confirmandoId === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-navy-500">¿Eliminar?</span>
                          <button onClick={() => { onDelete(p.id); setConfirmandoId(null); }} className="text-xs font-bold text-red-600 hover:text-red-700">
                            Sí
                          </button>
                          <button onClick={() => setConfirmandoId(null)} className="text-xs text-navy-400 hover:text-navy-600">
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmandoId(p.id)} className="text-xs font-semibold text-navy-400 hover:text-red-500 flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* --- Proyección isométrica simple, para que el ancho/profundo/alto se      */
/* distingan claramente en la previsualización. x = ancho, y = profundo,    */
/* z = altura (hacia arriba). Devuelve coordenadas de pantalla [sx, sy].     */
/* Con esta fórmula, la esquina "más cercana" al espectador es siempre la   */
/* de x máximo y y máximo — las dos caras visibles deben tocar esa esquina. */
const ISO_COS = Math.cos(Math.PI / 6); // 30°
const ISO_SIN = Math.sin(Math.PI / 6);
function isoPt(x, y, z, ox, oy) {
  return [ox + (x - y) * ISO_COS, oy + (x + y) * ISO_SIN - z];
}
function poly(points) {
  return points.map((p) => p.join(',')).join(' ');
}
/* Dibuja una caja isométrica (3 caras visibles: superior, derecha e         */
/* izquierda) entre z0 (abajo) y z1 (arriba), con ancho W y profundo D,      */
/* dentro de un origen (ox, oy). Colores en 3 tonos para dar volumen.       */
function IsoBox({ x0, y0, w, d, z0, z1, ox, oy, colors }) {
  const top = [
    isoPt(x0, y0, z1, ox, oy),
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0, y0 + d, z1, ox, oy),
  ];
  const right = [
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0 + w, y0, z0, ox, oy),
  ];
  const left = [
    isoPt(x0, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0, y0 + d, z0, ox, oy),
  ];
  return (
    <g>
      <polygon points={poly(left)} fill={colors[2]} stroke="#59671E" strokeWidth="1" />
      <polygon points={poly(right)} fill={colors[1]} stroke="#59671E" strokeWidth="1" />
      <polygon points={poly(top)} fill={colors[0]} stroke="#59671E" strokeWidth="1" />
    </g>
  );
}
/* Misma caja isométrica de arriba, pero en estilo "plano técnico" (líneas    */
/* azul oscuro, sin relleno de color) — para las plantillas de Cimentaciones. */
function IsoBoxLineArt({ x0, y0, w, d, z0, z1, ox, oy, fillTop = 'white', fillSide = '#F6F7F9' }) {
  const top = [
    isoPt(x0, y0, z1, ox, oy),
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0, y0 + d, z1, ox, oy),
  ];
  const right = [
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0 + w, y0, z0, ox, oy),
  ];
  const left = [
    isoPt(x0, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0, y0 + d, z0, ox, oy),
  ];
  return (
    <g>
      <polygon points={poly(left)} fill={fillSide} stroke="#152644" strokeWidth="1.1" />
      <polygon points={poly(right)} fill={fillSide} stroke="#152644" strokeWidth="1.1" />
      <polygon points={poly(top)} fill={fillTop} stroke="#152644" strokeWidth="1.3" />
    </g>
  );
}
/* Línea de Nivel de Terreno Natural (N.T.N), dibujada con el mismo ángulo   */
/* isométrico, tocando el modelo justo a la altura donde cruza el terreno.  */
function NtnMarker({ x, y, z, ox, oy }) {
  const [x1, y1] = isoPt(x, y, z, ox, oy);
  const [x2, y2] = isoPt(x - 22, y, z, ox, oy);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3C64AA" strokeWidth="1.2" />
      <text x={x2 - 3} y={y2 - 3} fontSize="9" fill="#3C64AA" textAnchor="end" fontFamily="monospace">N.T.N</text>
    </g>
  );
}

/* Dibujo esquemático (isométrico) de una cimentación: pedestal rectangular, */
/* pilote cilíndrico, o zapata con pedestal (ej. portón). No es a escala     */
/* exacta (tiene límites para no deformarse), solo es una previsualización  */
/* que reacciona a los valores digitados. "sobresale" es fijo por tipo de   */
/* elemento; "desplante" es lo que digita cada quien (profundidad).         */
function CimentacionPreview({ forma, v, sobresale }) {
  const m2px = 48;
  const clampD = (m) => Math.max(16, Math.min(80, m * m2px));
  const dim = (strVal, defaultMeters) => {
    const n = parseFloat(strVal);
    return clampD(n > 0 ? n : defaultMeters);
  };
  const desplanteM = parseFloat(v.desplante) || 0;
  const totalM = desplanteM + sobresale;
  const totalPx = totalM > 0 ? clampD(totalM) : 46;
  const sobresalePx = totalM > 0 ? (sobresale / totalM) * totalPx : (sobresale > 0 ? 12 : 0);

  const svgW = 160;
  const ox = svgW / 2;
  const oy = 60;

  let body = null;
  let ntn = null;
  let svgH = 150;

  if (forma === 'cilindrica') {
    const diamPx = dim(v.diametro, 0.3);
    const rx = diamPx / 2;
    const ry = rx * 0.42;
    const topZ = sobresalePx;
    const botZ = topZ - totalPx;
    const [cxTop, cyTop] = isoPt(0, 0, topZ, ox, oy);
    const [, cyBot] = isoPt(0, 0, botZ, ox, oy);
    body = (
      <g>
        <rect x={cxTop - rx} y={cyTop} width={rx * 2} height={Math.max(1, cyBot - cyTop)} fill="#D9FA47" stroke="#59671E" strokeWidth="1" />
        <ellipse cx={cxTop} cy={cyBot} rx={rx} ry={ry} fill="#9AB620" stroke="#59671E" strokeWidth="1" />
        <ellipse cx={cxTop} cy={cyTop} rx={rx} ry={ry} fill="#F5FAE1" stroke="#59671E" strokeWidth="1" />
      </g>
    );
    ntn = <NtnMarker x={rx} y={0} z={0} ox={ox} oy={oy} />;
    svgH = cyBot + 20;
  } else if (forma === 'zapata_pedestal') {
    const A = dim(v.ancho_zapata, 1.2);
    const B = dim(v.profundo_zapata, 1.2);
    const a = dim(v.ancho_pedestal, 0.5);
    const b = dim(v.profundo_pedestal, 0.5);
    const altoZapataM = parseFloat(v.alto_zapata) || 0.3;
    const pedestalAltoM = Math.max(0.05, totalM - altoZapataM);
    const effScale = totalM > 0 ? totalPx / totalM : m2px;
    const zapataH = Math.max(6, altoZapataM * effScale);
    const pedestalH = Math.max(6, pedestalAltoM * effScale);
    const topZ = sobresalePx;
    const botZ = topZ - totalPx;
    const zapataTopZ = botZ + zapataH;
    body = (
      <g>
        <IsoBox x0={-A / 2} y0={-B / 2} w={A} d={B} z0={botZ} z1={zapataTopZ} ox={ox} oy={oy} colors={['#F5FAE1', '#C2E723', '#9AB620']} />
        <IsoBox x0={-a / 2} y0={-b / 2} w={a} d={b} z0={zapataTopZ} z1={zapataTopZ + pedestalH} ox={ox} oy={oy} colors={['#F5FAE1', '#D9FA47', '#C2E723']} />
      </g>
    );
    // El N.T.N. se ancla donde z=0 cruza el modelo: el pedestal si llega hasta ahí, si no la zapata.
    const zRef = 0 >= zapataTopZ ? { x: a / 2, y: b / 2 } : { x: A / 2, y: B / 2 };
    ntn = <NtnMarker x={zRef.x} y={zRef.y} z={0} ox={ox} oy={oy} />;
    const [, yBottomCorner] = isoPt(A / 2, B / 2, botZ, ox, oy);
    svgH = yBottomCorner + 20;
  } else {
    const W = dim(v.ancho, 0.8);
    const D = dim(v.profundo, 0.8);
    const topZ = sobresalePx;
    const botZ = topZ - totalPx;
    body = <IsoBox x0={-W / 2} y0={-D / 2} w={W} d={D} z0={botZ} z1={topZ} ox={ox} oy={oy} colors={['#F5FAE1', '#C2E723', '#9AB620']} />;
    ntn = <NtnMarker x={W / 2} y={D / 2} z={0} ox={ox} oy={oy} />;
    const [, yBottomCorner] = isoPt(W / 2, D / 2, botZ, ox, oy);
    svgH = yBottomCorner + 20;
  }

  return (
    <svg viewBox={`-10 0 ${svgW} ${svgH}`} className="w-32 h-32">
      {body}
      {ntn}
    </svg>
  );
}

function FieldRenderer({ field, value, editMode, onChange, siblingData, inversionistas, onAddInversionista, paises, onAddPais, proveedores, onAddProveedor }) {
  if (field.type === 'departamento') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
        >
          <option value="">Seleccionar…</option>
          {COLOMBIA.map((d) => (
            <option key={d.nombre} value={d.nombre}>{d.nombre}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'municipio') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    const depto = siblingData?.departamento;
    const opciones = COLOMBIA.find((d) => d.nombre === depto)?.municipios || [];
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={!depto}
          className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 disabled:bg-navy-50 disabled:text-navy-400"
        >
          <option value="">{depto ? 'Seleccionar…' : 'Elige primero el departamento'}</option>
          {opciones.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          {value && !opciones.includes(value) && <option value={value}>{value} (no está en la lista)</option>}
        </select>
      </div>
    );
  }

  if (field.type === 'inversionista') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <InversionistaPicker value={value} inversionistas={inversionistas || []} onChange={onChange} onAddNew={onAddInversionista} />
      </div>
    );
  }

  if (field.type === 'pais') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <PaisPicker value={value} paises={paises || []} onChange={onChange} onAddNew={onAddPais} />
      </div>
    );
  }

  if (field.type === 'proveedor') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <ProveedorPicker value={value} proveedores={proveedores || []} onChange={onChange} onAddNew={onAddProveedor} />
      </div>
    );
  }

  if (field.type === 'select') {
    /* En lectura se muestra el valor EFECTIVO y nada más: si el campo está
       vacío y el catálogo declara un default, ese es el valor que usan las
       notas, así que es el que se enseña. Sin texto auxiliar que explique de
       dónde sale. */
    const usaDefault = field.allowOther && isBlank(value) && !isBlank(field.defaultValue);
    const valorMostrado = usaDefault ? field.defaultValue : value;

    if (!editMode) {
      return <ReadOnlyValue label={field.label} value={valorMostrado} mono={false} />;
    }

    if (field.allowOther) {
      return (
        <div className="py-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
          <SelectOrOtro
            value={value}
            opciones={field.opciones}
            defaultValue={field.defaultValue}
            onChange={onChange}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
          />
        </div>
      );
    }

    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
        >
          <option value="">Seleccionar…</option>
          {field.opciones.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'computed') {
    const calculado = field.formula(siblingData);
    return (
      <div className="py-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{field.label}</p>
        <p className="text-sm text-navy-700 font-mono">{calculado}</p>
        {field.ayuda && <p className="text-xs text-navy-300 italic mt-0.5">{field.ayuda}</p>}
      </div>
    );
  }

  if (field.type === 'cimentacion') {
    const v = value && typeof value === 'object' && !Array.isArray(value) ? value : emptyCimentacion(field.forma);
    const totalM = ((parseFloat(v.desplante) || 0) + field.sobresale).toFixed(2);

    const resumenPartes = field.forma === 'cilindrica'
      ? [v.diametro && `Diámetro: ${v.diametro} m`]
      : field.forma === 'zapata_pedestal'
        ? [
            (v.ancho_zapata || v.profundo_zapata || v.alto_zapata) &&
              `Zapata ${v.ancho_zapata || '—'} × ${v.profundo_zapata || '—'} × ${v.alto_zapata || '—'} m`,
            (v.ancho_pedestal || v.profundo_pedestal) &&
              `Pedestal ${v.ancho_pedestal || '—'} × ${v.profundo_pedestal || '—'} × ${altoPedestal(v, field.sobresale).toFixed(2)} m`,
          ]
        : [(v.ancho || v.profundo) && `${v.ancho || '—'} × ${v.profundo || '—'} m`];
    if (v.desplante) resumenPartes.push(`Desplante: ${v.desplante} m`);
    if (v.resistencia) resumenPartes.push(`Concreto: ${v.resistencia}`);
    const resumen = resumenPartes.filter(Boolean).join(' · ');

    if (!editMode) {
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          <div className="flex items-center gap-3">
            <CimentacionPreview forma={field.forma} v={v} sobresale={field.sobresale} />
            <div>
              <p className={`text-sm ${resumen ? 'text-navy-700' : 'text-navy-300 italic'}`}>{resumen || 'Sin definir'}</p>
              <p className="text-xs text-navy-400 mt-1">Sobresale del terreno: {field.sobresale} m · Alto total: {totalM} m</p>
            </div>
          </div>
        </div>
      );
    }

    function set(key, val) {
      onChange({ ...v, [key]: val });
    }
    const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2">{field.label}</label>
        <div className="flex items-start gap-4 flex-wrap">
          <CimentacionPreview forma={field.forma} v={v} sobresale={field.sobresale} />
          <div className="space-y-2 flex-1" style={{ minWidth: 190 }}>
            {field.forma === 'cilindrica' && (
              <div>
                <label className="block text-xs text-navy-500 mb-1">Diámetro (m)</label>
                <input value={v.diametro} onChange={(e) => set('diametro', e.target.value)} placeholder="0.30" className={cellInput} />
              </div>
            )}
            {field.forma === 'rectangular' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
                  <input value={v.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
                  <input value={v.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.40" className={cellInput} />
                </div>
              </div>
            )}
            {field.forma === 'zapata_pedestal' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Ancho zapata (m)</label>
                  <input value={v.ancho_zapata} onChange={(e) => set('ancho_zapata', e.target.value)} placeholder="1.00" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Profundo zapata (m)</label>
                  <input value={v.profundo_zapata} onChange={(e) => set('profundo_zapata', e.target.value)} placeholder="1.00" className={cellInput} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-navy-500 mb-1">Alto de zapata (m)</label>
                  <input value={v.alto_zapata} onChange={(e) => set('alto_zapata', e.target.value)} placeholder="0.30" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Ancho pedestal (m)</label>
                  <input value={v.ancho_pedestal} onChange={(e) => set('ancho_pedestal', e.target.value)} placeholder="0.40" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Profundo pedestal (m)</label>
                  <input value={v.profundo_pedestal} onChange={(e) => set('profundo_pedestal', e.target.value)} placeholder="0.40" className={cellInput} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-navy-500 mb-1">
                {field.forma === 'zapata_pedestal' ? 'Profundidad de desplante (m)' : 'Desplante (m)'}
              </label>
              <input value={v.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
              <ResistenciaSelect value={v.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
            </div>
            <p className="text-xs text-navy-400">
              Sobresale del terreno: <span className="font-mono text-navy-600">{field.sobresale} m</span> (fijo) · Alto total:{' '}
              <span className="font-mono text-navy-600">{totalM} m</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (field.type === 'stations') {
    const rows = Array.isArray(value) && value.length > 0 ? value : emptyStations();
    if (!editMode) {
      const conDatos = rows.filter((r) => r.nombre || r.dias || r.peso);
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          {conDatos.length === 0 ? (
            <p className="text-sm text-navy-300 italic">Sin definir</p>
          ) : (
            <table className="w-full text-sm border border-navy-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-navy-50">
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Nombre de la estación</th>
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Días/año promedio</th>
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Peso porcentual</th>
                </tr>
              </thead>
              <tbody>
                {conDatos.map((r, i) => (
                  <tr key={i} className="border-b border-navy-100 last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-navy-700">{r.nombre || '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-navy-700">{r.dias || '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-navy-700">{r.peso ? `${r.peso}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
    function updateRow(i, key, val) {
      const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
      onChange(next);
    }
    const cellInput = 'w-full rounded-md border border-navy-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-navy-200 rounded-lg">
            <thead>
              <tr className="bg-navy-50">
                <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200">Nombre de la estación</th>
                <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-40">Días/año promedio</th>
                <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-36">Peso porcentual (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-navy-100 last:border-b-0">
                  <td className="p-1.5">
                    <input type="text" className={cellInput} value={r.nombre} onChange={(e) => updateRow(i, 'nombre', e.target.value)} />
                  </td>
                  <td className="p-1.5">
                    <input type="text" className={cellInput} value={r.dias} onChange={(e) => updateRow(i, 'dias', e.target.value)} />
                  </td>
                  <td className="p-1.5">
                    <input type="text" className={cellInput} value={r.peso} onChange={(e) => updateRow(i, 'peso', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === 'boolean') {
    const val = value && typeof value === 'object' ? value : { valor: null, nota: '' };
    if (!editMode) {
      const valorTxt = val.valor === true ? 'Sí' : val.valor === false ? 'No' : '';
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{field.label}</p>
          <p className={`text-sm ${valorTxt ? 'text-navy-700' : 'text-navy-300 italic'}`}>{valorTxt || 'Sin definir'}</p>
          {val.nota && <p className="text-sm text-navy-500 mt-1 whitespace-pre-wrap break-words">{val.nota}</p>}
        </div>
      );
    }
    const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <select
          className={baseInput}
          value={val.valor === true ? 'si' : val.valor === false ? 'no' : ''}
          onChange={(e) => onChange({ ...val, valor: e.target.value === '' ? null : e.target.value === 'si' })}
        >
          <option value="">Seleccionar…</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
        <textarea
          rows={2}
          placeholder="Descripción u observaciones (opcional)"
          className={`${baseInput} mt-2`}
          value={val.nota || ''}
          onChange={(e) => onChange({ ...val, nota: e.target.value })}
        />
      </div>
    );
  }

  if (!editMode) {
    let display = value;
    if (field.type === 'date') display = value ? formatDate(value) : '';
    return <ReadOnlyValue label={field.label} value={display} mono={field.type !== 'textarea'} />;
  }

  const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  return (
    <div className="py-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
      {field.type === 'textarea' && (
        <textarea rows={3} className={baseInput} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === 'date' && (
        <input type="date" className={baseInput} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === 'text' && (
        <input type="text" className={`${baseInput} font-mono`} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SectionFieldsGrid({
  section, data, editMode, onFieldChange, inversionistas, onAddInversionista, paises, onAddPais,
  proveedores, onAddProveedor,
  structureType, focusFieldKey, onFocusHandled,
}) {
  const [grupoAbierto, setGrupoAbierto] = useState(false);
  /* Subapartados desplegados dentro del acordeón: "General" y el de la
     estructura activa se abren de entrada; el resto queda cerrado pero
     SIEMPRE presente y desplegable. Estado de UI puro: nunca se persiste. */
  const [subAbiertos, setSubAbiertos] = useState(() =>
    structureType ? { GENERAL: true, [structureType]: true } : { GENERAL: true }
  );

  const propios = section.fields.filter((f) => !f.grupo);
  const agrupados = section.fields.filter((f) => f.grupo === GRUPO_NOTAS_TECNICAS.id);
  const porClave = new Map(agrupados.map((f) => [f.key, f]));

  /* SIEMPRE se muestran todos los subapartados: esta es una pantalla de
     captura, así que el tipo de estructura elegido en Notas Técnicas no
     oculta nada aquí (solo se resalta el que está activo). El filtrado por
     estructura ocurre al generar las notas, no al editar los datos. */
  const gruposVisibles = allFieldGroups()
    .map((g) => ({
      ...g,
      subgroups: g.subgroups
        .map((s) => ({ ...s, fields: s.fieldKeys.map((k) => porClave.get(k)).filter(Boolean) }))
        .filter((s) => s.fields.length > 0),
    }))
    .filter((g) => g.subgroups.length > 0);

  /* Red de seguridad: si algún campo del acordeón no está declarado en
     fieldGroups.js, se muestra igual al final en vez de desaparecer. */
  const clavesAgrupadas = new Set(gruposVisibles.flatMap((g) => g.subgroups.flatMap((s) => s.fields.map((f) => f.key))));
  const clavesDeOtraEstructura = new Set(allGroupedFieldKeys());
  const sinGrupo = agrupados.filter((f) => !clavesAgrupadas.has(f.key) && !clavesDeOtraEstructura.has(f.key));

  const visibles = [...clavesAgrupadas, ...sinGrupo.map((f) => f.key)];
  const conDato = visibles.filter((k) => data && !isBlank(data[k])).length;

  /* Llegada desde un "pendiente" de Notas Técnicas: abrir el acordeón y el
     subapartado que contiene el campo, desplazarse hasta él y enfocarlo.
     Estado puramente de UI. */
  useEffect(() => {
    if (!focusFieldKey) return;
    if (requiresAccordion(focusFieldKey)) {
      setGrupoAbierto(true);
      const grupoDestino = groupToOpenFor(focusFieldKey);
      if (grupoDestino) setSubAbiertos((prev) => ({ ...prev, [grupoDestino]: true }));
    }
    const t = setTimeout(() => {
      const nodo = document.querySelector(`[data-field-key="${focusFieldKey}"]`);
      if (nodo) {
        nodo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const control = nodo.querySelector('select, input, textarea');
        if (control) control.focus({ preventScroll: true });
      }
      onFocusHandled && onFocusHandled();
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFieldKey]);

  /* `contextual`: dentro del acordeón, la jerarquía grupo › subgrupo ya da el
     contexto, así que se usa la etiqueta corta. Fuera de él (campos propios
     de la pestaña) se conserva el label canónico completo. */
  function renderCampos(fields, { contextual = false } = {}) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 divide-y divide-navy-100 md:divide-y-0">
        {fields.map((original) => {
          const field = contextual
            ? { ...original, label: displayLabelFor(original.key, original.label) }
            : original;
          return (
          <div
            key={field.key}
            data-field-key={field.key}
            className={`${field.type === 'stations' || field.type === 'cimentacion' ? 'col-span-full' : ''} ${
              focusFieldKey === field.key ? 'ring-2 ring-lime-400 rounded-lg' : ''
            }`}
          >
            <FieldRenderer
              field={field}
              value={data ? data[field.key] : undefined}
              editMode={editMode}
              onChange={(val) => onFieldChange(section.id, field.key, val)}
              siblingData={data}
              inversionistas={inversionistas}
              onAddInversionista={onAddInversionista}
              paises={paises}
              onAddPais={onAddPais}
              proveedores={proveedores}
              onAddProveedor={onAddProveedor}
            />
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {renderCampos(propios)}

      {agrupados.length > 0 && (
        <div className="mt-6 border-t border-navy-200 pt-4">
          <button
            type="button"
            onClick={() => setGrupoAbierto((v) => !v)}
            className="flex items-center gap-2 w-full text-left group"
          >
            {grupoAbierto
              ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" />
              : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />}
            <span className="text-sm font-semibold text-navy-700 group-hover:text-navy-900">
              {GRUPO_NOTAS_TECNICAS.label}
            </span>
            <span className="text-xs text-navy-400">
              {conDato} de {visibles.length} con dato
            </span>
          </button>

          {grupoAbierto && (
            <div className="mt-4">
              <p className="text-xs text-navy-400 mb-4">
                Parámetros que alimentan las notas técnicas. Están todos disponibles para editar;
                {structureType ? (
                  <>
                    {' '}las notas activas se generan a partir de{' '}
                    <span className="font-semibold text-navy-600">{STRUCTURE_LABELS[structureType] || structureType}</span>.
                  </>
                ) : (
                  <> el tipo de estructura se elige en <span className="font-semibold">Notas Técnicas</span>.</>
                )}
                {' '}Nada se guarda hasta que edites y guardes esta pestaña.
              </p>

              <div className="space-y-3">
                {gruposVisibles.map((grupo) => {
                  const abierto = !!subAbiertos[grupo.id];
                  const esActivo = grupo.id === structureType;
                  const clavesGrupo = grupo.subgroups.flatMap((s) => s.fields.map((f) => f.key));
                  const conDatoGrupo = clavesGrupo.filter((k) => data && !isBlank(data[k])).length;
                  return (
                    <div
                      key={grupo.id}
                      className={`border rounded-lg overflow-hidden ${esActivo ? 'border-lime-400' : 'border-navy-200'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSubAbiertos((prev) => ({ ...prev, [grupo.id]: !prev[grupo.id] }))}
                        className={`flex items-center gap-2 w-full text-left px-3 py-2 transition-colors ${
                          esActivo ? 'bg-lime-50 hover:bg-lime-100' : 'bg-navy-50 hover:bg-navy-100'
                        }`}
                      >
                        {abierto
                          ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />}
                        <span className="text-xs font-bold uppercase tracking-wide text-navy-600">{grupo.label}</span>
                        {esActivo && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-lime-100 text-lime-700 border border-lime-300 normal-case">
                            Notas activas
                          </span>
                        )}
                        <span className="text-xs text-navy-400 font-normal normal-case">
                          {conDatoGrupo} de {clavesGrupo.length}
                        </span>
                      </button>
                      {abierto && (
                        <div className="px-3 py-3 space-y-4">
                          {grupo.subgroups.map((sub) => (
                            <div key={sub.label}>
                              <p className="text-xs font-semibold text-navy-400 mb-1">{sub.label}</p>
                              {renderCampos(sub.fields, { contextual: true })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {sinGrupo.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-navy-600 border-b border-navy-200 pb-1 mb-3">
                      Otros parámetros
                    </p>
                    {renderCampos(sinGrupo)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TitleCell({ label, value, custom, span }) {
  return (
    <div className={`px-4 py-2.5 ${span === 2 ? 'col-span-2' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-navy-400 font-semibold">{label}</p>
      {custom ? (
        <div className="mt-1">{custom}</div>
      ) : (
        <p className="text-sm font-mono text-navy-700 mt-0.5 truncate">{value || 'N/A'}</p>
      )}
    </div>
  );
}

function NotesPanel({ notas, onAdd, onRemove, canEdit }) {
  const [texto, setTexto] = useState('');
  const textareaRef = useRef(null);

  function aplicarFormato(tipo) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (tipo === 'bullet') {
      const before = texto.slice(0, start);
      const after = texto.slice(end);
      const lineStart = before.lastIndexOf('\n') + 1;
      const relEnd = after.indexOf('\n');
      const lineEnd = relEnd === -1 ? texto.length : end + relEnd;
      const bloque = texto.slice(lineStart, lineEnd);
      const lineas = bloque.split('\n');
      const todasConVineta = lineas.every((l) => l.startsWith('- ') || l.trim() === '');
      const nuevasLineas = lineas.map((l) => {
        if (l.trim() === '') return l;
        return todasConVineta ? l.replace(/^- /, '') : (l.startsWith('- ') ? l : `- ${l}`);
      });
      const nuevoBloque = nuevasLineas.join('\n');
      const nuevo = texto.slice(0, lineStart) + nuevoBloque + texto.slice(lineEnd);
      setTexto(nuevo);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(lineStart, lineStart + nuevoBloque.length);
      });
      return;
    }

    const marcador = tipo === 'bold' ? '**' : tipo === 'italic' ? '*' : '__';
    const seleccionado = texto.slice(start, end) || 'texto';
    const nuevo = texto.slice(0, start) + marcador + seleccionado + marcador + texto.slice(end);
    setTexto(nuevo);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marcador.length, start + marcador.length + seleccionado.length);
    });
  }

  function submit(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    onAdd(texto.trim());
    setTexto('');
  }

  const ordenadas = [...(notas || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  return (
    <div>
      {canEdit ? (
        <form onSubmit={submit} className="mb-5 space-y-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => aplicarFormato('bold')} title="Negrilla" className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-300 text-navy-600 hover:bg-navy-50 hover:border-navy-400">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => aplicarFormato('italic')} title="Cursiva" className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-300 text-navy-600 hover:bg-navy-50 hover:border-navy-400">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => aplicarFormato('underline')} title="Subrayado" className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-300 text-navy-600 hover:bg-navy-50 hover:border-navy-400">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => aplicarFormato('bullet')} title="Viñetas" className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-300 text-navy-600 hover:bg-navy-50 hover:border-navy-400">
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe una particularidad o nota que haya surgido durante el diseño…"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
          />
          <div className="flex justify-end">
            <button type="submit" className="flex items-center gap-1.5 text-xs font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 px-3 py-1.5 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar nota
            </button>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-5">
          <Lock className="w-3.5 h-3.5" /> Solo el equipo asignado puede agregar notas.
        </p>
      )}

      {ordenadas.length === 0 ? (
        <p className="text-sm text-navy-400 italic text-center py-8">Aún no hay notas para este proyecto.</p>
      ) : (
        <div className="space-y-3">
          {ordenadas.map((n) => (
            <div key={n.id} className="bg-navy-50 border border-navy-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-navy-500">
                  <span className="font-semibold text-navy-700">{n.autor}</span> · {formatDateTime(n.fecha)}
                </p>
                {canEdit && (
                  <button onClick={() => onRemove(n.id)} className="text-navy-300 hover:text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-sm text-navy-700 break-words">{renderNoteText(n.texto)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Input de comentarios que solo confirma (y dispara la persistencia) al     */
/* perder el foco, para no escribir en la base de datos en cada tecla.       */
/* Campo de texto con flujo explícito "Editar → Guardar": se muestra como     */
/* texto de solo lectura con un botón "Editar"; al editar aparece el         */
/* textarea + "Guardar"/"Cancelar". No crea entradas nuevas — siempre edita  */
/* el mismo valor. Usado en Observaciones y Comentarios de Control de       */
/* Calidad de cada documento.                                                */
function ComentarioEditable({ value, onCommit, disabled, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  if (disabled) {
    return value ? <p className="text-sm text-navy-600 whitespace-pre-wrap">{value}</p> : <p className="text-sm text-navy-300 italic">Sin definir</p>;
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        {value ? (
          <p className="text-sm text-navy-600 whitespace-pre-wrap flex-1 min-w-0">{value}</p>
        ) : (
          <p className="text-sm text-navy-300 italic flex-1 min-w-0">Sin definir</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700 shrink-0"
        >
          <Pencil className="w-3 h-3" /> {value ? 'Editar' : 'Agregar'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        rows={2}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm rounded-md border border-navy-300 px-2.5 py-1.5 mb-1.5 focus:outline-none focus:ring-2 focus:ring-lime-400"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => { setDraft(value || ''); setEditing(false); }}
          className="text-xs text-navy-400 hover:text-navy-600 px-2 py-1"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { onCommit(draft); setEditing(false); }}
          className="text-xs font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 px-3 py-1 rounded-md transition-colors"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function DocEstadoBadge({ estado }) {
  const cfg = DOC_ESTADO_CONFIG[estado] || DOC_ESTADO_CONFIG['Pendiente'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {estado || 'Pendiente'}
    </span>
  );
}

/* Diagrama de torta (donut) del progreso de Control Documental. Es puramente */
/* visual — a propósito no aparece en la hoja de vida imprimible.            */
function ProgresoDonut({ conteoPorEstado, total, compact = false }) {
  const size = compact ? 52 : 116;
  const radius = size / 2;
  const innerRadius = radius * 0.58;
  const cx = radius;
  const cy = radius;

  // "No aplica" no se cuenta en el seguimiento: no entra al dibujo de la
  // torta (para que las demás porciones sí completen el círculo), pero
  // sigue apareciendo en la lista de al lado con su cantidad.
  const totalSeguido = total - (conteoPorEstado['No aplica'] || 0);

  if (total === 0) {
    return compact ? (
      <div className="shrink-0 flex items-center justify-center rounded-full bg-navy-100" style={{ width: size, height: size }}>
        <span className="text-[9px] text-navy-400">N/A</span>
      </div>
    ) : (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-xs text-navy-400 italic text-center px-2">Sin documentos<br />en esta vista</p>
      </div>
    );
  }

  let angleStart = -Math.PI / 2;
  const slices = totalSeguido === 0 ? [] : DOC_ESTADOS.filter((estado) => estado !== 'No aplica' && conteoPorEstado[estado] > 0).map((estado) => {
    const valor = conteoPorEstado[estado];
    const angle = (valor / totalSeguido) * Math.PI * 2;
    const angleEnd = angleStart + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(angleStart), y1 = cy + radius * Math.sin(angleStart);
    const x2 = cx + radius * Math.cos(angleEnd), y2 = cy + radius * Math.sin(angleEnd);
    const ix1 = cx + innerRadius * Math.cos(angleStart), iy1 = cy + innerRadius * Math.sin(angleStart);
    const ix2 = cx + innerRadius * Math.cos(angleEnd), iy2 = cy + innerRadius * Math.sin(angleEnd);
    const d = valor === totalSeguido
      ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} L ${cx - 0.01} ${cy - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius} Z`
      : `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    angleStart = angleEnd;
    return { d, estado, valor, color: DOC_ESTADO_HEX[estado] };
  });

  const aprobados = conteoPorEstado['Aprobado para construcción (APC)'] || 0;
  const pct = totalSeguido === 0 ? 0 : Math.round((aprobados / totalSeguido) * 100);
  const entregados = conteoPorEstado['Entregado'] || 0;
  const pctEntregado = totalSeguido === 0 ? 0 : Math.round((entregados / totalSeguido) * 100);

  if (compact) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.length === 0 ? (
          <circle cx={cx} cy={cy} r={(radius + innerRadius) / 2} fill="none" stroke="#CBD5E6" strokeWidth={radius - innerRadius} />
        ) : (
          slices.map((s) => <path key={s.estado} d={s.d} fill={s.color} stroke="white" strokeWidth="1" />)
        )}
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="12" fontWeight="700" fill="#152644">{pct}%</text>
      </svg>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {slices.length === 0 ? (
            <circle cx={cx} cy={cy} r={(radius + innerRadius) / 2} fill="none" stroke="#CBD5E6" strokeWidth={radius - innerRadius} />
          ) : (
            slices.map((s) => (
              <path key={s.estado} d={s.d} fill={s.color} stroke="white" strokeWidth="1.5" />
            ))
          )}
        </svg>
        <div className="space-y-1">
          {DOC_ESTADOS.filter((estado) => conteoPorEstado[estado] > 0).map((estado) => (
            <div key={estado} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DOC_ESTADO_HEX[estado] }} />
              <span className="text-navy-600">{DOC_ESTADO_CORTO[estado]}: <span className="font-semibold">{conteoPorEstado[estado]}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-8 mt-3 pt-3 border-t border-navy-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-navy-800">{pct}%</p>
          <p className="text-xs font-semibold text-navy-400 tracking-wide">APC</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-violet-600">{pctEntregado}%</p>
          <p className="text-xs font-semibold text-violet-400 tracking-wide">ENTREGADO</p>
        </div>
      </div>
    </div>
  );
}

/* Barra de progreso por especialidad, "pintada" por segmentos según el     */
/* estado de cada documento (no solo APC). Al pasar el cursor sobre un      */
/* segmento se ve el % y la cantidad de documentos en ese estado.          */
function EspecialidadBarra({ especialidad, docs, conteo }) {
  const total = docs.length;
  const segmentos = DOC_ESTADOS.filter((estado) => conteo[estado] > 0);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-navy-600">{especialidad}</span>
        <span className="text-navy-400">{total} docs</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-navy-300 italic">Todos los documentos de esta especialidad son "No aplica".</p>
      ) : (
        <div className="relative">
          {/* Barra visual (con esquinas redondeadas, por eso overflow-hidden) */}
          <div className="w-full h-2.5 bg-navy-200 rounded-full overflow-hidden flex">
            {segmentos.map((estado) => (
              <div key={estado} className="h-full" style={{ width: `${(conteo[estado] / total) * 100}%`, backgroundColor: DOC_ESTADO_HEX[estado] }} />
            ))}
          </div>
          {/* Capa invisible encima, solo para el hover — sin overflow-hidden, así el tooltip no se recorta */}
          <div className="absolute inset-0 flex">
            {segmentos.map((estado) => {
              const pct = (conteo[estado] / total) * 100;
              return (
                <div key={estado} className="relative group h-full" style={{ width: `${pct}%` }}>
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-navy-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {DOC_ESTADO_CORTO[estado]}: {Math.round(pct)}% ({conteo[estado]})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Historial de entregas de un documento: fecha de entrega + fecha de        */
/* devolución de comentarios (opcional, no todos los proyectos tienen       */
/* interventoría) por cada versión. Se puede agregar cuantas versiones      */
/* hagan falta.                                                             */
function VersionesTracker({ versiones, onChange, disabled }) {
  const lista = versiones || [];

  function actualizarVersion(idx, patch) {
    onChange(lista.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function agregarVersion() {
    onChange([...lista, { id: makeId('ver'), entrega: '', comentarios_recibidos: '' }]);
  }
  function quitarVersion(idx) {
    onChange(lista.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <p className="text-xs font-semibold text-navy-400 mb-1.5">Historial de entregas</p>
      {lista.length === 0 && <p className="text-xs text-navy-300 italic mb-2">Aún no hay versiones registradas.</p>}
      <div className="space-y-2 mb-2">
        {lista.map((v, idx) => (
          <div key={v.id} className="flex items-center gap-3 flex-wrap bg-navy-50 border border-navy-200 rounded-lg px-2.5 py-2">
            <span className="text-xs font-bold text-navy-600 shrink-0">Versión {idx + 1}</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-navy-500">Entrega:</label>
              <input
                type="date"
                disabled={disabled}
                value={v.entrega || ''}
                onChange={(e) => actualizarVersion(idx, { entrega: e.target.value })}
                className="text-xs rounded-md border border-navy-300 px-2 py-1 disabled:bg-navy-100 disabled:text-navy-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-navy-500">Comentarios recibidos (si aplica):</label>
              <input
                type="date"
                disabled={disabled}
                value={v.comentarios_recibidos || ''}
                onChange={(e) => actualizarVersion(idx, { comentarios_recibidos: e.target.value })}
                className="text-xs rounded-md border border-navy-300 px-2 py-1 disabled:bg-navy-100 disabled:text-navy-400"
              />
            </div>
            {!disabled && (
              <button onClick={() => quitarVersion(idx)} title="Quitar esta versión" className="text-navy-300 hover:text-red-500 ml-auto shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button onClick={agregarVersion} className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700">
          <Plus className="w-3.5 h-3.5" /> Agregar versión
        </button>
      )}
    </div>
  );
}

/* Tarjeta de un documento en Control Documental. Contraída de entrada:      */
/* solo se ve nombre/código/tipo y el estado. Al hacer clic se despliegan    */
/* Observaciones, Comentarios de Calidad y el historial de entregas. Cuando  */
/* está contraída, unos íconos avisan si ya hay observación/comentario/      */
/* versiones registradas, para no tener que abrir cada una para revisar.    */
function DocumentoCard({ doc, codigoFinal, estadoDoc, estadoValor, puedeEditarContenido, puedeComentar, onDocChange }) {
  const [expandido, setExpandido] = useState(false);
  const cfg = DOC_ESTADO_CONFIG[estadoValor];
  const tieneObs = !!(estadoDoc.observaciones && estadoDoc.observaciones.trim());
  const tieneComentario = !!(estadoDoc.comentarios && estadoDoc.comentarios.trim());
  const versiones = estadoDoc.versiones || [];

  return (
    <div className={`bg-white rounded-lg border-l-4 ${cfg.border} border-t border-r border-b border-t-navy-200 border-r-navy-200 border-b-navy-200 overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-2 p-3">
        <button onClick={() => setExpandido((v) => !v)} className="flex items-start gap-2 min-w-0 flex-1 text-left">
          <span className="mt-0.5 text-navy-300 shrink-0">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-700 flex items-center gap-1.5 flex-wrap">
              {doc.nombre}
              {tieneObs && <MessageSquare className="w-3.5 h-3.5 text-navy-400 shrink-0" title="Tiene observaciones" />}
              {tieneComentario && <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Tiene comentario de Control de Calidad" />}
              {versiones.length > 0 && (
                <span className="text-xs font-semibold bg-navy-100 text-navy-500 px-1.5 py-0.5 rounded-full shrink-0">
                  {versiones.length} versión{versiones.length === 1 ? '' : 'es'}
                </span>
              )}
            </p>
            <p className="text-xs font-mono text-navy-400">{codigoFinal} · {doc.tipo}</p>
          </div>
        </button>
        {puedeEditarContenido ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <select
              value={estadoValor}
              onChange={(e) => onDocChange(doc, { estado: e.target.value })}
              className="text-xs rounded-md border border-navy-300 px-2 py-1"
            >
              {DOC_ESTADOS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        ) : (
          <DocEstadoBadge estado={estadoValor} />
        )}
      </div>
      {expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-navy-100 space-y-3">
          <div>
            <p className="text-xs font-semibold text-navy-400 mb-1">Observaciones</p>
            <ComentarioEditable
              value={estadoDoc.observaciones}
              onCommit={(val) => onDocChange(doc, { observaciones: val })}
              disabled={!puedeEditarContenido}
              placeholder="Ej. por qué sigue en proceso, qué falta, a quién se le pidió…"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-400 mb-1">Comentarios de Control de Calidad</p>
            <ComentarioEditable
              value={estadoDoc.comentarios}
              onCommit={(val) => onDocChange(doc, { comentarios: val })}
              disabled={!puedeComentar}
              placeholder="Comentarios de control de calidad…"
            />
          </div>
          <VersionesTracker
            versiones={versiones}
            onChange={(nuevas) => onDocChange(doc, { versiones: nuevas })}
            disabled={!puedeEditarContenido}
          />
        </div>
      )}
    </div>
  );
}

function DocumentControlPanel({ project, puedeEditarContenido, puedeComentar, onDocChange }) {
  const general = project.data.general;
  const lista = pickDocumentList(general.inversionista);
  const prefijo = buildProjectCode(general);
  const estadoActual = project.documentos || {};
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  function estadoDeDoc(doc) {
    return (estadoActual[doc.codigo] && estadoActual[doc.codigo].estado) || 'Pendiente';
  }

  const grupos = [];
  const idxByEsp = new Map();
  lista.forEach((doc) => {
    if (!idxByEsp.has(doc.especialidad)) {
      idxByEsp.set(doc.especialidad, grupos.length);
      grupos.push({ especialidad: doc.especialidad, docs: [] });
    }
    grupos[idxByEsp.get(doc.especialidad)].docs.push(doc);
  });
  const tiposDisponibles = [...new Set(lista.map((d) => d.tipo))].sort((a, b) => a.localeCompare(b, 'es'));

  // Universo según especialidad + tipo elegidos (antes de aplicar el filtro de
  // estado), para que los conteos del semáforo reflejen esos dos filtros pero
  // no cambien solo por hacer clic entre estados.
  const universo = lista.filter(
    (d) => (filtroEspecialidad === 'todas' || d.especialidad === filtroEspecialidad) && (filtroTipo === 'todos' || d.tipo === filtroTipo)
  );
  const conteoPorEstado = {};
  DOC_ESTADOS.forEach((e) => { conteoPorEstado[e] = 0; });
  universo.forEach((doc) => { conteoPorEstado[estadoDeDoc(doc)] += 1; });

  const gruposFiltrados = grupos
    .filter((g) => filtroEspecialidad === 'todas' || g.especialidad === filtroEspecialidad)
    .map((g) => ({
      ...g,
      docs: g.docs.filter(
        (doc) => (filtroTipo === 'todos' || doc.tipo === filtroTipo) && (filtroEstado === 'todos' || estadoDeDoc(doc) === filtroEstado)
      ),
    }))
    .filter((g) => g.docs.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-navy-400">
          Lista aplicable según inversionista: <span className="font-semibold text-navy-600">{general.inversionista || 'Ninguno definido — se usa Estándar'}</span>
        </p>
        <p className="text-xs font-mono text-navy-500 bg-navy-50 border border-navy-200 rounded px-2 py-1">
          {prefijo ? `Prefijo de código: ${prefijo}` : 'Completa Departamento (abrev.), N.° de minigranja y N.° de predio en "General" para generar el código'}
        </p>
      </div>

      <div className="bg-navy-50 border border-navy-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-6 items-stretch">
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">
              Progreso
              {filtroEspecialidad !== 'todas' ? ` · ${filtroEspecialidad}` : ''}
              {filtroTipo !== 'todos' ? ` · ${filtroTipo}` : ''}
            </p>
            <div className="flex-1 flex items-center">
              <ProgresoDonut conteoPorEstado={conteoPorEstado} total={universo.length} />
            </div>
          </div>
          <div className="flex-1 min-w-[180px] border-l border-navy-200 pl-6">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Progreso por especialidad</p>
            <p className="text-xs text-navy-400 mb-3">No incluye documentos en "No aplica" — esos no se cuentan en el seguimiento.</p>
            <div className="space-y-3">
              {grupos.map((g) => {
                const docsSeguidos = g.docs.filter((d) => estadoDeDoc(d) !== 'No aplica' && (filtroTipo === 'todos' || d.tipo === filtroTipo));
                const conteo = {};
                DOC_ESTADOS.forEach((e) => { conteo[e] = 0; });
                docsSeguidos.forEach((d) => { conteo[estadoDeDoc(d)] += 1; });
                return <EspecialidadBarra key={g.especialidad} especialidad={g.especialidad} docs={docsSeguidos} conteo={conteo} />;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-navy-500">Filtrar por especialidad:</label>
          <select
            value={filtroEspecialidad}
            onChange={(e) => setFiltroEspecialidad(e.target.value)}
            className="text-sm rounded-lg border border-navy-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="todas">Todas ({lista.length})</option>
            {grupos.map((g) => (
              <option key={g.especialidad} value={g.especialidad}>{g.especialidad} ({g.docs.length})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-navy-500">Filtrar por tipo:</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-sm rounded-lg border border-navy-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="todos">Todos ({lista.length})</option>
            {tiposDisponibles.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo} ({lista.filter((d) => d.tipo === tipo).length})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Semáforo de progreso: resume y a la vez filtra por estado */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFiltroEstado('todos')}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
            filtroEstado === 'todos' ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
          }`}
        >
          Todos ({universo.length})
        </button>
        {DOC_ESTADOS.map((estado) => {
          const cfg = DOC_ESTADO_CONFIG[estado];
          const activo = filtroEstado === estado;
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              title={estado}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                activo ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ring-offset-1 ${cfg.ring}` : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {DOC_ESTADO_CORTO[estado]} ({conteoPorEstado[estado]})
            </button>
          );
        })}
      </div>

      {!puedeComentar && (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-4">
          <Lock className="w-3.5 h-3.5" /> Solo "Control de Calidad Interno" puede escribir comentarios.
        </p>
      )}
      <div className="space-y-6">
        {gruposFiltrados.map((g) => (
          <div key={g.especialidad}>
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{g.especialidad}</p>
            <div className="space-y-2">
              {g.docs.map((doc) => {
                const codigoFinal = prefijo ? doc.codigo.replace('COLXXXXXXPX', prefijo) : doc.codigo;
                const estadoDoc = estadoActual[doc.codigo] || {};
                const estadoValor = estadoDoc.estado || 'Pendiente';
                return (
                  <DocumentoCard
                    key={doc.codigo}
                    doc={doc}
                    codigoFinal={codigoFinal}
                    estadoDoc={estadoDoc}
                    estadoValor={estadoValor}
                    puedeEditarContenido={puedeEditarContenido}
                    puedeComentar={puedeComentar}
                    onDocChange={onDocChange}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {gruposFiltrados.length === 0 && (
          <p className="text-sm text-navy-400 italic text-center py-8">No hay documentos que coincidan con estos filtros.</p>
        )}
      </div>
    </div>
  );
}

function PrintableReport({ project }) {
  const general = project.data.general;
  return (
    <div className="print-only p-10">
      <div className="flex items-center justify-between border-b-2 border-navy-800 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <img src={logoMark} alt="" className="w-6 h-6 object-contain" />
          <div>
            <p className="font-bold text-lg text-navy-800">Sun Design Suite</p>
            <p className="text-xs text-navy-500">Hoja de Vida de Minigranja Fotovoltaica</p>
          </div>
        </div>
        <p className="text-xs text-navy-400">Generado el {new Date().toLocaleDateString('es-CO')}</p>
      </div>

      <h1 className="text-xl font-bold text-navy-800 mb-1">{projectDisplayName(project)}</h1>
      <p className="text-sm text-navy-500 mb-6">{general.municipio || 'N/A'}, {general.departamento || 'N/A'}, {general.pais || 'N/A'}</p>

      <table className="w-full text-sm mb-8 border border-navy-300">
        <tbody>
          <tr className="border-b border-navy-300">
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50 w-1/4">Estado</td>
            <td className="px-3 py-2">{STATUS_CONFIG[project.estado]?.label}</td>
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50 w-1/4">Elaboró</td>
            <td className="px-3 py-2">{equipoTexto(project.equipo.civil) || 'N/A'}</td>
          </tr>
          <tr>
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50">Fecha de Inicio</td>
            <td className="px-3 py-2 font-mono">{formatDate(general.fecha_inicio) || 'N/A'}</td>
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50">Fecha de Entrega</td>
            <td className="px-3 py-2 font-mono">{formatDate(general.fecha_entrega) || 'N/A'}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="text-sm font-bold uppercase tracking-wide text-navy-600 mb-2 border-b border-navy-300 pb-1">Equipo Asignado</h2>
      <table className="w-full text-sm mb-8">
        <tbody>
          {ROLES.map((role) => (
            <tr key={role.key} className="border-b border-navy-100">
              <td className="py-1.5 pr-4 text-navy-500 w-1/3">{role.label}</td>
              <td className="py-1.5 font-medium text-navy-700">{equipoTexto(project.equipo[role.key]) || 'Sin asignar'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {SCHEMA.map((section) => (
        <div key={section.id} className="mb-8 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-600 mb-2 border-b border-navy-300 pb-1">{section.label}</h2>
          <table className="w-full text-sm">
            <tbody>
              {section.fields.map((field) => {
                const raw = project.data[section.id] ? project.data[section.id][field.key] : undefined;

                if (field.type === 'stations') {
                  const filas = (Array.isArray(raw) ? raw : []).filter((r) => r.nombre || r.dias || r.peso);
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 align-top">
                        {filas.length === 0 ? (
                          <span className="font-mono text-navy-700">—</span>
                        ) : (
                          <table className="w-full text-xs border border-navy-300">
                            <thead>
                              <tr className="bg-navy-50">
                                <th className="text-left px-2 py-1 border-b border-navy-300">Estación</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Días/año</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Peso %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map((r, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1 font-mono">{r.nombre || '—'}</td>
                                  <td className="px-2 py-1 font-mono">{r.dias || '—'}</td>
                                  <td className="px-2 py-1 font-mono">{r.peso || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (field.type === 'cimentacion') {
                  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
                  const totalM = ((parseFloat(v.desplante) || 0) + field.sobresale).toFixed(2);
                  const partes = field.forma === 'cilindrica'
                    ? [v.diametro && `Ø ${v.diametro} m`]
                    : field.forma === 'zapata_pedestal'
                      ? [
                          (v.ancho_zapata || v.profundo_zapata || v.alto_zapata) &&
                            `Zapata ${v.ancho_zapata || '—'}×${v.profundo_zapata || '—'}×${v.alto_zapata || '—'} m`,
                          (v.ancho_pedestal || v.profundo_pedestal) &&
                            `Pedestal ${v.ancho_pedestal || '—'}×${v.profundo_pedestal || '—'}×${altoPedestal(v, field.sobresale).toFixed(2)} m`,
                        ]
                      : [(v.ancho || v.profundo) && `${v.ancho || '—'}×${v.profundo || '—'} m`];
                  if (v.desplante) partes.push(`Desplante ${v.desplante} m`);
                  if (v.resistencia) partes.push(`Concreto ${v.resistencia}`);
                  const resumen = partes.filter(Boolean).join(' · ');
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 font-mono text-navy-700 align-top">
                        {resumen || '—'}
                        <span className="block font-sans text-xs text-navy-500 mt-0.5">Sobresale del terreno: {field.sobresale} m · Alto total: {totalM} m</span>
                      </td>
                    </tr>
                  );
                }

                if (field.type === 'computed') {
                  const calculado = field.formula(project.data[section.id] || {});
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 font-mono text-navy-700 align-top">{calculado}</td>
                    </tr>
                  );
                }

                let val = raw;
                let nota = '';
                if (field.type === 'boolean') {
                  const v = raw && typeof raw === 'object' ? raw : { valor: null, nota: '' };
                  val = v.valor === true ? 'Sí' : v.valor === false ? 'No' : '—';
                  nota = v.nota || '';
                } else if (field.type === 'date') {
                  val = raw ? formatDate(raw) : '—';
                } else if (val === '' || val === null || val === undefined) {
                  val = '—';
                }
                return (
                  <tr key={field.key} className="border-b border-navy-100">
                    <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                    <td className="py-1.5 font-mono text-navy-700 align-top">
                      {val}
                      {nota && <span className="block font-sans text-xs text-navy-500 mt-0.5">{nota}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <h2 className="text-sm font-bold uppercase tracking-wide text-navy-600 mb-2 border-b border-navy-300 pb-1">Control Documental</h2>
      {(() => {
        const lista = pickDocumentList(general.inversionista);
        const prefijo = buildProjectCode(general);
        const estadoActual = project.documentos || {};
        const grupos = [];
        const idx = new Map();
        lista.forEach((doc) => {
          if (!idx.has(doc.especialidad)) {
            idx.set(doc.especialidad, grupos.length);
            grupos.push({ especialidad: doc.especialidad, docs: [] });
          }
          grupos[idx.get(doc.especialidad)].docs.push(doc);
        });
        return (
          <div className="mb-8">
            <p className="text-xs text-navy-400 mb-3">
              Lista aplicable según inversionista: <span className="font-semibold text-navy-600">{general.inversionista || 'Estándar'}</span>
            </p>
            {grupos.map((g) => (
              <div key={g.especialidad} className="mb-4 break-inside-avoid">
                <p className="text-xs font-bold text-navy-500 uppercase mb-1">{g.especialidad}</p>
                <table className="w-full text-xs border border-navy-300">
                  <thead>
                    <tr className="bg-navy-50">
                      <th className="text-left px-2 py-1 border-b border-navy-300">Documento</th>
                      <th className="text-left px-2 py-1 border-b border-navy-300">Código</th>
                      <th className="text-left px-2 py-1 border-b border-navy-300">Estado</th>
                      <th className="text-left px-2 py-1 border-b border-navy-300">Comentarios</th>
                      <th className="text-left px-2 py-1 border-b border-navy-300">Últ. entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.docs.map((doc) => {
                      const codigoFinal = prefijo ? doc.codigo.replace('COLXXXXXXPX', prefijo) : doc.codigo;
                      const info = estadoActual[doc.codigo] || {};
                      const versiones = info.versiones || [];
                      const ultima = versiones[versiones.length - 1];
                      return (
                        <tr key={doc.codigo} className="border-b border-navy-100">
                          <td className="px-2 py-1">{doc.nombre}</td>
                          <td className="px-2 py-1 font-mono">{codigoFinal}</td>
                          <td className="px-2 py-1">{info.estado || 'Pendiente'}</td>
                          <td className="px-2 py-1">{info.comentarios || '—'}</td>
                          <td className="px-2 py-1">
                            {ultima ? `V${versiones.length}: ${formatDate(ultima.entrega) || '—'}${ultima.comentarios_recibidos ? ` (com. ${formatDate(ultima.comentarios_recibidos)})` : ''}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })()}

      <p className="text-xs text-navy-400 mt-10 pt-4 border-t border-navy-200">
        Documento generado automáticamente por Sun Design Suite. Uso interno del equipo de diseño.
      </p>
    </div>
  );
}

/* ============================================================================
   6. AUTENTICACIÓN Y CUENTA DE INGENIERO
   ============================================================================ */
function AuthGate() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Cuenta creada. Si tu proyecto de Supabase exige confirmar el correo, revisa tu bandeja de entrada y luego inicia sesión.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-lg bg-lime-300 flex items-center justify-center shrink-0">
            <img src={logoMark} alt="" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="font-bold text-navy-800 leading-tight">Sun Design Suite</p>
            <p className="text-xs text-navy-500">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Correo</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" placeholder="tu@empresa.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Contraseña</label>
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" placeholder="Mínimo 6 caracteres" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {info && <p className="text-xs text-emerald-600">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-600 disabled:opacity-60 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
          <button
            type="button"
            onClick={() => { setMode((m) => (m === 'login' ? 'signup' : 'login')); setError(''); setInfo(''); }}
            className="w-full text-xs text-navy-500 hover:text-navy-700"
          >
            {mode === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProfileGate({ userId, initial, onSaved, onCancel }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [preview, setPreview] = useState(initial?.foto || null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handlePhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      let foto = initial?.foto || null;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${userId}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        foto = data.publicUrl;
      }
      const { error: dbErr } = await supabase.from('profiles').upsert({ id: userId, nombre: nombre.trim(), foto_url: foto });
      if (dbErr) throw dbErr;
      onSaved({ id: userId, nombre: nombre.trim(), foto });
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-lime-300 flex items-center justify-center shrink-0">
              <img src={logoMark} alt="" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="font-bold text-navy-800 leading-tight">Sun Design Suite</p>
              <p className="text-xs text-navy-500">{initial ? 'Editar mi perfil' : 'Completa tu perfil'}</p>
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="text-navy-400 hover:text-navy-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col items-center">
            <label className="cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-navy-100 border-2 border-dashed border-navy-300 flex items-center justify-center overflow-hidden group-hover:border-lime-400 transition-colors">
                {preview ? <img src={preview} alt="Foto de perfil" className="w-full h-full object-cover" /> : <UploadCloud className="w-6 h-6 text-navy-400" />}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            <p className="text-xs text-navy-400 mt-2">Foto de perfil (opcional)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre completo *</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="Ej. Camilo Zapata"
            />
          </div>

          {!initial && (
            <p className="text-xs text-navy-400 flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Tu cuenta se crea sin rol. Pídele a un líder que te asigne tu(s) especialidad(es) desde la sección "Equipo" para poder ver y trabajar en tus proyectos.
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-600 disabled:opacity-60 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? 'Guardar cambios' : 'Crear mi perfil'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoadingScreen({ mensaje = 'Cargando…' }) {
  return (
    <div className="fixed inset-0 bg-navy-50 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
      <p className="text-sm text-navy-400">{mensaje}</p>
    </div>
  );
}

/* ============================================================================
   7. NAVEGACIÓN Y LAYOUT
   ============================================================================ */
function Sidebar({ view, setView, stats, perfil, onEditProfile, onRefresh, onLogout, mobileOpen, onCloseMobile }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'mis', label: 'Mis Proyectos', icon: FolderKanban },
    { key: 'todos', label: 'Todos los Proyectos', icon: Layers },
    { key: 'resumen_inversionistas', label: 'Resumen por Inversionista', icon: PieChart },
    { key: 'cimentaciones', label: 'Cimentaciones', icon: Boxes },
    { key: 'equipo', label: 'Equipo', icon: UserCog },
    { key: 'instructivos', label: 'Instructivos', icon: Video },
    { key: 'enlaces', label: 'Enlaces de Interés', icon: Link2 },
  ];

  return (
    <>
      {/* Fondo oscuro detrás del menú en móvil — clic para cerrar. Nunca aparece en escritorio. */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 bg-navy-900/60 z-30 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`no-print w-64 shrink-0 bg-navy-900 text-navy-200 flex flex-col h-screen fixed md:sticky top-0 left-0 z-40 transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div
          className="px-5 py-6 border-b border-navy-800 flex items-center gap-2.5"
          style={{ paddingTop: 'max(env(safe-area-inset-top) + 1.5rem, 3.25rem)' }}
        >
          <div className="w-9 h-9 rounded-lg bg-lime-300 flex items-center justify-center shrink-0">
            <img src={logoMark} alt="" className="w-5 h-5 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold leading-tight">Sun Design Suite</p>
            <p className="text-xs text-navy-300 tracking-wide">Minigranjas Fotovoltaicas</p>
          </div>
          <button onClick={onRefresh} title="Actualizar datos compartidos" className="text-navy-300 hover:text-white shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onCloseMobile} className="md:hidden text-navy-300 hover:text-white shrink-0" title="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="custom-scroll flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-10 rounded-lg text-sm font-medium leading-tight transition-colors border-l-2 ${
                  active ? 'bg-navy-800 text-white border-lime-500' : 'text-navy-300 border-transparent hover:bg-navy-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div
          className="p-4 border-t border-navy-800 flex items-center gap-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom) + 1rem, 1.25rem)' }}
        >
          <Avatar name={perfil.nombre} foto={perfil.foto} />
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate">{perfil.nombre}</p>
            <p className="text-navy-300 text-xs truncate flex items-center gap-1">
              {isLeader(perfil) && <ShieldCheck className="w-3 h-3 text-lime-400 shrink-0" />}
              {rolesLabel(perfil)}
            </p>
          </div>
          <button onClick={onEditProfile} title="Editar mi perfil" className="text-navy-300 hover:text-white shrink-0">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onLogout} title="Cerrar sesión" className="text-navy-300 hover:text-red-400 shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, value, icon: Icon, accent, textColor = 'text-navy-700' }) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${accent} border-t border-r border-b border-t-navy-200 border-r-navy-200 border-b-navy-200 p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
        <Icon className={`w-4 h-4 ${textColor}`} />
      </div>
      <p className={`text-2xl font-bold mt-2 ${textColor}`}>{value}</p>
    </div>
  );
}

function ProjectCard({ project, onClick, directorio }) {
  const general = project.data.general;
  const asignados = ROLES.flatMap((r) => equipoComoArray(project.equipo[r.key]).map((nombre) => ({ nombre, role: r })));
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-navy-200 p-4 hover:border-lime-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="font-bold text-navy-800 leading-snug group-hover:text-lime-600 transition-colors">{projectDisplayName(project)}</h3>
        <StatusBadge estado={project.estado} size="sm" />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-navy-500 mb-3">
        <MapPin className="w-3.5 h-3.5 shrink-0" /> {general.municipio || 'Sin ubicación'}, {general.departamento || ''}
      </p>
      <div className="flex items-center justify-between pt-3 border-t border-navy-100">
        <div className="flex -space-x-2">
          {asignados.slice(0, 4).map(({ nombre, role }, i) => {
            const u = findUserByName(directorio, nombre);
            return <Avatar key={`${role.key}-${nombre}-${i}`} name={nombre} foto={u?.foto} title={role.label} size="sm" />;
          })}
          {asignados.length === 0 && <span className="text-xs text-navy-300 italic">Sin equipo asignado</span>}
          {asignados.length > 4 && <span className="text-xs text-navy-400 ml-1">+{asignados.length - 4}</span>}
        </div>
        <p className="flex items-center gap-1 text-xs text-navy-400">
          <Calendar className="w-3.5 h-3.5" /> {formatDate(general.fecha_entrega) || 'Sin fecha'}
        </p>
      </div>
    </button>
  );
}

/* ============================================================================
   8. VISTAS PRINCIPALES
   ============================================================================ */
function Dashboard({ projects, misProyectos, onNewProject, openProject, setView, directorio, perfil }) {
  const total = projects.length;
  const activos = projects.filter((p) => p.estado === 'activo').length;
  const pausa = projects.filter((p) => p.estado === 'pausa').length;
  const inactivos = projects.filter((p) => p.estado === 'inactivo').length;
  const finalizados = projects.filter((p) => p.estado === 'finalizado').length;
  const primerNombre = (perfil.nombre || '').split(' ')[0];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Avatar name={perfil.nombre} foto={perfil.foto} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Hola, {primerNombre}</h1>
            <p className="text-navy-500 text-sm mt-1">{rolesLabel(perfil)} · Panel general de proyectos</p>
          </div>
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <StatCard label="Total Proyectos" value={total} icon={Layers} accent="border-navy-300" />
        <StatCard label="Activos" value={activos} icon={Check} accent="border-emerald-400" textColor="text-emerald-600" />
        <StatCard label="En Pausa" value={pausa} icon={Cog} accent="border-yellow-400" textColor="text-yellow-600" />
        <StatCard label="Inactivos" value={inactivos} icon={XCircle} accent="border-red-400" textColor="text-red-600" />
        <StatCard label="Finalizados" value={finalizados} icon={PartyPopper} accent="border-violet-400" textColor="text-violet-600" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-navy-800">Mis proyectos</h2>
        <button onClick={() => setView('mis')} className="text-sm font-medium text-lime-600 hover:text-lime-700">
          Ver todos →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {misProyectos.slice(0, 3).map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => openProject(p.id)} directorio={directorio} />
        ))}
        {misProyectos.length === 0 && <p className="text-navy-400 text-sm italic col-span-full">No tienes proyectos asignados todavía.</p>}
      </div>
    </div>
  );
}

function ProjectListView({ projects, title, subtitle, onOpen, onNewProject, directorio, archivarFinalizados = false, mostrarFiltroInversionista = false }) {
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [inversionistaFiltro, setInversionistaFiltro] = useState('todos');
  const [mostrarArchivados, setMostrarArchivados] = useState(false);

  const activos = archivarFinalizados ? projects.filter((p) => p.estado !== 'finalizado') : projects;
  const archivados = archivarFinalizados ? projects.filter((p) => p.estado === 'finalizado') : [];
  const pool = archivarFinalizados && mostrarArchivados ? archivados : activos;

  const inversionistasDisponibles = mostrarFiltroInversionista
    ? [...new Set(pool.map((p) => p.data.general?.inversionista).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    : [];

  const filtered = pool.filter((p) => {
    const general = p.data.general;
    const codigo = buildProjectCode(general);
    const haystack = `${p.nombre} ${general.municipio || ''} ${general.departamento || ''} ${codigo}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());
    const matchEstado = estadoFiltro === 'todos' || p.estado === estadoFiltro;
    const matchInversionista = inversionistaFiltro === 'todos' || (general.inversionista || '') === inversionistaFiltro;
    return matchSearch && matchEstado && matchInversionista;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">{title}</h1>
          <p className="text-navy-500 text-sm mt-1">{subtitle}</p>
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      {archivarFinalizados && (
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setMostrarArchivados(false)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              !mostrarArchivados ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
            }`}
          >
            Activos ({activos.length})
          </button>
          <button
            onClick={() => setMostrarArchivados(true)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              mostrarArchivados ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
            }`}
          >
            <PartyPopper className="w-3.5 h-3.5" /> Finalizados ({archivados.length})
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 my-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-navy-400" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, ubicación o código…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-navy-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
          />
        </div>
        {!mostrarArchivados && (
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="text-sm rounded-lg border border-navy-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="pausa">En Pausa</option>
            <option value="inactivo">Inactivo</option>
            {!archivarFinalizados && <option value="finalizado">Finalizado</option>}
          </select>
        )}
        {mostrarFiltroInversionista && (
          <select
            value={inversionistaFiltro}
            onChange={(e) => setInversionistaFiltro(e.target.value)}
            className="text-sm rounded-lg border border-navy-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="todos">Todos los inversionistas</option>
            {inversionistasDisponibles.map((inv) => (
              <option key={inv} value={inv}>{inv}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => onOpen(p.id)} directorio={directorio} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-navy-400">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {mostrarArchivados ? 'No hay proyectos finalizados con esos filtros.' : 'No se encontraron proyectos con esos filtros.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* Tarjeta de resumen de UN inversionista: cuántos proyectos tiene en cada    */
/* estado, progreso de Control Documental sumando TODOS sus proyectos, y     */
/* una lista desplegable de esos proyectos (clic para ir directo a uno).    */
function InversionistaResumenCard({ nombre, proyectos, onOpenProject }) {
  const [expandido, setExpandido] = useState(false);

  const conteoEstadoProyecto = {};
  proyectos.forEach((p) => { conteoEstadoProyecto[p.estado] = (conteoEstadoProyecto[p.estado] || 0) + 1; });

  const conteoDocsAgregado = {};
  DOC_ESTADOS.forEach((e) => { conteoDocsAgregado[e] = 0; });
  let totalDocsAgregado = 0;
  proyectos.forEach((p) => {
    const { conteoPorEstado, total } = computeProjectDocProgress(p);
    DOC_ESTADOS.forEach((e) => { conteoDocsAgregado[e] += conteoPorEstado[e]; });
    totalDocsAgregado += total;
  });
  const especialidadMap = computeEspecialidadProgressMultiProyecto(proyectos);

  return (
    <div className="bg-white border border-navy-200 rounded-xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-navy-800">{nombre}</h2>
          <p className="text-xs text-navy-400">{proyectos.length} proyecto{proyectos.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.keys(STATUS_CONFIG).map((key) => {
            const cfg = STATUS_CONFIG[key];
            const cantidad = conteoEstadoProyecto[key] || 0;
            if (cantidad === 0) return null;
            return (
              <span key={key} className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                {cfg.label}: {cantidad}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bg-navy-50 border border-navy-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-6 items-stretch">
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Progreso (todos sus proyectos)</p>
            <div className="flex-1 flex items-center">
              <ProgresoDonut conteoPorEstado={conteoDocsAgregado} total={totalDocsAgregado} />
            </div>
          </div>
          <div className="flex-1 min-w-[180px] border-l border-navy-200 pl-6">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Progreso por especialidad</p>
            <p className="text-xs text-navy-400 mb-3">No incluye documentos en "No aplica" — esos no se cuentan en el seguimiento.</p>
            <div className="space-y-3">
              {[...especialidadMap.keys()].sort((a, b) => a.localeCompare(b, 'es')).map((esp) => {
                const conteo = especialidadMap.get(esp);
                const total = Object.values(conteo).reduce((a, b) => a + b, 0);
                return <EspecialidadBarra key={esp} especialidad={esp} docs={Array.from({ length: total })} conteo={conteo} />;
              })}
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => setExpandido((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700">
        {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {expandido ? 'Ocultar' : 'Ver'} proyectos
      </button>
      {expandido && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {proyectos.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="flex items-center justify-between gap-2 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-lg px-3 py-2.5 text-left transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-700 truncate">{projectDisplayName(p)}</p>
                <p className="text-xs text-navy-400 truncate">{p.data.general.municipio}, {p.data.general.departamento}</p>
              </div>
              <StatusBadge estado={p.estado} size="sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenInversionistasView({ projects, onOpenProject }) {
  const grupos = new Map();
  // Los proyectos "Finalizado" ya se archivan aparte y no se cuentan aquí —
  // este resumen es sobre el trabajo que sigue en curso por inversionista.
  projects.filter((p) => p.estado !== 'finalizado').forEach((p) => {
    const inv = (p.data.general?.inversionista || '').trim() || 'Sin inversionista definido';
    if (!grupos.has(inv)) grupos.set(inv, []);
    grupos.get(inv).push(p);
  });
  const inversionistasOrdenados = [...grupos.keys()].sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-800">Resumen por Inversionista</h1>
        <p className="text-navy-500 text-sm mt-1">Progreso de Control Documental y estado de proyectos, agrupado por inversionista. No incluye proyectos finalizados.</p>
      </div>
      {inversionistasOrdenados.length === 0 ? (
        <p className="text-sm text-navy-400 italic text-center py-16">Aún no hay proyectos para resumir.</p>
      ) : (
        <div className="space-y-6">
          {inversionistasOrdenados.map((inv) => (
            <InversionistaResumenCard key={inv} nombre={inv} proyectos={grupos.get(inv)} onOpenProject={onOpenProject} />
          ))}
        </div>
      )}
    </div>
  );
}

function EquipoSelect({ role, valorActual, directorio, onChange, readOnly }) {
  const candidatos = directorio.filter((u) => u.roles && u.roles.includes(role.key));
  const actualRegistrado = valorActual && candidatos.some((u) => u.nombre === valorActual);

  if (readOnly) {
    return (
      <p className={`text-sm font-medium py-1.5 ${valorActual ? 'text-navy-700' : 'text-navy-300 italic'}`}>
        {valorActual || 'Sin asignar'}
      </p>
    );
  }

  return (
    <select value={valorActual || ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm">
      <option value="">Sin asignar</option>
      {candidatos.map((u) => (
        <option key={u.id} value={u.nombre}>{u.nombre}</option>
      ))}
      {valorActual && !actualRegistrado && <option value={valorActual}>{valorActual} (no registrado)</option>}
    </select>
  );
}

/* Para especialidades que admiten varias personas (civil, eléctrico,       */
/* delineante): cada asignado se muestra como una "chip" con su X para      */
/* quitarlo, y un botón "+ Agregar" abre un select con los candidatos que   */
/* faltan por agregar.                                                      */
function EquipoMultiSelect({ role, valores, directorio, onChange, readOnly }) {
  const [showAdd, setShowAdd] = useState(false);
  const asignados = equipoComoArray(valores);
  const candidatos = directorio.filter((u) => u.roles && u.roles.includes(role.key) && !asignados.includes(u.nombre));

  if (readOnly) {
    return (
      <p className={`text-sm font-medium py-1.5 ${asignados.length ? 'text-navy-700' : 'text-navy-300 italic'}`}>
        {asignados.length ? asignados.join(', ') : 'Sin asignar'}
      </p>
    );
  }

  function agregar(nombre) {
    setShowAdd(false);
    if (!nombre || asignados.includes(nombre)) return;
    onChange([...asignados, nombre]);
  }
  function quitar(nombre) {
    onChange(asignados.filter((n) => n !== nombre));
  }

  if (showAdd) {
    return (
      <select
        autoFocus
        value=""
        onChange={(e) => agregar(e.target.value)}
        onBlur={() => setShowAdd(false)}
        className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Seleccionar persona…</option>
        {candidatos.map((u) => (
          <option key={u.id} value={u.nombre}>{u.nombre}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm flex flex-wrap items-center gap-1.5">
      {asignados.map((nombre) => (
        <span key={nombre} className="inline-flex items-center gap-1 bg-navy-100 text-navy-700 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full">
          {nombre}
          <button onClick={() => quitar(nombre)} title={`Quitar a ${nombre}`} className="text-navy-400 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button onClick={() => setShowAdd(true)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
        <Plus className="w-3 h-3" /> Agregar
      </button>
    </div>
  );
}

/* Decide si usar el selector de una sola persona o el de varias, según el   */
/* rol. Se usa en todos los lugares donde se asigna equipo a un proyecto.   */
function EquipoField({ role, valor, directorio, onChange, readOnly }) {
  if (esRolMultiple(role.key)) {
    return <EquipoMultiSelect role={role} valores={valor} directorio={directorio} onChange={onChange} readOnly={readOnly} />;
  }
  return <EquipoSelect role={role} valorActual={valor} directorio={directorio} onChange={onChange} readOnly={readOnly} />;
}

function ProjectFormModal({ onClose, onCreate, directorio, perfil, inversionistas, onAddInversionista, paises, onAddPais, projects }) {
  const puedeGestionar = isLeader(perfil);
  const [form, setForm] = useState({
    nombre: '',
    estado: 'activo',
    equipo: Object.fromEntries(ROLES.map((r) => [r.key, esRolMultiple(r.key) ? [] : ''])),
    general: {
      municipio: '', departamento: '', pais: 'Colombia', inversionista: '',
      numero_minigranja: '', numero_predio: '',
      fecha_inicio: '', fecha_entrega: '', drive_url: '',
    },
  });

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }
  function setGeneral(key, val) {
    setForm((prev) => ({ ...prev, general: { ...prev.general, [key]: val } }));
  }
  function setEquipo(roleKey, val) {
    setForm((prev) => ({ ...prev, equipo: { ...prev.equipo, [roleKey]: val } }));
  }

  // Un mismo par (N.° de minigranja, N.° de predio) identifica un único
  // proyecto real — si ya existe uno con esos dos datos, es el mismo
  // proyecto y no se debe volver a crear.
  const minigranja = form.general.numero_minigranja.trim();
  const predio = form.general.numero_predio.trim();
  const duplicado = minigranja && predio
    ? projects.find((p) => (p.data.general.numero_minigranja || '').trim() === minigranja && (p.data.general.numero_predio || '').trim() === predio)
    : null;

  function submit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    if (duplicado) return;
    const data = emptySchemaData();
    data.general = { ...data.general, ...form.general };
    onCreate({
      id: makeId('proj'),
      nombre: form.nombre,
      estado: form.estado,
      equipo: form.equipo,
      data,
      archivos: [],
      notas: [],
      documentos: {},
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-50 overflow-y-auto z-50 p-4 flex items-start justify-center">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-200">
          <h2 className="text-lg font-bold text-navy-800">Nuevo Proyecto</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre del Proyecto *</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="Ej. Minigranja Solar El Retiro 5MW"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Departamento</label>
              <select
                value={form.general.departamento}
                onChange={(e) => { setGeneral('departamento', e.target.value); setGeneral('municipio', ''); }}
                className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar…</option>
                {COLOMBIA.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Municipio</label>
              <select
                value={form.general.municipio}
                onChange={(e) => setGeneral('municipio', e.target.value)}
                disabled={!form.general.departamento}
                className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm disabled:bg-navy-50 disabled:text-navy-400"
              >
                <option value="">{form.general.departamento ? 'Seleccionar…' : 'Elige antes el departamento'}</option>
                {(COLOMBIA.find((d) => d.nombre === form.general.departamento)?.municipios || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">País</label>
              <PaisPicker value={form.general.pais} paises={paises} onChange={(val) => setGeneral('pais', val)} onAddNew={onAddPais} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Inversionista</label>
              <InversionistaPicker
                value={form.general.inversionista}
                inversionistas={inversionistas}
                onChange={(val) => setGeneral('inversionista', val)}
                onAddNew={onAddInversionista}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Fecha de Inicio</label>
              <input type="date" value={form.general.fecha_inicio} onChange={(e) => setGeneral('fecha_inicio', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Fecha de Entrega</label>
              <input type="date" value={form.general.fecha_entrega} onChange={(e) => setGeneral('fecha_entrega', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Carpeta de Drive (URL, opcional)</label>
              <input
                type="text"
                value={form.general.drive_url}
                onChange={(e) => setGeneral('drive_url', e.target.value)}
                placeholder="https://drive.google.com/…"
                className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-navy-500 mb-2">Código del proyecto (para Control Documental)</p>
            <p className="text-xs text-navy-400 mb-2">
              La abreviatura del departamento (3 letras + "T" de terreno) se calcula sola a partir del departamento elegido arriba.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-navy-500 mb-1">N.° de minigranja</label>
                <input value={form.general.numero_minigranja} onChange={(e) => setGeneral('numero_minigranja', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-navy-500 mb-1">N.° de predio</label>
                <input value={form.general.numero_predio} onChange={(e) => setGeneral('numero_predio', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            {duplicado && (
              <p className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Ya existe un proyecto con esta minigranja y predio: <strong>{projectDisplayName(duplicado)}</strong>. No se puede crear un duplicado — si es el mismo proyecto, ábrelo desde el listado en vez de crear uno nuevo.
              </p>
            )}
          </div>

          {puedeGestionar ? (
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className="rounded-lg border border-navy-300 px-3 py-2 text-sm">
                <option value="activo">Activo</option>
                <option value="pausa">En Pausa</option>
                <option value="inactivo">Inactivo</option>
              <option value="finalizado">Finalizado</option>
              </select>
            </div>
          ) : (
            <p className="text-xs text-navy-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> El proyecto se crea como <strong className="font-semibold text-navy-600">Activo</strong>. Solo un líder puede cambiar el estado.
            </p>
          )}

          <div>
            <p className="text-xs font-semibold uppercase text-navy-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Asignación de Equipo
            </p>
            {puedeGestionar ? (
              <>
                <p className="text-xs text-navy-400 mb-2">Solo aparecen ingenieros que ya crearon su cuenta con esa especialidad.</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map((role) => (
                    <div key={role.key}>
                      <label className="block text-xs text-navy-500 mb-1">{role.label}</label>
                      <EquipoField role={role} valor={form.equipo[role.key]} directorio={directorio} onChange={(val) => setEquipo(role.key, val)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-navy-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Solo un líder (Civil, Eléctrico, Delineantes o Diseño) puede asignar el equipo. Pídele a uno que complete esta parte después de crear el proyecto.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-100 rounded-lg">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!!duplicado}
              className="px-4 py-2 text-sm font-semibold bg-lime-500 hover:bg-lime-600 disabled:bg-navy-200 disabled:text-navy-400 disabled:cursor-not-allowed text-navy-900 rounded-lg shadow-sm"
            >
              Crear Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistorialItem({ h }) {
  return (
    <div className="flex gap-3 border-l-2 border-lime-300 pl-3">
      <div className="min-w-0">
        <p className="text-sm text-navy-700">
          <span className="font-semibold">{h.usuario_nombre}</span>
          <span className="text-navy-400"> · {formatDateTime(h.created_at)}</span>
        </p>
        <p className="text-sm text-navy-600 mt-0.5 whitespace-pre-wrap break-words">{h.accion}</p>
      </div>
    </div>
  );
}

/* Orden preferido de las categorías al listarlas (coincide con el orden de   */
/* las pestañas del proyecto).                                               */
const HISTORIAL_ORDEN = ['nombre', 'estado', 'general', 'civil', 'mecanica', 'geotecnia', 'estructural', 'hidraulico', 'electrico', 'documentos', 'notas', 'archivos'];

function HistorialPanel({ historial, loading, onRefresh }) {
  const [openCats, setOpenCats] = useState({}); // categoría entera visible o no
  const [openAnteriores, setOpenAnteriores] = useState({}); // dentro de una categoría abierta, ver también lo viejo

  const encabezado = (
    <div className="flex items-center justify-between mb-4">
      <p className="text-xs text-navy-400">Separado por especialidad · haz clic en una para ver sus cambios</p>
      <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700">
        <RefreshCw className="w-3.5 h-3.5" /> Actualizar
      </button>
    </div>
  );

  if (loading) {
    return (
      <div>
        {encabezado}
        <p className="text-sm text-navy-400 text-center py-8">Cargando historial…</p>
      </div>
    );
  }
  if (!historial || historial.length === 0) {
    return (
      <div>
        {encabezado}
        <p className="text-sm text-navy-400 italic text-center py-8">Aún no hay cambios registrados para este proyecto.</p>
      </div>
    );
  }

  const inicioSemana = inicioDeSemana();
  const grupos = [];
  const idx = new Map();
  historial.forEach((h) => {
    const cat = h.categoria || 'general';
    if (!idx.has(cat)) {
      idx.set(cat, grupos.length);
      grupos.push({ categoria: cat, items: [] });
    }
    grupos[idx.get(cat)].items.push(h);
  });
  grupos.sort((a, b) => {
    const ia = HISTORIAL_ORDEN.indexOf(a.categoria);
    const ib = HISTORIAL_ORDEN.indexOf(b.categoria);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div>
      {encabezado}
      <div className="space-y-2">
        {grupos.map((g) => {
          const estaSemana = g.items.filter((h) => new Date(h.created_at) >= inicioSemana);
          const anteriores = g.items.filter((h) => new Date(h.created_at) < inicioSemana);
          const abierto = !!openCats[g.categoria];
          const verAnteriores = !!openAnteriores[g.categoria];
          return (
            <div key={g.categoria} className="border border-navy-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenCats((prev) => ({ ...prev, [g.categoria]: !prev[g.categoria] }))}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-navy-50 hover:bg-navy-100 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-600">
                  {abierto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                  {categoriaLabel(g.categoria)}
                </span>
                <span className="text-xs font-medium text-navy-400 shrink-0">
                  {g.items.length} cambio{g.items.length === 1 ? '' : 's'}
                </span>
              </button>
              {abierto && (
                <div className="p-3 border-t border-navy-100">
                  {estaSemana.length === 0 && anteriores.length > 0 && (
                    <p className="text-xs text-navy-400 italic mb-2">Sin cambios esta semana.</p>
                  )}
                  {estaSemana.length === 0 && anteriores.length === 0 && (
                    <p className="text-xs text-navy-400 italic">Sin cambios.</p>
                  )}
                  {estaSemana.length > 0 && (
                    <div className="space-y-3 mb-2">
                      {estaSemana.map((h) => <HistorialItem key={h.id} h={h} />)}
                    </div>
                  )}
                  {anteriores.length > 0 && (
                    <div>
                      <button
                        onClick={() => setOpenAnteriores((prev) => ({ ...prev, [g.categoria]: !prev[g.categoria] }))}
                        className="flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700"
                      >
                        {verAnteriores ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {verAnteriores ? 'Ocultar' : 'Ver'} {anteriores.length} cambio{anteriores.length === 1 ? '' : 's'} anterior{anteriores.length === 1 ? '' : 'es'}
                      </button>
                      {verAnteriores && (
                        <div className="space-y-3 mt-2">
                          {anteriores.map((h) => <HistorialItem key={h.id} h={h} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectDetail({ project, updateProject, onBack, onDelete, directorio, perfil, inversionistas, onAddInversionista, paises, onAddPais, proveedores, onAddProveedor }) {
  const [activeTab, setActiveTab] = useState(SCHEMA[0].id);
  const [editMode, setEditMode] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [baseSectionSnapshot, setBaseSectionSnapshot] = useState(null);
  const [saveConflict, setSaveConflict] = useState(null); // { seccionId, accion, nuevaSeccion, servidorActual } | null
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [historial, setHistorial] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingNombre, setEditingNombre] = useState(false);
  const [nombreDraft, setNombreDraft] = useState(project.nombre);
  const [editingDriveUrl, setEditingDriveUrl] = useState(false);
  const [driveUrlDraft, setDriveUrlDraft] = useState(project.data.general?.drive_url || '');
  const [showConfetti, setShowConfetti] = useState(false);
  /* Campo al que saltar tras pulsar un pendiente en Notas Técnicas. Estado de
     UI únicamente: no se persiste en projects.data. */
  const [focusFieldKey, setFocusFieldKey] = useState(null);

  const puedeGestionar = isLeader(perfil); // asignar equipo + cambiar estado + eliminar/renombrar proyecto
  const puedeEditarContenido = isDeveloper(perfil) || isAssignedToProject(perfil, project); // campos técnicos + archivos + notas
  const puedeComentar = isQA(perfil); // comentarios en Control Documental

  async function loadHistorial() {
    setLoadingHistorial(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error) setHistorial(data || []);
    setLoadingHistorial(false);
  }

  useEffect(() => {
    if (activeTab === 'historial' && historial === null) {
      loadHistorial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function startEdit() {
    setDraftData(JSON.parse(JSON.stringify(project.data)));
    setBaseSectionSnapshot(JSON.parse(JSON.stringify(project.data[activeSection.id])));
    setEditMode(true);
  }
  function cancelEdit() {
    setDraftData(null);
    setEditMode(false);
  }
  function confirmarGuardado(seccionId, nuevaSeccion, accion) {
    updateProject(
      project.id,
      (p) => ({ ...p, data: { ...p.data, [seccionId]: nuevaSeccion } }),
      accion,
      seccionId,
      () => supabase.rpc('merge_project_data_section', { p_id: project.id, p_section: seccionId, p_value: nuevaSeccion })
    );
    setEditMode(false);
    setDraftData(null);
    setSaveConflict(null);
    setHistorial(null);
  }
  function descartarYRecargar() {
    const { seccionId, servidorActual } = saveConflict;
    // Solo actualiza la vista local con lo que ya está guardado en el servidor
    // (no vuelve a escribir nada — por eso el "persist" no hace nada).
    updateProject(
      project.id,
      (p) => ({ ...p, data: { ...p.data, [seccionId]: servidorActual } }),
      undefined,
      undefined,
      () => Promise.resolve({ error: null })
    );
    setEditMode(false);
    setDraftData(null);
    setSaveConflict(null);
  }
  async function saveEdit() {
    const cambios = diffSectionData(activeSection, project.data[activeSection.id], draftData[activeSection.id]);
    if (cambios.length === 0) {
      // No se tocó nada: ni se guarda, ni se registra en el historial.
      setEditMode(false);
      setDraftData(null);
      return;
    }
    const accion = `Editó "${activeSection.label}" — ${cambios.join('; ')}`;
    const seccionId = activeSection.id;
    const nuevaSeccion = draftData[seccionId];

    // Antes de guardar, revisamos si alguien más cambió esta misma pestaña
    // mientras nosotros la teníamos abierta — así evitamos que un guardado
    // borre en silencio lo que la otra persona acaba de hacer.
    setCheckingConflict(true);
    const { data: freshRow, error } = await supabase.from('projects').select('data').eq('id', project.id).maybeSingle();
    setCheckingConflict(false);

    if (!error && freshRow) {
      const servidorActual = freshRow.data?.[seccionId];
      const cambioAjeno = JSON.stringify(servidorActual) !== JSON.stringify(baseSectionSnapshot);
      if (cambioAjeno) {
        setSaveConflict({ seccionId, accion, nuevaSeccion, servidorActual });
        return; // Esperamos a que la persona decida qué hacer.
      }
    }
    confirmarGuardado(seccionId, nuevaSeccion, accion);
  }
  function handleFieldChange(sectionId, fieldKey, value) {
    setDraftData((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], [fieldKey]: value } }));
  }
  /* Tipo de estructura de las Notas Técnicas. Vive namespaced dentro de
     project.data (regla 22) y se guarda con la misma función de guardado
     parcial que las pestañas, así que no pisa cambios de otra persona. */
  function saveTechnicalNotes(nuevaSeccion, accion) {
    updateProject(
      project.id,
      (p) => ({ ...p, data: { ...p.data, technicalNotes: nuevaSeccion } }),
      accion,
      'notas_tecnicas',
      () => supabase.rpc('merge_project_data_section', { p_id: project.id, p_section: 'technicalNotes', p_value: nuevaSeccion })
    );
    setHistorial(null);
  }
  function handleStructureTypeChange(structureType) {
    const anterior = project.data?.technicalNotes?.structureType || '—';
    saveTechnicalNotes(
      { ...(project.data?.technicalNotes || {}), structureType },
      `Notas técnicas — tipo de estructura: "${anterior}" → "${structureType || '—'}"`
    );
  }
  /* Override de un parámetro que no tiene campo en ninguna especialidad
     (ej. unidad de planos, productos de impermeabilización). Se registra el
     cambio del DATO en el historial; las notas no se registran porque se
     regeneran solas a partir de él. */
  function handleOverrideChange(categoryId, inputKey, valor) {
    const tn = project.data?.technicalNotes || {};
    const anterior = tn.overrides?.[categoryId]?.[inputKey] || '—';
    saveTechnicalNotes(
      {
        ...tn,
        overrides: {
          ...(tn.overrides || {}),
          [categoryId]: { ...(tn.overrides?.[categoryId] || {}), [inputKey]: valor },
        },
      },
      `Notas técnicas — ${inputKey}: "${anterior}" → "${valor || '—'}"`
    );
  }
  function handleEstadoChange(nuevoEstado) {
    const anterior = STATUS_CONFIG[project.estado]?.label || project.estado;
    const nuevo = STATUS_CONFIG[nuevoEstado]?.label || nuevoEstado;
    updateProject(
      project.id,
      (p) => ({ ...p, estado: nuevoEstado }),
      `Cambió el estado: ${anterior} → ${nuevo}`,
      'estado',
      () => supabase.from('projects').update({ estado: nuevoEstado }).eq('id', project.id)
    );
    setHistorial(null);
    if (nuevoEstado === 'finalizado') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2600);
    }
  }
  function saveNombre() {
    const nuevo = nombreDraft.trim();
    if (!nuevo || nuevo === project.nombre) {
      setNombreDraft(project.nombre);
      setEditingNombre(false);
      return;
    }
    updateProject(
      project.id,
      (p) => ({ ...p, nombre: nuevo }),
      `Cambió el nombre del proyecto: "${project.nombre}" → "${nuevo}"`,
      'nombre',
      () => supabase.from('projects').update({ nombre: nuevo }).eq('id', project.id)
    );
    setEditingNombre(false);
    setHistorial(null);
  }
  function saveDriveUrl() {
    const nuevo = driveUrlDraft.trim();
    const anterior = project.data.general?.drive_url || '';
    if (nuevo === anterior) {
      setEditingDriveUrl(false);
      return;
    }
    const nuevoGeneral = { ...project.data.general, drive_url: nuevo };
    updateProject(
      project.id,
      (p) => ({ ...p, data: { ...p.data, general: nuevoGeneral } }),
      nuevo ? 'Actualizó el link de la carpeta de Drive' : 'Quitó el link de la carpeta de Drive',
      'general',
      () => supabase.rpc('merge_project_data_section', { p_id: project.id, p_section: 'general', p_value: nuevoGeneral })
    );
    setEditingDriveUrl(false);
    setHistorial(null);
  }
  function handleEquipoChange(roleKey, nombre) {
    // No se registra en el historial: las asignaciones de equipo/rol
    // generaban demasiado ruido en la trazabilidad de cambios técnicos.
    updateProject(
      project.id,
      (p) => ({ ...p, equipo: { ...p.equipo, [roleKey]: nombre } }),
      undefined,
      undefined,
      () => supabase.rpc('merge_project_equipo_role', { p_id: project.id, p_role: roleKey, p_value: nombre })
    );
  }
  function handleAddNota(texto) {
    const nueva = { id: makeId('nota'), texto, autor: perfil.nombre, fecha: new Date().toISOString() };
    const resumen = texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
    updateProject(
      project.id,
      (p) => ({ ...p, notas: [...(p.notas || []), nueva] }),
      `Agregó una nota: "${resumen}"`,
      'notas',
      () => supabase.rpc('append_project_nota', { p_id: project.id, p_nota: nueva })
    );
    setHistorial(null);
  }
  function handleRemoveNota(notaId) {
    const nota = (project.notas || []).find((n) => n.id === notaId);
    const resumen = nota ? (nota.texto.length > 80 ? `${nota.texto.slice(0, 80)}…` : nota.texto) : null;
    updateProject(
      project.id,
      (p) => ({ ...p, notas: (p.notas || []).filter((n) => n.id !== notaId) }),
      resumen ? `Eliminó una nota: "${resumen}"` : 'Eliminó una nota',
      'notas',
      () => supabase.rpc('remove_project_nota', { p_id: project.id, p_nota_id: notaId })
    );
    setHistorial(null);
  }
  function handleDocChange(doc, patch) {
    const anterior = (project.documentos || {})[doc.codigo] || {};
    const nuevo = { ...anterior, ...patch };
    const accion = patch.estado !== undefined
      ? `Actualizó el estado de "${doc.nombre}" a "${patch.estado}"`
      : patch.comentarios !== undefined
        ? `Comentó (control de calidad) en "${doc.nombre}"`
        : `Agregó una observación en "${doc.nombre}"`;
    updateProject(
      project.id,
      (p) => ({ ...p, documentos: { ...(p.documentos || {}), [doc.codigo]: nuevo } }),
      accion,
      'documentos',
      () => supabase.rpc('merge_project_documento', { p_id: project.id, p_codigo: doc.codigo, p_patch: patch })
    );
    setHistorial(null);
  }

  const dataForRender = editMode ? draftData : project.data;
  const activeSection = SCHEMA.find((s) => s.id === activeTab);
  const general = project.data.general;

  return (
    <div className="max-w-6xl mx-auto">
      {showConfetti && <Confetti />}
      {saveConflict && (
        <div className="no-print fixed inset-0 bg-navy-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3 text-orange-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-base">Alguien más editó esto mientras tú también lo hacías</h3>
            </div>
            <p className="text-sm text-navy-600 mb-5">
              Otra persona guardó cambios en <strong>"{activeSection.label}"</strong> de este proyecto después de que empezaste a editar.
              Si guardas ahora, tus cambios reemplazarán los de esa persona en esta pestaña. Si prefieres, puedes ver primero lo que
              cambió y volver a hacer tus cambios después.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => confirmarGuardado(saveConflict.seccionId, saveConflict.nuevaSeccion, saveConflict.accion)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                Guardar mis cambios de todas formas
              </button>
              <button
                onClick={descartarYRecargar}
                className="w-full bg-navy-100 hover:bg-navy-200 text-navy-700 font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                Ver los cambios más recientes (perderé lo que edité)
              </button>
              <button onClick={() => setSaveConflict(null)} className="text-xs text-navy-400 hover:text-navy-600 mt-1">
                Cancelar y seguir editando
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="no-print p-4 md:p-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-700 mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al listado
        </button>

        <div className="bg-white border-2 border-navy-800 rounded-lg overflow-hidden mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 bg-navy-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-lime-400 shrink-0" />
              <p className="text-white font-bold text-sm tracking-wide">HOJA DE VIDA DEL PROYECTO</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {puedeGestionar ? (
                <select
                  value={project.estado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  className="text-xs font-semibold rounded-md border-0 py-1.5 pl-2 pr-6 bg-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-lime-400"
                >
                  <option value="activo">Activo</option>
                  <option value="pausa">En Pausa</option>
                  <option value="inactivo">Inactivo</option>
                <option value="finalizado">Finalizado</option>
                </select>
              ) : (
                <StatusBadge estado={project.estado} />
              )}
              {editingDriveUrl ? (
                <div className="flex items-center gap-1.5 bg-navy-700 rounded-md px-2 py-1">
                  <input
                    type="text"
                    autoFocus
                    value={driveUrlDraft}
                    onChange={(e) => setDriveUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveDriveUrl();
                      if (e.key === 'Escape') { setDriveUrlDraft(project.data.general?.drive_url || ''); setEditingDriveUrl(false); }
                    }}
                    placeholder="Pega el link de la carpeta de Drive…"
                    className="text-xs font-mono text-white bg-navy-800 border border-navy-600 rounded px-2 py-1 w-56 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                  <button onClick={saveDriveUrl} title="Guardar" className="text-emerald-400 hover:text-emerald-300 shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setDriveUrlDraft(project.data.general?.drive_url || ''); setEditingDriveUrl(false); }}
                    title="Cancelar"
                    className="text-navy-300 hover:text-white shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const url = project.data.general?.drive_url;
                      if (url) window.open(normalizeUrl(url), '_blank', 'noopener,noreferrer');
                    }}
                    disabled={!project.data.general?.drive_url}
                    title={project.data.general?.drive_url ? 'Abrir carpeta de Drive' : 'No hay link de Drive guardado'}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                      project.data.general?.drive_url
                        ? 'bg-nashville-500 hover:bg-nashville-600 text-white'
                        : 'bg-navy-700 text-navy-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" /> Carpeta
                  </button>
                  {puedeEditarContenido && (
                    <button
                      onClick={() => { setDriveUrlDraft(project.data.general?.drive_url || ''); setEditingDriveUrl(true); }}
                      title="Editar link de Drive"
                      className="text-navy-300 hover:text-white p-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 text-xs font-bold px-3 py-1.5 rounded-md transition-colors">
                <Printer className="w-3.5 h-3.5" /> Exportar / Imprimir
              </button>
              {puedeGestionar && (
                confirmingDelete ? (
                  <div className="flex items-center gap-1.5 bg-navy-700 rounded-md px-2 py-1">
                    <span className="text-xs text-white whitespace-nowrap">¿Eliminar proyecto?</span>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md transition-colors"
                    >
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmingDelete(false)} className="text-xs text-navy-300 hover:text-white px-1.5">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    title="Eliminar proyecto"
                    className="flex items-center gap-1.5 text-navy-300 hover:text-red-400 hover:bg-navy-700 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-navy-200">
            {puedeGestionar ? (
              <div className="px-4 py-2.5 col-span-2">
                <p className="text-xs uppercase tracking-wide text-navy-400 font-semibold">Proyecto</p>
                {editingNombre ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      autoFocus
                      value={nombreDraft}
                      onChange={(e) => setNombreDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveNombre();
                        if (e.key === 'Escape') { setNombreDraft(project.nombre); setEditingNombre(false); }
                      }}
                      className="text-sm font-mono text-navy-700 border border-navy-300 rounded-md px-2 py-1 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-lime-400"
                    />
                    <button onClick={saveNombre} title="Guardar" className="text-emerald-600 hover:text-emerald-700 shrink-0">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setNombreDraft(project.nombre); setEditingNombre(false); }} title="Cancelar" className="text-navy-400 hover:text-navy-600 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5 group">
                    <p className="text-sm font-mono text-navy-700 truncate">{projectDisplayName(project)}</p>
                    <button
                      onClick={() => { setNombreDraft(project.nombre); setEditingNombre(true); }}
                      title="Cambiar nombre del proyecto"
                      className="text-navy-300 hover:text-lime-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <TitleCell label="Proyecto" value={projectDisplayName(project)} span={2} />
            )}
            <TitleCell label="Ubicación" value={`${general.municipio || 'N/A'}, ${general.departamento || 'N/A'}`} />
            <TitleCell label="Estado" custom={<StatusBadge estado={project.estado} />} />
            <TitleCell label="Inversionista" value={general.inversionista} />
            <TitleCell label="Fecha de Inicio" value={formatDate(general.fecha_inicio)} />
            <TitleCell label="Fecha de Entrega" value={formatDate(general.fecha_entrega)} />
            <TitleCell label="Elaboró" value={equipoTexto(project.equipo.civil)} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-navy-200 p-5 mb-6">
          <p className="flex items-center justify-between text-sm font-bold text-navy-700 mb-4">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-lime-500" /> Equipo Asignado
            </span>
            {!puedeGestionar && (
              <span className="flex items-center gap-1 text-xs font-normal text-navy-400">
                <Lock className="w-3.5 h-3.5" /> Solo un líder puede editar esto
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ROLES.map((role) => {
              const RoleIcon = role.icon;
              return (
                <div key={role.key} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0 mt-0.5">
                    <RoleIcon className="w-4 h-4 text-navy-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-navy-400 mb-0.5">{role.label}</p>
                    <EquipoField
                      role={role}
                      valor={project.equipo[role.key]}
                      directorio={directorio}
                      onChange={(val) => handleEquipoChange(role.key, val)}
                      readOnly={!puedeGestionar}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="flex items-center border-b border-navy-200 overflow-x-auto">
            {SCHEMA.map((section) => {
              const SIcon = section.icon;
              const active = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
                  }`}
                >
                  <SIcon className="w-4 h-4" /> {section.label}
                </button>
              );
            })}
            <button
              onClick={() => setActiveTab('documentos')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'documentos' ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" /> Control Documental
            </button>
            <button
              onClick={() => setActiveTab('notas_tecnicas')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'notas_tecnicas' ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <FileText className="w-4 h-4" /> Notas Técnicas
            </button>
            <button
              onClick={() => setActiveTab('notas')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'notas' ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <StickyNote className="w-4 h-4" /> Notas {project.notas && project.notas.length > 0 && `(${project.notas.length})`}
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'historial' ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <History className="w-4 h-4" /> Historial
            </button>
          </div>

          <div className="p-6">
            {activeTab !== 'historial' && activeTab !== 'documentos' && activeTab !== 'notas' && activeTab !== 'notas_tecnicas' && activeSection && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-navy-400">Campos de la especialidad · {activeSection.label}</p>
                  {!puedeEditarContenido ? (
                    <span className="flex items-center gap-1.5 text-xs text-navy-400">
                      <Lock className="w-3.5 h-3.5" /> Solo el equipo asignado puede editar
                    </span>
                  ) : !editMode ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700">
                      <Pencil className="w-3.5 h-3.5" /> Editar campos
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={cancelEdit} className="flex items-center gap-1.5 text-xs font-semibold text-navy-500 hover:text-navy-700">
                        <XCircle className="w-3.5 h-3.5" /> Cancelar
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={checkingConflict}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-1.5 rounded-md"
                      >
                        <Save className="w-3.5 h-3.5" /> {checkingConflict ? 'Verificando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </div>
                <SectionFieldsGrid
                  section={activeSection}
                  data={dataForRender[activeSection.id]}
                  editMode={editMode}
                  onFieldChange={handleFieldChange}
                  inversionistas={inversionistas}
                  onAddInversionista={onAddInversionista}
                  paises={paises}
                  onAddPais={onAddPais}
                  proveedores={proveedores}
                  onAddProveedor={onAddProveedor}
                  structureType={getStructureType(project)}
                  focusFieldKey={focusFieldKey}
                  onFocusHandled={() => setFocusFieldKey(null)}
                />
              </>
            )}
            {activeTab === 'documentos' && (
              <DocumentControlPanel
                project={project}
                puedeEditarContenido={puedeEditarContenido}
                puedeComentar={puedeComentar}
                onDocChange={handleDocChange}
              />
            )}
            {activeTab === 'notas_tecnicas' && (
              <TechnicalNotesPanel
                project={project}
                puedeEditar={puedeEditarContenido}
                onNavigateToField={(tab, fieldKey) => { setActiveTab(tab); setFocusFieldKey(fieldKey || null); }}
                onStructureTypeChange={handleStructureTypeChange}
                onOverrideChange={handleOverrideChange}
              />
            )}
            {activeTab === 'notas' && (
              <NotesPanel notas={project.notas} onAdd={handleAddNota} onRemove={handleRemoveNota} canEdit={puedeEditarContenido} />
            )}
            {activeTab === 'historial' && (
              <HistorialPanel historial={historial} loading={loadingHistorial} onRefresh={loadHistorial} />
            )}
          </div>
        </div>
      </div>

      <PrintableReport project={project} />
    </div>
  );
}

function LinksView({ links, onAdd, onUpdate, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ descripcion: '', url: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ descripcion: '', url: '' });

  function submitNew(e) {
    e.preventDefault();
    if (!form.descripcion.trim() || !form.url.trim()) return;
    onAdd({ id: makeId('link'), descripcion: form.descripcion, url: form.url });
    setForm({ descripcion: '', url: '' });
    setShowForm(false);
  }
  function startEdit(link) {
    setEditingId(link.id);
    setEditForm({ descripcion: link.descripcion, url: link.url });
  }
  function saveEdit(id) {
    if (!editForm.descripcion.trim() || !editForm.url.trim()) return;
    onUpdate(id, editForm);
    setEditingId(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Enlaces de Interés</h1>
          <p className="text-navy-500 text-sm mt-1">Recursos y herramientas de consulta para el equipo de diseño</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm">
          <Plus className="w-4 h-4" /> Agregar Enlace
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitNew} className="bg-white border border-navy-200 rounded-xl p-5 mb-8 space-y-3">
          <input
            required
            placeholder="Descripción del recurso"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-navy-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-navy-800 text-white rounded-lg">Guardar Enlace</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {links.map((link) =>
          editingId === link.id ? (
            <div key={link.id} className="bg-white border border-lime-300 rounded-xl p-4 space-y-2">
              <input
                value={editForm.descripcion}
                onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))}
                className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
                placeholder="Descripción"
              />
              <input
                value={editForm.url}
                onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
                placeholder="https://…"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs font-medium text-navy-500">Cancelar</button>
                <button onClick={() => saveEdit(link.id)} className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Guardar</button>
              </div>
            </div>
          ) : (
            <div key={link.id} className="flex items-start justify-between bg-white border border-navy-200 rounded-xl p-4 hover:border-nashville-300 transition-colors">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 min-w-0 flex-1 group">
                <div className="w-8 h-8 rounded-lg bg-nashville-50 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-nashville-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-700 group-hover:text-nashville-600">{link.descripcion}</p>
                  <p className="text-xs text-navy-400 truncate">{link.url}</p>
                </div>
              </a>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button onClick={() => startEdit(link)} className="text-navy-300 hover:text-lime-500 p-1">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onRemove(link.id)} className="text-navy-300 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        )}
        {links.length === 0 && <p className="text-sm text-navy-400 italic text-center py-8">Aún no hay enlaces guardados.</p>}
      </div>
    </div>
  );
}

/* ============================================================================
   INSTRUCTIVOS (videos de YouTube organizados en carpetas)
   ============================================================================ */
function VideoCard({ video, abierto, onToggle, onEdit, onDelete }) {
  const [confirmando, setConfirmando] = useState(false);
  const videoId = extractYouTubeId(video.url);

  return (
    <div className="border border-navy-200 rounded-lg overflow-hidden bg-white">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-navy-50 transition-colors">
        {videoId ? (
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            className="w-24 h-14 object-cover rounded-md shrink-0 bg-navy-100"
          />
        ) : (
          <div className="w-24 h-14 rounded-md bg-navy-100 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-navy-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-700 truncate">{video.titulo}</p>
          {video.descripcion && <p className="text-xs text-navy-400 truncate">{video.descripcion}</p>}
        </div>
        <PlayCircle className="w-5 h-5 text-lime-500 shrink-0" />
      </button>
      {abierto && (
        <div className="border-t border-navy-200">
          {videoId ? (
            <div className="aspect-video bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={video.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-red-500 p-3">No se pudo reconocer el link de YouTube de este video.</p>
          )}
          <div className="flex items-center justify-end gap-3 px-3 py-2 bg-navy-50">
            <button onClick={onEdit} className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-lime-600">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {confirmando ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-navy-500">¿Eliminar?</span>
                <button onClick={() => { onDelete(); setConfirmando(false); }} className="text-xs font-bold text-red-600 hover:text-red-700">
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmando(false)} className="text-xs text-navy-400 hover:text-navy-600">
                  Cancelar
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmando(true)} className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FolderFormModal({ initial, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim());
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy-800">{initial ? 'Renombrar carpeta' : 'Nueva carpeta'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            autoFocus
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Diseño Eléctrico"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-navy-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoFormModal({ initial, carpetas, onClose, onSave }) {
  const [titulo, setTitulo] = useState(initial?.titulo || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion || '');
  const [carpetaId, setCarpetaId] = useState(initial?.carpeta_id || '');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;
    if (!extractYouTubeId(url)) {
      setError('No se reconoce ese link como un video de YouTube válido.');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      url: url.trim(),
      descripcion: descripcion.trim() || null,
      carpeta_id: carpetaId || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-50 overflow-y-auto flex items-start justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy-800">{initial ? 'Editar video' : 'Nuevo video'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Título *</label>
            <input
              required
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="Ej. Cómo calcular la zona de viento"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Link de YouTube *</label>
            <input
              required
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="https://youtu.be/… o https://www.youtube.com/watch?v=…"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Descripción (opcional)</label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Carpeta</label>
            <select value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm">
              <option value="">Sin carpeta</option>
              {carpetas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-navy-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstructivosView({ carpetas, videos, onAddCarpeta, onUpdateCarpeta, onDeleteCarpeta, onAddVideo, onUpdateVideo, onDeleteVideo }) {
  const [openFolders, setOpenFolders] = useState({});
  const [openVideoId, setOpenVideoId] = useState(null);
  const [folderModal, setFolderModal] = useState(null); // null | 'new' | {id, nombre}
  const [videoModal, setVideoModal] = useState(null); // null | 'new' | video
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);

  function toggleFolder(id) {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleVideo(id) {
    setOpenVideoId((prev) => (prev === id ? null : id));
  }

  const sinCarpeta = videos.filter((v) => !v.carpeta_id);
  const gruposCarpeta = carpetas.map((c) => ({ carpeta: c, videos: videos.filter((v) => v.carpeta_id === c.id) }));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Instructivos</h1>
          <p className="text-navy-500 text-sm mt-1">Videos explicando procesos de la etapa de diseño, organizados en carpetas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFolderModal('new')}
            className="flex items-center gap-2 bg-white border border-navy-300 hover:border-lime-400 text-navy-700 font-semibold text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <FolderPlus className="w-4 h-4" /> Nueva carpeta
          </button>
          <button
            onClick={() => setVideoModal('new')}
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-3 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo video
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {gruposCarpeta.map(({ carpeta, videos: videosCarpeta }) => (
          <div key={carpeta.id} className="bg-white border border-navy-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-navy-50 border-b border-navy-200">
              <button onClick={() => toggleFolder(carpeta.id)} className="flex items-center gap-2 text-sm font-bold text-navy-700 flex-1 text-left min-w-0">
                {openFolders[carpeta.id] ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <Folder className="w-4 h-4 text-nashville-500 shrink-0" />
                <span className="truncate">{carpeta.nombre}</span>
                <span className="text-xs font-normal text-navy-400 shrink-0">({videosCarpeta.length})</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setFolderModal(carpeta)} title="Renombrar carpeta" className="text-navy-400 hover:text-lime-600 p-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {confirmDeleteFolder === carpeta.id ? (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-xs text-navy-500 whitespace-nowrap">¿Eliminar carpeta y sus {videosCarpeta.length} video(s)?</span>
                    <button
                      onClick={() => { onDeleteCarpeta(carpeta.id); setConfirmDeleteFolder(null); }}
                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md whitespace-nowrap"
                    >
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmDeleteFolder(null)} className="text-xs text-navy-400 hover:text-navy-600 px-1">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteFolder(carpeta.id)} title="Eliminar carpeta" className="text-navy-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {openFolders[carpeta.id] && (
              <div className="p-3 space-y-2">
                {videosCarpeta.length === 0 ? (
                  <p className="text-sm text-navy-400 italic text-center py-4">Esta carpeta no tiene videos todavía.</p>
                ) : (
                  videosCarpeta.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      abierto={openVideoId === v.id}
                      onToggle={() => toggleVideo(v.id)}
                      onEdit={() => setVideoModal(v)}
                      onDelete={() => onDeleteVideo(v.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        <div className="bg-white border border-navy-200 rounded-xl overflow-hidden">
          <div className="flex items-center px-4 py-3 bg-navy-50 border-b border-navy-200">
            <p className="flex items-center gap-2 text-sm font-bold text-navy-700 flex-1">
              <Folder className="w-4 h-4 text-navy-400" /> Sin carpeta <span className="text-xs font-normal text-navy-400">({sinCarpeta.length})</span>
            </p>
          </div>
          <div className="p-3 space-y-2">
            {sinCarpeta.length === 0 ? (
              <p className="text-sm text-navy-400 italic text-center py-4">No hay videos sueltos.</p>
            ) : (
              sinCarpeta.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  abierto={openVideoId === v.id}
                  onToggle={() => toggleVideo(v.id)}
                  onEdit={() => setVideoModal(v)}
                  onDelete={() => onDeleteVideo(v.id)}
                />
              ))
            )}
          </div>
        </div>

        {carpetas.length === 0 && videos.length === 0 && (
          <p className="text-sm text-navy-400 italic text-center py-12">
            Aún no hay instructivos. Crea una carpeta o agrega tu primer video.
          </p>
        )}
      </div>

      {folderModal && (
        <FolderFormModal
          initial={folderModal === 'new' ? null : folderModal}
          onClose={() => setFolderModal(null)}
          onSave={(nombre) => {
            if (folderModal === 'new') onAddCarpeta(nombre);
            else onUpdateCarpeta(folderModal.id, nombre);
            setFolderModal(null);
          }}
        />
      )}

      {videoModal && (
        <VideoFormModal
          initial={videoModal === 'new' ? null : videoModal}
          carpetas={carpetas}
          onClose={() => setVideoModal(null)}
          onSave={(data) => {
            if (videoModal === 'new') onAddVideo(data);
            else onUpdateVideo(videoModal.id, data);
            setVideoModal(null);
          }}
        />
      )}
    </div>
  );
}

/* Insignias de rol con toggle, reutilizadas dentro de la ficha de cada       */
/* persona (antes vivían inline en la lista de Equipo).                      */
function RoleBadgesEditor({ persona, perfil, onToggleRole }) {
  const [pending, setPending] = useState(null);

  async function handleToggle(roleKey, tieneRol) {
    setPending(roleKey);
    await onToggleRole(persona.id, roleKey, tieneRol);
    setPending(null);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLE_DEFS.map((role) => {
        const tieneRol = persona.roles.includes(role.key);
        const cargando = pending === role.key;
        const puedeAsignarEste = canAssignRole(perfil, role.key);
        const RoleIcon = role.icon;
        return (
          <button
            key={role.key}
            disabled={!puedeAsignarEste || cargando}
            title={!puedeAsignarEste ? 'Solo el Líder de Diseño (o un Desarrollador) puede asignar este rol' : undefined}
            onClick={() => handleToggle(role.key, tieneRol)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
              tieneRol ? 'bg-lime-100 text-lime-800 border-lime-300' : 'bg-navy-50 text-navy-400 border-navy-200'
            } ${puedeAsignarEste ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} ${cargando ? 'opacity-50' : ''}`}
          >
            <RoleIcon className="w-3 h-3" />
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

/* Ficha de una persona: roles (editables por quien tenga permiso), datos de  */
/* cumpleaños/ingreso, y los proyectos donde está asignada con un resumen    */
/* de Control Documental de cada uno (clic para ir directo al proyecto).    */
function PersonProfileView({ persona, perfil, projects, onBack, onToggleRole, onDeleteUser, onUpdatePersonaInfo, onOpenProject }) {
  const soyLiderDiseno = isDesignLeader(perfil);
  const puedeEditarFechas = soyLiderDiseno || persona.id === perfil.id;
  const [editingFechas, setEditingFechas] = useState(false);
  const [cumpleDraft, setCumpleDraft] = useState(persona.fecha_cumpleanos || '');
  const [ingresoDraft, setIngresoDraft] = useState(persona.fecha_ingreso || '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function guardarFechas() {
    onUpdatePersonaInfo(persona.id, { fecha_cumpleanos: cumpleDraft || null, fecha_ingreso: ingresoDraft || null });
    setEditingFechas(false);
  }

  async function confirmarEliminar() {
    setDeleting(true);
    await onDeleteUser(persona.id);
    setDeleting(false);
    onBack();
  }

  const proyectosAsignados = projects.filter((p) => equipoNombres(p.equipo).includes(persona.nombre));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Volver a Equipo
      </button>

      <div className="bg-white border border-navy-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar name={persona.nombre} foto={persona.foto} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-navy-800">{persona.nombre}{persona.id === perfil.id ? ' (tú)' : ''}</h1>
              <p className="text-sm text-navy-500">{rolesLabel(persona)}</p>
            </div>
          </div>
          {soyLiderDiseno && persona.id !== perfil.id && (
            confirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-navy-50 border border-navy-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-navy-600 whitespace-nowrap">¿Eliminar la cuenta de {persona.nombre.split(' ')[0]}?</span>
                <button
                  onClick={confirmarEliminar}
                  disabled={deleting}
                  className="text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded-md transition-colors"
                >
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmingDelete(false)} className="text-xs text-navy-400 hover:text-navy-600 px-1.5">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar cuenta
              </button>
            )
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-navy-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">Fecha de cumpleaños</p>
            {editingFechas ? (
              <input type="date" value={cumpleDraft} onChange={(e) => setCumpleDraft(e.target.value)} className="rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm" />
            ) : (
              <p className={persona.fecha_cumpleanos ? 'text-sm text-navy-700' : 'text-sm text-navy-300 italic'}>
                {persona.fecha_cumpleanos ? formatDate(persona.fecha_cumpleanos) : 'Sin definir'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">Fecha de ingreso</p>
            {editingFechas ? (
              <input type="date" value={ingresoDraft} onChange={(e) => setIngresoDraft(e.target.value)} className="rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm" />
            ) : (
              <p className={persona.fecha_ingreso ? 'text-sm text-navy-700' : 'text-sm text-navy-300 italic'}>
                {persona.fecha_ingreso ? formatDate(persona.fecha_ingreso) : 'Sin definir'}
              </p>
            )}
          </div>
          {puedeEditarFechas && (
            <div className="sm:col-span-2 flex gap-2">
              {editingFechas ? (
                <>
                  <button onClick={guardarFechas} className="flex items-center gap-1.5 text-xs font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 px-3 py-1.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Guardar
                  </button>
                  <button
                    onClick={() => { setCumpleDraft(persona.fecha_cumpleanos || ''); setIngresoDraft(persona.fecha_ingreso || ''); setEditingFechas(false); }}
                    className="text-xs text-navy-400 hover:text-navy-600 px-2 py-1.5"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingFechas(true)} className="flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700">
                  <Pencil className="w-3.5 h-3.5" /> Editar fechas
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-6 mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Roles</p>
        <RoleBadgesEditor persona={persona} perfil={perfil} onToggleRole={onToggleRole} />
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
          Proyectos asignados <span className="font-normal text-navy-400">({proyectosAsignados.length})</span>
        </p>
        {proyectosAsignados.length === 0 ? (
          <p className="text-sm text-navy-400 italic">No está asignado(a) a ningún proyecto todavía.</p>
        ) : (
          <div className="space-y-3">
            {proyectosAsignados.map((p) => {
              const { conteoPorEstado, total } = computeProjectDocProgress(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenProject(p.id)}
                  className="w-full flex items-center gap-4 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-lg p-3 text-left transition-colors"
                >
                  <ProgresoDonut conteoPorEstado={conteoPorEstado} total={total} compact />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-800 truncate">{projectDisplayName(p)}</p>
                    <p className="text-xs text-navy-400">{p.data.general.municipio}, {p.data.general.departamento}</p>
                    <StatusBadge estado={p.estado} size="sm" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-navy-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* Lista de Equipo agrupada en 5 categorías fijas — una persona puede         */
/* aparecer en varias si tiene varios roles. Clic en una persona → su ficha. */
function TeamCategoriesView({ directorio, perfil, onOpenPerson }) {
  const soyLider = isLeader(perfil);
  const soyLiderDiseno = isDesignLeader(perfil);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-800">Equipo</h1>
        <p className="text-navy-500 text-sm mt-1">
          {soyLider
            ? 'Como líder, puedes otorgar o quitar roles técnicos desde la ficha de cada persona. Solo el Líder de Diseño puede otorgar roles de líder o de Desarrollador.'
            : 'Haz clic en una persona para ver su ficha.'}
          {soyLiderDiseno && ' También puedes eliminar cuentas y editar fecha de cumpleaños/ingreso de cualquiera.'}
        </p>
      </div>

      <div className="space-y-8">
        {(() => {
          const sinRol = directorio.filter((u) => !EQUIPO_CATEGORIAS.some((cat) => u.roles.some((r) => cat.roles.includes(r))));
          if (sinRol.length === 0) return null;
          return (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-orange-600">Sin rol asignado</h2>
                <span className="text-xs text-navy-400">({sinRol.length})</span>
              </div>
              <p className="text-xs text-navy-400 mb-2">Personas que crearon su cuenta pero todavía no tienen ningún rol — haz clic para asignarles uno.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sinRol.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => onOpenPerson(u.id)}
                    className="flex items-center gap-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-3 text-left transition-colors"
                  >
                    <Avatar name={u.nombre} foto={u.foto} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy-800 truncate text-sm">{u.nombre}{u.id === perfil.id ? ' (tú)' : ''}</p>
                      <p className="text-xs text-orange-600 truncate">Sin rol — pendiente de asignar</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-navy-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        {EQUIPO_CATEGORIAS.map((cat) => {
          const personas = directorio.filter((u) => u.roles.some((r) => cat.roles.includes(r)));
          const CatIcon = cat.icon;
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-3">
                <CatIcon className="w-4 h-4 text-navy-500" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-600">{cat.label}</h2>
                <span className="text-xs text-navy-400">({personas.length})</span>
              </div>
              {personas.length === 0 ? (
                <p className="text-sm text-navy-300 italic mb-2">Nadie en esta categoría todavía.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {personas.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => onOpenPerson(u.id)}
                      className="flex items-center gap-3 bg-white hover:bg-navy-50 border border-navy-200 rounded-lg p-3 text-left transition-colors"
                    >
                      <Avatar name={u.nombre} foto={u.foto} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-800 truncate text-sm">{u.nombre}{u.id === perfil.id ? ' (tú)' : ''}</p>
                        <p className="text-xs text-navy-400 truncate">{rolesLabel(u)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-navy-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Envoltorio de la pestaña "Equipo": decide si mostrar la lista por          */
/* categorías o la ficha de una persona en particular.                      */
function EquipoView({ directorio, perfil, projects, selectedPersonId, onOpenPerson, onBackToList, onToggleRole, onDeleteUser, onUpdatePersonaInfo, onOpenProject }) {
  const persona = selectedPersonId ? directorio.find((u) => u.id === selectedPersonId) : null;
  if (persona) {
    return (
      <PersonProfileView
        persona={persona}
        perfil={perfil}
        projects={projects}
        onBack={onBackToList}
        onToggleRole={onToggleRole}
        onDeleteUser={onDeleteUser}
        onUpdatePersonaInfo={onUpdatePersonaInfo}
        onOpenProject={onOpenProject}
      />
    );
  }
  return <TeamCategoriesView directorio={directorio} perfil={perfil} onOpenPerson={onOpenPerson} />;
}

/* ============================================================================
   9. COMPONENTE RAÍZ
   ============================================================================ */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = verificando, null = sin sesión
  const [perfil, setPerfil] = useState(null);
  const [checkingPerfil, setCheckingPerfil] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  const [projects, setProjects] = useState([]);
  const [links, setLinks] = useState([]);
  const [directorio, setDirectorio] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [videos, setVideos] = useState([]);
  const [inversionistas, setInversionistas] = useState([]);
  const [paises, setPaises] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [plantillasCimentacion, setPlantillasCimentacion] = useState([]);
  const [mallas, setMallas] = useState([]);
  const [parametrosIngenieria, setParametrosIngenieria] = useState({ recubrimiento: RECUBRIMIENTO_CIMENTACION, barras: BARRA_ACERO, traslapos: TRASLAPO_TABLE });
  const [dataLoaded, setDataLoaded] = useState(false);

  const [view, setViewState] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');

  // Conecta el botón "atrás" del navegador con la navegación de la app: en
  // vez de salir de la página, vuelve a la vista anterior (Dashboard, Mis
  // Proyectos, un proyecto abierto, etc.) — igual que esperaría cualquiera
  // que use las flechas del navegador en cualquier otra página.
  useEffect(() => {
    window.history.replaceState({ view: 'dashboard' }, '');
    function onPopState(e) {
      if (e.state && e.state.view) {
        setViewState(e.state.view);
        setSelectedId(e.state.selectedId || null);
        setSelectedPersonId(e.state.selectedPersonId || null);
      } else {
        setViewState('dashboard');
        setSelectedId(null);
        setSelectedPersonId(null);
      }
      setSidebarOpen(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Sesión de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Perfil del usuario logueado + datos compartidos (proyectos, enlaces, equipo)
  // OJO: se dispara solo cuando cambia el ID de usuario (login/logout/cambio de
  // cuenta), NO cada vez que Supabase refresca el token de sesión (esto pasa
  // automáticamente, entre otras cosas, al volver a la pestaña del navegador).
  // Antes esto recargaba toda la app y borraba cualquier formulario abierto.
  useEffect(() => {
    if (!session) {
      setPerfil(null);
      return;
    }
    let cancelled = false;
    setCheckingPerfil(true);
    (async () => {
      const { data: ownRow } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      if (!ownRow) {
        setPerfil(null);
        setCheckingPerfil(false);
        return;
      }
      setCheckingPerfil(false);
      await loadSharedData(session.user.id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadSharedData(ownUserId) {
    const { data: projRows } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
    if (!projRows || projRows.length === 0) {
      await supabase.from('projects').insert(INITIAL_PROJECTS.map(projectToRow));
      setProjects(INITIAL_PROJECTS);
    } else {
      setProjects(projRows.map(rowToProject));
    }

    const { data: linkRows } = await supabase.from('links').select('*').order('created_at', { ascending: true });
    if (!linkRows || linkRows.length === 0) {
      await supabase.from('links').insert(INITIAL_LINKS);
      setLinks(INITIAL_LINKS);
    } else {
      setLinks(linkRows);
    }

    const [{ data: profileRows }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    const rolesByUser = new Map();
    (roleRows || []).forEach((r) => {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
      rolesByUser.get(r.user_id).push(r.role_key);
    });
    const merged = (profileRows || []).map((row) => rowToProfile(row, rolesByUser.get(row.id) || []));
    setDirectorio(merged);
    if (ownUserId) {
      const yo = merged.find((u) => u.id === ownUserId);
      if (yo) setPerfil(yo);
    }

    const { data: carpetaRows } = await supabase.from('instructivo_carpetas').select('*').order('created_at', { ascending: true });
    setCarpetas(carpetaRows || []);
    const { data: videoRows } = await supabase.from('instructivo_videos').select('*').order('created_at', { ascending: true });
    setVideos(videoRows || []);

    const { data: invRows } = await supabase.from('inversionistas').select('*').order('created_at', { ascending: true });
    if (!invRows || invRows.length === 0) {
      const semilla = ['FENOGE', 'CFM', 'FMO', 'Bancolombia'];
      await supabase.from('inversionistas').insert(semilla.map((nombre) => ({ nombre }))).then(({ error }) => {
        if (error) console.error('Error creando inversionistas semilla:', error);
      });
      setInversionistas(semilla);
    } else {
      setInversionistas(invRows.map((r) => r.nombre));
    }

    const { data: paisRows } = await supabase.from('paises').select('*').order('created_at', { ascending: true });
    if (!paisRows || paisRows.length === 0) {
      await supabase.from('paises').insert({ nombre: 'Colombia' }).then(({ error }) => {
        if (error) console.error('Error creando país semilla:', error);
      });
      setPaises(['Colombia']);
    } else {
      setPaises(paisRows.map((r) => r.nombre));
    }

    const { data: provRows } = await supabase.from('proveedores').select('*').order('created_at', { ascending: true });
    if (!provRows || provRows.length === 0) {
      const semillaProv = ['Zentrack', 'TRINA', 'Antai'];
      await supabase.from('proveedores').insert(semillaProv.map((nombre) => ({ nombre }))).then(({ error }) => {
        if (error) console.error('Error creando proveedores semilla:', error);
      });
      setProveedores(semillaProv);
    } else {
      setProveedores(provRows.map((r) => r.nombre));
    }

    const { data: plantillaRows } = await supabase.from('cimentacion_plantillas').select('*').order('created_at', { ascending: true });
    setPlantillasCimentacion((plantillaRows || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, datos: r.datos || {} })));

    const { data: mallaRows } = await supabase.from('mallas').select('*').order('created_at', { ascending: true });
    if (!mallaRows || mallaRows.length === 0) {
      await supabase.from('mallas').insert({ nombre: 'D84' }).then(({ error }) => {
        if (error) console.error('Error creando malla semilla:', error);
      });
      setMallas(['D84']);
    } else {
      setMallas(mallaRows.map((r) => r.nombre));
    }

    // Si la tabla aún no existe (falta correr la migración), seguimos con
    // los valores por defecto que ya trae el código — sin tronar la carga.
    try {
      const { data: paramRow, error: paramError } = await supabase.from('parametros_ingenieria').select('*').eq('id', 'global').maybeSingle();
      if (!paramError && paramRow?.datos) {
        aplicarParametrosIngenieria(paramRow.datos);
        setParametrosIngenieria({
          recubrimiento: RECUBRIMIENTO_CIMENTACION,
          barras: { ...BARRA_ACERO },
          traslapos: { ...TRASLAPO_TABLE },
        });
      }
    } catch (e) {
      console.error('No se pudieron cargar los parámetros de ingeniería (¿falta correr la migración?):', e);
    }

    setDataLoaded(true);
  }

  function setView(v) {
    setViewState(v);
    setSelectedId(null);
    setSelectedPersonId(null);
    setSidebarOpen(false);
    window.history.pushState({ view: v }, '');
  }
  function openProject(id) {
    setPreviousView(view === 'detalle' ? previousView : view);
    setSelectedId(id);
    setSelectedPersonId(null);
    setViewState('detalle');
    setSidebarOpen(false);
    window.history.pushState({ view: 'detalle', selectedId: id }, '');
  }
  function goBack() {
    // Deja que el navegador retroceda de verdad — el listener de popstate
    // ya se encarga de actualizar la vista a partir de ahí, así el botón
    // "atrás" del navegador y este botón "volver" quedan sincronizados.
    window.history.back();
  }

  async function logActivity(projectId, accion, categoria) {
    if (!accion) return;
    try {
      const { error } = await supabase.from('activity_log').insert({
        project_id: projectId,
        usuario_id: perfil?.id || null,
        usuario_nombre: perfil?.nombre || 'Desconocido',
        accion,
        categoria: categoria || 'general',
      });
      if (error) console.error('Error registrando historial:', error);
    } catch (e) {
      console.error('Error registrando historial:', e);
    }
  }

  // "persist" es opcional: si se da, se usa para guardar SOLO lo que cambió
  // (una columna puntual, o un merge parcial vía función de Postgres) en vez
  // de sobrescribir la fila completa — así dos personas editando cosas
  // distintas del mismo proyecto al mismo tiempo no se borran los cambios.
  // Si no se da (casos que ya son de una sola columna simple), se usa el
  // guardado de fila completa de siempre.
  function updateProject(id, updater, accion, categoria, persist) {
    let updatedProject = null;
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? updater(p) : p));
      updatedProject = next.find((p) => p.id === id);
      return next;
    });
    // OJO: supabase.rpc(...) y supabase.from(...).update(...) NO rechazan la
    // promesa cuando hay un error de base de datos (ej. función inexistente
    // o RLS que lo bloquea) — resuelven con { error }. Por eso revisamos
    // "res.error" explícitamente y avisamos, en vez de confiar solo en
    // .catch() (que solo agarra fallas de red/conexión). Sin esto, un
    // guardado podía fallar en completo silencio y solo se notaba al
    // refrescar la página y ver que el cambio no quedó.
    function avisarErrorGuardado(error) {
      console.error('Error guardando proyecto:', error);
      alert(
        'No se pudo guardar este cambio en el servidor (tu vista en pantalla sí lo muestra, pero no quedó guardado).\n\n' +
        'Vuelve a intentarlo. Si el problema sigue, dile al desarrollador que revise que las funciones de guardado parcial ' +
        '(supabase/migration_guardado_parcial.sql) estén creadas en Supabase.\n\n' +
        'Detalle técnico: ' + (error?.message || String(error))
      );
    }
    if (persist) {
      persist().then((res) => {
        if (res && res.error) avisarErrorGuardado(res.error);
      }).catch(avisarErrorGuardado);
    } else if (updatedProject) {
      supabase.from('projects').update(projectToRow(updatedProject)).eq('id', id).then(({ error }) => {
        if (error) avisarErrorGuardado(error);
      });
    }
    logActivity(id, accion, categoria);
  }
  function handleCreate(newProject) {
    setProjects((prev) => [...prev, newProject]);
    supabase.from('projects').insert(projectToRow(newProject)).then(({ error }) => {
      if (error) console.error('Error creando proyecto:', error);
    });
    logActivity(newProject.id, 'Creó el proyecto', 'general');
    setShowCreate(false);
    openProject(newProject.id);
  }
  async function handleDeleteProject(id) {
    if (!isLeader(perfil)) {
      alert('Solo un líder puede eliminar proyectos.');
      return;
    }
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        setViewState(previousView);
        setSelectedId(null);
        window.history.pushState({ view: previousView }, '');
      }
    } catch (e) {
      console.error('Error eliminando proyecto:', e);
      alert('No se pudo eliminar el proyecto. Esta acción requiere permisos de líder.');
    }
  }
  function handleAddLink(link) {
    setLinks((prev) => [...prev, link]);
    supabase.from('links').insert(link).then(({ error }) => {
      if (error) console.error('Error creando enlace:', error);
    });
  }
  function handleUpdateLink(id, patch) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    supabase.from('links').update(patch).eq('id', id).then(({ error }) => {
      if (error) console.error('Error editando enlace:', error);
    });
  }
  function handleRemoveLink(id) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    supabase.from('links').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Error eliminando enlace:', error);
    });
  }
  function handleAddInversionista(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setInversionistas((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    supabase.from('inversionistas').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando inversionista:', error);
    });
  }
  function handleAddPais(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setPaises((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    supabase.from('paises').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando país:', error);
    });
  }
  function handleAddProveedor(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setProveedores((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    supabase.from('proveedores').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando proveedor:', error);
    });
  }
  function handleAddMalla(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setMallas((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    supabase.from('mallas').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando malla:', error);
    });
  }
  async function handleGuardarParametrosIngenieria(nuevosDatos) {
    aplicarParametrosIngenieria(nuevosDatos);
    setParametrosIngenieria({
      recubrimiento: RECUBRIMIENTO_CIMENTACION,
      barras: { ...BARRA_ACERO },
      traslapos: { ...TRASLAPO_TABLE },
    });
    const { error } = await supabase.from('parametros_ingenieria').upsert({ id: 'global', datos: nuevosDatos, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Error guardando parámetros de ingeniería:', error);
      alert('No se pudieron guardar los parámetros en el servidor (¿tienes rol Desarrollador y corriste la migración?). Detalle: ' + error.message);
    }
  }
  function handleAddPlantillaCimentacion(tipo, nombre, datos) {
    const nueva = { id: makeId('cim'), tipo, nombre, datos };
    setPlantillasCimentacion((prev) => [...prev, nueva]);
    supabase.from('cimentacion_plantillas').insert({ id: nueva.id, tipo, nombre, datos, creado_por: perfil?.nombre || null }).then(({ error }) => {
      if (error) {
        console.error('Error creando plantilla de cimentación:', error);
        alert('No se pudo guardar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  function handleUpdatePlantillaCimentacion(id, patch) {
    setPlantillasCimentacion((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    supabase.from('cimentacion_plantillas').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error editando plantilla de cimentación:', error);
        alert('No se pudo guardar el cambio. Detalle: ' + error.message);
      }
    });
  }
  function handleDeletePlantillaCimentacion(id) {
    setPlantillasCimentacion((prev) => prev.filter((p) => p.id !== id));
    supabase.from('cimentacion_plantillas').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando plantilla de cimentación:', error);
        alert('No se pudo eliminar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  function handleAddCarpeta(nombre) {
    const nueva = { id: makeId('carpeta'), nombre };
    setCarpetas((prev) => [...prev, nueva]);
    supabase.from('instructivo_carpetas').insert(nueva).then(({ error }) => {
      if (error) console.error('Error creando carpeta:', error);
    });
  }
  function handleUpdateCarpeta(id, nombre) {
    setCarpetas((prev) => prev.map((c) => (c.id === id ? { ...c, nombre } : c)));
    supabase.from('instructivo_carpetas').update({ nombre }).eq('id', id).then(({ error }) => {
      if (error) console.error('Error renombrando carpeta:', error);
    });
  }
  function handleDeleteCarpeta(id) {
    setCarpetas((prev) => prev.filter((c) => c.id !== id));
    setVideos((prev) => prev.filter((v) => v.carpeta_id !== id));
    supabase.from('instructivo_carpetas').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Error eliminando carpeta:', error);
    });
  }
  function handleAddVideo(data) {
    const nuevo = { id: makeId('video'), ...data };
    setVideos((prev) => [...prev, nuevo]);
    supabase.from('instructivo_videos').insert(nuevo).then(({ error }) => {
      if (error) console.error('Error creando video:', error);
    });
  }
  function handleUpdateVideo(id, patch) {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    supabase.from('instructivo_videos').update(patch).eq('id', id).then(({ error }) => {
      if (error) console.error('Error editando video:', error);
    });
  }
  function handleDeleteVideo(id) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    supabase.from('instructivo_videos').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Error eliminando video:', error);
    });
  }
  function handleProfileSaved(p) {
    const eraNuevo = !perfil;
    setPerfil((prev) => ({ ...(prev || {}), ...p, roles: prev?.roles || [] }));
    setDirectorio((prev) => {
      const existente = prev.find((u) => u.id === p.id);
      const merged = { ...p, roles: existente?.roles || [] };
      return existente ? prev.map((u) => (u.id === p.id ? merged : u)) : [...prev, merged];
    });
    setShowProfileEdit(false);
    if (eraNuevo) loadSharedData(p.id);
  }
  async function handleUpdatePersonaInfo(userId, patch) {
    setDirectorio((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    if (userId === perfil.id) setPerfil((prev) => ({ ...prev, ...patch }));
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) {
      console.error('Error actualizando datos de la persona:', error);
      alert('No se pudo guardar este dato. Detalle: ' + error.message);
    }
  }
  async function handleToggleRole(userId, roleKey, tieneRol) {
    try {
      if (tieneRol) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_key', roleKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_key: roleKey, assigned_by: perfil.id });
        if (error) throw error;
      }
      const aplicarCambio = (roles) => (tieneRol ? roles.filter((r) => r !== roleKey) : [...roles, roleKey]);
      setDirectorio((prev) => prev.map((u) => (u.id === userId ? { ...u, roles: aplicarCambio(u.roles) } : u)));
      if (userId === perfil.id) {
        setPerfil((prev) => ({ ...prev, roles: aplicarCambio(prev.roles) }));
      }
    } catch (e) {
      console.error('Error actualizando rol:', e);
      alert('No se pudo actualizar el rol. Esta acción requiere permisos de líder.');
    }
  }
  async function handleDeleteUser(userId) {
    if (!isDesignLeader(perfil)) {
      alert('Solo el Líder de Diseño puede eliminar usuarios.');
      return;
    }
    if (userId === perfil.id) {
      alert('No puedes eliminar tu propia cuenta desde aquí.');
      return;
    }
    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setDirectorio((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error('Error eliminando usuario:', e);
      alert('No se pudo eliminar el usuario. Esta acción requiere permisos de Líder de Diseño.');
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  async function handleRefresh() {
    setDataLoaded(false);
    await loadSharedData(perfil?.id);
  }

  if (session === undefined) return <LoadingScreen mensaje="Verificando sesión…" />;
  if (!session) return <AuthGate />;
  if (checkingPerfil) return <LoadingScreen mensaje="Cargando tu perfil…" />;
  if (!perfil) return <ProfileGate userId={session.user.id} onSaved={handleProfileSaved} />;
  if (!dataLoaded) return <LoadingScreen mensaje="Cargando proyectos…" />;

  const misProyectos = projects.filter((p) => equipoNombres(p.equipo).includes(perfil.nombre));
  const selectedProject = projects.find((p) => p.id === selectedId);
  const stats = {
    activo: projects.filter((p) => p.estado === 'activo').length,
    pausa: projects.filter((p) => p.estado === 'pausa').length,
    inactivo: projects.filter((p) => p.estado === 'inactivo').length,
    finalizado: projects.filter((p) => p.estado === 'finalizado').length,
  };

  return (
    <div className="app-shell flex h-screen bg-navy-50 font-sans text-navy-800 antialiased">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
          }
          .app-shell {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .app-main {
            height: auto !important;
            overflow: visible !important;
          }
        }
        .print-only { display: none; }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: #2A497E transparent; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #2A497E; border-radius: 999px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #3C64AA; }
      `}</style>

      <Sidebar
        view={view}
        setView={setView}
        stats={stats}
        perfil={perfil}
        onEditProfile={() => setShowProfileEdit(true)}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <main className="app-main flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        <div
          className="no-print md:hidden sticky top-0 z-20 flex items-center gap-3 bg-navy-900 px-4 py-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top) + 0.75rem, 2.75rem)' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1" title="Abrir menú">
            <Menu className="w-6 h-6" />
          </button>
          <div className="w-7 h-7 rounded-md bg-lime-300 flex items-center justify-center shrink-0">
            <img src={logoMark} alt="" className="w-4 h-4 object-contain" />
          </div>
          <p className="text-white font-bold text-sm">Sun Design Suite</p>
        </div>
        {view === 'dashboard' && (
          <Dashboard
            projects={projects}
            misProyectos={misProyectos}
            onNewProject={() => setShowCreate(true)}
            openProject={openProject}
            setView={setView}
            directorio={directorio}
            perfil={perfil}
          />
        )}
        {view === 'mis' && (
          <ProjectListView
            projects={misProyectos}
            title="Mis Proyectos"
            subtitle={`Proyectos donde ${perfil.nombre} hace parte del equipo`}
            onOpen={openProject}
            onNewProject={() => setShowCreate(true)}
            directorio={directorio}
          />
        )}
        {view === 'todos' && (
          <ProjectListView
            projects={projects}
            title="Todos los Proyectos"
            subtitle="Portafolio completo de minigranjas fotovoltaicas"
            onOpen={openProject}
            onNewProject={() => setShowCreate(true)}
            directorio={directorio}
            archivarFinalizados
            mostrarFiltroInversionista
          />
        )}
        {view === 'resumen_inversionistas' && (
          <ResumenInversionistasView projects={projects} onOpenProject={openProject} />
        )}
        {view === 'cimentaciones' && (
          <CimentacionesView
            plantillas={plantillasCimentacion}
            onAdd={handleAddPlantillaCimentacion}
            onUpdate={handleUpdatePlantillaCimentacion}
            onDelete={handleDeletePlantillaCimentacion}
            mallas={mallas}
            onAddMalla={handleAddMalla}
            perfil={perfil}
            parametrosIngenieria={parametrosIngenieria}
            onGuardarParametros={handleGuardarParametrosIngenieria}
          />
        )}
        {view === 'equipo' && (
          <EquipoView
            directorio={directorio}
            perfil={perfil}
            projects={projects}
            selectedPersonId={selectedPersonId}
            onOpenPerson={(id) => setSelectedPersonId(id)}
            onBackToList={() => setSelectedPersonId(null)}
            onToggleRole={handleToggleRole}
            onDeleteUser={handleDeleteUser}
            onUpdatePersonaInfo={handleUpdatePersonaInfo}
            onOpenProject={openProject}
          />
        )}
        {view === 'instructivos' && (
          <InstructivosView
            carpetas={carpetas}
            videos={videos}
            onAddCarpeta={handleAddCarpeta}
            onUpdateCarpeta={handleUpdateCarpeta}
            onDeleteCarpeta={handleDeleteCarpeta}
            onAddVideo={handleAddVideo}
            onUpdateVideo={handleUpdateVideo}
            onDeleteVideo={handleDeleteVideo}
          />
        )}
        {view === 'enlaces' && <LinksView links={links} onAdd={handleAddLink} onUpdate={handleUpdateLink} onRemove={handleRemoveLink} />}
        {view === 'detalle' && selectedProject && (
          <ProjectDetail
            key={selectedProject.id}
            project={selectedProject}
            updateProject={updateProject}
            onBack={goBack}
            onDelete={handleDeleteProject}
            directorio={directorio}
            perfil={perfil}
            inversionistas={inversionistas}
            onAddInversionista={handleAddInversionista}
            paises={paises}
            onAddPais={handleAddPais}
            proveedores={proveedores}
            onAddProveedor={handleAddProveedor}
          />
        )}
      </main>

      {showCreate && (
        <ProjectFormModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          directorio={directorio}
          perfil={perfil}
          inversionistas={inversionistas}
          onAddInversionista={handleAddInversionista}
          paises={paises}
          onAddPais={handleAddPais}
          projects={projects}
        />
      )}
      {showProfileEdit && <ProfileGate initial={perfil} userId={perfil.id} onSaved={handleProfileSaved} onCancel={() => setShowProfileEdit(false)} />}
    </div>
  );
}
