/* ============================================================================
   CAMBIOS EN VIVO — enterarse cuando otra persona guarda
   ----------------------------------------------------------------------------
   Escucha dos tablas a través de Realtime:

     - projects: para refrescar solo los proyectos que NO se están mirando
       (listas, Dashboard, resumen por inversionista). Ahí nadie está
       escribiendo, así que actualizarlos al vuelo no molesta a nadie.
     - activity_log: para saber QUIÉN hizo el cambio y qué hizo. La fila de
       projects no dice el autor; el historial sí, y además deja filtrar los
       cambios propios (los que uno mismo acaba de guardar).

   Lo que se está mirando NUNCA se recarga solo: eso se avisa y lo decide la
   persona (ver el aviso "Ver cambios" en la ficha del proyecto). Recargar por
   debajo a alguien que está leyendo —o peor, escribiendo— sería más molesto
   que el problema que se quiere resolver.

   Necesita que las dos tablas estén habilitadas para Realtime:
   supabase/migration_cambios_en_vivo.sql
   ============================================================================ */

import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export const CANAL_CAMBIOS = 'cambios-proyectos';

/**
 * @param {object} opciones
 * @param {string} opciones.perfilId - para ignorar los cambios propios
 * @param {(row: object) => void} opciones.onProyectoCambiado - fila nueva/actualizada
 * @param {(id: string) => void} opciones.onProyectoEliminado
 * @param {(registro: object) => void} opciones.onActividadAjena - fila de activity_log de OTRA persona
 * @param {boolean} [opciones.activo] - false mientras no haya sesión/perfil
 */
export function useCambiosEnVivo({ perfilId, onProyectoCambiado, onProyectoEliminado, onActividadAjena, activo = true }) {
  /* Los callbacks se guardan en una referencia para no rehacer la suscripción
     cada vez que App.jsx se vuelve a pintar (que es en cada tecla). */
  const manejadores = useRef({});
  manejadores.current = { onProyectoCambiado, onProyectoEliminado, onActividadAjena, perfilId };

  useEffect(() => {
    if (!activo || !perfilId) return undefined;

    const canal = supabase.channel(CANAL_CAMBIOS);

    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
      const { onProyectoCambiado: cambiado, onProyectoEliminado: eliminado } = manejadores.current;
      if (payload.eventType === 'DELETE') {
        if (payload.old && payload.old.id) eliminado?.(payload.old.id);
        return;
      }
      if (payload.new && payload.new.id) cambiado?.(payload.new);
    });

    canal.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
      const { onActividadAjena: ajena, perfilId: yo } = manejadores.current;
      const registro = payload.new;
      if (!registro) return;
      /* Lo que uno mismo acaba de guardar ya está en pantalla: avisárselo
         sería ruido. */
      if (registro.usuario_id && registro.usuario_id === yo) return;
      ajena?.(registro);
    });

    canal.subscribe();

    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, perfilId]);
}

/**
 * Texto del aviso, a partir del registro de historial que lo disparó.
 * "Ana Gómez · Actualizó la pestaña Civil"
 */
export function textoDeCambio(registro) {
  if (!registro) return '';
  const quien = registro.usuario_nombre || 'Alguien';
  const que = (registro.accion || '').trim();
  return que ? `${quien} · ${que}` : `${quien} actualizó este proyecto`;
}
