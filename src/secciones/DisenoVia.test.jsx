// @vitest-environment jsdom
/* ============================================================================
   DISEÑO DE VÍA — la pantalla, montada de verdad.
   ----------------------------------------------------------------------------
   Las cuentas ya están probadas contra los dos ejemplos del Excel en
   shared/disenoVia.test.js. Aquí se prueba lo que solo se rompe al montar:
   que los números lleguen a la pantalla, que traer datos de un proyecto no
   pise lo escrito, que guardar mande lo que dice mandar y que no pueda
   guardar quien no debe.

   Los números salen formateados en español —coma decimal—, así que las
   comparaciones van con coma.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DisenoViaView from './DisenoVia.jsx';

afterEach(cleanup);

const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };

/* El ejemplo 1 de la hoja, en las unidades que se escriben en pantalla. */
const EJEMPLO_1 = {
  nombre: 'Vía de acceso',
  ejes: [
    { tipo: 'simple', cantidad: 1, peso: 7 },
    { tipo: 'tandem', cantidad: 2, peso: 20 },
    { tipo: 'tridem', cantidad: 0, peso: 0 },
  ],
  tpd: 1 / 30, tasaPct: 1, periodo: 10, direccionalPct: 100, comercialesPct: 100,
  estaciones: [
    { nombre: 'El Descanso', dias: 39.5, peso: 60 },
    { nombre: 'Manaure', dias: 142.52, peso: 5 },
    { nombre: 'Villa Carmelita', dias: 65.2, peso: 15 },
    { nombre: 'Paris De Francia', dias: 60.44, peso: 14 },
    { nombre: 'San Angel', dias: 41.13, peso: 6 },
  ],
  calidadDrenaje: 'bueno', materialCapa1: 'afirmado', materialCapa2: 'subbase',
  confiabilidadPct: 50, errorEstandar: 0.45, servInicial: 4.2, servFinal: 2,
  cbrSubrasantePct: 7, espesorCapa1: 5, espesorCapa2: 10,
};

function proyecto(over = {}) {
  return {
    id: 'p1', nombre: 'Chinú 3',
    equipo: { civil: ['Ana'] },
    data: {
      hidraulico: {
        estaciones_pluviometricas: [
          { nombre: 'El Descanso', dias: '39.5', peso: '60' },
          { nombre: 'Manaure', dias: '142.52', peso: '5' },
        ],
      },
      geotecnia: { cbr: '12', cbr_sumergido: '7' },
    },
    ...over,
  };
}

function pintar(props = {}) {
  return render(
    <DisenoViaView
      perfil={perfil}
      projects={[proyecto()]}
      onGuardarEnProyecto={() => {}}
      onAbrirProyecto={() => {}}
      {...props}
    />,
  );
}

const elegirProyecto = (id = 'p1') => {
  const select = screen.getByText('Proyecto').parentElement.querySelector('select');
  fireEvent.change(select, { target: { value: id } });
};

describe('la pantalla', () => {
  it('abre sin proyecto y sin romperse', () => {
    pintar();
    expect(screen.getByText('Diseño de vía')).toBeTruthy();
    expect(screen.getByText('Sin proyecto — solo para tantear')).toBeTruthy();
  });

  it('trae los seis bloques del cálculo', () => {
    pintar();
    ['1 · Vehículo de diseño', '2 · Tránsito', '3 · Pluviometría y drenaje',
      '4 · Materiales y subrasante', '5 · Módulos y números estructurales', '6 · Espesores']
      .forEach((t) => expect(screen.getByText(t), t).toBeTruthy());
  });

  /* Sin estaciones no hay coeficiente de drenaje, y sin él no hay espesor.
     Eso no puede dejar "NaN" en pantalla. */
  it('con la pantalla recién abierta no muestra NaN en ninguna parte', () => {
    const { container } = pintar();
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
  });

  it('recalcula al cambiar un dato, sin apretar nada', () => {
    pintar();
    const periodo = screen.getByText('Periodo de diseño').parentElement.querySelector('input');
    fireEvent.change(periodo, { target: { value: '20' } });
    /* Veinte años de tránsito piden más que diez. */
    expect(screen.getByText('Ejes equivalentes en el periodo (W18)')).toBeTruthy();
  });
});

describe('un diseño guardado se reabre entero', () => {
  const conDiseno = () => proyecto({
    data: { ...proyecto().data, diseno_via: { entradas: EJEMPLO_1, guardado_por: 'Beto', updated_at: '2026-09-01T10:00:00.000Z' } },
  });

  it('avisa que el proyecto ya tiene uno, y de quién', () => {
    pintar({ projects: [conDiseno()] });
    elegirProyecto();
    expect(screen.getByText(/Ya tiene un diseño guardado por Beto/)).toBeTruthy();
  });

  /* La prueba de fuego: al reabrirlo tienen que salir los mismos números que
     dio el Excel para ese ejemplo. */
  it('al abrirlo reproduce los números del ejemplo de la hoja', () => {
    const { container } = pintar({ projects: [conDiseno()] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Abrirlo'));
    expect(container.textContent).toContain('7,541');   // factor camión
    expect(container.textContent).toContain('965');     // W18
    expect(container.textContent).toContain('1,082');   // coeficiente de drenaje
    expect(container.textContent).toContain('11,1');    // espesor mínimo capa 1, en cm
    expect(screen.getByText('Cumple')).toBeTruthy();
  });
});

describe('traer datos del proyecto', () => {
  it('trae las estaciones y el CBR sumergido', () => {
    pintar();
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    expect(screen.getByText(/Se trajo las estaciones y el CBR sumergido de Chinú 3/)).toBeTruthy();
    expect(screen.getByDisplayValue('El Descanso')).toBeTruthy();
  });

  /* El CBR sumergido no es el CBR de arriba: si el proyecto solo tiene ese
     otro, no se trae nada en vez de meter el número equivocado. */
  it('no confunde el CBR normal con el sumergido', () => {
    const sinSumergido = proyecto({ data: { geotecnia: { cbr: '12' } } });
    pintar({ projects: [sinSumergido] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    expect(screen.getByText(/todavía no tiene estaciones pluviométricas ni CBR sumergido/)).toBeTruthy();
  });

  /* El peso viaja en porcentaje desde el proyecto y en fracción hacia el
     cálculo. Si esa conversión se pierde, la saturación se divide por cien y
     el coeficiente de drenaje sube sin que nada se rompa. */
  it('el peso porcentual del proyecto llega bien al cálculo', () => {
    const unaSola = proyecto({
      data: { hidraulico: { estaciones_pluviometricas: [{ nombre: 'X', dias: '365', peso: '100' }] } },
    });
    const { container } = pintar({ projects: [unaSola] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    /* 365 días con peso 100% es saturación del 100%, no del 1%. */
    expect(container.textContent).toContain('100,0');
  });
});

describe('guardar en el proyecto', () => {
  it('sin proyecto elegido no se puede guardar', () => {
    pintar();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(true);
  });

  it('manda las entradas y un resumen con los espesores', () => {
    const guardados = [];
    pintar({ onGuardarEnProyecto: (id, d) => guardados.push([id, d]) });
    elegirProyecto();
    fireEvent.click(screen.getByText('Guardar en el proyecto'));
    expect(guardados).toHaveLength(1);
    const [id, diseno] = guardados[0];
    expect(id).toBe('p1');
    expect(diseno.entradas.materialCapa1).toBe('afirmado');
    expect(diseno.resumen.espesorCapa1).toBe(5);
    expect(diseno.resumen.materialCapa1).toBe('Afirmado INVÍAS 311');
    expect(diseno.guardado_por).toBe('Ana');
    expect(screen.getByText(/Diseño guardado en Chinú 3/)).toBeTruthy();
  });

  /* Diseñar lo puede hacer cualquiera; guardar dentro de un proyecto ajeno,
     no. Es la misma regla de las pestañas técnicas. */
  it('quien no está en el equipo del proyecto no puede guardar ahí', () => {
    const ajeno = proyecto({ equipo: { civil: ['Beto'] } });
    pintar({ projects: [ajeno] });
    elegirProyecto();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(true);
    expect(screen.getByText(/guardar ahí es de quien está en su equipo/)).toBeTruthy();
  });

  it('el desarrollador sí puede, aunque no esté en el equipo', () => {
    const ajeno = proyecto({ equipo: { civil: ['Beto'] } });
    pintar({ projects: [ajeno], perfil: { id: 'u9', nombre: 'Dev', roles: ['desarrollador'] } });
    elegirProyecto();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(false);
  });
});

describe('el veredicto', () => {
  const conDiseno = (entradas) => proyecto({
    data: { ...proyecto().data, diseno_via: { entradas } },
  });

  it('unos espesores que no alcanzan lo dicen, y explican qué hacer', () => {
    pintar({ projects: [conDiseno({ ...EJEMPLO_1, espesorCapa1: 1, espesorCapa2: 1 })] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Abrirlo'));
    expect(screen.getByText('No cumple')).toBeTruthy();
    expect(screen.getByText(/Sube el de\s+cualquiera de las dos capas/)).toBeTruthy();
  });

  /* Los pesos reparten el 100%: si no suman eso, el promedio ponderado no
     significa lo que dice y hay que avisarlo. */
  it('avisa cuando los pesos de las estaciones no suman 100%', () => {
    pintar({ projects: [conDiseno({ ...EJEMPLO_1, estaciones: [{ nombre: 'X', dias: 100, peso: 50 }] })] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Abrirlo'));
    expect(screen.getByText(/Los pesos no suman 100%/)).toBeTruthy();
  });
});

describe('copiar el diseño', () => {
  it('deja en el portapapeles el resumen del cálculo', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    pintar();
    fireEvent.click(screen.getByText('Copiar'));
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Diseño de vía');
    expect(writeText.mock.calls[0][0]).toContain('Espesores');
  });
});

describe('el aviso de los pesos', () => {
  /* Con la tabla en blanco no hay nada que avisar: ese aviso en un formulario
     recién abierto solo enseña a ignorarlo. */
  it('no aparece en un formulario vacío', () => {
    pintar();
    expect(screen.queryByText(/Los pesos no suman 100%/)).toBe(null);
  });

  it('aparece en cuanto hay pesos escritos que no suman', () => {
    pintar();
    const primeraFila = screen.getByText('Estación').closest('table').querySelectorAll('tbody tr')[0];
    fireEvent.change(primeraFila.querySelectorAll('input')[2], { target: { value: '50' } });
    expect(screen.getByText(/Los pesos no suman 100%/)).toBeTruthy();
  });
});
