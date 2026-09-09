// @vitest-environment jsdom
/* ============================================================================
   RESÚMENES SEMANALES — render real.
   ----------------------------------------------------------------------------
   Además de que pinte, aquí se comprueban las dos reglas que hacen que el
   bloque de avance signifique algo: que un resumen ya enviado muestre la foto
   GUARDADA y no una recalculada, y que al enviarlo se guarde justamente esa
   foto para que la semana siguiente tenga contra qué compararse.

   Las semanas se calculan con la fecha de hoy, así que nada aquí puede estar
   anclado a un lunes concreto.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ResumenesView, { diaYMes, esSoloDesarrollador } from './Resumenes.jsx';
import { lunesDe, sumarDias, viernesDe } from '../shared/resumenes.js';

afterEach(cleanup);

const SEMANA = lunesDe();
const ANTERIOR = sumarDias(SEMANA, -7);

const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };
const directorio = [
  { id: 'u1', nombre: 'Ana', roles: ['civil'] },
  { id: 'u2', nombre: 'Beto', roles: ['delineante'] },
  { id: 'u3', nombre: 'Caro', roles: ['electrico'] },
];

const dossiers = [{
  id: 'dos-1', nombre: 'CFM', version: 1,
  documentos: [
    { id: 'a', codigo: 'C-PL-001', nombre: 'Cerramiento', especialidad: 'CIVIL', tipo: 'Plano', responsables: { civil: 'R', delineante: 'E' } },
    { id: 'b', codigo: 'C-INF-001', nombre: 'Vías de acceso', especialidad: 'CIVIL', tipo: 'Informe', responsables: { civil: 'E' } },
  ],
}];

function proyecto(over = {}) {
  return {
    id: 'p1', nombre: 'Chinú 3', dossier_id: 'dos-1',
    equipo: { civil: ['Ana'] },
    documentos: { 'C-PL-001': { estado: 'Entregado' } },
    data: { general: {} },
    ...over,
  };
}

function pintar(props = {}) {
  return render(
    <ResumenesView
      perfil={perfil}
      directorio={directorio}
      projects={[proyecto()]}
      dossiers={dossiers}
      resumenes={[]}
      onGuardar={() => {}}
      {...props}
    />,
  );
}

/* Un resumen guardado de la semana pasada, con su foto. */
function resumenPrevio(estados) {
  return {
    id: 'r0', usuario_id: 'u1', semana: ANTERIOR, hasta: null, enviado: true,
    bloques: {},
    proyectos: [{ id: 'p1', nombre: 'Chinú 3', total: 2, porEstado: {}, estados, nombres: {} }],
  };
}

/* Un renglon se escribe y se "quema" con la palomita: deja de ser caja de
   texto y pasa a ser texto. */
function escribirEnLoMejor(texto) {
  fireEvent.click(screen.getAllByText('Agregar renglón')[0]);
  const [caja] = screen.getAllByPlaceholderText(/Lo que sacaste esta semana/);
  fireEvent.change(caja, { target: { value: texto } });
  fireEvent.click(screen.getByTitle('Listo (o pulsa Enter)'));
}

describe('mi resumen', () => {
  it('abre en la semana actual con los cuatro bloques', () => {
    pintar();
    ['Lo mejor', 'Pendientes', 'Dificultades', 'Temas'].forEach((b) => {
      expect(screen.getByText(b), b).toBeTruthy();
    });
  });

  it('sin documentos a cargo lo explica en vez de mostrar un bloque vacío', () => {
    pintar({ projects: [proyecto({ equipo: { electrico: ['Otro'] } })] });
    expect(screen.getByText(/No tienes documentos a cargo esta semana/)).toBeTruthy();
  });

  it('la primera semana lo dice, en vez de anunciar que no hubo avances', () => {
    pintar();
    expect(screen.getByText('Chinú 3')).toBeTruthy();
    expect(screen.getByText(/primera semana registrada/)).toBeTruthy();
  });

  it('con la foto de la semana pasada dice qué se movió y cuál fue', () => {
    pintar({ resumenes: [resumenPrevio({ 'C-PL-001': 'Pendiente', 'C-INF-001': 'Pendiente' })] });
    fireEvent.click(screen.getByText(/1 documento avanzó/));
    expect(screen.getByText(/Pendiente → Entregado/)).toBeTruthy();
    /* "Cerramiento" sale dos veces al desplegar: en la lista de lo que se
       movió y en la de todos mis documentos. */
    expect(screen.getAllByText(/Cerramiento/).length).toBe(2);
  });

  /* La pregunta que quedaba sin responder: cuáles son exactamente los
     documentos que el porcentaje está contando. */
  it('al desplegar se ven mis documentos agrupados por estado, con mi papel', () => {
    pintar();
    fireEvent.click(screen.getByText(/ver mis 2 documentos/));
    expect(screen.getByText('Entregado (1)')).toBeTruthy();
    expect(screen.getByText('Pendiente (1)')).toBeTruthy();
    expect(screen.getByText('Cerramiento')).toBeTruthy();
    expect(screen.getByText('Vías de acceso')).toBeTruthy();
    expect(screen.getByTitle('Lo revisas')).toBeTruthy();
    expect(screen.getByTitle('Lo elaboras o lo dibujas')).toBeTruthy();
  });

  it('las franjas de la barra dicen cuántos documentos son y qué porcentaje', () => {
    const { container } = pintar();
    const franjas = [...container.querySelectorAll('[title]')].map((n) => n.getAttribute('title'));
    expect(franjas).toContain('Pendiente: 1 documento (50%)');
    expect(franjas).toContain('Entregado: 1 documento (50%)');
  });

  it('el nombre del proyecto lleva a su ficha', () => {
    const abiertos = [];
    pintar({ onAbrirProyecto: (id) => abiertos.push(id) });
    fireEvent.click(screen.getByText('Chinú 3'));
    expect(abiertos).toEqual(['p1']);
  });

  /* Un proyecto ya terminado se registra la semana en que se cierra y no
     vuelve a aparecer: después es solo ruido. */
  it('un proyecto finalizado deja de aparecer la semana siguiente', () => {
    const terminado = proyecto({ estado: 'finalizado' });
    const previo = {
      id: 'r0', usuario_id: 'u1', semana: ANTERIOR, enviado: true, bloques: {},
      proyectos: [{ id: 'p1', nombre: 'Chinú 3', estado: 'finalizado', estados: {}, porEstado: {}, total: 2 }],
    };
    pintar({ projects: [terminado], resumenes: [previo] });
    expect(screen.queryByText('Chinú 3')).toBe(null);
    expect(screen.getByText(/No tienes documentos a cargo esta semana/)).toBeTruthy();
  });

  it('un documento que ya estaba igual no se reporta como avance', () => {
    pintar({ resumenes: [resumenPrevio({ 'C-PL-001': 'Entregado', 'C-INF-001': 'Pendiente' })] });
    expect(screen.getByText(/sin cambios esta semana/)).toBeTruthy();
  });
});

describe('guardar', () => {
  it('manda lo escrito y la foto del avance', () => {
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    escribirEnLoMejor('Reunión Drawing Team');
    fireEvent.click(screen.getByText('Enviar'));
    expect(guardados.length).toBe(1);
    expect(guardados[0].semana).toBe(SEMANA);
    expect(guardados[0].bloques.lo_mejor).toEqual(['Reunión Drawing Team']);
    expect(guardados[0].proyectos[0]).toMatchObject({ id: 'p1', nombre: 'Chinú 3' });
    /* La foto lleva el estado de cada documento: es lo único con lo que la
       semana siguiente puede comparar. */
    expect(guardados[0].proyectos[0].estados).toEqual({ 'C-PL-001': 'Entregado', 'C-INF-001': 'Pendiente' });
  });

  it('enviar guarda con la bandera puesta', () => {
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(guardados[0].enviado).toBe(true);
  });

  /* No hay boton de "guardar borrador": si estas editando, es un borrador. Lo
     escrito baja solo poco despues de dejar de teclear. */
  it('lo escrito se guarda solo, sin apretar nada', async () => {
    vi.useFakeTimers();
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    expect(screen.queryByText('Guardar borrador')).toBe(null);
    escribirEnLoMejor('Mesa técnica');
    expect(guardados.length).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(guardados.length).toBe(1);
    expect(guardados[0].enviado).toBe(false);
    expect(guardados[0].bloques.lo_mejor).toEqual(['Mesa técnica']);
    vi.useRealTimers();
  });

  /* Entrar a mirar la pantalla no puede crear un resumen vacio a nombre de
     nadie: en la vista del equipo apareceria como si hubiera empezado. */
  it('abrir la pantalla sin escribir nada no guarda', async () => {
    vi.useFakeTimers();
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(guardados.length).toBe(0);
    vi.useRealTimers();
  });
});

describe('un resumen ya enviado', () => {
  const enviado = {
    id: 'r1', usuario_id: 'u1', semana: SEMANA, hasta: null, enviado: true,
    bloques: { lo_mejor: ['Algo que hice'] },
    proyectos: [{
      id: 'p1', nombre: 'Chinú 3', total: 2,
      porEstado: { 'Aprobado para construcción (APC)': 2 },
      estados: {}, nombres: {}, hayComparacion: true, avanzaron: 2, cambios: [],
    }],
  };

  it('se ve en lectura, sin renglones para escribir', () => {
    pintar({ resumenes: [enviado] });
    expect(screen.getByText('- Algo que hice')).toBeTruthy();
    expect(screen.queryByText('Enviar')).toBe(null);
    expect(screen.queryAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(0);
  });

  /* Lo importante: muestra la foto GUARDADA (2 en APC, 100%) y no una
     recalculada contra los proyectos de ahora, que daría 0%. */
  it('muestra la foto congelada, no una recalculada', () => {
    pintar({ resumenes: [enviado] });
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('2 de 2 en APC')).toBeTruthy();
  });

  it('se puede reabrir para editarlo', () => {
    const guardados = [];
    pintar({ resumenes: [enviado], onGuardar: (r) => { guardados.push(r); } });
    fireEvent.click(screen.getByText('Volver a editar'));
    expect(guardados[0].enviado).toBe(false);
  });
});

describe('copiar para el chat', () => {
  it('arma el texto con el formato del equipo', async () => {
    let copiado = null;
    Object.assign(navigator, { clipboard: { writeText: (t) => { copiado = t; return Promise.resolve(); } } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    pintar();
    escribirEnLoMejor('Mesa técnica');
    await fireEvent.click(screen.getByText('Copiar para el chat'));
    await Promise.resolve();

    expect(copiado).toContain('Buenas tardes');
    expect(copiado).toContain('Lo mejor\n-Mesa técnica');
    expect(copiado).toContain('Dificultades\n-Ninguna');
    expect(copiado).toContain('Temas\n-Ninguno');
    expect(copiado).toContain('Avance de mis proyectos');
  });
});

describe('la vista del equipo', () => {
  const soloBeto = {
    id: 'r2', usuario_id: 'u2', semana: SEMANA, enviado: true,
    bloques: { lo_mejor: ['Planos de Chinú 4'] }, proyectos: [],
  };

  it('dice quién ya envió y quién no', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getByText('1 de 3 ya enviaron su resumen de esta semana.')).toBeTruthy();
    expect(screen.getByText('Enviado')).toBeTruthy();
    expect(screen.getAllByText('Sin registrar').length).toBe(2);
  });

  /* Mientras no este enviado, no esta dicho: el borrador ajeno ni se marca ni
     se puede abrir. */
  it('un borrador ajeno cuenta como sin registrar y no se despliega', () => {
    pintar({ resumenes: [{ ...soloBeto, enviado: false }] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getAllByText('Sin registrar').length).toBe(3);
    expect(screen.getByText('0 de 3 ya enviaron su resumen de esta semana.')).toBeTruthy();
    fireEvent.click(screen.getByText('Beto'));
    expect(screen.queryByText('- Planos de Chinú 4')).toBe(null);
  });

  it('el resumen ajeno se despliega y se lee, pero no se edita', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    fireEvent.click(screen.getByText('Beto'));
    expect(screen.getByText('- Planos de Chinú 4')).toBeTruthy();
  });

  it('el filtro por rol deja solo a los de esa área', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    fireEvent.click(screen.getByText('Delineante (1)'));
    expect(screen.getByText('Beto')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBe(null);
    expect(screen.getByText('1 de 1 ya enviaron su resumen de esta semana.')).toBeTruthy();
  });
});

describe('cambiar de semana', () => {
  it('no arrastra lo que se estaba escribiendo en la otra', () => {
    pintar();
    escribirEnLoMejor('De esta semana');
    expect(screen.getByText('De esta semana')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ANTERIOR } });
    expect(screen.queryByText('De esta semana')).toBe(null);
  });
});

describe('los desarrolladores no entran al seguimiento', () => {
  it('quien SOLO es Desarrollador no aparece en la lista', () => {
    pintar({ directorio: [...directorio, { id: 'u9', nombre: 'Dev', roles: ['desarrollador'] }] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.queryByText('Dev')).toBe(null);
    expect(screen.getByText('0 de 3 ya enviaron su resumen de esta semana.')).toBeTruthy();
  });

  /* Pero quien ademas tiene un rol tecnico si trabaja, y si reporta. */
  it('quien es Desarrollador y ademas ingeniero sigue apareciendo', () => {
    pintar({ directorio: [...directorio, { id: 'u9', nombre: 'Dev', roles: ['desarrollador', 'civil'] }] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getByText('Dev')).toBeTruthy();
  });

  it('esSoloDesarrollador distingue los dos casos', () => {
    expect(esSoloDesarrollador({ roles: ['desarrollador'] })).toBe(true);
    expect(esSoloDesarrollador({ roles: ['desarrollador', 'civil'] })).toBe(false);
    expect(esSoloDesarrollador({ roles: [] })).toBe(false);
    expect(esSoloDesarrollador({})).toBe(false);
  });
});

describe('los renglones se queman al escribirlos', () => {
  /* Con la caja de texto siempre abierta bastaba un teclazo despistado para
     danar algo ya escrito. */
  it('al confirmar deja de ser caja de texto y pasa a ser texto', () => {
    pintar();
    fireEvent.click(screen.getAllByText('Agregar renglón')[0]);
    expect(screen.getAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(1);
    fireEvent.change(screen.getByPlaceholderText(/Lo que sacaste esta semana/), { target: { value: 'Mesa técnica' } });
    fireEvent.click(screen.getByTitle('Listo (o pulsa Enter)'));
    expect(screen.queryAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(0);
    expect(screen.getByText('Mesa técnica')).toBeTruthy();
  });

  it('Enter tambien lo quema', () => {
    pintar();
    fireEvent.click(screen.getAllByText('Agregar renglón')[0]);
    const caja = screen.getByPlaceholderText(/Lo que sacaste esta semana/);
    fireEvent.change(caja, { target: { value: 'Con Enter' } });
    fireEvent.keyDown(caja, { key: 'Enter' });
    expect(screen.queryAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(0);
    expect(screen.getByText('Con Enter')).toBeTruthy();
  });

  it('el lapiz lo vuelve a abrir', () => {
    pintar();
    escribirEnLoMejor('Para corregir');
    fireEvent.click(screen.getAllByTitle('Editar este renglón')[0]);
    expect(screen.getByPlaceholderText(/Lo que sacaste esta semana/).value).toBe('Para corregir');
  });

  it('un renglon que queda vacio se descarta en vez de guardarse en blanco', () => {
    pintar();
    fireEvent.click(screen.getAllByText('Agregar renglón')[0]);
    fireEvent.click(screen.getByTitle('Listo (o pulsa Enter)'));
    expect(screen.queryAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(0);
    expect(screen.getAllByText(/Si lo dejas vacío se escribe/).length).toBeGreaterThan(0);
  });

  it('la X lo quita', () => {
    pintar();
    escribirEnLoMejor('Me equivoqué');
    fireEvent.click(screen.getAllByTitle('Quitar este renglón')[0]);
    expect(screen.queryByText('Me equivoqué')).toBe(null);
  });
});

describe('el cierre colectivo de la semana', () => {
  const VIERNES = viernesDe(SEMANA);
  const HOY = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  it('por defecto la semana cierra el viernes', () => {
    pintar();
    expect(screen.getByText(diaYMes(VIERNES))).toBeTruthy();
  });

  it('un líder lo puede mover; un ingeniero no', () => {
    pintar({ perfil: { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] }, onGuardarCierre: () => {} });
    expect(screen.getByText('moverlo')).toBeTruthy();
    cleanup();
    pintar({ onGuardarCierre: () => {} });
    expect(screen.queryByText('moverlo')).toBe(null);
  });

  it('mover el cierre manda la fecha y el porqué', () => {
    const guardados = [];
    pintar({
      perfil: { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] },
      onGuardarCierre: (...args) => guardados.push(args),
    });
    fireEvent.click(screen.getByText('moverlo'));
    const jueves = sumarDias(SEMANA, 3);
    fireEvent.change(screen.getByLabelText('Día en que cierra la semana'), { target: { value: jueves } });
    fireEvent.change(screen.getByPlaceholderText(/Por qué/), { target: { value: 'Viernes festivo' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(guardados).toEqual([[SEMANA, jueves, 'Viernes festivo']]);
  });

  /* Un cierre fuera de su semana dejaria a todo el mundo sin vencer para
     siempre, o vencido desde antes de empezar. */
  it('no deja poner una fecha de otra semana', () => {
    const guardados = [];
    pintar({
      perfil: { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] },
      onGuardarCierre: (...args) => guardados.push(args),
    });
    fireEvent.click(screen.getByText('moverlo'));
    fireEvent.change(screen.getByLabelText('Día en que cierra la semana'), { target: { value: sumarDias(SEMANA, 8) } });
    expect(screen.getByText(/tiene que caer dentro de esta misma semana/)).toBeTruthy();
    fireEvent.click(screen.getByText('Guardar'));
    expect(guardados).toEqual([]);
  });

  it('muestra el porqué del cambio y deja volver al viernes', () => {
    const guardados = [];
    const cierres = [{ semana: SEMANA, cierre: sumarDias(SEMANA, 3), nota: 'Viernes festivo' }];
    pintar({
      perfil: { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] },
      cierres,
      onGuardarCierre: (...args) => guardados.push(args),
    });
    expect(screen.getByText(/Viernes festivo/)).toBeTruthy();
    fireEvent.click(screen.getByText('cambiar'));
    fireEvent.click(screen.getByText('Volver al viernes'));
    expect(guardados).toEqual([[SEMANA, null, '']]);
  });

  it('el "cubre hasta" de mi resumen viene con el cierre de la semana, no con el viernes', () => {
    const jueves = sumarDias(SEMANA, 3);
    pintar({ cierres: [{ semana: SEMANA, cierre: jueves, nota: '' }] });
    const guardados = [];
    cleanup();
    pintar({
      cierres: [{ semana: SEMANA, cierre: jueves, nota: '' }],
      onGuardar: (r) => guardados.push(r),
    });
    fireEvent.click(screen.getByText('Enviar'));
    expect(guardados[0].hasta).toBe(jueves);
  });
});

describe('la vista del equipo avisa a quién se le pasó', () => {
  const HOY = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  /* Hoy siempre cae dentro de la semana actual, asi que esto no depende del
     dia en que se corra la prueba. */
  it('el día del cierre avisa, sin marcar a nadie en rojo', () => {
    pintar({ cierres: [{ semana: SEMANA, cierre: HOY, nota: '' }] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getAllByText('Cierra hoy').length).toBe(3);
    expect(screen.queryByText('No lo envió')).toBe(null);
  });

  /* Una semana pasada ya vencio siempre, sin importar el dia de hoy. */
  it('en una semana que ya cerró, quien no envió queda marcado', () => {
    pintar();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ANTERIOR } });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getAllByText('No lo envió').length).toBe(3);
    expect(screen.getByText(/3 no alcanzó a hacerlo/)).toBeTruthy();
  });

  it('quien sí envió no queda marcado, aunque la semana ya haya cerrado', () => {
    const suyo = {
      id: 'r9', usuario_id: 'u2', semana: ANTERIOR, enviado: true,
      bloques: { lo_mejor: ['Algo'] }, proyectos: [],
    };
    pintar({ resumenes: [suyo] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ANTERIOR } });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getByText('Enviado')).toBeTruthy();
    expect(screen.getAllByText('No lo envió').length).toBe(2);
  });
});

describe('diaYMes', () => {
  it('se lee como lo diría una persona', () => {
    expect(diaYMes('2026-09-11')).toBe('viernes 11 de septiembre');
    expect(diaYMes('2026-01-01')).toBe('jueves 1 de enero');
    expect(diaYMes('')).toBe('');
  });
});

describe('la vista de Temas del lunes', () => {
  const conTemas = (usuario, semana, temas) => ({
    id: `r-${usuario}-${semana}`, usuario_id: usuario, semana, enviado: true,
    bloques: { temas }, proyectos: [],
  });

  const irATemas = () => fireEvent.click(screen.getByText('Temas del lunes'));

  it('junta los temas de todos, con su autor', () => {
    pintar({
      resumenes: [
        conTemas('u2', SEMANA, ['Quién dibuja el cerramiento']),
        conTemas('u1', SEMANA, ['Alcance de Chinú 5', 'Fechas de entrega']),
      ],
    });
    irATemas();
    expect(screen.getByText('3 temas de 2 personas.')).toBeTruthy();
    expect(screen.getByText('- Alcance de Chinú 5')).toBeTruthy();
    expect(screen.getByText('- Quién dibuja el cerramiento')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Beto')).toBeTruthy();
  });

  it('un borrador sin enviar no llega a la reunión', () => {
    pintar({ resumenes: [{ ...conTemas('u1', SEMANA, ['Secreto']), enviado: false }] });
    irATemas();
    expect(screen.queryByText('- Secreto')).toBe(null);
    expect(screen.getByText('Nadie puso temas para esta semana.')).toBeTruthy();
  });

  /* La reunion es el lunes y habla de la semana que cerro, pero la pantalla
     abre en la semana en curso. Se ofrece el salto en vez de adivinarlo. */
  it('si esta semana está vacía y la pasada no, ofrece saltar', () => {
    pintar({ resumenes: [conTemas('u1', ANTERIOR, ['Lo de la semana pasada'])] });
    irATemas();
    expect(screen.getByText(/La semana pasada sí tiene 1 tema/)).toBeTruthy();
    fireEvent.click(screen.getByText('Ver los de la semana pasada'));
    expect(screen.getByText('- Lo de la semana pasada')).toBeTruthy();
  });

  it('no ofrece saltar si esta semana ya tiene temas', () => {
    pintar({
      resumenes: [conTemas('u1', ANTERIOR, ['Viejo']), conTemas('u2', SEMANA, ['Nuevo'])],
    });
    irATemas();
    expect(screen.queryByText('Ver los de la semana pasada')).toBe(null);
    expect(screen.getByText('- Nuevo')).toBeTruthy();
  });

  it('sin temas en ninguna semana explica de dónde salen', () => {
    pintar();
    irATemas();
    expect(screen.getByText(/Los temas salen del bloque "Temas" de cada resumen enviado/)).toBeTruthy();
    expect(screen.queryByText('Copiar el orden del día')).toBe(null);
  });

  it('el orden del día se copia listo para pegar', async () => {
    let copiado = null;
    Object.assign(navigator, { clipboard: { writeText: (t) => { copiado = t; return Promise.resolve(); } } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    pintar({ resumenes: [conTemas('u1', SEMANA, ['Alcance de Chinú 5'])] });
    irATemas();
    await fireEvent.click(screen.getByText('Copiar el orden del día'));
    await Promise.resolve();

    expect(copiado).toContain('Temas para la reunión');
    expect(copiado).toContain('Ana');
    expect(copiado).toContain('-Alcance de Chinú 5');
  });
});
