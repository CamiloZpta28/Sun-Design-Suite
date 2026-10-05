/* ============================================================================
   REUNIONES DEL LUNES
   ----------------------------------------------------------------------------
   Tres reuniones —civil, eléctrica y delineantes— y en cada sesión, en el
   orden en que pasan: quién modera, los pendientes que vienen de antes, los
   temas que llegaron de los resúmenes del viernes y el registro de lo que se
   habló. El cálculo está aparte, en shared/reuniones.js.

   Quién puede qué:
   - Quien gestiona la reunión (su líder de área, el Líder de Diseño y el
     Desarrollador) corre la fecha, elige al moderador y arma la rotación.
   - El moderador y quien gestiona tratan los temas y crean pendientes.
   - El estado de un pendiente lo mueven sus responsables, el moderador y
     quien gestiona: así cada quien actualiza lo suyo durante la semana.
   - Los invitados no ven esta sección; la base tampoco les entrega nada.
   ============================================================================ */

import React, { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, Handshake, History, Plus, Trash2, UserCog, X,
} from 'lucide-react';
import { copiarTexto } from '../shared/copiar.jsx';
import { esInvitado } from '../shared/permisos.js';
import { REUNIONES, lunesDe, ultimasSemanas } from '../shared/resumenes.js';
import {
  ESTADOS_PENDIENTE, actualizacionValida, bandejaDeLaSesion, etiquetaDeEstado, fechaDeSesion,
  fechaDeSesionValida, fechaLegible, gestionaReunion, historialDe, idDeSesion, moderadorSugerido,
  nombreDe, ordenDeRotacion, participantes, pendientesDeReunion, puedeActualizarPendiente,
  registroDeLaSesion, registroVacio, resolucionValida, reunionInicial, reunionPorId,
  reunionesDePersona, semanasAbierto, sesionDe, temasParaLaSesion, textoDelRegistro,
  ultimaJustificacion,
} from '../shared/reuniones.js';

const entrada = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

function ChipEstado({ estado }) {
  const def = ESTADOS_PENDIENTE.find((e) => e.id === estado) || ESTADOS_PENDIENTE[0];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${def.clase}`}>{def.label}</span>;
}

/* ------------------------------------------------------- responsables */

/* Los responsables de un pendiente: uno o más. Primero se ofrecen los de la
   reunión, que son casi siempre; después el resto del equipo, porque a veces
   el compromiso es de alguien de otra área. */
function SelectorResponsables({ seleccion, onChange, directorio, reunionId }) {
  const deLaReunion = participantes(reunionId, directorio);
  const idsReunion = new Set(deLaReunion.map((p) => p.id));
  const resto = (directorio || [])
    .filter((p) => !esInvitado(p) && !idsReunion.has(p.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const disponibles = (lista) => lista.filter((p) => !seleccion.includes(p.id));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {seleccion.map((id) => (
          <span key={id} className="text-xs font-medium px-2 py-1 rounded-full bg-navy-100 text-navy-700 flex items-center gap-1">
            {nombreDe(directorio, id)}
            <button type="button" onClick={() => onChange(seleccion.filter((x) => x !== id))} title="Quitar" className="text-navy-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {seleccion.length === 0 && <span className="text-xs text-navy-300 italic">Nadie todavía</span>}
      </div>
      <select
        value=""
        aria-label="Agregar responsable"
        onChange={(e) => { if (e.target.value) onChange([...seleccion, e.target.value]); }}
        className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">+ Agregar responsable…</option>
        {disponibles(deLaReunion).length > 0 && (
          <optgroup label="En esta reunión">
            {disponibles(deLaReunion).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </optgroup>
        )}
        {disponibles(resto).length > 0 && (
          <optgroup label="Resto del equipo">
            {disponibles(resto).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </optgroup>
        )}
      </select>
    </div>
  );
}

/* ------------------------------------------------------- un pendiente */

function TarjetaPendiente({
  pendiente, historial, directorio, perfil, gestiona, esModerador,
  onActualizar, onCambiarResponsables, onEliminar,
}) {
  const [actualizando, setActualizando] = useState(false);
  const [estado, setEstado] = useState(pendiente.estado);
  const [justificacion, setJustificacion] = useState('');
  const [verHistorial, setVerHistorial] = useState(false);
  const [editandoResp, setEditandoResp] = useState(false);
  const [responsables, setResponsables] = useState(pendiente.responsables || []);

  const puede = puedeActualizarPendiente(perfil, pendiente, { gestiona, esModerador });
  const ultima = ultimaJustificacion(historial, pendiente.id);
  const entradas = historialDe(historial, pendiente.id);
  const semanas = semanasAbierto(pendiente);
  const abierto = pendiente.estado !== 'finalizado';

  async function guardar() {
    if (!actualizacionValida(justificacion)) return;
    const ok = await onActualizar(pendiente, { estado, justificacion: justificacion.trim() });
    if (ok !== false) {
      setActualizando(false);
      setJustificacion('');
    }
  }

  return (
    <div className="bg-white border border-navy-200 rounded-xl px-3 py-2.5">
      <div className="flex items-start gap-2 flex-wrap">
        <p className="text-sm font-medium text-navy-800 flex-1 min-w-[12rem] break-words">{pendiente.texto}</p>
        <ChipEstado estado={pendiente.estado} />
      </div>

      <p className="text-xs text-navy-500 mt-1">
        {(pendiente.responsables || []).map((id) => nombreDe(directorio, id)).join(', ') || 'Sin responsable'}
        {abierto && semanas >= 1 && (
          <span className={semanas >= 3 ? 'text-amber-600 font-semibold' : 'text-navy-400'}>
            {' · '}lleva {semanas} {semanas === 1 ? 'semana' : 'semanas'}
          </span>
        )}
      </p>

      {ultima && (
        <p className="text-xs text-navy-600 mt-1.5 bg-navy-50 rounded-md px-2 py-1.5">
          <span className="text-navy-400">{ultima.usuario_nombre || 'Alguien'} · {fechaLegible((ultima.created_at || '').slice(0, 10))}:</span>{' '}
          {ultima.justificacion}
        </p>
      )}

      {actualizando ? (
        <div className="mt-2 space-y-2 border-t border-navy-100 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-semibold text-navy-500">Estado:</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado del pendiente" className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm">
              {ESTADOS_PENDIENTE.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <textarea
            autoFocus
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="Por qué está así: qué se hizo, qué falta, de quién depende…"
            rows={2}
            className={entrada}
          />
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={!actualizacionValida(justificacion)}
              className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
            >
              Guardar
            </button>
            <button onClick={() => { setActualizando(false); setEstado(pendiente.estado); setJustificacion(''); }} className="text-sm text-navy-500 hover:text-navy-700 px-2">
              Cancelar
            </button>
          </div>
        </div>
      ) : editandoResp ? (
        <div className="mt-2 space-y-2 border-t border-navy-100 pt-2">
          <SelectorResponsables seleccion={responsables} onChange={setResponsables} directorio={directorio} reunionId={pendiente.serie} />
          <div className="flex gap-2">
            <button
              onClick={() => { onCambiarResponsables(pendiente, responsables); setEditandoResp(false); }}
              disabled={responsables.length === 0}
              className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
            >
              Guardar
            </button>
            <button onClick={() => { setEditandoResp(false); setResponsables(pendiente.responsables || []); }} className="text-sm text-navy-500 hover:text-navy-700 px-2">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {puede && (
            <button onClick={() => setActualizando(true)} className="text-xs font-semibold text-lime-600 hover:text-lime-700">
              Actualizar
            </button>
          )}
          {(gestiona || esModerador) && (
            <button onClick={() => setEditandoResp(true)} className="flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700">
              <UserCog className="w-3.5 h-3.5" /> Responsables
            </button>
          )}
          <button onClick={() => setVerHistorial((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700">
            <History className="w-3.5 h-3.5" /> Historial ({entradas.length})
          </button>
          {gestiona && (
            <button
              onClick={() => { if (window.confirm(`¿Borrar el pendiente "${pendiente.texto}"? Es para corregir un error; para cerrarlo, márcalo como finalizado.`)) onEliminar(pendiente); }}
              title="Borrar pendiente"
              className="text-navy-300 hover:text-red-500 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {verHistorial && (
        <ul className="mt-2 border-t border-navy-100 pt-2 space-y-1.5">
          {entradas.map((h) => (
            <li key={h.id} className="text-xs text-navy-600">
              <span className="text-navy-400">{fechaLegible((h.created_at || '').slice(0, 10))} · {h.usuario_nombre || 'Alguien'}</span>
              {h.accion === 'creado'
                ? <span> — creó el pendiente</span>
                : <span> — <span className="font-semibold">{etiquetaDeEstado(h.estado)}</span>: {h.justificacion}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------ pendiente nuevo */

function NuevoPendiente({ reunionId, directorio, onCrear }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [responsables, setResponsables] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const listo = texto.trim() && responsables.length > 0;

  async function crear() {
    if (!listo) return;
    setGuardando(true);
    const creado = await onCrear({ texto: texto.trim(), responsables });
    setGuardando(false);
    if (creado) {
      setTexto('');
      setResponsables([]);
      setAbierto(false);
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="flex items-center gap-1.5 text-sm font-semibold text-lime-600 hover:text-lime-700">
        <Plus className="w-4 h-4" /> Nuevo pendiente
      </button>
    );
  }
  return (
    <div className="border border-lime-400 bg-lime-50/40 rounded-xl p-3 space-y-2">
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué hay que hacer"
        className={entrada}
      />
      <SelectorResponsables seleccion={responsables} onChange={setResponsables} directorio={directorio} reunionId={reunionId} />
      <div className="flex gap-2">
        <button
          onClick={crear}
          disabled={!listo || guardando}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
        >
          Crear pendiente
        </button>
        <button onClick={() => setAbierto(false)} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
      </div>
      {texto.trim() && responsables.length === 0 && (
        <p className="text-xs text-navy-400">Un pendiente sin responsable no lo cierra nadie: elige al menos uno.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ los temas */

function TemaDeLaBandeja({ tema, directorio, puedeTratar, reunionId, onConvertir, onCerrar, onDeshacer, pendientes }) {
  const [modo, setModo] = useState(null); // null | 'pendiente' | 'cerrar'
  const [texto, setTexto] = useState(tema.texto);
  const [responsables, setResponsables] = useState(() => (
    (directorio || []).some((p) => p.id === tema.autorId) ? [tema.autorId] : []
  ));
  const [conclusion, setConclusion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const r = tema.resolucion;

  async function convertir() {
    if (!texto.trim() || responsables.length === 0) return;
    setGuardando(true);
    const ok = await onConvertir(tema, { texto: texto.trim(), responsables, conclusion: conclusion.trim() });
    setGuardando(false);
    if (ok) setModo(null);
  }
  async function cerrar() {
    if (!resolucionValida('sin_compromiso', conclusion)) return;
    setGuardando(true);
    const ok = await onCerrar(tema, conclusion.trim());
    setGuardando(false);
    if (ok) setModo(null);
  }

  const pendienteCreado = r?.pendiente_id ? (pendientes || []).find((p) => p.id === r.pendiente_id) : null;

  return (
    <div className={`border rounded-xl px-3 py-2.5 ${r ? 'bg-navy-50 border-navy-200' : 'bg-white border-navy-200'}`}>
      <p className="text-sm text-navy-800 break-words">{tema.texto}</p>
      <p className="text-xs text-navy-400 mt-0.5">{tema.autorNombre}</p>

      {r ? (
        <div className="flex items-start gap-2 mt-1.5">
          <p className="text-xs text-navy-600 flex-1">
            {r.resultado === 'pendiente'
              ? <>→ Quedó como pendiente{pendienteCreado ? `: ${pendienteCreado.texto}` : ''}{r.conclusion ? ` · ${r.conclusion}` : ''}</>
              : <>→ {r.conclusion}</>}
          </p>
          {puedeTratar && (
            <button onClick={() => onDeshacer(r)} className="text-xs text-navy-400 hover:text-navy-600 underline shrink-0">deshacer</button>
          )}
        </div>
      ) : modo === 'pendiente' ? (
        <div className="mt-2 space-y-2 border-t border-navy-100 pt-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto del pendiente" className={entrada} />
          <SelectorResponsables seleccion={responsables} onChange={setResponsables} directorio={directorio} reunionId={reunionId} />
          <input
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="En qué quedó (opcional)"
            className={entrada}
          />
          <div className="flex gap-2">
            <button
              onClick={convertir}
              disabled={!texto.trim() || responsables.length === 0 || guardando}
              className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
            >
              Crear pendiente
            </button>
            <button onClick={() => setModo(null)} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
          </div>
        </div>
      ) : modo === 'cerrar' ? (
        <div className="mt-2 space-y-2 border-t border-navy-100 pt-2">
          <input
            autoFocus
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="En qué quedó"
            className={entrada}
          />
          <div className="flex gap-2">
            <button
              onClick={cerrar}
              disabled={!resolucionValida('sin_compromiso', conclusion) || guardando}
              className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
            >
              Cerrar tema
            </button>
            <button onClick={() => setModo(null)} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
          </div>
        </div>
      ) : puedeTratar ? (
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <button onClick={() => setModo('pendiente')} className="text-xs font-semibold text-lime-600 hover:text-lime-700">
            Volver pendiente
          </button>
          <button onClick={() => setModo('cerrar')} className="text-xs font-semibold text-navy-500 hover:text-navy-700">
            Cerrar sin compromiso
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- la rotación */

function EditorRotacion({ orden, reunionId, directorio, onGuardar, onCerrar }) {
  const [lista, setLista] = useState(orden);
  const candidatos = participantes(reunionId, directorio).filter((p) => !lista.includes(p.id));

  function mover(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const copia = [...lista];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setLista(copia);
  }

  return (
    <div className="bg-nashville-50 border border-nashville-300 rounded-xl px-3 py-2.5 mb-4">
      <p className="text-xs font-semibold text-navy-600 mb-2">Orden de moderación</p>
      {lista.length === 0 && <p className="text-xs text-navy-400 italic mb-2">La lista está vacía.</p>}
      <ol className="space-y-1 mb-2">
        {lista.map((id, i) => (
          <li key={id} className="flex items-center gap-2 text-sm text-navy-700">
            <span className="text-navy-300 w-5 text-right">{i + 1}.</span>
            <span className="flex-1 min-w-0 truncate">{nombreDe(directorio, id)}</span>
            <button onClick={() => mover(i, -1)} title="Subir" className="text-navy-300 hover:text-navy-600 p-0.5"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => mover(i, 1)} title="Bajar" className="text-navy-300 hover:text-navy-600 p-0.5"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => setLista(lista.filter((x) => x !== id))} title="Quitar de la lista" className="text-navy-300 hover:text-red-500 p-0.5"><X className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value=""
          aria-label="Agregar a la rotación"
          onChange={(e) => { if (e.target.value) setLista([...lista, e.target.value]); }}
          className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
        >
          <option value="">+ Agregar…</option>
          {candidatos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button onClick={() => { onGuardar(lista); onCerrar(); }} className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg">
          Guardar
        </button>
        <button onClick={onCerrar} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ cabecera */

function CabeceraSesion({
  reunionId, semana, fecha, moderadorId, origenModerador, saltados, gestiona, directorio,
  orden, onGuardarSesion, onGuardarRotacion,
}) {
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(fecha);
  const [editandoRotacion, setEditandoRotacion] = useState(false);
  const corrida = fecha !== semana;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-sm">
        <p className="text-navy-700">
          <span className="font-semibold capitalize">{fechaLegible(fecha)}</span>
          {corrida && <span className="text-xs text-navy-400"> · se corrió del lunes</span>}
          {gestiona && !editandoFecha && (
            <button onClick={() => { setNuevaFecha(fecha); setEditandoFecha(true); }} className="text-xs font-semibold text-lime-600 hover:text-lime-700 underline ml-2">
              cambiar fecha
            </button>
          )}
        </p>
        <p className="text-navy-700 flex items-center gap-2 flex-wrap">
          <span className="text-navy-400">Modera:</span>
          {moderadorId ? (
            <span className="font-semibold">{nombreDe(directorio, moderadorId)}</span>
          ) : (
            <span className="text-navy-400 italic">
              {orden.length === 0 ? 'falta armar la rotación' : 'todos los de la lista están ausentes'}
            </span>
          )}
          {moderadorId && origenModerador === 'rotacion' && <span className="text-xs text-navy-400">(le toca por rotación)</span>}
          {gestiona && (
            <select
              value=""
              aria-label="Elegir moderador"
              onChange={(e) => { if (e.target.value) onGuardarSesion({ moderador_id: e.target.value }); }}
              className="rounded-md border border-navy-300 px-2 py-1 text-xs"
            >
              <option value="">cambiar…</option>
              {participantes(reunionId, directorio).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          {gestiona && (
            <button onClick={() => setEditandoRotacion((v) => !v)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 underline">
              rotación
            </button>
          )}
        </p>
      </div>

      {saltados.length > 0 && (
        <p className="text-xs text-navy-400 mt-1">
          Se saltó a {saltados.map((id) => nombreDe(directorio, id)).join(', ')}: tiene ausencia registrada ese día.
        </p>
      )}

      {editandoFecha && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <input
            type="date"
            value={nuevaFecha}
            aria-label="Fecha de la reunión"
            onChange={(e) => setNuevaFecha(e.target.value)}
            className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={() => { onGuardarSesion({ fecha: nuevaFecha }); setEditandoFecha(false); }}
            disabled={!fechaDeSesionValida(semana, nuevaFecha)}
            className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
          >
            Guardar
          </button>
          <button onClick={() => setEditandoFecha(false)} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
          {!fechaDeSesionValida(semana, nuevaFecha) && (
            <span className="text-xs text-red-600">Tiene que caer en la misma semana.</span>
          )}
        </div>
      )}

      {editandoRotacion && (
        <div className="mt-3">
          <EditorRotacion
            orden={orden}
            reunionId={reunionId}
            directorio={directorio}
            onGuardar={onGuardarRotacion}
            onCerrar={() => setEditandoRotacion(false)}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- registro */

function Registro({ registro, titulo, moderador, directorio }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!(await copiarTexto(textoDelRegistro(registro, { titulo, moderador, directorio })))) {
      window.alert('El navegador no dejó copiar. Selecciona el texto a mano.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  if (registroVacio(registro)) {
    return <p className="text-sm text-navy-300 italic">Todavía no hay nada registrado en esta sesión.</p>;
  }

  return (
    <div className="bg-white border border-navy-200 rounded-xl px-3 py-2.5 space-y-3">
      {registro.temas.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400 mb-1">Temas tratados</p>
          <ul className="space-y-0.5">
            {registro.temas.map((t) => (
              <li key={t.id} className="text-sm text-navy-700">
                - {t.texto} <span className="text-navy-400">({nombreDe(directorio, t.autor_id)})</span>
                {' → '}
                {t.resultado === 'pendiente' ? `quedó como pendiente${t.pendiente ? `: ${t.pendiente.texto}` : ''}` : t.conclusion}
              </li>
            ))}
          </ul>
        </div>
      )}
      {registro.revisados.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400 mb-1">Pendientes revisados</p>
          <ul className="space-y-0.5">
            {registro.revisados.map((h) => (
              <li key={h.id} className="text-sm text-navy-700">
                - {h.pendiente?.texto}: <span className="font-semibold">{etiquetaDeEstado(h.estado)}</span> · {h.justificacion}
              </li>
            ))}
          </ul>
        </div>
      )}
      {registro.nuevos.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400 mb-1">Pendientes nuevos</p>
          <ul className="space-y-0.5">
            {registro.nuevos.map((p) => (
              <li key={p.id} className="text-sm text-navy-700">
                - {p.texto} <span className="text-navy-400">· {(p.responsables || []).map((id) => nombreDe(directorio, id)).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={copiar} className="flex items-center gap-1.5 text-xs font-semibold text-navy-500 hover:text-navy-700">
        {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copiado ? 'Copiado' : 'Copiar el registro'}
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- raíz */

function Bloque({ titulo, children, accion }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500">{titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

export default function ReunionesView({
  perfil, directorio, resumenes, ausencias, disponible = true,
  sesiones, rotaciones, pendientes, historial, temasTratados,
  onAsegurarSesion, onGuardarSesion, onGuardarRotacion,
  onCrearPendiente, onActualizarPendiente, onCambiarResponsables, onEliminarPendiente,
  onResolverTema, onDeshacerTema,
}) {
  const [reunionId, setReunionId] = useState(() => reunionInicial(perfil));
  const [semana, setSemana] = useState(() => lunesDe());
  const [verFinalizados, setVerFinalizados] = useState(false);
  const semanas = useMemo(() => ultimasSemanas(12), []);
  const semanaActual = lunesDe();
  const mias = reunionesDePersona(perfil).map((r) => r.id);
  const reunion = reunionPorId(reunionId);

  /* La sesión que se está mirando, y la de esta semana: los pendientes son
     siempre los de hoy, así que el moderador que cuenta para ellos es el de
     esta semana aunque se esté mirando una vieja. */
  const sesion = sesionDe(sesiones, reunionId, semana);
  const fecha = fechaDeSesion(sesion, semana);
  const sugerido = moderadorSugerido({ reunionId, semana, fecha, sesiones, rotaciones, ausencias });
  const moderadorId = sesion?.moderador_id || sugerido.usuarioId;
  const origenModerador = sesion?.moderador_id ? 'asignado' : 'rotacion';

  const sesionActual = sesionDe(sesiones, reunionId, semanaActual);
  const moderadorActualId = sesionActual?.moderador_id
    || moderadorSugerido({ reunionId, semana: semanaActual, fecha: fechaDeSesion(sesionActual, semanaActual), sesiones, rotaciones, ausencias }).usuarioId;

  const gestiona = gestionaReunion(perfil, reunionId);
  const puedeTratar = disponible && (gestiona || (!!perfil?.id && perfil.id === moderadorId));
  const esModeradorActual = !!perfil?.id && perfil.id === moderadorActualId;

  const { abiertos, finalizados } = pendientesDeReunion(pendientes, reunionId);
  const sesionId = idDeSesion(reunionId, semana);
  const temas = bandejaDeLaSesion(temasParaLaSesion(resumenes, reunionId, semana, directorio), temasTratados, sesionId);
  const porTratar = temas.filter((t) => !t.resolucion).length;
  const registro = registroDeLaSesion({ sesionId, fecha, temasTratados, pendientes, historial, reunionId });

  /* Lo primero que se hace en una sesión la crea, con el moderador que le
     tocaba: así la rotación avanza sola desde quien moderó de verdad. */
  async function conSesion(accion) {
    const id = await onAsegurarSesion(reunionId, semana, moderadorId);
    if (!id) return null;
    return accion(id);
  }

  const crearPendiente = ({ texto, responsables }) => conSesion((id) => onCrearPendiente({ serie: reunionId, texto, responsables, sesionId: id }));

  async function convertirTema(tema, { texto, responsables, conclusion }) {
    return conSesion(async (id) => {
      const creado = await onCrearPendiente({ serie: reunionId, texto, responsables, sesionId: id });
      if (!creado) return false;
      return onResolverTema({ sesionId: id, tema, resultado: 'pendiente', conclusion, pendienteId: creado.id });
    });
  }

  const cerrarTema = (tema, conclusion) => conSesion((id) => onResolverTema({ sesionId: id, tema, resultado: 'sin_compromiso', conclusion }));

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2 mb-1">
        <Handshake className="w-6 h-6 text-navy-400" /> Reuniones
      </h1>
      <p className="text-sm text-navy-500 mb-4">
        Lo que se revisa cada lunes, los temas que llegan de los resúmenes y los pendientes que quedan.
      </p>

      {!disponible && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
          Falta correr la migración de reuniones (<span className="font-mono">migration_reuniones.sql</span>). Mientras
          tanto esta sección se ve, pero no se puede guardar nada.
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex gap-1 flex-wrap">
          {REUNIONES.map((r) => (
            <button
              key={r.id}
              onClick={() => setReunionId(r.id)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                reunionId === r.id ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
              }`}
            >
              {r.label.replace('Reunión ', '').replace(/^./, (c) => c.toUpperCase())}
              {mias.includes(r.id) && <span className="ml-1.5 text-[10px] font-semibold opacity-70">· la tuya</span>}
            </button>
          ))}
        </div>
        <select
          value={semana}
          onChange={(e) => setSemana(e.target.value)}
          aria-label="Semana"
          className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
        >
          {semanas.map((s) => (
            <option key={s} value={s}>Semana del {fechaLegible(s).replace(/^\S+ /, '')}{s === semanaActual ? ' (esta)' : ''}</option>
          ))}
        </select>
      </div>

      <CabeceraSesion
        key={`${reunionId}-${semana}`}
        reunionId={reunionId}
        semana={semana}
        fecha={fecha}
        moderadorId={moderadorId}
        origenModerador={origenModerador}
        saltados={sesion?.moderador_id ? [] : sugerido.saltados}
        gestiona={gestiona && disponible}
        directorio={directorio}
        orden={ordenDeRotacion(rotaciones, reunionId)}
        onGuardarSesion={(patch) => onGuardarSesion(reunionId, semana, patch, moderadorId)}
        onGuardarRotacion={(orden) => onGuardarRotacion(reunionId, orden)}
      />

      <Bloque titulo={`Pendientes (${abiertos.length})`}>
        <div className="space-y-2 mb-3">
          {abiertos.length === 0 && <p className="text-sm text-navy-300 italic">No hay pendientes abiertos en esta reunión.</p>}
          {abiertos.map((p) => (
            <TarjetaPendiente
              key={`${p.id}-${p.estado}-${(p.responsables || []).join(',')}`}
              pendiente={p}
              historial={historial}
              directorio={directorio}
              perfil={perfil}
              gestiona={gestiona && disponible}
              esModerador={esModeradorActual && disponible}
              onActualizar={onActualizarPendiente}
              onCambiarResponsables={onCambiarResponsables}
              onEliminar={onEliminarPendiente}
            />
          ))}
        </div>
        {puedeTratar && <NuevoPendiente reunionId={reunionId} directorio={directorio} onCrear={crearPendiente} />}
      </Bloque>

      <Bloque titulo={`Temas de los resúmenes${temas.length > 0 ? ` (${porTratar} por tratar)` : ''}`}>
        {temas.length === 0 ? (
          <p className="text-sm text-navy-300 italic">
            Nadie marcó temas para esta reunión en su resumen de la semana anterior.
          </p>
        ) : (
          <div className="space-y-2">
            {temas.map((t) => (
              <TemaDeLaBandeja
                key={t.clave}
                tema={t}
                directorio={directorio}
                puedeTratar={puedeTratar}
                reunionId={reunionId}
                pendientes={pendientes}
                onConvertir={convertirTema}
                onCerrar={cerrarTema}
                onDeshacer={onDeshacerTema}
              />
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Registro de la sesión">
        <Registro
          registro={registro}
          titulo={`${reunion?.label || 'Reunión'} · ${fechaLegible(fecha)}`}
          moderador={moderadorId ? nombreDe(directorio, moderadorId) : null}
          directorio={directorio}
        />
      </Bloque>

      {finalizados.length > 0 && (
        <Bloque
          titulo={`Finalizados (${finalizados.length})`}
          accion={(
            <button onClick={() => setVerFinalizados((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700">
              {verFinalizados ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {verFinalizados ? 'ocultar' : 'ver'}
            </button>
          )}
        >
          {verFinalizados && (
            <div className="space-y-2">
              {finalizados.map((p) => (
                <TarjetaPendiente
                  key={`${p.id}-${p.estado}`}
                  pendiente={p}
                  historial={historial}
                  directorio={directorio}
                  perfil={perfil}
                  gestiona={gestiona && disponible}
                  esModerador={esModeradorActual && disponible}
                  onActualizar={onActualizarPendiente}
                  onCambiarResponsables={onCambiarResponsables}
                  onEliminar={onEliminarPendiente}
                />
              ))}
            </div>
          )}
        </Bloque>
      )}

      <p className="text-xs text-navy-300 italic">
        Los cambios que hagan los demás aparecen al refrescar los datos (el botón de flechas, arriba en el menú).
      </p>
    </div>
  );
}
