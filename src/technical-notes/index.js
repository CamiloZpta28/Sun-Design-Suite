/* ============================================================================
   API pública del módulo de Notas Técnicas.
   ----------------------------------------------------------------------------
   getResolvedTechnicalNotes(project, structureType) es la función pensada
   para reutilizarse fuera de la UI (planos, PDF, DOCX, otros reportes) sin
   depender de React ni de components de src/App.jsx.

   El catálogo se sirve a través de un provider (catalogProvider.js) para
   que más adelante pueda existir un SupabaseCatalogProvider sin cambiar el
   motor ni esta API.
   ============================================================================ */

import { resolveTechnicalNotes, STATUS, isResolvedStatus, extractPlaceholderIds } from './engine.js';
import { buildSpec } from './catalog/bundler.js';
import { MANIFEST, STRUCTURE_LABELS } from './catalog/manifest.js';
import { optionsFor } from './repository.js';
import { validateCatalog } from './validation.js';
import { TRACEABILITY, sourcesForCategory } from './catalog/traceability.js';
import { buildPlainTextNotes, sectionTitle } from './notesText.js';

export {
  buildPlainTextNotes,
  sectionTitle,
  STATUS,
  isResolvedStatus,
  extractPlaceholderIds,
  MANIFEST,
  STRUCTURE_LABELS,
  optionsFor,
  validateCatalog,
  TRACEABILITY,
  sourcesForCategory,
  buildSpec,
};

/** Tipos de estructura disponibles para el selector principal. */
export const STRUCTURE_OPTIONS = MANIFEST.structure_options.map((id) => ({
  id,
  label: STRUCTURE_LABELS[id] || id,
}));

/**
 * Resuelve las notas técnicas de un proyecto para un tipo de estructura.
 * Devuelve null si el tipo no existe en el manifest.
 *
 * @param {object} project
 * @param {string} structureType - ej. "CERRAMIENTO_PERIMETRAL"
 */
export function getResolvedTechnicalNotes(project, structureType) {
  const spec = buildSpec(structureType);
  if (!spec) return null;
  const resolved = resolveTechnicalNotes(project, spec, { structureType });
  /* Vista derivada para copiar/pegar y para futuras exportaciones. Se
     recalcula en cada llamada a partir de las notas resueltas: nunca se
     guarda en projects.data. */
  return { ...resolved, textoCompleto: buildPlainTextNotes(resolved) };
}

/** Tipo de estructura guardado en el proyecto (regla 22: namespaced dentro
 *  de projects.data, sin duplicar un campo que ya exista). */
export function getStructureType(project) {
  return project?.data?.technicalNotes?.structureType || null;
}
