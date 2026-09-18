/* ============================================================================
   CÓDIGO DEL PROYECTO — de qué está hecho y cuándo dos proyectos son el mismo.
   ----------------------------------------------------------------------------
   El código (COL + 3 letras del departamento + T + terreno + P + predio) es la
   identidad documental del proyecto: se imprime en cada plano. Equivocarlo o
   confundir dos proyectos distintos se propaga a todos los entregables.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { buildProjectCode, proyectoConMismoCodigo, DEPARTAMENTO_ABREVIATURA } from './dominio.jsx';

const general = (departamento, num, predio) => ({
  pais: 'Colombia', departamento, numero_minigranja: num, numero_predio: predio,
});
const proyecto = (nombre, departamento, num, predio) => ({
  id: nombre, nombre, data: { general: general(departamento, num, predio) },
});

describe('cómo se arma el código', () => {
  it('sale del departamento elegido, no del nombre escrito', () => {
    expect(buildProjectCode(general('Bolívar', '5', '1'))).toBe('COLBOLT5P1');
    expect(buildProjectCode(general('Santander', '5', '1'))).toBe('COLSANT5P1');
    expect(buildProjectCode(general('Boyacá', '147', '1'))).toBe('COLBOYT147P1');
  });

  /* Dos departamentos que empiezan igual no pueden colapsar en la misma
     abreviatura: Santander y Norte de Santander llevan código distinto. */
  it('no hay dos departamentos con la misma abreviatura', () => {
    const abrevs = Object.values(DEPARTAMENTO_ABREVIATURA);
    expect(new Set(abrevs).size).toBe(abrevs.length);
    expect(DEPARTAMENTO_ABREVIATURA['Norte de Santander']).not.toBe(DEPARTAMENTO_ABREVIATURA['Santander']);
  });

  it('con un dato de menos no inventa código', () => {
    expect(buildProjectCode(general('', '5', '1'))).toBe('');
    expect(buildProjectCode(general('Bolívar', '', '1'))).toBe('');
    expect(buildProjectCode(general('Bolívar', '5', ''))).toBe('');
    expect(buildProjectCode(general('Bolivia', '5', '1'))).toBe('');
    expect(buildProjectCode(null)).toBe('');
  });
});

describe('cuándo ya existe el proyecto', () => {
  const existentes = [
    proyecto('Girón Sur 1', 'Santander', '5', '1'),
    proyecto('El Molino Occidente', 'La Guajira', '17', '2'),
  ];

  it('el mismo código es el mismo proyecto', () => {
    expect(proyectoConMismoCodigo(existentes, general('Santander', '5', '1'))?.nombre).toBe('Girón Sur 1');
  });

  /* El caso que dio el falso positivo: Mompox (Bolívar) terreno 5 predio 1
     no es Girón Sur (Santander) terreno 5 predio 1. Los números coinciden,
     el código no —COLBOLT5P1 contra COLSANT5P1—, y son proyectos distintos. */
  it('los mismos números en otro departamento no', () => {
    expect(proyectoConMismoCodigo(existentes, general('Bolívar', '5', '1'))).toBe(null);
  });

  it('cambiar solo el predio tampoco choca', () => {
    expect(proyectoConMismoCodigo(existentes, general('Santander', '5', '2'))).toBe(null);
  });

  /* Sin código completo no hay con qué comparar: mejor dejar crear que
     bloquear por una coincidencia que nadie puede verificar. */
  it('sin código completo no se afirma nada', () => {
    expect(proyectoConMismoCodigo(existentes, general('', '5', '1'))).toBe(null);
    expect(proyectoConMismoCodigo(existentes, general('Santander', '5', ''))).toBe(null);
  });

  /* Los proyectos viejos sin departamento tienen código vacío: no pueden
     empatar entre ellos ni bloquear a uno nuevo. */
  it('los proyectos sin código no empatan con nada', () => {
    const viejos = [{ id: 'v', nombre: 'Viejo', data: { general: {} } }, { id: 'v2', nombre: 'Otro', data: {} }];
    expect(proyectoConMismoCodigo(viejos, general('Bolívar', '5', '1'))).toBe(null);
  });

  it('sin lista de proyectos no revienta', () => {
    expect(proyectoConMismoCodigo(null, general('Bolívar', '5', '1'))).toBe(null);
  });
});
