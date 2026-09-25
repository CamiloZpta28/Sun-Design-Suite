/* ============================================================================
   ACCESO — errores en español, contraseñas nuevas y el enlace de recuperación.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import { mensajeDeError, problemaDeContrasenaNueva, leerRetornoDeAcceso, MINIMO_CONTRASENA } from './acceso.js';

describe('los errores de Supabase salen en español', () => {
  it('credenciales inválidas, por código y por texto', () => {
    const esperado = /Correo o contraseña incorrectos/;
    expect(mensajeDeError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(esperado);
    expect(mensajeDeError({ message: 'Invalid login credentials' })).toMatch(esperado);
  });

  /* Cuando alguien no puede entrar, el mensaje le tiene que decir por dónde
     salir: la recuperación de contraseña. */
  it('el de credenciales señala la salida', () => {
    expect(mensajeDeError({ code: 'invalid_credentials' })).toMatch(/Olvidaste tu contraseña/);
  });

  it('los demás casos conocidos', () => {
    expect(mensajeDeError({ code: 'email_not_confirmed' })).toMatch(/no está confirmado/);
    expect(mensajeDeError({ message: 'User already registered' })).toMatch(/Ya hay una cuenta/);
    expect(mensajeDeError({ code: 'same_password' })).toMatch(/distinta de la anterior/);
    expect(mensajeDeError({ status: 429, message: 'x' })).toMatch(/demasiados intentos/);
    expect(mensajeDeError({ code: 'over_email_send_rate_limit' })).toMatch(/demasiados intentos/);
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/);
    expect(mensajeDeError({ code: 'otp_expired' })).toMatch(/venció/);
  });

  /* El código manda sobre el texto: si Supabase cambia la redacción, la
     traducción no se cae. */
  it('el código manda sobre el texto', () => {
    expect(mensajeDeError({ code: 'email_not_confirmed', message: 'Invalid login credentials' })).toMatch(/no está confirmado/);
  });

  it('lo desconocido se muestra con su detalle, no se esconde', () => {
    expect(mensajeDeError({ message: 'Database exploded' })).toBe('No se pudo completar. Detalle: Database exploded');
    expect(mensajeDeError({})).toBe('Ocurrió un error, intenta de nuevo.');
    expect(mensajeDeError(null)).toBe('');
  });

  it('ningún mensaje conocido queda en inglés', () => {
    ['invalid_credentials', 'email_not_confirmed', 'user_already_exists', 'weak_password', 'otp_expired']
      .forEach((code) => expect(mensajeDeError({ code, message: 'Invalid login credentials' })).not.toMatch(/invalid|login|credentials/i));
  });
});

describe('una contraseña nueva', () => {
  it('bien escrita y confirmada, pasa', () => {
    expect(problemaDeContrasenaNueva('Solenium2026', 'Solenium2026')).toBe(null);
  });

  it(`con menos de ${MINIMO_CONTRASENA} caracteres, no`, () => {
    expect(problemaDeContrasenaNueva('abc', 'abc')).toMatch(/al menos 6/);
    expect(problemaDeContrasenaNueva('', '')).toMatch(/al menos 6/);
  });

  /* El caso por el que existe la confirmación: un typo al crearla quedaba
     guardado, y después la persona escribía "bien" una que nunca fue la suya. */
  it('si las dos no coinciden, no', () => {
    expect(problemaDeContrasenaNueva('Solenium2026', 'Solenium2025')).toMatch(/no coinciden/);
    expect(problemaDeContrasenaNueva('Solenium2026', undefined)).toMatch(/no coinciden/);
  });

  it('con un espacio al principio o al final, no', () => {
    expect(problemaDeContrasenaNueva('Solenium2026 ', 'Solenium2026 ')).toMatch(/espacio/);
    expect(problemaDeContrasenaNueva(' Solenium2026', ' Solenium2026')).toMatch(/espacio/);
  });

  it('un espacio en medio sí se permite', () => {
    expect(problemaDeContrasenaNueva('sol de mayo', 'sol de mayo')).toBe(null);
  });
});

describe('volver del enlace del correo', () => {
  it('reconoce el enlace de recuperación', () => {
    const r = leerRetornoDeAcceso('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery', '');
    expect(r).toEqual({ recuperacion: true, error: null });
  });

  it('un ingreso normal o un enlace de confirmación no es recuperación', () => {
    expect(leerRetornoDeAcceso('', '')).toEqual({ recuperacion: false, error: null });
    expect(leerRetornoDeAcceso('#access_token=abc&type=signup', '').recuperacion).toBe(false);
    expect(leerRetornoDeAcceso('#/proyectos', '').recuperacion).toBe(false);
  });

  /* Supabase manda el error así cuando el enlace venció o ya se abrió. */
  it('el enlace vencido trae su explicación en español', () => {
    const r = leerRetornoDeAcceso('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '');
    expect(r.recuperacion).toBe(false);
    expect(r.error).toMatch(/venció o ya se usó/);
  });

  it('también lee el error cuando viene en la consulta', () => {
    expect(leerRetornoDeAcceso('', '?error=access_denied&error_code=otp_expired').error).toMatch(/venció/);
  });

  it('sin dirección no revienta', () => {
    expect(leerRetornoDeAcceso(undefined, undefined)).toEqual({ recuperacion: false, error: null });
  });
});
