/* ============================================================================
   ACCESO — lo que no se ve de la pantalla de ingreso.
   ----------------------------------------------------------------------------
   Traduce los errores de Supabase, revisa las contraseñas nuevas antes de
   guardarlas y lee lo que deja en la dirección el enlace de "recuperar
   contraseña". Nada de esto habla con el servidor: se puede probar solo.
   ============================================================================ */

export const MINIMO_CONTRASENA = 6;

/* Supabase responde en inglés. Primero se mira el código del error, que es
   estable; el texto solo como respaldo, para versiones que no lo mandan. */
const TRADUCCIONES = [
  {
    codigos: ['invalid_credentials'],
    texto: /invalid login credentials/i,
    mensaje: 'Correo o contraseña incorrectos. Si no recuerdas la contraseña, usa «¿Olvidaste tu contraseña?».',
  },
  {
    codigos: ['email_not_confirmed'],
    texto: /email not confirmed/i,
    mensaje: 'Tu correo todavía no está confirmado. Busca el correo de confirmación en tu bandeja de entrada (y en spam).',
  },
  {
    codigos: ['user_already_exists', 'email_exists'],
    texto: /already registered|already exists/i,
    mensaje: 'Ya hay una cuenta con ese correo. Inicia sesión, o recupera la contraseña si no la recuerdas.',
  },
  {
    codigos: ['same_password'],
    texto: /different from the old password/i,
    mensaje: 'La contraseña nueva tiene que ser distinta de la anterior.',
  },
  {
    codigos: ['weak_password'],
    texto: /password should be/i,
    mensaje: `La contraseña es muy débil: mínimo ${MINIMO_CONTRASENA} caracteres.`,
  },
  {
    codigos: ['email_address_invalid'],
    texto: /invalid format|unable to validate email/i,
    mensaje: 'Ese correo no tiene un formato válido.',
  },
  {
    codigos: ['over_email_send_rate_limit', 'over_request_rate_limit'],
    texto: /rate limit|too many requests/i,
    mensaje: 'Se hicieron demasiados intentos en poco tiempo. Espera unos minutos y vuelve a probar.',
  },
  {
    codigos: ['otp_expired'],
    texto: /has expired|is invalid or has expired/i,
    mensaje: 'El enlace venció o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».',
  },
  {
    codigos: [],
    texto: /failed to fetch|networkerror|load failed/i,
    mensaje: 'No hay conexión con el servidor. Revisa tu internet y vuelve a probar.',
  },
];

const LIMITE = TRADUCCIONES.find((t) => t.codigos.includes('over_request_rate_limit')).mensaje;

export function mensajeDeError(err) {
  if (!err) return '';
  const codigo = err.code || err.error_code || '';
  const texto = String(err.message || err.error_description || '');
  const porCodigo = codigo && TRADUCCIONES.find((t) => t.codigos.includes(codigo));
  if (porCodigo) return porCodigo.mensaje;
  if (err.status === 429) return LIMITE;
  const porTexto = texto && TRADUCCIONES.find((t) => t.texto.test(texto));
  if (porTexto) return porTexto.mensaje;
  /* Lo que no se reconoce se muestra igual, con el detalle original: sirve
     para que quien lo vea pueda contarlo tal cual. */
  return texto ? `No se pudo completar. Detalle: ${texto}` : 'Ocurrió un error, intenta de nuevo.';
}

/* Para una contraseña NUEVA (registro o cambio). La de ingreso no se revisa:
   si alguien ya tiene una con espacios, tiene que poder seguir entrando. */
export function problemaDeContrasenaNueva(contrasena, confirmacion) {
  const c = contrasena || '';
  if (c.length < MINIMO_CONTRASENA) return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  /* En el celular es fácil que se cuele un espacio al final y no se ve; luego
     la persona escribe la contraseña "bien" y no le entra. */
  if (c !== c.trim()) return 'La contraseña empieza o termina con un espacio. Quítalo: después no se ve y no te va a dejar entrar.';
  if (c !== (confirmacion || '')) return 'Las dos contraseñas no coinciden.';
  return null;
}

/* El enlace del correo vuelve a la plataforma con los datos en la dirección:
   "#access_token=…&type=recovery" si sirvió, o "#error=…&error_code=…" si
   venció. Hay que leerlo ANTES de crear el cliente de Supabase, que limpia la
   dirección al procesarla. */
export function leerRetornoDeAcceso(hash, search) {
  const params = new URLSearchParams([
    ...new URLSearchParams(String(search || '').replace(/^\?/, '')),
    ...new URLSearchParams(String(hash || '').replace(/^#/, '')),
  ]);
  const error = params.get('error');
  const codigo = params.get('error_code');
  return {
    recuperacion: params.get('type') === 'recovery' && !error,
    error: error || codigo
      ? mensajeDeError({ code: codigo || '', message: params.get('error_description') || error || codigo })
      : null,
  };
}
