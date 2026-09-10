/* ============================================================================
   PEGAR UNA TABLA DE EXCEL
   ----------------------------------------------------------------------------
   Lo que de verdad llega del portapapeles cuando alguien copia un rango: con
   el salto de línea que Excel deja al final, con el encabezado que se copió
   sin querer, con más filas de las que caben.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  celdasPegadas, esUnaSolaCelda, pareceEncabezado, pegarEnTabla,
  pegarDesdePortapapeles, MAXIMO_FILAS,
} from './pegarTabla.js';

const CLAVES = ['nombre', 'dias', 'peso'];
const vacia = () => ({ nombre: '', dias: '', peso: '' });
const siete = () => Array.from({ length: 7 }, vacia);

describe('lo que Excel pone en el portapapeles', () => {
  it('separa por tabulador y por salto de línea', () => {
    expect(celdasPegadas('El Descanso\t39.5\t60\nManaure\t142.52\t5')).toEqual([
      ['El Descanso', '39.5', '60'],
      ['Manaure', '142.52', '5'],
    ]);
  });

  /* Excel casi siempre deja un salto al final del rango copiado. Sin quitarlo,
     cada pegado metería una fila vacía de regalo. */
  it('ignora el salto de línea que Excel deja al final', () => {
    expect(celdasPegadas('A\t1\t2\r\n')).toEqual([['A', '1', '2']]);
    expect(celdasPegadas('A\t1\t2\n\n')).toEqual([['A', '1', '2']]);
  });

  it('entiende los saltos de Windows y los de Mac', () => {
    expect(celdasPegadas('A\t1\r\nB\t2')).toHaveLength(2);
    expect(celdasPegadas('A\t1\rB\t2')).toHaveLength(2);
  });

  it('quita los espacios que sobran en cada celda', () => {
    expect(celdasPegadas(' El Descanso \t 39.5 ')).toEqual([['El Descanso', '39.5']]);
  });

  it('con texto vacío no devuelve una fila fantasma', () => {
    expect(celdasPegadas('')).toEqual([]);
    expect(celdasPegadas(null)).toEqual([]);
    expect(celdasPegadas('\n')).toEqual([]);
  });

  /* Pegar un solo valor es lo de siempre: que el navegador lo meta en la
     celda donde está el cursor, sin que nos metamos. */
  it('reconoce cuándo es una sola celda', () => {
    expect(esUnaSolaCelda(celdasPegadas('39.5'))).toBe(true);
    expect(esUnaSolaCelda(celdasPegadas('39.5\t60'))).toBe(false);
    expect(esUnaSolaCelda(celdasPegadas('39.5\n60'))).toBe(false);
  });
});

describe('el encabezado copiado sin querer', () => {
  /* Se mira el contenido y no el título: así sigue funcionando aunque la
     columna se llame distinto, aquí o en el Excel del que copian. */
  it('una fila sin números en las columnas numéricas es encabezado', () => {
    expect(pareceEncabezado(['Estación', 'Días/año', 'Peso'], [1, 2])).toBe(true);
  });

  it('una fila con datos no lo es', () => {
    expect(pareceEncabezado(['El Descanso', '39.5', '60'], [1, 2])).toBe(false);
  });

  /* Una estación puede llamarse "3 Esquinas" sin que eso la vuelva un
     encabezado: lo que decide son las columnas de números. */
  it('un nombre con números no confunde', () => {
    expect(pareceEncabezado(['3 Esquinas', '39.5', '60'], [1, 2])).toBe(false);
    expect(pareceEncabezado(['3 Esquinas', 'Días', 'Peso'], [1, 2])).toBe(true);
  });

  it('acepta la coma decimal', () => {
    expect(pareceEncabezado(['A', '39,5', '60'], [1, 2])).toBe(false);
  });
});

describe('meter las celdas en la tabla', () => {
  it('llena desde la primera fila', () => {
    const { filas } = pegarEnTabla({
      filas: siete(),
      celdas: [['El Descanso', '39.5', '60'], ['Manaure', '142.52', '5']],
      claves: CLAVES, filaVacia: vacia,
    });
    expect(filas[0]).toEqual({ nombre: 'El Descanso', dias: '39.5', peso: '60' });
    expect(filas[1]).toEqual({ nombre: 'Manaure', dias: '142.52', peso: '5' });
    expect(filas[2]).toEqual(vacia());
    expect(filas).toHaveLength(7);
  });

  /* Pegar en la mitad de la tabla llena desde ahí, no desde arriba. */
  it('empieza donde se pegó', () => {
    const { filas } = pegarEnTabla({
      filas: siete(), celdas: [['Nueva', '10', '20']],
      filaInicial: 3, claves: CLAVES, filaVacia: vacia,
    });
    expect(filas[3].nombre).toBe('Nueva');
    expect(filas[0].nombre).toBe('');
  });

  /* Pegar una columna de días no puede borrar los nombres que ya había. */
  it('no toca las columnas que el pegado no alcanza', () => {
    const conNombres = siete().map((f, i) => ({ ...f, nombre: `Estación ${i}` }));
    const { filas } = pegarEnTabla({
      filas: conNombres, celdas: [['39.5'], ['142.52']],
      columnaInicial: 1, claves: CLAVES, filaVacia: vacia,
    });
    expect(filas[0]).toEqual({ nombre: 'Estación 0', dias: '39.5', peso: '' });
    expect(filas[1].nombre).toBe('Estación 1');
  });

  it('crece si se pegan más filas de las que hay', () => {
    const diez = Array.from({ length: 10 }, (_, i) => [`E${i}`, '10', '10']);
    const { filas, descartadas } = pegarEnTabla({
      filas: siete(), celdas: diez, claves: CLAVES, filaVacia: vacia,
    });
    expect(filas).toHaveLength(10);
    expect(descartadas).toBe(0);
  });

  /* Un pegado que se come filas en silencio es peor que no tener pegado: se
     cuentan para poder decirlo. */
  it('cuenta las que no cupieron, en vez de tragárselas', () => {
    const muchas = Array.from({ length: MAXIMO_FILAS + 5 }, (_, i) => [`E${i}`, '10', '10']);
    const { filas, descartadas } = pegarEnTabla({
      filas: siete(), celdas: muchas, claves: CLAVES, filaVacia: vacia,
    });
    expect(filas).toHaveLength(MAXIMO_FILAS);
    expect(descartadas).toBe(5);
  });

  it('las columnas de más se ignoran sin romper nada', () => {
    const { filas } = pegarEnTabla({
      filas: siete(), celdas: [['A', '1', '2', 'sobra', 'sobra']],
      claves: CLAVES, filaVacia: vacia,
    });
    expect(filas[0]).toEqual({ nombre: 'A', dias: '1', peso: '2' });
  });

  it('aguanta una tabla que llega vacía', () => {
    const { filas } = pegarEnTabla({
      filas: null, celdas: [['A', '1', '2']], claves: CLAVES, filaVacia: vacia,
    });
    expect(filas[0].nombre).toBe('A');
  });
});

describe('el pegado de punta a punta', () => {
  const pegar = (texto, extra = {}) => pegarDesdePortapapeles({
    texto, filas: siete(), claves: CLAVES, filaVacia: vacia,
    columnasNumericas: [1, 2], ...extra,
  });

  it('pega un rango completo de Excel, con encabezado y todo', () => {
    const r = pegar('Estación\tDías/año\tPeso\nEl Descanso\t39.5\t60\nManaure\t142.52\t5\r\n');
    expect(r.encabezadoQuitado).toBe(true);
    expect(r.pegadas).toBe(2);
    expect(r.filas[0]).toEqual({ nombre: 'El Descanso', dias: '39.5', peso: '60' });
    expect(r.filas[1].nombre).toBe('Manaure');
  });

  it('sin encabezado también', () => {
    const r = pegar('El Descanso\t39.5\t60\nManaure\t142.52\t5');
    expect(r.encabezadoQuitado).toBe(false);
    expect(r.filas[0].nombre).toBe('El Descanso');
  });

  /* Pegar una sola celda es lo de siempre: no nos metemos. */
  it('deja pasar el pegado de un solo valor', () => {
    expect(pegar('39.5')).toBe(null);
    expect(pegar('')).toBe(null);
  });

  /* Si alguien pega dos columnas sueltas a media tabla, la primera fila son
     datos, no títulos. */
  it('no descarta la primera fila si el pegado no empieza en la primera columna', () => {
    const r = pegar('39.5\t60\n142.52\t5', { columnaInicial: 1 });
    expect(r.encabezadoQuitado).toBe(false);
    expect(r.filas[0].dias).toBe('39.5');
    expect(r.filas[0].peso).toBe('60');
  });

  /* Pegar SOLO el encabezado no puede dejar la tabla llena de títulos. */
  it('un pegado que es solo encabezado no hace nada', () => {
    expect(pegar('Estación\tDías/año\tPeso')).toBe(null);
  });
});
