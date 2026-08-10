import { CONCRETO } from '../categories/index.js';
import { STATUS } from '../../engine.js';
import { fromCatalog, getPath, allowDefaultFor } from '../../resolverKit.js';
import { isBlank, passthrough } from '../../formatters.js';

/* Cimentación de SCHEMA que alimenta FC_ESTRUCTURAL según la estructura
   activa: cada estructura ya captura la resistencia de SU cimentación en la
   pestaña Estructural, así que no se crea un campo nuevo (regla 19: una sola
   fuente de verdad). Portón y cerramiento reutilizan sus dim_ciment_*;
   soporte de inversores usa dim_ciment_inversores; shelter, dim_ciment_shelter. */
const CIMENTACION_POR_ESTRUCTURA = {
  PORTON_METALICO: 'dim_ciment_porton',
  CERRAMIENTO_PERIMETRAL: 'dim_ciment_cerramiento',
  SHELTER_CIMENTACION: 'dim_ciment_shelter',
  SOPORTE_INVERSORES: 'dim_ciment_inversores',
};

/** FC_ESTRUCTURAL es el único parámetro dependiente del contexto: lee la
 *  resistencia de la cimentación de la estructura activa. Es
 *  repository_select en el catálogo, así que sí admite caer al default
 *  (21 MPa) cuando esa cimentación todavía no tiene resistencia definida. */
function fcEstructuralResolver() {
  const input = CONCRETO.inputs.FC_ESTRUCTURAL;
  const suggested = passthrough(input.default);
  return {
    id: 'FC_ESTRUCTURAL',
    label: "Concreto estructural — f'c",
    fieldRef: { tab: 'estructural', fieldKey: 'dim_ciment_cerramiento' },
    resolve(data, context) {
      const fieldKey = CIMENTACION_POR_ESTRUCTURA[context?.structureType];
      const raw = fieldKey ? getPath(data, ['estructural', fieldKey, 'resistencia']) : undefined;
      if (!isBlank(raw)) {
        const value = passthrough(raw);
        return isBlank(value)
          ? { status: STATUS.INVALID, value: null, suggested }
          : { status: STATUS.RESOLVED_PROJECT, value, suggested };
      }
      return { status: STATUS.RESOLVED_DEFAULT, value: suggested, suggested };
    },
  };
}

export function buildConcretoResolvers() {
  return {
    FC_ESTRUCTURAL: fcEstructuralResolver(),

    // Reutiliza los campos que ya existían para las notas de cerramiento
    // (no se duplican: son globales de concreto, no exclusivos de cerramiento).
    FC_SOLADO: fromCatalog(CONCRETO, 'FC_SOLADO', {
      label: "Concreto de solado — f'c",
      tab: 'estructural',
      fieldKey: 'concreto_solado_fc',
      path: ['estructural', 'concreto_solado_fc'],
    }),
    ESPESOR_SOLADO: fromCatalog(CONCRETO, 'ESPESOR_SOLADO', {
      label: 'Concreto de solado — espesor',
      tab: 'estructural',
      fieldKey: 'concreto_solado_espesor',
      path: ['estructural', 'concreto_solado_espesor'],
    }),

    ACERO_FY: fromCatalog(CONCRETO, 'ACERO_FY', {
      label: 'Acero de refuerzo — fy',
      tab: 'estructural',
      fieldKey: 'acero_refuerzo_fy',
      path: ['estructural', 'acero_refuerzo_fy'],
    }),
    AGREGADO_MAX: fromCatalog(CONCRETO, 'AGREGADO_MAX', {
      label: 'Agregados — tamaño máximo nominal',
      tab: 'estructural',
      fieldKey: 'agregado_tamano_max',
      path: ['estructural', 'agregado_tamano_max'],
    }),
    RELACION_AC_MAX: fromCatalog(CONCRETO, 'RELACION_AC_MAX', {
      label: 'Relación agua/cemento máxima',
      tab: 'estructural',
      fieldKey: 'relacion_agua_cemento_max',
      path: ['estructural', 'relacion_agua_cemento_max'],
    }),
    REC_TIERRA: fromCatalog(CONCRETO, 'REC_TIERRA', {
      label: 'Recubrimiento — elementos en contacto con tierra',
      tab: 'estructural',
      fieldKey: 'recubrimiento_tierra',
      path: ['estructural', 'recubrimiento_tierra'],
    }),
    REC_NO_TIERRA: fromCatalog(CONCRETO, 'REC_NO_TIERRA', {
      label: 'Recubrimiento — elementos sin contacto con tierra',
      tab: 'estructural',
      fieldKey: 'recubrimiento_no_tierra',
      path: ['estructural', 'recubrimiento_no_tierra'],
    }),
  };
}

export { CIMENTACION_POR_ESTRUCTURA, allowDefaultFor };
