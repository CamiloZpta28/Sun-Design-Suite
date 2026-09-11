/* ============================================================================
   MIS NOTIFICACIONES, EN VIVO
   ----------------------------------------------------------------------------
   Hasta ahora las notificaciones se leían una sola vez, al entrar: alguien
   podía dejar la plataforma abierta toda la tarde sin enterarse de nada.
   Aquí se escucha la tabla y llegan solas.

   El filtro por usuario va en la suscripción y no en el código que la recibe:
   así el servidor no manda las notificaciones de los demás, que además de
   ruido serían datos ajenos viajando a un navegador que no debería verlos.
   ============================================================================ */

import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export const CANAL_NOTIFICACIONES = 'mis-notificaciones';

export function useNotificacionesEnVivo({ usuarioId, onNotificacion, activo = true }) {
  /* El manejador se guarda en una referencia para no rehacer la suscripción
     cada vez que la aplicación se vuelve a pintar. */
  const manejador = useRef();
  manejador.current = onNotificacion;

  useEffect(() => {
    if (!activo || !usuarioId) return undefined;

    const canal = supabase.channel(CANAL_NOTIFICACIONES);
    canal.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` },
      (payload) => { if (payload.new) manejador.current?.(payload.new); },
    );
    canal.subscribe();

    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, usuarioId]);
}
