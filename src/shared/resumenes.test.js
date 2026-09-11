/* ============================================================================
   RESÚMENES SEMANALES — el cálculo, sin pantalla.
   ----------------------------------------------------------------------------
   Lo que de verdad importa comprobar: que a cada quien le toquen SUS
   documentos (ni de más ni de menos), que la comparación con la semana pasada
   mida lo que se movió y no lo que apareció, y que el texto salga con el
   formato que el equipo pega en el chat.

   Nada de fechas fijas: la semana se calcula con Date.now(), así que una
   prueba anclada a un lunes concreto pasa hoy y falla la semana entrante.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  BLOQUES_RESUMEN, cambiosEntreFotos, cuentaDeFoto, etiquetaDeSemana, fotoConComparacion,
  fotoDeLaSemana, fotoDeProyecto, lunesDe, misDocumentosDelProyecto, nivelDeEstado,
  REUNIONES, cierreDeSemana, cierreValido, contarTemas, estadoDeEntrega, notaDeCierre,
  repartirEnReuniones, temasDeLaSemana, textoDeTemas, lineasDeBloque, normalizarTemas,
  ausenciaDeLaSemana, ausenciasQueTocan, rangoDeAusenciaValido, etiquetaDeMotivo,
  sinCerradosRepetidos, ESTADOS_CERRADOS, estaCerrado, sumarDias, textoDelResumen, ultimasSemanas, viernesDe,
  ROLES_TRANSVERSALES, usaAvanceCompacto, totalDeAvance,
} from './resumenes.js';

const dossier = {
  id: 'dos-1',
  nombre: 'CFM',
  version: 1,
  documentos: [
    { id: 'a', codigo: 'C-PL-001', nombre: 'Cerramiento', especialidad: 'CIVIL', tipo: 'Plano', responsables: { delineante: 'E', civil: 'R' } },
    { id: 'b', codigo: 'C-INF-001', nombre: 'Inundabilidad', especialidad: 'CIVIL', tipo: 'Informe', responsables: { hidraulico: 'E' } },
    { id: 'c', codigo: 'C-INF-002', nombre: 'Cimentaciones', especialidad: 'CIVIL', tipo: 'Informe', responsables: { estructural: 'E' } },
    { id: 'd', codigo: 'C-LIS-001', nombre: 'Cantidades', especialidad: 'CIVIL', tipo: 'Listado', responsables: {} },
  ],
};

function proyecto(over = {}) {
  return {
    id: 'p1',
    nombre: 'Chinú 3',
    dossier_id: 'dos-1',
    equipo: { civil: ['Ana'], delineante: ['Beto'], hidraulico: 'Caro' },
    documentos: {},
    data: { general: {} },
    ...over,
  };
}

describe('a quién le toca cada documento', () => {
  it('cada quien recibe los documentos de su rol, con su papel', () => {
    const p = proyecto();
    const deBeto = misDocumentosDelProyecto(p, [dossier], 'Beto');
    expect(deBeto.map((x) => x.doc.codigo)).toEqual(['C-PL-001']);
    expect(deBeto[0].papeles).toEqual(['E']);

    const deAna = misDocumentosDelProyecto(p, [dossier], 'Ana');
    expect(deAna.map((x) => x.doc.codigo)).toEqual(['C-PL-001']);
    expect(deAna[0].papeles).toEqual(['R']);

    expect(misDocumentosDelProyecto(p, [dossier], 'Caro').map((x) => x.doc.codigo)).toEqual(['C-INF-001']);
  });

  it('el mismo plano le sale a los dos: al que lo dibuja y al que lo revisa', () => {
    const p = proyecto();
    const codigos = (n) => misDocumentosDelProyecto(p, [dossier], n).map((x) => x.doc.codigo);
    expect(codigos('Beto')).toContain('C-PL-001');
    expect(codigos('Ana')).toContain('C-PL-001');
  });

  it('quien ocupa dos roles en el proyecto acumula los dos papeles', () => {
    const p = proyecto({ equipo: { civil: ['Ana'], delineante: ['Ana'] } });
    const suyos = misDocumentosDelProyecto(p, [dossier], 'Ana');
    expect(suyos[0].papeles.sort()).toEqual(['E', 'R']);
  });

  it('un documento sin responsables no es de nadie', () => {
    const p = proyecto({ equipo: { civil: ['Ana'], delineante: ['Beto'], hidraulico: 'Caro', estructural: 'Eva' } });
    const todos = ['Ana', 'Beto', 'Caro', 'Eva'].flatMap((n) => misDocumentosDelProyecto(p, [dossier], n).map((x) => x.doc.codigo));
    expect(todos).not.toContain('C-LIS-001');
  });

  it('quien no está en el equipo del proyecto no recibe nada', () => {
    expect(misDocumentosDelProyecto(proyecto(), [dossier], 'Ajeno')).toEqual([]);
  });

  /* Trámites y BT no está excluido por código: es que ningún documento lo
     nombra. Si mañana un líder le asigna uno, le empieza a salir solo. */
  it('un rol que ningún documento nombra no reporta nada, sin lista negra', () => {
    const p = proyecto({ equipo: { tramites_bt: 'Tito' } });
    expect(misDocumentosDelProyecto(p, [dossier], 'Tito')).toEqual([]);
    const conDocumento = {
      ...dossier,
      documentos: [{ ...dossier.documentos[3], responsables: { tramites_bt: 'E' } }],
    };
    expect(misDocumentosDelProyecto(p, [conDocumento], 'Tito').map((x) => x.doc.codigo)).toEqual(['C-LIS-001']);
  });
});

describe('la foto del proyecto', () => {
  it('cuenta solo mis documentos y les pone Pendiente si no tienen estado', () => {
    const foto = fotoDeProyecto(proyecto(), [dossier], 'Beto');
    expect(foto.total).toBe(1);
    expect(foto.estados).toEqual({ 'C-PL-001': 'Pendiente' });
    expect(foto.nombres).toEqual({ 'C-PL-001': 'Cerramiento' });
  });

  it('un proyecto donde no tengo documentos no genera foto', () => {
    expect(fotoDeProyecto(proyecto(), [dossier], 'Ajeno')).toBe(null);
    expect(fotoDeLaSemana([proyecto()], [dossier], 'Ajeno')).toEqual([]);
  });

  it('el porcentaje es el mismo del resto de la aplicación: APC sobre los seguidos', () => {
    const foto = {
      total: 4,
      porEstado: {
        'No aplica': 1, 'Pendiente': 1, 'Entregado': 1,
        'Aprobado para construcción (APC)': 1,
      },
    };
    expect(cuentaDeFoto(foto)).toEqual({ total: 4, seguidos: 3, apc: 1, pct: 33 });
  });

  it('sin documentos seguidos el porcentaje es 0 y no revienta', () => {
    expect(cuentaDeFoto({ total: 1, porEstado: { 'No aplica': 1 } }).pct).toBe(0);
    expect(cuentaDeFoto(null).pct).toBe(0);
  });
});

describe('la comparación con la semana pasada', () => {
  const anterior = { id: 'p1', estados: { A: 'Pendiente', B: 'Entregado', C: 'En proceso' }, nombres: {} };
  const actual = {
    id: 'p1',
    estados: { A: 'Entregado', B: 'Entregado', C: 'Pendiente', D: 'Pendiente' },
    nombres: { A: 'Uno', C: 'Tres', D: 'Cuatro' },
  };

  it('reporta lo que se movió, con su nombre', () => {
    const cambios = cambiosEntreFotos(anterior, actual);
    expect(cambios.map((c) => c.codigo).sort()).toEqual(['A', 'C']);
    expect(cambios.find((c) => c.codigo === 'A')).toMatchObject({ nombre: 'Uno', de: 'Pendiente', a: 'Entregado' });
  });

  it('lo que no cambió no aparece', () => {
    expect(cambiosEntreFotos(anterior, actual).some((c) => c.codigo === 'B')).toBe(false);
  });

  /* Que a alguien lo agreguen a un proyecto no es trabajo que hizo. */
  it('un documento nuevo para mí no cuenta como avance', () => {
    expect(cambiosEntreFotos(anterior, actual).some((c) => c.codigo === 'D')).toBe(false);
  });

  it('distingue avanzar de retroceder', () => {
    const cambios = cambiosEntreFotos(anterior, actual);
    expect(cambios.find((c) => c.codigo === 'A').avance).toBeGreaterThan(0);
    expect(cambios.find((c) => c.codigo === 'C').avance).toBeLessThan(0);
  });

  it('entrar o salir de "No aplica" no es un movimiento de trabajo', () => {
    const cambios = cambiosEntreFotos(
      { estados: { X: 'No aplica', Y: 'Pendiente' } },
      { estados: { X: 'Pendiente', Y: 'No aplica' }, nombres: {} },
    );
    expect(cambios).toEqual([]);
  });

  it('la primera semana se marca como tal, no como "cero avances"', () => {
    const [foto] = fotoConComparacion([{ id: 'p1', estados: { A: 'Pendiente' }, nombres: {} }], null);
    expect(foto.hayComparacion).toBe(false);
    expect(foto.avanzaron).toBe(0);
    const [conPrevia] = fotoConComparacion(
      [{ id: 'p1', estados: { A: 'Entregado' }, nombres: { A: 'Uno' } }],
      [{ id: 'p1', estados: { A: 'Pendiente' } }],
    );
    expect(conPrevia.hayComparacion).toBe(true);
    expect(conPrevia.avanzaron).toBe(1);
  });

  it('el nivel de un estado sigue el orden de DOC_ESTADOS', () => {
    expect(nivelDeEstado('Pendiente')).toBeLessThan(nivelDeEstado('Entregado'));
    expect(nivelDeEstado('Entregado')).toBeLessThan(nivelDeEstado('Aprobado para construcción (APC)'));
    expect(nivelDeEstado('inventado')).toBe(0);
  });
});

describe('semanas', () => {
  it('el lunes de una semana es el mismo para todos sus días', () => {
    const lunes = lunesDe(new Date(2026, 8, 7)); // lunes 7 de septiembre de 2026
    expect(lunes).toBe('2026-09-07');
    [8, 9, 10, 11, 12, 13].forEach((dia) => {
      expect(lunesDe(new Date(2026, 8, dia)), String(dia)).toBe('2026-09-07');
    });
  });

  it('el domingo pertenece a la semana que termina, no a la que empieza', () => {
    expect(lunesDe(new Date(2026, 8, 13))).toBe('2026-09-07');
    expect(lunesDe(new Date(2026, 8, 14))).toBe('2026-09-14');
  });

  it('sumar días cruza meses y años sin desfase de zona horaria', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(viernesDe('2026-09-07')).toBe('2026-09-11');
  });

  /* Nada de fechas fijas: se comprueba la forma, no un lunes concreto. */
  it('las últimas semanas arrancan en la actual y van hacia atrás de 7 en 7', () => {
    const semanas = ultimasSemanas(4);
    expect(semanas[0]).toBe(lunesDe());
    expect(semanas.length).toBe(4);
    semanas.forEach((s, i) => {
      if (i > 0) expect(sumarDias(semanas[i - 1], -7)).toBe(s);
    });
  });

  it('la etiqueta se lee como la diría una persona', () => {
    expect(etiquetaDeSemana('2026-09-07')).toBe('Del 7 al 11 de septiembre de 2026');
    expect(etiquetaDeSemana('2026-09-07', '2026-09-09')).toBe('Del 7 al 9 de septiembre de 2026');
    expect(etiquetaDeSemana('2026-09-28', '2026-10-02')).toBe('Del 28 de septiembre al 2 de octubre de 2026');
    expect(etiquetaDeSemana('2026-12-28', '2027-01-01')).toBe('Del 28 de diciembre de 2026 al 1 de enero de 2027');
  });
});

describe('el texto que se pega en el chat', () => {
  const bloques = {
    lo_mejor: ['Reunión Drawing Team', 'Versión 00 de Chinú 5'],
    pendientes: ['Retomar San Tomás'],
    dificultades: [],
    temas: [],
  };

  it('sale con los cuatro bloques y "Ninguna"/"Ninguno" donde no hay nada', () => {
    const texto = textoDelResumen({ bloques, proyectos: [] });
    expect(texto).toBe([
      'Buenas tardes',
      '',
      'Lo mejor',
      '-Reunión Drawing Team',
      '-Versión 00 de Chinú 5',
      '',
      'Pendientes',
      '-Retomar San Tomás',
      '',
      'Dificultades',
      '-Ninguna',
      '',
      'Temas',
      '-Ninguno',
    ].join('\n'));
  });

  it('las líneas en blanco no se cuelan', () => {
    const texto = textoDelResumen({ bloques: { lo_mejor: ['Algo', '   ', ''] }, proyectos: [] });
    expect(texto).toContain('-Algo');
    expect(texto).not.toContain('-   ');
    expect(texto.split('\n').filter((l) => l === '-').length).toBe(0);
  });

  it('el avance va arriba y se puede dejar por fuera', () => {
    const proyectos = [{
      id: 'p1', nombre: 'Chinú 3', total: 2,
      porEstado: { 'Pendiente': 1, 'Aprobado para construcción (APC)': 1 },
      hayComparacion: true, avanzaron: 1,
    }];
    const con = textoDelResumen({ bloques, proyectos });
    expect(con).toContain('Avance de mis proyectos');
    expect(con).toContain('-Chinú 3: 50% (1 de 2 en APC) · 1 documento avanzó esta semana');
    expect(textoDelResumen({ bloques, proyectos, incluirAvance: false })).not.toContain('Avance de mis proyectos');
  });

  it('la primera semana lo dice en vez de anunciar cero avances', () => {
    const proyectos = [{ id: 'p1', nombre: 'Chinú 3', total: 1, porEstado: { 'Pendiente': 1 }, hayComparacion: false, avanzaron: 0 }];
    expect(textoDelResumen({ bloques, proyectos })).toContain('primera semana registrada');
  });

  it('una semana sin movimiento lo dice sin adornos', () => {
    const proyectos = [{ id: 'p1', nombre: 'Chinú 3', total: 1, porEstado: { 'Pendiente': 1 }, hayComparacion: true, avanzaron: 0 }];
    expect(textoDelResumen({ bloques, proyectos })).toContain('sin cambios esta semana');
  });

  it('los cuatro bloques salen siempre, en orden, aunque el resumen esté vacío', () => {
    const texto = textoDelResumen({ bloques: {}, proyectos: [] });
    const posiciones = BLOQUES_RESUMEN.map((b) => texto.indexOf(b.label));
    expect(posiciones.every((p) => p > -1)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });
});

const APC = 'Aprobado para construcción (APC)';

describe('el avance de quien está en casi todos los proyectos', () => {
  /* Hidráulico, estructural y geotécnico no llevan tres proyectos: están en
     casi todos. Treinta tarjetas, veintiocho quietas en el mismo porcentaje,
     entierran lo único que un resumen semanal tiene que decir. */
  const foto = (id, apc, total, avanzaron) => ({
    id, nombre: id, estado: 'activo', total,
    porEstado: { [APC]: apc },
    hayComparacion: true, avanzaron, cambios: [],
  });

  it('reconoce los tres roles, y solo esos', () => {
    expect(ROLES_TRANSVERSALES).toEqual(['hidraulico', 'estructural', 'geotecnico']);
    expect(usaAvanceCompacto({ roles: ['geotecnico'] })).toBe(true);
    expect(usaAvanceCompacto({ roles: ['civil', 'estructural'] })).toBe(true);
    expect(usaAvanceCompacto({ roles: ['civil'] })).toBe(false);
    expect(usaAvanceCompacto(null)).toBe(false);
  });

  it('suma el avance de todos los proyectos en uno solo', () => {
    const t = totalDeAvance([foto('a', 5, 10, 0), foto('b', 3, 10, 2)]);
    expect(t.proyectos).toBe(2);
    expect(t.seguidos).toBe(20);
    expect(t.apc).toBe(8);
    expect(t.pct).toBe(40);
  });

  /* Lo que se movió es la noticia; lo quieto se cuenta, no se lista. */
  it('separa los que se movieron de los que siguen igual', () => {
    const t = totalDeAvance([foto('a', 5, 10, 0), foto('b', 3, 10, 2), foto('c', 1, 10, 1)]);
    expect(t.conMovimiento.map((f) => f.id)).toEqual(['b', 'c']);
    expect(t.avanzaron).toBe(3);
    expect(t.quietos).toBe(1);
  });

  it('una semana sin movimiento lo dice sin dividir por cero', () => {
    const t = totalDeAvance([]);
    expect(t).toMatchObject({ proyectos: 0, seguidos: 0, apc: 0, pct: 0, avanzaron: 0, quietos: 0 });
  });

  /* Los "No aplica" no cuentan, igual que en la torta del resto de la
     aplicación. */
  it('no cuenta los documentos en "No aplica"', () => {
    const conNoAplica = { ...foto('a', 5, 10, 0), porEstado: { [APC]: 5, 'No aplica': 4 } };
    expect(totalDeAvance([conNoAplica]).seguidos).toBe(6);
  });
});

describe('el texto del resumen, en su versión corta', () => {
  const fotos = [
    { id: 'a', nombre: 'Chinú 3', total: 10, porEstado: { [APC]: 5 }, hayComparacion: true, avanzaron: 0 },
    { id: 'b', nombre: 'La Vega', total: 10, porEstado: { [APC]: 3 }, hayComparacion: true, avanzaron: 2 },
    { id: 'c', nombre: 'Gamarra', total: 10, porEstado: { [APC]: 1 }, hayComparacion: true, avanzaron: 0 },
  ];

  it('lleva el total y solo lo que se movió', () => {
    const texto = textoDelResumen({ bloques: {}, proyectos: fotos, compacto: true });
    expect(texto).toContain('-En total: 3 proyectos, 9 de 30 documentos en APC (30%)');
    expect(texto).toContain('-La Vega: 30% · 2 documentos avanzaron');
    expect(texto).toContain('-Los otros 2 siguen igual');
    /* Los quietos no se listan uno por uno: esa es la razón de todo esto. */
    expect(texto).not.toContain('Chinú 3');
  });

  it('una semana sin movimiento lo dice', () => {
    const quietos = fotos.map((f) => ({ ...f, avanzaron: 0 }));
    const texto = textoDelResumen({ bloques: {}, proyectos: quietos, compacto: true });
    expect(texto).toContain('-Ningún proyecto se movió esta semana');
  });

  /* Para el resto del equipo el texto no cambia. */
  it('sin compacto sigue listando proyecto por proyecto', () => {
    const texto = textoDelResumen({ bloques: {}, proyectos: fotos });
    expect(texto).toContain('Chinú 3');
    expect(texto).toContain('Gamarra');
    expect(texto).not.toContain('En total:');
  });
});

describe('un proyecto que deja de moverse aparece una vez y deja de estorbar', () => {
  const activo = { id: 'p1', estado: 'activo', estados: {} };
  const cerrado = (estado) => ({ id: 'p2', estado, estados: {} });
  const previa = (estado) => [{ id: 'p2', estado, estados: {} }];
  const ids = (fotos, previas) => sinCerradosRepetidos(fotos, previas).map((f) => f.id);

  it('finalizado, en pausa e inactivo cuentan como cerrados', () => {
    expect(ESTADOS_CERRADOS).toEqual(['finalizado', 'pausa', 'inactivo']);
    expect(estaCerrado('activo')).toBe(false);
    expect(estaCerrado('pausa')).toBe(true);
  });

  /* La semana del cambio es la noticia; las siguientes, ruido. */
  it.each(['finalizado', 'pausa', 'inactivo'])('la semana en que pasa a %s sí sale', (estado) => {
    expect(ids([activo, cerrado(estado)], previa('activo'))).toEqual(['p1', 'p2']);
  });

  it.each(['finalizado', 'pausa', 'inactivo'])('las semanas siguientes en %s ya no', (estado) => {
    expect(ids([activo, cerrado(estado)], previa(estado))).toEqual(['p1']);
  });

  /* Pasar de pausa a inactivo también es un cambio de estado. */
  it('cambiar de un estado cerrado a otro sí sale', () => {
    expect(ids([cerrado('inactivo')], previa('pausa'))).toEqual(['p2']);
  });

  /* Reactivarlo lo devuelve a la lista: 'activo' nunca se filtra. */
  it('al reactivarlo vuelve a aparecer todas las semanas', () => {
    const reactivado = { id: 'p2', estado: 'activo', estados: {} };
    expect(ids([reactivado], previa('pausa'))).toEqual(['p2']);
    expect(ids([reactivado], previa('activo'))).toEqual(['p2']);
  });

  /* Más vale que salga una vez de más a que un proyecto recién cerrado no
     quede registrado nunca. */
  it('sin foto anterior se deja pasar', () => {
    expect(ids([activo, cerrado('finalizado')], null)).toEqual(['p1', 'p2']);
    expect(ids([cerrado('pausa')], null)).toEqual(['p2']);
  });

  it('fotoConComparacion también lo filtra', () => {
    const previas = [{ id: 'p2', estado: 'pausa', estados: {} }];
    expect(fotoConComparacion([activo, cerrado('pausa')], previas).map((f) => f.id)).toEqual(['p1']);
  });
});

describe('la foto guarda con qué me toca cada documento', () => {
  it('trae el papel de cada uno y el estado del proyecto', () => {
    const p = {
      id: 'p1', nombre: 'Chinú 3', estado: 'finalizado', dossier_id: 'dos-1',
      equipo: { civil: ['Ana'], delineante: ['Ana'] }, documentos: {}, data: { general: {} },
    };
    const foto = fotoDeProyecto(p, [dossier], 'Ana');
    expect(foto.estado).toBe('finalizado');
    expect(foto.papeles['C-PL-001'].sort()).toEqual(['E', 'R']);
  });

  it('un proyecto sin estado se toma como activo', () => {
    expect(fotoDeProyecto(proyecto(), [dossier], 'Ana').estado).toBe('activo');
  });
});

describe('el cierre de la semana', () => {
  const LUNES = '2026-09-07';
  const VIERNES = '2026-09-11';

  it('sin nada configurado, la semana cierra el viernes', () => {
    expect(cierreDeSemana(LUNES, [])).toBe(VIERNES);
    expect(cierreDeSemana(LUNES, undefined)).toBe(VIERNES);
    expect(cierreDeSemana(LUNES, [{ semana: '2026-09-14', cierre: '2026-09-17' }])).toBe(VIERNES);
  });

  it('un líder lo puede correr, y solo para esa semana', () => {
    const cierres = [{ semana: LUNES, cierre: '2026-09-10', nota: 'Viernes festivo' }];
    expect(cierreDeSemana(LUNES, cierres)).toBe('2026-09-10');
    expect(notaDeCierre(LUNES, cierres)).toBe('Viernes festivo');
    /* La semana siguiente no se entera. */
    expect(cierreDeSemana('2026-09-14', cierres)).toBe('2026-09-18');
    expect(notaDeCierre('2026-09-14', cierres)).toBe('');
  });

  /* Mover el cierre fuera de su semana dejaria a todo el mundo "sin vencer"
     para siempre, o vencido desde antes de empezar. */
  it('el cierre tiene que caer dentro de su propia semana', () => {
    expect(cierreValido(LUNES, LUNES)).toBe(true);
    expect(cierreValido(LUNES, '2026-09-13')).toBe(true);   // domingo
    expect(cierreValido(LUNES, '2026-09-06')).toBe(false);  // domingo anterior
    expect(cierreValido(LUNES, '2026-09-14')).toBe(false);  // lunes siguiente
    expect(cierreValido(LUNES, '')).toBe(false);
    expect(cierreValido(LUNES, null)).toBe(false);
  });
});

describe('en qué va la entrega de cada quien', () => {
  const CIERRE = '2026-09-11';
  const enviado = { enviado: true };
  const borrador = { enviado: false };

  it('enviado manda sobre todo lo demás, aunque ya haya vencido', () => {
    expect(estadoDeEntrega(enviado, CIERRE, new Date(2026, 8, 9))).toBe('enviado');
    expect(estadoDeEntrega(enviado, CIERRE, new Date(2026, 8, 30))).toBe('enviado');
  });

  it('antes del cierre está pendiente, sin alarma', () => {
    expect(estadoDeEntrega(null, CIERRE, new Date(2026, 8, 9))).toBe('pendiente');
    expect(estadoDeEntrega(borrador, CIERRE, new Date(2026, 8, 9))).toBe('pendiente');
  });

  /* El resumen se manda EL día del cierre, casi siempre por la tarde: ese día
     no puede contar como vencido. */
  it('el día del cierre avisa, pero todavía no está vencido', () => {
    expect(estadoDeEntrega(null, CIERRE, new Date(2026, 8, 11))).toBe('cierra_hoy');
  });

  it('pasado el cierre, vencido', () => {
    expect(estadoDeEntrega(null, CIERRE, new Date(2026, 8, 12))).toBe('vencido');
    expect(estadoDeEntrega(borrador, CIERRE, new Date(2026, 8, 20))).toBe('vencido');
  });

  it('un borrador sin enviar no cuenta como entregado', () => {
    expect(estadoDeEntrega(borrador, CIERRE, new Date(2026, 8, 12))).toBe('vencido');
  });
});

describe('ausencias', () => {
  const SEM = '2026-09-07';   // lunes
  const CIERRE = '2026-09-11'; // viernes
  const aus = (over) => ({ id: 'a1', usuario_id: 'u1', desde: SEM, hasta: CIERRE, motivo: 'vacaciones', ...over });

  it('la que cubre toda la semana tapa la entrega', () => {
    expect(ausenciaDeLaSemana([aus()], 'u1', SEM, CIERRE)).toBeTruthy();
  });

  it('una que empezó antes y sigue después también', () => {
    expect(ausenciaDeLaSemana([aus({ desde: '2026-08-01', hasta: '2026-12-31' })], 'u1', SEM, CIERRE)).toBeTruthy();
  });

  /* Quien trabajó aunque fuera un día tiene algo que contar: para cerrar
     antes está el "hasta" de su propio resumen, no esto. */
  it('la que cubre solo parte de la semana NO tapa nada', () => {
    expect(ausenciaDeLaSemana([aus({ desde: '2026-09-09' })], 'u1', SEM, CIERRE)).toBe(null);
    expect(ausenciaDeLaSemana([aus({ hasta: '2026-09-10' })], 'u1', SEM, CIERRE)).toBe(null);
  });

  it('la de otra persona no cuenta', () => {
    expect(ausenciaDeLaSemana([aus()], 'u2', SEM, CIERRE)).toBe(null);
    expect(ausenciaDeLaSemana([aus()], null, SEM, CIERRE)).toBe(null);
  });

  /* Si el líder corrió el cierre al jueves, la ausencia hasta el jueves ya
     cubre la semana entera. */
  it('se mide contra el cierre de verdad, no contra el viernes', () => {
    expect(ausenciaDeLaSemana([aus({ hasta: '2026-09-10' })], 'u1', SEM, '2026-09-10')).toBeTruthy();
  });

  it('sin ausencias no revienta', () => {
    expect(ausenciaDeLaSemana(null, 'u1', SEM, CIERRE)).toBe(null);
    expect(ausenciasQueTocan(null, SEM)).toEqual([]);
  });

  it('se listan las que tocan la semana, aunque sea un día, en orden', () => {
    const lista = ausenciasQueTocan([
      aus({ id: 'b', desde: '2026-09-10', hasta: '2026-09-15' }),
      aus({ id: 'a', desde: '2026-09-01', hasta: '2026-09-07' }),
      aus({ id: 'fuera', desde: '2026-10-01', hasta: '2026-10-05' }),
    ], SEM);
    expect(lista.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('un rango al revés no se guarda', () => {
    expect(rangoDeAusenciaValido(SEM, CIERRE)).toBe(true);
    expect(rangoDeAusenciaValido(SEM, SEM)).toBe(true);
    expect(rangoDeAusenciaValido(CIERRE, SEM)).toBe(false);
    expect(rangoDeAusenciaValido('', CIERRE)).toBe(false);
    expect(rangoDeAusenciaValido(SEM, null)).toBe(false);
  });

  it('el motivo tiene nombre legible, y uno desconocido no deja el hueco', () => {
    expect(etiquetaDeMotivo('incapacidad')).toBe('Incapacidad');
    expect(etiquetaDeMotivo('lo_que_sea')).toBe('Ausente');
  });

  describe('cómo se ve en la entrega', () => {
    const DESPUES = new Date('2026-09-14T09:00:00');

    it('ausente en vez de vencido', () => {
      expect(estadoDeEntrega(null, CIERRE, DESPUES)).toBe('vencido');
      expect(estadoDeEntrega(null, CIERRE, DESPUES, aus())).toBe('ausente');
    });

    /* Quien mandó su resumen aunque estuviera de vacaciones hizo el trabajo:
       manda lo que hizo, no lo que se esperaba de él. */
    it('haberlo enviado gana sobre la ausencia', () => {
      expect(estadoDeEntrega({ enviado: true }, CIERRE, DESPUES, aus())).toBe('enviado');
    });
  });
});

describe('los temas de las reuniones', () => {
  const SEM = '2026-09-07';
  const gente = [
    { id: 'u1', nombre: 'Ana' },
    { id: 'u2', nombre: 'Beto' },
    { id: 'u3', nombre: 'Caro' },
  ];
  const resumen = (over) => ({
    usuario_id: 'u1', semana: SEM, enviado: true, bloques: { temas: ['Un tema'] }, ...over,
  });

  const textos = (g) => g.temas.map((t) => t.texto);

  it('junta los temas de todos, agrupados por quien los puso y en orden', () => {
    const grupos = temasDeLaSemana([
      resumen({ usuario_id: 'u2', bloques: { temas: ['Lo de Beto'] } }),
      resumen({ usuario_id: 'u1', bloques: { temas: ['Lo de Ana', 'Otro de Ana'] } }),
    ], SEM, gente);
    expect(grupos.map((g) => g.nombre)).toEqual(['Ana', 'Beto']);
    expect(textos(grupos[0])).toEqual(['Lo de Ana', 'Otro de Ana']);
    expect(contarTemas(grupos)).toBe(3);
  });

  /* Llevar a una reunion un tema que alguien todavia estaba pensando seria
     peor que no llevarlo. */
  it('un borrador sin enviar no entra al orden del día', () => {
    const grupos = temasDeLaSemana([resumen({ enviado: false })], SEM, gente);
    expect(grupos).toEqual([]);
  });

  it('solo mira la semana que se pidió', () => {
    const grupos = temasDeLaSemana([resumen({ semana: '2026-08-31' })], SEM, gente);
    expect(grupos).toEqual([]);
  });

  it('quien no puso temas no aparece con una fila vacía', () => {
    const grupos = temasDeLaSemana([
      resumen({ usuario_id: 'u1', bloques: { temas: [] } }),
      resumen({ usuario_id: 'u2', bloques: {} }),
      resumen({ usuario_id: 'u3', bloques: { temas: ['  ', ''] } }),
    ], SEM, gente);
    expect(grupos).toEqual([]);
  });

  it('las líneas en blanco no se cuelan', () => {
    const grupos = temasDeLaSemana([resumen({ bloques: { temas: ['Sí', '  ', ''] } })], SEM, gente);
    expect(textos(grupos[0])).toEqual(['Sí']);
  });

  /* El nombre sale del directorio, no del resumen: asi un cambio de nombre no
     deja temas viejos firmados por un fantasma. */
  it('el nombre lo pone el directorio', () => {
    const grupos = temasDeLaSemana([resumen()], SEM, [{ id: 'u1', nombre: 'Ana María' }]);
    expect(grupos[0].nombre).toBe('Ana María');
  });

  it('un tema de alguien que ya no está en el equipo no se pierde', () => {
    const grupos = temasDeLaSemana([resumen({ usuario_id: 'fuera' })], SEM, gente);
    expect(grupos.length).toBe(1);
    expect(textos(grupos[0])).toEqual(['Un tema']);
  });

  it('sin resúmenes no revienta', () => {
    expect(temasDeLaSemana(null, SEM, null)).toEqual([]);
    expect(contarTemas(null)).toBe(0);
  });

  /* Los temas guardados antes de que se pudiera elegir reunión eran texto
     pelado. Se leen como temas del área: era la única que existía. */
  it('un tema viejo, sin reunión elegida, queda en la de su área', () => {
    const grupos = temasDeLaSemana([resumen({ bloques: { temas: ['De antes'] } })], SEM, gente);
    expect(grupos[0].temas).toEqual([{ texto: 'De antes', reunion: 'equipo' }]);
  });

  it('un tema nuevo conserva la reunión que se le eligió', () => {
    const grupos = temasDeLaSemana([
      resumen({ bloques: { temas: [{ texto: 'Para diseño', reunion: 'diseno' }] } }),
    ], SEM, gente);
    expect(grupos[0].temas).toEqual([{ texto: 'Para diseño', reunion: 'diseno' }]);
  });

  it('normalizarTemas descarta los vacíos, vengan como vengan', () => {
    expect(normalizarTemas(['  ', { texto: '' }, 'Vale', { texto: ' Otro ', reunion: 'diseno' }]))
      .toEqual([{ texto: 'Vale', reunion: 'equipo' }, { texto: 'Otro', reunion: 'diseno' }]);
    expect(normalizarTemas(null)).toEqual([]);
  });
});

describe('los renglones de un bloque, listos para leer', () => {
  it('los bloques normales salen tal cual, sin blancos', () => {
    expect(lineasDeBloque('pendientes', { pendientes: ['Uno', '  ', 'Dos'] })).toEqual(['Uno', 'Dos']);
  });

  /* En el mensaje del chat, un tema de diseño tiene que decir que lo es: si
     no, quien lo lee no sabe a qué reunión va. */
  it('los temas de diseño se marcan; los del área, no', () => {
    expect(lineasDeBloque('temas', {
      temas: [{ texto: 'Del área', reunion: 'equipo' }, { texto: 'De diseño', reunion: 'diseno' }],
    })).toEqual(['Del área', 'De diseño (reunión de diseño)']);
  });

  it('aguanta un bloque que no existe', () => {
    expect(lineasDeBloque('temas', {})).toEqual([]);
    expect(lineasDeBloque('lo_mejor', null)).toEqual([]);
  });
});

describe('el orden del día como texto', () => {
  const grupos = [
    { nombre: 'Ana', temas: ['Alcance de Chinú 5', 'Fechas de entrega'] },
    { nombre: 'Beto', temas: ['Quién dibuja el cerramiento'] },
  ];

  it('sale agrupado por persona, listo para pegar', () => {
    expect(textoDeTemas(grupos, 'Del 7 al 11 de septiembre de 2026')).toBe([
      'Temas para la reunión · Del 7 al 11 de septiembre de 2026',
      '',
      'Ana',
      '-Alcance de Chinú 5',
      '-Fechas de entrega',
      '',
      'Beto',
      '-Quién dibuja el cerramiento',
    ].join('\n'));
  });

  it('sin temas lo dice en vez de entregar un texto a medias', () => {
    expect(textoDeTemas([], 'Del 7 al 11')).toBe('Temas para la reunión · Del 7 al 11\n\nNinguno');
  });
});

describe('el reparto en las reuniones del lunes', () => {
  const grupo = (usuario_id, roles, temas = ['Un tema']) => ({ usuario_id, nombre: usuario_id, roles, temas });
  const paraDiseno = (texto) => ({ texto, reunion: 'diseno' });
  const deLa = (reuniones, id) => reuniones.find((r) => r.id === id);

  it('cada área tiene su reunión', () => {
    const reuniones = repartirEnReuniones([
      grupo('civil', ['civil']),
      grupo('electrico', ['electrico']),
      grupo('delineante', ['delineante']),
    ]);
    expect(deLa(reuniones, 'civil').grupos.map((g) => g.usuario_id)).toEqual(['civil']);
    expect(deLa(reuniones, 'electrica').grupos.map((g) => g.usuario_id)).toEqual(['electrico']);
    expect(deLa(reuniones, 'delineantes').grupos.map((g) => g.usuario_id)).toEqual(['delineante']);
  });

  /* Hidraulico, estructural y geotecnico van a la civil, igual que en la
     pestana Equipo: una sola lista diciendo quien es "civil". */
  it('hidráulicos, estructurales y geotécnicos van a la civil', () => {
    const reuniones = repartirEnReuniones([
      grupo('h', ['hidraulico']), grupo('e', ['estructural']), grupo('g', ['geotecnico']),
    ]);
    expect(deLa(reuniones, 'civil').grupos.length).toBe(3);
    expect(deLa(reuniones, 'electrica').grupos).toEqual([]);
  });

  it('cada líder de área va a la suya', () => {
    const reuniones = repartirEnReuniones([
      grupo('lc', ['lider_civil']), grupo('le', ['lider_electrico']), grupo('ld', ['lider_delineantes']),
    ]);
    expect(deLa(reuniones, 'civil').grupos.map((g) => g.usuario_id)).toEqual(['lc']);
    expect(deLa(reuniones, 'electrica').grupos.map((g) => g.usuario_id)).toEqual(['le']);
    expect(deLa(reuniones, 'delineantes').grupos.map((g) => g.usuario_id)).toEqual(['ld']);
  });

  /* Repetirlo es mejor que esconderlo: en la reunion que sobre se pasa de
     largo, en la que falte no se habla nunca. */
  it('quien es de dos áreas lleva su tema a las dos reuniones', () => {
    const reuniones = repartirEnReuniones([grupo('ambos', ['civil', 'delineante'])]);
    expect(deLa(reuniones, 'civil').grupos.length).toBe(1);
    expect(deLa(reuniones, 'delineantes').grupos.length).toBe(1);
    expect(deLa(reuniones, 'electrica').grupos.length).toBe(0);
  });

  /* Un orden del dia que se come temas en silencio no sirve para nada. */
  it('quien no cae en ninguna no se pierde: va a un grupo aparte', () => {
    const reuniones = repartirEnReuniones([
      grupo('bt', ['tramites_bt']), grupo('qa', ['control_calidad']), grupo('jefe', ['lider_diseno']),
    ]);
    const otros = deLa(reuniones, 'otros');
    expect(otros).toBeTruthy();
    expect(otros.grupos.map((g) => g.usuario_id).sort()).toEqual(['bt', 'jefe', 'qa']);
  });

  it('sin sueltos no aparece el grupo aparte', () => {
    const reuniones = repartirEnReuniones([grupo('c', ['civil'])]);
    expect(deLa(reuniones, 'otros')).toBe(undefined);
  });

  /* Quien convoca necesita ver que su reunion no tiene temas, no que no
     existe. */
  it('todas las reuniones se devuelven siempre, aunque estén vacías', () => {
    const reuniones = repartirEnReuniones([]);
    expect(reuniones.map((r) => r.id)).toEqual(['diseno', ...REUNIONES.map((r) => r.id)]);
    expect(reuniones.every((r) => r.grupos.length === 0)).toBe(true);
    expect(repartirEnReuniones(null).length).toBe(4);
  });

  /* La reunión de diseño es la única a la que va todo el mundo: ahí el rol
     de quien puso el tema no decide nada. */
  it('la de diseño recoge los temas de cualquiera, sin mirar el rol', () => {
    const reuniones = repartirEnReuniones([
      grupo('civil', ['civil'], [paraDiseno('Uno')]),
      grupo('bt', ['tramites_bt'], [paraDiseno('Dos')]),
      grupo('nadie', [], [paraDiseno('Tres')]),
    ]);
    expect(deLa(reuniones, 'diseno').grupos.map((g) => g.usuario_id)).toEqual(['civil', 'bt', 'nadie']);
    expect(deLa(reuniones, 'civil').grupos).toEqual([]);
    expect(deLa(reuniones, 'otros')).toBe(undefined);
  });

  it('un tema de diseño no se cuela en la reunión del área', () => {
    const reuniones = repartirEnReuniones([grupo('c', ['civil'], [paraDiseno('Solo diseño')])]);
    expect(deLa(reuniones, 'civil').grupos).toEqual([]);
    expect(deLa(reuniones, 'diseno').grupos.length).toBe(1);
  });

  /* Quien reparte sus temas entre las dos reuniones aparece en ambas, pero
     cada una con lo suyo. */
  it('cada reunión se queda solo con los temas que le tocan', () => {
    const reuniones = repartirEnReuniones([
      grupo('ana', ['civil'], ['Del área', paraDiseno('De diseño'), 'Otro del área']),
    ]);
    expect(deLa(reuniones, 'civil').grupos[0].temas.map((t) => t.texto)).toEqual(['Del área', 'Otro del área']);
    expect(deLa(reuniones, 'diseno').grupos[0].temas.map((t) => t.texto)).toEqual(['De diseño']);
  });

  it('alguien sin rol asignado tampoco se pierde', () => {
    const reuniones = repartirEnReuniones([grupo('nuevo', [])]);
    expect(deLa(reuniones, 'otros').grupos.map((g) => g.usuario_id)).toEqual(['nuevo']);
  });

  it('los grupos traen los roles de quien puso el tema', () => {
    const grupos = temasDeLaSemana(
      [{ usuario_id: 'u1', semana: 'S', enviado: true, bloques: { temas: ['Algo'] } }],
      'S',
      [{ id: 'u1', nombre: 'Ana', roles: ['civil', 'delineante'] }],
    );
    expect(grupos[0].roles).toEqual(['civil', 'delineante']);
  });
});

describe('el texto de una reunión concreta', () => {
  it('lleva el nombre de su reunión en el encabezado', () => {
    const texto = textoDeTemas([{ nombre: 'Ana', temas: ['Algo'] }], 'Del 7 al 11', 'Reunión civil');
    expect(texto.startsWith('Reunión civil · Del 7 al 11')).toBe(true);
  });
});
