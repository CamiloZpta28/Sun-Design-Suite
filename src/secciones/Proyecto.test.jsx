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
  DESCRIPCION_PRIMERA_VERSION, DocumentControlPanel,
} = await import('./Proyecto.jsx');
const { SCHEMA, DOC_ESTADOS, pickDocumentList } = await import('../shared/dominio.jsx');

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

describe('Control Documental · filtros por especialidad y tipo', () => {
  /* El filtro dejó de ser "una sola especialidad" para ser "las que uno
     quiera": la gente de Civil y Mecánica trabaja junta y necesita ver sus
     dos listas a la vez, no saltar entre ellas. */
  const proyectoCD = proyecto();
  const listaCD = pickDocumentList(proyectoCD.data.general.inversionista);
  const ESPECIALIDADES = [...new Set(listaCD.map((d) => d.especialidad))];
  const docsDe = (esp) => listaCD.filter((d) => d.especialidad === esp);

  function pintar() {
    return render(
      <DocumentControlPanel
        project={proyectoCD}
        puedeEditarContenido
        puedeComentar={false}
        onDocChange={() => {}}
      />,
    );
  }

  /* Las fichas de filtro son las únicas que llevan aria-pressed; eso las
     separa del semáforo de estados, que tiene su propio "Todos (n)". */
  const ficha = (nombre) => screen.getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .find((b) => b.textContent.trim().startsWith(nombre + ' ('));
  /* Cada especialidad visible aparece dos veces: el encabezado de su lista y
     su barra en el resumen. Si no está seleccionada, no aparece ninguna. */
  const veces = (esp) => screen.queryAllByText(esp).length;
  const totalDelSemaforo = () => {
    const boton = screen.getAllByRole('button')
      .find((b) => !b.hasAttribute('aria-pressed') && /^Todos \(\d+\)$/.test(b.textContent.trim()));
    return Number(boton.textContent.match(/\((\d+)\)/)[1]);
  };

  it('de entrada se ven todas las especialidades', () => {
    pintar();
    ESPECIALIDADES.forEach((esp) => expect(veces(esp), esp).toBeGreaterThan(0));
    expect(totalDelSemaforo()).toBe(listaCD.length);
  });

  it('al encender una, solo queda esa —en la lista y en el resumen—', () => {
    pintar();
    const elegida = ESPECIALIDADES[0];
    fireEvent.click(ficha(elegida));
    expect(veces(elegida)).toBeGreaterThan(0);
    ESPECIALIDADES.slice(1).forEach((esp) => expect(veces(esp), esp).toBe(0));
    expect(totalDelSemaforo()).toBe(docsDe(elegida).length);
  });

  it('se pueden encender varias a la vez', () => {
    pintar();
    const [a, b] = ESPECIALIDADES;
    fireEvent.click(ficha(a));
    fireEvent.click(ficha(b));
    expect(veces(a)).toBeGreaterThan(0);
    expect(veces(b)).toBeGreaterThan(0);
    ESPECIALIDADES.slice(2).forEach((esp) => expect(veces(esp), esp).toBe(0));
    expect(totalDelSemaforo()).toBe(docsDe(a).length + docsDe(b).length);
  });

  it('volver a hacer clic la apaga', () => {
    pintar();
    const elegida = ESPECIALIDADES[0];
    fireEvent.click(ficha(elegida));
    fireEvent.click(ficha(elegida));
    ESPECIALIDADES.forEach((esp) => expect(veces(esp), esp).toBeGreaterThan(0));
    expect(totalDelSemaforo()).toBe(listaCD.length);
  });

  it('"Todas" borra la selección de un golpe', () => {
    pintar();
    fireEvent.click(ficha(ESPECIALIDADES[0]));
    fireEvent.click(ficha(ESPECIALIDADES[1]));
    fireEvent.click(ficha('Todas'));
    ESPECIALIDADES.forEach((esp) => expect(veces(esp), esp).toBeGreaterThan(0));
    expect(totalDelSemaforo()).toBe(listaCD.length);
  });

  /* Los tipos (Plano, Informe, Memoria…) funcionan igual: se encienden varios
     y el resumen cuenta sobre ellos. */
  const TIPOS = [...new Set(listaCD.map((d) => d.tipo))].sort((a, b) => a.localeCompare(b, 'es'));
  const docsDeTipo = (tipo) => listaCD.filter((d) => d.tipo === tipo);

  it('se pueden encender varios tipos a la vez', () => {
    pintar();
    const [a, b] = TIPOS;
    fireEvent.click(ficha(a));
    fireEvent.click(ficha(b));
    expect(totalDelSemaforo()).toBe(docsDeTipo(a).length + docsDeTipo(b).length);
  });

  it('volver a hacer clic apaga un tipo', () => {
    pintar();
    fireEvent.click(ficha(TIPOS[0]));
    fireEvent.click(ficha(TIPOS[0]));
    expect(totalDelSemaforo()).toBe(listaCD.length);
  });

  it('"Todos" borra la selección de tipos sin tocar la de especialidades', () => {
    pintar();
    fireEvent.click(ficha(ESPECIALIDADES[0]));
    fireEvent.click(ficha(TIPOS[0]));
    fireEvent.click(ficha('Todos'));
    expect(totalDelSemaforo()).toBe(docsDe(ESPECIALIDADES[0]).length);
  });

  /* Lo que de verdad importa: los dos filtros se cruzan, no se pisan. */
  it('especialidad y tipo se cruzan', () => {
    pintar();
    const esp = ESPECIALIDADES.find((e) => new Set(listaCD.filter((d) => d.especialidad === e).map((d) => d.tipo)).size > 1);
    const tipo = TIPOS.find((t) => docsDeTipo(t).some((d) => d.especialidad === esp));
    fireEvent.click(ficha(esp));
    fireEvent.click(ficha(tipo));
    const esperado = listaCD.filter((d) => d.especialidad === esp && d.tipo === tipo).length;
    expect(esperado).toBeGreaterThan(0);
    expect(esperado).toBeLessThan(docsDe(esp).length);
    expect(totalDelSemaforo()).toBe(esperado);
  });

  /* La barra de esa especialidad en el resumen también se recorta al tipo:
     antes contaba todos sus documentos aunque hubiera un tipo elegido. */
  it('las barras del resumen cuentan solo el tipo elegido', () => {
    pintar();
    const tipo = TIPOS[0];
    const esp = ESPECIALIDADES.find((e) => listaCD.some((d) => d.especialidad === e && d.tipo === tipo)
      && listaCD.some((d) => d.especialidad === e && d.tipo !== tipo));
    fireEvent.click(ficha(esp));
    fireEvent.click(ficha(tipo));
    const cuantos = listaCD.filter((d) => d.especialidad === esp && d.tipo === tipo).length;
    expect(screen.getByText(`${cuantos} docs`)).toBeTruthy();
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

describe('resistencia del concreto por proyecto', () => {
  /* La misma plantilla —un CT Tipo 1— se funde en 21 MPa en un proyecto y en
     28 en otro, así que la resistencia dejó de vivir en la plantilla y pasó a
     ser un campo del proyecto, uno por cada cimentación. */
  const estructural = SCHEMA.find((s) => s.id === 'estructural');

  it('cada cimentación trae su resistencia justo después de la plantilla', () => {
    const plantillas = estructural.fields.filter((f) => f.type === 'cimentacion_plantilla');
    expect(plantillas.length).toBe(9);
    plantillas.forEach((f) => {
      const siguiente = estructural.fields[estructural.fields.indexOf(f) + 1];
      expect(siguiente?.key, f.key).toBe(`resistencia_${f.tipoCimentacion}`);
      expect(siguiente.opciones, f.key).toContain('28 MPa');
    });
  });

  it('se puede elegir y avisa el valor elegido', () => {
    const field = estructural.fields.find((f) => f.key === 'resistencia_shelter_ct');
    let elegido = null;
    render(
      <FieldRenderer
        field={field}
        value=""
        editMode
        onChange={(val) => { elegido = val; }}
        siblingData={{}}
        inversionistas={[]} onAddInversionista={() => {}} paises={[]} onAddPais={() => {}}
        proveedores={[]} onAddProveedor={() => {}} plantillasCimentacion={[]} plantillasEquipos={[]}
        inversionistasDetalle={[]} operadoresRed={[]} onAddOperadorRed={() => {}}
        instaladores={[]} onAddInstalador={() => {}} ingenierosProyectos={[]}
        onUpdateCatalogoAtributo={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '28 MPa' } });
    expect(elegido).toBe('28 MPa');
  });

  it('el valor guardado se ve en la pestaña Estructural', () => {
    const p = proyecto({ data: { general: {}, estructural: { resistencia_shelter_ct: '28 MPa' } } });
    const { container } = render(<ProjectDetail project={p} perfil={perfilLider} {...props} />);
    const boton = screen.getAllByRole('button')
      .find((b) => b.textContent.trim().replace(/\s+/g, ' ').startsWith('Estructural'));
    fireEvent.click(boton);
    /* Por la celda del campo y no por el texto suelto: "28 MPa" también sale
       en la hoja de vida imprimible, que se pinta oculta en la misma página. */
    const celda = container.querySelector('[data-field-key="resistencia_shelter_ct"]');
    expect(celda).toBeTruthy();
    expect(celda.textContent).toContain('28 MPa');
  });

  /* Va DENTRO de la celda de su plantilla, no en una celda propia al lado: esa
     celda es alta —lleva el dibujo y el resumen— y la del f'c es un renglón,
     así que separadas dejaban media pantalla en blanco. */
  it('la resistencia se pinta dentro de la celda de su cimentación', () => {
    const { container } = render(<ProjectDetail project={proyecto()} perfil={perfilLider} {...props} />);
    fireEvent.click(screen.getAllByRole('button')
      .find((b) => b.textContent.trim().replace(/\s+/g, ' ').startsWith('Estructural')));
    const plantilla = container.querySelector('[data-field-key="plantilla_shelter_ct"]');
    expect(plantilla).toBeTruthy();
    expect(plantilla.querySelector('[data-field-key="resistencia_shelter_ct"]')).toBeTruthy();
  });
});

describe('los documentos salen del dossier del proyecto', () => {
  /* Antes la lista se elegía con un "if" por el nombre del inversionista.
     Ahora el proyecto apunta a un dossier y de ahí sale todo; las listas de
     siempre quedan solo como red de seguridad para el proyecto que todavía no
     tiene dossier (o si no se corrió la migración). */
  const dossierPropio = {
    id: 'dos-1', nombre: 'CFM', version: 2, archivado: false,
    documentos: [{
      id: 'dd1', codigo: 'COLXXXXXXPX-CIV-PL-099', nombre: 'Plano inventado del dossier',
      especialidad: 'CIVIL', tipo: 'Plano', orden: 0, responsables: {},
    }],
  };

  const primeroDeLaListaVieja = pickDocumentList(proyecto().data.general.inversionista)[0].nombre;

  function abrirControlDocumental(project, dossiers) {
    render(<ProjectDetail project={project} perfil={perfilLider} {...props} dossiers={dossiers} />);
    fireEvent.click(screen.getAllByRole('button')
      .find((b) => b.textContent.trim().replace(/\s+/g, ' ').startsWith('Control Documental')));
  }

  it('con dossier, manda el dossier y no el inversionista', () => {
    abrirControlDocumental(proyecto({ dossier_id: 'dos-1' }), [dossierPropio]);
    expect(screen.getAllByText('Plano inventado del dossier').length).toBeGreaterThan(0);
    /* El primer documento de la lista vieja del inversionista de este proyecto:
       si apareciera, el dossier no estaría mandando. */
    expect(screen.queryByText(primeroDeLaListaVieja)).toBe(null);
  });

  it('sin dossier cae a la lista de siempre en vez de quedarse en blanco', () => {
    abrirControlDocumental(proyecto(), []);
    expect(screen.getAllByText(primeroDeLaListaVieja).length).toBeGreaterThan(0);
  });

  it('con un dossier que ya no existe tampoco se queda en blanco', () => {
    abrirControlDocumental(proyecto({ dossier_id: 'borrado' }), [dossierPropio]);
    expect(screen.getAllByText(primeroDeLaListaVieja).length).toBeGreaterThan(0);
  });
});

describe('Control Documental · responsables', () => {
  /* Dentro de un proyecto lo util no es el rol sino la PERSONA: el dossier
     dice que responde el delineante, y el equipo dice que el delineante de
     este proyecto es Beto. */
  const dossierChico = {
    id: 'dos-1', nombre: 'CFM', version: 1,
    documentos: [
      { id: 'a', codigo: 'X-CIV-PL-001', nombre: 'Cerramiento', especialidad: 'CIVIL', tipo: 'Plano', responsables: { delineante: 'E', civil: 'R' } },
      { id: 'b', codigo: 'X-CIV-INF-001', nombre: 'Vías de acceso', especialidad: 'CIVIL', tipo: 'Informe', responsables: { civil: 'E' } },
      { id: 'c', codigo: 'X-CIV-INF-002', nombre: 'Cimentaciones', especialidad: 'CIVIL', tipo: 'Informe', responsables: { estructural: 'E' } },
      { id: 'd', codigo: 'X-ELE-PL-001', nombre: 'Unifilar', especialidad: 'ELECTRICA', tipo: 'Plano', responsables: { electrico: 'R', delineante: 'E' } },
    ],
  };
  const conDossier = proyecto({
    dossier_id: 'dos-1',
    /* Sin estructural a proposito: ese es el rol vacante. */
    equipo: { civil: ['Ana'], delineante: ['Beto'], electrico: ['Caro'] },
  });

  function pintarCD(props = {}) {
    return render(
      <DocumentControlPanel
        project={conDossier}
        puedeEditarContenido
        puedeComentar={false}
        onDocChange={() => {}}
        dossiers={[dossierChico]}
        {...props}
      />,
    );
  }

  const fichaResp = (nombre) => screen.getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .find((b) => b.textContent.trim().startsWith(nombre + ' ('));

  it('cada documento muestra quien responde por el, con su papel', () => {
    pintarCD();
    /* Beto dibuja dos planos, asi que su chip sale dos veces. */
    expect(screen.getAllByTitle('Beto (Delineante) lo elabora o lo dibuja').length).toBe(2);
    expect(screen.getByTitle('Ana (Ing. Civil) lo revisa')).toBeTruthy();
    expect(screen.getByTitle('Ana (Ing. Civil) lo elabora o lo dibuja')).toBeTruthy();
    expect(screen.getByTitle('Caro (Ing. Eléctrico) lo revisa')).toBeTruthy();
  });

  /* El hueco: el dossier dice que responde el estructural y en este proyecto
     no hay estructural. Es trabajo sin dueño y tiene que saltar a la vista. */
  it('un rol sin nadie asignado se ve como vacante', () => {
    pintarCD();
    expect(screen.getByTitle(/Nadie tiene el rol de Ing. Estructural en este proyecto/)).toBeTruthy();
    expect(screen.getByText(/Sin Estructural/)).toBeTruthy();
  });

  it('el filtro ofrece una ficha por persona, y "Sin asignar" de ultimo', () => {
    pintarCD();
    expect(fichaResp('Ana')).toBeTruthy();
    expect(fichaResp('Beto')).toBeTruthy();
    expect(fichaResp('Caro')).toBeTruthy();
    const fichas = screen.getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
      .map((b) => b.textContent.trim());
    const personas = fichas.filter((t) => /^(Ana|Beto|Caro|Sin asignar) \(/.test(t));
    expect(personas[personas.length - 1]).toMatch(/^Sin asignar/);
  });

  it('filtrar por una persona deja solo sus documentos', () => {
    pintarCD();
    fireEvent.click(fichaResp('Caro'));
    expect(screen.getByText('Unifilar')).toBeTruthy();
    expect(screen.queryByText('Cerramiento')).toBe(null);
    expect(screen.queryByText('Vías de acceso')).toBe(null);
  });

  it('el resumen de arriba sigue el filtro de responsable', () => {
    pintarCD();
    const total = () => Number(screen.getAllByRole('button')
      .find((b) => !b.hasAttribute('aria-pressed') && /^Todos \(\d+\)$/.test(b.textContent.trim()))
      .textContent.match(/\((\d+)\)/)[1]);
    expect(total()).toBe(4);
    fireEvent.click(fichaResp('Beto'));
    expect(total()).toBe(2);
  });

  it('el filtro de responsable se cruza con el de especialidad', () => {
    pintarCD();
    fireEvent.click(fichaResp('Beto'));
    const fichaEsp = screen.getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
      .find((b) => b.textContent.trim().startsWith('CIVIL ('));
    fireEvent.click(fichaEsp);
    expect(screen.getByText('Cerramiento')).toBeTruthy();
    expect(screen.queryByText('Unifilar')).toBe(null);
  });

  it('"Sin asignar" saca los documentos que no tienen dueno', () => {
    pintarCD();
    fireEvent.click(fichaResp('Sin asignar'));
    expect(screen.getByText('Cimentaciones')).toBeTruthy();
    expect(screen.queryByText('Cerramiento')).toBe(null);
  });

  /* Un dossier que todavia no reparte responsables no debe mostrar una fila
     de filtro vacia. */
  it('sin responsables repartidos no aparece la fila de filtro', () => {
    const sinRepartir = { ...dossierChico, documentos: dossierChico.documentos.map((d) => ({ ...d, responsables: {} })) };
    pintarCD({ dossiers: [sinRepartir] });
    expect(screen.queryByText('Responsable:')).toBe(null);
  });

  it('los documentos propios se marcan para poder ubicarlos de un vistazo', () => {
    const { container } = pintarCD({ miNombre: 'Beto' });
    const [mio] = container.querySelectorAll('[title="Beto (Delineante) lo elabora o lo dibuja"]');
    expect(mio.className).toContain('ring-1');
    const ajeno = container.querySelector('[title="Ana (Ing. Civil) lo revisa"]');
    expect(ajeno.className).not.toContain('ring-1');
  });
});
