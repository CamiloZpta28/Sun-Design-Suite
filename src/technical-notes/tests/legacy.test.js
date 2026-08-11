/* ============================================================================
   COMPATIBILIDAD CON DATOS LEGACY
   ----------------------------------------------------------------------------
   Proyectos guardados por el motor ANTERIOR de Notas Técnicas conservan
   valores con un formato pensado para plantillas que ya no existen. Estas
   pruebas fijan el contrato de esta fase:

     1. el texto de la nota se adapta (capa de presentación), y
     2. projects.data NUNCA se modifica.

   Referencia del formato antiguo (leído verbatim del motor anterior antes de
   retirarlo): la nota de bandit decía «cinta bandit en aluminio {{CALIBRE}}»
   —sin la palabra "calibre"— y la de perfilería decía «conforme a NTC 1560 /
   {{NORMA}}» —con el prefijo fijo en la plantilla—.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { getResolvedTechnicalNotes, STATUS, isResolvedStatus } from '../index.js';
import { normalizeLegacyTechnicalValue, inspectLegacyValue, LEGACY_PRESENTATION_RULES } from '../compatibility.js';
import { optionsFor } from '../repository.js';

/** Proyecto tal como lo habría dejado el motor anterior. */
function legacyProject(overrides = {}) {
  return {
    id: 'proj-legacy',
    data: {
      geotecnia: { capacidad_admisible_cerramiento: '13.00 kN (1.30 ton)' },
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
      ...(overrides.raiz || {}),
    },
  };
}

const notaDe = (resolved, noteId) => resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === noteId);
const paramDe = (resolved, id) => resolved.parametros.find((p) => p.id === id);

describe('TEST 1 — BANDIT legacy: no duplica la palabra "calibre"', () => {
  it('«calibre 1/2”» produce la frase correcta, con "calibre" una sola vez', () => {
    const resolved = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    const cer008 = notaDe(resolved, 'CER-008');
    expect(cer008.textoResuelto).toContain('cinta bandit calibre 1/2”');
    expect(cer008.textoResuelto).not.toContain('calibre calibre');
    expect(cer008.textoResuelto.match(/calibre/gi)).toHaveLength(1);
  });

  it('también cubre variantes de mayúsculas y espaciado del valor legacy', () => {
    ['calibre 1/2”', 'Calibre 1/2”', 'CALIBRE  1/2”'].forEach((valor) => {
      const resolved = getResolvedTechnicalNotes(
        legacyProject({ estructural: { cerramiento_bandit_calibre: valor } }),
        'CERRAMIENTO_PERIMETRAL'
      );
      expect(notaDe(resolved, 'CER-008').textoResuelto, valor).not.toMatch(/calibre\s+calibre/i);
    });
  });

  it('no recorta valores que solo empiezan parecido (ej. "calibres especiales")', () => {
    // "calibre" seguido de espacio y contenido sí se recorta; sin espacio, no.
    expect(normalizeLegacyTechnicalValue({ categoryId: 'CERRAMIENTO_PERIMETRAL', inputId: 'BANDIT', value: 'calibrado 3/4' }))
      .toBe('calibrado 3/4');
  });
});

describe('TEST 2 — BANDIT nuevo: el formato actual sigue funcionando', () => {
  it('«1/2 in» pasa sin tocarse', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_bandit_calibre: '1/2 in' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(paramDe(resolved, 'BANDIT').value).toBe('1/2 in');
    expect(notaDe(resolved, 'CER-008').textoResuelto).toContain('cinta bandit calibre 1/2 in');
  });

  it('el default del catálogo (campo vacío) también funciona', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_bandit_calibre: '' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramDe(resolved, 'BANDIT');
    expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(p.value).toBe('1/2 in');
    expect(notaDe(resolved, 'CER-008').textoResuelto).not.toContain('calibre calibre');
  });
});

describe('TEST 3 — ACERO legacy: se preserva, no se completa silenciosamente', () => {
  it('«ASTM A1011» se mantiene exactamente como está', () => {
    const resolved = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    const p = paramDe(resolved, 'ACERO');
    expect(p.value).toBe('ASTM A1011');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
  });

  it('la nota NO inventa el prefijo "NTC 1560 /" que el dato no contiene', () => {
    const cer009 = notaDe(getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL'), 'CER-009');
    expect(cer009.textoResuelto).toContain('La perfilería será ASTM A1011');
    expect(cer009.textoResuelto).not.toContain('NTC 1560');
  });

  it('si el proyecto sí guarda la norma completa, se usa tal cual', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_acero_norma: 'NTC 1560 / ASTM A1011' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(notaDe(resolved, 'CER-009').textoResuelto).toContain('NTC 1560 / ASTM A1011');
  });
});

describe('TEST 4 — valor custom fuera del catálogo', () => {
  it('«ASTM A615» gana sobre el default del repositorio', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_acero_norma: 'ASTM A615' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(paramDe(resolved, 'ACERO').value).toBe('ASTM A615');
    expect(notaDe(resolved, 'CER-009').textoResuelto).toContain('ASTM A615');
    expect(notaDe(resolved, 'CER-009').textoResuelto).not.toContain('ASTM A1011');
  });
});

describe('TEST 5 — reconstrucción como "Otro" en la UI', () => {
  /* SelectOrOtro decide el modo comparando el valor ALMACENADO contra las
     opciones del repositorio; se replica aquí esa condición para fijar el
     contrato sin necesidad de renderizar React. */
  const esOtro = (valor, group, structureType) => !optionsFor(group, structureType).includes(valor);

  it('valores legacy fuera del catálogo se presentan como "Otro" + su valor', () => {
    expect(esOtro('ASTM A615', 'ACERO_ESTRUCTURAL', 'CERRAMIENTO_PERIMETRAL')).toBe(true);
    expect(esOtro('ASTM A1011', 'ACERO_ESTRUCTURAL', 'CERRAMIENTO_PERIMETRAL')).toBe(true);
    expect(esOtro('Ø 2”', 'TUBERIA_GALVANIZADA_DIAMETRO', 'CERRAMIENTO_PERIMETRAL')).toBe(true);
    expect(esOtro('calibre 1/2”', 'ACCESORIOS', 'CERRAMIENTO_PERIMETRAL')).toBe(true);
  });

  it('valores que sí están en el catálogo se presentan como opción normal', () => {
    expect(esOtro('NTC 1560 / ASTM A1011', 'ACERO_ESTRUCTURAL', 'CERRAMIENTO_PERIMETRAL')).toBe(false);
    expect(esOtro('Ø 2 in', 'TUBERIA_GALVANIZADA_DIAMETRO', 'CERRAMIENTO_PERIMETRAL')).toBe(false);
    expect(esOtro('1/2 in', 'ACCESORIOS', 'CERRAMIENTO_PERIMETRAL')).toBe(false);
  });

  it('la capa de compatibilidad NO altera lo que ve el formulario, solo la nota', () => {
    // El formulario lee el valor crudo; la normalización vive en el resolver.
    const inspeccion = inspectLegacyValue({
      categoryId: 'CERRAMIENTO_PERIMETRAL', inputId: 'BANDIT', value: 'calibre 1/2”',
    });
    expect(inspeccion.original).toBe('calibre 1/2”'); // lo que sigue guardado y editándose
    expect(inspeccion.normalized).toBe('1/2”');       // lo que entra a la nota
    expect(inspeccion.esLegacy).toBe(true);
  });
});

describe('TEST 6 — el motor no muta el proyecto', () => {
  it('resolver un proyecto legacy deja projects.data byte a byte igual', () => {
    const project = legacyProject();
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project).toEqual(snapshot);
  });

  it('resolver todas las estructuras seguidas tampoco muta nada', () => {
    const project = legacyProject();
    const snapshot = structuredClone(project);
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES']
      .forEach((s) => getResolvedTechnicalNotes(project, s));
    expect(project).toEqual(snapshot);
  });

  it('el valor legacy de bandit sigue intacto en el objeto después de resolver', () => {
    const project = legacyProject();
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project.data.estructural.cerramiento_bandit_calibre).toBe('calibre 1/2”');
  });
});

describe('TEST 7 — project_value sigue sin auto-adoptar su default', () => {
  it('capacidad del suelo vacía queda PENDING aunque haya sugerido', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ raiz: { geotecnia: {} } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramDe(resolved, 'CAPACIDAD_SUELO');
    expect(p.status).toBe(STATUS.PENDING);
    expect(p.value).toBeNull();
    expect(p.suggested).toBe('23.05 kN (2.35 ton)');
    expect(notaDe(resolved, 'CER-002').textoResuelto).not.toContain('23.05');
  });

  it('el valor legacy del proyecto sí se usa cuando existe', () => {
    const resolved = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    expect(paramDe(resolved, 'CAPACIDAD_SUELO').value).toBe('13.00 kN (1.30 ton)');
  });
});

describe('TEST 8 — los repository_select vacíos siguen usando su default', () => {
  it('poste sin diámetro cae al default del catálogo', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_poste_diametro: '' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramDe(resolved, 'POSTE_DIAMETRO');
    expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(p.value).toBe('Ø 2 in');
  });

  it('la notación legacy «Ø 2”» se respeta sin convertirla a «Ø 2 in»', () => {
    const resolved = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    expect(paramDe(resolved, 'POSTE_DIAMETRO').value).toBe('Ø 2”');
    expect(notaDe(resolved, 'CER-004').textoResuelto).toContain('Ø 2”');
  });
});

describe('TEST 9 y 10 — 0 y false siguen siendo valores válidos', () => {
  it('0 no se confunde con vacío ni cae al default', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_poste_anclaje: 0 } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramDe(resolved, 'POSTE_EMBEBIDO');
    expect(isResolvedStatus(p.status)).toBe(true);
    expect(p.value).toBe('0.00 m');
  });

  it('la capa de compatibilidad deja pasar 0 y false sin tocarlos', () => {
    const args = { categoryId: 'CERRAMIENTO_PERIMETRAL', inputId: 'BANDIT' };
    expect(normalizeLegacyTechnicalValue({ ...args, value: 0 })).toBe(0);
    expect(normalizeLegacyTechnicalValue({ ...args, value: false })).toBe(false);
    expect(normalizeLegacyTechnicalValue({ ...args, value: null })).toBeNull();
  });
});

describe('TEST 11 — la compatibilidad de cerramiento no afecta a otras estructuras', () => {
  it('un valor "calibre …" en un input de OTRA categoría no se normaliza', () => {
    // La regla está registrada solo para CERRAMIENTO_PERIMETRAL.BANDIT.
    expect(normalizeLegacyTechnicalValue({ categoryId: 'PORTON_METALICO', inputId: 'BANDIT', value: 'calibre 1/2”' }))
      .toBe('calibre 1/2”');
    expect(normalizeLegacyTechnicalValue({ categoryId: 'CERRAMIENTO_PERIMETRAL', inputId: 'ACERO', value: 'calibre 1/2”' }))
      .toBe('calibre 1/2”');
  });

  it('el portón conserva su propio acero y no ve el del cerramiento', () => {
    const resolved = getResolvedTechnicalNotes(
      legacyProject({ estructural: { porton_acero_norma: '', cerramiento_acero_norma: 'ASTM A1011' } }),
      'PORTON_METALICO'
    );
    expect(paramDe(resolved, 'ACERO').value).toBe('ASTM A500 Grado C');
    expect(paramDe(resolved, 'FY').value).toBe('315 MPa');
    expect(paramDe(resolved, 'FU').value).toBe('425 MPa');
  });

  it('las notas del portón no contienen datos del cerramiento', () => {
    const resolved = getResolvedTechnicalNotes(legacyProject(), 'PORTON_METALICO');
    expect(resolved.textoCompleto).not.toContain('ASTM A1011');
    expect(resolved.textoCompleto).not.toContain('bandit');
  });
});

describe('TEST 12 — actualización en vivo tras corregir un valor legacy', () => {
  it('cambiar el bandit legacy por el del catálogo cambia la nota de inmediato', () => {
    const antes = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    const despues = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_bandit_calibre: '1/2 in' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(notaDe(antes, 'CER-008').textoResuelto).toContain('calibre 1/2”');
    expect(notaDe(despues, 'CER-008').textoResuelto).toContain('calibre 1/2 in');
    expect(notaDe(antes, 'CER-008').textoResuelto).not.toBe(notaDe(despues, 'CER-008').textoResuelto);
  });

  it('completar la norma del acero actualiza CER-009 sin tocar nada más', () => {
    const antes = getResolvedTechnicalNotes(legacyProject(), 'CERRAMIENTO_PERIMETRAL');
    const despues = getResolvedTechnicalNotes(
      legacyProject({ estructural: { cerramiento_acero_norma: 'NTC 1560 / ASTM A1011' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(notaDe(antes, 'CER-009').textoResuelto).not.toContain('NTC 1560');
    expect(notaDe(despues, 'CER-009').textoResuelto).toContain('NTC 1560 / ASTM A1011');
    expect(notaDe(antes, 'CER-004').textoResuelto).toBe(notaDe(despues, 'CER-004').textoResuelto);
  });
});

describe('alcance de la capa de compatibilidad', () => {
  it('solo existe una regla registrada, y es la de bandit', () => {
    // Guarda contra "normalizar de más": cada regla nueva debe ser deliberada.
    expect(Object.keys(LEGACY_PRESENTATION_RULES)).toEqual(['CERRAMIENTO_PERIMETRAL.BANDIT']);
  });

  it('un input sin reglas devuelve el valor idéntico', () => {
    ['ASTM A1011', 'Ø 2”', '12.50 m (al poste central)', '  espacios  '].forEach((v) => {
      expect(normalizeLegacyTechnicalValue({ categoryId: 'CERRAMIENTO_PERIMETRAL', inputId: 'ACERO', value: v })).toBe(v);
    });
  });
});
