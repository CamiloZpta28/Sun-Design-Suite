/* ============================================================================
   REUNIONES — el cálculo, sin pantalla.
   ----------------------------------------------------------------------------
   Lo que hay que asegurar: que cada quien caiga en su reunión, que la rotación
   siga desde quien moderó de verdad y se salte al ausente, que a la sesión le
   lleguen los temas de la semana ANTERIOR, y que el registro cuente lo que se
   revisó ese día y no lo que se movió a mitad de semana.

   Las fechas aquí son fijas a propósito, pero nunca se comparan con "hoy":
   todo lo que depende del día se recibe como parámetro.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  actualizacionValida, ausenteEl, bandejaDeLaSesion, fechaLegible, nombreDe,
  fueraDelEquipo, idDePlan, proximoModerador, limpiarItems, nombreDeProyecto, planAnterior, planDe, tienePlan, claveDeTema, fechaDeSesion, fechaDeSesionValida,
  gestionaReunion, historialDe, idDeSesion, moderadorDeLaSesion, moderadorFijo, moderadorSugerido, participantes,
  pendientesDeReunion, proximoModerador, tieneRotacion,
  puedeActualizarPendiente, registroDeLaSesion, registroVacio, resolucionValida, reunionInicial,
  reunionesDePersona, semanaDeLosTemas, semanasAbierto, temasParaLaSesion, textoDelRegistro,
  ultimaJustificacion,
} from './reuniones.js';

const directorio = [
  { id: 'ana', nombre: 'Ana', roles: ['civil'] },
  { id: 'beto', nombre: 'Beto', roles: ['delineante'] },
  { id: 'caro', nombre: 'Caro', roles: ['electrico'] },
  { id: 'dani', nombre: 'Dani', roles: ['hidraulico'] },
  { id: 'eva', nombre: 'Eva', roles: ['civil', 'delineante'] },
  { id: 'lucho', nombre: 'Lucho', roles: ['lider_civil'] },
  { id: 'jefa', nombre: 'Jefa', roles: ['lider_diseno'] },
  { id: 'nuevo', nombre: 'Nuevo', roles: [] },
];
const persona = (id) => directorio.find((p) => p.id === id);

describe('quién va a qué reunión', () => {
  it('cada quien cae en la de su área, y los transversales en la civil', () => {
    expect(reunionesDePersona(persona('ana')).map((r) => r.id)).toEqual(['civil']);
    expect(reunionesDePersona(persona('caro')).map((r) => r.id)).toEqual(['electrica']);
    expect(reunionesDePersona(persona('beto')).map((r) => r.id)).toEqual(['delineantes']);
    expect(reunionesDePersona(persona('dani')).map((r) => r.id)).toEqual(['civil']);
  });

  it('quien es de dos áreas va a las dos', () => {
    expect(reunionesDePersona(persona('eva')).map((r) => r.id)).toEqual(['civil', 'delineantes']);
  });

  it('el líder de área va a la suya', () => {
    expect(reunionesDePersona(persona('lucho')).map((r) => r.id)).toEqual(['civil']);
  });

  it('la pantalla abre en la propia; quien no tiene área abre en la de diseño', () => {
    expect(reunionInicial(persona('caro'))).toBe('electrica');
    expect(reunionInicial(persona('jefa'))).toBe('diseno');
  });

  it('un invitado no va a ninguna reunión', () => {
    expect(reunionesDePersona(persona('nuevo'))).toEqual([]);
    expect(participantes('civil', directorio).map((p) => p.id)).not.toContain('nuevo');
  });

  it('los participantes salen ordenados por nombre', () => {
    expect(participantes('civil', directorio).map((p) => p.id)).toEqual(['ana', 'dani', 'eva', 'lucho']);
  });
});

describe('quién gestiona cada reunión', () => {
  it('el líder de área gestiona la suya y no las otras', () => {
    expect(gestionaReunion(persona('lucho'), 'civil')).toBe(true);
    expect(gestionaReunion(persona('lucho'), 'electrica')).toBe(false);
  });

  it('el Líder de Diseño y el Desarrollador gestionan todas', () => {
    expect(gestionaReunion(persona('jefa'), 'electrica')).toBe(true);
    expect(gestionaReunion({ id: 'd', nombre: 'Dev', roles: ['desarrollador'] }, 'delineantes')).toBe(true);
  });

  it('un ingeniero no gestiona, ni un invitado', () => {
    expect(gestionaReunion(persona('ana'), 'civil')).toBe(false);
    expect(gestionaReunion(persona('nuevo'), 'civil')).toBe(false);
  });
});

describe('las sesiones', () => {
  it('el id es determinista: dos que abren a la vez no crean dos filas', () => {
    expect(idDeSesion('civil', '2026-10-05')).toBe('sesion-civil-2026-10-05');
  });

  it('la fecha es el lunes, salvo que la corran', () => {
    expect(fechaDeSesion(null, '2026-10-05')).toBe('2026-10-05');
    expect(fechaDeSesion({ fecha: '2026-10-06' }, '2026-10-05')).toBe('2026-10-06');
  });

  it('la fecha corrida tiene que caer en la misma semana', () => {
    expect(fechaDeSesionValida('2026-10-05', '2026-10-06')).toBe(true);
    expect(fechaDeSesionValida('2026-10-05', '2026-10-11')).toBe(true);
    expect(fechaDeSesionValida('2026-10-05', '2026-10-12')).toBe(false);
    expect(fechaDeSesionValida('2026-10-05', '2026-10-04')).toBe(false);
    expect(fechaDeSesionValida('2026-10-05', '')).toBe(false);
  });
});

describe('a quién le toca moderar', () => {
  const rotaciones = [{ serie: 'civil', orden: ['ana', 'dani', 'eva'] }];
  const base = { reunionId: 'civil', semana: '2026-10-12', rotaciones, sesiones: [], ausencias: [] };

  it('sin historia arranca por el primero de la lista', () => {
    expect(moderadorSugerido(base).usuarioId).toBe('ana');
  });

  it('sigue desde quien moderó la última sesión', () => {
    const sesiones = [{ serie: 'civil', semana: '2026-10-05', moderador_id: 'ana' }];
    expect(moderadorSugerido({ ...base, sesiones }).usuarioId).toBe('dani');
  });

  it('da la vuelta al final de la lista', () => {
    const sesiones = [{ serie: 'civil', semana: '2026-10-05', moderador_id: 'eva' }];
    expect(moderadorSugerido({ ...base, sesiones }).usuarioId).toBe('ana');
  });

  /* Si el líder eligió a otra persona una semana, la rotación sigue desde
     quien moderó de verdad. */
  it('sigue desde quien moderó de verdad, aunque haya sido fuera de turno', () => {
    const sesiones = [
      { serie: 'civil', semana: '2026-09-28', moderador_id: 'ana' },
      { serie: 'civil', semana: '2026-10-05', moderador_id: 'eva' },
    ];
    expect(moderadorSugerido({ ...base, sesiones }).usuarioId).toBe('ana');
  });

  it('no mira las sesiones de otras reuniones ni las posteriores', () => {
    const sesiones = [
      { serie: 'electrica', semana: '2026-10-05', moderador_id: 'ana' },
      { serie: 'civil', semana: '2026-10-19', moderador_id: 'dani' },
    ];
    expect(moderadorSugerido({ ...base, sesiones }).usuarioId).toBe('ana');
  });

  it('se salta a quien tenga ausencia ese día', () => {
    const sesiones = [{ serie: 'civil', semana: '2026-10-05', moderador_id: 'ana' }];
    const ausencias = [{ usuario_id: 'dani', desde: '2026-10-10', hasta: '2026-10-20' }];
    const sugerido = moderadorSugerido({ ...base, sesiones, ausencias });
    expect(sugerido.usuarioId).toBe('eva');
    expect(sugerido.saltados).toEqual(['dani']);
  });

  /* La ausencia se mira en la fecha real: si el lunes es festivo y la reunión
     pasa al martes, cuenta el martes. */
  it('la ausencia se mira en la fecha de la sesión, no en el lunes', () => {
    const ausencias = [{ usuario_id: 'ana', desde: '2026-10-12', hasta: '2026-10-12' }];
    expect(moderadorSugerido({ ...base, ausencias }).usuarioId).toBe('dani');
    expect(moderadorSugerido({ ...base, ausencias, fecha: '2026-10-13' }).usuarioId).toBe('ana');
  });

  it('si todos están ausentes no se inventa un moderador', () => {
    const ausencias = ['ana', 'dani', 'eva'].map((id) => ({ usuario_id: id, desde: '2026-10-01', hasta: '2026-10-30' }));
    expect(moderadorSugerido({ ...base, ausencias }).usuarioId).toBe(null);
  });

  it('sin lista de rotación no hay sugerencia', () => {
    expect(moderadorSugerido({ ...base, rotaciones: [] }).usuarioId).toBe(null);
  });

  it('si quien moderó ya no está en la lista, arranca desde el principio', () => {
    const sesiones = [{ serie: 'civil', semana: '2026-10-05', moderador_id: 'se-fue' }];
    expect(moderadorSugerido({ ...base, sesiones }).usuarioId).toBe('ana');
  });

  it('ausenteEl mira el rango completo', () => {
    const ausencias = [{ usuario_id: 'ana', desde: '2026-10-05', hasta: '2026-10-09' }];
    expect(ausenteEl(ausencias, 'ana', '2026-10-05')).toBe(true);
    expect(ausenteEl(ausencias, 'ana', '2026-10-09')).toBe(true);
    expect(ausenteEl(ausencias, 'ana', '2026-10-10')).toBe(false);
    expect(ausenteEl(ausencias, 'dani', '2026-10-06')).toBe(false);
  });
});

describe('los pendientes', () => {
  const pendientes = [
    { id: 'p1', serie: 'civil', estado: 'en_curso', created_at: '2026-09-01T10:00:00Z' },
    { id: 'p2', serie: 'civil', estado: 'pendiente', created_at: '2026-08-01T10:00:00Z' },
    { id: 'p3', serie: 'civil', estado: 'finalizado', created_at: '2026-07-01T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' },
    { id: 'p4', serie: 'electrica', estado: 'pendiente', created_at: '2026-08-15T10:00:00Z' },
  ];

  it('separa abiertos de finalizados, y solo los de esa reunión', () => {
    const { abiertos, finalizados } = pendientesDeReunion(pendientes, 'civil');
    expect(abiertos.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(finalizados.map((p) => p.id)).toEqual(['p3']);
  });

  /* El que lleva más tiempo esperando es el primero que hay que mirar. */
  it('los abiertos van del más viejo al más nuevo', () => {
    expect(pendientesDeReunion(pendientes, 'civil').abiertos[0].id).toBe('p2');
  });

  it('cuenta las semanas que lleva abierto', () => {
    const hoy = new Date('2026-10-05T12:00:00Z');
    expect(semanasAbierto({ created_at: '2026-09-14T12:00:00Z' }, hoy)).toBe(3);
    expect(semanasAbierto({ created_at: '2026-10-04T12:00:00Z' }, hoy)).toBe(0);
    expect(semanasAbierto({}, hoy)).toBe(0);
  });

  it('el estado lo mueven los responsables, el moderador y quien gestiona', () => {
    const p = { responsables: ['ana', 'eva'] };
    expect(puedeActualizarPendiente(persona('ana'), p, {})).toBe(true);
    expect(puedeActualizarPendiente(persona('dani'), p, {})).toBe(false);
    expect(puedeActualizarPendiente(persona('dani'), p, { esModerador: true })).toBe(true);
    expect(puedeActualizarPendiente(persona('dani'), p, { gestiona: true })).toBe(true);
  });

  it('un invitado no mueve nada, aunque lo hayan puesto de responsable', () => {
    expect(puedeActualizarPendiente(persona('nuevo'), { responsables: ['nuevo'] }, { gestiona: true })).toBe(false);
  });

  /* El estado sin su porqué es justamente lo que se quería dejar de tener. */
  it('una actualización sin justificación no vale', () => {
    expect(actualizacionValida('Se pidió la información al cliente')).toBe(true);
    expect(actualizacionValida('   ')).toBe(false);
    expect(actualizacionValida(undefined)).toBe(false);
  });
});

describe('el historial', () => {
  const historial = [
    { id: 'h1', pendiente_id: 'p1', accion: 'creado', estado: 'pendiente', justificacion: '', created_at: '2026-09-01T10:00:00Z' },
    { id: 'h2', pendiente_id: 'p1', accion: 'actualizado', estado: 'en_curso', justificacion: 'Arrancó', created_at: '2026-09-08T10:00:00Z' },
    { id: 'h3', pendiente_id: 'p1', accion: 'actualizado', estado: 'en_curso', justificacion: 'Falta el cliente', created_at: '2026-09-15T10:00:00Z' },
    { id: 'h4', pendiente_id: 'p2', accion: 'creado', estado: 'pendiente', justificacion: '', created_at: '2026-09-15T10:00:00Z' },
  ];

  it('va del cambio más reciente al más viejo', () => {
    expect(historialDe(historial, 'p1').map((h) => h.id)).toEqual(['h3', 'h2', 'h1']);
  });

  it('a la vista queda la última justificación escrita', () => {
    expect(ultimaJustificacion(historial, 'p1').justificacion).toBe('Falta el cliente');
  });

  it('la creación no cuenta como justificación', () => {
    expect(ultimaJustificacion(historial, 'p2')).toBe(null);
  });
});

describe('los temas que llegan a la sesión', () => {
  const resumen = (usuario_id, semana, temas, enviado = true) => ({ usuario_id, semana, enviado, bloques: { temas } });

  it('la sesión de una semana mira los resúmenes de la anterior', () => {
    expect(semanaDeLosTemas('2026-10-05')).toBe('2026-09-28');
  });

  it('llegan los temas de quienes van a esa reunión, de la semana anterior', () => {
    const resumenes = [
      resumen('ana', '2026-09-28', [{ texto: 'Lo civil', reunion: 'equipo' }]),
      resumen('caro', '2026-09-28', [{ texto: 'Lo eléctrico', reunion: 'equipo' }]),
      resumen('ana', '2026-10-05', [{ texto: 'De esta semana', reunion: 'equipo' }]),
    ];
    const temas = temasParaLaSesion(resumenes, 'civil', '2026-10-05', directorio);
    expect(temas.map((t) => t.texto)).toEqual(['Lo civil']);
    expect(temas[0]).toMatchObject({ autorId: 'ana', autorNombre: 'Ana' });
  });

  /* A la de diseño llega lo marcado para ella, sea de quien sea: también de
     quien no tiene reunión de área, como el Líder de Diseño. */
  it('los marcados para diseño llegan a la de diseño y no a la del área', () => {
    const resumenes = [
      resumen('ana', '2026-09-28', [{ texto: 'Para diseño', reunion: 'diseno' }]),
      resumen('jefa', '2026-09-28', [{ texto: 'Del jefe', reunion: 'diseno' }]),
    ];
    expect(temasParaLaSesion(resumenes, 'civil', '2026-10-05', directorio)).toEqual([]);
    expect(temasParaLaSesion(resumenes, 'diseno', '2026-10-05', directorio).map((t) => t.texto))
      .toEqual(['Para diseño', 'Del jefe']);
  });

  it('un borrador sin enviar no llega', () => {
    const resumenes = [resumen('ana', '2026-09-28', [{ texto: 'Borrador', reunion: 'equipo' }], false)];
    expect(temasParaLaSesion(resumenes, 'civil', '2026-10-05', directorio)).toEqual([]);
  });

  it('quien es de dos áreas lleva su tema a las dos sesiones', () => {
    const resumenes = [resumen('eva', '2026-09-28', [{ texto: 'De Eva', reunion: 'equipo' }])];
    expect(temasParaLaSesion(resumenes, 'civil', '2026-10-05', directorio).length).toBe(1);
    expect(temasParaLaSesion(resumenes, 'delineantes', '2026-10-05', directorio).length).toBe(1);
  });

  /* Si alguien reordena sus temas, la conclusión no puede quedar pegada al
     tema equivocado: la llave lleva el texto, no la posición. */
  it('la llave del tema lleva el texto, no la posición', () => {
    expect(claveDeTema('ana', 'Lo civil')).toBe('ana:Lo civil');
  });

  it('en la bandeja, lo que falta por tratar va primero', () => {
    const temas = [{ clave: 'a' }, { clave: 'b' }, { clave: 'c' }];
    const tratados = [{ sesion_id: 's1', clave: 'a', resultado: 'sin_compromiso' }];
    expect(bandejaDeLaSesion(temas, tratados, 's1').map((t) => t.clave)).toEqual(['b', 'c', 'a']);
  });

  it('una resolución de otra sesión no cuenta para esta', () => {
    const tratados = [{ sesion_id: 'otra', clave: 'a' }];
    expect(bandejaDeLaSesion([{ clave: 'a' }], tratados, 's1')[0].resolucion).toBe(null);
  });

  it('cerrar sin compromiso pide decir en qué quedó', () => {
    expect(resolucionValida('sin_compromiso', 'Se mantiene la fecha')).toBe(true);
    expect(resolucionValida('sin_compromiso', '  ')).toBe(false);
    expect(resolucionValida('pendiente', '')).toBe(true);
    expect(resolucionValida('otra cosa', 'x')).toBe(false);
  });
});

describe('el registro de la sesión', () => {
  const pendientes = [
    { id: 'p1', serie: 'civil', texto: 'Revisar alcance', responsables: ['ana', 'eva'], sesion_origen: 's1', created_at: '2026-10-05T14:00:00' },
    { id: 'p2', serie: 'civil', texto: 'Planos de vía', responsables: ['dani'], sesion_origen: 'vieja', created_at: '2026-09-01T14:00:00' },
    { id: 'p3', serie: 'electrica', texto: 'De otra reunión', responsables: [], sesion_origen: 'otra', created_at: '2026-09-01T14:00:00' },
  ];
  const historial = [
    { id: 'h1', pendiente_id: 'p1', accion: 'creado', estado: 'pendiente', created_at: '2026-10-05T14:00:00' },
    { id: 'h2', pendiente_id: 'p2', accion: 'actualizado', estado: 'en_curso', justificacion: 'Arrancó el dibujo', created_at: '2026-10-05T14:10:00' },
    { id: 'h3', pendiente_id: 'p2', accion: 'actualizado', estado: 'en_curso', justificacion: 'Miércoles', created_at: '2026-10-07T09:00:00' },
    { id: 'h4', pendiente_id: 'p3', accion: 'actualizado', estado: 'en_curso', justificacion: 'Otra', created_at: '2026-10-05T14:20:00' },
  ];
  const temasTratados = [
    { sesion_id: 's1', clave: 'x', texto: 'Alcance de Chinú 5', autor_id: 'ana', resultado: 'pendiente', pendiente_id: 'p1', created_at: '2026-10-05T14:00:00' },
    { sesion_id: 's1', clave: 'y', texto: 'Fechas', autor_id: 'eva', resultado: 'sin_compromiso', conclusion: 'Se mantiene el 15', created_at: '2026-10-05T14:05:00' },
    { sesion_id: 'otra', clave: 'z', texto: 'De otra sesión', created_at: '2026-10-05T14:05:00' },
  ];
  const registro = registroDeLaSesion({
    sesionId: 's1', fecha: '2026-10-05', temasTratados, pendientes, historial, reunionId: 'civil',
  });

  it('trae los temas tratados en esa sesión, con su pendiente si lo hubo', () => {
    expect(registro.temas.map((t) => t.texto)).toEqual(['Alcance de Chinú 5', 'Fechas']);
    expect(registro.temas[0].pendiente.texto).toBe('Revisar alcance');
  });

  /* Lo que un responsable movió un miércoles queda en el historial del
     pendiente, pero no es de la reunión. */
  it('los revisados son los cambios de ESE día, no los de la semana', () => {
    expect(registro.revisados.map((h) => h.id)).toEqual(['h2']);
  });

  it('la creación no cuenta como revisión, y otras reuniones tampoco', () => {
    expect(registro.revisados.map((h) => h.id)).not.toContain('h1');
    expect(registro.revisados.map((h) => h.id)).not.toContain('h4');
  });

  it('los nuevos son los que nacieron en la sesión', () => {
    expect(registro.nuevos.map((p) => p.id)).toEqual(['p1']);
  });

  it('el texto sale listo para pegar, con nombres y desenlaces', () => {
    const texto = textoDelRegistro(registro, { titulo: 'Reunión civil · lunes 5 de octubre', moderador: 'Lucho', directorio });
    expect(texto).toBe([
      'Reunión civil · lunes 5 de octubre',
      'Moderó: Lucho',
      '',
      'Temas tratados',
      '-Alcance de Chinú 5 (Ana) → quedó como pendiente: Revisar alcance',
      '-Fechas (Eva) → Se mantiene el 15',
      '',
      'Pendientes revisados',
      '-Planos de vía: En curso · Arrancó el dibujo',
      '',
      'Pendientes nuevos',
      '-Revisar alcance · Ana, Eva',
    ].join('\n'));
  });

  it('una sesión sin nada lo dice en vez de entregar un texto a medias', () => {
    const vacio = registroDeLaSesion({ sesionId: 'nada', fecha: '2026-10-05', temasTratados, pendientes, historial, reunionId: 'civil' });
    expect(registroVacio({ ...vacio, revisados: [] })).toBe(true);
    expect(textoDelRegistro({ temas: [], revisados: [], nuevos: [] }, { titulo: 'Reunión civil' }))
      .toBe('Reunión civil\n\nNo se registró nada en esta sesión.');
  });
});

describe('nombres y fechas', () => {
  it('la fecha se lee como un día concreto', () => {
    expect(fechaLegible('2026-10-05')).toBe('lunes 5 de octubre');
    expect(fechaLegible('2026-10-13')).toBe('martes 13 de octubre');
    expect(fechaLegible('')).toBe('');
  });

  it('quien ya no está en el equipo se nombra así, no con un hueco', () => {
    expect(nombreDe(directorio, 'ana')).toBe('Ana');
    expect(nombreDe(directorio, 'se-fue')).toBe('Alguien que ya no está en el equipo');
  });
});

describe('el plan de la semana', () => {
  const planes = [
    { serie: 'civil', semana: '2026-09-21', usuario_id: 'ana', items: [{ id: 'a', tarea: 'Hace dos semanas' }] },
    { serie: 'civil', semana: '2026-09-28', usuario_id: 'ana', items: [] },
    { serie: 'civil', semana: '2026-10-05', usuario_id: 'ana', items: [{ id: 'b', tarea: 'Esta semana' }] },
    { serie: 'civil', semana: '2026-10-05', usuario_id: 'dani', items: [{ id: 'c', tarea: 'De Dani' }] },
  ];

  it('solo la reunión civil lleva plan', () => {
    expect(tienePlan('civil')).toBe(true);
    expect(tienePlan('electrica')).toBe(false);
    expect(tienePlan('delineantes')).toBe(false);
  });

  it('un plan por reunión, semana y persona', () => {
    expect(idDePlan('civil', '2026-10-05', 'ana')).toBe('plan-civil-2026-10-05-ana');
    expect(planDe(planes, 'civil', '2026-10-05', 'ana').items[0].tarea).toBe('Esta semana');
    expect(planDe(planes, 'civil', '2026-10-05', 'eva')).toBe(null);
  });

  /* Si la semana pasada no hubo plan (vacaciones, un festivo), se parte del
     último que sí hubo: casi siempre el trabajo continúa. */
  it('para partir de algo, toma el último plan con tareas, no el de hace exactamente una semana', () => {
    expect(planAnterior(planes, 'civil', '2026-10-05', 'ana').semana).toBe('2026-09-21');
    expect(planAnterior(planes, 'civil', '2026-10-05', 'eva')).toBe(null);
  });

  it('al guardar, se recortan las tareas y se descartan las vacías', () => {
    expect(limpiarItems([
      { id: '1', tarea: '  Memoria de cimentaciones ', proyecto_id: 'p1' },
      { id: '2', tarea: '   ', proyecto_id: 'p2' },
      { id: '3', tarea: 'Capacitación', proyecto_id: '' },
    ])).toEqual([
      { id: '1', tarea: 'Memoria de cimentaciones', proyecto_id: 'p1' },
      { id: '3', tarea: 'Capacitación', proyecto_id: null },
    ]);
  });

  /* No se impide —el equipo se cambia en el proyecto—, pero se avisa. */
  it('avisa si el proyecto asignado no tiene a la persona en su equipo', () => {
    const proyectos = [{ id: 'p1', nombre: 'Chinú 3', equipo: { civil: ['Ana'] } }];
    expect(fueraDelEquipo({ proyecto_id: 'p1' }, 'Ana', proyectos)).toBe(false);
    expect(fueraDelEquipo({ proyecto_id: 'p1' }, 'Dani', proyectos)).toBe(true);
    expect(fueraDelEquipo({ proyecto_id: null }, 'Dani', proyectos)).toBe(false);
    expect(fueraDelEquipo({ proyecto_id: 'no-existe' }, 'Dani', proyectos)).toBe(false);
  });

  it('un proyecto borrado no deja un hueco en el plan', () => {
    expect(nombreDeProyecto([{ id: 'p1', nombre: 'Chinú 3' }], 'p1')).toBe('Chinú 3');
    expect(nombreDeProyecto([], 'p9')).toBe('Proyecto que ya no existe');
    expect(nombreDeProyecto([], null)).toBe(null);
  });
});

describe('el plan entra al registro de la sesión', () => {
  const planes = [
    { serie: 'civil', semana: '2026-10-05', usuario_id: 'dani', items: [{ id: 'x', tarea: 'Planos de vía', proyecto_id: 'p1' }] },
    { serie: 'civil', semana: '2026-10-05', usuario_id: 'ana', items: [{ id: 'y', tarea: 'Memoria', proyecto_id: null }, { id: 'z', tarea: 'Revisar CBR', proyecto_id: 'p1' }] },
    { serie: 'civil', semana: '2026-10-05', usuario_id: 'eva', items: [] },
    { serie: 'civil', semana: '2026-09-28', usuario_id: 'ana', items: [{ id: 'w', tarea: 'De otra semana' }] },
  ];
  const registro = registroDeLaSesion({
    sesionId: 's', fecha: '2026-10-05', temasTratados: [], pendientes: [], historial: [],
    reunionId: 'civil', semana: '2026-10-05', planes,
  });

  it('trae el plan de esa semana, solo de quien tiene tareas', () => {
    expect(registro.plan.map((p) => p.usuario_id).sort()).toEqual(['ana', 'dani']);
  });

  it('una sesión con solo el plan no está vacía', () => {
    expect(registroVacio(registro)).toBe(false);
  });

  it('en el texto sale por persona, numerado en el orden de prioridad', () => {
    const texto = textoDelRegistro(registro, {
      titulo: 'Reunión civil', directorio, proyectos: [{ id: 'p1', nombre: 'Chinú 3' }],
    });
    expect(texto).toBe([
      'Reunión civil',
      '',
      'Plan de la semana',
      'Ana',
      '-1. Memoria',
      '-2. Chinú 3 · Revisar CBR',
      'Dani',
      '-1. Chinú 3 · Planos de vía',
    ].join('\n'));
  });
});

describe('a quién le toca la semana siguiente', () => {
  const rotaciones = [{ serie: 'civil', orden: ['ana', 'dani', 'eva'] }];
  const base = { reunionId: 'civil', semana: '2026-10-05', rotaciones, ausencias: [] };

  /* La sesión de esta semana todavía no existe (nadie ha hecho nada en ella):
     sin contarla, la rotación repetiría el nombre de esta semana. */
  it('cuenta con quien modera esta semana, aunque su sesión no se haya creado', () => {
    expect(proximoModerador({ ...base, sesiones: [], moderadorActualId: 'ana' })).toBe('dani');
  });

  it('si el líder eligió a otra persona esta semana, sigue desde ella', () => {
    const sesiones = [{ serie: 'civil', semana: '2026-10-05', moderador_id: 'eva' }];
    expect(proximoModerador({ ...base, sesiones, moderadorActualId: 'eva' })).toBe('ana');
  });

  it('se salta a quien estará ausente el lunes siguiente', () => {
    const ausencias = [{ usuario_id: 'dani', desde: '2026-10-12', hasta: '2026-10-16' }];
    expect(proximoModerador({ ...base, sesiones: [], ausencias, moderadorActualId: 'ana' })).toBe('eva');
  });

  it('sin rotación no hay pronóstico', () => {
    expect(proximoModerador({ ...base, rotaciones: [], sesiones: [], moderadorActualId: 'ana' })).toBe(null);
  });
});

describe('la reunión de diseño: va todo el equipo y siempre la modera su líder', () => {
  const base = { semana: '2026-10-05', fecha: '2026-10-05', sesiones: [], ausencias: [], directorio };

  it('van todos menos los invitados', () => {
    expect(participantes('diseno', directorio).map((p) => p.id))
      .toEqual(['ana', 'beto', 'caro', 'dani', 'eva', 'jefa', 'lucho']);
  });

  it('la gestiona el Líder de Diseño, no los líderes de área', () => {
    expect(gestionaReunion(persona('jefa'), 'diseno')).toBe(true);
    expect(gestionaReunion(persona('lucho'), 'diseno')).toBe(false);
  });

  it('solo la de diseño tiene moderador fijo; las de área rotan', () => {
    expect(tieneRotacion('diseno')).toBe(false);
    ['civil', 'electrica', 'delineantes'].forEach((id) => expect(tieneRotacion(id)).toBe(true));
  });

  it('la modera quien tiene el rol de Líder de Diseño', () => {
    expect(moderadorFijo('diseno', directorio)).toBe('jefa');
    expect(moderadorFijo('diseno', directorio.filter((p) => p.id !== 'jefa'))).toBe(null);
    expect(moderadorFijo('civil', directorio)).toBe(null);
  });

  it('manda el rol aunque la sesión tenga guardado otro moderador, y no mira rotación', () => {
    const r = moderadorDeLaSesion({
      ...base, reunionId: 'diseno', sesion: { moderador_id: 'ana' },
      rotaciones: [{ serie: 'diseno', orden: ['ana'] }],
    });
    expect(r).toEqual({ usuarioId: 'jefa', origen: 'fijo', saltados: [] });
  });

  it('la civil sigue igual: asignado si lo eligió el líder, si no rotación', () => {
    const rotaciones = [{ serie: 'civil', orden: ['ana', 'eva'] }];
    expect(moderadorDeLaSesion({ ...base, reunionId: 'civil', sesion: { moderador_id: 'eva' }, rotaciones }))
      .toMatchObject({ usuarioId: 'eva', origen: 'asignado' });
    expect(moderadorDeLaSesion({ ...base, reunionId: 'civil', sesion: null, rotaciones }))
      .toMatchObject({ usuarioId: 'ana', origen: 'rotacion' });
  });

  it('no hay pronóstico de la semana siguiente: siempre es el mismo', () => {
    expect(proximoModerador({
      reunionId: 'diseno', semana: '2026-10-05', sesiones: [], ausencias: [],
      rotaciones: [{ serie: 'diseno', orden: ['ana'] }], moderadorActualId: 'jefa',
    })).toBe(null);
  });
});
