/* Transcripción verbatim de 04_METAL(1).txt. No reescribir textos. */
export const METAL = {
  category_id: 'METAL',
  category_type: 'GLOBAL',
  label: 'Perfilería metálica, soldadura y anticorrosión',
  inputs: {
    GALVANIZADO: { default: 'Z450', type: 'repository_select', group: 'GALVANIZADO' },
    ZINC_FRIO: { default: '92 %', type: 'number_unit' },
    CAPAS_REPARACION: { default: '4', type: 'number' },
  },
  notes: [
    { note_id: 'MET-001', text: 'Los perfiles metálicos deberán contar con galvanizado {{GALVANIZADO}} o sistema equivalente aprobado según exposición ambiental y vida útil.' },
    { note_id: 'MET-002', text: 'Tornillería, anclajes, platinas, bisagras, pasadores y accesorios deberán ser compatibles con el galvanizado y no generar pares galvánicos.' },
    { note_id: 'MET-003', text: 'Las superficies para soldar deberán estar limpias y libres de grasa, pintura, óxido, humedad, escoria o contaminantes.' },
    { note_id: 'MET-004', text: 'Las zonas afectadas por corte, perforación, soldadura o pérdida del galvanizado deberán repararse con galvanizado en frío con mínimo {{ZINC_FRIO}} de zinc y al menos {{CAPAS_REPARACION}} capas uniformes, o sistema equivalente aprobado.' },
    { note_id: 'MET-005', text: 'Las soldaduras deberán garantizar continuidad, penetración adecuada y ausencia de defectos visibles.' },
  ],
};
