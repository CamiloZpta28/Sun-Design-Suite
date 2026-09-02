/* ============================================================================
   NOTIFICACIONES — la campanita y la regla de caducidad.
   ----------------------------------------------------------------------------
   Una notificación se marca como leída al abrirla (o todas de un golpe con
   "Marcar todas como leídas"), y desaparece UN DÍA DESPUÉS de leerla —no de
   haberse creado—, para que la bandeja no se vuelva un archivo histórico.

   El borrado ocurre en dos lugares, a propósito:
     · en la base de datos, al entrar a la aplicación (ver App.jsx), que es
       lo que de verdad libera las filas;
     · aquí, filtrando lo que se pinta, por si ese borrado no alcanzó a
       correr o falló — así nadie ve una notificación que ya venció.
   ============================================================================ */

import React, { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { formatoFechaHora } from './formatos.js';

/* Cuánto sobrevive una notificación después de leída. */
export const DIAS_TRAS_LEER = 1;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/* Momento a partir del cual una notificación leída ya se puede borrar: todo
   lo leído ANTES de esta marca está vencido. */
export function fechaDeCorte(ahora = Date.now()) {
  return new Date(ahora - DIAS_TRAS_LEER * MS_POR_DIA).toISOString();
}

/* Sin fecha de lectura no se adivina: una notificación así se sigue viendo.
   Las que ya estaban leídas antes de que existiera `leida_at` reciben su
   fecha en la migración, así que este caso no debería darse. */
export function estaVencida(n, ahora = Date.now()) {
  if (!n || !n.leida || !n.leida_at) return false;
  return n.leida_at < fechaDeCorte(ahora);
}

/* Lo que se pinta: todo menos lo vencido. */
export function notificacionesVigentes(notificaciones, ahora = Date.now()) {
  return (notificaciones || []).filter((n) => !estaVencida(n, ahora));
}

/* --------------------------------------------------------------------------
   Campanita — "sin leer" en rojo (+9 si hay más de 9), clic abre un panel
   con el resumen y navega al lugar en cuestión.
   -------------------------------------------------------------------------- */
export function NotificationBell({ notificaciones, onAbrirNotificacion, onMarcarTodasLeidas, dark }) {
  const [abierto, setAbierto] = useState(false);
  const vigentes = notificacionesVigentes(notificaciones);
  const sinLeer = vigentes.filter((n) => !n.leida).length;
  const textoContador = sinLeer > 9 ? '+9' : String(sinLeer);

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        title="Notificaciones"
        className={`relative p-1.5 rounded-lg shrink-0 ${dark ? 'text-navy-300 hover:text-white hover:bg-navy-800' : 'text-navy-500 hover:text-navy-800 hover:bg-navy-100'}`}
      >
        <Bell className="w-5 h-5" />
        {sinLeer > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
            {textoContador}
          </span>
        )}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 max-h-[26rem] overflow-y-auto bg-white rounded-xl shadow-xl border border-navy-200 z-50">
            <div className="px-4 py-3 border-b border-navy-100 sticky top-0 bg-white flex items-center gap-2">
              <p className="text-xs font-bold uppercase text-navy-500 flex-1">Notificaciones</p>
              {sinLeer > 0 && (
                <button
                  onClick={() => onMarcarTodasLeidas && onMarcarTodasLeidas()}
                  title="Marcar todas como leídas"
                  className="flex items-center gap-1 text-[11px] font-semibold text-navy-600 hover:text-navy-900 hover:bg-navy-50 rounded-md px-1.5 py-1 shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {vigentes.length === 0 ? (
              <p className="px-4 py-8 text-sm text-navy-400 italic text-center">Sin notificaciones todavía.</p>
            ) : (
              <>
                {vigentes.slice(0, 30).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setAbierto(false); onAbrirNotificacion(n); }}
                    className={`w-full text-left px-4 py-3 border-b border-navy-50 hover:bg-navy-50 flex items-start gap-2 ${!n.leida ? 'bg-lime-50' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.leida ? 'bg-lime-500' : 'bg-transparent'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy-700">{n.mensaje}</p>
                      <p className="text-[11px] text-navy-400 mt-0.5">{formatoFechaHora(n.created_at)}</p>
                    </div>
                  </button>
                ))}
                <p className="px-4 py-2 text-[11px] text-navy-400 italic text-center">
                  Las leídas se borran un día después.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
