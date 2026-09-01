/* ============================================================================
   AddableSelect — desplegable con "+ Agregar nuevo…"
   ----------------------------------------------------------------------------
   Base de todos los selectores de listas compartidas (inversionistas, países,
   proveedores, diámetros de tubería, mallas…). Vive aquí porque lo usan tanto
   App.jsx como secciones que se descargan aparte.
   ============================================================================ */

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

export function AddableSelect({ value, opciones, onChange, onAddNew, placeholderNuevo, etiquetaAgregar }) {
  const [showAdd, setShowAdd] = useState(false);
  const [nuevo, setNuevo] = useState('');

  function confirmarNuevo() {
    const nombre = nuevo.trim();
    if (!nombre) {
      setShowAdd(false);
      return;
    }
    onAddNew(nombre);
    onChange(nombre);
    setNuevo('');
    setShowAdd(false);
  }

  const baseInput = 'w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  if (showAdd) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmarNuevo();
            }
            if (e.key === 'Escape') setShowAdd(false);
          }}
          placeholder={placeholderNuevo}
          className={baseInput}
        />
        <button type="button" onClick={confirmarNuevo} title="Guardar" className="text-emerald-600 hover:text-emerald-700 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setShowAdd(false)} title="Cancelar" className="text-navy-400 hover:text-navy-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const registrado = !value || opciones.includes(value);
  return (
    <select
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === '__nuevo__') {
          setShowAdd(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={baseInput}
    >
      <option value="">Sin definir</option>
      {opciones.map((op) => (
        <option key={op} value={op}>{op}</option>
      ))}
      {!registrado && <option value={value}>{value} (no registrado)</option>}
      <option value="__nuevo__">{etiquetaAgregar}</option>
    </select>
  );
}
export default AddableSelect;
