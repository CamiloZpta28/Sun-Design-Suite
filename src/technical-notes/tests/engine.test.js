import { describe, it, expect } from 'vitest';
import { getResolvedTechnicalNotes, STATUS } from '../index.js';
import { resolveTechnicalNotes, extractPlaceholderIds, isResolvedStatus } from '../engine.js';

/* Proyecto de prueba: por defecto TODO vacío, para que cada test declare
   explícitamente qué datos existen. `data` imita la forma real de
   projects.data (una clave por pestaña de SCHEMA + technicalNotes). */
function buildProject({ estructural = {}, geotecnia = {}, technicalNotes = {} } = {}) {
  return {
    id: 'proj-test',
    data: {
      geotecnia,
      estructural,
      technicalNotes,
    },
  };
}

function paramOf(resolved, id) {
  return resolved.parametros.find((p) => p.id === id);
}

describe('motor — comportamiento genérico', () => {
  it('extractPlaceholderIds encuentra los IDs únicos en orden de aparición', () => {
    expect(extractPlaceholderIds('{{A}} y {{B}} y {{A}} otra vez')).toEqual(['A', 'B']);
  });

  it('nunca deja un {{PLACEHOLDER}} crudo visible: muestra "Pendiente: <etiqueta>"', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    resolved.secciones.forEach((s) =>
      s.notas.forEach((n) => {
        expect(n.textoResuelto).not.toContain('{{');
        expect(n.textoResuelto).not.toContain('}}');
      })
    );
    const cer002 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-002');
    expect(cer002.textoResuelto).toContain('Pendiente');
  });

  it('un placeholder sin resolver declarado se reporta UNKNOWN (error de catálogo, no de datos)', () => {
    const spec = {
      id: 'FAKE',
      label: 'Fake',
      notes: [{ note_id: 'X-1', text: 'Valor: {{NO_EXISTE}}.', categoryId: 'C', categoryLabel: 'C' }],
      resolvers: {},
    };
    const resolved = resolveTechnicalNotes(buildProject(), spec);
    expect(paramOf(resolved, 'NO_EXISTE').status).toBe(STATUS.UNKNOWN);
  });

  it('el mismo ID usado en varias notas se resuelve una vez y produce el mismo valor', () => {
    const project = buildProject({ estructural: { cerramiento_poste_diametro: 'Ø 3 in' } });
    const resolved = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(paramOf(resolved, 'POSTE_DIAMETRO').value).toBe('Ø 3 in');
    const cer004 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-004');
    expect(cer004.textoResuelto).toContain('Ø 3 in');
  });
});

describe('jerarquía de valores: proyecto > usuario > default', () => {
  it('repository_select vacío usa el default del catálogo y lo marca RESOLVED_DEFAULT', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    const p = paramOf(resolved, 'POSTE_DIAMETRO');
    expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(p.value).toBe('Ø 2 in');
  });

  it('un valor del proyecto gana sobre el default y se marca RESOLVED_PROJECT', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_diametro: 'Ø 2 1/2 in' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramOf(resolved, 'POSTE_DIAMETRO');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
    expect(p.value).toBe('Ø 2 1/2 in');
  });

  it('un override de Notas Técnicas (sin campo de dominio) se marca RESOLVED_USER', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ technicalNotes: { overrides: { IMPERMEABILIZACION_JUNTAS: { IMPERMEABILIZANTE: 'Producto X o equivalente' } } } }),
      'SHELTER_CIMENTACION'
    );
    const p = paramOf(resolved, 'IMPERMEABILIZANTE');
    expect(p.status).toBe(STATUS.RESOLVED_USER);
    expect(p.value).toBe('Producto X o equivalente');
  });

  it('override vacío cae al default del catálogo', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'SHELTER_CIMENTACION');
    const p = paramOf(resolved, 'IMPERMEABILIZANTE');
    expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(p.value).toBe('SikaTop-107 Seal CO o equivalente');
  });
});

describe('project_value — el default es referencia, NUNCA valor adoptado', () => {
  it('capacidad del suelo sin dato queda PENDING, aunque el catálogo traiga un default', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    const p = paramOf(resolved, 'CAPACIDAD_SUELO');
    expect(p.status).toBe(STATUS.PENDING);
    expect(p.value).toBeNull();
    // …pero el valor de la memoria viaja como sugerencia para la UI.
    expect(p.suggested).toBe('23.05 kN (2.35 ton)');
  });

  it('el texto de la nota NO contiene el default de un project_value pendiente', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    const cer002 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-002');
    expect(cer002.textoResuelto).not.toContain('23.05');
    expect(cer002.completa).toBe(false);
  });

  it('con dato del proyecto, el mismo parámetro pasa a RESOLVED_PROJECT', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ geotecnia: { capacidad_admisible_cerramiento: '18.40 kN' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramOf(resolved, 'CAPACIDAD_SUELO');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
    expect(p.value).toBe('18.40 kN');
  });

  it('los tres project_value de soporte de inversores quedan pendientes con su referencia', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'SOPORTE_INVERSORES');
    expect(paramOf(resolved, 'FC_FUNDACION').status).toBe(STATUS.PENDING);
    expect(paramOf(resolved, 'FC_FUNDACION').suggested).toBe('28 MPa');
    expect(paramOf(resolved, 'FC_CICLOPEO').status).toBe(STATUS.PENDING);
    expect(paramOf(resolved, 'FC_CICLOPEO').suggested).toBe('17.5 MPa');
    expect(paramOf(resolved, 'MANUAL_CARGAS').status).toBe(STATUS.PENDING);
    const inv002 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'INV-002');
    expect(inv002.textoResuelto).not.toContain('28 MPa');
  });

  it('los project_value de shelter no se adoptan solos', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'SHELTER_CIMENTACION');
    ['COTA_MINIMA', 'CAP_PORTANTE', 'CM_TOTAL', 'VIENTO'].forEach((id) => {
      expect(paramOf(resolved, id).status, id).toBe(STATUS.PENDING);
    });
  });
});

describe('valores existentes nunca se sustituyen (proyecto antiguo)', () => {
  it('acero "ASTM A615" de un proyecto viejo se conserva, no se reemplaza por el del repositorio', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_acero_norma: 'ASTM A615' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramOf(resolved, 'ACERO');
    expect(p.value).toBe('ASTM A615');
    expect(p.value).not.toBe('NTC 1560 / ASTM A1011');
    expect(p.status).toBe(STATUS.RESOLVED_PROJECT);
    const cer009 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-009');
    expect(cer009.textoResuelto).toContain('ASTM A615');
    expect(cer009.textoResuelto).not.toContain('NTC 1560');
  });

  it('un valor custom sobrevive a la "recarga": releer los mismos datos lo reconstruye igual', () => {
    const project = buildProject({ estructural: { cerramiento_acero_norma: 'ASTM A572 Gr 50' } });
    const primera = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    const segunda = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(segunda.textoCompleto).toBe(primera.textoCompleto);
    expect(paramOf(segunda, 'ACERO').value).toBe('ASTM A572 Gr 50');
  });

  it('volver del valor custom a la opción estándar guarda solo el valor final (un único campo)', () => {
    const custom = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_acero_norma: 'ASTM A615' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const estandar = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_acero_norma: 'NTC 1560 / ASTM A1011' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(paramOf(custom, 'ACERO').value).toBe('ASTM A615');
    expect(paramOf(estandar, 'ACERO').value).toBe('NTC 1560 / ASTM A1011');
  });
});

describe('valores límite', () => {
  it('0 es un valor válido, no "vacío"', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_anclaje: 0 } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramOf(resolved, 'POSTE_EMBEBIDO');
    expect(isResolvedStatus(p.status)).toBe(true);
    expect(p.value).toBe('0.00 m'); // no cae al default "0.50 m"
  });

  it('false es un valor válido, no "vacío"', () => {
    const spec = {
      id: 'FAKE',
      label: 'Fake',
      notes: [{ note_id: 'X-1', text: 'Bandera: {{FLAG}}.', categoryId: 'C', categoryLabel: 'C' }],
      resolvers: {
        FLAG: {
          id: 'FLAG',
          label: 'Bandera',
          fieldRef: null,
          resolve: (d) => (d?.estructural?.flag === undefined
            ? { status: STATUS.PENDING, value: null }
            : { status: STATUS.RESOLVED_PROJECT, value: d.estructural.flag ? 'Sí' : 'No' }),
        },
      },
    };
    const resolved = resolveTechnicalNotes(buildProject({ estructural: { flag: false } }), spec);
    expect(paramOf(resolved, 'FLAG').status).toBe(STATUS.RESOLVED_PROJECT);
    expect(paramOf(resolved, 'FLAG').value).toBe('No');
  });
});

describe('resolución en vivo', () => {
  it('cambiar el diámetro del poste cambia inmediatamente el texto de CER-004', () => {
    const antes = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    const despues = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_diametro: 'Ø 2 1/2 in' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const notaDe = (r) => r.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'CER-004').textoResuelto;
    expect(notaDe(antes)).toContain('Ø 2 in');
    expect(notaDe(despues)).toContain('Ø 2 1/2 in');
    expect(notaDe(antes)).not.toBe(notaDe(despues));
  });

  it('el motor no guarda texto: no expone ningún campo persistible de notas resueltas', () => {
    const project = buildProject();
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    // El proyecto no fue mutado por resolver sus notas.
    expect(project.data.technicalNotes).toEqual({});
  });
});

describe('parámetros dependientes de la estructura activa', () => {
  it("FC_ESTRUCTURAL lee la cimentación de la estructura activa (cerramiento vs portón)", () => {
    const project = buildProject({
      estructural: {
        dim_ciment_cerramiento: { resistencia: '25 MPa' },
        dim_ciment_porton: { resistencia: '31 MPa' },
      },
    });
    expect(paramOf(getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL'), 'FC_ESTRUCTURAL').value).toBe('25 MPa');
    expect(paramOf(getResolvedTechnicalNotes(project, 'PORTON_METALICO'), 'FC_ESTRUCTURAL').value).toBe('31 MPa');
  });

  it('si esa cimentación no tiene resistencia, FC_ESTRUCTURAL cae al default global (21 MPa)', () => {
    const p = paramOf(getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL'), 'FC_ESTRUCTURAL');
    expect(p.status).toBe(STATUS.RESOLVED_DEFAULT);
    expect(p.value).toBe('21 MPa');
  });
});

describe('parámetros derivados', () => {
  it('POSTE_LONGITUD suma anclaje + afloramiento del proyecto', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_anclaje: '0.50', cerramiento_poste_afloramiento: '2.50' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(paramOf(resolved, 'POSTE_LONGITUD').value).toBe('3.00 m');
  });

  it('POSTE_LONGITUD deriva de los defaults confirmados cuando el proyecto no trae dato', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_anclaje: '0.50' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    const p = paramOf(resolved, 'POSTE_LONGITUD');
    // 0.50 del proyecto + 0.50 del default confirmado de afloramiento.
    expect(p.status).toBe(STATUS.RESOLVED_DERIVED);
    expect(p.value).toBe('1.00 m');
  });

  it('POSTE_LONGITUD nunca cae al "3.00 m" del catálogo: siempre es la suma real', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { cerramiento_poste_afloramiento: '2.50' } }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(paramOf(resolved, 'POSTE_LONGITUD').value).toBe('3.00 m'); // 0.50 + 2.50, no el default
  });

  it('MICROPILOTE_TOTAL suma profundidad + sobresaliente', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { shelter_micropilote_profundidad: '2.00', shelter_micropilote_sobresaliente: '0.50' } }),
      'SHELTER_CIMENTACION'
    );
    expect(paramOf(resolved, 'MICROPILOTE_TOTAL').value).toBe('2.50 m');
  });

  it('ZAPATA del portón se arma con ancho y profundo de dim_ciment_porton', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({ estructural: { dim_ciment_porton: { ancho_zapata: '1.00', profundo_zapata: '1.00' } } }),
      'PORTON_METALICO'
    );
    expect(paramOf(resolved, 'ZAPATA').value).toBe('1.00 m x 1.00 m');
  });
});

describe('completitud', () => {
  it('un proyecto vacío tiene completitud < 100% y lista pendientes reales', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.completitud.porcentaje).toBeLessThan(100);
    expect(resolved.pendientes.length).toBeGreaterThan(0);
    expect(resolved.pendientes.map((p) => p.id)).toContain('CAPACIDAD_SUELO');
  });

  it('los parámetros EXCLUIDOS no cuentan para la completitud ni aparecen como pendientes', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'SHELTER_CIMENTACION');
    const ids = resolved.pendientes.map((p) => p.id);
    ['AMENAZA_SISMICA', 'TIPO_SUELO', 'GRUPO_USO', 'I', 'AA', 'AV', 'FA', 'FV'].forEach((id) => {
      expect(ids, id).not.toContain(id);
    });
    // Ningún parámetro sísmico llega siquiera a resolverse: SHE-002 no se emite.
    expect(resolved.parametros.some((p) => p.id === 'AA')).toBe(false);
  });

  it('completitud llega a 100% cuando todos los parámetros requeridos tienen valor', () => {
    const resolved = getResolvedTechnicalNotes(
      buildProject({
        geotecnia: { capacidad_admisible_cerramiento: '23.05 kN (2.35 ton)' },
        estructural: {
          dim_ciment_cerramiento: { diametro: '0.30', desplante: '0.80', resistencia: '21 MPa' },
          concreto_solado_fc: '14 MPa',
          concreto_solado_espesor: '5 cm',
          acero_refuerzo_fy: '420 MPa',
          agregado_tamano_max: '1 in',
          recubrimiento_tierra: '7.5 cm',
          recubrimiento_no_tierra: '5 cm',
          tipo_galvanizado: 'Z450',
          galvanizado_frio_zinc: '92 %',
          galvanizado_frio_capas: '4',
          cerramiento_poste_diametro: 'Ø 2 in',
          cerramiento_poste_espesor: '1.50 mm',
          cerramiento_poste_anclaje: '0.50',
          cerramiento_poste_afloramiento: '2.50',
          cerramiento_poste_separacion: '2.50 m',
          cerramiento_tubo_secundario_diametro: 'Ø 1 1/2 in',
          cerramiento_tubo_secundario_espesor: '1.90 mm',
          cerramiento_diagonales_longitud: '3.40 m',
          cerramiento_diagonales_separacion: '12.50 m',
          cerramiento_vientos_longitud: '3.62 m',
          cerramiento_vientos_separacion: '25 m',
          cerramiento_malla_especificacion: 'ojo 6 cm x 6 cm, calibre 10.5, altura 2.00 m',
          cerramiento_bandit_calibre: '1/2 in',
          cerramiento_fijacion_separacion: '50 cm',
          cerramiento_acero_norma: 'NTC 1560 / ASTM A1011',
          cerramiento_acero_fy: '172 MPa',
          cerramiento_acero_fu: '303 MPa',
          cerramiento_soldadura_espesor: '3 mm',
          ambiente_corrosion_clase: 'C3',
        },
      }),
      'CERRAMIENTO_PERIMETRAL'
    );
    expect(resolved.pendientes).toEqual([]);
    expect(resolved.completitud.porcentaje).toBe(100);
    expect(resolved.secciones.flatMap((s) => s.notas).every((n) => n.completa)).toBe(true);
  });
});

describe('presentación', () => {
  it('las notas se agrupan por categoría en el orden del bundle', () => {
    const resolved = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.secciones.map((s) => s.categoryId)).toEqual([
      'GENERAL', 'CONCRETO', 'METAL', 'CERRAMIENTO_PERIMETRAL',
    ]);
  });
});

describe('numeración de presentación', () => {
  it('es continua a lo largo de todas las secciones, sin reiniciar por categoría', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const notas = getResolvedTechnicalNotes(buildProject(), s).secciones.flatMap((sec) => sec.notas);
      expect(notas.map((n) => n.numero), s).toEqual(notas.map((_, i) => i + 1));
    });
  });

  it('empieza en 1 y la primera nota de la segunda sección continúa la cuenta', () => {
    const secciones = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL').secciones;
    expect(secciones[0].notas[0].numero).toBe(1);
    // GENERAL trae 3 notas -> CONCRETO debe empezar en 4, no en 1.
    expect(secciones[0].notas).toHaveLength(3);
    expect(secciones[1].notas[0].numero).toBe(4);
  });

  it('los note_id internos se conservan intactos junto al número', () => {
    const notas = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL').secciones.flatMap((s) => s.notas);
    expect(notas[0].noteId).toBe('GEN-001');
    expect(notas.find((n) => n.numero === 4).noteId).toBe('CON-001');
    expect(notas.every((n) => /^[A-Z]{3}-\d{3}$/.test(n.noteId))).toBe(true);
  });

  it('el texto exportable usa la numeración continua, no los códigos internos', () => {
    const { textoCompleto } = getResolvedTechnicalNotes(buildProject(), 'CERRAMIENTO_PERIMETRAL');
    expect(textoCompleto).toContain('1. Las dimensiones están dadas en');
    expect(textoCompleto).not.toContain('GEN-001');
    expect(textoCompleto).not.toContain('CER-004');
  });
});
