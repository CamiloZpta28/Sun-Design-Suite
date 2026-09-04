// @vitest-environment jsdom
/* ============================================================================
   NOTIFICACIONES — la campanita y la caducidad de las leídas.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  NotificationBell, notificacionesVigentes, estaVencida, fechaDeCorte, DIAS_TRAS_LEER,
} from './notificaciones.jsx';

afterEach(cleanup);

const MS_DIA = 24 * 60 * 60 * 1000;
/* La hora real, no una fija: la campanita decide qué está vencido con
   `Date.now()`, así que una fecha de referencia clavada en el calendario
   hace que las pruebas empiecen a fallar solas con el paso de los días. */
const AHORA = Date.now();
const haceHoras = (h) => new Date(AHORA - h * 60 * 60 * 1000).toISOString();

function notif(extra = {}) {
  return { id: 'n1', mensaje: 'Ana actualizó Minigranja 147', created_at: haceHoras(2), leida: false, leida_at: null, ...extra };
}

describe('caducidad de las leídas', () => {
  it('la sin leer nunca vence, por vieja que sea', () => {
    expect(estaVencida(notif({ created_at: haceHoras(24 * 30) }), AHORA)).toBe(false);
  });

  it('la leída hace un rato sigue viva', () => {
    expect(estaVencida(notif({ leida: true, leida_at: haceHoras(3) }), AHORA)).toBe(false);
  });

  /* El día se cuenta desde que se LEYÓ, no desde que ocurrió: una
     notificación de la semana pasada, abierta hoy, dura hasta mañana. */
  it('cuenta desde la lectura, no desde la creación', () => {
    const vieja = notif({ created_at: haceHoras(24 * 7), leida: true, leida_at: haceHoras(1) });
    expect(estaVencida(vieja, AHORA)).toBe(false);
  });

  it('la leída hace más de un día está vencida', () => {
    expect(estaVencida(notif({ leida: true, leida_at: haceHoras(25) }), AHORA)).toBe(true);
  });

  it('la leída sin hora de lectura se sigue mostrando (no se adivina)', () => {
    expect(estaVencida(notif({ leida: true, leida_at: null }), AHORA)).toBe(false);
  });

  it('el corte queda exactamente un día atrás', () => {
    expect(fechaDeCorte(AHORA)).toBe(new Date(AHORA - DIAS_TRAS_LEER * MS_DIA).toISOString());
  });

  it('notificacionesVigentes deja fuera solo las vencidas', () => {
    const lista = [
      notif({ id: 'a' }),
      notif({ id: 'b', leida: true, leida_at: haceHoras(2) }),
      notif({ id: 'c', leida: true, leida_at: haceHoras(48) }),
    ];
    expect(notificacionesVigentes(lista, AHORA).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('aguanta una lista vacía o sin definir', () => {
    expect(notificacionesVigentes(undefined)).toEqual([]);
    expect(notificacionesVigentes([])).toEqual([]);
  });
});

describe('campanita', () => {
  const abrirPanel = () => fireEvent.click(screen.getByTitle('Notificaciones'));

  it('el panel arranca cerrado', () => {
    render(<NotificationBell notificaciones={[notif()]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    expect(screen.queryByText(/Ana actualizó/)).toBe(null);
  });

  it('cuenta las sin leer y las lista al abrir', () => {
    render(<NotificationBell notificaciones={[notif(), notif({ id: 'n2', leida: true, leida_at: haceHoras(1) })]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    expect(screen.getByText('1')).toBeTruthy();
    abrirPanel();
    expect(screen.getAllByText(/Ana actualizó/)).toHaveLength(2);
  });

  it('con más de nueve sin leer muestra "+9"', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => notif({ id: `n${i}` }));
    render(<NotificationBell notificaciones={muchas} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    expect(screen.getByText('+9')).toBeTruthy();
  });

  /* Las vencidas no se pintan aunque lleguen en la lista: el borrado de la
     base de datos puede no haber corrido todavía. */
  it('no pinta ni cuenta las vencidas', () => {
    render(<NotificationBell notificaciones={[notif({ leida: true, leida_at: haceHoras(48) })]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    abrirPanel();
    expect(screen.getByText('Sin notificaciones todavía.')).toBeTruthy();
  });

  it('abrir una notificación cierra el panel y avisa cuál fue', () => {
    const onAbrir = vi.fn();
    render(<NotificationBell notificaciones={[notif()]} onAbrirNotificacion={onAbrir} onMarcarTodasLeidas={() => {}} />);
    abrirPanel();
    fireEvent.click(screen.getByText('Ana actualizó Minigranja 147'));
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir.mock.calls[0][0].id).toBe('n1');
    expect(screen.queryByText(/Ana actualizó/)).toBe(null);
  });

  it('ofrece marcar todas como leídas y lo avisa una sola vez', () => {
    const onTodas = vi.fn();
    render(<NotificationBell notificaciones={[notif(), notif({ id: 'n2' })]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={onTodas} />);
    abrirPanel();
    fireEvent.click(screen.getByText('Marcar todas como leídas'));
    expect(onTodas).toHaveBeenCalledTimes(1);
  });

  it('no ofrece marcar todas si ya están todas leídas', () => {
    render(<NotificationBell notificaciones={[notif({ leida: true, leida_at: haceHoras(1) })]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    abrirPanel();
    expect(screen.queryByText('Marcar todas como leídas')).toBe(null);
  });

  it('avisa que las leídas se borran', () => {
    render(<NotificationBell notificaciones={[notif()]} onAbrirNotificacion={() => {}} onMarcarTodasLeidas={() => {}} />);
    abrirPanel();
    expect(screen.getByText('Las leídas se borran un día después.')).toBeTruthy();
  });
});
