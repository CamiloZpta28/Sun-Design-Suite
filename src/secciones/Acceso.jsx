/* ============================================================================
   ACCESO — ingresar, crear cuenta, recuperar y elegir contraseña nueva.
   ----------------------------------------------------------------------------
   Vivía dentro de App.jsx sin forma de recuperar una contraseña: quien la
   olvidaba (o la había guardado con un error de tecleo al registrarse, porque
   se pedía una sola vez) quedaba bloqueado y solo se desbloqueaba desde el
   panel de Supabase. Ahora:
     - "¿Olvidaste tu contraseña?" manda un enlace al correo;
     - ese enlace abre NuevaContrasena, donde se elige una nueva;
     - al registrarse la contraseña se escribe dos veces;
     - el ojo deja ver lo que se escribe, que en el celular es lo que más
       ayuda;
     - los errores salen en español (ver shared/acceso.js).
   ============================================================================ */

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { mensajeDeError, problemaDeContrasenaNueva, MINIMO_CONTRASENA } from '../shared/acceso.js';
import logoMark from '../assets/logo-s-mark.png';

const ETIQUETA = 'block text-xs font-semibold uppercase text-navy-500 mb-1';
const CAMPO = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm';

/* Los teclados del celular capitalizan y corrigen por su cuenta: en un correo
   o una contraseña eso solo estorba. */
const SIN_AYUDAS_DE_TECLADO = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false };

function Marco({ subtitulo, children }) {
  return (
    <div className="fixed inset-0 bg-navy-900 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-lg bg-lime-300 flex items-center justify-center shrink-0">
            <img src={logoMark} alt="" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="font-bold text-navy-800 leading-tight">Sun Design Suite</p>
            <p className="text-xs text-navy-500">{subtitulo}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Mensajes({ error, info }) {
  return (
    <>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      {info && <p role="status" className="text-xs text-emerald-600">{info}</p>}
    </>
  );
}

function BotonPrincipal({ cargando, children }) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-600 disabled:opacity-60 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
    >
      {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function CampoCorreo({ value, onChange }) {
  return (
    <div>
      <label htmlFor="acceso-correo" className={ETIQUETA}>Correo</label>
      <input
        id="acceso-correo"
        required
        type="email"
        inputMode="email"
        autoComplete="email"
        {...SIN_AYUDAS_DE_TECLADO}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={CAMPO}
        placeholder="tu@empresa.com"
      />
    </div>
  );
}

/* Contraseña con ojo para mostrarla. Cada campo tiene el suyo: ver la
   primera no destapa la confirmación de al lado. */
export function CampoContrasena({ id, etiqueta, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          required
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          {...SIN_AYUDAS_DE_TECLADO}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${CAMPO} pr-10`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-navy-400 hover:text-navy-700"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

const SUBTITULOS = {
  login: 'Inicia sesión',
  signup: 'Crea tu cuenta',
  recuperar: 'Recupera tu contraseña',
};

export function AuthGate({ avisoInicial = null }) {
  const [modo, setModo] = useState('login');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState(avisoInicial || '');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);

  /* El correo se conserva al cambiar de modo: quien no pudo entrar y pasa a
     recuperar no tiene que volver a escribirlo. */
  function cambiarA(nuevo) {
    setModo(nuevo);
    setError('');
    setInfo('');
    setContrasena('');
    setConfirmacion('');
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    const email = correo.trim();

    if (modo === 'signup') {
      const problema = problemaDeContrasenaNueva(contrasena, confirmacion);
      if (problema) { setError(problema); return; }
    }

    setCargando(true);
    try {
      if (modo === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password: contrasena });
        if (err) throw err;
        cambiarA('login');
        setInfo('Cuenta creada. Si te llega un correo de confirmación, ábrelo primero y luego inicia sesión.');
      } else if (modo === 'recuperar') {
        /* Supabase responde igual exista o no la cuenta —así nadie puede
           averiguar qué correos están registrados—, y el mensaje lo respeta. */
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (err) throw err;
        setInfo(`Si hay una cuenta con ${email}, te llegó un correo con un enlace para elegir una contraseña nueva. Revisa también spam. El enlace sirve una sola vez.`);
      } else {
        /* La contraseña va tal cual, sin recortar: si alguien la guardó con un
           espacio, tiene que poder seguir entrando con ella. */
        const { error: err } = await supabase.auth.signInWithPassword({ email, password: contrasena });
        if (err) throw err;
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco subtitulo={SUBTITULOS[modo]}>
      <form onSubmit={enviar} className="space-y-4">
        {modo === 'recuperar' && (
          <p className="text-xs text-navy-500">
            Escribe el correo con el que entras a la plataforma y te mandamos un enlace para elegir una contraseña nueva.
          </p>
        )}

        <CampoCorreo value={correo} onChange={setCorreo} />

        {modo !== 'recuperar' && (
          <CampoContrasena
            id="acceso-contrasena"
            etiqueta="Contraseña"
            value={contrasena}
            onChange={setContrasena}
            autoComplete={modo === 'signup' ? 'new-password' : 'current-password'}
            placeholder={modo === 'signup' ? `Mínimo ${MINIMO_CONTRASENA} caracteres` : ''}
          />
        )}

        {modo === 'signup' && (
          <CampoContrasena
            id="acceso-confirmacion"
            etiqueta="Repite la contraseña"
            value={confirmacion}
            onChange={setConfirmacion}
            autoComplete="new-password"
          />
        )}

        {modo === 'login' && (
          <div className="-mt-2 text-right">
            <button type="button" onClick={() => cambiarA('recuperar')} className="text-xs font-medium text-lime-700 hover:text-lime-800">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        <Mensajes error={error} info={info} />

        <BotonPrincipal cargando={cargando}>
          {modo === 'login' && 'Iniciar sesión'}
          {modo === 'signup' && 'Crear cuenta'}
          {modo === 'recuperar' && 'Enviarme el enlace'}
        </BotonPrincipal>

        <button
          type="button"
          onClick={() => cambiarA(modo === 'login' ? 'signup' : 'login')}
          className="w-full text-xs text-navy-500 hover:text-navy-700"
        >
          {modo === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </Marco>
  );
}

/* Se muestra cuando la persona vuelve del enlace de recuperación: Supabase
   ya le abrió la sesión, pero todavía no tiene una contraseña que conozca.
   Hasta que la elija, no se entra a la plataforma — si no, la próxima vez que
   se le cierre la sesión quedaría bloqueada otra vez. */
export function NuevaContrasena({ correo, onListo }) {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [lista, setLista] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    const problema = problemaDeContrasenaNueva(contrasena, confirmacion);
    if (problema) { setError(problema); return; }
    setCargando(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: contrasena });
      if (err) throw err;
      setLista(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (lista) {
    return (
      <Marco subtitulo="Contraseña actualizada">
        <div className="space-y-4">
          <p role="status" className="text-sm text-navy-700">
            Listo, tu contraseña quedó cambiada. La próxima vez entra con ella.
          </p>
          <button
            type="button"
            onClick={onListo}
            className="w-full bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-colors"
          >
            Entrar a la plataforma
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco subtitulo="Elige una contraseña nueva">
      <form onSubmit={enviar} className="space-y-4">
        {correo && (
          <p className="text-xs text-navy-500">
            Para la cuenta <strong className="text-navy-700">{correo}</strong>.
          </p>
        )}
        <CampoContrasena
          id="nueva-contrasena"
          etiqueta="Contraseña nueva"
          value={contrasena}
          onChange={setContrasena}
          autoComplete="new-password"
          placeholder={`Mínimo ${MINIMO_CONTRASENA} caracteres`}
        />
        <CampoContrasena
          id="nueva-confirmacion"
          etiqueta="Repite la contraseña"
          value={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
        />
        <Mensajes error={error} />
        <BotonPrincipal cargando={cargando}>Guardar contraseña</BotonPrincipal>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full text-xs text-navy-500 hover:text-navy-700"
        >
          Cancelar y salir
        </button>
      </form>
    </Marco>
  );
}
