// @vitest-environment jsdom
/* Render real de la sección Equipos eléctricos — ver Instructivos.test.jsx
   para el porqué de estas pruebas. */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EquiposElectricosView from './Equipos.jsx';
import { EQUIPO_TIPOS, EQUIPO_SEED, EquipoIcono } from './equiposDatos.jsx';

afterEach(cleanup);

const sinAcciones = { onAdd: () => {}, onUpdate: () => {}, onDelete: () => {} };

describe('EquiposElectricosView', () => {
  it('renderiza sin plantillas', () => {
    render(<EquiposElectricosView plantillas={[]} {...sinAcciones} />);
    expect(screen.getByText('Equipos eléctricos')).toBeTruthy();
  });

  it('renderiza una plantilla del primer tipo, con sus atributos', () => {
    const tipo = EQUIPO_TIPOS[0];
    const plantillas = [{
      id: 'e1',
      tipo: tipo.id,
      nombre: 'Modelo de ejemplo',
      datos: { especificacion: '550 Wp', atributos: { Potencia: '550 W', Marca: '' }, imagen: null },
    }];
    render(<EquiposElectricosView plantillas={plantillas} {...sinAcciones} />);
    expect(screen.getByText('Modelo de ejemplo')).toBeTruthy();
    /* Los atributos vacíos no se muestran (ver atributosLineas). */
    expect(screen.getByText(/Potencia:/)).toBeTruthy();
    expect(screen.queryByText(/Marca:/)).toBe(null);
  });
});

describe('equiposDatos', () => {
  /* Un ícono faltante deja la tarjeta del equipo en blanco, así que se
     comprueba que TODOS los tipos tengan el suyo y que ninguno reviente. */
  it('cada tipo de equipo tiene ícono y se puede pintar', () => {
    EQUIPO_TIPOS.forEach((tipo) => {
      const { container } = render(<EquipoIcono tipoId={tipo.id} />);
      expect(container.querySelector('svg'), tipo.id).toBeTruthy();
      cleanup();
    });
  });

  it('la semilla solo usa tipos que existen', () => {
    const ids = new Set(EQUIPO_TIPOS.map((t) => t.id));
    EQUIPO_SEED.forEach((s) => expect(ids.has(s.tipo), s.tipo).toBe(true));
  });
});
