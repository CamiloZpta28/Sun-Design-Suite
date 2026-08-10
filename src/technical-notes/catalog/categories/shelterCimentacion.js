/* Transcripción verbatim de 08_SHELTER_CIMENTACION(1).txt. No reescribir
   textos NI valores. Único añadido: `excluded`/`reason` en los inputs
   sísmicos y en la nota SHE-002, tal como pide la regla 17 del encargo —
   mecanismo para poder reactivarlos después sin reconstruir el catálogo,
   nunca se borra la información fuente. */
export const SHELTER_CIMENTACION = {
  category_id: 'SHELTER_CIMENTACION',
  category_type: 'ESTRUCTURA',
  label: 'Cimentación de shelter',
  dependencies: ['GENERAL', 'CONCRETO', 'IMPERMEABILIZACION_JUNTAS'],
  detect_by: ['shelter', 'cimentación del shelter', 'centro de transformación', 'CT'],
  inputs: {
    COTA_MINIMA: { default: '50 cm', type: 'project_value' },
    CALADO_ESTUDIO: { default: '20 cm', type: 'project_value' },
    BORDE_LIBRE: { default: '30 cm', type: 'project_value' },
    AMENAZA_SISMICA: { default: 'baja', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    TIPO_SUELO: { default: 'E', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    GRUPO_USO: { default: 'Grupo IV', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    I: { default: '1.00', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    AA: { default: '0.10', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    AV: { default: '0.10', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    FA: { default: '2.50', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    FV: { default: '3.50', type: 'project_value', excluded: true, reason: 'sismico_fuera_de_alcance' },
    MICROPILOTE_PROF: { default: '2.00 m', type: 'project_value' },
    MICROPILOTE_SOBRE: { default: '0.50 m', type: 'project_value' },
    MICROPILOTE_TOTAL: { default: '2.50 m', type: 'project_value' },
    COMPACTACION: { default: '95 % Proctor modificado', type: 'project_value' },
    CAP_PORTANTE: { default: '6.82 ton', type: 'project_value' },
    CV_MANT: { default: '0.50 kN/m²', type: 'project_value' },
    CV_SOBRE: { default: '2.0 kN/m²', type: 'project_value' },
    CM_TOTAL: { default: '12.89 kN/m²', type: 'project_value' },
    VIENTO: { default: '0.91 kN/m²', type: 'project_value' },
  },
  notes: [
    { note_id: 'SHE-001', text: 'El shelter se ubicará a una cota mínima de {{COTA_MINIMA}} respecto al nivel de referencia. Si se identifican calados superiores a {{CALADO_ESTUDIO}}, deberán realizarse análisis hidráulicos y obras de drenaje, manteniendo un borde libre adicional de {{BORDE_LIBRE}}.' },
    { note_id: 'SHE-002', text: 'Parámetros sísmicos: amenaza {{AMENAZA_SISMICA}}, suelo {{TIPO_SUELO}}, {{GRUPO_USO}}, I={{I}}, Aa={{AA}}, Av={{AV}}, Fa={{FA}} y Fv={{FV}}.', excluded: true, reason: 'sismico_fuera_de_alcance' },
    { note_id: 'SHE-003', text: 'Los micropilotes tendrán profundidad {{MICROPILOTE_PROF}}, sobresaliente {{MICROPILOTE_SOBRE}} y longitud total {{MICROPILOTE_TOTAL}}.' },
    { note_id: 'SHE-004', text: 'La compactación mínima será {{COMPACTACION}}. La capacidad portante considerada será {{CAP_PORTANTE}} y el relleno se ejecutará conforme al estudio de suelos.' },
    { note_id: 'SHE-005', text: 'Cargas consideradas: mantenimiento {{CV_MANT}}, sobrecarga {{CV_SOBRE}}, carga muerta total {{CM_TOTAL}} y viento {{VIENTO}}.' },
  ],
};
