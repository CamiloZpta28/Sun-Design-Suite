// @vitest-environment jsdom
/* ============================================================================
   FICHA DE UN PROYECTO — render real.
   ----------------------------------------------------------------------------
   Es la pantalla que más se usa y la que más código reúne (las 7 pestañas
   técnicas, Control Documental, Notas, Historial, Notas Técnicas y la hoja de
   vida imprimible), así que se recorre entera: se abre cada pestaña, con un
   proyecto lleno y con uno vacío —el caso de los proyectos viejos, a los que
   les faltan campos que se agregaron después—.

   Supabase se sustituye por un doble: la ficha lo llama al guardar y al pedir
   el historial, y aquí no hay (ni debe haber) conexión a la base de datos.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/* Doble de Supabase: cualquier cadena de llamadas termina en una respuesta
   vacía, que es lo que la ficha espera cuando no hay datos. */
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

const { default: ProjectDetail, PrintableReport, FieldRenderer } = await import('./Proyecto.jsx');
const { SCHEMA } = await import('../shared/dominio.jsx');

afterEach(cleanup);

const perfilLider = { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] };
const perfilAjeno = { id: 'u2', nombre: 'Beto', roles: ['civil'] };

function proyecto(overrides = {}) {
  return {
    id: 'proj-1',
    nombre: 'Minigranja de prueba',
    estado: 'activo',
    equipo: { civil: ['Ana'], electrico: ['Ana'] },
    data: {
      general: {
        departamento: 'Boyacá', municipio: 'Tunja', pais: 'Colombia',
        numero_minigranja: '147', numero_predio: '1', inversionista: 'FENOGE',
      },
      civil: {},
      estructural: {},
    },
    archivos: [],
    notas: [{ id: 'n1', texto: 'Una nota **importante**', autor: 'Ana', fecha: '2026-08-01T10:00:00.000Z' }],
    documentos: {},
    created_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

const props = {
  updateProject: () => {},
  onBack: () => {},
  onDelete: () => {},
  directorio: [
    { id: 'u1', nombre: 'Ana', roles: ['lider_diseno', 'civil'] },
    { id: 'u2', nombre: 'Beto', roles: ['electrico'] },
  ],
  inversionistas: ['FENOGE', 'CFM'],
  onAddInversionista: () => {},
  paises: ['Colombia'],
  onAddPais: () => {},
  proveedores: ['TRINA'],
  onAddProveedor: () => {},
  plantillasCimentacion: [],
  plantillasEquipos: [],
  inversionistasDetalle: [],
  operadoresRed: [],
  onAddOperadorRed: () => {},
  instaladores: [],
  onAddInstalador: () => {},
  ingenierosProyectos: [],
  onAddIngenieroProyectos: () => {},
  onUpdateCatalogoAtributo: () => {},
};

describe('ProjectDetail', () => {
  it('abre un proyecto con datos', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} />);
    expect(screen.getAllByText(/Minigranja de prueba/).length).toBeGreaterThan(0);
  });

  /* Un proyecto creado antes de que existieran varios campos: `data` casi
     vacío. Es el escenario que históricamente dejaba la pantalla en blanco. */
  it('abre un proyecto viejo, sin datos', () => {
    render(<ProjectDetail project={proyecto({ data: {}, notas: [], documentos: {} })} perfil={perfilLider} {...props} />);
    expect(screen.getAllByText(/Minigranja de prueba/).length).toBeGreaterThan(0);
  });

  it('abre un proyecto para alguien que no está en su equipo (solo lectura)', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilAjeno} {...props} />);
    expect(screen.getAllByText(/Minigranja de prueba/).length).toBeGreaterThan(0);
  });

  /* Cada pestaña técnica pinta sus campos con FieldRenderer, que es donde
     viven los tipos raros (coordenadas, tablas, plantillas, plegables). */
  /* Las pestañas se buscan por el texto del botón (no por un nodo de texto
     exacto): algunas llevan además un ícono y un contador, ej. "Notas (1)". */
  const PESTANAS = [...SCHEMA.map((s) => s.label), 'Control Documental', 'Notas Técnicas', 'Notas', 'Historial'];
  const botonDePestana = (etiqueta) => screen.getAllByRole('button')
    .find((b) => b.textContent.trim().replace(/\s+/g, ' ').startsWith(etiqueta));

  it('recorre todas las pestañas sin romperse', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} />);
    PESTANAS.forEach((etiqueta) => {
      const boton = botonDePestana(etiqueta);
      expect(boton, etiqueta).toBeTruthy();
      fireEvent.click(boton);
    });
  });

  it('recorre todas las pestañas de un proyecto vacío', () => {
    render(<ProjectDetail project={proyecto({ data: {}, notas: [], documentos: {} })} perfil={perfilLider} {...props} />);
    PESTANAS.forEach((etiqueta) => {
      const boton = botonDePestana(etiqueta);
      expect(boton, etiqueta).toBeTruthy();
      fireEvent.click(boton);
    });
    expect(screen.getAllByText(/Minigranja de prueba/).length).toBeGreaterThan(0);
  });
});

describe('PrintableReport (hoja de vida imprimible)', () => {
  it('se arma con un proyecto completo', () => {
    const { container } = render(
      <PrintableReport project={proyecto()} plantillasCimentacion={[]} plantillasEquipos={[]} />,
    );
    expect(container.textContent).toContain('Hoja de Vida');
  });

  it('se arma con un proyecto vacío', () => {
    const { container } = render(
      <PrintableReport project={proyecto({ data: {}, notas: [], documentos: {} })} plantillasCimentacion={[]} plantillasEquipos={[]} />,
    );
    expect(container.textContent).toContain('Hoja de Vida');
  });
});

describe('FieldRenderer', () => {
  /* Todos los tipos de campo declarados en SCHEMA, en modo lectura y en modo
     edición: si alguno quedó sin su componente al mover el código, revienta
     aquí y no en la pantalla de un ingeniero. */
  const tipos = [...new Set(SCHEMA.flatMap((s) => s.fields.map((f) => f.type)))];

  tipos.forEach((tipo) => {
    it(`pinta un campo de tipo "${tipo}" en lectura y en edición`, () => {
      const field = SCHEMA.flatMap((s) => s.fields).find((f) => f.type === tipo);
      [false, true].forEach((editMode) => {
        const { container } = render(
          <FieldRenderer
            field={field}
            value={undefined}
            editMode={editMode}
            onChange={() => {}}
            siblingData={{}}
            inversionistas={['FENOGE']}
            onAddInversionista={() => {}}
            paises={['Colombia']}
            onAddPais={() => {}}
            proveedores={[]}
            onAddProveedor={() => {}}
            plantillasCimentacion={[]}
            plantillasEquipos={[]}
            inversionistasDetalle={[]}
            operadoresRed={[]}
            onAddOperadorRed={() => {}}
            instaladores={[]}
            onAddInstalador={() => {}}
            ingenierosProyectos={[]}
            onUpdateCatalogoAtributo={() => {}}
          />,
        );
        expect(container, `${tipo} (editMode=${editMode})`).toBeTruthy();
        cleanup();
      });
    });
  });
});
