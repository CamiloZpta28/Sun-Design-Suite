// @vitest-environment jsdom
/* ============================================================================
   IMÁGENES ADJUNTAS — render real, con un servicio de mentiras en vez de
   Supabase Storage.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import {
  BotonAgregarImagen, GaleriaImagenes, MAX_MB_IMAGEN, errorDeImagen, imagenesDelPortapapeles, subirImagenes,
} from './imagenes.jsx';

afterEach(cleanup);

const png = (nombre = 'a.png', bytes = 4) => new File([new Uint8Array(bytes)], nombre, { type: 'image/png' });
const firmar = async (ruta) => `https://firmada/${ruta}`;

describe('qué imagen entra', () => {
  it('solo imágenes, y hasta el límite', () => {
    expect(errorDeImagen(png())).toBe(null);
    expect(errorDeImagen(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(/Solo se pueden adjuntar imágenes/);
    expect(errorDeImagen(png('g.png', MAX_MB_IMAGEN * 1024 * 1024 + 1))).toMatch(/no puede pesar más de/);
  });

  it('del portapapeles solo saca imágenes', () => {
    const archivo = png();
    const evento = { clipboardData: { items: [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => archivo },
    ] } };
    expect(imagenesDelPortapapeles(evento)).toEqual([archivo]);
    expect(imagenesDelPortapapeles({ clipboardData: { items: [{ kind: 'string', type: 'text/plain' }] } })).toEqual([]);
  });

  /* Si una falla, se dice y se paran las siguientes; las que ya subieron
     quedan. */
  it('al subir varias, la primera que falla detiene el resto', async () => {
    const subir = vi.fn(async (f) => {
      if (f.name === 'mala.png') throw new Error('Se cayó la red');
      return `ruta-${f.name}`;
    });
    const r = await subirImagenes([png('uno.png'), png('mala.png'), png('tres.png')], { subir });
    expect(r).toEqual({ rutas: ['ruta-uno.png'], error: 'Se cayó la red' });
    expect(subir).toHaveBeenCalledTimes(2);
  });
});

describe('la galería', () => {
  it('pinta cada imagen con su enlace firmado, y la agranda al pulsarla', async () => {
    render(<GaleriaImagenes rutas={['img-1.png']} firmar={firmar} />);
    const img = await screen.findByAltText('Imagen adjunta');
    expect(img.getAttribute('src')).toBe('https://firmada/img-1.png');
    fireEvent.click(screen.getByTitle('Ver en grande'));
    expect(screen.getAllByAltText('Imagen adjunta').length).toBe(2);
  });

  /* Sin enlace (sin la migración, o sin permiso) queda un recuadro, no una
     imagen rota. */
  it('si no se puede firmar, deja un recuadro', async () => {
    render(<GaleriaImagenes rutas={['img-1.png']} firmar={async () => null} />);
    await waitFor(() => expect(screen.getByTitle('No se pudo cargar la imagen')).toBeTruthy());
    expect(screen.queryByAltText('Imagen adjunta')).toBe(null);
  });

  it('con onQuitar, cada una se puede quitar; sin él, no', async () => {
    const onQuitar = vi.fn();
    render(<GaleriaImagenes rutas={['img-1.png', 'img-2.png']} firmar={firmar} onQuitar={onQuitar} />);
    fireEvent.click(screen.getAllByLabelText('Quitar la imagen')[1]);
    expect(onQuitar).toHaveBeenCalledWith('img-2.png');
    cleanup();
    render(<GaleriaImagenes rutas={['img-1.png']} firmar={firmar} />);
    expect(screen.queryByLabelText('Quitar la imagen')).toBe(null);
  });

  it('sin rutas no pinta nada', () => {
    const { container } = render(<GaleriaImagenes rutas={[]} firmar={firmar} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('el botón de adjuntar', () => {
  it('sube lo que se elige y entrega las rutas', async () => {
    const onAgregadas = vi.fn();
    const subir = vi.fn(async (f) => `ruta-${f.name}`);
    render(<BotonAgregarImagen servicio={{ subir, firmar }} onAgregadas={onAgregadas} />);
    fireEvent.change(screen.getByTestId('adjuntar-imagen'), { target: { files: [png('uno.png'), png('dos.png')] } });
    await waitFor(() => expect(onAgregadas).toHaveBeenCalledWith(['ruta-uno.png', 'ruta-dos.png']));
  });

  it('si no se puede subir, lo dice', async () => {
    const subir = async () => { throw new Error('Falta correr la migración'); };
    render(<BotonAgregarImagen servicio={{ subir, firmar }} onAgregadas={() => {}} />);
    fireEvent.change(screen.getByTestId('adjuntar-imagen'), { target: { files: [png()] } });
    expect(await screen.findByText('Falta correr la migración')).toBeTruthy();
  });

  it('sin servicio no aparece', () => {
    render(<BotonAgregarImagen servicio={null} onAgregadas={() => {}} />);
    expect(screen.queryByLabelText('Adjuntar imagen')).toBe(null);
  });
});
