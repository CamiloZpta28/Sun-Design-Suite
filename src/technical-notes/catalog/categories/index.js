/* Registro de categorías disponibles, keyed por category_id — punto único de
   extensión para agregar una categoría nueva sin tocar el motor ni el
   ensamblador de bundles (bundler.js). */
import { GENERAL } from './general.js';
import { CONCRETO } from './concrete.js';
import { METAL } from './metal.js';
import { PORTON_METALICO } from './portonMetalico.js';
import { CERRAMIENTO_PERIMETRAL } from './cerramientoPerimetral.js';
import { IMPERMEABILIZACION_JUNTAS } from './impermeabilizacionJuntas.js';
import { SHELTER_CIMENTACION } from './shelterCimentacion.js';
import { SOPORTE_INVERSORES } from './soporteInversores.js';

export const CATEGORIES = {
  GENERAL,
  CONCRETO,
  METAL,
  PORTON_METALICO,
  CERRAMIENTO_PERIMETRAL,
  IMPERMEABILIZACION_JUNTAS,
  SHELTER_CIMENTACION,
  SOPORTE_INVERSORES,
};

export { GENERAL, CONCRETO, METAL, PORTON_METALICO, CERRAMIENTO_PERIMETRAL, IMPERMEABILIZACION_JUNTAS, SHELTER_CIMENTACION, SOPORTE_INVERSORES };

export function getCategory(categoryId) {
  return CATEGORIES[categoryId] || null;
}
