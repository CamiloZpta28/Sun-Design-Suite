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
    expect(screen.getByText('rotación')).toBeTruthy();
    expect(screen.getByLabelText('Elegir moderador')).toBeTruthy();
    cleanup();
    pintar({ perfil: yo('dani') });
    expect(screen.queryByText('cambiar fecha')).toBe(null);
    expect(screen.queryByText('rotación')).toBe(null);
  });

  it('el líder arma la rotación y la guarda en orden', () => {
    const { handlers } = pintar({ perfil: yo('lucho'), rotaciones: [] });
    fireEvent.click(screen.getByText('rotación'));
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
