/* ============================================================================
   BUNDLER — ensambla la "spec" que consume el motor a partir del manifest.
   ----------------------------------------------------------------------------
   Toma un structureType, resuelve su bundle de categorías, concatena sus
   notas en orden de despliegue y une los mapas de resolvers de cada
   categoría. El motor (engine.js) no sabe nada de manifests ni de bundles:
   solo recibe { id, label, notes, resolvers }.

   Reglas implementadas aquí (del paquete fuente):
     - Un note_id solo puede aparecer una vez en la salida (dedupe).
     - No mezclar valores de una estructura con otra: el mapa de resolvers de
       un bundle SOLO incluye las categorías de ese bundle, así que un
       placeholder homónimo de otra estructura (ej. ACERO/FY/FU/SOLDADURA,
       que existen tanto en portón como en cerramiento) nunca puede
       resolverse con el valor de la otra.
     - Los inputs/notas marcados excluded (sísmicos de shelter) se filtran de
       la salida activa, sin borrarse del catálogo.

   ORDEN: el manifest declara el bundle empezando por las categorías globales
   (GENERAL, CONCRETO, …) y terminando por la específica. El paquete pide
   "cargar primero la categoría principal" para RESOLUCIÓN — eso es
   irrelevante aquí porque la resolución es por placeholder y no depende del
   orden de carga (cada categoría aporta su propio mapa y no hay
   sobrescritura entre bundles). Para PRESENTACIÓN se usa el orden del
   manifest, que ya es el orden legible pedido (Generalidades -> Concreto ->
   Metal -> categoría de la estructura).
   ============================================================================ */

import { MANIFEST, STRUCTURE_LABELS, bundleFor } from './manifest.js';
import { getCategory } from './categories/index.js';
import { buildGeneralResolvers } from './resolvers/general.js';
import { buildConcretoResolvers } from './resolvers/concrete.js';
import { buildMetalResolvers } from './resolvers/metal.js';
import { buildPortonResolvers } from './resolvers/portonMetalico.js';
import { buildCerramientoResolvers } from './resolvers/cerramientoPerimetral.js';
import { buildImpermeabilizacionResolvers } from './resolvers/impermeabilizacionJuntas.js';
import { buildShelterResolvers } from './resolvers/shelterCimentacion.js';
import { buildSoporteInversoresResolvers } from './resolvers/soporteInversores.js';

const RESOLVER_BUILDERS = {
  GENERAL: buildGeneralResolvers,
  CONCRETO: buildConcretoResolvers,
  METAL: buildMetalResolvers,
  PORTON_METALICO: buildPortonResolvers,
  CERRAMIENTO_PERIMETRAL: buildCerramientoResolvers,
  IMPERMEABILIZACION_JUNTAS: buildImpermeabilizacionResolvers,
  SHELTER_CIMENTACION: buildShelterResolvers,
  SOPORTE_INVERSORES: buildSoporteInversoresResolvers,
};

/**
 * Ensambla la spec de un tipo de estructura.
 * @param {string} structureType - ej. 'CERRAMIENTO_PERIMETRAL'
 * @returns {{id, label, categories, notes, resolvers, duplicates}|null}
 */
export function buildSpec(structureType) {
  const bundle = bundleFor(structureType);
  if (!bundle) return null;

  const notes = [];
  const seenNoteIds = new Map();
  const duplicates = [];
  let resolvers = {};
  const categories = [];

  bundle.forEach((categoryId) => {
    const category = getCategory(categoryId);
    if (!category) return;
    categories.push({ id: category.category_id, label: category.label, type: category.category_type });

    const builder = RESOLVER_BUILDERS[categoryId];
    if (builder) resolvers = { ...resolvers, ...builder() };

    category.notes.forEach((nota) => {
      if (nota.excluded) return; // sísmicos de shelter: fuera de la salida activa
      const previo = seenNoteIds.get(nota.note_id);
      if (previo) {
        // Mismo note_id cargado por dos categorías del bundle: se emite una
        // sola vez. Si además el texto difiere, es un error de catálogo.
        if (previo.text !== nota.text) {
          duplicates.push({ noteId: nota.note_id, categorias: [previo.categoryId, categoryId], textoDistinto: true });
        }
        return;
      }
      const entry = {
        note_id: nota.note_id,
        text: nota.text,
        categoryId: category.category_id,
        categoryLabel: category.label,
      };
      seenNoteIds.set(nota.note_id, entry);
      notes.push(entry);
    });
  });

  return {
    id: structureType,
    label: STRUCTURE_LABELS[structureType] || structureType,
    categories,
    notes,
    resolvers,
    duplicates,
  };
}

export { MANIFEST, STRUCTURE_LABELS, bundleFor };
