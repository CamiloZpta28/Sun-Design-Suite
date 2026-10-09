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
  esInvitado, isLeader, isDeveloper, isDesignLeader, isQA, canAssignRole, rolesLabel,
  puedeVerVista, VISTAS_DEL_INVITADO, puedeVerDatosPersonales, separarDatosPersonales,
  CAMPOS_DATOS_PERSONALES, ALL_ROLE_DEFS, EQUIPO_CATEGORIAS,
  REVISOR_ELECTRICO, esRevisorElectricoDe, proyectosQueReviso, puedeComentarDocumento,
} from './permisos.js';

const proyecto = (equipo) => ({ id: 'p1', nombre: 'Chinú 3', equipo });

describe('quién cuenta como asignado', () => {
  it('quien está en un rol técnico, sí', () => {
    expect(isAssignedToProject({ nombre: 'Ana', roles: ['civil'] }, proyecto({ civil: ['Ana'] }))).toBe(true);
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

/* Invitado = quien no tiene ningún rol de equipo. Es el estado de toda
   cuenta nueva: se sale de él cuando un líder da un rol, y se vuelve a él si
   se los quitan todos. */
describe('quién es invitado', () => {
  it('quien no tiene ningún rol, empezando por toda cuenta nueva', () => {
    expect(esInvitado({ id: 'n', nombre: 'Nueva', roles: [] })).toBe(true);
    expect(esInvitado({ id: 'n', nombre: 'Nueva' })).toBe(true);
  });

  it('quien tiene cualquier rol de equipo, no', () => {
    ['civil', 'delineante', 'tramites_bt', 'control_calidad', 'lider_civil', 'desarrollador'].forEach((rol) => {
      expect(esInvitado({ roles: [rol] }), rol).toBe(false);
    });
  });

  /* No es un rol que se otorgue: no está entre los que se asignan, así que
     nadie puede quedar con "Invitado" y otro rol a la vez. */
  it('no aparece entre los roles que se asignan', () => {
    expect(ALL_ROLE_DEFS.map((r) => r.key)).not.toContain('invitado');
  });

  it('sin sesión no es nada', () => {
    expect(esInvitado(null)).toBe(false);
  });

  it('se presenta como Invitado', () => {
    expect(rolesLabel({ roles: [] })).toBe('Invitado');
    expect(rolesLabel({ roles: ['civil'] })).toBe('Ing. Civil');
  });
});

describe('lo que un invitado no puede', () => {
  const invitada = { id: 'u9', nombre: 'Ana', roles: [] };

  it('ningún permiso de edición', () => {
    expect(isLeader(invitada)).toBe(false);
    expect(isDeveloper(invitada)).toBe(false);
    expect(isDesignLeader(invitada)).toBe(false);
    expect(isQA(invitada)).toBe(false);
    expect(canAssignRole(invitada, 'civil')).toBe(false);
  });

  /* A alguien le quitaron los roles pero sigue escrito en el equipo de un
     proyecto: no por eso puede editarlo. */
  it('aunque figure en el equipo de un proyecto, no cuenta como asignada', () => {
    expect(isAssignedToProject(invitada, proyecto({ civil: ['Ana'] }))).toBe(false);
    expect(isAssignedToProject({ ...invitada, roles: ['civil'] }, proyecto({ civil: ['Ana'] }))).toBe(true);
  });
});

describe('qué secciones ve', () => {
  const invitada = { roles: [] };
  const ingeniero = { roles: ['civil'] };

  it('las cuatro de consulta y la ficha de un proyecto', () => {
    expect(VISTAS_DEL_INVITADO).toEqual(['dashboard', 'todos', 'resumen_inversionistas', 'equipo', 'detalle']);
    VISTAS_DEL_INVITADO.forEach((v) => expect(puedeVerVista(invitada, v), v).toBe(true));
  });

  it('ninguna de trabajo', () => {
    ['mis', 'cimentaciones', 'equipos_electricos', 'canalizaciones', 'cruces', 'diseno_via',
      'actualizaciones', 'resumenes', 'dossiers', 'instructivos', 'enlaces']
      .forEach((v) => expect(puedeVerVista(invitada, v), v).toBe(false));
  });

  it('quien es del equipo sigue viéndolo todo', () => {
    ['mis', 'cimentaciones', 'resumenes', 'dossiers', 'enlaces'].forEach((v) => expect(puedeVerVista(ingeniero, v), v).toBe(true));
  });
});

describe('datos personales', () => {
  const ana = { id: 'a', roles: ['civil'] };
  const beto = { id: 'b', roles: ['electrico'] };
  const invitada = { id: 'i', roles: [] };

  it('cada quien ve los suyos, incluso un invitado', () => {
    expect(puedeVerDatosPersonales(invitada, invitada)).toBe(true);
    expect(puedeVerDatosPersonales(ana, ana)).toBe(true);
  });

  it('los de los demás, solo quien es del equipo', () => {
    expect(puedeVerDatosPersonales(ana, beto)).toBe(true);
    expect(puedeVerDatosPersonales(invitada, ana)).toBe(false);
  });

  it('sin datos no revienta', () => {
    expect(puedeVerDatosPersonales(null, ana)).toBe(false);
    expect(puedeVerDatosPersonales(ana, null)).toBe(false);
  });

  /* Al guardar la ficha, cada campo va a su tabla: si una cédula terminara en
     el perfil, cualquier cuenta la podría volver a leer. */
  it('al guardar se separan de lo que va al perfil', () => {
    const { perfil, datos } = separarDatosPersonales({
      fecha_cumpleanos: '1990-01-01', cedula: '123', celular: '300', nombre: 'Ana',
    });
    expect(perfil).toEqual({ fecha_cumpleanos: '1990-01-01', nombre: 'Ana' });
    expect(datos).toEqual({ cedula: '123', celular: '300' });
  });

  it('son los seis de la ficha', () => {
    expect(CAMPOS_DATOS_PERSONALES).toEqual([
      'cedula', 'ciudad_expedicion_cedula', 'matricula_profesional', 'celular', 'direccion', 'correo_personal',
    ]);
  });
});

/* En Equipo, los invitados van en un bloque propio al principio (ver
   TeamRolesView), no como una categoría más. */
it('los invitados no son una categoría de Equipo', () => {
  expect(EQUIPO_CATEGORIAS.map((c) => c.id)).not.toContain('invitados');
});

describe('el revisor eléctrico', () => {
  const caro = { id: 'u3', nombre: 'Caro', roles: ['electrico'] };
  const conRevisor = proyecto({ electrico: ['Beto'], [REVISOR_ELECTRICO]: 'Caro' });
  const electrico = { responsables: { electrico: 'R', delineante: 'E' } };
  const civil = { responsables: { civil: 'E' } };

  /* No desarrolla el proyecto: no cuenta como asignado, así que no edita
     nada y el proyecto no le sale en "Mis proyectos". */
  it('no cuenta como asignado', () => {
    expect(EQUIPO_CLAVES_SIN_ASIGNACION).toContain(REVISOR_ELECTRICO);
    expect(isAssignedToProject(caro, conRevisor)).toBe(false);
    expect(equipoNombres(conRevisor.equipo)).toEqual(['Beto']);
  });

  it('es revisor quien está puesto ahí y sigue siendo Ing. Eléctrico', () => {
    expect(esRevisorElectricoDe(caro, conRevisor)).toBe(true);
    expect(esRevisorElectricoDe({ ...caro, roles: ['civil'] }, conRevisor)).toBe(false);
    expect(esRevisorElectricoDe({ ...caro, roles: [] }, conRevisor)).toBe(false);
    expect(esRevisorElectricoDe({ nombre: 'Beto', roles: ['electrico'] }, conRevisor)).toBe(false);
    expect(esRevisorElectricoDe(null, conRevisor)).toBe(false);
  });

  /* Empezó en blanco: el revisor de la mecánica vieja no revive. */
  it('el de la clave vieja no es revisor', () => {
    expect(esRevisorElectricoDe(caro, proyecto({ aprobador_electrico: 'Caro' }))).toBe(false);
  });

  it('sus revisiones son los proyectos donde está puesto', () => {
    const otro = { ...proyecto({ [REVISOR_ELECTRICO]: 'Dani' }), id: 'p2' };
    expect(proyectosQueReviso([conRevisor, otro], caro).map((p) => p.id)).toEqual(['p1']);
  });

  it('comenta los entregables que tienen de responsable a Ing. Eléctrico, y solo esos', () => {
    expect(puedeComentarDocumento(caro, conRevisor, electrico)).toBe(true);
    expect(puedeComentarDocumento(caro, conRevisor, civil)).toBe(false);
    expect(puedeComentarDocumento(caro, conRevisor, {})).toBe(false);
    /* En un proyecto que no revisa, ninguno. */
    expect(puedeComentarDocumento(caro, proyecto({ electrico: ['Caro'] }), electrico)).toBe(false);
  });

  it('Control de Calidad sigue comentando todos', () => {
    const qa = { nombre: 'Quique', roles: ['control_calidad'] };
    expect(puedeComentarDocumento(qa, conRevisor, civil)).toBe(true);
  });
});
