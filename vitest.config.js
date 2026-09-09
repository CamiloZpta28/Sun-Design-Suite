import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /* El mismo plugin que usa la app: sin él, las pruebas que renderizan
     componentes (src/secciones/*.test.jsx) no sabrían leer JSX. */
  plugins: [react()],
  test: {
    /* Por defecto node (las pruebas del motor de notas no necesitan DOM).
       Las que sí renderizan piden jsdom con `// @vitest-environment jsdom`
       en su primera línea. */
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    /* En Windows, arrancar jsdom dentro del pool por defecto ("forks") tarda
       tanto que vitest da por muerto al worker antes de que termine. Con
       hilos arranca bien. */
    pool: 'threads',
    /* Los 5 s por defecto se quedaban cortos. Control Documental se prueba con
       un dossier completo —84 documentos— y cada clic en un filtro repinta las
       84 tarjetas; en jsdom eso puede pasar de 6 s en una máquina cargada. Las
       pruebas fallaban de vez en cuando por tiempo, no por estar mal, que es
       la peor clase de falla: la que enseña a desconfiar de la suite. */
    testTimeout: 30000,
  },
});
