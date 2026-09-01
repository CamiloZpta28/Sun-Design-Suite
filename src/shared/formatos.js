/* ============================================================================
   FORMATOS DE TEXTO COMPARTIDOS
   ----------------------------------------------------------------------------
   Piezas mínimas que necesitan tanto App.jsx como las secciones que se
   descargan aparte. Se quedan fuera de esas secciones a propósito: son unas
   pocas líneas, así que cargarlas siempre no cuesta nada, y si vivieran
   dentro de una sección, usarlas desde App.jsx la volvería a arrastrar al
   paquete inicial.
   ============================================================================ */

export function formatoFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}
