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
import { equipoComoArray } from './permisos.js';

/* Los cuatro bloques que se escriben a mano, en el orden en que se pegan.
   El "vacío" es lo que se escribe cuando no hay nada — el formato que el
   equipo ya usa dice "Ninguna" para dificultades y "Ninguno" para temas. */
export const BLOQUES_RESUMEN = [
  { key: 'lo_mejor', label: 'Lo mejor', vacio: 'Ninguno', ayuda: 'Lo que sacaste esta semana: reuniones, asesorías, capacitaciones, entregas…' },
  { key: 'pendientes', label: 'Pendientes', vacio: 'Ninguno', ayuda: 'Lo que queda para la semana entrante' },
  { key: 'dificultades', label: 'Dificultades', vacio: 'Ninguna', ayuda: 'Lo que te frenó o te costó' },
  { key: 'temas', label: 'Temas', vacio: 'Ninguno', ayuda: 'Lo que quieres hablar en la reunión del lunes' },
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

/* Los roles que una persona ocupa EN ESTE proyecto, no los que tiene en su
   perfil. Alguien puede ser Ing. Civil y Delineante a la vez y estar puesto
   en un proyecto solo como civil: ahí los planos no son suyos. */
export function rolesEnProyecto(nombre, equipo) {
  return Object.entries(equipo || {})
    .filter(([, valor]) => equipoComoArray(valor).includes(nombre))
    .map(([rol]) => rol);
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
       semana (ver sinFinalizadosRepetidos). */
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

/* Un proyecto terminado no tiene por qué salir cada semana con el mismo 100%:
   la semana en que se termina sí es noticia, las siguientes son ruido. Se
   queda solo el que TODAVÍA no estaba finalizado en la foto anterior.

   Cuando no hay foto anterior —el primer resumen de alguien— se deja pasar:
   más vale que aparezca una vez de más a que un proyecto que se acaba de
   cerrar no se registre nunca. */
export function sinFinalizadosRepetidos(fotos, anteriores) {
  const previas = new Map((anteriores || []).map((f) => [f.id, f]));
  return (fotos || []).filter((foto) => {
    if (foto.estado !== 'finalizado') return true;
    const previa = previas.get(foto.id);
    return !previa || previa.estado !== 'finalizado';
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
  return sinFinalizadosRepetidos(fotos, anteriores).map((foto) => {
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

/* ------------------------------------------------------------------- texto */

/* El resumen como texto plano, con el formato que el equipo ya usa en el
   chat. Las menciones (@Fulano) no se pueden generar desde aquí: salen como
   texto y hay que volver a mencionarlas al pegar. */
export function textoDelResumen({ bloques, proyectos, saludo = 'Buenas tardes', incluirAvance = true }) {
  const partes = [saludo];

  if (incluirAvance && (proyectos || []).length > 0) {
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
    const lineas = (bloques?.[bloque.key] || []).map((l) => (l || '').trim()).filter(Boolean);
    partes.push('', bloque.label);
    if (lineas.length === 0) partes.push(`-${bloque.vacio}`);
    else lineas.forEach((l) => partes.push(`-${l}`));
  });

  return partes.join('\n');
}
