import { GENERAL } from '../categories/index.js';
import { fromCatalogOverride } from '../../resolverKit.js';

/** UNIDAD_PLANOS no tiene campo de dominio en ninguna pestaña (es una
 *  convención de presentación de planos/notas, no un dato técnico del
 *  proyecto) — vive en project.data.technicalNotes.overrides.GENERAL. */
export function buildGeneralResolvers() {
  return {
    UNIDAD_PLANOS: fromCatalogOverride(GENERAL, 'UNIDAD_PLANOS'),
  };
}
