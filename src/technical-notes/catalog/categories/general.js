/* Transcripción verbatim de 02_GENERAL(1).txt. No reescribir textos. */
export const GENERAL = {
  category_id: 'GENERAL',
  category_type: 'GLOBAL',
  label: 'Generalidades',
  inputs: {
    UNIDAD_PLANOS: { default: 'm', type: 'select', options: ['m', 'cm', 'mm'] },
  },
  notes: [
    { note_id: 'GEN-001', text: 'Las dimensiones están dadas en {{UNIDAD_PLANOS}} a menos que se especifique otra unidad y los diámetros de las varillas están dados en pulgadas.' },
    { note_id: 'GEN-002', text: 'Todas las dimensiones, ejes, cotas, niveles y alineamientos deberán verificarse antes del inicio de las actividades.' },
    { note_id: 'GEN-003', text: 'Cualquier modificación al diseño, geometría, materiales, dimensiones o sistema constructivo deberá ser consultada y aprobada por el diseñador responsable.' },
  ],
};
