/* ============================================================================
   SUBCATEGORÍA "VÍA" — las cantidades de obra que salen del diseño.
   ----------------------------------------------------------------------------
   Los espesores llegan de la sección Diseño de vía y aquí se vuelven
   volúmenes. Son multiplicaciones sencillas, pero con dos cosas que sí se
   pueden equivocar: en qué unidad va cada cosa —todo en metros, como el
   plano— y qué mostrar cuando falta un dato.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { CAMPOS_VIA } from './dominio.jsx';

const campo = (key) => CAMPOS_VIA.find((c) => c.key === key);
const calcular = (key, datos) => campo(key).formula(datos);

/* Una vía de 100 m por 4 m, con 0.05 m de rodadura sobre 0.10 m de subbase, y
   20 m² de sobreanchos. */
const VIA = {
  via_longitud: '100',
  via_ancho: '4',
  via_espesor_capa1: '0.05',
  via_espesor_capa2: '0.10',
  via_area_sobreanchos: '20',
};

describe('los campos que se piden', () => {
  it('están todos, en el orden acordado', () => {
    expect(CAMPOS_VIA.map((c) => c.key)).toEqual([
      'via_longitud', 'via_ancho',
      'via_material_capa1', 'via_espesor_capa1',
      'via_material_capa2', 'via_espesor_capa2',
      'via_espesor_total',
      'via_volumen_calzada_capa1', 'via_volumen_calzada_capa2',
      'via_area_sobreanchos',
      'via_volumen_sobreanchos_capa1', 'via_volumen_sobreanchos_capa2',
      'via_volumen_total_capa1', 'via_volumen_total_capa2',
      'via_volumen_corte_banca', 'via_volumen_lleno_banca',
      'via_perfil',
    ]);
  });

  /* Los volúmenes se calculan solos; lo demás se escribe. Si alguno de estos
     dejara de ser calculado, quedaría un campo que alguien puede contradecir
     a mano. */
  it('los volúmenes y el espesor total son calculados, no escritos', () => {
    const calculados = CAMPOS_VIA.filter((c) => c.type === 'computed').map((c) => c.key);
    expect(calculados).toEqual([
      'via_espesor_total',
      'via_volumen_calzada_capa1', 'via_volumen_calzada_capa2',
      'via_volumen_sobreanchos_capa1', 'via_volumen_sobreanchos_capa2',
      'via_volumen_total_capa1', 'via_volumen_total_capa2',
    ]);
  });
});

describe('los volúmenes', () => {
  it('el espesor total suma las dos capas', () => {
    expect(calcular('via_espesor_total', VIA)).toBe('0,15');
  });

  it('el de la calzada es espesor × ancho × longitud', () => {
    expect(calcular('via_volumen_calzada_capa1', VIA)).toBe('20,00');   // 0.05 × 4 × 100
    expect(calcular('via_volumen_calzada_capa2', VIA)).toBe('40,00');   // 0.10 × 4 × 100
  });

  it('el de los sobreanchos es área × espesor', () => {
    expect(calcular('via_volumen_sobreanchos_capa1', VIA)).toBe('1,00');  // 20 × 0.05
    expect(calcular('via_volumen_sobreanchos_capa2', VIA)).toBe('2,00');  // 20 × 0.10
  });

  it('el total suma calzada y sobreanchos', () => {
    expect(calcular('via_volumen_total_capa1', VIA)).toBe('21,00');
    expect(calcular('via_volumen_total_capa2', VIA)).toBe('42,00');
  });

  it('lee la coma decimal, que es como se escribe aquí', () => {
    expect(calcular('via_volumen_calzada_capa1', { ...VIA, via_espesor_capa1: '0,05' })).toBe('20,00');
  });
});

describe('cuando falta un dato', () => {
  /* Un 0,00 parece un resultado; lo que hay es un dato sin llenar. */
  it('no muestra cero: muestra que falta', () => {
    expect(calcular('via_volumen_calzada_capa1', {})).toBe('—');
    expect(calcular('via_volumen_calzada_capa1', { ...VIA, via_ancho: '' })).toBe('—');
    expect(calcular('via_volumen_sobreanchos_capa1', { ...VIA, via_area_sobreanchos: '' })).toBe('—');
    expect(calcular('via_espesor_total', {})).toBe('—');
  });

  /* Pero una vía sin sobreanchos sí tiene volumen total: el de la calzada. */
  it('una vía sin sobreanchos no deja el total en blanco', () => {
    const sinSobreanchos = { ...VIA, via_area_sobreanchos: '' };
    expect(calcular('via_volumen_total_capa1', sinSobreanchos)).toBe('20,00');
    expect(calcular('via_volumen_total_capa2', sinSobreanchos)).toBe('40,00');
  });

  it('con una sola capa el espesor total es el de esa capa', () => {
    expect(calcular('via_espesor_total', { via_espesor_capa1: '0.05' })).toBe('0,05');
  });

  it('un texto que no es número no revienta', () => {
    expect(calcular('via_volumen_calzada_capa1', { ...VIA, via_longitud: 'no sé' })).toBe('—');
  });
});
