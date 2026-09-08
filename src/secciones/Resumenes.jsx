/* ============================================================================
   RESÚMENES SEMANALES
   ----------------------------------------------------------------------------
   Cada viernes —o el último día que se trabaje— cada quien registra lo que
   hizo. Cuatro bloques que se escriben a mano (Lo mejor, Pendientes,
   Dificultades, Temas) y un bloque de avance que la aplicación arma sola con
   el estado de SUS documentos, comparado contra la foto de la semana pasada.

   El cálculo está aparte, en shared/resumenes.js. Aquí solo está la pantalla.

   Dos cosas que explican cómo se comporta:

   - Mientras el resumen es borrador, el avance se recalcula cada vez que se
     abre: es el estado de ahora. Al marcarlo como enviado, la foto QUEDA
     GUARDADA tal cual — si se recalculara después, el número de una semana
     vieja cambiaría cada vez que alguien toca un documento, y la comparación
     con la semana siguiente dejaría de significar nada.

   - Los resúmenes los lee todo el mundo. Se escribe solo el propio, y eso lo
     impone la RLS, no esta pantalla.
   ============================================================================ */

import React, { useMemo, useState } from 'react';
import {
  CalendarCheck, Check, ChevronDown, ChevronRight, Copy, Pencil, Plus, Send, Trash2, Users, X,
} from 'lucide-react';
import { DOC_ESTADOS, DOC_ESTADO_HEX, DOC_ESTADO_CORTO } from '../shared/dominio.jsx';
import { ROLES, roleLabel } from '../shared/permisos.js';
import { FiltroFichas, alternarEn, Avatar } from '../shared/ui.jsx';
import { copiarTexto } from '../shared/copiar.jsx';
import {
  BLOQUES_RESUMEN, cuentaDeFoto, etiquetaDeSemana, fotoConComparacion, fotoDeLaSemana,
  lunesDe, sumarDias, textoDelResumen, ultimasSemanas, viernesDe,
} from '../shared/resumenes.js';

/* --------------------------------------------------------------- el avance */

/* Barra de estados: una franja por estado, con los mismos colores de la torta
   del Dashboard. "No aplica" no entra, igual que allá. */
function BarraEstados({ porEstado, seguidos }) {
  if (!seguidos) {
    return <div className="h-2.5 rounded-full bg-navy-100 w-full" title="Sin documentos que seguir" />;
  }
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex w-full bg-navy-100">
      {DOC_ESTADOS.filter((e) => e !== 'No aplica' && porEstado[e] > 0).map((estado) => (
        <div
          key={estado}
          title={`${DOC_ESTADO_CORTO[estado] || estado}: ${porEstado[estado]}`}
          style={{ width: `${(porEstado[estado] / seguidos) * 100}%`, backgroundColor: DOC_ESTADO_HEX[estado] }}
        />
      ))}
    </div>
  );
}

function TarjetaAvance({ foto }) {
  const [abierto, setAbierto] = useState(false);
  const { seguidos, apc, pct } = cuentaDeFoto(foto);
  const movimiento = !foto.hayComparacion
    ? 'primera semana registrada'
    : foto.avanzaron === 0
      ? 'sin cambios esta semana'
      : `${foto.avanzaron} ${foto.avanzaron === 1 ? 'documento avanzó' : 'documentos avanzaron'}`;

  return (
    <div className="bg-white border border-navy-200 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-navy-700 min-w-[8rem] flex-1">{foto.nombre}</p>
        <span className="text-sm font-bold text-navy-800 tabular-nums">{pct}%</span>
        <span className="text-xs text-navy-400 whitespace-nowrap">{apc} de {seguidos} en APC</span>
      </div>
      <div className="mt-1.5 mb-1.5">
        <BarraEstados porEstado={foto.porEstado} seguidos={seguidos} />
      </div>
      {foto.cambios && foto.cambios.length > 0 ? (
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700"
        >
          {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {movimiento}
        </button>
      ) : (
        <p className="text-xs text-navy-400">{movimiento}</p>
      )}
      {abierto && (
        <ul className="mt-1.5 space-y-0.5 pl-4">
          {foto.cambios.map((c) => (
            <li key={c.codigo} className="text-xs text-navy-500">
              <span className="font-medium text-navy-700">{c.nombre}</span>: {c.de} → {c.a}
              {c.avance < 0 && <span className="text-amber-600"> (retrocedió)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BloqueAvance({ fotos }) {
  if (fotos.length === 0) {
    return (
      <p className="text-sm text-navy-300 italic">
        No tienes documentos a cargo esta semana. Los documentos salen del dossier de cada proyecto: si crees que
        alguno debería ser tuyo, un líder puede repartirlos en la sección Dossiers.
      </p>
    );
  }
  return <div className="space-y-2">{fotos.map((f) => <TarjetaAvance key={f.id} foto={f} />)}</div>;
}

/* ------------------------------------------------------------ los 4 bloques */

/* Lista de viñetas: se escribe una por renglón. Enter agrega la siguiente, que
   es lo que uno espera al ir listando lo de la semana. */
function ListaEditable({ lineas, onChange, ayuda, vacio }) {
  const valores = lineas && lineas.length > 0 ? lineas : [''];

  function cambiar(i, texto) {
    const copia = [...valores];
    copia[i] = texto;
    onChange(copia);
  }
  function agregar(despuesDe) {
    const copia = [...valores];
    copia.splice(despuesDe + 1, 0, '');
    onChange(copia);
  }
  function quitar(i) {
    const copia = valores.filter((_, j) => j !== i);
    onChange(copia.length === 0 ? [''] : copia);
  }

  return (
    <div>
      <div className="space-y-1.5">
        {valores.map((linea, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-navy-300 shrink-0">-</span>
            <input
              value={linea}
              onChange={(e) => cambiar(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(i); } }}
              placeholder={i === 0 ? ayuda : ''}
              className="flex-1 min-w-0 rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
            />
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
        onClick={() => agregar(valores.length - 1)}
        className="flex items-center gap-1 text-xs font-semibold text-lime-600 hover:text-lime-700 mt-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar renglón
      </button>
      <p className="text-xs text-navy-300 italic mt-1">Si lo dejas vacío se escribe "{vacio}".</p>
    </div>
  );
}

/* Un resumen ya escrito, en lectura: lo que ve el resto del equipo. */
function ResumenEnLectura({ resumen }) {
  const fotos = resumen?.proyectos || [];
  return (
    <div className="space-y-4">
      {fotos.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Avance de sus proyectos</p>
          <div className="space-y-2">{fotos.map((f) => <TarjetaAvance key={f.id} foto={f} />)}</div>
        </div>
      )}
      {BLOQUES_RESUMEN.map((bloque) => {
        const lineas = (resumen?.bloques?.[bloque.key] || []).map((l) => (l || '').trim()).filter(Boolean);
        return (
          <div key={bloque.key}>
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-1">{bloque.label}</p>
            {lineas.length === 0 ? (
              <p className="text-sm text-navy-300 italic">{bloque.vacio}</p>
            ) : (
              <ul className="space-y-0.5">
                {lineas.map((l, i) => <li key={i} className="text-sm text-navy-700">- {l}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- mi resumen */

function MiResumen({ semana, guardado, fotosEnVivo, onGuardar }) {
  /* El borrador vive aquí mientras se escribe; solo baja a la base al
     guardar. Se reinicia cuando cambia la semana o llega otra versión desde
     la base (la `key` del componente, ver más abajo). */
  const [bloques, setBloques] = useState(() => guardado?.bloques || {});
  const [hasta, setHasta] = useState(() => guardado?.hasta || viernesDe(semana));
  const [incluirAvance, setIncluirAvance] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const enviado = !!guardado?.enviado;
  /* Enviado: la foto queda congelada. Borrador: se recalcula al abrir, porque
     es el estado de ahora. */
  const fotos = enviado ? (guardado.proyectos || []) : fotosEnVivo;

  async function copiar() {
    const texto = textoDelResumen({ bloques, proyectos: fotos, incluirAvance });
    if (!(await copiarTexto(texto))) {
      window.alert('El navegador no dejó copiar. Selecciona el texto a mano.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  async function guardar(marcarEnviado) {
    setGuardando(true);
    await onGuardar({ semana, hasta, bloques, proyectos: fotos, enviado: marcarEnviado });
    setGuardando(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-navy-500">Cubre hasta:</label>
        <input
          type="date"
          value={hasta}
          disabled={enviado}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm disabled:bg-navy-50 disabled:text-navy-400"
        />
        <p className="text-xs text-navy-400">
          Normalmente el viernes. Si sales antes —vacaciones, un viaje— ciérralo el día que de verdad trabajaste; eso
          no le cambia la semana a nadie más.
        </p>
      </div>

      {enviado && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 flex-1">
            Enviado. El avance quedó congelado tal como estaba al enviarlo, para que la comparación de la semana
            entrante tenga contra qué medirse.
          </p>
          <button
            onClick={() => guardar(false)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline shrink-0"
          >
            Volver a editar
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Avance de mis proyectos</p>
        <BloqueAvance fotos={fotos} />
      </div>

      {BLOQUES_RESUMEN.map((bloque) => (
        <div key={bloque.key}>
          <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{bloque.label}</p>
          {enviado ? (
            (bloques[bloque.key] || []).filter((l) => (l || '').trim()).length === 0 ? (
              <p className="text-sm text-navy-300 italic">{bloque.vacio}</p>
            ) : (
              <ul className="space-y-0.5">
                {(bloques[bloque.key] || []).filter((l) => (l || '').trim()).map((l, i) => (
                  <li key={i} className="text-sm text-navy-700">- {l}</li>
                ))}
              </ul>
            )
          ) : (
            <ListaEditable
              lineas={bloques[bloque.key]}
              ayuda={bloque.ayuda}
              vacio={bloque.vacio}
              onChange={(lineas) => setBloques((prev) => ({ ...prev, [bloque.key]: lineas }))}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 flex-wrap border-t border-navy-200 pt-4">
        {!enviado && (
          <>
            <button
              onClick={() => guardar(false)}
              disabled={guardando}
              className="text-sm font-semibold text-navy-600 hover:text-navy-800 border border-navy-300 rounded-lg px-3 py-2 disabled:opacity-40"
            >
              Guardar borrador
            </button>
            <button
              onClick={() => guardar(true)}
              disabled={guardando}
              className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-40"
            >
              <Send className="w-4 h-4" /> Marcar como enviado
            </button>
          </>
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
      </div>
      <p className="text-xs text-navy-300 italic">
        Las menciones tipo @Fulano no se pueden generar desde aquí: salen como texto y toca volver a mencionarlas al
        pegar.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- el equipo */

function FilaPersona({ persona, resumen }) {
  const [abierto, setAbierto] = useState(false);
  const estado = !resumen ? 'pendiente' : resumen.enviado ? 'enviado' : 'borrador';
  const chip = {
    enviado: { texto: 'Enviado', clase: 'bg-emerald-100 text-emerald-800' },
    borrador: { texto: 'Borrador', clase: 'bg-amber-100 text-amber-800' },
    pendiente: { texto: 'Sin registrar', clase: 'bg-navy-100 text-navy-500' },
  }[estado];

  return (
    <div className="bg-white border border-navy-200 rounded-xl">
      <button
        onClick={() => resumen && setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {resumen
          ? (abierto ? <ChevronDown className="w-4 h-4 text-navy-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-navy-400 shrink-0" />)
          : <span className="w-4 shrink-0" />}
        <Avatar name={persona.nombre} foto={persona.foto} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-700 truncate">{persona.nombre}</p>
          <p className="text-xs text-navy-400 truncate">{(persona.roles || []).map(roleLabel).join(' · ') || 'Sin rol asignado'}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${chip.clase}`}>{chip.texto}</span>
      </button>
      {abierto && resumen && (
        <div className="border-t border-navy-100 px-3 py-3">
          <ResumenEnLectura resumen={resumen} />
        </div>
      )}
    </div>
  );
}

function VistaEquipo({ directorio, resumenesDeLaSemana }) {
  const [roles, setRoles] = useState([]);

  const porUsuario = new Map(resumenesDeLaSemana.map((r) => [r.usuario_id, r]));
  const gente = [...(directorio || [])].sort((a, b) => a.nombre.localeCompare(b.nombre));

  /* Las fichas de filtro solo ofrecen los roles que alguien tiene de verdad:
     una ficha en cero no le sirve a nadie. */
  const opciones = ROLES
    .map((rol) => ({ valor: rol.label, conteo: gente.filter((p) => (p.roles || []).includes(rol.key)).length, key: rol.key }))
    .filter((o) => o.conteo > 0);
  const clavesElegidas = opciones.filter((o) => roles.includes(o.valor)).map((o) => o.key);
  const visibles = clavesElegidas.length === 0
    ? gente
    : gente.filter((p) => (p.roles || []).some((r) => clavesElegidas.includes(r)));

  const enviados = visibles.filter((p) => porUsuario.get(p.id)?.enviado).length;

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
      <p className="text-sm text-navy-500 mb-3">
        {enviados} de {visibles.length} ya enviaron su resumen de esta semana.
      </p>
      <div className="space-y-2">
        {visibles.map((persona) => (
          <FilaPersona key={persona.id} persona={persona} resumen={porUsuario.get(persona.id)} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ raíz */

export default function ResumenesView({ perfil, directorio, projects, dossiers, resumenes, onGuardar }) {
  const [semana, setSemana] = useState(() => lunesDe());
  const [pestana, setPestana] = useState('mio');

  const semanas = useMemo(() => ultimasSemanas(12), []);
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
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2 mb-1">
        <CalendarCheck className="w-6 h-6 text-navy-400" /> Resúmenes semanales
      </h1>
      <p className="text-sm text-navy-500 mb-4">{etiquetaDeSemana(semana, mio?.hasta)}</p>

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

      {pestana === 'mio' ? (
        <MiResumen
          /* Al cambiar de semana —o cuando la base devuelve otra versión— el
             borrador de la pantalla tiene que empezar de cero, no arrastrar lo
             que se estaba escribiendo en la semana anterior. */
          key={`${semana}-${mio?.updated_at || 'nuevo'}-${mio?.enviado ? 'enviado' : 'borrador'}`}
          semana={semana}
          guardado={mio}
          fotosEnVivo={fotosEnVivo}
          onGuardar={onGuardar}
        />
      ) : (
        <VistaEquipo directorio={directorio} resumenesDeLaSemana={deLaSemana} />
      )}
    </div>
  );
}
