/* Transcripción verbatim de 07_IMPERMEABILIZACION_JUNTAS(1).txt. No reescribir textos. */
export const IMPERMEABILIZACION_JUNTAS = {
  category_id: 'IMPERMEABILIZACION_JUNTAS',
  category_type: 'PROCESO',
  label: 'Impermeabilización y juntas de construcción',
  inputs: {
    IMPERMEABILIZANTE: { default: 'SikaTop-107 Seal CO o equivalente', type: 'repository_select', group: 'IMPERMEABILIZACION' },
    PUENTE_ADHERENCIA: { default: 'Sikadur-32 Primer o equivalente', type: 'repository_select', group: 'JUNTAS' },
    SELLO_HIDROEXPANSIVO: { default: 'SikaSwell S-2 o equivalente', type: 'repository_select', group: 'JUNTAS' },
  },
  notes: [
    { note_id: 'IMP-001', text: 'Se recomienda impermeabilización superficial de fundaciones mediante {{IMPERMEABILIZANTE}} o producto equivalente, aplicado según ficha técnica.' },
    { note_id: 'IMP-002', text: 'La superficie deberá estar sana, limpia y libre de contaminantes; los defectos deberán repararse antes de aplicar el sistema.' },
    { note_id: 'IMP-003', text: 'La impermeabilización se ejecutará antes del relleno o contacto definitivo con el terreno y se protegerá contra daños mecánicos.' },
    { note_id: 'JUN-001', text: 'Se evitarán juntas frías mediante planeación del vaciado. Si son inevitables, deberán ubicarse preferiblemente en zonas de menor solicitación y ser aprobadas.' },
    { note_id: 'JUN-002', text: 'Para concreto nuevo sobre concreto endurecido se preparará una superficie rugosa y limpia. Podrá utilizarse {{PUENTE_ADHERENCIA}} según ficha técnica.' },
    { note_id: 'JUN-003', text: 'En juntas sometidas a humedad podrá utilizarse {{SELLO_HIDROEXPANSIVO}}, debidamente confinado y protegido durante el vaciado.' },
    { note_id: 'JUN-004', text: 'Toda junta fría deberá quedar registrada en obra indicando ubicación, fechas, preparación, producto utilizado y responsable de aprobación.' },
  ],
};
