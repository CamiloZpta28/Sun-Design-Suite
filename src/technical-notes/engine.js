/* ============================================================================
   MOTOR DE NOTAS TÉCNICAS
   ----------------------------------------------------------------------------
   Framework-agnóstico a propósito (no importa React ni nada de src/App.jsx):
   recibe un proyecto, una "spec" (notas + resolvers) y un contexto opcional
   ({ structureType }, para resolvers que dependen de qué estructura está
   activa, ej. FC_ESTRUCTURAL) y devuelve texto resuelto + metadatos de
   completitud. Pensado para reutilizarse desde la UI, y más adelante desde
   generación de planos/PDF/DOCX/exportaciones sin cambiar nada aquí.

   Determinístico: mismo project + misma spec + mismo contexto => mismo
   resultado, siempre. No hay IA ni nada no determinístico involucrado
   (regla explícita del encargo: cero llamadas a modelos en runtime).
   ============================================================================ */

/* Estados de resolución de un parámetro. Cada uno responde "de dónde salió
   el valor" y no solo "si hay valor":
     RESOLVED_PROJECT  -> viene de un campo de dominio existente en SCHEMA
                          (projects.data), sea porque ya lo traía el proyecto
                          o porque el ingeniero lo acaba de editar (en esta
                          arquitectura ambos casos son el mismo campo/estado:
                          no hay una capa "usuario" separada de "proyecto"
                          para campos de dominio).
     RESOLVED_USER     -> viene de un override de Notas Técnicas que NO tiene
                          campo de dominio propio (projects.data.technicalNotes
                          .overrides), explícitamente elegido/escrito por el
                          ingeniero.
     RESOLVED_DEFAULT  -> el campo está vacío y se usó el "valor típico" del
                          catálogo (solo permitido si el input NO es
                          project_value — ver isDefaultAllowed en resolvers).
     PENDING           -> no hay valor y no aplica (o no está permitido)
                          usar el default; requiere acción del ingeniero.
     INVALID           -> hay un valor pero el formatter no pudo interpretarlo.
     EXCLUDED          -> el input/nota está marcado excluded:true en el
                          catálogo (ver categorías de shelter) — no bloquea
                          completitud ni aparece como pendiente.
     UNKNOWN           -> el placeholder no tiene resolver declarado: error
                          de configuración del catálogo, no de datos del
                          proyecto. */
export const STATUS = Object.freeze({
  RESOLVED_PROJECT: 'RESOLVED_PROJECT',
  RESOLVED_USER: 'RESOLVED_USER',
  RESOLVED_DEFAULT: 'RESOLVED_DEFAULT',
  /* Calculado a partir de otros parámetros (ver preload_mode DERIVED del
     inventario): no lo aporta el proyecto ni sale de un default propio, así
     que se distingue para que la UI pueda etiquetarlo como derivado. */
  RESOLVED_DERIVED: 'RESOLVED_DERIVED',
  PENDING: 'PENDING',
  INVALID: 'INVALID',
  EXCLUDED: 'EXCLUDED',
  UNKNOWN: 'UNKNOWN',
});

const RESOLVED_STATUSES = new Set([
  STATUS.RESOLVED_PROJECT,
  STATUS.RESOLVED_USER,
  STATUS.RESOLVED_DEFAULT,
  STATUS.RESOLVED_DERIVED,
]);
export function isResolvedStatus(status) {
  return RESOLVED_STATUSES.has(status);
}

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

/** IDs únicos de placeholders {{ID}} presentes en un texto, en orden de
 *  primera aparición. */
export function extractPlaceholderIds(text) {
  const ids = [];
  const seen = new Set();
  const re = new RegExp(PLACEHOLDER_PATTERN.source, 'g');
  let match = re.exec(text);
  while (match !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    match = re.exec(text);
  }
  return ids;
}

/** Resuelve un único ID contra los resolvers de una spec y los datos de un
 *  proyecto. Un ID sin resolver declarado se reporta como UNKNOWN (no como
 *  PENDING): es un problema de la plantilla/catálogo, no de que al
 *  ingeniero le falte llenar un dato. */
export function resolveParameter(resolvers, id, projectData, context) {
  const resolver = resolvers ? resolvers[id] : null;
  if (!resolver) {
    return { id, label: id, status: STATUS.UNKNOWN, value: null, fieldRef: null, suggested: null };
  }
  const outcome = resolver.resolve(projectData, context) || {};
  const status = outcome.status || STATUS.PENDING;
  return {
    id,
    label: resolver.label || id,
    status,
    value: isResolvedStatus(status) ? outcome.value : null,
    fieldRef: resolver.fieldRef || null,
    // Para PENDING de un `project_value`: el valor de referencia de la memoria,
    // a mostrar como sugerencia en la UI — nunca se usa para resolver la nota.
    suggested: outcome.suggested ?? null,
  };
}

/** Reemplaza cada {{ID}} de `text` por su valor resuelto. Si un parámetro no
 *  está resuelto, NUNCA deja el token {{ID}} crudo visible — lo reemplaza
 *  por una marca legible con la etiqueta humana del parámetro, para que el
 *  llamador (UI, exportación) decida cómo destacarla. */
function renderText(text, resolvedById) {
  return text.replace(PLACEHOLDER_PATTERN, (fullMatch, id) => {
    const resolved = resolvedById.get(id);
    if (resolved && isResolvedStatus(resolved.status)) return resolved.value;
    const label = resolved ? resolved.label : id;
    return `⚠ Pendiente: ${label}`;
  });
}

/**
 * Resuelve todas las notas técnicas de una spec ya ensamblada (ver
 * catalog/bundler.js) para un proyecto.
 *
 * @param {object} project - proyecto completo (usa project.data).
 * @param {object} spec - { id, label, notes: [{note_id, text, categoryId, categoryLabel}], resolvers }.
 * @param {object} [context] - ej. { structureType }.
 * @returns {ResolvedTechnicalNotes}
 */
export function resolveTechnicalNotes(project, spec, context) {
  if (!spec || !spec.notes || !spec.resolvers) {
    throw new Error('resolveTechnicalNotes: spec inválida (falta notes/resolvers).');
  }
  const projectData = (project && project.data) || {};

  // 1) IDs realmente requeridos por las notas (únicos, en orden de aparición).
  const requiredIds = [];
  const seenIds = new Set();
  spec.notes.forEach((nota) => {
    extractPlaceholderIds(nota.text).forEach((id) => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        requiredIds.push(id);
      }
    });
  });

  // 2) Se resuelve cada ID único UNA sola vez (si se repite en varias notas,
  //    todas las apariciones usan exactamente el mismo valor resuelto).
  const resolvedById = new Map(requiredIds.map((id) => [id, resolveParameter(spec.resolvers, id, projectData, context)]));

  // 3) Notas resueltas, agrupadas por categoría en el orden en que vinieron
  //    ensambladas (bundler.js ya las entrega en orden de despliegue:
  //    Generalidades -> Concreto -> Metal/Impermeabilización -> específica).
  /* `numero` es la numeración CONTINUA de presentación (1, 2, 3… a lo largo
     de todas las secciones, sin reiniciar por categoría). `noteId` sigue
     siendo el identificador estable interno (dedupe, trazabilidad, tests,
     exportaciones) y no se muestra al usuario. */
  const notas = spec.notes.map((nota, i) => {
    const idsEnNota = extractPlaceholderIds(nota.text);
    const parametros = idsEnNota.map((id) => resolvedById.get(id));
    const completa = parametros.every((p) => isResolvedStatus(p.status));
    return {
      numero: i + 1,
      noteId: nota.note_id,
      categoryId: nota.categoryId,
      categoryLabel: nota.categoryLabel,
      textoOriginal: nota.text,
      textoResuelto: renderText(nota.text, resolvedById),
      completa,
      parametros,
    };
  });

  const secciones = [];
  const seccionByCategoria = new Map();
  notas.forEach((nota) => {
    let seccion = seccionByCategoria.get(nota.categoryId);
    if (!seccion) {
      seccion = { categoryId: nota.categoryId, titulo: nota.categoryLabel, notas: [] };
      seccionByCategoria.set(nota.categoryId, seccion);
      secciones.push(seccion);
    }
    seccion.notas.push(nota);
  });

  // 4) Completitud sobre placeholders únicos requeridos por las notas.
  const parametros = requiredIds.map((id) => resolvedById.get(id));
  const pendientes = parametros.filter((p) => !isResolvedStatus(p.status) && p.status !== STATUS.EXCLUDED);
  const completos = parametros.length - pendientes.length - parametros.filter((p) => p.status === STATUS.EXCLUDED).length;
  const consideradas = parametros.length - parametros.filter((p) => p.status === STATUS.EXCLUDED).length;
  const porcentaje = consideradas === 0 ? 100 : Math.round((completos / consideradas) * 100);

  /* El texto plano consolidado NO se arma aquí: es presentación (títulos
     legibles, mayúsculas, separaciones) y vive en notesText.js, que lo
     compone la capa pública (index.js). Así el motor queda libre de
     decisiones de formato y existe un único formato de salida. */
  return {
    specId: spec.id,
    specLabel: spec.label,
    secciones,
    parametros,
    pendientes,
    completitud: { requeridos: consideradas, completos, porcentaje },
  };
}
