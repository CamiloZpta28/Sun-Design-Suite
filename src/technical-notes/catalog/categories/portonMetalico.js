/* Transcripción verbatim de 05_PORTON_METALICO(1).txt. No reescribir textos. */
export const PORTON_METALICO = {
  category_id: 'PORTON_METALICO',
  category_type: 'ESTRUCTURA',
  label: 'Portón metálico',
  dependencies: ['GENERAL', 'CONCRETO', 'METAL'],
  detect_by: ['portón metálico', 'portón vehicular', 'puerta vehicular'],
  inputs: {
    CAPACIDAD_SUELO: { default: '200.13 kN/m²', type: 'project_value' },
    ZAPATA: { default: '1.00 m x 1.00 m', type: 'project_value' },
    DESPLANTE: { default: '1.45 m', type: 'project_value' },
    VIGA_AMARRE: { default: '0.30 m x 0.35 m', type: 'project_value' },
    REEMPLAZO_GRANULAR: { default: '30 cm', type: 'project_value' },
    PERFIL: { default: 'perfil 4 in', type: 'repository_select', group: 'PERFILES' },
    ACERO: { default: 'ASTM A500 Grado C', type: 'repository_select', group: 'ACERO_ESTRUCTURAL' },
    FY: { default: '315 MPa', type: 'repository_value' },
    FU: { default: '425 MPa', type: 'repository_value' },
    SOLDADURA: { default: '5 mm', type: 'project_value' },
  },
  notes: [
    { note_id: 'POR-001', text: 'La cimentación deberá apoyarse sobre el estrato competente definido en el estudio geotécnico.' },
    { note_id: 'POR-002', text: 'La capacidad admisible mínima del suelo en servicio será {{CAPACIDAD_SUELO}}.' },
    { note_id: 'POR-003', text: 'La cimentación estará conformada por zapatas de {{ZAPATA}}, desplante {{DESPLANTE}}, unidas mediante viga de amarre {{VIGA_AMARRE}} y vaciadas monolíticamente.' },
    { note_id: 'POR-004', text: 'Se realizará reemplazo de {{REEMPLAZO_GRANULAR}} de material granular bajo la cimentación, extendido, nivelado y compactado.' },
    { note_id: 'POR-005', text: 'Los elementos metálicos embebidos {{PERFIL}} serán de {{ACERO}}, fy = {{FY}} y fu = {{FU}}.' },
    { note_id: 'POR-006', text: 'Las soldaduras se ejecutarán mediante SMAW con electrodo E6011, cordón continuo y espesor mínimo {{SOLDADURA}} salvo indicación diferente en planos.' },
  ],
};
