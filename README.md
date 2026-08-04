# Sun Design Suite

Versión autónoma (fuera de Claude) de la app de gestión y hoja de vida de
minigranjas fotovoltaicas. Usa **Supabase** como backend (autenticación +
base de datos + almacenamiento de fotos) y se despliega en **Vercel**
(o Netlify) con una URL propia que puede compartirse con todo el equipo.

Sigue los pasos en orden. No necesitas experiencia previa con Supabase.

---

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Clic en **New project**. Ponle un nombre (ej. `sun-design-suite`),
   define una contraseña de base de datos (guárdala, no la necesitarás en
   el código, pero Supabase la pide) y elige la región más cercana a tu
   equipo. Espera 1-2 minutos a que se aprovisione.

## 2. Crear las tablas y permisos

1. En el menú lateral, entra a **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo**
   su contenido, pégalo en el editor y presiona **Run**.
3. Esto crea las tablas `profiles`, `projects`, `links`, `activity_log`
   (historial de cambios) y `user_roles` (roles de cada persona), las
   reglas de seguridad correspondientes, y el bucket de almacenamiento
   `avatars` para las fotos de perfil.

> **¿Ya tenías este proyecto desplegado antes de esta actualización?**
> Tu base de datos ya existe, así que **no vuelvas a correr `schema.sql`
> completo** (las políticas de seguridad fallarían por estar duplicadas).
> En su lugar, corre — en este orden, y solo los que no hayas corrido ya —
> `supabase/migration_historial.sql`,
> `supabase/migration_roles_notas_documentos.sql`,
> `supabase/migration_eliminar_proyectos_solo_lideres.sql`,
> `supabase/migration_eliminar_usuarios_lider_diseno.sql`,
> `supabase/migration_solo_lider_diseno_asigna_lideres.sql` y
> `supabase/migration_instructivos.sql` y
> `supabase/migration_rol_desarrollador.sql` y
> `supabase/migration_historial_categoria.sql`. Cada uno agrega
> solo lo nuevo sin tocar lo que ya tenías. Si no recuerdas si ya corriste
> alguno, no pasa nada por intentarlo de nuevo: en el peor caso te marcará
> un error de "ya existe", que puedes ignorar.
>
> **Sobre "eliminar usuarios":** el Líder de Diseño puede borrar el perfil
> y los roles de alguien desde la sección "Equipo" — eso lo saca del
> equipo y de cualquier proyecto al que pudiera asignarse. Pero su cuenta
> de acceso (correo + contraseña) sigue existiendo en Supabase Auth, así
> que si vuelve a entrar, verá la pantalla de "crear tu perfil" otra vez,
> como si fuera nuevo. Para borrar el acceso por completo, hazlo desde
> **Authentication → Users** en el panel de Supabase (esto requiere
> permisos de administrador del proyecto de Supabase, no de la app).

## 3. Asignar el primer líder

El sistema de roles es intencionalmente estricto: **nadie puede otorgarse
un rol de líder a sí mismo**, ni siquiera desde la aplicación — solo otro
líder puede darle un rol a alguien. Esto significa que la primera vez,
alguien tiene que "romper" esa regla manualmente desde la base de datos:

1. Pídele a la persona que será el primer líder que entre a la app, cree
   su cuenta (correo + contraseña) y complete su perfil (nombre y foto).
2. En Supabase, ve a **Authentication → Users** y copia su **UID** (un
   código largo tipo `a1b2c3d4-...`).
3. Ve a **SQL Editor → New query** y corre (reemplazando el UID):
   ```sql
   insert into user_roles (user_id, role_key)
   values ('PEGA-AQUI-EL-UID', 'lider_diseno');
   ```
4. Listo — esa persona ya puede entrar a la sección **"Equipo"** de la
   app y asignarle rol a todos los demás con solo hacer clic, sin volver
   a tocar el SQL Editor.

Los roles disponibles son: `civil`, `hidraulico`, `estructural`, `electrico`,
`mecanico`, `geotecnico`, `delineante` (especialidades técnicas),
`lider_civil`, `lider_electrico`, `lider_delineantes`, `lider_diseno`
(líderes) y `control_calidad` (Control de Calidad Interno). Una misma
persona puede tener varios a la vez.

## 4. Habilitar registro por correo (ya viene activo por defecto)

1. Ve a **Authentication → Providers** y confirma que **Email** esté
   habilitado (lo está por defecto).
2. Si quieres que la gente pueda entrar sin confirmar el correo primero
   (más simple para un equipo interno pequeño), ve a
   **Authentication → Settings** y desactiva "Confirm email". Si lo dejas
   activado, cada persona deberá hacer clic en un enlace de confirmación
   que le llega por correo antes de poder iniciar sesión.

## 5. Copiar tus llaves de API

1. Ve a **Project Settings → API**.
2. Copia el **Project URL** y la clave **anon public**.

## 6. Configurar el proyecto localmente

1. Descomprime este proyecto y abre una terminal dentro de la carpeta.
2. Copia el archivo de ejemplo de variables de entorno:
   ```
   cp .env.example .env
   ```
3. Abre `.env` y pega los dos valores que copiaste en el paso anterior:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica
   ```
4. Instala las dependencias:
   ```
   npm install
   ```
5. Corre el proyecto en tu computador para probarlo:
   ```
   npm run dev
   ```
   Abre la URL que te muestra la terminal (normalmente
   `http://localhost:5173`). Crea una cuenta de prueba, completa tu perfil
   y confirma que todo funciona antes de publicarlo.

## 7. Publicarlo en Vercel (para que todo el equipo lo use)

**Opción A — Con GitHub (recomendada):**

1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. Ve a [vercel.com](https://vercel.com), crea una cuenta gratuita e
   importa ese repositorio ("Add New… → Project").
3. Vercel detecta automáticamente que es un proyecto Vite. Antes de darle
   a "Deploy", abre la sección **Environment Variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (los mismos valores de tu archivo `.env`).
4. Clic en **Deploy**. En un minuto tendrás una URL como
   `https://sun-design-suite.vercel.app`.

**Opción B — Sin GitHub, con la CLI de Vercel:**

1. Instala la CLI: `npm install -g vercel`
2. Desde la carpeta del proyecto: `vercel`
3. Sigue las instrucciones en pantalla (te pedirá iniciar sesión en Vercel
   la primera vez).
4. Cuando te pregunte por variables de entorno, agrega
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si no te las pide en
   ese momento, agrégalas después desde el dashboard de Vercel
   (Project → Settings → Environment Variables) y ejecuta `vercel --prod`
   de nuevo.

## 8. Compartir el acceso con el equipo

Envía la URL pública (ej. `https://sun-design-suite.vercel.app`) a cada
ingeniero. Cada persona:

1. Entra al link.
2. Crea su cuenta con correo y contraseña.
3. Completa su perfil (nombre y foto — **ya no elige su propia
   especialidad**).
4. Le pide a un líder (o al primer líder que asignaste en el paso 3) que
   le otorgue su(s) rol(es) desde la sección **"Equipo"**.
5. Una vez tiene rol, aparece disponible para ser asignado como
   responsable en los proyectos que correspondan a su especialidad, y
   puede editar el contenido de los proyectos donde quede asignado.

---

## Notas y siguientes pasos

- **Marca "Solé"**: la paleta (`lime`, `navy`, `nashville`) vive en
  `tailwind.config.js` con los códigos exactos de marca (Lemony `#E2FF65`,
  Nautical Navy `#152644`, Nashville `#8CC3E1`). El logo de la barra
  lateral usa `src/assets/logo-s-mark.png` (la "S" recortada del logo
  principal); si cambian el logo, solo hay que reemplazar ese archivo con
  el mismo nombre.
- **Formato en Notas**: la barra de herramientas (negrilla, cursiva,
  subrayado, viñetas) guarda una mini-sintaxis de texto plano
  (`**negrilla**`, `*cursiva*`, `__subrayado__`, líneas con `- ` para
  viñetas) — no HTML. Esto es intencional: evita guardar HTML sin
  controlar en la base de datos. Si más adelante quieres un editor más
  completo (encabezados, listas numeradas, etc.), se puede reemplazar por
  una librería como TipTap, pero implica más dependencias.
- **Rol de Desarrollador**: tiene todos los permisos habilitados a la vez
  (equivale a Líder de Diseño + Control de Calidad Interno + poder
  gestionar cualquier rol, incluidos los de líder). Pensado para quien
  mantiene la plataforma técnicamente, no para el equipo de diseño del día
  a día. Solo un Líder de Diseño (o otro Desarrollador) puede otorgarlo,
  desde la sección "Equipo".
- **Varias personas en un mismo rol**: Ing. Civil, Ing. Eléctrico y
  Delineante admiten más de una persona por proyecto (ej. dos ingenieros
  civiles en el mismo diseño). Las demás especialidades siguen siendo de
  una sola persona. No requiere ninguna migración de base de datos: los
  proyectos que ya tenías siguen funcionando igual (una sola persona por
  rol), y simplemente ahora puedes agregar una segunda, tercera, etc. Si
  quieres que alguna otra especialidad también admita varias personas,
  edita el arreglo `MULTI_ROLE_KEYS` en `src/App.jsx`.
- **Instructivos**: cualquier persona con cuenta puede crear, editar y
  eliminar carpetas y videos (no está restringido a líderes, igual que
  "Enlaces de Interés"). Solo acepta links de YouTube (`youtube.com/watch`,
  `youtu.be/`, `/embed/` o `/shorts/`); el video se reproduce embebido en
  la misma página, sin descargar ni guardar el archivo en ningún lado —
  sigue viviendo en YouTube. Si más adelante quieres restringir quién
  puede editarlos, se ajusta en las políticas de `instructivo_carpetas` /
  `instructivo_videos` en `supabase/schema.sql`.
- **Código de documentos (Control Documental)**: se genera automáticamente
  a partir de tres campos en la pestaña "General" de cada proyecto
  (departamento abreviado, número de minigranja, número de predio). Si
  quedan vacíos, la pestaña de Control Documental muestra el código con el
  placeholder original (`COLXXXXXXPX-...`) hasta que se completen.
- **Listas de documentos por inversionista**: viven como constantes
  (`DOCS_ESTANDAR`, `DOCS_CFM`, `DOCS_FENOGE`) en `src/App.jsx`. Si tu
  lista de documentos cambia, edita esos arreglos directamente — no hace
  falta tocar la base de datos.
- **Permisos por rol**: solo un líder (Civil, Eléctrico, Delineantes o
  Diseño) puede asignar equipo o cambiar el estado de un proyecto; solo
  quien ya está asignado a un proyecto puede editar sus campos técnicos,
  notas y archivos; solo "Control de Calidad Interno" puede escribir
  comentarios en Control Documental. El estado de cada documento sí lo
  puede cambiar cualquiera del equipo asignado (no solo QA), porque las
  especialidades del listado de documentos —GENERAL, COMUNICACIONES,
  etc.— no coinciden 1 a 1 con las 7 especialidades técnicas de la app.
- **Fotos de perfil**: se guardan en el bucket `avatars` de Supabase
  Storage (plan gratuito incluye 1 GB).
- **Archivos adjuntos de proyectos**: por ahora la app solo guarda el
  *nombre* del archivo, igual que la versión de prueba en Claude — no
  sube el contenido real. Si quieres subir los documentos de verdad,
  se puede crear un bucket adicional (ej. `documentos`) y usar
  `supabase.storage.from('documentos').upload(...)` en el módulo de
  Archivos Adjuntos (`AttachmentsPanel`, dentro de `src/App.jsx`).
- **Actualizar datos de otros compañeros**: la app no tiene sincronización
  en vivo; usa el botón de refrescar (ícono de flechas circulares, junto a
  "Resumen" en la barra lateral) para traer los cambios más recientes de
  la base de datos. Si más adelante quieres que se actualice sola,
  Supabase permite suscribirte a cambios en tiempo real
  (`supabase.channel(...).on('postgres_changes', ...)`).
- **Plan gratuito de Supabase**: puede pausar proyectos inactivos tras un
  tiempo sin uso; si eso pasa, solo hay que reactivarlo con un clic desde
  el dashboard de Supabase.
- **Seguridad**: las políticas actuales asumen un equipo interno de
  confianza (cualquier persona con cuenta puede ver y editar todos los
  proyectos). Si en el futuro necesitas restringir por proyecto o rol,
  se ajusta en las políticas RLS de `supabase/schema.sql`.
