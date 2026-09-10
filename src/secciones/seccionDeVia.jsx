/* ============================================================================
   EL PERFIL DE LA RASANTE — dibujo de la sección
   ----------------------------------------------------------------------------
   La versión simplificada del plano: solo las dos capas y sus espesores, sin
   bombeo ni ancho de calzada. Sirve para lo que un plano no alcanza a hacer
   mientras uno diseña —ver de un vistazo en qué queda la estructura— y para
   pegarlo en una revisión rápida.

   Tres decisiones que vienen de cómo se construyen estas vías:

   1. La vía va ENCAJONADA: la rasante queda a nivel del suelo, no encima. Por
      eso el terreno llega hasta arriba a lado y lado y la estructura se ve
      metida en él, como el cajón que de verdad se excava.

   2. No hay línea de cota horizontal. La había, y leída de lejos parecía
      acotar el ancho de la vía —que este dibujo no dice—. El espesor total
      queda como texto, que es lo que se quería decir.

   3. Las alturas van a escala real entre sí: una capa de 3 cm sobre una de 30
      se ve así de delgada, a propósito. Darles una altura mínima "para que se
      vean" haría que el dibujo mintiera justo sobre lo único que muestra.
   ============================================================================ */

import React from 'react';

const ANCHO = 480;
const ALTO = 196;
const IZQ = 104;          // deja sitio a las cotas de espesor
const DER = 316;          // y a los nombres de material
const RASANTE = 46;       // nivel del suelo — y de la superficie de la vía
const ALTO_CAPAS = 88;

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* En metros, que es como se acota un plano de rasante. */
export function enMetros(cm) {
  return (num(cm) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* El borde inferior del terreno, irregular: es donde termina el dibujo, no
   una cota de nada. */
const FONDO_TERRENO = 'M0,0 L28,14 L56,4 L92,20 L128,6 L164,18 L200,5 L236,16 L272,3 L308,15 L344,6 L380,17 L416,5 L452,14 L480,4 L480,40 L0,40 Z';

/* El nombre del material va sobre el terreno, así que lleva su propio fondo
   claro para poder leerse — como los rótulos de un plano. */
function Rotulo({ x, y, texto }) {
  const ancho = texto.length * 5.3 + 12;
  return (
    <g>
      <rect x={x} y={y - 8} width={ancho} height={16} rx="3" fill="#FFFFFF" fillOpacity="0.9" stroke="#E4D7BE" strokeWidth="0.75" />
      <text x={x + 6} y={y + 3.5} fontSize="10" className="fill-navy-600">{texto}</text>
    </g>
  );
}

export function SeccionDeVia({ nombreCapa1, nombreCapa2, espesorCapa1, espesorCapa2 }) {
  const e1 = num(espesorCapa1);
  const e2 = num(espesorCapa2);
  const total = e1 + e2;

  /* Sin espesores no hay nada que dibujar: se dice, en vez de pintar una
     estructura de altura cero que parece un error. */
  if (total === 0) {
    return (
      <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-8 text-center">
        <p className="text-sm text-navy-400 italic">Escribe los espesores para ver la sección.</p>
      </div>
    );
  }

  const h1 = (e1 / total) * ALTO_CAPAS;
  const h2 = ALTO_CAPAS - h1;
  const y1 = RASANTE;
  const y2 = y1 + h1;
  const fondoCajon = y2 + h2;

  const centro = (y, h) => y + h / 2;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto" role="img"
      aria-label={`Sección de la vía: ${nombreCapa1 || 'capa 1'} de ${espesorCapa1} cm sobre ${nombreCapa2 || 'capa 2'} de ${espesorCapa2} cm`}>
      <defs>
        {/* Los granulares se rayan distinto para distinguirlos sin depender
            del color, que en una impresión en blanco y negro se pierde. */}
        <pattern id="dv-capa1" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#D8D2C4" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#A89F8C" strokeWidth="1.5" />
        </pattern>
        <pattern id="dv-capa2" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#EDE6D6" />
          <circle cx="3" cy="3" r="1.1" fill="#B9AE95" />
        </pattern>
      </defs>

      {/* --------------- el espesor total, sin línea de cota que lo acompañe */}
      <text x={(IZQ + DER) / 2} y={RASANTE - 16} fontSize="12" textAnchor="middle" fontWeight="bold" className="fill-navy-800">
        Estructura: {enMetros(total)} m
      </text>

      {/* ------------------------------------------------- el terreno natural
          Llega hasta la rasante a lado y lado: la vía va encajonada, con su
          superficie al mismo nivel del suelo. */}
      <rect x="0" y={RASANTE} width={ANCHO} height={ALTO - RASANTE} fill="#F2DFC0" />
      <path d={FONDO_TERRENO} transform={`translate(0, ${ALTO - 40})`} fill="#E8CFA6" />
      <line x1="0" y1={RASANTE} x2={ANCHO} y2={RASANTE} stroke="#B9945F" strokeWidth="1.25" />

      {/* ------------------------------------------------------- las dos capas */}
      <rect x={IZQ} y={y1} width={DER - IZQ} height={h1} fill="url(#dv-capa1)" stroke="#8C8371" strokeWidth="1" />
      <rect x={IZQ} y={y2} width={DER - IZQ} height={h2} fill="url(#dv-capa2)" stroke="#8C8371" strokeWidth="1" />
      {/* Las paredes del cajón excavado. */}
      <line x1={IZQ} y1={y1} x2={IZQ} y2={fondoCajon} stroke="#8C8371" strokeWidth="1.25" />
      <line x1={DER} y1={y1} x2={DER} y2={fondoCajon} stroke="#8C8371" strokeWidth="1.25" />

      {/* ------------------------------------- cotas de espesor, capa por capa */}
      {[
        { yTop: y1, h: h1, e: e1, key: 'c1' },
        { yTop: y2, h: h2, e: e2, key: 'c2' },
      ].filter((c) => c.h > 0).map((c) => (
        <g key={c.key} stroke="#C2410C" fill="#C2410C">
          <line x1={IZQ - 34} y1={c.yTop} x2={IZQ} y2={c.yTop} strokeWidth="0.75" strokeDasharray="3 2" />
          <line x1={IZQ - 34} y1={c.yTop + c.h} x2={IZQ} y2={c.yTop + c.h} strokeWidth="0.75" strokeDasharray="3 2" />
          <line x1={IZQ - 26} y1={c.yTop} x2={IZQ - 26} y2={c.yTop + c.h} strokeWidth="1" />
          <text x={IZQ - 38} y={centro(c.yTop, c.h) + 3.5} fontSize="11" textAnchor="end" stroke="none">
            {enMetros(c.e)} m
          </text>
        </g>
      ))}

      {/* --------------------------------------------- nombres de cada material */}
      <g>
        <line x1={DER} y1={centro(y1, h1)} x2={DER + 12} y2={centro(y1, h1)} stroke="#C2410C" strokeWidth="0.75" />
        <Rotulo x={DER + 12} y={centro(y1, h1)} texto={nombreCapa1 || 'Capa 1'} />
        <line x1={DER} y1={centro(y2, h2)} x2={DER + 12} y2={centro(y2, h2)} stroke="#C2410C" strokeWidth="0.75" />
        <Rotulo x={DER + 12} y={centro(y2, h2)} texto={nombreCapa2 || 'Capa 2'} />
      </g>
    </svg>
  );
}

export default SeccionDeVia;
