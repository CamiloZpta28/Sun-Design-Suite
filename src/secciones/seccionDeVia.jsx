/* ============================================================================
   EL PERFIL DE LA VÍA — dibujo de la sección
   ----------------------------------------------------------------------------
   La versión simplificada del plano de rasante: solo las dos capas y sus
   espesores, sin bombeo ni acotado de ancho. Sirve para lo que un plano no
   alcanza a hacer mientras uno diseña — ver de un vistazo si la proporción
   entre las capas tiene sentido — y para pegarlo en una revisión rápida.

   Las alturas van a escala real entre sí: una capa de 5 cm sobre una de 20 se
   ve así de delgada, a propósito. Si se dibujaran con una altura mínima
   "para que se vea", el dibujo mentiría justo sobre lo único que muestra.
   ============================================================================ */

import React from 'react';

const ANCHO = 480;
const ALTO = 210;
const IZQ = 96;      // deja sitio a las cotas
const DER = 356;     // y a los nombres de material
const ALTO_CAPAS = 76;
const CIELO = 34;

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* En metros, que es como se acota un plano de rasante. */
export function enMetros(cm) {
  return (num(cm) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* El terreno natural: un borde inferior irregular, como en el plano. No dice
   nada técnico —es donde termina el dibujo— pero sin él las capas parecen
   flotar. */
const PERFIL_TERRENO = 'M0,0 L28,14 L56,4 L92,20 L128,6 L164,18 L200,5 L236,16 L272,3 L308,15 L344,6 L380,17 L416,5 L452,14 L480,4 L480,40 L0,40 Z';

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
  const y1 = CIELO;
  const y2 = y1 + h1;
  const ySubrasante = y2 + h2;

  /* Las cotas y los nombres se anclan al centro de su capa. */
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

      {/* --------------------------------------------------- terreno natural */}
      <rect x="0" y={ySubrasante} width={ANCHO} height={ALTO - ySubrasante} fill="#F2DFC0" />
      <path d={PERFIL_TERRENO} transform={`translate(0, ${ALTO - 40})`} fill="#E8CFA6" />
      <line x1="0" y1={ySubrasante} x2={ANCHO} y2={ySubrasante} stroke="#B9945F" strokeWidth="1" />
      <text x={IZQ} y={ALTO - 12} className="fill-navy-500" fontSize="10">Terreno natural explanado</text>

      {/* ------------------------------------------------------- las dos capas */}
      <rect x={IZQ} y={y1} width={DER - IZQ} height={h1} fill="url(#dv-capa1)" stroke="#8C8371" strokeWidth="1" />
      <rect x={IZQ} y={y2} width={DER - IZQ} height={h2} fill="url(#dv-capa2)" stroke="#8C8371" strokeWidth="1" />

      {/* ------------------------------------------------------------- cotas */}
      {[
        { yTop: y1, h: h1, e: e1, key: 'c1' },
        { yTop: y2, h: h2, e: e2, key: 'c2' },
      ].filter((c) => c.h > 0).map((c) => {
        const { yTop } = c;
        return (
          <g key={c.key} stroke="#C2410C" fill="#C2410C">
            <line x1={IZQ - 30} y1={yTop} x2={IZQ} y2={yTop} strokeWidth="0.75" strokeDasharray="3 2" />
            <line x1={IZQ - 30} y1={yTop + c.h} x2={IZQ} y2={yTop + c.h} strokeWidth="0.75" strokeDasharray="3 2" />
            <line x1={IZQ - 22} y1={yTop} x2={IZQ - 22} y2={yTop + c.h} strokeWidth="1" />
            <text x={IZQ - 34} y={centro(yTop, c.h) + 3.5} fontSize="11" textAnchor="end" stroke="none">
              {enMetros(c.e)} m
            </text>
          </g>
        );
      })}

      {/* --------------------------------------------------- nombres a la derecha */}
      <g fontSize="10" className="fill-navy-600">
        <line x1={DER} y1={centro(y1, h1)} x2={DER + 14} y2={centro(y1, h1)} stroke="#C2410C" strokeWidth="0.75" />
        <text x={DER + 18} y={centro(y1, h1) + 3.5}>{nombreCapa1 || 'Capa 1'}</text>
        <line x1={DER} y1={centro(y2, h2)} x2={DER + 14} y2={centro(y2, h2)} stroke="#C2410C" strokeWidth="0.75" />
        <text x={DER + 18} y={centro(y2, h2) + 3.5}>{nombreCapa2 || 'Capa 2'}</text>
      </g>

      {/* ------------------------------------------------------- espesor total */}
      <g stroke="#152644" fill="#152644">
        <line x1={IZQ} y1={y1 - 16} x2={DER} y2={y1 - 16} strokeWidth="0.75" />
        <line x1={IZQ} y1={y1 - 20} x2={IZQ} y2={y1 - 12} strokeWidth="1" />
        <line x1={DER} y1={y1 - 20} x2={DER} y2={y1 - 12} strokeWidth="1" />
        <text x={(IZQ + DER) / 2} y={y1 - 22} fontSize="11" textAnchor="middle" stroke="none" fontWeight="bold">
          Estructura: {enMetros(total)} m
        </text>
      </g>
    </svg>
  );
}

export default SeccionDeVia;
