// @vitest-environment jsdom
/* ============================================================================
   PRESENCIA EN VIVO — quién está en el proyecto.
   ----------------------------------------------------------------------------
   La parte con lógica de verdad es traducir el estado crudo de Supabase a
   "quiénes son los otros", así que ahí va el grueso de las pruebas. El canal
   se sustituye por un doble: aquí no hay (ni debe haber) conexión.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

/* Doble del canal de Supabase: guarda lo que se le anuncia y deja provocar
   un "sync" desde la prueba. */
const canalFalso = {
  estado: {},
  anunciados: [],
  handlers: {},
  quitado: false,
  on(tipo, filtro, cb) { this.handlers[filtro.event] = cb; return this; },
  subscribe(cb) { this.suscriptor = cb; cb('SUBSCRIBED'); return this; },
  track(meta) { this.anunciados.push(meta); return Promise.resolve('ok'); },
  presenceState() { return this.estado; },
  simularSync(estado) { this.estado = estado; this.handlers.sync?.(); },
  reiniciar() { this.estado = {}; this.anunciados = []; this.handlers = {}; this.quitado = false; },
};

vi.mock('../supabaseClient', () => ({
  supabase: {
    channel: () => canalFalso,
    removeChannel: () => { canalFalso.quitado = true; },
  },
}));

const { otrosPresentes, quienEdita, canalDeProyecto, usePresenciaProyecto, PresenciaBarra, AvisoPestanaOcupada } = await import('./presencia.jsx');

afterEach(() => { cleanup(); canalFalso.reiniciar(); });

const ana = { id: 'u1', nombre: 'Ana', foto_url: null, tab: 'civil', editando: null, desde: '2026-09-01T10:00:00.000Z' };
const beto = { id: 'u2', nombre: 'Beto', foto_url: null, tab: 'civil', editando: 'civil', desde: '2026-09-01T10:05:00.000Z' };
const caro = { id: 'u3', nombre: 'Caro', foto_url: null, tab: 'electrico', editando: null, desde: '2026-09-01T10:06:00.000Z' };

describe('otrosPresentes', () => {
  it('deja fuera a uno mismo', () => {
    const otros = otrosPresentes({ u1: [ana], u2: [beto] }, 'u1');
    expect(otros.map((o) => o.id)).toEqual(['u2']);
  });

  it('devuelve vacío si no hay nadie más', () => {
    expect(otrosPresentes({ u1: [ana] }, 'u1')).toEqual([]);
    expect(otrosPresentes({}, 'u1')).toEqual([]);
    expect(otrosPresentes(null, 'u1')).toEqual([]);
  });

  it('ordena por nombre', () => {
    const otros = otrosPresentes({ u3: [caro], u2: [beto] }, 'u1');
    expect(otros.map((o) => o.nombre)).toEqual(['Beto', 'Caro']);
  });

  /* Una misma persona con dos pestañas abiertas aparece una sola vez. */
  it('junta las varias pestañas de una misma persona', () => {
    const otraPestana = { ...beto, tab: 'notas', editando: null, desde: '2026-09-01T10:09:00.000Z' };
    const otros = otrosPresentes({ u2: [beto, otraPestana] }, 'u1');
    expect(otros).toHaveLength(1);
    /* Gana la que está editando, aunque se haya anunciado antes. */
    expect(otros[0].editando).toBe('civil');
  });

  it('si ninguna edita, gana la más reciente', () => {
    const vieja = { ...caro, tab: 'civil', desde: '2026-09-01T09:00:00.000Z' };
    const otros = otrosPresentes({ u3: [vieja, caro] }, 'u1');
    expect(otros[0].tab).toBe('electrico');
  });

  it('ignora entradas sin identificar', () => {
    expect(otrosPresentes({ x: [null, {}, { nombre: 'Sin id' }] }, 'u1')).toEqual([]);
  });
});

describe('quienEdita', () => {
  it('filtra por pestaña', () => {
    const otros = [beto, caro];
    expect(quienEdita(otros, 'civil').map((o) => o.nombre)).toEqual(['Beto']);
    expect(quienEdita(otros, 'electrico')).toEqual([]);
    expect(quienEdita(undefined, 'civil')).toEqual([]);
  });
});

describe('canal', () => {
  it('es el mismo nombre para todos los que abren ese proyecto', () => {
    expect(canalDeProyecto('proj-1')).toBe('proyecto:proj-1');
  });
});

describe('usePresenciaProyecto', () => {
  function Sonda({ projectId, perfil, tab, editando }) {
    const { otros, conectado } = usePresenciaProyecto({ projectId, perfil, tab, editando });
    return <div data-testid="sonda">{conectado ? 'conectado' : 'suelto'}:{otros.map((o) => o.nombre).join(',')}</div>;
  }

  it('se anuncia al entrar y muestra a los demás cuando llega el sync', () => {
    render(<Sonda projectId="proj-1" perfil={{ id: 'u1', nombre: 'Ana' }} tab="civil" editando={null} />);
    expect(canalFalso.anunciados[0]).toMatchObject({ id: 'u1', nombre: 'Ana', tab: 'civil', editando: null });

    act(() => canalFalso.simularSync({ u1: [ana], u2: [beto] }));
    expect(screen.getByTestId('sonda').textContent).toBe('conectado:Beto');
  });

  it('vuelve a anunciarse al cambiar de pestaña, sin rehacer el canal', () => {
    const { rerender } = render(<Sonda projectId="proj-1" perfil={{ id: 'u1', nombre: 'Ana' }} tab="civil" editando={null} />);
    const anunciosIniciales = canalFalso.anunciados.length;
    rerender(<Sonda projectId="proj-1" perfil={{ id: 'u1', nombre: 'Ana' }} tab="electrico" editando="electrico" />);
    expect(canalFalso.anunciados.length).toBeGreaterThan(anunciosIniciales);
    expect(canalFalso.anunciados.at(-1)).toMatchObject({ tab: 'electrico', editando: 'electrico' });
    expect(canalFalso.quitado).toBe(false);
  });

  it('suelta el canal al salir del proyecto', () => {
    const { unmount } = render(<Sonda projectId="proj-1" perfil={{ id: 'u1', nombre: 'Ana' }} tab="civil" editando={null} />);
    unmount();
    expect(canalFalso.quitado).toBe(true);
  });

  /* Sin perfil (todavía cargando) no hay a quién anunciar. */
  it('no se anuncia sin perfil', () => {
    render(<Sonda projectId="proj-1" perfil={null} tab="civil" editando={null} />);
    expect(canalFalso.anunciados).toEqual([]);
  });
});

describe('lo que se ve', () => {
  const etiqueta = (id) => ({ civil: 'Civil', electrico: 'Eléctrico' }[id] || id);

  it('no ocupa espacio si no hay nadie más', () => {
    const { container } = render(<PresenciaBarra otros={[]} etiquetaDeTab={etiqueta} />);
    expect(container.firstChild).toBe(null);
  });

  it('distingue a quien mira de quien edita', () => {
    render(<PresenciaBarra otros={[beto, caro]} etiquetaDeTab={etiqueta} />);
    expect(screen.getByText(/Beto está editando Civil/)).toBeTruthy();
    expect(screen.getByText(/Caro está viendo este proyecto/)).toBeTruthy();
  });

  it('resume cuando hay mucha gente', () => {
    const muchos = Array.from({ length: 9 }, (_, i) => ({ id: `u${i}`, nombre: `Persona ${i}`, editando: null }));
    render(<PresenciaBarra otros={muchos} etiquetaDeTab={etiqueta} />);
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('el aviso de pestaña ocupada solo sale si hay alguien', () => {
    const { container } = render(<AvisoPestanaOcupada personas={[]} etiqueta="Civil" />);
    expect(container.firstChild).toBe(null);
    cleanup();
    render(<AvisoPestanaOcupada personas={[beto]} etiqueta="Civil" />);
    expect(screen.getByText(/está editando Civil en este momento/)).toBeTruthy();
  });
});
