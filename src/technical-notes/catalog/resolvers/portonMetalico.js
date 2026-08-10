/* ============================================================================
   Resolvers de PORTON_METALICO.
   ----------------------------------------------------------------------------
   ZAPATA y DESPLANTE se derivan de dim_ciment_porton (cimentación tipo
   zapata+pedestal que YA existía en Estructural) en vez de crear campos
   nuevos. Los demás project_value sí necesitan campo propio.

   AISLAMIENTO (regla 9): el acero del portón (ASTM A500 Grado C, fy 315,
   fu 425) vive SOLO aquí; el del cerramiento, solo en su propio módulo.
   Aunque ambos pertenezcan al group "ACERO_ESTRUCTURAL", nunca se ofrecen
   como opción cruzada — el repositorio los mantiene con scope por estructura.
   ============================================================================ */

import { PORTON_METALICO } from '../categories/index.js';
import { STATUS } from '../../engine.js';
import { fromCatalog, getPath } from '../../resolverKit.js';
import { isBlank, metersToMetersPhrase, passthrough } from '../../formatters.js';

const EST = 'estructural';

/** "1.00 m x 1.00 m" a partir del ancho y profundo de la zapata del portón
 *  ya capturados en dim_ciment_porton. project_value: si falta cualquiera
 *  de las dos dimensiones, queda PENDING (no se inventa la del default). */
function zapataResolver() {
  const suggested = passthrough(PORTON_METALICO.inputs.ZAPATA.default);
  return {
    id: 'ZAPATA',
    label: 'Zapata del portón — dimensiones en planta',
    fieldRef: { tab: EST, fieldKey: 'dim_ciment_porton' },
    resolve(data) {
      const ancho = getPath(data, [EST, 'dim_ciment_porton', 'ancho_zapata']);
      const profundo = getPath(data, [EST, 'dim_ciment_porton', 'profundo_zapata']);
      if (isBlank(ancho) || isBlank(profundo)) return { status: STATUS.PENDING, value: null, suggested };
      const a = metersToMetersPhrase(ancho);
      const b = metersToMetersPhrase(profundo);
      if (isBlank(a) || isBlank(b)) return { status: STATUS.INVALID, value: null, suggested };
      return { status: STATUS.RESOLVED_PROJECT, value: `${a} x ${b}`, suggested };
    },
  };
}

export function buildPortonResolvers() {
  const cat = PORTON_METALICO;
  return {
    CAPACIDAD_SUELO: fromCatalog(cat, 'CAPACIDAD_SUELO', {
      label: 'Capacidad admisible del suelo (cimentación portón)',
      tab: 'geotecnia',
      fieldKey: 'capacidad_admisible_porton',
      path: ['geotecnia', 'capacidad_admisible_porton'],
    }),
    ZAPATA: zapataResolver(),
    DESPLANTE: fromCatalog(cat, 'DESPLANTE', {
      label: 'Zapata del portón — profundidad de desplante',
      tab: EST,
      fieldKey: 'dim_ciment_porton',
      path: [EST, 'dim_ciment_porton', 'desplante'],
      formatter: metersToMetersPhrase,
    }),
    VIGA_AMARRE: fromCatalog(cat, 'VIGA_AMARRE', {
      label: 'Viga de amarre — sección',
      tab: EST,
      fieldKey: 'porton_viga_amarre_seccion',
      path: [EST, 'porton_viga_amarre_seccion'],
    }),
    REEMPLAZO_GRANULAR: fromCatalog(cat, 'REEMPLAZO_GRANULAR', {
      label: 'Reemplazo de material granular bajo la cimentación',
      tab: EST,
      fieldKey: 'porton_reemplazo_granular',
      path: [EST, 'porton_reemplazo_granular'],
    }),
    PERFIL: fromCatalog(cat, 'PERFIL', {
      label: 'Portón — perfil metálico embebido',
      tab: EST,
      fieldKey: 'porton_perfil_embebido',
      path: [EST, 'porton_perfil_embebido'],
    }),
    ACERO: fromCatalog(cat, 'ACERO', {
      label: 'Portón — norma del acero',
      tab: EST,
      fieldKey: 'porton_acero_norma',
      path: [EST, 'porton_acero_norma'],
    }),
    FY: fromCatalog(cat, 'FY', {
      label: 'Portón — fy',
      tab: EST,
      fieldKey: 'porton_acero_fy',
      path: [EST, 'porton_acero_fy'],
    }),
    FU: fromCatalog(cat, 'FU', {
      label: 'Portón — fu',
      tab: EST,
      fieldKey: 'porton_acero_fu',
      path: [EST, 'porton_acero_fu'],
    }),
    SOLDADURA: fromCatalog(cat, 'SOLDADURA', {
      label: 'Soldadura del portón — espesor mínimo',
      tab: EST,
      fieldKey: 'porton_soldadura_espesor',
      path: [EST, 'porton_soldadura_espesor'],
    }),
  };
}
