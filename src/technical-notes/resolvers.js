/* ============================================================================
   PARAMETER_RESOLVERS — mapa declarativo: ID del catálogo -> cómo obtener su
   valor a partir de projects.data (o de una constante fija), y cómo
   formatearlo para la nota. Ningún componente visual necesita saber de
   dónde sale cada dato: solo llama a engine.resolveParameter(id, data).

   Cada resolver es: { id, label, fieldRef, resolve(data) }
     - label:     texto humano para "falta definir …" en la UI.
     - fieldRef:  { tab, fieldKey } de SCHEMA para el botón "Ir al campo",
                  o null si el parámetro no corresponde a un único campo
                  editable (ninguno de los de cerramiento cae en ese caso).
     - resolve(data): recibe projects.data completo y devuelve
                  { status: 'RESUELTO'|'FALTANTE'|'INVALIDO', value }.

   "data" es siempre projects.data (el mismo objeto que ya vive en el estado
   de React de App/ProjectDetail) — nunca se lee nada fuera de ese objeto,
   así que cualquier cambio de campo se refleja de inmediato sin round-trip a
   Supabase.
   ============================================================================ */

import { isBlank, passthrough, metersToCm, metersToCmPhrase, metersToMetersPhrase, soladoAdicionalPhrase, sumMetersFormatted } from './formatters.js';

function getPath(data, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

/** Resolver de un campo simple: lee `path` dentro de projects.data y lo
 *  pasa por `formatter`. FALTANTE si el valor crudo está vacío; INVALIDO si
 *  hay un valor pero el formatter no pudo interpretarlo (ej. texto no
 *  numérico donde se esperaba un número). */
function directField({ id, label, tab, fieldKey, path, formatter = passthrough }) {
  return {
    id,
    label,
    fieldRef: { tab, fieldKey },
    resolve(data) {
      const raw = getPath(data, path);
      if (isBlank(raw)) return { status: 'FALTANTE', value: null };
      const value = formatter(raw);
      if (isBlank(value)) return { status: 'INVALIDO', value: null };
      return { status: 'RESUELTO', value };
    },
  };
}

/** Resolver constante: valor fijo, no proviene de projects.data. Reservado
 *  para futuros parámetros que el análisis determine como "criterio
 *  constructivo general" en vez de dato de proyecto — no se usa en el
 *  catálogo actual de cerramiento (los tres candidatos a constante
 *  — concreto de solado y norma de acero de refuerzo — se implementaron
 *  como campos de proyecto por decisión explícita). Se deja disponible para
 *  no tener que rediseñar el motor si un futuro parámetro sí lo necesita. */
export function constantValue({ id, label, value }) {
  return {
    id,
    label,
    fieldRef: null,
    resolve() {
      return isBlank(value) ? { status: 'FALTANTE', value: null } : { status: 'RESUELTO', value };
    },
  };
}

const ESTRUCTURAL = ['estructural'];
const GEOTECNIA = ['geotecnia'];

export const CERRAMIENTO_PERIMETRAL_RESOLVERS = {
  GEOTECNIA_CERRAMIENTO_CAPACIDAD_ADMISIBLE: directField({
    id: 'GEOTECNIA_CERRAMIENTO_CAPACIDAD_ADMISIBLE',
    label: 'Capacidad admisible del suelo (cimentación cerramiento)',
    tab: 'geotecnia',
    fieldKey: 'capacidad_admisible_cerramiento',
    path: [...GEOTECNIA, 'capacidad_admisible_cerramiento'],
  }),

  CONCRETO_SOLADO_FC: directField({
    id: 'CONCRETO_SOLADO_FC',
    label: "Concreto de solado — f'c",
    tab: 'estructural',
    fieldKey: 'concreto_solado_fc',
    path: [...ESTRUCTURAL, 'concreto_solado_fc'],
  }),

  CONCRETO_SOLADO_ESPESOR: directField({
    id: 'CONCRETO_SOLADO_ESPESOR',
    label: 'Concreto de solado — espesor mínimo',
    tab: 'estructural',
    fieldKey: 'concreto_solado_espesor',
    path: [...ESTRUCTURAL, 'concreto_solado_espesor'],
  }),

  /* DERIVADO: no pide un campo propio — reutiliza concreto_solado_espesor.
     Ver catalog.js: esta relación no está declarada como DERIVAR_DATO en el
     archivo fuente, es una inferencia de esta implementación para no volver
     a preguntar el mismo espesor dos veces. */
  CERRAMIENTO_SOLADO_ADICIONAL: {
    id: 'CERRAMIENTO_SOLADO_ADICIONAL',
    label: 'Espesor de solado adicional bajo el pedestal (deriva de "Concreto de solado — espesor mínimo")',
    fieldRef: { tab: 'estructural', fieldKey: 'concreto_solado_espesor' },
    resolve(data) {
      const raw = getPath(data, [...ESTRUCTURAL, 'concreto_solado_espesor']);
      if (isBlank(raw)) return { status: 'FALTANTE', value: null };
      const value = soladoAdicionalPhrase(raw);
      return isBlank(value) ? { status: 'INVALIDO', value: null } : { status: 'RESUELTO', value };
    },
  },

  CERRAMIENTO_PEDESTAL_DIAMETRO: directField({
    id: 'CERRAMIENTO_PEDESTAL_DIAMETRO',
    label: 'Diámetro del pedestal de cimentación del cerramiento',
    tab: 'estructural',
    fieldKey: 'dim_ciment_cerramiento',
    path: [...ESTRUCTURAL, 'dim_ciment_cerramiento', 'diametro'],
    formatter: (raw) => metersToCmPhrase(raw, 'de diámetro'),
  }),

  CERRAMIENTO_PEDESTAL_DESPLANTE: directField({
    id: 'CERRAMIENTO_PEDESTAL_DESPLANTE',
    label: 'Desplante del pedestal de cimentación del cerramiento',
    tab: 'estructural',
    fieldKey: 'dim_ciment_cerramiento',
    path: [...ESTRUCTURAL, 'dim_ciment_cerramiento', 'desplante'],
    formatter: (raw) => metersToCmPhrase(raw, 'de desplante'),
  }),

  CONCRETO_ESTRUCTURAL_FC: directField({
    id: 'CONCRETO_ESTRUCTURAL_FC',
    label: "Resistencia del concreto (f'c) de la cimentación del cerramiento",
    tab: 'estructural',
    fieldKey: 'dim_ciment_cerramiento',
    path: [...ESTRUCTURAL, 'dim_ciment_cerramiento', 'resistencia'],
  }),

  ACERO_REFUERZO_NORMA: directField({
    id: 'ACERO_REFUERZO_NORMA',
    label: 'Acero de refuerzo — norma',
    tab: 'estructural',
    fieldKey: 'acero_refuerzo_norma',
    path: [...ESTRUCTURAL, 'acero_refuerzo_norma'],
  }),

  CERRAMIENTO_POSTE_DIAMETRO: directField({
    id: 'CERRAMIENTO_POSTE_DIAMETRO',
    label: 'Poste típico — diámetro nominal',
    tab: 'estructural',
    fieldKey: 'cerramiento_poste_diametro',
    path: [...ESTRUCTURAL, 'cerramiento_poste_diametro'],
  }),

  CERRAMIENTO_POSTE_ESPESOR: directField({
    id: 'CERRAMIENTO_POSTE_ESPESOR',
    label: 'Poste típico — espesor',
    tab: 'estructural',
    fieldKey: 'cerramiento_poste_espesor',
    path: [...ESTRUCTURAL, 'cerramiento_poste_espesor'],
  }),

  /* anclaje y afloramiento se guardan en metros decimales (igual convención
     que dim_ciment_*), no como texto libre ya formateado: así la nota
     LONGITUD_TOTAL puede sumarlos de forma confiable en vez de intentar
     sumar texto con unidades mixtas. */
  CERRAMIENTO_POSTE_ANCLAJE: directField({
    id: 'CERRAMIENTO_POSTE_ANCLAJE',
    label: 'Poste típico — anclaje',
    tab: 'estructural',
    fieldKey: 'cerramiento_poste_anclaje',
    path: [...ESTRUCTURAL, 'cerramiento_poste_anclaje'],
    formatter: metersToCm,
  }),

  CERRAMIENTO_POSTE_AFLORAMIENTO: directField({
    id: 'CERRAMIENTO_POSTE_AFLORAMIENTO',
    label: 'Poste típico — afloramiento',
    tab: 'estructural',
    fieldKey: 'cerramiento_poste_afloramiento',
    path: [...ESTRUCTURAL, 'cerramiento_poste_afloramiento'],
    formatter: metersToMetersPhrase,
  }),

  /* DERIVADO: computado a partir de anclaje + afloramiento, misma fórmula
     que el campo `computed` de SCHEMA (sumMetersFormatted, en
     formatters.js) — una sola fuente de verdad para la suma. */
  CERRAMIENTO_POSTE_LONGITUD_TOTAL: {
    id: 'CERRAMIENTO_POSTE_LONGITUD_TOTAL',
    label: 'Poste típico — longitud total (anclaje + afloramiento)',
    fieldRef: { tab: 'estructural', fieldKey: 'cerramiento_poste_longitud_total' },
    resolve(data) {
      const anclaje = getPath(data, [...ESTRUCTURAL, 'cerramiento_poste_anclaje']);
      const afloramiento = getPath(data, [...ESTRUCTURAL, 'cerramiento_poste_afloramiento']);
      if (isBlank(anclaje) || isBlank(afloramiento)) return { status: 'FALTANTE', value: null };
      const value = sumMetersFormatted(anclaje, afloramiento);
      return isBlank(value) ? { status: 'INVALIDO', value: null } : { status: 'RESUELTO', value };
    },
  },

  CERRAMIENTO_POSTE_SEPARACION: directField({
    id: 'CERRAMIENTO_POSTE_SEPARACION',
    label: 'Poste típico — separación entre postes',
    tab: 'estructural',
    fieldKey: 'cerramiento_poste_separacion',
    path: [...ESTRUCTURAL, 'cerramiento_poste_separacion'],
  }),

  CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO: directField({
    id: 'CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO',
    label: 'Diagonales y vientos — diámetro nominal',
    tab: 'estructural',
    fieldKey: 'cerramiento_tubo_secundario_diametro',
    path: [...ESTRUCTURAL, 'cerramiento_tubo_secundario_diametro'],
  }),

  CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR: directField({
    id: 'CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR',
    label: 'Diagonales y vientos — espesor',
    tab: 'estructural',
    fieldKey: 'cerramiento_tubo_secundario_espesor',
    path: [...ESTRUCTURAL, 'cerramiento_tubo_secundario_espesor'],
  }),

  CERRAMIENTO_DIAGONALES_SEPARACION: directField({
    id: 'CERRAMIENTO_DIAGONALES_SEPARACION',
    label: 'Separación entre diagonales',
    tab: 'estructural',
    fieldKey: 'cerramiento_diagonales_separacion',
    path: [...ESTRUCTURAL, 'cerramiento_diagonales_separacion'],
  }),

  CERRAMIENTO_VIENTOS_SEPARACION: directField({
    id: 'CERRAMIENTO_VIENTOS_SEPARACION',
    label: 'Separación entre vientos',
    tab: 'estructural',
    fieldKey: 'cerramiento_vientos_separacion',
    path: [...ESTRUCTURAL, 'cerramiento_vientos_separacion'],
  }),

  CERRAMIENTO_BANDIT_CALIBRE: directField({
    id: 'CERRAMIENTO_BANDIT_CALIBRE',
    label: 'Calibre de la cinta bandit',
    tab: 'estructural',
    fieldKey: 'cerramiento_bandit_calibre',
    path: [...ESTRUCTURAL, 'cerramiento_bandit_calibre'],
  }),

  CERRAMIENTO_ACERO_NORMA: directField({
    id: 'CERRAMIENTO_ACERO_NORMA',
    label: 'Perfilería del cerramiento — norma del acero',
    tab: 'estructural',
    fieldKey: 'cerramiento_acero_norma',
    path: [...ESTRUCTURAL, 'cerramiento_acero_norma'],
  }),

  CERRAMIENTO_ACERO_FY: directField({
    id: 'CERRAMIENTO_ACERO_FY',
    label: 'Perfilería del cerramiento — esfuerzo de fluencia (Fy)',
    tab: 'estructural',
    fieldKey: 'cerramiento_acero_fy',
    path: [...ESTRUCTURAL, 'cerramiento_acero_fy'],
  }),

  CERRAMIENTO_ACERO_FU: directField({
    id: 'CERRAMIENTO_ACERO_FU',
    label: 'Perfilería del cerramiento — esfuerzo último (Fu)',
    tab: 'estructural',
    fieldKey: 'cerramiento_acero_fu',
    path: [...ESTRUCTURAL, 'cerramiento_acero_fu'],
  }),

  GALVANIZADO_CLASE: directField({
    id: 'GALVANIZADO_CLASE',
    label: 'Tipo de galvanizado',
    tab: 'estructural',
    fieldKey: 'tipo_galvanizado',
    path: [...ESTRUCTURAL, 'tipo_galvanizado'],
  }),

  AMBIENTE_CORROSION_CLASE: directField({
    id: 'AMBIENTE_CORROSION_CLASE',
    label: 'Clase de ambiente de corrosión',
    tab: 'estructural',
    fieldKey: 'ambiente_corrosion_clase',
    path: [...ESTRUCTURAL, 'ambiente_corrosion_clase'],
  }),

  GALVANIZADO_PERDIDA_ZINC_PROYECTADA: directField({
    id: 'GALVANIZADO_PERDIDA_ZINC_PROYECTADA',
    label: 'Pérdida de zinc proyectada (vida útil del galvanizado)',
    tab: 'estructural',
    fieldKey: 'galvanizado_perdida_zinc_proyectada',
    path: [...ESTRUCTURAL, 'galvanizado_perdida_zinc_proyectada'],
  }),
};
