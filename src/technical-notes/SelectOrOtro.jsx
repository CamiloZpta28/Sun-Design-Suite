import React, { useState } from 'react';
import { X } from 'lucide-react';
import { isBlank } from './formatters.js';

/* ============================================================================
   Selector genérico "valor típico + Otro": select con `opciones` fijas y, si
   el valor actual no está en esa lista (o el usuario pulsa "Otro…"), un input
   libre para escribir cualquier especificación.

   Un solo campo persistido — nunca dos (no hay un "_otro" aparte): lo que se
   guarda es siempre el valor final, venga de la lista o del input. Al cargar
   un proyecto cuyo valor no está en las opciones, el componente entra solo en
   modo "Otro" mostrando ese valor, así que un dato antiguo nunca se pierde ni
   se sustituye por el default.

   Si `defaultValue` está definido y el campo está vacío, se muestra
   preseleccionado como sugerencia — pero eso es solo presentación: no se
   escribe nada hasta que el usuario elige o escribe algo.
   ============================================================================ */
export default function SelectOrOtro({ value, opciones, defaultValue, onChange, className, placeholder, allowOther = true }) {
  const [showOtro, setShowOtro] = useState(false);
  const esConocida = isBlank(value) || opciones.includes(value);

  if (allowOther && (showOtro || (!esConocida && !isBlank(value)))) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <select
            value="__otro__"
            onChange={(e) => { if (e.target.value !== '__otro__') { setShowOtro(false); onChange(e.target.value); } }}
            className={className}
          >
            {opciones.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
            <option value="__otro__">Otro…</option>
          </select>
          <button
            type="button"
            onClick={() => { setShowOtro(false); onChange(''); }}
            title="Descartar el valor personalizado"
            className="text-navy-400 hover:text-navy-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs text-navy-500 mt-1.5 mb-1">Especificar otro valor</label>
        <input
          autoFocus={showOtro}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Especificar…'}
          className={className}
        />
      </div>
    );
  }

  const seleccionado = isBlank(value) && !isBlank(defaultValue) ? defaultValue : (value || '');
  return (
    <select
      value={seleccionado}
      onChange={(e) => {
        if (e.target.value === '__otro__') {
          setShowOtro(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={className}
    >
      {isBlank(defaultValue) && <option value="">Sin definir</option>}
      {opciones.map((op) => (
        <option key={op} value={op}>{op}</option>
      ))}
      {allowOther && <option value="__otro__">Otro…</option>}
    </select>
  );
}
