/* Transcripción verbatim de 10_TRAZABILIDAD(1).txt (el archivo duplicado con
   nombre autogenerado NO se trata como categoría adicional — ver 00_LEEME).
   Metadata de auditoría/debug: categoría -> documento(s) fuente. No se
   muestra permanentemente al usuario final; queda disponible para una
   futura UI de administración. */
export const TRACEABILITY = {
  sources: {
    'MGS_0051_Cerramiento.docx': ['PORTON_METALICO', 'CERRAMIENTO_PERIMETRAL', 'CONCRETO', 'METAL'],
    '1-MC-Shelter(1).docx': ['SHELTER_CIMENTACION', 'CONCRETO', 'IMPERMEABILIZACION_JUNTAS'],
    'COLCEST312P3-CIV-MEC-003 MC Inversor (1).docx': ['SOPORTE_INVERSORES', 'CONCRETO'],
  },
};

/** Documentos fuente que respaldan una categoría dada (para auditoría/debug). */
export function sourcesForCategory(categoryId) {
  return Object.entries(TRACEABILITY.sources)
    .filter(([, categorias]) => categorias.includes(categoryId))
    .map(([doc]) => doc);
}
