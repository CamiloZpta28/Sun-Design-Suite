/* ============================================================================
   QUIÉN RESPONDE POR CADA DOCUMENTO
   ----------------------------------------------------------------------------
   El dossier dice qué ROLES responden por cada documento y con qué papel (E si
   lo elabora o lo dibuja, R si lo revisa). El equipo del proyecto dice qué
   PERSONA ocupa cada rol. Cruzar las dos cosas es lo que convierte
   "Ing. Estructural: E" en "Camilo lo elabora", y es lo que necesitan tanto
   Control Documental como los resúmenes semanales.

   Vive aparte de resumenes.js porque ya no es solo cosa de los resúmenes, y
   porque Control Documental no tiene por qué arrastrar el cálculo de semanas y
   de fotos para pintar un par de chips.

   El caso que más vale la pena mirar es el del rol SIN NADIE: un documento que
   según el dossier responde el estructural, en un proyecto donde no hay
   estructural asignado. No se calla — se muestra como "sin asignar", porque es
   justo el hueco que a nadie le conviene descubrir tarde.
   ============================================================================ */

import { ROLES, equipoComoArray } from './permisos.js';

/* Valor con el que se filtra por "documentos que no tiene nadie". No es el
   nombre de una persona, así que no puede chocar con uno. */
export const SIN_ASIGNAR = 'Sin asignar';

/* Los roles que una persona ocupa EN ESTE proyecto, no los que tiene en su
   perfil. Alguien puede ser Ing. Civil y Delineante a la vez y estar puesto
   en un proyecto solo como civil: ahí los planos no son suyos. */
export function rolesEnProyecto(nombre, equipo) {
  return Object.entries(equipo || {})
    .filter(([, valor]) => equipoComoArray(valor).includes(nombre))
    .map(([rol]) => rol);
}

/* Quién responde por un documento en un proyecto concreto:
   [{ rol, papel, nombre }], con `nombre` en null cuando ese rol no lo ocupa
   nadie. Un rol con dos personas (dos civiles, dos delineantes) produce una
   entrada por cada una: el documento le sale a las dos.

   El orden es el de ROLES y no el del jsonb del dossier, que no garantiza
   ninguno — así los chips no se reordenan solos entre un documento y otro. */
export function responsablesDeDocumento(doc, equipo) {
  const asignados = doc?.responsables || {};
  return ROLES
    .filter((rol) => asignados[rol.key])
    .flatMap((rol) => {
      const papel = asignados[rol.key];
      const personas = equipoComoArray((equipo || {})[rol.key]);
      if (personas.length === 0) return [{ rol: rol.key, papel, nombre: null }];
      return personas.map((nombre) => ({ rol: rol.key, papel, nombre }));
    });
}

/* Con qué valor entra este documento al filtro de responsable: los nombres de
   quienes responden por él, o SIN_ASIGNAR si su rol está vacante. Un documento
   que el dossier no le asigna a nadie no entra con ningún valor — no está sin
   asignar, es que no aplica. */
export function valoresDeResponsable(doc, equipo) {
  const entradas = responsablesDeDocumento(doc, equipo);
  return [...new Set(entradas.map((e) => e.nombre || SIN_ASIGNAR))];
}
