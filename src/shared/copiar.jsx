/* ============================================================================
   COPIAR AL PORTAPAPELES
   ----------------------------------------------------------------------------
   Los códigos de documento (COLLAGT173P1-CIV-INF-001) se escriben a mano en
   correos, planos y planillas todo el día. Un clic encima lo copia.
   ============================================================================ */

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/* Devuelve true si de verdad quedó copiado. El camino normal es la API del
   portapapeles; el de respaldo (un textarea invisible y `execCommand`) cubre
   los navegadores viejos y las páginas servidas sin HTTPS, donde esa API no
   existe. */
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/* El código, en un botón que lo copia. El ícono se ve tenue y se aviva al
   pasar el mouse —en el celular no hay "pasar el mouse", por eso nunca se
   esconde del todo—; al copiar cambia a un chulo por un segundo y medio. */
export function CodigoCopiable({ codigo, className = '' }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(e) {
    e.stopPropagation();
    if (!(await copiarTexto(codigo))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Código copiado' : `Copiar ${codigo}`}
      className={`group inline-flex items-center gap-1 font-mono rounded hover:text-navy-600 ${className}`}
    >
      {codigo}
      {copiado
        ? <Check className="w-3 h-3 text-emerald-500 shrink-0" />
        : <Copy className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

export default CodigoCopiable;
