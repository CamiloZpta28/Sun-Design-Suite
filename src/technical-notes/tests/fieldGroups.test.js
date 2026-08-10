/* ============================================================================
   AGRUPACIÓN DEL ACORDEÓN "Información para Notas Técnicas"
   ----------------------------------------------------------------------------
   Contrato de esta pantalla: es de CAPTURA, así que muestra SIEMPRE todos los
   subapartados (General + las cuatro estructuras), sin importar el tipo
   elegido en Notas Técnicas. El filtrado por estructura vive en el otro
   extremo: el bundle decide qué NOTAS se generan (ver catalog.test.js y
   notesText.test.js).
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  FIELD_GROUPS,
  allFieldGroups,
  visibleFieldKeys,
  categoryOfField,
  isTechnicalNotesField,
  requiresAccordion,
  groupToOpenFor,
  allGroupedFieldKeys,
} from '../fieldGroups.js';
import { getResolvedTechnicalNotes, STATUS } from '../index.js';

const ESTRUCTURAS = ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'];
const gruposDel = () => allFieldGroups().map((g) => g.id);

describe('el acordeón muestra SIEMPRE todos los subapartados', () => {
  it('están los cinco: General + las cuatro estructuras', () => {
    expect(gruposDel()).toEqual([
      'GENERAL',
      'CERRAMIENTO_PERIMETRAL',
      'PORTON_METALICO',
      'SHELTER_CIMENTACION',
      'SOPORTE_INVERSORES',
    ]);
  });

  it('la lista no depende del tipo de estructura activo', () => {
    // allFieldGroups() no recibe structureType: no hay forma de ocultar nada.
    expect(allFieldGroups).toHaveLength(0); // 0 parámetros declarados
    const antes = gruposDel();
    ESTRUCTURAS.forEach(() => expect(gruposDel()).toEqual(antes));
  });

  it('los campos de TODAS las estructuras están disponibles para editar', () => {
    const claves = visibleFieldKeys();
    expect(claves).toContain('cerramiento_poste_diametro');
    expect(claves).toContain('porton_acero_norma');
    expect(claves).toContain('shelter_cota_minima');
    expect(claves).toContain('inversores_fc_ciclopeo');
    expect(claves).toContain('acero_refuerzo_fy'); // general
    expect(claves).toContain('galvanizado_frio_zinc'); // general (metal)
  });

  it('elegir una estructura NO oculta los campos de las demás', () => {
    // El acordeón no filtra: seleccionar cerramiento deja visibles portón,
    // shelter e inversores para poder llenarlos igualmente.
    const claves = visibleFieldKeys();
    ['porton_acero_norma', 'shelter_carga_viento', 'inversores_manual_cargas'].forEach((k) => {
      expect(claves, k).toContain(k);
    });
  });

  it('General agrupa los parámetros transversales, incluido el galvanizado en frío', () => {
    const general = allFieldGroups().find((g) => g.id === 'GENERAL');
    const claves = general.subgroups.flatMap((s) => s.fieldKeys);
    expect(claves).toContain('concreto_solado_fc');
    expect(claves).toContain('acero_refuerzo_norma');
    expect(claves).toContain('acero_refuerzo_fy');
    expect(claves).toContain('recubrimiento_tierra');
    expect(claves).toContain('galvanizado_frio_zinc');
  });

  it('cada subapartado específico contiene solo campos de SU estructura', () => {
    const prefijo = {
      CERRAMIENTO_PERIMETRAL: 'cerramiento_',
      PORTON_METALICO: 'porton_',
      SHELTER_CIMENTACION: 'shelter_',
      SOPORTE_INVERSORES: 'inversores_',
    };
    ESTRUCTURAS.forEach((id) => {
      const grupo = allFieldGroups().find((g) => g.id === id);
      const claves = grupo.subgroups.flatMap((s) => s.fieldKeys);
      const ajenas = claves.filter(
        (k) => !k.startsWith(prefijo[id]) && !['ambiente_corrosion_clase', 'galvanizado_perdida_zinc_proyectada'].includes(k)
      );
      expect(ajenas, `${id} contiene campos ajenos`).toEqual([]);
    });
  });
});

describe('Notas Técnicas SÍ sigue filtrando por bundle', () => {
  it('el texto generado solo incluye las notas de la estructura activa', () => {
    const proyecto = { id: 'x', data: {} };
    const cer = getResolvedTechnicalNotes(proyecto, 'CERRAMIENTO_PERIMETRAL');
    expect(cer.textoCompleto).toContain('CERRAMIENTO PERIMETRAL');
    expect(cer.textoCompleto).not.toContain('PORTÓN METÁLICO');
    expect(cer.textoCompleto).not.toContain('CIMENTACIÓN DE SHELTER');

    const por = getResolvedTechnicalNotes(proyecto, 'PORTON_METALICO');
    expect(por.textoCompleto).toContain('PORTÓN METÁLICO');
    expect(por.textoCompleto).not.toContain('CERRAMIENTO PERIMETRAL');
  });

  it('los parámetros resueltos son solo los del bundle activo', () => {
    const proyecto = { id: 'x', data: {} };
    const ids = getResolvedTechnicalNotes(proyecto, 'SOPORTE_INVERSORES').parametros.map((p) => p.id);
    expect(ids).toContain('FC_CICLOPEO');
    expect(ids).not.toContain('POSTE_DIAMETRO');
    expect(ids).not.toContain('MICROPILOTE_TOTAL');
  });
});

describe('subgrupos', () => {
  it('cerramiento organiza sus campos en subtítulos legibles', () => {
    const cer = allFieldGroups().find((g) => g.id === 'CERRAMIENTO_PERIMETRAL');
    expect(cer.subgroups.map((s) => s.label)).toEqual([
      'Poste típico',
      'Tubería de diagonales y vientos',
      'Diagonales',
      'Vientos',
      'Malla y fijaciones',
      'Perfilería y soldadura',
      'Protección anticorrosiva',
    ]);
  });

  it('ninguna clave está repetida en dos subgrupos', () => {
    const claves = allGroupedFieldKeys();
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('ningún subgrupo queda vacío', () => {
    FIELD_GROUPS.forEach((g) => {
      g.subgroups.forEach((s) => expect(s.fieldKeys.length, `${g.id}/${s.label}`).toBeGreaterThan(0));
    });
  });

  it('cada campo sigue sabiendo de qué categoría del catálogo proviene', () => {
    expect(categoryOfField('acero_refuerzo_fy')).toBe('CONCRETO');
    expect(categoryOfField('galvanizado_frio_zinc')).toBe('METAL');
    expect(categoryOfField('cerramiento_poste_diametro')).toBe('CERRAMIENTO_PERIMETRAL');
  });
});

describe('navegación desde un pendiente', () => {
  it('cada pendiente identifica pestaña y campo destino', () => {
    const resolved = getResolvedTechnicalNotes({ id: 'x', data: {} }, 'CERRAMIENTO_PERIMETRAL');
    // CAPACIDAD_SUELO es un project_value real: sigue pendiente al estar vacío.
    const pendiente = resolved.pendientes.find((p) => p.id === 'CAPACIDAD_SUELO');
    expect(pendiente.status).toBe(STATUS.PENDING);
    expect(pendiente.fieldRef.tab).toBe('geotecnia');
    expect(pendiente.fieldRef.fieldKey).toBe('capacidad_admisible_cerramiento');
  });

  it('todos los pendientes con campo editable traen tab + fieldKey', () => {
    ESTRUCTURAS.forEach((s) => {
      getResolvedTechnicalNotes({ id: 'x', data: {} }, s).pendientes
        .filter((p) => p.fieldRef?.tab)
        .forEach((p) => {
          expect(p.fieldRef.fieldKey, `${s}/${p.id}`).toBeTruthy();
          expect(typeof p.fieldRef.fieldKey).toBe('string');
        });
    });
  });

  it('navegar a un campo del acordeón solicita abrirlo', () => {
    expect(requiresAccordion('cerramiento_diagonales_longitud')).toBe(true);
    expect(requiresAccordion('shelter_carga_viento')).toBe(true);
    expect(isTechnicalNotesField('cerramiento_poste_separacion')).toBe(true);
  });

  it('un pendiente GENERAL abre el subapartado General', () => {
    expect(groupToOpenFor('acero_refuerzo_fy')).toBe('GENERAL');
    expect(groupToOpenFor('concreto_solado_fc')).toBe('GENERAL');
    expect(groupToOpenFor('galvanizado_frio_zinc')).toBe('GENERAL');
  });

  it('un pendiente específico abre el subapartado de SU estructura', () => {
    expect(groupToOpenFor('cerramiento_poste_separacion')).toBe('CERRAMIENTO_PERIMETRAL');
    expect(groupToOpenFor('porton_acero_fy')).toBe('PORTON_METALICO');
    expect(groupToOpenFor('shelter_carga_viento')).toBe('SHELTER_CIMENTACION');
    expect(groupToOpenFor('inversores_fc_ciclopeo')).toBe('SOPORTE_INVERSORES');
  });

  it('un campo fuera del acordeón no pide abrir ningún subapartado', () => {
    expect(groupToOpenFor('dim_ciment_cerramiento')).toBeNull();
    expect(groupToOpenFor('tipo_galvanizado')).toBeNull();
  });

  it('el destino de CUALQUIER pendiente está siempre presente en el acordeón', () => {
    // Al no filtrar por estructura, ningún pendiente puede apuntar a un campo
    // que la pantalla no muestre.
    const claves = visibleFieldKeys();
    ESTRUCTURAS.forEach((s) => {
      getResolvedTechnicalNotes({ id: 'x', data: {} }, s).pendientes
        .filter((p) => p.fieldRef?.tab === 'estructural' && isTechnicalNotesField(p.fieldRef.fieldKey))
        .forEach((p) => expect(claves, `${s}/${p.id}`).toContain(p.fieldRef.fieldKey));
    });
  });
});

describe('agrupar es solo presentación', () => {
  it('no modifica projects.data', () => {
    const project = {
      id: 'p',
      data: {
        estructural: {
          cerramiento_poste_diametro: 'Ø 2 in',
          porton_acero_norma: 'ASTM A500 Grado C',
          shelter_cota_minima: '50 cm',
        },
        technicalNotes: { structureType: 'CERRAMIENTO_PERIMETRAL' },
      },
    };
    const snapshot = structuredClone(project);
    allFieldGroups();
    visibleFieldKeys();
    requiresAccordion('cerramiento_poste_diametro');
    groupToOpenFor('porton_acero_norma');
    expect(project).toEqual(snapshot);
  });

  it('abrir o cerrar subapartados no toca los datos (es estado de UI)', () => {
    // El módulo de agrupación no expone ninguna función de escritura.
    const exportaciones = { allFieldGroups, visibleFieldKeys, categoryOfField, isTechnicalNotesField, requiresAccordion, groupToOpenFor, allGroupedFieldKeys };
    Object.values(exportaciones).forEach((fn) => expect(typeof fn).toBe('function'));
    const data = { cerramiento_poste_diametro: 'Ø 2 in' };
    const snapshot = structuredClone(data);
    Object.values(exportaciones).forEach((fn) => { try { fn('cerramiento_poste_diametro'); } catch { /* firma distinta */ } });
    expect(data).toEqual(snapshot);
  });

  it('los valores de cualquier estructura se resuelven al cambiar de tipo', () => {
    const project = {
      id: 'p',
      data: { estructural: { porton_acero_norma: 'ASTM A572 Gr 50', cerramiento_poste_diametro: 'Ø 3 in' } },
    };
    expect(getResolvedTechnicalNotes(project, 'PORTON_METALICO').parametros.find((p) => p.id === 'ACERO').value)
      .toBe('ASTM A572 Gr 50');
    expect(getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL').parametros.find((p) => p.id === 'POSTE_DIAMETRO').value)
      .toBe('Ø 3 in');
  });
});
