/* ============================================================================
   SUPERVISIÓN TÉCNICA — paquetes de entrega y sus respuestas
   ----------------------------------------------------------------------------
   Solo aparece en los proyectos cuyo inversionista está marcado como "requiere
   supervisión técnica" (ver la casilla del inversionista en la pestaña
   General). Registra el ida y vuelta con Supervisión:

     1. Se arma un PAQUETE con los documentos que se van a entregar y la fecha
        en que se entregan.
     2. Supervisión responde en una fecha: unos documentos quedan aprobados
        (APC) y otros vuelven con comentarios.
     3. Con los que volvieron con comentarios se arma el paquete siguiente, y
        así hasta que todo el dossier queda en APC.

   El paquete es el registro de UNA vuelta completa. Un documento no puede
   estar en dos paquetes sin responder a la vez, y los que ya están en APC no
   se vuelven a ofrecer.

   Todo vive en projects.data.supervision (la misma vía de guardado que las
   pestañas técnicas), así que no hace falta ninguna tabla nueva.
   ============================================================================ */

import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, MessageSquare, Package, Plus, Send, Trash2, X } from 'lucide-react';
import { formatDate, makeId } from '../shared/dominio.jsx';

/* Situación de un documento frente a Supervisión, deducida de los paquetes
   (nunca se guarda aparte: los paquetes son la única fuente). */
export const SITUACION = Object.freeze({
  SIN_ENVIAR: 'sin_enviar',
  EN_REVISION: 'en_revision',
  CON_COMENTARIOS: 'con_comentarios',
  APC: 'apc',
});

const SITUACION_CONFIG = {
  [SITUACION.SIN_ENVIAR]: { texto: 'Sin enviar', clase: 'bg-navy-100 text-navy-500 border-navy-300' },
  [SITUACION.EN_REVISION]: { texto: 'En revisión', clase: 'bg-violet-100 text-violet-700 border-violet-300' },
  [SITUACION.CON_COMENTARIOS]: { texto: 'Con comentarios', clase: 'bg-nashville-100 text-nashville-700 border-nashville-300' },
  [SITUACION.APC]: { texto: 'APC', clase: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

/* Estados de Control Documental que corresponden a cada resultado, para la
   confirmación que se le muestra al usuario antes de aplicarlos. */
export const ESTADO_POR_RESULTADO = {
  apc: 'Aprobado para construcción (APC)',
  comentarios: 'Aprobado para construcción con comentarios (APCC)',
};

/**
 * Situación de cada documento a partir de los paquetes, en orden cronológico:
 * manda siempre el paquete más reciente en el que aparece.
 * @returns {Map<string, {situacion: string, paquete: object|null}>}
 */
export function situacionPorDocumento(paquetes) {
  const mapa = new Map();
  (paquetes || []).forEach((paq) => {
    (paq.documentos || []).forEach((d) => {
      let situacion = SITUACION.EN_REVISION;
      if (paq.fecha_respuesta) {
        situacion = d.resultado === 'apc' ? SITUACION.APC : SITUACION.CON_COMENTARIOS;
      }
      mapa.set(d.codigo, { situacion, paquete: paq });
    });
  });
  return mapa;
}

/** ¿Se puede meter este documento en un paquete nuevo? */
export function sePuedeEnviar(situacion) {
  return situacion !== SITUACION.EN_REVISION && situacion !== SITUACION.APC;
}

function Chip({ situacion }) {
  const cfg = SITUACION_CONFIG[situacion] || SITUACION_CONFIG[SITUACION.SIN_ENVIAR];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.clase}`}>{cfg.texto}</span>;
}

/* ---------------------------------------------------------------------------
   Formulario de un paquete nuevo: qué se entrega y cuándo.
   ------------------------------------------------------------------------- */
function PaqueteForm({ grupos, situaciones, preseleccion, onCancel, onSave }) {
  const [seleccion, setSeleccion] = useState(() => new Set(preseleccion || []));
  const [fecha, setFecha] = useState('');

  const disponibles = grupos.flatMap((g) => g.docs).filter((d) => sePuedeEnviar(situaciones.get(d.codigo)?.situacion || SITUACION.SIN_ENVIAR));
  const disponiblesPorEsp = new Map(grupos.map((g) => [
    g.especialidad,
    g.docs.filter((d) => sePuedeEnviar(situaciones.get(d.codigo)?.situacion || SITUACION.SIN_ENVIAR)),
  ]));

  function alternar(codigo) {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(codigo)) nueva.delete(codigo); else nueva.add(codigo);
      return nueva;
    });
  }
  function alternarEspecialidad(especialidad) {
    const docs = disponiblesPorEsp.get(especialidad) || [];
    const todosPuestos = docs.length > 0 && docs.every((d) => seleccion.has(d.codigo));
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      docs.forEach((d) => (todosPuestos ? nueva.delete(d.codigo) : nueva.add(d.codigo)));
      return nueva;
    });
  }
  function alternarTodos() {
    const todosPuestos = disponibles.length > 0 && disponibles.every((d) => seleccion.has(d.codigo));
    setSeleccion(todosPuestos ? new Set() : new Set(disponibles.map((d) => d.codigo)));
  }

  const todosPuestos = disponibles.length > 0 && disponibles.every((d) => seleccion.has(d.codigo));

  return (
    <div className="bg-white border border-navy-300 rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-navy-700">Nuevo paquete de entrega</h3>
        <button onClick={onCancel} className="text-navy-400 hover:text-navy-600" title="Cancelar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-navy-500">Fecha de entrega</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="text-sm rounded-md border border-navy-300 px-2.5 py-1.5"
        />
        <button
          onClick={alternarTodos}
          className="text-xs font-semibold text-lime-600 hover:text-lime-700 ml-auto"
        >
          {todosPuestos ? 'Quitar todos' : `Seleccionar todos (${disponibles.length})`}
        </button>
      </div>

      {disponibles.length === 0 ? (
        <p className="text-sm text-navy-400 italic mb-4">
          No hay documentos disponibles: todos están en APC o esperando respuesta de un paquete anterior.
        </p>
      ) : (
        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto pr-1">
          {grupos.map((g) => {
            const docsDisp = disponiblesPorEsp.get(g.especialidad) || [];
            if (docsDisp.length === 0) return null;
            const todosDeEsp = docsDisp.every((d) => seleccion.has(d.codigo));
            return (
              <div key={g.especialidad}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    checked={todosDeEsp}
                    onChange={() => alternarEspecialidad(g.especialidad)}
                    className="accent-lime-500"
                    id={`esp-${g.especialidad}`}
                  />
                  <label htmlFor={`esp-${g.especialidad}`} className="text-xs font-bold uppercase tracking-wide text-navy-500 cursor-pointer">
                    {g.especialidad} <span className="text-navy-400 font-semibold">({docsDisp.length})</span>
                  </label>
                </div>
                <div className="pl-6 space-y-1">
                  {g.docs.map((d) => {
                    const situacion = situaciones.get(d.codigo)?.situacion || SITUACION.SIN_ENVIAR;
                    const puede = sePuedeEnviar(situacion);
                    return (
                      <label
                        key={d.codigo}
                        className={`flex items-start gap-2 text-sm ${puede ? 'text-navy-700 cursor-pointer' : 'text-navy-300'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!puede}
                          checked={seleccion.has(d.codigo)}
                          onChange={() => alternar(d.codigo)}
                          className="mt-0.5 accent-lime-500"
                        />
                        <span className="font-mono text-xs shrink-0">{d.codigoFinal}</span>
                        <span className="flex-1">{d.nombre}</span>
                        {!puede && <Chip situacion={situacion} />}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave([...seleccion], fecha)}
          disabled={seleccion.size === 0 || !fecha}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Crear paquete ({seleccion.size})
        </button>
        <button onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">Cancelar</button>
        {seleccion.size > 0 && !fecha && <span className="text-xs text-amber-600">Falta la fecha de entrega</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Registro de la respuesta de Supervisión a un paquete: una sola fecha, y el
   resultado documento por documento.
   ------------------------------------------------------------------------- */
function RespuestaForm({ paquete, nombrePorCodigo, codigoFinalPorCodigo, onCancel, onSave }) {
  const [fecha, setFecha] = useState('');
  const [resultados, setResultados] = useState(() => {
    const inicial = {};
    (paquete.documentos || []).forEach((d) => { inicial[d.codigo] = d.resultado || null; });
    return inicial;
  });

  const total = (paquete.documentos || []).length;
  const decididos = Object.values(resultados).filter(Boolean).length;
  const apc = Object.values(resultados).filter((r) => r === 'apc').length;
  const conComentarios = decididos - apc;

  function marcarTodos(resultado) {
    const nuevo = {};
    (paquete.documentos || []).forEach((d) => { nuevo[d.codigo] = resultado; });
    setResultados(nuevo);
  }

  return (
    <div className="border-t border-navy-200 mt-3 pt-3">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-navy-500">Fecha de respuesta</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="text-sm rounded-md border border-navy-300 px-2.5 py-1.5"
        />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => marcarTodos('apc')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            Todos APC
          </button>
          <span className="text-navy-300">·</span>
          <button onClick={() => marcarTodos('comentarios')} className="text-xs font-semibold text-nashville-600 hover:text-nashville-700">
            Todos con comentarios
          </button>
        </div>
      </div>

      <div className="space-y-1 mb-3 max-h-80 overflow-y-auto pr-1">
        {(paquete.documentos || []).map((d) => (
          <div key={d.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm py-1.5 border-b border-navy-100 last:border-0">
            <span className="font-mono text-xs text-navy-500 shrink-0">{codigoFinalPorCodigo.get(d.codigo) || d.codigo}</span>
            <span className="flex-1 min-w-[12rem] text-navy-700">{nombrePorCodigo.get(d.codigo) || '(documento que ya no está en el dossier)'}</span>
            <label className="flex items-center gap-1.5 text-xs text-emerald-700 cursor-pointer shrink-0">
              <input
                type="radio"
                name={`res-${paquete.id}-${d.codigo}`}
                checked={resultados[d.codigo] === 'apc'}
                onChange={() => setResultados((prev) => ({ ...prev, [d.codigo]: 'apc' }))}
                className="accent-emerald-500"
              />
              APC
            </label>
            <label className="flex items-center gap-1.5 text-xs text-nashville-700 cursor-pointer shrink-0">
              <input
                type="radio"
                name={`res-${paquete.id}-${d.codigo}`}
                checked={resultados[d.codigo] === 'comentarios'}
                onChange={() => setResultados((prev) => ({ ...prev, [d.codigo]: 'comentarios' }))}
                className="accent-nashville-500"
              />
              Con comentarios
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => onSave(fecha, resultados)}
          disabled={!fecha || decididos < total}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Guardar respuesta
        </button>
        <button onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">Cancelar</button>
        <span className="text-xs text-navy-500">
          {decididos} de {total} marcados · {apc} APC · {conComentarios} con comentarios
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Confirmación de los cambios que la respuesta produce en Control Documental.
   Se pregunta siempre: el estado de un documento se puede haber cambiado a
   mano, y nadie debería descubrir que algo se movió solo.
   ------------------------------------------------------------------------- */
function ConfirmarEstados({ cambios, onAplicar, onSaltar, onCancel }) {
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <h3 className="text-base font-bold text-navy-800 mb-1">Actualizar Control Documental</h3>
        <p className="text-sm text-navy-500 mb-4">
          Según la respuesta, {cambios.length === 1 ? 'este documento cambiaría de estado' : `estos ${cambios.length} documentos cambiarían de estado`} en
          Control Documental:
        </p>
        {/* Cada cambio en dos renglones: los nombres de estado son largos
            ("Aprobado para construcción con comentarios (APCC)") y en una
            sola fila terminaban partiendo el nombre del documento palabra
            por palabra. */}
        <div className="space-y-2 mb-5">
          {cambios.map((c) => (
            <div key={c.codigo} className="text-sm border-b border-navy-100 last:border-0 pb-2 last:pb-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono text-xs text-navy-500">{c.codigoFinal}</span>
                <span className="text-navy-700">{c.nombre}</span>
              </div>
              <p className="text-xs text-navy-400 mt-0.5">
                {c.anterior} → <strong className="text-navy-700">{c.nuevo}</strong>
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onAplicar} className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
            Aplicar y guardar
          </button>
          <button onClick={onSaltar} className="text-sm font-semibold text-navy-600 hover:text-navy-800 border border-navy-300 rounded-lg px-4 py-2">
            Guardar sin cambiar estados
          </button>
          <button onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 ml-auto">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Panel principal.
   ------------------------------------------------------------------------- */
export default function SupervisionTecnicaPanel({
  grupos, supervision, estadoDocs, puedeEditar, perfil, onGuardar,
}) {
  const paquetes = supervision?.paquetes || [];
  const [creando, setCreando] = useState(false);
  const [preseleccion, setPreseleccion] = useState([]);
  const [respondiendo, setRespondiendo] = useState(null); // id del paquete
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [confirmacion, setConfirmacion] = useState(null);

  const situaciones = situacionPorDocumento(paquetes);
  const todosLosDocs = grupos.flatMap((g) => g.docs);
  const nombrePorCodigo = new Map(todosLosDocs.map((d) => [d.codigo, d.nombre]));
  const codigoFinalPorCodigo = new Map(todosLosDocs.map((d) => [d.codigo, d.codigoFinal]));

  const enApc = todosLosDocs.filter((d) => situaciones.get(d.codigo)?.situacion === SITUACION.APC).length;
  const enRevision = todosLosDocs.filter((d) => situaciones.get(d.codigo)?.situacion === SITUACION.EN_REVISION).length;
  const conComentarios = todosLosDocs.filter((d) => situaciones.get(d.codigo)?.situacion === SITUACION.CON_COMENTARIOS).length;
  const sinEnviar = todosLosDocs.length - enApc - enRevision - conComentarios;

  function alternarPaquete(id) {
    setAbiertos((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
      return nueva;
    });
  }

  function crearPaquete(codigos, fecha) {
    const numero = paquetes.reduce((max, p) => Math.max(max, p.numero || 0), 0) + 1;
    const paquete = {
      id: makeId('paq'),
      numero,
      fecha_entrega: fecha,
      fecha_respuesta: '',
      documentos: codigos.map((codigo) => ({ codigo, resultado: null })),
      creado_por: perfil?.nombre || '',
      created_at: new Date().toISOString(),
    };
    onGuardar(
      { ...(supervision || {}), paquetes: [...paquetes, paquete] },
      `Supervisión técnica: creó el paquete ${numero} con ${codigos.length} documento(s)`,
      [],
    );
    setCreando(false);
    setPreseleccion([]);
    setAbiertos((prev) => new Set(prev).add(paquete.id));
  }

  /* Antes de guardar la respuesta se calcula qué estados de Control Documental
     quedarían distintos, para poder preguntar. Un documento que YA está en el
     estado que le tocaría no aparece: no hay nada que cambiarle. */
  function prepararRespuesta(paquete, fecha, resultados) {
    const cambios = (paquete.documentos || []).map((d) => {
      const nuevo = ESTADO_POR_RESULTADO[resultados[d.codigo]];
      const anterior = (estadoDocs || {})[d.codigo]?.estado || 'Pendiente';
      return {
        codigo: d.codigo,
        codigoFinal: codigoFinalPorCodigo.get(d.codigo) || d.codigo,
        nombre: nombrePorCodigo.get(d.codigo) || d.codigo,
        anterior,
        nuevo,
      };
    }).filter((c) => c.nuevo && c.nuevo !== c.anterior);

    const paquetesActualizados = paquetes.map((p) => (p.id !== paquete.id ? p : {
      ...p,
      fecha_respuesta: fecha,
      documentos: (p.documentos || []).map((d) => ({ ...d, resultado: resultados[d.codigo] || null })),
    }));
    const nuevaSupervision = { ...(supervision || {}), paquetes: paquetesActualizados };
    const resumen = `Supervisión técnica: registró la respuesta del paquete ${paquete.numero}`;

    if (cambios.length === 0) {
      onGuardar(nuevaSupervision, resumen, []);
      setRespondiendo(null);
      return;
    }
    setConfirmacion({ cambios, nuevaSupervision, resumen });
  }

  function cerrarConfirmacion(cambiosAAplicar) {
    onGuardar(confirmacion.nuevaSupervision, confirmacion.resumen, cambiosAAplicar);
    setConfirmacion(null);
    setRespondiendo(null);
  }

  function nuevoPaqueteConComentarios(paquete) {
    const codigos = (paquete.documentos || [])
      .filter((d) => d.resultado === 'comentarios')
      .map((d) => d.codigo);
    setPreseleccion(codigos);
    setCreando(true);
  }

  const dossierVacio = todosLosDocs.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-lg font-bold text-navy-800">Supervisión técnica</h2>
          <p className="text-sm text-navy-500">
            Entregas a Supervisión y sus respuestas, paquete por paquete.
          </p>
        </div>
        {puedeEditar && !creando && !dossierVacio && (
          <button
            onClick={() => { setPreseleccion([]); setCreando(true); }}
            className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo paquete de entrega
          </button>
        )}
      </div>

      {dossierVacio ? (
        <p className="text-sm text-navy-400 italic">
          Este proyecto todavía no tiene una lista de documentos: completa el inversionista en la pestaña General.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'En APC', valor: enApc, clase: 'text-emerald-600' },
              { label: 'Con comentarios', valor: conComentarios, clase: 'text-nashville-600' },
              { label: 'En revisión', valor: enRevision, clase: 'text-violet-600' },
              { label: 'Sin enviar', valor: sinEnviar, clase: 'text-navy-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-navy-200 rounded-xl px-4 py-3">
                <p className={`text-2xl font-bold ${s.clase}`}>{s.valor}</p>
                <p className="text-xs text-navy-400 font-semibold uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {creando && (
            <PaqueteForm
              grupos={grupos}
              situaciones={situaciones}
              preseleccion={preseleccion}
              onCancel={() => { setCreando(false); setPreseleccion([]); }}
              onSave={crearPaquete}
            />
          )}

          <h3 className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">
            Paquetes de entrega {paquetes.length > 0 && <span className="text-navy-400">({paquetes.length})</span>}
          </h3>
          {paquetes.length === 0 ? (
            <p className="text-sm text-navy-400 italic mb-6">Todavía no se ha entregado ningún paquete a Supervisión.</p>
          ) : (
            <div className="space-y-2 mb-8">
              {[...paquetes].reverse().map((paq) => {
                const abierto = abiertos.has(paq.id);
                const respondido = !!paq.fecha_respuesta;
                const docs = paq.documentos || [];
                const apc = docs.filter((d) => d.resultado === 'apc').length;
                const conCom = docs.filter((d) => d.resultado === 'comentarios').length;
                return (
                  <div key={paq.id} className="bg-white border border-navy-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => alternarPaquete(paq.id)}
                      className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-navy-50 transition-colors"
                    >
                      {abierto ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />}
                      <Package className="w-4 h-4 text-navy-400 shrink-0" />
                      <span className="font-semibold text-sm text-navy-700 shrink-0">Paquete {paq.numero}</span>
                      <span className="text-xs text-navy-500">
                        Entregado el {formatDate(paq.fecha_entrega) || '—'} · {docs.length} documento{docs.length === 1 ? '' : 's'}
                      </span>
                      <span className="sm:ml-auto flex flex-wrap items-center gap-2">
                        {respondido ? (
                          <>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                              {apc} APC
                            </span>
                            {conCom > 0 && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-nashville-50 text-nashville-700 border-nashville-200">
                                {conCom} con comentarios
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                            Esperando respuesta
                          </span>
                        )}
                      </span>
                    </button>

                    {abierto && (
                      <div className="px-4 pb-4 border-t border-navy-100">
                        <div className="flex items-center gap-4 flex-wrap text-xs text-navy-500 py-2">
                          <span>Entrega: <strong className="text-navy-700">{formatDate(paq.fecha_entrega) || '—'}</strong></span>
                          <span>Respuesta: <strong className="text-navy-700">{formatDate(paq.fecha_respuesta) || 'pendiente'}</strong></span>
                          {paq.creado_por && <span>Creado por {paq.creado_por}</span>}
                        </div>

                        {respondiendo === paq.id ? (
                          <RespuestaForm
                            paquete={paq}
                            nombrePorCodigo={nombrePorCodigo}
                            codigoFinalPorCodigo={codigoFinalPorCodigo}
                            onCancel={() => setRespondiendo(null)}
                            onSave={(fecha, resultados) => prepararRespuesta(paq, fecha, resultados)}
                          />
                        ) : (
                          <>
                            <div className="space-y-1">
                              {docs.map((d) => (
                                <div key={d.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm py-1.5 border-b border-navy-100 last:border-0">
                                  <span className="font-mono text-xs text-navy-500 shrink-0">{codigoFinalPorCodigo.get(d.codigo) || d.codigo}</span>
                                  <span className="flex-1 min-w-[12rem] text-navy-700">{nombrePorCodigo.get(d.codigo) || '(documento que ya no está en el dossier)'}</span>
                                  {respondido && (
                                    d.resultado === 'apc'
                                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0"><Check className="w-3.5 h-3.5" /> APC</span>
                                      : <span className="flex items-center gap-1 text-xs font-semibold text-nashville-600 shrink-0"><MessageSquare className="w-3.5 h-3.5" /> Con comentarios</span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {puedeEditar && (
                              <div className="flex items-center gap-3 flex-wrap mt-3">
                                {!respondido && (
                                  <button
                                    onClick={() => setRespondiendo(paq.id)}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-navy-700 border border-navy-300 rounded-lg px-3 py-1.5 hover:border-navy-400"
                                  >
                                    <Send className="w-3.5 h-3.5" /> Registrar respuesta
                                  </button>
                                )}
                                {respondido && conCom > 0 && (
                                  <button
                                    onClick={() => nuevoPaqueteConComentarios(paq)}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-lime-700 border border-lime-400 bg-lime-50 rounded-lg px-3 py-1.5 hover:bg-lime-100"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Nuevo paquete con los {conCom} que tienen comentarios
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (!window.confirm(`¿Eliminar el paquete ${paq.numero}? Esto no cambia el estado de ningún documento.`)) return;
                                    onGuardar(
                                      { ...(supervision || {}), paquetes: paquetes.filter((p) => p.id !== paq.id) },
                                      `Supervisión técnica: eliminó el paquete ${paq.numero}`,
                                      [],
                                    );
                                  }}
                                  className="flex items-center gap-1.5 text-xs text-navy-400 hover:text-red-500 ml-auto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Eliminar paquete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">
            Documentos del dossier <span className="text-navy-400">({todosLosDocs.length})</span>
          </h3>
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.especialidad}>
                <p className="text-xs font-bold uppercase tracking-wide text-navy-400 mb-1">{g.especialidad}</p>
                <div className="bg-white border border-navy-200 rounded-xl divide-y divide-navy-100">
                  {g.docs.map((d) => (
                    <div key={d.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-navy-500 shrink-0">{d.codigoFinal}</span>
                      <span className="flex-1 min-w-[12rem] text-navy-700">{d.nombre}</span>
                      <Chip situacion={situaciones.get(d.codigo)?.situacion || SITUACION.SIN_ENVIAR} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {enApc === todosLosDocs.length && todosLosDocs.length > 0 && (
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <Check className="w-4 h-4" /> Todo el dossier quedó aprobado para construcción.
            </div>
          )}
        </>
      )}

      {confirmacion && (
        <ConfirmarEstados
          cambios={confirmacion.cambios}
          onAplicar={() => cerrarConfirmacion(confirmacion.cambios)}
          onSaltar={() => cerrarConfirmacion([])}
          onCancel={() => setConfirmacion(null)}
        />
      )}

      {!puedeEditar && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-navy-400">
          <AlertTriangle className="w-3.5 h-3.5" /> Solo el equipo asignado al proyecto puede crear paquetes y registrar respuestas.
        </p>
      )}
    </div>
  );
}
