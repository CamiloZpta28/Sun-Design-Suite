# Sun Design Suite

Gestión y hoja de vida de minigranjas fotovoltaicas para el equipo de diseño
de Solenium. React + Vite + Tailwind, con Supabase (autenticación, Postgres y
almacenamiento) como toda la trastienda. Se publica en Vercel.

Este proyecto **no tiene nada que ver con Expo ni con React Native**, por si
llegas desde otra sesión con esas instrucciones cargadas.

## Cómo se trabaja aquí

- **Todo va en español**: la interfaz, los mensajes de error, los nombres de
  las cosas y —sobre todo— los comentarios. No es cosmético: el código lo lee
  gente de ingeniería civil y eléctrica, no solo programadores.
- **Los comentarios explican el porqué, no el qué.** El repositorio está
  escrito así de punta a punta; si escribes uno que solo repite lo que hace la
  línea siguiente, sobra.
- **El README es la bitácora.** Cada cambio con cara de funcionalidad suma una
  entrada al principio de "Notas y siguientes pasos", con qué cambió, qué
  decisión se tomó y si necesita migración. Léelo antes de proponer nada: casi
  siempre explica por qué algo está como está.
- **Los mensajes de commit son largos y en español**, y cuentan el problema
  antes que la solución. Mira `git log` para el tono.
- **No hagas push.** Se commitea cuando el usuario lo pide, y él sube y
  despliega desde su lado. No hay ambiente de pruebas: lo que se sube sale a
  producción, y eso pesa en cada decisión.

## Comandos

```bash
npm run dev     # servidor local
npm test        # las pruebas (vitest run)
npm run build   # build de producción; conviene correrlo antes de commitear
```

Necesita un `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver
`.env.example`).

## Las pruebas

Son **pruebas de render de verdad**, no de humo: montan cada sección con
`@testing-library/react` sobre jsdom, con un proyecto lleno y con uno vacío
—el caso de los proyectos viejos, a los que les faltan campos que se
agregaron después—. Ese es el escenario que históricamente dejaba la pantalla
en blanco, y es el que más fallos ha atrapado (`SelectOrOtro is not defined`,
`logoMark is not defined`: importes perdidos al mover código, invisibles para
cualquier análisis estático).

- Un archivo que renderiza JSX se llama `.test.jsx` y abre con
  `// @vitest-environment jsdom` en la primera línea. Sin eso no hay DOM.
- Supabase se sustituye siempre por un doble; ninguna prueba abre conexión.
- Cuando escribas una prueba nueva, **compruébala inyectando el fallo a
  propósito** en el código y confirmando que falla. Una prueba que pasa
  siempre no vale nada, y aquí ya pasó: un `expect` que parecía verificar el
  anidamiento de botones se cumplía solo.
- **No ancles una prueba a una fecha fija** si el código usa `Date.now()`:
  pasa hoy y falla la semana entrante. Ya ocurrió con las notificaciones.

## Cómo está armado

- `src/App.jsx` — el armazón: estado global, sesión, rutas y los manejadores
  que guardan. **No es donde se escriben funcionalidades**; las secciones
  pesadas viven aparte y se descargan solas con `React.lazy`.
- `src/secciones/` — una pantalla por archivo, cada una con su `.test.jsx`.
- `src/shared/` — lo que comparten. `dominio.jsx` es el corazón: ahí está
  `SCHEMA`, el arreglo que declara los campos técnicos por especialidad. La
  interfaz se genera desde ahí, así que **agregar un campo es tocar `SCHEMA`,
  no la interfaz**.
- `src/technical-notes/` — el subsistema de notas técnicas (catálogo, motor y
  panel), con sus propias pruebas en `tests/`.
- `src/routes.js` — cada sección tiene URL propia (`/cimentaciones`, …). La
  navegación es `history.pushState` a mano, sin router.

## Supabase

- `supabase/schema.sql` es el estado completo; los `migration_*.sql` son los
  parches para bases que ya existían. **Las dos cosas se actualizan juntas.**
- Guardar un proyecto no reescribe la fila entera: hay funciones de guardado
  parcial (`merge_project_data_section`, `merge_project_documento`,
  `append_project_nota`…) para que dos personas trabajando a la vez no se
  pisen. Úsalas.
- Correr una migración es cosa del usuario, en el editor SQL de Supabase. Si
  escribes una, transcríbesela en el chat y di qué pasa si no la corre —la
  respuesta correcta casi siempre es "nada se rompe, la función nueva no
  aparece".
- Hay trabajo en vivo con Realtime: presencia (quién tiene abierto un
  proyecto) y aviso de cambios ajenos. Eso no se puede probar solo; requiere
  dos sesiones reales.

## Lo que no se puede verificar desde aquí

Vale la pena decirlo en voz alta cuando entregues algo: no hay forma de
probar dos personas usando la plataforma a la vez, ni de ver la pantalla
real. Los fallos de maquetación (nombres que se parten palabra por palabra,
diálogos que se desbordan) han salido siempre en el navegador del usuario,
nunca en las pruebas.
