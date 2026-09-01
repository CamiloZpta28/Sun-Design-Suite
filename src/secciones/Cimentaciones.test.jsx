// @vitest-environment jsdom
/* ============================================================================
   CIMENTACIONES — render real de los 9 tipos.
   ----------------------------------------------------------------------------
   Esta es la sección con más historia de pantallas en blanco: casi siempre
   por abrir un formulario con una plantilla vieja a la que le faltan campos
   que se agregaron después (el código leía datos.viga.barras.ganchos sobre un
   objeto que no existía). Por eso cada tipo se renderiza en los tres
   escenarios que de verdad ocurren:

     1. crear una plantilla nueva (sin datos),
     2. editar una plantilla vieja incompleta (datos: {}),
     3. editar una plantilla completa (la que deja el propio formulario).

   Y además se pintan todas sus vistas técnicas, que es donde viven los
   cálculos de geometría.
   ============================================================================ */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CimentacionesView, { CIMENTACION_COMPONENTES, PreviewPlantilla } from './Cimentaciones.jsx';
import { CIMENTACION_TIPOS, CIMENTACION_RESUMENES, aplicarParametrosIngenieria, BARRA_ACERO } from './cimentacionesDatos.js';

afterEach(cleanup);

const sinAcciones = { onAdd: () => {}, onUpdate: () => {}, onDelete: () => {}, onAddMalla: () => {}, onGuardarParametros: () => {} };
const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };
const desarrollador = { id: 'u2', nombre: 'Dev', roles: ['desarrollador'] };

/* Plantilla "de verdad" de cada tipo: se arma con medidas plausibles para que
   los cálculos y los dibujos tengan con qué trabajar. */
const DATOS_COMPLETOS = {
  postes_mt: { diametro: '0.30', desplante: '0.90', sobresaliente: '0.05', espesor_solado: '0.05', resistencia: '21 MPa' },
  luminarias: { ancho: '0.40', profundo: '0.40', desplante: '0.80', sobresaliente: '0.10', espesor_solado: '0.05', resistencia: '21 MPa' },
  camaras: { ancho: '0.40', profundo: '0.40', desplante: '0.80', sobresaliente: '0.05', espesor_solado: '0.05', resistencia: '21 MPa' },
  cerramiento_postes: { diametro: '0.30', desplante: '0.90', sobresaliente: '0', espesor_solado: '0.05', resistencia: '21 MPa' },
  cerramiento_paso_fauna: { ancho: '0.40', profundo: '0.60', alto: '0.50', espesor_solado: '0.05', resistencia: '21 MPa' },
  inversores: {
    resistencia: '21 MPa',
    pedestal: {
      ancho: '0.40', profundo: '0.40', desplante: '0.80', sobresaliente: '0.20', separacion: '2.00',
      espesor_solado: '0.05', barras: { cantidad: '4', calibre: '#4', ganchos: '1' }, estribos: { calibre: '#3', separacion: '0.15' },
    },
    losa: { ancho: '1.40', largo: '1.55', espesor: '0.15', malla: 'D84' },
  },
  cerramiento_porton: {
    resistencia: '21 MPa', desplante: '1.00', separacion_zapatas: '4.00', espesor_solado: '0.05',
    zapata: {
      ancho: '1.00', largo: '1.00', espesor: '0.30',
      parrilla_longitudinal: { calibre: '#4', separacion: '0.15', recubrimiento: '0.075' },
      parrilla_transversal: { calibre: '#4', separacion: '0.15', recubrimiento: '0.075' },
    },
    viga: { ancho: '0.30', alto: '0.40', barras: { cantidad: '8', calibre: '#4', ganchos: '1' }, estribos: { calibre: '#3', separacion: '0.15' } },
    pedestal: { ancho: '0.30', profundo: '0.30', empotramiento: '0.20', barras: { cantidad: '8', calibre: '#4', ganchos: '1' }, estribos: { calibre: '#3', separacion: '0.15' } },
  },
  shelter_ct: {
    resistencia: '21 MPa', ancho: '3.00', largo: '4.00', desplante: '1.00', sobresaliente: '0.20', espesor_solado: '0.05',
    pedestal: { ancho: '0.40', profundo: '0.40', barras: { cantidad: '8', calibre: '#4', ganchos: '1' }, estribos: { calibre: '#3', separacion: '0.15' } },
    viga: { ancho: '0.30', alto: '0.40', barras: { cantidad: '4', calibre: '#4', ganchos: '1' }, estribos: { calibre: '#3', separacion: '0.15' } },
  },
  shelter_trampa_aceite: {
    resistencia: '21 MPa', ancho: '1.50', profundo: '1.00', alto: '0.80', espesor_pared: '0.15',
    espesor_losa: '0.15', espesor_solado: '0.05',
    anillos: { calibre: '#3', separacion: '0.20' },
    u: { calibre: '#3', separacion: '0.20' },
  },
};

describe('CimentacionesView', () => {
  it('renderiza la lista sin plantillas', () => {
    render(<CimentacionesView plantillas={[]} mallas={[]} perfil={perfil} parametrosIngenieria={{}} {...sinAcciones} />);
    expect(screen.getByText('Cimentaciones')).toBeTruthy();
  });

  it('renderiza con una plantilla de cada tipo', () => {
    const plantillas = CIMENTACION_TIPOS.map((t) => ({
      id: `p-${t.id}`, tipo: t.id, nombre: `Tipo ${t.label}`, datos: DATOS_COMPLETOS[t.id] || {},
    }));
    render(<CimentacionesView plantillas={plantillas} mallas={['D84']} perfil={perfil} parametrosIngenieria={{}} {...sinAcciones} />);
    expect(screen.getByText('Cimentaciones')).toBeTruthy();
  });

  /* La "puerta trasera" de parámetros de ingeniería solo la ve el rol
     Desarrollador; se renderiza aparte porque es otra rama del componente. */
  it('renderiza para un Desarrollador (con la puerta trasera de parámetros)', () => {
    render(
      <CimentacionesView
        plantillas={[]}
        mallas={[]}
        perfil={desarrollador}
        parametrosIngenieria={{ recubrimiento: 0.075, barras: BARRA_ACERO, traslapos: {} }}
        {...sinAcciones}
      />,
    );
    expect(screen.getByText('Cimentaciones')).toBeTruthy();
  });
});

describe('formularios de cada tipo', () => {
  CIMENTACION_TIPOS.forEach((tipo) => {
    const { Form } = CIMENTACION_COMPONENTES[tipo.id];

    it(`${tipo.id}: crear una plantilla nueva`, () => {
      const { container } = render(<Form plantilla={null} onCancel={() => {}} onSave={() => {}} mallas={['D84']} onAddMalla={() => {}} />);
      expect(container.querySelector('input')).toBeTruthy();
    });

    /* El escenario que tumbaba la app: una plantilla guardada antes de que
       existieran algunos campos. */
    it(`${tipo.id}: editar una plantilla vieja e incompleta`, () => {
      const plantilla = { id: 'vieja', tipo: tipo.id, nombre: 'De antes', datos: {} };
      const { container } = render(<Form plantilla={plantilla} onCancel={() => {}} onSave={() => {}} mallas={[]} onAddMalla={() => {}} />);
      expect(container.querySelector('input')).toBeTruthy();
    });

    it(`${tipo.id}: editar una plantilla completa`, () => {
      const plantilla = { id: 'c', tipo: tipo.id, nombre: 'Completa', datos: DATOS_COMPLETOS[tipo.id] || {} };
      const { container } = render(<Form plantilla={plantilla} onCancel={() => {}} onSave={() => {}} mallas={['D84']} onAddMalla={() => {}} />);
      expect(container.querySelector('input')).toBeTruthy();
    });
  });
});

describe('dibujos técnicos', () => {
  CIMENTACION_TIPOS.forEach((tipo) => {
    it(`${tipo.id}: pinta su previsualización, con datos y sin ellos`, () => {
      const conDatos = render(<PreviewPlantilla tipo={tipo.id} datos={DATOS_COMPLETOS[tipo.id] || {}} />);
      expect(conDatos.container.querySelector('svg'), tipo.id).toBeTruthy();
      cleanup();
      const vacio = render(<PreviewPlantilla tipo={tipo.id} datos={{}} />);
      expect(vacio.container.querySelector('svg'), `${tipo.id} vacío`).toBeTruthy();
      cleanup();
    });
  });

  it('un tipo desconocido no revienta', () => {
    const { container } = render(<PreviewPlantilla tipo="no_existe" datos={{}} />);
    expect(container.textContent).toBe('');
  });
});

describe('resúmenes (los que se ven dentro de un proyecto)', () => {
  it('cada tipo tiene resumen y devuelve líneas de texto', () => {
    CIMENTACION_TIPOS.forEach((tipo) => {
      const resumen = CIMENTACION_RESUMENES[tipo.id];
      expect(resumen, tipo.id).toBeTruthy();
      const lineas = resumen(DATOS_COMPLETOS[tipo.id] || {});
      expect(Array.isArray(lineas), tipo.id).toBe(true);
      expect(lineas.every((l) => typeof l === 'string'), tipo.id).toBe(true);
    });
  });

  it('el resumen aguanta datos vacíos', () => {
    CIMENTACION_TIPOS.forEach((tipo) => {
      expect(() => CIMENTACION_RESUMENES[tipo.id]({}), tipo.id).not.toThrow();
    });
  });
});

describe('parámetros de ingeniería', () => {
  /* La "puerta trasera" sobreescribe el CONTENIDO de las constantes de acero;
     como ahora viven en otro archivo, se comprueba que el cambio siga
     llegando a quien las usa. */
  it('aplicarParametrosIngenieria cambia la tabla de barras en su sitio', () => {
    const original = { ...BARRA_ACERO['#3'] };
    aplicarParametrosIngenieria({ barras: { ...BARRA_ACERO, '#3': { gancho: 0.99, peso: 9.9 } } });
    expect(BARRA_ACERO['#3'].gancho).toBe(0.99);
    aplicarParametrosIngenieria({ barras: { ...BARRA_ACERO, '#3': original } });
    expect(BARRA_ACERO['#3'].gancho).toBe(original.gancho);
  });
});
