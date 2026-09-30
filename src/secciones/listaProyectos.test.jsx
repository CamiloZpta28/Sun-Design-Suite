// @vitest-environment jsdom
/* ============================================================================
   LISTA DE PROYECTOS — "Todos los proyectos" y sus hermanas.
   ----------------------------------------------------------------------------
   La misma lista sirve para varias pantallas; lo que cambia entre ellas son
   los valores por defecto. Esta prueba cubre el que importa: "Todos los
   proyectos" abre en los activos, no en el portafolio entero.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/* Doble de Supabase: App.jsx lo importa al cargarse, y aquí no hay (ni debe
   haber) conexión a la base de datos. */
vi.mock('../supabaseClient', () => {
  const respuesta = Promise.resolve({ data: [], error: null });
  const cadena = () => new Proxy(() => cadena(), {
    get: (_, prop) => {
      if (prop === 'then') return respuesta.then.bind(respuesta);
      return () => cadena();
    },
    apply: () => cadena(),
  });
  return { supabase: cadena() };
});

const { ProjectListView } = await import('../App.jsx');

afterEach(cleanup);

const proyecto = (id, nombre, estado) => ({
  id, nombre, estado, equipo: {}, documentos: {},
  data: { general: { inversionista: 'FENOGE' } },
});

const CARTERA = [
  proyecto('p1', 'Activo Uno', 'activo'),
  proyecto('p2', 'Pausado Dos', 'pausa'),
  proyecto('p3', 'Inactivo Tres', 'inactivo'),
  proyecto('p4', 'Finalizado Cuatro', 'finalizado'),
];

function pintar(props = {}) {
  return render(
    <ProjectListView
      projects={CARTERA}
      title="Todos los Proyectos"
      subtitle="Portafolio completo"
      onOpen={() => {}}
      onNewProject={() => {}}
      directorio={[]}
      {...props}
    />,
  );
}

const selectorDeEstado = () => screen.getByDisplayValue(/Todos los estados|Activo|En Pausa|Inactivo|Finalizado/);

describe('"Todos los proyectos" abre en los activos', () => {
  /* Es lo que se está trabajando; lo demás sigue a un clic en el filtro. */
  it('con estadoInicial="activo" solo muestra los activos', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    expect(screen.getByText('Activo Uno')).toBeTruthy();
    expect(screen.queryByText('Pausado Dos')).toBe(null);
    expect(screen.queryByText('Inactivo Tres')).toBe(null);
  });

  it('el filtro arranca puesto en Activo, no en blanco', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    expect(selectorDeEstado().value).toBe('activo');
  });

  /* Ver el portafolio completo sigue siendo un clic. */
  it('cambiar el filtro a "todos los estados" los trae de vuelta', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    fireEvent.change(selectorDeEstado(), { target: { value: 'todos' } });
    expect(screen.getByText('Pausado Dos')).toBeTruthy();
    expect(screen.getByText('Inactivo Tres')).toBeTruthy();
  });

  /* Las otras listas que usan este mismo componente no cambian. */
  it('sin estadoInicial se comporta como siempre: muestra todo', () => {
    pintar();
    expect(screen.getByText('Activo Uno')).toBeTruthy();
    expect(screen.getByText('Pausado Dos')).toBeTruthy();
    expect(screen.getByText('Finalizado Cuatro')).toBeTruthy();
  });
});

describe('el cableado en App.jsx', () => {
  /* Las pruebas de arriba comprueban que la lista respeta la prop, pero no
     que la pantalla "Todos los proyectos" se la pase: montar App entero pide
     sesión de Supabase. Esta lee el código fuente, que es poco elegante pero
     sí atrapa que alguien quite la prop — comprobado inyectando ese fallo. */
  it('"Todos los proyectos" arranca en los activos', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../App.jsx'), 'utf8');
    const bloque = app.slice(app.indexOf("vistaActual === 'todos'"), app.indexOf("vistaActual === 'resumen_inversionistas'"));
    expect(bloque).toContain('title="Todos los Proyectos"');
    expect(bloque).toContain('estadoInicial="activo"');
  });
});

describe('la pestaña de finalizados', () => {
  /* Regresión: al hacer que "Todos los proyectos" abriera en los activos, el
     filtro de estado se quedaba en 'activo' también en la pestaña de
     archivados —donde el selector ni siquiera se muestra—, así que los
     finalizados quedaban escondidos detrás de un filtro invisible. */
  const irAFinalizados = () => fireEvent.click(screen.getByText(/Finalizados/));

  it('muestra los finalizados aunque la lista abra en los activos', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    irAFinalizados();
    expect(screen.getByText('Finalizado Cuatro')).toBeTruthy();
    expect(screen.queryByText(/No hay proyectos finalizados/)).toBe(null);
  });

  it('el contador de la pestaña coincide con lo que se ve', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    expect(screen.getByText('Finalizados (1)')).toBeTruthy();
    irAFinalizados();
    expect(screen.getAllByText('Finalizado Cuatro')).toHaveLength(1);
  });

  /* Y al volver, los activos siguen filtrados como estaban. */
  it('volver a activos conserva el filtro', () => {
    pintar({ estadoInicial: 'activo', archivarFinalizados: true });
    irAFinalizados();
    fireEvent.click(screen.getByText(/Activos/));
    expect(screen.getByText('Activo Uno')).toBeTruthy();
    expect(screen.queryByText('Pausado Dos')).toBe(null);
  });
});
