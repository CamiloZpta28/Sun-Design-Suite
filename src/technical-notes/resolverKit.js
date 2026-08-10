/* ============================================================================
   RESOLVER KIT — constructores genéricos de resolvers, compartidos por todas
   las categorías (catalog/resolvers/*.js). Evita "cientos de ifs": cada
   categoría solo declara QUÉ campo de SCHEMA (o override) alimenta cada
   placeholder; este módulo decide CÓMO se resuelve (blank -> default o
   PENDING, formatter, status) a partir del `type` ya declarado en el
   catálogo — una sola fuente de verdad para "¿puede autocompletarse?".
   ============================================================================ */

import { STATUS } from './engine.js';
import { isBlank, passthrough } from './formatters.js';
import { normalizeLegacyTechnicalValue } from './compatibility.js';

function getPath(data, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

/** Aplica la capa de compatibilidad legacy (si el par categoría/input tiene
 *  alguna regla) y después el formatter. Punto ÚNICO por donde pasa todo
 *  valor de proyecto antes de entrar a una nota: así ningún resolver ni
 *  componente necesita saber que existen formatos antiguos. */
function presentValue(raw, { categoryId, inputId, formatter }) {
  const normalized = categoryId && inputId
    ? normalizeLegacyTechnicalValue({ categoryId, inputId, value: raw })
    : raw;
  return formatter(normalized);
}

/** Un input `project_value` NUNCA se autocompleta en la nota (regla F del
 *  encargo); cualquier otro type (repository_select, repository_value,
 *  select, number, number_unit) sí puede caer al default cuando el campo
 *  está vacío. Una sola función para no mantener esta regla en dos sitios. */
export function allowDefaultFor(catalogInput) {
  return catalogInput.type !== 'project_value';
}

/** Campo de dominio (SCHEMA/projects.data) ya existente — status
 *  RESOLVED_PROJECT cuando el proyecto ya tiene dato, RESOLVED_DEFAULT
 *  cuando está vacío y el input lo permite, PENDING en caso contrario.
 *  `suggested` siempre viaja (aun en PENDING) para que la UI pueda mostrar
 *  "sugerido por memoria" sin aplicarlo. */
export function schemaField({ id, label, tab, fieldKey, path, formatter = passthrough, defaultValue, allowDefault, categoryId }) {
  const suggested = !isBlank(defaultValue) ? formatter(defaultValue) : null;
  return {
    id,
    label,
    fieldRef: { tab, fieldKey },
    resolve(data) {
      const raw = getPath(data, path || [tab, fieldKey]);
      if (!isBlank(raw)) {
        const value = presentValue(raw, { categoryId, inputId: id, formatter });
        return isBlank(value)
          ? { status: STATUS.INVALID, value: null, suggested }
          : { status: STATUS.RESOLVED_PROJECT, value, suggested };
      }
      if (allowDefault && !isBlank(suggested)) {
        return { status: STATUS.RESOLVED_DEFAULT, value: suggested, suggested };
      }
      return { status: STATUS.PENDING, value: null, suggested };
    },
  };
}

/** Override propio de Notas Técnicas, sin campo de dominio (ver regla 22):
 *  vive en project.data.technicalNotes.overrides[categoryId][overrideKey].
 *  Misma semántica que schemaField, pero status RESOLVED_USER en vez de
 *  RESOLVED_PROJECT cuando hay valor explícito (distingue "dato de una
 *  pestaña de dominio" de "elección propia de Notas Técnicas"). */
export function overrideField({ id, label, categoryId, overrideKey, formatter = passthrough, defaultValue, allowDefault }) {
  const suggested = !isBlank(defaultValue) ? formatter(defaultValue) : null;
  return {
    id,
    label,
    fieldRef: { tab: null, categoryId, overrideKey },
    resolve(data) {
      const raw = getPath(data, ['technicalNotes', 'overrides', categoryId, overrideKey]);
      if (!isBlank(raw)) {
        const value = presentValue(raw, { categoryId, inputId: id, formatter });
        return isBlank(value)
          ? { status: STATUS.INVALID, value: null, suggested }
          : { status: STATUS.RESOLVED_USER, value, suggested };
      }
      if (allowDefault && !isBlank(suggested)) {
        return { status: STATUS.RESOLVED_DEFAULT, value: suggested, suggested };
      }
      return { status: STATUS.PENDING, value: null, suggested };
    },
  };
}

/** Input marcado excluded:true en el catálogo (ej. parámetros sísmicos de
 *  shelter): status EXCLUDED siempre, nunca bloquea completitud ni aparece
 *  como pendiente. No se elimina el input del catálogo — solo no se resuelve. */
export function excludedField({ id, label, reason }) {
  return {
    id,
    label,
    fieldRef: null,
    resolve() {
      return { status: STATUS.EXCLUDED, value: null, suggested: null, reason };
    },
  };
}

/** Construye un schemaField directamente a partir de un input ya declarado
 *  en una categoría del catálogo: toma su `default` y deriva `allowDefault`
 *  de su `type`, para no repetirlos a mano en cada resolver. */
export function fromCatalog(category, inputKey, { label, tab, fieldKey, path, formatter } = {}) {
  const input = category.inputs[inputKey];
  if (!input) throw new Error(`fromCatalog: "${inputKey}" no existe en los inputs de ${category.category_id}`);
  if (input.excluded) return excludedField({ id: inputKey, label: label || inputKey, reason: input.reason });
  return schemaField({
    id: inputKey,
    label: label || `${category.label} — ${inputKey}`,
    tab,
    fieldKey,
    path,
    formatter,
    defaultValue: input.default,
    allowDefault: allowDefaultFor(input),
    categoryId: category.category_id,
  });
}

/** Igual que fromCatalog pero apuntando a un override de Notas Técnicas en
 *  vez de a un campo de SCHEMA. */
export function fromCatalogOverride(category, inputKey, { label, overrideKey, formatter } = {}) {
  const input = category.inputs[inputKey];
  if (!input) throw new Error(`fromCatalogOverride: "${inputKey}" no existe en los inputs de ${category.category_id}`);
  if (input.excluded) return excludedField({ id: inputKey, label: label || inputKey, reason: input.reason });
  return overrideField({
    id: inputKey,
    label: label || `${category.label} — ${inputKey}`,
    categoryId: category.category_id,
    overrideKey: overrideKey || inputKey,
    formatter,
    defaultValue: input.default,
    allowDefault: allowDefaultFor(input),
  });
}

export { getPath };
