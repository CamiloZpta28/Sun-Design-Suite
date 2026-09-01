import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /* Las librerías se separan del código de la app: React, Supabase y los
           íconos casi nunca cambian, así que quedan en archivos con su propio
           hash y el navegador los reutiliza de una versión a otra en vez de
           volver a descargar casi un megabyte en cada despliegue. */
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
