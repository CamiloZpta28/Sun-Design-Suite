/* ============================================================================
   NORMA DEL ACERO DE REFUERZO — valor técnico de catálogo sin nota asociada.
   ----------------------------------------------------------------------------
   El catálogo actual (CON-003) solo interpola {{ACERO_FY}}: no existe
   placeholder para la norma. Aun así el dato se captura y debe comportarse
   como cualquier otro material del repositorio: desplegable con el valor de
   las memorias (ASTM A706) + "Otro", sin sobrescribir nunca lo ya guardado.

   Como el campo no alimenta ninguna nota, no tiene resolver: estas pruebas
   fijan el contrato del REPOSITORIO y el de SelectOrOtro (que decide entre
   opción y "Otro" comparando el valor almacenado contra las opciones).
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { optionsFor, STANDALONE_TECHNICAL_VALUES, TECHNICAL_VALUE_REPOSITORY } from '../repository.js';
import { CONCRETO } from '../catalog/categories/index.js';
import { getResolvedTechnicalNotes } from '../index.js';
import { isBlank } from '../formatters.js';

const NORMA = STANDALONE_TECHNICAL_VALUES.ACERO_REFUERZO_NORMA;

/* Réplica exacta de la decisión de SelectOrOtro: con el valor almacenado,
   ¿se muestra como opción del desplegable o como "Otro" + input libre? */
function modoUI(valorAlmacenado, { group, defaultValue }) {
  const opciones = optionsFor(group, null);
  if (isBlank(valorAlmacenado)) {
    return { modo: 'select', mostrado: defaultValue, persistido: null };
  }
  return opciones.includes(valorAlmacenado)
    ? { modo: 'select', mostrado: valorAlmacenado, persistido: valorAlmacenado }
    : { modo: 'otro', mostrado: valorAlmacenado, persistido: valorAlmacenado };
}

describe('catálogo del campo', () => {
  it('el campo persistido sigue siendo el existente: acero_refuerzo_norma', () => {
    expect(NORMA.fieldKey).toBe('acero_refuerzo_norma');
  });

  it('ofrece ASTM A706 como opción, con ese mismo valor por defecto', () => {
    expect(optionsFor(NORMA.group, null)).toEqual(['ASTM A706']);
    expect(NORMA.defaultValue).toBe('ASTM A706');
  });

  it('vive en un grupo propio: la norma no contamina el desplegable de fy', () => {
    expect(optionsFor('ACERO_REFUERZO', null)).toEqual(['420 MPa']);
    expect(optionsFor('ACERO_REFUERZO', null)).not.toContain('ASTM A706');
    expect(optionsFor(NORMA.group, null)).not.toContain('420 MPa');
  });

  it('es global: disponible desde cualquier estructura', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      expect(optionsFor(NORMA.group, s), s).toContain('ASTM A706');
    });
  });
});

describe('campo vacío → ASTM A706 como default sugerido', () => {
  it('un proyecto nuevo muestra ASTM A706 preseleccionado', () => {
    const ui = modoUI('', NORMA);
    expect(ui.modo).toBe('select');
    expect(ui.mostrado).toBe('ASTM A706');
  });

  it('el default es solo presentación: nada se persiste hasta que el usuario actúe', () => {
    expect(modoUI('', NORMA).persistido).toBeNull();
    expect(modoUI(undefined, NORMA).persistido).toBeNull();
    expect(modoUI(null, NORMA).persistido).toBeNull();
  });
});

describe('valor existente ASTM A615 → se conserva y se presenta como "Otro"', () => {
  it('no se sustituye por el default del catálogo', () => {
    const ui = modoUI('ASTM A615', NORMA);
    expect(ui.mostrado).toBe('ASTM A615');
    expect(ui.mostrado).not.toBe('ASTM A706');
    expect(ui.persistido).toBe('ASTM A615');
  });

  it('la UI lo reconstruye conceptualmente como Otro + valor existente', () => {
    expect(modoUI('ASTM A615', NORMA).modo).toBe('otro');
    expect(modoUI('ASTM A615 Grado 60', NORMA).modo).toBe('otro');
  });
});

describe('seleccionar "Otro" y guardar un valor personalizado', () => {
  it('el valor custom queda en el mismo campo, sin campo paralelo', () => {
    const ui = modoUI('NTC 2289', NORMA);
    expect(ui.modo).toBe('otro');
    expect(ui.persistido).toBe('NTC 2289');
    // Un único campo: no existe "acero_refuerzo_norma_otro" en el registro.
    expect(Object.values(STANDALONE_TECHNICAL_VALUES).map((v) => v.fieldKey)).toEqual(['acero_refuerzo_norma']);
  });

  it('tras "recargar", el mismo valor se reconstruye otra vez como Otro', () => {
    const guardado = modoUI('NTC 2289', NORMA).persistido;
    const trasRecarga = modoUI(guardado, NORMA);
    expect(trasRecarga.modo).toBe('otro');
    expect(trasRecarga.mostrado).toBe('NTC 2289');
  });
});

describe('volver de "Otro" a la opción estándar', () => {
  it('ASTM A706 vuelve a presentarse como opción normal del desplegable', () => {
    const ui = modoUI('ASTM A706', NORMA);
    expect(ui.modo).toBe('select');
    expect(ui.persistido).toBe('ASTM A706');
  });
});

describe('independencia entre norma y fy', () => {
  it('ACERO_FY conserva su propio valor y default, ajeno a la norma', () => {
    expect(CONCRETO.inputs.ACERO_FY.default).toBe('420 MPa');
    expect(CONCRETO.inputs.ACERO_FY.group).toBe('ACERO_REFUERZO');
  });

  it('elegir una norma distinta no altera el fy resuelto en las notas', () => {
    const conNormaEstandar = getResolvedTechnicalNotes(
      { id: 'a', data: { estructural: { acero_refuerzo_norma: 'ASTM A706', acero_refuerzo_fy: '420 MPa' } } },
      'CERRAMIENTO_PERIMETRAL'
    );
    const conNormaCustom = getResolvedTechnicalNotes(
      { id: 'b', data: { estructural: { acero_refuerzo_norma: 'ASTM A615', acero_refuerzo_fy: '420 MPa' } } },
      'CERRAMIENTO_PERIMETRAL'
    );
    const fyDe = (r) => r.parametros.find((p) => p.id === 'ACERO_FY').value;
    expect(fyDe(conNormaEstandar)).toBe('420 MPa');
    expect(fyDe(conNormaCustom)).toBe('420 MPa');
  });

  it('cambiar el fy no fuerza ninguna norma', () => {
    const resolved = getResolvedTechnicalNotes(
      { id: 'c', data: { estructural: { acero_refuerzo_norma: 'ASTM A615', acero_refuerzo_fy: '500 MPa' } } },
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(resolved.parametros.find((p) => p.id === 'ACERO_FY').value).toBe('500 MPa');
    // La norma no participa en ninguna nota, así que no aparece como parámetro…
    expect(resolved.parametros.some((p) => p.id === 'ACERO_REFUERZO_NORMA')).toBe(false);
    // …y CON-003 sigue hablando solo de fy.
    const con003 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CON-003');
    expect(con003.textoResuelto).toContain('fy = 500 MPa');
    expect(con003.textoResuelto).not.toContain('ASTM');
  });
});

describe('el texto de las notas no se tocó para introducir la norma', () => {
  it('CON-003 sigue sin placeholder de norma', () => {
    const con003 = CONCRETO.notes.find((n) => n.note_id === 'CON-003');
    expect(con003.text).toContain('{{ACERO_FY}}');
    expect(con003.text).not.toContain('NORMA');
    expect(con003.text).toBe('El acero corrugado tendrá fy = {{ACERO_FY}}. Las longitudes de traslapo y desarrollo no indicadas deberán ajustarse a la NSR-10, Capítulo C.12.');
  });

  it('ninguna categoría declara un input de norma de acero de refuerzo', () => {
    expect(CONCRETO.inputs.ACERO_NORMA).toBeUndefined();
  });
});

describe('resolver notas no modifica projects.data', () => {
  it('un proyecto con norma legacy queda idéntico tras resolver', () => {
    const project = { id: 'd', data: { estructural: { acero_refuerzo_norma: 'ASTM A615', acero_refuerzo_fy: '420 MPa' } } };
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project).toEqual(snapshot);
    expect(project.data.estructural.acero_refuerzo_norma).toBe('ASTM A615');
  });

  it('consultar el repositorio tampoco muta su propia definición', () => {
    const antes = structuredClone(TECHNICAL_VALUE_REPOSITORY.ACERO_REFUERZO_NORMA);
    optionsFor('ACERO_REFUERZO_NORMA', 'CERRAMIENTO_PERIMETRAL');
    optionsFor('ACERO_REFUERZO_NORMA', null);
    expect(TECHNICAL_VALUE_REPOSITORY.ACERO_REFUERZO_NORMA).toEqual(antes);
  });
});
