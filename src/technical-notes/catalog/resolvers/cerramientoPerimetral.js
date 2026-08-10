/* ============================================================================
   Resolvers de CERRAMIENTO_PERIMETRAL.
   ----------------------------------------------------------------------------
   Reutiliza al máximo los campos de SCHEMA que ya existían para las notas de
   cerramiento de la implementación anterior (regla 19: una sola fuente de
   verdad, nada de "cerramiento_x" + "notas_cerramiento_x").

   DISCREPANCIAS conocidas entre lo que esos campos guardan hoy y lo que el
   paquete nuevo espera — se reportaron al usuario y NO se "corrigen"
   automáticamente sobre datos ya guardados (regla 1: no reemplazar valores
   del paquete con conocimiento externo, y regla 8: nunca sustituir un dato
   existente):
     - BANDIT: el catálogo nuevo espera solo el calibre ("1/2 in") porque la
       nota CER-008 ya escribe la palabra "calibre". Proyectos viejos pueden
       tener guardado "calibre 1/2”" (la frase completa), que se mostrará tal
       cual quedó.
     - ACERO: el catálogo nuevo espera la norma completa
       ("NTC 1560 / ASTM A1011") porque CER-009 ya no trae el prefijo fijo.
       Proyectos viejos pueden tener solo "ASTM A1011".
     - Las separaciones (poste/diagonales/vientos) pasaron de autocompletarse
       a ser project_value: ahora quedan PENDING si el proyecto no las define.
   ============================================================================ */

import { CERRAMIENTO_PERIMETRAL } from '../categories/index.js';
import { STATUS } from '../../engine.js';
import { fromCatalog, getPath } from '../../resolverKit.js';
import { isBlank, metersToCm, metersToMetersPhrase, sumMetersFormatted, passthrough } from '../../formatters.js';

const EST = 'estructural';

/** POSTE_LONGITUD es la suma de anclaje + afloramiento, misma fórmula que el
 *  campo `computed` de SCHEMA (una sola fuente: sumMetersFormatted). Es
 *  project_value en el catálogo, así que NO cae al default "3.00 m": si
 *  falta cualquiera de los dos sumandos, queda PENDING. */
function posteLongitudResolver() {
  const suggested = passthrough(CERRAMIENTO_PERIMETRAL.inputs.POSTE_LONGITUD.default);
  return {
    id: 'POSTE_LONGITUD',
    label: 'Poste típico — longitud total (anclaje + afloramiento)',
    fieldRef: { tab: EST, fieldKey: 'cerramiento_poste_longitud_total' },
    resolve(data) {
      const anclaje = getPath(data, [EST, 'cerramiento_poste_anclaje']);
      const afloramiento = getPath(data, [EST, 'cerramiento_poste_afloramiento']);
      if (isBlank(anclaje) || isBlank(afloramiento)) return { status: STATUS.PENDING, value: null, suggested };
      const value = sumMetersFormatted(anclaje, afloramiento);
      return isBlank(value)
        ? { status: STATUS.INVALID, value: null, suggested }
        : { status: STATUS.RESOLVED_PROJECT, value, suggested };
    },
  };
}

export function buildCerramientoResolvers() {
  const cat = CERRAMIENTO_PERIMETRAL;
  return {
    CAPACIDAD_SUELO: fromCatalog(cat, 'CAPACIDAD_SUELO', {
      label: 'Capacidad admisible del suelo (cimentación cerramiento)',
      tab: 'geotecnia',
      fieldKey: 'capacidad_admisible_cerramiento',
      path: ['geotecnia', 'capacidad_admisible_cerramiento'],
    }),

    /* Diámetro y desplante del pedestal viven en dim_ciment_cerramiento
       (cimentación cilíndrica, en metros decimales) — se convierten a cm
       porque las notas hablan en centímetros. */
    PEDESTAL_DIAMETRO: fromCatalog(cat, 'PEDESTAL_DIAMETRO', {
      label: 'Pedestal del cerramiento — diámetro',
      tab: EST,
      fieldKey: 'dim_ciment_cerramiento',
      path: [EST, 'dim_ciment_cerramiento', 'diametro'],
      formatter: metersToCm,
    }),
    PEDESTAL_DESPLANTE: fromCatalog(cat, 'PEDESTAL_DESPLANTE', {
      label: 'Pedestal del cerramiento — desplante',
      tab: EST,
      fieldKey: 'dim_ciment_cerramiento',
      path: [EST, 'dim_ciment_cerramiento', 'desplante'],
      formatter: metersToCm,
    }),

    /* POSTE_EMBEBIDO reutiliza el campo de anclaje del poste: es el mismo
       hecho físico (cuánto del poste queda dentro del pedestal), capturado
       en metros decimales. */
    POSTE_EMBEBIDO: fromCatalog(cat, 'POSTE_EMBEBIDO', {
      label: 'Poste típico — longitud embebida (anclaje)',
      tab: EST,
      fieldKey: 'cerramiento_poste_anclaje',
      path: [EST, 'cerramiento_poste_anclaje'],
      formatter: metersToCm,
    }),

    POSTE_DIAMETRO: fromCatalog(cat, 'POSTE_DIAMETRO', {
      label: 'Poste típico — diámetro nominal',
      tab: EST,
      fieldKey: 'cerramiento_poste_diametro',
      path: [EST, 'cerramiento_poste_diametro'],
    }),
    POSTE_ESPESOR: fromCatalog(cat, 'POSTE_ESPESOR', {
      label: 'Poste típico — espesor',
      tab: EST,
      fieldKey: 'cerramiento_poste_espesor',
      path: [EST, 'cerramiento_poste_espesor'],
    }),
    POSTE_LONGITUD: posteLongitudResolver(),
    POSTE_AFLORAMIENTO: fromCatalog(cat, 'POSTE_AFLORAMIENTO', {
      label: 'Poste típico — afloramiento',
      tab: EST,
      fieldKey: 'cerramiento_poste_afloramiento',
      path: [EST, 'cerramiento_poste_afloramiento'],
      formatter: metersToMetersPhrase,
    }),
    POSTE_SEPARACION: fromCatalog(cat, 'POSTE_SEPARACION', {
      label: 'Poste típico — separación entre postes',
      tab: EST,
      fieldKey: 'cerramiento_poste_separacion',
      path: [EST, 'cerramiento_poste_separacion'],
    }),

    DIAGONAL_DIAMETRO: fromCatalog(cat, 'DIAGONAL_DIAMETRO', {
      label: 'Diagonales y vientos — diámetro nominal',
      tab: EST,
      fieldKey: 'cerramiento_tubo_secundario_diametro',
      path: [EST, 'cerramiento_tubo_secundario_diametro'],
    }),
    DIAGONAL_ESPESOR: fromCatalog(cat, 'DIAGONAL_ESPESOR', {
      label: 'Diagonales y vientos — espesor',
      tab: EST,
      fieldKey: 'cerramiento_tubo_secundario_espesor',
      path: [EST, 'cerramiento_tubo_secundario_espesor'],
    }),
    DIAGONAL_LONGITUD: fromCatalog(cat, 'DIAGONAL_LONGITUD', {
      label: 'Diagonales — longitud',
      tab: EST,
      fieldKey: 'cerramiento_diagonales_longitud',
      path: [EST, 'cerramiento_diagonales_longitud'],
    }),
    DIAGONAL_SEPARACION: fromCatalog(cat, 'DIAGONAL_SEPARACION', {
      label: 'Diagonales — separación',
      tab: EST,
      fieldKey: 'cerramiento_diagonales_separacion',
      path: [EST, 'cerramiento_diagonales_separacion'],
    }),

    VIENTO_LONGITUD: fromCatalog(cat, 'VIENTO_LONGITUD', {
      label: 'Vientos — longitud',
      tab: EST,
      fieldKey: 'cerramiento_vientos_longitud',
      path: [EST, 'cerramiento_vientos_longitud'],
    }),
    VIENTO_SEPARACION: fromCatalog(cat, 'VIENTO_SEPARACION', {
      label: 'Vientos — separación',
      tab: EST,
      fieldKey: 'cerramiento_vientos_separacion',
      path: [EST, 'cerramiento_vientos_separacion'],
    }),

    MALLA: fromCatalog(cat, 'MALLA', {
      label: 'Malla eslabonada — especificación',
      tab: EST,
      fieldKey: 'cerramiento_malla_especificacion',
      path: [EST, 'cerramiento_malla_especificacion'],
    }),
    BANDIT: fromCatalog(cat, 'BANDIT', {
      label: 'Cinta bandit — calibre',
      tab: EST,
      fieldKey: 'cerramiento_bandit_calibre',
      path: [EST, 'cerramiento_bandit_calibre'],
    }),
    FIJACION: fromCatalog(cat, 'FIJACION', {
      label: 'Malla — separación máxima entre fijaciones',
      tab: EST,
      fieldKey: 'cerramiento_fijacion_separacion',
      path: [EST, 'cerramiento_fijacion_separacion'],
    }),

    ACERO: fromCatalog(cat, 'ACERO', {
      label: 'Perfilería del cerramiento — norma del acero',
      tab: EST,
      fieldKey: 'cerramiento_acero_norma',
      path: [EST, 'cerramiento_acero_norma'],
    }),
    FY: fromCatalog(cat, 'FY', {
      label: 'Perfilería del cerramiento — fy',
      tab: EST,
      fieldKey: 'cerramiento_acero_fy',
      path: [EST, 'cerramiento_acero_fy'],
    }),
    FU: fromCatalog(cat, 'FU', {
      label: 'Perfilería del cerramiento — fu',
      tab: EST,
      fieldKey: 'cerramiento_acero_fu',
      path: [EST, 'cerramiento_acero_fu'],
    }),

    AMBIENTE: fromCatalog(cat, 'AMBIENTE', {
      label: 'Clase de ambiente de corrosión (ISO 9223)',
      tab: EST,
      fieldKey: 'ambiente_corrosion_clase',
      path: [EST, 'ambiente_corrosion_clase'],
    }),
    SOLDADURA: fromCatalog(cat, 'SOLDADURA', {
      label: 'Soldadura del cerramiento — espesor mínimo',
      tab: EST,
      fieldKey: 'cerramiento_soldadura_espesor',
      path: [EST, 'cerramiento_soldadura_espesor'],
    }),
  };
}
