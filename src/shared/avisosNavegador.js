/* ============================================================================
   AVISOS DEL NAVEGADOR
   ----------------------------------------------------------------------------
   Las notificaciones de la campanita solo se ven si uno está mirando la
   pestaña. Con permiso del navegador, además salen como aviso del sistema,
   así que llegan aunque la plataforma esté en otra pestaña o detrás de otra
   ventana.

   LO QUE ESTO NO ES: una notificación con la plataforma cerrada. Eso pide un
   service worker, Web Push y un servidor que empuje los avisos —otro
   proyecto—. Aquí el aviso sale mientras la aplicación esté abierta en alguna
   pestaña, que es donde está casi todo el valor y nada de la infraestructura.

   Dos decisiones que conviene tener presentes:

   1. El permiso NO se pide al entrar. Un navegador que pregunta por
      notificaciones apenas abre una página se responde "bloquear" por
      reflejo, y bloquearlo es difícil de deshacer. Se pide cuando la persona
      lo enciende a propósito.

   2. Encendido y permiso son dos cosas distintas. El permiso lo da el
      navegador y vive en él; el interruptor es de la persona y vive en este
      equipo (localStorage), para poder apagarlo sin tener que ir a la
      configuración del navegador.
   ============================================================================ */

const CLAVE = 'sds_avisos_navegador';

export function soportado() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/* 'default' (todavía no se ha preguntado), 'granted' o 'denied'. */
export function permiso() {
  return soportado() ? window.Notification.permission : 'unsupported';
}

/* El interruptor de esta persona en este equipo. Se lee con cuidado porque
   en una ventana privada —o con las cookies bloqueadas— el acceso revienta. */
export function avisosEncendidos() {
  try {
    return window.localStorage.getItem(CLAVE) === 'si';
  } catch {
    return false;
  }
}

export function guardarEncendidos(encendidos) {
  try {
    window.localStorage.setItem(CLAVE, encendidos ? 'si' : 'no');
  } catch {
    /* Sin localStorage el interruptor no sobrevive al refresco. No es motivo
       para no dejar encenderlo en esta sesión. */
  }
}

/* Pide el permiso y devuelve si quedó concedido. Solo se llama desde un clic:
   varios navegadores ignoran la petición si no viene de un gesto. */
export async function pedirPermiso() {
  if (!soportado()) return false;
  if (window.Notification.permission === 'granted') return true;
  if (window.Notification.permission === 'denied') return false;
  try {
    return (await window.Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/* Enciende los avisos: pide permiso si hace falta y guarda la decisión.
   Devuelve por qué no se pudo, cuando no se pudo, para poder decirlo. */
export async function encenderAvisos() {
  if (!soportado()) return { ok: false, motivo: 'sin_soporte' };
  if (permiso() === 'denied') return { ok: false, motivo: 'bloqueado' };
  const concedido = await pedirPermiso();
  if (!concedido) return { ok: false, motivo: 'sin_permiso' };
  guardarEncendidos(true);
  return { ok: true };
}

export function apagarAvisos() {
  guardarEncendidos(false);
}

/* ¿Hay que mostrar un aviso del sistema ahora mismo? Solo si la persona lo
   encendió, el navegador lo permite y la pestaña NO está a la vista: si la
   está mirando, la campanita ya se lo dice y el aviso del sistema sobra. */
export function debeAvisar({ oculto = typeof document !== 'undefined' && document.hidden } = {}) {
  return soportado() && permiso() === 'granted' && avisosEncendidos() && !!oculto;
}

/* Muestra el aviso. `tag` evita que veinte avisos del mismo proyecto se
   apilen: el navegador reemplaza el anterior. */
export function mostrarAviso({ titulo, cuerpo, tag, icono, alAbrir }) {
  if (!soportado() || permiso() !== 'granted') return null;
  try {
    const aviso = new window.Notification(titulo, { body: cuerpo, tag, icon: icono });
    aviso.onclick = () => {
      try { window.focus(); } catch { /* algunos navegadores no dejan */ }
      aviso.close();
      alAbrir?.();
    };
    return aviso;
  } catch {
    /* Si el navegador lo rechaza —o estamos en un contexto sin permiso— no
       pasa nada: la notificación sigue estando en la campanita. */
    return null;
  }
}
