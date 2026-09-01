// @vitest-environment jsdom
/* ============================================================================
   CAMBIOS EN VIVO — qué se hace con cada aviso que llega.
   ----------------------------------------------------------------------------
   Lo importante aquí es la política, no el transporte: los proyectos que
   nadie mira se refrescan solos, el que está abierto solo se avisa, y lo que
   uno mismo guardó no se avisa nunca.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

const canalFalso = {
  handlers: [],
  suscrito: false,
  quitado: false,
  on(tipo, filtro, cb) { this.handlers.push({ tipo, filtro, cb }); return this; },
  subscribe() { this.suscrito = true; return this; },
  /* Dispara el handler registrado para una tabla. */
  emitir(tabla, payload) {
    this.handlers.filter((h) => h.filtro.table === tabla).forEach((h) => h.cb(payload));
  },
  reiniciar() { this.handlers = []; this.suscrito = false; this.quitado = false; },
};

vi.mock('../supabaseClient', () => ({
  supabase: {
    channel: () => canalFalso,
    removeChannel: () => { canalFalso.quitado = true; },
  },
}));

const { useCambiosEnVivo, textoDeCambio, CANAL_CAMBIOS } = await import('./cambiosEnVivo.js');

afterEach(() => { cleanup(); canalFalso.reiniciar(); });

function montar(props = {}) {
  const espias = {
    onProyectoCambiado: vi.fn(),
    onProyectoEliminado: vi.fn(),
    onActividadAjena: vi.fn(),
  };
  function Sonda() {
    useCambiosEnVivo({ perfilId: 'u1', ...espias, ...props });
    return null;
  }
  const utils = render(<Sonda />);
  return { ...utils, ...espias };
}

describe('suscripción', () => {
  it('escucha projects y activity_log en un solo canal', () => {
    montar();
    expect(canalFalso.suscrito).toBe(true);
    expect(canalFalso.handlers.map((h) => h.filtro.table).sort()).toEqual(['activity_log', 'projects']);
    expect(CANAL_CAMBIOS).toBe('cambios-proyectos');
  });

  it('no se suscribe sin perfil (todavía cargando)', () => {
    montar({ perfilId: null });
    expect(canalFalso.suscrito).toBe(false);
  });

  it('no se suscribe si se le dice que no está activo', () => {
    montar({ activo: false });
    expect(canalFalso.suscrito).toBe(false);
  });

  it('suelta el canal al desmontar', () => {
    const { unmount } = montar();
    unmount();
    expect(canalFalso.quitado).toBe(true);
  });
});

describe('cambios en projects', () => {
  it('un proyecto actualizado se entrega tal cual', () => {
    const { onProyectoCambiado } = montar();
    canalFalso.emitir('projects', { eventType: 'UPDATE', new: { id: 'proj-1', nombre: 'Nuevo nombre' } });
    expect(onProyectoCambiado).toHaveBeenCalledWith({ id: 'proj-1', nombre: 'Nuevo nombre' });
  });

  it('un proyecto nuevo también', () => {
    const { onProyectoCambiado } = montar();
    canalFalso.emitir('projects', { eventType: 'INSERT', new: { id: 'proj-9' } });
    expect(onProyectoCambiado).toHaveBeenCalledWith({ id: 'proj-9' });
  });

  it('un proyecto eliminado avisa por su propio camino', () => {
    const { onProyectoCambiado, onProyectoEliminado } = montar();
    canalFalso.emitir('projects', { eventType: 'DELETE', old: { id: 'proj-1' } });
    expect(onProyectoEliminado).toHaveBeenCalledWith('proj-1');
    expect(onProyectoCambiado).not.toHaveBeenCalled();
  });

  it('un aviso sin fila no rompe nada', () => {
    const { onProyectoCambiado, onProyectoEliminado } = montar();
    canalFalso.emitir('projects', { eventType: 'UPDATE', new: null });
    canalFalso.emitir('projects', { eventType: 'DELETE', old: null });
    expect(onProyectoCambiado).not.toHaveBeenCalled();
    expect(onProyectoEliminado).not.toHaveBeenCalled();
  });
});

describe('historial ajeno', () => {
  it('avisa de lo que hizo otra persona', () => {
    const { onActividadAjena } = montar();
    const registro = { project_id: 'proj-1', usuario_id: 'u2', usuario_nombre: 'Beto', accion: 'Actualizó la pestaña Civil' };
    canalFalso.emitir('activity_log', { eventType: 'INSERT', new: registro });
    expect(onActividadAjena).toHaveBeenCalledWith(registro);
  });

  /* Lo que uno acaba de guardar ya está en su pantalla. */
  it('NO avisa de lo que uno mismo guardó', () => {
    const { onActividadAjena } = montar();
    canalFalso.emitir('activity_log', {
      eventType: 'INSERT',
      new: { project_id: 'proj-1', usuario_id: 'u1', usuario_nombre: 'Ana', accion: 'Guardó Civil' },
    });
    expect(onActividadAjena).not.toHaveBeenCalled();
  });

  it('un registro sin autor sí avisa (mejor de más que de menos)', () => {
    const { onActividadAjena } = montar();
    canalFalso.emitir('activity_log', { eventType: 'INSERT', new: { project_id: 'proj-1', accion: 'Algo' } });
    expect(onActividadAjena).toHaveBeenCalled();
  });
});

describe('textoDeCambio', () => {
  it('junta a la persona con lo que hizo', () => {
    expect(textoDeCambio({ usuario_nombre: 'Ana Gómez', accion: 'Actualizó la pestaña Civil' }))
      .toBe('Ana Gómez · Actualizó la pestaña Civil');
  });

  it('sin acción, dice lo genérico', () => {
    expect(textoDeCambio({ usuario_nombre: 'Ana' })).toBe('Ana actualizó este proyecto');
  });

  it('sin nombre, no deja el hueco', () => {
    expect(textoDeCambio({ accion: 'Cambió el estado' })).toBe('Alguien · Cambió el estado');
    expect(textoDeCambio(null)).toBe('');
  });
});
