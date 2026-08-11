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
import { hasConfirmedDefault, effectiveDefaultFor } from './confirmedDefaults.js';
import { normalizeTechnicalText } from './textNormalization.js';

function getPath(data, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

/** Aplica la capa de compatibilidad legacy (si el par categoría/input tiene
 *  alguna regla) y después el formatter. Punto ÚNICO por donde pasa todo
 *  valor de proyecto antes de entrar a una nota: así ningún resolver ni
 *  componente necesita saber que existen formatos antiguos. */
function presentValue(raw, { categoryId, inputId, formatter }) {
  /* El whitespace se limpia PRIMERO: un valor pegado desde Word puede traer
     NBSP invisibles que romperían tanto la comparación legacy como el
     parseo numérico de los formatters. */
  const limpio = normalizeTechnicalText(raw);
  const normalized = categoryId && inputId
    ? normalizeLegacyTechnicalValue({ categoryId, inputId, value: limpio })
    : limpio;
  return formatter(normalized);
}

/** ¿Puede el motor resolver este input con su default cuando está vacío?
 *
 *  Regla base: todo type EXCEPTO `project_value`, que es dato propio del
 *  proyecto y debe quedar PENDIENTE.
 *
 *  Excepción declarada: los inputs listados en CONFIRMED_TECHNICAL_DEFAULTS,
 *  que el paquete fuente modela como project_value pero el equipo decidió
 *  tratar como valores típicos estándar (ver confirmedDefaults.js).
 *
 *  Una sola función para no mantener esta regla en dos sitios. */
export function allowDefaultFor(catalogInput, categoryId, inputKey) {
  if (categoryId && inputKey && hasConfirmedDefault(categoryId, inputKey)) return true;
  return catalogInput.type !== 'project_value';
}

/** Campo de dominio (SCHEMA/projects.data) ya existente — status
 *  RESOLVED_PROJECT cuando el proyecto ya tiene dato, RESOLVED_DEFAULT
 *  cuando está vacío y el input lo permite, PENDING en caso contrario.
 *  `suggested` viaja siempre (aun en PENDING) como dato interno de
 *  trazabilidad: refleja el valor de referencia del catálogo. NINGUNA vista
 *  lo muestra — la interfaz enseña el valor efectivo o "⚠ Pendiente", nunca
 *  una sugerencia. Se conserva porque lo usan los tests y puede servir a
 *  futuras exportaciones o auditorías. */
export function schemaField({ id, label, tab, fieldKey, path, formatter = passthrough, defaultValue, allowDefault, categoryId }) {
  const suggested = !isBlank(defaultValue) ? formatter(normalizeTechnicalText(defaultValue)) : null;
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
  const suggested = !isBlank(defaultValue) ? formatter(normalizeTechnicalText(defaultValue)) : null;
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

/** Valor fijo del sistema: no lo aporta el proyecto ni el usuario y no es
 *  editable desde ninguna pantalla. Se resuelve siempre igual, así que nunca
 *  queda pendiente ni resta completitud. `fieldRef: null` evita que la UI
 *  ofrezca un "ir al campo" que no existe. */
export function fixedValue({ id, label, value }) {
  return {
    id,
    label,
    fieldRef: null,
    resolve() {
      return { status: STATUS.RESOLVED_DEFAULT, value, suggested: value };
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
    defaultValue: effectiveDefaultFor(category.category_id, inputKey, input.default),
    allowDefault: allowDefaultFor(input, category.category_id, inputKey),
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
    defaultValue: effectiveDefaultFor(category.category_id, inputKey, input.default),
    allowDefault: allowDefaultFor(input, category.category_id, inputKey),
  });
}

export { getPath };
