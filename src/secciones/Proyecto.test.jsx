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

const {
  default: ProjectDetail, PrintableReport, FieldRenderer, VersionesTracker,
  DESCRIPCION_PRIMERA_VERSION,
} = await import('./Proyecto.jsx');
const { SCHEMA, DOC_ESTADOS } = await import('../shared/dominio.jsx');

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

describe('aviso de que otra persona guardó', () => {
  it('no aparece si no hay nada nuevo', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} cambioPendiente={null} />);
    expect(screen.queryByText('Ver cambios')).toBe(null);
  });

  /* Aparece, pero NO recarga nada: los datos en pantalla siguen siendo los
     que estaban hasta que la persona lo pide. */
  it('aparece con quién y qué, y solo trae los cambios al pedirlo', () => {
    const onVerCambios = vi.fn();
    render(
      <ProjectDetail
        project={proyecto()}
        perfil={perfilLider}
        {...props}
        cambioPendiente={{ projectId: 'proj-1', texto: 'Beto · Actualizó la pestaña Civil' }}
        onVerCambios={onVerCambios}
      />,
    );
    expect(screen.getByText('Beto · Actualizó la pestaña Civil')).toBeTruthy();
    expect(onVerCambios).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Ver cambios'));
    expect(onVerCambios).toHaveBeenCalledTimes(1);
  });
});

describe('pestaña de Supervisión técnica', () => {
  const detalleCFM = [{ nombre: 'FENOGE', supervision_tecnica: false }, { nombre: 'CFM', supervision_tecnica: true }];

  it('no aparece si el inversionista no la requiere', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} inversionistasDetalle={detalleCFM} />);
    expect(screen.queryByText('Supervisión técnica')).toBe(null);
  });

  it('aparece —y se abre— para un inversionista marcado', () => {
    const conCFM = proyecto();
    conCFM.data.general.inversionista = 'CFM';
    render(<ProjectDetail project={conCFM} perfil={perfilLider} {...props} inversionistasDetalle={detalleCFM} />);
    const boton = screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith('Supervisión técnica'));
    expect(boton).toBeTruthy();
    fireEvent.click(boton);
    expect(screen.getByText('Paquetes de entrega')).toBeTruthy();
  });
});

describe('código de documento copiable', () => {
  /* La cabecera de cada documento tiene un botón que despliega la tarjeta y,
     dentro, el código: si el código vuelve a quedar ANIDADO en ese botón, el
     navegador lo saca de su sitio y el clic deja de copiar. */
  it('cada documento de Control Documental ofrece copiar su código', () => {
    render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} />);
    const control = screen.getAllByRole('button')
      .find((b) => b.textContent.trim().startsWith('Control Documental'));
    fireEvent.click(control);
    const copiables = screen.getAllByRole('button').filter((b) => (b.getAttribute('title') || '').startsWith('Copiar COL'));
    expect(copiables.length).toBeGreaterThan(0);
    expect(copiables.every((b) => b.parentElement.closest('button') === null)).toBe(true);
  });
});

describe('historial de entregas de un documento', () => {
  it('la primera versión llega con la descripción de emisión inicial', () => {
    const cambios = [];
    render(<VersionesTracker versiones={[]} onChange={(v) => cambios.push(v)} disabled={false} />);
    fireEvent.click(screen.getByText('Agregar versión'));
    expect(cambios[0]).toHaveLength(1);
    expect(cambios[0][0].descripcion).toBe(DESCRIPCION_PRIMERA_VERSION);
    expect(cambios[0][0].entrega).toBe('');
  });

  it('las siguientes versiones llegan con la descripción en blanco', () => {
    const cambios = [];
    const previa = [{ id: 'v1', entrega: '2026-08-01', descripcion: DESCRIPCION_PRIMERA_VERSION }];
    render(<VersionesTracker versiones={previa} onChange={(v) => cambios.push(v)} disabled={false} />);
    fireEvent.click(screen.getByText('Agregar versión'));
    expect(cambios[0][1].descripcion).toBe('');
  });

  /* El campo de fecha "Comentarios recibidos" se retiró: ahora esa vuelta se
     lleva en Supervisión técnica. */
  it('ya no pide la fecha de comentarios recibidos', () => {
    render(
      <VersionesTracker
        versiones={[{ id: 'v1', entrega: '2026-08-01', descripcion: 'Emisión inicial de documento', comentarios_recibidos: '2026-08-20' }]}
        onChange={() => {}}
        disabled={false}
      />,
    );
    expect(screen.queryByText(/Comentarios recibidos/)).toBe(null);
    expect(screen.getByText('Actualizaciones:')).toBeTruthy();
  });
});

describe('estados de documento', () => {
  it('"Listo para entrega" existe y va entre revisión interna y entregado', () => {
    expect(DOC_ESTADOS).toContain('Listo para entrega');
    expect(DOC_ESTADOS.indexOf('Listo para entrega')).toBe(DOC_ESTADOS.indexOf('Revisión interna') + 1);
    expect(DOC_ESTADOS.indexOf('Listo para entrega')).toBe(DOC_ESTADOS.indexOf('Entregado') - 1);
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
