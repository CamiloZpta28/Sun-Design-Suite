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
> `supabase/migration_historial_categoria.sql` y
> `supabase/migration_inversionistas.sql` y
> `supabase/migration_paises.sql` y
> `supabase/migration_guardado_parcial.sql`,
> `supabase/migration_proveedores.sql` y
> `supabase/migration_perfil_fechas.sql` y
> `supabase/migration_cimentacion_plantillas.sql`. Cada uno agrega
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

- **Ajustes finos al Portón, verificados extrayendo el SVG real que genera
  cada vista** (no solo revisando el código):
  - **Viga a la misma profundidad que la zapata**: ya no se dibuja encima
    de la zapata — arranca desde el mismo nivel (justo encima del
    solado), como en tu referencia.
  - **Texto de separación quitado del isométrico** — la longitud de la
    viga se sigue viendo en "Viga · vista posterior" (ya estaba ahí).
  - **Estribos como línea única** en las vistas posteriores de viga y
    pedestal — el "efecto de pares" que reportaste no era un problema de
    separación, era que los dibujaba como un rectángulo hueco (sus dos
    lados verticales se veían como dos líneas). Ahora es una sola línea
    por estribo, igual que ya tenía la sección transversal.
  - **Estribos de la viga centrados**, con la misma lógica que ya usaba
    el pedestal.
  - **Ganchos completos en la viga**: ahora las dos barras (arriba y
    abajo) tienen gancho en AMBOS extremos, no solo en uno — cada extremo
    ancla en su propia zapata.

- **La pantalla en blanco de Portón — encontrada la causa real esta vez.**
  Mi corrección anterior (rellenar campos faltantes en plantillas viejas)
  era necesaria pero no era la causa completa — por eso seguía pasando
  incluso al crear una plantilla nueva. El problema real: al mover el
  cálculo de la altura del pedestal (ahora se saca sola de "desplante −
  espesor de zapata"), dejé una variable con un nombre en el texto que
  se muestra en pantalla (`alturaPedestal`) que nunca llegué a declarar
  — el cálculo real vivía en otra variable con un nombre parecido
  (`alturaTotalPedestal`). Eso revienta la app apenas se intenta pintar
  el formulario, tanto al crear como al editar, y como es un choque real
  de React sin manejo de errores, tumba toda la página — por eso ni el
  botón "atrás" respondía.
  - **Hasta ahora no había podido pescar este tipo de error** porque mi
    prueba de humo solo confirmaba que el código cargara sin errores de
    referencia a nivel de módulo — nunca llegaba a renderizar el
    formulario de verdad. Esta vez monté React de verdad en un DOM
    simulado (usando exactamente el mismo React que usa la app, evitando
    mezclar dos copias) y rendericé el formulario en 3 escenarios:
    crear una plantilla nueva, editar una plantilla vieja incompleta, y
    editar una plantilla completa con todos los campos llenos. Los tres
    ya renderizan sin ningún error de consola, y confirmé que el resumen
    de acero y de volúmenes sí aparecen con los números calculados.
  - Voy a dejar este tipo de prueba (renderizar el formulario de verdad,
    no solo cargar el módulo) como parte de mi rutina de validación para
    cualquier cambio futuro a formularios grandes como este.

- **Corrección urgente — página en blanco al editar Portón**: la causa
  real era que varias funciones (de cálculo y del formulario) leían
  campos como `datos.viga.barras.ganchos` o `datos.pedestal.estribos.calibre`
  asumiendo que esa estructura anidada siempre existía completa. Como esos
  campos se fueron agregando en distintas rondas, una plantilla guardada
  con una versión anterior del formulario podía no tenerlos todos, y al
  abrirla para editar, JavaScript revienta al intentar leer una propiedad
  de "undefined" — pantalla en blanco, sin ningún aviso.
  - En vez de parchar cada acceso uno por uno, arreglé la causa de raíz:
    agregué `normalizarDatosPorton()`, que rellena CUALQUIER campo
    faltante con un valor por defecto vacío al abrir el formulario — así
    no importa qué tan vieja sea la plantilla, siempre queda con la
    estructura completa antes de que el resto del código la use.
  - Verifiqué esto simulando una plantilla vieja incompleta (sin ganchos
    en la viga, sin estribos en el pedestal, sin parrilla transversal en
    la zapata) y confirmando que ya no revienta, antes de darlo por
    resuelto.
- **Botón "atrás" del navegador**: ya no cierra la página — ahora vuelve a
  la vista anterior dentro de la app (Dashboard, Mis Proyectos, un
  proyecto abierto, etc.), igual que en cualquier otra página web. Cada
  vez que cambias de sección o abres un proyecto, queda registrado en el
  historial del navegador; el botón "Volver" dentro de un proyecto usa
  exactamente el mismo mecanismo, así los dos quedan sincronizados.
  - Por ahora esto cubre la navegación principal (secciones del menú +
    abrir/cerrar un proyecto). No cubre pasos más internos, como cerrar
    el formulario de "editar plantilla" dentro de Cimentaciones — si te
    parece importante que el botón "atrás" también deshaga eso, avísame
    y lo extiendo.

- **Ronda grande de correcciones a Portón** (11 puntos de tu feedback):
  1. **Viga solapada con la zapata** — bug real encontrado: la fórmula de
     su posición vertical se volvía negativa. Ahora arranca desde la parte
     de arriba de la zapata, sin chocar. Verifiqué el resultado
     renderizándolo antes de entregarlo.
  2. **Solado agregado** en el isométrico y la elevación (bajo cada zapata
     y bajo el tramo de la viga), y también en Paso de fauna.
  3. **Nivel de terreno natural corregido** — ahora cruza a la altura de
     la parte de ARRIBA de los pedestales, no al nivel de la zapata/viga.
  4. **Corte del pedestal con 8 barras** (4 esquinas + 4 a mitad de lado)
     — construí una función que reparte cualquier cantidad de barras
     alrededor del perímetro, reutilizable para el futuro.
  5. **Vista posterior del pedestal con 3 barras visibles** (no 4) —
     encontré el bug real: usaba techo(cantidad/2) en vez de calcular las
     posiciones X realmente únicas según cómo se reparten las barras en el
     perímetro. Los estribos ya estaban parejos en el código (verifiqué la
     fórmula a mano); si los sigues viendo en pares avísame con más
     detalle.
  6. **Vista posterior de la viga más grande** — le di su propio tamaño,
     mucho más ancho que las demás vistas, para que se lean los datos.
  7. **Cotas paralelas agregadas** en las vistas que faltaban: isométrico,
     elevación, corte de pedestal, corte de viga, y las dos vistas
     posteriores.
  8. **Ganchos de la viga**: agregué el campo "N.° de ganchos por pieza" —
     antes no se tenían en cuenta. Van en el extremo que ancla en la
     zapata (no en el del traslapo, que usa el solape en vez de un gancho).
  9. **Altura del pedestal ahora se calcula sola**: desplante − espesor de
     zapata, en vez de digitarse aparte — ya no hay dos números que
     puedan contradecirse entre sí.
  10. **Peso de acero por elemento**: nuevo desglose (zapata longitudinal,
      zapata transversal, viga barras, viga estribos, pedestal barras,
      pedestal estribos), además del total ya existente.
  11. **Paso de fauna ahora sí lleva solado**, con su propio campo y la
      excavación corregida.
  - **Un incidente en el camino**: al reescribir la vista posterior de la
    viga borré por accidente su propia firma, dejando el cuerpo de la
    función huérfano. Lo detecté de inmediato revisando antes de seguir
    (como ya es costumbre) y reconstruí la función completa.

- **Empalmes de la viga de amarre corregidos**: ya no se parten a la mitad
  — van a tercios, con el de las barras de arriba en 1/3 y el de las de
  abajo en 2/3 (nunca en el mismo tercio), tal como lo corregiste. Cada
  línea (2 arriba + 2 abajo = 4 líneas) queda formada por una pieza corta
  (≈1/3 de la longitud) y una larga (≈2/3), cada una con medio traslapo de
  más — 8 piezas en total.
- **6 vistas nuevas agregadas al Portón** (ya son 8 en total):
  planta y elevación de todo el conjunto, corte transversal y vista
  posterior del pedestal, y corte transversal y vista posterior de la
  viga (esta última con los empalmes marcados exactamente en 1/3 y 2/3,
  verificado renderizando el resultado antes de entregarlo).

- **Cerramiento completo — las 3 plantillas separadas, como pediste**:
  - **Cerramiento · Postes**: reutiliza EXACTAMENTE el mismo código de
    Postes MT (cilíndrico, sin acero) — no hay nada nuevo que mantener por
    separado, cualquier mejora futura a Postes MT aplica aquí también.
  - **Cerramiento · Paso de fauna**: bloque macizo sin acero (base,
    profundo, alto). La excavación es igual al volumen de concreto (no
    tiene solado aparte, tal como lo describiste).
  - **Cerramiento · Portón** (la parte grande) — Zapata + Viga de amarre +
    Pedestal, con la parrilla y el traslapo calculados solos, no digitados:
    - **Parrilla de la zapata**: ya no se digita la cantidad de barras —
      se calcula con techo[(x−2a)/b] en cada dirección, tal como lo
      corregiste. Cada barra lleva 2 ganchos hacia arriba.
    - **Traslapo de la viga**: usa la tabla NSR-10 que me diste, buscada
      por calibre y la resistencia del concreto de la plantilla (por eso
      recuperamos ese campo). Las 8 barras longitudinales se arman como 4
      líneas × 2 piezas traslapadas cada una, cada pieza midiendo
      (separación entre zapatas + traslapo) / 2.
    - **Excavación combinada**: huella de las 2 zapatas + el tramo de la
      viga entre sus caras internas, todo multiplicado por (desplante +
      espesor de solado) — exactamente la fórmula que diste. El pedestal
      no aporta nada aparte.
    - **Verifiqué todas las fórmulas a mano** (fuera del código, con
      números de ejemplo) antes de confiar en la implementación.
  - **Dos decisiones de ingeniería que tomé por mi cuenta — avísame si no
    eran así**:
    1. Para el pedestal del Portón, separé "altura sobre la zapata"
       (su propio concreto, lo único que suma al volumen de concreto) de
       "empotramiento en zapata" (un campo nuevo, solo para el cálculo de
       longitud de la barra — no suma concreto ni excavación, porque ese
       tramo ya es concreto de la zapata). Me pareció la forma de evitar
       contar ese concreto dos veces.
    2. El traslapo de las piezas de la viga lo puse a la mitad del
       recorrido (cada pieza cubre la mitad de la separación entre
       zapatas más medio traslapo) — tu Excel mostraba piezas de largos
       distintos (no partidas a la mitad), así que si tienes una
       convención específica de dónde debe caer el empalme, dime y lo
       ajusto.
  - **Previsualización**: por el tamaño de esta plantilla, dejé 2 vistas
    (isométrico del conjunto completo, y la planta de una zapata con su
    parrilla) en vez de las 3-4 vistas de los tipos anteriores — si
    quieres que agregue una vista del corte de la viga o del pedestal,
    dímelo y la sumo.

- **Cerramiento — Fase 1 completa** (base compartida, antes de construir
  Zapata+Viga+Pedestal del Portón):
  - **Tabla de ganchos corregida**: #3=0.10, #4=0.20, #5=0.25, #6=0.30 m.
  - **Tabla de traslapos** (NSR-10, tipo B a tensión) por calibre y
    resistencia — verificada contra tu imagen, coincide exactamente
    (ej. #3 @ 21MPa = 0.55m).
  - **Excavación corregida en TODAS las cimentaciones existentes**: ahora
    usa (desplante + espesor de solado), no solo desplante — Postes MT,
    Luminarias, Cámaras e Inversores.
  - **"Resistencia del concreto" recuperada** en las 4 plantillas
    existentes, y agregada la opción "35 MPa" (la necesita la tabla de
    traslapos).
  - **Puerta trasera** (`Wrench` en la esquina de Cimentaciones, visible
    solo para el rol Desarrollador — no Líder de Diseño): permite ver y
    editar recubrimiento, gancho/peso por calibre, y traslapos, guardados
    en Supabase y aplicados de inmediato sin necesitar un despliegue
    nuevo. Debajo, una lista de las fórmulas en texto plano, de solo
    lectura (para corregir una fórmula en sí — no solo un número — toca
    pedir un cambio de código).
  - **Necesita migración**: `supabase/migration_parametros_ingenieria.sql`.
  - **Siguiente paso**: construir Zapata + Viga de amarre + Pedestal del
    Portón, con la parrilla de acero calculada (no digitada), el traslapo
    de la viga según la tabla, y la excavación combinada de todo el
    conjunto, tal como lo definiste.

- **Bug real encontrado y corregido — volumen de solado en 0**: tenías
  razón, no era un problema de la fórmula sino de los nombres. Las
  funciones de cálculo esperaban un dato llamado `espesorSolado`
  (camelCase), pero el campo real que guardan los formularios se llama
  `espesor_solado` (con guion bajo) — así que siempre leían "vacío" y el
  volumen de solado daba 0.000 sin importar qué escribieras. Ya está
  corregido en Postes MT, Luminarias y Cámaras; lo verifiqué con tus
  mismos números exactos (0.30 m de diámetro, 0.05 m de espesor) y ahora
  sí da 0.003534 m³, igual a tu calculadora.
  - La fórmula en sí (que confirmé la vez pasada) siempre estuvo bien —
    el problema nunca fue el cálculo matemático, sino que nunca le estaba
    llegando el dato correcto.
- **Solado en sección longitudinal**: la corrección de "misma huella" que
  hice la vez pasada solo había quedado aplicada en la vista isométrica.
  Ya está corregida también en la sección longitudinal, para Postes MT,
  Luminarias y Cámaras.
- **Inversores: solado separado por pedestal**: antes se dibujaba como
  una sola franja corrida bajo ambos pedestales; ahora cada pedestal tiene
  su propio solado independiente, con su misma huella — lo verifiqué
  renderizando el resultado antes de entregarlo.

- **Ajustes rápidos a Cimentaciones**:
  - **Previsualización centrada de verdad** en Postes MT, Luminarias y
    Cámaras: la caja gris que envuelve las 3 vistas ahora usa
    `width: fit-content`, así que siempre mide exactamente lo que ocupan
    los dibujos — antes, en ciertos anchos de pantalla, la caja podía
    quedar más ancha de lo necesario y el contenido se veía pegado a la
    izquierda en vez de centrado.
  - **Fórmula de solado**: la revisé a fondo y **ya estaba correcta** —
    `Math.PI * (d/2) * (d/2)` es matemáticamente lo mismo que
    `π×(D²/4)`, y en el caso rectangular ya usábamos `ancho × profundo`.
    No hice ningún cambio ahí porque no encontré ningún error; si notas
    algún número que no cuadre, avísame con el caso puntual (medidas y
    resultado esperado) y lo reviso de nuevo.
  - **Peso de acero dentro de "Cantidades de obra"**: en Inversores, el
    peso total de acero ya no aparece en un recuadro aparte — ahora es una
    columna más dentro del mismo panel de "Cantidades de obra", junto a
    concreto, excavación y solado.

- **Mejoras a Postes MT, Luminarias y Cámaras (regresando antes de seguir
  con Cerramiento)**:
  - **Dibujos más grandes**, mismo tamaño que usamos para Inversores.
  - **Solado corregido**: ya no sobresale de la cimentación — comparte
    exactamente la misma huella (mismo diámetro en Postes MT, mismo
    ancho×profundo en Luminarias/Cámaras). Antes tenía un margen extra que
    lo hacía ver como un "collar" más ancho.
  - **Cálculo de volúmenes (concreto, excavación, solado)** — nuevo panel
    "Cantidades de obra" en los 4 formularios que ya existen:
    - Postes MT y las secciones rectangulares (Luminarias, Cámaras,
      pedestales de Inversores): concreto = área de la sección × altura
      total; excavación = área × **desplante** (no la altura total, ya que
      solo se excava la parte enterrada); solado = área × su espesor.
    - Inversores es un caso especial: el concreto suma los 2 pedestales
      más la losa, pero la **excavación solo cuenta los pedestales** — la
      losa va sobre el nivel de terreno natural, así que no requiere
      excavación, tal como me confirmaste.
    - Verifiqué las fórmulas con números concretos a mano (fuera del
      código) antes de confiar en la implementación en React.
  - De paso encontré y corregí un comentario que había quedado mal
    ubicado en el código de Cámaras desde una edición anterior (no
    afectaba el funcionamiento, solo la documentación interna).

- **Segunda ronda de correcciones a Inversores**:
  - **Isométrico reorganizado**: ancho y largo de la losa ahora van arriba
    (usando la esquina trasera, la que queda más alta en la proyección),
    altura del pedestal a la derecha, espesor de losa a la izquierda.
    Verifiqué que las 4 cotas ya no se crucen en ningún caso.
  - **Vista posterior corregida**: los estribos ahora quedan centrados en
    la altura (antes se acumulaban hacia abajo); los ganchos de las barras
    vuelven a apuntar hacia el centro (como se doblan de verdad), pero
    ahora con un largo que se ajusta para que nunca se crucen entre sí sin
    importar la separación entre barras. Se agregaron las cotas de ancho y
    altura, paralelas a sus bordes.
  - **Corte transversal**: ahora se ven los 2 ganchos del estribo (antes
    sin querer los dibujaba sobre la misma diagonal, así que se veían como
    uno solo) y se agregaron las cotas de ancho y profundo.
  - **Planta de la losa**: se agregaron las cotas de ancho y largo por
    separado, paralelas a sus bordes (antes solo había un texto combinado
    sin líneas de cota).

- **Correcciones a Inversores** (después de tu primer feedback):
  - **Fórmula de estribos corregida**: ahora es (altura − 2×recubrimiento) /
    separación, tal como la corregiste. Ya no lleva el "+1" que tenía antes.
  - **Dibujos más grandes** en las 4 vistas.
  - **Cotas de la losa reorganizadas** para que nunca se crucen entre sí:
    altura del pedestal y espesor de losa quedaron a la izquierda, ancho y
    largo de la losa a la derecha (antes coincidían en el mismo lado y se
    encimaban cuando la losa era más grande que los pedestales). Verifiqué
    esto con las medidas exactas de tu ejemplo (1.40 × 1.55 m) antes de
    entregarlo.
  - **Elevación del refuerzo repensada**: ahora solo se dibujan
    ⌈N.° de barras / 2⌉ líneas (2 para un arreglo típico de 4 en las
    esquinas, ya que en una vista posterior las barras de adelante y atrás
    caen en la misma posición); se agregaron los ganchos a 90° en los
    extremos (según el N.° de ganchos que hayas puesto); y la cantidad de
    estribos dibujada ahora corresponde exactamente a la calculada, con su
    separación real a escala (antes se limitaba a un máximo arbitrario de
    12 repartidos parejo).
  - **Nueva nomenclatura**: "4#4 LLb" en vez de "4#4 CONTINUAS" — la "L" se
    repite una vez por cada gancho que tenga la barra, seguida de la
    longitud de gancho de ese calibre.
  - **Corte transversal**: se agregó la marca diagonal del gancho del
    estribo, como en tu imagen de referencia.
  - **Alineación de campos**: en "Barras longitudinales" los tres cuadros
    de texto ya quedan en la misma fila — el problema era que una
    etiqueta más larga se partía en dos líneas y desalineaba todo, así que
    la acorté y les di una altura mínima pareja a las tres.

- **Inversores, cuarto tipo de Cimentaciones construido — el más grande
  hasta ahora**: 2 pedestales iguales + 1 losa con malla electrosoldada, con
  despiece de acero completo (barras longitudinales + estribos) y cálculo
  automático de longitudes y pesos.
  - **Parámetros de acero fijos, como definiste**: recubrimiento siempre
    7.5cm; gancho y peso por metro según calibre (#3: 10cm/0.56kg,
    #4: 15cm/0.994kg, #5: 20cm/1.552kg, #6: 25cm/2.235kg). Viven en una
    tabla central (`BARRA_ACERO`) que cualquier cimentación futura puede
    reutilizar sin repetir los números.
  - **Cálculos**: longitud de barra = altura − 2×recubrimiento + (N.° de
    ganchos × gancho del calibre); cantidad de estribos = ⌈altura /
    separación⌉ + 1 (redondeado hacia arriba); longitud de estribo =
    2×(ancho+profundo−4×recubrimiento) + 2×gancho. Con esto se calcula
    peso por barra/estribo, por pedestal, y total de la cimentación
    (multiplicando por 2, ya que los pedestales son iguales).
  - **Dos decisiones que tomé por mi cuenta, avísame si no eran así**:
    (1) agregué un campo "N.° de ganchos por barra" (con 1 como sugerencia)
    porque tu fórmula necesita saber cuántos ganchos tiene cada barra para
    sumarlos, y no lo habías especificado; (2) agregué "Separación entre
    pedestales" como campo nuevo, porque sin ese dato no se puede dibujar
    el conjunto — no estaba en tu lista original pero es necesario para la
    previsualización.
  - **Previsualización**: 4 vistas — isométrico del conjunto (losa + los 2
    pedestales, con cotas), elevación del despiece de un pedestal (barras
    verdes + estribos azules, con las etiquetas típicas tipo
    "4#4 CONTINUAS" / "7 E#3 @0.15"), corte transversal (con las 4 barras
    de esquina y el estribo), y la planta de la losa con la malla. Verifiqué
    cada una por separado antes de entregarte esto.
  - **Tipo de malla**: nueva lista compartida (como proveedores/países),
    empieza con "D84" y cualquiera puede agregar otras. Necesita la
    migración `supabase/migration_mallas.sql`.

- **Corrección urgente — página en blanco**: al duplicar Luminarias para
  crear Cámaras, corté el bloque de código un poco antes de tiempo y
  `CamarasForm` quedó usado pero nunca definido. Esto no lo detecta
  `npm run build` (JavaScript solo revienta con eso al ejecutarse en el
  navegador, no al compilar), por eso pasó sin avisar. Ya está corregido:
  agregué la función que faltaba, y de paso escaneé todo el archivo
  buscando cualquier otro identificador usado pero no definido (no
  apareció ninguno más). También ejecuté el paquete final en un entorno
  simulado de navegador para confirmar que ya no truena al cargar, antes
  de entregarte esto.

- **Cámaras (CCTV), tercer tipo de Cimentaciones construido**: misma
  estructura exacta que Luminarias (ancho, profundo, desplante,
  sobresaliente, espesor de solado, y las 3 vistas técnicas), ya que en
  el esquema de los proyectos las cimentaciones de CCTV también eran de
  sección rectangular. Ya quedan 3 de las 6 — Inversores, Cerramiento y
  Shelter siguen en la fila.
- **Ajuste de las cotas de Luminarias**: el valor de cada cota (ancho y
  profundo) se separó un poco más de su propia línea — antes quedaba casi
  pegado a la línea y era difícil de leer.

- **Luminarias, segundo tipo de Cimentaciones construido**: mismo esquema
  que Postes MT (crear/editar/eliminar plantillas, 3 vistas tipo plano
  técnico), pero con **sección rectangular** (no necesariamente cuadrada):
  campos separados "Ancho" y "Profundo" en vez de un solo "Lado" —
  la nota debajo del formulario avisa que si la sección es cuadrada, hay
  que poner el mismo valor en ambos. La caja isométrica usa la misma
  geometría corregida de los pedestales de proyectos (reescrita en estilo
  de líneas, no de colores), con **una cota independiente por cada borde
  visible de la base** (ancho y profundo por separado, no combinadas en
  una sola etiqueta), y el plano de N.T.N. es un rombo/paralelogramo
  coherente con esa perspectiva (en vez de la elipse de Postes MT). Las
  dos vistas 2D son un rectángulo (longitudinal, con la cota de ancho) y
  otro rectángulo (transversal, ahora con **ambas** cotas — horizontal y
  vertical — para que no se pierda la profundidad cuando no es cuadrada).
  Ya quedan 2 de las 6 cimentaciones construidas — Cámaras, Inversores,
  Cerramiento y Shelter siguen en la fila.
  - Internamente agregué un registro `CIMENTACION_COMPONENTES` que le dice
    a la pantalla de Cimentaciones qué formulario/vista/resumen usar según
    el tipo activo, para no tener que reescribir esa lógica cada vez que
    agreguemos un tipo nuevo — solo hay que sumar una entrada ahí.

- **Nueva sección "Cimentaciones"** (menú lateral): plantillas reutilizables
  de dimensiones/despiece de cimentación, independientes de cualquier
  proyecto. Están las 6 categorías que pediste (Postes MT, Luminarias,
  Cámaras, Inversores, Cerramiento, Shelter), ordenadas de menos a más
  compleja, pero **por ahora solo "Postes MT" tiene formulario real** —
  las otras 5 muestran un aviso de "todavía no está disponible" hasta que
  las construyamos una por una, como pediste.
  - **Postes MT**: diámetro, longitud de desplante, longitud sobresaliente
    (la altura total se calcula sola, igual que en los proyectos), y
    espesor de solado. Ya **no incluye resistencia del concreto** — eso
    pasó a decidirse en cada proyecto, no en la plantilla. Se pueden
    crear, editar y eliminar plantillas libremente — cualquiera del
    equipo con sesión iniciada puede administrarlas (mismo nivel de
    acceso que Instructivos).
  - **Tres vistas tipo plano técnico**: isométrico (con el solado como un
    cilindro igual a la cimentación, y el nivel de terreno natural como un
    plano elíptico coherente con la perspectiva — ambos corregidos tras tu
    primer feedback), más dos vistas 2D nuevas: sección longitudinal (un
    rectángulo, con el terreno como línea recta porque ahí sí es una vista
    plana real) y sección transversal (un círculo). Verifiqué visualmente
    las tres antes de entregarlas, con distintas combinaciones de medidas.
  - **Pendiente para más adelante** (no incluido todavía): usar una
    plantilla directamente desde un proyecto (ej. elegir "Postes MT Tipo
    1" en la pestaña Estructural del proyecto y que precargue esos
    datos). Lo dejamos para cuando quieras retomarlo — probablemente
    tiene más sentido hacerlo cuando ya tengamos más de un tipo
    construido.
  - **Necesita migración**: `supabase/migration_cimentacion_plantillas.sql`.

- **Aviso de conflicto al guardar una pestaña técnica**: al darle "Guardar
  cambios" en una pestaña (Civil, Mecánica, etc.), la app revisa primero
  si alguien más guardó algo en esa misma pestaña de ese mismo proyecto
  mientras tú la tenías abierta. Si detecta que sí, te muestra un aviso
  con dos opciones: guardar tus cambios de todas formas (reemplazando los
  de la otra persona) o ver primero lo que cambió y decidir después. Este
  es el único punto donde antes se podía perder trabajo en silencio
  (editar la misma pestaña del mismo proyecto a la vez); todo lo demás
  (documentos, notas, archivos, equipo, otras pestañas) ya estaba
  protegido desde antes. No necesita ninguna migración — usa las mismas
  tablas y funciones de siempre.

- **Corrección en Equipo — nadie queda invisible**: encontré que las 5
  categorías originales dejaban a algunas personas sin ningún lugar
  donde aparecer (por eso no podías encontrar a alguien nuevo para
  asignarle un rol). Ahora: "Ing. Civiles" también incluye Ing.
  Geotécnico, hay una categoría nueva "Control de Calidad" para ese rol,
  y agregué "Sin rol asignado" (arriba de todo, en naranja) para
  cualquiera que aún no tenga ningún rol — así una persona recién creada
  siempre aparece en algún lado y se le puede asignar su rol desde ahí.

- **Ícono de la app**: generé un set completo de íconos con la "S" de la
  marca sobre fondo lima (`public/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` para Android, `apple-touch-icon.png` para iOS, y
  favicons), más `public/manifest.webmanifest` conectado en `index.html`.
  Con esto, si alguien agrega la página a la pantalla de inicio desde el
  celular (Android o iPhone), el ícono sale con los colores reales de la
  marca en vez del genérico. Si el logo cambia más adelante, solo hay que
  regenerar esos PNG con la nueva "S" — no hace falta tocar código.
- **Porcentajes de la torta, más grandes y centrados**: "APC" y
  "Entregado" ya no van apretados dentro del hueco del donut — ahora
  aparecen en una fila centrada debajo de la torta y la lista de estados,
  con letra más grande y fácil de leer.

- **Optimización para móvil**: el menú lateral ya no se queda fijo
  ocupando la pantalla en celulares — ahora es un panel que se abre con
  el botón de menú (☰) arriba a la izquierda, con fondo oscuro para
  cerrarlo tocando afuera, y se cierra solo al navegar a otra sección. En
  pantallas de escritorio (`md` en adelante) se comporta exactamente
  igual que antes, siempre visible. También reduje el margen de las
  páginas en pantallas chicas y ajusté varios encabezados para que sus
  botones/controles se acomoden en más de una fila en vez de
  desbordarse. No es una reescritura completa para móvil — es la parte
  que hacía la app literalmente inutilizable (el menú tapando todo);
  formularios y tablas grandes puntuales pueden necesitar más ajuste con
  el uso real.
- **Proyecto duplicado**: al crear un proyecto, si el par (N.° de
  minigranja, N.° de predio) ya existe en otro proyecto, aparece una
  alerta con el nombre de ese proyecto y no se puede crear el duplicado.
- **Pestaña "Archivos" eliminada** de cada proyecto (botón, contenido, y
  la sección correspondiente en la hoja de vida imprimible). Si algún
  proyecto ya tenía archivos adjuntos, ese dato queda igual en la base de
  datos, simplemente ya no se muestra en ningún lado.
- **"Dim. cimentación postes" → "Dim. cimentación postes MT"**, ahora
  cilíndrica (como Cerramiento) en vez de rectangular. Si algún proyecto
  ya tenía datos ahí con la forma anterior, hay que volver a digitarlos.
- **Resistencia del concreto**: se agregó "28 MPa" entre 24 y 31 en todos
  los campos que usan ese selector (cimentaciones de Estructural).

- **Bloque 5 de la macro-actualización — cierra la lista** (resumen por
  inversionista): nueva pestaña "Resumen por Inversionista" en el menú.
  Agrupa todos los proyectos por inversionista y para cada uno muestra:
  cuántos proyectos tiene en cada estado (activo/pausa/inactivo/
  finalizado), una torta con el progreso de Control Documental sumando
  **todos** sus proyectos juntos, y una lista desplegable de esos
  proyectos (clic en cualquiera te lleva directo a él). No necesita
  ninguna migración — reutiliza los mismos datos que ya existen.

- **Bloque 4 de la macro-actualización** (Control Documental: acordeón +
  historial de versiones):
  - Cada documento ahora aparece **contraído** de entrada: solo se ve el
    nombre, código, tipo y el estado — igual que pediste. Clic en el
    documento (o en la flecha) despliega Observaciones, Comentarios de
    Control de Calidad y el nuevo historial de entregas.
  - Cuando está contraído, se ven íconos de aviso si ya hay algo cargado:
    un ícono de mensaje si hay observaciones, un check si hay comentario
    de Control de Calidad, y una píldora "N versiones" si ya se registró
    algún historial de entregas — así no hay que abrir cada documento
    para saber si tiene algo pendiente de revisar.
  - **Historial de entregas**: dentro de cada documento se pueden agregar
    tantas "versiones" como hagan falta, cada una con su fecha de entrega
    y, opcionalmente, la fecha en que devolvieron comentarios (para
    proyectos sin interventoría, ese campo simplemente se deja vacío). Se
    guarda como una lista dentro del mismo documento (`versiones: [...]`
    dentro de `documentos[codigo]`), sin necesidad de ninguna tabla ni
    migración nueva en Supabase.
  - La hoja de vida imprimible ahora incluye una columna "Últ. entrega"
    en la tabla de Control Documental, con la versión más reciente y su
    fecha (y la fecha de comentarios recibidos, si la hay).

- **Bloque 3 de la macro-actualización** (rediseño de Equipo):
  - La pestaña "Equipo" ahora agrupa a todos en 5 categorías fijas: Ing.
    Civiles (civil, hidráulico, estructural), Ing. Eléctricos, Delineantes,
    Líderes (los 4 roles de líder, incluido Líder de Diseño) y
    Desarrolladores. Una persona puede aparecer en varias categorías si
    tiene varios roles.
  - Ya no hay un panel desplegable para asignar roles en la propia lista:
    ahora se hace clic en una persona y se abre su **ficha** — ahí se
    editan los roles (con los mismos permisos de siempre), la fecha de
    cumpleaños y la fecha de ingreso (editables por el Líder de Diseño o
    por la propia persona), y se puede eliminar la cuenta.
  - La ficha también muestra los **proyectos asignados** a esa persona,
    cada uno con una mini torta de progreso de Control Documental — clic
    en cualquiera y te lleva directo a ese proyecto.
  - **Necesita migración**: `supabase/migration_perfil_fechas.sql` (agrega
    las columnas de fecha y el permiso para que el Líder de Diseño edite
    cualquier perfil, no solo el propio).
  - Supuse que el cuarto rol de "Líderes" era **Líder de Diseño** (en tu
    lista mencionaste "Líder civil" dos veces); si no era así, se ajusta
    fácilmente en la constante `EQUIPO_CATEGORIAS` de `src/App.jsx`.

- **Bloque 1 de la macro-actualización** (torta, Drive, roles, proveedor,
  General):
  - La torta de Control Documental ahora muestra dos métricas en el
    centro: % de APC (como antes) y % de Entregado, debajo, en violeta.
  - Nuevo botón "Carpeta" en la Hoja de Vida del proyecto: si el proyecto
    tiene un link de Drive guardado, lo abre en pestaña nueva; si no,
    te lleva a la pestaña General para que lo agregues ahí.
  - Nuevos campos en General: "Propietario de predio", "Teléfono de
    propietario" y "Carpeta de Drive (URL)".
  - Se eliminó el rol "Ing. Mecánico" de los roles asignables en Equipo
    (la pestaña técnica "Mecánica" del proyecto sigue intacta — son cosas
    distintas: una es un rol de persona, la otra es una especialidad de
    datos técnicos).
  - Nuevo campo "Proveedor" en Mecánica, con el mismo mecanismo de
    Inversionistas/País (lista compartida en Supabase + "Agregar nuevo
    proveedor…"). Viene con Zentrack, TRINA y Antai por defecto.

- **Edición simultánea (importante, léelo antes de desplegar)**: antes,
  cada guardado reescribía la fila COMPLETA del proyecto con lo que el
  navegador tenía cargado, así que si dos personas guardaban casi al
  mismo tiempo, la segunda borraba en silencio lo que la primera acababa
  de guardar — aunque fueran cosas totalmente distintas (una pestaña
  distinta, un documento distinto, etc.). Ahora cada guardado (editar una
  pestaña técnica, cambiar el estado de un documento, agregar/quitar una
  nota o un archivo, asignar un rol del equipo) usa una función de
  Postgres que modifica **solo esa pieza puntual** directamente en la
  base de datos, sin tocar el resto. Dos personas editando cosas
  distintas del mismo proyecto — o incluso agregando notas/archivos casi
  al mismo tiempo — ya no se pisan los cambios.
  **Límite real que sigue existiendo**: si dos personas editan el
  **mismo campo de la misma pestaña** (ej. ambos escribiendo en "Tipo de
  suelo" de Geotecnia al mismo tiempo), todavía gana quien guarde de
  último — eso ya es un problema de "quién escribe qué carácter, cuándo"
  que requeriría edición colaborativa en tiempo real (como Google Docs),
  una reescritura mucho más grande que no incluí aquí. Para el 99% de los
  casos reales (gente trabajando en pestañas, documentos o notas
  distintas al mismo tiempo) esto ya está resuelto.
  **Para que funcione**, tienes que correr
  `supabase/migration_guardado_parcial.sql` en tu Supabase ya desplegado
  (o usar el `schema.sql` nuevo si vas a crear el proyecto desde cero).
- **Progreso por especialidad**: al lado de la torta general en Control
  Documental, ahora hay una barra de progreso por cada especialidad de la
  lista de documentos activa (4 en Estándar, 5 en CFM, etc.).
- **Observaciones por documento**: cada documento ahora tiene dos campos
  de texto independientes: "Observaciones" (para cualquiera que pueda
  editar el proyecto, ej. por qué sigue en proceso) y "Comentarios de
  Control de Calidad" (como antes, solo para ese rol). No requiere
  migración — es una llave más (`observaciones`) dentro del mismo JSON de
  cada documento.
- **Nuevos campos**: "Postes en (o cerca) del predio" (Sí/No +
  observaciones) en Civil, y "Temperatura del suelo" (texto) en
  Geotecnia.
- **Estado "Finalizado"**: nuevo estado de proyecto (violeta), disponible en
  todos los selectores de estado. Al cambiarlo a "Finalizado" se dispara
  una animación de confeti + 🎉 (CSS puro, sin librerías externas), que se
  oculta sola a los pocos segundos. No aparece en la hoja de vida
  imprimible (es puramente celebratorio en pantalla). No requiere ninguna
  migración en Supabase — es el mismo campo `estado` de siempre, con un
  valor nuevo (`finalizado`).
- **Nuevos estados de documentos**: la lista de Control Documental ahora
  es No aplica, Pendiente (por defecto), En proceso, Revisión interna,
  Entregado, APCC y APC — con colores distintos para cada uno (incluida
  la torta de progreso). Los documentos que ya tenían un estado de la
  lista anterior lo conservan sin problema, ya que "Pendiente", "En
  proceso", "No aplica", "APCC" y "APC" siguen existiendo igual.
- **Rol de Desarrollador con acceso total a contenido**: ya podía asignar
  equipo/estado/eliminar cualquier proyecto; ahora también puede editar
  los campos técnicos, notas y archivos de cualquier proyecto sin
  necesidad de estar en su equipo.
- **Lista Estándar actualizada**: reemplacé por completo `DOCS_ESTANDAR` con
  el nuevo dosier (72 documentos, especialidades Civil/Mecánica/
  Comunicaciones/Eléctrica — ya sin "General"). Los códigos se tomaron
  directamente del archivo que subiste (columna "Código"), reemplazando el
  prefijo de ese proyecto de ejemplo por el placeholder genérico
  `COLXXXXXXPX` que la app sustituye por el código real de cada proyecto.
  CFM y FENOGE no se tocaron.
- **Progreso visual (Control Documental)**: nueva "torta" (dona) arriba de
  la lista de documentos, con el % de documentos en estado "Aprobado para
  construcción (APC)" en el centro y un detalle por estado al lado. Se
  actualiza sola según el filtro de especialidad que tengas activo. Es
  puramente visual — a propósito no aparece en la hoja de vida imprimible,
  tal como pediste.
- **Corrección de color**: de paso noté que "En proceso" y "APCC" habían
  quedado con el mismo tono de lima después del rebranding a Solé (antes
  eran distintos). Le puse a "APCC" el celeste "Nashville" para que se
  distingan bien tanto en las píldoras de estado como en la torta nueva.
- **Cimentaciones con previsualización isométrica** (pestaña Estructural):
  el dibujo ahora es un cubo/cilindro en isométrico (3 caras visibles) para
  distinguir ancho, profundo y alto de un vistazo. Tres formas:
  - **Pedestal** (Shelter, Inversores, Luminarias, CCTV, Postes): Ancho ×
    Profundo.
  - **Pilote** (Cerramiento): Diámetro.
  - **Zapata con pedestal** (Portón): Ancho/Profundo de la zapata (A/B) +
    Ancho/Profundo del pedestal (a/b), como en un plano típico de zapata.
  En los tres casos, lo que se digita es el **Desplante** (profundidad de
  fundación bajo el nivel del terreno) y la **Resistencia del concreto**
  (ya no son campos aparte — se eliminaron `res_conc_*`). Lo que
  **sobresale** sobre el terreno es fijo por tipo de elemento (Shelter
  0.50 m, Luminarias 0.10 m, CCTV y Postes 0.05 m, Portón y Cerramiento
  0 m; Inversores quedó en 0 m porque no me diste ese valor — ajústalo en
  el campo `sobresale` de `dim_ciment_inversores` en el arreglo `SCHEMA`
  de `src/App.jsx` si no es el correcto). El "Alto total" ya no se digita:
  se calcula solo como Desplante + lo que sobresale, y se muestra como
  dato informativo. También moví `Aa` y `Av` al final de la pestaña, junto
  con el resto de campos de texto.
  **Importante:** estos 7 campos (y los 7 `res_conc_*` que se eliminaron)
  cambiaron de forma — si algún proyecto ya tenía algo escrito ahí a mano
  (texto libre o los campos viejos de Alto/Resistencia), no se pierde en
  la base de datos, pero no se va a ver reflejado con la forma nueva y
  hay que volver a digitarlo con los campos actuales. No fue necesario
  ningún cambio en Supabase para esto: sigue siendo el mismo campo JSON de
  siempre, solo cambió su forma por dentro.
- **Código de documentos, formato actualizado**: ahora es
  `COL` + abreviatura de 3 letras del departamento (automática, según el
  departamento elegido en el selector) + `T` (terreno, fija) + número de
  minigranja + `P` + número de predio — ej. `COLBOYT147P1`. Ya no se
  escribe la abreviatura a mano; si necesitas ajustar alguna, está en el
  objeto `DEPARTAMENTO_ABREVIATURA` en `src/App.jsx`.
- **Municipios y departamentos**: la lista completa (33 departamentos,
  ~1110 municipios) viene del paquete `colombia-territorial` (datos
  DIVIPOLA/DANE), convertida a una constante `COLOMBIA` dentro de
  `src/App.jsx` — no depende de ningún servicio externo ni de internet
  para funcionar. Municipio se habilita después de elegir el
  departamento. Si el DANE actualiza algún nombre, se edita ahí mismo.
- **Países**: mismo mecanismo que Inversionistas — empieza solo con
  Colombia (tabla `paises`), y cualquiera puede agregar otro desde el
  selector el día que haya un proyecto fuera del país.
- **Inversionistas**: ahora es una lista que vive en la base de datos
  (tabla `inversionistas`), con un botón "+ Agregar nuevo inversionista…"
  directamente en el selector — lo que agregues queda disponible para
  todo el equipo de inmediato, sin tocar código. Viene con FENOGE, CFM,
  FMO y Bancolombia por defecto.
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
