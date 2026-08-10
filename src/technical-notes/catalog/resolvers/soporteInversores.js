/* ============================================================================
   Resolvers de SOPORTE_INVERSORES.
   ----------------------------------------------------------------------------
   Los tres inputs son project_value: sus defaults (Manual SUN2000, 28 MPa,
   17.5 MPa) son referencias de la memoria fuente y aparecen como sugerencia,
   nunca como valor adoptado silenciosamente.

   FC_FUNDACION reutiliza la resistencia ya capturada en dim_ciment_inversores
   (regla 19) en vez de crear un campo paralelo.
   ============================================================================ */

import { SOPORTE_INVERSORES } from '../categories/index.js';
import { fromCatalog } from '../../resolverKit.js';

const EST = 'estructural';

export function buildSoporteInversoresResolvers() {
  const cat = SOPORTE_INVERSORES;
  return {
    MANUAL_CARGAS: fromCatalog(cat, 'MANUAL_CARGAS', {
      label: 'Soporte de inversores — manual de cargas de referencia',
      tab: EST, fieldKey: 'inversores_manual_cargas', path: [EST, 'inversores_manual_cargas'],
    }),
    FC_FUNDACION: fromCatalog(cat, 'FC_FUNDACION', {
      label: "Soporte de inversores — f'c de fundaciones",
      tab: EST, fieldKey: 'dim_ciment_inversores', path: [EST, 'dim_ciment_inversores', 'resistencia'],
    }),
    FC_CICLOPEO: fromCatalog(cat, 'FC_CICLOPEO', {
      label: "Soporte de inversores — f'c del concreto ciclópeo",
      tab: EST, fieldKey: 'inversores_fc_ciclopeo', path: [EST, 'inversores_fc_ciclopeo'],
    }),
  };
}
