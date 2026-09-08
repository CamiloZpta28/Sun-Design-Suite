// @vitest-environment jsdom
/* ============================================================================
   DOSSIERS — render real.
   ----------------------------------------------------------------------------
   Lo que más importa comprobar aquí no es que pinte, sino que la regla que
   protege los datos se cumpla en pantalla: un dossier EN USO no puede ofrecer
   agregar, editar ni quitar documentos (cambiar un código dejaría huérfano el
   trabajo guardado en todos los proyectos que lo usan), pero SÍ tiene que
   dejar cambiar los responsables, que no son parte de lo que el proyecto
   guarda.

   Y la otra mitad: quien no es líder no ve ninguno de esos botones.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DossiersView, { proyectosQueUsan, siguienteVersion } from './Dossiers.jsx';

afterEach(cleanup);

const lider = { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] };
const ingeniero = { id: 'u2', nombre: 'Beto', roles: ['civil'] };

function doc(over = {}) {
  return {
    id: 'd1',
    codigo: 'COLXXXXXXPX-CIV-PL-001',
    nombre: 'Layout General',
    especialidad: 'CIVIL',
    tipo: 'Plano',
    orden: 0,
    responsables: { delineante: 'E', civil: 'R' },
    ...over,
  };
}

function dossier(over = {}) {
  return { id: 'dos-1', nombre: 'CFM', version: 1, archivado: false, documentos: [doc()], ...over };
}

const sinAcciones = {
  onCrearDossier: () => {},
  onActualizarDossier: () => {},
  onEliminarDossier: () => {},
  onGuardarDocumento: () => {},
  onQuitarDocumento: () => {},
  onCambiarResponsables: () => {},
  onAsignarInversionista: () => {},
};

function pintar(props = {}) {
  return render(
    <DossiersView
      dossiers={[dossier()]}
      projects={[]}
      inversionistas={['CFM', 'FENOGE']}
      inversionistasDetalle={[{ nombre: 'CFM', dossier_id: 'dos-1' }]}
      perfil={lider}
      {...sinAcciones}
      {...props}
    />,
  );
}

const abrir = (etiqueta = 'CFM 1') => fireEvent.click(
  screen.getAllByRole('button').find((b) => b.textContent.includes(etiqueta)),
);

describe('lista de dossiers', () => {
  it('sin dossiers cargados avisa que falta la migración, sin dejar la pantalla en blanco', () => {
    pintar({ dossiers: [] });
    expect(screen.getByText(/falta correr la migración/i)).toBeTruthy();
  });

  it('agrupa las versiones bajo su familia', () => {
    pintar({
      dossiers: [
        dossier(),
        dossier({ id: 'dos-2', version: 2 }),
        dossier({ id: 'dos-3', nombre: 'FENOGE' }),
      ],
    });
    expect(screen.getByText('CFM 1')).toBeTruthy();
    expect(screen.getByText('CFM 2')).toBeTruthy();
    expect(screen.getByText('FENOGE 1')).toBeTruthy();
  });

  it('dice cuántos proyectos usan cada versión', () => {
    pintar({ projects: [{ id: 'p1', dossier_id: 'dos-1' }, { id: 'p2', dossier_id: 'dos-1' }] });
    expect(screen.getByText(/2 proyectos/)).toBeTruthy();
  });

  it('un ingeniero ve la lista pero ningún botón de gestión', () => {
    pintar({ perfil: ingeniero });
    expect(screen.getByText('CFM 1')).toBeTruthy();
    expect(screen.queryByText('Nuevo dossier')).toBe(null);
    expect(screen.queryByTitle('Duplicar como versión nueva')).toBe(null);
  });

  it('no ofrece eliminar una versión que algún proyecto usa', () => {
    pintar({ projects: [{ id: 'p1', dossier_id: 'dos-1' }] });
    expect(screen.queryByTitle('Eliminar dossier')).toBe(null);
    cleanup();
    pintar();
    expect(screen.getByTitle('Eliminar dossier')).toBeTruthy();
  });
});

describe('un dossier EN USO tiene la estructura congelada', () => {
  const enUso = { projects: [{ id: 'p1', nombre: 'Chinú 3', dossier_id: 'dos-1' }] };

  it('lo explica y no ofrece tocar los documentos', () => {
    pintar(enUso);
    abrir();
    expect(screen.getByText(/La lista de documentos está congelada/i)).toBeTruthy();
    expect(screen.queryByText('Agregar documento')).toBe(null);
    expect(screen.queryByTitle('Editar documento')).toBe(null);
    expect(screen.queryByTitle('Quitar documento')).toBe(null);
  });

  it('pero los responsables sí se siguen pudiendo cambiar', () => {
    const cambios = [];
    pintar({ ...enUso, onCambiarResponsables: (...args) => cambios.push(args) });
    abrir();
    fireEvent.click(screen.getByTitle(/Ing. Estructural: sin participación/));
    expect(cambios).toEqual([['dos-1', 'd1', { delineante: 'E', civil: 'R', estructural: 'E' }]]);
  });
});

describe('un dossier SIN USAR se puede editar entero', () => {
  it('ofrece agregar, editar y quitar documentos', () => {
    pintar();
    abrir();
    expect(screen.getByText('Agregar documento')).toBeTruthy();
    expect(screen.getByTitle('Editar documento')).toBeTruthy();
    expect(screen.getByTitle('Quitar documento')).toBeTruthy();
  });

  it('el formulario de documento guarda lo que se escribió', () => {
    const guardados = [];
    pintar({ onGuardarDocumento: (...args) => guardados.push(args) });
    abrir();
    fireEvent.click(screen.getByText('Agregar documento'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Cerramiento'), { target: { value: 'Paso de fauna' } });
    fireEvent.change(screen.getByPlaceholderText('COLXXXXXXPX-CIV-PL-009'), { target: { value: 'COLXXXXXXPX-CIV-PL-010' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(guardados.length).toBe(1);
    expect(guardados[0][1]).toMatchObject({ nombre: 'Paso de fauna', codigo: 'COLXXXXXXPX-CIV-PL-010' });
  });
});

describe('responsables', () => {
  it('cada rol pasa por vacío → E → R → vacío', () => {
    const cambios = [];
    pintar({ onCambiarResponsables: (_d, _doc, resp) => cambios.push(resp) });
    abrir();
    /* El delineante arranca en E: un clic lo lleva a R y el siguiente lo deja
       fuera. Cada clic parte del mismo estado inicial porque el componente no
       se vuelve a pintar (el padre no guarda), así que se comprueban por
       separado los dos saltos que sí se pueden observar aquí. */
    fireEvent.click(screen.getByTitle('Delineante: Elabora o dibuja'));
    expect(cambios[0]).toEqual({ delineante: 'R', civil: 'R' });
    fireEvent.click(screen.getByTitle('Ing. Civil: Revisa'));
    expect(cambios[1]).toEqual({ delineante: 'E' });
  });

  it('un ingeniero ve los responsables pero no los puede cambiar', () => {
    /* Los ve igual —son la referencia de a quién le toca— pero pintados como
       texto, no como botones: no hay nada que pulsar. */
    pintar({ perfil: ingeniero });
    abrir();
    expect(screen.getByTitle('Delineante: Elabora o dibuja').tagName).toBe('SPAN');
    expect(screen.getByTitle('Ing. Estructural: sin participación').tagName).toBe('SPAN');
    cleanup();
    pintar();
    abrir();
    expect(screen.getByTitle('Delineante: Elabora o dibuja').tagName).toBe('BUTTON');
  });

  it('avisa cuántos documentos quedaron sin responsable', () => {
    pintar({ dossiers: [dossier({ documentos: [doc(), doc({ id: 'd2', codigo: 'X-2', nombre: 'Sin dueño', responsables: {} })] })] });
    expect(screen.getByText(/1 sin responsable/)).toBeTruthy();
  });
});

describe('inversionistas', () => {
  it('muestra a quién le sirve por defecto y deja quitarlo', () => {
    const quitados = [];
    pintar({ onAsignarInversionista: (...args) => quitados.push(args) });
    abrir();
    expect(screen.getByText(/Inversionistas que lo usan por defecto/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Quitar'));
    expect(quitados).toEqual([['CFM', null]]);
  });
});

describe('funciones sueltas', () => {
  it('proyectosQueUsan cuenta solo los de ese dossier', () => {
    const projects = [{ dossier_id: 'a' }, { dossier_id: 'b' }, { dossier_id: 'a' }, {}];
    expect(proyectosQueUsan('a', projects).length).toBe(2);
    expect(proyectosQueUsan('z', projects).length).toBe(0);
    expect(proyectosQueUsan('a', undefined).length).toBe(0);
  });

  it('siguienteVersion mira la familia, no la versión que se duplicó', () => {
    const lista = [
      { nombre: 'CFM', version: 1 }, { nombre: 'CFM', version: 3 }, { nombre: 'FENOGE', version: 1 },
    ];
    expect(siguienteVersion('CFM', lista)).toBe(4);
    expect(siguienteVersion('FENOGE', lista)).toBe(2);
    expect(siguienteVersion('Nuevo', lista)).toBe(1);
  });
});

describe('códigos repetidos', () => {
  it('no deja meter dos documentos con el mismo código', () => {
    const avisos = [];
    const guardados = [];
    vi.spyOn(window, 'alert').mockImplementation((m) => avisos.push(m));
    pintar({ onGuardarDocumento: (...args) => guardados.push(args) });
    abrir();
    fireEvent.click(screen.getByText('Agregar documento'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Cerramiento'), { target: { value: 'Otro plano' } });
    fireEvent.change(screen.getByPlaceholderText('COLXXXXXXPX-CIV-PL-009'), { target: { value: 'COLXXXXXXPX-CIV-PL-001' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(guardados.length).toBe(0);
    expect(avisos[0]).toMatch(/Layout General/);
    window.alert.mockRestore();
  });
});
