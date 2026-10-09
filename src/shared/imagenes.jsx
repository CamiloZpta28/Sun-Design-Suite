/* ============================================================================
   IMÁGENES ADJUNTAS — pantallazos en los temas y pendientes de las reuniones
   ----------------------------------------------------------------------------
   A diferencia de Actualizaciones, que guarda la imagen como texto dentro de
   la fila, aquí la imagen va al almacenamiento de Supabase (bucket privado
   "reuniones") y la fila guarda solo su ruta. La razón es el peso: los
   pendientes se cargan todos al entrar a la plataforma, y los resúmenes de
   doce semanas también; con los pantallazos adentro, cada entrada bajaría
   megas de imágenes que casi nadie va a mirar.

   El bucket es privado (los invitados no ven nada de las reuniones), así que
   para mostrar una imagen se pide un enlace firmado que vence. Subir y firmar
   llegan como un "servicio" desde App.jsx, que es quien habla con Supabase:
   así estas piezas se prueban sin conexión.

     servicio = { subir(archivo) → Promise<ruta>, firmar(ruta) → Promise<url> }
   ============================================================================ */

import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, ImagePlus, Loader2, X } from 'lucide-react';

export const MAX_MB_IMAGEN = 5;

/* Por qué no entra un archivo, o null si entra. */
export function errorDeImagen(archivo) {
  if (!archivo || !(archivo.type || '').startsWith('image/')) return 'Solo se pueden adjuntar imágenes.';
  if (archivo.size > MAX_MB_IMAGEN * 1024 * 1024) {
    return `La imagen no puede pesar más de ${MAX_MB_IMAGEN} MB. Si es un pantallazo, recórtalo a la parte que importa.`;
  }
  return null;
}

/* Las imágenes de un Ctrl+V. Si lo pegado es texto, no hay ninguna y el
   campo pega el texto como siempre. */
export function imagenesDelPortapapeles(evento) {
  return Array.from(evento?.clipboardData?.items || [])
    .filter((i) => i.kind === 'file' && (i.type || '').startsWith('image/'))
    .map((i) => i.getAsFile())
    .filter(Boolean);
}

/* Sube varios archivos en orden y devuelve las rutas de los que subieron.
   El primero que falle detiene el resto y se informa: subir la mitad sin
   decir nada sería peor. */
export async function subirImagenes(archivos, servicio) {
  const rutas = [];
  for (const archivo of archivos) {
    const error = errorDeImagen(archivo);
    if (error) return { rutas, error };
    try {
      rutas.push(await servicio.subir(archivo));
    } catch (e) {
      return { rutas, error: e?.message || 'No se pudo subir la imagen.' };
    }
  }
  return { rutas, error: null };
}

/* Subir con su estado de "subiendo…" y su error, para cualquier lugar que
   adjunte imágenes (el botón, o un campo de texto donde se pega). */
export function useSubirImagenes(servicio, onAgregadas) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  async function subir(archivos) {
    if (!servicio || archivos.length === 0) return;
    setError('');
    setSubiendo(true);
    const r = await subirImagenes(archivos, servicio);
    setSubiendo(false);
    if (r.rutas.length > 0) onAgregadas(r.rutas);
    if (r.error) setError(r.error);
  }
  /* Para el onPaste de un campo: solo intercepta si lo pegado es imagen. */
  function alPegar(e) {
    const archivos = imagenesDelPortapapeles(e);
    if (archivos.length === 0) return;
    e.preventDefault();
    subir(archivos);
  }
  return { subir, alPegar, subiendo, error };
}

function useUrlFirmada(ruta, firmar) {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vigente = true;
    setUrl(null);
    setFallo(false);
    Promise.resolve(firmar ? firmar(ruta) : null)
      .then((u) => { if (vigente) { setUrl(u || null); setFallo(!u); } })
      .catch(() => { if (vigente) setFallo(true); });
    return () => { vigente = false; };
  }, [ruta, firmar]);
  return { url, fallo };
}

function Miniatura({ ruta, firmar, onAmpliar, onQuitar }) {
  const { url, fallo } = useUrlFirmada(ruta, firmar);
  return (
    <span className="relative inline-block">
      {url ? (
        <button type="button" onClick={() => onAmpliar(url)} title="Ver en grande" className="block">
          <img src={url} alt="Imagen adjunta" className="h-16 w-24 object-cover rounded-md border border-navy-200 hover:opacity-90" />
        </button>
      ) : (
        <span
          title={fallo ? 'No se pudo cargar la imagen' : 'Cargando…'}
          className="h-16 w-24 rounded-md border border-dashed border-navy-300 bg-navy-50 flex items-center justify-center text-navy-300"
        >
          <ImageIcon className="w-5 h-5" />
        </span>
      )}
      {onQuitar && (
        <button
          type="button"
          onClick={() => onQuitar(ruta)}
          title="Quitar la imagen"
          aria-label="Quitar la imagen"
          className="absolute -top-1.5 -right-1.5 bg-white border border-navy-300 rounded-full p-0.5 text-navy-400 hover:text-red-500 shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

/* Las miniaturas de una lista de rutas; un clic agranda. Con `onQuitar`,
   cada una lleva su X. */
export function GaleriaImagenes({ rutas, firmar, onQuitar, className = '' }) {
  const [ampliada, setAmpliada] = useState(null);
  if (!rutas || rutas.length === 0) return null;
  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {rutas.map((ruta) => (
          <Miniatura key={ruta} ruta={ruta} firmar={firmar} onAmpliar={setAmpliada} onQuitar={onQuitar} />
        ))}
      </div>
      {ampliada && (
        <div
          className="fixed inset-0 bg-navy-900/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setAmpliada(null)}
        >
          <button type="button" onClick={() => setAmpliada(null)} className="absolute top-4 right-4 text-white/80 hover:text-white" title="Cerrar">
            <X className="w-6 h-6" />
          </button>
          <img src={ampliada} alt="Imagen adjunta" className="max-w-full max-h-full object-contain rounded-lg cursor-default" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

/* El botón de adjuntar: abre el explorador de archivos (varias a la vez). */
export function BotonAgregarImagen({ servicio, onAgregadas, soloIcono = false }) {
  const entrada = useRef(null);
  const { subir, subiendo, error } = useSubirImagenes(servicio, onAgregadas);
  if (!servicio) return null;
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={subiendo}
        title="Adjuntar una imagen (también puedes pegarla con Ctrl+V)"
        aria-label="Adjuntar imagen"
        className={`inline-flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700 disabled:opacity-50 ${soloIcono ? 'p-1' : ''}`}
      >
        {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
        {!soloIcono && (subiendo ? 'Subiendo…' : 'Imagen')}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="adjuntar-imagen"
        onChange={(e) => { subir(Array.from(e.target.files || [])); e.target.value = ''; }}
      />
      {error && <span className="text-xs text-red-500 mt-0.5">{error}</span>}
    </span>
  );
}
