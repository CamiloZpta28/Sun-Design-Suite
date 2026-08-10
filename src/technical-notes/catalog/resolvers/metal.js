import { METAL } from '../categories/index.js';
import { fromCatalog } from '../../resolverKit.js';

export function buildMetalResolvers() {
  return {
    /* Reutiliza "Tipo de galvanizado", campo que ya existía en Estructural y
       que comparte toda la app (no es exclusivo de una estructura). */
    GALVANIZADO: fromCatalog(METAL, 'GALVANIZADO', {
      label: 'Tipo de galvanizado',
      tab: 'estructural',
      fieldKey: 'tipo_galvanizado',
      path: ['estructural', 'tipo_galvanizado'],
    }),
    ZINC_FRIO: fromCatalog(METAL, 'ZINC_FRIO', {
      label: 'Galvanizado en frío — contenido mínimo de zinc',
      tab: 'estructural',
      fieldKey: 'galvanizado_frio_zinc',
      path: ['estructural', 'galvanizado_frio_zinc'],
    }),
    CAPAS_REPARACION: fromCatalog(METAL, 'CAPAS_REPARACION', {
      label: 'Galvanizado en frío — capas de reparación',
      tab: 'estructural',
      fieldKey: 'galvanizado_frio_capas',
      path: ['estructural', 'galvanizado_frio_capas'],
    }),
  };
}
