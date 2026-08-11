/* ============================================================================
   TEXTO PLANO DE LAS NOTAS TÉCNICAS
   ----------------------------------------------------------------------------
   Construye la salida consolidada lista para copiar y pegar en AutoCAD, Word,
   Excel o correo. Es una vista DERIVADA: se recalcula siempre a partir de las
   notas ya resueltas y nunca se persiste en projects.data (ver regla "el
   textarea no es fuente de verdad").

   Formato compacto — una nota por línea, sin líneas vacías entre notas
   consecutivas, y una sola línea en blanco entre el final de una sección y
   el título de la siguiente:

       GENERALIDADES
       1. Las dimensiones están dadas en metros…
       2. Todas las dimensiones…
       3. Cualquier modificación…

       CONCRETO
       4. El concreto estructural…

   - Numeración continua (1…N), la misma que se ve en pantalla.
   - Títulos de sección legibles en mayúsculas; NUNCA los note_id internos
     (GEN-001, CER-004…), que se conservan solo dentro del motor.
   - Sin badges, HTML, iconos ni metadatos: texto plano puro.
   - Los parámetros pendientes se mantienen visibles tal como se muestran en
     pantalla ("⚠ Pendiente: <etiqueta>") — no se inventa el valor sugerido.
   ============================================================================ */

/* Títulos de presentación por categoría. Viven aquí y no en
   catalog/categories/*, que son transcripción literal de los archivos
   fuente: el `label` de esos módulos es descriptivo y largo (ej. "Concreto:
   materiales, control, colocación y curado"), poco práctico como encabezado
   al pegar las notas en un plano. */
import { normalizeTechnicalText } from './textNormalization.js';

const SECTION_TITLES = {
  GENERAL: 'Generalidades',
  CONCRETO: 'Concreto',
  METAL: 'Metal',
  IMPERMEABILIZACION_JUNTAS: 'Impermeabilización y juntas',
  CERRAMIENTO_PERIMETRAL: 'Cerramiento perimetral',
  PORTON_METALICO: 'Portón metálico',
  SHELTER_CIMENTACION: 'Shelter',
  SOPORTE_INVERSORES: 'Soporte de inversores',
};

/** Título legible de una sección, en mayúsculas para destacarlo al pegar. */
export function sectionTitle(categoryId, fallback) {
  return (SECTION_TITLES[categoryId] || fallback || categoryId).toUpperCase();
}

/**
 * Texto plano consolidado de unas notas ya resueltas.
 *
 * @param {object} resolved - resultado de resolveTechnicalNotes
 * @returns {string}
 */
export function buildPlainTextNotes(resolved) {
  if (!resolved || !resolved.secciones) return '';
  const texto = resolved.secciones
    .map((seccion) => {
      const titulo = sectionTitle(seccion.categoryId, seccion.titulo);
      // Una nota por línea: sin línea vacía entre numerales consecutivos.
      const notas = seccion.notas.map((n) => `${n.numero}. ${n.textoResuelto}`).join('\n');
      return `${titulo}\n${notas}`;
    })
    // Una única línea en blanco entre secciones.
    .join('\n\n');

  /* Última pasada de normalización sobre el texto ya ensamblado: garantiza
     que lo que se ve, lo que se copia y lo que consuma una exportación futura
     sean exactamente la misma cadena, con espacios ASCII y saltos LF en
     cualquier sistema operativo. */
  return normalizeTechnicalText(texto);
}
