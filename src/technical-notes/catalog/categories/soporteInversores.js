/* Transcripción verbatim de 09_SOPORTE_INVERSORES(1).txt. No reescribir
   textos. El `warning` del archivo fuente se conserva como metadato — NO se
   convierte en nota (regla explícita del encargo). */
export const SOPORTE_INVERSORES = {
  category_id: 'SOPORTE_INVERSORES',
  category_type: 'ESTRUCTURA',
  label: 'Soporte de inversores',
  dependencies: ['GENERAL', 'CONCRETO'],
  detect_by: ['inversor', 'soporte de inversores'],
  inputs: {
    MANUAL_CARGAS: { default: 'Manual del usuario de la serie SUN2000-(250KTL, 280KTL, 300KTL, 330KTL)', type: 'project_value' },
    FC_FUNDACION: { default: '28 MPa', type: 'project_value' },
    FC_CICLOPEO: { default: '17.5 MPa', type: 'project_value' },
  },
  notes: [
    { note_id: 'INV-001', text: 'Para las cargas muertas sobreimpuestas se tomará como referencia {{MANUAL_CARGAS}} o el documento vigente del equipo.' },
    { note_id: 'INV-002', text: "El concreto de fundaciones tendrá f'c = {{FC_FUNDACION}}." },
    { note_id: 'INV-003', text: "El concreto ciclópeo, cuando aplique, tendrá f'c = {{FC_CICLOPEO}}." },
    { note_id: 'INV-004', text: 'Se recomienda el uso de concreto impermeabilizado para prolongar la vida útil de los elementos.' },
  ],
  warning: 'La memoria fuente incluye una recomendación de dejar reposar el concreto antes de colocarlo. No se convirtió en nota global porque las memorias más recientes indican controlar temperatura y tiempos mediante el diseño de mezcla y el procedimiento de colocación.',
};
