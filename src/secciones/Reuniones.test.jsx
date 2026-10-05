// @vitest-environment jsdom
/* ============================================================================
   REUNIONES — render real.
   ----------------------------------------------------------------------------
   Además de que pinte, lo que se comprueba aquí es el reparto de permisos,
   que es lo que hace que la sección funcione en una reunión de verdad: cada
   quien actualiza lo suyo, el moderador trata los temas, el líder arma la
   rotación, y nadie cambia un estado sin decir por qué.

   Las semanas salen de la fecha de hoy, así que nada aquí está anclado a un
   lunes concreto.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ReunionesView from './Reuniones.jsx';
import { lunesDe, sumarDias } from '../shared/resumenes.js';
import { puedeVerVista } from '../shared/permisos.js';

afterEach(cleanup);

const SEMANA = lunesDe();
const ANTERIOR = sumarDias(SEMANA, -7);
const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString();

const directorio = [
  { id: 'ana', nombre: 'Ana', roles: ['civil'] },
  { id: 'dani', nombre: 'Dani', roles: ['hidraulico'] },
  { id: 'caro', nombre: 'Caro', roles: ['electrico'] },
  { id: 'beto', nombre: 'Beto', roles: ['estructural'] },
  { id: 'lucho', nombre: 'Lucho', roles: ['lider_civil'] },
  { id: 'nuevo', nombre: 'Nuevo', roles: [] },
];
const yo = (id) => directorio.find((p) => p.id === id);

const proyectos = [
  { id: 'chinu3', nombre: 'Chinú 3', estado: 'activo', equipo: { civil: ['Ana'], hidraulico: 'Dani' } },
  { id: 'santomas', nombre: 'San Tomás', estado: 'activo', equipo: { civil: ['Ana'] } },
  { id: 'viejo', nombre: 'Proyecto cerrado', estado: 'finalizado', equipo: {} },
];

const pendienteViejo = {
  id: 'p1', serie: 'civil', texto: 'Revisar alcance de Chinú 5', responsables: ['dani'],
  estado: 'en_curso', sesion_origen: 'vieja', created_at: haceDias(16), updated_at: haceDias(3),
};
const historial = [
  { id: 'h1', pendiente_id: 'p1', accion: 'creado', estado: 'pendiente', usuario_nombre: 'Lucho', created_at: haceDias(16) },
  { id: 'h2', pendiente_id: 'p1', accion: 'actualizado', estado: 'en_curso', justificacion: 'Falta la respuesta del cliente', usuario_nombre: 'Dani', created_at: haceDias(3) },
];

function pintar(props = {}) {
  const handlers = {
    onAsegurarSesion: vi.fn(async (serie, semana) => `sesion-${serie}-${semana}`),
    onGuardarSesion: vi.fn(),
    onGuardarRotacion: vi.fn(),
    onCrearPendiente: vi.fn(async (datos) => ({ id: 'nuevo-p', ...datos })),
    onActualizarPendiente: vi.fn(async () => true),
    onCambiarResponsables: vi.fn(),
    onEliminarPendiente: vi.fn(),
    onResolverTema: vi.fn(async () => true),
    onDeshacerTema: vi.fn(),
    onGuardarPlan: vi.fn(async () => true),
    onAbrirProyecto: vi.fn(),
  };
  const utils = render(
    <ReunionesView
      perfil={yo('ana')}
      directorio={directorio}
      resumenes={[]}
      ausencias={[]}
      sesiones={[]}
      rotaciones={[{ serie: 'civil', orden: ['ana', 'dani'] }]}
      pendientes={[pendienteViejo]}
      historial={historial}
      temasTratados={[]}
      proyectos={proyectos}
      planes={[]}
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, handlers: { ...handlers, ...props } };
}

describe('qué reunión abre', () => {
  it('abre en la reunión de uno, marcada como suya', () => {
    pintar({ perfil: yo('caro'), rotaciones: [] });
    expect(screen.getByText(/· la tuya/).closest('button').textContent).toMatch(/Eléctrica/);
  });

  it('sin la migración avisa, en vez de mostrarse vacía como si nada', () => {
    pintar({ disponible: false });
    expect(screen.getByText(/Falta correr la migración de reuniones/)).toBeTruthy();
  });

  /* Los invitados no ven la sección: ni en el menú ni por dirección. */
  it('un invitado no tiene acceso a la sección', () => {
    expect(puedeVerVista(yo('nuevo'), 'reuniones')).toBe(false);
    expect(puedeVerVista(yo('ana'), 'reuniones')).toBe(true);
  });
});

describe('quién modera', () => {
  it('sale quien le toca por rotación', () => {
    pintar();
    expect(screen.getByText('(le toca por rotación)')).toBeTruthy();
    expect(screen.getByText('Modera:').parentElement.textContent).toContain('Ana');
  });

  it('se salta a quien tiene ausencia ese día, y lo dice', () => {
    pintar({ ausencias: [{ usuario_id: 'ana', desde: sumarDias(SEMANA, -1), hasta: sumarDias(SEMANA, 6) }] });
    expect(screen.getByText('Modera:').parentElement.textContent).toContain('Dani');
    expect(screen.getByText(/Se saltó a Ana: tiene ausencia registrada ese día/)).toBeTruthy();
  });

  it('sin lista de rotación lo dice', () => {
    pintar({ rotaciones: [] });
    expect(screen.getByText('falta armar la rotación')).toBeTruthy();
  });

  it('el líder ve los controles de la sesión; un ingeniero no', () => {
    pintar({ perfil: yo('lucho') });
    expect(screen.getByText('cambiar fecha')).toBeTruthy();
    expect(screen.getByLabelText('Elegir moderador')).toBeTruthy();
    cleanup();
    pintar({ perfil: yo('dani') });
    expect(screen.queryByText('cambiar fecha')).toBe(null);
    expect(screen.queryByLabelText('Elegir moderador')).toBe(null);
  });

  /* Quien sigue tiene que saber con tiempo que le toca, para preparar la
     reunión: la rotación la ve todo el mundo. */
  it('todos ven la rotación, pero solo el líder la edita', () => {
    pintar({ perfil: yo('dani') });
    fireEvent.click(screen.getByText('rotación'));
    expect(screen.getByText('Orden de moderación')).toBeTruthy();
    expect(screen.getByText('esta semana')).toBeTruthy();
    expect(screen.queryByText('editar')).toBe(null);
    expect(screen.queryByLabelText('Agregar a la rotación')).toBe(null);
  });

  it('marca a quien modera esta semana y a quien le toca la siguiente', () => {
    pintar({ perfil: yo('lucho') });
    fireEvent.click(screen.getByText('rotación'));
    const fila = (nombre) => screen.getAllByRole('listitem').find((li) => li.textContent.includes(nombre));
    expect(fila('Ana').textContent).toContain('esta semana');
    expect(fila('Dani').textContent).toContain('la siguiente');
  });

  it('a quien le toca la semana siguiente se le dice directamente', () => {
    pintar({ perfil: yo('dani') });
    expect(screen.getByText('La semana siguiente te toca moderar a ti.')).toBeTruthy();
    cleanup();
    pintar({ perfil: yo('lucho') });
    expect(screen.getByText('La semana siguiente modera Dani.')).toBeTruthy();
  });

  it('sin rotación no promete a nadie para la semana siguiente', () => {
    pintar({ rotaciones: [] });
    expect(screen.queryByText(/La semana siguiente/)).toBe(null);
  });

  it('el líder arma la rotación y la guarda en orden', () => {
    const { handlers } = pintar({ perfil: yo('lucho'), rotaciones: [] });
    fireEvent.click(screen.getByText('rotación'));
    fireEvent.click(screen.getByText('editar'));
    fireEvent.change(screen.getByLabelText('Agregar a la rotación'), { target: { value: 'dani' } });
    fireEvent.change(screen.getByLabelText('Agregar a la rotación'), { target: { value: 'ana' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(handlers.onGuardarRotacion).toHaveBeenCalledWith('civil', ['dani', 'ana']);
  });

  it('la fecha corrida tiene que caer en la misma semana', () => {
    const { handlers } = pintar({ perfil: yo('lucho') });
    fireEvent.click(screen.getByText('cambiar fecha'));
    fireEvent.change(screen.getByLabelText('Fecha de la reunión'), { target: { value: sumarDias(SEMANA, 9) } });
    expect(screen.getByText('Tiene que caer en la misma semana.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Fecha de la reunión'), { target: { value: sumarDias(SEMANA, 1) } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(handlers.onGuardarSesion).toHaveBeenCalledWith('civil', SEMANA, { fecha: sumarDias(SEMANA, 1) }, 'ana');
  });
});

describe('los pendientes', () => {
  it('se ven con sus responsables, cuánto llevan y la última justificación', () => {
    pintar();
    expect(screen.getByText('Revisar alcance de Chinú 5')).toBeTruthy();
    expect(screen.getByText(/lleva 2 semanas/)).toBeTruthy();
    expect(screen.getByText('Falta la respuesta del cliente')).toBeTruthy();
  });

  /* Cada quien actualiza lo suyo durante la semana. */
  /* Beto va a la reunión civil (es estructural) pero no es responsable ni
     modera: ve el pendiente y no lo puede mover. Tiene que ser alguien de la
     MISMA reunión — con alguien de otra, la pantalla abre en la suya, el
     pendiente ni aparece y la prueba pasaría siempre. */
  it('el responsable lo puede actualizar; alguien ajeno no', () => {
    pintar({ perfil: yo('dani') });
    expect(screen.getByText('Actualizar')).toBeTruthy();
    cleanup();
    pintar({ perfil: yo('beto') });
    expect(screen.getByText('Revisar alcance de Chinú 5')).toBeTruthy();
    expect(screen.queryByText('Actualizar')).toBe(null);
  });

  it('el moderador de esta semana también puede actualizarlo', () => {
    pintar({ perfil: yo('ana') });
    expect(screen.getByText('Actualizar')).toBeTruthy();
  });

  /* El estado sin su porqué es justamente lo que se quería dejar de tener. */
  it('no deja guardar sin justificación', () => {
    const { handlers } = pintar({ perfil: yo('dani') });
    fireEvent.click(screen.getByText('Actualizar'));
    const guardar = screen.getByText('Guardar');
    expect(guardar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Estado del pendiente'), { target: { value: 'finalizado' } });
    fireEvent.change(screen.getByPlaceholderText(/Por qué está así/), { target: { value: 'Se entregó el viernes' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(handlers.onActualizarPendiente).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      { estado: 'finalizado', justificacion: 'Se entregó el viernes' },
    );
  });

  it('el historial muestra quién hizo qué', () => {
    pintar();
    fireEvent.click(screen.getByText('Historial (2)'));
    expect(screen.getByText(/creó el pendiente/)).toBeTruthy();
  });

  it('crear uno pide al menos un responsable, y nace dentro de la sesión', async () => {
    const { handlers } = pintar({ perfil: yo('ana') });
    fireEvent.click(screen.getByText('Nuevo pendiente'));
    fireEvent.change(screen.getByPlaceholderText('Qué hay que hacer'), { target: { value: 'Planos de vía' } });
    expect(screen.getByText('Crear pendiente').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Agregar responsable'), { target: { value: 'dani' } });
    fireEvent.click(screen.getByText('Crear pendiente'));
    await vi.waitFor(() => expect(handlers.onCrearPendiente).toHaveBeenCalled());
    expect(handlers.onAsegurarSesion).toHaveBeenCalledWith('civil', SEMANA, 'ana');
    expect(handlers.onCrearPendiente).toHaveBeenCalledWith({
      serie: 'civil', texto: 'Planos de vía', responsables: ['dani'], sesionId: `sesion-civil-${SEMANA}`,
    });
  });

  it('solo el moderador y el líder crean pendientes', () => {
    pintar({ perfil: yo('dani') });
    expect(screen.queryByText('Nuevo pendiente')).toBe(null);
  });

  it('los finalizados quedan aparte, plegados', () => {
    pintar({ pendientes: [pendienteViejo, { ...pendienteViejo, id: 'p2', texto: 'Ya cerrado', estado: 'finalizado' }] });
    expect(screen.queryByText('Ya cerrado')).toBe(null);
    fireEvent.click(screen.getByText('ver'));
    expect(screen.getByText('Ya cerrado')).toBeTruthy();
  });
});

describe('los temas que llegan de los resúmenes', () => {
  const resumen = {
    id: 'r1', usuario_id: 'dani', semana: ANTERIOR, enviado: true,
    bloques: { temas: [{ texto: 'Cambio de trazado en Chinú 3', reunion: 'equipo' }] },
  };

  it('llegan los de la semana anterior, con su autor', () => {
    pintar({ resumenes: [resumen] });
    expect(screen.getByText('Cambio de trazado en Chinú 3')).toBeTruthy();
    expect(screen.getByText(/1 por tratar/)).toBeTruthy();
  });

  it('volverlo pendiente crea el pendiente y deja el tema tratado', async () => {
    const { handlers } = pintar({ resumenes: [resumen] });
    fireEvent.click(screen.getByText('Volver pendiente'));
    fireEvent.click(screen.getByText('Crear pendiente'));
    await vi.waitFor(() => expect(handlers.onResolverTema).toHaveBeenCalled());
    /* El autor queda de responsable por defecto: lo trajo él. */
    expect(handlers.onCrearPendiente).toHaveBeenCalledWith(expect.objectContaining({ responsables: ['dani'] }));
    expect(handlers.onResolverTema).toHaveBeenCalledWith(expect.objectContaining({
      resultado: 'pendiente', pendienteId: 'nuevo-p',
    }));
  });

  it('cerrarlo sin compromiso pide decir en qué quedó', async () => {
    const { handlers } = pintar({ resumenes: [resumen] });
    fireEvent.click(screen.getByText('Cerrar sin compromiso'));
    expect(screen.getByText('Cerrar tema').disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('En qué quedó'), { target: { value: 'Se mantiene el trazado' } });
    fireEvent.click(screen.getByText('Cerrar tema'));
    await vi.waitFor(() => expect(handlers.onResolverTema).toHaveBeenCalled());
    expect(handlers.onResolverTema).toHaveBeenCalledWith(expect.objectContaining({
      resultado: 'sin_compromiso', conclusion: 'Se mantiene el trazado',
    }));
  });

  it('quien no modera ni gestiona los ve, pero no los trata', () => {
    pintar({ perfil: yo('dani'), resumenes: [resumen] });
    expect(screen.getByText('Cambio de trazado en Chinú 3')).toBeTruthy();
    expect(screen.queryByText('Volver pendiente')).toBe(null);
  });

  it('un tema ya tratado muestra en qué quedó y entra al registro', () => {
    const tratado = {
      id: 't1', sesion_id: `sesion-civil-${SEMANA}`, clave: 'dani:Cambio de trazado en Chinú 3', autor_id: 'dani',
      texto: 'Cambio de trazado en Chinú 3', resultado: 'sin_compromiso', conclusion: 'Se mantiene el trazado',
      created_at: new Date().toISOString(),
    };
    pintar({ resumenes: [resumen], temasTratados: [tratado] });
    expect(screen.getAllByText(/Se mantiene el trazado/).length).toBe(2);
    expect(screen.getByText('Copiar el registro')).toBeTruthy();
  });
});


describe('el plan de la semana', () => {
  const planDeDani = {
    id: `plan-civil-${SEMANA}-dani`, serie: 'civil', semana: SEMANA, usuario_id: 'dani',
    items: [{ id: 'i1', proyecto_id: 'chinu3', tarea: 'Diseño de drenaje' }, { id: 'i2', proyecto_id: 'santomas', tarea: 'Revisar caudales' }],
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('solo la reunión civil lo tiene', () => {
    pintar({ perfil: yo('lucho') });
    expect(screen.getByText('Plan de la semana')).toBeTruthy();
    cleanup();
    pintar({ perfil: yo('caro'), rotaciones: [] });
    expect(screen.queryByText('Plan de la semana')).toBe(null);
  });

  it('lo edita el líder; un ingeniero solo lo ve', () => {
    pintar({ perfil: yo('lucho') });
    expect(screen.getAllByTitle('Editar el plan').length).toBeGreaterThan(0);
    cleanup();
    pintar({ perfil: yo('ana'), planes: [planDeDani] });
    expect(screen.queryByTitle('Editar el plan')).toBe(null);
    expect(screen.getAllByText(/Diseño de drenaje/).length).toBeGreaterThan(0);
  });

  it('el líder arma el plan en orden de prioridad, y nace dentro de la sesión', async () => {
    const { handlers, container } = pintar({ perfil: yo('lucho') });
    const tarjetaDeDani = [...container.querySelectorAll('div')]
      .find((d) => d.firstChild?.firstChild?.textContent === 'Dani');
    fireEvent.click(tarjetaDeDani.querySelector('[title="Editar el plan"]'));
    fireEvent.change(screen.getByLabelText('Tarea 1'), { target: { value: 'Revisar caudales' } });
    fireEvent.click(screen.getByText('Agregar tarea'));
    fireEvent.change(screen.getByLabelText('Proyecto de la tarea 2'), { target: { value: 'chinu3' } });
    fireEvent.change(screen.getByLabelText('Tarea 2'), { target: { value: 'Diseño de drenaje' } });
    /* Lo de Chinú 3 es más urgente: sube al primer puesto. */
    fireEvent.click(screen.getAllByTitle('Subir prioridad')[1]);
    fireEvent.click(screen.getByText('Agregar tarea'));
    fireEvent.click(screen.getByText('Guardar'));
    await vi.waitFor(() => expect(handlers.onGuardarPlan).toHaveBeenCalled());
    expect(handlers.onAsegurarSesion).toHaveBeenCalled();
    const [serie, semana, usuario, items] = handlers.onGuardarPlan.mock.calls[0];
    expect([serie, semana, usuario]).toEqual(['civil', SEMANA, 'dani']);
    /* El renglón que quedó vacío se descarta al guardar. */
    expect(items.map((i) => [i.proyecto_id, i.tarea])).toEqual([
      ['chinu3', 'Diseño de drenaje'],
      [null, 'Revisar caudales'],
    ]);
  });

  it('no ofrece los proyectos finalizados', () => {
    const { container } = pintar({ perfil: yo('lucho') });
    fireEvent.click(container.querySelector('[title="Editar el plan"]'));
    const opciones = [...screen.getByLabelText('Proyecto de la tarea 1').querySelectorAll('option')].map((o) => o.textContent);
    expect(opciones).toContain('Chinú 3');
    expect(opciones).not.toContain('Proyecto cerrado');
  });

  /* Casi siempre el trabajo continúa: se parte del último plan. */
  it('se puede partir del plan anterior', () => {
    const anterior = { ...planDeDani, id: 'viejo', semana: ANTERIOR };
    const { container } = pintar({ perfil: yo('lucho'), planes: [anterior] });
    const tarjetaDeDani = [...container.querySelectorAll('div')]
      .find((d) => d.firstChild?.firstChild?.textContent === 'Dani');
    fireEvent.click(tarjetaDeDani.querySelector('[title="Editar el plan"]'));
    fireEvent.click(screen.getByText(/Traer el plan de la semana del/));
    expect(screen.getByLabelText('Tarea 1').value).toBe('Diseño de drenaje');
    expect(screen.getByLabelText('Tarea 2').value).toBe('Revisar caudales');
  });

  /* No se impide —el equipo se cambia en el proyecto—, pero se avisa. */
  it('avisa si le asignaron un proyecto donde no está en el equipo', () => {
    pintar({ perfil: yo('ana'), planes: [planDeDani] });
    /* Dani está en Chinú 3 pero no en San Tomás. */
    expect(screen.getAllByText(/No está en el equipo de este proyecto/).length).toBe(1);
  });

  it('cada quien ve su semana arriba del todo, con el proyecto a un clic', () => {
    const { handlers } = pintar({ perfil: yo('dani'), planes: [planDeDani] });
    expect(screen.getByText('Tu semana')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Chinú 3')[0]);
    expect(handlers.onAbrirProyecto).toHaveBeenCalledWith('chinu3');
  });

  it('quien no tiene plan no ve el bloque de su semana', () => {
    pintar({ perfil: yo('ana'), planes: [planDeDani] });
    expect(screen.queryByText('Tu semana')).toBe(null);
  });

  it('el plan entra al registro de la sesión', () => {
    pintar({ perfil: yo('ana'), planes: [planDeDani] });
    expect(screen.getByText(/1\. Chinú 3 · Diseño de drenaje; 2\. San Tomás · Revisar caudales/)).toBeTruthy();
  });

  it('sin la migración del plan, la reunión sigue y solo el plan avisa', () => {
    pintar({ perfil: yo('lucho'), planesDisponibles: false });
    expect(screen.getByText(/Falta correr la migración del plan/)).toBeTruthy();
    expect(screen.queryByTitle('Editar el plan')).toBe(null);
    expect(screen.getByText('Revisar alcance de Chinú 5')).toBeTruthy();
  });
});
