import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getResolvedTechnicalNotes, getStructureType, STRUCTURE_OPTIONS, STATUS, isResolvedStatus } from './index.js';
import { overrideFieldsFor } from './overridesSchema.js';
import SelectOrOtro from './SelectOrOtro.jsx';

/* ============================================================================
   TechnicalNotesPanel — el texto de las notas es SIEMPRE derivado: el motor
   recalcula en cada render a partir del `project` que ya vive en el estado de
   React de ProjectDetail/App, así que responde de inmediato a cualquier
   edición de campo sin recargar (y nunca se persiste texto resuelto, solo el
   tipo de estructura y los overrides — ver regla 23).

   `onNavigateToField(tab)` cambia de pestaña al SCHEMA correspondiente.
   `onStructureTypeChange(structureType)` lo provee ProjectDetail y persiste
   en project.data.technicalNotes.structureType.
   ============================================================================ */

const ORIGEN_BADGE = {
  [STATUS.RESOLVED_PROJECT]: { texto: 'Proyecto', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [STATUS.RESOLVED_USER]: { texto: 'Seleccionado', clase: 'bg-sky-50 text-sky-700 border-sky-200' },
  [STATUS.RESOLVED_DEFAULT]: { texto: 'Default', clase: 'bg-navy-50 text-navy-500 border-navy-200' },
  [STATUS.PENDING]: { texto: 'Pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  [STATUS.INVALID]: { texto: 'Inválido', clase: 'bg-red-50 text-red-700 border-red-200' },
  [STATUS.UNKNOWN]: { texto: 'Sin resolver', clase: 'bg-red-50 text-red-700 border-red-200' },
};

function OrigenBadge({ status }) {
  const badge = ORIGEN_BADGE[status];
  if (!badge) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.clase} shrink-0`}>{badge.texto}</span>
  );
}

export default function TechnicalNotesPanel({ project, onNavigateToField, onStructureTypeChange, onOverrideChange, puedeEditar }) {
  const structureType = getStructureType(project);
  const resolved = structureType ? getResolvedTechnicalNotes(project, structureType) : null;
  const overrideFields = structureType ? overrideFieldsFor(structureType) : [];
  const overrides = project?.data?.technicalNotes?.overrides || {};

  return (
    <div>
      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">Tipo de estructura</label>
        <select
          value={structureType || ''}
          disabled={!puedeEditar}
          onChange={(e) => onStructureTypeChange(e.target.value || null)}
          className="w-full max-w-sm rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 disabled:bg-navy-50 disabled:text-navy-400"
        >
          <option value="">Seleccionar…</option>
          {STRUCTURE_OPTIONS.map((op) => (
            <option key={op.id} value={op.id}>{op.label}</option>
          ))}
        </select>
      </div>

      {!resolved ? (
        <p className="text-sm text-navy-400 italic text-center py-8">
          Elige un tipo de estructura para generar sus notas técnicas.
        </p>
      ) : (
        <>
          <div className="bg-navy-50 border border-navy-200 rounded-xl p-4 mb-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-bold text-navy-700">Notas técnicas — {resolved.specLabel}</p>
              <p className="text-xs text-navy-500 mt-1">
                Parámetros requeridos: <span className="font-semibold text-navy-700">{resolved.completitud.requeridos}</span>
                {' · '}Completos: <span className="font-semibold text-emerald-600">{resolved.completitud.completos}</span>
                {' · '}Pendientes: <span className="font-semibold text-amber-600">{resolved.pendientes.length}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-2xl font-bold ${resolved.completitud.porcentaje === 100 ? 'text-emerald-600' : 'text-navy-700'}`}>
                {resolved.completitud.porcentaje}%
              </p>
              <p className="text-xs text-navy-400">Completitud</p>
            </div>
          </div>

          {resolved.pendientes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Pendientes para completar las notas
              </p>
              <ul className="space-y-1.5">
                {resolved.pendientes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm text-amber-800">
                    <span className="min-w-0">
                      {p.label}
                      {p.suggested && (
                        <span className="text-amber-600"> — sugerido por memoria: <span className="font-mono">{p.suggested}</span></span>
                      )}
                      {p.status === STATUS.UNKNOWN && (
                        <span className="text-amber-500"> — parámetro sin resolver declarado (revisar catálogo)</span>
                      )}
                    </span>
                    {p.fieldRef?.tab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToField(p.fieldRef.tab)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 shrink-0"
                      >
                        Ir al campo <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overrideFields.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-1">Selecciones de notas técnicas</p>
              <p className="text-xs text-navy-400 mb-3">
                Parámetros que no pertenecen a ninguna especialidad: se guardan solo para las notas técnicas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overrideFields.map((f) => (
                  <div key={`${f.categoryId}.${f.inputKey}`}>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">{f.label}</label>
                    <SelectOrOtro
                      value={overrides[f.categoryId]?.[f.inputKey]}
                      opciones={f.opciones}
                      defaultValue={f.defaultValue}
                      allowOther={f.allowOther}
                      onChange={(val) => onOverrideChange(f.categoryId, f.inputKey, val)}
                      placeholder="Ej. Producto X o equivalente"
                      className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 disabled:bg-navy-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Parámetros técnicos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {resolved.parametros
                .filter((p) => p.status !== STATUS.EXCLUDED)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-navy-100 py-1.5">
                    <span className="text-navy-500 min-w-0 truncate" title={p.label}>{p.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-xs ${isResolvedStatus(p.status) ? 'text-navy-700' : 'text-navy-300 italic'}`}>
                        {isResolvedStatus(p.status) ? p.value : '—'}
                      </span>
                      <OrigenBadge status={p.status} />
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-6">
            {resolved.secciones.map((seccion) => (
              <div key={seccion.categoryId}>
                <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{seccion.titulo}</p>
                <div className="space-y-2">
                  {seccion.notas.map((nota) => (
                    <div
                      key={nota.noteId}
                      className={`rounded-lg border-l-4 p-3 text-sm border-t border-r border-b ${
                        nota.completa ? 'border-l-emerald-400 bg-white border-t-navy-200 border-r-navy-200 border-b-navy-200' : 'border-l-amber-400 bg-amber-50 border-t-amber-200 border-r-amber-200 border-b-amber-200'
                      }`}
                    >
                      <p className="text-navy-700 leading-relaxed whitespace-pre-wrap break-words">
                        <span className="font-semibold text-navy-500 mr-1">{nota.noteId}</span>
                        {nota.textoResuelto}
                      </p>
                      {!nota.completa && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {nota.parametros
                            .filter((p) => !isResolvedStatus(p.status))
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={!p.fieldRef?.tab}
                                onClick={() => p.fieldRef?.tab && onNavigateToField(p.fieldRef.tab)}
                                className="flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full hover:bg-amber-200 disabled:opacity-60 disabled:cursor-default transition-colors"
                              >
                                <AlertTriangle className="w-3 h-3" /> {p.label}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
