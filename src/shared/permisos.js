/* ============================================================================
   ROLES, EQUIPO Y PERMISOS
   ----------------------------------------------------------------------------
   Quién es cada persona dentro del equipo y qué puede hacer. Vive fuera de
   App.jsx porque lo necesitan también las secciones que se cargan aparte
   (Actualizaciones, Cimentaciones, Canalizaciones…): si estas funciones
   siguieran dentro de App.jsx, importarlas obligaría a descargar la
   aplicación entera antes de poder pintar cualquier sección.

   Es un movimiento literal desde App.jsx: mismas reglas, mismos nombres.
   ============================================================================ */

import {
  HardHat, Droplets, Building2, Zap, Mountain, PenTool, FileText,
  ShieldCheck, ClipboardCheck, Code2,
} from 'lucide-react';

/* --------------------------- 1. ROLES / ESPECIALIDADES --------------------- */
/* Cada persona puede tener VARIOS roles a la vez (ej. Líder Civil + Ing.     */
/* Civil). Los roles ya no se auto-asignan al crear la cuenta: solo un       */
/* líder puede otorgarlos (ver TeamRolesView), para que nadie pueda          */
/* entrar a proyectos que no le corresponden con solo elegir un rol.         */
export const ROLES = [
  { key: 'civil', label: 'Ing. Civil', icon: HardHat },
  { key: 'hidraulico', label: 'Ing. Hidráulico', icon: Droplets },
  { key: 'estructural', label: 'Ing. Estructural', icon: Building2 },
  { key: 'electrico', label: 'Ing. Eléctrico', icon: Zap },
  { key: 'geotecnico', label: 'Ing. Geotécnico', icon: Mountain },
  { key: 'delineante', label: 'Delineante', icon: PenTool },
  { key: 'tramites_bt', label: 'Trámites y BT', icon: FileText },
];
/* Roles "de disciplina técnica" — para estos, el Dashboard muestra el       */
/* resumen PERSONAL (solo los proyectos donde están asignados) en vez del   */
/* total de todos los proyectos. Si alguien tiene ADEMÁS un rol que no está  */
/* en esta lista (líder, QA, desarrollador, Trámites y BT…), ese "otro tipo" */
/* gana y ve el resumen total — ver usaResumenPersonal().                   */
export const ROLES_DASHBOARD_PERSONAL = ['civil', 'geotecnico', 'estructural', 'hidraulico', 'electrico', 'delineante'];
export function usaResumenPersonal(perfil) {
  const roles = perfil?.roles || [];
  return roles.length > 0 && roles.every((r) => ROLES_DASHBOARD_PERSONAL.includes(r));
}

/* Estas especialidades admiten varias personas a la vez en el mismo        */
/* proyecto (ej. dos ingenieros civiles). Las demás siguen siendo de una    */
/* sola persona. En equipo, estos roles guardan un arreglo de nombres en    */
/* vez de un solo nombre.                                                   */
export const MULTI_ROLE_KEYS = ['civil', 'electrico', 'delineante'];
export function esRolMultiple(roleKey) {
  return MULTI_ROLE_KEYS.includes(roleKey);
}
/* Normaliza cualquier valor de equipo[role] (string viejo, array, vacío)   */
/* a un arreglo de nombres.                                                  */
export function equipoComoArray(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  return valor ? [valor] : [];
}
/* Claves de "equipo" que NO cuentan como asignación real de trabajo: quien  */
/* aprueba un proyecto no lo desarrolla (no debería tener permiso de        */
/* edición ni aparecer en sus "Mis proyectos" — ver "Revisión de proyectos" */
/* aparte), y el ingeniero de proyectos no tiene cuenta con la que iniciar  */
/* sesión, así que tampoco aplica.                                          */
export const EQUIPO_CLAVES_SIN_ASIGNACION = ['aprobador_electrico', 'ingeniero_proyectos'];
/* Todos los nombres asignados a un proyecto, sin importar el rol.         */
export function equipoNombres(equipo) {
  return Object.entries(equipo || {})
    .filter(([k]) => !EQUIPO_CLAVES_SIN_ASIGNACION.includes(k))
    .flatMap(([, v]) => equipoComoArray(v));
}
/* Texto legible para un valor de equipo[role] (nombre único, varios       */
/* nombres separados por coma, o vacío).                                    */
export function equipoTexto(valor) {
  return equipoComoArray(valor).join(', ');
}

/* Roles de liderazgo: los únicos que pueden asignar el equipo de un         */
/* proyecto, cambiar su estado, y otorgar roles a los demás. Un líder puede  */
/* tener también un rol técnico en paralelo (ej. Líder Civil + Ing. Civil).  */
export const LEADER_ROLES = [
  { key: 'lider_civil', label: 'Líder Civil', icon: HardHat },
  { key: 'lider_electrico', label: 'Líder Eléctrico', icon: Zap },
  { key: 'lider_delineantes', label: 'Líder Delineantes', icon: PenTool },
  { key: 'lider_diseno', label: 'Líder de Diseño', icon: ShieldCheck },
];
export const LEADER_ROLE_KEYS = LEADER_ROLES.map((r) => r.key);

/* Rol de Control de Calidad Interno: puede ser paralelo a cualquier otro    */
/* rol. Es el único que puede escribir comentarios en Control Documental.    */
export const QA_ROLE = { key: 'control_calidad', label: 'Control de Calidad Interno', icon: ClipboardCheck };

/* Rol de Desarrollador: tiene TODOS los permisos habilitados (equivale a    */
/* Líder de Diseño + Control de Calidad + poder gestionar cualquier rol).   */
/* Pensado para quien mantiene la plataforma, no para el equipo de diseño.  */
export const DEV_ROLE = { key: 'desarrollador', label: 'Desarrollador', icon: Code2 };

export const ALL_ROLE_DEFS = [...ROLES, ...LEADER_ROLES, QA_ROLE, DEV_ROLE];
/* Roles que solo el Líder de Diseño (o un Desarrollador) puede otorgar.     */
export const ROLES_DE_ALTO_NIVEL = [...LEADER_ROLE_KEYS, DEV_ROLE.key];

/* Agrupación de la pestaña "Equipo": una persona puede caer en varias        */
/* categorías a la vez si tiene varios roles (ej. Ing. Civil y Líder Civil). */
export const EQUIPO_CATEGORIAS = [
  { id: 'ing_civiles', label: 'Ing. Civiles', icon: HardHat, roles: ['civil', 'hidraulico', 'estructural', 'geotecnico'] },
  { id: 'ing_electricos', label: 'Ing. Eléctricos', icon: Zap, roles: ['electrico'] },
  { id: 'delineantes', label: 'Delineantes', icon: PenTool, roles: ['delineante'] },
  { id: 'control_documental', label: 'Trámites y BT', icon: FileText, roles: ['tramites_bt'] },
  { id: 'control_calidad', label: 'Control de Calidad', icon: ClipboardCheck, roles: [QA_ROLE.key] },
  { id: 'lideres', label: 'Líderes', icon: ShieldCheck, roles: LEADER_ROLE_KEYS },
  { id: 'desarrolladores', label: 'Desarrolladores', icon: Code2, roles: [DEV_ROLE.key] },
];

export function roleLabel(key) {
  return ALL_ROLE_DEFS.find((r) => r.key === key)?.label || key;
}
export function rolesLabel(perfil) {
  if (!perfil || !perfil.roles || perfil.roles.length === 0) return 'Sin rol asignado';
  return perfil.roles.map(roleLabel).join(' · ');
}
export function isDeveloper(perfil) {
  return !!perfil && !!perfil.roles && perfil.roles.includes(DEV_ROLE.key);
}
export function isLeader(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.some((k) => LEADER_ROLE_KEYS.includes(k)));
}
export function isDesignLeader(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes('lider_diseno'));
}
export function isQA(perfil) {
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes(QA_ROLE.key));
}
/* Los roles de líder y el de Desarrollador solo los puede otorgar o quitar */
/* el Líder de Diseño (o un Desarrollador). Los demás roles los puede       */
/* gestionar cualquier líder.                                                */
export function canAssignRole(perfil, roleKey) {
  if (ROLES_DE_ALTO_NIVEL.includes(roleKey)) return isDesignLeader(perfil);
  return isLeader(perfil);
}
export function isAssignedToProject(perfil, project) {
  return !!perfil && equipoNombres(project.equipo).includes(perfil.nombre);
}
/* A diferencia de isAssignedToProject: esto SÍ mira la clave de revisor    */
/* — para el apartado "Revisión de proyectos" (ver Dashboard), que es lo     */
/* opuesto de "Mis proyectos" (no lo desarrollo, solo lo reviso).            */
export function esAprobadorDe(perfil, project) {
  if (!perfil) return false;
  const equipo = project.equipo || {};
  return equipo.aprobador_electrico === perfil.nombre;
}
