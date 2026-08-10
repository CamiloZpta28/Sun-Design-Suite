/* ============================================================================
   Resolvers de SHELTER_CIMENTACION.
   ----------------------------------------------------------------------------
   TODOS los inputs no sísmicos son project_value: sus defaults son
   referencias de la memoria fuente y NUNCA se adoptan automáticamente
   (regla F). Los sísmicos (AMENAZA_SISMICA, TIPO_SUELO, GRUPO_USO, I, AA,
   AV, FA, FV) están marcados excluded en la categoría, así que fromCatalog
   devuelve un resolver EXCLUDED para ellos: no piden campo, no cuentan para
   completitud, y la nota SHE-002 que los usa se filtra en el bundler.
   ============================================================================ */

import { SHELTER_CIMENTACION } from '../categories/index.js';
import { STATUS } from '../../engine.js';
import { fromCatalog, getPath } from '../../resolverKit.js';
import { isBlank, metersToMetersPhrase, sumMetersFormatted, passthrough } from '../../formatters.js';

const EST = 'estructural';

/** MICROPILOTE_TOTAL = profundidad + sobresaliente (mismo patrón que la
 *  longitud del poste de cerramiento). project_value: PENDING si falta
 *  cualquiera de los dos sumandos. */
function micropiloteTotalResolver() {
  const suggested = passthrough(SHELTER_CIMENTACION.inputs.MICROPILOTE_TOTAL.default);
  return {
    id: 'MICROPILOTE_TOTAL',
    label: 'Micropilote — longitud total (profundidad + sobresaliente)',
    fieldRef: { tab: EST, fieldKey: 'shelter_micropilote_longitud_total' },
    resolve(data) {
      const prof = getPath(data, [EST, 'shelter_micropilote_profundidad']);
      const sobre = getPath(data, [EST, 'shelter_micropilote_sobresaliente']);
      if (isBlank(prof) || isBlank(sobre)) return { status: STATUS.PENDING, value: null, suggested };
      const value = sumMetersFormatted(prof, sobre);
      return isBlank(value)
        ? { status: STATUS.INVALID, value: null, suggested }
        : { status: STATUS.RESOLVED_PROJECT, value, suggested };
    },
  };
}

export function buildShelterResolvers() {
  const cat = SHELTER_CIMENTACION;
  return {
    COTA_MINIMA: fromCatalog(cat, 'COTA_MINIMA', {
      label: 'Shelter — cota mínima sobre el nivel de referencia',
      tab: EST, fieldKey: 'shelter_cota_minima', path: [EST, 'shelter_cota_minima'],
    }),
    CALADO_ESTUDIO: fromCatalog(cat, 'CALADO_ESTUDIO', {
      label: 'Shelter — calado que exige estudio hidráulico',
      tab: EST, fieldKey: 'shelter_calado_estudio', path: [EST, 'shelter_calado_estudio'],
    }),
    BORDE_LIBRE: fromCatalog(cat, 'BORDE_LIBRE', {
      label: 'Shelter — borde libre adicional',
      tab: EST, fieldKey: 'shelter_borde_libre', path: [EST, 'shelter_borde_libre'],
    }),

    // Sísmicos: excluidos en esta fase (ver categoría; SHE-002 no se emite).
    AMENAZA_SISMICA: fromCatalog(cat, 'AMENAZA_SISMICA', { label: 'Amenaza sísmica' }),
    TIPO_SUELO: fromCatalog(cat, 'TIPO_SUELO', { label: 'Tipo de suelo (sísmico)' }),
    GRUPO_USO: fromCatalog(cat, 'GRUPO_USO', { label: 'Grupo de uso' }),
    I: fromCatalog(cat, 'I', { label: 'Coeficiente de importancia (I)' }),
    AA: fromCatalog(cat, 'AA', { label: 'Aa' }),
    AV: fromCatalog(cat, 'AV', { label: 'Av' }),
    FA: fromCatalog(cat, 'FA', { label: 'Fa' }),
    FV: fromCatalog(cat, 'FV', { label: 'Fv' }),

    MICROPILOTE_PROF: fromCatalog(cat, 'MICROPILOTE_PROF', {
      label: 'Micropilote — profundidad',
      tab: EST, fieldKey: 'shelter_micropilote_profundidad', path: [EST, 'shelter_micropilote_profundidad'],
      formatter: metersToMetersPhrase,
    }),
    MICROPILOTE_SOBRE: fromCatalog(cat, 'MICROPILOTE_SOBRE', {
      label: 'Micropilote — sobresaliente',
      tab: EST, fieldKey: 'shelter_micropilote_sobresaliente', path: [EST, 'shelter_micropilote_sobresaliente'],
      formatter: metersToMetersPhrase,
    }),
    MICROPILOTE_TOTAL: micropiloteTotalResolver(),

    COMPACTACION: fromCatalog(cat, 'COMPACTACION', {
      label: 'Shelter — compactación mínima',
      tab: EST, fieldKey: 'shelter_compactacion_minima', path: [EST, 'shelter_compactacion_minima'],
    }),
    CAP_PORTANTE: fromCatalog(cat, 'CAP_PORTANTE', {
      label: 'Shelter — capacidad portante considerada',
      tab: 'geotecnia', fieldKey: 'capacidad_portante_shelter', path: ['geotecnia', 'capacidad_portante_shelter'],
    }),

    CV_MANT: fromCatalog(cat, 'CV_MANT', {
      label: 'Shelter — carga viva de mantenimiento',
      tab: EST, fieldKey: 'shelter_carga_mantenimiento', path: [EST, 'shelter_carga_mantenimiento'],
    }),
    CV_SOBRE: fromCatalog(cat, 'CV_SOBRE', {
      label: 'Shelter — sobrecarga',
      tab: EST, fieldKey: 'shelter_carga_sobrecarga', path: [EST, 'shelter_carga_sobrecarga'],
    }),
    CM_TOTAL: fromCatalog(cat, 'CM_TOTAL', {
      label: 'Shelter — carga muerta total',
      tab: EST, fieldKey: 'shelter_carga_muerta_total', path: [EST, 'shelter_carga_muerta_total'],
    }),
    VIENTO: fromCatalog(cat, 'VIENTO', {
      label: 'Shelter — carga de viento',
      tab: EST, fieldKey: 'shelter_carga_viento', path: [EST, 'shelter_carga_viento'],
    }),
  };
}
