/* ============================================================================
   REPOSITORIO DE VALORES TÉCNICOS — opciones seleccionables por grupo, CON
   SCOPE por estructura.
   ----------------------------------------------------------------------------
   Regla 9 del encargo: dos estructuras pueden compartir el nombre de un
   grupo (ej. "ACERO_ESTRUCTURAL") sin compartir sus opciones. El acero del
   portón (ASTM A500 Grado C) NO debe ofrecerse al cerramiento y viceversa.
   Por eso cada opción declara su `scope`:
       GLOBAL                -> visible desde cualquier estructura
       <STRUCTURE_ID>        -> visible solo dentro de esa estructura

   Las opciones se derivan del `default` declarado en cada categoría del
   catálogo (única fuente de los valores; ver catalog/categories/*): este
   módulo NO reescribe valores, solo los indexa por grupo+scope y deja el
   lugar donde agregar más opciones estándar en el futuro (regla: "sin
   reconstruir el componente").

   El componente de UI nunca hardcodea listas: pide
   optionsFor(group, structureType) y recibe las opciones válidas.
   ============================================================================ */

import { CONCRETO } from './catalog/categories/concrete.js';
import { METAL } from './catalog/categories/metal.js';
import { PORTON_METALICO } from './catalog/categories/portonMetalico.js';
import { CERRAMIENTO_PERIMETRAL } from './catalog/categories/cerramientoPerimetral.js';
import { IMPERMEABILIZACION_JUNTAS } from './catalog/categories/impermeabilizacionJuntas.js';

export const SCOPE_GLOBAL = 'GLOBAL';

/** { group: [{ value, scope }] }. Un mismo group puede tener opciones de
 *  varios scopes; optionsFor() filtra por la estructura activa. */
export const TECHNICAL_VALUE_REPOSITORY = {
  CONCRETO: [
    { value: CONCRETO.inputs.FC_ESTRUCTURAL.default, scope: SCOPE_GLOBAL },
    { value: CONCRETO.inputs.FC_SOLADO.default, scope: SCOPE_GLOBAL },
  ],
  ACERO_REFUERZO: [
    { value: CONCRETO.inputs.ACERO_FY.default, scope: SCOPE_GLOBAL },
  ],
  /* Grupo propio, separado de ACERO_REFUERZO (que contiene esfuerzos de
     fluencia): norma y fy son datos independientes y no deben forzarse
     mutuamente, así que tampoco deben aparecer mezclados en el mismo
     desplegable. Ver STANDALONE_TECHNICAL_VALUES. */
  ACERO_REFUERZO_NORMA: [
    { value: 'ASTM A706', scope: SCOPE_GLOBAL },
  ],
  AGREGADOS: [
    { value: CONCRETO.inputs.AGREGADO_MAX.default, scope: SCOPE_GLOBAL },
  ],
  GALVANIZADO: [
    { value: METAL.inputs.GALVANIZADO.default, scope: SCOPE_GLOBAL },
  ],
  /* Aislamiento explícito: cada norma de acero pertenece a SU estructura. */
  ACERO_ESTRUCTURAL: [
    { value: PORTON_METALICO.inputs.ACERO.default, scope: 'PORTON_METALICO' },
    { value: CERRAMIENTO_PERIMETRAL.inputs.ACERO.default, scope: 'CERRAMIENTO_PERIMETRAL' },
  ],
  PERFILES: [
    { value: PORTON_METALICO.inputs.PERFIL.default, scope: 'PORTON_METALICO' },
  ],
  /* El paquete fuente agrupa toda la tubería del cerramiento bajo un único
     "TUBERIA_GALVANIZADA", lo que mezclaría magnitudes distintas en el mismo
     desplegable (un campo de diámetro ofrecería espesores y viceversa). Se
     separa por magnitud — ver INPUT_GROUP_OVERRIDES, que es donde se decide
     qué grupo consume cada input sin alterar la transcripción del catálogo.

     Diámetros y espesores NO se sub-dividen además por elemento (poste vs.
     diagonal): un poste Ø 1 1/2" o una diagonal Ø 2" son combinaciones
     técnicamente válidas, solo distintas del valor típico de la memoria.
     Separar más obligaría a escribir "Otro" para usar un valor que ya está
     en el catálogo. Lo que sí es incompatible —un diámetro en milímetros de
     pared— queda impedido. */
  TUBERIA_GALVANIZADA_DIAMETRO: [
    { value: CERRAMIENTO_PERIMETRAL.inputs.POSTE_DIAMETRO.default, scope: 'CERRAMIENTO_PERIMETRAL' },
    { value: CERRAMIENTO_PERIMETRAL.inputs.DIAGONAL_DIAMETRO.default, scope: 'CERRAMIENTO_PERIMETRAL' },
  ],
  TUBERIA_GALVANIZADA_ESPESOR: [
    { value: CERRAMIENTO_PERIMETRAL.inputs.POSTE_ESPESOR.default, scope: 'CERRAMIENTO_PERIMETRAL' },
    { value: CERRAMIENTO_PERIMETRAL.inputs.DIAGONAL_ESPESOR.default, scope: 'CERRAMIENTO_PERIMETRAL' },
  ],
  MALLA: [
    { value: CERRAMIENTO_PERIMETRAL.inputs.MALLA.default, scope: 'CERRAMIENTO_PERIMETRAL' },
  ],
  ACCESORIOS: [
    { value: CERRAMIENTO_PERIMETRAL.inputs.BANDIT.default, scope: 'CERRAMIENTO_PERIMETRAL' },
  ],
  IMPERMEABILIZACION: [
    { value: IMPERMEABILIZACION_JUNTAS.inputs.IMPERMEABILIZANTE.default, scope: SCOPE_GLOBAL },
  ],
  JUNTAS: [
    { value: IMPERMEABILIZACION_JUNTAS.inputs.PUENTE_ADHERENCIA.default, scope: SCOPE_GLOBAL },
    { value: IMPERMEABILIZACION_JUNTAS.inputs.SELLO_HIDROEXPANSIVO.default, scope: SCOPE_GLOBAL },
  ],
};

/* ----------------------------------------------------------------------------
   ESPECIALIZACIÓN DE GRUPOS POR INPUT
   ----------------------------------------------------------------------------
   Los archivos de catalog/categories/* son transcripción literal de los .txt
   entregados, así que el `group` que declaran no se modifica. Cuando ese
   grupo es demasiado amplio y mezclaría magnitudes incompatibles en un mismo
   desplegable, se declara aquí qué grupo consume realmente cada input.

   Clave: "<CATEGORY_ID>.<INPUT_KEY>". Si no hay entrada, se usa el grupo tal
   como lo declara el catálogo.
   -------------------------------------------------------------------------- */
export const INPUT_GROUP_OVERRIDES = {
  'CERRAMIENTO_PERIMETRAL.POSTE_DIAMETRO': 'TUBERIA_GALVANIZADA_DIAMETRO',
  'CERRAMIENTO_PERIMETRAL.DIAGONAL_DIAMETRO': 'TUBERIA_GALVANIZADA_DIAMETRO',
  'CERRAMIENTO_PERIMETRAL.POSTE_ESPESOR': 'TUBERIA_GALVANIZADA_ESPESOR',
  'CERRAMIENTO_PERIMETRAL.DIAGONAL_ESPESOR': 'TUBERIA_GALVANIZADA_ESPESOR',
};

/** Grupo efectivo del que un input toma sus opciones. */
export function groupForInput(categoryId, inputKey, declaredGroup) {
  return INPUT_GROUP_OVERRIDES[`${categoryId}.${inputKey}`] || declaredGroup;
}

/**
 * Opciones que debe ofrecer el desplegable de un input del catálogo.
 *
 * Los tipos `number`, `number_unit` y `repository_value` no declaran `group`,
 * así que el repositorio no tiene entradas para ellos. Sin este respaldo el
 * campo quedaba como un desplegable VACÍO: el default existía pero no había
 * ninguna opción que lo mostrara, y en pantalla se veía en blanco. En ese
 * caso su propio valor de catálogo es la única opción conocida — y "Otro"
 * sigue permitiendo apartarse de él.
 *
 * @param {object} input - input tal como lo declara la categoría
 * @param {string} categoryId
 * @param {string} inputKey
 * @param {string} [structureScope] - estructura dueña, para el aislamiento
 * @returns {string[]}
 */
export function selectableOptionsFor(input, categoryId, inputKey, structureScope) {
  if (input.options) return input.options;
  const delRepositorio = optionsFor(groupForInput(categoryId, inputKey, input.group), structureScope || categoryId);
  if (delRepositorio.length > 0) return delRepositorio;
  return input.default != null ? [input.default] : [];
}

/* ----------------------------------------------------------------------------
   VALORES TÉCNICOS SIN NOTA ASOCIADA
   ----------------------------------------------------------------------------
   Datos reutilizables que hoy NO tienen placeholder en ninguna categoría del
   paquete fuente, pero que el proyecto sí captura y que deben comportarse
   como cualquier otro valor de repositorio (desplegable + "Otro" + default
   sugerido, sin sobrescribir lo guardado).

   Viven aquí y no dentro de catalog/categories/* porque esos módulos son
   transcripción literal de los .txt entregados: agregarles un input que el
   archivo fuente no declara rompería esa correspondencia. Si una memoria
   futura introduce el placeholder correspondiente, el valor se mueve a la
   categoría y este registro desaparece sin tocar la UI.
   -------------------------------------------------------------------------- */
export const STANDALONE_TECHNICAL_VALUES = {
  /* Norma del acero de refuerzo. La nota CON-003 del catálogo actual solo
     interpola fy ({{ACERO_FY}}), así que este dato todavía no alimenta
     ninguna nota — pero es un parámetro técnico reutilizable que los
     proyectos ya venían capturando con el motor anterior. Valor inicial
     tomado de las memorias: ASTM A706. */
  ACERO_REFUERZO_NORMA: {
    fieldKey: 'acero_refuerzo_norma',
    group: 'ACERO_REFUERZO_NORMA',
    defaultValue: 'ASTM A706',
  },
};

/**
 * Opciones válidas de un grupo para una estructura dada: las globales más
 * las de esa misma estructura. Nunca devuelve opciones de otra estructura.
 */
export function optionsFor(group, structureType) {
  const entries = TECHNICAL_VALUE_REPOSITORY[group] || [];
  return entries
    .filter((e) => e.scope === SCOPE_GLOBAL || e.scope === structureType)
    .map((e) => e.value);
}
