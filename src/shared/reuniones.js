/* ============================================================================
   REUNIONES DEL LUNES — quién va, quién modera y qué queda pendiente
   ----------------------------------------------------------------------------
   Cada lunes hay tres reuniones —civil, eléctrica y delineantes— y en cada
   una pasan tres cosas, en este orden: se revisan los pendientes de las
   anteriores, se tratan los temas que la gente marcó en su resumen del
   viernes, y salen pendientes nuevos.

   La distinción que sostiene todo esto:

   - Un TEMA (del resumen) es lo que LLEGA a la reunión. Vive con su semana.
   - Un PENDIENTE es lo que SALE de ella: un compromiso con responsables, que
     se arrastra lunes tras lunes hasta que se finaliza. Pertenece a la
     reunión, no a una sesión, y por eso no hay que "pasarlo" a la siguiente.

   El registro de cada sesión no se escribe: se arma solo con lo que pasó en
   ella —los temas con su conclusión, los pendientes que se revisaron ese día y
   los que se crearon—. Un acta en blanco se llena tres semanas y después nadie
   la vuelve a escribir.

   Aquí vive solo el cálculo, sin interfaz, para poder probarlo sin montar
   ninguna pantalla.
   ============================================================================ */

import { REUNIONES, isoDeFecha, repartirEnReuniones, sumarDias, temasDeLaSemana } from './resumenes.js';
import { equipoNombres, esInvitado, isDesignLeader, isDeveloper } from './permisos.js';

/* Los estados de un pendiente, en el orden en que avanza. */
export const ESTADOS_PENDIENTE = [
  { id: 'pendiente', label: 'Pendiente', clase: 'bg-navy-100 text-navy-600' },
  { id: 'en_curso', label: 'En curso', clase: 'bg-amber-100 text-amber-800' },
  { id: 'finalizado', label: 'Finalizado', clase: 'bg-emerald-100 text-emerald-800' },
];
export const ESTADO_INICIAL = 'pendiente';

export function etiquetaDeEstado(id) {
  return (ESTADOS_PENDIENTE.find((e) => e.id === id) || ESTADOS_PENDIENTE[0]).label;
}

/* El líder de cada área es quien gestiona su reunión: edita la rotación,
   corre la fecha si el lunes es festivo y elige al moderador. */
export const LIDER_DE_REUNION = {
  civil: 'lider_civil',
  electrica: 'lider_electrico',
  delineantes: 'lider_delineantes',
};

export function reunionPorId(id) {
  return REUNIONES.find((r) => r.id === id) || null;
}

/* "lunes 5 de octubre": la reunión es un día concreto, y así se nombra. */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLegible(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`;
}

/* El nombre de alguien a partir de su id. Si ya no está en el equipo, el
   pendiente o el tema siguen ahí: se dice, en vez de dejar un hueco. */
export function nombreDe(directorio, id) {
  return ((directorio || []).find((p) => p.id === id) || {}).nombre || 'Alguien que ya no está en el equipo';
}

/* ------------------------------------------------------------ quién va */

/* Las reuniones a las que va una persona, según sus roles. Es la misma regla
   que reparte los temas del resumen (REUNIONES sale de las categorías de la
   pestaña Equipo), para que no haya dos listas diciendo quién es "civil". */
export function reunionesDePersona(perfil) {
  if (!perfil || esInvitado(perfil)) return [];
  const roles = perfil.roles || [];
  return REUNIONES.filter((r) => roles.some((rol) => r.roles.includes(rol)));
}

/* La reunión con la que abre la pantalla: la de uno. Quien no va a ninguna
   (el Líder de Diseño, Control de Calidad…) abre en la civil, que es la
   primera; las demás quedan a un clic. */
export function reunionInicial(perfil) {
  const mias = reunionesDePersona(perfil);
  return (mias[0] || REUNIONES[0]).id;
}

/* Quiénes van a una reunión, por nombre. Los invitados no van a ninguna. */
export function participantes(reunionId, directorio) {
  const reunion = reunionPorId(reunionId);
  if (!reunion) return [];
  return (directorio || [])
    .filter((p) => !esInvitado(p) && (p.roles || []).some((rol) => reunion.roles.includes(rol)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* Quien gestiona la reunión: su líder de área, el Líder de Diseño y el
   Desarrollador, que en el resto de la plataforma pueden todo. */
export function gestionaReunion(perfil, reunionId) {
  if (!perfil || esInvitado(perfil)) return false;
  if (isDeveloper(perfil) || isDesignLeader(perfil)) return true;
  return (perfil.roles || []).includes(LIDER_DE_REUNION[reunionId]);
}

/* ------------------------------------------------------------- sesiones */

/* Una sesión por reunión y por semana. El id es determinista para que dos
   personas que la abren a la vez no creen dos filas. */
export function idDeSesion(reunionId, semana) {
  return `sesion-${reunionId}-${semana}`;
}

export function sesionDe(sesiones, reunionId, semana) {
  return (sesiones || []).find((s) => s.serie === reunionId && s.semana === semana) || null;
}

/* La fecha de la sesión: el lunes, salvo que el líder la haya corrido porque
   era festivo. */
export function fechaDeSesion(sesion, semana) {
  return (sesion && sesion.fecha) || semana;
}

/* Correr la fecha solo tiene sentido dentro de la misma semana: una sesión
   fechada en otra semana dejaría de encontrarse donde uno la busca. */
export function fechaDeSesionValida(semana, fecha) {
  return !!fecha && fecha >= semana && fecha <= sumarDias(semana, 6);
}

/* ------------------------------------------------------------- rotación */

export function ordenDeRotacion(rotaciones, reunionId) {
  const fila = (rotaciones || []).find((r) => r.serie === reunionId);
  return Array.isArray(fila?.orden) ? fila.orden : [];
}

/* ¿Tiene esta persona una ausencia registrada que cubra ese día? */
export function ausenteEl(ausencias, usuarioId, fechaIso) {
  return (ausencias || []).some((a) => a.usuario_id === usuarioId && a.desde <= fechaIso && a.hasta >= fechaIso);
}

/* A quién le toca moderar. Sigue la lista desde quien moderó la última
   sesión anterior, y se salta a quien tenga ausencia registrada ese día: si
   está de vacaciones, no va a moderar, y ya sabemos que no está.

   Lo que se guarda es quién moderó de verdad (la sesión lleva su moderador),
   así que la rotación continúa desde ahí aunque una semana el líder haya
   elegido a otra persona. Si quien moderó la última vez ya no está en la
   lista, se arranca desde el principio. */
export function moderadorSugerido({ reunionId, semana, fecha, sesiones, rotaciones, ausencias }) {
  const orden = ordenDeRotacion(rotaciones, reunionId);
  if (orden.length === 0) return { usuarioId: null, saltados: [] };

  const anteriores = (sesiones || [])
    .filter((s) => s.serie === reunionId && s.semana < semana && s.moderador_id)
    .sort((a, b) => b.semana.localeCompare(a.semana));
  const ultima = anteriores.find((s) => orden.includes(s.moderador_id));
  const inicio = ultima ? (orden.indexOf(ultima.moderador_id) + 1) % orden.length : 0;

  const dia = fecha || semana;
  const saltados = [];
  for (let i = 0; i < orden.length; i += 1) {
    const candidato = orden[(inicio + i) % orden.length];
    if (!ausenteEl(ausencias, candidato, dia)) return { usuarioId: candidato, saltados };
    saltados.push(candidato);
  }
  /* Todos ausentes: mejor decirlo que inventar un moderador. */
  return { usuarioId: null, saltados };
}

/* A quién le toca la semana siguiente, para que lo sepa con tiempo y prepare
   la reunión. Se calcula como si la sesión de esta semana ya estuviera
   guardada con quien la modera: si todavía no se ha creado (nadie ha hecho
   nada en ella), la rotación no la vería y repetiría el mismo nombre.

   Es un pronóstico: si el líder elige a otra persona esta semana, o alguien
   registra una ausencia, cambia. Se mira la ausencia en el lunes siguiente;
   si ese lunes resulta festivo y la reunión se corre, se recalcula sola. */
export function proximoModerador({ reunionId, semana, sesiones, rotaciones, ausencias, moderadorActualId }) {
  const siguiente = sumarDias(semana, 7);
  const conLaDeEsta = moderadorActualId
    ? [
      ...(sesiones || []).filter((s) => !(s.serie === reunionId && s.semana === semana)),
      { serie: reunionId, semana, moderador_id: moderadorActualId },
    ]
    : sesiones;
  return moderadorSugerido({
    reunionId, semana: siguiente, fecha: siguiente, sesiones: conLaDeEsta, rotaciones, ausencias,
  }).usuarioId;
}

/* ----------------------------------------------------------- pendientes */

/* Los pendientes de una reunión, separados en abiertos y finalizados. Los
   abiertos van del más viejo al más nuevo: el que lleva más tiempo esperando
   es el primero que hay que mirar el lunes. */
export function pendientesDeReunion(pendientes, reunionId) {
  const deEsta = (pendientes || []).filter((p) => p.serie === reunionId);
  const abiertos = deEsta
    .filter((p) => p.estado !== 'finalizado')
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const finalizados = deEsta
    .filter((p) => p.estado === 'finalizado')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  return { abiertos, finalizados };
}

/* El historial de un pendiente, del cambio más reciente al más viejo. */
export function historialDe(historial, pendienteId) {
  return (historial || [])
    .filter((h) => h.pendiente_id === pendienteId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

/* La última justificación escrita, que es lo que se muestra a la vista: el
   "por qué está así" de hoy. La entrada de creación no cuenta, no justifica
   nada. */
export function ultimaJustificacion(historial, pendienteId) {
  return historialDe(historial, pendienteId).find((h) => h.accion !== 'creado' && (h.justificacion || '').trim()) || null;
}

/* Cuántas semanas lleva abierto. Es lo primero que se pregunta en la reunión
   de un pendiente viejo. */
export function semanasAbierto(pendiente, hoy = new Date()) {
  if (!pendiente?.created_at) return 0;
  const dias = Math.floor((hoy - new Date(pendiente.created_at)) / 86400000);
  return Math.max(0, Math.floor(dias / 7));
}

/* Quién puede mover el estado de un pendiente: sus responsables —así cada
   quien actualiza lo suyo durante la semana—, el moderador y quien gestiona
   la reunión. */
export function puedeActualizarPendiente(perfil, pendiente, { gestiona, esModerador }) {
  if (!perfil || esInvitado(perfil)) return false;
  if (gestiona || esModerador) return true;
  return (pendiente?.responsables || []).includes(perfil.id);
}

/* Una actualización necesita su porqué. El estado sin justificación es
   justamente lo que se quería dejar de tener. */
export function actualizacionValida(justificacion) {
  return !!(justificacion || '').trim();
}

/* -------------------------------------------------------- los temas */

/* El lunes se tratan los temas que la gente marcó en su resumen del viernes
   anterior, así que la sesión de la semana W mira los resúmenes de W-1. */
export function semanaDeLosTemas(semanaSesion) {
  return sumarDias(semanaSesion, -7);
}

/* La llave de un tema dentro de su sesión. Lleva el texto y no la posición:
   si alguien reabre su resumen y reordena los temas, la conclusión no puede
   quedar pegada al tema equivocado. */
export function claveDeTema(usuarioId, texto) {
  return `${usuarioId}:${texto}`;
}

/* Los temas que le llegan a la sesión de una reunión: los marcados para "Mi
   equipo" en los resúmenes ENVIADOS de la semana anterior, de quienes van a
   esa reunión. Los marcados para la reunión de diseño no entran: esa reunión
   no se lleva aquí. Usa el mismo reparto de la pestaña de temas de los
   resúmenes, así que lo que se ve allá es lo que llega acá. */
export function temasParaLaSesion(resumenes, reunionId, semanaSesion, directorio) {
  const grupos = temasDeLaSemana(resumenes, semanaDeLosTemas(semanaSesion), directorio);
  const reunion = repartirEnReuniones(grupos).find((r) => r.id === reunionId);
  const vistos = new Set();
  const temas = [];
  (reunion?.grupos || []).forEach((g) => {
    g.temas.forEach((t) => {
      const clave = claveDeTema(g.usuario_id, t.texto);
      if (vistos.has(clave)) return;
      vistos.add(clave);
      temas.push({ clave, autorId: g.usuario_id, autorNombre: g.nombre, texto: t.texto });
    });
  });
  return temas;
}

/* Cada tema con lo que se decidió de él en esa sesión, si ya se trató. Los
   que faltan van primero: son lo que queda por hablar. */
export function bandejaDeLaSesion(temas, temasTratados, sesionId) {
  const tratados = new Map((temasTratados || [])
    .filter((t) => t.sesion_id === sesionId)
    .map((t) => [t.clave, t]));
  const conResolucion = (temas || []).map((t) => ({ ...t, resolucion: tratados.get(t.clave) || null }));
  return [
    ...conResolucion.filter((t) => !t.resolucion),
    ...conResolucion.filter((t) => t.resolucion),
  ];
}

/* Cerrar un tema sin compromiso pide decir en qué quedó: si no, el registro
   dice que se habló pero no qué se concluyó. */
export function resolucionValida(resultado, conclusion) {
  if (resultado === 'sin_compromiso') return !!(conclusion || '').trim();
  return resultado === 'pendiente';
}

/* ------------------------------------------------- el plan de la semana */

/* Al final de la reunión civil, el líder reparte el trabajo de la semana:
   a cada quien, una lista ordenada de tareas —el orden ES la prioridad—, casi
   siempre ligadas a un proyecto. Solo la reunión civil lo hace; si mañana
   otra lo necesita, es agregarla aquí. */
export const REUNIONES_CON_PLAN = ['civil'];

export function tienePlan(reunionId) {
  return REUNIONES_CON_PLAN.includes(reunionId);
}

/* Un plan por reunión, semana y persona. Determinista: guardar dos veces el
   de alguien actualiza la fila en vez de crear otra. */
export function idDePlan(reunionId, semana, usuarioId) {
  return `plan-${reunionId}-${semana}-${usuarioId}`;
}

export function planDe(planes, reunionId, semana, usuarioId) {
  return (planes || []).find((p) => p.serie === reunionId && p.semana === semana && p.usuario_id === usuarioId) || null;
}

/* El último plan que tuvo alguien antes de esta semana, para partir de él:
   casi siempre el trabajo continúa. No necesariamente el de la semana
   inmediatamente anterior —si esa semana no hubo plan (vacaciones, un
   festivo), se toma el último que sí hubo—. */
export function planAnterior(planes, reunionId, semana, usuarioId) {
  return (planes || [])
    .filter((p) => p.serie === reunionId && p.usuario_id === usuarioId && p.semana < semana && (p.items || []).length > 0)
    .sort((a, b) => b.semana.localeCompare(a.semana))[0] || null;
}

/* Los renglones listos para guardarse: sin espacios sobrantes y sin los que
   quedaron sin tarea. Un renglón con proyecto pero sin tarea no dice qué hay
   que hacer. */
export function limpiarItems(items) {
  return (items || [])
    .map((i) => ({ ...i, tarea: (i.tarea || '').trim(), proyecto_id: i.proyecto_id || null }))
    .filter((i) => i.tarea);
}

/* ¿Le asignaron un proyecto donde no está en el equipo? No se impide —el
   líder puede tener sus razones, y el equipo se cambia en el proyecto—, pero
   se avisa: o falta agregarla allá, o se equivocó de proyecto. */
export function fueraDelEquipo(item, nombre, proyectos) {
  if (!item?.proyecto_id || !nombre) return false;
  const proyecto = (proyectos || []).find((p) => p.id === item.proyecto_id);
  if (!proyecto) return false;
  return !equipoNombres(proyecto.equipo).includes(nombre);
}

export function nombreDeProyecto(proyectos, id) {
  if (!id) return null;
  return ((proyectos || []).find((p) => p.id === id) || {}).nombre || 'Proyecto que ya no existe';
}

/* ---------------------------------------------------------- el registro */

/* Lo que pasó en una sesión, armado con lo que ya quedó guardado:

   - los temas tratados, con su conclusión;
   - los pendientes que se REVISARON ese día: los cambios del historial
     hechos en la fecha de la sesión. Los de mitad de semana —un responsable
     que actualiza lo suyo un miércoles— quedan en el historial del
     pendiente, pero no son de la reunión;
   - los pendientes que nacieron en ella. */
export function registroDeLaSesion({ sesionId, fecha, temasTratados, pendientes, historial, reunionId, semana, planes }) {
  const porId = new Map((pendientes || []).map((p) => [p.id, p]));
  const temas = (temasTratados || [])
    .filter((t) => t.sesion_id === sesionId)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map((t) => ({ ...t, pendiente: t.pendiente_id ? porId.get(t.pendiente_id) || null : null }));

  const revisados = (historial || [])
    .filter((h) => h.accion !== 'creado' && h.created_at && isoDeFecha(new Date(h.created_at)) === fecha)
    .filter((h) => porId.get(h.pendiente_id)?.serie === reunionId)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map((h) => ({ ...h, pendiente: porId.get(h.pendiente_id) }));

  const nuevos = (pendientes || [])
    .filter((p) => p.sesion_origen === sesionId)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  /* El plan que el líder repartió esa semana, solo de quien tiene algo. */
  const plan = (planes || [])
    .filter((p) => p.serie === reunionId && p.semana === semana && (p.items || []).length > 0);

  return { temas, revisados, nuevos, plan };
}

export function registroVacio(registro) {
  return !registro || (registro.temas.length === 0 && registro.revisados.length === 0
    && registro.nuevos.length === 0 && (registro.plan || []).length === 0);
}

/* El registro como texto, para pegarlo en el chat. Mismo formato de viñetas
   que el resto de la plataforma; las secciones vacías no salen. */
export function textoDelRegistro(registro, { titulo, moderador, directorio, proyectos }) {
  const nombre = (id) => ((directorio || []).find((p) => p.id === id) || {}).nombre || 'Alguien';
  const partes = [titulo];
  if (moderador) partes.push(`Moderó: ${moderador}`);

  if (registroVacio(registro)) {
    partes.push('', 'No se registró nada en esta sesión.');
    return partes.join('\n');
  }

  if (registro.temas.length > 0) {
    partes.push('', 'Temas tratados');
    registro.temas.forEach((t) => {
      const desenlace = t.resultado === 'pendiente'
        ? `quedó como pendiente${t.pendiente ? `: ${t.pendiente.texto}` : ''}`
        : (t.conclusion || '').trim();
      partes.push(`-${t.texto} (${nombre(t.autor_id)}) → ${desenlace}`);
    });
  }

  if (registro.revisados.length > 0) {
    partes.push('', 'Pendientes revisados');
    registro.revisados.forEach((h) => {
      partes.push(`-${h.pendiente?.texto || 'Pendiente'}: ${etiquetaDeEstado(h.estado)} · ${(h.justificacion || '').trim()}`);
    });
  }

  if (registro.nuevos.length > 0) {
    partes.push('', 'Pendientes nuevos');
    registro.nuevos.forEach((p) => {
      const quienes = (p.responsables || []).map(nombre).join(', ');
      partes.push(`-${p.texto}${quienes ? ` · ${quienes}` : ''}`);
    });
  }

  if ((registro.plan || []).length > 0) {
    partes.push('', 'Plan de la semana');
    [...registro.plan]
      .sort((a, b) => nombre(a.usuario_id).localeCompare(nombre(b.usuario_id), 'es'))
      .forEach((p) => {
        partes.push(nombre(p.usuario_id));
        p.items.forEach((item, i) => {
          const proyecto = nombreDeProyecto(proyectos, item.proyecto_id);
          partes.push(`-${i + 1}. ${proyecto ? `${proyecto} · ` : ''}${item.tarea}`);
        });
      });
  }

  return partes.join('\n');
}
