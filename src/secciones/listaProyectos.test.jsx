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
    const bloque = app.slice(app.indexOf("view === 'todos'"), app.indexOf("view === 'resumen_inversionistas'"));
    expect(bloque).toContain('title="Todos los Proyectos"');
    expect(bloque).toContain('estadoInicial="activo"');
  });
});
