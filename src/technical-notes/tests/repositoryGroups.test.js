/* ============================================================================
   PRECISIÓN DE LOS GRUPOS DEL REPOSITORIO
   ----------------------------------------------------------------------------
   El paquete fuente agrupa toda la tubería del cerramiento bajo un único
   "TUBERIA_GALVANIZADA". Sin especializar, un campo de diámetro ofrecería
   espesores (y al revés), permitiendo elegir combinaciones sin sentido
   físico como POSTE_DIAMETRO = "1.50 mm".

   Estas pruebas fijan que cada input consuma únicamente opciones de su
   propia magnitud, sin tocar los valores ya almacenados en los proyectos.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  optionsFor,
  groupForInput,
  TECHNICAL_VALUE_REPOSITORY,
  INPUT_GROUP_OVERRIDES,
} from '../repository.js';
import { CATEGORIES, CERRAMIENTO_PERIMETRAL } from '../catalog/categories/index.js';
import { getResolvedTechnicalNotes } from '../index.js';
import { isBlank } from '../formatters.js';

const CER = 'CERRAMIENTO_PERIMETRAL';

/** Opciones que realmente vería el desplegable de un input. */
function opcionesDe(categoryId, inputKey, structureType = categoryId) {
  const input = CATEGORIES[categoryId].inputs[inputKey];
  return input.options || optionsFor(groupForInput(categoryId, inputKey, input.group), structureType);
}

const ES_ESPESOR = /^\d+(\.\d+)?\s*mm$/;      // 1.50 mm, 1.90 mm
const ES_DIAMETRO = /^Ø/;                      // Ø 2 in, Ø 1 1/2 in

describe('1 y 2 — separación de magnitudes', () => {
  it('los selects de diámetro NUNCA contienen espesores', () => {
    ['POSTE_DIAMETRO', 'DIAGONAL_DIAMETRO'].forEach((input) => {
      const opciones = opcionesDe(CER, input);
      expect(opciones.length, input).toBeGreaterThan(0);
      opciones.forEach((op) => {
        expect(ES_ESPESOR.test(op), `${input} ofrece el espesor "${op}"`).toBe(false);
        expect(ES_DIAMETRO.test(op), `${input} ofrece "${op}", que no es un diámetro`).toBe(true);
      });
    });
  });

  it('los selects de espesor NUNCA contienen diámetros', () => {
    ['POSTE_ESPESOR', 'DIAGONAL_ESPESOR'].forEach((input) => {
      const opciones = opcionesDe(CER, input);
      expect(opciones.length, input).toBeGreaterThan(0);
      opciones.forEach((op) => {
        expect(ES_DIAMETRO.test(op), `${input} ofrece el diámetro "${op}"`).toBe(false);
        expect(ES_ESPESOR.test(op), `${input} ofrece "${op}", que no es un espesor`).toBe(true);
      });
    });
  });

  it('las combinaciones sin sentido físico son imposibles de seleccionar', () => {
    expect(opcionesDe(CER, 'POSTE_DIAMETRO')).not.toContain('1.50 mm');
    expect(opcionesDe(CER, 'POSTE_DIAMETRO')).not.toContain('1.90 mm');
    expect(opcionesDe(CER, 'POSTE_ESPESOR')).not.toContain('Ø 2 in');
    expect(opcionesDe(CER, 'POSTE_ESPESOR')).not.toContain('Ø 1 1/2 in');
    expect(opcionesDe(CER, 'DIAGONAL_DIAMETRO')).not.toContain('1.90 mm');
    expect(opcionesDe(CER, 'DIAGONAL_ESPESOR')).not.toContain('Ø 1 1/2 in');
  });
});

describe('3 a 6 — cada campo ofrece los valores de la memoria', () => {
  it('POSTE_DIAMETRO contiene Ø 2 in', () => {
    expect(opcionesDe(CER, 'POSTE_DIAMETRO')).toContain('Ø 2 in');
  });
  it('DIAGONAL_DIAMETRO contiene Ø 1 1/2 in', () => {
    expect(opcionesDe(CER, 'DIAGONAL_DIAMETRO')).toContain('Ø 1 1/2 in');
  });
  it('POSTE_ESPESOR contiene 1.50 mm', () => {
    expect(opcionesDe(CER, 'POSTE_ESPESOR')).toContain('1.50 mm');
  });
  it('DIAGONAL_ESPESOR contiene 1.90 mm', () => {
    expect(opcionesDe(CER, 'DIAGONAL_ESPESOR')).toContain('1.90 mm');
  });

  it('el default de cada input sigue estando entre sus propias opciones', () => {
    ['POSTE_DIAMETRO', 'POSTE_ESPESOR', 'DIAGONAL_DIAMETRO', 'DIAGONAL_ESPESOR'].forEach((input) => {
      expect(opcionesDe(CER, input), input).toContain(CERRAMIENTO_PERIMETRAL.inputs[input].default);
    });
  });
});

describe('7 y 8 — valores legacy y custom se siguen conservando', () => {
  /* Réplica de la decisión de SelectOrOtro con las opciones ya especializadas. */
  const modoUI = (valor, categoryId, inputKey) => {
    if (isBlank(valor)) return 'select';
    return opcionesDe(categoryId, inputKey).includes(valor) ? 'select' : 'otro';
  };

  it('el diámetro legacy «Ø 2”» se reconstruye como Otro, no se reemplaza', () => {
    expect(modoUI('Ø 2”', CER, 'POSTE_DIAMETRO')).toBe('otro');
    expect(modoUI('Ø 1 1/2”', CER, 'DIAGONAL_DIAMETRO')).toBe('otro');
  });

  it('un espesor custom «2.00 mm» se reconstruye como Otro', () => {
    expect(modoUI('2.00 mm', CER, 'POSTE_ESPESOR')).toBe('otro');
    expect(modoUI('3.00 mm', CER, 'DIAGONAL_ESPESOR')).toBe('otro');
  });

  it('los valores del catálogo se siguen presentando como opción normal', () => {
    expect(modoUI('Ø 2 in', CER, 'POSTE_DIAMETRO')).toBe('select');
    expect(modoUI('1.50 mm', CER, 'POSTE_ESPESOR')).toBe('select');
  });

  it('las notas siguen usando el valor legacy tal cual', () => {
    const resolved = getResolvedTechnicalNotes(
      { id: 'x', data: { estructural: { cerramiento_poste_diametro: 'Ø 2”', cerramiento_poste_espesor: '2.00 mm' } } },
      CER
    );
    const cer004 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-004');
    expect(cer004.textoResuelto).toContain('Ø 2”');
    expect(cer004.textoResuelto).toContain('2.00 mm');
  });
});

describe('9 — no se modifica projects.data', () => {
  it('resolver con valores legacy y custom deja el proyecto idéntico', () => {
    const project = {
      id: 'y',
      data: {
        estructural: {
          cerramiento_poste_diametro: 'Ø 2”',
          cerramiento_poste_espesor: '2.00 mm',
          cerramiento_tubo_secundario_diametro: 'Ø 1 1/2”',
          cerramiento_tubo_secundario_espesor: '1.90 mm',
        },
      },
    };
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, CER);
    expect(project).toEqual(snapshot);
  });

  it('consultar opciones no muta la definición del repositorio', () => {
    const antes = structuredClone(TECHNICAL_VALUE_REPOSITORY);
    opcionesDe(CER, 'POSTE_DIAMETRO');
    opcionesDe(CER, 'POSTE_ESPESOR');
    optionsFor('TUBERIA_GALVANIZADA_DIAMETRO', CER);
    expect(TECHNICAL_VALUE_REPOSITORY).toEqual(antes);
  });
});

describe('10 — aislamiento entre estructuras', () => {
  it('el portón no recibe ninguna opción de tubería del cerramiento', () => {
    ['TUBERIA_GALVANIZADA_DIAMETRO', 'TUBERIA_GALVANIZADA_ESPESOR'].forEach((group) => {
      expect(optionsFor(group, 'PORTON_METALICO'), group).toEqual([]);
      expect(optionsFor(group, 'SHELTER_CIMENTACION'), group).toEqual([]);
      expect(optionsFor(group, 'SOPORTE_INVERSORES'), group).toEqual([]);
    });
  });

  it('el perfil y el acero del portón siguen siendo exclusivos suyos', () => {
    expect(opcionesDe('PORTON_METALICO', 'PERFIL', 'PORTON_METALICO')).toEqual(['perfil 4 in']);
    expect(opcionesDe('PORTON_METALICO', 'ACERO', 'PORTON_METALICO')).toEqual(['ASTM A500 Grado C']);
    expect(opcionesDe(CER, 'ACERO', CER)).toEqual(['NTC 1560 / ASTM A1011']);
  });

  it('los overrides de grupo solo afectan a inputs del cerramiento', () => {
    Object.keys(INPUT_GROUP_OVERRIDES).forEach((clave) => {
      expect(clave.startsWith(`${CER}.`), clave).toBe(true);
    });
  });
});

describe('guardarraíl: ningún input queda sin opciones', () => {
  /* Si alguien agrega un input repository_select con un grupo que el
     repositorio no conoce, el desplegable quedaría vacío en silencio.
     Este test lo convierte en un fallo visible. */
  it('todo repository_select resuelve a un grupo con al menos una opción', () => {
    Object.values(CATEGORIES).forEach((category) => {
      Object.entries(category.inputs || {}).forEach(([inputKey, input]) => {
        if (input.type !== 'repository_select' || input.excluded) return;
        const grupo = groupForInput(category.category_id, inputKey, input.group);
        const opciones = optionsFor(grupo, category.category_id);
        expect(opciones.length, `${category.category_id}.${inputKey} -> grupo "${grupo}" sin opciones`).toBeGreaterThan(0);
      });
    });
  });

  it('todo grupo referenciado por un override existe en el repositorio', () => {
    Object.values(INPUT_GROUP_OVERRIDES).forEach((grupo) => {
      expect(TECHNICAL_VALUE_REPOSITORY[grupo], grupo).toBeDefined();
    });
  });

  it('el grupo genérico TUBERIA_GALVANIZADA ya no se usa', () => {
    expect(TECHNICAL_VALUE_REPOSITORY.TUBERIA_GALVANIZADA).toBeUndefined();
  });
});
