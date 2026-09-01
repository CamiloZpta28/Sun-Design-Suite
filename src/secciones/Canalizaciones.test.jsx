// @vitest-environment jsdom
/* Render real de Canalizaciones y Cruces — ver Instructivos.test.jsx para el
   porqué de estas pruebas. Aquí importan especialmente los dibujos: son SVG
   calculados a partir de los datos, así que un dato faltante o una función
   mal referenciada revientan al pintar, no al compilar. */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CanalizacionesView, { CrucesView, CanalizacionPreview, CrucePreview } from './Canalizaciones.jsx';
import { CANALIZACION_TIPOS, emptyDatosCanalizacion, construirSeedCanalizaciones } from './canalizacionesDatos.js';

afterEach(cleanup);

const sinAcciones = { onAdd: () => {}, onUpdate: () => {}, onDelete: () => {}, onSetPrincipal: () => {} };
const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };

function plantillaDe(tipoDef, extra = {}) {
  return {
    id: `p-${tipoDef.id}`,
    tipo: tipoDef.id,
    nombre: `Zanja ${tipoDef.label}`,
    datos: { ...emptyDatosCanalizacion(tipoDef), diametro: '2"', ...extra },
    es_principal: true,
  };
}

describe('CanalizacionesView', () => {
  it('renderiza sin plantillas', () => {
    render(<CanalizacionesView plantillas={[]} diametrosTuberia={[]} perfil={perfil} {...sinAcciones} />);
    expect(screen.getByText('Canalizaciones')).toBeTruthy();
  });

  it('renderiza con la semilla completa (todos los tipos)', () => {
    render(
      <CanalizacionesView
        plantillas={construirSeedCanalizaciones()}
        diametrosTuberia={['1"', '2"', '4"']}
        perfil={perfil}
        {...sinAcciones}
      />,
    );
    expect(screen.getByText('Canalizaciones')).toBeTruthy();
  });
});

describe('CanalizacionPreview', () => {
  /* Cada tipo dibuja distinto (con tubería, cable fino, sin arenilla…): si
     alguno revienta, la sección entera queda en blanco. */
  it('dibuja el corte de zanja de todos los tipos', () => {
    CANALIZACION_TIPOS.forEach((tipoDef) => {
      const { container } = render(<CanalizacionPreview tipoId={tipoDef.id} datos={emptyDatosCanalizacion(tipoDef)} />);
      expect(container.querySelector('svg'), tipoDef.id).toBeTruthy();
      cleanup();
    });
  });

  it('dibuja aunque los datos vengan vacíos', () => {
    const { container } = render(<CanalizacionPreview tipoId="dc" datos={{}} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('CrucesView', () => {
  const dc = plantillaDe(CANALIZACION_TIPOS.find((t) => t.id === 'dc'));
  const mt = plantillaDe(CANALIZACION_TIPOS.find((t) => t.id === 'mt'), { diametro: '4"' });
  const spt = plantillaDe(CANALIZACION_TIPOS.find((t) => t.id === 'spt'));

  it('renderiza sin cruces guardados', () => {
    render(<CrucesView plantillas={[]} plantillasCanalizaciones={[dc, mt]} perfil={perfil} {...sinAcciones} />);
    expect(screen.getByText('Cruces')).toBeTruthy();
  });

  it('renderiza un cruce guardado entre dos líneas', () => {
    const cruce = { id: 'c1', nombre: 'DC × MT', datos: { lineaAId: dc.id, lineaBId: mt.id } };
    render(<CrucesView plantillas={[cruce]} plantillasCanalizaciones={[dc, mt]} perfil={perfil} {...sinAcciones} />);
    expect(screen.getByText('DC × MT')).toBeTruthy();
  });

  it('el dibujo del cruce aguanta una línea que ya no existe', () => {
    const { container } = render(
      <CrucePreview datos={{ lineaAId: dc.id, lineaBId: 'borrada' }} plantillasCanalizaciones={[dc]} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  /* El SPT siempre va por debajo: es la regla que más lógica de dibujo
     dispara, así que se pinta explícitamente. */
  it('dibuja el cruce con SPT', () => {
    const { container } = render(
      <CrucePreview datos={{ lineaAId: spt.id, lineaBId: mt.id }} plantillasCanalizaciones={[spt, mt]} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
