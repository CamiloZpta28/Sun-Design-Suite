/* ============================================================================
   RESÚMENES SEMANALES — a quién le toca qué, y cómo se mide el avance
   ----------------------------------------------------------------------------
   Cada viernes —o el último día que se trabaje— cada quien registra lo que
   hizo. Cuatro bloques de texto que escribe a mano (reuniones, asesorías,
   capacitaciones…) y un bloque de avance que la aplicación arma sola con el
   estado de SUS documentos.

   Aquí vive solo el cálculo, sin nada de interfaz, porque es la parte que hay
   que poder probar sin montar una pantalla: quién responde por cada documento,
   cuánto se movió respecto a la semana pasada y cómo queda el texto que se
   pega en el chat.

   Dos decisiones que conviene tener presentes:

   1. NO hay una lista de "roles que reportan documentos". Sale del dossier: a
      alguien le toca un documento si ese documento nombra su rol en
      `responsables`. Por eso Trámites y BT hoy no tiene bloque de avance —no
      porque esté excluido en el código, sino porque ningún documento lo
      nombra— y si mañana los líderes le asignan alguno, aparece solo.

   2. El porcentaje es el MISMO que usa el resto de la aplicación (documentos
      en APC sobre los que se siguen), no una escala inventada para esta
      pantalla. Un resumen que dijera 68% mientras la torta del Dashboard dice
      40% sería peor que no tener número. Lo que sí mide la semana es cuántos
      documentos AVANZARON, que es la pregunta de verdad.
   ============================================================================ */

import { DOC_ESTADOS, documentosDeProyecto } from './dominio.jsx';
import { EQUIPO_CATEGORIAS } from './permisos.js';
import { rolesEnProyecto } from './responsables.js';

/* Los cuatro bloques que se escriben a mano, en el orden en que se pegan.
   El "vacío" es lo que se escribe cuando no hay nada — el formato que el
   equipo ya usa dice "Ninguna" para dificultades y "Ninguno" para temas. */
export const BLOQUES_RESUMEN = [
  { key: 'lo_mejor', label: 'Lo mejor', vacio: 'Ninguno', ayuda: 'Lo que sacaste esta semana: reuniones, asesorías, capacitaciones, entregas…' },
  { key: 'pendientes', label: 'Pendientes', vacio: 'Ninguno', ayuda: 'Lo que queda para la semana entrante' },
  { key: 'dificultades', label: 'Dificultades', vacio: 'Ninguna', ayuda: 'Lo que te frenó o te costó' },
  { key: 'temas', label: 'Temas', vacio: 'Ninguno', ayuda: 'Lo que quieres hablar el lunes', conDestino: true },
];

/* Un documento en "No aplica" no se sigue: ni cuenta para el total ni puede
   avanzar. Es el mismo criterio de la torta de avance. */
const NO_APLICA = 'No aplica';
const APC = 'Aprobado para construcción (APC)';

/* Qué tan adelantado está un estado. Es la posición en DOC_ESTADOS, que ya
   está en orden de avance — así, agregar un estado nuevo en su sitio no
   obliga a tocar nada de aquí. */
export function nivelDeEstado(estado) {
  const i = DOC_ESTADOS.indexOf(estado);
  return i === -1 ? 0 : i;
}

/* Los documentos de un proyecto que le tocan a una persona, cada uno con los
   papeles que cumple en él: E (lo elabora o lo dibuja) y/o R (lo revisa). El
   mismo plano puede aparecerle a dos personas con papeles distintos, y a una
   sola persona con los dos papeles si ocupa los dos roles. */
export function misDocumentosDelProyecto(project, dossiers, nombre) {
  const roles = rolesEnProyecto(nombre, project?.equipo);
  if (roles.length === 0) return [];
  return documentosDeProyecto(project, dossiers)
    .map((doc) => {
      const papeles = roles.map((rol) => (doc.responsables || {})[rol]).filter(Boolean);
      return papeles.length === 0 ? null : { doc, papeles: [...new Set(papeles)] };
    })
    .filter(Boolean);
}

/* La foto de una persona en un proyecto: cuántos documentos suyos hay en cada
   estado, y el estado de cada uno.

   El mapa `estados` es lo que permite comparar con la semana pasada, y por eso
   se guarda DENTRO del resumen en vez de recalcularse: si se recalculara, el
   número de la semana pasada cambiaría cada vez que alguien toca un documento
   viejo, y la comparación no significaría nada. */
export function fotoDeProyecto(project, dossiers, nombre) {
  const mios = misDocumentosDelProyecto(project, dossiers, nombre);
  if (mios.length === 0) return null;
  const guardados = project.documentos || {};
  const porEstado = {};
  DOC_ESTADOS.forEach((e) => { porEstado[e] = 0; });
  const estados = {};
  mios.forEach(({ doc }) => {
    const estado = guardados[doc.codigo]?.estado || 'Pendiente';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    estados[doc.codigo] = estado;
  });
  return {
    id: project.id,
    nombre: project.nombre,
    /* Para poder dejar de repetir un proyecto ya terminado semana tras
       semana (ver sinCerradosRepetidos). */
    estado: project.estado || 'activo',
    total: mios.length,
    porEstado,
    estados,
    /* El nombre de cada documento y el papel con que me toca van en la foto
       para que un resumen viejo se siga leyendo entero aunque su dossier haya
       cambiado de versión. */
    nombres: Object.fromEntries(mios.map(({ doc }) => [doc.codigo, doc.nombre])),
    papeles: Object.fromEntries(mios.map(({ doc, papeles }) => [doc.codigo, papeles])),
  };
}

/* Todas las fotos de una persona, una por proyecto donde tenga documentos. */
export function fotoDeLaSemana(projects, dossiers, nombre) {
  return (projects || [])
    .map((p) => fotoDeProyecto(p, dossiers, nombre))
    .filter(Boolean);
}

/* Los estados en los que un proyecto deja de moverse. Un proyecto así no
   tiene por qué salir cada semana con el mismo porcentaje: la semana en que
   se cierra —o se pausa, o se desactiva— sí es noticia, las siguientes son
   ruido. */
export const ESTADOS_CERRADOS = ['finalizado', 'pausa', 'inactivo'];

export const estaCerrado = (estado) => ESTADOS_CERRADOS.includes(estado);

/* Se queda solo el proyecto cerrado que la semana pasada estaba en OTRO
   estado: ahí es donde está la noticia. Pasar de pausa a inactivo también
   cuenta —es un cambio— y volver a activarlo lo devuelve a la lista, porque
   'activo' nunca se filtra.

   Cuando no hay foto anterior —el primer resumen de alguien— se deja pasar:
   más vale que aparezca una vez de más a que un proyecto que se acaba de
   cerrar no se registre nunca. */
export function sinCerradosRepetidos(fotos, anteriores) {
  const previas = new Map((anteriores || []).map((f) => [f.id, f]));
  return (fotos || []).filter((foto) => {
    if (!estaCerrado(foto.estado)) return true;
    const previa = previas.get(foto.id);
    return !previa || previa.estado !== foto.estado;
  });
}

/* Documentos que se movieron entre dos fotos del mismo proyecto. Solo cuenta
   lo que AVANZÓ o RETROCEDIÓ de verdad: un documento que apareció esta semana
   (porque a la persona la asignaron al proyecto) no es un avance suyo. */
export function cambiosEntreFotos(anterior, actual) {
  const antes = anterior?.estados || {};
  const cambios = [];
  Object.entries(actual?.estados || {}).forEach(([codigo, estado]) => {
    const previo = antes[codigo];
    if (previo === undefined || previo === estado) return;
    if (previo === NO_APLICA || estado === NO_APLICA) return;
    cambios.push({
      codigo,
      nombre: actual.nombres?.[codigo] || codigo,
      de: previo,
      a: estado,
      avance: nivelDeEstado(estado) - nivelDeEstado(previo),
    });
  });
  return cambios;
}

/* Cuántos documentos se siguen (los de "No aplica" no cuentan) y cuántos ya
   están en APC. Misma cuenta que la torta del resto de la aplicación. */
export function cuentaDeFoto(foto) {
  const total = foto?.total || 0;
  const noAplica = foto?.porEstado?.[NO_APLICA] || 0;
  const seguidos = total - noAplica;
  const apc = foto?.porEstado?.[APC] || 0;
  return { total, seguidos, apc, pct: seguidos === 0 ? 0 : Math.round((apc / seguidos) * 100) };
}

/* La foto de esta semana con lo que cambió respecto a la anterior ya
   calculado. `anteriores` es el arreglo de fotos del resumen de la semana
   pasada (o nada, si es el primero). */
export function fotoConComparacion(fotos, anteriores) {
  const previas = new Map((anteriores || []).map((f) => [f.id, f]));
  return sinCerradosRepetidos(fotos, anteriores).map((foto) => {
    const previa = previas.get(foto.id);
    const cambios = previa ? cambiosEntreFotos(previa, foto) : [];
    return {
      ...foto,
      /* Sin foto anterior no se dice "0 avanzaron" —que sonaría a que no se
         hizo nada— sino que no hay con qué comparar. */
      hayComparacion: !!previa,
      cambios,
      avanzaron: cambios.filter((c) => c.avance > 0).length,
    };
  });
}

/* ------------------------------------------------------------------ semanas */

/* Medianoche del lunes de la semana de `fecha`, como 'YYYY-MM-DD'. Es la
   llave de un resumen: uno por persona y por semana. */
export function lunesDe(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo … 6 = sábado
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return isoDeFecha(d);
}

export function isoDeFecha(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/* Suma días a una fecha 'YYYY-MM-DD' y devuelve otra igual. Se construye la
   fecha a mano y no con new Date('YYYY-MM-DD'), que se interpreta en UTC y en
   Colombia devuelve el día anterior. */
export function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return isoDeFecha(fecha);
}

/* El viernes de esa semana: el cierre normal. Quien salga antes puede cerrar
   su resumen otro día (ver `hasta`), y eso no afecta a los demás. */
export function viernesDe(lunesIso) {
  return sumarDias(lunesIso, 4);
}

/* El día en que cierra la semana PARA TODOS. Normalmente el viernes; un líder
   lo puede correr cuando ese viernes es festivo y el equipo entero entrega el
   jueves. Es distinto del `hasta` de cada resumen, que es una decisión
   individual —quien sale de vacaciones el jueves cierra el suyo el miércoles—
   y no le mueve la semana a nadie más. */
export function cierreDeSemana(lunesIso, cierres) {
  const fila = (cierres || []).find((c) => c.semana === lunesIso);
  return (fila && fila.cierre) || viernesDe(lunesIso);
}

/* La nota con la que un líder explica por qué corrió el cierre ("Viernes
   festivo"), si la escribió. */
export function notaDeCierre(lunesIso, cierres) {
  const fila = (cierres || []).find((c) => c.semana === lunesIso);
  return (fila && fila.nota) || '';
}

/* Un cierre solo tiene sentido dentro de su propia semana: mover el de esta
   semana a un día del mes entrante dejaría a todo el mundo "sin vencer" para
   siempre. */
export function cierreValido(lunesIso, cierreIso) {
  if (!cierreIso) return false;
  return cierreIso >= lunesIso && cierreIso <= sumarDias(lunesIso, 6);
}

/* ---------------------------------------------------------- ausencias */

/* Por qué alguien no estuvo. El motivo se muestra en la lista del equipo: no
   es lo mismo unas vacaciones planeadas que una incapacidad. */
export const MOTIVOS_AUSENCIA = [
  { id: 'vacaciones', label: 'Vacaciones' },
  { id: 'incapacidad', label: 'Incapacidad' },
  { id: 'permiso', label: 'Permiso' },
  { id: 'licencia', label: 'Licencia' },
];

export function etiquetaDeMotivo(id) {
  return (MOTIVOS_AUSENCIA.find((m) => m.id === id) || {}).label || 'Ausente';
}

/* La ausencia que tapa una semana ENTERA: desde el lunes hasta el día en que
   cierra. Una que cubre solo parte no cuenta, a propósito — quien trabajó
   aunque fuera un día tiene algo que contar, y para cerrar antes ya está el
   campo "hasta" de cada resumen.

   Si hay varias que sirven se devuelve la primera: solo se necesita saber por
   qué no estuvo, y con una basta. */
export function ausenciaDeLaSemana(ausencias, usuarioId, lunesIso, cierreIso) {
  if (!usuarioId) return null;
  return (ausencias || []).find((a) => a.usuario_id === usuarioId
    && a.desde <= lunesIso && a.hasta >= cierreIso) || null;
}

/* Las ausencias que tocan la semana, aunque sea un día: es lo que se lista en
   la pantalla, porque un "sale el jueves" también hay que verlo. */
export function ausenciasQueTocan(ausencias, lunesIso, hastaIso) {
  const fin = hastaIso || sumarDias(lunesIso, 6);
  return (ausencias || [])
    .filter((a) => a.desde <= fin && a.hasta >= lunesIso)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

/* Un rango al revés —o sin fechas— no se guarda: dejaría una ausencia que no
   cubre nada y que nadie entiende al leerla. */
export function rangoDeAusenciaValido(desde, hasta) {
  return !!desde && !!hasta && desde <= hasta;
}

/* En qué va la entrega de una persona esa semana. Antes solo había "enviado" o
   "sin registrar", que no distinguía al que va con tiempo del que ya no lo
   tiene — que es justamente lo que un líder necesita ver.

   El día del cierre NO cuenta como vencido: el resumen se manda ese día, casi
   siempre por la tarde.

   Quien estuvo ausente toda la semana no debe nada, así que no aparece en rojo
   ni cuenta como pendiente. Si aun así mandó su resumen, manda lo que hizo: se
   ve como enviado. */
export function estadoDeEntrega(resumen, cierreIso, hoy = new Date(), ausencia = null) {
  if (resumen && resumen.enviado) return 'enviado';
  if (ausencia) return 'ausente';
  const hoyIso = isoDeFecha(hoy instanceof Date ? hoy : new Date(hoy));
  if (hoyIso > cierreIso) return 'vencido';
  if (hoyIso === cierreIso) return 'cierra_hoy';
  return 'pendiente';
}

/* "Semana del 8 al 12 de septiembre de 2026" — el título de la pantalla. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function etiquetaDeSemana(lunesIso, hastaIso) {
  const [a1, m1, d1] = lunesIso.split('-').map(Number);
  const fin = hastaIso || viernesDe(lunesIso);
  const [a2, m2, d2] = fin.split('-').map(Number);
  if (m1 === m2 && a1 === a2) return `Del ${d1} al ${d2} de ${MESES[m1 - 1]} de ${a1}`;
  if (a1 === a2) return `Del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a1}`;
  return `Del ${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
}

/* Las últimas `cuantas` semanas, de la más reciente a la más vieja. La
   pantalla abre en la actual: las viejas se buscan, no se acumulan a la
   vista. */
export function ultimasSemanas(cuantas = 12, hoy = new Date()) {
  const actual = lunesDe(hoy);
  return Array.from({ length: cuantas }, (_, i) => sumarDias(actual, -7 * i));
}

/* ------------------------------------------------ los temas de reuniones */

/* Un tema va a una de dos partes: la reunión del área de quien lo pone —que
   es a la que asiste— o la reunión de diseño, donde está todo el mundo. La
   segunda no se filtra por rol: cualquiera puede llevar algo ahí. */
export const DESTINOS_TEMA = [
  { id: 'equipo', label: 'Mi equipo', ayuda: 'Va a la reunión de tu área' },
  { id: 'diseno', label: 'Diseño', ayuda: 'Va a la reunión de diseño' },
];
export const DESTINO_POR_DEFECTO = 'equipo';

/* Los temas de antes se guardaron como texto pelado, cuando no había dónde
   elegir. Se leen como temas del área: era la única reunión que existía
   cuando se escribieron, así que es lo que quiso decir quien los puso. */
export function normalizarTema(tema) {
  if (typeof tema === 'string') return { texto: tema.trim(), reunion: DESTINO_POR_DEFECTO };
  return {
    texto: ((tema && tema.texto) || '').trim(),
    reunion: (tema && tema.reunion) || DESTINO_POR_DEFECTO,
  };
}

export function normalizarTemas(lista) {
  return (lista || []).map(normalizarTema).filter((t) => t.texto);
}

/* Los renglones de un bloque, ya listos para leerse. Solo "Temas" necesita
   traducción —sus renglones son objetos, no texto— y ahí se marca cuál va a
   la reunión de diseño: en el mensaje del chat, si no se dice, no se sabe. */
export function lineasDeBloque(key, bloques) {
  if (key !== 'temas') {
    return ((bloques || {})[key] || []).map((l) => (l || '').trim()).filter(Boolean);
  }
  return normalizarTemas((bloques || {}).temas)
    .map((t) => (t.reunion === 'diseno' ? `${t.texto} (reunión de diseño)` : t.texto));
}

/* El orden del día de la reunión del lunes: los "Temas" de todo el equipo,
   juntos y agrupados por quien los puso.

   Solo entran los resúmenes ENVIADOS, con el mismo criterio del resto: un
   borrador no está dicho, y llevar a una reunión un tema que alguien todavía
   estaba pensando sería peor que no llevarlo.

   El nombre sale del directorio y no del resumen, para que un cambio de nombre
   no deje temas viejos firmados por un fantasma; si la persona ya no está en
   el directorio se conserva la fila con lo que se sepa, porque el tema se
   discutió igual. */
export function temasDeLaSemana(resumenes, semana, directorio) {
  const porId = new Map((directorio || []).map((p) => [p.id, p]));
  return (resumenes || [])
    .filter((r) => r.semana === semana && r.enviado)
    .map((r) => {
      const persona = porId.get(r.usuario_id);
      return {
        usuario_id: r.usuario_id,
        nombre: persona?.nombre || 'Alguien que ya no está en el equipo',
        foto: persona?.foto || null,
        /* Los roles viajan con el grupo para poder repartirlo en su reunión
           (ver repartirEnReuniones) sin volver a consultar el directorio. */
        roles: persona?.roles || [],
        temas: normalizarTemas(r.bloques?.temas),
      };
    })
    .filter((g) => g.temas.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* Los lunes no hay una reunión sino tres, y cada quien va a la suya. Los
   roles de cada una salen de las mismas categorías con las que se agrupa la
   pestaña Equipo (EQUIPO_CATEGORIAS), para que no haya dos listas diciendo
   quién es "civil" y que se desincronicen con el tiempo.

   A la reunión de cada área se suma su líder: el Líder Civil va a la civil, y
   así. El Líder de Diseño no está en ninguna porque va a todas. */
const rolesDeCategoria = (id) => (EQUIPO_CATEGORIAS.find((c) => c.id === id) || {}).roles || [];

export const REUNIONES = [
  { id: 'civil', label: 'Reunión civil', roles: [...rolesDeCategoria('ing_civiles'), 'lider_civil'] },
  { id: 'electrica', label: 'Reunión eléctrica', roles: [...rolesDeCategoria('ing_electricos'), 'lider_electrico'] },
  { id: 'delineantes', label: 'Reunión delineantes', roles: [...rolesDeCategoria('delineantes'), 'lider_delineantes'] },
];

/* Reparte los temas en sus reuniones según el rol de quien los puso.

   Dos decisiones que conviene tener presentes:

   - Quien tiene roles de dos áreas —Ing. Civil y Delineante, por ejemplo— va a
     las dos reuniones, así que su tema aparece en las dos. Repetirlo es mejor
     que esconderlo: en la que sobre, se pasa de largo en diez segundos; en la
     que falte, no se habla nunca.

   - Quien no cae en ninguna (Trámites y BT, Control de Calidad, el Líder de
     Diseño) NO se descarta: sus temas van a un grupo aparte. Un orden del día
     que se come temas en silencio no sirve para nada.

   Las tres reuniones se devuelven siempre, aunque estén vacías, porque quien
   convoca necesita ver que la suya no tiene temas — no que no existe. */
export function repartirEnReuniones(grupos) {
  const lista = grupos || [];
  /* Cada grupo, con solo los temas que van a la reunión pedida. Quien se
     quede sin ninguno no aparece: una firma sin temas debajo no dice nada. */
  const soloDe = (destino) => lista
    .map((g) => ({ ...g, temas: (g.temas || []).map(normalizarTema).filter((t) => t.reunion === destino) }))
    .filter((g) => g.temas.length > 0);

  const deEquipo = soloDe('equipo');
  const reuniones = REUNIONES.map((r) => ({
    ...r,
    grupos: deEquipo.filter((g) => (g.roles || []).some((rol) => r.roles.includes(rol))),
  }));
  const repartidos = new Set(reuniones.flatMap((r) => r.grupos.map((g) => g.usuario_id)));
  const sueltos = deEquipo.filter((g) => !repartidos.has(g.usuario_id));
  if (sueltos.length > 0) {
    reuniones.push({ id: 'otros', label: 'Sin reunión asignada', grupos: sueltos });
  }

  /* La de diseño va primero porque es la única a la que va todo el mundo, y
     no se filtra por rol: si alguien puso un tema ahí, ahí queda. */
  return [{ id: 'diseno', label: 'Reunión de diseño', grupos: soloDe('diseno') }, ...reuniones];
}

/* Cuántos temas hay en total, para el encabezado de la reunión. */
export function contarTemas(grupos) {
  return (grupos || []).reduce((total, g) => total + g.temas.length, 0);
}

/* El orden del día como texto, para pegarlo en la convocatoria de la reunión.
   Mismo formato de viñetas que el resto de la aplicación. */
export function textoDeTemas(grupos, etiquetaSemana, titulo = 'Temas para la reunión') {
  const partes = [`${titulo}${etiquetaSemana ? ` · ${etiquetaSemana}` : ''}`];
  (grupos || []).forEach((g) => {
    partes.push('', g.nombre);
    g.temas.forEach((t) => partes.push(`-${normalizarTema(t).texto}`));
  });
  if ((grupos || []).length === 0) partes.push('', 'Ninguno');
  return partes.join('\n');
}

/* ------------------------------------------------------------------- texto */

/* El resumen como texto plano, con el formato que el equipo ya usa en el
   chat. Las menciones (@Fulano) no se pueden generar desde aquí: salen como
   texto y hay que volver a mencionarlas al pegar. */
export function textoDelResumen({ bloques, proyectos, saludo = 'Buenas tardes', incluirAvance = true, compacto = false }) {
  const partes = [saludo];

  /* El mensaje que se pega en el chat es el que más sufre con treinta
     proyectos: ahí van el total y lo que se movió, nada más. */
  if (incluirAvance && compacto && (proyectos || []).length > 0) {
    const t = totalDeAvance(proyectos);
    partes.push('', 'Avance de mis proyectos');
    partes.push(`-En total: ${t.proyectos} proyectos, ${t.apc} de ${t.seguidos} documentos en APC (${t.pct}%)`);
    if (t.conMovimiento.length === 0) {
      partes.push('-Ningún proyecto se movió esta semana');
    } else {
      t.conMovimiento.forEach((p) => {
        const { pct } = cuentaDeFoto(p);
        partes.push(`-${p.nombre}: ${pct}% · ${p.avanzaron} ${p.avanzaron === 1 ? 'documento avanzó' : 'documentos avanzaron'}`);
      });
      if (t.quietos > 0) partes.push(`-Los otros ${t.quietos} siguen igual`);
    }
  } else if (incluirAvance && (proyectos || []).length > 0) {
    partes.push('', 'Avance de mis proyectos');
    proyectos.forEach((p) => {
      const { pct, apc, seguidos } = cuentaDeFoto(p);
      const movimiento = !p.hayComparacion
        ? 'primera semana registrada'
        : p.avanzaron === 0
          ? 'sin cambios esta semana'
          : `${p.avanzaron} ${p.avanzaron === 1 ? 'documento avanzó' : 'documentos avanzaron'} esta semana`;
      partes.push(`-${p.nombre}: ${pct}% (${apc} de ${seguidos} en APC) · ${movimiento}`);
    });
  }

  BLOQUES_RESUMEN.forEach((bloque) => {
    const lineas = lineasDeBloque(bloque.key, bloques);
    partes.push('', bloque.label);
    if (lineas.length === 0) partes.push(`-${bloque.vacio}`);
    else lineas.forEach((l) => partes.push(`-${l}`));
  });

  return partes.join('\n');
}

/* ------------------------------------------- avance de los roles transversales */

/* Hidráulico, estructural y geotécnico no llevan tres o cuatro proyectos:
   están en casi todos. Listarles treinta tarjetas, veintiocho de ellas
   quietas en el mismo porcentaje, entierra lo único que un resumen semanal
   tiene que decir — qué se movió. */
export const ROLES_TRANSVERSALES = ['hidraulico', 'estructural', 'geotecnico'];

export function usaAvanceCompacto(perfil) {
  const roles = (perfil && perfil.roles) || [];
  return roles.some((r) => ROLES_TRANSVERSALES.includes(r));
}

/* El avance de todos los proyectos sumado, más los que se movieron. Los
   documentos en "No aplica" no cuentan, igual que en la torta del resto de la
   aplicación: `cuentaDeFoto` ya lo resuelve por proyecto y aquí solo se
   suman. */
export function totalDeAvance(fotos) {
  const lista = fotos || [];
  const suma = lista.reduce((t, f) => {
    const { seguidos, apc } = cuentaDeFoto(f);
    return { seguidos: t.seguidos + seguidos, apc: t.apc + apc };
  }, { seguidos: 0, apc: 0 });
  const conMovimiento = lista.filter((f) => (f.avanzaron || 0) > 0);
  return {
    proyectos: lista.length,
    seguidos: suma.seguidos,
    apc: suma.apc,
    pct: suma.seguidos === 0 ? 0 : Math.round((suma.apc / suma.seguidos) * 100),
    avanzaron: conMovimiento.reduce((t, f) => t + f.avanzaron, 0),
    conMovimiento,
    quietos: lista.length - conMovimiento.length,
  };
}
