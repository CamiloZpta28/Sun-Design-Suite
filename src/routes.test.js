/* ============================================================================
   DIRECCIONES DE CADA SECCIÓN — ida y vuelta entre URL y estado de navegación.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { RUTAS_VISTA, rutaDe, estadoDeRuta } from './routes.js';

describe('rutaDe', () => {
  it('cada sección del menú tiene su propia dirección, y ninguna se repite', () => {
    const rutas = Object.values(RUTAS_VISTA);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('un proyecto abierto lleva su id en la dirección', () => {
    expect(rutaDe({ view: 'detalle', selectedId: 'proj-123' })).toBe('/proyecto/proj-123');
  });

  it('la ficha de una persona lleva su id en la dirección', () => {
    expect(rutaDe({ view: 'equipo', selectedPersonId: 'user-9' })).toBe('/equipo/user-9');
  });

  it('la lista del equipo (sin persona abierta) es /equipo', () => {
    expect(rutaDe({ view: 'equipo', selectedPersonId: null })).toBe('/equipo');
  });

  it('una vista sin dirección declarada cae en la raíz', () => {
    expect(rutaDe({ view: 'inventada' })).toBe('/');
  });

  /* Sin id no hay a dónde apuntar: mandar a /proyecto/undefined dejaría un
     link roto que además reventaría al abrirse. */
  it('detalle sin proyecto seleccionado no arma una dirección rota', () => {
    expect(rutaDe({ view: 'detalle', selectedId: null })).toBe('/');
  });
});

describe('estadoDeRuta', () => {
  it('reconoce todas las secciones del menú', () => {
    Object.entries(RUTAS_VISTA).forEach(([vista, ruta]) => {
      expect(estadoDeRuta(ruta).view, ruta).toBe(vista);
    });
  });

  it('reconoce un proyecto', () => {
    expect(estadoDeRuta('/proyecto/proj-123')).toEqual({
      view: 'detalle',
      selectedId: 'proj-123',
      selectedPersonId: null,
    });
  });

  it('reconoce la ficha de una persona', () => {
    expect(estadoDeRuta('/equipo/user-9')).toEqual({
      view: 'equipo',
      selectedId: null,
      selectedPersonId: 'user-9',
    });
  });

  it('ignora la barra final', () => {
    expect(estadoDeRuta('/cimentaciones/').view).toBe('cimentaciones');
    expect(estadoDeRuta('/').view).toBe('dashboard');
  });

  it('una dirección desconocida cae al Dashboard, nunca a una pantalla vacía', () => {
    expect(estadoDeRuta('/lo-que-sea').view).toBe('dashboard');
    expect(estadoDeRuta('').view).toBe('dashboard');
    expect(estadoDeRuta(null).view).toBe('dashboard');
  });

  it('ida y vuelta: toda dirección generada se vuelve a leer igual', () => {
    const estados = [
      { view: 'cimentaciones', selectedId: null, selectedPersonId: null },
      { view: 'detalle', selectedId: 'proj-abc-123', selectedPersonId: null },
      { view: 'equipo', selectedId: null, selectedPersonId: 'a1b2-c3d4' },
      { view: 'dashboard', selectedId: null, selectedPersonId: null },
    ];
    estados.forEach((estado) => {
      expect(estadoDeRuta(rutaDe(estado)), estado.view).toEqual(estado);
    });
  });
});
