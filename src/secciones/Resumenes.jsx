/* ============================================================================
   RESÚMENES SEMANALES
   ----------------------------------------------------------------------------
   Cada viernes —o el último día que se trabaje— cada quien registra lo que
   hizo. Cuatro bloques que se escriben a mano (Lo mejor, Pendientes,
   Dificultades, Temas) y un bloque de avance que la aplicación arma sola con
   el estado de SUS documentos, comparado contra la foto de la semana pasada.

   El cálculo está aparte, en shared/resumenes.js. Aquí solo está la pantalla.

   Tres cosas que explican cómo se comporta:

   - No hay "guardar borrador". Lo que se escribe se va guardando solo: si
     estás editando, es un borrador, y decirlo con un botón sobraba. El único
     botón que importa es ENVIAR, que congela la foto del avance — si se
     recalculara después, el número de una semana vieja cambiaría cada vez que
     alguien toca un documento y la comparación con la semana siguiente
     dejaría de significar nada.

   - Un renglón escrito se "quema": deja de ser una caja de texto abierta y
     pasa a ser texto, con un lápiz para volver a entrar. Con la caja siempre
     abierta era muy fácil dañar de un teclazo algo ya escrito.

   - Los resúmenes los lee todo el mundo, pero solo los ENVIADOS: un borrador
     ajeno no se muestra. Escribir el propio lo impone la RLS, no esta
     pantalla.
   ============================================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck, CalendarClock, Check, ChevronDown, ChevronRight, Copy, ExternalLink, MessagesSquare,
  Pencil, Plus, Send, Users, X,
} from 'lucide-react';
import { DOC_ESTADOS, DOC_ESTADO_HEX, DOC_ESTADO_CORTO } from '../shared/dominio.jsx';
import { ROLES, isLeader, roleLabel } from '../shared/permisos.js';
import { FiltroFichas, alternarEn, Avatar } from '../shared/ui.jsx';
import { copiarTexto } from '../shared/copiar.jsx';
import {
  BLOQUES_RESUMEN, DESTINOS_TEMA, DESTINO_POR_DEFECTO, cierreDeSemana, cierreValido, contarTemas, cuentaDeFoto, estadoDeEntrega,
  etiquetaDeSemana, fotoConComparacion, fotoDeLaSemana, lineasDeBloque, lunesDe, normalizarTema,
  notaDeCierre, repartirEnReuniones, MOTIVOS_AUSENCIA, etiquetaDeMotivo, ausenciaDeLaSemana,
  ausenciasQueTocan, rangoDeAusenciaValido,
  sumarDias, temasDeLaSemana, textoDeTemas, textoDelResumen, ultimasSemanas,
} from '../shared/resumenes.js';

/* "viernes 11 de septiembre" — cómo se lee una fecha suelta en la cabecera. */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_CORTOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function diaYMes(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES_CORTOS[m - 1]}`;
}

/* El viernes de esa semana, para saber si el cierre está en su sitio o lo
   movieron. */
function viernesDeLaSemana(lunesIso) {
  return sumarDias(lunesIso, 4);
}

/* --------------------------------------------------------------- el avance */

/* Barra de estados: una franja por estado, con los mismos colores de la torta
   del Dashboard. "No aplica" no entra, igual que allá. Al pasar el mouse cada
   franja dice cuántos documentos son y qué parte del total representan. */
function BarraEstados({ porEstado, seguidos }) {
  if (!seguidos) {
    return <div className="h-2.5 rounded-full bg-navy-100 w-full" title="Sin documentos que seguir" />;
  }
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex w-full bg-navy-100">
      {DOC_ESTADOS.filter((e) => e !== 'No aplica' && porEstado[e] > 0).map((estado) => {
        const n = porEstado[estado];
        const pct = Math.round((n / seguidos) * 100);
        return (
          <div
            key={estado}
            title={`${DOC_ESTADO_CORTO[estado] || estado}: ${n} ${n === 1 ? 'documento' : 'documentos'} (${pct}%)`}
            style={{ width: `${(n / seguidos) * 100}%`, backgroundColor: DOC_ESTADO_HEX[estado] }}
          />
        );
      })}
    </div>
  );
}

function ChipPapel({ papel }) {
  const clase = papel === 'E' ? 'bg-lime-300 text-navy-900' : 'bg-nashville-200 text-navy-800';
  return (
    <span
      title={papel === 'E' ? 'Lo elaboras o lo dibujas' : 'Lo revisas'}
      className={`text-[10px] font-bold leading-none px-1.5 py-0.5 rounded shrink-0 ${clase}`}
    >
      {papel}
    </span>
  );
}

/* Mis documentos de ese proyecto, agrupados por estado. Es la respuesta a
   "¿cuáles está contando exactamente?": sin esta lista, el porcentaje es un
   número que hay que creerse. */
function ListaDeMisDocumentos({ foto }) {
  const codigosMovidos = new Set((foto.cambios || []).map((c) => c.codigo));
  const porEstado = new Map();
  Object.entries(foto.estados || {}).forEach(([codigo, estado]) => {
    if (!porEstado.has(estado)) porEstado.set(estado, []);
    porEstado.get(estado).push(codigo);
  });

  return (
    <div className="mt-2 space-y-2">
      {DOC_ESTADOS.filter((e) => porEstado.has(e)).map((estado) => (
        <div key={estado}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DOC_ESTADO_HEX[estado] || '#CBD5E6' }} />
            {DOC_ESTADO_CORTO[estado] || estado} ({porEstado.get(estado).length})
          </p>
          <ul className="pl-3.5 mt-0.5 space-y-0.5">
            {porEstado.get(estado).map((codigo) => (
              <li key={codigo} className="text-xs text-navy-600 flex items-center gap-1.5">
                {(foto.papeles?.[codigo] || []).map((p) => <ChipPapel key={p} papel={p} />)}
                <span className="min-w-0">{foto.nombres?.[codigo] || codigo}</span>
                {codigosMovidos.has(codigo) && (
                  <span className="text-[10px] font-semibold text-lime-600 shrink-0">· se movió</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TarjetaAvance({ foto, onAbrirProyecto }) {
  const [abierto, setAbierto] = useState(false);
  const { seguidos, apc, pct } = cuentaDeFoto(foto);
  const cambios = foto.cambios || [];
  const movimiento = !foto.hayComparacion
    ? 'primera semana registrada'
    : foto.avanzaron === 0
      ? 'sin cambios esta semana'
      : `${foto.avanzaron} ${foto.avanzaron === 1 ? 'documento avanzó' : 'documentos avanzaron'}`;

  return (
    <div className="bg-white border border-navy-200 rounded-lg px-3 py-2.5">
      {/* Dos botones hermanos, nunca uno dentro de otro: el navegador saca el
          anidado de su sitio y se pierde el clic. */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onAbrirProyecto && onAbrirProyecto(foto.id)}
          disabled={!onAbrirProyecto}
          title={onAbrirProyecto ? `Abrir ${foto.nombre}` : undefined}
          className="group min-w-0 flex-1 text-left flex items-center gap-1.5 disabled:cursor-default"
        >
          <span className="text-sm font-semibold text-navy-700 group-hover:text-lime-600 group-disabled:text-navy-700 truncate">
            {foto.nombre}
          </span>
          {onAbrirProyecto && <ExternalLink className="w-3 h-3 text-navy-300 group-hover:text-lime-600 shrink-0" />}
        </button>
        <span className="text-sm font-bold text-navy-800 tabular-nums shrink-0">{pct}%</span>
        <span className="text-xs text-navy-400 whitespace-nowrap shrink-0">{apc} de {seguidos} en APC</span>
      </div>

      <div className="mt-1.5 mb-1.5">
        <BarraEstados porEstado={foto.porEstado} seguidos={seguidos} />
      </div>

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700"
      >
        {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="text-navy-400 font-normal">{movimiento}</span>
        <span>· {abierto ? 'ocultar' : `ver mis ${foto.total} documentos`}</span>
      </button>

      {abierto && (
        <>
          {cambios.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 pl-4">
              {cambios.map((c) => (
                <li key={c.codigo} className="text-xs text-navy-500">
                  <span className="font-medium text-navy-700">{c.nombre}</span>: {c.de} → {c.a}
                  {c.avance < 0 && <span className="text-amber-600"> (retrocedió)</span>}
                </li>
              ))}
            </ul>
          )}
          <ListaDeMisDocumentos foto={foto} />
        </>
      )}
    </div>
  );
}

function BloqueAvance({ fotos, onAbrirProyecto }) {
  if (fotos.length === 0) {
    return (
      <p className="text-sm text-navy-300 italic">
        No tienes documentos a cargo esta semana. Los documentos salen del dossier de cada proyecto: si crees que
        alguno debería ser tuyo, un líder puede repartirlos en la sección Dossiers.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {fotos.map((f) => <TarjetaAvance key={f.id} foto={f} onAbrirProyecto={onAbrirProyecto} />)}
    </div>
  );
}

/* ------------------------------------------------------------ los 4 bloques */

/* Lista de viñetas. Un renglón se escribe y se "quema": pasa a ser texto, con
   un lápiz para volver a entrar. Con la caja de texto siempre abierta bastaba
   un teclazo despistado para dañar algo ya escrito. */
/* Las dos reuniones a las que puede ir un tema, para elegir al escribirlo.
   Va pegado al renglón y no arriba del bloque a propósito: cada tema escoge
   la suya, y quien escribe tres puede mandar dos a su área y una a diseño. */
function ElegirReunion({ valor, onChange }) {
  return (
    <span className="flex gap-1 shrink-0">
      {DESTINOS_TEMA.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          title={d.ayuda}
          aria-pressed={valor === d.id}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
            valor === d.id ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-400 border-navy-300 hover:border-navy-400'
          }`}
        >
          {d.label}
        </button>
      ))}
    </span>
  );
}

/* Con `conDestino`, cada renglón es { texto, reunion } en vez de una cadena;
   sin él, la lista sigue siendo de texto pelado como los otros tres bloques. */
function ListaEditable({ lineas, onChange, ayuda, vacio, conDestino }) {
  /* Índice del renglón que se está escribiendo, o null si todos están
     quemados. Es estado de interfaz puro: no se guarda. */
  const [editando, setEditando] = useState(null);
  const valores = lineas || [];

  const textoDe = (l) => (conDestino ? normalizarTema(l).texto : (l || ''));
  const conTexto = (l, texto) => (conDestino ? { ...normalizarTema(l), texto } : texto);
  const enBlanco = () => (conDestino ? { texto: '', reunion: DESTINO_POR_DEFECTO } : '');

  function cambiar(i, texto) {
    onChange(valores.map((l, j) => (j === i ? conTexto(l, texto) : l)));
  }
  function cambiarReunion(i, reunion) {
    onChange(valores.map((l, j) => (j === i ? { ...normalizarTema(l), reunion } : l)));
  }
  /* Al quemar, un renglón vacío se descarta: no tiene sentido guardar viñetas
     en blanco que después salen como "-" en el texto del chat. */
  function quemar() {
    onChange(valores.filter((l) => textoDe(l).trim() !== ''));
    setEditando(null);
  }
  function agregar() {
    const limpias = valores.filter((l) => textoDe(l).trim() !== '');
    onChange([...limpias, enBlanco()]);
    setEditando(limpias.length);
  }
  function quitar(i) {
    onChange(valores.filter((_, j) => j !== i));
    setEditando(null);
  }

  return (
    <div>
      <div className="space-y-1.5">
        {valores.map((linea, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-navy-300 shrink-0">-</span>
            {editando === i ? (
              <>
                <input
                  autoFocus
                  value={textoDe(linea)}
                  onChange={(e) => cambiar(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); quemar(); }
                    if (e.key === 'Escape') { e.preventDefault(); quemar(); }
                  }}
                  placeholder={ayuda}
                  className="flex-1 min-w-0 rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
                />
                <button
                  type="button"
                  onClick={quemar}
                  title="Listo (o pulsa Enter)"
                  className="text-emerald-500 hover:text-emerald-700 shrink-0 p-1"
                >
                  <Check className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 text-sm text-navy-700 break-words">{textoDe(linea)}</span>
                <button
                  type="button"
                  onClick={() => setEditando(i)}
                  title="Editar este renglón"
                  className="text-navy-300 hover:text-navy-600 shrink-0 p-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {conDestino && (
              <ElegirReunion valor={normalizarTema(linea).reunion} onChange={(r) => cambiarReunion(i, r)} />
            )}
            <button
              type="button"
              onClick={() => quitar(i)}
              title="Quitar este renglón"
              className="text-navy-300 hover:text-red-500 shrink-0 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700 mt-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar renglón
      </button>
      {valores.length === 0 && (
        <p className="text-xs text-navy-300 italic mt-1">Si lo dejas vacío se escribe "{vacio}".</p>
      )}
    </div>
  );
}

function BloqueEnLectura({ bloque, lineas }) {
  const limpias = lineasDeBloque(bloque.key, { [bloque.key]: lineas });
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-1">{bloque.label}</p>
      {limpias.length === 0 ? (
        <p className="text-sm text-navy-300 italic">{bloque.vacio}</p>
      ) : (
        <ul className="space-y-0.5">
          {limpias.map((l, i) => <li key={i} className="text-sm text-navy-700">- {l}</li>)}
        </ul>
      )}
    </div>
  );
}

/* Un resumen ya enviado, en lectura: lo que ve el resto del equipo. */
function ResumenEnLectura({ resumen, onAbrirProyecto }) {
  const fotos = resumen?.proyectos || [];
  return (
    <div className="space-y-4">
      {fotos.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Avance de sus proyectos</p>
          <div className="space-y-2">
            {fotos.map((f) => <TarjetaAvance key={f.id} foto={f} onAbrirProyecto={onAbrirProyecto} />)}
          </div>
        </div>
      )}
      {BLOQUES_RESUMEN.map((bloque) => (
        <BloqueEnLectura key={bloque.key} bloque={bloque} lineas={resumen?.bloques?.[bloque.key]} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- mi resumen */

function MiResumen({ semana, cierre, guardado, fotosEnVivo, onGuardar, onAbrirProyecto }) {
  const [bloques, setBloques] = useState(() => guardado?.bloques || {});
  const [hasta, setHasta] = useState(() => guardado?.hasta || cierre);
  const [incluirAvance, setIncluirAvance] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [guardadoSolo, setGuardadoSolo] = useState(false);
  /* Nada se guarda hasta que la persona escriba algo: entrar a mirar la
     pantalla no debe crear un resumen vacío a nombre de nadie. */
  const tocado = useRef(false);

  const enviado = !!guardado?.enviado;
  /* Enviado: la foto queda congelada. Sin enviar: se recalcula al abrir,
     porque es el estado de ahora. */
  const fotos = enviado ? (guardado.proyectos || []) : fotosEnVivo;

  /* Se guarda solo, poco después de dejar de escribir. No hay botón de
     "guardar borrador" a propósito: si estás editando, es un borrador. */
  useEffect(() => {
    if (!tocado.current || enviado) return;
    const t = setTimeout(async () => {
      await onGuardar({ semana, hasta, bloques, proyectos: fotos, enviado: false });
      setGuardadoSolo(true);
      setTimeout(() => setGuardadoSolo(false), 2000);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloques, hasta, enviado]);

  function editar(cambio) {
    tocado.current = true;
    cambio();
  }

  async function copiar() {
    const texto = textoDelResumen({ bloques, proyectos: fotos, incluirAvance });
    if (!(await copiarTexto(texto))) {
      window.alert('El navegador no dejó copiar. Selecciona el texto a mano.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  async function enviar(marcar) {
    setEnviando(true);
    await onGuardar({ semana, hasta, bloques, proyectos: fotos, enviado: marcar });
    setEnviando(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-navy-500">Cubre hasta:</label>
        <input
          type="date"
          value={hasta}
          disabled={enviado}
          onChange={(e) => editar(() => setHasta(e.target.value))}
          className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm disabled:bg-navy-50 disabled:text-navy-400"
        />
        <p className="text-xs text-navy-400 flex-1 min-w-[14rem]">
          Viene puesto en el día que cierra la semana. Si sales antes —vacaciones, un viaje— ciérralo el día que de
          verdad trabajaste; eso no le cambia la semana a nadie más.
        </p>
      </div>

      {enviado && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex-wrap">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 flex-1 min-w-[14rem]">
            Enviado. El avance quedó congelado tal como estaba, para que la comparación de la semana entrante tenga
            contra qué medirse.
          </p>
          <button
            onClick={() => enviar(false)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline shrink-0"
          >
            Volver a editar
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Avance de mis proyectos</p>
        <BloqueAvance fotos={fotos} onAbrirProyecto={onAbrirProyecto} />
      </div>

      {BLOQUES_RESUMEN.map((bloque) => (
        enviado ? (
          <BloqueEnLectura key={bloque.key} bloque={bloque} lineas={bloques[bloque.key]} />
        ) : (
          <div key={bloque.key}>
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{bloque.label}</p>
            <ListaEditable
              lineas={bloques[bloque.key]}
              ayuda={bloque.ayuda}
              vacio={bloque.vacio}
              conDestino={bloque.conDestino}
              onChange={(nuevas) => editar(() => setBloques((prev) => ({ ...prev, [bloque.key]: nuevas })))}
            />
          </div>
        )
      ))}

      <div className="flex items-center gap-3 flex-wrap border-t border-navy-200 pt-4">
        {!enviado && (
          <button
            onClick={() => enviar(true)}
            disabled={enviando}
            className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-40"
          >
            <Send className="w-4 h-4" /> Enviar
          </button>
        )}
        <button
          onClick={copiar}
          className="flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:text-navy-800 border border-navy-300 rounded-lg px-3 py-2"
        >
          {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copiado ? 'Copiado' : 'Copiar para el chat'}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-navy-500">
          <input type="checkbox" checked={incluirAvance} onChange={(e) => setIncluirAvance(e.target.checked)} />
          incluir el avance en el texto
        </label>
        {guardadoSolo && <span className="text-xs text-navy-400">Guardado</span>}
      </div>
      <p className="text-xs text-navy-300 italic">
        Lo que escribes se guarda solo. Al enviar, el avance queda congelado y sirve de punto de partida para la
        semana entrante. Las menciones tipo @Fulano no se pueden generar desde aquí: salen como texto y toca volver a
        mencionarlas al pegar.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- el cierre */

/* El día en que cierra la semana PARA TODOS. Normalmente el viernes; cuando
   ese viernes es festivo, un líder lo corre y a todo el equipo le cambia la
   fecha de entrega. Es distinto del "cubre hasta" de cada resumen, que es una
   decisión individual y no le mueve la semana a nadie más. */
function CierreDeLaSemana({ semana, cierre, nota, puedeMover, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState(cierre);
  const [texto, setTexto] = useState(nota);
  const movido = cierre !== viernesDeLaSemana(semana);
  const valido = cierreValido(semana, fecha);

  function guardar() {
    if (!valido) return;
    onGuardar(semana, fecha, texto);
    setEditando(false);
  }
  function volverAlViernes() {
    onGuardar(semana, null, '');
    setEditando(false);
  }

  if (editando) {
    return (
      <div className="bg-nashville-50 border border-nashville-300 rounded-xl px-3 py-2.5 mb-4">
        <p className="text-xs font-semibold text-navy-600 mb-2">Mover el cierre de esta semana</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            aria-label="Día en que cierra la semana"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por qué (ej. viernes festivo)"
            className="flex-1 min-w-[12rem] rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={guardar}
            disabled={!valido}
            className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-3 py-1.5 rounded-lg"
          >
            Guardar
          </button>
          {movido && (
            <button onClick={volverAlViernes} className="text-sm text-navy-500 hover:text-navy-700 px-2 py-1.5">
              Volver al viernes
            </button>
          )}
          <button onClick={() => setEditando(false)} className="text-sm text-navy-500 hover:text-navy-700 px-2 py-1.5">
            Cancelar
          </button>
        </div>
        {!valido && (
          <p className="text-xs text-red-600 mt-1.5">
            El cierre tiene que caer dentro de esta misma semana.
          </p>
        )}
        <p className="text-xs text-navy-400 mt-1.5">
          Le cambia la fecha de entrega a todo el equipo. Para cerrar solo el tuyo antes —vacaciones, un viaje— usa
          "Cubre hasta" en tu resumen.
        </p>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 flex-wrap text-xs text-navy-500 mb-4">
      <CalendarClock className="w-3.5 h-3.5 text-navy-400 shrink-0" />
      <span>
        Cierra el <span className="font-semibold text-navy-700">{diaYMes(cierre)}</span>
        {movido && nota ? ` · ${nota}` : ''}
        {movido && !nota ? ' · movido' : ''}
      </span>
      {puedeMover && (
        <button
          onClick={() => { setFecha(cierre); setTexto(nota); setEditando(true); }}
          className="font-semibold text-lime-600 hover:text-lime-700 underline"
        >
          {movido ? 'cambiar' : 'moverlo'}
        </button>
      )}
    </p>
  );
}

/* ------------------------------------------------------------- el equipo */

/* Cómo se ve cada estado de entrega. "Cierra hoy" avisa sin alarmar —el
   resumen se manda ese día, casi siempre por la tarde— y solo pasado el cierre
   se marca en rojo. */
const CHIP_ENTREGA = {
  enviado: { texto: 'Enviado', clase: 'bg-emerald-100 text-emerald-800' },
  /* Ausente no es un incumplimiento: va en azul, no en rojo, y el motivo lo
     reemplaza para que se entienda sin abrir nada. */
  ausente: { texto: 'Ausente', clase: 'bg-sky-100 text-sky-700' },
  pendiente: { texto: 'Sin registrar', clase: 'bg-navy-100 text-navy-500' },
  cierra_hoy: { texto: 'Cierra hoy', clase: 'bg-amber-100 text-amber-800' },
  vencido: { texto: 'No lo envió', clase: 'bg-red-100 text-red-700' },
};

function FilaPersona({ persona, resumen, onAbrirProyecto, cierre, ausencia }) {
  const [abierto, setAbierto] = useState(false);
  /* Un borrador ajeno no se muestra: mientras no esté enviado, no está dicho. */
  const enviado = !!resumen?.enviado;
  const estado = estadoDeEntrega(resumen, cierre, new Date(), ausencia);
  const base = CHIP_ENTREGA[estado] || CHIP_ENTREGA.pendiente;
  const chip = estado === 'ausente' ? { ...base, texto: etiquetaDeMotivo(ausencia.motivo) } : base;

  return (
    <div className="bg-white border border-navy-200 rounded-xl">
      <button
        onClick={() => enviado && setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {enviado
          ? (abierto ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />)
          : <span className="w-4 shrink-0" />}
        <Avatar name={persona.nombre} foto={persona.foto} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-700 truncate">{persona.nombre}</p>
          <p className="text-xs text-navy-400 truncate">{(persona.roles || []).map(roleLabel).join(' · ') || 'Sin rol asignado'}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${chip.clase}`}>
          {chip.texto}
        </span>
      </button>
      {abierto && enviado && (
        <div className="border-t border-navy-100 px-3 py-3">
          <ResumenEnLectura resumen={resumen} onAbrirProyecto={onAbrirProyecto} />
        </div>
      )}
    </div>
  );
}

/* Quien SOLO es Desarrollador no hace parte del seguimiento semanal: no
   entrega diseño. Quien tiene además un rol técnico sí aparece, porque
   entonces sí hace trabajo que se reporta. */
export function esSoloDesarrollador(persona) {
  const roles = persona?.roles || [];
  return roles.length > 0 && roles.every((r) => r === 'desarrollador');
}

/* Registrar que alguien no estuvo. Se anota una vez con su rango y cubre todas
   las semanas que toque: nadie tiene que acordarse cada lunes.

   Un líder la registra por cualquiera —quien está incapacitado no entra a la
   plataforma a marcarse— y el resto, solo la suya. La RLS es la que de verdad
   lo impide; esto solo evita ofrecer lo que va a fallar. */
function FormularioAusencia({ gente, perfil, semana, onGuardar, onCancelar }) {
  const puedePorOtros = isLeader(perfil);
  const [usuarioId, setUsuarioId] = useState(perfil?.id || '');
  const [desde, setDesde] = useState(semana);
  const [hasta, setHasta] = useState(sumarDias(semana, 4));
  const [motivo, setMotivo] = useState('vacaciones');
  const [nota, setNota] = useState('');
  const valido = !!usuarioId && rangoDeAusenciaValido(desde, hasta);

  return (
    <div className="bg-white border border-navy-200 rounded-xl p-3 mb-3">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 min-w-[10rem] flex-1">
          <span className="text-xs font-semibold text-navy-500">Quién</span>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            disabled={!puedePorOtros}
            className="rounded-md border border-navy-300 px-2 py-1.5 text-sm disabled:bg-navy-50 disabled:text-navy-400"
          >
            {(puedePorOtros ? gente : gente.filter((p) => p.id === perfil?.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-500">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-navy-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-500">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border border-navy-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-500">Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
            className="rounded-md border border-navy-300 px-2 py-1.5 text-sm">
            {MOTIVOS_AUSENCIA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full mt-2 rounded-md border border-navy-300 px-2 py-1.5 text-sm"
      />
      {!rangoDeAusenciaValido(desde, hasta) && (
        <p className="text-xs text-red-500 mt-1.5">La fecha de "hasta" no puede ser anterior a la de "desde".</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          disabled={!valido}
          onClick={() => onGuardar({ usuario_id: usuarioId, desde, hasta, motivo, nota: nota.trim() || null })}
          className="text-sm font-semibold bg-navy-800 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          Registrar
        </button>
        <button onClick={onCancelar} className="text-sm text-navy-500 hover:text-navy-700 px-2">Cancelar</button>
      </div>
    </div>
  );
}

/* Las ausencias que tocan la semana que se está mirando. Se listan aunque
   cubran solo un par de días: un "sale el jueves" también hay que verlo,
   aunque esa persona sí deba su resumen. */
function PanelAusencias({ ausencias, gente, perfil, semana, onGuardar, onBorrar }) {
  const [abriendo, setAbriendo] = useState(false);
  const delAsemana = ausenciasQueTocan(ausencias, semana);
  const nombreDe = (id) => (gente.find((p) => p.id === id) || {}).nombre || 'Alguien que ya no está';
  const puedeBorrar = (a) => isLeader(perfil) || a.usuario_id === perfil?.id;

  if (!onGuardar) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 flex-1">
          Ausencias <span className="text-navy-300">({delAsemana.length})</span>
        </p>
        {!abriendo && (
          <button onClick={() => setAbriendo(true)} className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700">
            <Plus className="w-3.5 h-3.5" /> Registrar ausencia
          </button>
        )}
      </div>
      {abriendo && (
        <FormularioAusencia
          gente={gente}
          perfil={perfil}
          semana={semana}
          onGuardar={(datos) => { onGuardar(datos); setAbriendo(false); }}
          onCancelar={() => setAbriendo(false)}
        />
      )}
      {delAsemana.length > 0 && (
        <div className="space-y-1.5">
          {delAsemana.map((a) => (
            <div key={a.id} className="flex items-center gap-2 flex-wrap bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5">
              <span className="text-sm font-semibold text-navy-700">{nombreDe(a.usuario_id)}</span>
              <span className="text-xs text-navy-500">
                {etiquetaDeMotivo(a.motivo)} · del {diaYMes(a.desde)} al {diaYMes(a.hasta)}
              </span>
              {a.nota && <span className="text-xs text-navy-400 italic min-w-0 truncate">{a.nota}</span>}
              {puedeBorrar(a) && onBorrar && (
                <button onClick={() => onBorrar(a.id)} title="Quitar esta ausencia" className="ml-auto text-navy-300 hover:text-red-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaEquipo({ directorio, resumenesDeLaSemana, onAbrirProyecto, cierre, semana, ausencias, perfil, onGuardarAusencia, onBorrarAusencia }) {
  const [roles, setRoles] = useState([]);

  const porUsuario = new Map(resumenesDeLaSemana.map((r) => [r.usuario_id, r]));
  const gente = (directorio || []).filter((p) => !esSoloDesarrollador(p)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const ausenciaDe = (id) => ausenciaDeLaSemana(ausencias, id, semana, cierre);

  /* Las fichas de filtro solo ofrecen los roles que alguien tiene de verdad:
     una ficha en cero no le sirve a nadie. */
  const opciones = ROLES
    .map((rol) => ({ valor: rol.label, conteo: gente.filter((p) => (p.roles || []).includes(rol.key)).length, key: rol.key }))
    .filter((o) => o.conteo > 0);
  const clavesElegidas = opciones.filter((o) => roles.includes(o.valor)).map((o) => o.key);
  const visibles = clavesElegidas.length === 0
    ? gente
    : gente.filter((p) => (p.roles || []).some((r) => clavesElegidas.includes(r)));

  /* Quien no estuvo en toda la semana no debe nada: sale de la cuenta en vez
     de engordar el "faltan tantos". Se dice aparte para que no parezca que el
     equipo encogió. */
  const ausentes = visibles.filter((p) => !porUsuario.get(p.id)?.enviado && ausenciaDe(p.id)).length;
  const esperados = visibles.length - ausentes;
  const enviados = visibles.filter((p) => porUsuario.get(p.id)?.enviado).length;
  const vencidos = visibles.filter(
    (p) => estadoDeEntrega(porUsuario.get(p.id), cierre, new Date(), ausenciaDe(p.id)) === 'vencido',
  ).length;

  return (
    <div>
      <FiltroFichas
        etiqueta="Rol:"
        etiquetaTodas="Todos"
        total={gente.length}
        opciones={opciones}
        seleccion={roles}
        onAlternar={(v) => setRoles((prev) => alternarEn(prev, v))}
        onLimpiar={() => setRoles([])}
      />
      <PanelAusencias
        ausencias={ausencias}
        gente={gente}
        perfil={perfil}
        semana={semana}
        onGuardar={onGuardarAusencia}
        onBorrar={onBorrarAusencia}
      />
      <p className="text-sm text-navy-500 mb-3">
        {enviados} de {esperados} ya enviaron su resumen de esta semana.
        {vencidos > 0 && (
          <span className="text-red-600 font-semibold"> {vencidos} no alcanzó a hacerlo.</span>
        )}
        {ausentes > 0 && (
          <span> {ausentes === 1 ? 'Otra persona no estuvo' : 'Otras ' + ausentes + ' personas no estuvieron'} esta semana.</span>
        )}
      </p>
      <div className="space-y-2">
        {visibles.map((persona) => (
          <FilaPersona
            key={persona.id}
            persona={persona}
            resumen={porUsuario.get(persona.id)}
            onAbrirProyecto={onAbrirProyecto}
            cierre={cierre}
            ausencia={ausenciaDe(persona.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------- los temas del lunes */

/* El orden del día de UNA de las tres reuniones, con su propio botón de
   copiar: lo que se pega en la convocatoria es la agenda de esa reunión, no la
   de las tres juntas. */
function Reunion({ reunion, etiquetaSemana }) {
  const [copiado, setCopiado] = useState(false);
  const total = contarTemas(reunion.grupos);

  async function copiar() {
    if (!(await copiarTexto(textoDeTemas(reunion.grupos, etiquetaSemana, reunion.label)))) {
      window.alert('El navegador no dejó copiar. Selecciona el texto a mano.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500">
          {reunion.label} <span className="text-navy-300">({total})</span>
        </p>
        {total > 0 && (
          <button
            onClick={copiar}
            className="flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'copiar'}
          </button>
        )}
      </div>
      {total === 0 ? (
        <p className="text-sm text-navy-300 italic">Ningún tema.</p>
      ) : (
        <div className="space-y-2">
          {reunion.grupos.map((g) => (
            <div key={g.usuario_id} className="bg-white border border-navy-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Avatar name={g.nombre} foto={g.foto} size="sm" />
                <p className="text-sm font-semibold text-navy-700 min-w-0 truncate">{g.nombre}</p>
              </div>
              <ul className="space-y-0.5 pl-1">
                {g.temas.map((t, i) => (
                  <li key={i} className="text-sm text-navy-700">- {normalizarTema(t).texto}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* El orden del día del lunes, repartido en las tres reuniones según el área de
   quien puso cada tema. Se arma solo con lo que la gente ya escribió el
   viernes, que es justamente el trabajo que hoy se rehace a mano leyendo los
   mensajes uno por uno. */
function VistaTemas({ resumenes, semana, directorio, cierre, onIrASemana }) {
  const grupos = temasDeLaSemana(resumenes, semana, directorio);
  const total = contarTemas(grupos);
  const reuniones = repartirEnReuniones(grupos);

  /* La reunión es el lunes y habla de la semana que acaba de cerrar, pero la
     pantalla abre en la semana en curso. En vez de adivinar, se ofrece el
     salto cuando esta semana no tiene temas y la anterior sí: un clic, sin
     que nada se mueva a espaldas de nadie. */
  const anterior = sumarDias(semana, -7);
  const temasAnteriores = contarTemas(temasDeLaSemana(resumenes, anterior, directorio));
  const sugerirAnterior = total === 0 && temasAnteriores > 0;

  return (
    <div>
      <p className="text-sm text-navy-500 mb-4">
        {total === 0
          ? 'Nadie puso temas para esta semana.'
          : `${total} ${total === 1 ? 'tema' : 'temas'} de ${grupos.length} ${grupos.length === 1 ? 'persona' : 'personas'}. Los de equipo van a la reunión del área de quien los puso; los de diseño, a la de todos.`}
      </p>

      {sugerirAnterior && (
        <div className="flex items-center gap-2 flex-wrap bg-nashville-50 border border-nashville-300 rounded-xl px-3 py-2.5 mb-4">
          <p className="text-xs text-navy-600 flex-1 min-w-[14rem]">
            La semana pasada sí tiene {temasAnteriores} {temasAnteriores === 1 ? 'tema' : 'temas'}. Si la reunión es
            hoy, probablemente son esos los que buscas.
          </p>
          <button
            onClick={() => onIrASemana(anterior)}
            className="text-xs font-semibold text-lime-600 hover:text-lime-700 underline shrink-0"
          >
            Ver los de la semana pasada
          </button>
        </div>
      )}

      {total === 0 && !sugerirAnterior ? (
        <p className="text-sm text-navy-300 italic">
          Los temas salen del bloque "Temas" de cada resumen enviado. Mientras nadie envíe el suyo, aquí no hay nada
          que mostrar.
        </p>
      ) : (
        reuniones.map((r) => (
          <Reunion key={r.id} reunion={r} etiquetaSemana={etiquetaDeSemana(semana, cierre)} />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ raíz */

export default function ResumenesView({ perfil, directorio, projects, dossiers, resumenes, onGuardar, onAbrirProyecto, cierres, onGuardarCierre, ausencias, onGuardarAusencia, onBorrarAusencia }) {
  const [semana, setSemana] = useState(() => lunesDe());
  const [pestana, setPestana] = useState('mio');

  const semanas = useMemo(() => ultimasSemanas(12), []);
  const cierre = cierreDeSemana(semana, cierres);
  const deLaSemana = (resumenes || []).filter((r) => r.semana === semana);
  const mio = deLaSemana.find((r) => r.usuario_id === perfil?.id) || null;
  const anterior = (resumenes || []).find((r) => r.usuario_id === perfil?.id && r.semana === sumarDias(semana, -7));

  /* El avance de ahora mismo, comparado contra la foto que quedó guardada la
     semana pasada. Se calcula aquí y no dentro de MiResumen para no rehacerlo
     con cada tecla que se escribe en los bloques de texto. */
  const fotosEnVivo = useMemo(
    () => fotoConComparacion(fotoDeLaSemana(projects, dossiers, perfil?.nombre), anterior?.proyectos),
    [projects, dossiers, perfil?.nombre, anterior],
  );

  const pestanas = [
    { key: 'mio', label: 'Mi resumen', icon: CalendarCheck },
    { key: 'equipo', label: 'El equipo', icon: Users },
    { key: 'temas', label: 'Temas de reuniones', icon: MessagesSquare },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2 mb-1">
        <CalendarCheck className="w-6 h-6 text-navy-400" /> Resúmenes semanales
      </h1>
      <p className="text-sm text-navy-500 mb-1">{etiquetaDeSemana(semana, mio?.hasta || cierre)}</p>
      <CierreDeLaSemana
        semana={semana}
        cierre={cierre}
        nota={notaDeCierre(semana, cierres)}
        puedeMover={isLeader(perfil) && !!onGuardarCierre}
        onGuardar={onGuardarCierre}
      />

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <select
          value={semana}
          onChange={(e) => setSemana(e.target.value)}
          className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
        >
          {semanas.map((s) => (
            <option key={s} value={s}>{etiquetaDeSemana(s)}{s === lunesDe() ? ' (esta semana)' : ''}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {pestanas.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => setPestana(p.key)}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  pestana === p.key ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
                }`}
              >
                <Icon className="w-4 h-4" /> {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {pestana === 'temas' ? (
        <VistaTemas
          resumenes={resumenes}
          semana={semana}
          directorio={directorio}
          cierre={cierre}
          onIrASemana={setSemana}
        />
      ) : pestana === 'mio' ? (
        <MiResumen
          /* Al cambiar de semana, o al enviar/reabrir, la pantalla empieza de
             cero. La clave NO incluye la hora de guardado a propósito: como
             ahora se guarda solo mientras se escribe, incluirla remontaría el
             componente a media frase y se perdería el foco. */
          key={`${semana}-${mio?.enviado ? 'enviado' : 'edicion'}`}
          semana={semana}
          cierre={cierre}
          guardado={mio}
          fotosEnVivo={fotosEnVivo}
          onGuardar={onGuardar}
          onAbrirProyecto={onAbrirProyecto}
        />
      ) : (
        <VistaEquipo
          directorio={directorio}
          resumenesDeLaSemana={deLaSemana}
          onAbrirProyecto={onAbrirProyecto}
          cierre={cierre}
          semana={semana}
          ausencias={ausencias}
          perfil={perfil}
          onGuardarAusencia={onGuardarAusencia}
          onBorrarAusencia={onBorrarAusencia}
        />
      )}
    </div>
  );
}
