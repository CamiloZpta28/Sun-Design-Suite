// @vitest-environment jsdom
/* Render real de la sección Actualizaciones — ver Instructivos.test.jsx para
   el porqué de estas pruebas. */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ActualizacionesView from './Actualizaciones.jsx';
import { ACTUALIZACION_CATEGORIAS_SEED } from './actualizacionesDatos.js';

afterEach(cleanup);

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
