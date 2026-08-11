/* ============================================================================
   PRECARGAS Y NORMALIZACIÓN DE WHITESPACE
   ----------------------------------------------------------------------------
   Auditan la implementación contra el inventario consolidado
   (notas_tecnicas_consolidadas_utf8.txt): cada ACTIVE_DEFAULT debe resolverse
   solo, cada PROJECT_REFERENCE debe seguir pendiente, y ningún texto de salida
   puede contener whitespace no portable.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { getResolvedTechnicalNotes, STATUS } from '../index.js';
import { normalizeTechnicalText, tieneWhitespaceProblematico, WHITESPACE_PROHIBIDO } from '../textNormalization.js';
import { selectableOptionsFor } from '../repository.js';
import { CATEGORIES } from '../catalog/categories/index.js';
import { hasConfirmedDefault, effectiveDefaultFor, DECISION_POSTE } from '../confirmedDefaults.js';

const ESTRUCTURAS = ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'];
const proyecto = (estructural = {}, extra = {}) => ({ id: 'p', data: { estructural, ...extra } });
const paramDe = (s, id, data) =>
  getResolvedTechnicalNotes(proyecto(data), s).parametros.find((p) => p.id === id);

/* ---------------------------------------------------------------- PRECARGAS */

describe('ACTIVE_DEFAULT del inventario — se resuelven solos', () => {
  const ESPERADOS = [
    ['CERRAMIENTO_PERIMETRAL', 'UNIDAD_PLANOS', 'metros'],
    ['CERRAMIENTO_PERIMETRAL', 'FC_ESTRUCTURAL', '21 MPa'],
    ['CERRAMIENTO_PERIMETRAL', 'FC_SOLADO', '14 MPa'],
    ['CERRAMIENTO_PERIMETRAL', 'ESPESOR_SOLADO', '5 cm'],
    ['CERRAMIENTO_PERIMETRAL', 'ACERO_FY', '420 MPa'],
    ['CERRAMIENTO_PERIMETRAL', 'REC_TIERRA', '7.5 cm'],
    ['CERRAMIENTO_PERIMETRAL', 'REC_NO_TIERRA', '5 cm'],
    ['CERRAMIENTO_PERIMETRAL', 'GALVANIZADO', 'Z450'],
    ['CERRAMIENTO_PERIMETRAL', 'ZINC_FRIO', '92 %'],
    ['CERRAMIENTO_PERIMETRAL', 'CAPAS_REPARACION', '4'],
    ['CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO', '0.50 m'],
    ['CERRAMIENTO_PERIMETRAL', 'POSTE_DIAMETRO', 'Ø 2 in'],
    ['CERRAMIENTO_PERIMETRAL', 'POSTE_ESPESOR', '1.50 mm'],
    ['CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO', '0.50 m'],
    ['CERRAMIENTO_PERIMETRAL', 'POSTE_SEPARACION', '2.50 m'],
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_DIAMETRO', 'Ø 1 1/2 in'],
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_ESPESOR', '1.90 mm'],
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_LONGITUD', '3.40 m'],
    ['CERRAMIENTO_PERIMETRAL', 'DIAGONAL_SEPARACION', '12.50 m'],
    ['CERRAMIENTO_PERIMETRAL', 'VIENTO_LONGITUD', '3.62 m'],
    ['CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', '3.40 m'],
    ['CERRAMIENTO_PERIMETRAL', 'MALLA', 'ojo 6 cm x 6 cm, calibre 10.5, altura 2.00 m'],
    ['CERRAMIENTO_PERIMETRAL', 'BANDIT', '1/2 in'],
    ['CERRAMIENTO_PERIMETRAL', 'FIJACION', '50 cm'],
    ['CERRAMIENTO_PERIMETRAL', 'ACERO', 'NTC 1560 / ASTM A1011'],
    ['CERRAMIENTO_PERIMETRAL', 'FY', '172 MPa'],
    ['CERRAMIENTO_PERIMETRAL', 'FU', '303 MPa'],
    ['CERRAMIENTO_PERIMETRAL', 'SOLDADURA', '3 mm'],
    ['PORTON_METALICO', 'REEMPLAZO_GRANULAR', '30 cm'],
    ['PORTON_METALICO', 'PERFIL', 'perfil 4 in'],
    ['PORTON_METALICO', 'ACERO', 'ASTM A500 Grado C'],
    ['PORTON_METALICO', 'FY', '315 MPa'],
    ['PORTON_METALICO', 'FU', '425 MPa'],
    ['SHELTER_CIMENTACION', 'IMPERMEABILIZANTE', 'SikaTop-107 Seal CO o equivalente'],
    ['SHELTER_CIMENTACION', 'PUENTE_ADHERENCIA', 'Sikadur-32 Primer o equivalente'],
    ['SHELTER_CIMENTACION', 'SELLO_HIDROEXPANSIVO', 'SikaSwell S-2 o equivalente'],
  ];

  it.each(ESPERADOS)('%s.%s → %s', (estructura, id, valor) => {
    const p = paramDe(estructura, id);
    expect(p.value).toBe(valor);
    expect(p.status).not.toBe(STATUS.PENDING);
  });

  it('ninguno aparece en la lista de pendientes', () => {
    ESPERADOS.forEach(([estructura, id]) => {
      const pendientes = getResolvedTechnicalNotes(proyecto(), estructura).pendientes.map((p) => p.id);
      expect(pendientes, `${estructura}.${id}`).not.toContain(id);
    });
  });

  it('un valor del proyecto siempre gana sobre el default', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', { cerramiento_vientos_separacion: '25 m' }).value).toBe('25 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_SEPARACION', { cerramiento_poste_separacion: '3.00 m' }).value).toBe('3.00 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO', { cerramiento_poste_anclaje: '0.80' }).value).toBe('0.80 m');
    expect(paramDe('PORTON_METALICO', 'REEMPLAZO_GRANULAR', { porton_reemplazo_granular: '45 cm' }).value).toBe('45 cm');
  });

  it('resolver nunca modifica projects.data', () => {
    const project = proyecto({ cerramiento_poste_separacion: '3.00 m' });
    const snapshot = structuredClone(project);
    ESTRUCTURAS.forEach((s) => getResolvedTechnicalNotes(project, s));
    expect(project).toEqual(snapshot);
    expect(project.data.estructural.cerramiento_vientos_separacion).toBeUndefined();
  });
});

describe('PROJECT_REFERENCE — siguen pendientes al estar vacíos', () => {
  const REFERENCIAS = [
    ['CERRAMIENTO_PERIMETRAL', 'CAPACIDAD_SUELO'],
    ['CERRAMIENTO_PERIMETRAL', 'PEDESTAL_DIAMETRO'],
    ['CERRAMIENTO_PERIMETRAL', 'PEDESTAL_DESPLANTE'],
    ['CERRAMIENTO_PERIMETRAL', 'AMBIENTE'],
    ['PORTON_METALICO', 'CAPACIDAD_SUELO'],
    ['PORTON_METALICO', 'ZAPATA'],
    ['PORTON_METALICO', 'DESPLANTE'],
    ['PORTON_METALICO', 'VIGA_AMARRE'],
    ['PORTON_METALICO', 'SOLDADURA'],
    ['SHELTER_CIMENTACION', 'COTA_MINIMA'],
    ['SHELTER_CIMENTACION', 'CAP_PORTANTE'],
    ['SHELTER_CIMENTACION', 'CV_MANT'],
    ['SHELTER_CIMENTACION', 'VIENTO'],
    ['SOPORTE_INVERSORES', 'MANUAL_CARGAS'],
    ['SOPORTE_INVERSORES', 'FC_FUNDACION'],
    ['SOPORTE_INVERSORES', 'FC_CICLOPEO'],
  ];

  it.each(REFERENCIAS)('%s.%s sigue PENDING', (estructura, id) => {
    expect(paramDe(estructura, id).status).toBe(STATUS.PENDING);
  });

  it('la soldadura del portón NO heredó el default del cerramiento', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'SOLDADURA').value).toBe('3 mm');
    expect(paramDe('PORTON_METALICO', 'SOLDADURA').status).toBe(STATUS.PENDING);
  });
});

describe('DERIVED, FIXED y EXCLUDED', () => {
  it('POSTE_LONGITUD se calcula cuando existen sus dos operandos', () => {
    const p = paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_LONGITUD', { cerramiento_poste_afloramiento: '2.50' });
    expect(p.value).toBe('3.00 m'); // 0.50 (embebido por default) + 2.50 del proyecto
    expect(p.status).toBe(STATUS.RESOLVED_DERIVED);
  });

  it('MICROPILOTE_TOTAL se calcula a partir de profundidad y sobresaliente', () => {
    const p = paramDe('SHELTER_CIMENTACION', 'MICROPILOTE_TOTAL', {
      shelter_micropilote_profundidad: '2.00', shelter_micropilote_sobresaliente: '0.50',
    });
    expect(p.value).toBe('2.50 m');
    expect(p.status).toBe(STATUS.RESOLVED_DERIVED);
  });

  it('UNIDAD_PLANOS es FIXED: sin campo editable y siempre "metros"', () => {
    ESTRUCTURAS.forEach((s) => {
      const p = paramDe(s, 'UNIDAD_PLANOS');
      expect(p.value, s).toBe('metros');
      expect(p.fieldRef, s).toBeNull(); // no navegable = no editable
    });
  });

  it('los parámetros sísmicos del shelter siguen EXCLUIDOS', () => {
    const r = getResolvedTechnicalNotes(proyecto(), 'SHELTER_CIMENTACION');
    const ids = r.parametros.map((p) => p.id);
    ['AMENAZA_SISMICA', 'TIPO_SUELO', 'GRUPO_USO', 'I', 'AA', 'AV', 'FA', 'FV'].forEach((id) => {
      expect(ids, id).not.toContain(id);
    });
    expect(r.secciones.flatMap((s) => s.notas).map((n) => n.noteId)).not.toContain('SHE-002');
    expect(r.textoCompleto).not.toContain('Parámetros sísmicos');
  });
});

describe('geometría del poste — decisión confirmada por el equipo', () => {
  it('embebido, afloramiento, longitud y separación se precargan', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO').value).toBe('0.50 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO').value).toBe('0.50 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_LONGITUD').value).toBe('1.00 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_SEPARACION').value).toBe('2.50 m');
  });

  it('la longitud se marca como derivada, no como default propio', () => {
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_LONGITUD').status).toBe(STATUS.RESOLVED_DERIVED);
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO').status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO').status).toBe(STATUS.RESOLVED_DEFAULT);
  });

  it('la decisión queda registrada para trazabilidad', () => {
    expect(DECISION_POSTE.afloramiento).toBe('0.50 m');
    expect(DECISION_POSTE.longitudDerivada).toBe('1.00 m');
    expect(DECISION_POSTE.valorAnteriorAfloramiento).toBe('2.50 m');
  });

  it('un proyecto con valores propios manda sobre la decisión', () => {
    const p = { cerramiento_poste_anclaje: '0.60', cerramiento_poste_afloramiento: '2.50' };
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO', p).value).toBe('2.50 m');
    expect(paramDe('CERRAMIENTO_PERIMETRAL', 'POSTE_LONGITUD', p).value).toBe('3.10 m');
  });
});

describe('ningún desplegable del catálogo queda sin opciones', () => {
  it('todos los inputs seleccionables ofrecen al menos su propio valor', () => {
    Object.entries(CATEGORIES).forEach(([cid, cat]) => {
      Object.entries(cat.inputs || {}).forEach(([k, input]) => {
        if (input.excluded) return;
        const confirmado = hasConfirmedDefault(cid, k);
        if (!confirmado && input.type === 'project_value') return;
        const opciones = confirmado
          ? [effectiveDefaultFor(cid, k, input.default)]
          : selectableOptionsFor(input, cid, k, cid);
        expect(opciones.length, `${cid}.${k} sin opciones`).toBeGreaterThan(0);
      });
    });
  });

  it('number, number_unit y repository_value ofrecen su valor de catálogo', () => {
    const c = CATEGORIES.CONCRETO.inputs;
    expect(selectableOptionsFor(c.ESPESOR_SOLADO, 'CONCRETO', 'ESPESOR_SOLADO', 'CONCRETO')).toEqual(['5 cm']);
    expect(selectableOptionsFor(c.RELACION_AC_MAX, 'CONCRETO', 'RELACION_AC_MAX', 'CONCRETO')).toEqual(['0.50']);
    const cer = CATEGORIES.CERRAMIENTO_PERIMETRAL.inputs;
    expect(selectableOptionsFor(cer.FY, 'CERRAMIENTO_PERIMETRAL', 'FY', 'CERRAMIENTO_PERIMETRAL')).toEqual(['172 MPa']);
  });

  it('el respaldo no pisa las opciones reales del repositorio', () => {
    const cer = CATEGORIES.CERRAMIENTO_PERIMETRAL.inputs;
    const ops = selectableOptionsFor(cer.POSTE_DIAMETRO, 'CERRAMIENTO_PERIMETRAL', 'POSTE_DIAMETRO', 'CERRAMIENTO_PERIMETRAL');
    expect(ops).toEqual(['Ø 2 in', 'Ø 1 1/2 in']);
  });
});

/* -------------------------------------------------------------- WHITESPACE */

describe('normalizeTechnicalText', () => {
  it.each([
    ['NBSP', 'a b', 'a b'],
    ['narrow NBSP', 'a b', 'a b'],
    ['figure space', 'a b', 'a b'],
    ['thin space', 'a b', 'a b'],
    ['hair space', 'a b', 'a b'],
    ['ideográfico', 'a　b', 'a b'],
    ['zero width', 'a​b', 'ab'],
    ['BOM', 'a﻿b', 'ab'],
    ['tab', 'a\tb', 'a b'],
    ['CRLF', 'a\r\nb', 'a\nb'],
    ['CR suelto', 'a\rb', 'a\nb'],
    ['espacios repetidos', 'a    b', 'a b'],
  ])('%s se normaliza', (_, entrada, esperado) => {
    expect(normalizeTechnicalText(entrada)).toBe(esperado);
  });

  it('los símbolos técnicos se conservan intactos', () => {
    const tecnico = 'Ø 2 in · m² · m³ · f’c · 31.52 μm · 45° · “Z450”';
    expect(normalizeTechnicalText(tecnico)).toBe(tecnico);
  });

  it('preserva los saltos de línea intencionales', () => {
    expect(normalizeTechnicalText('T\n1. a\n2. b\n\nT2\n3. c')).toBe('T\n1. a\n2. b\n\nT2\n3. c');
  });

  it('no toca valores que no son string', () => {
    expect(normalizeTechnicalText(0)).toBe(0);
    expect(normalizeTechnicalText(false)).toBe(false);
    expect(normalizeTechnicalText(null)).toBeNull();
    expect(normalizeTechnicalText(undefined)).toBeUndefined();
  });

  it('es idempotente', () => {
    const sucio = '1.  Nota\r\n2. Otra​';
    expect(normalizeTechnicalText(normalizeTechnicalText(sucio))).toBe(normalizeTechnicalText(sucio));
  });

  it('PORTABILIDAD: el caso contaminado da el resultado esperado', () => {
    expect(normalizeTechnicalText('1.  Nota técnica\r\n2. Nota técnica'))
      .toBe('1. Nota técnica\n2. Nota técnica');
  });
});

describe('las salidas del sistema están libres de whitespace no portable', () => {
  it('el textoCompleto de las cuatro estructuras está limpio', () => {
    ESTRUCTURAS.forEach((s) => {
      const texto = getResolvedTechnicalNotes(proyecto(), s).textoCompleto;
      expect(tieneWhitespaceProblematico(texto), s).toBe(false);
      WHITESPACE_PROHIBIDO.forEach((ch) => expect(texto.includes(ch), `${s} contiene ${JSON.stringify(ch)}`).toBe(false));
    });
  });

  it('un valor de proyecto contaminado se limpia al entrar a la nota', () => {
    const sucio = { cerramiento_malla_especificacion: 'ojo 6 cm x 6 cm, calibre 10.5' };
    const p = paramDe('CERRAMIENTO_PERIMETRAL', 'MALLA', sucio);
    expect(p.value).toBe('ojo 6 cm x 6 cm, calibre 10.5');
    expect(tieneWhitespaceProblematico(p.value)).toBe(false);
  });

  it('limpiar el valor NO modifica lo almacenado', () => {
    const project = proyecto({ cerramiento_malla_especificacion: 'ojo 6 cm' });
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project).toEqual(snapshot);
    expect(project.data.estructural.cerramiento_malla_especificacion).toBe('ojo 6 cm');
  });

  it('un valor con CRLF no rompe la estructura de líneas del texto', () => {
    const texto = getResolvedTechnicalNotes(
      proyecto({ cerramiento_bandit_calibre: '1/2 in\r\n' }), 'CERRAMIENTO_PERIMETRAL'
    ).textoCompleto;
    expect(texto).not.toContain('\r');
    expect(texto).not.toMatch(/\n\n\d+\. /); // sigue sin línea vacía entre notas
  });

  it('el texto del textarea y el que se copia son la misma cadena', () => {
    const r = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL');
    expect(r.textoCompleto).toBe(normalizeTechnicalText(r.textoCompleto));
  });
});
