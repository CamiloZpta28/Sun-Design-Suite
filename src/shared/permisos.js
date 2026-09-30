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
  ShieldCheck, ClipboardCheck, Code2, Eye,
} from 'lucide-react';

/* --------------------------- 1. ROLES / ESPECIALIDADES --------------------- */
/* Cada persona puede tener VARIOS roles a la vez (ej. Líder Civil + Ing.     */
/* Civil). Los roles ya no se auto-asignan al crear la cuenta: solo un       */
/* líder puede otorgarlos (ver TeamRolesView), para que nadie pueda          */
/* entrar a proyectos que no le corresponden con solo elegir un rol.         */
/* "corto" es la abreviatura de 3 letras que se usa donde no cabe el nombre  */
/* completo: en los dossiers, cada documento muestra los 7 roles en fila.    */
export const ROLES = [
  { key: 'civil', label: 'Ing. Civil', corto: 'CIV', icon: HardHat },
  { key: 'hidraulico', label: 'Ing. Hidráulico', corto: 'HID', icon: Droplets },
  { key: 'estructural', label: 'Ing. Estructural', corto: 'EST', icon: Building2 },
  { key: 'electrico', label: 'Ing. Eléctrico', corto: 'ELE', icon: Zap },
  { key: 'geotecnico', label: 'Ing. Geotécnico', corto: 'GEO', icon: Mountain },
  { key: 'delineante', label: 'Delineante', corto: 'DEL', icon: PenTool },
  { key: 'tramites_bt', label: 'Trámites y BT', corto: 'BT', icon: FileText },
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
/* Claves de "equipo" que NO cuentan como asignación real de trabajo:

   - El ingeniero de proyectos no tiene cuenta con la que iniciar sesión, así
     que no puede ser el responsable de nada en la plataforma.

   - 'aprobador_electrico' es de la mecánica de revisión, que se retiró. La
     clave sigue aquí porque los proyectos de antes la tienen guardada: si se
     quitara, esas personas pasarían de pronto a contar como asignadas, con
     permiso de edición y el proyecto metido en sus "Mis proyectos". Quitar
     una pantalla no puede repartir permisos. */
export const EQUIPO_CLAVES_SIN_ASIGNACION = ['ingeniero_proyectos', 'aprobador_electrico'];
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

/* Invitado: quien NO tiene ningún rol de equipo. No es un rol que se otorgue
   —no aparece entre los que se asignan—: es el estado de toda cuenta nueva
   hasta que un líder o un desarrollador le da un rol del equipo, y vuelve a
   serlo si se los quitan todos. Así nunca se es invitado y otra cosa a la
   vez, y nadie entra a editar solo por haberse creado una cuenta.

   Sirve para gente de Solenium que sigue los proyectos sin trabajarlos
   (gerencia, comercial, otras áreas). Ve Dashboard, Todos los proyectos,
   Resumen por inversionista y Equipo; abre cualquier proyecto con todas sus
   pestañas, pero no edita nada, no aparece en los resúmenes semanales y no
   ve los datos personales de nadie más. La base de datos aplica la misma
   regla (ver supabase/migration_rol_invitado.sql), así que no depende solo
   de que la pantalla esconda los botones. */
export const INVITADO_ROLE = { key: 'invitado', label: 'Invitado', icon: Eye };

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
  if (!perfil) return 'Sin rol asignado';
  if (esInvitado(perfil)) return INVITADO_ROLE.label;
  return perfil.roles.map(roleLabel).join(' · ');
}
/* Ser invitado es no tener ningún rol de equipo. Si los roles todavía no se
   pudieron cargar, la persona queda como invitada: ante la duda, en solo
   lectura, nunca al revés. */
export function esInvitado(perfil) {
  return !!perfil && !(perfil.roles || []).some((rol) => rol !== INVITADO_ROLE.key);
}
/* Cada permiso empieza preguntando si es invitado: así, todo lo que ya
   dependía de estas funciones —editar campos, asignar equipo, comentar,
   borrar— queda cerrado para él sin tener que tocarlo uno por uno. */
export function isDeveloper(perfil) {
  return !esInvitado(perfil) && !!perfil && !!perfil.roles && perfil.roles.includes(DEV_ROLE.key);
}
export function isLeader(perfil) {
  if (esInvitado(perfil)) return false;
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.some((k) => LEADER_ROLE_KEYS.includes(k)));
}
export function isDesignLeader(perfil) {
  if (esInvitado(perfil)) return false;
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes('lider_diseno'));
}
export function isQA(perfil) {
  if (esInvitado(perfil)) return false;
  return isDeveloper(perfil) || (!!perfil && !!perfil.roles && perfil.roles.includes(QA_ROLE.key));
}

/* Las secciones del menú que ve un invitado. "detalle" es la ficha de un
   proyecto, que se abre desde las listas. */
export const VISTAS_DEL_INVITADO = ['dashboard', 'todos', 'resumen_inversionistas', 'equipo', 'detalle'];
export function puedeVerVista(perfil, vista) {
  return !esInvitado(perfil) || VISTAS_DEL_INVITADO.includes(vista);
}

/* Datos personales de la ficha de cada persona. Viven en su propia tabla
   (datos_personales), aparte del perfil: el perfil lo lee todo el mundo y
   estos no. Los ve la propia persona y quien tenga un rol de equipo; un
   invitado —incluida toda cuenta recién creada— solo ve los suyos. */
export const CAMPOS_DATOS_PERSONALES = [
  'cedula', 'ciudad_expedicion_cedula', 'matricula_profesional', 'celular', 'direccion', 'correo_personal',
];
export function puedeVerDatosPersonales(perfil, persona) {
  if (!perfil || !persona) return false;
  if (perfil.id === persona.id) return true;
  return !esInvitado(perfil);
}
/* Parte un cambio de la ficha de una persona en lo que va al perfil y lo
   que va a datos_personales, para guardar cada cosa en su tabla. */
export function separarDatosPersonales(patch) {
  const perfil = {};
  const datos = {};
  Object.entries(patch || {}).forEach(([clave, valor]) => {
    if (CAMPOS_DATOS_PERSONALES.includes(clave)) datos[clave] = valor;
    else perfil[clave] = valor;
  });
  return { perfil, datos };
}
/* Los dossiers los gestionan los líderes (y el Desarrollador): asignar el   */
/* dossier de un inversionista, duplicar una versión, agregar o quitar        */
/* documentos y repartir responsables. Todo el mundo los puede VER — son la   */
/* referencia de qué documentos lleva cada proyecto.                          */
export function puedeGestionarDossiers(perfil) {
  return isLeader(perfil);
}

/* Los roles de líder y el de Desarrollador solo los puede otorgar o quitar */
/* el Líder de Diseño (o un Desarrollador). Los demás roles los puede       */
/* gestionar cualquier líder.                                                */
export function canAssignRole(perfil, roleKey) {
  if (ROLES_DE_ALTO_NIVEL.includes(roleKey)) return isDesignLeader(perfil);
  return isLeader(perfil);
}
export function isAssignedToProject(perfil, project) {
  return !!perfil && !esInvitado(perfil) && equipoNombres(project.equipo).includes(perfil.nombre);
}

/* Quiénes elaboraron el proyecto: no solo los civiles. En el rótulo de la
   hoja de vida y en la cabecera del proyecto aparecía únicamente `civil`,
   así que los eléctricos y los delineantes hacían el trabajo y no salían
   por ninguna parte.

   Van en el orden en que se lee un plano —civiles, eléctricos, delineantes—
   y sin repetidos: alguien con dos roles en el mismo proyecto se nombra una
   sola vez. */
export const CLAVES_ELABORARON = ['civil', 'electrico', 'delineante'];

export function equipoQueElaboro(equipo) {
  const nombres = CLAVES_ELABORARON.flatMap((clave) => equipoComoArray((equipo || {})[clave]));
  return [...new Set(nombres)];
}

export function textoQueElaboro(equipo) {
  return equipoQueElaboro(equipo).join(', ');
}
