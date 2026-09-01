// @vitest-environment jsdom
/* ============================================================================
   INSTRUCTIVOS — prueba de render real.
   ----------------------------------------------------------------------------
   Monta el componente en un DOM simulado, que es la única forma de detectar
   el error que más veces ha tumbado esta app: una referencia que quedó
   huérfana al mover código (`X is not defined`). `npm run build` NO lo
   detecta — JavaScript solo revienta con eso al ejecutarse.

   Por eso cada sección que se saca de App.jsx entra aquí con, como mínimo,
   un render de su estado vacío y otro con datos.
   ============================================================================ */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import InstructivosView, { extractYouTubeId } from './Instructivos.jsx';

afterEach(cleanup);

const sinAcciones = {
  onAddCarpeta: () => {},
  onUpdateCarpeta: () => {},
  onDeleteCarpeta: () => {},
  onAddVideo: () => {},
  onUpdateVideo: () => {},
  onDeleteVideo: () => {},
};

describe('InstructivosView', () => {
  it('renderiza sin datos', () => {
    render(<InstructivosView carpetas={[]} videos={[]} {...sinAcciones} />);
    expect(screen.getByText('Instructivos')).toBeTruthy();
  });

  it('renderiza con carpetas y videos', () => {
    const carpetas = [{ id: 'c1', nombre: 'Cimentaciones', descripcion: 'Cómo se arman' }];
    const videos = [
      { id: 'v1', carpeta_id: 'c1', titulo: 'Zapata paso a paso', descripcion: '', url: 'https://youtu.be/abc123' },
      { id: 'v2', carpeta_id: 'c1', titulo: 'Link que no se entiende', descripcion: '', url: 'no-es-un-link' },
    ];
    render(<InstructivosView carpetas={carpetas} videos={videos} {...sinAcciones} />);
    expect(screen.getByText('Cimentaciones')).toBeTruthy();
  });
});

describe('extractYouTubeId', () => {
  it('reconoce los cuatro formatos de link', () => {
    expect(extractYouTubeId('https://youtu.be/abc123')).toBe('abc123');
    expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123')).toBe('abc123');
    expect(extractYouTubeId('https://www.youtube.com/embed/abc123')).toBe('abc123');
    expect(extractYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  it('devuelve null con cualquier otra cosa', () => {
    expect(extractYouTubeId('https://vimeo.com/123')).toBe(null);
    expect(extractYouTubeId('no-es-un-link')).toBe(null);
    expect(extractYouTubeId('')).toBe(null);
  });
});
