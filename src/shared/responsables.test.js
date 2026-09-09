/* ============================================================================
   QUIÉN RESPONDE POR CADA DOCUMENTO — el cruce entre dossier y equipo.
   ----------------------------------------------------------------------------
   Lo que hay que asegurar: que un rol con dos personas le salga a las dos, que
   el orden de los chips no dependa del orden del jsonb, y sobre todo que un
   rol sin nadie asignado NO se calle — ese es el hueco que a nadie le conviene
   descubrir tarde.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { SIN_ASIGNAR, responsablesDeDocumento, rolesEnProyecto, valoresDeResponsable } from './responsables.js';

const plano = {
  codigo: 'C-PL-001',
  nombre: 'Cerramiento',
  responsables: { delineante: 'E', civil: 'R' },
};

describe('rolesEnProyecto', () => {
  it('los roles cuentan por proyecto, no por perfil', () => {
    const equipo = { civil: ['Ana', 'Dani'], delineante: 'Beto', electrico: [] };
    expect(rolesEnProyecto('Ana', equipo)).toEqual(['civil']);
    expect(rolesEnProyecto('Dani', equipo)).toEqual(['civil']);
    expect(rolesEnProyecto('Beto', equipo)).toEqual(['delineante']);
    expect(rolesEnProyecto('Nadie', equipo)).toEqual([]);
    expect(rolesEnProyecto('Ana', undefined)).toEqual([]);
  });
});

describe('responsablesDeDocumento', () => {
  it('cruza el rol del dossier con la persona del equipo', () => {
    const entradas = responsablesDeDocumento(plano, { civil: ['Ana'], delineante: 'Beto' });
    expect(entradas).toEqual([
      { rol: 'civil', papel: 'R', nombre: 'Ana' },
      { rol: 'delineante', papel: 'E', nombre: 'Beto' },
    ]);
  });

  it('un rol con dos personas le sale a las dos', () => {
    const entradas = responsablesDeDocumento(plano, { civil: ['Ana', 'Dani'], delineante: 'Beto' });
    expect(entradas.filter((e) => e.rol === 'civil').map((e) => e.nombre)).toEqual(['Ana', 'Dani']);
  });

  /* El hueco: el dossier dice que responde alguien, pero ese rol está vacante
     en este proyecto. Callarlo sería esconder trabajo sin dueño. */
  it('un rol sin nadie asignado se reporta como vacante, no se omite', () => {
    const entradas = responsablesDeDocumento(plano, { civil: ['Ana'] });
    expect(entradas).toContainEqual({ rol: 'delineante', papel: 'E', nombre: null });
  });

  it('sin equipo, todos los roles del documento salen vacantes', () => {
    expect(responsablesDeDocumento(plano, {}).every((e) => e.nombre === null)).toBe(true);
    expect(responsablesDeDocumento(plano, undefined).length).toBe(2);
  });

  it('un documento que el dossier no le asigna a nadie no tiene responsables', () => {
    expect(responsablesDeDocumento({ codigo: 'X', responsables: {} }, { civil: ['Ana'] })).toEqual([]);
    expect(responsablesDeDocumento({ codigo: 'X' }, { civil: ['Ana'] })).toEqual([]);
    expect(responsablesDeDocumento(undefined, {})).toEqual([]);
  });

  /* El orden sale de ROLES y no del jsonb, que no garantiza ninguno: si
     dependiera de él, los chips se reordenarían entre un documento y otro. */
  it('el orden no depende de cómo esté escrito el jsonb', () => {
    const alReves = { ...plano, responsables: { civil: 'R', delineante: 'E' } };
    const orden = (d) => responsablesDeDocumento(d, { civil: ['Ana'], delineante: 'Beto' }).map((e) => e.rol);
    expect(orden(alReves)).toEqual(orden(plano));
  });
});

describe('valoresDeResponsable (lo que alimenta el filtro)', () => {
  it('devuelve los nombres de quienes responden', () => {
    expect(valoresDeResponsable(plano, { civil: ['Ana'], delineante: 'Beto' })).toEqual(['Ana', 'Beto']);
  });

  it('un rol vacante entra como "Sin asignar"', () => {
    expect(valoresDeResponsable(plano, { civil: ['Ana'] })).toEqual(['Ana', SIN_ASIGNAR]);
  });

  it('no repite a quien responde por dos roles a la vez', () => {
    expect(valoresDeResponsable(plano, { civil: ['Ana'], delineante: ['Ana'] })).toEqual(['Ana']);
  });

  /* Un documento sin responsables en el dossier no está "sin asignar": es que
     no le toca a nadie a propósito. */
  it('un documento sin responsables no entra al filtro con ningún valor', () => {
    expect(valoresDeResponsable({ codigo: 'X', responsables: {} }, { civil: ['Ana'] })).toEqual([]);
  });
});
