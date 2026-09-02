// @vitest-environment jsdom
/* ============================================================================
   COPIAR AL PORTAPAPELES — el código de un documento.
   ============================================================================ */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CodigoCopiable, copiarTexto } from './copiar.jsx';

const CODIGO = 'COLLAGT173P1-CIV-INF-001';

/* El portapapeles real no existe en las pruebas: se sustituye por un doble
   que registra lo que se le pidió copiar. */
function conPortapapeles({ falla = false } = {}) {
  const writeText = vi.fn(() => (falla ? Promise.reject(new Error('bloqueado')) : Promise.resolve()));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  return writeText;
}

/* Sin API de portapapeles (http o navegador viejo) queda el camino de
   respaldo: un textarea y `document.execCommand`. */
function sinPortapapeles({ ok = true } = {}) {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
  const exec = vi.fn(() => ok);
  document.execCommand = exec;
  return exec;
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(cleanup);

describe('copiarTexto', () => {
  it('usa el portapapeles del navegador cuando está disponible', async () => {
    const writeText = conPortapapeles();
    expect(await copiarTexto(CODIGO)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(CODIGO);
  });

  it('cae al textarea si no hay portapapeles, y no deja basura en la página', async () => {
    const exec = sinPortapapeles();
    expect(await copiarTexto(CODIGO)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('avisa que no pudo en vez de reventar', async () => {
    conPortapapeles({ falla: true });
    expect(await copiarTexto(CODIGO)).toBe(false);
  });
});

describe('CodigoCopiable', () => {
  it('muestra el código', () => {
    conPortapapeles();
    render(<CodigoCopiable codigo={CODIGO} />);
    expect(screen.getByText(CODIGO)).toBeTruthy();
  });

  it('lo copia al hacer clic y lo confirma en pantalla', async () => {
    const writeText = conPortapapeles();
    render(<CodigoCopiable codigo={CODIGO} />);
    expect(screen.getByTitle(`Copiar ${CODIGO}`)).toBeTruthy();
    fireEvent.click(screen.getByText(CODIGO));
    expect(writeText).toHaveBeenCalledWith(CODIGO);
    await waitFor(() => expect(screen.getByTitle('Código copiado')).toBeTruthy());
  });

  it('no dice "copiado" si el navegador lo bloqueó', async () => {
    conPortapapeles({ falla: true });
    render(<CodigoCopiable codigo={CODIGO} />);
    fireEvent.click(screen.getByText(CODIGO));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTitle('Código copiado')).toBe(null);
  });

  /* La tarjeta del documento se despliega al hacer clic encima; copiar el
     código NO debe desplegarla. */
  it('no dispara el clic de lo que lo rodea', () => {
    conPortapapeles();
    const alrededor = vi.fn();
    render(<div onClick={alrededor}><CodigoCopiable codigo={CODIGO} /></div>);
    fireEvent.click(screen.getByText(CODIGO));
    expect(alrededor).not.toHaveBeenCalled();
  });
});
