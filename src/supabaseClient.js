import { createClient } from '@supabase/supabase-js';
import { leerRetornoDeAcceso } from './shared/acceso.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env y completa los valores de tu proyecto de Supabase.'
  );
}

/* Se lee ANTES de crear el cliente: al arrancar, Supabase procesa el enlace
   del correo y limpia la dirección, y con ella se iría la única pista de que
   la persona viene a elegir una contraseña nueva (o de que el enlace venció). */
export const retornoDeAcceso = typeof window === 'undefined'
  ? { recuperacion: false, error: null }
  : leerRetornoDeAcceso(window.location.hash, window.location.search);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
