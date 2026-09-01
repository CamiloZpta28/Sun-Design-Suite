/* ============================================================================
   PIEZAS DE INTERFAZ COMPARTIDAS
   ----------------------------------------------------------------------------
   Componentes chicos que usan tanto App.jsx como varias de las secciones que
   se descargan aparte (Cimentaciones, Equipos, Canalizaciones, Cruces). Al
   vivir aquí, ninguna sección tiene que importar a otra —y arrastrarla al
   paquete inicial— solo para pintar un resumen.
   ============================================================================ */

import React from 'react';

/* Muestra las líneas de un "resumen" (ver arriba), poniendo en negrita la    */
/* parte antes de ":" — reutilizable en la tarjeta de Cimentaciones, en el    */
/* selector de plantillas dentro de un proyecto, y en el resumen imprimible. */
export function ResumenLineas({ lineas, size = 'text-xs', align = 'left' }) {
  if (!lineas || lineas.length === 0) return null;
  return (
    <div className={`${size} text-navy-500 space-y-0.5 ${align === 'center' ? 'text-center' : ''}`}>
      {lineas.map((linea, i) => {
        const idx = linea.indexOf(':');
        if (idx === -1) return <p key={i}>{linea}</p>;
        return (
          <p key={i}>
            <span className="font-semibold text-navy-600">{linea.slice(0, idx + 1)}</span>
            {linea.slice(idx + 1)}
          </p>
        );
      })}
    </div>
  );
}

/* Líneas "Atributo: valor" de una plantilla de equipo eléctrico — solo los   */
/* que sí se llenaron (los que quedan en blanco no aportan nada al resumen). */
export function atributosLineas(datos) {
  const atributos = datos?.atributos || {};
  return Object.entries(atributos)
    .filter(([, v]) => v && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`);
}

export function initialsOf(nombre) {
  return (nombre || '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function Avatar({ name, foto, title, size = 'md' }) {
  if (!name) return null;
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-28 h-28 text-3xl' : 'w-9 h-9 text-sm';
  if (foto) {
    return <img src={foto} alt={name} title={title ? `${title}: ${name}` : name} className={`${sizeClass} rounded-full object-cover border-2 border-white shrink-0`} />;
  }
  return (
    <div title={title ? `${title}: ${name}` : name} className={`${sizeClass} rounded-full bg-navy-700 text-white flex items-center justify-center font-bold border-2 border-white shrink-0`}>
      {initialsOf(name)}
    </div>
  );
}
