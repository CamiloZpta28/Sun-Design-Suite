/* ============================================================================
   ESTRUCTURA DE LA INTERFAZ — comprobaciones a nivel de código fuente.
   ----------------------------------------------------------------------------
   El proyecto no tiene jsdom ni testing-library instalados, así que estas
   pruebas NO renderizan React: leen el código de los componentes y verifican
   que ciertos bloques existan o hayan desaparecido.

   Son guardas de regresión deliberadamente sencillas para los cambios de UX
   pedidos (quitar la lista duplicada de notas y las sugerencias). No
   sustituyen a una prueba de render: la validación visual sigue siendo
   manual, pero esto impide que las piezas vuelvan por accidente.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const leer = (ruta) => readFileSync(join(dir, ruta), 'utf8');

const PANEL = leer('../TechnicalNotesPanel.jsx');
const APP = leer('../../App.jsx');

describe('1 — la lista visual de notas individuales ya no se renderiza', () => {
  it('el panel no recorre las notas de cada sección para pintarlas', () => {
    expect(PANEL).not.toContain('seccion.notas.map');
    expect(PANEL).not.toContain('resolved.secciones.map');
  });

  it('no queda markup de tarjeta por nota', () => {
    expect(PANEL).not.toContain('nota.textoResuelto');
    expect(PANEL).not.toContain('nota.numero');
    expect(PANEL).not.toContain('nota.completa');
    expect(PANEL).not.toContain('border-l-emerald-400');
  });

  it('las notas se leen de una sola fuente: el texto consolidado', () => {
    expect(PANEL).toContain('resolved.textoCompleto');
    expect(PANEL.match(/resolved\.textoCompleto/g)).toHaveLength(1);
  });
});

describe('2 y 3 — el cuadro copiable y el botón siguen existiendo', () => {
  it('hay un textarea de solo lectura', () => {
    expect(PANEL).toContain('<textarea');
    expect(PANEL).toContain('readOnly');
  });

  it('el textarea no es editable ni se persiste', () => {
    // Sin onChange: nada de lo que se escriba puede convertirse en dato.
    const bloque = PANEL.slice(PANEL.indexOf('<textarea'), PANEL.indexOf('</div>', PANEL.indexOf('<textarea')));
    expect(bloque).not.toContain('onChange');
    expect(PANEL).not.toContain('setTextoNotas');
  });

  it('existe el botón "Copiar notas" con su feedback', () => {
    expect(PANEL).toContain('Copiar notas');
    expect(PANEL).toContain('Copiado');
    expect(PANEL).toContain('navigator.clipboard');
  });

  it('se conservan selector de estructura, completitud y pendientes', () => {
    expect(PANEL).toContain('Tipo de estructura');
    expect(PANEL).toContain('Completitud');
    expect(PANEL).toContain('Pendientes para completar las notas');
    expect(PANEL).toContain('onNavigateToField');
  });
});

describe('8 y 9 — sin sugerencias; solo el indicador de pendiente', () => {
  it('el panel no muestra "sugerido por memoria" ni equivalentes', () => {
    expect(PANEL.toLowerCase()).not.toContain('sugerido por memoria');
    expect(PANEL.toLowerCase()).not.toContain('usar sugerido');
    expect(PANEL).not.toContain('p.suggested');
  });

  it('la edición estructural tampoco ofrece "Usar sugerido"', () => {
    expect(APP.toLowerCase()).not.toContain('usar sugerido');
    expect(APP.toLowerCase()).not.toContain('sugerido por memoria');
    expect(APP).not.toContain('field.sugerido');
  });

  it('los project_value ya no llevan la propiedad de sugerencia', () => {
    expect(APP).not.toContain('sugerido: input.default');
  });

  it('el indicador de pendiente SÍ se conserva', () => {
    expect(PANEL).toContain('Pendientes para completar las notas');
    expect(PANEL).toContain('AlertTriangle');
  });

  it('ningún componente de la interfaz contiene textos de sugerencia', () => {
    const componentes = {
      'TechnicalNotesPanel.jsx': PANEL,
      'App.jsx': APP,
      'SelectOrOtro.jsx': leer('../SelectOrOtro.jsx'),
    };
    Object.entries(componentes).forEach(([nombre, fuente]) => {
      // Solo el texto que llega al usuario: se ignoran comentarios /* … */.
      const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      ['valor sugerido', 'sugerido por memoria', 'sin confirmar', 'usar sugerido'].forEach((frase) => {
        expect(sinComentarios.toLowerCase(), `${nombre} contiene "${frase}"`).not.toContain(frase);
      });
    });
  });

  it('el modo lectura muestra el valor efectivo sin explicación auxiliar', () => {
    expect(APP).not.toContain('esSugerido');
    expect(APP).toContain('const usaDefault =');
  });

  it('`suggested` sigue existiendo en el motor pero ninguna vista lo lee', () => {
    const resolverKit = leer('../resolverKit.js');
    expect(resolverKit).toContain('suggested'); // dato interno conservado
    expect(PANEL).not.toContain('suggested');
    expect(APP).not.toContain('suggested');
  });
});

describe('4 — lo que debía mantenerse sigue en su sitio', () => {
  it('los defaults de catálogo siguen preseleccionándose con SelectOrOtro', () => {
    expect(APP).toContain('SelectOrOtro');
    expect(APP).toContain('defaultValue');
  });

  it('"Otro" sigue disponible en los selects de catálogo', () => {
    const selectOrOtro = leer('../SelectOrOtro.jsx');
    expect(selectOrOtro).toContain('__otro__');
    expect(selectOrOtro).toContain('Especificar otro valor');
  });

  it('el acordeón muestra todos los subapartados y resalta el activo', () => {
    expect(APP).toContain('allFieldGroups()');
    expect(APP).not.toContain('groupsForStructure');
    expect(APP).toContain('esActivo');
    expect(APP).toContain('Notas activas');
  });

  it('la navegación desde pendientes sigue abriendo el subapartado correcto', () => {
    expect(APP).toContain('groupToOpenFor');
    expect(APP).toContain('requiresAccordion');
    expect(APP).toContain('scrollIntoView');
  });
});
