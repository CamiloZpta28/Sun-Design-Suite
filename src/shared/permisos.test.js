/* ============================================================================
   PERMISOS — quién cuenta como asignado a un proyecto.
   ----------------------------------------------------------------------------
   Se prueba la parte que decide accesos, que es donde una equivocación no se
   ve: alguien que de pronto puede editar lo que no debería.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  EQUIPO_CLAVES_SIN_ASIGNACION, equipoNombres, equipoComoArray, equipoTexto,
  isAssignedToProject, equipoQueElaboro, textoQueElaboro, CLAVES_ELABORARON,
} from './permisos.js';

const proyecto = (equipo) => ({ id: 'p1', nombre: 'Chinú 3', equipo });

describe('quién cuenta como asignado', () => {
  it('quien está en un rol técnico, sí', () => {
    expect(isAssignedToProject({ nombre: 'Ana' }, proyecto({ civil: ['Ana'] }))).toBe(true);
    expect(isAssignedToProject({ nombre: 'Beto' }, proyecto({ civil: ['Ana'] }))).toBe(false);
  });

  /* El ingeniero de proyectos es un dato del cliente, no alguien con cuenta
     en la plataforma. */
  it('el ingeniero de proyectos no', () => {
    expect(isAssignedToProject({ nombre: 'Tito' }, proyecto({ ingeniero_proyectos: 'Tito' }))).toBe(false);
  });

  /* La mecánica de revisión eléctrica se retiró, pero los proyectos de antes
     tienen la clave guardada. Si dejara de estar en la lista, esas personas
     pasarían de pronto a contar como asignadas —con permiso de edición y el
     proyecto en sus "Mis proyectos"—. Quitar una pantalla no puede repartir
     permisos. */
  it('el revisor eléctrico de los proyectos viejos tampoco', () => {
    expect(EQUIPO_CLAVES_SIN_ASIGNACION).toContain('aprobador_electrico');
    expect(isAssignedToProject({ nombre: 'Caro' }, proyecto({ aprobador_electrico: 'Caro' }))).toBe(false);
    expect(equipoNombres({ civil: ['Ana'], aprobador_electrico: 'Caro' })).toEqual(['Ana']);
  });

  it('sin perfil o sin equipo no revienta', () => {
    expect(isAssignedToProject(null, proyecto({ civil: ['Ana'] }))).toBe(false);
    expect(equipoNombres(null)).toEqual([]);
  });
});

describe('quiénes elaboraron el proyecto', () => {
  const equipo = {
    civil: ['Ana', 'Caro'],
    electrico: ['Beto'],
    delineante: ['Dani', 'Ana'],
    geotecnico: ['Tito'],
    aprobador_electrico: 'Fulano',
  };

  it('son los civiles, los eléctricos y los delineantes', () => {
    expect(CLAVES_ELABORARON).toEqual(['civil', 'electrico', 'delineante']);
    expect(equipoQueElaboro(equipo)).toEqual(['Ana', 'Caro', 'Beto', 'Dani']);
  });

  /* Quien tiene dos roles en el mismo proyecto se nombra una sola vez. */
  it('no repite a nadie', () => {
    expect(equipoQueElaboro(equipo).filter((n) => n === 'Ana')).toHaveLength(1);
  });

  /* Los transversales apoyan varios proyectos: ya salen en el equipo
     asignado, que se muestra aparte. */
  it('no incluye a los transversales ni al revisor de antes', () => {
    expect(equipoQueElaboro(equipo)).not.toContain('Tito');
    expect(equipoQueElaboro(equipo)).not.toContain('Fulano');
  });

  it('sale como texto listo para el rótulo', () => {
    expect(textoQueElaboro(equipo)).toBe('Ana, Caro, Beto, Dani');
    expect(textoQueElaboro({})).toBe('');
    expect(textoQueElaboro(null)).toBe('');
  });
});

describe('un rol puede tener una persona o varias', () => {
  it('acepta las dos formas', () => {
    expect(equipoComoArray('Ana')).toEqual(['Ana']);
    expect(equipoComoArray(['Ana', 'Beto'])).toEqual(['Ana', 'Beto']);
    expect(equipoComoArray(null)).toEqual([]);
    expect(equipoTexto(['Ana', 'Beto'])).toBe('Ana, Beto');
  });
});
