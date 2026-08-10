import React, { useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getResolvedTechnicalNotes, TECHNICAL_NOTE_SPECS } from './index.js';

/* ============================================================================
   TechnicalNotesPanel — vista derivada de solo lectura (no escribe nada en
   projects.data ni dispara historial: el motor recalcula el texto en cada
   render a partir del `project` que ya vive en el estado de React de
   ProjectDetail/App, así que responde de inmediato a cualquier edición de
   campo, sin recargar la página).

   `onNavigateToField(tab)` lo provee ProjectDetail y simplemente cambia de
   pestaña (activeTab) al SCHEMA correspondiente — no intenta hacer scroll ni
   resaltar el input exacto, por diseño (ver análisis: no sobrediseñar la
   navegación).
   ============================================================================ */
export default function TechnicalNotesPanel({ project, onNavigateToField }) {
  const [specId, setSpecId] = useState(TECHNICAL_NOTE_SPECS.find((s) => s.enabled)?.id || null);
  const resolved = specId ? getResolvedTechnicalNotes(project, specId) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TECHNICAL_NOTE_SPECS.map((spec) => {
          const activo = spec.id === specId;
          return (
            <button
              key={spec.id}
              type="button"
              disabled={!spec.enabled}
              onClick={() => spec.enabled && setSpecId(spec.id)}
              title={!spec.enabled ? 'Todavía no está habilitado' : undefined}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                activo
                  ? 'bg-navy-800 text-white border-navy-800'
                  : spec.enabled
                    ? 'bg-white text-navy-600 border-navy-300 hover:border-navy-400'
                    : 'bg-navy-50 text-navy-300 border-navy-200 cursor-not-allowed'
              }`}
            >
              {spec.label}
              {!spec.enabled && ' (próximamente)'}
            </button>
          );
        })}
      </div>

      {!resolved ? (
        <p className="text-sm text-navy-400 italic text-center py-8">
          Esta especificación de notas técnicas todavía no está disponible.
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
                      {p.status === 'DESCONOCIDO' && (
                        <span className="text-amber-500"> — parámetro sin resolver declarado (revisar catálogo)</span>
                      )}
                    </span>
                    {p.fieldRef && (
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

          <div className="space-y-6">
            {resolved.secciones.map((seccion) => (
              <div key={seccion.titulo}>
                <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{seccion.titulo}</p>
                <div className="space-y-2">
                  {seccion.notas.map((nota) => (
                    <div
                      key={nota.numero}
                      className={`rounded-lg border-l-4 p-3 text-sm border-t border-r border-b ${
                        nota.completa ? 'border-l-emerald-400 bg-white border-t-navy-200 border-r-navy-200 border-b-navy-200' : 'border-l-amber-400 bg-amber-50 border-t-amber-200 border-r-amber-200 border-b-amber-200'
                      }`}
                    >
                      <p className="text-navy-700 leading-relaxed whitespace-pre-wrap break-words">
                        <span className="font-semibold text-navy-500 mr-1">{nota.numero}.</span>
                        {nota.textoResuelto}
                      </p>
                      {!nota.completa && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {nota.parametros
                            .filter((p) => p.status !== 'RESUELTO')
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={!p.fieldRef}
                                onClick={() => p.fieldRef && onNavigateToField(p.fieldRef.tab)}
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
