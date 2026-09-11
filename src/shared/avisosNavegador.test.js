/* ============================================================================
   AVISOS DEL NAVEGADOR
   ----------------------------------------------------------------------------
   La API de notificaciones no existe en las pruebas, así que se sustituye por
   un doble. Lo que se comprueba es la política, que es donde están las
   decisiones: cuándo se pide el permiso, cuándo NO se muestra un aviso, y que
   nada de esto reviente en un navegador que no lo soporta.
   ============================================================================ */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  soportado, permiso, avisosEncendidos, guardarEncendidos,
  encenderAvisos, apagarAvisos, debeAvisar, mostrarAviso,
} from './avisosNavegador.js';

/* Un doble de Notification: recuerda lo que se le pidió mostrar. */
function conNotificaciones({ estado = 'default', alPedir = 'granted' } = {}) {
  const mostrados = [];
  class Falsa {
    constructor(titulo, opciones) {
      this.titulo = titulo;
      this.opciones = opciones;
      this.close = vi.fn();
      mostrados.push(this);
    }
  }
  Falsa.permission = estado;
  Falsa.requestPermission = vi.fn(async () => { Falsa.permission = alPedir; return alPedir; });
  window.Notification = Falsa;
  return { mostrados, Falsa };
}

function sinNotificaciones() {
  delete window.Notification;
}

/* localStorage tampoco existe en node. */
function conAlmacenamiento({ revienta = false } = {}) {
  const datos = new Map();
  window.localStorage = {
    getItem: (k) => {
      if (revienta) throw new Error('bloqueado');
      return datos.has(k) ? datos.get(k) : null;
    },
    setItem: (k, v) => {
      if (revienta) throw new Error('bloqueado');
      datos.set(k, v);
    },
  };
  return datos;
}

beforeEach(() => {
  global.window = {};
  global.document = { hidden: true };
  conAlmacenamiento();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('un navegador que no las soporta', () => {
  it('no revienta en ninguna parte', async () => {
    sinNotificaciones();
    expect(soportado()).toBe(false);
    expect(permiso()).toBe('unsupported');
    expect(debeAvisar()).toBe(false);
    expect(mostrarAviso({ titulo: 'Hola' })).toBe(null);
    expect(await encenderAvisos()).toEqual({ ok: false, motivo: 'sin_soporte' });
  });
});

describe('encender los avisos', () => {
  /* El permiso se pide al encender, no al entrar: preguntar apenas abre la
     página se responde "bloquear" por reflejo. */
  it('pide el permiso y lo deja guardado', async () => {
    const { Falsa } = conNotificaciones({ estado: 'default', alPedir: 'granted' });
    expect(avisosEncendidos()).toBe(false);
    expect(await encenderAvisos()).toEqual({ ok: true });
    expect(Falsa.requestPermission).toHaveBeenCalledTimes(1);
    expect(avisosEncendidos()).toBe(true);
  });

  it('si la persona dice que no, no queda encendido', async () => {
    conNotificaciones({ estado: 'default', alPedir: 'denied' });
    expect(await encenderAvisos()).toEqual({ ok: false, motivo: 'sin_permiso' });
    expect(avisosEncendidos()).toBe(false);
  });

  /* Con el sitio bloqueado no tiene sentido volver a preguntar: el navegador
     ni siquiera muestra el diálogo. */
  it('con el sitio bloqueado lo dice en vez de insistir', async () => {
    const { Falsa } = conNotificaciones({ estado: 'denied' });
    expect(await encenderAvisos()).toEqual({ ok: false, motivo: 'bloqueado' });
    expect(Falsa.requestPermission).not.toHaveBeenCalled();
  });

  it('con el permiso ya dado no vuelve a preguntar', async () => {
    const { Falsa } = conNotificaciones({ estado: 'granted' });
    expect(await encenderAvisos()).toEqual({ ok: true });
    expect(Falsa.requestPermission).not.toHaveBeenCalled();
  });

  it('apagarlos no toca el permiso del navegador', () => {
    conNotificaciones({ estado: 'granted' });
    guardarEncendidos(true);
    apagarAvisos();
    expect(avisosEncendidos()).toBe(false);
    expect(permiso()).toBe('granted');
  });

  /* En una ventana privada el acceso a localStorage revienta. Eso no puede
     tumbar la campanita. */
  it('sin localStorage se comporta como apagado, sin romperse', () => {
    conNotificaciones({ estado: 'granted' });
    conAlmacenamiento({ revienta: true });
    expect(avisosEncendidos()).toBe(false);
    expect(() => guardarEncendidos(true)).not.toThrow();
  });
});

describe('cuándo sale un aviso', () => {
  const encendidoYConPermiso = () => {
    conNotificaciones({ estado: 'granted' });
    guardarEncendidos(true);
  };

  it('con permiso, encendido y la pestaña escondida', () => {
    encendidoYConPermiso();
    expect(debeAvisar({ oculto: true })).toBe(true);
  });

  /* Si está mirando la pestaña, la campanita ya se lo dice: el aviso del
     sistema encima sería ruido. */
  it('no si la persona está mirando la pestaña', () => {
    encendidoYConPermiso();
    expect(debeAvisar({ oculto: false })).toBe(false);
  });

  it('no si los apagó, aunque el navegador lo permita', () => {
    conNotificaciones({ estado: 'granted' });
    guardarEncendidos(false);
    expect(debeAvisar({ oculto: true })).toBe(false);
  });

  it('no si el navegador no ha dado permiso', () => {
    conNotificaciones({ estado: 'default' });
    guardarEncendidos(true);
    expect(debeAvisar({ oculto: true })).toBe(false);
  });
});

describe('mostrar el aviso', () => {
  it('lleva el mensaje y una etiqueta para no apilarse', () => {
    const { mostrados } = conNotificaciones({ estado: 'granted' });
    mostrarAviso({ titulo: 'Sun Design Suite', cuerpo: 'Ana actualizó Chinú 3', tag: 'n1' });
    expect(mostrados).toHaveLength(1);
    expect(mostrados[0].titulo).toBe('Sun Design Suite');
    expect(mostrados[0].opciones.body).toBe('Ana actualizó Chinú 3');
    expect(mostrados[0].opciones.tag).toBe('n1');
  });

  it('al hacerle clic abre lo que corresponda y se cierra', () => {
    const { mostrados } = conNotificaciones({ estado: 'granted' });
    const alAbrir = vi.fn();
    window.focus = vi.fn();
    mostrarAviso({ titulo: 'x', cuerpo: 'y', alAbrir });
    mostrados[0].onclick();
    expect(alAbrir).toHaveBeenCalledTimes(1);
    expect(mostrados[0].close).toHaveBeenCalled();
  });

  it('sin permiso no muestra nada', () => {
    const { mostrados } = conNotificaciones({ estado: 'default' });
    expect(mostrarAviso({ titulo: 'x' })).toBe(null);
    expect(mostrados).toHaveLength(0);
  });

  /* Si el navegador rechaza el constructor —pasa en algunos móviles— la
     notificación sigue estando en la campanita. */
  it('si el navegador lo rechaza, no tumba nada', () => {
    conNotificaciones({ estado: 'granted' });
    window.Notification = class { constructor() { throw new Error('no se puede'); } };
    window.Notification.permission = 'granted';
    expect(mostrarAviso({ titulo: 'x' })).toBe(null);
  });
});
