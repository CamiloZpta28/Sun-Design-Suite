import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard, FolderKanban, Layers, Link2, Zap, Cog, Plus, Search, X, Trash2, ChevronLeft,
  Pencil, MapPin, Calendar, Users, ExternalLink, Check, UploadCloud, XCircle, Loader2,
  RefreshCw, LogOut, ShieldCheck, Lock, ClipboardCheck, UserCog, ChevronDown, ChevronRight,
  Video, PartyPopper, PieChart, AlertTriangle, Menu, UserPlus, Boxes, GitBranch, Bell
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { rutaDe, estadoDeRuta } from './routes.js';
import { formatoFechaHora } from './shared/formatos.js';

import {
  SCHEMA, emptyStations, emptyEnergiaMensual, COLOMBIA, DOC_ESTADOS, EquipoField, EspecialidadBarra, InversionistaPicker, PaisPicker,
  ProgresoDonut, STATUS_CONFIG, StatusBadge, buildProjectCode, formatDate, makeId,
  pickDocumentList, projectDisplayName
} from './shared/dominio.jsx';

import { EQUIPO_SEED } from './secciones/equiposDatos.jsx';
import { construirSeedCanalizaciones, subcategoriaKey } from './secciones/canalizacionesDatos.js';
import { RECUBRIMIENTO_CIMENTACION, BARRA_ACERO, TRASLAPO_TABLE, aplicarParametrosIngenieria } from './secciones/cimentacionesDatos.js';
import { ACTUALIZACION_CATEGORIAS_SEED } from './secciones/actualizacionesDatos.js';
import {
  ROLES, usaResumenPersonal, esRolMultiple, equipoComoArray, equipoNombres, ALL_ROLE_DEFS,
  EQUIPO_CATEGORIAS, rolesLabel, isLeader, isDesignLeader, canAssignRole, esAprobadorDe
} from './shared/permisos.js';
import logoMark from './assets/logo-s-mark.png';

/* --------------------- SECCIONES QUE SE DESCARGAN APARTE -------------------
   Cada sección pesada vive en su propio archivo y se descarga la PRIMERA vez
   que alguien la abre, no al entrar a la aplicación. Así, quien solo mira el
   Dashboard no baja los formularios ni los dibujos técnicos que nunca va a
   ver; quien sí entra a una sección espera una fracción de segundo la
   primera vez y ya queda en la caché del navegador.

   Se pintan dentro de un <Suspense> (ver más abajo, dentro de <main>), que
   es lo que muestra "Cargando sección…" durante esa primera descarga.
   -------------------------------------------------------------------------- */
const InstructivosView = lazy(() => import('./secciones/Instructivos.jsx'));
const ActualizacionesView = lazy(() => import('./secciones/Actualizaciones.jsx'));
const EquiposElectricosView = lazy(() => import('./secciones/Equipos.jsx'));
const CanalizacionesView = lazy(() => import('./secciones/Canalizaciones.jsx'));
const CrucesView = lazy(() => import('./secciones/Canalizaciones.jsx').then((m) => ({ default: m.CrucesView })));
const CimentacionesView = lazy(() => import('./secciones/Cimentaciones.jsx'));
const ProjectDetail = lazy(() => import('./secciones/Proyecto.jsx'));
/* El dibujo de una plantilla de cimentación dentro de un proyecto: llega
   aparte, solo si esa pestaña tiene una plantilla elegida. */
const PreviewPlantillaCimentacion = lazy(() => import('./secciones/Cimentaciones.jsx').then((m) => ({ default: m.PreviewPlantilla })));

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

/* El esqueleto de las pestañas técnicas (SCHEMA) y sus ayudantes viven en
   src/shared/dominio.jsx, porque los necesitan tanto esta pantalla como la
   ficha de un proyecto, que se descarga aparte. */
function emptySchemaData() {
  const obj = {};
  SCHEMA.forEach((section) => {
    obj[section.id] = {};
    section.fields.forEach((f) => {
      if (f.type === 'boolean') obj[section.id][f.key] = { valor: null, nota: '' };
      else if (f.type === 'stations') obj[section.id][f.key] = emptyStations();
      else if (f.type === 'modulos_inversor') obj[section.id][f.key] = [];
      else if (f.type === 'energia_mensual') obj[section.id][f.key] = emptyEnergiaMensual();
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

function findUserByName(directorio, nombre) {
  return directorio.find((u) => u.nombre === nombre) || null;
}

function initialsOf(nombre) {
  return (nombre || '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
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
    created_at: row.created_at || null,
  };
}
function rowToProfile(row, roles) {
  return {
    id: row.id,
    nombre: row.nombre,
    foto: row.foto_url,
    fecha_cumpleanos: row.fecha_cumpleanos || '',
    fecha_ingreso: row.fecha_ingreso || '',
    cedula: row.cedula || '',
    ciudad_expedicion_cedula: row.ciudad_expedicion_cedula || '',
    matricula_profesional: row.matricula_profesional || '',
    celular: row.celular || '',
    direccion: row.direccion || '',
    correo_personal: row.correo_personal || '',
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

/* ============================================================================
   6. AUTENTICACIÓN Y CUENTA DE INGENIERO
   ============================================================================ */
/* Campanita de notificaciones — "sin leer" en rojo (+9 si hay más de 9),   */
/* clic abre un panel con el resumen y navega al lugar en cuestión.        */
function NotificationBell({ notificaciones, onAbrirNotificacion, dark }) {
  const [abierto, setAbierto] = useState(false);
  const sinLeer = notificaciones.filter((n) => !n.leida).length;
  const textoContador = sinLeer > 9 ? '+9' : String(sinLeer);

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        title="Notificaciones"
        className={`relative p-1.5 rounded-lg shrink-0 ${dark ? 'text-navy-300 hover:text-white hover:bg-navy-800' : 'text-navy-500 hover:text-navy-800 hover:bg-navy-100'}`}
      >
        <Bell className="w-5 h-5" />
        {sinLeer > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
            {textoContador}
          </span>
        )}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 max-h-[26rem] overflow-y-auto bg-white rounded-xl shadow-xl border border-navy-200 z-50">
            <p className="px-4 py-3 text-xs font-bold uppercase text-navy-500 border-b border-navy-100 sticky top-0 bg-white">Notificaciones</p>
            {notificaciones.length === 0 ? (
              <p className="px-4 py-8 text-sm text-navy-400 italic text-center">Sin notificaciones todavía.</p>
            ) : (
              notificaciones.slice(0, 30).map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setAbierto(false); onAbrirNotificacion(n); }}
                  className={`w-full text-left px-4 py-3 border-b border-navy-50 hover:bg-navy-50 flex items-start gap-2 ${!n.leida ? 'bg-lime-50' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.leida ? 'bg-lime-500' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-navy-700">{n.mensaje}</p>
                    <p className="text-[11px] text-navy-400 mt-0.5">{formatoFechaHora(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
function Sidebar({ view, setView, stats, perfil, onEditProfile, onViewMyProfile, onRefresh, onLogout, mobileOpen, onCloseMobile, notificaciones, onAbrirNotificacion }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'mis', label: 'Mis Proyectos', icon: FolderKanban },
    { key: 'revision', label: 'Revisión de Proyectos', icon: ClipboardCheck },
    { key: 'todos', label: 'Todos los Proyectos', icon: Layers },
    { key: 'resumen_inversionistas', label: 'Resumen por Inversionista', icon: PieChart },
    { key: 'cimentaciones', label: 'Cimentaciones', icon: Boxes },
    { key: 'equipos_electricos', label: 'Equipos eléctricos', icon: Zap },
    { key: 'canalizaciones', label: 'Canalizaciones', icon: Cog },
    { key: 'cruces', label: 'Cruces', icon: GitBranch },
    { key: 'actualizaciones', label: 'Actualizaciones', icon: Bell },
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
          <NotificationBell notificaciones={notificaciones} onAbrirNotificacion={onAbrirNotificacion} dark />
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
          <button
            onClick={onViewMyProfile}
            title="Ver mi perfil"
            className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-md hover:bg-navy-800 -m-1 p-1 transition-colors"
          >
            <Avatar name={perfil.nombre} foto={perfil.foto} />
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate">{perfil.nombre}</p>
              <p className="text-navy-300 text-xs truncate flex items-center gap-1">
                {isLeader(perfil) && <ShieldCheck className="w-3 h-3 text-lime-400 shrink-0" />}
                {rolesLabel(perfil)}
              </p>
            </div>
          </button>
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
function Dashboard({ projects, misProyectos, proyectosRevision, onNewProject, openProject, setView, directorio, perfil }) {
  const resumenPersonal = usaResumenPersonal(perfil);
  const universoResumen = resumenPersonal ? misProyectos : projects;
  const total = universoResumen.length;
  const activos = universoResumen.filter((p) => p.estado === 'activo').length;
  const pausa = universoResumen.filter((p) => p.estado === 'pausa').length;
  const inactivos = universoResumen.filter((p) => p.estado === 'inactivo').length;
  const finalizados = universoResumen.filter((p) => p.estado === 'finalizado').length;
  const primerNombre = (perfil.nombre || '').split(' ')[0];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Avatar name={perfil.nombre} foto={perfil.foto} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Hola, {primerNombre}</h1>
            <p className="text-navy-500 text-sm mt-1">{rolesLabel(perfil)} · {resumenPersonal ? 'Resumen de tus proyectos asignados' : 'Panel general de proyectos'}</p>
          </div>
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <StatCard label={resumenPersonal ? 'Mis Proyectos' : 'Total Proyectos'} value={total} icon={Layers} accent="border-navy-300" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {misProyectos.slice(0, 3).map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => openProject(p.id)} directorio={directorio} />
        ))}
        {misProyectos.length === 0 && <p className="text-navy-400 text-sm italic col-span-full">No tienes proyectos asignados todavía.</p>}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-navy-800">Revisión de proyectos</h2>
        <button onClick={() => setView('revision')} className="text-sm font-medium text-lime-600 hover:text-lime-700">
          Ver todos →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proyectosRevision.slice(0, 3).map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => openProject(p.id)} directorio={directorio} />
        ))}
        {proyectosRevision.length === 0 && <p className="text-navy-400 text-sm italic col-span-full">No tienes proyectos para aprobar todavía.</p>}
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
          {proyectos.map((p) => {
            const { conteoPorEstado: cpe, total: tot } = computeProjectDocProgress(p);
            const totalSeguido = tot - (cpe['No aplica'] || 0);
            const pctApc = totalSeguido === 0 ? 0 : Math.round(((cpe['Aprobado para construcción (APC)'] || 0) / totalSeguido) * 100);
            const pctEntregado = totalSeguido === 0 ? 0 : Math.round(((cpe['Entregado'] || 0) / totalSeguido) * 100);
            return (
              <button
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                className="flex items-center justify-between gap-2 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-lg px-3 py-2.5 text-left transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-700 truncate">{projectDisplayName(p)}</p>
                  <p className="text-xs text-navy-400 truncate">{p.data.general.municipio}, {p.data.general.departamento}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-navy-500">APC: <span className="font-semibold text-navy-700">{pctApc}%</span></span>
                    <span className="text-xs text-violet-500">Entregado: <span className="font-semibold text-violet-600">{pctEntregado}%</span></span>
                  </div>
                </div>
                <StatusBadge estado={p.estado} size="sm" />
              </button>
            );
          })}
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
  const [editingDatos, setEditingDatos] = useState(false);
  const [datosDraft, setDatosDraft] = useState({
    cedula: persona.cedula || '',
    ciudad_expedicion_cedula: persona.ciudad_expedicion_cedula || '',
    matricula_profesional: persona.matricula_profesional || '',
    celular: persona.celular || '',
    direccion: persona.direccion || '',
    correo_personal: persona.correo_personal || '',
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function guardarFechas() {
    onUpdatePersonaInfo(persona.id, { fecha_cumpleanos: cumpleDraft || null, fecha_ingreso: ingresoDraft || null });
    setEditingFechas(false);
  }
  function guardarDatos() {
    onUpdatePersonaInfo(persona.id, {
      cedula: datosDraft.cedula.trim() || null,
      ciudad_expedicion_cedula: datosDraft.ciudad_expedicion_cedula.trim() || null,
      matricula_profesional: datosDraft.matricula_profesional.trim() || null,
      celular: datosDraft.celular.trim() || null,
      direccion: datosDraft.direccion.trim() || null,
      correo_personal: datosDraft.correo_personal.trim() || null,
    });
    setEditingDatos(false);
  }
  function cancelarDatos() {
    setDatosDraft({
      cedula: persona.cedula || '',
      ciudad_expedicion_cedula: persona.ciudad_expedicion_cedula || '',
      matricula_profesional: persona.matricula_profesional || '',
      celular: persona.celular || '',
      direccion: persona.direccion || '',
      correo_personal: persona.correo_personal || '',
    });
    setEditingDatos(false);
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
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-4">Datos personales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ['cedula', 'Cédula'],
            ['ciudad_expedicion_cedula', 'Ciudad de expedición de la cédula'],
            ['matricula_profesional', 'Matrícula profesional'],
            ['celular', 'Celular'],
            ['direccion', 'Dirección'],
            ['correo_personal', 'Correo'],
          ].map(([key, label]) => (
            <div key={key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{label}</p>
              {editingDatos ? (
                <input
                  value={datosDraft[key]}
                  onChange={(e) => setDatosDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              ) : (
                <p className={persona[key] ? 'text-sm text-navy-700' : 'text-sm text-navy-300 italic'}>
                  {persona[key] || 'Sin definir'}
                </p>
              )}
            </div>
          ))}
          {puedeEditarFechas && (
            <div className="sm:col-span-2 flex gap-2">
              {editingDatos ? (
                <>
                  <button onClick={guardarDatos} className="flex items-center gap-1.5 text-xs font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 px-3 py-1.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Guardar
                  </button>
                  <button onClick={cancelarDatos} className="text-xs text-navy-400 hover:text-navy-600 px-2 py-1.5">
                    Cancelar
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingDatos(true)} className="flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700">
                  <Pencil className="w-3.5 h-3.5" /> Editar datos personales
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
  // Objetos completos (correo/teléfono/NIT/logo) de cada inversionista — se
  // cargan por separado de la lista de nombres de arriba (que no se toca,
  // para no afectar nada de lo que ya depende de ella).
  const [inversionistasDetalle, setInversionistasDetalle] = useState([]);
  const [operadoresRed, setOperadoresRed] = useState([]);
  const [instaladores, setInstaladores] = useState([]);
  const [ingenierosProyectos, setIngenierosProyectos] = useState([]);
  // { [projectId]: isoTimestamp } — solo de MIS visitas, para ordenar "Mis proyectos".
  const [misVisitas, setMisVisitas] = useState({});
  const [paises, setPaises] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [plantillasCimentacion, setPlantillasCimentacion] = useState([]);
  const [plantillasEquipos, setPlantillasEquipos] = useState([]);
  const [plantillasCanalizaciones, setPlantillasCanalizaciones] = useState([]);
  const [plantillasCruces, setPlantillasCruces] = useState([]);
  const [actualizacionCategorias, setActualizacionCategorias] = useState([]);
  const [actualizaciones, setActualizaciones] = useState([]);
  const [misNotificaciones, setMisNotificaciones] = useState([]);
  const [categoriaActualizacionDestino, setCategoriaActualizacionDestino] = useState(null);
  const [diametrosTuberia, setDiametrosTuberia] = useState([]);
  const [mallas, setMallas] = useState([]);
  const [parametrosIngenieria, setParametrosIngenieria] = useState({ recubrimiento: RECUBRIMIENTO_CIMENTACION, barras: BARRA_ACERO, traslapos: TRASLAPO_TABLE });
  const [dataLoaded, setDataLoaded] = useState(false);

  /* La app arranca donde diga la dirección del navegador, no siempre en el
     Dashboard: así un link a /cimentaciones o a /proyecto/<id> abre ahí, y
     recargar la página deja al usuario justo donde estaba. */
  const rutaInicial = estadoDeRuta(window.location.pathname);
  const [view, setViewState] = useState(rutaInicial.view);
  const [previousView, setPreviousView] = useState('dashboard');

  // Conecta el botón "atrás" del navegador con la navegación de la app: en
  // vez de salir de la página, vuelve a la vista anterior (Dashboard, Mis
  // Proyectos, un proyecto abierto, etc.) — igual que esperaría cualquiera
  // que use las flechas del navegador en cualquier otra página.
  useEffect(() => {
    window.history.replaceState(rutaInicial, '', rutaDe(rutaInicial));
    function onPopState(e) {
      /* Si el punto del historial no trae estado (ej. alguien editó la
         dirección a mano), se deduce de la dirección misma. */
      const estado = e.state && e.state.view ? e.state : estadoDeRuta(window.location.pathname);
      setViewState(estado.view);
      setSelectedId(estado.selectedId || null);
      setSelectedPersonId(estado.selectedPersonId || null);
      setSidebarOpen(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [selectedId, setSelectedId] = useState(rutaInicial.selectedId);
  const [selectedPersonId, setSelectedPersonId] = useState(rutaInicial.selectedPersonId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  /* Un link a un proyecto que ya no existe (o que se eliminó desde otro
     computador) no puede dejar la pantalla vacía: apenas terminan de cargar
     los proyectos se vuelve al Dashboard, corrigiendo también la dirección. */
  useEffect(() => {
    if (!dataLoaded || view !== 'detalle' || !selectedId) return;
    if (projects.some((p) => p.id === selectedId)) return;
    setViewState('dashboard');
    setSelectedId(null);
    /* Reemplaza en vez de agregar: el link roto no debe quedar en el
       historial, o el botón "atrás" volvería a él una y otra vez. */
    navegar({ view: 'dashboard' }, { reemplazar: true });
  }, [dataLoaded, view, selectedId, projects]);

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
      // Mis propias notificaciones (RLS ya las filtra por usuario, pero
      // igual filtramos explícito para dejarlo claro).
      const { data: notifRows } = await supabase.from('notificaciones').select('*').eq('usuario_id', ownUserId).order('created_at', { ascending: false }).limit(50);
      setMisNotificaciones(notifRows || []);
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
      setInversionistasDetalle(semilla.map((nombre) => ({ nombre })));
    } else {
      setInversionistas(invRows.map((r) => r.nombre));
      setInversionistasDetalle(invRows);
    }

    const { data: orRows } = await supabase.from('operadores_red').select('*').order('created_at', { ascending: true });
    setOperadoresRed(orRows || []);

    const { data: instRows } = await supabase.from('instaladores').select('*').order('created_at', { ascending: true });
    if (!instRows || instRows.length === 0) {
      await supabase.from('instaladores').insert({ nombre: 'Solenium' }).then(({ error }) => {
        if (error) console.error('Error creando instalador semilla:', error);
      });
      setInstaladores([{ nombre: 'Solenium' }]);
    } else {
      setInstaladores(instRows);
    }

    const { data: ingRows } = await supabase.from('ingenieros_proyectos').select('*').order('created_at', { ascending: true });
    setIngenierosProyectos(ingRows || []);

    if (ownUserId) {
      const { data: visitaRows } = await supabase.from('project_last_view').select('project_id, viewed_at').eq('usuario_id', ownUserId);
      const mapa = {};
      (visitaRows || []).forEach((r) => { mapa[r.project_id] = r.viewed_at; });
      setMisVisitas(mapa);
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

    // Equipos eléctricos: si la tabla está completamente vacía (primera vez
    // que se abre esta pestaña), la sembramos con las 68 plantillas de
    // ejemplo del Excel — mismo criterio que países/proveedores/mallas.
    const { data: equipoRows } = await supabase.from('equipo_plantillas').select('*').order('created_at', { ascending: true });
    if (!equipoRows || equipoRows.length === 0) {
      const semillaEquipos = EQUIPO_SEED.map((s) => ({
        id: makeId('equipo'),
        tipo: s.tipo,
        nombre: s.nombre,
        datos: { especificacion: s.especificacion, atributos: {}, imagen: null },
      }));
      await supabase.from('equipo_plantillas').insert(semillaEquipos).then(({ error }) => {
        if (error) console.error('Error creando plantillas semilla de equipos eléctricos:', error);
      });
      setPlantillasEquipos(semillaEquipos);
    } else {
      setPlantillasEquipos(equipoRows.map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, datos: r.datos || {} })));
    }

    const { data: canalizacionRows } = await supabase.from('canalizacion_plantillas').select('*').order('created_at', { ascending: true });
    const idsExistentes = new Set((canalizacionRows || []).map((r) => r.id));
    const seedFaltante = construirSeedCanalizaciones().filter((s) => !idsExistentes.has(s.id));
    if (seedFaltante.length > 0) {
      // "upsert" en vez de "insert": si por alguna carrera de red ya existieran
      // (ej. dos pestañas abiertas a la vez), no falla — simplemente no las duplica.
      await supabase.from('canalizacion_plantillas').upsert(seedFaltante).then(({ error }) => {
        if (error) console.error('Error creando plantillas semilla de canalizaciones:', error);
      });
      setPlantillasCanalizaciones([...(canalizacionRows || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, datos: r.datos || {}, es_principal: r.es_principal || false })), ...seedFaltante]);
    } else {
      setPlantillasCanalizaciones((canalizacionRows || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, datos: r.datos || {}, es_principal: r.es_principal || false })));
    }

    const { data: diametroRows } = await supabase.from('diametros_tuberia').select('*').order('created_at', { ascending: true });
    if (!diametroRows || diametroRows.length === 0) {
      const semillaDiametros = ['3/4"', '1"', '1 1/4"', '2"', '4"', '6"'];
      await supabase.from('diametros_tuberia').insert(semillaDiametros.map((nombre) => ({ nombre }))).then(({ error }) => {
        if (error) console.error('Error creando diámetros semilla:', error);
      });
      setDiametrosTuberia(semillaDiametros);
    } else {
      setDiametrosTuberia(diametroRows.map((r) => r.nombre));
    }

    const { data: cruceRows } = await supabase.from('cruce_plantillas').select('*').order('created_at', { ascending: true });
    setPlantillasCruces((cruceRows || []).map((r) => ({ id: r.id, nombre: r.nombre, datos: r.datos || {} })));

    const { data: catRows } = await supabase.from('actualizacion_categorias').select('*').order('orden', { ascending: true });
    if (!catRows || catRows.length === 0) {
      const semillaCat = ACTUALIZACION_CATEGORIAS_SEED.map((c, i) => ({ ...c, orden: i }));
      await supabase.from('actualizacion_categorias').insert(semillaCat).then(({ error }) => {
        if (error) console.error('Error creando categorías semilla de actualizaciones:', error);
      });
      setActualizacionCategorias(semillaCat);
    } else {
      setActualizacionCategorias(catRows);
    }
    const { data: actRows } = await supabase.from('actualizaciones').select('*').order('created_at', { ascending: false });
    setActualizaciones((actRows || []).map((r) => ({ id: r.id, categoria_id: r.categoria_id, nombre: r.nombre, descripcion: r.descripcion || '', interesados: r.interesados || [], ubicacion: r.ubicacion || '', etiquetas: r.etiquetas || [], imagen: r.imagen || null, creado_por: r.creado_por, created_at: r.created_at })));

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

  /* Único punto por donde se registra un movimiento en el historial del
     navegador: guarda el estado (para el botón "atrás") y escribe la
     dirección correspondiente (para poder compartir el link). */
  function navegar({ view: vista, selectedId: proyecto = null, selectedPersonId: persona = null }, { reemplazar = false } = {}) {
    const estado = { view: vista, selectedId: proyecto, selectedPersonId: persona };
    const ruta = rutaDe(estado);
    if (reemplazar) window.history.replaceState(estado, '', ruta);
    else window.history.pushState(estado, '', ruta);
  }
  function setView(v) {
    setViewState(v);
    setSelectedId(null);
    setSelectedPersonId(null);
    setSidebarOpen(false);
    navegar({ view: v });
  }
  function openProject(id) {
    setPreviousView(view === 'detalle' ? previousView : view);
    setSelectedId(id);
    setSelectedPersonId(null);
    setViewState('detalle');
    setSidebarOpen(false);
    navegar({ view: 'detalle', selectedId: id });
    registrarVisitaProyecto(id);
  }
  /* La ficha de una persona también es un punto propio del historial (antes
     no lo era): así "atrás" vuelve a la lista del Equipo y el link a una
     ficha se puede compartir. */
  function abrirPersona(id) {
    setSelectedPersonId(id);
    setSidebarOpen(false);
    navegar({ view: 'equipo', selectedPersonId: id });
  }
  function volverAListaEquipo() {
    setSelectedPersonId(null);
    navegar({ view: 'equipo' });
  }
  function verMiPerfil() {
    setViewState('equipo');
    setSelectedId(null);
    setSelectedPersonId(perfil.id);
    setSidebarOpen(false);
    navegar({ view: 'equipo', selectedPersonId: perfil.id });
  }
  /* Deja constancia de que YO abrí este proyecto ahora — solo para poder    */
  /* ordenar "Mis proyectos" por el último con el que interactué (no es un   */
  /* registro de cambios como activity_log, así que no aparece en ningún    */
  /* historial visible).                                                    */
  function registrarVisitaProyecto(id) {
    if (!perfil?.id) return;
    const ahora = new Date().toISOString();
    setMisVisitas((prev) => ({ ...prev, [id]: ahora }));
    supabase.from('project_last_view').upsert({ usuario_id: perfil.id, project_id: id, viewed_at: ahora }).then(({ error }) => {
      if (error) console.error('Error registrando visita al proyecto:', error);
    });
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

  /* Avisa a todo el equipo ASIGNADO de un proyecto (menos a quien hizo el   */
  /* cambio) cuando alguien más edita algo — mismo criterio de "asignado"    */
  /* que el resto de la app (equipoNombres ya excluye aprobador/ingeniero   */
  /* de proyectos, que no son parte del equipo que trabaja el proyecto).    */
  async function crearNotificacionesProyecto(project, accion) {
    if (!accion || !perfil) return;
    const asignados = equipoNombres(project.equipo);
    const destinatarios = directorio.filter((p) => p.id !== perfil.id && asignados.includes(p.nombre));
    if (destinatarios.length === 0) return;
    const accionMinuscula = accion.charAt(0).toLowerCase() + accion.slice(1);
    const filas = destinatarios.map((p) => ({
      id: makeId('notif'),
      usuario_id: p.id,
      tipo: 'proyecto',
      mensaje: `${perfil.nombre} ${accionMinuscula} en "${project.nombre}"`,
      proyecto_id: project.id,
      leida: false,
    }));
    const { error } = await supabase.from('notificaciones').insert(filas);
    if (error) console.error('Error creando notificaciones de proyecto:', error);
  }

  /* Avisa a quien tenga alguno de los roles marcados como "interesados" en */
  /* una actualización recién creada (menos a quien la creó).               */
  async function crearNotificacionesActualizacion(actualizacionId, categoriaId, interesados, nombreActualizacion) {
    if (!interesados || interesados.length === 0 || !perfil) return;
    const destinatarios = directorio.filter((p) => p.id !== perfil.id && (p.roles || []).some((r) => interesados.includes(r)));
    if (destinatarios.length === 0) return;
    const filas = destinatarios.map((p) => ({
      id: makeId('notif'),
      usuario_id: p.id,
      tipo: 'actualizacion',
      mensaje: `${perfil.nombre} agregó una actualización de diseño: "${nombreActualizacion}"`,
      actualizacion_id: actualizacionId,
      categoria_actualizacion_id: categoriaId,
      leida: false,
    }));
    const { error } = await supabase.from('notificaciones').insert(filas);
    if (error) console.error('Error creando notificaciones de actualización:', error);
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
    if (updatedProject) crearNotificacionesProyecto(updatedProject, accion);
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
        navegar({ view: previousView });
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
    setInversionistasDetalle((prev) => (prev.some((i) => i.nombre === limpio) ? prev : [...prev, { nombre: limpio }]));
    supabase.from('inversionistas').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando inversionista:', error);
    });
  }
  function handleAddOperadorRed(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setOperadoresRed((prev) => (prev.some((o) => o.nombre === limpio) ? prev : [...prev, { nombre: limpio }]));
    supabase.from('operadores_red').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando operador de red:', error);
    });
  }
  function handleAddInstalador(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setInstaladores((prev) => (prev.some((i) => i.nombre === limpio) ? prev : [...prev, { nombre: limpio }]));
    supabase.from('instaladores').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando instalador:', error);
    });
  }
  function handleAddIngenieroProyectos(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setIngenierosProyectos((prev) => (prev.some((i) => i.nombre === limpio) ? prev : [...prev, { nombre: limpio }]));
    supabase.from('ingenieros_proyectos').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando ingeniero de proyectos:', error);
    });
  }
  /* Actualiza un atributo (correo, NIT, logo, matrícula…) de UNA fila de un  */
  /* catálogo compartido (inversionistas/operadores_red/instaladores/        */
  /* ingenieros_proyectos) — se refleja en todos los proyectos que usen ese  */
  /* mismo nombre, ya que no es un dato del proyecto sino de la entidad.     */
  function handleUpdateCatalogoAtributo(tabla, nombre, campo, valor) {
    const setters = {
      inversionistas: setInversionistasDetalle,
      operadores_red: setOperadoresRed,
      instaladores: setInstaladores,
      ingenieros_proyectos: setIngenierosProyectos,
    };
    const setter = setters[tabla];
    if (!setter) return;
    setter((prev) => prev.map((row) => (row.nombre === nombre ? { ...row, [campo]: valor } : row)));
    supabase.from(tabla).update({ [campo]: valor }).eq('nombre', nombre).then(({ error }) => {
      if (error) {
        console.error(`Error actualizando ${campo} de ${nombre} en ${tabla}:`, error);
        alert('No se pudo guardar este dato. Detalle: ' + error.message);
      }
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
  function handleAddPlantillaEquipo(tipo, nombre, datos) {
    const nueva = { id: makeId('equipo'), tipo, nombre, datos };
    setPlantillasEquipos((prev) => [...prev, nueva]);
    supabase.from('equipo_plantillas').insert({ id: nueva.id, tipo, nombre, datos, creado_por: perfil?.nombre || null }).then(({ error }) => {
      if (error) {
        console.error('Error creando plantilla de equipo eléctrico:', error);
        alert('No se pudo guardar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  function handleUpdatePlantillaEquipo(id, patch) {
    setPlantillasEquipos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    supabase.from('equipo_plantillas').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error editando plantilla de equipo eléctrico:', error);
        alert('No se pudo guardar el cambio. Detalle: ' + error.message);
      }
    });
  }
  function handleDeletePlantillaEquipo(id) {
    setPlantillasEquipos((prev) => prev.filter((p) => p.id !== id));
    supabase.from('equipo_plantillas').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando plantilla de equipo eléctrico:', error);
        alert('No se pudo eliminar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  /* "es_principal": al crear/marcar una plantilla como principal, primero    */
  /* desmarca cualquier otra del MISMO tipo (nunca puede haber 2 principales  */
  /* a la vez para un mismo tipo de canalización).                           */
  function handleAddDiametro(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setDiametrosTuberia((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    supabase.from('diametros_tuberia').upsert({ nombre: limpio }).then(({ error }) => {
      if (error) console.error('Error creando diámetro de tubería:', error);
    });
  }
  function handleAddPlantillaCanalizacion(tipo, nombre, datos, esPrincipal) {
    const nueva = { id: makeId('canal'), tipo, nombre, datos, es_principal: !!esPrincipal };
    const key = subcategoriaKey(tipo, datos);
    // "Principal" es por sub-categoría (mismo tipo + mismo diámetro/cantidad
    // o calibre), no por todo el tipo — así puede haber una "DC 2" × 2
    // tuberías" principal a 0.45 m sin afectar una "DC 2" × 3 tuberías".
    const idsAUnDesmarcar = esPrincipal
      ? plantillasCanalizaciones.filter((p) => p.es_principal && subcategoriaKey(p.tipo, p.datos) === key).map((p) => p.id)
      : [];
    setPlantillasCanalizaciones((prev) => {
      const resto = idsAUnDesmarcar.length > 0 ? prev.map((p) => (idsAUnDesmarcar.includes(p.id) ? { ...p, es_principal: false } : p)) : prev;
      return [...resto, nueva];
    });
    if (idsAUnDesmarcar.length > 0) {
      supabase.from('canalizacion_plantillas').update({ es_principal: false }).in('id', idsAUnDesmarcar).then(() => {});
    }
    supabase.from('canalizacion_plantillas').insert({ id: nueva.id, tipo, nombre, datos, es_principal: !!esPrincipal, creado_por: perfil?.nombre || null }).then(({ error }) => {
      if (error) {
        console.error('Error creando plantilla de canalización:', error);
        alert('No se pudo guardar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  function handleUpdatePlantillaCanalizacion(id, patch, esPrincipal, tipo) {
    const key = subcategoriaKey(tipo, patch.datos);
    const idsAUnDesmarcar = esPrincipal
      ? plantillasCanalizaciones.filter((p) => p.id !== id && p.es_principal && subcategoriaKey(p.tipo, p.datos) === key).map((p) => p.id)
      : [];
    setPlantillasCanalizaciones((prev) => prev.map((p) => {
      if (idsAUnDesmarcar.includes(p.id)) return { ...p, es_principal: false };
      if (p.id === id) return { ...p, ...patch, es_principal: !!esPrincipal };
      return p;
    }));
    if (idsAUnDesmarcar.length > 0) {
      supabase.from('canalizacion_plantillas').update({ es_principal: false }).in('id', idsAUnDesmarcar).then(() => {});
    }
    supabase.from('canalizacion_plantillas').update({ ...patch, es_principal: !!esPrincipal, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error editando plantilla de canalización:', error);
        alert('No se pudo guardar el cambio. Detalle: ' + error.message);
      }
    });
  }
  function handleDeletePlantillaCanalizacion(id) {
    setPlantillasCanalizaciones((prev) => prev.filter((p) => p.id !== id));
    supabase.from('canalizacion_plantillas').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando plantilla de canalización:', error);
        alert('No se pudo eliminar la plantilla. Detalle: ' + error.message);
      }
    });
  }
  function handleSetPrincipalCanalizacion(id, tipo, datos) {
    const key = subcategoriaKey(tipo, datos);
    const idsAUnDesmarcar = plantillasCanalizaciones
      .filter((p) => p.id !== id && p.es_principal && subcategoriaKey(p.tipo, p.datos) === key)
      .map((p) => p.id);
    setPlantillasCanalizaciones((prev) => prev.map((p) => {
      if (p.id === id) return { ...p, es_principal: true };
      if (idsAUnDesmarcar.includes(p.id)) return { ...p, es_principal: false };
      return p;
    }));
    const desmarcar = idsAUnDesmarcar.length > 0
      ? supabase.from('canalizacion_plantillas').update({ es_principal: false }).in('id', idsAUnDesmarcar)
      : Promise.resolve({ error: null });
    desmarcar.then(() => {
      supabase.from('canalizacion_plantillas').update({ es_principal: true }).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Error marcando plantilla principal:', error);
          alert('No se pudo marcar como Principal. Detalle: ' + error.message);
        }
      });
    });
  }
  function handleAddCruce(nombre, datos) {
    const nueva = { id: makeId('cruce'), nombre, datos };
    setPlantillasCruces((prev) => [...prev, nueva]);
    supabase.from('cruce_plantillas').insert({ id: nueva.id, nombre, datos, creado_por: perfil?.nombre || null }).then(({ error }) => {
      if (error) {
        console.error('Error creando cruce:', error);
        alert('No se pudo guardar el cruce. Detalle: ' + error.message);
      }
    });
  }
  function handleUpdateCruce(id, patch) {
    setPlantillasCruces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    supabase.from('cruce_plantillas').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error editando cruce:', error);
        alert('No se pudo guardar el cambio. Detalle: ' + error.message);
      }
    });
  }
  function handleDeleteCruce(id) {
    setPlantillasCruces((prev) => prev.filter((p) => p.id !== id));
    supabase.from('cruce_plantillas').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando cruce:', error);
        alert('No se pudo eliminar el cruce. Detalle: ' + error.message);
      }
    });
  }
  function handleAddCategoriaActualizacion(nombre) {
    const nueva = { id: makeId('actcat'), nombre, orden: actualizacionCategorias.length };
    setActualizacionCategorias((prev) => [...prev, nueva]);
    supabase.from('actualizacion_categorias').insert(nueva).then(({ error }) => {
      if (error) {
        console.error('Error creando categoría de actualizaciones:', error);
        alert('No se pudo crear la categoría. Detalle: ' + error.message);
      }
    });
  }
  function handleRenameCategoriaActualizacion(id, nombre) {
    setActualizacionCategorias((prev) => prev.map((c) => (c.id === id ? { ...c, nombre } : c)));
    supabase.from('actualizacion_categorias').update({ nombre }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error renombrando categoría de actualizaciones:', error);
        alert('No se pudo renombrar la categoría. Detalle: ' + error.message);
      }
    });
  }
  function handleDeleteCategoriaActualizacion(id) {
    setActualizacionCategorias((prev) => prev.filter((c) => c.id !== id));
    setActualizaciones((prev) => prev.filter((a) => a.categoria_id !== id)); // la BD ya cascadea, esto es solo para que la UI no espere al refresh
    supabase.from('actualizacion_categorias').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando categoría de actualizaciones:', error);
        alert('No se pudo eliminar la categoría. Detalle: ' + error.message);
      }
    });
  }
  function handleAddActualizacion(categoriaId, datos) {
    const nueva = { id: makeId('act'), categoria_id: categoriaId, ...datos, creado_por: perfil?.nombre || null, created_at: new Date().toISOString() };
    setActualizaciones((prev) => [nueva, ...prev]);
    supabase.from('actualizaciones').insert({ id: nueva.id, categoria_id: categoriaId, nombre: datos.nombre, descripcion: datos.descripcion, interesados: datos.interesados, ubicacion: datos.ubicacion, etiquetas: datos.etiquetas, imagen: datos.imagen, creado_por: perfil?.nombre || null }).then(({ error }) => {
      if (error) {
        console.error('Error creando actualización:', error);
        alert('No se pudo guardar la actualización. Detalle: ' + error.message);
      }
    });
    crearNotificacionesActualizacion(nueva.id, categoriaId, datos.interesados, datos.nombre);
  }
  function handleUpdateActualizacion(id, datos) {
    setActualizaciones((prev) => prev.map((a) => (a.id === id ? { ...a, ...datos } : a)));
    supabase.from('actualizaciones').update(datos).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error editando actualización:', error);
        alert('No se pudo guardar el cambio. Detalle: ' + error.message);
      }
    });
  }
  function handleDeleteActualizacion(id) {
    setActualizaciones((prev) => prev.filter((a) => a.id !== id));
    supabase.from('actualizaciones').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Error eliminando actualización:', error);
        alert('No se pudo eliminar la actualización. Detalle: ' + error.message);
      }
    });
  }
  function handleMarcarNotificacionLeida(id) {
    setMisNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    supabase.from('notificaciones').update({ leida: true }).eq('id', id).then(({ error }) => {
      if (error) console.error('Error marcando notificación como leída:', error);
    });
  }
  /* Al hacer clic en una notificación: la marca como leída y navega al       */
  /* lugar en cuestión — el proyecto (si es de tipo "proyecto"), o la         */
  /* categoría correspondiente en Actualizaciones (si es de ese tipo).       */
  function handleAbrirNotificacion(n) {
    if (!n.leida) handleMarcarNotificacionLeida(n.id);
    if (n.tipo === 'proyecto' && n.proyecto_id) {
      openProject(n.proyecto_id);
    } else if (n.tipo === 'actualizacion') {
      setCategoriaActualizacionDestino(n.categoria_actualizacion_id || null);
      setView('actualizaciones');
      setSidebarOpen(false);
    }
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

  const misProyectos = projects
    .filter((p) => equipoNombres(p.equipo).includes(perfil.nombre))
    .sort((a, b) => new Date(misVisitas[b.id] || b.created_at || 0) - new Date(misVisitas[a.id] || a.created_at || 0));
  const proyectosRevision = projects.filter((p) => esAprobadorDe(perfil, p));
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
        onViewMyProfile={verMiPerfil}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        notificaciones={misNotificaciones}
        onAbrirNotificacion={handleAbrirNotificacion}
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
          <p className="text-white font-bold text-sm flex-1">Sun Design Suite</p>
          <NotificationBell notificaciones={misNotificaciones} onAbrirNotificacion={handleAbrirNotificacion} dark />
        </div>
        {/* Las secciones pesadas se descargan al abrirlas (ver SECCIONES). */}
        <Suspense fallback={<LoadingScreen mensaje="Cargando sección…" />}>
        {view === 'dashboard' && (
          <Dashboard
            projects={projects}
            misProyectos={misProyectos}
            proyectosRevision={proyectosRevision}
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
        {view === 'revision' && (
          <ProjectListView
            projects={proyectosRevision}
            title="Revisión de Proyectos"
            subtitle={`Proyectos donde ${perfil.nombre} es revisor eléctrico`}
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
        {view === 'equipos_electricos' && (
          <EquiposElectricosView
            plantillas={plantillasEquipos}
            onAdd={handleAddPlantillaEquipo}
            onUpdate={handleUpdatePlantillaEquipo}
            onDelete={handleDeletePlantillaEquipo}
          />
        )}
        {view === 'canalizaciones' && (
          <CanalizacionesView
            plantillas={plantillasCanalizaciones}
            onAdd={handleAddPlantillaCanalizacion}
            onUpdate={handleUpdatePlantillaCanalizacion}
            onDelete={handleDeletePlantillaCanalizacion}
            onSetPrincipal={handleSetPrincipalCanalizacion}
            diametrosTuberia={diametrosTuberia}
            onAddDiametro={handleAddDiametro}
            perfil={perfil}
          />
        )}
        {view === 'cruces' && (
          <CrucesView
            plantillas={plantillasCruces}
            plantillasCanalizaciones={plantillasCanalizaciones}
            onAdd={handleAddCruce}
            onUpdate={handleUpdateCruce}
            onDelete={handleDeleteCruce}
            perfil={perfil}
          />
        )}
        {view === 'actualizaciones' && (
          <ActualizacionesView
            categorias={actualizacionCategorias}
            actualizaciones={actualizaciones}
            perfil={perfil}
            onAddCategoria={handleAddCategoriaActualizacion}
            onRenameCategoria={handleRenameCategoriaActualizacion}
            onDeleteCategoria={handleDeleteCategoriaActualizacion}
            onAdd={handleAddActualizacion}
            onUpdate={handleUpdateActualizacion}
            onDelete={handleDeleteActualizacion}
            categoriaPreseleccionada={categoriaActualizacionDestino}
          />
        )}
        {view === 'equipo' && (
          <EquipoView
            directorio={directorio}
            perfil={perfil}
            projects={projects}
            selectedPersonId={selectedPersonId}
            onOpenPerson={abrirPersona}
            onBackToList={volverAListaEquipo}
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
            plantillasCimentacion={plantillasCimentacion}
            plantillasEquipos={plantillasEquipos}
            inversionistasDetalle={inversionistasDetalle}
            operadoresRed={operadoresRed}
            onAddOperadorRed={handleAddOperadorRed}
            instaladores={instaladores}
            onAddInstalador={handleAddInstalador}
            ingenierosProyectos={ingenierosProyectos}
            onAddIngenieroProyectos={handleAddIngenieroProyectos}
            onUpdateCatalogoAtributo={handleUpdateCatalogoAtributo}
          />
        )}
        </Suspense>
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
