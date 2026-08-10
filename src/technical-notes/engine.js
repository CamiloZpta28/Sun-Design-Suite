/* ============================================================================
   MOTOR DE NOTAS TÉCNICAS
   ----------------------------------------------------------------------------
   Framework-agnóstico a propósito (no importa React ni nada de src/App.jsx):
   recibe un proyecto y una "spec" (plantilla + resolvers) y devuelve texto
   resuelto + metadatos de completitud. Pensado para poder reutilizarse desde
   la UI, y más adelante desde generación de planos/PDF/DOCX/exportaciones
   sin cambiar nada aquí (ver README.md de este módulo).

   Determinístico: mismo project + misma spec => mismo resultado, siempre.
   No hay IA ni nada no determinístico involucrado.
   ============================================================================ */

export const RESOLUTION_STATUS = Object.freeze({
  RESUELTO: 'RESUELTO',
  FALTANTE: 'FALTANTE',
  INVALIDO: 'INVALIDO',
  NO_APLICA: 'NO_APLICA',
  DESCONOCIDO: 'DESCONOCIDO', // placeholder en la plantilla sin resolver declarado — error de configuración, no de datos
});

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
 *  proyecto. Un ID sin resolver declarado se reporta como DESCONOCIDO (no
 *  como FALTANTE): es un problema de la plantilla/catálogo, no de que al
 *  ingeniero le falte llenar un dato. */
export function resolveParameter(resolvers, id, projectData) {
  const resolver = resolvers ? resolvers[id] : null;
  if (!resolver) {
    return { id, label: id, status: RESOLUTION_STATUS.DESCONOCIDO, value: null, fieldRef: null };
  }
  const outcome = resolver.resolve(projectData) || {};
  return {
    id,
    label: resolver.label || id,
    status: outcome.status || RESOLUTION_STATUS.FALTANTE,
    value: outcome.status === RESOLUTION_STATUS.RESUELTO ? outcome.value : null,
    fieldRef: resolver.fieldRef || null,
  };
}

/** Reemplaza cada {{ID}} de `text` por su valor resuelto. Si un parámetro no
 *  está RESUELTO, NUNCA deja el token {{ID}} crudo visible — lo reemplaza
 *  por una marca legible con la etiqueta humana del parámetro, para que el
 *  llamador (UI, exportación) decida cómo destacarla. */
function renderText(text, resolvedById) {
  return text.replace(PLACEHOLDER_PATTERN, (fullMatch, id) => {
    const resolved = resolvedById.get(id);
    if (resolved && resolved.status === RESOLUTION_STATUS.RESUELTO) return resolved.value;
    const label = resolved ? resolved.label : id;
    return `⚠ Falta definir: ${label}`;
  });
}

/**
 * Resuelve todas las notas técnicas de una spec para un proyecto.
 *
 * @param {object} project - proyecto completo (usa project.data).
 * @param {object} spec - { id, label, template, resolvers }.
 * @returns {ResolvedTechnicalNotes}
 */
export function resolveTechnicalNotes(project, spec) {
  if (!spec || !spec.template || !spec.resolvers) {
    throw new Error('resolveTechnicalNotes: spec inválida o no habilitada (falta template/resolvers).');
  }
  const projectData = (project && project.data) || {};

  // 1) IDs realmente requeridos por la plantilla (únicos, en orden de aparición).
  const allNotesFlat = spec.template.secciones.flatMap((s) => s.notas);
  const requiredIds = [];
  const seenIds = new Set();
  allNotesFlat.forEach((nota) => {
    extractPlaceholderIds(nota.texto).forEach((id) => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        requiredIds.push(id);
      }
    });
  });

  // 2) Se resuelve cada ID único UNA sola vez (si se repite en varias notas,
  //    todas las apariciones usan exactamente el mismo valor resuelto).
  const resolvedById = new Map(requiredIds.map((id) => [id, resolveParameter(spec.resolvers, id, projectData)]));

  // 3) Notas, agrupadas igual que la plantilla original.
  const secciones = spec.template.secciones.map((seccion) => ({
    titulo: seccion.titulo,
    notas: seccion.notas.map((nota) => {
      const idsEnNota = extractPlaceholderIds(nota.texto);
      const parametros = idsEnNota.map((id) => resolvedById.get(id));
      const completa = parametros.every((p) => p.status === RESOLUTION_STATUS.RESUELTO);
      return {
        numero: nota.numero,
        textoOriginal: nota.texto,
        textoResuelto: renderText(nota.texto, resolvedById),
        completa,
        parametros,
      };
    }),
  }));

  // 4) Completitud sobre placeholders únicos requeridos por la plantilla.
  const parametros = requiredIds.map((id) => resolvedById.get(id));
  const pendientes = parametros.filter((p) => p.status !== RESOLUTION_STATUS.RESUELTO);
  const completos = parametros.length - pendientes.length;
  const porcentaje = parametros.length === 0 ? 100 : Math.round((completos / parametros.length) * 100);

  return {
    specId: spec.id,
    specLabel: spec.label,
    secciones,
    parametros,
    pendientes,
    completitud: {
      requeridos: parametros.length,
      completos,
      porcentaje,
    },
    textoCompleto: secciones
      .map((s) => `${s.titulo}\n\n${s.notas.map((n) => `${n.numero}. ${n.textoResuelto}`).join('\n\n')}`)
      .join('\n\n'),
  };
}
