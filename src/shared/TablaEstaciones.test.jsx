// @vitest-environment jsdom
/* ============================================================================
   TABLA DE ESTACIONES — pegar un rango de Excel, de verdad.
   ----------------------------------------------------------------------------
   La traducción del texto del portapapeles ya está probada aparte
   (pegarTabla.test.js). Aquí se prueba lo que solo se rompe al montar: que el
   pegado esté conectado a la tabla, que no se coma el pegado normal de una
   sola celda, y que lo que no cupo se diga en vez de perderse en silencio.
   ============================================================================ */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TablaEstaciones, filaDeEstacionVacia } from './TablaEstaciones.jsx';
import { MAXIMO_FILAS } from './pegarTabla.js';

afterEach(cleanup);

const siete = () => Array.from({ length: 7 }, filaDeEstacionVacia);

function pintar(filas = siete()) {
  const cambios = [];
  const vista = render(<TablaEstaciones filas={filas} onChange={(f) => cambios.push(f)} />);
  return { ...vista, cambios };
}

/* Un pegado como el que hace el navegador. Devuelve si el evento quedó
   cancelado: es como se sabe que la tabla se quedó con el pegado en vez de
   dejar que el navegador metiera el texto en una celda. */
function pegarEn(input, texto) {
  const noCancelado = fireEvent.paste(input, { clipboardData: { getData: () => texto } });
  return { cancelado: noCancelado === false };
}

const celdas = () => screen.getByText('Nombre de la estación').closest('table').querySelectorAll('tbody input');

describe('pegar desde Excel', () => {
  it('un rango completo llena la tabla de un golpe', () => {
    const { cambios } = pintar();
    pegarEn(celdas()[0], 'El Descanso\t39.5\t60\nManaure\t142.52\t5\r\n');
    expect(cambios).toHaveLength(1);
    expect(cambios[0][0]).toEqual({ nombre: 'El Descanso', dias: '39.5', peso: '60' });
    expect(cambios[0][1]).toEqual({ nombre: 'Manaure', dias: '142.52', peso: '5' });
    /* Las filas que el pegado no tocó siguen vacías, no se borran ni se
       llenan de nada. */
    expect(cambios[0][2]).toEqual(filaDeEstacionVacia());
  });

  it('se queda con el pegado en vez de dejar que el navegador lo meta en una celda', () => {
    pintar();
    expect(pegarEn(celdas()[0], 'A\t1\t2\nB\t3\t4').cancelado).toBe(true);
  });

  /* Pegar un solo valor es lo de siempre: ahí no nos metemos, o se rompería
     el copiar y pegar de toda la vida dentro de una celda. */
  it('un solo valor se deja pasar', () => {
    const { cambios } = pintar();
    expect(pegarEn(celdas()[1], '39.5').cancelado).toBe(false);
    expect(cambios).toHaveLength(0);
  });

  it('descarta la fila de títulos si se copió sin querer, y lo dice', () => {
    const { cambios } = pintar();
    pegarEn(celdas()[0], 'Estación\tDías\tPeso\nEl Descanso\t39.5\t60');
    expect(cambios[0][0].nombre).toBe('El Descanso');
    expect(screen.getByText(/sin la fila de títulos/)).toBeTruthy();
  });

  /* Pegar en la mitad de la tabla llena desde ahí. */
  it('empieza en la celda donde se pegó', () => {
    const { cambios } = pintar();
    pegarEn(celdas()[6], 'Nueva\t10\t20\nOtra\t11\t21');  // fila 2, primera columna
    expect(cambios[0][0].nombre).toBe('');
    expect(cambios[0][2].nombre).toBe('Nueva');
    expect(cambios[0][3].nombre).toBe('Otra');
  });

  /* Pegar solo la columna de días no puede borrar los nombres. */
  it('pegar una columna suelta respeta lo que ya estaba', () => {
    const conNombres = siete().map((f, i) => ({ ...f, nombre: `Estación ${i}` }));
    const { cambios } = pintar(conNombres);
    pegarEn(celdas()[1], '39.5\n142.52');   // segunda columna, primera fila
    expect(cambios[0][0]).toEqual({ nombre: 'Estación 0', dias: '39.5', peso: '' });
    expect(cambios[0][1].nombre).toBe('Estación 1');
  });

  it('la tabla crece si se pegan más estaciones de las que había', () => {
    const { cambios } = pintar();
    const diez = Array.from({ length: 10 }, (_, i) => `E${i}\t10\t10`).join('\n');
    pegarEn(celdas()[0], diez);
    expect(cambios[0]).toHaveLength(10);
    expect(screen.getByText(/Se pegaron 10 estaciones/)).toBeTruthy();
  });

  /* Un pegado que se come filas en silencio es peor que no tener pegado. */
  it('avisa cuántas no cupieron', () => {
    const { cambios } = pintar();
    const muchas = Array.from({ length: MAXIMO_FILAS + 4 }, (_, i) => `E${i}\t10\t10`).join('\n');
    pegarEn(celdas()[0], muchas);
    expect(cambios[0]).toHaveLength(MAXIMO_FILAS);
    expect(screen.getByText(/4 no cupieron/)).toBeTruthy();
  });
});

describe('escribir a mano sigue funcionando', () => {
  it('cambiar una celda avisa solo esa fila', () => {
    const { cambios } = pintar();
    fireEvent.change(celdas()[0], { target: { value: 'A mano' } });
    expect(cambios[0][0].nombre).toBe('A mano');
    expect(cambios[0][1]).toEqual(filaDeEstacionVacia());
  });

  it('explica que se puede pegar, para que alguien lo descubra', () => {
    pintar();
    expect(screen.getByText(/copiar el rango en Excel y pegarlo aquí/)).toBeTruthy();
  });
});
