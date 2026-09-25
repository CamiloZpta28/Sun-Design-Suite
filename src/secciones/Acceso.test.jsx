// @vitest-environment jsdom
/* ============================================================================
   ACCESO — que nadie vuelva a quedar bloqueado por una contraseña.
   ----------------------------------------------------------------------------
   Se prueba contra un Supabase simulado: lo que importa es QUÉ se le pide y
   con qué datos, y qué ve la persona cuando algo sale mal.
   ============================================================================ */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../supabaseClient', () => ({
  supabase: { auth },
  retornoDeAcceso: { recuperacion: false, error: null },
}));

import { AuthGate, NuevaContrasena } from './Acceso.jsx';

const sinError = { data: {}, error: null };

beforeEach(() => {
  Object.values(auth).forEach((f) => f.mockReset().mockResolvedValue(sinError));
});
afterEach(cleanup);

const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const enviar = (texto) => fireEvent.click(screen.getByRole('button', { name: texto }));

describe('iniciar sesión', () => {
  it('manda el correo recortado y la contraseña tal cual', async () => {
    render(<AuthGate />);
    escribir('Correo', '  miguelm@solenium.co ');
    escribir('Contraseña', ' clave con espacio ');
    enviar('Iniciar sesión');
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'miguelm@solenium.co', password: ' clave con espacio ',
    }));
  });

  /* Lo que vio Miguel en el celular: el mensaje de Supabase en inglés, sin
     ninguna salida. */
  it('el error sale en español y señala la recuperación', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    render(<AuthGate />);
    escribir('Correo', 'miguelm@solenium.co');
    escribir('Contraseña', 'loquesea');
    enviar('Iniciar sesión');
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/Correo o contraseña incorrectos/);
    expect(alerta.textContent).not.toMatch(/Invalid login credentials/);
  });

  it('muestra el aviso con el que llega, por ejemplo un enlace vencido', () => {
    render(<AuthGate avisoInicial="El enlace venció o ya se usó." />);
    expect(screen.getByRole('alert').textContent).toBe('El enlace venció o ya se usó.');
  });
});

describe('¿olvidaste tu contraseña?', () => {
  it('pide el enlace para el correo ya escrito, con vuelta a la plataforma', async () => {
    render(<AuthGate />);
    escribir('Correo', 'miguelm@solenium.co');
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    /* El correo no se pierde al cambiar de pantalla. */
    expect(screen.getByLabelText('Correo').value).toBe('miguelm@solenium.co');
    expect(screen.queryByLabelText('Contraseña')).toBe(null);

    enviar('Enviarme el enlace');
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'miguelm@solenium.co', { redirectTo: window.location.origin },
    ));
    expect((await screen.findByRole('status')).textContent).toMatch(/te llegó un correo con un enlace/);
  });

  it('se puede volver al ingreso', () => {
    render(<AuthGate />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión' }));
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
  });
});

describe('crear cuenta', () => {
  const abrirRegistro = () => {
    render(<AuthGate />);
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Crear una' }));
  };

  /* La causa probable del bloqueo: un typo al registrarse quedaba guardado
     porque la contraseña se pedía una sola vez. */
  it('si las contraseñas no coinciden, no se crea nada', async () => {
    abrirRegistro();
    escribir('Correo', 'nuevo@solenium.co');
    escribir('Contraseña', 'Solenium2026');
    escribir('Repite la contraseña', 'Solenium2O26');
    enviar('Crear cuenta');
    expect((await screen.findByRole('alert')).textContent).toMatch(/no coinciden/);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('si coinciden, se crea', async () => {
    abrirRegistro();
    escribir('Correo', 'nuevo@solenium.co');
    escribir('Contraseña', 'Solenium2026');
    escribir('Repite la contraseña', 'Solenium2026');
    enviar('Crear cuenta');
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({ email: 'nuevo@solenium.co', password: 'Solenium2026' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Cuenta creada/);
  });
});

describe('el ojo', () => {
  it('muestra y oculta la contraseña', () => {
    render(<AuthGate />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo.type).toBe('password');
  });

  /* Destapar una no destapa la otra: cada campo tiene su propio ojo. */
  it('cada campo tiene el suyo', () => {
    render(<AuthGate />);
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Crear una' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]);
    expect(screen.getByLabelText('Contraseña').type).toBe('text');
    expect(screen.getByLabelText('Repite la contraseña').type).toBe('password');
  });

  it('el teclado del celular no capitaliza ni corrige', () => {
    render(<AuthGate />);
    ['Correo', 'Contraseña'].forEach((etiqueta) => {
      const campo = screen.getByLabelText(etiqueta);
      expect(campo.getAttribute('autocapitalize')).toBe('none');
      expect(campo.getAttribute('autocorrect')).toBe('off');
    });
  });
});

describe('elegir la contraseña nueva', () => {
  it('si no coinciden, no se guarda', async () => {
    render(<NuevaContrasena correo="miguelm@solenium.co" onListo={() => {}} />);
    escribir('Contraseña nueva', 'Solenium2026');
    escribir('Repite la contraseña', 'otra-cosa');
    enviar('Guardar contraseña');
    expect((await screen.findByRole('alert')).textContent).toMatch(/no coinciden/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('si coinciden, se guarda y deja entrar', async () => {
    const onListo = vi.fn();
    render(<NuevaContrasena correo="miguelm@solenium.co" onListo={onListo} />);
    expect(screen.getByText('miguelm@solenium.co')).toBeTruthy();
    escribir('Contraseña nueva', 'Solenium2026');
    escribir('Repite la contraseña', 'Solenium2026');
    enviar('Guardar contraseña');
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Solenium2026' }));

    /* No entra de una: primero se le confirma que quedó guardada. */
    expect(onListo).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar a la plataforma' }));
    expect(onListo).toHaveBeenCalledTimes(1);
  });

  it('un error del servidor sale en español y no deja pasar', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password', message: 'New password should be different from the old password.' } });
    const onListo = vi.fn();
    render(<NuevaContrasena correo="a@b.co" onListo={onListo} />);
    escribir('Contraseña nueva', 'Solenium2026');
    escribir('Repite la contraseña', 'Solenium2026');
    enviar('Guardar contraseña');
    expect((await screen.findByRole('alert')).textContent).toMatch(/distinta de la anterior/);
    expect(screen.queryByRole('button', { name: 'Entrar a la plataforma' })).toBe(null);
  });

  it('cancelar cierra la sesión', () => {
    render(<NuevaContrasena correo="a@b.co" onListo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar y salir' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});

/* Las piezas están bien por separado; esto revisa que App.jsx las conecte.
   Sin estas líneas el enlace del correo abriría la plataforma directamente,
   sin pedir contraseña nueva, y la persona seguiría sin saber la suya. */
describe('App.jsx conecta la recuperación', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../App.jsx'), 'utf8');

  it('oye el aviso de recuperación de Supabase y lo cancela al salir', () => {
    expect(app).toMatch(/evento === 'PASSWORD_RECOVERY'\) setRecuperando\(true\)/);
    expect(app).toMatch(/evento === 'SIGNED_OUT'\) setRecuperando\(false\)/);
  });

  it('pide la contraseña nueva antes de dejar entrar', () => {
    expect(app).toMatch(/if \(recuperando\) return <NuevaContrasena/);
  });

  /* El token del enlace viene después del "#": si la app lo borra al arrancar,
     Supabase puede no alcanzar a leerlo. */
  it('no borra el "#" de la dirección al arrancar', () => {
    expect(app).toMatch(/replaceState\(rutaInicial, '', rutaDe\(rutaInicial\) \+ window\.location\.hash\)/);
  });
});
