/* ============================================================================
   ALMACÉN DE IMÁGENES DE REUNIONES — lo único que habla con Supabase Storage
   ----------------------------------------------------------------------------
   Es el "servicio" que esperan las piezas de shared/imagenes.jsx. Vive aparte
   para que esas piezas se puedan probar con un doble, sin conexión.
   ============================================================================ */

import { supabase } from '../supabaseClient';
import { makeId } from './dominio.jsx';

const BUCKET = 'reuniones';
/* Una hora: suficiente para una reunión con la pantalla abierta. Al vencer,
   la imagen se vuelve a firmar la próxima vez que se pinte. */
const VIGENCIA_S = 3600;
const firmadas = new Map(); // ruta → { url, vence }

const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function subirImagenReunion(archivo) {
  const ruta = `${makeId('img')}.${EXTENSION[archivo.type] || 'png'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type });
  if (error) {
    console.error('Error subiendo la imagen:', error);
    /* Sin la migración no existe el bucket: decirlo así, no con el mensaje
       crudo de Supabase. */
    if (/bucket.*not.*found|not found/i.test(error.message || '')) {
      throw new Error('Todavía no hay dónde guardar imágenes: falta correr la migración migration_reuniones_imagenes.sql.');
    }
    throw new Error(`No se pudo subir la imagen. Detalle: ${error.message}`);
  }
  return ruta;
}

export async function firmarImagenReunion(ruta) {
  const guardada = firmadas.get(ruta);
  /* Se renueva un minuto antes de que venza, para no pintar un enlace que
     muere a mitad de la reunión. */
  if (guardada && guardada.vence - 60000 > Date.now()) return guardada.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, VIGENCIA_S);
  if (error || !data?.signedUrl) {
    console.error('Error firmando la imagen:', error);
    return null;
  }
  firmadas.set(ruta, { url: data.signedUrl, vence: Date.now() + VIGENCIA_S * 1000 });
  return data.signedUrl;
}

export const servicioImagenesReunion = { subir: subirImagenReunion, firmar: firmarImagenReunion };
