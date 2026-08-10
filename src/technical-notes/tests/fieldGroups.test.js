/* ============================================================================
   AGRUPACIÓN Y FILTRADO DEL ACORDEÓN "Información para Notas Técnicas"
   ----------------------------------------------------------------------------
   Fijan que cada estructura vea solo sus propios parámetros más los globales,
   que filtrar sea únicamente presentación (nunca borra datos) y que la
   navegación desde un pendiente identifique pestaña + campo.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  FIELD_GROUPS,
  groupsForStructure,
  visibleFieldKeys,
  categoryOfField,
  isTechnicalNotesField,
  requiresAccordion,
  groupToOpenFor,
  allGroupedFieldKeys,
} from '../fieldGroups.js';
import { buildSpec } from '../catalog/bundler.js';
import { getResolvedTechnicalNotes, STATUS } from '../index.js';

const gruposDe = (s) => groupsForStructure(s).map((g) => g.id);
const categoriasDe = (s) => [
  ...new Set(groupsForStructure(s).flatMap((g) => g.subgroups.map((sub) => sub.categoryId || g.categoryId))),
];

describe('grupos por tipo de estructura', () => {
  it('CERRAMIENTO ve General + Cerramiento perimetral', () => {
    expect(gruposDe('CERRAMIENTO_PERIMETRAL')).toEqual(['GENERAL', 'CERRAMIENTO_PERIMETRAL']);
  });

  it('PORTÓN ve General + Portón metálico', () => {
    expect(gruposDe('PORTON_METALICO')).toEqual(['GENERAL', 'PORTON_METALICO']);
  });

  it('SHELTER ve General + Cimentación de shelter', () => {
    expect(gruposDe('SHELTER_CIMENTACION')).toEqual(['GENERAL', 'SHELTER_CIMENTACION']);
  });

  it('SOPORTE DE INVERSORES ve General + Soporte de inversores', () => {
    expect(gruposDe('SOPORTE_INVERSORES')).toEqual(['GENERAL', 'SOPORTE_INVERSORES']);
  });

  it('General aparece SIEMPRE, sea cual sea la estructura', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      expect(gruposDe(s), s).toContain('GENERAL');
    });
  });

  it('nunca se muestran dos estructuras específicas a la vez', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const especificos = gruposDe(s).filter((id) => id !== 'GENERAL');
      expect(especificos, s).toEqual([s]);
    });
  });

  it('la visibilidad coincide con el bundle del manifest (una sola fuente)', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const bundle = buildSpec(s).categories.map((c) => c.id);
      categoriasDe(s).forEach((cid) => expect(bundle, `${s} / ${cid}`).toContain(cid));
    });
  });

  it('dentro de General, el galvanizado (METAL) solo donde METAL está en el bundle', () => {
    const subgruposDe = (s) => groupsForStructure(s).find((g) => g.id === 'GENERAL').subgroups.map((x) => x.label);
    expect(subgruposDe('CERRAMIENTO_PERIMETRAL')).toContain('Galvanizado en frío');
    expect(subgruposDe('PORTON_METALICO')).toContain('Galvanizado en frío');
    expect(subgruposDe('SHELTER_CIMENTACION')).not.toContain('Galvanizado en frío');
    expect(subgruposDe('SOPORTE_INVERSORES')).not.toContain('Galvanizado en frío');
  });
});

describe('aislamiento: ninguna estructura ve campos de otra', () => {
  const EXCLUSIVOS = {
    CERRAMIENTO_PERIMETRAL: ['cerramiento_poste_diametro', 'cerramiento_bandit_calibre', 'cerramiento_acero_fy'],
    PORTON_METALICO: ['porton_acero_norma', 'porton_viga_amarre_seccion', 'porton_perfil_embebido'],
    SHELTER_CIMENTACION: ['shelter_cota_minima', 'shelter_carga_viento', 'shelter_micropilote_profundidad'],
    SOPORTE_INVERSORES: ['inversores_manual_cargas', 'inversores_fc_ciclopeo'],
  };

  it('Cerramiento no muestra campos exclusivos de Portón', () => {
    const visibles = visibleFieldKeys('CERRAMIENTO_PERIMETRAL');
    EXCLUSIVOS.PORTON_METALICO.forEach((k) => expect(visibles, k).not.toContain(k));
  });

  it('Portón no muestra campos exclusivos de Cerramiento', () => {
    const visibles = visibleFieldKeys('PORTON_METALICO');
    EXCLUSIVOS.CERRAMIENTO_PERIMETRAL.forEach((k) => expect(visibles, k).not.toContain(k));
  });

  it('Shelter no muestra campos de Cerramiento ni de Portón', () => {
    const visibles = visibleFieldKeys('SHELTER_CIMENTACION');
    [...EXCLUSIVOS.CERRAMIENTO_PERIMETRAL, ...EXCLUSIVOS.PORTON_METALICO].forEach((k) => {
      expect(visibles, k).not.toContain(k);
    });
  });

  it('Inversores no muestra campos de Cerramiento', () => {
    const visibles = visibleFieldKeys('SOPORTE_INVERSORES');
    EXCLUSIVOS.CERRAMIENTO_PERIMETRAL.forEach((k) => expect(visibles, k).not.toContain(k));
  });

  it('cada estructura sí muestra los suyos', () => {
    Object.entries(EXCLUSIVOS).forEach(([structure, claves]) => {
      const visibles = visibleFieldKeys(structure);
      claves.forEach((k) => expect(visibles, `${structure} / ${k}`).toContain(k));
    });
  });
});

describe('campos globales', () => {
  const GLOBALES_CONCRETO = ['concreto_solado_fc', 'acero_refuerzo_norma', 'acero_refuerzo_fy', 'recubrimiento_tierra'];

  it('los de Concreto aparecen en las cuatro estructuras', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const visibles = visibleFieldKeys(s);
      GLOBALES_CONCRETO.forEach((k) => expect(visibles, `${s} / ${k}`).toContain(k));
    });
  });

  it('los de Metal solo donde el bundle incluye METAL', () => {
    expect(visibleFieldKeys('CERRAMIENTO_PERIMETRAL')).toContain('galvanizado_frio_zinc');
    expect(visibleFieldKeys('PORTON_METALICO')).toContain('galvanizado_frio_zinc');
    expect(visibleFieldKeys('SHELTER_CIMENTACION')).not.toContain('galvanizado_frio_zinc');
    expect(visibleFieldKeys('SOPORTE_INVERSORES')).not.toContain('galvanizado_frio_zinc');
  });
});

describe('sin tipo de estructura seleccionado', () => {
  it('solo se muestra General, y dentro solo las categorías comunes a TODOS los bundles', () => {
    expect(gruposDe(null)).toEqual(['GENERAL']);
    expect(gruposDe(undefined)).toEqual(['GENERAL']);
    expect(categoriasDe(null)).toEqual(['CONCRETO']);
  });

  it('no se mezcla ningún campo específico de estructura', () => {
    const visibles = visibleFieldKeys(null);
    ['cerramiento_poste_diametro', 'porton_acero_norma', 'shelter_cota_minima', 'inversores_fc_ciclopeo']
      .forEach((k) => expect(visibles, k).not.toContain(k));
  });

  it('los globales de concreto sí siguen disponibles', () => {
    expect(visibleFieldKeys(null)).toContain('concreto_solado_fc');
    expect(visibleFieldKeys(null)).toContain('acero_refuerzo_norma');
  });
});

describe('subgrupos', () => {
  it('cerramiento organiza sus campos en subtítulos legibles', () => {
    const cer = groupsForStructure('CERRAMIENTO_PERIMETRAL').find((g) => g.id === 'CERRAMIENTO_PERIMETRAL');
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
      g.subgroups.forEach((s) => expect(s.fieldKeys.length, `${g.categoryId}/${s.label}`).toBeGreaterThan(0));
    });
  });
});

describe('navegación desde un pendiente', () => {
  it('cada pendiente identifica pestaña y campo destino', () => {
    const resolved = getResolvedTechnicalNotes({ id: 'x', data: {} }, 'CERRAMIENTO_PERIMETRAL');
    const pendiente = resolved.pendientes.find((p) => p.id === 'DIAGONAL_LONGITUD');
    expect(pendiente.status).toBe(STATUS.PENDING);
    expect(pendiente.fieldRef.tab).toBe('estructural');
    expect(pendiente.fieldRef.fieldKey).toBe('cerramiento_diagonales_longitud');
  });

  it('todos los pendientes con campo editable traen tab + fieldKey', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
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

  it('navegar a un campo de dominio normal NO exige abrir el acordeón', () => {
    // Estos se editan fuera del acordeón, en su sitio de siempre.
    expect(requiresAccordion('dim_ciment_cerramiento')).toBe(false);
    expect(requiresAccordion('tipo_galvanizado')).toBe(false);
    expect(requiresAccordion('capacidad_admisible_cerramiento')).toBe(false);
  });

  it('el campo destino del pendiente pertenece a un grupo visible en esa estructura', () => {
    const resolved = getResolvedTechnicalNotes({ id: 'x', data: {} }, 'CERRAMIENTO_PERIMETRAL');
    const visibles = visibleFieldKeys('CERRAMIENTO_PERIMETRAL');
    resolved.pendientes
      .filter((p) => p.fieldRef?.tab === 'estructural' && isTechnicalNotesField(p.fieldRef.fieldKey))
      .forEach((p) => expect(visibles, p.id).toContain(p.fieldRef.fieldKey));
  });
});

describe('el filtrado es solo presentación', () => {
  it('agrupar/filtrar no modifica projects.data', () => {
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
    groupsForStructure('CERRAMIENTO_PERIMETRAL');
    visibleFieldKeys('CERRAMIENTO_PERIMETRAL');
    requiresAccordion('cerramiento_poste_diametro');
    expect(project).toEqual(snapshot);
  });

  it('cambiar de estructura no elimina los datos de las otras', () => {
    const data = {
      cerramiento_poste_diametro: 'Ø 2 in',
      porton_acero_norma: 'ASTM A500 Grado C',
      shelter_cota_minima: '50 cm',
      inversores_fc_ciclopeo: '17.5 MPa',
    };
    const snapshot = structuredClone(data);
    // Se "cambia" de estructura varias veces: solo cambia qué se muestra.
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES', null]
      .forEach((s) => visibleFieldKeys(s));
    expect(data).toEqual(snapshot);
    expect(data.porton_acero_norma).toBe('ASTM A500 Grado C');
    expect(data.shelter_cota_minima).toBe('50 cm');
  });

  it('los valores de estructuras ocultas se siguen resolviendo si se vuelve a ellas', () => {
    const project = {
      id: 'p',
      data: { estructural: { porton_acero_norma: 'ASTM A572 Gr 50', cerramiento_poste_diametro: 'Ø 3 in' } },
    };
    // Con cerramiento activo, los campos de portón no se muestran…
    expect(visibleFieldKeys('CERRAMIENTO_PERIMETRAL')).not.toContain('porton_acero_norma');
    // …pero su valor sigue intacto y resuelve al cambiar de estructura.
    const porton = getResolvedTechnicalNotes(project, 'PORTON_METALICO');
    expect(porton.parametros.find((p) => p.id === 'ACERO').value).toBe('ASTM A572 Gr 50');
    const cerramiento = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(cerramiento.parametros.find((p) => p.id === 'POSTE_DIAMETRO').value).toBe('Ø 3 in');
  });
});
