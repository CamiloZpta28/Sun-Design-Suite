/* ============================================================================
   FICHA DE UN PROYECTO
   ----------------------------------------------------------------------------
   Todo lo que se ve al abrir un proyecto: sus pestañas técnicas (dibujadas a
   partir de SCHEMA), Control Documental, Notas, Historial, Notas Técnicas y
   la hoja de vida imprimible. Movido literal desde App.jsx.

   Se descarga al abrir el primer proyecto, no al entrar a la aplicación:
   quien solo mira el Dashboard, Actualizaciones o Instructivos nunca lo baja.
   ============================================================================ */

import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import {
  AlertTriangle, Bold, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck,
  ClipboardList, FileText, Folder, History, Italic, List, Lock, MessageSquare, Package, Pencil,
  Plus, Printer, RefreshCw, Save, StickyNote, Trash2, Underline, UploadCloud, Users, X,
  XCircle, Zap,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import logoMark from '../assets/logo-s-mark.png';
import SelectOrOtro from '../technical-notes/SelectOrOtro.jsx';
import TechnicalNotesPanel from '../technical-notes/TechnicalNotesPanel.jsx';
import { isBlank } from '../technical-notes/formatters.js';
import { allFieldGroups, allGroupedFieldKeys, displayLabelFor, groupToOpenFor, requiresAccordion } from '../technical-notes/fieldGroups.js';
import { STRUCTURE_LABELS, getStructureType } from '../technical-notes/index.js';
import {
  ROLES, equipoComoArray, equipoNombres, equipoTexto, isAssignedToProject, isDeveloper,
  isLeader, isQA,
} from '../shared/permisos.js';
import { ResumenLineas, atributosLineas } from '../shared/ui.jsx';
import { usePresenciaProyecto, quienEdita, PresenciaBarra, AvisoPestanaOcupada } from '../shared/presencia.jsx';
import {
  camposPlegables, MESES_ENERGIA, COLOMBIA, DOC_ESTADOS, DOC_ESTADO_CONFIG, DOC_ESTADO_CORTO, EquipoField, EquipoSelect,
  EspecialidadBarra, GRUPO_NOTAS_TECNICAS, IngenieroProyectosField, InstaladorPicker,
  InversionistaPicker, OperadorRedPicker, PaisPicker, ProgresoDonut, ProveedorPicker,
  SCHEMA, STATUS_CONFIG, StatusBadge, buildProjectCode, categoriaLabel, dossierPorEspecialidad,
  requiereSupervisionTecnica, emptyEnergiaMensual,
  emptyStations, formatDate, formatDateTime, inicioDeSemana, makeId, normalizeUrl,
  pickDocumentList, projectDisplayName, tieneValorParaConteo,
} from '../shared/dominio.jsx';
import { CIMENTACION_TIPOS, CIMENTACION_RESUMENES } from './cimentacionesDatos.js';
import { EQUIPO_TIPOS, EquipoIcono } from './equiposDatos.jsx';
import SupervisionTecnicaPanel from './SupervisionTecnica.jsx';

/* El dibujo de la plantilla de cimentación elegida en una pestaña técnica.
   Llega aparte —igual que en App.jsx— para que abrir un proyecto no baje los
   162 kB de dibujos de Cimentaciones si esa pestaña no tiene ninguna puesta. */
const PreviewPlantillaCimentacion = lazy(() => import('./Cimentaciones.jsx').then((m) => ({ default: m.PreviewPlantilla })));


/* --------------------- FORMATO DE TEXTO EN NOTAS (mini-sintaxis) ----------- */
/* **negrilla**, *cursiva*, __subrayado__ y líneas que empiezan con "- " para  */
/* viñetas. Se guarda como texto plano (no HTML) y se interpreta solo al       */
/* mostrarlo, para no tener que confiar en HTML crudo guardado por el usuario. */
export function renderNoteInline(text, keyPrefix) {
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

export function renderNoteText(texto) {
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

export function diffSectionData(section, before, after) {
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
    } else if (field.type === 'stations' || field.type === 'modulos_inversor' || field.type === 'energia_mensual') {
      if (JSON.stringify(b || []) !== JSON.stringify(a || [])) {
        cambios.push(`${field.label}: se actualizó la tabla`);
      }
    } else if (field.type === 'grupo_titulo') {
      // encabezado visual, no guarda datos propios — nada que comparar
    } else if ((b || '') !== (a || '')) {
      cambios.push(`${field.label}: "${b || '—'}" → "${a || '—'}"`);
    }
  });
  return cambios;
}

/* Animación de celebración (confeti + 🎉) cuando un proyecto pasa a         */
/* "Finalizado". Puramente visual y pasajera — no aparece en la hoja de vida */
/* imprimible (usa .no-print).                                              */
export const CONFETTI_COLORES = ['#E2FF65', '#8CC3E1', '#152644', '#10B981', '#C2E723', '#61A9D1', '#F59E0B'];

export function Confetti() {
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

export function ReadOnlyValue({ label, value, mono = true }) {
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

/* Convierte grados decimales a grados-minutos-segundos, ej. 4.70432 ->      */
/* 4°42'15.5"N. "esLatitud" decide si el hemisferio es N/S (latitud) o       */
/* E/O (longitud).                                                          */
export function decimalAGMS(decimal, esLatitud) {
  if (decimal === null || decimal === undefined || Number.isNaN(decimal)) return '';
  const abs = Math.abs(decimal);
  const grados = Math.floor(abs);
  const minutosDecimales = (abs - grados) * 60;
  const minutos = Math.floor(minutosDecimales);
  const segundos = (minutosDecimales - minutos) * 60;
  const hemisferio = esLatitud ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'O');
  return `${grados}°${minutos}'${segundos.toFixed(1)}"${hemisferio}`;
}

export function FieldRenderer({
  field, value, editMode, onChange, siblingData, inversionistas, onAddInversionista, paises, onAddPais,
  proveedores, onAddProveedor, plantillasCimentacion, plantillasEquipos,
  inversionistasDetalle, operadoresRed, onAddOperadorRed, instaladores, onAddInstalador,
  ingenierosProyectos, onUpdateCatalogoAtributo,
}) {
  if (field.type === 'coordenadas') {
    // Se guarda como "lat, lng" en grados decimales (texto plano, para que
    // cualquier otro lugar que muestre este campo — impresión, exportes —
    // lo siga viendo como texto normal sin tener que cambiar nada más).
    const partes = (value || '').split(',').map((s) => s.trim());
    const latTexto = partes[0] || '';
    const lngTexto = partes[1] || '';
    const latNum = latTexto !== '' && !Number.isNaN(parseFloat(latTexto)) ? parseFloat(latTexto) : null;
    const lngNum = lngTexto !== '' && !Number.isNaN(parseFloat(lngTexto)) ? parseFloat(lngTexto) : null;
    const gms = (latNum !== null && lngNum !== null) ? `${decimalAGMS(latNum, true)}  ${decimalAGMS(lngNum, false)}` : '';

    if (!editMode) {
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{field.label}</p>
          {value ? (
            <>
              <p className="text-sm text-navy-700 font-mono">{value}</p>
              {gms && <p className="text-xs text-navy-400 mt-0.5">{gms}</p>}
            </>
          ) : (
            <p className="text-sm text-navy-300 italic">Sin definir</p>
          )}
        </div>
      );
    }
    const baseInputCoord = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm text-navy-800 font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-navy-400 mb-0.5">Latitud (grados decimales)</label>
            <input
              type="text" inputMode="decimal" placeholder="Ej. 4.70432" className={baseInputCoord}
              value={latTexto} onChange={(e) => onChange(`${e.target.value}, ${lngTexto}`)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-navy-400 mb-0.5">Longitud (grados decimales)</label>
            <input
              type="text" inputMode="decimal" placeholder="Ej. -74.05030" className={baseInputCoord}
              value={lngTexto} onChange={(e) => onChange(`${latTexto}, ${e.target.value}`)}
            />
          </div>
        </div>
        {gms && <p className="text-xs text-navy-500 mt-1.5">≈ {gms}</p>}
      </div>
    );
  }

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

  if (field.type === 'operador_red') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <OperadorRedPicker value={value} operadoresRed={operadoresRed} onChange={onChange} onAddNew={onAddOperadorRed} />
      </div>
    );
  }

  if (field.type === 'instalador') {
    if (!editMode) return <ReadOnlyValue label={field.label} value={value} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <InstaladorPicker value={value} instaladores={instaladores} onChange={onChange} onAddNew={onAddInstalador} />
      </div>
    );
  }

  if (field.type === 'catalogo_atributo') {
    // No es un dato del proyecto: es un atributo de LA ENTIDAD elegida en
    // otro campo de esta misma sección (field.dependeDe) — ej. el correo del
    // inversionista, el logo del operador de red, el NIT del instalador. Se
    // guarda en la tabla del catálogo (field.catalogo), no en projects.data.
    const catalogos = { inversionistas: inversionistasDetalle, operadores_red: operadoresRed, instaladores, ingenieros_proyectos: ingenierosProyectos };
    const lista = catalogos[field.catalogo] || [];
    const nombreSeleccionado = siblingData ? siblingData[field.dependeDe] : '';
    const fila = lista.find((r) => r.nombre === nombreSeleccionado);
    const valorAtributo = fila ? fila[field.campoAtributo] : '';

    if (!nombreSeleccionado) {
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{field.label}</p>
          <p className="text-sm text-navy-300 italic">Elige primero "{field.dependeDeLabel || field.dependeDe}"</p>
        </div>
      );
    }

    function guardarAtributo(nuevoValor) {
      onUpdateCatalogoAtributo(field.catalogo, nombreSeleccionado, field.campoAtributo, nuevoValor);
    }

    /* Atributo de Sí/No del catálogo (ej. si las entregas de este
       inversionista pasan por Supervisión técnica). Como cualquier otro
       atributo, el valor es del inversionista y se refleja en TODOS sus
       proyectos, no solo en este. */
    if (field.esBooleano) {
      const texto = valorAtributo ? 'Sí' : 'No';
      if (!editMode) return <ReadOnlyValue label={field.label} value={texto} mono={false} />;
      return (
        <div className="py-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
          <select
            value={valorAtributo ? 'si' : 'no'}
            onChange={(e) => guardarAtributo(e.target.value === 'si')}
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
          <p className="text-[11px] text-navy-400 mt-1">
            Este dato pertenece a "{nombreSeleccionado}" — se refleja en todos sus proyectos.
          </p>
        </div>
      );
    }

    if (field.esImagen) {
      if (!editMode) {
        return (
          <div className="py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-1">{field.label}</p>
            {valorAtributo ? (
              <img src={valorAtributo} alt={field.label} className="max-h-16 rounded border border-navy-200 object-contain" />
            ) : (
              <p className="text-sm text-navy-300 italic">Sin definir</p>
            )}
          </div>
        );
      }
      return (
        <div className="py-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
          <div className="flex items-center gap-3">
            {valorAtributo && <img src={valorAtributo} alt={field.label} className="max-h-12 rounded border border-navy-200 object-contain" />}
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700 cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5" />
              {valorAtributo ? 'Cambiar imagen' : 'Subir imagen'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => guardarAtributo(reader.result);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </label>
            {valorAtributo && (
              <button
                type="button"
                onClick={() => guardarAtributo(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar imagen
              </button>
            )}
          </div>
          <p className="text-[11px] text-navy-400 mt-1">Este dato pertenece a "{nombreSeleccionado}" — se refleja en todos sus proyectos.</p>
        </div>
      );
    }

    if (!editMode) return <ReadOnlyValue label={field.label} value={valorAtributo} mono={false} />;
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <input
          value={valorAtributo || ''}
          onChange={(e) => guardarAtributo(e.target.value)}
          className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
        />
        <p className="text-[11px] text-navy-400 mt-1">Este dato pertenece a "{nombreSeleccionado}" — se refleja en todos sus proyectos.</p>
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

  if (field.type === 'grupo_titulo') {
    // Encabezado visual (sin valor propio) para separar sub-secciones dentro
    // de una pestaña — nivel 1 = título de la subcategoría completa (ej.
    // "Cerramiento"), nivel 2 = cada sub-subcategoría dentro de ella.
    return field.nivel === 1 ? (
      <p className="text-sm font-bold uppercase tracking-wide text-navy-800 mt-2">{field.label}</p>
    ) : (
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 pt-3 mt-1 border-t border-navy-100">{field.label}</p>
    );
  }

  if (field.type === 'cimentacion_plantilla') {
    const plantillasDelTipo = (plantillasCimentacion || []).filter((p) => p.tipo === field.tipoCimentacion);
    const seleccionada = plantillasDelTipo.find((p) => p.id === value);
    const tipoDef = CIMENTACION_TIPOS.find((t) => t.id === field.tipoCimentacion);
    const resumenDeLaPlantilla = CIMENTACION_RESUMENES[field.tipoCimentacion];

    /* El dibujo llega aparte (ver PreviewPlantillaCimentacion): mientras
       tanto se deja el recuadro gris vacío, del mismo tamaño, para que la
       pestaña no dé un salto cuando aparece. */
    const previewBox = seleccionada ? (
      <div className="w-36 h-32 shrink-0 flex items-center justify-center bg-navy-50 rounded-lg overflow-hidden">
        <Suspense fallback={null}>
          <PreviewPlantillaCimentacion tipo={seleccionada.tipo} datos={seleccionada.datos} />
        </Suspense>
      </div>
    ) : null;

    if (!editMode) {
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          {seleccionada ? (
            <div className="flex items-center gap-4">
              {previewBox}
              <div>
                <p className="text-sm text-navy-700 font-semibold mb-1">{seleccionada.nombre}</p>
                <ResumenLineas lineas={resumenDeLaPlantilla(seleccionada.datos)} size="text-sm" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-300 italic">Sin plantilla seleccionada</p>
          )}
        </div>
      );
    }

    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2">{field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 mb-2"
        >
          <option value="">— Ninguna —</option>
          {plantillasDelTipo.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        {plantillasDelTipo.length === 0 ? (
          <p className="text-xs text-navy-400 italic">Aún no hay plantillas de {tipoDef?.label} en Cimentaciones.</p>
        ) : seleccionada ? (
          <div className="flex items-center gap-4 mt-2">
            {previewBox}
            <ResumenLineas lineas={resumenDeLaPlantilla(seleccionada.datos)} size="text-sm" />
          </div>
        ) : null}
      </div>
    );
  }

  if (field.type === 'equipo_plantilla') {
    const plantillasDelTipo = (plantillasEquipos || []).filter((p) => p.tipo === field.tipoEquipo);
    const seleccionada = plantillasDelTipo.find((p) => p.id === value);
    const tipoDef = EQUIPO_TIPOS.find((t) => t.id === field.tipoEquipo);

    const previewBox = seleccionada ? (
      <div className="w-32 h-32 shrink-0 flex items-center justify-center bg-navy-50 rounded-lg overflow-hidden">
        {seleccionada.datos?.imagen ? (
          <img src={seleccionada.datos.imagen} alt={seleccionada.nombre} className="max-h-full max-w-full object-contain" />
        ) : (
          <EquipoIcono tipoId={seleccionada.tipo} className="w-28 h-28" />
        )}
      </div>
    ) : null;

    if (!editMode) {
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          {seleccionada ? (
            <div className="flex items-center gap-4">
              {previewBox}
              <div>
                <p className="text-sm text-navy-700 font-semibold mb-1">{seleccionada.nombre}</p>
                <ResumenLineas lineas={atributosLineas(seleccionada.datos)} size="text-sm" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-300 italic">Sin plantilla seleccionada</p>
          )}
        </div>
      );
    }

    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2">{field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 mb-2"
        >
          <option value="">— Ninguno —</option>
          {plantillasDelTipo.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        {plantillasDelTipo.length === 0 ? (
          <p className="text-xs text-navy-400 italic">Aún no hay plantillas de {tipoDef?.label} en Equipos eléctricos.</p>
        ) : seleccionada ? (
          <div className="flex items-center gap-4 mt-2">
            {previewBox}
            <ResumenLineas lineas={atributosLineas(seleccionada.datos)} size="text-sm" />
          </div>
        ) : null}
      </div>
    );
  }

  if (field.type === 'energia_mensual') {
    // 3 columnas independientes (nadie se calcula de las otras — se
    // confirmó con los datos reales que "Total" no es Inyectada+Consumida),
    // 12 filas fijas (una por mes) + una fila de totales, que sí es la suma
    // de cada columna.
    const filas = Array.isArray(value) && value.length === 12 ? value : emptyEnergiaMensual();
    const sumaCol = (campo) => filas.reduce((acc, f) => acc + (parseFloat(f?.[campo]) || 0), 0);
    const totalInyectada = sumaCol('inyectada');
    const totalConsumida = sumaCol('consumida');
    const totalTotal = sumaCol('total');
    const encabezados = ['Mes', 'Energía Inyectada [kWh-mes]', 'Energía Consumida [kWh-mes]', 'Energía Total [kWh-mes]'];

    if (!editMode) {
      const conDatos = filas.some((f) => f?.inyectada || f?.consumida || f?.total);
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          {!conDatos ? (
            <p className="text-sm text-navy-300 italic">Sin definir</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-navy-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-navy-50">
                    {encabezados.map((h) => (
                      <th key={h} className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MESES_ENERGIA.map((mes, i) => (
                    <tr key={mes} className="border-b border-navy-100 last:border-b-0">
                      <td className="px-3 py-1.5 font-mono text-navy-700">{mes}</td>
                      <td className="px-3 py-1.5 font-mono text-navy-700">{filas[i]?.inyectada || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-navy-700">{filas[i]?.consumida || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-navy-700">{filas[i]?.total || '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-navy-50">
                    <td className="px-3 py-1.5 font-bold text-navy-800">Total</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-navy-800">{totalInyectada}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-navy-800">{totalConsumida}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-navy-800">{totalTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    function updateFilaEnergia(i, campo, val) {
      const next = filas.map((f, idx) => (idx === i ? { ...f, [campo]: val } : f));
      onChange(next);
    }
    const cellInputE = 'w-full rounded-md border border-navy-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-navy-200 rounded-lg">
            <thead>
              <tr className="bg-navy-50">
                {encabezados.map((h) => (
                  <th key={h} className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES_ENERGIA.map((mes, i) => (
                <tr key={mes} className="border-b border-navy-100 last:border-b-0">
                  <td className="px-2 py-1.5 font-mono text-navy-500">{mes}</td>
                  <td className="p-1.5">
                    <input type="text" className={cellInputE} value={filas[i]?.inyectada || ''} onChange={(e) => updateFilaEnergia(i, 'inyectada', e.target.value)} />
                  </td>
                  <td className="p-1.5">
                    <input type="text" className={cellInputE} value={filas[i]?.consumida || ''} onChange={(e) => updateFilaEnergia(i, 'consumida', e.target.value)} />
                  </td>
                  <td className="p-1.5">
                    <input type="text" className={cellInputE} value={filas[i]?.total || ''} onChange={(e) => updateFilaEnergia(i, 'total', e.target.value)} />
                  </td>
                </tr>
              ))}
              <tr className="bg-navy-50">
                <td className="px-2 py-1.5 font-bold text-navy-800">Total</td>
                <td className="px-2 py-1.5 font-mono font-bold text-navy-800">{totalInyectada}</td>
                <td className="px-2 py-1.5 font-mono font-bold text-navy-800">{totalConsumida}</td>
                <td className="px-2 py-1.5 font-mono font-bold text-navy-800">{totalTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === 'modulos_inversor') {
    // Cantidad de filas = "Número de inversores" (otro campo de esta misma
    // sección) — cada fila representa un inversor con su configuración de
    // strings/módulos y la cantidad total de módulos que le corresponden.
    const n = Math.max(0, parseInt(siblingData?.numero_inversores, 10) || 0);
    const rowsGuardadas = Array.isArray(value) ? value : [];
    const filas = Array.from({ length: n }, (_, i) => rowsGuardadas[i] || { configuracion: '', cantidad: '' });

    if (!editMode) {
      const conDatos = filas.filter((r) => r.configuracion || r.cantidad);
      return (
        <div className="py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">{field.label}</p>
          {n === 0 ? (
            <p className="text-sm text-navy-300 italic">Define primero el "Número de inversores"</p>
          ) : conDatos.length === 0 ? (
            <p className="text-sm text-navy-300 italic">Sin definir</p>
          ) : (
            <table className="w-full text-sm border border-navy-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-navy-50">
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Inversor</th>
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Configuración</th>
                  <th className="text-left font-semibold text-navy-500 px-3 py-1.5 border-b border-navy-200">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r, i) => (
                  <tr key={i} className="border-b border-navy-100 last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-navy-700">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-navy-700">{r.configuracion || '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-navy-700">{r.cantidad || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    function updateFila(i, key, val) {
      const next = filas.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
      onChange(next);
    }
    const cellInputMod = 'w-full rounded-md border border-navy-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
    return (
      <div className="py-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{field.label}</label>
        {n === 0 ? (
          <p className="text-xs text-navy-400 italic">Define primero el campo "Número de inversores" para habilitar esta tabla.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-navy-200 rounded-lg">
              <thead>
                <tr className="bg-navy-50">
                  <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-20">Inversor</th>
                  <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200">Configuración</th>
                  <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-28">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r, i) => (
                  <tr key={i} className="border-b border-navy-100 last:border-b-0">
                    <td className="px-2 py-1.5 font-mono text-navy-500 text-center">{i + 1}</td>
                    <td className="p-1.5">
                      <input type="text" className={cellInputMod} value={r.configuracion} onChange={(e) => updateFila(i, 'configuracion', e.target.value)} placeholder="18 strings X 28 módulos" />
                    </td>
                    <td className="p-1.5">
                      <input type="text" className={cellInputMod} value={r.cantidad} onChange={(e) => updateFila(i, 'cantidad', e.target.value)} placeholder="504" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

export function SectionFieldsGrid({
  section, data, editMode, onFieldChange, inversionistas, onAddInversionista, paises, onAddPais,
  proveedores, onAddProveedor, plantillasCimentacion, plantillasEquipos,
  inversionistasDetalle, operadoresRed, onAddOperadorRed, instaladores, onAddInstalador,
  ingenierosProyectos, onUpdateCatalogoAtributo,
  structureType, focusFieldKey, onFocusHandled,
}) {
  const [grupoAbierto, setGrupoAbierto] = useState(false);
  /* Grupos plegables genéricos (ver camposPlegables) — a diferencia del      */
  /* acordeón de Notas Técnicas de arriba, puede haber varios por pestaña    */
  /* (ej. "Inversores" y "Equipos eléctricos" en Eléctrico) y todos arrancan */
  /* cerrados, ya que su único propósito es reducir ruido visual.            */
  const [plegablesAbiertos, setPlegablesAbiertos] = useState({});
  /* Subapartados desplegados dentro del acordeón: "General" y el de la
     estructura activa se abren de entrada; el resto queda cerrado pero
     SIEMPRE presente y desplegable. Estado de UI puro: nunca se persiste. */
  const [subAbiertos, setSubAbiertos] = useState(() =>
    structureType ? { GENERAL: true, [structureType]: true } : { GENERAL: true }
  );

  const propios = section.fields.filter((f) => !f.grupo && !f.grupoPlegable);
  const gruposPlegables = [];
  section.fields.forEach((f) => {
    if (!f.grupoPlegable) return;
    let g = gruposPlegables.find((g) => g.id === f.grupoPlegable);
    if (!g) {
      g = { id: f.grupoPlegable, label: f.grupoPlegableLabel || f.grupoPlegable, fields: [] };
      gruposPlegables.push(g);
    }
    g.fields.push(f);
  });
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
    // Estructural y Eléctrico están dominadas por selectores de plantillas
    // (cimentacion_plantilla / equipo_plantilla) con su propia vista previa;
    // se ven mejor a 2 columnas fijas (aprovechan el ancho disponible) en vez
    // de escalar a 3 en pantallas grandes, que las dejaba muy angostas.
    const dosColumnas = section.id === 'estructural' || section.id === 'electrico';
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 ${dosColumnas ? '' : 'lg:grid-cols-3'} gap-x-8 divide-y divide-navy-100 md:divide-y-0`}>
        {fields.map((original) => {
          const field = contextual
            ? { ...original, label: displayLabelFor(original.key, original.label) }
            : original;
          return (
          <div
            key={field.key}
            data-field-key={field.key}
            className={`${field.type === 'stations' || field.type === 'grupo_titulo' || field.type === 'modulos_inversor' || field.type === 'energia_mensual' ? 'col-span-full' : ''} ${
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
              plantillasCimentacion={plantillasCimentacion}
              plantillasEquipos={plantillasEquipos}
              inversionistasDetalle={inversionistasDetalle}
              operadoresRed={operadoresRed}
              onAddOperadorRed={onAddOperadorRed}
              instaladores={instaladores}
              onAddInstalador={onAddInstalador}
              ingenierosProyectos={ingenierosProyectos}
              onUpdateCatalogoAtributo={onUpdateCatalogoAtributo}
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

      {gruposPlegables.map((g) => {
        const abierto = !!plegablesAbiertos[g.id];
        const contables = g.fields.filter((f) => f.type !== 'grupo_titulo' && f.type !== 'computed');
        const conDato = contables.filter((f) => data && tieneValorParaConteo(data[f.key])).length;
        return (
          <div key={g.id} className="mt-6 border-t border-navy-200 pt-4">
            <button
              type="button"
              onClick={() => setPlegablesAbiertos((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
              className="flex items-center gap-2 w-full text-left group"
            >
              {abierto
                ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />}
              <span className="text-sm font-semibold text-navy-700 group-hover:text-navy-900">{g.label}</span>
              <span className="text-xs text-navy-400">{conDato} de {contables.length} con dato</span>
            </button>
            {abierto && <div className="mt-4">{renderCampos(g.fields)}</div>}
          </div>
        );
      })}

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

export function TitleCell({ label, value, custom, span }) {
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

export function NotesPanel({ notas, onAdd, onRemove, canEdit }) {
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
export function ComentarioEditable({ value, onCommit, disabled, placeholder }) {
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

export function DocEstadoBadge({ estado }) {
  const cfg = DOC_ESTADO_CONFIG[estado] || DOC_ESTADO_CONFIG['Pendiente'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {estado || 'Pendiente'}
    </span>
  );
}

/* Historial de entregas de un documento: fecha de entrega + fecha de        */
/* devolución de comentarios (opcional, no todos los proyectos tienen       */
/* interventoría) por cada versión. Se puede agregar cuantas versiones      */
/* hagan falta.                                                             */
/* La primera versión de cualquier documento es su emisión inicial; se
   precarga con ese texto (editable, por si algún caso no lo es). */
export const DESCRIPCION_PRIMERA_VERSION = 'Emisión inicial de documento';

export function VersionesTracker({ versiones, onChange, disabled }) {
  const lista = versiones || [];

  function actualizarVersion(idx, patch) {
    onChange(lista.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function agregarVersion() {
    const esPrimera = lista.length === 0;
    onChange([...lista, {
      id: makeId('ver'),
      entrega: '',
      descripcion: esPrimera ? DESCRIPCION_PRIMERA_VERSION : '',
    }]);
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
            <div className="flex items-center gap-1.5 flex-1 min-w-[16rem]">
              <label className="text-xs text-navy-500 shrink-0">Actualizaciones:</label>
              <input
                type="text"
                disabled={disabled}
                value={v.descripcion || ''}
                onChange={(e) => actualizarVersion(idx, { descripcion: e.target.value })}
                placeholder={idx === 0 ? DESCRIPCION_PRIMERA_VERSION : 'Qué cambió en esta versión'}
                className="text-xs rounded-md border border-navy-300 px-2 py-1 w-full disabled:bg-navy-100 disabled:text-navy-400"
              />
            </div>
            {!disabled && (
              <button onClick={() => quitarVersion(idx)} title="Quitar esta versión" className="text-navy-300 hover:text-red-500 shrink-0">
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
export function DocumentoCard({ doc, codigoFinal, estadoDoc, estadoValor, puedeEditarContenido, puedeComentar, onDocChange }) {
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

export function DocumentControlPanel({ project, puedeEditarContenido, puedeComentar, onDocChange }) {
  /* Un proyecto sin la sección "general" no puede dejar la pantalla en
     blanco: se trabaja sobre un objeto vacío. */
  const general = project.data?.general || {};
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

export function PrintableReport({ project, plantillasCimentacion, plantillasEquipos }) {
  /* Un proyecto sin la sección "general" no puede dejar la pantalla en
     blanco: se trabaja sobre un objeto vacío. */
  const general = project.data?.general || {};
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

                if (field.type === 'grupo_titulo') {
                  return (
                    <tr key={field.key}>
                      <td colSpan={2} className={`pt-3 pb-1 font-bold uppercase tracking-wide text-navy-600 ${field.nivel === 1 ? 'text-sm' : 'text-xs border-t border-navy-200'}`}>
                        {field.label}
                      </td>
                    </tr>
                  );
                }

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

                if (field.type === 'modulos_inversor') {
                  const sectionData = project.data[section.id] || {};
                  const n = Math.max(0, parseInt(sectionData.numero_inversores, 10) || 0);
                  const rowsGuardadas = Array.isArray(raw) ? raw : [];
                  const filas = Array.from({ length: n }, (_, i) => rowsGuardadas[i] || { configuracion: '', cantidad: '' })
                    .filter((r) => r.configuracion || r.cantidad);
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
                                <th className="text-left px-2 py-1 border-b border-navy-300">Inversor</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Configuración</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Cant.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map((r, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1 font-mono">{i + 1}</td>
                                  <td className="px-2 py-1 font-mono">{r.configuracion || '—'}</td>
                                  <td className="px-2 py-1 font-mono">{r.cantidad || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (field.type === 'energia_mensual') {
                  const filas = Array.isArray(raw) && raw.length === 12 ? raw : emptyEnergiaMensual();
                  const conDatos = filas.some((f) => f?.inyectada || f?.consumida || f?.total);
                  const sumaCol = (campo) => filas.reduce((acc, f) => acc + (parseFloat(f?.[campo]) || 0), 0);
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 align-top">
                        {!conDatos ? (
                          <span className="font-mono text-navy-700">—</span>
                        ) : (
                          <table className="w-full text-xs border border-navy-300">
                            <thead>
                              <tr className="bg-navy-50">
                                <th className="text-left px-2 py-1 border-b border-navy-300">Mes</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Energía Inyectada [kWh-mes]</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Energía Consumida [kWh-mes]</th>
                                <th className="text-left px-2 py-1 border-b border-navy-300">Energía Total [kWh-mes]</th>
                              </tr>
                            </thead>
                            <tbody>
                              {MESES_ENERGIA.map((mes, i) => (
                                <tr key={mes}>
                                  <td className="px-2 py-1 font-mono">{mes}</td>
                                  <td className="px-2 py-1 font-mono">{filas[i]?.inyectada || '—'}</td>
                                  <td className="px-2 py-1 font-mono">{filas[i]?.consumida || '—'}</td>
                                  <td className="px-2 py-1 font-mono">{filas[i]?.total || '—'}</td>
                                </tr>
                              ))}
                              <tr className="bg-navy-50 font-bold">
                                <td className="px-2 py-1">Total</td>
                                <td className="px-2 py-1 font-mono">{sumaCol('inyectada')}</td>
                                <td className="px-2 py-1 font-mono">{sumaCol('consumida')}</td>
                                <td className="px-2 py-1 font-mono">{sumaCol('total')}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (field.type === 'cimentacion_plantilla') {
                  const seleccionada = (plantillasCimentacion || []).find((p) => p.id === raw);
                  const resumenDeLaPlantilla = seleccionada ? CIMENTACION_RESUMENES[seleccionada.tipo] : null;
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 font-mono text-navy-700 align-top">
                        {seleccionada ? (
                          <>
                            {seleccionada.nombre}
                            <span className="block font-sans mt-0.5">
                              <ResumenLineas lineas={resumenDeLaPlantilla?.(seleccionada.datos)} size="text-xs" />
                            </span>
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                }

                if (field.type === 'equipo_plantilla') {
                  const seleccionada = (plantillasEquipos || []).find((p) => p.id === raw);
                  return (
                    <tr key={field.key} className="border-b border-navy-100">
                      <td className="py-1.5 pr-4 text-navy-500 w-1/2 align-top">{field.label}</td>
                      <td className="py-1.5 font-mono text-navy-700 align-top">
                        {seleccionada ? (
                          <>
                            {seleccionada.nombre}
                            <span className="block font-sans mt-0.5">
                              <ResumenLineas lineas={atributosLineas(seleccionada.datos)} size="text-xs" />
                            </span>
                          </>
                        ) : '—'}
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
                } else if (field.type === 'coordenadas' && raw) {
                  const partes = String(raw).split(',').map((s) => s.trim());
                  const latNum = partes[0] !== undefined && !Number.isNaN(parseFloat(partes[0])) ? parseFloat(partes[0]) : null;
                  const lngNum = partes[1] !== undefined && !Number.isNaN(parseFloat(partes[1])) ? parseFloat(partes[1]) : null;
                  const gms = (latNum !== null && lngNum !== null) ? `${decimalAGMS(latNum, true)}  ${decimalAGMS(lngNum, false)}` : '';
                  val = gms ? `${raw}  (${gms})` : raw;
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
                            {ultima ? `V${versiones.length}: ${formatDate(ultima.entrega) || '—'}${ultima.descripcion ? ` — ${ultima.descripcion}` : ''}` : '—'}
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

export function HistorialItem({ h }) {
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
export const HISTORIAL_ORDEN = ['nombre', 'estado', 'general', 'civil', 'mecanica', 'geotecnia', 'estructural', 'hidraulico', 'electrico', 'documentos', 'notas', 'archivos'];

export function HistorialPanel({ historial, loading, onRefresh }) {
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

/* Nombre legible de una pestaña, para los avisos de presencia. */
const ETIQUETAS_DE_TAB = {
  documentos: 'Control Documental',
  supervision: 'Supervisión técnica',
  notas_tecnicas: 'Notas Técnicas',
  notas: 'Notas',
  historial: 'Historial',
};
export function etiquetaDeTab(id) {
  const seccion = SCHEMA.find((s) => s.id === id);
  return seccion ? seccion.label : (ETIQUETAS_DE_TAB[id] || id);
}

export function ProjectDetail({
  project, updateProject, onBack, onDelete, directorio, perfil, inversionistas, onAddInversionista, paises, onAddPais,
  proveedores, onAddProveedor, plantillasCimentacion, plantillasEquipos,
  inversionistasDetalle, operadoresRed, onAddOperadorRed, instaladores, onAddInstalador,
  ingenierosProyectos, onAddIngenieroProyectos, onUpdateCatalogoAtributo,
}) {
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
  /* Además de un líder, el ingeniero eléctrico YA asignado a ESTE proyecto   */
  /* también puede elegir quién lo revisa (no cualquier eléctrico de la      */
  /* empresa, solo el de este proyecto).                                     */
  const puedeAsignarAprobadorElectrico = puedeGestionar || equipoComoArray(project.equipo.electrico).includes(perfil.nombre);

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
  /* Supervisión técnica: los paquetes viven en data.supervision, y la
     respuesta de Supervisión puede además mover el estado de sus documentos
     en Control Documental (solo los que el usuario confirmó en el aviso). Se
     guarda todo junto: primero la sección, después cada documento. */
  function guardarSupervision(nuevaSupervision, accion, cambiosEstado) {
    const cambios = cambiosEstado || [];
    updateProject(
      project.id,
      (p) => ({
        ...p,
        data: { ...p.data, supervision: nuevaSupervision },
        documentos: cambios.length === 0 ? p.documentos : {
          ...(p.documentos || {}),
          ...Object.fromEntries(cambios.map((c) => [
            c.codigo,
            { ...((p.documentos || {})[c.codigo] || {}), estado: c.nuevo },
          ])),
        },
      }),
      accion,
      'supervision',
      async () => {
        const seccion = await supabase.rpc('merge_project_data_section', {
          p_id: project.id, p_section: 'supervision', p_value: nuevaSupervision,
        });
        if (seccion && seccion.error) return seccion;
        for (const c of cambios) {
          const doc = await supabase.rpc('merge_project_documento', {
            p_id: project.id, p_codigo: c.codigo, p_patch: { estado: c.nuevo },
          });
          if (doc && doc.error) return doc;
        }
        return { error: null };
      },
    );
    setHistorial(null);
  }

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
  /* Un proyecto sin la sección "general" no puede dejar la pantalla en
     blanco: se trabaja sobre un objeto vacío. */
  const general = project.data?.general || {};
  const llevaSupervision = requiereSupervisionTecnica(general.inversionista, inversionistasDetalle);

  /* Quién más tiene este proyecto abierto, y en qué pestaña. Solo informa:
     no cambia nada de cómo se guarda (ver shared/presencia.jsx). */
  const { otros } = usePresenciaProyecto({
    projectId: project.id,
    perfil,
    tab: activeTab,
    editando: editMode ? activeTab : null,
  });
  const editandoEstaPestana = quienEdita(otros, activeTab);

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
                <Lock className="w-3.5 h-3.5" />
                {puedeAsignarAprobadorElectrico
                  ? 'Solo un líder puede editar el resto del equipo'
                  : 'Solo un líder puede editar esto'}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ROLES.filter((role) => role.key !== 'tramites_bt').map((role) => {
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

            {/* Ingeniero de proyectos: no tiene cuenta, sale de un catálogo   */}
            {/* compartido (nombre + matrícula) en vez de "directorio".        */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-navy-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-navy-400 mb-0.5">Ingeniero de proyectos</p>
                <IngenieroProyectosField
                  valor={project.equipo.ingeniero_proyectos}
                  ingenierosProyectos={ingenierosProyectos}
                  onChange={(val) => handleEquipoChange('ingeniero_proyectos', val)}
                  onAddNew={onAddIngenieroProyectos}
                  onUpdateMatricula={(nombre, val) => onUpdateCatalogoAtributo('ingenieros_proyectos', nombre, 'matricula', val)}
                  readOnly={!puedeGestionar}
                />
              </div>
            </div>

            {/* Revisor eléctrico: persona real con rol eléctrico, pero que    */}
            {/* NO desarrolla el proyecto — no cuenta como "asignada" (ver     */}
            {/* equipoNombres) ni tiene permiso de edición; aparece en         */}
            {/* "Revisión de proyectos" en vez de "Mis proyectos".              */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-navy-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-navy-400 mb-0.5">Revisor eléctrico</p>
                <EquipoSelect
                  role={{ key: 'aprobador_electrico', filterRoleKey: 'electrico' }}
                  valorActual={project.equipo.aprobador_electrico}
                  directorio={directorio}
                  onChange={(val) => handleEquipoChange('aprobador_electrico', val)}
                  readOnly={!puedeAsignarAprobadorElectrico}
                />
              </div>
            </div>
          </div>
        </div>

        <PresenciaBarra otros={otros} etiquetaDeTab={etiquetaDeTab} />

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
            {/* Solo para los inversionistas cuyas entregas pasan por
                Supervisión técnica (se marca en la ficha del inversionista). */}
            {llevaSupervision && (
              <button
                onClick={() => setActiveTab('supervision')}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'supervision' ? 'border-lime-500 text-lime-600 bg-lime-50' : 'border-transparent text-navy-500 hover:text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Package className="w-4 h-4" /> Supervisión técnica
              </button>
            )}
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
            <AvisoPestanaOcupada personas={editandoEstaPestana} etiqueta={etiquetaDeTab(activeTab)} />
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
                  plantillasCimentacion={plantillasCimentacion}
                  plantillasEquipos={plantillasEquipos}
                  inversionistasDetalle={inversionistasDetalle}
                  operadoresRed={operadoresRed}
                  onAddOperadorRed={onAddOperadorRed}
                  instaladores={instaladores}
                  onAddInstalador={onAddInstalador}
                  ingenierosProyectos={ingenierosProyectos}
                  onUpdateCatalogoAtributo={onUpdateCatalogoAtributo}
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
            {activeTab === 'supervision' && llevaSupervision && (
              <SupervisionTecnicaPanel
                grupos={dossierPorEspecialidad(general)}
                supervision={project.data?.supervision}
                estadoDocs={project.documentos}
                puedeEditar={puedeEditarContenido}
                perfil={perfil}
                onGuardar={guardarSupervision}
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

      <PrintableReport project={project} plantillasCimentacion={plantillasCimentacion} plantillasEquipos={plantillasEquipos} />
    </div>
  );
}

export default ProjectDetail;
