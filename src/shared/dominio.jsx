/* ============================================================================
   DOMINIO COMPARTIDO
   ----------------------------------------------------------------------------
   Lo que necesitan por igual el armazón de la aplicación (App.jsx) y la ficha
   de un proyecto, que se descarga aparte:

     - SCHEMA, el esqueleto de las pestañas técnicas, y los datos fijos que lo
       acompañan (departamentos y municipios, listas de documentos, estados);
     - utilidades de formato y de cálculo de progreso;
     - piezas de interfaz chicas que se usan en los dos lados (el semáforo de
       estado, la torta de avance, los selectores de listas compartidas).

   Vive aquí, y no dentro de la ficha, porque importarlo desde App.jsx
   volvería a arrastrar la ficha entera al paquete inicial — que es justo lo
   que se quiere evitar.
   ============================================================================ */

import React, { useState } from 'react';
import { MapPin, HardHat, Cog, Mountain, Building2, Droplets, Zap, X, Plus } from 'lucide-react';
import { CATEGORIES } from '../technical-notes/catalog/categories/index.js';
import { optionsFor, selectableOptionsFor, STANDALONE_TECHNICAL_VALUES } from '../technical-notes/repository.js';
import { isBlank, sumMetersFormatted } from '../technical-notes/formatters.js';
import { effectiveDefaultFor, hasConfirmedDefault } from '../technical-notes/confirmedDefaults.js';
import { equipoComoArray, esRolMultiple } from './permisos.js';
import AddableSelect from './AddableSelect.jsx';

/* Campo alimentado por un input del catálogo de Notas Técnicas
   (src/technical-notes/catalog/). Una sola fuente de verdad: el `default`,
   el `type` y las opciones del repositorio salen del catálogo, así que el
   select de esta pantalla y la nota técnica nunca pueden discrepar.

   - repository_select / repository_value / select -> desplegable. Los dos
     primeros admiten "Otro" (escribir cualquier especificación); un `select`
     cerrado (ej. unidad de planos) no lo admite, por definición del paquete.
   - project_value -> input libre. Su `default` es una REFERENCIA de la
     memoria fuente, no un valor universal: se muestra como sugerencia y
     jamás se guarda solo (regla F del encargo).
   Las opciones se piden con el scope de la estructura dueña del campo, para
   que el acero del portón nunca aparezca como opción del cerramiento. */
export function catalogField(categoryId, inputKey, label, { structureScope } = {}) {
  const input = CATEGORIES[categoryId].inputs[inputKey];

  /* Inputs que el paquete fuente modela como project_value pero cuyo valor
     típico el equipo ya confirmó (ver confirmedDefaults.js): se comportan
     como cualquier otro desplegable de catálogo, con su default
     preseleccionado y "Otro" para apartarse de él. */
  if (hasConfirmedDefault(categoryId, inputKey)) {
    const valor = effectiveDefaultFor(categoryId, inputKey, input.default);
    return { label, type: 'select', opciones: [valor], defaultValue: valor, allowOther: true };
  }

  /* project_value = dato propio del proyecto. Se captura como texto libre y
     SIN sugerencias en la interfaz: el `default` del catálogo es una simple
     referencia documental de la memoria fuente, no un valor a proponer. */
  if (input.type === 'project_value') {
    return { key: undefined, label, type: 'text' };
  }
  return {
    label,
    type: 'select',
    opciones: selectableOptionsFor(input, categoryId, inputKey, structureScope),
    defaultValue: input.default,
    allowOther: input.type !== 'select',
  };
}

export function camposNotasTecnicas(fields) {
  return fields.map((f) => ({ ...f, grupo: GRUPO_NOTAS_TECNICAS.id }));
}

/* Grupo plegable simple y genérico (mismo estilo visual que el acordeón de  */
/* Notas Técnicas de arriba, pero sin su lógica de subgrupos/estructura —    */
/* solo un plegar/desplegar con contador "X de Y con dato") para reducir el */
/* ruido visual de secciones largas dentro de una pestaña, ej. "Cerramiento" */
/* en Civil o "Inversores"/"Equipos eléctricos" en Eléctrico.               */
export function camposPlegables(fields, id, label) {
  return fields.map((f) => ({ ...f, grupoPlegable: id, grupoPlegableLabel: label }));
}

/* Los 12 meses fijos de la tabla "Energía mensual" (Eléctrico) — el orden   */
/* nunca cambia, así que no hace falta guardarlo, solo los 3 valores por mes.*/
export const MESES_ENERGIA = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'];

/* Campo de SCHEMA a partir del catálogo: `key` es la ruta real en
   projects.data (puede ser un campo que ya existía; ver regla "una sola
   fuente de verdad"). */
export function catalogSchemaField(key, categoryId, inputKey, label, opts) {
  return { ...catalogField(categoryId, inputKey, label, opts), key };
}

/* Los campos que solo existen para alimentar el motor de Notas Técnicas se
   marcan con este grupo para poder plegarlos en la pestaña Estructural, que
   de otro modo quedaría dominada por ellos. Es únicamente presentación: el
   campo, su clave en projects.data y su comportamiento no cambian. */
export const GRUPO_NOTAS_TECNICAS = { id: 'notas_tecnicas', label: 'Información para Notas Técnicas' };

/* Como isBlank() (de technical-notes) no sabe de arreglos/objetos, un array  */
/* vacío (ej. "Módulos por inversor" sin filas) contaría como "con dato" —   */
/* esta versión sí los trata como vacíos, para el contador de los grupos     */
/* plegables genéricos (ver camposPlegables).                               */
export function tieneValorParaConteo(v) {
  if (Array.isArray(v)) return v.some((item) => item && Object.values(item).some((x) => x && String(x).trim() !== ''));
  if (v && typeof v === 'object') return Object.values(v).some((x) => x && String(x).trim() !== '');
  return !isBlank(v);
}

/* Campo alimentado por un valor técnico del repositorio que todavía no tiene
   placeholder en ninguna nota (ver STANDALONE_TECHNICAL_VALUES). Se comporta
   igual que cualquier otro desplegable de catálogo: opciones + "Otro" +
   default sugerido que nunca sobrescribe lo ya guardado. */
export function repositoryField({ fieldKey, group, defaultValue }, label) {
  return {
    key: fieldKey,
    label,
    type: 'select',
    allowOther: true,
    opciones: optionsFor(group, null),
    defaultValue,
  };
}

/* Los campos de tipo 'boolean' guardan { valor: true|false|null, nota: '' }   */
/* para poder anexar una descripción a la respuesta Sí/No.                     */
export const SCHEMA = [
  {
    id: 'general', label: 'General', icon: MapPin,
    fields: [
      { key: 'departamento', label: 'Departamento', type: 'departamento' },
      { key: 'municipio', label: 'Municipio', type: 'municipio' },
      { key: 'pais', label: 'País', type: 'pais' },
      { key: 'numero_minigranja', label: 'Número de minigranja (ej. 215)', type: 'text' },
      { key: 'numero_predio', label: 'Número de predio (ej. 1)', type: 'text' },
      { key: 'propietario_predio', label: 'Propietario de predio', type: 'text' },
      { key: 'telefono_propietario', label: 'Teléfono de propietario', type: 'text' },
      { key: 'magna_sirgas', label: 'Coord. MAGNA-SIRGAS (Bogotá)', type: 'text' },
      { key: 'lat_long', label: 'Coordenadas Lat/Long', type: 'coordenadas' },
      { key: 'altitud', label: 'Altitud (m.s.n.m.)', type: 'text' },
      { key: 'direccion_proyecto', label: 'Dirección del proyecto', type: 'text' },
      { key: 'tipo_predio', label: 'Tipo predio (rural o urbano)', type: 'text' },
      { key: 'area_legal', label: 'Área legal (m²)', type: 'text' },
      { key: 'perimetro_legal', label: 'Perímetro legal (m)', type: 'text' },
      { key: 'fecha_inicio', label: 'Fecha de Inicio', type: 'date' },
      { key: 'fecha_entrega', label: 'Fecha de Entrega', type: 'date' },

      /* Operador de red / Inversionista / Instalador: cada uno es un        */
      /* catálogo compartido (mismo criterio que Mallas/Países/Proveedores)  */
      /* — el correo/teléfono/NIT/logo son ATRIBUTOS de esa entidad, no del  */
      /* proyecto, así que se editan aquí pero se guardan en su propio       */
      /* catálogo y se reflejan en todos los proyectos que la usen.         */
      ...camposPlegables([
        { key: 'operador_red', label: 'Operador de red', type: 'operador_red' },
        { key: 'or_logo', label: 'Logo OR', type: 'catalogo_atributo', catalogo: 'operadores_red', dependeDe: 'operador_red', dependeDeLabel: 'Operador de red', campoAtributo: 'logo', esImagen: true },
      ], 'operador_red_grupo', 'Operador de red'),

      ...camposPlegables([
        { key: 'inversionista', label: 'Inversionista', type: 'inversionista' },
        { key: 'inv_correo', label: 'Correo Inversionista', type: 'catalogo_atributo', catalogo: 'inversionistas', dependeDe: 'inversionista', dependeDeLabel: 'Inversionista', campoAtributo: 'correo' },
        { key: 'inv_telefono', label: 'Teléfono Inversionista', type: 'catalogo_atributo', catalogo: 'inversionistas', dependeDe: 'inversionista', dependeDeLabel: 'Inversionista', campoAtributo: 'telefono' },
        { key: 'inv_nit', label: 'NIT del inversionista', type: 'catalogo_atributo', catalogo: 'inversionistas', dependeDe: 'inversionista', dependeDeLabel: 'Inversionista', campoAtributo: 'nit' },
        { key: 'inv_logo', label: 'Logo Inversionista', type: 'catalogo_atributo', catalogo: 'inversionistas', dependeDe: 'inversionista', dependeDeLabel: 'Inversionista', campoAtributo: 'logo', esImagen: true },
        { key: 'inv_supervision', label: 'Requiere supervisión técnica', type: 'catalogo_atributo', catalogo: 'inversionistas', dependeDe: 'inversionista', dependeDeLabel: 'Inversionista', campoAtributo: 'supervision_tecnica', esBooleano: true },
      ], 'inversionista_grupo', 'Inversionista'),

      ...camposPlegables([
        { key: 'instalador', label: 'Instalador', type: 'instalador' },
        { key: 'instalador_nit', label: 'NIT instalador', type: 'catalogo_atributo', catalogo: 'instaladores', dependeDe: 'instalador', dependeDeLabel: 'Instalador', campoAtributo: 'nit' },
        { key: 'instalador_logo', label: 'Logo Instalador', type: 'catalogo_atributo', catalogo: 'instaladores', dependeDe: 'instalador', dependeDeLabel: 'Instalador', campoAtributo: 'logo', esImagen: true },
      ], 'instalador_grupo', 'Instalador'),
    ],
  },
  {
    id: 'civil', label: 'Civil', icon: HardHat,
    fields: [
      { key: 'arboles_intervenir', label: 'Árboles a intervenir', type: 'text' },
      { key: 'area_aprovechada', label: 'Área aprovechada (m²)', type: 'text' },
      { key: 'perimetro_aprovechado', label: 'Perímetro aprovechado (m)', type: 'text' },
      { key: 'descripcion_acceso', label: 'Descripción del acceso', type: 'textarea' },
      { key: 'mvtos_tierra', label: 'Movimientos de tierra', type: 'boolean' },
      { key: 'topografia_insumo', label: 'Topografía (insumo disponible)', type: 'boolean' },
      { key: 'es_insumo', label: 'Estudio de Suelos (insumo disponible)', type: 'boolean' },
      { key: 'zona_viento', label: 'Zona de viento', type: 'text' },
      { key: 'postes_cerca_predio', label: 'Postes en el predio (o cerca)', type: 'boolean' },

      /* ===================================================================
         CERRAMIENTO — replica el Excel de referencia de Camilo. Dentro de
         cada sub-subcategoría, primero van los campos que digita el
         ingeniero (los que en el Excel tenían fondo azul) y luego los que
         se calculan solos (fórmulas). Los "computed" leen otros campos de
         esta MISMA sección ('civil') por su key, vía el objeto que reciben.
         =================================================================== */
      ...camposPlegables([
      // — Cerramiento (general) —
      { key: 'cerr_general_titulo', label: 'General', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_longitud_total', label: 'Longitud total cerramiento (m)', type: 'text' },

      // — Pedestales — (100% calculado: postes + vientos)
      { key: 'cerr_pedestales_titulo', label: 'Pedestales', type: 'grupo_titulo', nivel: 2 },
      {
        key: 'cerr_pedestales_cantidad', label: 'Cantidad pedestales', type: 'computed',
        formula: (d) => {
          const postes = calcCerrCantidadPostes(d);
          const vientos = parseFloat(d?.cerr_vientos_cantidad) || 0;
          return String(postes + vientos);
        },
      },

      // — Tubería —
      { key: 'cerr_tuberia_titulo', label: 'Tubería', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_separacion_postes', label: 'Separación entre postes (m)', type: 'text' },
      { key: 'cerr_cambios_direccion', label: 'Cantidad cambios de dirección', type: 'text' },
      { key: 'cerr_separacion_diagonales', label: 'Separación entre diagonales (m)', type: 'text' },
      { key: 'cerr_diametro_poste_pulg', label: 'Diámetro de poste (pulg)', type: 'text' },
      {
        key: 'cerr_postes_cantidad', label: 'Cantidad postes', type: 'computed',
        formula: (d) => String(calcCerrCantidadPostes(d)),
      },
      {
        key: 'cerr_diagonales_cantidad', label: 'Diagonales', type: 'computed',
        formula: (d) => {
          const longitud = parseFloat(d?.cerr_longitud_total) || 0;
          const sepDiag = parseFloat(d?.cerr_separacion_diagonales) || 0;
          const cambios = parseFloat(d?.cerr_cambios_direccion) || 0;
          if (!sepDiag) return '0';
          return String(Math.ceil(((longitud / sepDiag) + cambios) * 2));
        },
      },
      {
        key: 'cerr_diametro_poste_m', label: 'Diámetro de poste (m)', type: 'computed',
        formula: (d) => ((parseFloat(d?.cerr_diametro_poste_pulg) || 0) * 0.0254).toFixed(4),
      },
      {
        key: 'cerr_circunferencia_poste', label: 'Circunferencia poste (m)', type: 'computed',
        formula: (d) => (((parseFloat(d?.cerr_diametro_poste_pulg) || 0) * 0.0254) * Math.PI).toFixed(4),
      },

      // — Vientos —
      { key: 'cerr_vientos_titulo', label: 'Vientos', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_vientos_cantidad', label: 'Cantidad vientos', type: 'text' },

      // — Ángulos (Malla) —
      { key: 'cerr_angulos_titulo', label: 'Ángulos (Malla)', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_perimetro_angulo', label: 'Perímetro ángulo (m)', type: 'text' },
      { key: 'cerr_perimetro_malla', label: 'Perímetro (m)', type: 'text' },
      {
        key: 'cerr_angulos_cantidad', label: 'Cantidad ángulos', type: 'computed',
        formula: (d) => String(Math.max(0, calcCerrCantidadPostes(d) - 1)),
      },
      {
        key: 'cerr_area_total', label: 'Área total (m²)', type: 'computed',
        formula: (d) => {
          const perimetro = parseFloat(d?.cerr_perimetro_malla) || 0;
          const angulos = Math.max(0, calcCerrCantidadPostes(d) - 1);
          const separacion = parseFloat(d?.cerr_separacion_postes) || 0;
          return (perimetro * angulos * separacion).toFixed(4);
        },
      },

      // — Platina (si aplica) — (100% calculado; si se usa platina, anula la
      // "Longitud total de cinta bandit en cerramiento" de más abajo, y viceversa)
      { key: 'cerr_platina_titulo', label: 'Platina (si aplica)', type: 'grupo_titulo', nivel: 2 },
      {
        key: 'cerr_platinas_cantidad', label: 'Cantidad platinas', type: 'computed',
        formula: (d) => String(3 * calcCerrCantidadPostes(d)),
      },

      // — Cinta Bandit —
      { key: 'cerr_bandit_titulo', label: 'Cinta Bandit', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_bandit_por_poste', label: 'Cantidad por poste', type: 'text' },
      { key: 'cerr_bandit_por_angulo', label: 'Cantidad por ángulo', type: 'text' },
      { key: 'cerr_bandit_por_diagonal', label: 'Cantidad por diagonal', type: 'text' },
      {
        key: 'cerr_bandit_total_cerramiento', label: 'Longitud total de cinta bandit en cerramiento (m)', type: 'computed',
        formula: (d) => {
          const circ = ((parseFloat(d?.cerr_diametro_poste_pulg) || 0) * 0.0254) * Math.PI;
          const perimAngulo = parseFloat(d?.cerr_perimetro_angulo) || 0;
          const postes = calcCerrCantidadPostes(d);
          const angulos = Math.max(0, postes - 1);
          const longitud = parseFloat(d?.cerr_longitud_total) || 0;
          const sepDiag = parseFloat(d?.cerr_separacion_diagonales) || 0;
          const cambios = parseFloat(d?.cerr_cambios_direccion) || 0;
          const diagonales = sepDiag ? Math.ceil(((longitud / sepDiag) + cambios) * 2) : 0;
          const porPoste = parseFloat(d?.cerr_bandit_por_poste) || 0;
          const porAngulo = parseFloat(d?.cerr_bandit_por_angulo) || 0;
          const porDiagonal = parseFloat(d?.cerr_bandit_por_diagonal) || 0;
          const total = (circ * 2 * porPoste * postes) + (perimAngulo * 2 * angulos * porAngulo) + (circ * 2 * porDiagonal * diagonales);
          return total.toFixed(2);
        },
      },
      {
        key: 'cerr_bandit_total_porton', label: 'Longitud total de cinta bandit en portón (m)', type: 'computed',
        formula: (d) => {
          const circ = ((parseFloat(d?.cerr_diametro_poste_pulg) || 0) * 0.0254) * Math.PI;
          const total = (circ * 2 * 4 * 6) + (circ * 2 * 6 * 3) + (circ * 2 * 4 * 2);
          return total.toFixed(2);
        },
      },

      // — Portón — (fijo, no depende de nada)
      { key: 'cerr_porton_titulo', label: 'Portón', type: 'grupo_titulo', nivel: 2 },
      {
        key: 'cerr_porton_bisagras', label: 'Cantidad de bisagras', type: 'computed',
        formula: () => '8',
      },

      // — Pintura —
      { key: 'cerr_pintura_titulo', label: 'Pintura', type: 'grupo_titulo', nivel: 2 },
      { key: 'cerr_imprimante_1mano', label: 'Imprimante 1 mano (m²/gal)', type: 'text' },
      { key: 'cerr_rendimiento_2manos', label: 'Rendimiento a 2 manos (m²/gal)', type: 'text' },
      {
        key: 'cerr_pintura_m2', label: 'm² de pintura (desperdicio 15%)', type: 'computed',
        formula: (d) => {
          const perimetro = parseFloat(d?.cerr_perimetro_malla) || 0;
          const angulos = Math.max(0, calcCerrCantidadPostes(d) - 1);
          const separacion = parseFloat(d?.cerr_separacion_postes) || 0;
          return ((perimetro * angulos * separacion) * 1.15).toFixed(2);
        },
      },
      {
        key: 'cerr_galones_imprimante', label: 'Galones de imprimante', type: 'computed',
        formula: (d) => {
          const perimetro = parseFloat(d?.cerr_perimetro_malla) || 0;
          const angulos = Math.max(0, calcCerrCantidadPostes(d) - 1);
          const separacion = parseFloat(d?.cerr_separacion_postes) || 0;
          const pinturaM2 = (perimetro * angulos * separacion) * 1.15;
          const rendimiento = parseFloat(d?.cerr_imprimante_1mano) || 0;
          return rendimiento ? String(Math.ceil(pinturaM2 / rendimiento)) : '0';
        },
      },
      {
        key: 'cerr_galones_pintura', label: 'Galones de pintura', type: 'computed',
        formula: (d) => {
          const perimetro = parseFloat(d?.cerr_perimetro_malla) || 0;
          const angulos = Math.max(0, calcCerrCantidadPostes(d) - 1);
          const separacion = parseFloat(d?.cerr_separacion_postes) || 0;
          const pinturaM2 = (perimetro * angulos * separacion) * 1.15;
          const rendimiento = parseFloat(d?.cerr_rendimiento_2manos) || 0;
          return rendimiento ? String(Math.ceil(pinturaM2 / rendimiento)) : '0';
        },
      },

      // — Pasos de fauna — (100% calculado)
      { key: 'cerr_pasos_fauna_titulo', label: 'Pasos de fauna', type: 'grupo_titulo', nivel: 2 },
      {
        key: 'cerr_pasos_fauna_cantidad', label: 'Cantidad pasos de fauna', type: 'computed',
        formula: (d) => String(Math.round((parseFloat(d?.cerr_longitud_total) || 0) / 100)),
      },
      ], 'cerramiento', 'Cerramiento'),
    ],
  },
  {
    id: 'mecanica', label: 'Mecánica', icon: Cog,
    fields: [
      { key: 'numero_mesas', label: 'Número de mesas', type: 'text' },
      { key: 'tipo_mesas', label: 'Tipo de mesas', type: 'select', opciones: ['Tracker', 'Mesa fija'] },
      { key: 'proveedor', label: 'Proveedor', type: 'proveedor' },
      { key: 'config_mesas', label: 'Configuración de las mesas', type: 'text' },
      { key: 'hincas_por_mesa', label: 'Hincas por mesa', type: 'text' },
      {
        key: 'numero_hincas', label: 'Número de hincas', type: 'computed',
        formula: (d) => String((parseFloat(d?.numero_mesas) || 0) * (parseFloat(d?.hincas_por_mesa) || 0)),
        ayuda: 'Se calcula solo: N.° de mesas × Hincas por mesa',
      },
      { key: 'numero_modulos', label: 'Número de módulos', type: 'text' },
      { key: 'especificacion_modulos', label: 'Especificación de módulos', type: 'text' },
      { key: 'inclinacion_modulos', label: 'Inclinación máxima de módulos (°)', type: 'text' },
      { key: 'altura_min_terreno', label: 'Altura mínima con terreno (m)', type: 'text' },
      { key: 'tolerancia_superior', label: 'Tolerancia superior (m)', type: 'text' },
      { key: 'tolerancia_inferior', label: 'Tolerancia inferior (m)', type: 'text' },
    ],
  },
  {
    id: 'geotecnia', label: 'Geotecnia', icon: Mountain,
    fields: [
      { key: 'tipo_suelo', label: 'Tipo de suelo', type: 'text' },
      { key: 'zona_amenaza_sismica', label: 'Zona de amenaza sísmica', type: 'text' },
      { key: 'cbr', label: 'CBR (%)', type: 'text' },
      { key: 'ensayos_quimicos', label: 'Ensayos químicos', type: 'textarea' },
      { key: 'coef_balasto', label: 'Coeficiente de balasto', type: 'text' },
      { key: 'nivel_freatico', label: 'Nivel freático', type: 'boolean' },
      { key: 'presencia_rocas', label: 'Presencia de rocas', type: 'boolean' },
      { key: 'cohesion_efectiva', label: "Cohesión efectiva (c')", type: 'text' },
      { key: 'angulo_friccion', label: "Ángulo de fricción efectiva (ø')", type: 'text' },
      { key: 'resistencia_corte', label: 'Resist. al corte no drenada (Cu)', type: 'text' },
      { key: 'modulo_elasticidad', label: 'Módulo de elasticidad (Es)', type: 'text' },
      { key: 'modulo_poisson', label: 'Módulo de Poisson (μ)', type: 'text' },
      { key: 'peso_unitario', label: 'Peso unitario', type: 'text' },
      { key: 'temperatura_suelo', label: 'Temperatura del suelo', type: 'text' },
      { key: 'resistividad_termica', label: 'Resistividad térmica', type: 'text' },
      { key: 'suelista', label: 'Suelista', type: 'text' },
      { key: 'clasificacion_suelo', label: 'Clasificación de suelo (NSR-10)', type: 'select', opciones: ['A', 'B', 'C', 'D', 'E', 'F'] },
      catalogSchemaField('capacidad_admisible_cerramiento', 'CERRAMIENTO_PERIMETRAL', 'CAPACIDAD_SUELO', 'Capacidad admisible del suelo (cimentación cerramiento)'),
      catalogSchemaField('capacidad_admisible_porton', 'PORTON_METALICO', 'CAPACIDAD_SUELO', 'Capacidad admisible del suelo (cimentación portón)'),
      catalogSchemaField('capacidad_portante_shelter', 'SHELTER_CIMENTACION', 'CAP_PORTANTE', 'Capacidad portante considerada (shelter)'),
    ],
  },
  {
    id: 'estructural', label: 'Estructural', icon: Building2,
    fields: [
      /* Cimentaciones del proyecto: cada una se elige de las plantillas ya   */
      /* creadas en la pestaña "Cimentaciones" (un slot fijo por cada uno de  */
      /* los 9 tipos) — no se digitan dimensiones aquí. El enlace es "en      */
      /* vivo": si alguien edita la plantilla después, este resumen refleja   */
      /* siempre la versión más reciente (solo se guarda el id elegido).      */
      { key: 'plantilla_postes_mt', label: 'Postes MT', type: 'cimentacion_plantilla', tipoCimentacion: 'postes_mt' },
      { key: 'plantilla_luminarias', label: 'Luminarias', type: 'cimentacion_plantilla', tipoCimentacion: 'luminarias' },
      { key: 'plantilla_camaras', label: 'Cámaras', type: 'cimentacion_plantilla', tipoCimentacion: 'camaras' },
      { key: 'plantilla_inversores', label: 'Inversores', type: 'cimentacion_plantilla', tipoCimentacion: 'inversores' },
      { key: 'plantilla_cerramiento_postes', label: 'Cerramiento · Postes', type: 'cimentacion_plantilla', tipoCimentacion: 'cerramiento_postes' },
      { key: 'plantilla_cerramiento_porton', label: 'Cerramiento · Portón', type: 'cimentacion_plantilla', tipoCimentacion: 'cerramiento_porton' },
      { key: 'plantilla_cerramiento_paso_fauna', label: 'Cerramiento · Paso de fauna', type: 'cimentacion_plantilla', tipoCimentacion: 'cerramiento_paso_fauna' },
      { key: 'plantilla_shelter_ct', label: 'Shelter · Centro de Transformación', type: 'cimentacion_plantilla', tipoCimentacion: 'shelter_ct' },
      { key: 'plantilla_shelter_trampa_aceite', label: 'Shelter · Trampa de aceite', type: 'cimentacion_plantilla', tipoCimentacion: 'shelter_trampa_aceite' },
      catalogSchemaField('tipo_galvanizado', 'METAL', 'GALVANIZADO', 'Tipo de galvanizado'),
      { key: 'esquema_puntado', label: 'Esquema de puntado', type: 'text' },
      { key: 'espec_aceros_pernos', label: 'Especificaciones de aceros y pernos', type: 'text' },
      { key: 'espec_refuerzo', label: 'Especificación de refuerzo', type: 'text' },
      { key: 'Aa', label: 'Aa', type: 'text' },
      { key: 'Av', label: 'Av', type: 'text' },

      /* Todo lo que sigue alimenta el motor de Notas Técnicas y se agrupa    */
      /* en una sección colapsable para no saturar la pestaña (ver           */
      /* GRUPO_NOTAS_TECNICAS y SectionFieldsGrid).                           */
      ...camposNotasTecnicas([
      /* ---- Concreto y metal (globales de Notas Técnicas: alimentan las    */
      /* notas CON-* y MET-* de TODAS las estructuras) ------------------- */
      catalogSchemaField('concreto_solado_fc', 'CONCRETO', 'FC_SOLADO', "Concreto de solado — f'c"),
      catalogSchemaField('concreto_solado_espesor', 'CONCRETO', 'ESPESOR_SOLADO', 'Concreto de solado — espesor'),
      catalogSchemaField('acero_refuerzo_fy', 'CONCRETO', 'ACERO_FY', 'Acero de refuerzo — fy'),
      /* La norma del acero de refuerzo todavía no tiene placeholder en el
         catálogo (CON-003 solo interpola fy), pero sí es un dato técnico
         reutilizable que los proyectos ya capturan: se maneja con el mismo
         patrón de desplegable + "Otro" que el resto de materiales. */
      repositoryField(STANDALONE_TECHNICAL_VALUES.ACERO_REFUERZO_NORMA, 'Acero de refuerzo — norma'),
      catalogSchemaField('agregado_tamano_max', 'CONCRETO', 'AGREGADO_MAX', 'Agregados — tamaño máximo nominal'),
      catalogSchemaField('relacion_agua_cemento_max', 'CONCRETO', 'RELACION_AC_MAX', 'Relación agua/cemento máxima'),
      catalogSchemaField('recubrimiento_tierra', 'CONCRETO', 'REC_TIERRA', 'Recubrimiento — en contacto con tierra'),
      catalogSchemaField('recubrimiento_no_tierra', 'CONCRETO', 'REC_NO_TIERRA', 'Recubrimiento — sin contacto con tierra'),
      catalogSchemaField('galvanizado_frio_zinc', 'METAL', 'ZINC_FRIO', 'Galvanizado en frío — zinc mínimo'),
      catalogSchemaField('galvanizado_frio_capas', 'METAL', 'CAPAS_REPARACION', 'Galvanizado en frío — capas de reparación'),

      /* ---- Cerramiento perimetral ------------------------------------- */
      catalogSchemaField('cerramiento_poste_diametro', 'CERRAMIENTO_PERIMETRAL', 'POSTE_DIAMETRO', 'Cerramiento — poste típico: diámetro nominal'),
      catalogSchemaField('cerramiento_poste_espesor', 'CERRAMIENTO_PERIMETRAL', 'POSTE_ESPESOR', 'Cerramiento — poste típico: espesor'),
      catalogSchemaField('cerramiento_poste_anclaje', 'CERRAMIENTO_PERIMETRAL', 'POSTE_EMBEBIDO', 'Cerramiento — poste típico: anclaje/embebido (m)'),
      catalogSchemaField('cerramiento_poste_afloramiento', 'CERRAMIENTO_PERIMETRAL', 'POSTE_AFLORAMIENTO', 'Cerramiento — poste típico: afloramiento (m)'),
      {
        key: 'cerramiento_poste_longitud_total', label: 'Cerramiento — poste típico: longitud total', type: 'computed',
        formula: (d) => sumMetersFormatted(d?.cerramiento_poste_anclaje, d?.cerramiento_poste_afloramiento) || '— (completa anclaje y afloramiento)',
        ayuda: 'Se calcula solo: anclaje + afloramiento del poste',
      },
      catalogSchemaField('cerramiento_poste_separacion', 'CERRAMIENTO_PERIMETRAL', 'POSTE_SEPARACION', 'Cerramiento — poste típico: separación'),
      catalogSchemaField('cerramiento_tubo_secundario_diametro', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_DIAMETRO', 'Cerramiento — diagonales y vientos: diámetro nominal'),
      catalogSchemaField('cerramiento_tubo_secundario_espesor', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_ESPESOR', 'Cerramiento — diagonales y vientos: espesor'),
      catalogSchemaField('cerramiento_diagonales_longitud', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_LONGITUD', 'Cerramiento — diagonales: longitud'),
      catalogSchemaField('cerramiento_diagonales_separacion', 'CERRAMIENTO_PERIMETRAL', 'DIAGONAL_SEPARACION', 'Cerramiento — diagonales: separación'),
      catalogSchemaField('cerramiento_vientos_longitud', 'CERRAMIENTO_PERIMETRAL', 'VIENTO_LONGITUD', 'Cerramiento — vientos: longitud'),
      catalogSchemaField('cerramiento_vientos_separacion', 'CERRAMIENTO_PERIMETRAL', 'VIENTO_SEPARACION', 'Cerramiento — vientos: separación'),
      catalogSchemaField('cerramiento_malla_especificacion', 'CERRAMIENTO_PERIMETRAL', 'MALLA', 'Cerramiento — malla eslabonada'),
      catalogSchemaField('cerramiento_bandit_calibre', 'CERRAMIENTO_PERIMETRAL', 'BANDIT', 'Cerramiento — cinta bandit: calibre'),
      catalogSchemaField('cerramiento_fijacion_separacion', 'CERRAMIENTO_PERIMETRAL', 'FIJACION', 'Cerramiento — separación máxima entre fijaciones'),
      catalogSchemaField('cerramiento_acero_norma', 'CERRAMIENTO_PERIMETRAL', 'ACERO', 'Cerramiento — perfilería: norma del acero'),
      catalogSchemaField('cerramiento_acero_fy', 'CERRAMIENTO_PERIMETRAL', 'FY', 'Cerramiento — perfilería: fy'),
      catalogSchemaField('cerramiento_acero_fu', 'CERRAMIENTO_PERIMETRAL', 'FU', 'Cerramiento — perfilería: fu'),
      catalogSchemaField('cerramiento_soldadura_espesor', 'CERRAMIENTO_PERIMETRAL', 'SOLDADURA', 'Cerramiento — soldadura: espesor mínimo'),
      { key: 'ambiente_corrosion_clase', label: 'Cerramiento — clase de ambiente de corrosión (ISO 9223)', type: 'select', opciones: ['C1', 'C2', 'C3', 'C4', 'C5'] },
      { key: 'galvanizado_perdida_zinc_proyectada', label: 'Cerramiento — pérdida de zinc proyectada (vida útil)', type: 'text' },

      /* ---- Portón metálico -------------------------------------------- */
      catalogSchemaField('porton_viga_amarre_seccion', 'PORTON_METALICO', 'VIGA_AMARRE', 'Portón — viga de amarre: sección'),
      catalogSchemaField('porton_reemplazo_granular', 'PORTON_METALICO', 'REEMPLAZO_GRANULAR', 'Portón — reemplazo de material granular'),
      catalogSchemaField('porton_perfil_embebido', 'PORTON_METALICO', 'PERFIL', 'Portón — perfil metálico embebido'),
      catalogSchemaField('porton_acero_norma', 'PORTON_METALICO', 'ACERO', 'Portón — norma del acero'),
      catalogSchemaField('porton_acero_fy', 'PORTON_METALICO', 'FY', 'Portón — fy'),
      catalogSchemaField('porton_acero_fu', 'PORTON_METALICO', 'FU', 'Portón — fu'),
      catalogSchemaField('porton_soldadura_espesor', 'PORTON_METALICO', 'SOLDADURA', 'Portón — soldadura: espesor mínimo'),

      /* ---- Cimentación de shelter (los sísmicos quedan EXCLUIDOS en esta */
      /* fase: no se crea campo para ellos — ver catálogo) --------------- */
      catalogSchemaField('shelter_cota_minima', 'SHELTER_CIMENTACION', 'COTA_MINIMA', 'Shelter — cota mínima'),
      catalogSchemaField('shelter_calado_estudio', 'SHELTER_CIMENTACION', 'CALADO_ESTUDIO', 'Shelter — calado que exige estudio hidráulico'),
      catalogSchemaField('shelter_borde_libre', 'SHELTER_CIMENTACION', 'BORDE_LIBRE', 'Shelter — borde libre adicional'),
      catalogSchemaField('shelter_micropilote_profundidad', 'SHELTER_CIMENTACION', 'MICROPILOTE_PROF', 'Shelter — micropilote: profundidad (m)'),
      catalogSchemaField('shelter_micropilote_sobresaliente', 'SHELTER_CIMENTACION', 'MICROPILOTE_SOBRE', 'Shelter — micropilote: sobresaliente (m)'),
      {
        key: 'shelter_micropilote_longitud_total', label: 'Shelter — micropilote: longitud total', type: 'computed',
        formula: (d) => sumMetersFormatted(d?.shelter_micropilote_profundidad, d?.shelter_micropilote_sobresaliente) || '— (completa profundidad y sobresaliente)',
        ayuda: 'Se calcula solo: profundidad + sobresaliente del micropilote',
      },
      catalogSchemaField('shelter_compactacion_minima', 'SHELTER_CIMENTACION', 'COMPACTACION', 'Shelter — compactación mínima'),
      catalogSchemaField('shelter_carga_mantenimiento', 'SHELTER_CIMENTACION', 'CV_MANT', 'Shelter — carga viva de mantenimiento'),
      catalogSchemaField('shelter_carga_sobrecarga', 'SHELTER_CIMENTACION', 'CV_SOBRE', 'Shelter — sobrecarga'),
      catalogSchemaField('shelter_carga_muerta_total', 'SHELTER_CIMENTACION', 'CM_TOTAL', 'Shelter — carga muerta total'),
      catalogSchemaField('shelter_carga_viento', 'SHELTER_CIMENTACION', 'VIENTO', 'Shelter — carga de viento'),

      /* ---- Soporte de inversores -------------------------------------- */
      catalogSchemaField('inversores_manual_cargas', 'SOPORTE_INVERSORES', 'MANUAL_CARGAS', 'Inversores — manual de cargas de referencia'),
      catalogSchemaField('inversores_fc_ciclopeo', 'SOPORTE_INVERSORES', 'FC_CICLOPEO', "Inversores — f'c del concreto ciclópeo"),
      ]),
    ],
  },
  {
    id: 'hidraulico', label: 'Hidráulico', icon: Droplets,
    fields: [
      { key: 'obras_hidraulicas', label: 'Obras hidráulicas requeridas', type: 'boolean' },
      { key: 'tipo_obras', label: 'Tipo de obras', type: 'text' },
      { key: 'inundabilidad', label: '¿Manchas mayores a 20cm Tr 25 años?', type: 'boolean' },
      { key: 'velocidades', label: '¿Velocidades de flujo mayores a 1m/s?', type: 'boolean' },
      { key: 'cuerpos_agua', label: 'Cuerpos de agua cercanos', type: 'boolean' },
      { key: 'medidas_erosion', label: '¿Requiere implementación de medidas para la erosión?', type: 'boolean' },
      { key: 'manejo_vegetacion', label: '¿Requiere manejo especial de vegetación?', type: 'boolean' },
      { key: 'estaciones_pluviometricas', label: 'Estaciones pluviométricas', type: 'stations' },
    ],
  },
  {
    id: 'electrico', label: 'Eléctrico', icon: Zap,
    fields: [
      { key: 'planta_fv', label: 'Planta FV', type: 'text' },
      { key: 'potencia_nominal', label: 'Potencia nominal', type: 'text' },
      { key: 'potencia_pico', label: 'Potencia pico', type: 'text' },
      { key: 'dc_ac_ratio', label: 'DC/AC ratio', type: 'text' },
      { key: 'tipo_estructura', label: 'Tipo de estructura', type: 'text' },
      { key: 'distancia_pitch', label: 'Distancia Pitch', type: 'text' },
      { key: 'modulos_por_string', label: 'Módulos por string', type: 'text' },
      { key: 'modulos_ev', label: 'Módulos FV', type: 'text' },

      ...camposPlegables([
        { key: 'factor_potencia', label: 'Factor de potencia (inversores)', type: 'text' },
        { key: 'numero_inversores', label: 'Número de inversores', type: 'text' },
        { key: 'referencia_inversores', label: 'Referencia de inversores', type: 'text' },
        { key: 'modulos_por_inversor', label: 'Módulos por inversor', type: 'modulos_inversor' },
      ], 'inversores', 'Inversores'),

      /* Equipos eléctricos del proyecto: cada uno se elige de las plantillas */
      /* ya creadas en "Equipos eléctricos" (un slot fijo por cada uno de los */
      /* 18 tipos) — enlace en vivo, igual criterio que en Estructural.       */
      ...camposPlegables([
        { key: 'equipo_panel', label: 'Panel', type: 'equipo_plantilla', tipoEquipo: 'panel' },
        { key: 'equipo_inversor', label: 'Inversor', type: 'equipo_plantilla', tipoEquipo: 'inversor' },
        { key: 'equipo_transformador_potencia', label: 'Transformador de potencia', type: 'equipo_plantilla', tipoEquipo: 'transformador_potencia' },
        { key: 'equipo_transformador_corriente', label: 'Transformador de corriente', type: 'equipo_plantilla', tipoEquipo: 'transformador_corriente' },
        { key: 'equipo_transformador_potencial', label: 'Transformador de potencial', type: 'equipo_plantilla', tipoEquipo: 'transformador_potencial' },
        { key: 'equipo_reconectador', label: 'Reconectador', type: 'equipo_plantilla', tipoEquipo: 'reconectador' },
        { key: 'equipo_celda', label: 'Celda', type: 'equipo_plantilla', tipoEquipo: 'celda' },
        { key: 'equipo_tablero', label: 'Tablero', type: 'equipo_plantilla', tipoEquipo: 'tablero' },
        { key: 'equipo_breaker', label: 'Breaker', type: 'equipo_plantilla', tipoEquipo: 'breaker' },
        { key: 'equipo_dps', label: 'DPS', type: 'equipo_plantilla', tipoEquipo: 'dps' },
        { key: 'equipo_medidor', label: 'Medidor', type: 'equipo_plantilla', tipoEquipo: 'medidor' },
        { key: 'equipo_cable_dc', label: 'Cable DC', type: 'equipo_plantilla', tipoEquipo: 'cable_dc' },
        { key: 'equipo_cable_ac', label: 'Cable AC', type: 'equipo_plantilla', tipoEquipo: 'cable_ac' },
        { key: 'equipo_cable_cobre_desnudo', label: 'Cable · Cobre desnudo', type: 'equipo_plantilla', tipoEquipo: 'cable_cobre_desnudo' },
        { key: 'equipo_bandeja', label: 'Bandeja', type: 'equipo_plantilla', tipoEquipo: 'bandeja' },
        { key: 'equipo_tuberia_poliamida', label: 'Tubería · Poliamida', type: 'equipo_plantilla', tipoEquipo: 'tuberia_poliamida' },
        { key: 'equipo_tuberia_pvc', label: 'Tubería · PVC/rígida', type: 'equipo_plantilla', tipoEquipo: 'tuberia_pvc' },
        { key: 'equipo_shelter', label: 'Shelter', type: 'equipo_plantilla', tipoEquipo: 'shelter' },
      ], 'equipos_electricos', 'Equipos eléctricos'),

      /* ===================================================================
         Datos adicionales de Eléctrico — mismo criterio que Cerramiento en
         Civil: agrupados en sub-subcategorías plegables. "Nivel de
         contaminación de aire" queda suelto (en el Excel de referencia
         venía como "Sin categoría", sin encajar en ningún grupo).
         =================================================================== */
      ...camposPlegables([
        { key: 'voltaje_red_mt_or', label: 'Voltaje red MT OR', type: 'text' },
        { key: 'codigo_obra_or', label: 'Código obra OR', type: 'text' },
        { key: 'icc_trifasica_mt', label: 'Corriente de cortocircuito trifásica red MT', type: 'text' },
        { key: 'icc_monofasica_mt', label: 'Corriente de cortocircuito monofásica red MT', type: 'text' },
        { key: 'icc_trifasica_bt', label: 'Corriente de cortocircuito trifásica BT', type: 'text' },
        { key: 'icc_monofasica_bt', label: 'Corriente de cortocircuito monofásica BT', type: 'text' },
        { key: 'codigo_bdi', label: 'Código BDI', type: 'text' },
        { key: 'codigo_ct', label: 'Código CT', type: 'text' },
        { key: 'nombre_circuito', label: 'Nombre Circuito', type: 'text' },
        { key: 'nombre_subestacion', label: 'Nombre subestación', type: 'text' },
      ], 'datos_ecs_or', 'Datos ECS / Insumos OR'),

      ...camposPlegables([
        { key: 'datos_temperatura_horaria', label: 'Datos de temperatura horaria', type: 'text' },
        { key: 'datos_irradiacion', label: 'Datos de irradiación', type: 'text' },
        { key: 'irradiacion_global_horizontal_anual', label: 'Irradiación global en un plano horizontal anual', type: 'text' },
        { key: 'generacion_anual', label: 'Generación anual', type: 'text' },
        { key: 'tamanos_string', label: 'Tamaños string', type: 'text' },
        { key: 'energia_mensual', label: 'Energía mensual', type: 'energia_mensual' },
      ], 'simulacion_pvsyst', 'Simulación Pvsyst'),

      ...camposPlegables([
        { key: 'tramo_panel_transicion_subterranea', label: 'Tramo string: panel → transición subterránea', type: 'text' },
        { key: 'tramo_transicion_subterranea_inversor', label: 'Tramo string: transición subterránea → inversor', type: 'text' },
        { key: 'tramo_inversor_tablero_bt', label: 'Tramo inversor → tablero de baja tensión', type: 'text' },
        { key: 'tramo_celda_remonte_poste_afloramiento', label: 'Tramo celda de remonte → poste de afloramiento', type: 'text' },
        { key: 'tramo_poste_afloramiento_punto_conexion', label: 'Tramo poste de afloramiento → punto de conexión', type: 'text' },
        { key: 'tramo_spt_subestacion_inversores_trackers', label: 'Tramo SPT subestación, inversores y trackers', type: 'text' },
        { key: 'tramo_spt_cerramiento_equipotencializacion', label: 'Tramo SPT cerramiento y equipotencialización', type: 'text' },
        { key: 'tramo_inversor_smartlogger', label: 'Tramo inversor → smartlogger', type: 'text' },
        { key: 'tramo_subestacion_estacion_meteorologica', label: 'Tramo subestación → estación meteorológica', type: 'text' },
        { key: 'tramo_camara_cctv_subestacion', label: 'Tramo cámara CCTV → subestación', type: 'text' },
      ], 'tramos_electricos', 'Tramos'),

      ...camposPlegables([
        { key: 'tipo_energizacion_aislamiento', label: 'Tipo de energización aislamiento', type: 'text' },
        { key: 'resistencias_cierre', label: 'Resistencias de cierre', type: 'text' },
        { key: 'compensacion_paralelo', label: 'Compensación en paralelo', type: 'text' },
        { key: 'distancia_dps_subestacion', label: 'Distancia del DPS a la subestación', type: 'text' },
        { key: 'vano_tipico_mt_acometida', label: 'Vano típico de la línea de media tensión en la acometida', type: 'text' },
        { key: 'indice_fallas_linea', label: 'Índice de fallas de la línea', type: 'text' },
        { key: 'tasa_falla_aceptable_aislamiento', label: 'Tasa de falla aceptable para el aislamiento', type: 'text' },
      ], 'coordinacion_aislamiento', 'Coordinación de aislamiento'),

      { key: 'nivel_contaminacion_aire', label: 'Nivel de contaminación de aire', type: 'text' },
    ],
  },
];

/* Departamentos y municipios de Colombia (fuente: DIVIPOLA/DANE), para los
   selectores de Municipio/Departamento y para derivar la abreviatura de 3
   letras usada en el código documental (ej. Boyacá -> BOY).             */
export const COLOMBIA = [
  { nombre: "Amazonas", municipios: ["El Encanto","La Chorrera","La Pedrera","La Victoria","Leticia","Mirití-Paraná","Puerto Alegría","Puerto Arica","Puerto Nariño","Puerto Santander","Tarapacá"] },
  { nombre: "Antioquia", municipios: ["Abejorral","Abriaquí","Alejandría","Amagá","Amalfi","Andes","Angelópolis","Angostura","Anorí","Anzá","Apartadó","Arboletes","Argelia","Armenia","Barbosa","Bello","Belmira","Betania","Betulia","Briceño","Buriticá","Cáceres","Caicedo","Caldas","Campamento","Cañasgordas","Caracolí","Caramanta","Carepa","Carmen de Viboral","Carolina del Príncipe","Caucasia","Chigorodó","Cisneros","Ciudad Bolívar","Cocorná","Concepción","Concordia","Copacabana","Dabeiba","Donmatías","Ebéjico","El Bagre","El Peñol","El Retiro","Entrerríos","Envigado","Fredonia","Frontino","Giraldo","Girardota","Gómez Plata","Granada","Guadalupe","Guarne","Guatapé","Heliconia","Hispania","Itagüí","Ituango","Jardín","Jericó","La Ceja","La Estrella","La Pintada","La Unión","Liborina","Maceo","Marinilla","Medellín","Montebello","Murindó","Mutatá","Nariño","Nechí","Necoclí","Olaya","Peque","Pueblorrico","Puerto Berrío","Puerto Nare","Puerto Triunfo","Remedios","Rionegro","Sabanalarga","Sabaneta","Salgar","San Andrés de Cuerquia","San Carlos","San Francisco","San Jerónimo","San José de la Montaña","San Juan de Urabá","San Luis","San Pedro de los Milagros","San Pedro de Urabá","San Rafael","San Roque","San Vicente Ferrer","Santa Bárbara","Santa Fe de Antioquia","Santa Rosa de Osos","Santo Domingo","Santuario","Segovia","Sonsón","Sopetrán","Támesis","Tarazá","Tarso","Titiribí","Toledo","Turbo","Uramita","Urrao","Valdivia","Valparaíso","Vegachí","Venecia","Yalí","Yarumal","Yolombó","Yondó","Zaragoza"] },
  { nombre: "Arauca", municipios: ["Arauca","Arauquita","Cravo Norte","Fortul","Puerto Rondón","Saravena","Tame"] },
  { nombre: "Atlántico", municipios: ["Baranoa","Barranquilla","Campo de la Cruz","Candelaria","Galapa","Juan de Acosta","Luruaco","Malambo","Manatí","Palmar de Varela","Piojó","Polonuevo","Ponedera","Puerto Colombia","Repelón","Sabanagrande","Sabanalarga","Santa Lucía","Santo Tomás","Soledad","Suan","Tubará","Usiacurí"] },
  { nombre: "Bogotá D.C.", municipios: ["Bogotá"] },
  { nombre: "Bolívar", municipios: ["Achí","Altos del Rosario","Arenal","Arjona","Arroyohondo","Barranco de Loba","Calamar","Cantagallo","Cartagena de Indias","Cicuco","Clemencia","Córdoba","El Carmen de Bolívar","El Guamo","El Peñón","Hatillo de Loba","Magangué","Mahates","Margarita","María La Baja","Mompox","Montecristo","Morales","Norosí","Pinillos","Regidor","Río Viejo","San Cristóbal","San Estanislao","San Fernando","San Jacinto","San Jacinto del Cauca","San Juan Nepomuceno","San Martín de Loba","San Pablo","Santa Catalina","Santa Rosa","Santa Rosa del Sur","Simití","Soplaviento","Talaigua Nuevo","Tiquisio","Turbaco","Turbana","Villanueva","Zambrano"] },
  { nombre: "Boyacá", municipios: ["Almeida","Aquitania","Arcabuco","Belén","Berbeo","Betéitiva","Boavita","Boyacá","Briceño","Buenavista","Caldas","Campohermoso","Cerinza","Chinavita","Chiquinquirá","Chíquiza","Chiscas","Chita","Chitaraque","Chivatá","Chivor","Ciénega","Cómbita","Coper","Corrales","Covarachía","Cubará","Cucaita","Cuítiva","Duitama","El Cocuy","El Espino","Firavitoba","Floresta","Gachantivá","Gámeza","Garagoa","Guacamayas","Guateque","Guayatá","Güicán","Iza","Jenesano","Jericó","La Capilla","La Uvita","La Victoria","Labranzagrande","Macanal","Maripí","Miraflores","Mongua","Monguí","Moniquirá","Motavita","Muzo","Nobsa","Nuevo Colón","Oicatá","Otanche","Pachavita","Páez","Paipa","Pajarito","Panqueba","Pauna","Paya","Paz de Río","Pesca","Pisba","Puerto Boyacá","Quípama","Ramiriquí","Ráquira","Rondón","Saboyá","Sáchica","Samacá","San Eduardo","San José de Pare","San Luis de Gaceno","San Mateo","San Miguel de Sema","San Pablo de Borbur","Santa María","Santa Rosa de Viterbo","Santa Sofía","Santana","Sativanorte","Sativasur","Siachoque","Soatá","Socha","Socotá","Sogamoso","Somondoco","Sora","Soracá","Sotaquirá","Susacón","Sutamarchán","Sutatenza","Tasco","Tenza","Tibaná","Tibasosa","Tinjacá","Tipacoque","Toca","Togüí","Tópaga","Tota","Tunja","Tununguá","Turmequé","Tuta","Tutazá","Úmbita","Ventaquemada","Villa de Leyva","Viracachá","Zetaquirá"] },
  { nombre: "Caldas", municipios: ["Aguadas","Anserma","Aranzazu","Belalcázar","Chinchiná","Filadelfia","La Dorada","La Merced","Manizales","Manzanares","Marmato","Marquetalia","Marulanda","Neira","Norcasia","Pácora","Palestina","Pensilvania","Riosucio","Risaralda","Salamina","Samaná","San José","Supía","Victoria","Villamaría","Viterbo"] },
  { nombre: "Caquetá", municipios: ["Albania","Belén de los Andaquíes","Cartagena del Chairá","Curillo","El Doncello","El Paujil","Florencia","La Montañita","Milán","Morelia","Puerto Rico","San José del Fragua","San Vicente del Caguán","Solano","Solita","Valparaíso"] },
  { nombre: "Casanare", municipios: ["Aguazul","Chámeza","Hato Corozal","La Salina","Maní","Monterrey","Nunchía","Orocué","Paz de Ariporo","Pore","Recetor","Sabanalarga","Sácama","San Luis de Palenque","Támara","Tauramena","Trinidad","Villanueva","Yopal"] },
  { nombre: "Cauca", municipios: ["Almaguer","Argelia","Balboa","Bolívar","Buenos Aires","Cajibío","Caldono","Caloto","Corinto","El Tambo","Florencia","Guachené","Guapí","Inzá","Jambaló","La Sierra","La Vega","López de Micay","Mercaderes","Miranda","Morales","Padilla","Páez","Patía","Piamonte","Piendamó","Popayán","Puerto Tejada","Puracé","Rosas","San Sebastián","Santa Rosa","Santander de Quilichao","Silvia","Sotará","Suárez","Sucre","Timbío","Timbiquí","Toribío","Totoró","Villa Rica"] },
  { nombre: "Cesar", municipios: ["Aguachica","Agustín Codazzi","Astrea","Becerril","Bosconia","Chimichagua","Chiriguaná","Curumaní","El Copey","El Paso","Gamarra","González","La Gloria","La Jagua de Ibirico","La Paz","Manaure","Pailitas","Pelaya","Pueblo Bello","Río de Oro","San Alberto","San Diego","San Martín","Tamalameque","Valledupar"] },
  { nombre: "Chocó", municipios: ["Acandí","Alto Baudó","Atrato","Bagadó","Bahía Solano","Bajo Baudó","Bojayá","Cantón de San Pablo","Carmen del Darién","Cértegui","Condoto","El Cantón del San Pablo","El Carmen de Atrato","El Litoral del San Juan","Istmina","Juradó","Lloró","Medio Atrato","Medio Baudó","Medio San Juan","Nóvita","Nuquí","Quibdó","Río Iró","Río Quito","Riosucio","San José del Palmar","San Juan","Sipí","Tadó","Unguía","Unión Panamericana"] },
  { nombre: "Córdoba", municipios: ["Ayapel","Buenavista","Canalete","Cereté","Chimá","Chinú","Ciénaga de Oro","Cotorra","La Apartada","Lorica","Los Córdobas","Momil","Montelíbano","Montería","Moñitos","Morales","Planeta Rica","Pueblo Nuevo","Puerto Escondido","Puerto Libertador","Purísima","Sahagún","San Andrés de Sotavento","San Antero","San Bernardo del Viento","San Carlos","San José de Uré","San Pelayo","Tierralta","Tuchín","Valencia"] },
  { nombre: "Cundinamarca", municipios: ["Agua de Dios","Albán","Almeidas","Anapoima","Apulo","Arbeláez","Arbeláez","Beltrán","Bituima","Bojacá","Cabrera","Cachipay","Cajicá","Caparrapí","Cáqueza","Carmen de Carupa","Chaguaní","Chía","Chipaque","Choachí","Chocontá","Cogua","Cota","Cucunubá","El Colegio","El Peñón","El Rosal","Facatativá","Fómeque","Fosca","Funza","Fúquene","Fusagasugá","Gachancipá","Girardot","Granada","Guaduas","Guasca","Guataquí","Guatavita","Guayabal de Síquima","Gutiérrez","Jerusalén","La Calera","La Mesa","La Palma","La Peña","La Vega","Lenguazaque","Machetá","Madrid","Manta","Medina","Mosquera","Nariño","Nemocón","Nilo","Nocaíma","Paime","Pandi","Paratebueno","Pasca","Puerto Salgar","Pulí","Quetame","Quipile","San Antonio del Tequendama","San Bernardo","San Cayetano","San Francisco","San Juan de Rioseco","Sasaima","Sesquilé","Sibaté","Silvania","Simijaca","Soacha","Sopó","Subachoque","Suesca","Supatá","Susa","Sutatausa","Tabio","Tausa","Tena","Tenjo","Tibirita","Tocaima","Tocancipá","Ubaque","Ubaté","Une","Útica","Venecia","Vergara","Vianí","Villa de San Diego de Ubaté","Villapinzón","Villeta","Villeta","Yacopí","Zipacón","Zipaquirá"] },
  { nombre: "Guainía", municipios: ["Barranco Minas","Cacahual","Inírida","La Guadalupe","Morichal Nuevo","Pana Pana","Puerto Colombia","San Felipe"] },
  { nombre: "Guaviare", municipios: ["Calamar","El Retorno","Miraflores","San José del Guaviare"] },
  { nombre: "Huila", municipios: ["Acevedo","Agrado","Aipe","Algeciras","Altamira","Baraya","Campoalegre","Colombia","Elías","Garzón","Gigante","Guadalupe","Hobo","Íquira","Isnos","La Argentina","La Plata","Nátaga","Neiva","Oporapa","Paicol","Palermo","Palestina","Pital","Pitalito","Rivera","Saladoblanco","San Agustín","Santa María","Suaza","Tarqui","Tello","Teruel","Tesalia","Timaná","Villavieja","Yaguará"] },
  { nombre: "La Guajira", municipios: ["Albania","Barrancas","Dibulla","Distracción","El Molino","Fonseca","Hatonuevo","La Jagua del Pilar","Maicao","Manaure","Riohacha","San Juan del Cesar","Uribia","Urumita","Villanueva"] },
  { nombre: "Magdalena", municipios: ["Algarrobo","Aracataca","Ariguaní","Cerro de San Antonio","Chivolo","Ciénaga","Concordia","El Banco","El Piñón","El Retén","Fundación","Guamal","Nueva Granada","Pedraza","Pijiño del Carmen","Pivijay","Plato","Puebloviejo","Remolino","Sabanas de San Ángel","Salamina","San Sebastián de Buenavista","San Zenón","Santa Ana","Santa Bárbara de Pinto","Santa Marta","Sitionuevo","Tenerife","Zapayán","Zona Bananera"] },
  { nombre: "Meta", municipios: ["Acacías","Barranca de Upía","Cabuyaro","Castilla la Nueva","Cubarral","Cumaral","El Calvario","El Castillo","El Dorado","Fuente de Oro","Granada","Guamal","La Macarena","La Uribe","Lejanías","Mapiripán","Mesetas","Puerto Concordia","Puerto Gaitán","Puerto Lleras","Puerto López","Puerto Rico","Restrepo","San Carlos de Guaroa","San Juan de Arama","San Juanito","San Martín","Villavicencio","Vista Hermosa"] },
  { nombre: "Nariño", municipios: ["Albán","Aldana","Ancuya","Arboleda","Barbacoas","Belén","Buesaco","Chachagüí","Colón","Consacá","Contadero","Córdoba","Cuaspud","Cumbal","Cumbitara","El Charco","El Peñol","El Rosario","El Tablón de Gómez","El Tambo","Francisco Pizarro","Funes","Guachucal","Guaitarilla","Gualmatán","Iles","Imués","Ipiales","La Cruz","La Florida","La Llanada","La Tola","La Unión","Leiva","Linares","Los Andes","Magüí Payán","Mallama","Mosquera","Nariño","Olaya Herrera","Ospina","Pasto","Policarpa","Potosí","Providencia","Puerres","Pupiales","Ricaurte","Roberto Payán","Samaniego","San Bernardo","San Juan de Pasto","San Lorenzo","San Pablo","San Pedro de Cartago","Sandona","Santa Bárbara","Santacruz","Sapuyes","Taminango","Tangua","Tumaco","Túquerres","Yacuanquer"] },
  { nombre: "Norte de Santander", municipios: ["Ábrego","Arboledas","Bochalema","Bucarasica","Cáchira","Cácota","Chinácota","Chitagá","Convención","Cúcuta","Cucutilla","Durania","El Carmen","El Tarra","El Zulia","Gramalote","Hacarí","Herrán","La Esperanza","La Playa de Belén","Labateca","Lourdes","Mutiscua","Ocaña","Pamplona","Pamplonita","Puerto Santander","Ragonvalia","Salazar de Las Palmas","San Calixto","San Cayetano","Santiago","Sardinata","Silos","Teorama","Tibú","Toledo","Villa Caro","Villa del Rosario"] },
  { nombre: "Putumayo", municipios: ["Colón","Mocoa","Mocoa","Orito","Puerto Asís","Puerto Caicedo","Puerto Guzmán","Puerto Leguízamo","San Francisco","San Miguel","Santiago","Sibundoy","Valle del Guamuez","Villagarzón"] },
  { nombre: "Quindío", municipios: ["Armenia","Buenavista","Calarcá","Circasia","Córdoba","Filandia","Génova","La Tebaida","Montenegro","Pijao","Quimbaya","Salento"] },
  { nombre: "Risaralda", municipios: ["Apía","Balboa","Belén de Umbría","Dosquebradas","Guática","La Celia","La Virginia","Marsella","Mistrató","Pereira","Pueblo Rico","Quinchía","Santa Rosa de Cabal","Santuario"] },
  { nombre: "San Andrés y Providencia", municipios: ["Providencia y Santa Catalina Islas","San Andrés"] },
  { nombre: "Santander", municipios: ["Aguada","Albania","Aratoca","Barbosa","Barichara","Barrancabermeja","Betulia","Bolívar","Bucaramanga","Cabrera","California","Capitanejo","Carcasí","Cepitá","Cerrito","Charalá","Charta","Chima","Chipatá","Cimitarra","Concepción","Confines","Contratación","Coromoro","Curití","El Carmen de Chucurí","El Guacamayo","El Peñón","El Playón","Encino","Enciso","Florián","Floridablanca","Galán","Gámbita","Girón","Guaca","Guadalupe","Guapotá","Guavatá","Güepsa","Hato","Jesús María","Jordán","La Belleza","La Paz","Landázuri","Lebrija","Los Santos","Macaravita","Málaga","Matanza","Mogotes","Molagavita","Ocamonte","Oiba","Onzaga","Palmar","Palmas del Socorro","Páramo","Piedecuesta","Pinchote","Puente Nacional","Puerto Parra","Puerto Wilches","Rionegro","Sabana de Torres","San Andrés","San Benito","San Gil","San Joaquín","San José de Miranda","San Miguel","San Vicente de Chucurí","Santa Bárbara","Santa Helena del Opón","Simacota","Socorro","Suaita","Sucre","Suratá","Tona","Valle de San José","Vélez","Vetas","Villanueva","Zapatoca"] },
  { nombre: "Sucre", municipios: ["Buenavista","Caimito","Chalán","Colosó","Corozal","Coveñas","El Roble","Galeras","Guaranda","La Unión","Los Palmitos","Majagual","Morroa","Ovejas","Palmito","Sampués","San Benito Abad","San Juan de Betulia","San Marcos","San Onofre","San Pedro","Santiago de Tolú","Sincelejo","Sucre","Tolú Viejo"] },
  { nombre: "Tolima", municipios: ["Alpujarra","Alvarado","Ambalema","Anzoátegui","Armero","Ataco","Cajamarca","Carmen de Apicalá","Casabianca","Chaparral","Coello","Coyaima","Cunday","Dolores","El Espinal","Falan","Flandes","Fresno","Guamo","Herveo","Honda","Ibagué","Icononzo","Lérida","Líbano","Mariquita","Melgar","Murillo","Natagaima","Ortega","Palocabildo","Piedras","Planadas","Prado","Purificación","Rioblanco","Roncesvalles","Rovira","Saldaña","San Antonio","San Luis","Santa Isabel","Suárez","Valle de San Juan","Venadillo","Villahermosa","Villarrica"] },
  { nombre: "Valle del Cauca", municipios: ["Alcalá","Andalucía","Ansermanuevo","Argelia","Bolívar","Buenaventura","Buga","Bugalagrande","Caicedonia","Cali","Calima","Candelaria","Cartago","Dagua","El Águila","El Cairo","El Cerrito","El Dovio","Florida","Ginebra","Guacarí","Jamundí","La Cumbre","La Unión","La Victoria","Obando","Palmira","Pradera","Restrepo","Riofrío","Roldanillo","San Pedro","Sevilla","Toro","Trujillo","Tuluá","Ulloa","Versalles","Vijes","Yotoco","Yumbo","Zarzal"] },
  { nombre: "Vaupés", municipios: ["Carurú","Mitú","Pacoa","Papunaua","Taraira","Yavaraté"] },
  { nombre: "Vichada", municipios: ["Cumaribo","La Primavera","Puerto Carreño","Santa Rosalía"] },
];

export const DEPARTAMENTO_ABREVIATURA = {
  'Amazonas': 'AMA',
  'Antioquia': 'ANT',
  'Arauca': 'ARA',
  'Atlántico': 'ATL',
  'Bogotá D.C.': 'BOG',
  'Bolívar': 'BOL',
  'Boyacá': 'BOY',
  'Caldas': 'CAL',
  'Caquetá': 'CAQ',
  'Casanare': 'CAS',
  'Cauca': 'CAU',
  'Cesar': 'CES',
  'Chocó': 'CHO',
  'Córdoba': 'COR',
  'Cundinamarca': 'CUN',
  'Guainía': 'GUA',
  'Guaviare': 'GUV',
  'Huila': 'HUI',
  'La Guajira': 'LAG',
  'Magdalena': 'MAG',
  'Meta': 'MET',
  'Nariño': 'NAR',
  'Norte de Santander': 'NSA',
  'Putumayo': 'PUT',
  'Quindío': 'QUI',
  'Risaralda': 'RIS',
  'San Andrés y Providencia': 'SAP',
  'Santander': 'SAN',
  'Sucre': 'SUC',
  'Tolima': 'TOL',
  'Valle del Cauca': 'VAL',
  'Vaupés': 'VAU',
  'Vichada': 'VIC'
};

export const STATUS_CONFIG = {
  activo: { label: 'Activo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pausa: { label: 'En Pausa', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  inactivo: { label: 'Inactivo', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  finalizado: { label: 'Finalizado', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
};

/* ------------------------------ 3. HELPERS ---------------------------------- */
export const STATION_ROWS = 7;

export function emptyEnergiaMensual() {
  return MESES_ENERGIA.map(() => ({ inyectada: '', consumida: '', total: '' }));
}

export function emptyStations() {
  return Array.from({ length: STATION_ROWS }, () => ({ nombre: '', dias: '', peso: '' }));
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Antepone https:// si a la URL le falta el protocolo (típico cuando         */
/* alguien pega solo "drive.google.com/..." sin más).                        */
export function normalizeUrl(url) {
  const limpio = (url || '').trim();
  if (!limpio) return '';
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* Categorías del historial: coinciden con las pestañas del proyecto, para   */
/* poder separar los cambios de Civil, Notas, Control Documental, etc.       */
export const HISTORIAL_CATEGORIAS = {
  general: 'General', civil: 'Civil', mecanica: 'Mecánica', geotecnia: 'Geotecnia',
  estructural: 'Estructural', hidraulico: 'Hidráulico', electrico: 'Eléctrico',
  documentos: 'Control Documental', notas: 'Notas', archivos: 'Archivos',
  notas_tecnicas: 'Notas Técnicas',
  supervision: 'Supervisión Técnica',
  estado: 'Estado del proyecto', nombre: 'Nombre del proyecto',
};

export function categoriaLabel(cat) {
  return HISTORIAL_CATEGORIAS[cat] || 'General';
}

/* Medianoche del lunes de la semana de "fecha" (para separar "esta semana"  */
/* de cambios anteriores en el historial).                                   */
export function inicioDeSemana(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo … 6 = sábado
  const diff = dia === 0 ? 6 : dia - 1; // días desde el lunes
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

/* Compara los valores "antes" y "después" de una especialidad y devuelve una  */
/* lista de textos legibles, uno por cada campo que realmente cambió.         */
/* Cantidad de postes del cerramiento — la reutilizan varias fórmulas de la   */
/* subcategoría "Cerramiento" en Civil (pedestales, ángulos, cinta bandit…). */
export function calcCerrCantidadPostes(d) {
  const longitud = parseFloat(d?.cerr_longitud_total) || 0;
  const separacion = parseFloat(d?.cerr_separacion_postes) || 0;
  const cambios = parseFloat(d?.cerr_cambios_direccion) || 0;
  if (!separacion) return 0;
  return Math.ceil((longitud / separacion) + 2 + (cambios - 1));
}

export function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return prefix + '-' + crypto.randomUUID();
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/* ------------------- LISTAS DE CONTROL DOCUMENTAL (por inversionista) ------ */
export const DOCS_ESTANDAR = [
  { nombre: 'Layout General', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Topografia', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Vías de acceso', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Canalizaciones y redes', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cerramiento', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cortes en mesas', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Obras de drenaje (si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Análisis de inundabilidad', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de suelos', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Topografía general', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Diseño Vial', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de cerramiento', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de inversores', codigo: 'COLXXXXXXPX-CIV-INF-006', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones Camaras - CCTV', codigo: 'COLXXXXXXPX-CIV-INF-007', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones luminarias', codigo: 'COLXXXXXXPX-CIV-INF-008', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-INF-009', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'ET para estudio de suelos', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'ET para Topografía', codigo: 'COLXXXXXXPX-CIV-ESP-002', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras y cantidades civiles', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Listado' },
  { nombre: 'BOM de estructura de módulos', codigo: 'COLXXXXXXPX-MEC-LIS-001', especialidad: 'MECANICA', tipo: 'Listado' },
  { nombre: 'Estructura Inversores', codigo: 'COLXXXXXXPX-MEC-PL-001', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Estructura de módulos', codigo: 'COLXXXXXXPX-MEC-PL-002', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Ficha técnica estructura de paneles', codigo: 'COLXXXXXXPX-MEC-ESP-001', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Procedimiento de montaje', codigo: 'COLXXXXXXPX-MEC-INF-001', especialidad: 'MECANICA', tipo: 'Informe' },
  { nombre: 'Memoria de estructura de módulos y cimentación', codigo: 'COLXXXXXXPX-MEC-INF-002', especialidad: 'MECANICA', tipo: 'Informe' },
  { nombre: 'BOM de comunicaciones', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de obras de comunicación', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de cables (Tags)', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Inventario de equipos', codigo: 'COLXXXXXXPX-COM-LIS-004', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Informe de Comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Arquitectura', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Diagrama de conexiones', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Comunicacion Inversores y ruta_CCTV', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Cobertura de Camaras', codigo: 'COLXXXXXXPX-COM-PL-004', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha técnica de CCTV (Camaras, NVR)', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de estación meteorológica', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica Equipos de Comunicaciones (Smartlogger, medidor, router, switch, starlink, AccessPoint)', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'BOM eléctrico', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de obras eléctrias', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de Strings', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'SSAA y respaldo', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Cargabilidad CT´s y PT´s', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Documento OR', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Declaración RETIE Diseñador y Constructor', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Proyecto especifico', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de aislamiento', codigo: 'COLXXXXXXPX-ELE-INF-004', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-INF-005', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Riesgo Electrico', codigo: 'COLXXXXXXPX-ELE-INF-006', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Simulación PVsyst', codigo: 'COLXXXXXXPX-ELE-INF-007', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-INF-008', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Arco eléctrico', codigo: 'COLXXXXXXPX-ELE-INF-009', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Estudio de conexión simplificado', codigo: 'COLXXXXXXPX-ELE-INF-010', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de protecciones B.T.', codigo: 'COLXXXXXXPX-ELE-INF-011', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Cableado DC', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC Inversores', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas AC BT/MT', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama Unifilar', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Conexion inversores', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Distribución de equipos en SHELTER', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Tablero de frontera', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Servicios auxiliares en S/E', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Tableros de baja tensión en S/E', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica de Inversores', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Paneles', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Transformador', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica del Shelter', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Reconectador y Relé', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de TC y TP', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Cableado DC, AC de BT y MT', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
];

export const DOCS_CFM = [
  { nombre: 'Layout general del proyecto', codigo: 'COLXXXXXXPX-GEN-PL-001', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout ubicación geografica del proyecto', codigo: 'COLXXXXXXPX-GEN-PL-002', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout planta de instalaciones provisionales', codigo: 'COLXXXXXXPX-GEN-PL-003', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Layout vías de acceso y salida circuito', codigo: 'COLXXXXXXPX-GEN-PL-004', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Informe de visita - equipo de ingenieria', codigo: 'COLXXXXXXPX-GEN-INF-001', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Estudio de ajuste y coordinación de protecciones', codigo: 'COLXXXXXXPX-GEN-INF-002', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Plano de señalizaciones y sistemas contra incendios', codigo: 'COLXXXXXXPX-GEN-PL-005', especialidad: 'GENERAL', tipo: 'Plano' },
  { nombre: 'Estudio geotecnico', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de CBR - vías', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de corrosividad', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de interferencia Catódica (Si aplica)', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Protocolo Pull Out - Proveedor de Estrructura', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Informe Pull Out', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Ubicación de las Pull Out Test', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe topográfico', codigo: 'COLXXXXXXPX-CIV-INF-006', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Plano o levantamiento topografico (con ortofoto)', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Estudio de resistividad electrica', codigo: 'COLXXXXXXPX-CIV-INF-007', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de hidrologia', codigo: 'COLXXXXXXPX-CIV-INF-008', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Movimiento de Tierra (con secciones por fila de mesas)', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe Movimiento de Tierra (Cantidades de corte y relleno)', codigo: 'COLXXXXXXPX-CIV-INF-009', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Memoria Descriptiva Vías (Incluye Materiales tipo Invias)', codigo: 'COLXXXXXXPX-CIV-MEM-001', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Layout de Vías - Planta General', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano de Vías - Perfiles y secciones transversales', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cantidades de Material - Vías', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Lista de materiales' },
  { nombre: 'Informe Vía de Acceso - Adecuación de Ingreso', codigo: 'COLXXXXXXPX-CIV-INF-0010', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Layout Vía de Acceso - Adecuación de Ingreso', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria Descriptiva y Cálculo de Cerramiento', codigo: 'COLXXXXXXPX-CIV-MEM-002', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano Cerramiento Perimetral y Accesos - General y Detalles', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano Cajas con Despieces y Zanjas Eléctricas - Detalles Generales', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria de cálculo de cajas y zanjas (Si aplica, en casos de que se modifique el diseño original del OR por condiciones del terreno)', codigo: 'COLXXXXXXPX-CIV-MEM-005', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano Cimentación Equipos y Despieces (CTs)', codigo: 'COLXXXXXXPX-CIV-PL-009', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Cimentaciones (CTs)', codigo: 'COLXXXXXXPX-CIV-MEM-003', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Memoria Cálculo Drenaje Aguas Lluvias (si aplica)', codigo: 'COLXXXXXXPX-CIV-MEM-004', especialidad: 'CIVIL', tipo: 'Memoria' },
  { nombre: 'Plano de Drenaje Aguas Lluvias - General y Detalles (Si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-010', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano Superposición de Zanjas, Vías, Drenajes y Cimentaciones.', codigo: 'COLXXXXXXPX-CIV-PL-011', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Listado de obras civiles', codigo: 'COLXXXXXXPX-CIV-LIS-002', especialidad: 'CIVIL', tipo: 'Lista de materiales' },
  { nombre: 'Plano Esquemático Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-PL-001', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Estructura de Mesas - Entregados por el Proveedor', codigo: 'COLXXXXXXPX-MEC-MEM-001', especialidad: 'MECANICA', tipo: 'Memoria' },
  { nombre: 'Plano Ubicación de Hincas - Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-PL-002', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Listado de Elementos de Mesas de Paneles - Entregado por el Proveedor', codigo: 'COLXXXXXXPX-MEC-LIS-001', especialidad: 'MECANICA', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica de Estructura de Mesas de Paneles', codigo: 'COLXXXXXXPX-MEC-ESP-001', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Plano Esquemático Estructura de Inversores', codigo: 'COLXXXXXXPX-MEC-PL-003', especialidad: 'MECANICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Estructura de Inversores - Entregados por el Proveedor', codigo: 'COLXXXXXXPX-MEC-MEM-002', especialidad: 'MECANICA', tipo: 'Memoria' },
  { nombre: 'Listado de Elementos de Estructura Inversores - Entregado por el Proveedor', codigo: 'COLXXXXXXPX-MEC-LIS-002', especialidad: 'MECANICA', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica de Estructura de Inversores', codigo: 'COLXXXXXXPX-MEC-ESP-002', especialidad: 'MECANICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Memoria de Cálculo Eléctrica', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Esquema Unifilar General PSFV', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Simulación de Generación PVSyst (PDF y ZIP)', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Ficha Técnica Panel con Certificado RETIE', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Manual de Instalación del Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Certificados del Inversor', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Diagrama Constructivo del Inversor', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexionado del Inversor', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Red MT (Línea o Subterráneo)', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Plano de Planta Red MT y Cámaras de Inspección', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Detalle Conexionado del Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Manual del Centro de Transformación', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Planos Centro de Transformación - Proveedor o Fabricante', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Memoria de Cálculo Red BT DC y AC', codigo: 'COLXXXXXXPX-ELE-MEM-003', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Plano de Planta Red BT DC y AC y Cámaras de Inspección', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Estudio Sistema Puesta Tierra', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Plano Sistema Puesta Tierra', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano Apantallamiento Equipos Mayores', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Listado de Cables DC, AC BT y AC MT', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Detalle Conexión Paneles Solares y Mesas', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexión Inversores y Strings', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ubicación de Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-012', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Esquema Unifilar Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-013', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Detalle Conexionado Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-014', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano Distribución Shelter y Listado de Materiales Tableros AC y SSAA', codigo: 'COLXXXXXXPX-ELE-PL-015', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Fichas Técnicas Celdas MT - SHELTER', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras eléctricas', codigo: 'COLXXXXXXPX-ELE-LIS-007', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 1 - SOLICITUD PARA INCENTIVOS A LA INVERSIÓN EN PROYECTOS DE FNCE', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 2 - GENERALIDADES DEL PROYECTO DE FNCE', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 3 - ESPECIFICACIONES DE ELEMENTOS, EQUIPOS Y/O MAQUINARIA', codigo: 'COLXXXXXXPX-ELE-LIS-004', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'FORMATO 4 - ESPECIFICACIONES DE SERVICIOS', codigo: 'COLXXXXXXPX-ELE-LIS-005', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Certificados de Conformidad Equipos UPME', codigo: 'COLXXXXXXPX-ELE-LIS-006', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Arquitectura de Comunicaciones', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Especificaciones Técnicas Equipos comunicación', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de Elementos comunicación', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Listado de señales', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Memoria Descriptiva comunicaciones', codigo: 'COLXXXXXXPX-COM-MEM-001', especialidad: 'COMUNICACIONES', tipo: 'Memoria' },
  { nombre: 'Plano Constructivo y Conexionado Rack comunicacione', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Protocolo SAT comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Plano de Ruta Cableado Comunicaciones', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha Técnica Fibra Óptica o UTP', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica Smart Logger', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Manual Smart Logger', codigo: 'COLXXXXXXPX-COM-ESP-004', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Especificaciones Técnicas equipos EEMM (Equipos Electrico de Maniobra y Medida)', codigo: 'COLXXXXXXPX-ELE-ESP-008', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de Equipos y accesorios de montaje', codigo: 'COLXXXXXXPX-ELE-LIS-008', especialidad: 'ELECTRICA', tipo: 'Lista de materiales' },
  { nombre: 'Protocolo SAT Equipos EM', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Montaje Equipos Meteorologicos', codigo: 'COLXXXXXXPX-ELE-PL-016', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Especificación Técnica Sistema de seguridad', codigo: 'COLXXXXXXPX-COM-ESP-005', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Planta General y Detalles Equipos de Seguridad', codigo: 'COLXXXXXXPX-COM-PL-004', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Listado de Señales Equipos de Seguridad', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Lista de materiales' },
  { nombre: 'Ficha Técnica equipos sistema de seguridad', codigo: 'COLXXXXXXPX-COM-ESP-006', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
];

export const DOCS_FENOGE = [
  { nombre: 'Listado de cables AC y DC (con tags)', codigo: 'COLXXXXXXPX-ELE-LIS-001', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'BOM eléctrico', codigo: 'COLXXXXXXPX-ELE-LIS-002', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'Listado de obras eléctrias', codigo: 'COLXXXXXXPX-ELE-LIS-003', especialidad: 'ELECTRICA', tipo: 'Listado' },
  { nombre: 'SSAA y respaldo', codigo: 'COLXXXXXXPX-ELE-MEM-001', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-MEM-002', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Distancias mínimas y de seguridad', codigo: 'COLXXXXXXPX-ELE-MEM-003', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Cargabilidad CT´s y PT´s', codigo: 'COLXXXXXXPX-ELE-MEM-004', especialidad: 'ELECTRICA', tipo: 'Memoria' },
  { nombre: 'Documento OR', codigo: 'COLXXXXXXPX-ELE-INF-001', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'RETIE', codigo: 'COLXXXXXXPX-ELE-INF-002', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Proyecto especifico', codigo: 'COLXXXXXXPX-ELE-INF-003', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Etiqueta de cables', codigo: 'COLXXXXXXPX-ELE-INF-004', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Criterios de seleccion de MPPT', codigo: 'COLXXXXXXPX-ELE-INF-005', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Coordinación de aislamiento', codigo: 'COLXXXXXXPX-ELE-INF-006', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-INF-007', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Riesgo Electrico', codigo: 'COLXXXXXXPX-ELE-INF-008', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Simulación PVsyst', codigo: 'COLXXXXXXPX-ELE-INF-009', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-INF-010', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Arco eléctrico', codigo: 'COLXXXXXXPX-ELE-INF-011', especialidad: 'ELECTRICA', tipo: 'Informe' },
  { nombre: 'Disposición física', codigo: 'COLXXXXXXPX-ELE-PL-001', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Cableado DC', codigo: 'COLXXXXXXPX-ELE-PL-002', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC-AC-MT', codigo: 'COLXXXXXXPX-ELE-PL-003', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas DC Inversores', codigo: 'COLXXXXXXPX-ELE-PL-004', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Rutas ACBT-MT y AÉREA', codigo: 'COLXXXXXXPX-ELE-PL-005', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama Unifilar', codigo: 'COLXXXXXXPX-ELE-PL-006', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Diagrama unifilar SSAA', codigo: 'COLXXXXXXPX-ELE-PL-007', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Sistema de puesta a tierra', codigo: 'COLXXXXXXPX-ELE-PL-008', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ruta de Evacuación', codigo: 'COLXXXXXXPX-ELE-PL-009', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Estructura Inversores', codigo: 'COLXXXXXXPX-CIV-PL-001', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Conexion inversores', codigo: 'COLXXXXXXPX-ELE-PL-010', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Apantallamiento', codigo: 'COLXXXXXXPX-ELE-PL-011', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Distribución de equipos en SHELTER', codigo: 'COLXXXXXXPX-ELE-PL-012', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Celda Frontera o medidor', codigo: 'COLXXXXXXPX-ELE-PL-013', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Soporte de bandeja en Inversores', codigo: 'COLXXXXXXPX-ELE-PL-014', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Plano de diseño de la red MT', codigo: 'COLXXXXXXPX-ELE-PL-015', especialidad: 'ELECTRICA', tipo: 'Plano' },
  { nombre: 'Ficha Técnica de Inversores', codigo: 'COLXXXXXXPX-ELE-ESP-001', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Medidor', codigo: 'COLXXXXXXPX-ELE-ESP-002', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Paneles', codigo: 'COLXXXXXXPX-ELE-ESP-003', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Transformador', codigo: 'COLXXXXXXPX-ELE-ESP-004', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Tableros', codigo: 'COLXXXXXXPX-ELE-ESP-005', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Reconectador', codigo: 'COLXXXXXXPX-ELE-ESP-006', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de TC y TP', codigo: 'COLXXXXXXPX-ELE-ESP-007', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha Técnica de Tracker', codigo: 'COLXXXXXXPX-ELE-ESP-008', especialidad: 'ELECTRICA', tipo: 'Especificaciones tecnicas' },
  { nombre: 'BOM de comunicaciones', codigo: 'COLXXXXXXPX-COM-LIS-001', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de obras de comunicación', codigo: 'COLXXXXXXPX-COM-LIS-002', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de cables (Tags)', codigo: 'COLXXXXXXPX-COM-LIS-003', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Inventario de equipos', codigo: 'COLXXXXXXPX-COM-LIS-004', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Listado de señales', codigo: 'COLXXXXXXPX-COM-LIS-005', especialidad: 'COMUNICACIONES', tipo: 'Listado' },
  { nombre: 'Comunicaciones', codigo: 'COLXXXXXXPX-COM-INF-001', especialidad: 'COMUNICACIONES', tipo: 'Informe' },
  { nombre: 'Arquitectura', codigo: 'COLXXXXXXPX-COM-PL-001', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Diagrama de conexiones', codigo: 'COLXXXXXXPX-COM-PL-002', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Comunicacion Inversores y ruta_CCTV', codigo: 'COLXXXXXXPX-COM-PL-003', especialidad: 'COMUNICACIONES', tipo: 'Plano' },
  { nombre: 'Ficha técnica de camaras', codigo: 'COLXXXXXXPX-COM-ESP-001', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de camaras en S/E', codigo: 'COLXXXXXXPX-COM-ESP-002', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de smartlogger', codigo: 'COLXXXXXXPX-COM-ESP-003', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de estación meteorológica', codigo: 'COLXXXXXXPX-COM-ESP-004', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de medidor', codigo: 'COLXXXXXXPX-COM-ESP-005', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de router', codigo: 'COLXXXXXXPX-COM-ESP-006', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de switch', codigo: 'COLXXXXXXPX-COM-ESP-007', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de camaras', codigo: 'COLXXXXXXPX-COM-ESP-008', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de NVR', codigo: 'COLXXXXXXPX-COM-ESP-009', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de starlink', codigo: 'COLXXXXXXPX-COM-ESP-010', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Ficha técnica de AccessPoint', codigo: 'COLXXXXXXPX-COM-ESP-011', especialidad: 'COMUNICACIONES', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Localizaciones y accesos', codigo: 'COLXXXXXXPX-CIV-PL-002', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Topografia del terreno', codigo: 'COLXXXXXXPX-CIV-PL-003', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Fijaciones mecánicas', codigo: 'COLXXXXXXPX-CIV-PL-004', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Caminos internos y vías perimetrales', codigo: 'COLXXXXXXPX-CIV-PL-005', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Áreas de circulación en el proyecto', codigo: 'COLXXXXXXPX-CIV-PL-006', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Canalizaciones de Baja y Media tensión; Redes', codigo: 'COLXXXXXXPX-CIV-PL-007', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cerramiento y Especificaciones generales', codigo: 'COLXXXXXXPX-CIV-PL-008', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cortes en mesas', codigo: 'COLXXXXXXPX-CIV-PL-009', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Cimentaciones de Shelter', codigo: 'COLXXXXXXPX-CIV-PL-010', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Arquitectonico Shelter', codigo: 'COLXXXXXXPX-CIV-PL-011', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Plano de obras hidráulicas (Si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-012', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Movimientos de tierras (si aplica)', codigo: 'COLXXXXXXPX-CIV-PL-013', especialidad: 'CIVIL', tipo: 'Plano' },
  { nombre: 'Informe hidrológico', codigo: 'COLXXXXXXPX-CIV-INF-001', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Informe hidráulico (Si aplica)', codigo: 'COLXXXXXXPX-CIV-INF-002', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Estudio de suelos', codigo: 'COLXXXXXXPX-CIV-INF-003', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Topografía general', codigo: 'COLXXXXXXPX-CIV-INF-004', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'Manual de instalación del tracker', codigo: 'COLXXXXXXPX-CIV-INF-005', especialidad: 'CIVIL', tipo: 'Informe' },
  { nombre: 'ET para estudio de suelos', codigo: 'COLXXXXXXPX-CIV-ESP-001', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'ET para Topografía', codigo: 'COLXXXXXXPX-CIV-ESP-002', especialidad: 'CIVIL', tipo: 'Especificaciones tecnicas' },
  { nombre: 'Listado de obras y cantidades civiles', codigo: 'COLXXXXXXPX-CIV-LIS-001', especialidad: 'CIVIL', tipo: 'Listado' },
  { nombre: 'Analisis de riesgo contra incendios (Si aplica)', codigo: 'COLXXXXXXPX-GEN-INF-001', especialidad: 'GENERAL', tipo: 'Informe' },
  { nombre: 'Sistema de detección de incendios (Si aplica)', codigo: 'COLXXXXXXPX-GEN-PL-001', especialidad: 'GENERAL', tipo: 'Plano' },
];

/* Estados posibles de un documento en Control Documental. */
export const DOC_ESTADOS = [
  'No aplica',
  'Pendiente',
  'En proceso',
  'Revisión interna',
  /* Ya pasó revisión interna y está listo para salir, pero todavía no se ha
     entregado — el paso que faltaba entre "Revisión interna" y "Entregado". */
  'Listo para entrega',
  'Entregado',
  'Aprobado para construcción con comentarios (APCC)',
  'Aprobado para construcción (APC)',
];

export const DOC_ESTADO_CONFIG = {
  'No aplica': { bg: 'bg-navy-50', text: 'text-navy-400', dot: 'bg-navy-300', border: 'border-navy-300', ring: 'ring-navy-300' },
  'Pendiente': { bg: 'bg-navy-100', text: 'text-navy-500', dot: 'bg-navy-400', border: 'border-navy-400', ring: 'ring-navy-400' },
  'En proceso': { bg: 'bg-lime-100', text: 'text-lime-700', dot: 'bg-lime-500', border: 'border-lime-500', ring: 'ring-lime-500' },
  'Revisión interna': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-500', ring: 'ring-orange-500' },
  'Listo para entrega': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400', border: 'border-amber-400', ring: 'ring-amber-400' },
  'Entregado': { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-500', ring: 'ring-violet-500' },
  'Aprobado para construcción con comentarios (APCC)': { bg: 'bg-nashville-100', text: 'text-nashville-700', dot: 'bg-nashville-500', border: 'border-nashville-500', ring: 'ring-nashville-500' },
  'Aprobado para construcción (APC)': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500' },
};

/* Mismos colores que arriba, en hexadecimal, para el diagrama de torta (SVG). */
export const DOC_ESTADO_HEX = {
  'No aplica': '#9BB0D4',
  'Pendiente': '#6487C4',
  'En proceso': '#C2E723',
  'Revisión interna': '#F97316',
  'Listo para entrega': '#FBBF24',
  'Entregado': '#8B5CF6',
  'Aprobado para construcción con comentarios (APCC)': '#61A9D1',
  'Aprobado para construcción (APC)': '#10B981',
};

/* Nombre corto para las píldoras de filtro/resumen, sin el paréntesis largo. */
export const DOC_ESTADO_CORTO = {
  'No aplica': 'No aplica',
  'Pendiente': 'Pendiente',
  'En proceso': 'En proceso',
  'Revisión interna': 'Rev. interna',
  'Listo para entrega': 'Listo p/ entrega',
  'Entregado': 'Entregado',
  'Aprobado para construcción con comentarios (APCC)': 'APCC',
  'Aprobado para construcción (APC)': 'APC',
};

/* Según el inversionista del proyecto, se usa una lista de documentos u otra. */
export function pickDocumentList(inversionista) {
  const v = (inversionista || '').trim().toUpperCase();
  if (v === 'CFM') return DOCS_CFM;
  if (v === 'FENOGE') return DOCS_FENOGE;
  return DOCS_ESTANDAR;
}

/* ¿Este proyecto lleva Supervisión técnica? Lo decide el inversionista, no el
   proyecto: en la lista de inversionistas cada uno tiene una casilla que dice
   si sus entregas pasan por Supervisión. Así, sumar un inversionista nuevo a
   ese flujo es marcar una casilla, no cambiar el código. */
export function requiereSupervisionTecnica(inversionista, inversionistasDetalle) {
  const fila = (inversionistasDetalle || []).find((r) => r.nombre === inversionista);
  return !!(fila && fila.supervision_tecnica);
}

/* El dossier del proyecto agrupado por especialidad, con el código real ya
   armado (el de la plantilla trae el placeholder COLXXXXXXPX). Lo usan tanto
   Control Documental como Supervisión técnica. */
export function dossierPorEspecialidad(general) {
  const datos = general || {};
  const prefijo = buildProjectCode(datos);
  const grupos = [];
  const porEspecialidad = new Map();
  pickDocumentList(datos.inversionista).forEach((doc) => {
    if (!porEspecialidad.has(doc.especialidad)) {
      porEspecialidad.set(doc.especialidad, grupos.length);
      grupos.push({ especialidad: doc.especialidad, docs: [] });
    }
    grupos[porEspecialidad.get(doc.especialidad)].docs.push({
      ...doc,
      codigoFinal: prefijo ? doc.codigo.replace('COLXXXXXXPX', prefijo) : doc.codigo,
    });
  });
  return grupos;
}

/* Arma el prefijo de código del proyecto (ej. COLBOYT147P1) a partir de los  */
/* campos de General. El departamento ya no se escribe a mano: se busca su   */
/* abreviatura oficial de 3 letras en DEPARTAMENTO_ABREVIATURA según el      */
/* nombre elegido en el selector de Departamento, y siempre se le agrega una */
/* "T" (terreno) después. Si falta algún dato, devuelve '' y el código de     */
/* cada documento se muestra con el placeholder original (COLXXXXXXPX).      */
export function buildProjectCode(general) {
  /* Un proyecto sin la sección "general" (fila creada por fuera de la app, o
     de una versión anterior) no puede tumbar la pantalla: sin datos, no hay
     código, y se sigue mostrando el placeholder. */
  const datos = general || {};
  const abrev = DEPARTAMENTO_ABREVIATURA[datos.departamento || ''];
  const num = (datos.numero_minigranja || '').trim();
  const predio = (datos.numero_predio || '').trim();
  if (!abrev || !num || !predio) return '';
  return `COL${abrev}T${num}P${predio}`;
}

/* Nombre del proyecto con el código documental al frente, ej.             */
/* "Confines Occidente - COLSANT215P1". Si el código aún no está completo  */
/* (faltan datos en General), se muestra solo el nombre.                   */
export function projectDisplayName(project) {
  const codigo = buildProjectCode(project.data?.general);
  return codigo ? `${project.nombre} - ${codigo}` : project.nombre;
}

/* ============================================================================
   5. COMPONENTES DE PRESENTACIÓN
   ============================================================================ */
export function StatusBadge({ estado, size = 'md' }) {
  const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.inactivo;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

export function InversionistaPicker({ value, inversionistas, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={inversionistas}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo inversionista"
      etiquetaAgregar="+ Agregar nuevo inversionista…"
    />
  );
}

export function PaisPicker({ value, paises, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={paises}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo país"
      etiquetaAgregar="+ Agregar nuevo país…"
    />
  );
}

export function ProveedorPicker({ value, proveedores, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={proveedores}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo proveedor"
      etiquetaAgregar="+ Agregar nuevo proveedor…"
    />
  );
}

export function OperadorRedPicker({ value, operadoresRed, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={(operadoresRed || []).map((o) => o.nombre)}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo operador de red"
      etiquetaAgregar="+ Agregar nuevo operador de red…"
    />
  );
}

export function InstaladorPicker({ value, instaladores, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={(instaladores || []).map((i) => i.nombre)}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo instalador"
      etiquetaAgregar="+ Agregar nuevo instalador…"
    />
  );
}

/* Diagrama de torta (donut) del progreso de Control Documental. Es puramente */
/* visual — a propósito no aparece en la hoja de vida imprimible.            */
export function ProgresoDonut({ conteoPorEstado, total, compact = false }) {
  const size = compact ? 52 : 116;
  const radius = size / 2;
  const innerRadius = radius * 0.58;
  const cx = radius;
  const cy = radius;

  // "No aplica" no se cuenta en el seguimiento: no entra al dibujo de la
  // torta (para que las demás porciones sí completen el círculo), pero
  // sigue apareciendo en la lista de al lado con su cantidad.
  const totalSeguido = total - (conteoPorEstado['No aplica'] || 0);

  if (total === 0) {
    return compact ? (
      <div className="shrink-0 flex items-center justify-center rounded-full bg-navy-100" style={{ width: size, height: size }}>
        <span className="text-[9px] text-navy-400">N/A</span>
      </div>
    ) : (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-xs text-navy-400 italic text-center px-2">Sin documentos<br />en esta vista</p>
      </div>
    );
  }

  let angleStart = -Math.PI / 2;
  const slices = totalSeguido === 0 ? [] : DOC_ESTADOS.filter((estado) => estado !== 'No aplica' && conteoPorEstado[estado] > 0).map((estado) => {
    const valor = conteoPorEstado[estado];
    const angle = (valor / totalSeguido) * Math.PI * 2;
    const angleEnd = angleStart + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(angleStart), y1 = cy + radius * Math.sin(angleStart);
    const x2 = cx + radius * Math.cos(angleEnd), y2 = cy + radius * Math.sin(angleEnd);
    const ix1 = cx + innerRadius * Math.cos(angleStart), iy1 = cy + innerRadius * Math.sin(angleStart);
    const ix2 = cx + innerRadius * Math.cos(angleEnd), iy2 = cy + innerRadius * Math.sin(angleEnd);
    const d = valor === totalSeguido
      ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} L ${cx - 0.01} ${cy - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius} Z`
      : `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    angleStart = angleEnd;
    return { d, estado, valor, color: DOC_ESTADO_HEX[estado] };
  });

  const aprobados = conteoPorEstado['Aprobado para construcción (APC)'] || 0;
  const pct = totalSeguido === 0 ? 0 : Math.round((aprobados / totalSeguido) * 100);
  const entregados = conteoPorEstado['Entregado'] || 0;
  const pctEntregado = totalSeguido === 0 ? 0 : Math.round((entregados / totalSeguido) * 100);

  if (compact) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.length === 0 ? (
          <circle cx={cx} cy={cy} r={(radius + innerRadius) / 2} fill="none" stroke="#CBD5E6" strokeWidth={radius - innerRadius} />
        ) : (
          slices.map((s) => <path key={s.estado} d={s.d} fill={s.color} stroke="white" strokeWidth="1" />)
        )}
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="12" fontWeight="700" fill="#152644">{pct}%</text>
      </svg>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {slices.length === 0 ? (
            <circle cx={cx} cy={cy} r={(radius + innerRadius) / 2} fill="none" stroke="#CBD5E6" strokeWidth={radius - innerRadius} />
          ) : (
            slices.map((s) => (
              <path key={s.estado} d={s.d} fill={s.color} stroke="white" strokeWidth="1.5" />
            ))
          )}
        </svg>
        <div className="space-y-1">
          {DOC_ESTADOS.filter((estado) => conteoPorEstado[estado] > 0).map((estado) => (
            <div key={estado} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DOC_ESTADO_HEX[estado] }} />
              <span className="text-navy-600">{DOC_ESTADO_CORTO[estado]}: <span className="font-semibold">{conteoPorEstado[estado]}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-8 mt-3 pt-3 border-t border-navy-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-navy-800">{pct}%</p>
          <p className="text-xs font-semibold text-navy-400 tracking-wide">APC</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-violet-600">{pctEntregado}%</p>
          <p className="text-xs font-semibold text-violet-400 tracking-wide">ENTREGADO</p>
        </div>
      </div>
    </div>
  );
}

/* Barra de progreso por especialidad, "pintada" por segmentos según el     */
/* estado de cada documento (no solo APC). Al pasar el cursor sobre un      */
/* segmento se ve el % y la cantidad de documentos en ese estado.          */
export function EspecialidadBarra({ especialidad, docs, conteo }) {
  const total = docs.length;
  const segmentos = DOC_ESTADOS.filter((estado) => conteo[estado] > 0);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-navy-600">{especialidad}</span>
        <span className="text-navy-400">{total} docs</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-navy-300 italic">Todos los documentos de esta especialidad son "No aplica".</p>
      ) : (
        <div className="relative">
          {/* Barra visual (con esquinas redondeadas, por eso overflow-hidden) */}
          <div className="w-full h-2.5 bg-navy-200 rounded-full overflow-hidden flex">
            {segmentos.map((estado) => (
              <div key={estado} className="h-full" style={{ width: `${(conteo[estado] / total) * 100}%`, backgroundColor: DOC_ESTADO_HEX[estado] }} />
            ))}
          </div>
          {/* Capa invisible encima, solo para el hover — sin overflow-hidden, así el tooltip no se recorta */}
          <div className="absolute inset-0 flex">
            {segmentos.map((estado) => {
              const pct = (conteo[estado] / total) * 100;
              return (
                <div key={estado} className="relative group h-full" style={{ width: `${pct}%` }}>
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-navy-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {DOC_ESTADO_CORTO[estado]}: {Math.round(pct)}% ({conteo[estado]})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function EquipoSelect({ role, valorActual, directorio, onChange, readOnly }) {
  const rolParaFiltrar = role.filterRoleKey || role.key;
  const candidatos = directorio.filter((u) => u.roles && u.roles.includes(rolParaFiltrar));
  const actualRegistrado = valorActual && candidatos.some((u) => u.nombre === valorActual);

  if (readOnly) {
    return (
      <p className={`text-sm font-medium py-1.5 ${valorActual ? 'text-navy-700' : 'text-navy-300 italic'}`}>
        {valorActual || 'Sin asignar'}
      </p>
    );
  }

  return (
    <select value={valorActual || ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm">
      <option value="">Sin asignar</option>
      {candidatos.map((u) => (
        <option key={u.id} value={u.nombre}>{u.nombre}</option>
      ))}
      {valorActual && !actualRegistrado && <option value={valorActual}>{valorActual} (no registrado)</option>}
    </select>
  );
}

/* Para especialidades que admiten varias personas (civil, eléctrico,       */
/* delineante): cada asignado se muestra como una "chip" con su X para      */
/* quitarlo, y un botón "+ Agregar" abre un select con los candidatos que   */
/* faltan por agregar.                                                      */
export function EquipoMultiSelect({ role, valores, directorio, onChange, readOnly }) {
  const [showAdd, setShowAdd] = useState(false);
  const asignados = equipoComoArray(valores);
  const candidatos = directorio.filter((u) => u.roles && u.roles.includes(role.key) && !asignados.includes(u.nombre));

  if (readOnly) {
    return (
      <p className={`text-sm font-medium py-1.5 ${asignados.length ? 'text-navy-700' : 'text-navy-300 italic'}`}>
        {asignados.length ? asignados.join(', ') : 'Sin asignar'}
      </p>
    );
  }

  function agregar(nombre) {
    setShowAdd(false);
    if (!nombre || asignados.includes(nombre)) return;
    onChange([...asignados, nombre]);
  }
  function quitar(nombre) {
    onChange(asignados.filter((n) => n !== nombre));
  }

  if (showAdd) {
    return (
      <select
        autoFocus
        value=""
        onChange={(e) => agregar(e.target.value)}
        onBlur={() => setShowAdd(false)}
        className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Seleccionar persona…</option>
        {candidatos.map((u) => (
          <option key={u.id} value={u.nombre}>{u.nombre}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm flex flex-wrap items-center gap-1.5">
      {asignados.map((nombre) => (
        <span key={nombre} className="inline-flex items-center gap-1 bg-navy-100 text-navy-700 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full">
          {nombre}
          <button onClick={() => quitar(nombre)} title={`Quitar a ${nombre}`} className="text-navy-400 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button onClick={() => setShowAdd(true)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
        <Plus className="w-3 h-3" /> Agregar
      </button>
    </div>
  );
}

/* Decide si usar el selector de una sola persona o el de varias, según el   */
/* rol. Se usa en todos los lugares donde se asigna equipo a un proyecto.   */
/* El "Ingeniero de proyectos" no tiene cuenta (no inicia sesión), así que no */
/* sale de "directorio" como los demás roles: sale de un catálogo compartido */
/* (nombre + matrícula) — se elige/agrega por nombre igual que un Instalador,*/
/* y la matrícula se ve/edita debajo, ligada a esa persona del catálogo.    */
export function IngenieroProyectosField({ valor, ingenierosProyectos, onChange, onAddNew, onUpdateMatricula, readOnly }) {
  const fila = (ingenierosProyectos || []).find((i) => i.nombre === valor);
  const matricula = fila?.matricula || '';

  if (readOnly) {
    return (
      <p className={`text-sm font-medium py-1.5 ${valor ? 'text-navy-700' : 'text-navy-300 italic'}`}>
        {valor ? `${valor}${matricula ? ` (${matricula})` : ''}` : 'Sin asignar'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <AddableSelect
        value={valor}
        opciones={(ingenierosProyectos || []).map((i) => i.nombre)}
        onChange={onChange}
        onAddNew={onAddNew}
        placeholderNuevo="Nombre del nuevo ingeniero de proyectos"
        etiquetaAgregar="+ Agregar nuevo ingeniero de proyectos…"
      />
      {valor && (
        <input
          value={matricula}
          onChange={(e) => onUpdateMatricula(valor, e.target.value)}
          placeholder="Matrícula profesional"
          className="w-full rounded-lg border border-navy-300 px-2.5 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

export function EquipoField({ role, valor, directorio, onChange, readOnly }) {
  if (esRolMultiple(role.key)) {
    return <EquipoMultiSelect role={role} valores={valor} directorio={directorio} onChange={onChange} readOnly={readOnly} />;
  }
  return <EquipoSelect role={role} valorActual={valor} directorio={directorio} onChange={onChange} readOnly={readOnly} />;
}
