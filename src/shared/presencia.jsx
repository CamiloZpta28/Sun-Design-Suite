/* ============================================================================
   QUIÉN ESTÁ AQUÍ — presencia en vivo dentro de un proyecto
   ----------------------------------------------------------------------------
   Varias personas trabajan sobre el mismo proyecto y hasta ahora no había
   forma de saberlo hasta que alguien guardaba. Esto usa la presencia de
   Supabase Realtime: al abrir un proyecto cada quien se anuncia en un canal
   propio de ese proyecto y ve quién más lo tiene abierto y en qué pestaña.

   Es solo información: no toca la base de datos ni cambia cómo se guarda. El
   objetivo es evitar el choque ANTES de que pase — el aviso de conflicto al
   guardar sigue existiendo como última red.

   Lo que NO resuelve: dos personas escribiendo en el mismo campo a la vez.
   Ahí sigue mandando quien guarde de último.
   ============================================================================ */

import React, { useEffect, useRef, useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Avatar } from './ui.jsx';

/** Canal de un proyecto. Un nombre por proyecto, estable para todos. */
export function canalDeProyecto(projectId) {
  return `proyecto:${projectId}`;
}

/**
 * Convierte el estado crudo de presencia de Supabase —{ clave: [meta, …] }—
 * en la lista de LAS OTRAS personas, una sola vez cada una aunque tengan
 * varias pestañas abiertas (se queda con la más reciente, que es la que sabe
 * de verdad qué están mirando).
 *
 * @param {object} estado - lo que devuelve channel.presenceState()
 * @param {string} miId - para no incluirse a uno mismo
 */
export function otrosPresentes(estado, miId) {
  const porPersona = new Map();
  Object.values(estado || {}).forEach((metas) => {
    (metas || []).forEach((meta) => {
      if (!meta || !meta.id || meta.id === miId) return;
      const previo = porPersona.get(meta.id);
      /* Entre dos pestañas de la misma persona gana la que está editando; si
         ninguna edita, la que se anunció más tarde. */
      if (!previo
        || (meta.editando && !previo.editando)
        || (!!meta.editando === !!previo.editando && (meta.desde || '') > (previo.desde || ''))) {
        porPersona.set(meta.id, meta);
      }
    });
  });
  return [...porPersona.values()].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

/** ¿Alguien más está editando esta pestaña ahora mismo? */
export function quienEdita(otros, tabId) {
  return (otros || []).filter((o) => o.editando === tabId);
}

/**
 * Anuncia mi presencia en un proyecto y devuelve quién más está.
 *
 * Cada vez que cambia lo que estoy mirando (pestaña, modo edición) se vuelve
 * a anunciar, sin rehacer el canal: reconectar en cada clic haría parpadear
 * la lista de los demás.
 *
 * @returns {{otros: Array, conectado: boolean}}
 */
export function usePresenciaProyecto({ projectId, perfil, tab, editando }) {
  const [otros, setOtros] = useState([]);
  const [conectado, setConectado] = useState(false);
  const canalRef = useRef(null);
  const desdeRef = useRef(new Date().toISOString());

  const miId = perfil?.id;

  useEffect(() => {
    if (!projectId || !miId) return undefined;

    const canal = supabase.channel(canalDeProyecto(projectId), {
      config: { presence: { key: miId } },
    });
    canalRef.current = canal;

    function sincronizar() {
      /* presenceState() puede no existir si el canal se cerró entre medias. */
      const estado = typeof canal.presenceState === 'function' ? canal.presenceState() : {};
      setOtros(otrosPresentes(estado, miId));
    }

    canal
      .on('presence', { event: 'sync' }, sincronizar)
      .on('presence', { event: 'join' }, sincronizar)
      .on('presence', { event: 'leave' }, sincronizar)
      .subscribe((estado) => {
        const listo = estado === 'SUBSCRIBED';
        setConectado(listo);
        if (listo) {
          canal.track({
            id: miId,
            nombre: perfil?.nombre || '',
            foto_url: perfil?.foto_url || null,
            tab,
            editando,
            desde: desdeRef.current,
          });
        }
      });

    return () => {
      canalRef.current = null;
      setOtros([]);
      setConectado(false);
      supabase.removeChannel(canal);
    };
    /* Solo se rehace el canal si cambia el proyecto o la persona. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, miId]);

  /* Lo que estoy mirando sí se vuelve a anunciar en el canal existente. */
  useEffect(() => {
    const canal = canalRef.current;
    if (!canal || !conectado || !miId) return;
    canal.track({
      id: miId,
      nombre: perfil?.nombre || '',
      foto_url: perfil?.foto_url || null,
      tab,
      editando,
      desde: desdeRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editando, conectado, miId]);

  return { otros, conectado };
}

/* ---------------------------------------------------------------------------
   Barra con las personas que tienen el proyecto abierto.
   ------------------------------------------------------------------------- */
export function PresenciaBarra({ otros, etiquetaDeTab }) {
  if (!otros || otros.length === 0) return null;

  const editando = otros.filter((o) => o.editando);
  const mirando = otros.filter((o) => !o.editando);

  return (
    <div className="no-print flex items-center gap-3 flex-wrap bg-white border border-navy-200 rounded-xl px-3 py-2 mb-4">
      <div className="flex -space-x-2 shrink-0">
        {otros.slice(0, 6).map((o) => (
          <Avatar
            key={o.id}
            name={o.nombre}
            foto={o.foto_url}
            size="sm"
            title={o.editando ? `Editando ${etiquetaDeTab(o.editando)}` : 'Viendo este proyecto'}
          />
        ))}
        {otros.length > 6 && (
          <span className="w-7 h-7 rounded-full bg-navy-100 text-navy-600 text-[11px] font-bold flex items-center justify-center border-2 border-white">
            +{otros.length - 6}
          </span>
        )}
      </div>
      <div className="text-xs text-navy-500 flex flex-wrap items-center gap-x-3 gap-y-1">
        {editando.map((o) => (
          <span key={o.id} className="flex items-center gap-1 font-semibold text-amber-700">
            <Pencil className="w-3 h-3" /> {o.nombre} está editando {etiquetaDeTab(o.editando)}
          </span>
        ))}
        {mirando.length > 0 && (
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {mirando.map((o) => o.nombre).join(', ')} {mirando.length === 1 ? 'está viendo' : 'están viendo'} este proyecto
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Aviso dentro de una pestaña que otra persona está editando ahora mismo.
   ------------------------------------------------------------------------- */
export function AvisoPestanaOcupada({ personas, etiqueta }) {
  if (!personas || personas.length === 0) return null;
  const nombres = personas.map((p) => p.nombre).join(', ');
  return (
    <div className="no-print flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
      <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        <strong>{nombres}</strong> {personas.length === 1 ? 'está editando' : 'están editando'} {etiqueta} en este momento.
        Si guardas, lo último que se guarde es lo que queda.
      </span>
    </div>
  );
}
