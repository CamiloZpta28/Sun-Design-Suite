/* ============================================================================
   TECHNICAL_NOTE_SPECS — registro de qué "especificaciones" de notas
   técnicas están disponibles. Punto único de extensión: para habilitar
   Portón metálico más adelante, se agrega una entrada aquí (con su propia
   plantilla + resolvers) sin tocar el motor (engine.js) ni el panel
   (TechnicalNotesPanel.jsx).
   ============================================================================ */

import { CERRAMIENTO_PERIMETRAL_TEMPLATE } from './templates/cerramientoPerimetral.js';
import { CERRAMIENTO_PERIMETRAL_RESOLVERS } from './resolvers.js';

export const TECHNICAL_NOTE_SPECS = [
  {
    id: 'CERRAMIENTO_PERIMETRAL',
    label: 'Cerramiento perimetral',
    enabled: true,
    template: CERRAMIENTO_PERIMETRAL_TEMPLATE,
    resolvers: CERRAMIENTO_PERIMETRAL_RESOLVERS,
  },
  {
    // El archivo fuente ya trae la plantilla de "1.1 Notas técnicas - portón
    // metálico" (con su propio catálogo de placeholders), pero esta primera
    // implementación solo habilita cerramiento perimetral (alcance pedido
    // explícitamente). Se deja el registro para no reconstruir la lista de
    // specs cuando se aborde portón — solo hará falta transcribir su
    // plantilla y sus resolvers y poner enabled: true.
    id: 'PORTON_METALICO',
    label: 'Portón metálico',
    enabled: false,
    template: null,
    resolvers: null,
  },
];

export function getTechnicalNoteSpec(specId) {
  return TECHNICAL_NOTE_SPECS.find((s) => s.id === specId) || null;
}
