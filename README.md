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
3. Esto crea las tablas `profiles`, `projects` y `links`, las reglas de
   seguridad (cada quien solo edita su propio perfil; el equipo completo
   puede ver y editar proyectos y enlaces), y el bucket de almacenamiento
   `avatars` para las fotos de perfil.

## 3. Habilitar registro por correo (ya viene activo por defecto)

1. Ve a **Authentication → Providers** y confirma que **Email** esté
   habilitado (lo está por defecto).
2. Si quieres que la gente pueda entrar sin confirmar el correo primero
   (más simple para un equipo interno pequeño), ve a
   **Authentication → Settings** y desactiva "Confirm email". Si lo dejas
   activado, cada persona deberá hacer clic en un enlace de confirmación
   que le llega por correo antes de poder iniciar sesión.

## 4. Copiar tus llaves de API

1. Ve a **Project Settings → API**.
2. Copia el **Project URL** y la clave **anon public**.

## 5. Configurar el proyecto localmente

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

## 6. Publicarlo en Vercel (para que todo el equipo lo use)

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

## 7. Compartir el acceso con el equipo

Envía la URL pública (ej. `https://sun-design-suite.vercel.app`) a cada
ingeniero. Cada persona:

1. Entra al link.
2. Crea su cuenta con correo y contraseña.
3. Completa su perfil (nombre, foto, especialidad).
4. A partir de ahí puede ver y crear proyectos, y aparecerá disponible
   para ser asignado como responsable en su especialidad.

---

## Notas y siguientes pasos

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
