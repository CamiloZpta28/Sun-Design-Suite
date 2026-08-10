/* ============================================================================
   VALIDACIÓN DEL CATÁLOGO — comprobaciones automáticas de integridad del
   paquete de categorías (regla 35 del encargo). Se ejecuta en tests; también
   puede llamarse desde una futura UI de administración.

   Devuelve una lista de problemas: [] significa catálogo consistente.
   ============================================================================ */

import { MANIFEST } from './catalog/manifest.js';
import { CATEGORIES, getCategory } from './catalog/categories/index.js';
import { buildSpec } from './catalog/bundler.js';
import { extractPlaceholderIds } from './engine.js';

export const KNOWN_INPUT_TYPES = new Set([
  'repository_select',
  'repository_value',
  'select',
  'number',
  'number_unit',
  'project_value',
]);

/** Tipos que representan una selección desde el repositorio y por tanto
 *  deben declarar a qué grupo pertenecen. `repository_value` queda fuera a
 *  propósito: en el paquete fuente (ej. FY/FU) no trae `group`. */
const TYPES_REQUIRING_GROUP = new Set(['repository_select']);

export function validateCatalog() {
  const problems = [];
  const problem = (tipo, mensaje) => problems.push({ tipo, mensaje });

  // 1) Toda estructura del manifest tiene bundle, y toda categoría del bundle existe.
  MANIFEST.structure_options.forEach((structureType) => {
    const bundle = MANIFEST.bundles[structureType];
    if (!bundle) {
      problem('manifest', `La estructura "${structureType}" no tiene bundle declarado.`);
      return;
    }
    bundle.forEach((categoryId) => {
      if (!getCategory(categoryId)) {
        problem('manifest', `El bundle de "${structureType}" referencia la categoría inexistente "${categoryId}".`);
      }
    });
  });

  Object.values(CATEGORIES).forEach((category) => {
    const cid = category.category_id;

    // 2) Toda dependencia declarada existe.
    (category.dependencies || []).forEach((dep) => {
      if (!getCategory(dep)) {
        problem('dependencias', `La categoría "${cid}" depende de "${dep}", que no existe.`);
      }
    });

    // 3) Notas bien formadas + IDs únicos dentro de la categoría.
    const noteIds = new Set();
    (category.notes || []).forEach((nota, i) => {
      if (!nota.note_id) problem('notes', `Nota #${i} de "${cid}" no tiene note_id.`);
      if (!nota.text) problem('notes', `Nota "${nota.note_id || i}" de "${cid}" no tiene text.`);
      if (nota.note_id) {
        if (noteIds.has(nota.note_id)) problem('ids', `note_id duplicado dentro de "${cid}": ${nota.note_id}.`);
        noteIds.add(nota.note_id);
      }
    });

    // 4) Tipos conocidos y grupos obligatorios.
    Object.entries(category.inputs || {}).forEach(([key, input]) => {
      if (!KNOWN_INPUT_TYPES.has(input.type)) {
        problem('types', `Input "${key}" de "${cid}" tiene un type desconocido: "${input.type}".`);
      }
      if (TYPES_REQUIRING_GROUP.has(input.type) && !input.group) {
        problem('groups', `Input "${key}" de "${cid}" es ${input.type} pero no declara group.`);
      }
    });
  });

  // 5) Todo placeholder de cada bundle tiene input declarado en alguna
  //    categoría de ese mismo bundle, y resolver correspondiente.
  MANIFEST.structure_options.forEach((structureType) => {
    const spec = buildSpec(structureType);
    if (!spec) return;
    const inputsDelBundle = new Set();
    (MANIFEST.bundles[structureType] || []).forEach((categoryId) => {
      const category = getCategory(categoryId);
      if (category) Object.keys(category.inputs || {}).forEach((k) => inputsDelBundle.add(k));
    });
    spec.notes.forEach((nota) => {
      extractPlaceholderIds(nota.text).forEach((id) => {
        if (!inputsDelBundle.has(id)) {
          problem('placeholders', `"${nota.note_id}" (${structureType}) usa {{${id}}}, que no está declarado en los inputs del bundle.`);
        }
        if (!spec.resolvers[id]) {
          problem('placeholders', `"${nota.note_id}" (${structureType}) usa {{${id}}}, que no tiene resolver declarado.`);
        }
      });
    });
    // 6) Notas duplicadas con texto distinto entre categorías del bundle.
    spec.duplicates.forEach((d) => {
      problem('ids', `note_id "${d.noteId}" aparece en ${d.categorias.join(' y ')} con texto distinto.`);
    });
  });

  // 7) Las exclusiones sísmicas del shelter están registradas.
  const shelter = getCategory('SHELTER_CIMENTACION');
  const SISMICOS = ['AMENAZA_SISMICA', 'TIPO_SUELO', 'GRUPO_USO', 'I', 'AA', 'AV', 'FA', 'FV'];
  SISMICOS.forEach((key) => {
    const input = shelter?.inputs?.[key];
    if (!input) problem('exclusions', `El input sísmico "${key}" ya no existe en SHELTER_CIMENTACION.`);
    else if (!input.excluded) problem('exclusions', `El input sísmico "${key}" no está marcado como excluded.`);
  });
  const she002 = (shelter?.notes || []).find((n) => n.note_id === 'SHE-002');
  if (!she002) problem('exclusions', 'La nota SHE-002 ya no existe en el catálogo (debía conservarse, solo excluirse).');
  else if (!she002.excluded) problem('exclusions', 'La nota SHE-002 no está marcada como excluded.');

  return problems;
}
