/* ============================================================================
   CAPA DE COMPATIBILIDAD LEGACY
   ----------------------------------------------------------------------------
   Adapta, SOLO EN PRESENTACIÓN, valores guardados por versiones anteriores
   del motor de Notas Técnicas cuyo formato ya no encaja con la plantilla
   actual. Nunca escribe en projects.data: el valor original permanece
   intacto y es lo que sigue viéndose (y editándose) en el formulario.

       valor almacenado original
               ↓
           resolver
               ↓
       normalizeLegacyTechnicalValue   ← esta capa
               ↓
           formatter
               ↓
       valor presentado en la nota

   Determinística, pura y sin dependencias de React, para que las
   exportaciones futuras (PDF/DOCX/planos) obtengan exactamente el mismo
   texto que la pantalla.

   CRITERIO PARA AGREGAR UNA REGLA (deliberadamente estricto):
     Solo se corrige cuando la plantilla NUEVA aporta por fuera un prefijo o
     sufijo que la plantilla ANTIGUA no tenía, de modo que el valor legacy lo
     traía incrustado y al combinarse produce texto ROTO (palabra duplicada,
     unidad duplicada).
     NO se usa esta capa para "mejorar", completar ni homogeneizar
     notaciones: un valor legacy técnicamente válido pero escrito distinto
     (ej. «Ø 2”» frente a «Ø 2 in») se respeta tal cual — cambiarlo sería
     reescribir la especificación del ingeniero, no arreglar un formato.
   ============================================================================ */

/* Reglas por "<CATEGORY_ID>.<INPUT_ID>". Cada regla declara por qué existe,
   qué detecta y cómo lo presenta. Agregar un caso legacy nuevo es agregar
   una entrada aquí — nunca un `if` dentro de un componente o un resolver. */
export const LEGACY_PRESENTATION_RULES = {
  /* La plantilla anterior decía «cinta bandit en aluminio {{CALIBRE}}», sin
     la palabra "calibre", así que el dato se guardó como «calibre 1/2”».
     La nota actual (CER-008) ya escribe «cinta bandit calibre {{BANDIT}}»,
     de modo que el valor legacy produciría «calibre calibre 1/2”». */
  'CERRAMIENTO_PERIMETRAL.BANDIT': [
    {
      id: 'bandit-prefijo-calibre-duplicado',
      motivo: 'CER-008 ya aporta la palabra "calibre"; los valores legacy la traían incrustada.',
      test: (value) => /^calibre\s+\S/i.test(value),
      apply: (value) => value.replace(/^calibre\s+/i, ''),
    },
  ],
};

/**
 * Normaliza para PRESENTACIÓN un valor almacenado. Si ninguna regla aplica
 * (el caso normal), devuelve el valor recibido sin tocarlo.
 *
 * @param {{categoryId: string, inputId: string, value: *}} args
 * @returns {*} el valor a mostrar (mismo tipo que entró si no hubo cambios)
 */
export function normalizeLegacyTechnicalValue({ categoryId, inputId, value }) {
  if (typeof value !== 'string') return value; // números, 0, false… se pasan tal cual
  const reglas = LEGACY_PRESENTATION_RULES[`${categoryId}.${inputId}`];
  if (!reglas) return value;
  return reglas.reduce((acc, regla) => (regla.test(acc) ? regla.apply(acc) : acc), value);
}

/**
 * Igual que la anterior, pero informa qué reglas se aplicaron. Pensada para
 * tests y para una futura UI de auditoría que quiera avisar "este proyecto
 * guarda un valor en formato antiguo".
 */
export function inspectLegacyValue({ categoryId, inputId, value }) {
  const original = value;
  const normalized = normalizeLegacyTechnicalValue({ categoryId, inputId, value });
  const reglas = LEGACY_PRESENTATION_RULES[`${categoryId}.${inputId}`] || [];
  const aplicadas = typeof value === 'string'
    ? reglas.filter((r) => r.test(value)).map((r) => r.id)
    : [];
  return { original, normalized, aplicadas, esLegacy: aplicadas.length > 0 };
}
