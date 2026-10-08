// @vitest-environment jsdom
/* ============================================================================
   BARRERA DE ERRORES — render real.
   ----------------------------------------------------------------------------
   Lo que se comprueba: que un error al pintar deje un aviso y no la pantalla
   en blanco, y que la recarga automática (para el caso de un despliegue) se
   haga una sola vez y no entre en ciclo.
   ============================================================================ */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import BarreraDeErrores, { esErrorDeDescarga, puedeRecargarSola } from './BarreraDeErrores.jsx';

/* React anota en la consola cada error que atrapa una barrera: es ruido
   esperado aquí. */
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Revienta({ error }) {
  throw error;
}
const deDescarga = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Proyecto-abc.js');

describe('la barrera de errores', () => {
  it('sin error pinta lo que lleva adentro', () => {
    render(<BarreraDeErrores><p>Todo bien</p></BarreraDeErrores>);
    expect(screen.getByText('Todo bien')).toBeTruthy();
  });

  it('un error al pintar deja un aviso con su mensaje, y recargar funciona', () => {
    const recargar = vi.fn();
    render(<BarreraDeErrores recargar={recargar}><Revienta error={new Error('logoMark is not defined')} /></BarreraDeErrores>);
    expect(screen.getByText('Algo falló al mostrar esta pantalla')).toBeTruthy();
    expect(screen.getByText('logoMark is not defined')).toBeTruthy();
    /* Un error del código no se arregla recargando: no se recarga sola. */
    expect(recargar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Recargar'));
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('si es una sección que no se pudo descargar, recarga sola una vez', () => {
    const recargar = vi.fn();
    render(<BarreraDeErrores recargar={recargar}><Revienta error={deDescarga()} /></BarreraDeErrores>);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hay una versión nueva de la plataforma')).toBeTruthy();
  });

  /* Si el archivo de verdad no existe, recargar no lo arregla: la segunda vez
     se queda el aviso en vez de recargar sin fin. */
  it('no entra en un ciclo de recargas', () => {
    const recargar = vi.fn();
    render(<BarreraDeErrores recargar={recargar}><Revienta error={deDescarga()} /></BarreraDeErrores>);
    cleanup();
    render(<BarreraDeErrores recargar={recargar}><Revienta error={deDescarga()} /></BarreraDeErrores>);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hay una versión nueva de la plataforma')).toBeTruthy();
  });
});

describe('qué cuenta como "no se pudo descargar"', () => {
  it('reconoce cómo lo dice cada navegador', () => {
    expect(esErrorDeDescarga(deDescarga())).toBe(true); // Chrome
    expect(esErrorDeDescarga(new TypeError('error loading dynamically imported module'))).toBe(true); // Firefox
    expect(esErrorDeDescarga(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(esErrorDeDescarga(new Error('SelectOrOtro is not defined'))).toBe(false);
    expect(esErrorDeDescarga(null)).toBe(false);
  });

  it('vuelve a permitir la recarga pasado un minuto', () => {
    const t = Date.now();
    expect(puedeRecargarSola(t)).toBe(true);
    expect(puedeRecargarSola(t + 30000)).toBe(false);
    expect(puedeRecargarSola(t + 61000)).toBe(true);
  });
});
