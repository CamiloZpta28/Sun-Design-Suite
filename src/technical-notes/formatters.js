/* ============================================================================
   FORMATTERS — convierten un valor tal como se almacena en projects.data a
   la forma textual que necesita una nota técnica. Puros (sin estado, sin
   acceso a projects.data): reciben un valor y devuelven texto o null.

   Regla general (ver análisis del módulo): la mayoría de los campos nuevos
   de Notas Técnicas se guardan ya en su forma final de texto libre (ej. el
   usuario escribe "Ø 2”" directamente) — para esos casos el formatter es un
   simple passthrough, evitando inventar conversiones de unidades no
   solicitadas (ej. no se intenta convertir números a fracciones en pulgadas).

   La única conversión real de unidades es la de los campos que se guardan en
   metros decimales (dim_ciment_*, cerramiento_poste_anclaje/afloramiento,
   shelter_micropilote_*, igual convención en toda la pestaña Estructural) —
   ahí sí hace falta un formatter porque las notas piden centímetros/metros
   con texto.
   ============================================================================ */

/** Determina si un valor debe tratarse como "no definido" (independiente de tipo). */
export function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** Passthrough: usa el texto tal como el usuario lo escribió, solo recorta espacios. */
export function passthrough(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

/** Convierte un número (como texto o número) a una cadena sin decimales
 *  innecesarios, ej. 30 -> "30", 32.50 -> "32.5". */
function trimNumber(n) {
  return Number(n.toFixed(2)).toString();
}

/** metros (texto decimal, ej. "0.50") -> centímetros sin sufijo, ej. "50 cm". */
export function metersToCm(value) {
  if (isBlank(value)) return null;
  const meters = parseFloat(value);
  if (Number.isNaN(meters)) return null;
  return `${trimNumber(meters * 100)} cm`;
}

/** metros (texto decimal) -> "X.XX m", ej. "2.5" -> "2.50 m". */
export function metersToMetersPhrase(value) {
  if (isBlank(value)) return null;
  const meters = parseFloat(value);
  if (Number.isNaN(meters)) return null;
  return `${meters.toFixed(2)} m`;
}

/** Suma dos longitudes en metros (texto decimal) y formatea "X.XX m".
 *  Única fuente de esta fórmula: la usan tanto campos `computed` de SCHEMA
 *  (ej. cerramiento_poste_longitud_total, shelter_micropilote_longitud_total
 *  en src/App.jsx) como los resolvers DERIVADOS de los mismos IDs en
 *  catalog/resolvers/*.js, para no mantener la misma cuenta en dos sitios.
 *  Devuelve null (no 0.00 m) si algún operando falta, para que quien llama
 *  pueda distinguir "faltan datos" de "la suma da cero". */
export function sumMetersFormatted(a, b) {
  if (isBlank(a) || isBlank(b)) return null;
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return null;
  return `${(na + nb).toFixed(2)} m`;
}
