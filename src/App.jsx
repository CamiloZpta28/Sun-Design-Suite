import React, { useState, useEffect } from 'react';
import {
  Sun, LayoutDashboard, FolderKanban, Layers, Link2, HardHat, Droplets,
  Building2, Zap, Cog, Mountain, PenTool, Plus, Search, X, Printer,
  Paperclip, Trash2, ChevronLeft, Pencil, Save, MapPin, Calendar,
  Users, ExternalLink, Check, FileText, UploadCloud, XCircle, ClipboardList,
  Loader2, RefreshCw, LogOut, ShieldCheck, Lock, History,
} from 'lucide-react';
import { supabase } from './supabaseClient';

/* ============================================================================
   SUN DESIGN SUITE (versión autónoma, fuera de Claude)
   Gestión y Hoja de Vida de Minigranjas Fotovoltaicas
   ----------------------------------------------------------------------------
   - Autenticación real con Supabase (correo + contraseña). Cada ingeniero
     crea su cuenta y su perfil (nombre, foto, especialidad).
   - Proyectos, enlaces y perfiles se guardan en una base de datos de
     Supabase compartida por todo el equipo.
   - Estructura "schema-driven": los campos técnicos por especialidad viven en
     el arreglo SCHEMA. Agregar/quitar un campo ahí no rompe la UI.
   ============================================================================ */

/* --------------------------- 1. ROLES / ESPECIALIDADES --------------------- */
const ROLES = [
  { key: 'civil', label: 'Ing. Civil', icon: HardHat },
  { key: 'hidraulico', label: 'Ing. Hidráulico', icon: Droplets },
  { key: 'estructural', label: 'Ing. Estructural', icon: Building2 },
  { key: 'electrico', label: 'Ing. Eléctrico', icon: Zap },
  { key: 'mecanico', label: 'Ing. Mecánico', icon: Cog },
  { key: 'geotecnico', label: 'Ing. Geotécnico', icon: Mountain },
  { key: 'delineante', label: 'Delineante', icon: PenTool },
];

/* Especialidades de liderazgo: son las únicas que pueden asignar el equipo   */
/* de un proyecto y cambiar su estado (Activo / En Pausa / Inactivo). No      */
/* ocupan una casilla del equipo técnico, son roles de coordinación.          */
const LEADER_ROLES = [
  { key: 'lider_civil', label: 'Líder Civil', icon: HardHat },
  { key: 'lider_electrico', label: 'Líder Eléctrico', icon: Zap },
  { key: 'lider_delineantes', label: 'Líder Delineantes', icon: PenTool },
  { key: 'lider_diseno', label: 'Líder de Diseño', icon: ShieldCheck },
];

const ALL_SPECIALTIES = [...ROLES, ...LEADER_ROLES];

function specialtyLabel(key) {
  return ALL_SPECIALTIES.find((s) => s.key === key)?.label || key;
}
function isLeader(perfil) {
  return !!perfil && LEADER_ROLES.some((r) => r.key === perfil.especialidad);
}
function isAssignedToProject(perfil, project) {
  return !!perfil && Object.values(project.equipo).includes(perfil.nombre);
}

/* --------------------- 2. ESQUEMA DE CAMPOS POR ESPECIALIDAD ---------------- */
/* Los campos de tipo 'boolean' guardan { valor: true|false|null, nota: '' }   */
/* para poder anexar una descripción a la respuesta Sí/No.                     */
const SCHEMA = [
  {
    id: 'general', label: 'General', icon: MapPin,
    fields: [
      { key: 'municipio', label: 'Municipio', type: 'text' },
      { key: 'departamento', label: 'Departamento', type: 'text' },
      { key: 'pais', label: 'País', type: 'text' },
      { key: 'inversionista', label: 'Inversionista', type: 'text' },
      { key: 'magna_sirgas', label: 'Coord. MAGNA-SIRGAS (Bogotá)', type: 'text' },
      { key: 'lat_long', label: 'Coordenadas Lat/Long', type: 'text' },
      { key: 'altitud', label: 'Altitud (m.s.n.m.)', type: 'text' },
      { key: 'particularidades', label: 'Particularidades Generales', type: 'textarea' },
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
    ],
  },
  {
    id: 'mecanica', label: 'Mecánica', icon: Cog,
    fields: [
      { key: 'numero_mesas', label: 'Número de mesas', type: 'text' },
      { key: 'tipo_mesas', label: 'Tipo de mesas', type: 'text' },
      { key: 'config_mesas', label: 'Configuración de las mesas', type: 'text' },
      { key: 'numero_hincas', label: 'Número de hincas', type: 'text' },
      { key: 'numero_modulos', label: 'Número de módulos', type: 'text' },
      { key: 'especificacion_modulos', label: 'Especificación de módulos', type: 'text' },
      { key: 'inclinacion_modulos', label: 'Inclinación de módulos', type: 'text' },
      { key: 'altura_min_terreno', label: 'Altura mínima con terreno', type: 'text' },
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
    ],
  },
  {
    id: 'estructural', label: 'Estructural', icon: Building2,
    fields: [
      { key: 'Aa', label: 'Aa', type: 'text' },
      { key: 'Av', label: 'Av', type: 'text' },
      { key: 'dim_ciment_shelter', label: 'Dim. cimentación shelter', type: 'text' },
      { key: 'dim_ciment_inversores', label: 'Dim. cimentación inversores', type: 'text' },
      { key: 'dim_ciment_cerramiento', label: 'Dim. cimentación cerramiento', type: 'text' },
      { key: 'dim_ciment_porton', label: 'Dim. cimentación portón', type: 'text' },
      { key: 'dim_ciment_luminarias', label: 'Dim. cimentación luminarias', type: 'text' },
      { key: 'dim_ciment_cctv', label: 'Dim. cimentación CCTV', type: 'text' },
      { key: 'dim_ciment_postes', label: 'Dim. cimentación postes', type: 'text' },
      { key: 'res_conc_shelter', label: 'Resist. concreto shelter', type: 'text' },
      { key: 'res_conc_inversores', label: 'Resist. concreto inversores', type: 'text' },
      { key: 'res_conc_cerramiento', label: 'Resist. concreto cerramiento', type: 'text' },
      { key: 'res_conc_porton', label: 'Resist. concreto portón', type: 'text' },
      { key: 'res_conc_luminarias', label: 'Resist. concreto luminarias', type: 'text' },
      { key: 'res_conc_cctv', label: 'Resist. concreto CCTV', type: 'text' },
      { key: 'res_conc_postes', label: 'Resist. concreto postes', type: 'text' },
      { key: 'tipo_galvanizado', label: 'Tipo de galvanizado', type: 'text' },
      { key: 'esquema_puntado', label: 'Esquema de puntado', type: 'text' },
      { key: 'espec_aceros_pernos', label: 'Especificaciones de aceros y pernos', type: 'text' },
      { key: 'espec_refuerzo', label: 'Especificación de refuerzo', type: 'text' },
    ],
  },
  {
    id: 'hidraulico', label: 'Hidráulico', icon: Droplets,
    fields: [
      { key: 'obras_hidraulicas', label: 'Obras hidráulicas requeridas', type: 'boolean' },
      { key: 'tipo_obras', label: 'Tipo de obras', type: 'text' },
      { key: 'inundabilidad', label: 'Inundabilidad', type: 'boolean' },
      { key: 'velocidades', label: 'Velocidades de flujo evaluadas', type: 'boolean' },
      { key: 'cuerpos_agua', label: 'Cuerpos de agua cercanos', type: 'boolean' },
      { key: 'estaciones_pluviometricas', label: 'Estaciones pluviométricas', type: 'text' },
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

const STATUS_CONFIG = {
  activo: { label: 'Activo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pausa: { label: 'En Pausa', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  inactivo: { label: 'Inactivo', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
};

/* ------------------------------ 3. HELPERS ---------------------------------- */
function emptySchemaData() {
  const obj = {};
  SCHEMA.forEach((section) => {
    obj[section.id] = {};
    section.fields.forEach((f) => {
      obj[section.id][f.key] = f.type === 'boolean' ? { valor: null, nota: '' } : '';
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

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function projectToRow(p) {
  return { id: p.id, nombre: p.nombre, estado: p.estado, equipo: p.equipo, data: p.data, archivos: p.archivos };
}
function rowToProject(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    estado: row.estado,
    equipo: row.equipo || {},
    data: row.data || emptySchemaData(),
    archivos: row.archivos || [],
  };
}
function rowToProfile(row) {
  return { id: row.id, nombre: row.nombre, especialidad: row.especialidad, foto: row.foto_url };
}

/* --------------------------- 4. DATOS SEMILLA -------------------------------- */
/* Se insertan en la base de datos SOLO la primera vez que las tablas están     */
/* vacías, a modo de ejemplo de cómo se ve la app con proyectos reales.        */
const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    nombre: 'Minigranja Solar Guacarí 5MW',
    estado: 'activo',
    equipo: { civil: '', hidraulico: '', estructural: '', electrico: '', mecanico: '', geotecnico: '', delineante: '' },
    archivos: [],
    data: buildData({
      general: {
        municipio: 'Guacarí', departamento: 'Valle del Cauca', pais: 'Colombia',
        inversionista: 'Fondo Energético Andino S.A.S.',
        magna_sirgas: 'N 923450.12 / E 1056220.44', lat_long: '3.7644 N / -76.3311 W',
        altitud: '1020', particularidades: 'Terreno con pendiente suave hacia el costado sur, cercano a canal de riego existente.',
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
    equipo: { civil: '', hidraulico: '', estructural: '', electrico: '', mecanico: '', geotecnico: '', delineante: '' },
    archivos: [],
    data: buildData({
      general: {
        municipio: 'El Espinal', departamento: 'Tolima', pais: 'Colombia', inversionista: 'Tolisol Energía S.A.S.',
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
    equipo: { civil: '', hidraulico: '', estructural: '', electrico: '', mecanico: '', geotecnico: '', delineante: '' },
    archivos: [],
    data: buildData({
      general: {
        municipio: 'Montería', departamento: 'Córdoba', pais: 'Colombia', inversionista: 'Caribe Solar Holding',
        fecha_inicio: '2025-08-01', fecha_entrega: '2026-06-15',
        particularidades: 'Proyecto en pausa por ajustes en el cierre financiero.',
      },
      hidraulico: {
        obras_hidraulicas: bool(true), inundabilidad: bool(true, 'Zona con inundaciones ocasionales reportadas por la comunidad en época de lluvias.'),
        cuerpos_agua: bool(true), estaciones_pluviometricas: 'Estación Montería IDEAM',
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

function Avatar({ name, foto, title, size = 'md' }) {
  if (!name) return null;
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
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

function FieldRenderer({ field, value, editMode, onChange }) {
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
    const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400';
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

  const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400';
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

function SectionFieldsGrid({ section, data, editMode, onFieldChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 divide-y divide-navy-100 md:divide-y-0">
      {section.fields.map((field) => (
        <div key={field.key}>
          <FieldRenderer
            field={field}
            value={data ? data[field.key] : undefined}
            editMode={editMode}
            onChange={(val) => onFieldChange(section.id, field.key, val)}
          />
        </div>
      ))}
    </div>
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

function AttachmentsPanel({ archivos, onAdd, onRemove, canEdit = true }) {
  return (
    <div>
      {canEdit ? (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-navy-300 rounded-xl py-8 cursor-pointer hover:border-gold-400 hover:bg-gold-50 transition-colors mb-5">
          <UploadCloud className="w-7 h-7 text-navy-400" />
          <p className="text-sm text-navy-500">
            <span className="font-semibold text-gold-600">Haz clic para adjuntar</span> planos o documentos
          </p>
          <p className="text-xs text-navy-400">Por ahora solo se guarda el nombre del archivo (sin subir el contenido)</p>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files.length) onAdd(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-5">
          <Lock className="w-3.5 h-3.5" /> Solo el equipo asignado a este proyecto puede adjuntar o eliminar documentos.
        </p>
      )}

      {archivos.length === 0 ? (
        <p className="text-sm text-navy-400 italic text-center py-4">Aún no se han adjuntado documentos a este proyecto.</p>
      ) : (
        <div className="space-y-2">
          {archivos.map((file) => (
            <div key={file.id} className="flex items-center justify-between bg-navy-50 border border-navy-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-navy-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-700 truncate">{file.nombre}</p>
                  <p className="text-xs text-navy-400">{formatBytes(file.tamano)} · Subido el {formatDate(file.fecha)}</p>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => onRemove(file.id)} className="text-navy-300 hover:text-red-500 shrink-0 ml-3">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrintableReport({ project }) {
  const general = project.data.general;
  return (
    <div className="print-only p-10">
      <div className="flex items-center justify-between border-b-2 border-navy-800 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Sun className="w-6 h-6 text-gold-500" />
          <div>
            <p className="font-bold text-lg text-navy-800">Sun Design Suite</p>
            <p className="text-xs text-navy-500">Hoja de Vida de Minigranja Fotovoltaica</p>
          </div>
        </div>
        <p className="text-xs text-navy-400">Generado el {new Date().toLocaleDateString('es-CO')}</p>
      </div>

      <h1 className="text-xl font-bold text-navy-800 mb-1">{project.nombre}</h1>
      <p className="text-sm text-navy-500 mb-6">{general.municipio || 'N/A'}, {general.departamento || 'N/A'}, {general.pais || 'N/A'}</p>

      <table className="w-full text-sm mb-8 border border-navy-300">
        <tbody>
          <tr className="border-b border-navy-300">
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50 w-1/4">Estado</td>
            <td className="px-3 py-2">{STATUS_CONFIG[project.estado]?.label}</td>
            <td className="px-3 py-2 font-semibold text-navy-500 bg-navy-50 w-1/4">Elaboró</td>
            <td className="px-3 py-2">{project.equipo.civil || 'N/A'}</td>
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
              <td className="py-1.5 font-medium text-navy-700">{project.equipo[role.key] || 'Sin asignar'}</td>
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

      <h2 className="text-sm font-bold uppercase tracking-wide text-navy-600 mb-2 border-b border-navy-300 pb-1">Archivos Adjuntos</h2>
      {project.archivos.length === 0 ? (
        <p className="text-sm text-navy-400 italic">Sin documentos adjuntos.</p>
      ) : (
        <ul className="text-sm space-y-1 list-disc pl-5">
          {project.archivos.map((f) => (
            <li key={f.id}>{f.nombre} — {formatBytes(f.tamano)} ({formatDate(f.fecha)})</li>
          ))}
        </ul>
      )}

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
          <div className="w-10 h-10 rounded-lg bg-gold-500 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5 text-navy-900" />
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
            className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
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
  const [especialidad, setEspecialidad] = useState(initial?.especialidad || ROLES[0].key);
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
      const { error: dbErr } = await supabase.from('profiles').upsert({ id: userId, nombre: nombre.trim(), especialidad, foto_url: foto });
      if (dbErr) throw dbErr;
      onSaved({ id: userId, nombre: nombre.trim(), especialidad, foto });
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
            <div className="w-10 h-10 rounded-lg bg-gold-500 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5 text-navy-900" />
            </div>
            <div>
              <p className="font-bold text-navy-800 leading-tight">Sun Design Suite</p>
              <p className="text-xs text-navy-500">{initial ? 'Editar mi perfil' : 'Completa tu perfil de ingeniero'}</p>
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
              <div className="w-20 h-20 rounded-full bg-navy-100 border-2 border-dashed border-navy-300 flex items-center justify-center overflow-hidden group-hover:border-gold-400 transition-colors">
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
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="Ej. Camilo Zapata"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Especialidad *</label>
            <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm">
              <optgroup label="Especialidades técnicas">
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="Roles de liderazgo">
                {LEADER_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </optgroup>
            </select>
            {LEADER_ROLES.some((r) => r.key === especialidad) && (
              <p className="text-xs text-gold-700 mt-1.5 flex items-start gap-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Como rol de liderazgo, podrás asignar el equipo y cambiar el estado de cualquier proyecto.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
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
      <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      <p className="text-sm text-navy-400">{mensaje}</p>
    </div>
  );
}

/* ============================================================================
   7. NAVEGACIÓN Y LAYOUT
   ============================================================================ */
function Sidebar({ view, setView, stats, perfil, onEditProfile, onRefresh, onLogout }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'mis', label: 'Mis Proyectos', icon: FolderKanban },
    { key: 'todos', label: 'Todos los Proyectos', icon: Layers },
    { key: 'enlaces', label: 'Enlaces de Interés', icon: Link2 },
  ];
  const especialidadLabel = specialtyLabel(perfil.especialidad);

  return (
    <aside className="no-print w-64 shrink-0 bg-navy-900 text-navy-300 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-navy-800 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center shrink-0">
          <Sun className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <p className="text-white font-bold leading-tight">Sun Design Suite</p>
          <p className="text-xs text-navy-500 tracking-wide">Minigranjas Fotovoltaicas</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                active ? 'bg-navy-800 text-white border-gold-500' : 'text-navy-400 border-transparent hover:bg-navy-800 hover:text-navy-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Resumen</p>
          <button onClick={onRefresh} title="Actualizar datos compartidos" className="text-navy-500 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-navy-800 rounded-md py-1.5 text-center">
            <p className="text-emerald-400 text-sm font-bold">{stats.activo}</p>
            <p className="text-xs text-navy-500">Activos</p>
          </div>
          <div className="bg-navy-800 rounded-md py-1.5 text-center">
            <p className="text-yellow-400 text-sm font-bold">{stats.pausa}</p>
            <p className="text-xs text-navy-500">Pausa</p>
          </div>
          <div className="bg-navy-800 rounded-md py-1.5 text-center">
            <p className="text-red-400 text-sm font-bold">{stats.inactivo}</p>
            <p className="text-xs text-navy-500">Inact.</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-navy-800 flex items-center gap-3">
        <Avatar name={perfil.nombre} foto={perfil.foto} />
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold truncate">{perfil.nombre}</p>
          <p className="text-navy-500 text-xs truncate flex items-center gap-1">
            {isLeader(perfil) && <ShieldCheck className="w-3 h-3 text-gold-400 shrink-0" />}
            {especialidadLabel}
          </p>
        </div>
        <button onClick={onEditProfile} title="Editar mi perfil" className="text-navy-500 hover:text-white shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onLogout} title="Cerrar sesión" className="text-navy-500 hover:text-red-400 shrink-0">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

function StatCard({ label, value, icon: Icon, accent, textColor = 'text-navy-700' }) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${accent} border-t border-r border-b border-navy-200 p-4 shadow-sm`}>
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
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-navy-200 p-4 hover:border-gold-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="font-bold text-navy-800 leading-snug group-hover:text-gold-600 transition-colors">{project.nombre}</h3>
        <StatusBadge estado={project.estado} size="sm" />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-navy-500 mb-3">
        <MapPin className="w-3.5 h-3.5 shrink-0" /> {general.municipio || 'Sin ubicación'}, {general.departamento || ''}
      </p>
      <div className="flex items-center justify-between pt-3 border-t border-navy-100">
        <div className="flex -space-x-2">
          {ROLES.filter((r) => project.equipo[r.key]).slice(0, 4).map((r) => {
            const u = findUserByName(directorio, project.equipo[r.key]);
            return <Avatar key={r.key} name={project.equipo[r.key]} foto={u?.foto} title={r.label} size="sm" />;
          })}
          {ROLES.filter((r) => project.equipo[r.key]).length === 0 && (
            <span className="text-xs text-navy-300 italic">Sin equipo asignado</span>
          )}
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
  const primerNombre = (perfil.nombre || '').split(' ')[0];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Hola, {primerNombre}</h1>
          <p className="text-navy-500 text-sm mt-1">{specialtyLabel(perfil.especialidad)} · Panel general de proyectos</p>
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Proyectos" value={total} icon={Layers} accent="border-navy-300" />
        <StatCard label="Activos" value={activos} icon={Check} accent="border-emerald-400" textColor="text-emerald-600" />
        <StatCard label="En Pausa" value={pausa} icon={Cog} accent="border-yellow-400" textColor="text-yellow-600" />
        <StatCard label="Inactivos" value={inactivos} icon={XCircle} accent="border-red-400" textColor="text-red-600" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-navy-800">Mis proyectos</h2>
        <button onClick={() => setView('mis')} className="text-sm font-medium text-gold-600 hover:text-gold-700">
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

function ProjectListView({ projects, title, subtitle, onOpen, onNewProject, directorio }) {
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  const filtered = projects.filter((p) => {
    const general = p.data.general;
    const haystack = `${p.nombre} ${general.municipio || ''} ${general.departamento || ''}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());
    const matchEstado = estadoFiltro === 'todos' || p.estado === estadoFiltro;
    return matchSearch && matchEstado;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">{title}</h1>
          <p className="text-navy-500 text-sm mt-1">{subtitle}</p>
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      <div className="flex items-center gap-3 my-6">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-navy-400" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o ubicación…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-navy-300 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="text-sm rounded-lg border border-navy-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="pausa">En Pausa</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => onOpen(p.id)} directorio={directorio} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-navy-400">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No se encontraron proyectos con esos filtros.</p>
        </div>
      )}
    </div>
  );
}

function EquipoSelect({ role, valorActual, directorio, onChange, readOnly }) {
  const candidatos = directorio.filter((u) => u.especialidad === role.key);
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

function ProjectFormModal({ onClose, onCreate, directorio, perfil }) {
  const puedeGestionar = isLeader(perfil);
  const [form, setForm] = useState({
    nombre: '',
    estado: 'activo',
    equipo: Object.fromEntries(ROLES.map((r) => [r.key, ''])),
    general: { municipio: '', departamento: '', pais: 'Colombia', inversionista: '', fecha_inicio: '', fecha_entrega: '' },
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

  function submit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    const data = emptySchemaData();
    data.general = { ...data.general, ...form.general };
    onCreate({
      id: makeId('proj'),
      nombre: form.nombre,
      estado: form.estado,
      equipo: form.equipo,
      data,
      archivos: [],
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
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="Ej. Minigranja Solar El Retiro 5MW"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Municipio</label>
              <input value={form.general.municipio} onChange={(e) => setGeneral('municipio', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Departamento</label>
              <input value={form.general.departamento} onChange={(e) => setGeneral('departamento', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">País</label>
              <input value={form.general.pais} onChange={(e) => setGeneral('pais', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Inversionista</label>
              <input value={form.general.inversionista} onChange={(e) => setGeneral('inversionista', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Fecha de Inicio</label>
              <input type="date" value={form.general.fecha_inicio} onChange={(e) => setGeneral('fecha_inicio', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Fecha de Entrega</label>
              <input type="date" value={form.general.fecha_entrega} onChange={(e) => setGeneral('fecha_entrega', e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
            </div>
          </div>

          {puedeGestionar ? (
            <div>
              <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className="rounded-lg border border-navy-300 px-3 py-2 text-sm">
                <option value="activo">Activo</option>
                <option value="pausa">En Pausa</option>
                <option value="inactivo">Inactivo</option>
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
                      <EquipoSelect role={role} valorActual={form.equipo[role.key]} directorio={directorio} onChange={(val) => setEquipo(role.key, val)} />
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
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg shadow-sm">
              Crear Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectDetail({ project, updateProject, onBack, directorio, perfil }) {
  const [activeTab, setActiveTab] = useState(SCHEMA[0].id);
  const [editMode, setEditMode] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const puedeGestionar = isLeader(perfil); // asignar equipo + cambiar estado
  const puedeEditarContenido = isAssignedToProject(perfil, project); // campos técnicos + archivos

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
    setEditMode(true);
  }
  function cancelEdit() {
    setDraftData(null);
    setEditMode(false);
  }
  function saveEdit() {
    const cambios = diffSectionData(activeSection, project.data[activeSection.id], draftData[activeSection.id]);
    const accion = cambios.length > 0
      ? `Editó "${activeSection.label}" — ${cambios.join('; ')}`
      : `Abrió "${activeSection.label}" en modo edición sin cambios`;
    updateProject(project.id, (p) => ({ ...p, data: draftData }), accion);
    setEditMode(false);
    setDraftData(null);
    setHistorial(null);
  }
  function handleFieldChange(sectionId, fieldKey, value) {
    setDraftData((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], [fieldKey]: value } }));
  }
  function handleEstadoChange(nuevoEstado) {
    const anterior = STATUS_CONFIG[project.estado]?.label || project.estado;
    const nuevo = STATUS_CONFIG[nuevoEstado]?.label || nuevoEstado;
    updateProject(project.id, (p) => ({ ...p, estado: nuevoEstado }), `Cambió el estado: ${anterior} → ${nuevo}`);
    setHistorial(null);
  }
  function handleEquipoChange(roleKey, nombre) {
    const role = ROLES.find((r) => r.key === roleKey);
    const anterior = project.equipo[roleKey] || 'Sin asignar';
    const nuevo = nombre || 'Sin asignar';
    updateProject(project.id, (p) => ({ ...p, equipo: { ...p.equipo, [roleKey]: nombre } }), `Asignó ${role?.label || roleKey}: ${anterior} → ${nuevo}`);
    setHistorial(null);
  }
  function handleAddFiles(fileList) {
    const nuevos = Array.from(fileList).map((f) => ({
      id: makeId('file'),
      nombre: f.name,
      tipo: f.type || 'Documento',
      tamano: f.size,
      fecha: new Date().toISOString().slice(0, 10),
    }));
    const nombres = nuevos.map((f) => f.nombre).join(', ');
    updateProject(project.id, (p) => ({ ...p, archivos: [...p.archivos, ...nuevos] }), `Adjuntó archivo(s): ${nombres}`);
    setHistorial(null);
  }
  function removeFile(fileId) {
    const archivo = project.archivos.find((f) => f.id === fileId);
    updateProject(project.id, (p) => ({ ...p, archivos: p.archivos.filter((f) => f.id !== fileId) }), archivo ? `Eliminó el archivo: ${archivo.nombre}` : 'Eliminó un archivo');
    setHistorial(null);
  }

  const dataForRender = editMode ? draftData : project.data;
  const activeSection = SCHEMA.find((s) => s.id === activeTab);
  const general = project.data.general;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="no-print p-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-700 mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al listado
        </button>

        <div className="bg-white border-2 border-navy-800 rounded-lg overflow-hidden mb-6">
          <div className="flex items-center justify-between bg-navy-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gold-400" />
              <p className="text-white font-bold text-sm tracking-wide">HOJA DE VIDA DEL PROYECTO</p>
            </div>
            <div className="flex items-center gap-2">
              {puedeGestionar ? (
                <select
                  value={project.estado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  className="text-xs font-semibold rounded-md border-0 py-1.5 pl-2 pr-6 bg-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                >
                  <option value="activo">Activo</option>
                  <option value="pausa">En Pausa</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              ) : (
                <StatusBadge estado={project.estado} />
              )}
              <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-navy-900 text-xs font-bold px-3 py-1.5 rounded-md transition-colors">
                <Printer className="w-3.5 h-3.5" /> Exportar / Imprimir
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-navy-200">
            <TitleCell label="Proyecto" value={project.nombre} span={2} />
            <TitleCell label="Ubicación" value={`${general.municipio || 'N/A'}, ${general.departamento || 'N/A'}`} />
            <TitleCell label="Estado" custom={<StatusBadge estado={project.estado} />} />
            <TitleCell label="Inversionista" value={general.inversionista} />
            <TitleCell label="Fecha de Inicio" value={formatDate(general.fecha_inicio)} />
            <TitleCell label="Fecha de Entrega" value={formatDate(general.fecha_entrega)} />
            <TitleCell label="Elaboró" value={project.equipo.civil} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-navy-200 p-5 mb-6">
          <p className="flex items-center justify-between text-sm font-bold text-navy-700 mb-4">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gold-500" /> Equipo Asignado
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
                <div key={role.key} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                    <RoleIcon className="w-4 h-4 text-navy-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-navy-400 mb-0.5">{role.label}</p>
                    <EquipoSelect
                      role={role}
                      valorActual={project.equipo[role.key]}
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
                    active ? 'border-gold-500 text-gold-600 bg-gold-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
                  }`}
                >
                  <SIcon className="w-4 h-4" /> {section.label}
                </button>
              );
            })}
            <button
              onClick={() => setActiveTab('archivos')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'archivos' ? 'border-gold-500 text-gold-600 bg-gold-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <Paperclip className="w-4 h-4" /> Archivos {project.archivos.length > 0 && `(${project.archivos.length})`}
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'historial' ? 'border-gold-500 text-gold-600 bg-gold-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
              }`}
            >
              <History className="w-4 h-4" /> Historial
            </button>
          </div>

          <div className="p-6">
            {activeTab !== 'archivos' && activeTab !== 'historial' && activeSection && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-navy-400">Campos de la especialidad · {activeSection.label}</p>
                  {!puedeEditarContenido ? (
                    <span className="flex items-center gap-1.5 text-xs text-navy-400">
                      <Lock className="w-3.5 h-3.5" /> Solo el equipo asignado puede editar
                    </span>
                  ) : !editMode ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-semibold text-gold-600 hover:text-gold-700">
                      <Pencil className="w-3.5 h-3.5" /> Editar campos
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={cancelEdit} className="flex items-center gap-1.5 text-xs font-semibold text-navy-500 hover:text-navy-700">
                        <XCircle className="w-3.5 h-3.5" /> Cancelar
                      </button>
                      <button onClick={saveEdit} className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md">
                        <Save className="w-3.5 h-3.5" /> Guardar cambios
                      </button>
                    </div>
                  )}
                </div>
                <SectionFieldsGrid
                  section={activeSection}
                  data={dataForRender[activeSection.id]}
                  editMode={editMode}
                  onFieldChange={handleFieldChange}
                />
              </>
            )}
            {activeTab === 'archivos' && (
              <AttachmentsPanel archivos={project.archivos} onAdd={handleAddFiles} onRemove={removeFile} canEdit={puedeEditarContenido} />
            )}
            {activeTab === 'historial' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-navy-400">Fecha, hora y responsable de cada cambio hecho a este proyecto</p>
                  <button onClick={loadHistorial} className="flex items-center gap-1.5 text-xs font-semibold text-gold-600 hover:text-gold-700">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>
                {loadingHistorial ? (
                  <p className="text-sm text-navy-400 text-center py-8">Cargando historial…</p>
                ) : !historial || historial.length === 0 ? (
                  <p className="text-sm text-navy-400 italic text-center py-8">Aún no hay cambios registrados para este proyecto.</p>
                ) : (
                  <div className="space-y-4">
                    {historial.map((h) => (
                      <div key={h.id} className="flex gap-3 border-l-2 border-gold-300 pl-3">
                        <div className="min-w-0">
                          <p className="text-sm text-navy-700">
                            <span className="font-semibold">{h.usuario_nombre}</span>
                            <span className="text-navy-400"> · {formatDateTime(h.created_at)}</span>
                          </p>
                          <p className="text-sm text-navy-600 mt-0.5 whitespace-pre-wrap break-words">{h.accion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Enlaces de Interés</h1>
          <p className="text-navy-500 text-sm mt-1">Recursos y herramientas de consulta para el equipo de diseño</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm">
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
            <div key={link.id} className="bg-white border border-gold-300 rounded-xl p-4 space-y-2">
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
            <div key={link.id} className="flex items-start justify-between bg-white border border-navy-200 rounded-xl p-4 hover:border-gold-300 transition-colors">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 min-w-0 flex-1 group">
                <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-gold-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-700 group-hover:text-gold-600">{link.descripcion}</p>
                  <p className="text-xs text-navy-400 truncate">{link.url}</p>
                </div>
              </a>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button onClick={() => startEdit(link)} className="text-navy-300 hover:text-gold-500 p-1">
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
  const [dataLoaded, setDataLoaded] = useState(false);

  const [view, setViewState] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Sesión de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Perfil del usuario logueado
  useEffect(() => {
    if (!session) {
      setPerfil(null);
      return;
    }
    let cancelled = false;
    setCheckingPerfil(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPerfil(data ? rowToProfile(data) : null);
        setCheckingPerfil(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function loadSharedData() {
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

    const { data: profileRows } = await supabase.from('profiles').select('*');
    setDirectorio((profileRows || []).map(rowToProfile));

    setDataLoaded(true);
  }

  // Datos compartidos, una vez hay sesión y perfil
  useEffect(() => {
    if (!session || !perfil) return;
    let cancelled = false;
    (async () => {
      await loadSharedData();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, perfil]);

  function setView(v) {
    setViewState(v);
    setSelectedId(null);
  }
  function openProject(id) {
    setPreviousView(view === 'detalle' ? previousView : view);
    setSelectedId(id);
    setViewState('detalle');
  }
  function goBack() {
    setViewState(previousView);
    setSelectedId(null);
  }

  async function logActivity(projectId, accion) {
    if (!accion) return;
    try {
      const { error } = await supabase.from('activity_log').insert({
        project_id: projectId,
        usuario_id: perfil?.id || null,
        usuario_nombre: perfil?.nombre || 'Desconocido',
        accion,
      });
      if (error) console.error('Error registrando historial:', error);
    } catch (e) {
      console.error('Error registrando historial:', e);
    }
  }

  function updateProject(id, updater, accion) {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? updater(p) : p));
      const updated = next.find((p) => p.id === id);
      if (updated) {
        supabase.from('projects').update(projectToRow(updated)).eq('id', id).then(({ error }) => {
          if (error) console.error('Error guardando proyecto:', error);
        });
      }
      return next;
    });
    logActivity(id, accion);
  }
  function handleCreate(newProject) {
    setProjects((prev) => [...prev, newProject]);
    supabase.from('projects').insert(projectToRow(newProject)).then(({ error }) => {
      if (error) console.error('Error creando proyecto:', error);
    });
    logActivity(newProject.id, 'Creó el proyecto');
    setShowCreate(false);
    openProject(newProject.id);
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
  function handleProfileSaved(p) {
    setPerfil(p);
    setDirectorio((prev) => {
      const exists = prev.some((u) => u.id === p.id);
      return exists ? prev.map((u) => (u.id === p.id ? p : u)) : [...prev, p];
    });
    setShowProfileEdit(false);
  }
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  async function handleRefresh() {
    setDataLoaded(false);
    await loadSharedData();
  }

  if (session === undefined) return <LoadingScreen mensaje="Verificando sesión…" />;
  if (!session) return <AuthGate />;
  if (checkingPerfil) return <LoadingScreen mensaje="Cargando tu perfil…" />;
  if (!perfil) return <ProfileGate userId={session.user.id} onSaved={handleProfileSaved} />;
  if (!dataLoaded) return <LoadingScreen mensaje="Cargando proyectos…" />;

  const misProyectos = projects.filter((p) => Object.values(p.equipo).includes(perfil.nombre));
  const selectedProject = projects.find((p) => p.id === selectedId);
  const stats = {
    activo: projects.filter((p) => p.estado === 'activo').length,
    pausa: projects.filter((p) => p.estado === 'pausa').length,
    inactivo: projects.filter((p) => p.estado === 'inactivo').length,
  };

  return (
    <div className="flex h-screen bg-navy-50 font-sans text-navy-800 antialiased">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
        }
        .print-only { display: none; }
      `}</style>

      <Sidebar
        view={view}
        setView={setView}
        stats={stats}
        perfil={perfil}
        onEditProfile={() => setShowProfileEdit(true)}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto">
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
          />
        )}
        {view === 'enlaces' && <LinksView links={links} onAdd={handleAddLink} onUpdate={handleUpdateLink} onRemove={handleRemoveLink} />}
        {view === 'detalle' && selectedProject && (
          <ProjectDetail key={selectedProject.id} project={selectedProject} updateProject={updateProject} onBack={goBack} directorio={directorio} perfil={perfil} />
        )}
      </main>

      {showCreate && <ProjectFormModal onClose={() => setShowCreate(false)} onCreate={handleCreate} directorio={directorio} perfil={perfil} />}
      {showProfileEdit && <ProfileGate initial={perfil} userId={perfil.id} onSaved={handleProfileSaved} onCancel={() => setShowProfileEdit(false)} />}
    </div>
  );
}
