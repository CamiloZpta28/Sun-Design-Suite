/* ============================================================================
   TEXTO COPIABLE Y UNIDAD DE PLANOS FIJA
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { getResolvedTechnicalNotes, buildPlainTextNotes, STATUS } from '../index.js';
import { UNIDAD_PLANOS_FIJA } from '../catalog/resolvers/general.js';
import { overrideFieldsFor } from '../overridesSchema.js';
import { GENERAL } from '../catalog/categories/index.js';

const proyecto = (data = {}) => ({ id: 'p', data });
const textoDe = (structureType, data) => getResolvedTechnicalNotes(proyecto(data), structureType).textoCompleto;

describe('texto copiable — formato', () => {
  it('usa numeración continua 1…N, no los note_id internos', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toMatch(/^GENERALIDADES\n1\. /);
    expect(texto).toContain('\n2. ');
    expect(texto).toContain('\n4. '); // la numeración continúa entre secciones
  });

  it('no contiene ningún identificador interno', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const texto = textoDe(s);
      expect(texto, s).not.toMatch(/\b(GEN|CON|MET|CER|POR|SHE|INV|IMP|JUN)-\d{3}\b/);
    });
  });

  it('conserva los títulos de sección legibles, en mayúsculas', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toContain('GENERALIDADES');
    expect(texto).toContain('CONCRETO');
    expect(texto).toContain('METAL');
    expect(texto).toContain('CERRAMIENTO PERIMETRAL');
  });

  it('formato compacto: una nota por línea, SIN línea vacía entre numerales', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const texto = textoDe(s);
      // Ninguna nota puede ir precedida de una línea en blanco.
      expect(texto, s).not.toMatch(/\n\n\d+\. /);
      // Ni existir tres saltos seguidos en ninguna parte.
      expect(texto, s).not.toContain('\n\n\n');
    });
  });

  it('cada línea de nota empieza por su número y no hay líneas vacías dentro de una sección', () => {
    const lineas = textoDe('CERRAMIENTO_PERIMETRAL').split('\n');
    lineas.forEach((linea, i) => {
      if (!/^\d+\. /.test(linea)) return;
      const anterior = lineas[i - 1];
      // La línea previa a una nota es o el título de sección o la nota anterior.
      expect(anterior === '' ? `vacía antes de "${linea.slice(0, 20)}"` : 'ok').toBe('ok');
    });
  });

  it('SÍ hay una línea en blanco entre el final de una sección y el título siguiente', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toContain('\n\nCONCRETO\n');
    expect(texto).toContain('\n\nMETAL\n');
    expect(texto).toContain('\n\nCERRAMIENTO PERIMETRAL\n');
  });

  it('el título de sección va pegado a su primera nota', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toMatch(/GENERALIDADES\n1\. /);
    expect(texto).toMatch(/\nCONCRETO\n4\. /);
  });

  it('no queda ninguna línea vacía suelta salvo las de separación entre secciones', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    const vacias = texto.split('\n').filter((l) => l === '').length;
    // Bundle de cerramiento = 4 secciones -> exactamente 3 separadores.
    expect(vacias).toBe(3);
  });

  it('es texto plano: sin HTML, badges ni iconos', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).not.toMatch(/<[a-z/]/i);
    expect(texto).not.toContain('RESOLVED_');
    expect(texto).not.toContain('PENDING');
  });
});

describe('texto copiable — aislamiento por bundle', () => {
  it('cerramiento no incluye notas de portón, shelter ni inversores', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toContain('CERRAMIENTO PERIMETRAL');
    expect(texto).not.toContain('PORTÓN METÁLICO');
    expect(texto).not.toContain('SHELTER');
    expect(texto).not.toContain('SOPORTE DE INVERSORES');
    expect(texto).not.toContain('micropilotes');
  });

  it('shelter incluye impermeabilización y no incluye metal ni cerramiento', () => {
    const texto = textoDe('SHELTER_CIMENTACION');
    expect(texto).toContain('IMPERMEABILIZACIÓN Y JUNTAS');
    expect(texto).toContain('SHELTER');
    expect(texto).not.toContain('\nMETAL\n');
    expect(texto).not.toContain('CERRAMIENTO PERIMETRAL');
  });

  it('cada estructura produce un texto distinto', () => {
    const textos = ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].map((s) => textoDe(s));
    expect(new Set(textos).size).toBe(4);
  });
});

describe('texto copiable — pendientes visibles', () => {
  it('un parámetro pendiente aparece marcado en el texto', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).toContain('⚠ Pendiente: Capacidad admisible del suelo (cimentación cerramiento)');
  });

  it('NO se inventa el valor sugerido de un project_value pendiente', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL');
    expect(texto).not.toContain('23.05'); // sugerido de CAPACIDAD_SUELO
    expect(textoDe('SOPORTE_INVERSORES')).not.toContain('17.5 MPa'); // sugerido de FC_CICLOPEO
  });

  it('al completar el dato, el pendiente desaparece del texto', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL', {
      geotecnia: { capacidad_admisible_cerramiento: '18.40 kN' },
    });
    expect(texto).toContain('18.40 kN');
    expect(texto).not.toContain('⚠ Pendiente: Capacidad admisible del suelo (cimentación cerramiento)');
  });
});

describe('texto copiable — es derivado, nunca fuente de verdad', () => {
  it('generarlo no modifica projects.data', () => {
    const project = proyecto({ estructural: { cerramiento_poste_diametro: 'Ø 2 in' } });
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    buildPlainTextNotes(getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL'));
    expect(project).toEqual(snapshot);
  });

  it('se recalcula: cambiar un parámetro cambia el texto de inmediato', () => {
    const antes = textoDe('CERRAMIENTO_PERIMETRAL');
    const despues = textoDe('CERRAMIENTO_PERIMETRAL', { estructural: { cerramiento_poste_diametro: 'Ø 3 in' } });
    expect(antes).not.toBe(despues);
    expect(despues).toContain('Ø 3 in');
  });

  it('es determinista: mismos datos, mismo texto', () => {
    expect(textoDe('CERRAMIENTO_PERIMETRAL')).toBe(textoDe('CERRAMIENTO_PERIMETRAL'));
  });

  it('buildPlainTextNotes tolera una entrada vacía', () => {
    expect(buildPlainTextNotes(null)).toBe('');
    expect(buildPlainTextNotes({})).toBe('');
  });

  it('el textarea y el botón Copiar comparten exactamente el mismo contenido', () => {
    /* En el panel, `texto` se pasa una sola vez a <NotasCopiables>, que lo usa
       tanto para el value del textarea como para navigator.clipboard: no hay
       dos formateos distintos que puedan divergir. Aquí se fija que la única
       fuente sea textoCompleto y que coincida con el builder. */
    const resolved = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.textoCompleto).toBe(buildPlainTextNotes(resolved));
  });
});

describe('UNIDAD_PLANOS — siempre metros', () => {
  it('la constante del sistema es "metros"', () => {
    expect(UNIDAD_PLANOS_FIJA).toBe('metros');
  });

  it('GEN-001 se resuelve siempre con "metros" en todas las estructuras', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      const resolved = getResolvedTechnicalNotes(proyecto(), s);
      const p = resolved.parametros.find((x) => x.id === 'UNIDAD_PLANOS');
      expect(p.value, s).toBe('metros');
      expect(p.status, s).toBe(STATUS.RESOLVED_DEFAULT);
      const gen001 = resolved.secciones.flatMap((sec) => sec.notas).find((n) => n.noteId === 'GEN-001');
      expect(gen001.textoResuelto, s).toBe(
        'Las dimensiones están dadas en metros a menos que se especifique otra unidad y los diámetros de las varillas están dados en pulgadas.'
      );
    });
  });

  it('nunca queda pendiente ni resta completitud', () => {
    const resolved = getResolvedTechnicalNotes(proyecto(), 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.pendientes.map((p) => p.id)).not.toContain('UNIDAD_PLANOS');
    const gen001 = resolved.secciones.flatMap((s) => s.notas).find((n) => n.noteId === 'GEN-001');
    expect(gen001.completa).toBe(true);
  });

  it('ya no es un input editable en ninguna pantalla', () => {
    ['CERRAMIENTO_PERIMETRAL', 'PORTON_METALICO', 'SHELTER_CIMENTACION', 'SOPORTE_INVERSORES'].forEach((s) => {
      expect(overrideFieldsFor(s).map((f) => f.inputKey), s).not.toContain('UNIDAD_PLANOS');
    });
  });

  it('el input sigue existiendo en el catálogo (transcripción intacta)', () => {
    expect(GENERAL.inputs.UNIDAD_PLANOS).toBeDefined();
    expect(GENERAL.inputs.UNIDAD_PLANOS.options).toEqual(['m', 'cm', 'mm']);
  });
});

describe('UNIDAD_PLANOS — override legacy ignorado, no migrado', () => {
  it('un proyecto antiguo con "cm" sigue resolviendo GEN-001 con metros', () => {
    const project = proyecto({ technicalNotes: { overrides: { GENERAL: { UNIDAD_PLANOS: 'cm' } } } });
    const resolved = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.parametros.find((p) => p.id === 'UNIDAD_PLANOS').value).toBe('metros');
    expect(resolved.textoCompleto).toContain('están dadas en metros a menos que');
  });

  it('lo mismo con "mm"', () => {
    const project = proyecto({ technicalNotes: { overrides: { GENERAL: { UNIDAD_PLANOS: 'mm' } } } });
    const resolved = getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(resolved.parametros.find((p) => p.id === 'UNIDAD_PLANOS').value).toBe('metros');
  });

  it('el dato legacy NO se borra ni se migra: permanece guardado sin uso', () => {
    const project = proyecto({ technicalNotes: { overrides: { GENERAL: { UNIDAD_PLANOS: 'cm' } } } });
    const snapshot = structuredClone(project);
    getResolvedTechnicalNotes(project, 'CERRAMIENTO_PERIMETRAL');
    expect(project).toEqual(snapshot);
    expect(project.data.technicalNotes.overrides.GENERAL.UNIDAD_PLANOS).toBe('cm');
  });
});

describe('la unidad de planos NO convierte ningún otro parámetro', () => {
  const DATOS = {
    estructural: {
      concreto_solado_espesor: '5 cm',
      cerramiento_poste_espesor: '1.50 mm',
      acero_refuerzo_fy: '420 MPa',
      cerramiento_poste_diametro: 'Ø 2 in',
      cerramiento_bandit_calibre: '1/2 in',
      recubrimiento_tierra: '7.5 cm',
    },
  };

  it('cada parámetro conserva su propia unidad', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL', DATOS);
    expect(texto).toContain('5 cm');
    expect(texto).toContain('1.50 mm');
    expect(texto).toContain('420 MPa');
    expect(texto).toContain('Ø 2 in');
    expect(texto).toContain('1/2 in');
    expect(texto).toContain('7.5 cm');
  });

  it('no aparecen valores convertidos a metros', () => {
    const texto = textoDe('CERRAMIENTO_PERIMETRAL', DATOS);
    expect(texto).not.toContain('0.05 m');    // 5 cm convertidos
    expect(texto).not.toContain('0.0015 m');  // 1.50 mm convertidos
    expect(texto).not.toContain('0.075 m');   // 7.5 cm convertidos
  });

  it('el valor resuelto de cada parámetro es idéntico al almacenado', () => {
    const resolved = getResolvedTechnicalNotes(proyecto(DATOS), 'CERRAMIENTO_PERIMETRAL');
    const valorDe = (id) => resolved.parametros.find((p) => p.id === id).value;
    expect(valorDe('ESPESOR_SOLADO')).toBe('5 cm');
    expect(valorDe('POSTE_ESPESOR')).toBe('1.50 mm');
    expect(valorDe('ACERO_FY')).toBe('420 MPa');
    expect(valorDe('POSTE_DIAMETRO')).toBe('Ø 2 in');
    expect(valorDe('BANDIT')).toBe('1/2 in');
  });
});
