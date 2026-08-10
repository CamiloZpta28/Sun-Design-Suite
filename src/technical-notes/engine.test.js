import { describe, it, expect } from 'vitest';
import { resolveTechnicalNotes, extractPlaceholderIds, RESOLUTION_STATUS } from './engine.js';
import { isBlank } from './formatters.js';
import { CERRAMIENTO_PERIMETRAL_RESOLVERS } from './resolvers.js';
import { CERRAMIENTO_PERIMETRAL_TEMPLATE } from './templates/cerramientoPerimetral.js';

/* ---------------------------------------------------------------------------
   Spec "de juguete", independiente de cerramiento, para probar el
   comportamiento GENÉRICO del motor (sustitución, reutilización, faltantes,
   desconocidos, completitud) sin depender del catálogo real.
   ------------------------------------------------------------------------ */
function fakeResolver(label, pick) {
  return {
    label,
    fieldRef: null,
    resolve(data) {
      const raw = pick(data);
      if (isBlank(raw)) return { status: RESOLUTION_STATUS.FALTANTE, value: null };
      return { status: RESOLUTION_STATUS.RESUELTO, value: String(raw) };
    },
  };
}

const FAKE_SPEC = {
  id: 'FAKE_SPEC',
  label: 'Spec de prueba',
  resolvers: {
    A: fakeResolver('Parámetro A', (d) => d?.a),
    B: fakeResolver('Parámetro B', (d) => d?.b),
    ZERO: fakeResolver('Parámetro cero', (d) => d?.zero),
    FLAG: {
      label: 'Bandera booleana',
      fieldRef: null,
      resolve(d) {
        if (isBlank(d?.flag)) return { status: RESOLUTION_STATUS.FALTANTE, value: null };
        return { status: RESOLUTION_STATUS.RESUELTO, value: d.flag ? 'Sí' : 'No' };
      },
    },
  },
  template: {
    secciones: [
      {
        titulo: 'Sección única',
        notas: [
          { numero: 1, texto: 'Valor de A: {{A}}.' },
          { numero: 2, texto: 'A otra vez: {{A}}. B: {{B}}.' },
          { numero: 3, texto: 'Cero: {{ZERO}}. Bandera: {{FLAG}}.' },
          { numero: 4, texto: 'Desconocido: {{NO_EXISTE}}.' },
        ],
      },
    ],
  },
};

function resolveFake(data) {
  return resolveTechnicalNotes({ data }, FAKE_SPEC);
}

describe('extractPlaceholderIds', () => {
  it('encuentra todos los IDs únicos en orden de aparición', () => {
    expect(extractPlaceholderIds('{{A}} y {{B}} y {{A}} otra vez')).toEqual(['A', 'B']);
  });
});

describe('motor de notas técnicas — comportamiento genérico', () => {
  it('sustitución simple: reemplaza un placeholder por su valor resuelto', () => {
    const result = resolveFake({ a: 'Ø 2”', b: '1.50 mm', zero: 1, flag: true });
    const nota1 = result.secciones[0].notas[0];
    expect(nota1.textoResuelto).toBe('Valor de A: Ø 2”.');
    expect(nota1.completa).toBe(true);
  });

  it('placeholder reutilizado: la misma ID produce siempre el mismo valor', () => {
    const result = resolveFake({ a: 'Ø 2”', b: '1.50 mm', zero: 1, flag: true });
    const nota1 = result.secciones[0].notas[0];
    const nota2 = result.secciones[0].notas[1];
    expect(nota1.textoResuelto).toContain('Ø 2”');
    expect(nota2.textoResuelto).toBe('A otra vez: Ø 2”. B: 1.50 mm.');
  });

  it('parámetro faltante: no deja {{...}} crudo, muestra una marca legible con la etiqueta', () => {
    const result = resolveFake({ b: '1.50 mm', zero: 1, flag: true }); // falta "a"
    const nota1 = result.secciones[0].notas[0];
    expect(nota1.textoResuelto).not.toContain('{{');
    expect(nota1.textoResuelto).not.toContain('}}');
    expect(nota1.textoResuelto).toContain('Falta definir');
    expect(nota1.textoResuelto).toContain('Parámetro A');
    expect(nota1.completa).toBe(false);
  });

  it('valor cero (número 0) se resuelve como válido, no como faltante', () => {
    const result = resolveFake({ a: 'x', b: 'y', zero: 0, flag: true });
    const param = result.parametros.find((p) => p.id === 'ZERO');
    expect(param.status).toBe(RESOLUTION_STATUS.RESUELTO);
    expect(param.value).toBe('0');
    expect(result.secciones[0].notas[2].textoResuelto).toContain('Cero: 0.');
  });

  it('boolean false se resuelve como válido, no como faltante', () => {
    const result = resolveFake({ a: 'x', b: 'y', zero: 5, flag: false });
    const param = result.parametros.find((p) => p.id === 'FLAG');
    expect(param.status).toBe(RESOLUTION_STATUS.RESUELTO);
    expect(param.value).toBe('No');
    expect(result.secciones[0].notas[2].textoResuelto).toContain('Bandera: No.');
  });

  it('placeholder desconocido: se detecta y se reporta como DESCONOCIDO, no como FALTANTE', () => {
    const result = resolveFake({ a: 'x', b: 'y', zero: 1, flag: true });
    const param = result.parametros.find((p) => p.id === 'NO_EXISTE');
    expect(param.status).toBe(RESOLUTION_STATUS.DESCONOCIDO);
    expect(result.secciones[0].notas[3].textoResuelto).toContain('Falta definir: NO_EXISTE');
  });

  it('completitud: cuenta placeholders únicos requeridos, no ocurrencias', () => {
    // 5 IDs únicos requeridos por la plantilla de juguete: A, B, ZERO, FLAG, NO_EXISTE
    const completo = resolveFake({ a: 'x', b: 'y', zero: 0, flag: false });
    expect(completo.completitud.requeridos).toBe(5);
    // NO_EXISTE nunca resuelve (no tiene resolver) -> 4 de 5 completos
    expect(completo.completitud.completos).toBe(4);
    expect(completo.completitud.porcentaje).toBe(80);

    const vacio = resolveFake({});
    expect(vacio.completitud.requeridos).toBe(5);
    expect(vacio.completitud.completos).toBe(0);
    expect(vacio.completitud.porcentaje).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
   Pruebas contra el catálogo REAL de cerramiento perimetral: formateo de
   unidades, reutilización de campos existentes de SCHEMA, y actualización
   inmediata al cambiar un dato del proyecto.
   ------------------------------------------------------------------------ */
function buildCerramientoProject(overrides = {}) {
  return {
    id: 'proj-cerramiento-test',
    data: {
      geotecnia: {
        capacidad_admisible_cerramiento: '13.00 kN (1.30 ton)',
        ...(overrides.geotecnia || {}),
      },
      estructural: {
        dim_ciment_cerramiento: { diametro: '0.30', desplante: '0.90', resistencia: '21 MPa' },
        tipo_galvanizado: 'Z450',
        concreto_solado_fc: '14 MPa',
        concreto_solado_espesor: '5 cm',
        acero_refuerzo_norma: 'ASTM A706',
        cerramiento_poste_diametro: 'Ø 2”',
        cerramiento_poste_espesor: '1.50 mm',
        cerramiento_poste_anclaje: '0.50',
        cerramiento_poste_afloramiento: '2.50',
        cerramiento_poste_separacion: '2.50 m',
        cerramiento_tubo_secundario_diametro: 'Ø 1 1/2”',
        cerramiento_tubo_secundario_espesor: '1.90 mm',
        cerramiento_diagonales_separacion: '12.50 m',
        cerramiento_vientos_separacion: '25 m',
        cerramiento_bandit_calibre: 'calibre 1/2”',
        cerramiento_acero_norma: 'ASTM A1011',
        cerramiento_acero_fy: '172 MPa',
        cerramiento_acero_fu: '303 MPa',
        ambiente_corrosion_clase: 'C2',
        galvanizado_perdida_zinc_proyectada: '31.52 μm',
        ...(overrides.estructural || {}),
      },
    },
  };
}

const CERRAMIENTO_SPEC = {
  id: 'CERRAMIENTO_PERIMETRAL',
  label: 'Cerramiento perimetral',
  template: CERRAMIENTO_PERIMETRAL_TEMPLATE,
  resolvers: CERRAMIENTO_PERIMETRAL_RESOLVERS,
};

describe('motor de notas técnicas — cerramiento perimetral (catálogo real)', () => {
  it('formateo: mantiene correctamente las unidades del ejemplo de aceptación (poste típico)', () => {
    const result = resolveTechnicalNotes(buildCerramientoProject(), CERRAMIENTO_SPEC);
    const nota13 = result.secciones[2].notas.find((n) => n.numero === 13);
    expect(nota13.textoResuelto).toBe(
      'El poste típico (PT) será en tubería galvanizada de diámetro nominal Ø 2”, espesor 1.50 mm, figurado con tubos de 3.00 m de longitud total, incluyendo 50 cm de anclaje y 2.50 m de afloramiento. Los postes estarán distribuidos cada 2.50 m.'
    );
    expect(nota13.completa).toBe(true);
  });

  it('reutiliza dim_ciment_cerramiento y tipo_galvanizado (campos ya existentes) sin pedir un input nuevo', () => {
    const result = resolveTechnicalNotes(buildCerramientoProject(), CERRAMIENTO_SPEC);
    const nota4 = result.secciones[0].notas.find((n) => n.numero === 4);
    expect(nota4.textoResuelto).toContain('30 cm de diámetro');
    expect(nota4.textoResuelto).toContain('90 cm de desplante');
    expect(nota4.textoResuelto).toContain('más 5 cm de solado');
    const nota20 = result.secciones[2].notas.find((n) => n.numero === 20);
    expect(nota20.textoResuelto).toContain('galvanizado Z450');
  });

  it('cambio de valor de proyecto produce inmediatamente una nota diferente', () => {
    const antes = resolveTechnicalNotes(buildCerramientoProject(), CERRAMIENTO_SPEC);
    const despues = resolveTechnicalNotes(
      buildCerramientoProject({ estructural: { cerramiento_poste_espesor: '1.90 mm' } }),
      CERRAMIENTO_SPEC
    );
    const notaAntes = antes.secciones[2].notas.find((n) => n.numero === 13).textoResuelto;
    const notaDespues = despues.secciones[2].notas.find((n) => n.numero === 13).textoResuelto;
    expect(notaAntes).toContain('espesor 1.50 mm');
    expect(notaDespues).toContain('espesor 1.90 mm');
    expect(notaAntes).not.toBe(notaDespues);
  });

  it('proyecto con campos faltantes: pendientes reales, sin placeholders crudos y completitud < 100%', () => {
    const result = resolveTechnicalNotes(
      buildCerramientoProject({
        geotecnia: { capacidad_admisible_cerramiento: '' },
        estructural: { cerramiento_poste_diametro: '', ambiente_corrosion_clase: '' },
      }),
      CERRAMIENTO_SPEC
    );
    expect(result.completitud.porcentaje).toBeLessThan(100);
    const idsPendientes = result.pendientes.map((p) => p.id);
    expect(idsPendientes).toContain('GEOTECNIA_CERRAMIENTO_CAPACIDAD_ADMISIBLE');
    expect(idsPendientes).toContain('CERRAMIENTO_POSTE_DIAMETRO');
    expect(idsPendientes).toContain('AMBIENTE_CORROSION_CLASE');
    // La nota 17 también usa CERRAMIENTO_POSTE_DIAMETRO -> debe marcarse incompleta también.
    const nota17 = result.secciones[2].notas.find((n) => n.numero === 17);
    expect(nota17.completa).toBe(false);
    expect(nota17.textoResuelto).not.toContain('{{');
    expect(nota17.textoResuelto).toContain('Falta definir');
  });

  it('longitud total del poste depende de anclaje Y afloramiento: si falta uno, se marca FALTANTE (no calcula con 0)', () => {
    const result = resolveTechnicalNotes(
      buildCerramientoProject({ estructural: { cerramiento_poste_afloramiento: '' } }),
      CERRAMIENTO_SPEC
    );
    const param = result.parametros.find((p) => p.id === 'CERRAMIENTO_POSTE_LONGITUD_TOTAL');
    expect(param.status).toBe(RESOLUTION_STATUS.FALTANTE);
    const nota13 = result.secciones[2].notas.find((n) => n.numero === 13);
    expect(nota13.textoResuelto).not.toContain('0.50 m'); // no debe "inventar" una longitud con el operando faltante en 0
  });

  it('completitud: los 25 IDs únicos de la plantilla de cerramiento están cubiertos por resolvers', () => {
    const result = resolveTechnicalNotes(buildCerramientoProject(), CERRAMIENTO_SPEC);
    expect(result.completitud.requeridos).toBe(25);
    expect(result.parametros.every((p) => p.status !== RESOLUTION_STATUS.DESCONOCIDO)).toBe(true);
    expect(result.completitud.porcentaje).toBe(100);
  });
});
