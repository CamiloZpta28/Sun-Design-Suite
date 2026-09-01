/* ============================================================================
   CIMENTACIONES — tipos, parámetros de acero y resúmenes
   ----------------------------------------------------------------------------
   La parte liviana de la sección, la que App.jsx necesita SIEMPRE:

     - los tipos y sus etiquetas;
     - las constantes de acero (recubrimiento, gancho/peso por calibre,
       traslapos) y la función que las sobreescribe con lo que el
       Desarrollador haya guardado en Supabase;
     - los "resumen": las líneas de texto "Etiqueta: valor" de una plantilla,
       que se ven dentro de un proyecto y en la hoja de vida imprimible.

   Los dibujos y los formularios —que son casi todo el peso— viven en
   Cimentaciones.jsx y se descargan solo cuando hacen falta. Separarlos así
   es lo que permite que abrir el Dashboard no baje 9 formularios técnicos.
   ============================================================================ */

import { Building2, CircleDot, Home, Lightbulb, Video, Zap } from 'lucide-react';

export const CIMENTACION_TIPOS = [
  { id: 'postes_mt', label: 'Postes MT', icon: CircleDot, disponible: true },
  { id: 'luminarias', label: 'Luminarias', icon: Lightbulb, disponible: true },
  { id: 'camaras', label: 'Cámaras', icon: Video, disponible: true },
  { id: 'inversores', label: 'Inversores', icon: Zap, disponible: true },
  { id: 'cerramiento_postes', label: 'Cerramiento · Postes', icon: CircleDot, disponible: true },
  { id: 'cerramiento_porton', label: 'Cerramiento · Portón', icon: Building2, disponible: true },
  { id: 'cerramiento_paso_fauna', label: 'Cerramiento · Paso de fauna', icon: Home, disponible: true },
  { id: 'shelter_ct', label: 'Shelter · Centro de Transformación', icon: Zap, disponible: true },
  { id: 'shelter_trampa_aceite', label: 'Shelter · Trampa de aceite', icon: Home, disponible: true },
];

/* Parámetros fijos de acero de refuerzo para TODAS las cimentaciones:        */

/* recubrimiento siempre 7.5cm, y por calibre — longitud de gancho estándar  */
/* y peso por metro (usados para calcular longitudes y pesos de barras).     */
/* Estas son las constantes de acero POR DEFECTO (usadas si el desarrollador */
/* aún no ha guardado sus propios valores en Supabase — ver                 */
/* "aplicarParametrosIngenieria" más abajo, que sobreescribe su CONTENIDO   */
/* en tiempo real cuando cargan los datos reales). "let" en el recubrimiento */
/* y mutación de los objetos (no reasignación) es justamente para que TODO  */
/* el código que ya usa estas constantes vea el valor actualizado sin tener */
/* que tocar cada función que las usa.                                     */
export let RECUBRIMIENTO_CIMENTACION = 0.075;
export const BARRA_ACERO = {
  '#3': { gancho: 0.10, peso: 0.56 },
  '#4': { gancho: 0.20, peso: 0.994 },
  '#5': { gancho: 0.25, peso: 1.552 },
  '#6': { gancho: 0.30, peso: 2.235 },
};
/* Traslapos tipo B a tensión (NSR-10), por calibre y resistencia del        */
/* concreto — ya redondeados hacia arriba al múltiplo de 0.05 m más         */
/* cercano. Solo cubre 21/28/35 MPa (los valores de la tabla oficial); si    */
/* la plantilla usa otra resistencia, el traslapo simplemente no se puede   */
/* calcular (se muestra "—").                                               */
export const TRASLAPO_TABLE = {
  '#3': { '21 MPa': 0.55, '28 MPa': 0.50, '35 MPa': 0.45 },
  '#4': { '21 MPa': 0.75, '28 MPa': 0.65, '35 MPa': 0.60 },
  '#5': { '21 MPa': 0.95, '28 MPa': 0.80, '35 MPa': 0.70 },
  '#6': { '21 MPa': 1.10, '28 MPa': 0.95, '35 MPa': 0.85 },
};
export const CALIBRES_DISPONIBLES = Object.keys(BARRA_ACERO);

/* Sobreescribe el CONTENIDO (no la referencia) de las constantes de acero   */
/* con lo que el desarrollador haya guardado en Supabase — así todo el      */
/* código que ya las usa (calcularLongitudinales, calcularEstribos, etc.)   */
/* ve el valor actualizado sin necesidad de tocar cada función.            */
export function aplicarParametrosIngenieria(datos) {
  if (!datos) return;
  if (typeof datos.recubrimiento === 'number') RECUBRIMIENTO_CIMENTACION = datos.recubrimiento;
  if (datos.barras) {
    Object.keys(BARRA_ACERO).forEach((k) => delete BARRA_ACERO[k]);
    Object.assign(BARRA_ACERO, datos.barras);
  }
  if (datos.traslapos) {
    Object.keys(TRASLAPO_TABLE).forEach((k) => delete TRASLAPO_TABLE[k]);
    Object.assign(TRASLAPO_TABLE, datos.traslapos);
  }
}

/* Traslapo (m) para el calibre y resistencia dados, o null si no hay dato   */
/* en la tabla para esa combinación (resistencia fuera de 21/28/35 MPa, o    */
/* "Otro").                                                                  */
export function obtenerTraslapo(calibre, resistencia) {
  const fila = TRASLAPO_TABLE[calibre];
  if (!fila) return null;
  const valor = fila[resistencia];
  return typeof valor === 'number' ? valor : null;
}

/* Cada resumen devuelve líneas "Etiqueta: valor" (no un solo string) para
   poder mostrar subcategorías (Losa/Pedestales, Zapatas/Pedestales/Viga…)
   como líneas separadas — se pintan con <ResumenLineas>. */
export const CIMENTACION_RESUMENES = {
  postes_mt: (d) => [
    `Diámetro: ${d.diametro || '—'} m`,
    `Desplante: ${d.desplante || '—'} m`,
    `Altura total: ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  ],
  luminarias: (d) => [
    `Ancho: ${d.ancho || '—'} m`,
    `Profundo: ${d.profundo || '—'} m`,
    `Desplante: ${d.desplante || '—'} m`,
    `Altura total: ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  ],
  camaras: (d) => [
    `Ancho: ${d.ancho || '—'} m`,
    `Profundo: ${d.profundo || '—'} m`,
    `Desplante: ${d.desplante || '—'} m`,
    `Altura total: ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  ],
  inversores: (d) => {
    const p = d.pedestal || {};
    const l = d.losa || {};
    const alturaPedestal = ((parseFloat(p.desplante) || 0) + (parseFloat(p.sobresaliente) || 0)).toFixed(2);
    return [
      `Desplante: ${p.desplante || '—'} m`,
      `Losa: ${l.ancho || '—'} × ${l.largo || '—'} × ${l.espesor || '—'} m`,
      `Pedestales: ${p.ancho || '—'} × ${p.profundo || '—'} × ${alturaPedestal} m`,
    ];
  },
  cerramiento_postes: (d) => [
    `Diámetro: ${d.diametro || '—'} m`,
    `Desplante: ${d.desplante || '—'} m`,
    `Altura total: ${((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2)} m`,
  ],
  cerramiento_porton: (d) => {
    const z = d.zapata || {};
    const p = d.pedestal || {};
    const v = d.viga || {};
    const alturaPedestal = Math.max(0, (parseFloat(d.desplante) || 0) - (parseFloat(z.espesor) || 0)).toFixed(2);
    const longitudViga = Math.max(0, (parseFloat(d.separacion_zapatas) || 0) - (parseFloat(z.largo) || 0)).toFixed(2);
    return [
      `Desplante: ${d.desplante || '—'} m`,
      `Zapatas: ${z.ancho || '—'} × ${z.largo || '—'} × ${z.espesor || '—'} m`,
      `Pedestales: ${p.ancho || '—'} × ${p.profundo || '—'} × ${alturaPedestal} m`,
      `Viga: ${v.ancho || '—'} × ${v.alto || '—'} × ${longitudViga} m`,
    ];
  },
  cerramiento_paso_fauna: (d) => [
    `Ancho: ${d.ancho || '—'} m`,
    `Profundo: ${d.profundo || '—'} m`,
    `Altura total: ${d.alto || '—'} m`,
  ],
  shelter_ct: (d) => {
    const p = d.pedestal || {};
    const v = d.viga || {};
    const anchoCT = parseFloat(d.ancho) || 0;
    const largoCT = parseFloat(d.largo) || 0;
    const pAncho = parseFloat(p.ancho) || 0;
    const pProfundo = parseFloat(p.profundo) || 0;
    const alturaPedestal = ((parseFloat(d.desplante) || 0) + (parseFloat(d.sobresaliente) || 0)).toFixed(2);
    const largoVigaLarga = Math.max(0, largoCT - pProfundo).toFixed(2);
    const largoVigaCorta = Math.max(0, anchoCT - pAncho).toFixed(2);
    return [
      `Desplante: ${d.desplante || '—'} m`,
      `Pedestales: ${p.ancho || '—'} × ${p.profundo || '—'} × ${alturaPedestal} m`,
      `Viga larga: ${v.ancho || '—'} × ${v.alto || '—'} × ${largoVigaLarga} m`,
      `Viga corta: ${v.ancho || '—'} × ${v.alto || '—'} × ${largoVigaCorta} m`,
    ];
  },
  shelter_trampa_aceite: (d) => [
    `Ancho: ${d.ancho || '—'} m`,
    `Profundo: ${d.profundo || '—'} m`,
    `Altura total: ${d.alto || '—'} m`,
  ],
};
