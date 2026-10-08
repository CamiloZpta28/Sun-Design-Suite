/* ============================================================================
   BARRERA DE ERRORES — que un fallo no deje la pantalla en blanco
   ----------------------------------------------------------------------------
   Sin esto, cualquier error al pintar desmonta la aplicación entera y lo que
   queda es una página vacía, sin decir nada. Con esto queda un aviso con un
   botón para recargar.

   El caso más común no es un error del código sino un despliegue: las
   secciones pesadas se descargan aparte (React.lazy), y cada versión nueva
   les cambia el nombre de archivo. Quien tenía la plataforma abierta desde
   antes del despliegue sigue pidiendo los archivos viejos, que ya no existen,
   y la sección no carga. Recargar trae la versión nueva y lo arregla, así que
   en ese caso se recarga sola —una vez: si vuelve a fallar enseguida, es otra
   cosa y se muestra el aviso—.
   ============================================================================ */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/* Los mensajes con que los navegadores dicen "no pude descargar esa parte".
   Chrome, Firefox y Safari lo dicen distinto. */
const PATRONES_DE_DESCARGA = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk [\w-]+ failed/i,
  /is not a valid JavaScript MIME type/i,
];

export function esErrorDeDescarga(error) {
  const texto = `${error?.name || ''} ${error?.message || error || ''}`;
  return PATRONES_DE_DESCARGA.some((p) => p.test(texto));
}

/* La marca de "ya recargué por esto" vive en sessionStorage, que sobrevive a
   la recarga. Si la última fue hace menos de un minuto, no se vuelve a
   recargar: un archivo que de verdad no existe dejaría la página en un ciclo
   de recargas sin fin. */
const MARCA = 'sds:recarga-por-despliegue';
const ESPERA_MS = 60000;

export function puedeRecargarSola(ahora = Date.now()) {
  try {
    const ultima = Number(sessionStorage.getItem(MARCA) || 0);
    if (ahora - ultima < ESPERA_MS) return false;
    sessionStorage.setItem(MARCA, String(ahora));
    return true;
  } catch {
    /* Sin almacenamiento (modo privado estricto) no hay cómo evitar el ciclo:
       mejor mostrar el aviso. */
    return false;
  }
}

const recargarPagina = () => window.location.reload();

export default class BarreraDeErrores extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al pintar la pantalla:', error, info?.componentStack);
    const { recargar = recargarPagina } = this.props;
    if (esErrorDeDescarga(error) && puedeRecargarSola()) recargar();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { recargar = recargarPagina, pantallaCompleta = false } = this.props;
    const porDespliegue = esErrorDeDescarga(error);
    return (
      <div className={`${pantallaCompleta ? 'min-h-screen bg-navy-50' : 'min-h-[60vh]'} flex items-center justify-center p-6`}>
        <div className="bg-white border border-navy-200 rounded-xl shadow-sm max-w-md w-full p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="font-bold text-navy-800 mb-2">
            {porDespliegue ? 'Hay una versión nueva de la plataforma' : 'Algo falló al mostrar esta pantalla'}
          </h2>
          <p className="text-sm text-navy-500 mb-5">
            {porDespliegue
              ? 'Esta pestaña tenía abierta la versión anterior. Recarga para traer la nueva; no se pierde nada de lo que ya estaba guardado.'
              : 'Recarga la página. Lo que ya estaba guardado no se pierde. Si vuelve a pasar, avísale a quien mantiene la plataforma con lo que estabas haciendo.'}
          </p>
          <button
            onClick={() => recargar()}
            className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Recargar
          </button>
          {!porDespliegue && (
            <p className="text-[11px] text-navy-400 mt-4 font-mono break-words">{String(error?.message || error)}</p>
          )}
        </div>
      </div>
    );
  }
}
