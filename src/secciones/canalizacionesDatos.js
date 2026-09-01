/* ============================================================================
   CANALIZACIONES — tipos, semilla y cálculos de zanja
   ----------------------------------------------------------------------------
   La parte que App.jsx necesita SIEMPRE: la semilla inicial y la clave de
   subcategoría (que decide cuál plantilla es la "principal" de su grupo).
   Son unas pocas funciones sin interfaz, así que cargarlas siempre no pesa;
   los dibujos y formularios viven en Canalizaciones.jsx, que se descarga
   solo al abrir la sección.
   ============================================================================ */
/* "tieneTuberia": false solo para SPT (cable desnudo, sin ducto ni arenilla) */
/* y AC-BT directamente enterrado (según el documento, sin tubería).         */
/* Orden y nombres pedidos: DC, AC-BT Tubería, AC-BT Enterrado, AC-MT,       */
/* Comunicaciones, Energía, SPT. "tieneTuberia": false para AC-BT Enterrado */
/* (cable directamente enterrado) y SPT (cable de puesta a tierra, muy      */
/* delgado — ver "esCableFino"). Todos llevan cinta de señalización.        */
export const CANALIZACION_TIPOS = [
  { id: 'dc', label: 'DC', profundidadNorma: 0.45, tieneTuberia: true, distanciaCintaNorma: 0.25, color: '#06B6D4' },
  { id: 'acbt_tuberia', label: 'AC-BT Tubería', profundidadNorma: 0.45, tieneTuberia: true, distanciaCintaNorma: 0.25, color: '#84CC16' },
  { id: 'acbt_directo', label: 'AC-BT Enterrado', profundidadNorma: 0.60, tieneTuberia: false, distanciaCintaNorma: 0.25, esCableFino: true, color: '#84CC16' },
  { id: 'mt', label: 'AC-MT', profundidadNorma: 0.75, tieneTuberia: true, distanciaCintaNorma: 0.25, color: '#B45309' },
  { id: 'comunicaciones', label: 'Comunicaciones', profundidadNorma: 0.40, tieneTuberia: true, distanciaCintaNorma: 0.20, color: '#D946EF' },
  { id: 'energia_ssaa', label: 'Energía', profundidadNorma: 0.45, tieneTuberia: true, distanciaCintaNorma: 0.25, color: '#D946EF' },
  { id: 'spt', label: 'SPT', profundidadNorma: 0.50, tieneTuberia: false, distanciaCintaNorma: 0.25, esCableFino: true, color: '#065F46' },
  /* "Combinaciones" no es un tipo de línea con su propia norma — es una      */
  /* zanja compuesta que junta 2 o más plantillas YA CREADAS (de cualquiera  */
  /* de los tipos de arriba), cada una a SU PROPIA profundidad (escalonada). */
  { id: 'combinacion', label: 'Combinaciones', esCombinacion: true },
];

/* "diametro" ahora se elige de un catálogo compartido (en pulgadas, mismo   */
/* criterio que País/Ingeniero de proyectos): admite fracciones como        */
/* 3/4" o 1 1/4". Estas dos funciones hacen la conversión a metros para     */
/* los cálculos de ancho de zanja y del dibujo.                             */
export function parsePulgadas(str) {
  if (!str) return 0;
  const limpio = String(str).replace(/["″]/g, '').trim();
  if (!limpio) return 0;
  let total = 0;
  for (const parte of limpio.split(/\s+/)) {
    if (parte.includes('/')) {
      const [num, den] = parte.split('/').map(Number);
      if (den) total += num / den;
    } else {
      total += parseFloat(parte) || 0;
    }
  }
  return total;
}
export function pulgadasAMetros(str) {
  return parsePulgadas(str) * 0.0254;
}

/* 19 combinaciones de ejemplo (diámetro × cantidad de tuberías) más         */
/* comunes en las minigranjas — se siembran solas la primera vez que se     */
/* carga la app (con IDs fijos, así que nunca duplican ni pisan las         */
/* plantillas que alguien ya haya creado a mano).                          */
export const CANALIZACION_SEED = [
  { id: 'seed_dc_2_1', tipo: 'dc', diametro: '2"', cantidad: 1 },
  { id: 'seed_dc_2_2', tipo: 'dc', diametro: '2"', cantidad: 2 },
  { id: 'seed_dc_2_3', tipo: 'dc', diametro: '2"', cantidad: 3 },
  { id: 'seed_dc_2_4', tipo: 'dc', diametro: '2"', cantidad: 4 },
  { id: 'seed_dc_2_5', tipo: 'dc', diametro: '2"', cantidad: 5 },
  { id: 'seed_dc_1_1', tipo: 'dc', diametro: '1"', cantidad: 1 },
  { id: 'seed_dc_1_2', tipo: 'dc', diametro: '1"', cantidad: 2 },
  { id: 'seed_dc_1_3', tipo: 'dc', diametro: '1"', cantidad: 3 },
  { id: 'seed_ac_2_1', tipo: 'acbt_tuberia', diametro: '2"', cantidad: 1 },
  { id: 'seed_ac_2_2', tipo: 'acbt_tuberia', diametro: '2"', cantidad: 2 },
  { id: 'seed_ac_4_1', tipo: 'acbt_tuberia', diametro: '4"', cantidad: 1 },
  { id: 'seed_ac_4_2', tipo: 'acbt_tuberia', diametro: '4"', cantidad: 2 },
  { id: 'seed_ac_4_3', tipo: 'acbt_tuberia', diametro: '4"', cantidad: 3 },
  { id: 'seed_mt_4_2', tipo: 'mt', diametro: '4"', cantidad: 2 },
  { id: 'seed_mt_6_2', tipo: 'mt', diametro: '6"', cantidad: 2 },
  { id: 'seed_com_34_1', tipo: 'comunicaciones', diametro: '3/4"', cantidad: 1 },
  { id: 'seed_com_34_2', tipo: 'comunicaciones', diametro: '3/4"', cantidad: 2 },
  { id: 'seed_ene_34_1', tipo: 'energia_ssaa', diametro: '3/4"', cantidad: 1 },
  { id: 'seed_ene_34_2', tipo: 'energia_ssaa', diametro: '3/4"', cantidad: 2 },
];
export function construirSeedCanalizaciones() {
  return CANALIZACION_SEED.map((s) => {
    const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === s.tipo);
    const nombre = `${tipoDef.label} ${s.diametro} × ${s.cantidad} tubería${s.cantidad > 1 ? 's' : ''}`;
    const datos = { ...emptyDatosCanalizacion(tipoDef), diametro: s.diametro, cantidad_tuberias: String(s.cantidad) };
    return { id: s.id, tipo: s.tipo, nombre, datos, es_principal: false };
  });
}

export function emptyDatosCanalizacion(tipoDef) {
  return {
    diametro: '',
    calibre_cable: '',
    cantidad_tuberias: tipoDef.tieneTuberia ? '1' : '',
    separacion_entre_tuberias: '0.10',
    profundidad: String(tipoDef.profundidadNorma),
    distancia_cinta: String(tipoDef.distanciaCintaNorma),
    espesor_arenilla: '0.05',
    separacion_lateral: '0.15',
    notas: '',
  };
}

/* Ancho de zanja: YA NO se digita — se calcula solo como (separación       */
/* lateral × 2, a lado y lado) + el espacio que ocupan la(s) tubería(s) y,  */
/* si hay más de una, la separación mínima entre caras externas (0.10 m).  */
/* Para SPT/AC-BT Enterrado (sin tubería) se usa un ancho de cable nominal  */
/* pequeño, ya que no hay un ducto real que mida.                          */
/* Sub-categoría dentro de un tipo: el diámetro (y cantidad de tuberías) o    */
/* el calibre del cable definen combinaciones distintas (ej. "DC 2\" × 2     */
/* tuberías" es una sub-categoría distinta de "DC 2\" × 3 tuberías") — cada  */
/* una tiene su PROPIA plantilla "Principal", independiente de las demás:    */
/* puede haber una "DC 2\" × 2 tuberías" principal a 0.45 m de profundidad y */
/* otra "DC 2\" × 2 tuberías" (no principal) a 0.60 m, sin que se pisen.     */
export function subcategoriaKey(tipo, datos) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === tipo);
  if (!tipoDef || tipoDef.esCombinacion) return tipo;
  if (tipoDef.tieneTuberia) return `${tipo}::${datos?.diametro || '—'}::${datos?.cantidad_tuberias || '1'}`;
  return `${tipo}::${datos?.calibre_cable || '—'}`;
}
export function subcategoriaLabel(tipo, datos) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === tipo);
  if (!tipoDef) return '';
  if (tipoDef.tieneTuberia) {
    const cantidad = Math.max(1, parseInt(datos?.cantidad_tuberias, 10) || 1);
    return `${datos?.diametro || 'Sin diámetro'} × ${cantidad} tubería${cantidad > 1 ? 's' : ''}`;
  }
  return datos?.calibre_cable ? `Calibre ${datos.calibre_cable}` : 'Sin calibre definido';
}

export function calcAnchoZanjaCanalizacion(tipoDef, datos) {
  const sepLateral = parseFloat(datos?.separacion_lateral) || 0.15;
  if (!tipoDef.tieneTuberia) {
    const anchoCable = tipoDef.esCableFino ? 0.01 : 0.02;
    return sepLateral * 2 + anchoCable;
  }
  const cantidad = Math.max(1, parseInt(datos?.cantidad_tuberias, 10) || 1);
  const sepEntre = parseFloat(datos?.separacion_entre_tuberias) || 0.10;
  const diametroM = pulgadasAMetros(datos?.diametro) || 0.02;
  const anchoTuberias = diametroM * cantidad + sepEntre * Math.max(0, cantidad - 1);
  return sepLateral * 2 + anchoTuberias;
}

/* La cinta se ubica respecto a la TUBERÍA/CABLE (0.20 m para              */
/* Comunicaciones, 0.25 m para las demás — sugerido, editable), pero NUNCA  */
/* a menos de 0.20 m de la superficie: si la tubería es muy superficial y   */
/* eso empujaría la cinta más arriba del mínimo permitido, se respeta el    */
/* mínimo (la distancia real a la tubería queda entonces menor a la        */
/* sugerida — se muestra igual, no es un error).                           */
export function calcCintaDesdeSuperficie(tipoDef, datos) {
  const profundidad = parseFloat(datos?.profundidad) || tipoDef.profundidadNorma;
  const distanciaDeseada = datos?.distancia_cinta !== '' && datos?.distancia_cinta != null
    ? parseFloat(datos.distancia_cinta)
    : tipoDef.distanciaCintaNorma;
  const posicionIdeal = profundidad - distanciaDeseada;
  return Math.max(0.20, posicionIdeal);
}
