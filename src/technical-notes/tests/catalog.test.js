import { describe, it, expect } from 'vitest';
import { MANIFEST } from '../catalog/manifest.js';
import { CATEGORIES, getCategory } from '../catalog/categories/index.js';
import { buildSpec } from '../catalog/bundler.js';
import { validateCatalog, KNOWN_INPUT_TYPES } from '../validation.js';
import { optionsFor } from '../repository.js';
import { sourcesForCategory } from '../catalog/traceability.js';

describe('validación del paquete de categorías', () => {
  it('el catálogo completo es consistente (manifest, dependencias, notas, IDs, placeholders, types, groups, exclusiones)', () => {
    expect(validateCatalog()).toEqual([]);
  });

  it('todos los inputs declaran un type conocido', () => {
    Object.values(CATEGORIES).forEach((category) => {
      Object.entries(category.inputs || {}).forEach(([key, input]) => {
        expect(KNOWN_INPUT_TYPES.has(input.type), `${category.category_id}.${key} -> ${input.type}`).toBe(true);
      });
    });
  });
});

describe('bundles del manifest', () => {
  it('CERRAMIENTO = GENERAL + CONCRETO + METAL + CERRAMIENTO', () => {
    const spec = buildSpec('CERRAMIENTO_PERIMETRAL');
    expect(spec.categories.map((c) => c.id)).toEqual(['GENERAL', 'CONCRETO', 'METAL', 'CERRAMIENTO_PERIMETRAL']);
  });

  it('PORTÓN no incluye ninguna categoría de shelter ni sus notas', () => {
    const spec = buildSpec('PORTON_METALICO');
    expect(spec.categories.map((c) => c.id)).toEqual(['GENERAL', 'CONCRETO', 'METAL', 'PORTON_METALICO']);
    expect(spec.categories.map((c) => c.id)).not.toContain('SHELTER_CIMENTACION');
    expect(spec.notes.some((n) => n.note_id.startsWith('SHE-'))).toBe(false);
    expect(spec.notes.some((n) => n.note_id.startsWith('CER-'))).toBe(false);
  });

  it('SHELTER incluye impermeabilización y juntas, pero NO metal', () => {
    const spec = buildSpec('SHELTER_CIMENTACION');
    expect(spec.categories.map((c) => c.id)).toEqual(['GENERAL', 'CONCRETO', 'IMPERMEABILIZACION_JUNTAS', 'SHELTER_CIMENTACION']);
    expect(spec.notes.some((n) => n.note_id.startsWith('IMP-'))).toBe(true);
    expect(spec.notes.some((n) => n.note_id.startsWith('JUN-'))).toBe(true);
    expect(spec.notes.some((n) => n.note_id.startsWith('MET-'))).toBe(false);
  });

  it('SOPORTE_INVERSORES = GENERAL + CONCRETO + SOPORTE_INVERSORES', () => {
    const spec = buildSpec('SOPORTE_INVERSORES');
    expect(spec.categories.map((c) => c.id)).toEqual(['GENERAL', 'CONCRETO', 'SOPORTE_INVERSORES']);
  });

  it('un structureType desconocido no produce spec', () => {
    expect(buildSpec('NO_EXISTE')).toBeNull();
  });
});

describe('exclusiones — sísmico fuera de alcance', () => {
  it('SHE-002 nunca aparece en la salida activa del bundle de shelter', () => {
    const spec = buildSpec('SHELTER_CIMENTACION');
    expect(spec.notes.some((n) => n.note_id === 'SHE-002')).toBe(false);
    // …pero sigue existiendo en el catálogo, marcada, para poder reactivarla.
    const shelter = getCategory('SHELTER_CIMENTACION');
    const she002 = shelter.notes.find((n) => n.note_id === 'SHE-002');
    expect(she002).toBeDefined();
    expect(she002.excluded).toBe(true);
    expect(she002.reason).toBe('sismico_fuera_de_alcance');
  });

  it('los 8 parámetros sísmicos siguen en el catálogo, marcados como excluidos', () => {
    const shelter = getCategory('SHELTER_CIMENTACION');
    ['AMENAZA_SISMICA', 'TIPO_SUELO', 'GRUPO_USO', 'I', 'AA', 'AV', 'FA', 'FV'].forEach((key) => {
      expect(shelter.inputs[key], key).toBeDefined();
      expect(shelter.inputs[key].excluded, key).toBe(true);
    });
  });

  it('las notas activas de shelter son SHE-001, SHE-003, SHE-004 y SHE-005', () => {
    const spec = buildSpec('SHELTER_CIMENTACION');
    const sheNotes = spec.notes.filter((n) => n.note_id.startsWith('SHE-')).map((n) => n.note_id);
    expect(sheNotes).toEqual(['SHE-001', 'SHE-003', 'SHE-004', 'SHE-005']);
  });
});

describe('deduplicación de notas', () => {
  it('ningún note_id aparece dos veces en un mismo bundle', () => {
    MANIFEST.structure_options.forEach((structureType) => {
      const spec = buildSpec(structureType);
      const ids = spec.notes.map((n) => n.note_id);
      expect(new Set(ids).size, structureType).toBe(ids.length);
    });
  });

  it('no hay conflictos de note_id con texto distinto entre categorías de un bundle', () => {
    MANIFEST.structure_options.forEach((structureType) => {
      expect(buildSpec(structureType).duplicates, structureType).toEqual([]);
    });
  });
});

describe('aislamiento entre estructuras (repositorio con scope)', () => {
  it('el acero del portón NO se ofrece como opción en cerramiento, y viceversa', () => {
    const enCerramiento = optionsFor('ACERO_ESTRUCTURAL', 'CERRAMIENTO_PERIMETRAL');
    const enPorton = optionsFor('ACERO_ESTRUCTURAL', 'PORTON_METALICO');
    expect(enCerramiento).toContain('NTC 1560 / ASTM A1011');
    expect(enCerramiento).not.toContain('ASTM A500 Grado C');
    expect(enPorton).toContain('ASTM A500 Grado C');
    expect(enPorton).not.toContain('NTC 1560 / ASTM A1011');
  });

  it('los valores globales sí se ofrecen a cualquier estructura', () => {
    expect(optionsFor('GALVANIZADO', 'CERRAMIENTO_PERIMETRAL')).toContain('Z450');
    expect(optionsFor('GALVANIZADO', 'PORTON_METALICO')).toContain('Z450');
    expect(optionsFor('CONCRETO', 'SHELTER_CIMENTACION')).toContain('21 MPa');
  });

  it('la tubería galvanizada del cerramiento no se ofrece al portón', () => {
    expect(optionsFor('TUBERIA_GALVANIZADA', 'PORTON_METALICO')).toEqual([]);
    expect(optionsFor('TUBERIA_GALVANIZADA', 'CERRAMIENTO_PERIMETRAL')).toContain('Ø 2 in');
  });
});

describe('trazabilidad', () => {
  it('cada categoría de estructura declara su documento fuente', () => {
    expect(sourcesForCategory('CERRAMIENTO_PERIMETRAL')).toContain('MGS_0051_Cerramiento.docx');
    expect(sourcesForCategory('SHELTER_CIMENTACION')).toContain('1-MC-Shelter(1).docx');
    expect(sourcesForCategory('SOPORTE_INVERSORES')).toContain('COLCEST312P3-CIV-MEC-003 MC Inversor (1).docx');
  });
});

describe('metadatos preservados', () => {
  it('el warning de soporte de inversores se conserva como metadato y NO como nota', () => {
    const cat = getCategory('SOPORTE_INVERSORES');
    expect(cat.warning).toContain('dejar reposar el concreto');
    expect(cat.notes.some((n) => n.text.includes('reposar'))).toBe(false);
  });
});
