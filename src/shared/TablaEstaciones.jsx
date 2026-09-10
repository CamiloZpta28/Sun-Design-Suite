/* ============================================================================
   TABLA DE ESTACIONES PLUVIOMÉTRICAS
   ----------------------------------------------------------------------------
   La misma tabla en los dos sitios donde se pide: la pestaña Hidráulico de un
   proyecto y la sección Diseño de vía. Eran dos copias con encabezados
   distintos para los mismos tres datos, y el pegado desde Excel habría sido
   una tercera copia.

   Lo de pegar es la razón de que esto exista como componente: estos datos
   salen de una hoja de cálculo del IDEAM, y escribir siete estaciones a mano
   —nombre, días y peso, veintiún celdas— es donde de verdad se pierde el
   tiempo y donde se cuela el dato mal copiado.
   ============================================================================ */

import React, { useState } from 'react';
import { ClipboardPaste, TriangleAlert } from 'lucide-react';
import { pegarDesdePortapapeles, MAXIMO_FILAS } from './pegarTabla.js';

export const CLAVES_ESTACION = ['nombre', 'dias', 'peso'];
/* Las dos que esperan números: es lo que permite reconocer un encabezado
   pegado sin querer. */
const COLUMNAS_NUMERICAS = [1, 2];

export const filaDeEstacionVacia = () => ({ nombre: '', dias: '', peso: '' });

const CELDA = 'w-full rounded-md border border-navy-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

/* Los pesos reparten el 100% entre las estaciones. El aviso vive aquí, donde
   se escriben, y no donde se usan: quien pueda arreglarlo es quien está
   editando la tabla. */
function pesosSuman100(filas) {
  const suma = (filas || []).reduce((t, f) => {
    const n = parseFloat(String(f?.peso ?? '').replace(',', '.'));
    return t + (Number.isFinite(n) ? n : 0);
  }, 0);
  return { suma, cuadran: Math.abs(suma - 100) < 1e-6 };
}

export function TablaEstaciones({ filas, onChange, soloLectura, notaSoloLectura }) {
  /* Lo que pasó en el último pegado. Es estado de interfaz puro: se muestra
     un momento y no se guarda con los datos. */
  const [resultado, setResultado] = useState(null);

  const valores = Array.isArray(filas) && filas.length > 0 ? filas : [];
  const pesos = pesosSuman100(valores);

  function cambiar(i, clave, valor) {
    onChange(valores.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));
  }

  /* Al pegar un rango de Excel se llena la tabla entera desde la celda donde
     se pegó. Un solo valor se deja pasar: ahí el pegado de siempre es el que
     hay que hacer. */
  function pegar(evento, fila, columna) {
    if (soloLectura) return;
    const texto = evento.clipboardData ? evento.clipboardData.getData('text/plain') : '';
    const r = pegarDesdePortapapeles({
      texto,
      filas: valores,
      filaInicial: fila,
      columnaInicial: columna,
      claves: CLAVES_ESTACION,
      filaVacia: filaDeEstacionVacia,
      columnasNumericas: COLUMNAS_NUMERICAS,
    });
    if (!r) return;
    evento.preventDefault();
    onChange(r.filas);
    setResultado(r);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-navy-200 rounded-lg">
          <thead>
            <tr className="bg-navy-50">
              <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200">Nombre de la estación</th>
              <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-40">Días/año promedio</th>
              <th className="text-left font-semibold text-navy-500 px-2 py-1.5 border-b border-navy-200 w-36">Peso porcentual (%)</th>
            </tr>
          </thead>
          <tbody>
            {valores.map((f, i) => (
              <tr key={i} className="border-b border-navy-100 last:border-b-0">
                {CLAVES_ESTACION.map((clave, j) => (
                  <td key={clave} className="p-1.5">
                    {soloLectura ? (
                      <span className="block px-2 py-1 text-sm text-navy-600 font-mono truncate">
                        {f[clave] || '—'}
                      </span>
                    ) : (
                      <input
                        className={CELDA}
                        value={f[clave] ?? ''}
                        onChange={(e) => cambiar(i, clave, e.target.value)}
                        onPaste={(e) => pegar(e, i, j)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {soloLectura ? (
        notaSoloLectura && <p className="text-xs text-navy-400 mt-1.5">{notaSoloLectura}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mt-1.5">
          <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
          Se puede copiar el rango en Excel y pegarlo aquí: llena la tabla de un
          golpe. Si copias también los títulos, se descartan solos.
        </p>
      )}

      {/* Con la tabla en blanco no hay nada que avisar todavía: el aviso es
          para quien ya escribió pesos y no le suman. */}
      {!soloLectura && pesos.suma > 0 && !pesos.cuadran && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-2">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Los pesos suman {pesos.suma.toLocaleString('es-CO', { maximumFractionDigits: 2 })}%, no 100%. El promedio
          ponderado de días de lluvia —y con él el diseño de vía— sale de lo que haya.
        </p>
      )}

      {resultado && (
        <p className={`text-xs mt-1 ${resultado.descartadas > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
          Se pegaron {resultado.pegadas} {resultado.pegadas === 1 ? 'estación' : 'estaciones'}
          {resultado.encabezadoQuitado ? ' (sin la fila de títulos)' : ''}.
          {resultado.descartadas > 0
            && ` ${resultado.descartadas} no cupieron: la tabla llega hasta ${MAXIMO_FILAS} filas.`}
        </p>
      )}
    </div>
  );
}

export default TablaEstaciones;
