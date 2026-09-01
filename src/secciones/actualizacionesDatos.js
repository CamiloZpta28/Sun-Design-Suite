/* Categorías con las que arranca la sección Actualizaciones la primera vez.
   Vive aparte de la vista (Actualizaciones.jsx) porque App.jsx la necesita
   al cargar los datos, y no queremos que eso obligue a descargar toda la
   sección antes de tiempo. */
/* ============================================================================
   6. ACTUALIZACIONES — registro global (no por proyecto) de actualizaciones
   de diseño, organizado por categoría. Las categorías son 100% editables
   desde la plataforma (crear/renombrar/eliminar), a diferencia de los tipos
   fijos de Canalizaciones.
   ============================================================================ */
export const ACTUALIZACION_CATEGORIAS_SEED = [
  { id: 'act_paneles_inversores_tracker', nombre: 'Paneles, inversores y tracker' },
  { id: 'act_spt_apantallamiento', nombre: 'SPT y apantallamiento' },
  { id: 'act_shelter', nombre: 'Shelter' },
  { id: 'act_canalizaciones', nombre: 'Canalizaciones' },
  { id: 'act_postes_recos', nombre: 'Postes y recos' },
  { id: 'act_cerramiento', nombre: 'Cerramiento' },
];
