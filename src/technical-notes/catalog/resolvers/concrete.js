import { CONCRETO } from '../categories/index.js';
import { STATUS } from '../../engine.js';
import { fromCatalog, getPath, allowDefaultFor } from '../../resolverKit.js';
import { isBlank, passthrough } from '../../formatters.js';

/* Campo de SCHEMA que alimenta FC_ESTRUCTURAL según la estructura activa:
   cada cimentación del proyecto ya captura su propia resistencia en la
   pestaña Estructural, así que no se crea un campo nuevo (regla 19: una sola
   fuente de verdad).

   Antes esto apuntaba a dim_ciment_porton / dim_ciment_cerramiento / … , unos
   campos que dejaron de existir cuando las cimentaciones pasaron a ser
   plantillas: la nota CON-001 llevaba desde entonces saliendo siempre con el
   default de 21 MPa, sin importar el proyecto. Ahora lee los campos reales
   (ver camposCimentacion en dominio.jsx). */
const CIMENTACION_POR_ESTRUCTURA = {
  PORTON_METALICO: 'resistencia_cerramiento_porton',
  CERRAMIENTO_PERIMETRAL: 'resistencia_cerramiento_postes',
  SHELTER_CIMENTACION: 'resistencia_shelter_ct',
  SOPORTE_INVERSORES: 'resistencia_inversores',
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
    /* Cuál es "el campo" depende de la estructura activa, así que el enlace
       del pendiente se devuelve desde resolve() y no aquí; este es el que se
       usa si no hay contexto. */
    fieldRef: { tab: 'estructural', fieldKey: 'resistencia_cerramiento_postes' },
    resolve(data, context) {
      const fieldKey = CIMENTACION_POR_ESTRUCTURA[context?.structureType];
      const fieldRef = fieldKey ? { tab: 'estructural', fieldKey } : null;
      const raw = fieldKey ? getPath(data, ['estructural', fieldKey]) : undefined;
      if (!isBlank(raw)) {
        const value = passthrough(raw);
        return isBlank(value)
          ? { status: STATUS.INVALID, value: null, suggested, fieldRef }
          : { status: STATUS.RESOLVED_PROJECT, value, suggested, fieldRef };
      }
      return { status: STATUS.RESOLVED_DEFAULT, value: suggested, suggested, fieldRef };
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
