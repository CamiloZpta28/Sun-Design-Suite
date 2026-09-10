/* ============================================================================
   PEGAR UNA TABLA DE EXCEL
   ----------------------------------------------------------------------------
   Excel —y Google Sheets, y Word— ponen en el portapapeles el rango copiado
   como texto: las celdas separadas por tabulador y las filas por salto de
   línea. Con eso se puede llenar una tabla de la plataforma de un solo pegado,
   en vez de escribir dato por dato.

   Aquí vive solo la traducción de ese texto a filas, sin nada de interfaz,
   porque es la parte con casos raros: el salto de línea que Excel deja al
   final, el encabezado que uno copia sin querer, las celdas de más que no
   caben en la tabla.
   ============================================================================ */

/* Cuántas filas puede llegar a tener una tabla después de un pegado. No es un
   límite del formato sino un seguro: pegar sin querer media hoja de cálculo
   no puede dejar la pantalla con miles de renglones. */
export const MAXIMO_FILAS = 30;

/* El texto del portapapeles convertido en filas de celdas. */
export function celdasPegadas(texto) {
  const limpio = String(texto ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (limpio === '') return [];
  return limpio.split('\n').map((linea) => linea.split('\t').map((c) => c.trim()));
}

/* Un solo valor no es una tabla: ahí conviene dejar que el navegador pegue
   como siempre, dentro de la celda donde está el cursor. */
export function esUnaSolaCelda(celdas) {
  return celdas.length === 1 && celdas[0].length === 1;
}

const esNumero = (v) => v !== '' && Number.isFinite(parseFloat(String(v).replace(',', '.')));

/* ¿La primera fila es el encabezado, copiado sin querer junto con los datos?
   Lo es si en las columnas que esperan números no hay ni uno. Se mira por el
   contenido y no por el texto del título, para que siga funcionando si mañana
   la columna se llama distinto — o si el Excel del que copian tiene sus
   propios encabezados. */
export function pareceEncabezado(fila, columnasNumericas) {
  if (!fila) return false;
  const conNumero = (columnasNumericas || []).some((i) => esNumero(fila[i]));
  return !conNumero;
}

/* Mete las celdas pegadas en la tabla, desde la celda donde se pegó.

   Devuelve las filas nuevas y cuántas se descartaron por no caber, que es lo
   que hay que poder decirle a quien pegó: un pegado que se come tres
   estaciones en silencio es peor que no tener pegado.

   Las celdas que el pegado no toca se quedan como estaban: pegar una columna
   de días no puede borrar los nombres que ya había. */
export function pegarEnTabla({ filas, celdas, filaInicial = 0, columnaInicial = 0, claves, filaVacia, maximo = MAXIMO_FILAS }) {
  const anteriores = Array.isArray(filas) ? filas : [];
  const nuevas = anteriores.map((f) => ({ ...f }));

  const necesarias = filaInicial + celdas.length;
  const cabenHasta = Math.min(necesarias, maximo);
  while (nuevas.length < cabenHasta) nuevas.push(filaVacia ? filaVacia() : {});

  celdas.forEach((celda, i) => {
    const fila = nuevas[filaInicial + i];
    if (!fila) return;
    celda.forEach((valor, j) => {
      const clave = claves[columnaInicial + j];
      if (clave) fila[clave] = valor;
    });
  });

  return { filas: nuevas, descartadas: Math.max(0, necesarias - cabenHasta) };
}

/* Todo junto: de lo que hay en el portapapeles a las filas nuevas. Devuelve
   null cuando no hay nada que hacer —una sola celda, o texto vacío— para que
   quien llame deje pasar el pegado normal del navegador. */
export function pegarDesdePortapapeles({
  texto, filas, filaInicial = 0, columnaInicial = 0, claves, filaVacia, columnasNumericas, maximo,
}) {
  let celdas = celdasPegadas(texto);
  if (celdas.length === 0 || esUnaSolaCelda(celdas)) return null;

  /* El encabezado solo se descarta si el pegado empieza en la primera
     columna: pegar dos columnas sueltas a media tabla no trae títulos. */
  let encabezadoQuitado = false;
  if (columnaInicial === 0 && pareceEncabezado(celdas[0], columnasNumericas || [])) {
    celdas = celdas.slice(1);
    encabezadoQuitado = true;
  }
  if (celdas.length === 0) return null;

  const { filas: nuevas, descartadas } = pegarEnTabla({
    filas, celdas, filaInicial, columnaInicial, claves, filaVacia, maximo,
  });
  return { filas: nuevas, pegadas: celdas.length, descartadas, encabezadoQuitado };
}
