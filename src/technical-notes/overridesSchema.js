/* ============================================================================
   Inputs del catálogo que NO tienen un campo de dominio en ninguna pestaña de
   SCHEMA y por tanto se editan desde el propio panel de Notas Técnicas,
   guardándose en project.data.technicalNotes.overrides[categoryId][inputKey]
   (regla 22: estructura namespaced, sin inventar pestañas nuevas).

   Se deriva del catálogo — no duplica valores ni opciones: solo declara qué
   inputs viven como override, para que el panel sepa qué renderizar.
   ============================================================================ */

import { CATEGORIES } from './catalog/categories/index.js';
import { bundleFor } from './catalog/manifest.js';
import { optionsFor, groupForInput } from './repository.js';

/* categoryId -> [inputKey] que se editan como override.
   UNIDAD_PLANOS quedó FUERA a propósito: la unidad de los planos es siempre
   metros en este sistema, se resuelve con un valor fijo (ver
   catalog/resolvers/general.js) y ya no es un dato capturable. */
const OVERRIDE_INPUTS = {
  IMPERMEABILIZACION_JUNTAS: ['IMPERMEABILIZANTE', 'PUENTE_ADHERENCIA', 'SELLO_HIDROEXPANSIVO'],
};

const LABELS = {
  IMPERMEABILIZANTE: 'Impermeabilizante de fundaciones',
  PUENTE_ADHERENCIA: 'Puente de adherencia',
  SELLO_HIDROEXPANSIVO: 'Sello hidroexpansivo',
};

/**
 * Campos de override editables para un tipo de estructura: solo los de las
 * categorías que realmente pertenecen a su bundle (ej. los productos de
 * impermeabilización solo aparecen en shelter).
 */
export function overrideFieldsFor(structureType) {
  const bundle = bundleFor(structureType) || [];
  const fields = [];
  bundle.forEach((categoryId) => {
    (OVERRIDE_INPUTS[categoryId] || []).forEach((inputKey) => {
      const input = CATEGORIES[categoryId].inputs[inputKey];
      fields.push({
        categoryId,
        inputKey,
        label: LABELS[inputKey] || inputKey,
        opciones: input.options || optionsFor(groupForInput(categoryId, inputKey, input.group), structureType),
        defaultValue: input.default,
        allowOther: input.type !== 'select',
      });
    });
  });
  return fields;
}
