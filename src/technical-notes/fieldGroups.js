/* ============================================================================
   AGRUPACIÓN DE LOS CAMPOS DE NOTAS TÉCNICAS
   ----------------------------------------------------------------------------
   Decide cómo se organizan visualmente los campos que viven dentro del
   acordeón "Información para Notas Técnicas" de la pestaña Estructural.

   Es SOLO presentación: no toca projects.data ni cambia claves o valores.

   El acordeón muestra SIEMPRE todos los subapartados (General, Cerramiento,
   Portón, Shelter, Inversores), sin importar el tipo de estructura elegido en
   Notas Técnicas: es una pantalla de captura y el ingeniero debe poder llenar
   cualquier estructura cuando lo necesite. El filtrado por estructura vive en
   el otro extremo — el bundle del manifest decide qué NOTAS se generan (ver
   catalog/bundler.js).
   ============================================================================ */

/* Grupos en orden de despliegue. `categoryId` documenta a qué categoría del
   catálogo pertenece cada familia; los subgrupos son solo subtítulos
   visuales (no acordeones anidados).
   Los campos que pertenecen al dominio normal del proyecto y ya existían
   fuera del acordeón (dim_ciment_*, tipo_galvanizado, capacidades del suelo
   en Geotecnia…) NO aparecen aquí: se editan en su lugar de siempre y las
   notas leen ese mismo valor. */
export const FIELD_GROUPS = [
  {
    /* Parámetros transversales, comunes a todas las estructuras. */
    id: 'GENERAL',
    label: 'General',
    subgroups: [
      { label: 'Concreto — solado', categoryId: 'CONCRETO', fieldKeys: ['concreto_solado_fc', 'concreto_solado_espesor'] },
      { label: 'Acero de refuerzo', categoryId: 'CONCRETO', fieldKeys: ['acero_refuerzo_norma', 'acero_refuerzo_fy'] },
      { label: 'Mezcla', categoryId: 'CONCRETO', fieldKeys: ['agregado_tamano_max', 'relacion_agua_cemento_max'] },
      { label: 'Recubrimientos', categoryId: 'CONCRETO', fieldKeys: ['recubrimiento_tierra', 'recubrimiento_no_tierra'] },
      { label: 'Galvanizado en frío', categoryId: 'METAL', fieldKeys: ['galvanizado_frio_zinc', 'galvanizado_frio_capas'] },
    ],
  },
  {
    id: 'CERRAMIENTO_PERIMETRAL',
    label: 'Cerramiento perimetral',
    categoryId: 'CERRAMIENTO_PERIMETRAL',
    subgroups: [
      {
        label: 'Poste típico',
        fieldKeys: [
          'cerramiento_poste_diametro',
          'cerramiento_poste_espesor',
          'cerramiento_poste_anclaje',
          'cerramiento_poste_afloramiento',
          'cerramiento_poste_longitud_total',
          'cerramiento_poste_separacion',
        ],
      },
      {
        label: 'Tubería de diagonales y vientos',
        fieldKeys: ['cerramiento_tubo_secundario_diametro', 'cerramiento_tubo_secundario_espesor'],
      },
      { label: 'Diagonales', fieldKeys: ['cerramiento_diagonales_longitud', 'cerramiento_diagonales_separacion'] },
      { label: 'Vientos', fieldKeys: ['cerramiento_vientos_longitud', 'cerramiento_vientos_separacion'] },
      {
        label: 'Malla y fijaciones',
        fieldKeys: ['cerramiento_malla_especificacion', 'cerramiento_bandit_calibre', 'cerramiento_fijacion_separacion'],
      },
      {
        label: 'Perfilería y soldadura',
        fieldKeys: ['cerramiento_acero_norma', 'cerramiento_acero_fy', 'cerramiento_acero_fu', 'cerramiento_soldadura_espesor'],
      },
      {
        label: 'Protección anticorrosiva',
        fieldKeys: ['ambiente_corrosion_clase', 'galvanizado_perdida_zinc_proyectada'],
      },
    ],
  },
  {
    id: 'PORTON_METALICO',
    label: 'Portón metálico',
    categoryId: 'PORTON_METALICO',
    subgroups: [
      { label: 'Cimentación', fieldKeys: ['porton_viga_amarre_seccion', 'porton_reemplazo_granular'] },
      {
        label: 'Perfilería y soldadura',
        fieldKeys: ['porton_perfil_embebido', 'porton_acero_norma', 'porton_acero_fy', 'porton_acero_fu', 'porton_soldadura_espesor'],
      },
    ],
  },
  {
    id: 'SHELTER_CIMENTACION',
    label: 'Cimentación de shelter',
    categoryId: 'SHELTER_CIMENTACION',
    subgroups: [
      {
        label: 'Implantación y drenaje',
        fieldKeys: ['shelter_cota_minima', 'shelter_calado_estudio', 'shelter_borde_libre'],
      },
      {
        label: 'Micropilotes',
        fieldKeys: ['shelter_micropilote_profundidad', 'shelter_micropilote_sobresaliente', 'shelter_micropilote_longitud_total'],
      },
      { label: 'Terreno', fieldKeys: ['shelter_compactacion_minima'] },
      {
        label: 'Cargas',
        fieldKeys: ['shelter_carga_mantenimiento', 'shelter_carga_sobrecarga', 'shelter_carga_muerta_total', 'shelter_carga_viento'],
      },
    ],
  },
  {
    id: 'SOPORTE_INVERSORES',
    label: 'Soporte de inversores',
    categoryId: 'SOPORTE_INVERSORES',
    subgroups: [
      { label: 'Materiales y cargas', fieldKeys: ['inversores_manual_cargas', 'inversores_fc_ciclopeo'] },
    ],
  },
];

/* ----------------------------------------------------------------------------
   ETIQUETAS DE PRESENTACIÓN
   ----------------------------------------------------------------------------
   Dentro del acordeón, la jerarquía (grupo → subgrupo) ya aporta el contexto,
   así que el campo no debe repetirlo: bajo "Cerramiento perimetral › Poste
   típico" sobra el prefijo "Cerramiento — poste típico:".

   Esto es EXCLUSIVAMENTE visual. No cambia fieldKey, ni el id del resolver,
   ni el label canónico del SCHEMA — que se sigue usando tal cual en los
   pendientes de Notas Técnicas y en la navegación, donde el campo aparece
   fuera de su jerarquía y necesita identificarse por completo.

   Se declara por clave (no se recorta el prefijo con un replace genérico,
   que sería frágil y rompería en cuanto un label no siguiera el patrón).
   -------------------------------------------------------------------------- */
export const FIELD_DISPLAY_LABELS = {
  // General › Concreto — solado
  concreto_solado_fc: "f'c",
  concreto_solado_espesor: 'Espesor',
  // General › Acero de refuerzo
  acero_refuerzo_norma: 'Norma',
  acero_refuerzo_fy: 'fy',
  // General › Mezcla
  agregado_tamano_max: 'Agregado: tamaño máximo nominal',
  relacion_agua_cemento_max: 'Relación agua/cemento máxima',
  // General › Recubrimientos
  recubrimiento_tierra: 'En contacto con tierra',
  recubrimiento_no_tierra: 'Sin contacto con tierra',
  // General › Galvanizado en frío
  galvanizado_frio_zinc: 'Zinc mínimo',
  galvanizado_frio_capas: 'Capas de reparación',

  // Cerramiento › Poste típico
  cerramiento_poste_diametro: 'Diámetro nominal',
  cerramiento_poste_espesor: 'Espesor',
  cerramiento_poste_anclaje: 'Anclaje/embebido (m)',
  cerramiento_poste_afloramiento: 'Afloramiento (m)',
  cerramiento_poste_longitud_total: 'Longitud total',
  cerramiento_poste_separacion: 'Separación',
  // Cerramiento › Tubería de diagonales y vientos
  cerramiento_tubo_secundario_diametro: 'Diámetro nominal',
  cerramiento_tubo_secundario_espesor: 'Espesor',
  // Cerramiento › Diagonales
  cerramiento_diagonales_longitud: 'Longitud',
  cerramiento_diagonales_separacion: 'Separación',
  // Cerramiento › Vientos
  cerramiento_vientos_longitud: 'Longitud',
  cerramiento_vientos_separacion: 'Separación',
  // Cerramiento › Malla y fijaciones
  cerramiento_malla_especificacion: 'Malla eslabonada',
  cerramiento_bandit_calibre: 'Cinta bandit: calibre',
  cerramiento_fijacion_separacion: 'Separación máxima entre fijaciones',
  // Cerramiento › Perfilería y soldadura
  cerramiento_acero_norma: 'Norma del acero',
  cerramiento_acero_fy: 'fy',
  cerramiento_acero_fu: 'fu',
  cerramiento_soldadura_espesor: 'Soldadura: espesor mínimo',
  // Cerramiento › Protección anticorrosiva
  ambiente_corrosion_clase: 'Clase de ambiente de corrosión (ISO 9223)',
  galvanizado_perdida_zinc_proyectada: 'Pérdida de zinc proyectada (vida útil)',

  // Portón › Cimentación
  porton_viga_amarre_seccion: 'Viga de amarre: sección',
  porton_reemplazo_granular: 'Reemplazo de material granular',
  // Portón › Perfilería y soldadura
  porton_perfil_embebido: 'Perfil metálico embebido',
  porton_acero_norma: 'Norma del acero',
  porton_acero_fy: 'fy',
  porton_acero_fu: 'fu',
  porton_soldadura_espesor: 'Soldadura: espesor mínimo',

  // Shelter › Implantación y drenaje
  shelter_cota_minima: 'Cota mínima',
  shelter_calado_estudio: 'Calado que exige estudio hidráulico',
  shelter_borde_libre: 'Borde libre adicional',
  // Shelter › Micropilotes
  shelter_micropilote_profundidad: 'Profundidad (m)',
  shelter_micropilote_sobresaliente: 'Sobresaliente (m)',
  shelter_micropilote_longitud_total: 'Longitud total',
  // Shelter › Terreno
  shelter_compactacion_minima: 'Compactación mínima',
  // Shelter › Cargas
  shelter_carga_mantenimiento: 'Carga viva de mantenimiento',
  shelter_carga_sobrecarga: 'Sobrecarga',
  shelter_carga_muerta_total: 'Carga muerta total',
  shelter_carga_viento: 'Carga de viento',

  // Inversores › Materiales y cargas
  inversores_manual_cargas: 'Manual de cargas de referencia',
  inversores_fc_ciclopeo: "f'c del concreto ciclópeo",
};

/**
 * Etiqueta que se muestra dentro del acordeón. Si la clave no tiene una
 * declarada, se devuelve el label canónico recibido: nunca desaparece un
 * campo por faltar su traducción visual.
 */
export function displayLabelFor(fieldKey, labelCanonico) {
  return FIELD_DISPLAY_LABELS[fieldKey] || labelCanonico;
}

/** Todas las claves gestionadas por esta agrupación, en orden. */
export function allGroupedFieldKeys() {
  return FIELD_GROUPS.flatMap((g) => g.subgroups.flatMap((s) => s.fieldKeys));
}

/** id del grupo (GENERAL, CERRAMIENTO_PERIMETRAL…) al que pertenece una
 *  clave, o null si no se edita en el acordeón. */
export function groupIdOfField(fieldKey) {
  const grupo = FIELD_GROUPS.find((g) => g.subgroups.some((s) => s.fieldKeys.includes(fieldKey)));
  return grupo ? grupo.id : null;
}

/** categoryId del catálogo que respalda una clave (null si no está agrupada). */
export function categoryOfField(fieldKey) {
  for (const grupo of FIELD_GROUPS) {
    const sub = grupo.subgroups.find((s) => s.fieldKeys.includes(fieldKey));
    if (sub) return sub.categoryId || grupo.categoryId;
  }
  return null;
}

/** ¿Este campo se edita dentro del acordeón de Notas Técnicas? */
export function isTechnicalNotesField(fieldKey) {
  return groupIdOfField(fieldKey) !== null;
}

/**
 * TODOS los grupos y subgrupos del acordeón de edición.
 *
 * El panel de Estructural los muestra siempre completos, con independencia
 * del tipo de estructura elegido en Notas Técnicas: es una pantalla de
 * captura de datos, y el ingeniero debe poder llenar la información de
 * cualquier estructura cuando lo necesite.
 *
 * El filtrado por estructura SÍ existe, pero en el otro extremo: el bundle
 * del manifest decide qué NOTAS se generan (ver catalog/bundler.js). Editar
 * un campo de otra estructura simplemente no afecta a las notas activas.
 *
 * @returns {Array<{id, label, subgroups}>}
 */
export function allFieldGroups() {
  return FIELD_GROUPS;
}

/** Claves de todos los grupos (equivale a allGroupedFieldKeys; se mantiene
 *  por legibilidad en los sitios que hablan de "lo visible"). */
export function visibleFieldKeys() {
  return allGroupedFieldKeys();
}

/**
 * ¿Navegar a este campo exige abrir el acordeón de Notas Técnicas?
 * Lo usa la pestaña Estructural al recibir un salto desde un pendiente.
 */
export function requiresAccordion(fieldKey) {
  return isTechnicalNotesField(fieldKey);
}

/**
 * Subapartado que hay que desplegar para que un campo quede a la vista al
 * llegar desde un pendiente ('GENERAL', 'CERRAMIENTO_PERIMETRAL'…).
 * null si el campo no vive en el acordeón.
 */
export function groupToOpenFor(fieldKey) {
  return groupIdOfField(fieldKey);
}
