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
  TUBERIA_GALVANIZADA: [
    { value: CERRAMIENTO_PERIMETRAL.inputs.POSTE_DIAMETRO.default, scope: 'CERRAMIENTO_PERIMETRAL' },
    { value: CERRAMIENTO_PERIMETRAL.inputs.POSTE_ESPESOR.default, scope: 'CERRAMIENTO_PERIMETRAL' },
    { value: CERRAMIENTO_PERIMETRAL.inputs.DIAGONAL_DIAMETRO.default, scope: 'CERRAMIENTO_PERIMETRAL' },
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
