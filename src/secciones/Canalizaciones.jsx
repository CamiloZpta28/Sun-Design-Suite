/* ============================================================================
   CANALIZACIONES Y CRUCES — dibujos, formularios y vistas
   ----------------------------------------------------------------------------
   Movido literal desde App.jsx. Las dos secciones comparten archivo (y por
   tanto descarga) a propósito: un cruce se dibuja combinando las mismas
   plantillas de canalización, así que separarlas obligaría a bajar casi lo
   mismo dos veces.
   ============================================================================ */

import React, { useState } from 'react';
import { Lock, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { ResumenLineas } from '../shared/ui.jsx';
import { isDeveloper } from '../shared/permisos.js';
import AddableSelect from '../shared/AddableSelect.jsx';
import {
  CANALIZACION_TIPOS, pulgadasAMetros, emptyDatosCanalizacion, subcategoriaKey,
  subcategoriaLabel, calcAnchoZanjaCanalizacion, calcCintaDesdeSuperficie,
} from './canalizacionesDatos.js';


/* Corte transversal simple (no isométrico — así se ven los planos reales de */
/* referencia): terreno arriba, material de excavación, cinta de            */
/* señalización, arenilla y la(s) tubería(s)/cable a su profundidad.        */
/* Reacciona a los valores digitados, igual criterio que Cimentaciones.     */
export function CanalizacionPreview({ tipoId, datos, className = 'w-full h-auto' }) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === tipoId) || CANALIZACION_TIPOS[0];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const scale = 220; // px por metro
  const d = datos || {};

  const profundidad = parseFloat(d.profundidad) || tipoDef.profundidadNorma;
  const anchoZanjaM = calcAnchoZanjaCanalizacion(tipoDef, d);
  const cintaDesdeSuperficieM = calcCintaDesdeSuperficie(tipoDef, d);
  const espesorArenilla = parseFloat(d.espesor_arenilla) || 0.05;
  const sepLateralM = parseFloat(d.separacion_lateral) || 0.15;
  const cantidad = tipoDef.tieneTuberia ? Math.max(1, parseInt(d.cantidad_tuberias, 10) || 1) : 1;
  const sepEntreM = parseFloat(d.separacion_entre_tuberias) || 0.10;
  const diametroM = tipoDef.tieneTuberia ? (pulgadasAMetros(d.diametro) || 0.02) : (tipoDef.esCableFino ? 0.01 : 0.02);

  const profPx = clamp(profundidad * scale, 60, 220);
  const anchoPx = clamp(anchoZanjaM * scale, 55, 220);
  const cintaYPx = clamp(cintaDesdeSuperficieM * scale, 10, profPx - 6);
  const arenillaPx = clamp(espesorArenilla * scale, 4, 18);
  const sepLateralPx = clamp(sepLateralM * scale, 6, anchoPx / 2 - 6);
  const sepEntrePx = clamp(sepEntreM * scale, 3, 30);

  const viaPx = d.cruzaConVia ? clamp((parseFloat(d.espesor_via) || 0.10) * scale, 10, 40) : 0;
  const marginTop = 34 + (d.cruzaConVia ? viaPx + 18 : 0);
  const marginLeft = 88;
  const zanjaX0 = marginLeft;
  const zanjaTopY = marginTop;
  const tuboY = zanjaTopY + profPx; // profundidad = a la generatriz superior del ducto/cable/elemento
  const tuboRadioPx = tipoDef.tieneTuberia ? clamp((anchoPx - 2 * sepLateralPx - sepEntrePx * (cantidad - 1)) / (2 * cantidad), 5, 16) : 0;
  // "Altura" del elemento enterrado: el diámetro completo si es tubería, o un
  // cable muy delgado si es SPT/AC-BT Enterrado (estos NO llevan arenilla).
  const alturaElementoPx = tipoDef.tieneTuberia ? tuboRadioPx * 2 : 3;
  const arenillaTopY = tuboY - arenillaPx;
  // "fondoY": punto más bajo del contenido de la zanja — con tubería, el
  // fondo de su arenilla; sin tubería (cable), justo debajo del cable mismo
  // (no hay arenilla que sumar).
  const fondoY = tipoDef.tieneTuberia ? (tuboY + alturaElementoPx + arenillaPx) : (tuboY + alturaElementoPx + 6);
  const zanjaBotY = fondoY + 12;
  const svgW = zanjaX0 + anchoPx + 96;
  const svgH = zanjaBotY + 62;

  // Centros de cada tubería, repartidas simétricamente con separación sepEntrePx.
  const centroZanja = zanjaX0 + anchoPx / 2;
  // La cinta de señalización NO va de lado a lado: tiene un ancho fijo de
  // 0.25 m y siempre queda centrada en la zanja (nunca a todo lo ancho).
  const cintaAnchoPx = clamp(0.25 * scale, 20, anchoPx - 4);
  const anchoGrupoTuberias = cantidad * (tuboRadioPx * 2) + (cantidad - 1) * sepEntrePx;
  const primerCentroX = centroZanja - anchoGrupoTuberias / 2 + tuboRadioPx;
  const centrosX = Array.from({ length: cantidad }, (_, i) => primerCentroX + i * (tuboRadioPx * 2 + sepEntrePx));

  // Cota vertical pequeña (segmento) — para la pila de cotas de la derecha, cercana al dibujo.
  function CotaVertical({ y0, y1, x, valor }) {
    if (y1 - y0 < 0.5) return null;
    const alto = y1 - y0;
    return (
      <g>
        <g stroke="#3C64AA" strokeWidth="1">
          <line x1={x} y1={y0} x2={x} y2={y1} />
          <line x1={x - 4} y1={y0} x2={x + 4} y2={y0} />
          <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
        </g>
        {alto < 18 ? (
          <text x={x + 6} y={y1 + 2.5} textAnchor="start" fontSize="6" fontWeight="600" fill="#3C64AA">
            {valor.toFixed(2)} m
          </text>
        ) : (
          <text x={x + 9} y={(y0 + y1) / 2} textAnchor="middle" fontSize="6.2" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${x + 9}, ${(y0 + y1) / 2})`}>
            {valor.toFixed(2)} m
          </text>
        )}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className={className}>
      {d.cruzaConVia && (
        <>
          <rect x={zanjaX0 - 6} y={zanjaTopY - viaPx} width={anchoPx + 12} height={viaPx} fill="#B9BEC7" stroke="#152644" strokeWidth="1" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={zanjaX0 - 4 + i * ((anchoPx + 8) / 6)} y1={zanjaTopY} x2={zanjaX0 - 4 + i * ((anchoPx + 8) / 6) + viaPx} y2={zanjaTopY - viaPx} stroke="#8A93A6" strokeWidth="1" />
          ))}
          <text x={zanjaX0 - 10} y={zanjaTopY - viaPx / 2 + 3} textAnchor="end" fontSize="7" fill="#152644">Espesor de vía</text>
          {/* El "Nivel de piso existente" es la SUPERFICIE de la vía (arriba */}
          {/* del todo), no la línea natural del terreno debajo del pavimento. */}
          <line x1={zanjaX0 - 20} y1={zanjaTopY - viaPx} x2={zanjaX0 + anchoPx + 20} y2={zanjaTopY - viaPx} stroke="#152644" strokeWidth="1.4" />
          <polygon points={`${centroZanja - 5},${zanjaTopY - viaPx - 11} ${centroZanja + 5},${zanjaTopY - viaPx - 11} ${centroZanja},${zanjaTopY - viaPx - 2}`} fill="#152644" />
          <text x={centroZanja} y={zanjaTopY - viaPx - 16} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">Nivel de piso existente</text>
        </>
      )}
      {!d.cruzaConVia && (
        <>
          <line x1={zanjaX0 - 20} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 20} y2={zanjaTopY} stroke="#152644" strokeWidth="1.4" />
          <polygon points={`${centroZanja - 5},${zanjaTopY - 11} ${centroZanja + 5},${zanjaTopY - 11} ${centroZanja},${zanjaTopY - 2}`} fill="#152644" />
          <text x={centroZanja} y={zanjaTopY - 16} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">Nivel de piso existente</text>
        </>
      )}

      {/* Material de excavación compactado (relleno) */}
      <rect x={zanjaX0} y={zanjaTopY} width={anchoPx} height={zanjaBotY - zanjaTopY} fill="#F2E8D5" stroke="#152644" strokeWidth="1.3" />
      {Array.from({ length: 26 }).map((_, i) => (
        <circle key={i} cx={zanjaX0 + 8 + (i * 37) % (anchoPx - 12)} cy={zanjaTopY + 8 + Math.floor(i / 4) * 14} r="1" fill="#B8A67D" opacity="0.7" />
      ))}

      {/* Descripciones a la IZQUIERDA (solo texto, sin cotas — así no se     */}
      {/* cruzan con las cotas, que ahora van todas a la derecha).           */}
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 - 6 : 12)} textAnchor="end" fontSize="7" fill="#152644">Material de la</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 2 : 20)} textAnchor="end" fontSize="7" fill="#152644">excavación</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 10 : 28)} textAnchor="end" fontSize="7" fill="#152644">compactado</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + cintaYPx + 3} textAnchor="end" fontSize="7.5" fill="#152644">Cinta de</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + cintaYPx + 12} textAnchor="end" fontSize="7.5" fill="#152644">señalización</text>
      {tipoDef.tieneTuberia && (
        <text x={zanjaX0 - 8} y={arenillaTopY + 4} textAnchor="end" fontSize="7.5" fill="#152644">{d.cruzaConVia ? 'Concreto' : 'Arenilla'}</text>
      )}
      <text x={zanjaX0 - 8} y={tuboY + alturaElementoPx / 2 + 4} textAnchor="end" fontSize="7.5" fontWeight="600" fill="#152644">{tipoDef.label}</text>

      {/* Cinta de señalización — TODOS los tipos, incluido SPT. Ancho fijo   */}
      {/* de 0.25 m, siempre centrada (no de lado a lado de la zanja).       */}
      <line x1={centroZanja - cintaAnchoPx / 2} y1={zanjaTopY + cintaYPx} x2={centroZanja + cintaAnchoPx / 2} y2={zanjaTopY + cintaYPx} stroke="#DC2626" strokeWidth="3" />

      {/* Arenilla (o CONCRETO si cruza con vía): franja de LADO A LADO de    */}
      {/* la zanja — SOLO si hay tubería (SPT y AC-BT Enterrado no llevan). */}
      {tipoDef.tieneTuberia && (
        <rect x={zanjaX0} y={arenillaTopY} width={anchoPx} height={fondoY - arenillaTopY} fill={d.cruzaConVia ? '#C8CDD6' : '#EFE3C8'} stroke="#152644" strokeWidth={d.cruzaConVia ? '0.8' : '1'} strokeDasharray={d.cruzaConVia ? '0' : '3 2'} />
      )}

      {/* Tubería(s) (círculos) o cable delgado (punto), coloreados según el  */}
      {/* tipo de línea — a la profundidad digitada.                        */}
      {tipoDef.tieneTuberia ? (
        centrosX.map((cx, i) => (
          <circle key={i} cx={cx} cy={tuboY + tuboRadioPx} r={tuboRadioPx} fill={`${tipoDef.color}33`} stroke={tipoDef.color} strokeWidth="1.6" />
        ))
      ) : (
        <circle cx={centroZanja} cy={tuboY + alturaElementoPx / 2} r="2.2" fill={tipoDef.color} stroke="#152644" strokeWidth="0.8" />
      )}

      {/* Cotas a la DERECHA, con jerarquía: primero (más cerca del dibujo)  */}
      {/* piso→cinta, y luego según haya o no tubería: cinta→arenilla,       */}
      {/* arenilla→elemento, elemento→arenilla (con tubería) o solo          */}
      {/* cinta→cable (sin tubería, no hay arenilla que medir). En paralelo, */}
      {/* más alejada, la profundidad total de la zanja.                    */}
      <CotaVertical y0={zanjaTopY} y1={zanjaTopY + cintaYPx} x={zanjaX0 + anchoPx + 14} valor={cintaDesdeSuperficieM} />
      {tipoDef.tieneTuberia ? (
        <>
          <CotaVertical y0={zanjaTopY + cintaYPx} y1={arenillaTopY} x={zanjaX0 + anchoPx + 14} valor={(arenillaTopY - (zanjaTopY + cintaYPx)) / scale} />
          <CotaVertical y0={arenillaTopY} y1={tuboY} x={zanjaX0 + anchoPx + 14} valor={espesorArenilla} />
          <CotaVertical y0={tuboY + alturaElementoPx} y1={fondoY} x={zanjaX0 + anchoPx + 14} valor={espesorArenilla} />
        </>
      ) : (
        <CotaVertical y0={zanjaTopY + cintaYPx} y1={tuboY} x={zanjaX0 + anchoPx + 14} valor={(tuboY - (zanjaTopY + cintaYPx)) / scale} />
      )}

      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0 + anchoPx + 40} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 40} y2={fondoY} />
        <line x1={zanjaX0 + anchoPx + 36} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 44} y2={zanjaTopY} />
        <line x1={zanjaX0 + anchoPx + 36} y1={fondoY} x2={zanjaX0 + anchoPx + 44} y2={fondoY} />
      </g>
      <text x={zanjaX0 + anchoPx + 52} y={(zanjaTopY + fondoY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${zanjaX0 + anchoPx + 52}, ${(zanjaTopY + fondoY) / 2})`}>
        {((fondoY - zanjaTopY) / scale).toFixed(2)} m
      </text>
      <text x={zanjaX0 + anchoPx + 62} y={(zanjaTopY + fondoY) / 2} textAnchor="middle" fontSize="5.5" fill="#8A93A6" transform={`rotate(90, ${zanjaX0 + anchoPx + 62}, ${(zanjaTopY + fondoY) / 2})`}>
        profundidad total de la zanja
      </text>

      {/* Cotas de segmentos abajo: separación lateral / diámetro / separación entre tuberías... */}
      {tipoDef.tieneTuberia && (() => {
        const segY = zanjaBotY + 12;
        const marcas = [zanjaX0, zanjaX0 + sepLateralPx];
        let cursor = zanjaX0 + sepLateralPx;
        for (let i = 0; i < cantidad; i++) {
          cursor += tuboRadioPx * 2;
          marcas.push(cursor);
          if (i < cantidad - 1) {
            cursor += sepEntrePx;
            marcas.push(cursor);
          }
        }
        marcas.push(zanjaX0 + anchoPx);
        const etiquetas = [sepLateralM, ...Array.from({ length: cantidad }, () => diametroM).flatMap((diam, i) => (i < cantidad - 1 ? [diam, sepEntreM] : [diam])), sepLateralM];
        return (
          <>
            {marcas.slice(0, -1).map((x0, i) => {
              const x1 = marcas[i + 1];
              return (
                <g key={i}>
                  <g stroke="#152644" strokeWidth="0.8">
                    <line x1={x0} y1={segY} x2={x1} y2={segY} />
                    <line x1={x0} y1={segY - 4} x2={x0} y2={segY + 4} />
                    <line x1={x1} y1={segY - 4} x2={x1} y2={segY + 4} />
                  </g>
                  <text x={(x0 + x1) / 2} y={segY - 6} textAnchor="middle" fontSize="6.3" fill="#152644">
                    {(etiquetas[i] || 0).toFixed(2)}
                  </text>
                </g>
              );
            })}
          </>
        );
      })()}

      {/* Cota de ancho de zanja total (la más abajo) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0} y1={zanjaBotY + 32} x2={zanjaX0 + anchoPx} y2={zanjaBotY + 32} />
        <line x1={zanjaX0} y1={zanjaBotY + 28} x2={zanjaX0} y2={zanjaBotY + 36} />
        <line x1={zanjaX0 + anchoPx} y1={zanjaBotY + 28} x2={zanjaX0 + anchoPx} y2={zanjaBotY + 36} />
      </g>
      <text x={centroZanja} y={zanjaBotY + 46} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {anchoZanjaM.toFixed(2)} m
      </text>
    </svg>
  );
}

/* Resumen en líneas (mismo patrón que ResumenLineas de Cimentaciones) para  */
/* mostrar esta plantilla en las tarjetas y en los selectores de proyecto.  */
export function resumenCanalizacion(tipoId, d) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === tipoId) || CANALIZACION_TIPOS[0];
  const lineas = [];
  if (tipoDef.tieneTuberia && d.diametro) {
    const cantidad = Math.max(1, parseInt(d.cantidad_tuberias, 10) || 1);
    lineas.push(`Tubería: ${d.diametro} × ${cantidad}`);
  }
  if (tipoDef.esCableFino && d.calibre_cable) lineas.push(`Calibre: ${d.calibre_cable}`);
  lineas.push(`Profundidad: ${d.profundidad || tipoDef.profundidadNorma} m`);
  lineas.push(`Ancho de zanja: ${calcAnchoZanjaCanalizacion(tipoDef, d).toFixed(2)} m`);
  lineas.push(`Cinta a: ${calcCintaDesdeSuperficie(tipoDef, d).toFixed(2)} m del piso`);
  return lineas;
}

export function DiametroPicker({ value, diametros, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={diametros || []}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo='Ej. 3/4", 1 1/4", 2"...'
      etiquetaAgregar="+ Agregar nuevo diámetro…"
    />
  );
}

export function CanalizacionForm({ tipoDef, plantilla, onCancel, onSave, diametrosTuberia, onAddDiametro }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [esPrincipal, setEsPrincipal] = useState(plantilla?.es_principal || false);
  const [datos, setDatos] = useState(() => ({ ...emptyDatosCanalizacion(tipoDef), ...(plantilla?.datos || {}) }));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos, esPrincipal);
  }
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  const cantidad = Math.max(1, parseInt(datos.cantidad_tuberias, 10) || 1);
  const anchoCalculado = calcAnchoZanjaCanalizacion(tipoDef, datos);

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · {tipoDef.label}
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-4 mb-5">
        <div className="w-full max-w-xl">
          <CanalizacionPreview tipoId={tipoDef.id} datos={datos} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={`${tipoDef.label} 2" × 1 tubería`} className={cellInput} required />
        </div>

        {tipoDef.tieneTuberia && (
          <>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Diámetro de tubería</label>
              <DiametroPicker value={datos.diametro} diametros={diametrosTuberia} onChange={(v) => set('diametro', v)} onAddNew={onAddDiametro} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Cantidad de tuberías en esta zanja</label>
              <input type="number" min="1" value={datos.cantidad_tuberias} onChange={(e) => set('cantidad_tuberias', e.target.value)} className={cellInput} />
            </div>
          </>
        )}
        {tipoDef.esCableFino && (
          <div>
            <label className="block text-xs text-navy-500 mb-1">Calibre del cable</label>
            <input value={datos.calibre_cable} onChange={(e) => set('calibre_cable', e.target.value)} placeholder='ej. 8.25 mm' className={cellInput} />
          </div>
        )}
        <div>
          <label className="block text-xs text-navy-500 mb-1">Profundidad (m)</label>
          <input value={datos.profundidad} onChange={(e) => set('profundidad', e.target.value)} className={cellInput} />
          <p className="text-[11px] text-navy-400 mt-0.5">Sugerida por la norma: {tipoDef.profundidadNorma} m (editable).</p>
        </div>
        <div>
          <label className="block text-xs text-navy-500 mb-1">Distancia de la cinta a la tubería/cable (m)</label>
          <input value={datos.distancia_cinta} onChange={(e) => set('distancia_cinta', e.target.value)} className={cellInput} />
          <p className="text-[11px] text-navy-400 mt-0.5">
            Sugerida: {tipoDef.distanciaCintaNorma} m. Nunca queda a menos de 0.20 m del piso — si tocara quedar más arriba, se respeta ese mínimo.
          </p>
        </div>
        <div>
          <label className="block text-xs text-navy-500 mb-1">Espesor de arenilla (m)</label>
          <input value={datos.espesor_arenilla} onChange={(e) => set('espesor_arenilla', e.target.value)} className={cellInput} />
          <p className="text-[11px] text-navy-400 mt-0.5">Por encima y por debajo del elemento (norma: 0.05 m).</p>
        </div>
        <div>
          <label className="block text-xs text-navy-500 mb-1">Separación lateral zanja–tubería (m)</label>
          <input value={datos.separacion_lateral} onChange={(e) => set('separacion_lateral', e.target.value)} className={cellInput} />
          <p className="text-[11px] text-navy-400 mt-0.5">A lado y lado, borde externo (norma: 0.15 m).</p>
        </div>
        {tipoDef.tieneTuberia && cantidad > 1 && (
          <div>
            <label className="block text-xs text-navy-500 mb-1">Separación entre tuberías (m)</label>
            <input value={datos.separacion_entre_tuberias} onChange={(e) => set('separacion_entre_tuberias', e.target.value)} className={cellInput} />
            <p className="text-[11px] text-navy-400 mt-0.5">Mínimo entre caras externas: 0.10 m.</p>
          </div>
        )}
        <div className="sm:col-span-2 bg-navy-50 rounded-lg px-3 py-2">
          <p className="text-xs text-navy-500">
            Ancho de zanja (calculado): <span className="font-mono font-semibold text-navy-800">{anchoCalculado.toFixed(2)} m</span>
          </p>
          <p className="text-[11px] text-navy-400 mt-0.5">= (separación lateral × 2) + espacio de la(s) tubería(s)/cable. Ya no se digita, se calcula solo.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-navy-500 mb-1">Notas</label>
          <input value={datos.notas} onChange={(e) => set('notas', e.target.value)} className={cellInput} />
        </div>
      </div>

      <label className="flex items-center gap-2 mb-5 cursor-pointer">
        <input type="checkbox" checked={esPrincipal} onChange={(e) => setEsPrincipal(e.target.checked)} className="w-4 h-4 accent-lime-500" />
        <span className="text-sm text-navy-700">Marcar como <strong>Principal</strong> de "{tipoDef.label}" (la vigente/más actualizada)</span>
      </label>
      {esPrincipal && (
        <p className="text-xs text-navy-400 -mt-4 mb-5 italic">Al guardar, cualquier otra plantilla de este mismo tipo dejará de ser Principal.</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          {plantilla ? 'Guardar cambios' : 'Crear plantilla'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* Datos "en vivo" de una línea dentro de una Combinación: mira su propia    */
/* plantilla (tipo + datos) tal como está AHORA — si se edita después, la    */
/* combinación refleja el cambio solo, igual criterio que Cimentaciones.    */
export function datosLineaCombinacion(plantillaLinea) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === plantillaLinea?.tipo);
  if (!tipoDef) return null;
  const d = plantillaLinea.datos || {};
  return {
    tipoDef,
    nombre: plantillaLinea.nombre,
    anchoM: calcAnchoZanjaCanalizacion(tipoDef, d),
    profundidadM: parseFloat(d.profundidad) || tipoDef.profundidadNorma,
    cintaDesdeSuperficieM: calcCintaDesdeSuperficie(tipoDef, d),
    espesorArenillaM: parseFloat(d.espesor_arenilla) || 0.05,
    sepLateralM: parseFloat(d.separacion_lateral) || 0.15,
    cantidad: tipoDef.tieneTuberia ? Math.max(1, parseInt(d.cantidad_tuberias, 10) || 1) : 1,
    sepEntreM: parseFloat(d.separacion_entre_tuberias) || 0.10,
    diametroM: tipoDef.tieneTuberia ? (pulgadasAMetros(d.diametro) || 0.02) : (tipoDef.esCableFino ? 0.01 : 0.02),
  };
}

/* Zanja escalonada: cada línea de la combinación se dibuja en su propia     */
/* "columna", una junto a otra, cada una excavada hasta SU propia            */
/* profundidad (más superficial a la izquierda, más profunda a la derecha), */
/* con un escalón entre columnas de distinta profundidad — así se ve un      */
/* corte real cuando dos líneas de distinta norma comparten la misma zanja. */
export function CombinacionPreview({ lineaIds, plantillasCanalizaciones, className = 'w-full h-auto' }) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const scale = 200;
  const lineas = (lineaIds || [])
    .map((id) => plantillasCanalizaciones.find((p) => p.id === id))
    .filter(Boolean)
    .map(datosLineaCombinacion)
    .filter(Boolean)
    .sort((a, b) => a.profundidadM - b.profundidadM); // más superficial primero (izquierda)

  if (lineas.length === 0) {
    return (
      <svg viewBox="0 0 200 60" className={className}>
        <text x="100" y="32" textAnchor="middle" fontSize="9" fill="#8A93A6">Elige al menos 2 plantillas</text>
      </svg>
    );
  }

  /* Reglas de una zanja combinada (distintas a una zanja de una sola línea):
     - NO es pegar una zanja junto a otra: la separación mínima entre los
       grupos de tubería/cable de líneas distintas es 0.10 m (sin importar
       el tipo), no la suma de las separaciones laterales de cada una.
     - Una sola cinta de señalización compartida (0.25 m de ancho,
       centrada en TODO el ancho combinado) — no una por línea.
     - El FONDO de la zanja es uniforme, a la profundidad de la línea más
       profunda; las líneas menos profundas rellenan ese espacio de más
       con arenilla (no se escalona la excavación, solo la tubería queda
       a su propia profundidad).
     - Sin línea divisoria entre columnas: es una sola excavación. */
  const GAP_ENTRE_LINEAS_M = 0.10;
  const sepLateralM = Math.max(...lineas.map((l) => l.sepLateralM));
  const gruposM = lineas.map((l) => (l.tipoDef.tieneTuberia ? l.diametroM * l.cantidad + l.sepEntreM * (l.cantidad - 1) : 0.03));
  const anchoTotalM = sepLateralM * 2 + gruposM.reduce((a, b) => a + b, 0) + GAP_ENTRE_LINEAS_M * (lineas.length - 1);
  // El fondo de la zanja: para líneas CON tubería, incluye su arenilla; para
  // cable (SPT / AC-BT Enterrado, que no llevan arenilla) es solo un margen
  // pequeño bajo el cable mismo.
  const maxArenillaBotM = Math.max(...lineas.map((l) =>
    l.tipoDef.tieneTuberia ? l.profundidadM + l.diametroM + l.espesorArenillaM : l.profundidadM + 0.016
  ));
  const cintaDesdeSuperficieCompartidaM = Math.min(...lineas.map((l) => l.cintaDesdeSuperficieM));

  const marginTop = 34;
  const zanjaX0 = 96;
  const zanjaTopY = marginTop;
  const anchoTotalPx = clamp(anchoTotalM * scale, 120, 420);
  const pxPorM = anchoTotalPx / anchoTotalM;
  const maxArenillaBotY = zanjaTopY + maxArenillaBotM * pxPorM;
  const cintaYPx = clamp(cintaDesdeSuperficieCompartidaM * pxPorM, 10, (maxArenillaBotY - zanjaTopY) - 6);
  const sepLateralPx = sepLateralM * pxPorM;
  const gapPx = GAP_ENTRE_LINEAS_M * pxPorM;

  let cursorX = zanjaX0 + sepLateralPx;
  const columnas = lineas.map((l, i) => {
    const grupoAnchoPx = gruposM[i] * pxPorM;
    const x0 = cursorX;
    cursorX += grupoAnchoPx + (i < lineas.length - 1 ? gapPx : 0);
    const tuboY = zanjaTopY + l.profundidadM * pxPorM;
    const arenillaPx = l.espesorArenillaM * pxPorM;
    const arenillaTopY = tuboY - arenillaPx;
    const tuboRadioPx = l.tipoDef.tieneTuberia
      ? clamp((grupoAnchoPx - l.sepEntreM * pxPorM * (l.cantidad - 1)) / (2 * l.cantidad), 3, 16)
      : 0;
    return { ...l, x0, grupoAnchoPx, tuboY, arenillaTopY, tuboRadioPx };
  });
  const anchoTotalRealPx = cursorX - zanjaX0 + sepLateralPx;
  const centroTotal = zanjaX0 + anchoTotalRealPx / 2;
  const cintaAnchoPx = clamp(0.25 * pxPorM, 20, anchoTotalRealPx - 8);
  // La arenilla cubre TODO el ancho de la zanja de lado a lado (no un
  // recuadro por línea) — solo aplica si al menos una línea lleva tubería;
  // el cable (SPT / AC-BT Enterrado) no la necesita.
  const columnasConTuberia = columnas.filter((c) => c.tipoDef.tieneTuberia);
  const arenillaTopYCompartida = columnasConTuberia.length > 0 ? Math.min(...columnasConTuberia.map((c) => c.arenillaTopY)) : null;

  const svgW = zanjaX0 + anchoTotalRealPx + 66;
  const svgH = maxArenillaBotY + 66;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className={className}>
      <line x1={zanjaX0 - 6} y1={zanjaTopY} x2={zanjaX0 + anchoTotalRealPx + 6} y2={zanjaTopY} stroke="#152644" strokeWidth="1.4" />
      <polygon points={`${centroTotal - 5},${zanjaTopY - 11} ${centroTotal + 5},${zanjaTopY - 11} ${centroTotal},${zanjaTopY - 2}`} fill="#152644" />
      <text x={centroTotal} y={zanjaTopY - 16} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">Nivel de piso existente</text>

      {/* UNA sola excavación (sin escalones ni línea divisoria entre líneas) */}
      <rect x={zanjaX0} y={zanjaTopY} width={anchoTotalRealPx} height={maxArenillaBotY - zanjaTopY} fill="#F2E8D5" stroke="#152644" strokeWidth="1.3" />
      {Array.from({ length: 30 }).map((_, i) => (
        <circle key={i} cx={zanjaX0 + 8 + (i * 37) % (anchoTotalRealPx - 12)} cy={zanjaTopY + 8 + Math.floor(i / 6) * 14} r="1" fill="#B8A67D" opacity="0.7" />
      ))}

      {/* Descripciones a la izquierda */}
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 - 6 : 12)} textAnchor="end" fontSize="7" fill="#152644">Material de la</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 2 : 20)} textAnchor="end" fontSize="7" fill="#152644">excavación</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 10 : 28)} textAnchor="end" fontSize="7" fill="#152644">compactado</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + cintaYPx + 3} textAnchor="end" fontSize="7.5" fill="#152644">Cinta de</text>
      <text x={zanjaX0 - 8} y={zanjaTopY + cintaYPx + 12} textAnchor="end" fontSize="7.5" fill="#152644">señalización</text>
      {arenillaTopYCompartida != null && (
        <text x={zanjaX0 - 8} y={(arenillaTopYCompartida + maxArenillaBotY) / 2} textAnchor="end" fontSize="7.5" fill="#152644">Arenilla</text>
      )}

      {/* Cinta de señalización: UNA sola, 0.25 m de ancho, centrada en TODO el ancho combinado */}
      <line x1={centroTotal - cintaAnchoPx / 2} y1={zanjaTopY + cintaYPx} x2={centroTotal + cintaAnchoPx / 2} y2={zanjaTopY + cintaYPx} stroke="#DC2626" strokeWidth="3" />

      {/* Arenilla: UNA franja continua de lado a lado (no un recuadro por    */}
      {/* línea) — solo si alguna línea de la combinación lleva tubería.     */}
      {arenillaTopYCompartida != null && (
        <rect x={zanjaX0} y={arenillaTopYCompartida} width={anchoTotalRealPx} height={maxArenillaBotY - arenillaTopYCompartida} fill="#EFE3C8" stroke="#152644" strokeWidth="0.8" strokeDasharray="3 2" />
      )}

      {columnas.map((c, i) => {
        const centro = c.x0 + c.grupoAnchoPx / 2;
        const sepEntrePxCol = clamp(c.sepEntreM * pxPorM, 2, 30);
        const anchoGrupo = c.cantidad * (c.tuboRadioPx * 2) + (c.cantidad - 1) * sepEntrePxCol;
        const primerCentro = centro - anchoGrupo / 2 + c.tuboRadioPx;
        return (
          <g key={i}>
            {c.tipoDef.tieneTuberia ? (
              Array.from({ length: c.cantidad }).map((_, j) => (
                <circle key={j} cx={primerCentro + j * (c.tuboRadioPx * 2 + sepEntrePxCol)} cy={c.tuboY + c.tuboRadioPx} r={c.tuboRadioPx} fill={`${c.tipoDef.color}33`} stroke={c.tipoDef.color} strokeWidth="1.4" />
              ))
            ) : (
              <circle cx={centro} cy={c.tuboY} r="2" fill={c.tipoDef.color} stroke="#152644" strokeWidth="0.7" />
            )}
            <text x={centro} y={maxArenillaBotY + 16} textAnchor="middle" fontSize="7" fontWeight="600" fill="#152644">{c.tipoDef.label}</text>
            <text x={centro} y={maxArenillaBotY + 28} textAnchor="middle" fontSize="7" fill="#3C64AA">{c.profundidadM.toFixed(2)} m</text>
          </g>
        );
      })}

      {/* Cotas a la derecha: piso→cinta, cinta→fondo, y en paralelo el total */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={zanjaX0 + anchoTotalRealPx + 14} y1={zanjaTopY} x2={zanjaX0 + anchoTotalRealPx + 14} y2={zanjaTopY + cintaYPx} />
        <line x1={zanjaX0 + anchoTotalRealPx + 10} y1={zanjaTopY} x2={zanjaX0 + anchoTotalRealPx + 18} y2={zanjaTopY} />
        <line x1={zanjaX0 + anchoTotalRealPx + 10} y1={zanjaTopY + cintaYPx} x2={zanjaX0 + anchoTotalRealPx + 18} y2={zanjaTopY + cintaYPx} />
      </g>
      <text x={zanjaX0 + anchoTotalRealPx + 23} y={zanjaTopY + cintaYPx / 2} textAnchor="middle" fontSize="6.2" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${zanjaX0 + anchoTotalRealPx + 23}, ${zanjaTopY + cintaYPx / 2})`}>
        {cintaDesdeSuperficieCompartidaM.toFixed(2)} m
      </text>
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={zanjaX0 + anchoTotalRealPx + 14} y1={zanjaTopY + cintaYPx} x2={zanjaX0 + anchoTotalRealPx + 14} y2={maxArenillaBotY} />
        <line x1={zanjaX0 + anchoTotalRealPx + 10} y1={maxArenillaBotY} x2={zanjaX0 + anchoTotalRealPx + 18} y2={maxArenillaBotY} />
      </g>
      <text x={zanjaX0 + anchoTotalRealPx + 23} y={zanjaTopY + cintaYPx + ((maxArenillaBotY - zanjaTopY - cintaYPx) / 2)} textAnchor="middle" fontSize="6.2" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${zanjaX0 + anchoTotalRealPx + 23}, ${zanjaTopY + cintaYPx + ((maxArenillaBotY - zanjaTopY - cintaYPx) / 2)})`}>
        {((maxArenillaBotY - zanjaTopY - cintaYPx) / pxPorM).toFixed(2)} m
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0 + anchoTotalRealPx + 40} y1={zanjaTopY} x2={zanjaX0 + anchoTotalRealPx + 40} y2={maxArenillaBotY} />
        <line x1={zanjaX0 + anchoTotalRealPx + 36} y1={zanjaTopY} x2={zanjaX0 + anchoTotalRealPx + 44} y2={zanjaTopY} />
        <line x1={zanjaX0 + anchoTotalRealPx + 36} y1={maxArenillaBotY} x2={zanjaX0 + anchoTotalRealPx + 44} y2={maxArenillaBotY} />
      </g>
      <text x={zanjaX0 + anchoTotalRealPx + 52} y={(zanjaTopY + maxArenillaBotY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${zanjaX0 + anchoTotalRealPx + 52}, ${(zanjaTopY + maxArenillaBotY) / 2})`}>
        {((maxArenillaBotY - zanjaTopY) / pxPorM).toFixed(2)} m
      </text>

      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0} y1={maxArenillaBotY + 40} x2={zanjaX0 + anchoTotalRealPx} y2={maxArenillaBotY + 40} />
        <line x1={zanjaX0} y1={maxArenillaBotY + 36} x2={zanjaX0} y2={maxArenillaBotY + 44} />
        <line x1={zanjaX0 + anchoTotalRealPx} y1={maxArenillaBotY + 36} x2={zanjaX0 + anchoTotalRealPx} y2={maxArenillaBotY + 44} />
      </g>
      <text x={zanjaX0 + anchoTotalRealPx / 2} y={maxArenillaBotY + 54} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {(anchoTotalRealPx / pxPorM).toFixed(2)} m (ancho total)
      </text>
    </svg>
  );
}

export function resumenCombinacion(lineaIds, plantillasCanalizaciones) {
  const lineas = (lineaIds || [])
    .map((id) => plantillasCanalizaciones.find((p) => p.id === id))
    .filter(Boolean)
    .map(datosLineaCombinacion)
    .filter(Boolean)
    .sort((a, b) => a.profundidadM - b.profundidadM);
  if (lineas.length === 0) return ['Sin líneas elegidas'];
  return lineas.map((l) => `${l.tipoDef.label} (${l.nombre}): ${l.profundidadM.toFixed(2)} m`);
}

/* ============================================================================
   5D. CRUCES — ventana aparte de Canalizaciones. Hay 2 tipos de cruce:
   (a) entre 2 líneas que se cruzan perpendicularmente (aplica la Tabla 4);
   (b) de UNA sola línea con una vía (usa CanalizacionPreview con la bandera
   "cruzaConVia" — ver arriba — nunca 2 líneas a la vez con vía).

   Para (a): a diferencia de una zanja paralela (Combinaciones), en un cruce
   solo se ve UNA columna — la de la línea menos profunda, en corte
   transversal normal (círculos/punto). La línea más profunda NO se ve en
   corte transversal (no tendría sentido: va perpendicular a la vista) sino
   LONGITUDINAL — una línea que atraviesa de un lado a otro de la zanja, a
   su propia profundidad.
   ============================================================================ */

/* "ACBT" en la Tabla 4 no distingue AC-BT con tubería de AC-BT Enterrado —  */
/* ambas mapean a la misma categoría del documento.                        */
export const CATEGORIA_TABLA4 = {
  dc: 'DC',
  acbt_tuberia: 'ACBT',
  acbt_directo: 'ACBT',
  mt: 'MT',
  comunicaciones: 'Comunicaciones',
  energia_ssaa: 'Energía-SSAA',
  spt: 'SPT',
};
/* Las 15 parejas de la Tabla 4 (todas las combinaciones posibles de las 6   */
/* categorías del documento). "obs" es la nota especial de esa pareja.      */
export const TABLA4_CRUCES = [
  { a: 'Energía-SSAA', aProf: 0.45, b: 'DC', bProf: 0.60 },
  { a: 'Energía-SSAA', aProf: 0.45, b: 'ACBT', bProf: 0.60 },
  { a: 'Energía-SSAA', aProf: 0.45, b: 'MT', bProf: 0.75 },
  { a: 'Energía-SSAA', aProf: 0.45, b: 'SPT', bProf: 0.75 },
  { a: 'Energía-SSAA', aProf: 0.60, b: 'Comunicaciones', bProf: 0.40, obs: 'Si el cruce es distinto a 90°, se debe garantizar una separación de 0.30 m entre tuberías.' },
  { a: 'ACBT', aProf: 0.45, b: 'DC', bProf: 0.60 },
  { a: 'ACBT', aProf: 0.45, b: 'MT', bProf: 0.75, obs: 'Debe haber una diferencia de mínimo 0.20 m entre la generatriz inferior de AC-BT y la generatriz superior de AC-MT.' },
  { a: 'ACBT', aProf: 0.45, b: 'SPT', bProf: 0.75 },
  { a: 'ACBT', aProf: 0.60, b: 'Comunicaciones', bProf: 0.40 },
  { a: 'DC', aProf: 0.60, b: 'Comunicaciones', bProf: 0.40 },
  { a: 'DC', aProf: 0.45, b: 'MT', bProf: 0.75 },
  { a: 'DC', aProf: 0.45, b: 'SPT', bProf: 0.75 },
  { a: 'Comunicaciones', aProf: 0.40, b: 'MT', bProf: 0.75 },
  { a: 'Comunicaciones', aProf: 0.40, b: 'SPT', bProf: 0.75 },
  { a: 'MT', aProf: 0.45, b: 'SPT', bProf: 0.75 },
];
/* Busca la pareja de la Tabla 4 para 2 tipos de línea (en cualquier orden)  */
/* y devuelve las profundidades YA orientadas: profA SIEMPRE corresponde al */
/* tipoA recibido (primer argumento), profB al tipoB — sin importar en qué  */
/* orden esté la pareja adentro de TABLA4_CRUCES.                          */
export function buscarTabla4(tipoA, tipoB) {
  const catA = CATEGORIA_TABLA4[tipoA];
  const catB = CATEGORIA_TABLA4[tipoB];
  if (!catA || !catB) return null;
  const par = TABLA4_CRUCES.find((p) => (p.a === catA && p.b === catB) || (p.a === catB && p.b === catA));
  if (!par) return null;
  return par.a === catA
    ? { profA: par.aProf, profB: par.bProf, obs: par.obs || '' }
    : { profA: par.bProf, profB: par.aProf, obs: par.obs || '' };
}
/* Nota especial de la norma: el cableado de SPT SIEMPRE debe quedar por    */
/* debajo de la otra línea en un cruce (es curvable, se agacha localmente). */
export const NOTA_SPT_SIEMPRE_ABAJO = 'El cableado de SPT siempre debe quedar por debajo de la otra línea en el cruce (es curvable).';

export function datosLineaCruce(plantillaLinea, profundidadOverride) {
  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === plantillaLinea?.tipo);
  if (!tipoDef) return null;
  const d = plantillaLinea.datos || {};
  const profundidadM = profundidadOverride != null && profundidadOverride !== ''
    ? parseFloat(profundidadOverride)
    : (parseFloat(d.profundidad) || tipoDef.profundidadNorma);
  return {
    tipoDef,
    nombre: plantillaLinea.nombre,
    profundidadM,
    cintaDesdeSuperficieM: calcCintaDesdeSuperficie(tipoDef, { ...d, profundidad: String(profundidadM) }),
    espesorArenillaM: parseFloat(d.espesor_arenilla) || 0.05,
    sepLateralM: parseFloat(d.separacion_lateral) || 0.15,
    cantidad: tipoDef.tieneTuberia ? Math.max(1, parseInt(d.cantidad_tuberias, 10) || 1) : 1,
    sepEntreM: parseFloat(d.separacion_entre_tuberias) || 0.10,
    diametroM: tipoDef.tieneTuberia ? (pulgadasAMetros(d.diametro) || 0.02) : (tipoDef.esCableFino ? 0.01 : 0.02),
  };
}

/* Corte de UNA sola columna (la de la línea menos profunda, en corte       */
/* transversal normal) — la línea más profunda se dibuja LONGITUDINAL: una  */
/* línea horizontal que atraviesa toda la zanja a su propia profundidad,    */
/* con su propia arenilla SOLO si tiene tubería (si es cable — SPT o AC-BT  */
/* Enterrado — no lleva arenilla, va directo enterrada).                    */
export function CrucePreview({ datos, plantillasCanalizaciones, className = 'w-full h-auto' }) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const scale = 220;
  const d = datos || {};
  const plantillaA = plantillasCanalizaciones.find((p) => p.id === d.lineaAId);
  const plantillaB = plantillasCanalizaciones.find((p) => p.id === d.lineaBId);
  const lineaA = plantillaA ? datosLineaCruce(plantillaA, d.profundidadA) : null;
  const lineaB = plantillaB ? datosLineaCruce(plantillaB, d.profundidadB) : null;

  if (!lineaA || !lineaB) {
    return (
      <svg viewBox="0 0 200 60" className={className}>
        <text x="100" y="32" textAnchor="middle" fontSize="9" fill="#8A93A6">Elige las 2 líneas que se cruzan</text>
      </svg>
    );
  }

  const [sup, prof] = lineaA.profundidadM <= lineaB.profundidadM ? [lineaA, lineaB] : [lineaB, lineaA];

  // La columna (ancho, cinta, arenilla, tubería) es SIEMPRE la de la línea
  // superior (menos profunda) — como una zanja normal de una sola línea.
  const supDatosFalsos = {
    diametro: '', cantidad_tuberias: String(sup.cantidad), separacion_entre_tuberias: String(sup.sepEntreM),
    separacion_lateral: String(sup.sepLateralM), espesor_arenilla: String(sup.espesorArenillaM),
  };
  const anchoZanjaM = sup.tipoDef.tieneTuberia
    ? sup.sepLateralM * 2 + (sup.diametroM * sup.cantidad + sup.sepEntreM * (sup.cantidad - 1))
    : sup.sepLateralM * 2 + (sup.tipoDef.esCableFino ? 0.01 : 0.02);

  const profPx = clamp(sup.profundidadM * scale, 60, 220);
  const anchoPx = clamp(anchoZanjaM * scale, 55, 220);
  const cintaYPx = clamp(sup.cintaDesdeSuperficieM * scale, 10, profPx - 6);
  const arenillaPx = clamp(sup.espesorArenillaM * scale, 4, 18);
  const sepLateralPx = clamp(sup.sepLateralM * scale, 6, anchoPx / 2 - 6);
  const sepEntrePx = clamp(sup.sepEntreM * scale, 3, 30);

  const marginTop = 34;
  const marginLeft = 108;
  const zanjaX0 = marginLeft;
  const zanjaTopY = marginTop;
  const tuboY = zanjaTopY + profPx;
  const tuboRadioPx = sup.tipoDef.tieneTuberia ? clamp((anchoPx - 2 * sepLateralPx - sepEntrePx * (sup.cantidad - 1)) / (2 * sup.cantidad), 5, 16) : 0;
  const alturaElementoPx = sup.tipoDef.tieneTuberia ? tuboRadioPx * 2 : 3;
  const arenillaTopY = tuboY - arenillaPx;
  const fondoSupY = sup.tipoDef.tieneTuberia ? (tuboY + alturaElementoPx + arenillaPx) : (tuboY + alturaElementoPx + 6);

  // La línea profunda (longitudinal): a su propia profundidad, con su
  // propia arenilla si tiene tubería (si no, va directa, sin arenilla).
  const profTuboY = zanjaTopY + clamp(prof.profundidadM * scale, profPx + 24, 460);
  const profArenillaPx = prof.tipoDef.tieneTuberia ? clamp(prof.espesorArenillaM * scale, 4, 16) : 0;
  // El grosor de la línea longitudinal representa el DIÁMETRO real de esa
  // línea (no un trazo arbitrario) — un cable delgado se ve delgado, una
  // tubería de 6" se ve más gruesa que una de 2".
  const profAlturaPx = prof.tipoDef.tieneTuberia ? clamp(prof.diametroM * scale, 6, 28) : 3;
  // Margen extra debajo de la línea profunda para que nunca quede pegada al
  // borde inferior del dibujo (antes se veía "cortada").
  const profFondoY = profTuboY + profAlturaPx + profArenillaPx + 16;

  const centroZanja = zanjaX0 + anchoPx / 2;
  const cintaAnchoPx = clamp(0.25 * scale, 20, anchoPx - 4);
  const anchoGrupoTuberias = sup.cantidad * (tuboRadioPx * 2) + (sup.cantidad - 1) * sepEntrePx;
  const primerCentroX = centroZanja - anchoGrupoTuberias / 2 + tuboRadioPx;
  const centrosX = Array.from({ length: sup.cantidad }, (_, i) => primerCentroX + i * (tuboRadioPx * 2 + sepEntrePx));

  // Separación real entre las 2 líneas (borde inferior de la de arriba al
  // borde superior de la de abajo) — debe ser mínimo 0.10 m (ver notasCruce).
  const separacionRealM = prof.profundidadM - (sup.profundidadM + (sup.tipoDef.tieneTuberia ? sup.diametroM : 0.01));

  const svgW = zanjaX0 + anchoPx + 96;
  const svgH = profFondoY + 50;

  function CotaVertical({ y0, y1, x, valor }) {
    if (y1 - y0 < 0.5) return null;
    const alto = y1 - y0;
    return (
      <g>
        <g stroke="#3C64AA" strokeWidth="1">
          <line x1={x} y1={y0} x2={x} y2={y1} />
          <line x1={x - 4} y1={y0} x2={x + 4} y2={y0} />
          <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
        </g>
        {alto < 18 ? (
          <text x={x + 6} y={y1 + 2.5} textAnchor="start" fontSize="6" fontWeight="600" fill="#3C64AA">
            {valor.toFixed(2)} m
          </text>
        ) : (
          <text x={x + 9} y={(y0 + y1) / 2} textAnchor="middle" fontSize="6.2" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${x + 9}, ${(y0 + y1) / 2})`}>
            {valor.toFixed(2)} m
          </text>
        )}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className={className}>
      <line x1={zanjaX0 - 20} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 20} y2={zanjaTopY} stroke="#152644" strokeWidth="1.4" />
      <polygon points={`${centroZanja - 5},${zanjaTopY - 11} ${centroZanja + 5},${zanjaTopY - 11} ${centroZanja},${zanjaTopY - 2}`} fill="#152644" />
      <text x={centroZanja} y={zanjaTopY - 16} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">Nivel de piso existente</text>

      <rect x={zanjaX0} y={zanjaTopY} width={anchoPx} height={profFondoY - zanjaTopY} fill="#F2E8D5" stroke="#152644" strokeWidth="1.3" />
      {Array.from({ length: 34 }).map((_, i) => (
        <circle key={i} cx={zanjaX0 + 8 + (i * 37) % (anchoPx - 12)} cy={zanjaTopY + 8 + Math.floor(i / 4) * 14} r="1" fill="#B8A67D" opacity="0.7" />
      ))}

      <text x={zanjaX0 - 12} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 - 6 : 12)} textAnchor="end" fontSize="7" fill="#152644">Material de la</text>
      <text x={zanjaX0 - 12} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 2 : 20)} textAnchor="end" fontSize="7" fill="#152644">excavación</text>
      <text x={zanjaX0 - 12} y={zanjaTopY + (cintaYPx > 30 ? cintaYPx / 2 + 10 : 28)} textAnchor="end" fontSize="7" fill="#152644">compactado</text>
      <text x={zanjaX0 - 12} y={zanjaTopY + cintaYPx + 3} textAnchor="end" fontSize="7.5" fill="#152644">Cinta de</text>
      <text x={zanjaX0 - 12} y={zanjaTopY + cintaYPx + 12} textAnchor="end" fontSize="7.5" fill="#152644">señalización</text>
      {sup.tipoDef.tieneTuberia && (
        <text x={zanjaX0 - 12} y={arenillaTopY + 4} textAnchor="end" fontSize="7.5" fill="#152644">Arenilla</text>
      )}
      <text x={zanjaX0 - 12} y={tuboY + alturaElementoPx / 2 + 4} textAnchor="end" fontSize="7.5" fontWeight="600" fill="#152644">{sup.tipoDef.label}</text>
      {prof.tipoDef.tieneTuberia && (
        <text x={zanjaX0 - 12} y={profTuboY + profAlturaPx / 2 + 4 - 9} textAnchor="end" fontSize="7" fill="#152644">Arenilla</text>
      )}
      <text x={zanjaX0 - 12} y={profTuboY + profAlturaPx / 2 + 4} textAnchor="end" fontSize="7.5" fontWeight="600" fill="#152644">{prof.tipoDef.label}</text>

      <line x1={centroZanja - cintaAnchoPx / 2} y1={zanjaTopY + cintaYPx} x2={centroZanja + cintaAnchoPx / 2} y2={zanjaTopY + cintaYPx} stroke="#DC2626" strokeWidth="3" />

      {sup.tipoDef.tieneTuberia && (
        <rect x={zanjaX0} y={arenillaTopY} width={anchoPx} height={fondoSupY - arenillaTopY} fill="#EFE3C8" stroke="#152644" strokeWidth="1" strokeDasharray="3 2" />
      )}
      {sup.tipoDef.tieneTuberia ? (
        centrosX.map((cx, i) => (
          <circle key={i} cx={cx} cy={tuboY + tuboRadioPx} r={tuboRadioPx} fill={`${sup.tipoDef.color}33`} stroke={sup.tipoDef.color} strokeWidth="1.6" />
        ))
      ) : (
        <circle cx={centroZanja} cy={tuboY + alturaElementoPx / 2} r="2.2" fill={sup.tipoDef.color} stroke="#152644" strokeWidth="0.8" />
      )}

      {/* Línea más profunda: LONGITUDINAL — atraviesa de un lado a otro,     */}
      {/* a SU propia profundidad, con el grosor de SU propio diámetro real. */}
      {prof.tipoDef.tieneTuberia && (
        <rect x={zanjaX0} y={profTuboY - profArenillaPx} width={anchoPx} height={profAlturaPx + profArenillaPx * 2} fill="#EFE3C8" stroke="#152644" strokeWidth="1" strokeDasharray="3 2" />
      )}
      <line x1={zanjaX0 + 6} y1={profTuboY + profAlturaPx / 2} x2={zanjaX0 + anchoPx - 6} y2={profTuboY + profAlturaPx / 2} stroke={prof.tipoDef.color} strokeWidth={profAlturaPx} strokeLinecap="round" />

      {/* Cotas jerárquicas a la derecha: piso→cinta, cinta→línea superior,   */}
      {/* separación entre ambas líneas (¡el valor clave del cruce!), y en   */}
      {/* paralelo, más alejada, la profundidad total de la zanja.          */}
      <CotaVertical y0={zanjaTopY} y1={zanjaTopY + cintaYPx} x={zanjaX0 + anchoPx + 18} valor={cintaYPx / scale} />
      <CotaVertical y0={zanjaTopY + cintaYPx} y1={tuboY} x={zanjaX0 + anchoPx + 18} valor={(tuboY - zanjaTopY - cintaYPx) / scale} />
      <CotaVertical y0={tuboY + alturaElementoPx} y1={profTuboY} x={zanjaX0 + anchoPx + 18} valor={separacionRealM} />
      <CotaVertical y0={profTuboY} y1={profTuboY + profAlturaPx} x={zanjaX0 + anchoPx + 18} valor={profAlturaPx / scale} />

      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0 + anchoPx + 40} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 40} y2={profFondoY - 16} />
        <line x1={zanjaX0 + anchoPx + 36} y1={zanjaTopY} x2={zanjaX0 + anchoPx + 44} y2={zanjaTopY} />
        <line x1={zanjaX0 + anchoPx + 36} y1={profFondoY - 16} x2={zanjaX0 + anchoPx + 44} y2={profFondoY - 16} />
      </g>
      <text x={zanjaX0 + anchoPx + 52} y={(zanjaTopY + profFondoY - 16) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${zanjaX0 + anchoPx + 52}, ${(zanjaTopY + profFondoY - 16) / 2})`}>
        {((profFondoY - 16 - zanjaTopY) / scale).toFixed(2)} m
      </text>

      <g stroke="#152644" strokeWidth="1">
        <line x1={zanjaX0} y1={profFondoY + 14} x2={zanjaX0 + anchoPx} y2={profFondoY + 14} />
        <line x1={zanjaX0} y1={profFondoY + 10} x2={zanjaX0} y2={profFondoY + 18} />
        <line x1={zanjaX0 + anchoPx} y1={profFondoY + 10} x2={zanjaX0 + anchoPx} y2={profFondoY + 18} />
      </g>
      <text x={centroZanja} y={profFondoY + 26} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {anchoZanjaM.toFixed(2)} m
      </text>
    </svg>
  );
}

/* Notas automáticas (observación de la Tabla 4 + validaciones dinámicas —  */
/* SPT siempre abajo, y la diferencia mínima de 0.20 m entre AC-BT y MT).  */
export function notasCruce(datos, plantillasCanalizaciones) {
  const d = datos || {};
  const plantillaA = plantillasCanalizaciones.find((p) => p.id === d.lineaAId);
  const plantillaB = plantillasCanalizaciones.find((p) => p.id === d.lineaBId);
  if (!plantillaA || !plantillaB) return [];
  const lineaA = datosLineaCruce(plantillaA, d.profundidadA);
  const lineaB = datosLineaCruce(plantillaB, d.profundidadB);
  const notas = [];
  const tabla4 = buscarTabla4(lineaA.tipoDef.id, lineaB.tipoDef.id);
  if (tabla4?.obs) notas.push(tabla4.obs);
  else if (!tabla4) notas.push('Esta pareja no está en la Tabla 4 del documento — se usan las profundidades normales de cada línea; ajústalas manualmente si aplica algún criterio especial.');
  const tieneSpt = lineaA.tipoDef.id === 'spt' || lineaB.tipoDef.id === 'spt';
  if (tieneSpt) {
    const spt = lineaA.tipoDef.id === 'spt' ? lineaA : lineaB;
    const otra = lineaA.tipoDef.id === 'spt' ? lineaB : lineaA;
    if (spt.profundidadM <= otra.profundidadM) notas.push(`⚠️ ${NOTA_SPT_SIEMPRE_ABAJO} Ajusta la profundidad: SPT está a ${spt.profundidadM.toFixed(2)} m, no más profundo que ${otra.tipoDef.label} (${otra.profundidadM.toFixed(2)} m).`);
    else notas.push(NOTA_SPT_SIEMPRE_ABAJO);
  }
  const idsACBT_MT = ['acbt_tuberia', 'acbt_directo', 'mt'];
  const esParAcbtMt = idsACBT_MT.includes(lineaA.tipoDef.id) && idsACBT_MT.includes(lineaB.tipoDef.id) && lineaA.tipoDef.id !== lineaB.tipoDef.id;
  if (esParAcbtMt) {
    const acbt = lineaA.tipoDef.id === 'mt' ? lineaB : lineaA;
    const mt = lineaA.tipoDef.id === 'mt' ? lineaA : lineaB;
    const generatrizInferiorAcbt = acbt.profundidadM + (acbt.tipoDef.tieneTuberia ? acbt.diametroM : 0.01);
    const diferencia = mt.profundidadM - generatrizInferiorAcbt;
    if (diferencia < 0.20) notas.push(`⚠️ La diferencia entre la generatriz inferior de AC-BT y la superior de AC-MT es de ${diferencia.toFixed(2)} m (debe ser mínimo 0.20 m).`);
  } else {
    // Regla general: mínimo 0.10 m entre el borde inferior de la línea de
    // arriba y el borde superior de la de abajo (AC-BT×MT usa su propia
    // regla más estricta de 0.20 m, de arriba, así que no se repite aquí).
    const [sup, prof] = lineaA.profundidadM <= lineaB.profundidadM ? [lineaA, lineaB] : [lineaB, lineaA];
    const bordeInferiorSup = sup.profundidadM + (sup.tipoDef.tieneTuberia ? sup.diametroM : 0.01);
    const separacion = prof.profundidadM - bordeInferiorSup;
    if (separacion < 0.10) notas.push(`⚠️ La separación entre ${sup.tipoDef.label} y ${prof.tipoDef.label} es de ${separacion.toFixed(2)} m (debe ser mínimo 0.10 m entre líneas que se cruzan).`);
  }
  notas.push('Queda a criterio de campo si cortar la cinta de señalización de la línea más profunda en el cruce, o dejarla, según facilidad constructiva.');
  return notas;
}

export function resumenCruce(datos, plantillasCanalizaciones) {
  const d = datos || {};
  if (d.esCruceConVia) {
    const plantilla = plantillasCanalizaciones.find((p) => p.id === d.lineaId);
    if (!plantilla) return ['Sin línea elegida'];
    const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === plantilla.tipo);
    const profundidad = d.profundidad || tipoDef?.profundidadNorma;
    return [`${tipoDef?.label} (${plantilla.nombre}): ${profundidad} m`, 'Cruce con vía (arenilla → concreto)'];
  }
  const plantillaA = plantillasCanalizaciones.find((p) => p.id === d.lineaAId);
  const plantillaB = plantillasCanalizaciones.find((p) => p.id === d.lineaBId);
  if (!plantillaA || !plantillaB) return ['Sin líneas elegidas'];
  const lineaA = datosLineaCruce(plantillaA, d.profundidadA);
  const lineaB = datosLineaCruce(plantillaB, d.profundidadB);
  const lineas = [lineaA, lineaB].sort((a, b) => a.profundidadM - b.profundidadM);
  return lineas.map((l) => `${l.tipoDef.label} (${l.nombre}): ${l.profundidadM.toFixed(2)} m`);
}

export function CruceForm({ plantilla, plantillasCanalizaciones, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => plantilla?.datos || { esCruceConVia: false, lineaAId: '', lineaBId: '', profundidadA: '', profundidadB: '', lineaId: '', profundidad: '', notas: '' });

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  // Al elegir/cambiar cualquiera de las 2 líneas, sugiere las profundidades
  // de la Tabla 4 automáticamente (si la pareja está en la tabla) — el
  // ingeniero puede seguir editándolas después. "tabla4.profA" SIEMPRE
  // corresponde al tipo que se pasó PRIMERO a buscarTabla4 (plantillaEsta),
  // sin importar si el campo que se está editando es A o B.
  function elegirLinea(campo, id) {
    const nuevosDatos = { ...datos, [campo]: id };
    const otroCampo = campo === 'lineaAId' ? 'lineaBId' : 'lineaAId';
    const plantillaEsta = plantillasCanalizaciones.find((p) => p.id === id);
    const plantillaOtra = plantillasCanalizaciones.find((p) => p.id === nuevosDatos[otroCampo]);
    if (plantillaEsta && plantillaOtra) {
      const tabla4 = buscarTabla4(plantillaEsta.tipo, plantillaOtra.tipo);
      if (tabla4) {
        const campoProfundidadEsta = campo === 'lineaAId' ? 'profundidadA' : 'profundidadB';
        const campoProfundidadOtra = campo === 'lineaAId' ? 'profundidadB' : 'profundidadA';
        nuevosDatos[campoProfundidadEsta] = String(tabla4.profA);
        nuevosDatos[campoProfundidadOtra] = String(tabla4.profB);
      }
    }
    setDatos(nuevosDatos);
  }
  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (datos.esCruceConVia) {
      if (!datos.lineaId) return;
    } else if (!datos.lineaAId || !datos.lineaBId || datos.lineaAId === datos.lineaBId) return;
    onSave(nombre.trim(), datos);
  }
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  const notas = datos.esCruceConVia ? [] : notasCruce(datos, plantillasCanalizaciones);
  const plantillaVia = plantillasCanalizaciones.find((p) => p.id === datos.lineaId);
  const tipoDefVia = plantillaVia ? CANALIZACION_TIPOS.find((t) => t.id === plantillaVia.tipo) : null;
  const datosPreviewVia = plantillaVia ? { ...plantillaVia.datos, profundidad: datos.profundidad || plantillaVia.datos?.profundidad, espesor_via: datos.espesor_via, cruzaConVia: true } : null;

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar cruce' : 'Nuevo cruce'}
      </p>

      <div className="flex gap-2 mb-5">
        <button type="button" onClick={() => set('esCruceConVia', false)} className={`text-sm font-semibold px-3 py-2 rounded-lg border ${!datos.esCruceConVia ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-600 border-navy-200'}`}>
          Cruce entre 2 líneas
        </button>
        <button type="button" onClick={() => set('esCruceConVia', true)} className={`text-sm font-semibold px-3 py-2 rounded-lg border ${datos.esCruceConVia ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-600 border-navy-200'}`}>
          Cruce de 1 línea con vía
        </button>
      </div>

      <div className="flex justify-center bg-navy-50 rounded-lg p-4 mb-5">
        <div className="w-full max-w-2xl">
          {datos.esCruceConVia ? (
            tipoDefVia ? <CanalizacionPreview tipoId={tipoDefVia.id} datos={datosPreviewVia} /> : (
              <svg viewBox="0 0 200 60"><text x="100" y="32" textAnchor="middle" fontSize="9" fill="#8A93A6">Elige la línea que cruza la vía</text></svg>
            )
          ) : (
            <CrucePreview datos={datos} plantillasCanalizaciones={plantillasCanalizaciones} />
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre del cruce</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={datos.esCruceConVia ? 'Ej. Cruce AC-MT con vía' : 'Ej. Cruce AC-MT con SPT'} className={cellInput} required />
      </div>

      {datos.esCruceConVia ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-navy-500 mb-1">Línea que cruza la vía</label>
            <select value={datos.lineaId} onChange={(e) => set('lineaId', e.target.value)} className={cellInput} required>
              <option value="">— Elegir —</option>
              {plantillasCanalizaciones.filter((p) => p.tipo !== 'combinacion').map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Profundidad (m)</label>
            <input value={datos.profundidad} onChange={(e) => set('profundidad', e.target.value)} placeholder={tipoDefVia ? String(tipoDefVia.profundidadNorma) : ''} className={cellInput} />
            <p className="text-[11px] text-navy-400 mt-0.5">Mínimo 0.60 m desde la rasante de la vía hasta la generatriz superior del ducto.</p>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de vía (m)</label>
            <input value={datos.espesor_via} onChange={(e) => set('espesor_via', e.target.value)} placeholder="0.10" className={cellInput} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-navy-500 mb-1">Notas</label>
            <input value={datos.notas} onChange={(e) => set('notas', e.target.value)} className={cellInput} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-navy-500 mb-1">Línea A</label>
            <select value={datos.lineaAId} onChange={(e) => elegirLinea('lineaAId', e.target.value)} className={cellInput} required>
              <option value="">— Elegir —</option>
              {plantillasCanalizaciones.filter((p) => p.tipo !== 'combinacion' && p.id !== datos.lineaBId).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Línea B</label>
            <select value={datos.lineaBId} onChange={(e) => elegirLinea('lineaBId', e.target.value)} className={cellInput} required>
              <option value="">— Elegir —</option>
              {plantillasCanalizaciones.filter((p) => p.tipo !== 'combinacion' && p.id !== datos.lineaAId).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Profundidad Línea A (m)</label>
            <input value={datos.profundidadA} onChange={(e) => set('profundidadA', e.target.value)} className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Profundidad Línea B (m)</label>
            <input value={datos.profundidadB} onChange={(e) => set('profundidadB', e.target.value)} className={cellInput} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-navy-500 mb-1">Notas</label>
            <input value={datos.notas} onChange={(e) => set('notas', e.target.value)} className={cellInput} />
          </div>
        </div>
      )}

      {notas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 space-y-1">
          {notas.map((n, i) => (
            <p key={i} className="text-xs text-amber-800">{n}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!nombre.trim() || (datos.esCruceConVia ? !datos.lineaId : (!datos.lineaAId || !datos.lineaBId || datos.lineaAId === datos.lineaBId))}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {plantilla ? 'Guardar cambios' : 'Crear cruce'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function CrucesView({ plantillas, plantillasCanalizaciones, onAdd, onUpdate, onDelete, perfil }) {
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [previewAmpliada, setPreviewAmpliada] = useState(null);

  // Mismo criterio que Canalizaciones: solo Ing. Civil o Líder Civil (o
  // Desarrollador) puede crear/editar/eliminar cruces.
  const puedeEditar = isDeveloper(perfil) || (perfil?.roles || []).some((r) => r === 'civil' || r === 'lider_civil');

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
  }
  function renderPreview(p, className) {
    const tipoDefVia = p.datos?.esCruceConVia ? CANALIZACION_TIPOS.find((t) => t.id === plantillasCanalizaciones.find((pl) => pl.id === p.datos.lineaId)?.tipo) : null;
    const plantillaViaBase = p.datos?.esCruceConVia ? plantillasCanalizaciones.find((pl) => pl.id === p.datos.lineaId) : null;
    if (p.datos?.esCruceConVia) {
      return tipoDefVia && plantillaViaBase ? (
        <CanalizacionPreview tipoId={tipoDefVia.id} datos={{ ...plantillaViaBase.datos, profundidad: p.datos.profundidad || plantillaViaBase.datos?.profundidad, espesor_via: p.datos.espesor_via, cruzaConVia: true }} className={className} />
      ) : null;
    }
    return <CrucePreview datos={p.datos} plantillasCanalizaciones={plantillasCanalizaciones} className={className} />;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Cruces</h1>
        <p className="text-navy-500 text-sm mt-1">
          Detalles de cruce entre 2 canalizaciones ya creadas (Tabla 4 del documento de criterios), o de una sola canalización con una vía.
        </p>
      </div>

      {!creando && !editandoId && puedeEditar && (
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg mb-5 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo cruce
        </button>
      )}
      {!puedeEditar && (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-5">
          <Lock className="w-3.5 h-3.5" /> Solo Ing. Civil o Líder Civil puede crear o editar cruces — aquí puedes verlos (clic en el dibujo para verlo más grande).
        </p>
      )}

      {(creando || editandoId) && puedeEditar && (
        <CruceForm
          plantilla={editandoId ? plantillas.find((p) => p.id === editandoId) : null}
          plantillasCanalizaciones={plantillasCanalizaciones}
          onCancel={cerrarFormulario}
          onSave={(nombre, datos) => {
            if (editandoId) onUpdate(editandoId, { nombre, datos });
            else onAdd(nombre, datos);
            cerrarFormulario();
          }}
        />
      )}

      {!creando && !editandoId && (
        plantillas.length === 0 ? (
          <p className="text-sm text-navy-400 italic text-center py-10">Aún no hay cruces creados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillas.map((p) => (
              <div key={p.id} className="bg-white border border-navy-200 rounded-xl p-4">
                <button
                  onClick={() => setPreviewAmpliada(p)}
                  className="flex items-center justify-center mb-2 w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                  title="Click para ampliar"
                >
                  {renderPreview(p, 'w-full h-auto')}
                </button>
                <p className="font-semibold text-navy-800 text-sm text-center mb-1">{p.nombre}</p>
                <div className="mb-3">
                  <ResumenLineas lineas={resumenCruce(p.datos, plantillasCanalizaciones)} size="text-xs" align="center" />
                </div>
                {puedeEditar && (
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button onClick={() => setEditandoId(p.id)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    {confirmandoId === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-navy-500">¿Eliminar?</span>
                        <button onClick={() => { onDelete(p.id); setConfirmandoId(null); }} className="text-xs font-bold text-red-600 hover:text-red-700">
                          Sí
                        </button>
                        <button onClick={() => setConfirmandoId(null)} className="text-xs text-navy-400 hover:text-navy-600">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmandoId(p.id)} className="text-xs font-semibold text-navy-400 hover:text-red-500 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Vista de visualización ampliada — clic afuera o en la X la cierra. */}
      {previewAmpliada && (
        <div className="fixed inset-0 z-50 bg-navy-900/90 flex items-center justify-center p-6 cursor-zoom-out" onClick={() => setPreviewAmpliada(null)}>
          <button onClick={() => setPreviewAmpliada(null)} className="absolute top-4 right-4 text-white bg-navy-800/70 hover:bg-navy-800 rounded-full p-2" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-full overflow-y-auto cursor-default" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-navy-800 text-center mb-3">{previewAmpliada.nombre}</p>
            {renderPreview(previewAmpliada, 'w-full h-auto')}
            <div className="mt-3">
              <ResumenLineas lineas={resumenCruce(previewAmpliada.datos, plantillasCanalizaciones)} size="text-sm" align="center" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CombinacionForm({ plantilla, plantillasCanalizaciones, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [lineaIds, setLineaIds] = useState(plantilla?.datos?.lineas || []);

  const opciones = plantillasCanalizaciones.filter((p) => p.tipo !== 'combinacion');
  const porTipo = {};
  opciones.forEach((p) => { (porTipo[p.tipo] = porTipo[p.tipo] || []).push(p); });

  function toggle(id) {
    setLineaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function submit(e) {
    e.preventDefault();
    if (!nombre.trim() || lineaIds.length < 2) return;
    onSave(nombre.trim(), { lineas: lineaIds });
  }
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla ? 'Editar combinación' : 'Nueva combinación'}
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-4 mb-5">
        <div className="w-full max-w-2xl">
          <CombinacionPreview lineaIds={lineaIds} plantillasCanalizaciones={plantillasCanalizaciones} />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la combinación</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder='Ej. AC-BT 2" + AC-BT 4"' className={cellInput} required />
      </div>

      <p className="block text-xs font-semibold uppercase text-navy-500 mb-2">
        Elige 2 o más plantillas ya creadas ({lineaIds.length} elegidas)
      </p>
      {opciones.length === 0 ? (
        <p className="text-sm text-navy-400 italic mb-4">Aún no hay plantillas de ningún tipo para combinar. Crea al menos 2 primero.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 max-h-80 overflow-y-auto border border-navy-100 rounded-lg p-3">
          {CANALIZACION_TIPOS.filter((t) => !t.esCombinacion && porTipo[t.id]?.length).map((t) => (
            <div key={t.id}>
              <p className="text-xs font-bold text-navy-600 mb-1">{t.label}</p>
              {porTipo[t.id].map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={lineaIds.includes(p.id)} onChange={() => toggle(p.id)} className="w-3.5 h-3.5 accent-lime-500" />
                  <span className="text-sm text-navy-700">{p.nombre}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      {lineaIds.length === 1 && <p className="text-xs text-amber-600 mb-4">Elige al menos una línea más (una combinación necesita 2 o más).</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={lineaIds.length < 2 || !nombre.trim()} className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          {plantilla ? 'Guardar cambios' : 'Crear combinación'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function CanalizacionesView({ plantillas, onAdd, onUpdate, onDelete, onSetPrincipal, diametrosTuberia, onAddDiametro, perfil }) {

  const [tipoActivo, setTipoActivo] = useState(CANALIZACION_TIPOS[0].id);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [previewAmpliada, setPreviewAmpliada] = useState(null);

  // Solo Ing. Civil o Líder Civil (o Desarrollador) puede crear/editar/
  // eliminar plantillas de Canalizaciones — el resto solo las visualiza
  // (con la vista ampliada para ver bien el detalle).
  const puedeEditar = isDeveloper(perfil) || (perfil?.roles || []).some((r) => r === 'civil' || r === 'lider_civil');

  const tipoDef = CANALIZACION_TIPOS.find((t) => t.id === tipoActivo);
  const plantillasDelTipo = plantillas.filter((p) => p.tipo === tipoActivo);

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Canalizaciones</h1>
        <p className="text-navy-500 text-sm mt-1">
          Secciones de zanja para líneas eléctricas y de comunicaciones enterradas — basadas en NTC 2050, RETIE y normas de los OR.
          La plantilla marcada como <strong>Principal</strong> es la vigente/más actualizada de cada tipo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CANALIZACION_TIPOS.map((t) => {
          const activo = tipoActivo === t.id;
          const cantidad = plantillas.filter((p) => p.tipo === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => { setTipoActivo(t.id); cerrarFormulario(); }}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
                activo ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-600 border-navy-200 hover:border-navy-400'
              }`}
            >
              {t.label}
              <span className={activo ? 'text-navy-300' : 'text-navy-400'}>({cantidad})</span>
            </button>
          );
        })}
      </div>

      {!creando && !editandoId && puedeEditar && (
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg mb-5 transition-colors"
        >
          <Plus className="w-4 h-4" /> {tipoDef.esCombinacion ? 'Nueva combinación' : `Nueva plantilla de ${tipoDef.label}`}
        </button>
      )}
      {!puedeEditar && (
        <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-5">
          <Lock className="w-3.5 h-3.5" /> Solo Ing. Civil o Líder Civil puede crear o editar estas plantillas — aquí puedes verlas (clic en el dibujo para verlo más grande).
        </p>
      )}

      {(creando || editandoId) && puedeEditar && (
        tipoDef.esCombinacion ? (
          <CombinacionForm
            plantilla={editandoId ? plantillasDelTipo.find((p) => p.id === editandoId) : null}
            plantillasCanalizaciones={plantillas}
            onCancel={cerrarFormulario}
            onSave={(nombre, datos) => {
              if (editandoId) onUpdate(editandoId, { nombre, datos }, false, tipoActivo);
              else onAdd(tipoActivo, nombre, datos, false);
              cerrarFormulario();
            }}
          />
        ) : (
          <CanalizacionForm
            tipoDef={tipoDef}
            plantilla={editandoId ? plantillasDelTipo.find((p) => p.id === editandoId) : null}
            onCancel={cerrarFormulario}
            onSave={(nombre, datos, esPrincipal) => {
              if (editandoId) onUpdate(editandoId, { nombre, datos }, esPrincipal, tipoActivo);
              else onAdd(tipoActivo, nombre, datos, esPrincipal);
              cerrarFormulario();
            }}
            diametrosTuberia={diametrosTuberia}
            onAddDiametro={onAddDiametro}
          />
        )
      )}

      {!creando && !editandoId && (
        plantillasDelTipo.length === 0 ? (
          <p className="text-sm text-navy-400 italic text-center py-10">
            {tipoDef.esCombinacion ? 'Aún no hay combinaciones.' : `Aún no hay plantillas de ${tipoDef.label}.`}
          </p>
        ) : (() => {
          function Tarjeta({ p }) {
            return (
              <div key={p.id} className={`bg-white border rounded-xl p-4 relative ${p.es_principal && !tipoDef.esCombinacion ? 'border-lime-400 ring-1 ring-lime-300' : 'border-navy-200'}`}>
                {p.es_principal && !tipoDef.esCombinacion && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold uppercase text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-lime-600 text-lime-600" /> Principal
                  </span>
                )}
                <button
                  onClick={() => setPreviewAmpliada(p)}
                  className="flex items-center justify-center mb-2 w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                  title="Click para ampliar"
                >
                  {tipoDef.esCombinacion ? (
                    <CombinacionPreview lineaIds={p.datos?.lineas} plantillasCanalizaciones={plantillas} className="w-full h-auto" />
                  ) : (
                    <CanalizacionPreview tipoId={p.tipo} datos={p.datos} className="w-full h-auto" />
                  )}
                </button>
                <p className="font-semibold text-navy-800 text-sm text-center mb-1">{p.nombre}</p>
                <div className="mb-3">
                  <ResumenLineas
                    lineas={tipoDef.esCombinacion ? resumenCombinacion(p.datos?.lineas, plantillas) : resumenCanalizacion(p.tipo, p.datos)}
                    size="text-xs" align="center"
                  />
                </div>
                {puedeEditar && (
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button onClick={() => setEditandoId(p.id)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    {!p.es_principal && !tipoDef.esCombinacion && (
                      <button onClick={() => onSetPrincipal(p.id, tipoActivo, p.datos)} className="text-xs font-semibold text-navy-500 hover:text-navy-700 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5" /> Marcar Principal
                      </button>
                    )}
                    {confirmandoId === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-navy-500">¿Eliminar?</span>
                        <button onClick={() => { onDelete(p.id); setConfirmandoId(null); }} className="text-xs font-bold text-red-600 hover:text-red-700">
                          Sí
                        </button>
                        <button onClick={() => setConfirmandoId(null)} className="text-xs text-navy-400 hover:text-navy-600">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmandoId(p.id)} className="text-xs font-semibold text-navy-400 hover:text-red-500 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          if (tipoDef.esCombinacion) {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plantillasDelTipo.map((p) => <Tarjeta key={p.id} p={p} />)}
              </div>
            );
          }

          // Agrupadas por sub-categoría (diámetro × cantidad, o calibre) —
          // cada una con su propia "Principal", independiente de las demás.
          const grupos = [];
          plantillasDelTipo.forEach((p) => {
            const key = subcategoriaKey(p.tipo, p.datos);
            let g = grupos.find((x) => x.key === key);
            if (!g) { g = { key, label: subcategoriaLabel(p.tipo, p.datos), items: [] }; grupos.push(g); }
            g.items.push(p);
          });
          return (
            <div className="space-y-6">
              {grupos.map((g) => (
                <div key={g.key}>
                  <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2 border-b border-navy-100 pb-1.5">
                    {g.label} <span className="text-navy-300 font-normal">({g.items.length})</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {g.items.map((p) => <Tarjeta key={p.id} p={p} />)}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Vista de visualización ampliada — clic afuera o en la X la cierra. */}
      {previewAmpliada && (
        <div className="fixed inset-0 z-50 bg-navy-900/90 flex items-center justify-center p-6 cursor-zoom-out" onClick={() => setPreviewAmpliada(null)}>
          <button onClick={() => setPreviewAmpliada(null)} className="absolute top-4 right-4 text-white bg-navy-800/70 hover:bg-navy-800 rounded-full p-2" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-full overflow-y-auto cursor-default" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-navy-800 text-center mb-3">{previewAmpliada.nombre}</p>
            {tipoDef.esCombinacion ? (
              <CombinacionPreview lineaIds={previewAmpliada.datos?.lineas} plantillasCanalizaciones={plantillas} className="w-full h-auto" />
            ) : (
              <CanalizacionPreview tipoId={previewAmpliada.tipo} datos={previewAmpliada.datos} className="w-full h-auto" />
            )}
            <div className="mt-3">
              <ResumenLineas
                lineas={tipoDef.esCombinacion ? resumenCombinacion(previewAmpliada.datos?.lineas, plantillas) : resumenCanalizacion(previewAmpliada.tipo, previewAmpliada.datos)}
                size="text-sm" align="center"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanalizacionesView;
