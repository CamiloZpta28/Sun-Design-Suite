/* ============================================================================
   MANIFEST — transcripción de 01_MANIFEST_CATEGORIAS(1).txt.
   ----------------------------------------------------------------------------
   Fuente de verdad funcional de esta implementación (ver 00_LEEME_CLAUDE.txt).
   No se leen archivos .txt en tiempo de ejecución: este módulo ES la versión
   versionada dentro de la aplicación de ese contenido, transcrita sin
   reescribir valores ni reglas.

   "category_files" del .txt apuntaba a nombres de archivo; aquí apunta a los
   módulos JS hermanos de este directorio (mismo mapeo conceptual).
   ============================================================================ */

export const MANIFEST = {
  schema: 'manifest_categorias_v1',
  main_selector: 'structure_type',
  structure_options: ['PORTON_METALICO', 'CERRAMIENTO_PERIMETRAL', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'],
  bundles: {
    PORTON_METALICO: ['GENERAL', 'CONCRETO', 'METAL', 'PORTON_METALICO'],
    CERRAMIENTO_PERIMETRAL: ['GENERAL', 'CONCRETO', 'METAL', 'CERRAMIENTO_PERIMETRAL'],
    SHELTER_CIMENTACION: ['GENERAL', 'CONCRETO', 'IMPERMEABILIZACION_JUNTAS', 'SHELTER_CIMENTACION'],
    SOPORTE_INVERSORES: ['GENERAL', 'CONCRETO', 'SOPORTE_INVERSORES'],
  },
  rules: [
    'Cargar primero la categoría seleccionada y después sus dependencias.',
    'Resolver placeholders con inputs locales o con el repositorio global.',
    'Un note_id solo puede aparecer una vez en la salida.',
    'Un valor project_value debe solicitarse o leerse del proyecto antes de usar el default.',
    'No mezclar valores de una estructura con otra.',
  ],
};

/** Etiquetas legibles para el selector "Tipo de estructura" (no viene en el
 *  manifest fuente, que solo trae los IDs; se añade aquí para la UI). */
export const STRUCTURE_LABELS = {
  PORTON_METALICO: 'Portón metálico',
  CERRAMIENTO_PERIMETRAL: 'Cerramiento perimetral',
  SHELTER_CIMENTACION: 'Cimentación de shelter',
  SOPORTE_INVERSORES: 'Soporte de inversores',
};

export function bundleFor(structureType) {
  return MANIFEST.bundles[structureType] || null;
}
