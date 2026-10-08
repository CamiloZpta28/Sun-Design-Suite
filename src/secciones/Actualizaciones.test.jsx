// @vitest-environment jsdom
/* Render real de la sección Actualizaciones — ver Instructivos.test.jsx para
   el porqué de estas pruebas. */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import ActualizacionesView, { ActualizacionForm, ubicacionesConocidas } from './Actualizaciones.jsx';
import { ACTUALIZACION_CATEGORIAS_SEED } from './actualizacionesDatos.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sinAcciones = {
  onAddCategoria: () => {},
  onRenameCategoria: () => {},
  onDeleteCategoria: () => {},
  onAdd: () => {},
  onUpdate: () => {},
  onDelete: () => {},
};

const lider = { id: 'u1', nombre: 'Ana', roles: ['lider_diseno'] };
const ingeniero = { id: 'u2', nombre: 'Beto', roles: ['civil'] };

describe('ActualizacionesView', () => {
  it('renderiza sin categorías ni actualizaciones', () => {
    render(<ActualizacionesView categorias={[]} actualizaciones={[]} perfil={ingeniero} {...sinAcciones} />);
    expect(screen.getAllByText('Actualizaciones').length).toBeGreaterThan(0);
  });

  it('renderiza con datos, para un líder (que además puede gestionar categorías)', () => {
    const categorias = ACTUALIZACION_CATEGORIAS_SEED.map((c, i) => ({ ...c, orden: i }));
    const actualizaciones = [
      {
        id: 'a1',
        categoria_id: 'act_shelter',
        nombre: 'Cambio de anclaje',
        descripcion: 'Se ajustó el detalle',
        etiquetas: ['shelter', 'anclaje'],
        ubicacion: 'Plano 3',
        interesados: ['civil'],
        creado_por: 'Ana',
        created_at: '2026-08-01T15:00:00.000Z',
      },
    ];
    /* La lista muestra solo la categoría activa, así que se abre en la del
       ejemplo — el mismo camino que usa una notificación al abrir la
       sección apuntando a su categoría. */
    render(
      <ActualizacionesView
        categorias={categorias}
        actualizaciones={actualizaciones}
        perfil={lider}
        categoriaPreseleccionada="act_shelter"
        {...sinAcciones}
      />,
    );
    expect(screen.getByText('Cambio de anclaje')).toBeTruthy();
    expect(screen.getByText('Se ajustó el detalle')).toBeTruthy();
  });

  /* La sección se puede abrir desde una notificación, que llega con la
     categoría ya elegida: ese camino no debe romper el render. */
  it('renderiza con una categoría preseleccionada', () => {
    const categorias = ACTUALIZACION_CATEGORIAS_SEED.map((c, i) => ({ ...c, orden: i }));
    render(
      <ActualizacionesView
        categorias={categorias}
        actualizaciones={[]}
        perfil={ingeniero}
        categoriaPreseleccionada="act_canalizaciones"
        {...sinAcciones}
      />,
    );
    expect(screen.getAllByText('Actualizaciones').length).toBeGreaterThan(0);
  });
});

describe('la ubicación con link', () => {
  const categorias = ACTUALIZACION_CATEGORIAS_SEED.map((c, i) => ({ ...c, orden: i }));
  const pintarCon = (extra) => render(
    <ActualizacionesView
      categorias={categorias}
      actualizaciones={[{
        id: 'a1', categoria_id: 'act_shelter', nombre: 'Cambio de anclaje', interesados: [], etiquetas: [],
        created_at: '2026-08-01T15:00:00.000Z', ...extra,
      }]}
      perfil={ingeniero}
      categoriaPreseleccionada="act_shelter"
      {...sinAcciones}
    />,
  );

  it('con link, la ubicación abre el link en otra pestaña', () => {
    pintarCon({ ubicacion: 'Plano 3', ubicacion_url: 'drive.google.com/x' });
    const enlace = screen.getByText('Plano 3').closest('a');
    expect(enlace.getAttribute('href')).toBe('https://drive.google.com/x');
    expect(enlace.getAttribute('target')).toBe('_blank');
  });

  it('con link y sin texto, el enlace se nombra solo', () => {
    pintarCon({ ubicacion: '', ubicacion_url: 'https://drive.google.com/x' });
    expect(screen.getByText('Abrir ubicación').closest('a')).toBeTruthy();
  });

  it('sin link, la ubicación es texto como siempre', () => {
    pintarCon({ ubicacion: 'Plano 3' });
    expect(screen.getByText('Plano 3').closest('a')).toBe(null);
  });
});

describe('el formulario de una actualización', () => {
  const pantallazo = () => new File([new Uint8Array([137, 80, 78, 71])], 'pantallazo.png', { type: 'image/png' });
  const conocidas = [{ nombre: 'Biblioteca civil', url: 'https://drive.google.com/civil' }, { nombre: 'Plano suelto', url: '' }];
  const pintarForm = () => {
    const onSave = vi.fn();
    const { container } = render(
      <ActualizacionForm etiquetasConocidas={[]} ubicacionesConocidas={conocidas} onCancel={() => {}} onSave={onSave} />,
    );
    const vistaPrevia = () => container.querySelector('form img');
    const nombre = container.querySelector('input[required]');
    return { onSave, form: container.querySelector('form'), vistaPrevia, nombre };
  };
  const ubicacion = () => screen.getByLabelText('Ubicación');
  const link = () => screen.getByLabelText('Link de la ubicación');

  it('guarda el link de la ubicación', () => {
    const { onSave, nombre } = pintarForm();
    fireEvent.change(nombre, { target: { value: 'Ajuste de vía' } });
    fireEvent.change(ubicacion(), { target: { value: 'Plano 3' } });
    fireEvent.change(link(), { target: { value: ' https://drive.google.com/x ' } });
    fireEvent.click(screen.getByText('Crear actualización'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ ubicacion: 'Plano 3', ubicacion_url: 'https://drive.google.com/x' });
  });

  it('un pantallazo pegado con Ctrl+V queda como imagen', async () => {
    const { form, vistaPrevia } = pintarForm();
    const archivo = pantallazo();
    const sinCancelar = fireEvent.paste(form, {
      clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => archivo }] },
    });
    expect(sinCancelar).toBe(false);
    await waitFor(() => expect(vistaPrevia()).toBeTruthy());
    expect(vistaPrevia().getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  /* Pegar texto en el nombre o la descripción no se toca. */
  it('pegar texto sigue funcionando como siempre', () => {
    const { form, vistaPrevia } = pintarForm();
    const sinCancelar = fireEvent.paste(form, {
      clipboardData: { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] },
    });
    expect(sinCancelar).toBe(true);
    expect(vistaPrevia()).toBe(null);
  });

  it('el botón de pegar lee la imagen del portapapeles', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { read: async () => [{ types: ['text/html', 'image/png'], getType: async () => pantallazo() }] },
    });
    const { vistaPrevia } = pintarForm();
    fireEvent.click(screen.getByText('Pegar del portapapeles'));
    await waitFor(() => expect(vistaPrevia()).toBeTruthy());
  });

  it('si el portapapeles no tiene imagen, lo dice', async () => {
    vi.stubGlobal('navigator', { clipboard: { read: async () => [{ types: ['text/plain'], getType: async () => null }] } });
    pintarForm();
    fireEvent.click(screen.getByText('Pegar del portapapeles'));
    expect(await screen.findByText('No hay ninguna imagen en el portapapeles.')).toBeTruthy();
  });

  /* Firefox no deja leer el portapapeles desde un botón: se enseña Ctrl+V. */
  it('si el navegador no deja leer el portapapeles, explica cómo pegar', async () => {
    vi.stubGlobal('navigator', {});
    pintarForm();
    fireEvent.click(screen.getByText('Pegar del portapapeles'));
    expect(await screen.findByText(/pega con Ctrl\+V/)).toBeTruthy();
  });

  it('un pantallazo de más de 3 MB no entra, y lo dice', () => {
    const { form, vistaPrevia } = pintarForm();
    const grande = new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
    fireEvent.paste(form, { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => grande }] } });
    expect(screen.getByText(/no puede pesar más de 3 MB/)).toBeTruthy();
    expect(vistaPrevia()).toBe(null);
  });
});

describe('las ubicaciones que se repiten', () => {
  const act = (ubicacion, ubicacion_url, created_at) => ({ ubicacion, ubicacion_url, created_at });

  it('se recuerdan con su link, sin repetirse por tildes o mayúsculas', () => {
    expect(ubicacionesConocidas([
      act('Biblioteca civil', 'https://drive/viejo', '2026-01-01'),
      act('biblioteca civil', 'https://drive/nuevo', '2026-03-01'),
      act('Carpeta de cantidades', '', '2026-02-01'),
      act('', 'https://suelto', '2026-02-01'),
    ])).toEqual([
      { nombre: 'biblioteca civil', url: 'https://drive/nuevo' },
      { nombre: 'Carpeta de cantidades', url: '' },
    ]);
  });

  /* Si la última vez se escribió sin link, se sugiere el de antes: un link
     que alguien ya se tomó el trabajo de poner no se pierde. */
  it('si la más reciente no trae link, se queda el último que lo tenía', () => {
    expect(ubicacionesConocidas([
      act('Biblioteca civil', 'https://drive/civil', '2026-01-01'),
      act('Biblioteca civil', '', '2026-03-01'),
    ])).toEqual([{ nombre: 'Biblioteca civil', url: 'https://drive/civil' }]);
  });
});

describe('elegir una ubicación conocida', () => {
  const conocidas = [{ nombre: 'Biblioteca civil', url: 'https://drive.google.com/civil' }, { nombre: 'Carpeta de cantidades', url: 'https://drive.google.com/cant' }];
  const pintar = () => render(<ActualizacionForm etiquetasConocidas={[]} ubicacionesConocidas={conocidas} onCancel={() => {}} onSave={() => {}} />);
  const ubicacion = () => screen.getByLabelText('Ubicación');
  const link = () => screen.getByLabelText('Link de la ubicación');

  it('llena su link solo, y lo cambia si se cambia de ubicación', () => {
    pintar();
    fireEvent.change(ubicacion(), { target: { value: 'Biblioteca civil' } });
    expect(link().value).toBe('https://drive.google.com/civil');
    fireEvent.change(ubicacion(), { target: { value: 'Carpeta de cantidades' } });
    expect(link().value).toBe('https://drive.google.com/cant');
    fireEvent.change(ubicacion(), { target: { value: 'Plano 3' } });
    expect(link().value).toBe('');
  });

  it('no pisa un link que la persona escribió', () => {
    pintar();
    fireEvent.change(link(), { target: { value: 'https://mi-link' } });
    fireEvent.change(ubicacion(), { target: { value: 'Biblioteca civil' } });
    expect(link().value).toBe('https://mi-link');
  });

  it('escrita distinto, queda con la escritura de siempre', () => {
    pintar();
    fireEvent.change(ubicacion(), { target: { value: 'biblioteca civil' } });
    expect(link().value).toBe('https://drive.google.com/civil');
    fireEvent.blur(ubicacion());
    expect(ubicacion().value).toBe('Biblioteca civil');
  });
});

describe('la pestaña "Todas"', () => {
  const categorias = [
    { id: 'c1', nombre: 'Paneles', orden: 0 },
    { id: 'c2', nombre: 'Cerramiento', orden: 1 },
  ];
  /* Ninguna de estas fechas importa en sí: solo su orden. */
  const actualizaciones = [
    { id: 'a1', categoria_id: 'c1', nombre: 'Vieja de paneles', interesados: [], etiquetas: [], created_at: '2026-01-01T10:00:00.000Z' },
    { id: 'a2', categoria_id: 'c2', nombre: 'Nueva de cerramiento', interesados: [], etiquetas: [], created_at: '2026-03-01T10:00:00.000Z' },
    { id: 'a3', categoria_id: 'c1', nombre: 'Media de paneles', interesados: [], etiquetas: [], created_at: '2026-02-01T10:00:00.000Z' },
  ];
  const pintarVista = (extra = {}) => {
    const onAdd = vi.fn();
    const utils = render(
      <ActualizacionesView categorias={categorias} actualizaciones={actualizaciones} perfil={ingeniero} {...sinAcciones} onAdd={onAdd} {...extra} />,
    );
    return { onAdd, ...utils };
  };
  const titulos = () => screen.queryAllByText(/de (paneles|cerramiento)$/).map((n) => n.textContent);

  it('abre en "Todas", con la más reciente primero y la categoría de cada una', () => {
    pintarVista();
    expect(screen.getByText('Todas').closest('button').className).toContain('bg-navy-800');
    expect(titulos()).toEqual(['Nueva de cerramiento', 'Media de paneles', 'Vieja de paneles']);
    expect(screen.getAllByRole('button', { name: 'Paneles' }).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Cerramiento' })).toBeTruthy();
  });

  it('los filtros por categoría siguen ahí', () => {
    pintarVista();
    fireEvent.click(screen.getByRole('button', { name: 'Paneles (2)' }));
    expect(titulos()).toEqual(['Media de paneles', 'Vieja de paneles']);
    fireEvent.click(screen.getByText('Todas'));
    expect(titulos().length).toBe(3);
  });

  it('desde una notificación abre en su categoría', () => {
    pintarVista({ categoriaPreseleccionada: 'c2' });
    expect(titulos()).toEqual(['Nueva de cerramiento']);
  });

  it('crear desde "Todas" pide la categoría', () => {
    const { onAdd, container } = pintarVista();
    fireEvent.click(screen.getByText('Nueva actualización'));
    fireEvent.change(container.querySelector('input[required]'), { target: { value: 'Ajuste' } });
    expect(screen.getByText('Crear actualización').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'c2' } });
    fireEvent.click(screen.getByText('Crear actualización'));
    expect(onAdd).toHaveBeenCalledWith('c2', expect.objectContaining({ nombre: 'Ajuste' }));
  });

  it('dentro de una categoría no la pide: es esa', () => {
    const { onAdd, container } = pintarVista({ categoriaPreseleccionada: 'c1' });
    fireEvent.click(screen.getByText('Nueva actualización en "Paneles"'));
    expect(screen.queryByLabelText('Categoría')).toBe(null);
    fireEvent.change(container.querySelector('input[required]'), { target: { value: 'Ajuste' } });
    fireEvent.click(screen.getByText('Crear actualización'));
    expect(onAdd).toHaveBeenCalledWith('c1', expect.objectContaining({ nombre: 'Ajuste' }));
  });

  /* Si borran la categoría que alguien tiene abierta, vuelve a "Todas" y no
     a otra categoría cualquiera. */
  it('si la categoría abierta desaparece, vuelve a "Todas"', () => {
    const { rerender } = pintarVista({ categoriaPreseleccionada: 'c2' });
    rerender(
      <ActualizacionesView categorias={[categorias[0]]} actualizaciones={actualizaciones.filter((a) => a.categoria_id === 'c1')} perfil={ingeniero} {...sinAcciones} />,
    );
    expect(screen.getByText('Todas').closest('button').className).toContain('bg-navy-800');
    expect(titulos()).toEqual(['Media de paneles', 'Vieja de paneles']);
  });
});

