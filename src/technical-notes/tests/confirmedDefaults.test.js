/* ============================================================================
   DEFAULTS TÉCNICOS CONFIRMADOS Y ETIQUETAS DE PRESENTACIÓN
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { getResolvedTechnicalNotes, STATUS } from '../index.js';
import { CONFIRMED_TECHNICAL_DEFAULTS, hasConfirmedDefault, effectiveDefaultFor } from '../confirmedDefaults.js';
import { CERRAMIENTO_PERIMETRAL, PORTON_METALICO } from '../catalog/categories/index.js';
import { FIELD_DISPLAY_LABELS, displayLabelFor, allFieldGroups, allGroupedFieldKeys } from '../fieldGroups.js';

const proyecto = (estructural = {}, geotecnia = {}) => ({ id: 'p', data: { estructural, geotecnia } });
const paramDe = (structureType, id, data) =>
  getResolvedTechnicalNotes(proyecto(data), structureType).parametros.find((p) => p.id === id);

describe('defaults confirmados — campo vacío se resuelve, no queda pendiente', () => {
  const ESPERADOS = [
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_LONGITUD', '3.40 m'],
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_SEPARACION', '12.50 m'],
    ['CERRAMIENTO_PERIMETRAL', 'VIENTO_LONGITUD', '3.62 m'],
    ['CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', '3.40 m'],
    ['CERRAMIENTO_PERIMETRAL', 'FIJACION', '50 cm'],
    ['CERRAMIENTO_PERIMETRAL', 'SOLDADURA', '3 mm'],
    ['PORTON_METALICO', 'REEMPLAZO_GRANULAR', '30 cm'],
  ];

  ESPERADOS.forEach(([estructura, id, valor]) => {
    it(`${id} vacío → ${valor}`, () => {
      const p = paramDe(estructura, id);
      expect(p.value).toBe(valor);
      expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    });
  });

  it('ninguno queda PENDING cuando está vacío', () => {
    ESPERADOS.forEach(([estructura, id]) => {
      const pendientes = getResolvedTechnicalNotes(proyecto(), estructura).pendientes.map((p) => p.id);
      expect(pendientes, id).not.toContain(id);
    });
  });

  it('la separación de vientos se aparta del valor de la memoria (25 m → 3.40 m)', () => {
    expect(CERRAMIENTO_PERIMETRAL.inputs.VIENTO_SEPARACION.default).toBe('25 m'); // catálogo intacto
    expect(effectiveDefaultFor('CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', '25 m')).toBe('3.40 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION').value).toBe('3.40 m');
  });

  it('las notas del cerramiento ya no muestran "Pendiente" para estos parámetros', () => {
    const texto = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL').textoCompleto;
    expect(texto).toContain('longitud 3.40 m');       // CER-005 diagonales
    expect(texto).toContain('cada 12.50 m');          // CER-005 separación
    expect(texto).toContain('longitud 3.62 m');       // CER-006 vientos
    expect(texto).toContain('separación máxima 50 cm'); // CER-008 fijación
    expect(texto).toContain('espesor mínimo 3 mm');   // CER-010 soldadura
  });
});

describe('el valor del proyecto SIEMPRE gana sobre el default confirmado', () => {
  it('una longitud de diagonal propia no se reemplaza por 3.40 m', () => {
    const p = paramDe('CERRAMIENTO_PERIMETRAL', 'DIAGONAL_LONGITUD', { cerramiento_diagonales_longitud: '3.80 m' });
    expect(p.value).toBe('3.80 m');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
  });

  it('una separación de vientos propia no se reemplaza por 3.40 m', () => {
    const p = paramDe('CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', { cerramiento_vientos_separacion: '25 m' });
    expect(p.value).toBe('25 m');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
  });

  it('lo mismo para el resto de defaults confirmados', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'FIJACION', { cerramiento_fijacion_separacion: '40 cm' }).value).toBe('40 cm');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'SOLDADURA', { cerramiento_soldadura_espesor: '5 mm' }).value).toBe('5 mm');
    expect(paramDe('PORTON_METALICO', 'REEMPLAZO_GRANULAR', { porton_reemplazo_granular: '45 cm' }).value).toBe('45 cm');
  });

  it('resolver no modifica projects.data', () => {
    const project = proyecto({ cerramiento_diagonales_longitud: '3.80 m' });
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project).toEqual(snapshot);
    // El default confirmado tampoco se escribe en los campos vacíos.
    expect(project.data.estructural.cerramiento_vientos_separacion).toBeUndefined();
  });
});

describe('los demás project_value conservan su comportamiento', () => {
  it('capacidades del suelo y portante siguen PENDING al estar vacías', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'CAPACIDAD_SUELO').status).toBe(STATUS.PENDING);
    expect(paramDe('PORTON_METALICO', 'CAPACIDAD_SUELO').status).toBe(STATUS.PENDING);
    expect(paramDe('SHELTER_CIMENTACION', 'CAP_PORTANTE').status).toBe(STATUS.PENDING);
  });

  it('las cargas del shelter siguen PENDING', () => {
    ['CV_MANT', 'CV_SOBRE', 'CM_TOTAL', 'VIENTO'].forEach((id) => {
      expect(paramDe('SHELTER_CIMENTACION', id).status, id).toBe(STATUS.PENDING);
    });
  });

  it('los concretos del soporte de inversores siguen PENDING', () => {
    expect(paramDe('SOPORTE_INVERSORES', 'FC_FUNDACION').status).toBe(STATUS.PENDING);
    expect(paramDe('SOPORTE_INVERSORES', 'FC_CICLOPEO').status).toBe(STATUS.PENDING);
  });

  it('la soldadura del PORTÓN no heredó el default del cerramiento', () => {
    expect(hasConfirmedDefault('PORTON_METALICO', 'SOLDADURA')).toBe(false);
    expect(paramDe('PORTON_METALICO', 'SOLDADURA').status).toBe(STATUS.PENDING);
    expect(PORTON_METALICO.inputs.SOLDADURA.default).toBe('5 mm'); // catálogo intacto
  });

  it('la lista de defaults confirmados es exactamente la acordada', () => {
    expect(Object.keys(CONFIRMED_TECHNICAL_DEFAULTS).sort()).toEqual([
      'CERRAMIENTO_PERIMETRAL.DIAGONAL_LONGITUD',
      'CERRAMIENTO_PERIMETRAL.DIAGONAL_SEPARACION',
      'CERRAMIENTO_PERIMETRAL.FIJACION',
      'CERRAMIENTO_PERIMETRAL.POSTE_AFLORAMIENTO',
      'CERRAMIENTO_PERIMETRAL.POSTE_EMBEBIDO',
      'CERRAMIENTO_PERIMETRAL.POSTE_SEPARACION',
      'CERRAMIENTO_PERIMETRAL.SOLDADURA',
      'CERRAMIENTO_PERIMETRAL.VIENTO_LONGITUD',
      'CERRAMIENTO_PERIMETRAL.VIENTO_SEPARACION',
      'PORTON_METALICO.REEMPLAZO_GRANULAR',
    ]);
    // El afloramiento entra por decisión confirmada del equipo (0.50 m).
    expect(CONFIRMED_TECHNICAL_DEFAULTS['CERRAMIENTO_PERIMETRAL.POSTE_AFLORAMIENTO'].value).toBe('0.50');
  });
});

describe('etiquetas de presentación dentro del acordeón', () => {
  it('Poste típico no repite "Cerramiento — poste típico"', () => {
    ['cerramiento_poste_diametro', 'cerramiento_poste_espesor', 'cerramiento_poste_separacion'].forEach((k) => {
      expect(displayLabelFor(k, 'x').toLowerCase()).not.toContain('cerramiento');
      expect(displayLabelFor(k, 'x').toLowerCase()).not.toContain('poste típico');
    });
  });

  it('muestra "Diámetro nominal", "Espesor", "Separación"', () => {
    expect(displayLabelFor('cerramiento_poste_diametro')).toBe('Diámetro nominal');
    expect(displayLabelFor('cerramiento_poste_espesor')).toBe('Espesor');
    expect(displayLabelFor('cerramiento_poste_separacion')).toBe('Separación');
  });

  it('Diagonales y Vientos muestran "Longitud" y "Separación"', () => {
    expect(displayLabelFor('cerramiento_diagonales_longitud')).toBe('Longitud');
    expect(displayLabelFor('cerramiento_diagonales_separacion')).toBe('Separación');
    expect(displayLabelFor('cerramiento_vientos_longitud')).toBe('Longitud');
    expect(displayLabelFor('cerramiento_vientos_separacion')).toBe('Separación');
  });

  it('Malla y fijaciones usan etiquetas limpias', () => {
    expect(displayLabelFor('cerramiento_malla_especificacion')).toBe('Malla eslabonada');
    expect(displayLabelFor('cerramiento_bandit_calibre')).toBe('Cinta bandit: calibre');
    expect(displayLabelFor('cerramiento_fijacion_separacion')).toBe('Separación máxima entre fijaciones');
  });

  it('Portón › Cimentación muestra "Viga de amarre: sección"', () => {
    expect(displayLabelFor('porton_viga_amarre_seccion')).toBe('Viga de amarre: sección');
    expect(displayLabelFor('porton_reemplazo_granular')).toBe('Reemplazo de material granular');
  });

  it('ninguna etiqueta del acordeón repite el nombre de su estructura', () => {
    const PREFIJOS = ['cerramiento —', 'portón —', 'porton —', 'shelter —', 'inversores —', 'acero de refuerzo —', 'recubrimiento —', 'galvanizado en frío —', 'concreto de solado —'];
    Object.entries(FIELD_DISPLAY_LABELS).forEach(([clave, etiqueta]) => {
      PREFIJOS.forEach((p) => expect(etiqueta.toLowerCase(), `${clave} → "${etiqueta}"`).not.toContain(p));
    });
  });

  it('todos los campos agrupados tienen etiqueta declarada', () => {
    allGroupedFieldKeys().forEach((k) => {
      expect(FIELD_DISPLAY_LABELS[k], `falta displayLabel para ${k}`).toBeDefined();
    });
  });

  it('si falta una etiqueta se devuelve el label canónico (nunca desaparece el campo)', () => {
    expect(displayLabelFor('clave_inexistente', 'Etiqueta canónica')).toBe('Etiqueta canónica');
  });
});

describe('la identidad técnica interna NO cambió', () => {
  it('los fieldKey siguen siendo los mismos', () => {
    const claves = allGroupedFieldKeys();
    ['cerramiento_poste_diametro', 'cerramiento_diagonales_longitud', 'porton_viga_amarre_seccion', 'shelter_micropilote_profundidad']
      .forEach((k) => expect(claves).toContain(k));
  });

  it('los id de resolver siguen siendo los mismos', () => {
    const ids = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL').parametros.map((p) => p.id);
    ['POSTE_DIAMETRO', 'DIAGONAL_LONGITUD', 'VIENTO_SEPARACION', 'FIJACION', 'SOLDADURA'].forEach((id) => {
      expect(ids, id).toContain(id);
    });
  });

  it('los pendientes conservan el label canónico completo (identifican fuera de su jerarquía)', () => {
    const pendiente = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL').pendientes
      .find((p) => p.id === 'CAPACIDAD_SUELO');
    expect(pendiente.label).toBe('Capacidad admisible del suelo (cimentación cerramiento)');
    expect(pendiente.fieldRef.fieldKey).toBe('capacidad_admisible_cerramiento');
  });

  it('la estructura de grupos y subgrupos se mantiene', () => {
    expect(allFieldGroups().map((g) => g.id)).toEqual([
      'GENERAL', 'CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES',
    ]);
  });
});
