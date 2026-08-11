/* ============================================================================
   NORMALIZACION DE TEXTO TECNICO
   ----------------------------------------------------------------------------
   Los valores que el ingeniero pega desde Word, Excel o un PDF suelen traer
   espacios Unicode invisibles (NBSP, narrow NBSP, thin space, zero-width...) y
   finales de linea CRLF. Se ven bien en el equipo donde se pegaron y se
   rompen -o desaparecen- en otro, o al copiar las notas a AutoCAD.

   Este modulo deja todo en la forma portable acordada: UTF-8 NFC, saltos LF
   y espacio normal U+0020.

   ALCANCE - solo texto que se PRESENTA:
     - valores de proyecto antes de entrar a una nota,
     - defaults del catalogo,
     - el texto consolidado que se muestra y se copia.
   NUNCA se aplica a identificadores (note_id, fieldKey, category_id,
   structureType): esos son claves, no texto, y normalizarlos podria romper
   busquedas o navegacion.

   NO ascii-fica: los simbolos tecnicos legitimos se conservan intactos
   (diametro, grados, potencias, micras, comillas tipograficas). El objetivo
   es el whitespace, no el contenido.
   ============================================================================ */

/* Los caracteres se declaran con escapes \uXXXX A PROPOSITO: incluirlos de
   forma literal reintroduciria en este mismo archivo el problema que el
   modulo resuelve, y serian invisibles para quien revise el codigo. */

/* Espacios Unicode que se sustituyen por un espacio normal U+0020: NBSP,
   ogham, los espacios de imprenta (en/em quad, en/em, three/four/six per em,
   figure, punctuation, thin, hair), narrow NBSP, medium math y el espacio
   ideografico. */
const ESPACIOS_UNICODE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/* Ancho cero e invisibles: NO ocupan espacio, asi que se ELIMINAN. Ponerles
   un espacio anadiria una separacion que el original no tenia.
   ZWSP, ZWNJ, ZWJ, word joiner y BOM. */
const ANCHO_CERO = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

/**
 * Normaliza texto tecnico para presentacion. Determinista e idempotente:
 * aplicarlo dos veces da el mismo resultado, y ese resultado no depende del
 * sistema operativo.
 *
 * @param {*} text - si no es string se devuelve tal cual (numeros, 0, false...)
 * @returns {*}
 */
export function normalizeTechnicalText(text) {
  if (typeof text !== 'string') return text;
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')      // CRLF y CR sueltos -> LF
    .replace(ANCHO_CERO, '')
    .replace(ESPACIOS_UNICODE, ' ')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')       // colapsa espacios repetidos (no toca los \n)
    .replace(/ +\n/g, '\n')       // sin espacios colgando al final de linea
    .replace(/\n +/g, '\n');      // ni sangria accidental al inicio
}

/** Whitespace que no deberia sobrevivir a la normalizacion. Se exporta para
 *  que los tests puedan auditar cualquier salida del sistema. */
export const WHITESPACE_PROHIBIDO = [
  '\u00A0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004',
  '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u202F',
  '\u205F', '\u3000', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF',
  '\t', '\r',
];

/** Contiene este texto algun whitespace problematico? Util en tests y para
 *  una futura auditoria de los datos ya guardados. */
export function tieneWhitespaceProblematico(text) {
  if (typeof text !== 'string') return false;
  return WHITESPACE_PROHIBIDO.some((ch) => text.includes(ch));
}
