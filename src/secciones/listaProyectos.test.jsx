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

const { ProjectListView, ProjectFormModal, MisRevisiones } = await import('../App.jsx');

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

describe('lo que la búsqueda encuentra pero el filtro esconde', () => {
  /* Pasó de verdad: alguien buscó un proyecto en pausa, la lista abría en
     Activos, no salió nada, y creyó que se había borrado. */
  const buscar = (texto) => fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), { target: { value: texto } });

  it('si el filtro esconde lo que se buscó, lo dice y deja verlo', () => {
    pintar({ archivarFinalizados: true, estadoInicial: 'activo' });
    buscar('pausado');
    expect(screen.getByText(/Con este filtro no hay nada, pero hay/)).toBeTruthy();
    fireEvent.click(screen.getByText('1 en pausa'));
    expect(screen.getByText('Pausado Dos')).toBeTruthy();
  });

  it('un finalizado escondido lleva a la pestaña de finalizados', () => {
    pintar({ archivarFinalizados: true, estadoInicial: 'activo' });
    buscar('cuatro');
    fireEvent.click(screen.getByText('1 finalizado'));
    expect(screen.getByText('Finalizado Cuatro')).toBeTruthy();
  });

  it('si algo sí se ve, avisa de lo demás como "además"', () => {
    pintar({ archivarFinalizados: true, estadoInicial: 'activo' });
    buscar('o');
    expect(screen.getByText('Activo Uno')).toBeTruthy();
    expect(screen.getByText(/Además hay/)).toBeTruthy();
  });

  /* Sin nada escrito, lo escondido es lo que uno filtró a propósito. */
  it('sin búsqueda no dice nada', () => {
    pintar({ archivarFinalizados: true, estadoInicial: 'activo' });
    expect(screen.queryByText(/Además hay|pero hay/)).toBe(null);
  });

  it('si no hay nada escondido, no dice nada', () => {
    pintar({ archivarFinalizados: true, estadoInicial: 'todos' });
    buscar('pausado');
    expect(screen.getByText('Pausado Dos')).toBeTruthy();
    expect(screen.queryByText(/Además hay|pero hay/)).toBe(null);
  });
});

describe('el aviso de proyecto repetido', () => {
  const existente = {
    id: 'pb', nombre: 'Paratebueno Sur', estado: 'pausa', equipo: {}, documentos: {},
    data: { general: { departamento: 'Cundinamarca', numero_minigranja: '3', numero_predio: '1' } },
  };

  function llenarCodigo() {
    const departamento = screen.getAllByRole('combobox')
      .find((c) => [...c.options].some((o) => o.value === 'Cundinamarca'));
    fireEvent.change(departamento, { target: { value: 'Cundinamarca' } });
    fireEvent.change(screen.getByText('N.° de minigranja').parentElement.querySelector('input'), { target: { value: '3' } });
    fireEvent.change(screen.getByText('N.° de predio').parentElement.querySelector('input'), { target: { value: '1' } });
  }

  function pintarFormulario(props = {}) {
    return render(
      <ProjectFormModal
        onClose={() => {}}
        onCreate={() => {}}
        directorio={[]}
        perfil={{ id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] }}
        inversionistas={[]}
        onAddInversionista={() => {}}
        paises={['Colombia']}
        onAddPais={() => {}}
        projects={[existente]}
        dossiers={[]}
        inversionistasDetalle={[]}
        {...props}
      />,
    );
  }

  /* Decir el estado es lo que faltaba: uno en pausa no sale en Activos. */
  it('dice en qué estado está el proyecto que ya tiene ese código', () => {
    pintarFormulario();
    llenarCodigo();
    expect(screen.getByText('Paratebueno Sur')).toBeTruthy();
    expect(screen.getByText(/\(en pausa\)/)).toBeTruthy();
  });

  it('y deja abrirlo de una vez', () => {
    const abiertos = [];
    pintarFormulario({ onAbrirProyecto: (id) => abiertos.push(id) });
    llenarCodigo();
    fireEvent.click(screen.getByText('ábrelo aquí'));
    expect(abiertos).toEqual(['pb']);
  });
});

describe('Mis revisiones', () => {
  it('muestra los proyectos que la persona revisa, y abre el que se pulsa', () => {
    const onOpen = vi.fn();
    render(<MisRevisiones projects={[proyecto('p1', 'Activo Uno', 'activo')]} onOpen={onOpen} directorio={[]} />);
    expect(screen.getByText('Mis revisiones')).toBeTruthy();
    fireEvent.click(screen.getByText('Activo Uno'));
    expect(onOpen).toHaveBeenCalledWith('p1');
  });

  it('sin revisiones lo dice', () => {
    render(<MisRevisiones projects={[]} onOpen={() => {}} directorio={[]} />);
    expect(screen.getByText(/Todavía no te han asignado como revisor/)).toBeTruthy();
  });
});
