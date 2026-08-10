/* ============================================================================
   API pública del módulo de Notas Técnicas.
   ----------------------------------------------------------------------------
   getResolvedTechnicalNotes(project, specId) es la función pensada para
   reutilizarse fuera de la UI (planos, PDF, DOCX, otros reportes) sin
   depender de React ni de components de src/App.jsx.
   ============================================================================ */

import { resolveTechnicalNotes, RESOLUTION_STATUS } from './engine.js';
import { TECHNICAL_NOTE_SPECS, getTechnicalNoteSpec } from './specs.js';

export { RESOLUTION_STATUS, TECHNICAL_NOTE_SPECS, getTechnicalNoteSpec };

/**
 * Resuelve las notas técnicas de un proyecto para una especificación dada.
 * Devuelve null si la spec no existe o todavía no está habilitada
 * (ej. "PORTON_METALICO" en esta primera versión).
 *
 * @param {object} project
 * @param {string} specId - ej. "CERRAMIENTO_PERIMETRAL"
 */
export function getResolvedTechnicalNotes(project, specId) {
  const spec = getTechnicalNoteSpec(specId);
  if (!spec || !spec.enabled) return null;
  return resolveTechnicalNotes(project, spec);
}
