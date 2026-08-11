/* ============================================================================
   DEFAULTS TÉCNICOS CONFIRMADOS
   ----------------------------------------------------------------------------
   El paquete fuente modela algunos parámetros como `project_value` —es decir,
   dato propio de cada proyecto que debe quedar PENDIENTE mientras no se
   capture—. Para los inputs listados aquí esa decisión funcional cambió: el
   equipo los considera valores típicos estándar, así que el motor SÍ puede
   resolverlos con su default cuando el proyecto no tiene dato.

   Vive fuera de catalog/categories/*, que son transcripción literal de los
   .txt entregados: no se altera la transcripción, se declara aparte qué
   inputs cambian de semántica. Así queda explícito y auditable qué se apartó
   del archivo fuente y por qué.

   Dos capacidades:
     - habilitar el default (todas las entradas), y
     - opcionalmente SUSTITUIR el valor cuando la decisión del equipo difiere
       del que traía la memoria (`value`).

   IMPORTANTE — esto NO es una migración: el valor del proyecto siempre gana,
   y el default nunca se escribe en projects.data por abrir la pantalla.
   El resto de `project_value` (capacidades del suelo, cargas, capacidades
   portantes, dimensiones calculadas) conserva su comportamiento: PENDIENTE
   mientras esté vacío.
   ============================================================================ */

export const CONFIRMED_TECHNICAL_DEFAULTS = {
  /* Cerramiento — poste típico.
     El embebido y el afloramiento se guardan en METROS DECIMALES (sus
     resolvers los formatean como "X.XX m"), así que el default va en esa
     unidad de almacenamiento: '0.50' -> "0.50 m". Usar el "50 cm" que
     declara el catálogo daría 50 metros.
     Ambos valores están confirmados por el equipo; la longitud total se
     deriva de su suma (ver DECISION_POSTE). */
  'CERRAMIENTO_PERIMETRAL.POSTE_EMBEBIDO': { value: '0.50' },
  'CERRAMIENTO_PERIMETRAL.POSTE_AFLORAMIENTO': { value: '0.50' },
  'CERRAMIENTO_PERIMETRAL.POSTE_SEPARACION': {},

  // Cerramiento — diagonales
  'CERRAMIENTO_PERIMETRAL.DIAGONAL_LONGITUD': {},
  'CERRAMIENTO_PERIMETRAL.DIAGONAL_SEPARACION': {},

  // Cerramiento — vientos. La separación se aparta del valor de la memoria
  // (25 m): el equipo la fijó en 3.40 m.
  'CERRAMIENTO_PERIMETRAL.VIENTO_LONGITUD': {},
  'CERRAMIENTO_PERIMETRAL.VIENTO_SEPARACION': { value: '3.40 m' },

  // Cerramiento — malla y fijaciones
  'CERRAMIENTO_PERIMETRAL.FIJACION': {},

  // Cerramiento — soldadura (el espesor del PORTÓN mantiene su propia regla)
  'CERRAMIENTO_PERIMETRAL.SOLDADURA': {},

  // Portón — cimentación
  'PORTON_METALICO.REEMPLAZO_GRANULAR': {},
};

/* ----------------------------------------------------------------------------
   DECISIÓN CONFIRMADA — geometría del poste típico
   ----------------------------------------------------------------------------
   La memoria original indicaba un afloramiento de 2.50 m (longitud total
   3.00 m). El equipo confirmó posteriormente los valores del inventario
   consolidado:

       embebido 0.50 m + afloramiento 0.50 m  ->  longitud derivada 1.00 m

   Estos son los valores vigentes y los que el motor precarga. Se deja
   constancia del valor anterior únicamente para trazabilidad documental:
   NO se migra ningún proyecto y cualquier valor ya guardado sigue mandando
   sobre estos defaults.
   -------------------------------------------------------------------------- */
export const DECISION_POSTE = {
  embebido: '0.50 m',
  afloramiento: '0.50 m',
  longitudDerivada: '1.00 m',
  valorAnteriorAfloramiento: '2.50 m',
  estado: 'CONFIRMADO por el equipo; sustituye el valor de la memoria original',
};

/** ¿Este input tiene un default confirmado que el motor puede aplicar? */
export function hasConfirmedDefault(categoryId, inputKey) {
  return Object.prototype.hasOwnProperty.call(CONFIRMED_TECHNICAL_DEFAULTS, `${categoryId}.${inputKey}`);
}

/**
 * Valor por defecto efectivo de un input: el confirmado por el equipo si lo
 * hay, o el que declara el catálogo.
 */
export function effectiveDefaultFor(categoryId, inputKey, catalogDefault) {
  const confirmado = CONFIRMED_TECHNICAL_DEFAULTS[`${categoryId}.${inputKey}`];
  if (!confirmado) return catalogDefault;
  return confirmado.value !== undefined ? confirmado.value : catalogDefault;
}
