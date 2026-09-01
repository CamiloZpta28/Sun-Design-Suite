/* ============================================================================
   DIRECCIONES (URL) DE CADA SECCIÓN
   ----------------------------------------------------------------------------
   Cada sección tiene su propia dirección — /cimentaciones, /proyecto/<id>,
   /equipo/<id> — así un link se puede compartir por WhatsApp o correo y abre
   directamente donde toca, y recargar la página (F5) ya no devuelve al
   Dashboard.

   Sigue siendo una sola página: no hay librería de ruteo, solo el
   history.pushState que la app ya usaba, ahora escribiendo también la
   dirección. Para que un link directo funcione en Vercel hace falta
   `vercel.json`, que hace que cualquier dirección sirva index.html (si no, el
   servidor buscaría un archivo llamado "cimentaciones" y daría 404).

   Vive fuera de App.jsx para poder probarse sin montar la aplicación entera
   (ver routes.test.js): estas dos funciones son la única traducción entre lo
   que ve el usuario en la barra de direcciones y el estado de navegación.
   ============================================================================ */

/** Vista de la app <-> dirección, para las secciones sin parámetros. */
export const RUTAS_VISTA = {
  dashboard: '/',
  mis: '/mis-proyectos',
  revision: '/revision',
  todos: '/proyectos',
  resumen_inversionistas: '/inversionistas',
  cimentaciones: '/cimentaciones',
  equipos_electricos: '/equipos-electricos',
  canalizaciones: '/canalizaciones',
  cruces: '/cruces',
  actualizaciones: '/actualizaciones',
  equipo: '/equipo',
  instructivos: '/instructivos',
  enlaces: '/enlaces',
};

export const VISTA_POR_RUTA = Object.fromEntries(
  Object.entries(RUTAS_VISTA).map(([vista, ruta]) => [ruta, vista]),
);

/** Dirección que le corresponde a un estado de navegación. */
export function rutaDe({ view, selectedId, selectedPersonId }) {
  if (view === 'detalle' && selectedId) return `/proyecto/${encodeURIComponent(selectedId)}`;
  if (view === 'equipo' && selectedPersonId) return `/equipo/${encodeURIComponent(selectedPersonId)}`;
  return RUTAS_VISTA[view] || '/';
}

/** Estado de navegación que le corresponde a una dirección. Cualquier
 *  dirección desconocida cae al Dashboard, nunca a una pantalla vacía. */
export function estadoDeRuta(pathname) {
  const limpio = (pathname || '/').replace(/\/+$/, '') || '/';
  const vacio = { view: 'dashboard', selectedId: null, selectedPersonId: null };
  if (VISTA_POR_RUTA[limpio]) return { ...vacio, view: VISTA_POR_RUTA[limpio] };
  const proyecto = limpio.match(/^\/proyecto\/(.+)$/);
  if (proyecto) return { ...vacio, view: 'detalle', selectedId: decodeURIComponent(proyecto[1]) };
  const persona = limpio.match(/^\/equipo\/(.+)$/);
  if (persona) return { ...vacio, view: 'equipo', selectedPersonId: decodeURIComponent(persona[1]) };
  return vacio;
}
