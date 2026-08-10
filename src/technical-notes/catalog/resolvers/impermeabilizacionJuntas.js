/* Los tres son productos comerciales: se guardan como override de Notas
   Técnicas (no son un dato de dominio de ninguna pestaña) y admiten "Otro"
   para no amarrar el proyecto a una marca — el ingeniero puede escribir
   "Producto X o equivalente". */
import { IMPERMEABILIZACION_JUNTAS } from '../categories/index.js';
import { fromCatalogOverride } from '../../resolverKit.js';

export function buildImpermeabilizacionResolvers() {
  const cat = IMPERMEABILIZACION_JUNTAS;
  return {
    IMPERMEABILIZANTE: fromCatalogOverride(cat, 'IMPERMEABILIZANTE', { label: 'Impermeabilizante de fundaciones' }),
    PUENTE_ADHERENCIA: fromCatalogOverride(cat, 'PUENTE_ADHERENCIA', { label: 'Puente de adherencia' }),
    SELLO_HIDROEXPANSIVO: fromCatalogOverride(cat, 'SELLO_HIDROEXPANSIVO', { label: 'Sello hidroexpansivo' }),
  };
}
