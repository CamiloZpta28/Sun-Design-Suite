/* ============================================================================
   CIMENTACIONES — cálculos, dibujos técnicos y formularios
   ----------------------------------------------------------------------------
   Movido literal desde App.jsx: los 9 tipos de cimentación con su despiece de
   acero, sus vistas (isométrico, plantas, elevaciones, cortes) y sus
   formularios. Es la parte más pesada de la aplicación, así que se descarga
   solo cuando alguien abre Cimentaciones — o cuando una pestaña de un
   proyecto necesita dibujar la plantilla elegida (ver PreviewPlantilla).

   Lo liviano (tipos, parámetros de acero, resúmenes de texto) está en
   cimentacionesDatos.js, que sí se carga siempre.
   ============================================================================ */

import React, { useState } from 'react';
import {
  Building2, ChevronLeft, CircleDot, Copy, Home, KeyRound, Lightbulb, Lock,
  Pencil, Plus, Trash2, Video, Wrench, X, Zap,
} from 'lucide-react';
import { ResumenLineas } from '../shared/ui.jsx';
import { isDeveloper } from '../shared/permisos.js';
import AddableSelect from '../shared/AddableSelect.jsx';
import SelectOrOtro from '../technical-notes/SelectOrOtro.jsx';
import {
  CIMENTACION_TIPOS, CIMENTACION_RESUMENES, RECUBRIMIENTO_CIMENTACION,
  BARRA_ACERO, TRASLAPO_TABLE, CALIBRES_DISPONIBLES, obtenerTraslapo,
} from './cimentacionesDatos.js';

export function MallaPicker({ value, mallas, onChange, onAddNew }) {
  return (
    <AddableSelect
      value={value}
      opciones={mallas}
      onChange={onChange}
      onAddNew={onAddNew}
      placeholderNuevo="Nombre del nuevo tipo de malla"
      etiquetaAgregar="+ Agregar nuevo tipo de malla…"
    />
  );
}

/* Resistencias de concreto más usadas + opción de escribir otra, compartida  */
/* por TODAS las cimentaciones (shelter, inversores, cerramiento, portón,     */
/* luminarias, CCTV, postes) — sin valor por defecto a propósito, para no     */
/* afectar especialidades fuera del alcance de esta funcionalidad.            */
export const RESISTENCIA_OPCIONES = ['21 MPa', '24 MPa', '28 MPa', '31 MPa', '35 MPa'];
export function ResistenciaSelect({ value, onChange, className }) {
  return (
    <SelectOrOtro
      value={value}
      opciones={RESISTENCIA_OPCIONES}
      onChange={onChange}
      className={className}
      placeholder="Ej. 28 MPa"
    />
  );
}

/* Calibre de barra de refuerzo. Las 4 opciones con datos conocidos de       */
/* gancho/peso (ver BARRA_ACERO) + "otro" para casos fuera de tabla — en ese */
/* caso los cálculos de peso simplemente no se pueden hacer (se muestra —). */
export function CalibreSelect({ value, onChange, className }) {
  return (
    <SelectOrOtro
      value={value}
      opciones={CALIBRES_DISPONIBLES}
      onChange={onChange}
      className={className}
      placeholder="Ej. #4"
    />
  );
}

/* Los 6 tipos de cimentación de la sección "Cimentaciones" (plantillas       */
/* reutilizables entre proyectos), ordenados de menos a más complejo. Se van  */
/* construyendo de a uno — "disponible: false" muestra un aviso de "muy      */
/* pronto" en vez del formulario, sin quitar el tipo de la lista.            */

/* Barras longitudinales de un pedestal: longitud = altura - 2×recubrimiento */
/* + (N.° de ganchos × longitud de gancho de ese calibre). Devuelve null si  */
/* falta algún dato o el calibre no está en la tabla (ej. "Otro").          */
export function calcularLongitudinales({ altura, cantidad, calibre, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const alturaNum = parseFloat(altura);
  const cantidadNum = parseFloat(cantidad);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !alturaNum || !cantidadNum) return null;
  const longitud = alturaNum - 2 * RECUBRIMIENTO_CIMENTACION + ganchosNum * info.gancho;
  const pesoBarra = longitud * info.peso;
  const pesoPedestal = pesoBarra * cantidadNum;
  return { longitud, pesoBarra, pesoPedestal, pesoTotal: pesoPedestal * 2, cantidad: cantidadNum };
}

/* Estribos de un pedestal: cantidad = altura/separación + 1 (redondeando    */
/* hacia arriba). Longitud = 2×(ancho+profundo−4×recubrimiento) + 2×gancho.  */
export function calcularEstribos({ altura, ancho, profundo, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const alturaNum = parseFloat(altura);
  const anchoNum = parseFloat(ancho);
  const profundoNum = parseFloat(profundo);
  const separacionNum = parseFloat(separacion);
  if (!info || !alturaNum || !anchoNum || !profundoNum || !separacionNum) return null;
  const cantidad = Math.ceil((alturaNum - 2 * RECUBRIMIENTO_CIMENTACION) / separacionNum);
  const longitud = 2 * (anchoNum + profundoNum - 4 * RECUBRIMIENTO_CIMENTACION) + 2 * info.gancho;
  const pesoEstribo = longitud * info.peso;
  const pesoPedestal = pesoEstribo * cantidad;
  return { cantidad, longitud, pesoEstribo, pesoPedestal, pesoTotal: pesoPedestal * 2 };
}

/* Parrilla de acero de la zapata del Portón: barras en las dos direcciones, */
/* cada una con 2 ganchos hacia arriba. La CANTIDAD ya no se digita — se     */
/* calcula sola con la misma fórmula que diste: techo[(x−2a)/b)], SIN +1.   */
/* Convención: las barras "longitudinales" corren a lo largo de "largo" y   */
/* se reparten a lo ANCHO de la zapata; las "transversales" corren a lo     */
/* ancho y se reparten a lo LARGO. Cada barra lleva 2 ganchos (uno en cada  */
/* extremo, apuntando hacia arriba).                                        */
export function calcularParrillaZapata({ ancho, largo, longitudinal, transversal }) {
  const anchoNum = parseFloat(ancho);
  const largoNum = parseFloat(largo);
  const resultado = {};

  const infoLong = BARRA_ACERO[longitudinal?.calibre];
  const sepLong = parseFloat(longitudinal?.separacion);
  if (anchoNum && largoNum && infoLong && sepLong) {
    const cantidad = Math.ceil((anchoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepLong);
    const longitudBarra = largoNum - 2 * RECUBRIMIENTO_CIMENTACION + 2 * infoLong.gancho;
    const pesoBarra = longitudBarra * infoLong.peso;
    resultado.longitudinal = { cantidad, longitud: longitudBarra, pesoBarra, pesoTotal: pesoBarra * cantidad };
  }

  const infoTrans = BARRA_ACERO[transversal?.calibre];
  const sepTrans = parseFloat(transversal?.separacion);
  if (anchoNum && largoNum && infoTrans && sepTrans) {
    const cantidad = Math.ceil((largoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepTrans);
    const longitudBarra = anchoNum - 2 * RECUBRIMIENTO_CIMENTACION + 2 * infoTrans.gancho;
    const pesoBarra = longitudBarra * infoTrans.peso;
    resultado.transversal = { cantidad, longitud: longitudBarra, pesoBarra, pesoTotal: pesoBarra * cantidad };
  }

  return resultado;
}

/* Barras longitudinales de la viga de amarre: 8 piezas en total (4 líneas —  */
/* 2 arriba, 2 abajo en las esquinas de la sección — cada línea formada por  */
/* 2 piezas traslapadas a la mitad del recorrido). El acero va de centro a   */
/* centro de zapata, por eso cada pieza mide (separación + traslapo)/2. El   */
/* traslapo sale de la tabla NSR-10 según calibre y resistencia.            */
/* Traslapo de las barras superiores/inferiores a TERCIOS del recorrido —    */
/* no a la mitad — y con el traslapo de arriba y de abajo en tercios         */
/* distintos (arriba en L/3, abajo en 2L/3) para no debilitar la misma       */
/* sección con dos empalmes encimados. Con esto, cada línea (2 arriba +      */
/* 2 abajo = 4 líneas) queda formada por UNA pieza corta (≈L/3) y UNA pieza  */
/* larga (≈2L/3), cada una con medio traslapo de más para poder solaparse.  */
export function calcularBarrasVigaAmarre({ separacionCentros, calibre, resistencia, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const L = parseFloat(separacionCentros);
  const traslapo = obtenerTraslapo(calibre, resistencia);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !L || traslapo === null) return null;
  const extraGancho = ganchosNum * info.gancho; // el gancho va en el extremo que ancla en la zapata, no en el del traslapo
  const piezaCorta = L / 3 + traslapo / 2 + extraGancho;
  const piezaLarga = (2 * L) / 3 + traslapo / 2 + extraGancho;
  const pesoCorta = piezaCorta * info.peso;
  const pesoLarga = piezaLarga * info.peso;
  // 4 líneas (2 arriba + 2 abajo), cada una con 1 pieza corta + 1 larga = 8 piezas en total.
  const piezasPorTipo = 4;
  return {
    traslapo,
    piezaCorta,
    piezaLarga,
    piezasPorTipo,
    piezas: piezasPorTipo * 2,
    pesoTotal: (pesoCorta + pesoLarga) * piezasPorTipo,
  };
}

/* Volúmenes combinados de TODO el conjunto Portón (2 zapatas + viga que las */
/* une + 2 pedestales encima). El pedestal no aporta a excavación ni a      */
/* solado — su tramo enterrado ya queda dentro de la excavación/solado de   */
/* la zapata; solo aporta su propio concreto (la parte que sobresale de la  */
/* zapata).                                                                  */
export function calcularVolumenesPorton({ zapata, viga, pedestal, separacionZapatas, desplante, espesorSolado }) {
  const zAncho = parseFloat(zapata.ancho) || 0;
  const zLargo = parseFloat(zapata.largo) || 0;
  const zEspesor = parseFloat(zapata.espesor) || 0;
  const vAncho = parseFloat(viga.ancho) || 0;
  const vAlto = parseFloat(viga.alto) || 0;
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const desp = parseFloat(desplante) || 0;
  const pAltura = Math.max(0, desp - zEspesor); // altura del pedestal = desplante − espesor de zapata
  const separacion = parseFloat(separacionZapatas) || 0;
  const esp = parseFloat(espesorSolado) || 0;
  if (!zAncho || !zLargo || !separacion) return null;

  const distanciaCarasInternas = Math.max(0, separacion - zLargo);
  const longitudViga = separacion - zLargo; // la viga corre entre las caras internas de las zapatas

  const concretoZapatas = zAncho * zLargo * zEspesor * 2;
  const concretoViga = longitudViga > 0 ? vAncho * vAlto * longitudViga : 0;
  const concretoPedestales = pAncho * pProfundo * pAltura * 2;

  const huellaConjunto = zAncho * zLargo * 2 + distanciaCarasInternas * vAncho;
  const profundidad = desp + esp;

  return {
    concreto: concretoZapatas + concretoViga + concretoPedestales,
    excavacion: huellaConjunto * profundidad,
    solado: huellaConjunto * esp,
    longitudViga,
  };
}

/* ============================================================ */
/* SHELTER · CENTRO DE TRANSFORMACIÓN (CT) — 4 pedestales iguales */
/* + 4 vigas (2 largas, 2 cortas) formando un marco. Sin zapata.  */
/* ============================================================ */

/* Barras longitudinales de una viga del CT: son CONTINUAS (sin traslapo,    */
/* a diferencia del Portón) — van de cara externa a cara externa de los     */
/* pedestales, para asegurar el cruce del acero en las esquinas. La         */
/* "dimensión del pedestal" que se suma es la que corre en la MISMA         */
/* dirección que la viga (así, para una viga larga se suma el profundo del  */
/* pedestal; para una corta, el ancho).                                     */
export function calcularBarrasVigaCT({ longitudCentros, dimensionPedestalMismaDireccion, cantidad, calibre, ganchos }) {
  const info = BARRA_ACERO[calibre];
  const L = parseFloat(longitudCentros);
  const dimPed = parseFloat(dimensionPedestalMismaDireccion);
  const cantidadNum = parseFloat(cantidad);
  const ganchosNum = parseFloat(ganchos) || 0;
  if (!info || !L || !cantidadNum) return null;
  const longitud = L + (dimPed || 0) + ganchosNum * info.gancho;
  const pesoBarra = longitud * info.peso;
  return { longitud, pesoBarra, pesoTotal: pesoBarra * cantidadNum, cantidad: cantidadNum };
}

/* Volúmenes del conjunto CT: 4 pedestales (con su propio solado, como los   */
/* de Postes MT/Inversores — sin zapata) + 4 vigas (2 largas + 2 cortas,     */
/* corriendo entre las caras INTERNAS de los pedestales — su propio         */
/* concreto no incluye lo que ya cuenta el pedestal). Solo los pedestales    */
/* se excavan; las vigas quedan al nivel del terreno natural (su parte de    */
/* arriba coincide con el N.T.N.), igual que la losa de Inversores.         */
export function calcularVolumenesCT({ ancho, largo, pedestal, viga, desplante, sobresaliente, espesorSolado }) {
  const anchoNum = parseFloat(ancho) || 0;
  const largoNum = parseFloat(largo) || 0;
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const vAncho = parseFloat(viga.ancho) || 0;
  const vAlto = parseFloat(viga.alto) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesorSolado) || 0;
  if (!anchoNum || !largoNum || !pAncho || !pProfundo) return null;

  const alturaPedestal = desp + sobre; // el N.T.N. coincide con la parte de arriba de la viga
  const areaPedestal = pAncho * pProfundo;
  const concretoPedestales = areaPedestal * alturaPedestal * 4;

  const longitudLibreLarga = Math.max(0, largoNum - pProfundo);
  const longitudLibreCorta = Math.max(0, anchoNum - pAncho);
  const concretoVigas = vAncho * vAlto * (longitudLibreLarga * 2 + longitudLibreCorta * 2);

  return {
    concreto: concretoPedestales + concretoVigas,
    excavacion: areaPedestal * (desp + esp) * 4, // solo los pedestales
    solado: areaPedestal * esp * 4,
    alturaPedestal,
    longitudLibreLarga,
    longitudLibreCorta,
  };
}

/* Perímetro de acero "centrado" en el espesor de pared — no el exterior ni  */
/* el interior, sino el que realmente recorre la barra dentro del muro.    */
export function perimetroCentradoTrampa(ancho, profundo, espesorPared) {
  return 2 * (ancho - espesorPared) + 2 * (profundo - espesorPared);
}

/* Anillos horizontales de la trampa de aceite: continuos, con un gancho a  */
/* 180° en CADA extremo. La cantidad se calcula igual que los estribos      */
/* (altura − 2×recubrimiento, entre la separación).                        */
export function calcularAnillosTrampa({ ancho, profundo, alto, espesorPared, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const anchoNum = parseFloat(ancho);
  const profundoNum = parseFloat(profundo);
  const altoNum = parseFloat(alto);
  const espPared = parseFloat(espesorPared);
  const sepNum = parseFloat(separacion);
  if (!info || !anchoNum || !profundoNum || !altoNum || !espPared || !sepNum) return null;
  const cantidad = Math.ceil((altoNum - 2 * RECUBRIMIENTO_CIMENTACION) / sepNum);
  const perimetro = perimetroCentradoTrampa(anchoNum, profundoNum, espPared);
  const longitud = perimetro + 2 * info.gancho;
  const pesoAnillo = longitud * info.peso;
  return { cantidad, longitud, pesoAnillo, pesoTotal: pesoAnillo * cantidad };
}

/* Barras verticales en "U" de la trampa de aceite: bajan por una pared,     */
/* cruzan la losa y suben por la pared opuesta, con gancho a 180° en cada   */
/* extremo de arriba. "direccion" define cuál par de paredes conectan       */
/* (largo → paredes largas, separadas por el ancho; corto → paredes         */
/* cortas, separadas por el profundo) — la cantidad de piezas se reparte a  */
/* lo largo de la dirección PERPENDICULAR, con la misma fórmula que la      */
/* parrilla de la zapata del Portón.                                       */
export function calcularUTrampa({ dimensionTransversal, dimensionReparto, alto, espesorPared, separacion, calibre }) {
  const info = BARRA_ACERO[calibre];
  const dimTrans = parseFloat(dimensionTransversal);
  const dimRep = parseFloat(dimensionReparto);
  const altoNum = parseFloat(alto);
  const espPared = parseFloat(espesorPared);
  const sepNum = parseFloat(separacion);
  if (!info || !dimTrans || !dimRep || !altoNum || !espPared || !sepNum) return null;
  const cantidad = Math.ceil((dimRep - 2 * RECUBRIMIENTO_CIMENTACION) / sepNum);
  const pata = altoNum - RECUBRIMIENTO_CIMENTACION; // una sola pata: el otro "extremo" continúa hacia la losa, no lleva recubrimiento doble
  const tramoInferior = dimTrans - espPared; // centrado en el espesor de las paredes que conecta
  const longitud = 2 * pata + tramoInferior + 2 * info.gancho;
  const pesoBarra = longitud * info.peso;
  return { cantidad, longitud, pesoBarra, pesoTotal: pesoBarra * cantidad };
}

/* Volúmenes de la trampa de aceite: una caja de concreto (4 paredes + losa  */
/* inferior, sin losa superior) — se calcula como el bloque sólido exterior */
/* menos el hueco interior (que empieza encima de la losa).                */
export function calcularVolumenesTrampa({ ancho, profundo, alto, espesorPared, espesorLosa, espesorSolado }) {
  const anchoNum = parseFloat(ancho) || 0;
  const profundoNum = parseFloat(profundo) || 0;
  const altoNum = parseFloat(alto) || 0;
  const espPared = parseFloat(espesorPared) || 0;
  const espLosa = parseFloat(espesorLosa) || 0;
  const espSolado = parseFloat(espesorSolado) || 0;
  if (!anchoNum || !profundoNum || !altoNum) return null;

  const volSolido = anchoNum * profundoNum * altoNum;
  const anchoHueco = Math.max(0, anchoNum - 2 * espPared);
  const profundoHueco = Math.max(0, profundoNum - 2 * espPared);
  const altoHueco = Math.max(0, altoNum - espLosa);
  const volHueco = anchoHueco * profundoHueco * altoHueco;

  return {
    concreto: volSolido - volHueco,
    excavacion: anchoNum * profundoNum * (altoNum + espSolado),
    solado: anchoNum * profundoNum * espSolado,
  };
}

/* Volúmenes (concreto, excavación, solado) de un elemento CILÍNDRICO         */
/* (Postes MT): concreto = área × altura total; excavación = área ×          */
/* desplante (solo la parte enterrada); solado = área × su espesor. El       */
/* solado tiene la MISMA sección que el elemento (sin sobresalir).          */
export function calcularVolumenesCilindro({ diametro, desplante, sobresaliente, espesor_solado }) {
  const d = parseFloat(diametro) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesor_solado) || 0;
  if (!d) return null;
  const areaSeccion = Math.PI * (d / 2) * (d / 2);
  const alturaTotal = desp + sobre;
  return {
    areaSeccion,
    concreto: areaSeccion * alturaTotal,
    excavacion: areaSeccion * (desp + esp), // la excavación llega hasta el fondo del solado, no solo el desplante
    solado: areaSeccion * esp,
  };
}

/* Lo mismo, pero para un elemento de sección RECTANGULAR (Luminarias,       */
/* Cámaras, y los pedestales de Inversores).                                 */
export function calcularVolumenesPrisma({ ancho, profundo, desplante, sobresaliente, espesor_solado }) {
  const a = parseFloat(ancho) || 0;
  const p = parseFloat(profundo) || 0;
  const desp = parseFloat(desplante) || 0;
  const sobre = parseFloat(sobresaliente) || 0;
  const esp = parseFloat(espesor_solado) || 0;
  if (!a || !p) return null;
  const areaSeccion = a * p;
  const alturaTotal = desp + sobre;
  return {
    areaSeccion,
    concreto: areaSeccion * alturaTotal,
    excavacion: areaSeccion * (desp + esp), // la excavación llega hasta el fondo del solado, no solo el desplante
    solado: areaSeccion * esp,
  };
}

/* Panel de resumen de volúmenes (concreto, excavación, solado), reutilizado */
/* en todas las plantillas de cimentación.                                  */
/* Volúmenes de Inversores: 2 pedestales iguales + 1 losa. La losa va sobre  */
/* el nivel de terreno natural, así que NO cuenta en la excavación — esa    */
/* solo se calcula con los pedestales.                                      */
export function calcularVolumenesInversores({ pedestal, losa }) {
  const pAncho = parseFloat(pedestal.ancho) || 0;
  const pProfundo = parseFloat(pedestal.profundo) || 0;
  const desplante = parseFloat(pedestal.desplante) || 0;
  const sobresaliente = parseFloat(pedestal.sobresaliente) || 0;
  const espSolado = parseFloat(pedestal.espesor_solado) || 0;
  const lAncho = parseFloat(losa.ancho) || 0;
  const lLargo = parseFloat(losa.largo) || 0;
  const lEspesor = parseFloat(losa.espesor) || 0;
  if (!pAncho || !pProfundo) return null;

  const areaPedestal = pAncho * pProfundo;
  const alturaPedestal = desplante + sobresaliente;
  const volConcretoPedestales = areaPedestal * alturaPedestal * 2;
  const volConcretoLosa = lAncho && lLargo && lEspesor ? lAncho * lLargo * lEspesor : 0;

  return {
    concreto: volConcretoPedestales + volConcretoLosa,
    excavacion: areaPedestal * (desplante + espSolado) * 2, // solo los pedestales (hasta el fondo del solado) — la losa no se excava
    solado: areaPedestal * espSolado * 2,
  };
}

export function ResumenVolumenes({ volumenes, pesoAcero, titulo = 'Cantidades de obra' }) {
  if (!volumenes) return null;
  return (
    <div className="mt-4 bg-lime-50 border border-lime-200 rounded-lg px-4 py-3">
      <p className="text-sm font-semibold text-navy-700 mb-2">{titulo}</p>
      <div className={pesoAcero !== undefined ? 'grid grid-cols-1 sm:grid-cols-4 gap-2' : 'grid grid-cols-1 sm:grid-cols-3 gap-2'}>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de concreto</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.concreto.toFixed(3)} m³</span>
        </div>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de excavación</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.excavacion.toFixed(3)} m³</span>
        </div>
        <div className="flex items-center justify-between sm:block">
          <span className="text-xs text-navy-500">Volumen de solado</span>
          <span className="font-mono font-bold text-navy-800 sm:block">{volumenes.solado.toFixed(3)} m³</span>
        </div>
        {pesoAcero !== undefined && (
          <div className="flex items-center justify-between sm:block">
            <span className="text-xs text-navy-500">Peso de acero</span>
            <span className="font-mono font-bold text-navy-800 sm:block">{pesoAcero.toFixed(2)} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Lienzo y escala COMPARTIDOS por las 3 vistas de Postes MT, para que se     */
/* vean alineadas entre sí (mismo tamaño en pantalla = mismo tamaño real).   */
export const POSTE_VB_W = 200;
export const POSTE_VB_H = 195;
export const POSTE_M2PX = 80;
export const POSTE_CSS_SIZE = 'w-56 h-56';

/* Dibujo tipo plano técnico (líneas negras, sin relleno de color) de un      */
/* poste MT: cilindro + solado de limpieza (mismo cilindro, más corto) +     */
/* cotas de diámetro y altura + nivel de terreno natural (como un plano      */
/* elíptico, coherente con la perspectiva del cilindro). No es a escala      */
/* exacta, solo ilustrativo.                                                 */
export function PostesMtPreview({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const diamPx = clamp((diametro || 0.3) * POSTE_M2PX, 28, 85);
  const rx = diamPx / 2;
  const ry = rx * 0.32;
  const alturaPx = clamp((altura || 0.3) * POSTE_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * POSTE_M2PX, 5, 11);

  const cx = POSTE_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;
  const groundRx = rx + 20;
  const groundRy = ry + (ry / rx) * 20;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      {/* Solado de limpieza: misma huella (mismo diámetro), solo más corto */}
      <g>
        <line x1={cx - rx} y1={botY} x2={cx - rx} y2={soladoBotY} stroke="#152644" strokeWidth="1.1" />
        <line x1={cx + rx} y1={botY} x2={cx + rx} y2={soladoBotY} stroke="#152644" strokeWidth="1.1" />
        <ellipse cx={cx} cy={soladoBotY} rx={rx} ry={ry} fill="#F6F7F9" stroke="#152644" strokeWidth="1.1" />
      </g>
      {/* Cuerpo del cilindro (poste) */}
      <line x1={cx - rx} y1={topY} x2={cx - rx} y2={botY} stroke="#152644" strokeWidth="1.3" />
      <line x1={cx + rx} y1={topY} x2={cx + rx} y2={botY} stroke="#152644" strokeWidth="1.3" />
      <ellipse cx={cx} cy={botY} rx={rx} ry={ry} fill="none" stroke="#152644" strokeWidth="1.3" />
      <ellipse cx={cx} cy={topY} rx={rx} ry={ry} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Nivel de terreno natural: un plano (elipse) que atraviesa el poste, no una línea recta */}
      <ellipse cx={cx} cy={groundY} rx={groundRx} ry={groundRy} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - groundRx - 4} y={groundY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de diámetro */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - rx} y1={soladoBotY + ry + 18} x2={cx + rx} y2={soladoBotY + ry + 18} />
        <line x1={cx - rx} y1={soladoBotY + ry + 14} x2={cx - rx} y2={soladoBotY + ry + 22} />
        <line x1={cx + rx} y1={soladoBotY + ry + 14} x2={cx + rx} y2={soladoBotY + ry + 22} />
      </g>
      <text x={cx} y={soladoBotY + ry + 35} textAnchor="middle" fontSize="10" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + rx + 40} y1={topY} x2={cx + rx + 40} y2={botY} />
        <line x1={cx + rx + 36} y1={topY} x2={cx + rx + 44} y2={topY} />
        <line x1={cx + rx + 36} y1={botY} x2={cx + rx + 44} y2={botY} />
      </g>
      <text
        x={cx + rx + 50}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + rx + 50}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D, sin perspectiva): un rectángulo   */
/* — ancho = diámetro, alto = altura total — con el solado, el nivel de     */
/* terreno (aquí sí una línea recta, porque es una vista plana real) y las   */
/* cotas de ancho y alto. Usa el mismo lienzo/escala que el isométrico para  */
/* que las tres vistas se vean alineadas entre sí.                          */
export function PostesMtSeccionLongitudinal({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((diametro || 0.3) * POSTE_M2PX, 30, 100);
  const alturaPx = clamp((altura || 0.3) * POSTE_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * POSTE_M2PX, 5, 11);

  const cx = POSTE_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      {/* Solado */}
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Cuerpo (vista frontal) */}
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Nivel de terreno natural (línea recta: aquí sí es correcto, es una vista plana) */}
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho (diámetro) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
      {/* Cota de alto */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un círculo con la cota del      */
/* diámetro. Mismo lienzo/escala que las otras dos vistas.                  */
export function PostesMtSeccionTransversal({ datos }) {
  const diametro = parseFloat(datos.diametro) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rr = clamp((diametro || 0.3) * POSTE_M2PX, 28, 85) / 2;

  const cx = POSTE_VB_W / 2;
  const cy = POSTE_VB_H / 2 - 10;

  return (
    <svg viewBox={`0 0 ${POSTE_VB_W} ${POSTE_VB_H}`} className={POSTE_CSS_SIZE}>
      <circle cx={cx} cy={cy} r={rr} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - rr} y1={cy} x2={cx + rr} y2={cy} stroke="#152644" strokeWidth="1" />
      <line x1={cx - rr} y1={cy - 5} x2={cx - rr} y2={cy + 5} stroke="#152644" strokeWidth="1" />
      <line x1={cx + rr} y1={cy - 5} x2={cx + rr} y2={cy + 5} stroke="#152644" strokeWidth="1" />
      <text x={cx} y={cy + rr + 20} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        Ø {diametro || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas (isométrico + las 2 secciones 2D) lado a lado, cada     */
/* una con su etiqueta — así se ve como un plano técnico real.              */
export function PostesMtVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <PostesMtPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <PostesMtSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <PostesMtSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

export function PostesMtForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { diametro: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesCilindro(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Postes MT
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <PostesMtVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Poste MT Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Diámetro (m)</label>
            <input value={datos.diametro} onChange={(e) => set('diametro', e.target.value)} placeholder="0.30" className={cellInput} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="1.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* Lienzo y escala compartidos por las 3 vistas de Luminarias — mismo         */
/* criterio que Postes MT, pero con sección cuadrada (isométrico con caja    */
/* rectangular en vez de cilindro).                                          */
export const LUMI_VB_W = 200;
export const LUMI_VB_H = 195;
export const LUMI_M2PX = 80;
export const LUMI_CSS_SIZE = 'w-56 h-56';

/* Isométrico de una cimentación de sección rectangular (o cuadrada, si       */
/* ancho = profundo): caja + solado (misma forma, un poco más ancha y corta) */
/* + plano de terreno natural (un paralelogramo coherente con la perspectiva) */
/* + cotas independientes de ancho y profundo (una en cada borde visible de   */
/* la base) + cota de altura.                                                */
export function LuminariasPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 26, 65);
  const profundoPx = clamp((profundo || 0.3) * LUMI_M2PX, 26, 65);
  const alturaPx = clamp((altura || 0.3) * LUMI_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * LUMI_M2PX, 5, 11);
  const groundFrac = altura > 0 ? desplante / altura : 0;

  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const bodyZ0 = soladoPx;
  const bodyZ1 = soladoPx + alturaPx;
  const groundZ = soladoPx + groundFrac * alturaPx;

  const ox = LUMI_VB_W / 2;
  const oy = 18 + Math.max(halfW, halfD) + bodyZ1;

  const soladoHalfW = halfW;
  const soladoHalfD = halfD;
  const groundHalfW = halfW + 16;
  const groundHalfD = halfD + 16;

  const [groundLeftX, groundLeftY] = isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy);
  const groundPlane = poly([
    isoPt(-groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, groundHalfD, groundZ, ox, oy),
    isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy),
  ]);

  // Los puntos reales de la base que nos importan: la esquina más cercana
  // (donde se juntan los dos bordes visibles) y sus dos vecinas.
  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], bodyZ0, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], bodyZ0, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], bodyZ0, ox, oy);

  // Cada cota se dibuja PARALELA a su propio borde, desplazada hacia afuera
  // en el eje del modelo correspondiente (no en pantalla) — así una queda
  // "hacia el frente" (ancho) y la otra "hacia la derecha" (profundo), sin
  // que sus etiquetas choquen entre sí.
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, bodyZ0, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, bodyZ0, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], bodyZ0, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], bodyZ0, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, bodyZ0, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, bodyZ0, ox, oy);

  // Cota de altura, con la esquina superior/inferior derecha del cuerpo.
  const [rightTopX, rightTopY] = isoPt(halfW, -halfD, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(halfW, -halfD, bodyZ0, ox, oy);

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      {/* Solado: misma forma, un poco más ancho y corto */}
      <IsoBoxLineArt x0={-soladoHalfW} y0={-soladoHalfD} w={soladoHalfW * 2} d={soladoHalfD * 2} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Cuerpo (pedestal) */}
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano que atraviesa el cuerpo */}
      <polygon points={groundPlane} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={groundLeftX - 4} y={groundLeftY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho: paralela al borde frontal-izquierdo, desplazada "hacia el frente" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo: paralela al borde frontal-derecho, desplazada "hacia la derecha" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {profundo || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 34} y1={rightTopY} x2={rightBotX + 34} y2={rightBotY} />
        <line x1={rightTopX + 30} y1={rightTopY} x2={rightTopX + 38} y2={rightTopY} />
        <line x1={rightBotX + 30} y1={rightBotY} x2={rightBotX + 38} y2={rightBotY} />
      </g>
      <text
        x={rightTopX + 46}
        y={(rightTopY + rightBotY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${rightTopX + 46}, ${(rightTopY + rightBotY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D): un rectángulo — ancho = ancho,    */
/* alto = altura total — igual estilo que Postes MT.                        */
export function LuminariasSeccionLongitudinal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 28, 85);
  const alturaPx = clamp((altura || 0.3) * LUMI_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * LUMI_M2PX, 5, 11);

  const cx = LUMI_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un rectángulo (o cuadrado, si   */
/* ancho = profundo) con AMBAS cotas — horizontal (ancho) y vertical         */
/* (profundo) — porque la sección puede no ser cuadrada.                    */
export function LuminariasSeccionTransversal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * LUMI_M2PX, 28, 85);
  const profundoPx = clamp((profundo || 0.3) * LUMI_M2PX, 28, 85);

  const cx = LUMI_VB_W / 2;
  const cy = LUMI_VB_H / 2 - 14;

  return (
    <svg viewBox={`0 0 ${LUMI_VB_W} ${LUMI_VB_H}`} className={LUMI_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={cy - profundoPx / 2} width={anchoPx} height={profundoPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota horizontal: ancho, debajo */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 14} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 14} />
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx - anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
        <line x1={cx + anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
      </g>
      <text x={cx} y={cy + profundoPx / 2 + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota vertical: profundo, a la derecha */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 14} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 14} y2={cy + profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy - profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy + profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy + profundoPx / 2} />
      </g>
      <text
        x={cx + anchoPx / 2 + 30}
        y={cy}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 30}, ${cy})`}
      >
        {profundo || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas de Luminarias lado a lado, cada una con su etiqueta.   */
export function LuminariasVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <LuminariasPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <LuminariasSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <LuminariasSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

/* Formulario de crear/editar una plantilla de Luminarias: lado (sección      */
/* cuadrada), altura (desplante + sobresaliente) y espesor de solado.       */
export function LuminariasForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesPrisma(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Luminarias
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <LuminariasVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Luminaria Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 italic">Si la sección es cuadrada, usa el mismo valor en ambos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.10" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* Formulario de crear/editar una plantilla de Cámaras (CCTV): mismo         */
/* esquema que Luminarias (ancho, profundo, desplante, sobresaliente,       */
/* espesor de solado).                                                       */
export function CamarasForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(
    plantilla?.datos || { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', resistencia: '' }
  );

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const altura = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const volumenes = calcularVolumenesPrisma(datos);
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cámaras
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <CamarasVistas datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Cámara Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 italic">Si la sección es cuadrada, usa el mismo valor en ambos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.10" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400">
            Altura total: <span className="font-mono text-navy-600">{altura.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* ============================================================ */
/* CÁMARAS (CCTV) — misma estructura que Luminarias, sección       */
/* rectangular/cuadrada.                                            */
/* ============================================================ */

export const CAM_VB_W = 200;
export const CAM_VB_H = 195;
export const CAM_M2PX = 80;
export const CAM_CSS_SIZE = 'w-56 h-56';

/* Isométrico de una cimentación de sección rectangular (o cuadrada, si       */
/* ancho = profundo): caja + solado (misma forma, un poco más ancha y corta) */
/* + plano de terreno natural (un paralelogramo coherente con la perspectiva) */
/* + cotas independientes de ancho y profundo (una en cada borde visible de   */
/* la base) + cota de altura.                                                */
export function CamarasPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 26, 65);
  const profundoPx = clamp((profundo || 0.3) * CAM_M2PX, 26, 65);
  const alturaPx = clamp((altura || 0.3) * CAM_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * CAM_M2PX, 5, 11);
  const groundFrac = altura > 0 ? desplante / altura : 0;

  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const bodyZ0 = soladoPx;
  const bodyZ1 = soladoPx + alturaPx;
  const groundZ = soladoPx + groundFrac * alturaPx;

  const ox = CAM_VB_W / 2;
  const oy = 18 + Math.max(halfW, halfD) + bodyZ1;

  const soladoHalfW = halfW;
  const soladoHalfD = halfD;
  const groundHalfW = halfW + 16;
  const groundHalfD = halfD + 16;

  const [groundLeftX, groundLeftY] = isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy);
  const groundPlane = poly([
    isoPt(-groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, -groundHalfD, groundZ, ox, oy),
    isoPt(groundHalfW, groundHalfD, groundZ, ox, oy),
    isoPt(-groundHalfW, groundHalfD, groundZ, ox, oy),
  ]);

  // Los puntos reales de la base que nos importan: la esquina más cercana
  // (donde se juntan los dos bordes visibles) y sus dos vecinas.
  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], bodyZ0, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], bodyZ0, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], bodyZ0, ox, oy);

  // Cada cota se dibuja PARALELA a su propio borde, desplazada hacia afuera
  // en el eje del modelo correspondiente (no en pantalla) — así una queda
  // "hacia el frente" (ancho) y la otra "hacia la derecha" (profundo), sin
  // que sus etiquetas choquen entre sí.
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, bodyZ0, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, bodyZ0, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], bodyZ0, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], bodyZ0, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, bodyZ0, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, bodyZ0, ox, oy);

  // Cota de altura, con la esquina superior/inferior derecha del cuerpo.
  const [rightTopX, rightTopY] = isoPt(halfW, -halfD, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(halfW, -halfD, bodyZ0, ox, oy);

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      {/* Solado: misma forma, un poco más ancho y corto */}
      <IsoBoxLineArt x0={-soladoHalfW} y0={-soladoHalfD} w={soladoHalfW * 2} d={soladoHalfD * 2} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Cuerpo (pedestal) */}
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano que atraviesa el cuerpo */}
      <polygon points={groundPlane} fill="none" stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={groundLeftX - 4} y={groundLeftY + 3} textAnchor="end" fontSize="8" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Cota de ancho: paralela al borde frontal-izquierdo, desplazada "hacia el frente" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo: paralela al borde frontal-derecho, desplazada "hacia la derecha" */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {profundo || '—'} m
      </text>
      {/* Cota de altura total */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 34} y1={rightTopY} x2={rightBotX + 34} y2={rightBotY} />
        <line x1={rightTopX + 30} y1={rightTopY} x2={rightTopX + 38} y2={rightTopY} />
        <line x1={rightBotX + 30} y1={rightBotY} x2={rightBotX + 38} y2={rightBotY} />
      </g>
      <text
        x={rightTopX + 46}
        y={(rightTopY + rightBotY) / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${rightTopX + 46}, ${(rightTopY + rightBotY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección longitudinal (vista frontal 2D): un rectángulo — ancho = ancho,    */
/* alto = altura total — igual estilo que Postes MT.                        */
export function CamarasSeccionLongitudinal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const altura = desplante + sobresaliente;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 28, 85);
  const alturaPx = clamp((altura || 0.3) * CAM_M2PX, 50, 100);
  const soladoPx = clamp((espesorSolado || 0.05) * CAM_M2PX, 5, 11);

  const cx = CAM_VB_W / 2;
  const topY = 30;
  const botY = topY + alturaPx;
  const soladoBotY = botY + soladoPx;
  const groundY = altura > 0 ? topY + (sobresaliente / altura) * alturaPx : topY;

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={botY} width={anchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - anchoPx / 2} y={topY} width={anchoPx} height={alturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <line x1={cx - anchoPx / 2 - 20} y1={groundY} x2={cx + anchoPx / 2 + 20} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={cx - anchoPx / 2 - 22} y={groundY + 3} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 14} x2={cx + anchoPx / 2} y2={soladoBotY + 14} />
        <line x1={cx - anchoPx / 2} y1={soladoBotY + 10} x2={cx - anchoPx / 2} y2={soladoBotY + 18} />
        <line x1={cx + anchoPx / 2} y1={soladoBotY + 10} x2={cx + anchoPx / 2} y2={soladoBotY + 18} />
      </g>
      <text x={cx} y={soladoBotY + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 30} y1={topY} x2={cx + anchoPx / 2 + 30} y2={botY} />
        <line x1={cx + anchoPx / 2 + 26} y1={topY} x2={cx + anchoPx / 2 + 34} y2={topY} />
        <line x1={cx + anchoPx / 2 + 26} y1={botY} x2={cx + anchoPx / 2 + 34} y2={botY} />
      </g>
      <text
        x={cx + anchoPx / 2 + 40}
        y={(topY + botY) / 2}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 40}, ${(topY + botY) / 2})`}
      >
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Sección transversal (vista en planta 2D): un rectángulo (o cuadrado, si   */
/* ancho = profundo) con AMBAS cotas — horizontal (ancho) y vertical         */
/* (profundo) — porque la sección puede no ser cuadrada.                    */
export function CamarasSeccionTransversal({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.3) * CAM_M2PX, 28, 85);
  const profundoPx = clamp((profundo || 0.3) * CAM_M2PX, 28, 85);

  const cx = CAM_VB_W / 2;
  const cy = CAM_VB_H / 2 - 14;

  return (
    <svg viewBox={`0 0 ${CAM_VB_W} ${CAM_VB_H}`} className={CAM_CSS_SIZE}>
      <rect x={cx - anchoPx / 2} y={cy - profundoPx / 2} width={anchoPx} height={profundoPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota horizontal: ancho, debajo */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 14} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 14} />
        <line x1={cx - anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx - anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
        <line x1={cx + anchoPx / 2} y1={cy + profundoPx / 2 + 10} x2={cx + anchoPx / 2} y2={cy + profundoPx / 2 + 18} />
      </g>
      <text x={cx} y={cy + profundoPx / 2 + 30} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota vertical: profundo, a la derecha */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx + anchoPx / 2 + 14} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 14} y2={cy + profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy - profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy - profundoPx / 2} />
        <line x1={cx + anchoPx / 2 + 10} y1={cy + profundoPx / 2} x2={cx + anchoPx / 2 + 18} y2={cy + profundoPx / 2} />
      </g>
      <text
        x={cx + anchoPx / 2 + 30}
        y={cy}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#152644"
        transform={`rotate(90, ${cx + anchoPx / 2 + 30}, ${cy})`}
      >
        {profundo || '—'} m
      </text>
    </svg>
  );
}

/* Junta las 3 vistas de Luminarias lado a lado, cada una con su etiqueta.   */
export function CamarasVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <CamarasPreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <CamarasSeccionLongitudinal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección longitudinal</p>
      </div>
      <div className="text-center">
        <CamarasSeccionTransversal datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección transversal</p>
      </div>
    </div>
  );
}

/* ============================================================ */
/* INVERSORES — 2 pedestales rectangulares iguales + 1 losa con  */
/* malla electrosoldada, con despiece de acero (barras + estribos). */
/* ============================================================ */
export const INV_M2PX = 55;
export const INV_CSS_SIZE = 'w-72 h-60';
export const INV_ISO_CSS_SIZE = 'w-[32rem] h-auto';
export const INV_REF_CSS_SIZE = 'w-56 h-56';

/* Isométrico del conjunto: solado corrido + 2 pedestales + losa encima,      */
/* con cotas de la losa (ancho/largo/espesor) y de un pedestal (ancho/       */
/* profundo/altura) — igual estilo de líneas que los demás tipos.           */
export function InversoresIsometrico({ datos, className = INV_ISO_CSS_SIZE }) {
  const p = datos.pedestal || {};
  const l = datos.losa || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const pDesplante = parseFloat(p.desplante) || 0;
  const pSobresaliente = parseFloat(p.sobresaliente) || 0;
  const pSolado = parseFloat(p.espesor_solado) || 0;
  const pSeparacion = parseFloat(p.separacion) || 0;
  const pAltura = pDesplante + pSobresaliente;

  const lAncho = parseFloat(l.ancho) || 0;
  const lLargo = parseFloat(l.largo) || 0;
  const lEspesor = parseFloat(l.espesor) || 0;

  const pAnchoPx = clamp((pAncho || 0.3) * INV_M2PX, 18, 45);
  const pProfundoPx = clamp((pProfundo || 0.3) * INV_M2PX, 18, 45);
  const pAlturaPx = clamp((pAltura || 0.5) * INV_M2PX, 40, 85);
  const pSoladoPx = clamp((pSolado || 0.05) * INV_M2PX, 4, 9);
  const pSepPx = clamp((pSeparacion || 0.6) * INV_M2PX, 20, 90);

  const lAnchoPx = clamp((lAncho || 1.6) * INV_M2PX, pAnchoPx * 2 + pSepPx, 190);
  const lLargoPx = clamp((lLargo || 1.0) * INV_M2PX, pProfundoPx + 20, 110);
  const lEspesorPx = clamp((lEspesor || 0.15) * INV_M2PX, 6, 16);

  const halfPed = pAnchoPx / 2;
  const halfProf = pProfundoPx / 2;
  const centroX = (pAnchoPx + pSepPx) / 2;

  const bodyZ0 = pSoladoPx;
  const bodyZ1 = pSoladoPx + pAlturaPx;
  const losaZ1 = bodyZ1 + lEspesorPx;

  // El tamaño del lienzo se calcula a partir de los puntos extremos reales
  // del dibujo (con un origen provisional en 0,0), en vez de un margen fijo
  // pensado para el peor caso posible — así no queda espacio muerto de más
  // en los casos típicos (que son la inmensa mayoría).
  const dimPushLosa = 26;
  const PAD = 46; // margen para el texto de las cotas, que sobresale de sus líneas
  const bounds = [
    isoPt(-centroX - halfPed, -halfProf, 0, 0, 0),
    isoPt(centroX + halfPed, -halfProf, 0, 0, 0),
    isoPt(centroX + halfPed, halfProf, 0, 0, 0),
    isoPt(-centroX - halfPed, halfProf, 0, 0, 0),
    isoPt(-lAnchoPx / 2, -lLargoPx / 2, losaZ1, 0, 0),
    isoPt(lAnchoPx / 2, -lLargoPx / 2, losaZ1, 0, 0),
    isoPt(lAnchoPx / 2, lLargoPx / 2, losaZ1, 0, 0),
    isoPt(-lAnchoPx / 2, lLargoPx / 2, losaZ1, 0, 0),
    isoPt(-lAnchoPx / 2 - 24, -lLargoPx / 2 - 24, bodyZ1, 0, 0),
    isoPt(lAnchoPx / 2 + 24, -lLargoPx / 2 - 24, bodyZ1, 0, 0),
    isoPt(lAnchoPx / 2 + 24, lLargoPx / 2 + 24, bodyZ1, 0, 0),
    isoPt(-lAnchoPx / 2 - 24, lLargoPx / 2 + 24, bodyZ1, 0, 0),
    isoPt(-lAnchoPx / 2, -lLargoPx / 2 - dimPushLosa, losaZ1, 0, 0),
    isoPt(lAnchoPx / 2, -lLargoPx / 2 - dimPushLosa, losaZ1, 0, 0),
    isoPt(-lAnchoPx / 2 - dimPushLosa, -lLargoPx / 2, losaZ1, 0, 0),
    isoPt(-lAnchoPx / 2 - dimPushLosa, lLargoPx / 2, losaZ1, 0, 0),
    isoPt(centroX + halfPed, -halfProf, bodyZ1, 0, 0),
    isoPt(centroX + halfPed, -halfProf, bodyZ0, 0, 0),
    isoPt(-lAnchoPx / 2, lLargoPx / 2, losaZ1, 0, 0),
    isoPt(-lAnchoPx / 2, lLargoPx / 2, bodyZ1, 0, 0),
  ];
  const minX = Math.min(...bounds.map((pt) => pt[0])) - PAD;
  const maxX = Math.max(...bounds.map((pt) => pt[0])) + PAD;
  const minY = Math.min(...bounds.map((pt) => pt[1])) - PAD * 0.6;
  const maxY = Math.max(...bounds.map((pt) => pt[1])) + PAD * 0.6;
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const ox = -minX;
  const oy = -minY;


  // Altura del pedestal: esquina trasera-derecha, hacia la derecha.
  const [rightTopX, rightTopY] = isoPt(centroX + halfPed, -halfProf, bodyZ1, ox, oy);
  const [rightBotX, rightBotY] = isoPt(centroX + halfPed, -halfProf, bodyZ0, ox, oy);

  // Espesor de la losa: frente-izquierda, hacia la izquierda.
  const [espTopX, espTopY] = isoPt(-lAnchoPx / 2, lLargoPx / 2, losaZ1, ox, oy);
  const [espBotX, espBotY] = isoPt(-lAnchoPx / 2, lLargoPx / 2, bodyZ1, ox, oy);

  // Ancho y largo de la losa: arriba, paralelos a los dos bordes que se ven
  // desde la esquina trasera (la que queda más arriba en la proyección),
  // desplazados aún más arriba para no chocar con la losa ni entre sí.
  const backModel = [-lAnchoPx / 2, -lLargoPx / 2];
  const rightBackModel = [lAnchoPx / 2, -lLargoPx / 2];
  const frontLeftModel = [-lAnchoPx / 2, lLargoPx / 2];
  const backPt = isoPt(backModel[0], backModel[1], losaZ1, ox, oy);
  const rightBackPt = isoPt(rightBackModel[0], rightBackModel[1], losaZ1, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], losaZ1, ox, oy);
  const lAnchoP1 = isoPt(backModel[0], backModel[1] - dimPushLosa, losaZ1, ox, oy);
  const lAnchoP2 = isoPt(rightBackModel[0], rightBackModel[1] - dimPushLosa, losaZ1, ox, oy);
  const lLargoP1 = isoPt(backModel[0] - dimPushLosa, backModel[1], losaZ1, ox, oy);
  const lLargoP2 = isoPt(frontLeftModel[0] - dimPushLosa, frontLeftModel[1], losaZ1, ox, oy);
  const lAnchoLabel = isoPt((backModel[0] + rightBackModel[0]) / 2, backModel[1] - dimPushLosa - 14, losaZ1, ox, oy);
  const lLargoLabel = isoPt(backModel[0] - dimPushLosa - 14, (backModel[1] + frontLeftModel[1]) / 2, losaZ1, ox, oy);

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={className}>
      {/* Solado: uno por cada pedestal, con su misma huella (no una franja continua) */}
      <IsoBoxLineArt x0={-centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={0} z1={pSoladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={0} z1={pSoladoPx} ox={ox} oy={oy} />
      {/* Pedestal izquierdo */}
      <IsoBoxLineArt x0={-centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Pedestal derecho */}
      <IsoBoxLineArt x0={centroX - halfPed} y0={-halfProf} w={pAnchoPx} d={pProfundoPx} z0={bodyZ0} z1={bodyZ1} ox={ox} oy={oy} />
      {/* Losa encima de ambos */}
      <IsoBoxLineArt x0={-lAnchoPx / 2} y0={-lLargoPx / 2} w={lAnchoPx} d={lLargoPx} z0={bodyZ1} z1={losaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      {/* Nivel de terreno natural: coincide con la parte de ARRIBA del pedestal (= la parte de abajo de la losa, que no se excava) — */}
      {/* el plano se dibuja más grande que la LOSA (no que el pedestal), para que quede claramente por fuera y no se encime con ella. */}
      <polygon
        points={poly([
          isoPt(-lAnchoPx / 2 - 24, -lLargoPx / 2 - 24, bodyZ1, ox, oy),
          isoPt(lAnchoPx / 2 + 24, -lLargoPx / 2 - 24, bodyZ1, ox, oy),
          isoPt(lAnchoPx / 2 + 24, lLargoPx / 2 + 24, bodyZ1, ox, oy),
          isoPt(-lAnchoPx / 2 - 24, lLargoPx / 2 + 24, bodyZ1, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-lAnchoPx / 2 - 24, -lLargoPx / 2 - 24, bodyZ1, ox, oy)[0] - 4}
        y={isoPt(-lAnchoPx / 2 - 24, -lLargoPx / 2 - 24, bodyZ1, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      {/* Cota de altura del pedestal (a la derecha) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={rightTopX + 20} y1={rightTopY} x2={rightBotX + 20} y2={rightBotY} />
        <line x1={rightTopX + 16} y1={rightTopY} x2={rightTopX + 24} y2={rightTopY} />
        <line x1={rightBotX + 16} y1={rightBotY} x2={rightBotX + 24} y2={rightBotY} />
      </g>
      <text x={rightTopX + 30} y={(rightTopY + rightBotY) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${rightTopX + 30}, ${(rightTopY + rightBotY) / 2})`}>
        {pAltura ? pAltura.toFixed(2) : '—'} m
      </text>
      {/* Cota de espesor de losa (a la izquierda) */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={espTopX - 20} y1={espTopY} x2={espBotX - 20} y2={espBotY} />
        <line x1={espTopX - 16} y1={espTopY} x2={espTopX - 24} y2={espTopY} />
        <line x1={espBotX - 16} y1={espBotY} x2={espBotX - 24} y2={espBotY} />
      </g>
      <text x={espTopX - 30} y={(espTopY + espBotY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${espTopX - 30}, ${(espTopY + espBotY) / 2})`}>
        {lEspesor ? lEspesor.toFixed(2) : '—'} m
      </text>
      {/* Cota de ancho de losa: arriba, paralela al borde trasero */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={lAnchoP1[0]} y2={lAnchoP1[1]} />
        <line x1={rightBackPt[0]} y1={rightBackPt[1]} x2={lAnchoP2[0]} y2={lAnchoP2[1]} />
        <line x1={lAnchoP1[0]} y1={lAnchoP1[1]} x2={lAnchoP2[0]} y2={lAnchoP2[1]} />
      </g>
      <text x={lAnchoLabel[0]} y={lAnchoLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA">
        {lAncho || '—'} m
      </text>
      {/* Cota de largo de losa: arriba, paralela al borde trasero-izquierdo */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={lLargoP1[0]} y2={lLargoP1[1]} />
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={lLargoP2[0]} y2={lLargoP2[1]} />
        <line x1={lLargoP1[0]} y1={lLargoP1[1]} x2={lLargoP2[0]} y2={lLargoP2[1]} />
      </g>
      <text x={lLargoLabel[0]} y={lLargoLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3C64AA">
        {lLargo || '—'} m
      </text>
    </svg>
  );
}

/* Elevación del conjunto (vista de frente): los 2 pedestales, separados     */
/* por el espacio libre entre sus caras internas, con la losa apoyada       */
/* encima de ambos — el N.T.N. coincide con la parte de arriba del pedestal */
/* (= la parte de abajo de la losa, que no se excava).                     */
export function InversoresElevacion({ datos }) {
  const p = datos.pedestal || {};
  const l = datos.losa || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const pAncho = parseFloat(p.ancho) || 0;
  const pDesplante = parseFloat(p.desplante) || 0;
  const pSobresaliente = parseFloat(p.sobresaliente) || 0;
  const pAltura = pDesplante + pSobresaliente;
  const pSeparacion = parseFloat(p.separacion) || 0;
  const espesorSolado = parseFloat(p.espesor_solado) || 0;
  const lAncho = parseFloat(l.ancho) || 0;
  const lEspesor = parseFloat(l.espesor) || 0;

  const scale = 90;
  const pAnchoPx = clamp((pAncho || 0.3) * scale, 20, 45);
  const pAlturaPx = clamp((pAltura || 0.5) * scale, 45, 110);
  const soladoPx = clamp((espesorSolado || 0.05) * scale, 4, 9);
  const sepPx = clamp((pSeparacion || 0.6) * scale, 60, 160);
  const lEspesorPx = clamp((lEspesor || 0.15) * scale, 8, 20);
  const lAnchoPx = clamp((lAncho || 1.6) * scale, pAnchoPx * 2 + sepPx + 20, 260);

  const cx = 160;
  const groundY = 170; // N.T.N. — coincide EXACTAMENTE con la parte de arriba del pedestal:
  // la losa se apoya directamente sobre el terreno, sin ningún tramo sobresaliendo por encima.
  const pTopY = groundY;
  const pBotY = groundY + pAlturaPx; // toda la altura del pedestal queda enterrada
  const soladoBotY = pBotY + soladoPx;
  const losaTopY = pTopY - lEspesorPx;

  const x1 = cx - (pAnchoPx + sepPx) / 2; // centro del pedestal izquierdo
  const x2 = cx + (pAnchoPx + sepPx) / 2; // centro del pedestal derecho

  return (
    <svg viewBox="0 0 320 300" className={INV_CSS_SIZE}>
      <line x1={x1 - pAnchoPx / 2 - 34} y1={groundY} x2={x2 + pAnchoPx / 2 + 34} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={x1 - pAnchoPx / 2 - 38} y={groundY - 4} textAnchor="end" fontSize="10" fill="#6487C4" fontFamily="monospace">N.T.N</text>

      {/* Solado bajo cada pedestal */}
      <rect x={x1 - pAnchoPx / 2} y={pBotY} width={pAnchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      <rect x={x2 - pAnchoPx / 2} y={pBotY} width={pAnchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />

      {/* Pedestales */}
      <rect x={x1 - pAnchoPx / 2} y={pTopY} width={pAnchoPx} height={pBotY - pTopY} fill="white" stroke="#152644" strokeWidth="1.3" />
      <rect x={x2 - pAnchoPx / 2} y={pTopY} width={pAnchoPx} height={pBotY - pTopY} fill="white" stroke="#152644" strokeWidth="1.3" />

      {/* Losa, apoyada directamente sobre el terreno (sobre ambos pedestales) */}
      <rect x={cx - lAnchoPx / 2} y={losaTopY} width={lAnchoPx} height={lEspesorPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.2" />

      {/* Cota de separación libre entre pedestales, justo debajo de la losa */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 + pAnchoPx / 2} y1={losaTopY - 16} x2={x2 - pAnchoPx / 2} y2={losaTopY - 16} />
        <line x1={x1 + pAnchoPx / 2} y1={losaTopY - 20} x2={x1 + pAnchoPx / 2} y2={losaTopY - 12} />
        <line x1={x2 - pAnchoPx / 2} y1={losaTopY - 20} x2={x2 - pAnchoPx / 2} y2={losaTopY - 12} />
      </g>
      <text x={cx} y={losaTopY - 26} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#152644">
        Separación libre: {pSeparacion || '—'} m
      </text>

      {/* Cota de altura del pedestal, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - pAnchoPx / 2 - 14} y1={pTopY} x2={x1 - pAnchoPx / 2 - 14} y2={pBotY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pTopY} x2={x1 - pAnchoPx / 2 - 18} y2={pTopY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pBotY} x2={x1 - pAnchoPx / 2 - 18} y2={pBotY} />
      </g>
      <text x={x1 - pAnchoPx / 2 - 26} y={(pTopY + pBotY) / 2} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${x1 - pAnchoPx / 2 - 26}, ${(pTopY + pBotY) / 2})`}>
        {pAltura ? pAltura.toFixed(2) : '—'} m
      </text>

      {/* Cota de espesor de losa, a la derecha */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={x2 + pAnchoPx / 2 + 14} y1={losaTopY} x2={x2 + pAnchoPx / 2 + 14} y2={pTopY} />
        <line x1={x2 + pAnchoPx / 2 + 10} y1={losaTopY} x2={x2 + pAnchoPx / 2 + 18} y2={losaTopY} />
        <line x1={x2 + pAnchoPx / 2 + 10} y1={pTopY} x2={x2 + pAnchoPx / 2 + 18} y2={pTopY} />
      </g>
      <text x={x2 + pAnchoPx / 2 + 26} y={(losaTopY + pTopY) / 2} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${x2 + pAnchoPx / 2 + 26}, ${(losaTopY + pTopY) / 2})`}>
        {lEspesor ? lEspesor.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Elevación ("Vista Posterior") del despiece de acero de UN pedestal        */
/* (los dos son iguales): barras longitudinales verticales + estribos       */
/* horizontales, con las etiquetas típicas de un plano de despiece.        */
export function InversoresRefuerzoElevacion({ datos }) {
  const p = datos.pedestal || {};
  const b = datos.barras || {};
  const e = datos.estribos || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const pAncho = parseFloat(p.ancho) || 0.3;
  const altura = (parseFloat(p.desplante) || 0) + (parseFloat(p.sobresaliente) || 0);
  const cantidadBarras = Math.max(2, parseInt(b.cantidad, 10) || 2);
  const ganchosBarra = parseFloat(b.ganchos) || 0;
  const infoBarra = BARRA_ACERO[b.calibre];
  const estribos = calcularEstribos({ altura, ancho: p.ancho, profundo: p.profundo, separacion: e.separacion, calibre: e.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionM = parseFloat(e.separacion) || 0;

  const w = clamp(pAncho * 130, 45, 100);
  const h = clamp((altura || 0.5) * 130, 90, 190);
  const cx = 90;
  const topY = 30;
  const botY = topY + h;
  const recubPx = 7;
  const escala = altura > 0 ? h / altura : 130;

  // En una vista posterior/elevación, las barras que comparten la misma
  // posición "x" (una al frente, otra atrás) se dibujan como UNA sola línea
  // — por eso solo se ven la mitad de las barras totales (redondeando
  // hacia arriba), no las 4 de un arreglo típico en las esquinas.
  const posicionesVisibles = Math.max(1, Math.ceil(cantidadBarras / 2));
  const barX = [];
  for (let i = 0; i < posicionesVisibles; i++) {
    const frac = posicionesVisibles === 1 ? 0.5 : i / (posicionesVisibles - 1);
    barX.push(cx - w / 2 + recubPx + frac * (w - 2 * recubPx));
  }
  // Los ganchos apuntan hacia el centro (como se doblan de verdad, hacia
  // adentro del núcleo de concreto) — se limita su largo a una fracción de
  // la distancia entre barras para que nunca se crucen entre sí.
  const distanciaEntreBarras = barX.length > 1 ? barX[barX.length - 1] - barX[0] : w;
  const ganchoMaximoSinChoque = (distanciaEntreBarras / 2) * 0.6;
  const ganchoPx = infoBarra ? clamp(Math.min(infoBarra.gancho * escala, ganchoMaximoSinChoque), 5, 13) : Math.min(10, ganchoMaximoSinChoque);

  // Los estribos se dibujan CENTRADOS en la altura del pedestal (no
  // pegados abajo), con su separación real a escala, así la cantidad que
  // se ve corresponde a la cantidad real calculada.
  const separacionPx = separacionM > 0 ? separacionM * escala : (h - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
  const totalSpanEstribos = (cantidadEstribos - 1) * separacionPx;
  const inicioEstribos = topY + recubPx + Math.max(0, (h - 2 * recubPx - totalSpanEstribos) / 2);
  const estriboY = [];
  for (let i = 0; i < cantidadEstribos; i++) {
    estriboY.push(inicioEstribos + i * separacionPx);
  }

  const ganchosLabel = ganchosBarra > 0 ? 'L'.repeat(Math.min(ganchosBarra, 2)) : '';
  const ganchoLongitud = infoBarra ? infoBarra.gancho : null;

  return (
    <svg viewBox="0 0 190 250" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboY.map((y, i) => (
        <rect key={i} x={cx - w / 2 + recubPx} y={y - 2} width={w - 2 * recubPx} height="4" fill="none" stroke="#2563EB" strokeWidth="1" />
      ))}
      {barX.map((x, i) => {
        const dir = x < cx ? 1 : x > cx ? -1 : 1; // hacia el centro
        return (
          <g key={i}>
            <line x1={x} y1={topY + 2} x2={x} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />
            {ganchosBarra >= 1 && <line x1={x} y1={botY - 2} x2={x + dir * ganchoPx} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />}
            {ganchosBarra >= 2 && <line x1={x} y1={topY + 2} x2={x + dir * ganchoPx} y2={topY + 2} stroke="#059669" strokeWidth="1.6" />}
          </g>
        );
      })}
      <text x={cx} y={topY - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {cantidadBarras}{b.calibre || '#—'} {ganchosLabel}{ganchoLongitud !== null ? ganchoLongitud.toFixed(2) : ''}
      </text>
      <text x={cx + w / 2 + 8} y={(topY + botY) / 2} fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${(topY + botY) / 2})`} textAnchor="middle">
        {cantidadEstribos || '—'} E{e.calibre || '#—'} @{e.separacion || '—'}
      </text>
      {/* Cota de ancho (abajo, paralela a la base) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={botY + 14} x2={cx + w / 2} y2={botY + 14} />
        <line x1={cx - w / 2} y1={botY + 10} x2={cx - w / 2} y2={botY + 18} />
        <line x1={cx + w / 2} y1={botY + 10} x2={cx + w / 2} y2={botY + 18} />
      </g>
      <text x={cx} y={botY + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {pAncho || '—'} m
      </text>
      {/* Cota de altura (izquierda, paralela al lado) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={topY} x2={cx - w / 2 - 16} y2={botY} />
        <line x1={cx - w / 2 - 12} y1={topY} x2={cx - w / 2 - 20} y2={topY} />
        <line x1={cx - w / 2 - 12} y1={botY} x2={cx - w / 2 - 20} y2={botY} />
      </g>
      <text x={cx - w / 2 - 26} y={(topY + botY) / 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${(topY + botY) / 2})`}>
        {altura ? altura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal (planta) del pedestal: el estribo como un rectángulo    */
/* inscrito, con las 4 barras de esquina.                                   */
export function InversoresRefuerzoCorte({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const pAncho = parseFloat(p.ancho) || 0.3;
  const pProfundo = parseFloat(p.profundo) || 0.3;
  const w = clamp(pAncho * 130, 40, 100);
  const d = clamp(pProfundo * 130, 40, 100);
  const cx = 85, cy = 80;
  const recubPx = 7;

  return (
    <svg viewBox="0 0 180 190" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      {/* Gancho del estribo: 2 líneas casi paralelas en la esquina superior izquierda, a -45° desde el borde superior */}
      <GanchoEstriboEsquina x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={cx + sx * (w / 2 - recubPx)} cy={cy + sy * (d / 2 - recubPx)} r="2.6" fill="#059669" />
      ))}
      {/* Cota de ancho (abajo) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {pAncho || '—'} m
      </text>
      {/* Cota de profundo (izquierda) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={cy - d / 2} x2={cx - w / 2 - 16} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy - d / 2} x2={cx - w / 2 - 20} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy + d / 2} x2={cx - w / 2 - 20} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 26} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${cy})`}>
        {pProfundo || '—'} m
      </text>
    </svg>
  );
}

/* Planta de la losa con la malla electrosoldada representada como una       */
/* cuadrícula simple, etiquetada con el tipo elegido.                       */
export function InversoresLosaPlanta({ datos }) {
  const l = datos.losa || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ancho = parseFloat(l.ancho) || 0;
  const largo = parseFloat(l.largo) || 0;
  const w = clamp((ancho || 1.6) * 60, 60, 140);
  const d = clamp((largo || 1.0) * 60, 50, 100);
  const cx = 95, cy = 80;
  const cols = 5, rows = 4;

  return (
    <svg viewBox="0 0 200 190" className={INV_REF_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`v${i}`} x1={cx - w / 2 + ((i + 1) * w) / cols} y1={cy - d / 2} x2={cx - w / 2 + ((i + 1) * w) / cols} y2={cy + d / 2} stroke="#2563EB" strokeWidth="0.6" />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`h${i}`} x1={cx - w / 2} y1={cy - d / 2 + ((i + 1) * d) / rows} x2={cx + w / 2} y2={cy - d / 2 + ((i + 1) * d) / rows} stroke="#2563EB" strokeWidth="0.6" />
      ))}
      {/* Cota de ancho (abajo) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 30} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de largo (izquierda) */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={cy - d / 2} x2={cx - w / 2 - 16} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy - d / 2} x2={cx - w / 2 - 20} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 12} y1={cy + d / 2} x2={cx - w / 2 - 20} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 26} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${cy})`}>
        {largo || '—'} m
      </text>
      <text x={cx} y={cy - d / 2 - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#2563EB">
        Malla {l.malla || '—'}
      </text>
    </svg>
  );
}

/* Junta las 4 vistas de Inversores (isométrico general + las 3 de despiece  */
/* de acero) con sus etiquetas.                                            */
export function InversoresVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <InversoresIsometrico datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico del conjunto</p>
      </div>
      <div className="text-center">
        <InversoresElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Elevación del conjunto</p>
      </div>
      <div className="text-center">
        <InversoresRefuerzoElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Refuerzo · vista posterior</p>
      </div>
      <div className="text-center">
        <InversoresRefuerzoCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Refuerzo · corte transversal</p>
      </div>
      <div className="text-center">
        <InversoresLosaPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Losa · planta con malla</p>
      </div>
    </div>
  );
}

/* Fila de resumen numérico (longitud/peso) dentro de la tabla de despiece.  */
export function FilaResumenAcero({ label, valor }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-navy-100 last:border-0">
      <span className="text-navy-500">{label}</span>
      <span className="font-mono font-semibold text-navy-700">{valor}</span>
    </div>
  );
}

/* Formulario de crear/editar una plantilla de Inversores: 2 pedestales      */
/* iguales (con su despiece de barras + estribos) y 1 losa con malla.      */
/* Garantiza que toda la estructura anidada exista, sin importar qué tan     */
/* vieja sea la plantilla guardada — mismo motivo que en Portón/CT/Trampa:  */
/* sin esto, abrir una plantilla vieja para editarla revienta con pantalla  */
/* en blanco.                                                               */
export function normalizarDatosInversores(datos) {
  const base = {
    pedestal: { ancho: '', profundo: '', desplante: '', sobresaliente: '', espesor_solado: '', separacion: '' },
    barras: { cantidad: '', calibre: '', ganchos: '1' },
    estribos: { calibre: '', separacion: '' },
    losa: { ancho: '', largo: '', espesor: '', malla: '' },
    resistencia: '',
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    pedestal: { ...base.pedestal, ...datos.pedestal },
    barras: { ...base.barras, ...datos.barras },
    estribos: { ...base.estribos, ...datos.estribos },
    losa: { ...base.losa, ...datos.losa },
  };
}

export function InversoresForm({ plantilla, onCancel, onSave, mallas, onAddMalla }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosInversores(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  const alturaPedestal = (parseFloat(datos.pedestal.desplante) || 0) + (parseFloat(datos.pedestal.sobresaliente) || 0);
  const longitudinales = calcularLongitudinales({ altura: alturaPedestal, cantidad: datos.barras.cantidad, calibre: datos.barras.calibre, ganchos: datos.barras.ganchos });
  const estribos = calcularEstribos({ altura: alturaPedestal, ancho: datos.pedestal.ancho, profundo: datos.pedestal.profundo, separacion: datos.estribos.separacion, calibre: datos.estribos.calibre });
  const pesoTotalAcero = (longitudinales?.pesoTotal || 0) + (estribos?.pesoTotal || 0);
  const volumenes = calcularVolumenesInversores(datos);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Inversores
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <InversoresVistas datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Inversores Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pedestales */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestales (2 iguales)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. de desplante (m)</label>
              <input value={datos.pedestal.desplante} onChange={(e) => setGrupo('pedestal', 'desplante', e.target.value)} placeholder="0.60" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Long. sobresaliente (m)</label>
              <input value={datos.pedestal.sobresaliente} onChange={(e) => setGrupo('pedestal', 'sobresaliente', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Altura total: <span className="font-mono text-navy-600">{alturaPedestal.toFixed(2)} m</span> (desplante + sobresaliente)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
              <input value={datos.pedestal.espesor_solado} onChange={(e) => setGrupo('pedestal', 'espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación entre pedestales (m)</label>
              <input value={datos.pedestal.separacion} onChange={(e) => setGrupo('pedestal', 'separacion', e.target.value)} placeholder="0.60" className={cellInput} />
            </div>
          </div>
        </div>

        {/* Losa */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Losa</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.losa.ancho} onChange={(e) => setGrupo('losa', 'ancho', e.target.value)} placeholder="1.60" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Largo (m)</label>
              <input value={datos.losa.largo} onChange={(e) => setGrupo('losa', 'largo', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-navy-500 mb-1">Espesor (m)</label>
            <input value={datos.losa.espesor} onChange={(e) => setGrupo('losa', 'espesor', e.target.value)} placeholder="0.15" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Tipo de malla electrosoldada</label>
            <MallaPicker value={datos.losa.malla} mallas={mallas || []} onChange={(val) => setGrupo('losa', 'malla', val)} onAddNew={onAddMalla} />
          </div>
        </div>

        {/* Barras longitudinales */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Barras longitudinales (por pedestal)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">N.° de barras</label>
              <input value={datos.barras.cantidad} onChange={(e) => setGrupo('barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">Calibre</label>
              <CalibreSelect value={datos.barras.calibre} onChange={(val) => setGrupo('barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1 min-h-[2rem]">N.° de ganchos</label>
              <input value={datos.barras.ganchos} onChange={(e) => setGrupo('barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {longitudinales ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2">
              <FilaResumenAcero label="Longitud por barra" valor={`${longitudinales.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Peso por barra" valor={`${longitudinales.pesoBarra.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso por pedestal" valor={`${longitudinales.pesoPedestal.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso total (2 pedestales)" valor={`${longitudinales.pesoTotal.toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa altura, cantidad y calibre para calcular.</p>
          )}
        </div>

        {/* Estribos */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Estribos (por pedestal)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.estribos.calibre} onChange={(val) => setGrupo('estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.estribos.separacion} onChange={(e) => setGrupo('estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {estribos ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2">
              <FilaResumenAcero label="Cantidad por pedestal" valor={`${estribos.cantidad}`} />
              <FilaResumenAcero label="Longitud por estribo" valor={`${estribos.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Peso por estribo" valor={`${estribos.pesoEstribo.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso por pedestal" valor={`${estribos.pesoPedestal.toFixed(2)} kg`} />
              <FilaResumenAcero label="Peso total (2 pedestales)" valor={`${estribos.pesoTotal.toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa altura, dimensiones, separación y calibre para calcular.</p>
          )}
        </div>
      </div>

      <ResumenVolumenes volumenes={volumenes} pesoAcero={(longitudinales || estribos) ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* PASO DE FAUNA — bloque simple de concreto, sin acero.          */
/* ============================================================ */
export const FAUNA_VB_W = 200;
export const FAUNA_VB_H = 195;
export const FAUNA_M2PX = 90;
export const FAUNA_CSS_SIZE = 'w-56 h-56';

export function PasoFaunaPreview({ datos }) {
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const anchoPx = clamp((ancho || 0.4) * FAUNA_M2PX, 30, 90);
  const profundoPx = clamp((profundo || 0.2) * FAUNA_M2PX, 20, 70);
  const altoPx = clamp((alto || 0.2) * FAUNA_M2PX, 20, 80);
  const soladoPx = clamp((espesorSolado || 0.05) * FAUNA_M2PX, 4, 9);
  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const ox = FAUNA_VB_W / 2;
  const oy = 30 + halfW + altoPx + soladoPx;

  const nearBottomModel = [halfW, halfD];
  const frontLeftModel = [-halfW, halfD];
  const rightModel = [halfW, -halfD];
  const nearBottomPt = isoPt(nearBottomModel[0], nearBottomModel[1], soladoPx, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], soladoPx, ox, oy);
  const rightPt = isoPt(rightModel[0], rightModel[1], soladoPx, ox, oy);
  const dimPush = 22;
  const anchoP1 = isoPt(frontLeftModel[0], frontLeftModel[1] + dimPush, soladoPx, ox, oy);
  const anchoP2 = isoPt(nearBottomModel[0], nearBottomModel[1] + dimPush, soladoPx, ox, oy);
  const profP1 = isoPt(nearBottomModel[0] + dimPush, nearBottomModel[1], soladoPx, ox, oy);
  const profP2 = isoPt(rightModel[0] + dimPush, rightModel[1], soladoPx, ox, oy);
  const anchoLabel = isoPt((frontLeftModel[0] + nearBottomModel[0]) / 2, frontLeftModel[1] + dimPush + 16, soladoPx, ox, oy);
  const profLabel = isoPt(nearBottomModel[0] + dimPush + 16, (nearBottomModel[1] + rightModel[1]) / 2, soladoPx, ox, oy);
  const [topX, topY] = isoPt(halfW, -halfD, soladoPx + altoPx, ox, oy);
  const [botX, botY] = isoPt(halfW, -halfD, soladoPx, ox, oy);

  return (
    <svg viewBox={`0 0 ${FAUNA_VB_W} ${FAUNA_VB_H}`} className={FAUNA_CSS_SIZE}>
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={soladoPx} z1={soladoPx + altoPx} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: en la parte de ARRIBA del bloque — aquí el */}
      {/* desplante es igual a la altura total (el bloque queda enterrado    */}
      {/* completo, sin sobresaliente).                                     */}
      <polygon
        points={poly([
          isoPt(-halfW - 14, -halfD - 14, soladoPx + altoPx, ox, oy),
          isoPt(halfW + 14, -halfD - 14, soladoPx + altoPx, ox, oy),
          isoPt(halfW + 14, halfD + 14, soladoPx + altoPx, ox, oy),
          isoPt(-halfW - 14, halfD + 14, soladoPx + altoPx, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-halfW - 14, -halfD - 14, soladoPx + altoPx, ox, oy)[0] - 4}
        y={isoPt(-halfW - 14, -halfD - 14, soladoPx + altoPx, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">{ancho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={nearBottomPt[0]} y1={nearBottomPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={rightPt[0]} y1={rightPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644">{profundo || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={topX + 20} y1={topY} x2={botX + 20} y2={botY} />
        <line x1={topX + 16} y1={topY} x2={topX + 24} y2={topY} />
        <line x1={botX + 16} y1={botY} x2={botX + 24} y2={botY} />
      </g>
      <text x={topX + 30} y={(topY + botY) / 2} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${topX + 30}, ${(topY + botY) / 2})`}>
        {alto || '—'} m
      </text>
    </svg>
  );
}

export function PasoFaunaForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(plantilla?.datos || { ancho: '', profundo: '', alto: '', espesor_solado: '' });

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }

  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const volumenes = ancho && profundo && alto
    ? { concreto: ancho * profundo * alto, excavacion: ancho * profundo * (alto + espesorSolado), solado: ancho * profundo * espesorSolado }
    : null;
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cerramiento · Paso de fauna
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex justify-center bg-navy-50 rounded-lg p-3 shrink-0 w-fit mx-auto">
          <PasoFaunaPreview datos={datos} />
        </div>
        <div className="flex-1 space-y-3" style={{ minWidth: 240 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Paso de fauna Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Base / Ancho (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto (m)</label>
              <input value={datos.alto} onChange={(e) => set('alto', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
          <p className="text-xs text-navy-400 italic">
            Bloque macizo sin acero — la excavación usa el alto más el espesor de solado.
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
      <ResumenVolumenes volumenes={volumenes} />
    </form>
  );
}

/* ============================================================ */
/* PORTÓN — 2 zapatas + viga de amarre + 2 pedestales.             */
/* ============================================================ */
export const PORTON_VB_W = 340;
export const PORTON_VB_H = 280;
export const PORTON_M2PX = 45;
export const PORTON_CSS_SIZE = 'w-72 h-56';
export const PORTON_PLANTA_CSS_SIZE = 'w-56 h-56';
export const PORTON_VIGA_ELEV_CSS_SIZE = 'w-[26rem] h-40';

/* Isométrico del conjunto: 2 zapatas + viga que las une + 2 pedestales      */
/* encima. No dibuja el acero (demasiado detalle para una sola vista) — el  */
/* despiece se documenta con números en el formulario.                     */
export function PortonIsometrico({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const p = datos.pedestal || {};
  const clamp = (v_, min, max) => Math.max(min, Math.min(max, v_));

  const zAncho = parseFloat(z.ancho) || 0;
  const zLargo = parseFloat(z.largo) || 0;
  const zEspesor = parseFloat(z.espesor) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const pAltura = Math.max(0, desplante - zEspesor); // desplante − espesor de zapata
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const zAnchoPx = clamp((zAncho || 1) * PORTON_M2PX, 30, 70);
  const zLargoPx = clamp((zLargo || 1) * PORTON_M2PX, 30, 70);
  const zEspesorPx = clamp((zEspesor || 0.35) * PORTON_M2PX, 8, 22);
  const soladoPx = clamp((espesorSolado || 0.05) * PORTON_M2PX, 4, 9);
  const sepPx = clamp((separacion || 5) * PORTON_M2PX, 90, 210);
  const pAnchoPx = clamp((pAncho || 0.4) * PORTON_M2PX, 14, 34);
  const pProfundoPx = clamp((pProfundo || 0.4) * PORTON_M2PX, 14, 34);
  const pAlturaPx = clamp((pAltura || 0.7) * PORTON_M2PX, 25, 70);
  const vAnchoPx = clamp((vAncho || 0.3) * PORTON_M2PX, 10, 20);
  const vAltoPx = clamp((vAlto || 0.35) * PORTON_M2PX, 10, 22);

  const halfZ = zLargoPx / 2;
  const halfZAncho = zAnchoPx / 2;
  const centroX = sepPx / 2;
  // z=0 es el fondo del solado. La zapata va encima del solado; la viga y el
  // pedestal arrancan juntos desde la parte de ARRIBA de la zapata.
  const zapataZ0 = soladoPx;
  const zapataZ1 = soladoPx + zEspesorPx;
  const vigaZ0 = zapataZ0; // la viga va a la misma profundidad que la zapata, justo encima del solado
  const vigaZ1 = zapataZ0 + vAltoPx;
  const pedestalZ0 = zapataZ1;
  const pedestalZ1 = zapataZ1 + pAlturaPx;
  const ntnZ = pedestalZ1; // el N.T.N. queda en la parte de ARRIBA del pedestal

  const ox = PORTON_VB_W / 2;
  // Margen vertical generoso: el plano de N.T.N. se empuja hacia afuera del
  // objeto (más allá de sus esquinas reales), y esa proyección isométrica
  // puede quedar muy por encima del resto del dibujo — sin margen suficiente
  // aquí, el plano (y su etiqueta) cae fuera del viewBox y queda invisible.
  const oy = 70 + Math.max(halfZAncho, 40) + pedestalZ1;

  const distanciaCarasInternas = Math.max(0, sepPx - zLargoPx);

  // Cota de altura del pedestal (derecha)
  const [alturaTopX, alturaTopY] = isoPt(centroX + pAnchoPx / 2, -pProfundoPx / 2, pedestalZ1, ox, oy);
  const [alturaBotX, alturaBotY] = isoPt(centroX + pAnchoPx / 2, -pProfundoPx / 2, zapataZ1, ox, oy);

  return (
    <svg viewBox={`0 0 ${PORTON_VB_W} ${PORTON_VB_H}`} className={PORTON_CSS_SIZE}>
      {/* Solado bajo cada zapata (misma huella) */}
      <IsoBoxLineArt x0={-centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      {/* Solado bajo el tramo de la viga, uniendo los dos anteriores */}
      {distanciaCarasInternas > 0 && (
        <IsoBoxLineArt x0={-centroX + halfZ} y0={-vAnchoPx / 2} w={distanciaCarasInternas} d={vAnchoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} />
      )}
      {/* Zapata izquierda: se dibuja ANTES que la viga, así la viga queda      */}
      {/* ENCIMA de ella (visible, la tapa donde se cruzan).                   */}
      <IsoBoxLineArt x0={-centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={zapataZ0} z1={zapataZ1} ox={ox} oy={oy} />
      {/* Viga de amarre, a la misma profundidad que las zapatas */}
      {distanciaCarasInternas > 0 && (
        <IsoBoxLineArt x0={-centroX + halfZ} y0={-vAnchoPx / 2} w={distanciaCarasInternas} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
      )}
      {/* Zapata derecha: se dibuja DESPUÉS que la viga, así queda ENCIMA y la */}
      {/* tapa donde se cruzan — esto imita la profundidad real: desde este    */}
      {/* ángulo isométrico, la zapata izquierda queda "detrás" (la viga pasa  */}
      {/* por encima) y la derecha queda "adelante" (tapa a la viga).         */}
      <IsoBoxLineArt x0={centroX - halfZ} y0={-halfZAncho} w={zLargoPx} d={zAnchoPx} z0={zapataZ0} z1={zapataZ1} ox={ox} oy={oy} />
      {/* Pedestales, también arrancando desde la parte de arriba de la zapata */}
      <IsoBoxLineArt x0={-centroX - pAnchoPx / 2} y0={-pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
      <IsoBoxLineArt x0={centroX - pAnchoPx / 2} y0={-pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
      {/* Nivel de terreno natural: un plano a la altura de la PARTE DE ARRIBA de los pedestales */}
      <polygon
        points={poly([
          isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy),
          isoPt(centroX + pAnchoPx / 2 + 16, -halfZAncho - 20, ntnZ, ox, oy),
          isoPt(centroX + pAnchoPx / 2 + 16, halfZAncho + 20, ntnZ, ox, oy),
          isoPt(-centroX - pAnchoPx / 2 - 16, halfZAncho + 20, ntnZ, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy)[0] - 4}
        y={isoPt(-centroX - pAnchoPx / 2 - 16, -halfZAncho - 20, ntnZ, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      {/* Cota de altura del pedestal, a la derecha, paralela a su borde */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={alturaTopX + 18} y1={alturaTopY} x2={alturaBotX + 18} y2={alturaBotY} />
        <line x1={alturaTopX + 14} y1={alturaTopY} x2={alturaTopX + 22} y2={alturaTopY} />
        <line x1={alturaBotX + 14} y1={alturaBotY} x2={alturaBotX + 22} y2={alturaBotY} />
      </g>
      <text x={alturaTopX + 28} y={(alturaTopY + alturaBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${alturaTopX + 28}, ${(alturaTopY + alturaBotY) / 2})`}>
        {pAltura > 0 ? pAltura.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Planta de UNA zapata (las dos son iguales) con la parrilla de acero en    */
/* las dos direcciones — cada barra con sus 2 ganchos hacia arriba          */
/* representados como un punto en cada extremo.                            */
export function PortonZapataPlanta({ datos }) {
  const z = datos.zapata || {};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ancho = parseFloat(z.ancho) || 0;
  const largo = parseFloat(z.largo) || 0;
  const w = clamp((ancho || 1) * 90, 60, 140);
  const d = clamp((largo || 1) * 90, 60, 140);
  const cx = 100, cy = 90;
  const recubPx = 6;

  const parrilla = calcularParrillaZapata({
    ancho: z.ancho,
    largo: z.largo,
    longitudinal: z.parrilla_longitudinal,
    transversal: z.parrilla_transversal,
  });
  const nLong = Math.min(parrilla.longitudinal?.cantidad || 3, 10);
  const nTrans = Math.min(parrilla.transversal?.cantidad || 3, 10);

  return (
    <svg viewBox="0 0 200 210" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Barras longitudinales: corren verticalmente en el dibujo (a lo largo de "largo"), repartidas en el ancho */}
      {Array.from({ length: nLong }, (_, i) => {
        const frac = nLong === 1 ? 0.5 : i / (nLong - 1);
        const x = cx - w / 2 + recubPx + frac * (w - 2 * recubPx);
        return <line key={`l${i}`} x1={x} y1={cy - d / 2 + recubPx} x2={x} y2={cy + d / 2 - recubPx} stroke="#059669" strokeWidth="1.3" />;
      })}
      {/* Barras transversales: corren horizontalmente (a lo largo de "ancho"), repartidas a lo largo */}
      {Array.from({ length: nTrans }, (_, i) => {
        const frac = nTrans === 1 ? 0.5 : i / (nTrans - 1);
        const y = cy - d / 2 + recubPx + frac * (d - 2 * recubPx);
        return <line key={`t${i}`} x1={cx - w / 2 + recubPx} y1={y} x2={cx + w / 2 - recubPx} y2={y} stroke="#2563EB" strokeWidth="1.3" />;
      })}
      <text x={cx} y={cy - d / 2 - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {parrilla.longitudinal ? `${parrilla.longitudinal.cantidad}${z.parrilla_longitudinal?.calibre || '#—'} @${z.parrilla_longitudinal?.separacion || '—'}` : 'Long. —'}
      </text>
      <text x={cx + w / 2 + 8} y={cy} textAnchor="middle" fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${cy})`}>
        {parrilla.transversal ? `${parrilla.transversal.cantidad}${z.parrilla_transversal?.calibre || '#—'} @${z.parrilla_transversal?.separacion || '—'}` : 'Trans. —'}
      </text>
      <text x={cx} y={cy + d / 2 + 22} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        Zapata {ancho || '—'} × {largo || '—'} m
      </text>
    </svg>
  );
}

/* Vista en planta (desde arriba) de TODO el conjunto: las 2 zapatas y la    */
/* viga que las une, con la cota de separación entre centros.               */
export function PortonPlanta({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const zAncho = parseFloat(z.ancho) || 0;
  const zLargo = parseFloat(z.largo) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const scale = 40;
  const zAnchoPx = clamp((zAncho || 1) * scale, 30, 70);
  const zLargoPx = clamp((zLargo || 1) * scale, 30, 70);
  const vAnchoPx = clamp((vAncho || 0.3) * scale, 6, 16);
  const sepPx = clamp((separacion || 5) * scale, 110, 220);

  const cx = 150, cy = 100;
  const x1 = cx - sepPx / 2;
  const x2 = cx + sepPx / 2;

  return (
    <svg viewBox="0 0 300 190" className={PORTON_CSS_SIZE}>
      <rect x={x1 - zLargoPx / 2} y={cy - zAnchoPx / 2} width={zLargoPx} height={zAnchoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={x2 - zLargoPx / 2} y={cy - zAnchoPx / 2} width={zLargoPx} height={zAnchoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {sepPx - zLargoPx > 0 && (
        <rect x={x1 + zLargoPx / 2} y={cy - vAnchoPx / 2} width={sepPx - zLargoPx} height={vAnchoPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.2" />
      )}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={cy - zAnchoPx / 2 - 16} x2={x2} y2={cy - zAnchoPx / 2 - 16} />
        <line x1={x1} y1={cy - zAnchoPx / 2 - 20} x2={x1} y2={cy - zAnchoPx / 2 - 12} />
        <line x1={x2} y1={cy - zAnchoPx / 2 - 20} x2={x2} y2={cy - zAnchoPx / 2 - 12} />
      </g>
      <text x={cx} y={cy - zAnchoPx / 2 - 26} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {separacion || '—'} m (centro a centro)
      </text>
    </svg>
  );
}

/* Vista en elevación (de frente) de TODO el conjunto: las 2 zapatas abajo,  */
/* la viga entre ellas, y los 2 pedestales subiendo desde cada zapata.      */
export function PortonElevacion({ datos }) {
  const z = datos.zapata || {};
  const v = datos.viga || {};
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const zLargo = parseFloat(z.largo) || 0;
  const zEspesor = parseFloat(z.espesor) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const pAltura = Math.max(0, desplante - zEspesor);
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;
  const separacion = parseFloat(datos.separacion_zapatas) || 0;

  const scale = 30;
  const zLargoPx = clamp((zLargo || 1) * scale, 26, 55);
  const zEspesorPx = clamp((zEspesor || 0.35) * scale, 8, 18);
  const soladoPx = clamp((espesorSolado || 0.05) * scale, 4, 9);
  const vAltoPx = clamp((vAlto || 0.35) * scale, 8, 18);
  const pAnchoPx = clamp((pAncho || 0.4) * scale, 16, 30);
  const pAlturaPx = clamp((pAltura || 0.7) * scale, 25, 70);
  const sepPx = clamp((separacion || 5) * scale, 110, 220);

  const cx = 150;
  const groundY = 40; // N.T.N. — a la altura de la parte de ARRIBA de los pedestales
  const pBotY = groundY + pAlturaPx; // = parte de arriba de la zapata
  const zBotY = pBotY + zEspesorPx; // = parte de abajo de la zapata
  const soladoBotY = zBotY + soladoPx;
  const x1 = cx - sepPx / 2;
  const x2 = cx + sepPx / 2;

  return (
    <svg viewBox="0 0 300 210" className={PORTON_CSS_SIZE}>
      <line x1={x1 - 30} y1={groundY} x2={x2 + 30} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={x1 - 34} y={groundY - 4} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Solado bajo cada zapata, y bajo el tramo de la viga entre ellas */}
      <rect x={x1 - zLargoPx / 2} y={zBotY} width={zLargoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      <rect x={x2 - zLargoPx / 2} y={zBotY} width={zLargoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      {x2 - zLargoPx / 2 - (x1 + zLargoPx / 2) > 0 && (
        <rect x={x1 + zLargoPx / 2} y={zBotY} width={x2 - zLargoPx / 2 - (x1 + zLargoPx / 2)} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      )}
      {/* Zapatas */}
      <rect x={x1 - zLargoPx / 2} y={pBotY} width={zLargoPx} height={zEspesorPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={x2 - zLargoPx / 2} y={pBotY} width={zLargoPx} height={zEspesorPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {/* Viga, entre las caras internas de las zapatas (no penetra en ellas), */}
      {/* a la misma profundidad (su base coincide con el fondo de la zapata, */}
      {/* justo encima del solado).                                          */}
      {x2 - zLargoPx / 2 - (x1 + zLargoPx / 2) > 0 && (
        <rect
          x={x1 + zLargoPx / 2}
          y={zBotY - vAltoPx}
          width={x2 - zLargoPx / 2 - (x1 + zLargoPx / 2)}
          height={vAltoPx}
          fill="#EAF1FF"
          stroke="#152644"
          strokeWidth="1.2"
        />
      )}
      {/* Pedestales */}
      <rect x={x1 - pAnchoPx / 2} y={groundY} width={pAnchoPx} height={pAlturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      <rect x={x2 - pAnchoPx / 2} y={groundY} width={pAnchoPx} height={pAlturaPx} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota de separación, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={groundY - 14} x2={x2} y2={groundY - 14} />
        <line x1={x1} y1={groundY - 18} x2={x1} y2={groundY - 10} />
        <line x1={x2} y1={groundY - 18} x2={x2} y2={groundY - 10} />
      </g>
      <text x={cx} y={groundY - 22} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        Separación (centro a centro): {separacion || '—'} m
      </text>
      {/* Cota de altura del pedestal, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - pAnchoPx / 2 - 14} y1={groundY} x2={x1 - pAnchoPx / 2 - 14} y2={pBotY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={groundY} x2={x1 - pAnchoPx / 2 - 18} y2={groundY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pBotY} x2={x1 - pAnchoPx / 2 - 18} y2={pBotY} />
      </g>
      <text x={x1 - pAnchoPx / 2 - 24} y={(groundY + pBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${x1 - pAnchoPx / 2 - 24}, ${(groundY + pBotY) / 2})`}>
        {pAltura > 0 ? pAltura.toFixed(2) : '—'} m
      </text>
      {/* Cota de espesor de zapata, a la derecha */}
      <g stroke="#3C64AA" strokeWidth="1">
        <line x1={x2 + zLargoPx / 2 + 14} y1={pBotY} x2={x2 + zLargoPx / 2 + 14} y2={zBotY} />
        <line x1={x2 + zLargoPx / 2 + 10} y1={pBotY} x2={x2 + zLargoPx / 2 + 18} y2={pBotY} />
        <line x1={x2 + zLargoPx / 2 + 10} y1={zBotY} x2={x2 + zLargoPx / 2 + 18} y2={zBotY} />
      </g>
      <text x={x2 + zLargoPx / 2 + 24} y={(pBotY + zBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#3C64AA" transform={`rotate(90, ${x2 + zLargoPx / 2 + 24}, ${(pBotY + zBotY) / 2})`}>
        {zEspesor || '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal del pedestal (planta): estribo con sus 2 ganchos y las  */
/* barras de esquina — igual criterio que en Inversores.                    */
/* Reparte "cantidad" barras alrededor del perímetro de un rectángulo：      */
/* siempre 4 en las esquinas, y las que sobren repartidas parejo entre los  */
/* 4 lados (ej. cantidad=8 → 4 esquinas + 1 a la mitad de cada lado).       */
/* Marca del gancho a 180° de un estribo, en corte transversal: 2 líneas     */
/* casi paralelas en la esquina superior izquierda del estribo, a 315°       */
/* medido desde la horizontal (convención estándar, sentido antihorario) —  */
/* es decir, hacia ABAJO-DERECHA desde la esquina, entrando en el estribo   */
/* (no hacia afuera de la caja, que se prestaba a confusión visual).        */
export function GanchoEstriboEsquina({ x, y, size = 9, gap = 3 }) {
  const rad = (315 * Math.PI) / 180; // 315° = -45°, medido antihorario desde la horizontal
  // screen_dx = cos(rad); screen_dy = -sin(rad) (el eje Y de pantalla está invertido respecto al matemático)
  const dx = size * Math.cos(rad);
  const dy = -size * Math.sin(rad);
  // Desplazamiento perpendicular a la línea del gancho, para separar las 2 líneas.
  const perpRad = rad + Math.PI / 2;
  const ox = gap * Math.cos(perpRad);
  const oy = -gap * Math.sin(perpRad);
  return (
    <g stroke="#2563EB" strokeWidth="1.3">
      <line x1={x} y1={y} x2={x + dx} y2={y + dy} />
      <line x1={x + ox} y1={y + oy} x2={x + dx + ox} y2={y + dy + oy} />
    </g>
  );
}

export function puntosPerimetroRectangulo(halfW, halfD, cantidad) {
  const puntos = [
    [-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD],
  ];
  const extra = Math.max(0, cantidad - 4);
  const porLado = Math.floor(extra / 4);
  const restante = extra % 4;
  const lados = [
    { fijo: 'y', valor: -halfD, min: -halfW, max: halfW }, // lado superior
    { fijo: 'x', valor: halfW, min: -halfD, max: halfD }, // lado derecho
    { fijo: 'y', valor: halfD, min: halfW, max: -halfW }, // lado inferior (invertido)
    { fijo: 'x', valor: -halfW, min: halfD, max: -halfD }, // lado izquierdo (invertido)
  ];
  lados.forEach((lado, li) => {
    const n = porLado + (li < restante ? 1 : 0);
    for (let i = 1; i <= n; i++) {
      const frac = i / (n + 1);
      const val = lado.min + frac * (lado.max - lado.min);
      puntos.push(lado.fijo === 'y' ? [val, lado.valor] : [lado.valor, val]);
    }
  });
  return puntos;
}

export function PortonPedestalCorte({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.4;
  const pProfundo = parseFloat(p.profundo) || 0.4;
  const cantidad = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const w = clamp(pAncho * 130, 40, 100);
  const d = clamp(pProfundo * 130, 40, 100);
  const cx = 85, cy = 80;
  const recubPx = 7;
  const puntos = puntosPerimetroRectangulo(w / 2 - recubPx, d / 2 - recubPx, cantidad);

  return (
    <svg viewBox="0 0 180 190" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <GanchoEstriboEsquina x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} />
      {puntos.map(([px, py], i) => (
        <circle key={i} cx={cx + px} cy={cy + py} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{pAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{pProfundo || '—'} m</text>
    </svg>
  );
}

/* Vista posterior (elevación) del despiece del pedestal: mismo criterio que */
/* Inversores — solo la mitad de las barras se ven (front+back se encimarían */
/* en la proyección), con ganchos hacia el centro, estribos centrados y con */
/* la separación real, y la altura que incluye el empotramiento en la       */
/* zapata (el acero llega hasta allá, aunque el concreto visible no).      */
export function PortonPedestalElevacion({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.4;
  const pProfundo = parseFloat(p.profundo) || 0.4;
  const alturaTotal = Math.max(0, (parseFloat(datos.desplante) || 0) - (parseFloat(datos.zapata?.espesor) || 0)) + (parseFloat(p.empotramiento_zapata) || 0);
  const cantidadBarras = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const ganchosBarra = parseFloat(p.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[p.barras?.calibre];
  const estribos = calcularEstribos({ altura: alturaTotal, ancho: p.ancho, profundo: p.profundo, separacion: p.estribos?.separacion, calibre: p.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionM = parseFloat(p.estribos?.separacion) || 0;

  const w = clamp(pAncho * 130, 45, 100);
  const h = clamp((alturaTotal || 0.5) * 130, 90, 190);
  const cx = 90, topY = 30, botY = topY + h, recubPx = 7;
  const escala = alturaTotal > 0 ? h / alturaTotal : 130;

  // Las posiciones visibles en una elevación son las X ÚNICAS de las barras
  // repartidas en el perímetro — no la mitad de la cantidad total. Con 8
  // barras (4 esquinas + 4 a mitad de lado), solo hay 3 X distintas:
  // izquierda, centro (las de los lados frontal/posterior caen ahí) y derecha.
  const puntos = puntosPerimetroRectangulo(1, pProfundo / pAncho || 1, cantidadBarras);
  const xUnicas = Array.from(new Set(puntos.map(([px]) => Math.round(px * 1000) / 1000))).sort((a, b) => a - b);
  const barX = xUnicas.map((frac) => cx + (frac * (w - 2 * recubPx)) / 2);
  const distanciaEntreBarras = barX.length > 1 ? barX[barX.length - 1] - barX[0] : w;
  const ganchoMaximoSinChoque = (distanciaEntreBarras / 2) * 0.6;
  const ganchoPx = infoBarra ? clamp(Math.min(infoBarra.gancho * escala, ganchoMaximoSinChoque), 5, 13) : Math.min(10, ganchoMaximoSinChoque);

  const separacionPx = separacionM > 0 ? separacionM * escala : (h - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
  const totalSpanEstribos = (cantidadEstribos - 1) * separacionPx;
  const inicioEstribos = topY + recubPx + Math.max(0, (h - 2 * recubPx - totalSpanEstribos) / 2);
  const estriboY = [];
  for (let i = 0; i < cantidadEstribos; i++) estriboY.push(inicioEstribos + i * separacionPx);

  const ganchosLabel = ganchosBarra > 0 ? 'L'.repeat(Math.min(ganchosBarra, 2)) : '';
  const ganchoLongitud = infoBarra ? infoBarra.gancho : null;

  return (
    <svg viewBox="0 0 190 250" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboY.map((y, i) => (
        <line key={i} x1={cx - w / 2 + recubPx} y1={y} x2={cx + w / 2 - recubPx} y2={y} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {barX.map((x, i) => {
        const dir = x < cx ? 1 : x > cx ? -1 : 1;
        return (
          <g key={i}>
            <line x1={x} y1={topY + 2} x2={x} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />
            {ganchosBarra >= 1 && <line x1={x} y1={botY - 2} x2={x + dir * ganchoPx} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />}
            {ganchosBarra >= 2 && <line x1={x} y1={topY + 2} x2={x + dir * ganchoPx} y2={topY + 2} stroke="#059669" strokeWidth="1.6" />}
          </g>
        );
      })}
      <text x={cx} y={topY - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {cantidadBarras}{p.barras?.calibre || '#—'} {ganchosLabel}{ganchoLongitud !== null ? ganchoLongitud.toFixed(2) : ''}
      </text>
      <text x={cx + w / 2 + 8} y={(topY + botY) / 2} fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${(topY + botY) / 2})`} textAnchor="middle">
        {cantidadEstribos || '—'} E{p.estribos?.calibre || '#—'} @{p.estribos?.separacion || '—'}
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={topY} x2={cx - w / 2 - 16} y2={botY} />
        <line x1={cx - w / 2 - 12} y1={topY} x2={cx - w / 2 - 20} y2={topY} />
        <line x1={cx - w / 2 - 12} y1={botY} x2={cx - w / 2 - 20} y2={botY} />
      </g>
      <text x={cx - w / 2 - 26} y={(topY + botY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${(topY + botY) / 2})`}>
        {alturaTotal ? alturaTotal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal de la viga de amarre: 4 barras de esquina (2 arriba +   */
/* 2 abajo — las que luego se ven "duplicadas" en pares por el traslapo) +  */
/* el estribo con sus 2 ganchos.                                            */
export function PortonVigaCorte({ datos }) {
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const vAncho = parseFloat(v.ancho) || 0.3;
  const vAlto = parseFloat(v.alto) || 0.35;
  const w = clamp(vAncho * 150, 40, 110);
  const d = clamp(vAlto * 150, 40, 110);
  const cx = 90, cy = 80;
  const recubPx = 7;

  return (
    <svg viewBox="0 0 180 190" className={PORTON_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <GanchoEstriboEsquina x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={cx + sx * (w / 2 - recubPx)} cy={cy + sy * (d / 2 - recubPx)} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{vAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{vAlto || '—'} m</text>
    </svg>
  );
}


/* Vista posterior (elevación) de la viga a lo largo de su longitud: la      */
/* línea de arriba y la de abajo (cada una representa las 2 barras de esa    */
/* capa, que en elevación se ven encimadas) con la marca del traslapo en su  */
/* tercio correspondiente (arriba en L/3, abajo en 2L/3), los ganchos en el  */
/* extremo que ancla en cada zapata, y los estribos con su separación real.  */
export function PortonVigaElevacion({ datos }) {
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const vAlto = parseFloat(v.alto) || 0.35;
  const longitudViga = (parseFloat(datos.separacion_zapatas) || 0) - (parseFloat(datos.zapata?.largo) || 0);
  const separacionEstribos = parseFloat(v.estribos?.separacion) || 0;
  const estribos = calcularEstribos({ altura: longitudViga > 0 ? longitudViga : undefined, ancho: v.ancho, profundo: v.alto, separacion: v.estribos?.separacion, calibre: v.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const ganchosBarra = parseFloat(v.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[v.barras?.calibre];

  const w = clamp((longitudViga || 5) * 40, 260, 420);
  const h = clamp(vAlto * 160, 40, 75);
  const cx = 220, topY = 50, leftX = cx - w / 2, rightX = cx + w / 2, botY = topY + h;
  const recubPx = 6;
  const escala = longitudViga > 0 ? w / longitudViga : 40;
  const ganchoPx = infoBarra ? clamp(infoBarra.gancho * escala, 8, 18) : 12;

  const estriboX = [];
  if (cantidadEstribos > 0) {
    const separacionPx = separacionEstribos > 0 ? separacionEstribos * escala : (w - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
    const totalSpan = (cantidadEstribos - 1) * separacionPx;
    const inicio = leftX + recubPx + Math.max(0, (w - 2 * recubPx - totalSpan) / 2);
    for (let i = 0; i < cantidadEstribos; i++) estriboX.push(inicio + i * separacionPx);
  }

  const tercio1 = leftX + w / 3;
  const tercio2 = leftX + (2 * w) / 3;

  return (
    <svg viewBox="0 0 440 170" className={PORTON_VIGA_ELEV_CSS_SIZE}>
      <rect x={leftX} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboX.map((x, i) => (
        <line key={i} x1={x} y1={topY + recubPx} x2={x} y2={botY - recubPx} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {/* Barra superior: gancho en AMBOS extremos (ancla en cada zapata), empalme marcado en L/3 */}
      <line x1={leftX + 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={topY + recubPx} x2={leftX + 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      <circle cx={tercio1} cy={topY + recubPx} r="2.8" fill="white" stroke="#059669" strokeWidth="1.3" />
      <text x={tercio1} y={topY - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">empalme 1/3</text>
      {/* Barra inferior: gancho en AMBOS extremos (ancla en cada zapata), empalme marcado en 2L/3 */}
      <line x1={leftX + 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={botY - recubPx} x2={leftX + 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      <circle cx={tercio2} cy={botY - recubPx} r="2.8" fill="white" stroke="#059669" strokeWidth="1.3" />
      <text x={tercio2} y={botY + 16} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">empalme 2/3</text>
      {/* Cota de longitud, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={leftX} y1={topY - 20} x2={rightX} y2={topY - 20} />
        <line x1={leftX} y1={topY - 24} x2={leftX} y2={topY - 16} />
        <line x1={rightX} y1={topY - 24} x2={rightX} y2={topY - 16} />
      </g>
      <text x={cx} y={topY - 28} textAnchor="middle" fontSize="9" fontWeight="600" fill="#152644">
        Longitud (entre caras internas) {longitudViga > 0 ? longitudViga.toFixed(2) : '—'} m
      </text>
      <text x={cx} y={botY + 32} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#2563EB">
        {cantidadEstribos || '—'} E{v.estribos?.calibre || '#—'} @{v.estribos?.separacion || '—'}
      </text>
    </svg>
  );
}

export function PortonVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <PortonIsometrico datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico del conjunto</p>
      </div>
      <div className="text-center">
        <PortonPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Planta del conjunto</p>
      </div>
      <div className="text-center">
        <PortonElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Elevación del conjunto</p>
      </div>
      <div className="text-center">
        <PortonZapataPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Sección de zapata (con parrilla)</p>
      </div>
      <div className="text-center">
        <PortonPedestalCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · corte transversal</p>
      </div>
      <div className="text-center">
        <PortonPedestalElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · vista posterior</p>
      </div>
      <div className="text-center">
        <PortonVigaCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga · corte transversal</p>
      </div>
      <div className="text-center">
        <PortonVigaElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga · vista posterior</p>
      </div>
    </div>
  );
}

/* Garantiza que TODA la estructura anidada de datos exista, sin importar    */
/* qué tan vieja sea la plantilla guardada (por ejemplo, si se creó antes   */
/* de que existiera el campo "ganchos" de la viga, o antes de que la altura */
/* del pedestal se calculara sola). Sin esto, abrir una plantilla vieja      */
/* para editarla podía reventar con una pantalla en blanco.                */
export function normalizarDatosPorton(datos) {
  const base = {
    zapata: {
      ancho: '', largo: '', espesor: '',
      parrilla_longitudinal: { calibre: '', separacion: '' },
      parrilla_transversal: { calibre: '', separacion: '' },
    },
    viga: {
      ancho: '', alto: '',
      barras: { calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    pedestal: {
      ancho: '', profundo: '', empotramiento_zapata: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    separacion_zapatas: '',
    desplante: '',
    espesor_solado: '',
    resistencia: '',
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    zapata: {
      ...base.zapata,
      ...datos.zapata,
      parrilla_longitudinal: { ...base.zapata.parrilla_longitudinal, ...datos.zapata?.parrilla_longitudinal },
      parrilla_transversal: { ...base.zapata.parrilla_transversal, ...datos.zapata?.parrilla_transversal },
    },
    viga: {
      ...base.viga,
      ...datos.viga,
      barras: { ...base.viga.barras, ...datos.viga?.barras },
      estribos: { ...base.viga.estribos, ...datos.viga?.estribos },
    },
    pedestal: {
      ...base.pedestal,
      ...datos.pedestal,
      barras: { ...base.pedestal.barras, ...datos.pedestal?.barras },
      estribos: { ...base.pedestal.estribos, ...datos.pedestal?.estribos },
    },
  };
}

export function PortonForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosPorton(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }
  function setSubgrupo(grupo, subgrupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [subgrupo]: { ...prev[grupo][subgrupo], [key]: val } } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  const parrilla = calcularParrillaZapata({
    ancho: datos.zapata.ancho,
    largo: datos.zapata.largo,
    longitudinal: datos.zapata?.parrilla_longitudinal,
    transversal: datos.zapata?.parrilla_transversal,
  });
  const vigaBarras = calcularBarrasVigaAmarre({
    separacionCentros: datos.separacion_zapatas,
    calibre: datos.viga?.barras?.calibre,
    resistencia: datos.resistencia,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const longitudViga = (parseFloat(datos.separacion_zapatas) || 0) - (parseFloat(datos.zapata.largo) || 0);
  const vigaEstribos = calcularEstribos({
    altura: longitudViga > 0 ? longitudViga : undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });
  const alturaPedestal = Math.max(0, (parseFloat(datos.desplante) || 0) - (parseFloat(datos.zapata?.espesor) || 0));
  const alturaTotalPedestal = alturaPedestal + (parseFloat(datos.pedestal.empotramiento_zapata) || 0);
  const pedestalLongitudinales = calcularLongitudinales({
    altura: alturaTotalPedestal || undefined,
    cantidad: datos.pedestal?.barras?.cantidad,
    calibre: datos.pedestal?.barras?.calibre,
    ganchos: datos.pedestal?.barras?.ganchos,
  });
  const pedestalEstribos = calcularEstribos({
    altura: alturaTotalPedestal || undefined,
    ancho: datos.pedestal.ancho,
    profundo: datos.pedestal.profundo,
    separacion: datos.pedestal?.estribos?.separacion,
    calibre: datos.pedestal?.estribos?.calibre,
  });
  const volumenes = calcularVolumenesPorton({
    zapata: datos.zapata,
    viga: datos.viga,
    pedestal: datos.pedestal,
    separacionZapatas: datos.separacion_zapatas,
    desplante: datos.desplante,
    espesorSolado: datos.espesor_solado,
  });

  const pesoTotalAcero =
    (parrilla.longitudinal?.pesoTotal || 0) * 2 + // ×2 porque son 2 zapatas iguales
    (parrilla.transversal?.pesoTotal || 0) * 2 +
    (vigaBarras?.pesoTotal || 0) +
    (vigaEstribos?.pesoTotal ? vigaEstribos.pesoEstribo * vigaEstribos.cantidad : 0) +
    (pedestalLongitudinales?.pesoTotal || 0) +
    (pedestalEstribos?.pesoTotal || 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Cerramiento · Portón
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <PortonVistas datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Portón Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
          <p className="text-xs text-navy-400 mt-1">Se usa para buscar el traslapo de la viga en la tabla NSR-10 (solo cubre 21/28/35 MPa).</p>
        </div>
      </div>

      <div className="border border-navy-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Datos compartidos del conjunto</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-navy-500 mb-1">Separación entre zapatas (centro a centro, m)</label>
            <input value={datos.separacion_zapatas} onChange={(e) => set('separacion_zapatas', e.target.value)} placeholder="5.27" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Profundidad de desplante (m)</label>
            <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="1.15" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2 italic">
          Estos 3 valores son de todo el conjunto (zapatas + viga) — la excavación se calcula con la huella completa (2 zapatas + el tramo de la viga entre ellas) por (desplante + espesor de solado).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Zapata */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Zapata (2 iguales)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.zapata.ancho} onChange={(e) => setGrupo('zapata', 'ancho', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Largo (m)</label>
              <input value={datos.zapata.largo} onChange={(e) => setGrupo('zapata', 'largo', e.target.value)} placeholder="1.00" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor (m)</label>
              <input value={datos.zapata.espesor} onChange={(e) => setGrupo('zapata', 'espesor', e.target.value)} placeholder="0.35" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-2">"Largo" es la dirección a lo largo del eje de la viga.</p>

          <p className="text-xs font-semibold text-navy-600 mb-2">Parrilla — dirección longitudinal (corre a lo largo de "Largo")</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.zapata.parrilla_longitudinal.calibre} onChange={(val) => setSubgrupo('zapata', 'parrilla_longitudinal', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.zapata.parrilla_longitudinal.separacion} onChange={(e) => setSubgrupo('zapata', 'parrilla_longitudinal', 'separacion', e.target.value)} placeholder="0.12" className={cellInput} />
            </div>
          </div>
          {parrilla.longitudinal ? (
            <p className="text-xs text-navy-500 mb-3">
              → <span className="font-mono font-semibold text-navy-700">{parrilla.longitudinal.cantidad}</span> barras de{' '}
              <span className="font-mono font-semibold text-navy-700">{parrilla.longitudinal.longitud.toFixed(2)} m</span> c/u (2 ganchos arriba) — {parrilla.longitudinal.pesoTotal.toFixed(2)} kg por zapata
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa ancho, largo, calibre y separación.</p>
          )}

          <p className="text-xs font-semibold text-navy-600 mb-2">Parrilla — dirección transversal (corre a lo largo de "Ancho")</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.zapata.parrilla_transversal.calibre} onChange={(val) => setSubgrupo('zapata', 'parrilla_transversal', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.zapata.parrilla_transversal.separacion} onChange={(e) => setSubgrupo('zapata', 'parrilla_transversal', 'separacion', e.target.value)} placeholder="0.24" className={cellInput} />
            </div>
          </div>
          {parrilla.transversal ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{parrilla.transversal.cantidad}</span> barras de{' '}
              <span className="font-mono font-semibold text-navy-700">{parrilla.transversal.longitud.toFixed(2)} m</span> c/u (2 ganchos arriba) — {parrilla.transversal.pesoTotal.toFixed(2)} kg por zapata
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa ancho, largo, calibre y separación.</p>
          )}
        </div>

        {/* Viga de amarre */}
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Viga de amarre</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho de sección (m)</label>
              <input value={datos.viga.ancho} onChange={(e) => setGrupo('viga', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto de sección (m)</label>
              <input value={datos.viga.alto} onChange={(e) => setGrupo('viga', 'alto', e.target.value)} placeholder="0.35" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Longitud (entre caras internas de las zapatas): <span className="font-mono text-navy-600">{longitudViga > 0 ? longitudViga.toFixed(2) : '—'} m</span>
          </p>
          <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales (8 en total: 4 líneas traslapadas en pares)</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.barras.calibre} onChange={(val) => setSubgrupo('viga', 'barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° de ganchos por pieza</label>
              <input value={datos.viga.barras.ganchos} onChange={(e) => setSubgrupo('viga', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {vigaBarras ? (
            <p className="text-xs text-navy-500 mb-3">
              → Traslapo de <span className="font-mono font-semibold text-navy-700">{vigaBarras.traslapo.toFixed(2)} m</span> (arriba a 1/3, abajo a 2/3) · pieza corta{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaBarras.piezaCorta.toFixed(2)} m</span> · pieza larga{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaBarras.piezaLarga.toFixed(2)} m</span> · {vigaBarras.piezas} piezas en total — {vigaBarras.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa separación entre zapatas, resistencia y calibre.</p>
          )}
          <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.estribos.calibre} onChange={(val) => setSubgrupo('viga', 'estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.viga.estribos.separacion} onChange={(e) => setSubgrupo('viga', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {vigaEstribos ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{vigaEstribos.cantidad}</span> estribos de{' '}
              <span className="font-mono font-semibold text-navy-700">{vigaEstribos.longitud.toFixed(2)} m</span> c/u — {(vigaEstribos.pesoEstribo * vigaEstribos.cantidad).toFixed(2)} kg en total
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa ancho, alto, separación y calibre.</p>
          )}
        </div>

        {/* Pedestal */}
        <div className="border border-navy-200 rounded-lg p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestal (2 iguales, van sobre la zapata)</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.40" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Empotramiento en zapata (m)</label>
              <input value={datos.pedestal.empotramiento_zapata} onChange={(e) => setGrupo('pedestal', 'empotramiento_zapata', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs text-navy-400 mb-3">
            Altura del pedestal (desplante − espesor de zapata): <span className="font-mono text-navy-600">{alturaPedestal > 0 ? alturaPedestal.toFixed(2) : '—'} m</span>
          </p>
          <p className="text-xs text-navy-400 mb-3 italic">
            El pedestal se apoya ENCIMA de la zapata, va enterrado (el nivel de terreno natural queda a la altura de su parte superior) — no tiene solado propio ni cuenta aparte en la excavación. El "empotramiento" es solo para saber hasta dónde llega el acero dentro de la zapata.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° barras</label>
                  <input value={datos.pedestal.barras.cantidad} onChange={(e) => setSubgrupo('pedestal', 'barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.barras.calibre} onChange={(val) => setSubgrupo('pedestal', 'barras', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">N.° ganchos</label>
                  <input value={datos.pedestal.barras.ganchos} onChange={(e) => setSubgrupo('pedestal', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
                </div>
              </div>
              {pedestalLongitudinales ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalLongitudinales.longitud.toFixed(2)} m</span> c/u — {pedestalLongitudinales.pesoTotal.toFixed(2)} kg (2 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa altura, empotramiento, cantidad y calibre.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Calibre</label>
                  <CalibreSelect value={datos.pedestal.estribos.calibre} onChange={(val) => setSubgrupo('pedestal', 'estribos', 'calibre', val)} className={cellInput} />
                </div>
                <div>
                  <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
                  <input value={datos.pedestal.estribos.separacion} onChange={(e) => setSubgrupo('pedestal', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
                </div>
              </div>
              {pedestalEstribos ? (
                <p className="text-xs text-navy-500">
                  → <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.cantidad}</span> estribos de{' '}
                  <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.longitud.toFixed(2)} m</span> — {pedestalEstribos.pesoTotal.toFixed(2)} kg (2 pedestales)
                </p>
              ) : (
                <p className="text-xs text-navy-300 italic">Completa altura, empotramiento, dimensiones, separación y calibre.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {pesoTotalAcero > 0 && (
        <div className="mt-4 bg-white border border-navy-200 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-navy-700 mb-2">Peso de acero por elemento</p>
          <FilaResumenAcero label="Zapata — parrilla longitudinal (2 zapatas)" valor={`${((parrilla.longitudinal?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Zapata — parrilla transversal (2 zapatas)" valor={`${((parrilla.transversal?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Viga — barras longitudinales (8 piezas)" valor={`${(vigaBarras?.pesoTotal || 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Viga — estribos" valor={`${(vigaEstribos ? vigaEstribos.pesoEstribo * vigaEstribos.cantidad : 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Pedestal — barras longitudinales (2 pedestales)" valor={`${(pedestalLongitudinales?.pesoTotal || 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Pedestal — estribos (2 pedestales)" valor={`${(pedestalEstribos?.pesoTotal || 0).toFixed(2)} kg`} />
        </div>
      )}
      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* SHELTER · CENTRO DE TRANSFORMACIÓN (CT) — 4 pedestales +       */
/* 4 vigas (2 largas, 2 cortas) formando un marco. Sin zapata.    */
/* ============================================================ */
export const CT_M2PX = 42;
export const CT_CSS_SIZE = 'w-80 h-64';
export const CT_ISO_CSS_SIZE = 'w-[35rem] h-auto';
export const CT_PLANTA_CSS_SIZE = 'w-56 h-56';
export const CT_PLANTA_GRANDE_CSS_SIZE = 'w-96 h-80';
export const CT_VIGA_ELEV_CSS_SIZE = 'w-[26rem] h-40';

/* Garantiza que toda la estructura anidada exista, sin importar qué tan     */
/* vieja sea la plantilla guardada — mismo motivo que en Portón: sin esto,   */
/* abrir una plantilla vieja para editarla puede reventar con pantalla en   */
/* blanco.                                                                   */
export function normalizarDatosCT(datos) {
  const base = {
    ancho: '', largo: '',
    desplante: '', sobresaliente: '0.50',
    espesor_solado: '', resistencia: '',
    pedestal: {
      ancho: '', profundo: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
    viga: {
      ancho: '', alto: '',
      barras: { cantidad: '', calibre: '', ganchos: '1' },
      estribos: { calibre: '', separacion: '' },
    },
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    pedestal: {
      ...base.pedestal,
      ...datos.pedestal,
      barras: { ...base.pedestal.barras, ...datos.pedestal?.barras },
      estribos: { ...base.pedestal.estribos, ...datos.pedestal?.estribos },
    },
    viga: {
      ...base.viga,
      ...datos.viga,
      barras: { ...base.viga.barras, ...datos.viga?.barras },
      estribos: { ...base.viga.estribos, ...datos.viga?.estribos },
    },
  };
}

/* Isométrico del marco completo: 4 pedestales en las esquinas + 4 vigas     */
/* (2 largas + 2 cortas) uniéndolos. Las vigas se dibujan ANTES que los      */
/* pedestales — en las 4 esquinas, el pedestal siempre tapa el extremo de   */
/* la viga que llega a él (la viga "entra" al pedestal), así que este orden */
/* funciona en las 4 esquinas a la vez (a diferencia del Portón, que solo   */
/* tenía 2 esquinas con relación de profundidad opuesta entre sí).          */
export function CTIsometrico({ datos, className = CT_ISO_CSS_SIZE }) {
  const p = datos.pedestal || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const anchoCT = parseFloat(datos.ancho) || 0;
  const largoCT = parseFloat(datos.largo) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const vAncho = parseFloat(v.ancho) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const alturaPedestal = desplante + sobresaliente;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;

  const anchoPx = clamp((anchoCT || 2) * CT_M2PX, 70, 160);
  const largoPx = clamp((largoCT || 3) * CT_M2PX, 90, 200);
  const pAnchoPx = clamp((pAncho || 0.3) * CT_M2PX, 12, 26);
  const pProfundoPx = clamp((pProfundo || 0.3) * CT_M2PX, 12, 26);
  const pAlturaPx = clamp((alturaPedestal || 1) * CT_M2PX, 30, 75);
  const vAnchoPx = clamp((vAncho || 0.3) * CT_M2PX, 8, 18);
  const vAltoPx = clamp((vAlto || 0.3) * CT_M2PX, 8, 18);
  const soladoPx = clamp((espesorSolado || 0.05) * CT_M2PX, 4, 9);

  const halfAncho = anchoPx / 2;
  const halfLargo = largoPx / 2;
  const soladoZ0 = 0;
  const soladoZ1 = soladoPx;
  const pedestalZ0 = soladoPx;
  const pedestalZ1 = soladoPx + pAlturaPx;
  const ntnZ = soladoPx + clamp((desplante || 0.5) * CT_M2PX, 20, 60);
  const vigaZ1 = ntnZ;
  const vigaZ0 = ntnZ - vAltoPx;

  // El tamaño del lienzo se calcula a partir de los puntos extremos reales
  // del dibujo (con un origen provisional en 0,0), en vez de un margen fijo
  // pensado para el peor caso posible — así no queda espacio muerto de más
  // en los casos típicos (que son la inmensa mayoría).
  const PAD = 40;
  const esqAncho = pAnchoPx / 2;
  const esqProf = pProfundoPx / 2;
  const bounds = [
    isoPt(-halfAncho - esqAncho, -halfLargo - esqProf, 0, 0, 0),
    isoPt(halfAncho + esqAncho, -halfLargo - esqProf, 0, 0, 0),
    isoPt(halfAncho + esqAncho, halfLargo + esqProf, 0, 0, 0),
    isoPt(-halfAncho - esqAncho, halfLargo + esqProf, 0, 0, 0),
    isoPt(-halfAncho - esqAncho, -halfLargo - esqProf, pedestalZ1, 0, 0),
    isoPt(halfAncho + esqAncho, -halfLargo - esqProf, pedestalZ1, 0, 0),
    isoPt(halfAncho + esqAncho, halfLargo + esqProf, pedestalZ1, 0, 0),
    isoPt(-halfAncho - esqAncho, halfLargo + esqProf, pedestalZ1, 0, 0),
    isoPt(-halfAncho - 20, -halfLargo - 20, ntnZ, 0, 0),
    isoPt(halfAncho + 20, -halfLargo - 20, ntnZ, 0, 0),
    isoPt(halfAncho + 20, halfLargo + 20, ntnZ, 0, 0),
    isoPt(-halfAncho - 20, halfLargo + 20, ntnZ, 0, 0),
  ];
  const minX = Math.min(...bounds.map((pt) => pt[0])) - PAD;
  const maxX = Math.max(...bounds.map((pt) => pt[0])) + PAD;
  const minY = Math.min(...bounds.map((pt) => pt[1])) - PAD * 0.6;
  const maxY = Math.max(...bounds.map((pt) => pt[1])) + PAD * 0.9; // un poco más abajo, para el texto de resumen
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const ox = -minX;
  const oy = -minY;

  // Las 4 esquinas: "superior" es la más al fondo en la proyección, "inferior"
  // la más al frente, y las otras dos son las "laterales".
  const pSuperior = [-halfAncho, -halfLargo];
  const pLateralA = [halfAncho, -halfLargo];
  const pInferior = [halfAncho, halfLargo];
  const pLateralB = [-halfAncho, halfLargo];

  const pedestalBox = ([ex, ey], key) => (
    <IsoBoxLineArt key={key} x0={ex - pAnchoPx / 2} y0={ey - pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={pedestalZ0} z1={pedestalZ1} ox={ox} oy={oy} />
  );
  const soladoPedestal = ([ex, ey], key) => (
    <IsoBoxLineArt key={key} x0={ex - pAnchoPx / 2} y0={ey - pProfundoPx / 2} w={pAnchoPx} d={pProfundoPx} z0={soladoZ0} z1={soladoZ1} ox={ox} oy={oy} />
  );
  // Viga "corta" @ y=-halfLargo: une pSuperior con pLateralA
  const vigaSuperiorCorta = (
    <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={-halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
  );
  const soladoVigaSuperiorCorta = (
    <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={-halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0 - soladoPx} z1={vigaZ0} ox={ox} oy={oy} />
  );
  // Viga "larga" @ x=-halfAncho: une pSuperior con pLateralB
  const vigaSuperiorLarga = (
    <IsoBoxLineArt x0={-halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
  );
  const soladoVigaSuperiorLarga = (
    <IsoBoxLineArt x0={-halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0 - soladoPx} z1={vigaZ0} ox={ox} oy={oy} />
  );
  // Viga "larga" @ x=+halfAncho: une pLateralA con pInferior
  const vigaInferiorLarga = (
    <IsoBoxLineArt x0={halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
  );
  const soladoVigaInferiorLarga = (
    <IsoBoxLineArt x0={halfAncho - vAnchoPx / 2} y0={-halfLargo + pProfundoPx / 2} w={vAnchoPx} d={largoPx - pProfundoPx} z0={vigaZ0 - soladoPx} z1={vigaZ0} ox={ox} oy={oy} />
  );
  // Viga "corta" @ y=+halfLargo: une pLateralB con pInferior
  const vigaInferiorCorta = (
    <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0} z1={vigaZ1} ox={ox} oy={oy} fillTop="#EAF1FF" fillSide="#EAF1FF" />
  );
  const soladoVigaInferiorCorta = (
    <IsoBoxLineArt x0={-halfAncho + pAnchoPx / 2} y0={halfLargo - vAnchoPx / 2} w={anchoPx - pAnchoPx} d={vAnchoPx} z0={vigaZ0 - soladoPx} z1={vigaZ0} ox={ox} oy={oy} />
  );

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={className}>
      {/* Orden de atrás hacia adelante, tal como se ve en la proyección — cada */}
      {/* elemento con su propio solado dibujado justo antes que él: pedestal  */}
      {/* superior → vigas superiores (con sus solados) → pedestales laterales */}
      {/* → vigas inferiores (con sus solados) → pedestal inferior. Así cada   */}
      {/* pedestal tapa el extremo de la viga que le llega desde "atrás".      */}
      {soladoPedestal(pSuperior, 'sol-ped-superior')}
      {pedestalBox(pSuperior, 'ped-superior')}
      {soladoVigaSuperiorCorta}
      {vigaSuperiorCorta}
      {soladoVigaSuperiorLarga}
      {vigaSuperiorLarga}
      {soladoPedestal(pLateralA, 'sol-ped-lateral-a')}
      {pedestalBox(pLateralA, 'ped-lateral-a')}
      {soladoPedestal(pLateralB, 'sol-ped-lateral-b')}
      {pedestalBox(pLateralB, 'ped-lateral-b')}
      {soladoVigaInferiorLarga}
      {vigaInferiorLarga}
      {soladoVigaInferiorCorta}
      {vigaInferiorCorta}
      {soladoPedestal(pInferior, 'sol-ped-inferior')}
      {pedestalBox(pInferior, 'ped-inferior')}
      {/* Nivel de terreno natural: coincide con la parte de ARRIBA de la viga */}
      <polygon
        points={poly([
          isoPt(-halfAncho - 20, -halfLargo - 20, ntnZ, ox, oy),
          isoPt(halfAncho + 20, -halfLargo - 20, ntnZ, ox, oy),
          isoPt(halfAncho + 20, halfLargo + 20, ntnZ, ox, oy),
          isoPt(-halfAncho - 20, halfLargo + 20, ntnZ, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-halfAncho - 20, -halfLargo - 20, ntnZ, ox, oy)[0] - 4}
        y={isoPt(-halfAncho - 20, -halfLargo - 20, ntnZ, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      <text x={ox} y={vbH - 10} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644">
        {anchoCT || '—'} × {largoCT || '—'} m (centro a centro) · Altura pedestal {alturaPedestal ? alturaPedestal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Vista en planta (desde arriba) de TODO el conjunto: los 4 pedestales en   */
/* las esquinas de un rectángulo ancho×largo (centro a centro) y las 4      */
/* vigas (2 largas a los lados, 2 cortas arriba/abajo) uniéndolos.          */
export function CTPlanta({ datos }) {
  const p = datos.pedestal || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const anchoCT = parseFloat(datos.ancho) || 0;
  const largoCT = parseFloat(datos.largo) || 0;
  const pAncho = parseFloat(p.ancho) || 0;
  const pProfundo = parseFloat(p.profundo) || 0;
  const vAncho = parseFloat(v.ancho) || 0;

  const scale = 40;
  const anchoPx = clamp((anchoCT || 2) * scale, 90, 170);
  const largoPx = clamp((largoCT || 3) * scale, 110, 210);
  const pAnchoPx = clamp((pAncho || 0.3) * scale, 14, 30);
  const pProfundoPx = clamp((pProfundo || 0.3) * scale, 14, 30);
  const vAnchoPx = clamp((vAncho || 0.3) * scale, 8, 18);

  const cx = 190, cy = 160;
  const x1 = cx - anchoPx / 2, x2 = cx + anchoPx / 2;
  const y1 = cy - largoPx / 2, y2 = cy + largoPx / 2;
  const tramoHorizontal = Math.max(0, anchoPx - pAnchoPx);
  const tramoVertical = Math.max(0, largoPx - pProfundoPx);

  return (
    <svg viewBox="0 0 340 300" className={CT_PLANTA_GRANDE_CSS_SIZE}>
      {/* Vigas cortas: arriba y abajo, entre las caras internas de los pedestales de ese lado */}
      {tramoHorizontal > 0 && (
        <>
          <rect x={x1 + pAnchoPx / 2} y={y1 - vAnchoPx / 2} width={tramoHorizontal} height={vAnchoPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.1" />
          <rect x={x1 + pAnchoPx / 2} y={y2 - vAnchoPx / 2} width={tramoHorizontal} height={vAnchoPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.1" />
        </>
      )}
      {/* Vigas largas: izquierda y derecha */}
      {tramoVertical > 0 && (
        <>
          <rect x={x1 - vAnchoPx / 2} y={y1 + pProfundoPx / 2} width={vAnchoPx} height={tramoVertical} fill="#EAF1FF" stroke="#152644" strokeWidth="1.1" />
          <rect x={x2 - vAnchoPx / 2} y={y1 + pProfundoPx / 2} width={vAnchoPx} height={tramoVertical} fill="#EAF1FF" stroke="#152644" strokeWidth="1.1" />
        </>
      )}
      {/* 4 pedestales, en las esquinas */}
      {[[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([px, py], i) => (
        <rect key={i} x={px - pAnchoPx / 2} y={py - pProfundoPx / 2} width={pAnchoPx} height={pProfundoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      ))}
      {/* Cota de ancho, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={y1 - 24} x2={x2} y2={y1 - 24} />
        <line x1={x1} y1={y1 - 28} x2={x1} y2={y1 - 20} />
        <line x1={x2} y1={y1 - 28} x2={x2} y2={y1 - 20} />
      </g>
      <text x={cx} y={y1 - 32} textAnchor="middle" fontSize="11" fontWeight="600" fill="#152644">
        Ancho {anchoCT || '—'} m
      </text>
      {/* Cota de largo, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - 24} y1={y1} x2={x1 - 24} y2={y2} />
        <line x1={x1 - 28} y1={y1} x2={x1 - 20} y2={y1} />
        <line x1={x1 - 28} y1={y2} x2={x1 - 20} y2={y2} />
      </g>
      <text x={x1 - 34} y={(y1 + y2) / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#152644" transform={`rotate(-90, ${x1 - 34}, ${(y1 + y2) / 2})`}>
        Largo {largoCT || '—'} m
      </text>
    </svg>
  );
}

/* Vista en elevación (de frente) de UN lado del marco: los 2 pedestales de */
/* ese lado (separados por "largo" o por "ancho", según tipo) unidos por su */
/* viga correspondiente (larga o corta), que queda justo debajo del N.T.N.  */
/* — a diferencia del Portón, aquí el pedestal SIGUE subiendo por encima    */
/* del N.T.N. (el sobresaliente), ya que la altura total es desplante +     */
/* sobresaliente, SIN restar nada de la viga.                              */
export function CTElevacionLado({ datos, tipo }) {
  const p = datos.pedestal || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const separacion = tipo === 'largo' ? (parseFloat(datos.largo) || 0) : (parseFloat(datos.ancho) || 0);
  const pAncho = parseFloat(p.ancho) || 0;
  const vAlto = parseFloat(v.alto) || 0;
  const desplante = parseFloat(datos.desplante) || 0;
  const sobresaliente = parseFloat(datos.sobresaliente) || 0;
  const alturaPedestal = desplante + sobresaliente;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;

  const scale = 30;
  const pAnchoPx = clamp((pAncho || 0.3) * scale, 16, 30);
  const vAltoPx = clamp((vAlto || 0.3) * scale, 8, 18);
  const pAlturaPx = clamp((alturaPedestal || 1) * scale, 40, 90);
  const desplantePx = clamp((desplante || 0.5) * scale, 20, 60);
  const soladoPx = clamp((espesorSolado || 0.05) * scale, 4, 9);
  const sepPx = clamp((separacion || 2) * scale, 110, 220);

  const cx = 150;
  const groundY = 100; // N.T.N. — coincide con la parte de arriba de la viga
  // Margen suficiente arriba (hasta 70px de sobresaliente posible + cota) y
  // abajo (hasta 60px de desplante + solado) para que nada quede recortado
  // dentro del viewBox, incluso en los extremos de las escalas clamp().
  const sobresalientePx = Math.max(4, pAlturaPx - desplantePx);
  const pTopY = groundY - sobresalientePx; // parte que sobresale sobre el N.T.N.
  const pBotY = groundY + desplantePx; // parte que se entierra (hasta el desplante)
  const x1 = cx - sepPx / 2;
  const x2 = cx + sepPx / 2;
  const tramoLibre = x2 - pAnchoPx / 2 - (x1 + pAnchoPx / 2);

  return (
    <svg viewBox="0 0 300 250" className={CT_CSS_SIZE}>
      <line x1={x1 - 30} y1={groundY} x2={x2 + 30} y2={groundY} stroke="#6487C4" strokeWidth="1" strokeDasharray="4 3" />
      <text x={x1 - 34} y={groundY - 4} textAnchor="end" fontSize="7.5" fill="#6487C4" fontFamily="monospace">N.T.N</text>
      {/* Solado bajo cada pedestal (misma huella) */}
      <rect x={x1 - pAnchoPx / 2} y={pBotY} width={pAnchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      <rect x={x2 - pAnchoPx / 2} y={pBotY} width={pAnchoPx} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
      {/* Viga, justo debajo del N.T.N., entre las caras internas de los pedestales */}
      {tramoLibre > 0 && (
        <>
          {/* Solado bajo la viga, justo debajo de su propia cara inferior */}
          <rect x={x1 + pAnchoPx / 2} y={groundY + vAltoPx} width={tramoLibre} height={soladoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1" />
          <rect x={x1 + pAnchoPx / 2} y={groundY} width={tramoLibre} height={vAltoPx} fill="#EAF1FF" stroke="#152644" strokeWidth="1.2" />
        </>
      )}
      {/* Pedestales: desde el sobresaliente (arriba del N.T.N.) hasta el desplante (abajo) */}
      <rect x={x1 - pAnchoPx / 2} y={pTopY} width={pAnchoPx} height={pBotY - pTopY} fill="white" stroke="#152644" strokeWidth="1.3" />
      <rect x={x2 - pAnchoPx / 2} y={pTopY} width={pAnchoPx} height={pBotY - pTopY} fill="white" stroke="#152644" strokeWidth="1.3" />
      {/* Cota de separación, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={pTopY - 14} x2={x2} y2={pTopY - 14} />
        <line x1={x1} y1={pTopY - 18} x2={x1} y2={pTopY - 10} />
        <line x1={x2} y1={pTopY - 18} x2={x2} y2={pTopY - 10} />
      </g>
      <text x={cx} y={pTopY - 22} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {tipo === 'largo' ? 'Largo' : 'Ancho'} (centro a centro): {separacion || '—'} m
      </text>
      {/* Cota de altura del pedestal, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - pAnchoPx / 2 - 14} y1={pTopY} x2={x1 - pAnchoPx / 2 - 14} y2={pBotY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pTopY} x2={x1 - pAnchoPx / 2 - 18} y2={pTopY} />
        <line x1={x1 - pAnchoPx / 2 - 10} y1={pBotY} x2={x1 - pAnchoPx / 2 - 18} y2={pBotY} />
      </g>
      <text x={x1 - pAnchoPx / 2 - 24} y={(pTopY + pBotY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${x1 - pAnchoPx / 2 - 24}, ${(pTopY + pBotY) / 2})`}>
        {alturaPedestal > 0 ? alturaPedestal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}
export function CTElevacionLadoLargo({ datos }) {
  return <CTElevacionLado datos={datos} tipo="largo" />;
}
export function CTElevacionLadoCorto({ datos }) {
  return <CTElevacionLado datos={datos} tipo="corto" />;
}

/* Corte transversal del pedestal (planta): igual criterio que en Portón —  */
/* estribo con sus 2 ganchos y las barras repartidas en el perímetro       */
/* (4 esquinas + el resto repartido parejo entre los 4 lados).             */
export function CTPedestalCorte({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.3;
  const pProfundo = parseFloat(p.profundo) || 0.3;
  const cantidad = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const w = clamp(pAncho * 130, 40, 100);
  const d = clamp(pProfundo * 130, 40, 100);
  const cx = 85, cy = 80;
  const recubPx = 7;
  const puntos = puntosPerimetroRectangulo(w / 2 - recubPx, d / 2 - recubPx, cantidad);

  return (
    <svg viewBox="0 0 180 190" className={CT_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <GanchoEstriboEsquina x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} />
      {puntos.map(([px, py], i) => (
        <circle key={i} cx={cx + px} cy={cy + py} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{pAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{pProfundo || '—'} m</text>
    </svg>
  );
}

/* Vista posterior (elevación) del despiece del pedestal — mismo criterio   */
/* que en Portón, pero la altura total es simplemente desplante +          */
/* sobresaliente (sin zapata que restar, sin empotramiento adicional).     */
export function CTPedestalElevacion({ datos }) {
  const p = datos.pedestal || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const pAncho = parseFloat(p.ancho) || 0.3;
  const pProfundo = parseFloat(p.profundo) || 0.3;
  const alturaTotal = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const cantidadBarras = Math.max(4, parseInt(p.barras?.cantidad, 10) || 4);
  const ganchosBarra = parseFloat(p.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[p.barras?.calibre];
  const estribos = calcularEstribos({ altura: alturaTotal, ancho: p.ancho, profundo: p.profundo, separacion: p.estribos?.separacion, calibre: p.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionM = parseFloat(p.estribos?.separacion) || 0;

  const w = clamp(pAncho * 130, 45, 100);
  const h = clamp((alturaTotal || 0.5) * 130, 90, 190);
  const cx = 90, topY = 30, botY = topY + h, recubPx = 7;
  const escala = alturaTotal > 0 ? h / alturaTotal : 130;

  const puntos = puntosPerimetroRectangulo(1, pProfundo / pAncho || 1, cantidadBarras);
  const xUnicas = Array.from(new Set(puntos.map(([px]) => Math.round(px * 1000) / 1000))).sort((a, b) => a - b);
  const barX = xUnicas.map((frac) => cx + (frac * (w - 2 * recubPx)) / 2);
  const distanciaEntreBarras = barX.length > 1 ? barX[barX.length - 1] - barX[0] : w;
  const ganchoMaximoSinChoque = (distanciaEntreBarras / 2) * 0.6;
  const ganchoPx = infoBarra ? clamp(Math.min(infoBarra.gancho * escala, ganchoMaximoSinChoque), 5, 13) : Math.min(10, ganchoMaximoSinChoque);

  const separacionPx = separacionM > 0 ? separacionM * escala : (h - 2 * recubPx) / Math.max(cantidadEstribos - 1, 1);
  const totalSpanEstribos = (cantidadEstribos - 1) * separacionPx;
  const inicioEstribos = topY + recubPx + Math.max(0, (h - 2 * recubPx - totalSpanEstribos) / 2);
  const estriboY = [];
  for (let i = 0; i < cantidadEstribos; i++) estriboY.push(inicioEstribos + i * separacionPx);

  const ganchosLabel = ganchosBarra > 0 ? 'L'.repeat(Math.min(ganchosBarra, 2)) : '';
  const ganchoLongitud = infoBarra ? infoBarra.gancho : null;

  return (
    <svg viewBox="0 0 190 250" className={CT_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboY.map((y, i) => (
        <line key={i} x1={cx - w / 2 + recubPx} y1={y} x2={cx + w / 2 - recubPx} y2={y} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {barX.map((x, i) => {
        const dir = x < cx ? 1 : x > cx ? -1 : 1;
        return (
          <g key={i}>
            <line x1={x} y1={topY + 2} x2={x} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />
            {ganchosBarra >= 1 && <line x1={x} y1={botY - 2} x2={x + dir * ganchoPx} y2={botY - 2} stroke="#059669" strokeWidth="1.6" />}
            {ganchosBarra >= 2 && <line x1={x} y1={topY + 2} x2={x + dir * ganchoPx} y2={topY + 2} stroke="#059669" strokeWidth="1.6" />}
          </g>
        );
      })}
      <text x={cx} y={topY - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">
        {cantidadBarras}{p.barras?.calibre || '#—'} {ganchosLabel}{ganchoLongitud !== null ? ganchoLongitud.toFixed(2) : ''}
      </text>
      <text x={cx + w / 2 + 8} y={(topY + botY) / 2} fontSize="8" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${cx + w / 2 + 8}, ${(topY + botY) / 2})`} textAnchor="middle">
        {cantidadEstribos || '—'} E{p.estribos?.calibre || '#—'} @{p.estribos?.separacion || '—'}
      </text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 16} y1={topY} x2={cx - w / 2 - 16} y2={botY} />
        <line x1={cx - w / 2 - 12} y1={topY} x2={cx - w / 2 - 20} y2={topY} />
        <line x1={cx - w / 2 - 12} y1={botY} x2={cx - w / 2 - 20} y2={botY} />
      </g>
      <text x={cx - w / 2 - 26} y={(topY + botY) / 2} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 26}, ${(topY + botY) / 2})`}>
        {alturaTotal ? alturaTotal.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Corte transversal de la viga (larga o corta comparten la misma sección): */
/* 4 barras de esquina + el estribo con sus 2 ganchos.                     */
export function CTVigaCorte({ datos }) {
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const vAncho = parseFloat(v.ancho) || 0.3;
  const vAlto = parseFloat(v.alto) || 0.3;
  const w = clamp(vAncho * 150, 40, 110);
  const d = clamp(vAlto * 150, 40, 110);
  const cx = 90, cy = 80;
  const recubPx = 7;

  return (
    <svg viewBox="0 0 180 190" className={CT_PLANTA_CSS_SIZE}>
      <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} width={w - 2 * recubPx} height={d - 2 * recubPx} fill="none" stroke="#2563EB" strokeWidth="1.2" />
      <GanchoEstriboEsquina x={cx - w / 2 + recubPx} y={cy - d / 2 + recubPx} />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={cx + sx * (w / 2 - recubPx)} cy={cy + sy * (d / 2 - recubPx)} r="2.6" fill="#059669" />
      ))}
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2} y1={cy + d / 2 + 14} x2={cx + w / 2} y2={cy + d / 2 + 14} />
        <line x1={cx - w / 2} y1={cy + d / 2 + 10} x2={cx - w / 2} y2={cy + d / 2 + 18} />
        <line x1={cx + w / 2} y1={cy + d / 2 + 10} x2={cx + w / 2} y2={cy + d / 2 + 18} />
      </g>
      <text x={cx} y={cy + d / 2 + 28} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644">{vAncho || '—'} m</text>
      <g stroke="#152644" strokeWidth="1">
        <line x1={cx - w / 2 - 14} y1={cy - d / 2} x2={cx - w / 2 - 14} y2={cy + d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy - d / 2} x2={cx - w / 2 - 18} y2={cy - d / 2} />
        <line x1={cx - w / 2 - 10} y1={cy + d / 2} x2={cx - w / 2 - 18} y2={cy + d / 2} />
      </g>
      <text x={cx - w / 2 - 24} y={cy} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${cx - w / 2 - 24}, ${cy})`}>{vAlto || '—'} m</text>
    </svg>
  );
}

/* Vista posterior (elevación) de una viga a lo largo de su longitud —      */
/* a diferencia del Portón, aquí la barra es CONTINUA SIN TRASLAPO (no hay  */
/* marcas de empalme): una sola línea de arriba y una de abajo, cada una    */
/* con gancho en AMBOS extremos (ancla dentro de cada pedestal), y longitud */
/* total "de cara externa a cara externa" (incluye lo embebido). Los        */
/* estribos van solo en el tramo LIBRE entre las caras internas.           */
export function CTVigaElevacion({ datos, tipo }) {
  const p = datos.pedestal || {};
  const v = datos.viga || {};
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const longitudCentros = tipo === 'larga' ? (parseFloat(datos.largo) || 0) : (parseFloat(datos.ancho) || 0);
  const dimPedestal = tipo === 'larga' ? (parseFloat(p.profundo) || 0) : (parseFloat(p.ancho) || 0);
  const vAlto = parseFloat(v.alto) || 0;
  const barras = calcularBarrasVigaCT({
    longitudCentros,
    dimensionPedestalMismaDireccion: dimPedestal,
    cantidad: v.barras?.cantidad,
    calibre: v.barras?.calibre,
    ganchos: v.barras?.ganchos,
  });
  const longitudLibre = Math.max(0, longitudCentros - dimPedestal);
  const estribos = calcularEstribos({ altura: longitudLibre || undefined, ancho: v.ancho, profundo: v.alto, separacion: v.estribos?.separacion, calibre: v.estribos?.calibre });
  const cantidadEstribos = estribos ? estribos.cantidad : 0;
  const separacionEstribos = parseFloat(v.estribos?.separacion) || 0;
  const ganchosBarra = parseFloat(v.barras?.ganchos) || 0;
  const infoBarra = BARRA_ACERO[v.barras?.calibre];
  const longitudTotal = barras ? barras.longitud : longitudCentros + dimPedestal;

  const w = clamp((longitudTotal || 3) * 45, 220, 400);
  const h = clamp((vAlto || 0.3) * 160, 35, 70);
  const cx = 210, topY = 45, leftX = cx - w / 2, rightX = cx + w / 2, botY = topY + h;
  const recubPx = 6;
  const escala = longitudTotal > 0 ? w / longitudTotal : 45;
  const ganchoPx = infoBarra ? clamp(infoBarra.gancho * escala, 8, 18) : 12;

  const estriboX = [];
  if (cantidadEstribos > 0) {
    // El tramo libre (entre caras internas) queda centrado dentro del ancho
    // total dibujado (que incluye lo embebido en los pedestales a cada lado).
    const anchoLibrePx = longitudLibre > 0 ? longitudLibre * escala : w;
    const margen = Math.max(0, (w - anchoLibrePx) / 2);
    const separacionPx = separacionEstribos > 0 ? separacionEstribos * escala : anchoLibrePx / Math.max(cantidadEstribos - 1, 1);
    const totalSpan = (cantidadEstribos - 1) * separacionPx;
    const inicio = leftX + margen + Math.max(0, (anchoLibrePx - totalSpan) / 2);
    for (let i = 0; i < cantidadEstribos; i++) estriboX.push(inicio + i * separacionPx);
  }

  return (
    <svg viewBox="0 0 420 160" className={CT_VIGA_ELEV_CSS_SIZE}>
      <rect x={leftX} y={topY} width={w} height={h} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      {estriboX.map((x, i) => (
        <line key={i} x1={x} y1={topY + recubPx} x2={x} y2={botY - recubPx} stroke="#2563EB" strokeWidth="1.4" />
      ))}
      {/* Barra superior: continua, sin traslapo, con gancho en ambos extremos */}
      <line x1={leftX + 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={topY + recubPx} x2={leftX + 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={topY + recubPx} x2={rightX - 3} y2={topY + recubPx + ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {/* Barra inferior: igual */}
      <line x1={leftX + 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx} stroke="#059669" strokeWidth="1.6" />
      {ganchosBarra >= 1 && <line x1={leftX + 3} y1={botY - recubPx} x2={leftX + 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {ganchosBarra >= 1 && <line x1={rightX - 3} y1={botY - recubPx} x2={rightX - 3} y2={botY - recubPx - ganchoPx} stroke="#059669" strokeWidth="1.6" />}
      {/* Cota de longitud total, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={leftX} y1={topY - 18} x2={rightX} y2={topY - 18} />
        <line x1={leftX} y1={topY - 22} x2={leftX} y2={topY - 14} />
        <line x1={rightX} y1={topY - 22} x2={rightX} y2={topY - 14} />
      </g>
      <text x={cx} y={topY - 26} textAnchor="middle" fontSize="9" fontWeight="600" fill="#152644">
        Longitud (cara externa a cara externa) {longitudTotal ? longitudTotal.toFixed(2) : '—'} m
      </text>
      <text x={cx} y={botY + 20} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#2563EB">
        {cantidadEstribos || '—'} E{v.estribos?.calibre || '#—'} @{v.estribos?.separacion || '—'}
      </text>
    </svg>
  );
}
export function CTVigaElevacionLarga({ datos }) {
  return <CTVigaElevacion datos={datos} tipo="larga" />;
}
export function CTVigaElevacionCorta({ datos }) {
  return <CTVigaElevacion datos={datos} tipo="corta" />;
}

export function CTVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <CTIsometrico datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico del conjunto</p>
      </div>
      <div className="text-center">
        <CTPlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Planta del conjunto</p>
      </div>
      <div className="text-center">
        <CTElevacionLadoLargo datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Elevación · lado largo</p>
      </div>
      <div className="text-center">
        <CTElevacionLadoCorto datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Elevación · lado corto</p>
      </div>
      <div className="text-center">
        <CTPedestalCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · corte transversal</p>
      </div>
      <div className="text-center">
        <CTPedestalElevacion datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Pedestal · vista posterior</p>
      </div>
      <div className="text-center">
        <CTVigaCorte datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga · corte transversal</p>
      </div>
      <div className="text-center">
        <CTVigaElevacionLarga datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga larga · vista posterior</p>
      </div>
      <div className="text-center">
        <CTVigaElevacionCorta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Viga corta · vista posterior</p>
      </div>
    </div>
  );
}

export function CTForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosCT(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }
  function setSubgrupo(grupo, subgrupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [subgrupo]: { ...prev[grupo][subgrupo], [key]: val } } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  const alturaPedestal = (parseFloat(datos.desplante) || 0) + (parseFloat(datos.sobresaliente) || 0);
  const pedestalLongitudinales = calcularLongitudinales({
    altura: alturaPedestal || undefined,
    cantidad: datos.pedestal?.barras?.cantidad,
    calibre: datos.pedestal?.barras?.calibre,
    ganchos: datos.pedestal?.barras?.ganchos,
  });
  const pedestalEstribos = calcularEstribos({
    altura: alturaPedestal || undefined,
    ancho: datos.pedestal.ancho,
    profundo: datos.pedestal.profundo,
    separacion: datos.pedestal?.estribos?.separacion,
    calibre: datos.pedestal?.estribos?.calibre,
  });

  const vigaLarga = calcularBarrasVigaCT({
    longitudCentros: datos.largo,
    dimensionPedestalMismaDireccion: datos.pedestal.profundo,
    cantidad: datos.viga?.barras?.cantidad,
    calibre: datos.viga?.barras?.calibre,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const vigaCorta = calcularBarrasVigaCT({
    longitudCentros: datos.ancho,
    dimensionPedestalMismaDireccion: datos.pedestal.ancho,
    cantidad: datos.viga?.barras?.cantidad,
    calibre: datos.viga?.barras?.calibre,
    ganchos: datos.viga?.barras?.ganchos,
  });
  const longitudLibreLarga = Math.max(0, (parseFloat(datos.largo) || 0) - (parseFloat(datos.pedestal.profundo) || 0));
  const longitudLibreCorta = Math.max(0, (parseFloat(datos.ancho) || 0) - (parseFloat(datos.pedestal.ancho) || 0));
  const vigaLargaEstribos = calcularEstribos({
    altura: longitudLibreLarga || undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });
  const vigaCortaEstribos = calcularEstribos({
    altura: longitudLibreCorta || undefined,
    ancho: datos.viga.ancho,
    profundo: datos.viga.alto,
    separacion: datos.viga?.estribos?.separacion,
    calibre: datos.viga?.estribos?.calibre,
  });

  const volumenes = calcularVolumenesCT({
    ancho: datos.ancho,
    largo: datos.largo,
    pedestal: datos.pedestal,
    viga: datos.viga,
    desplante: datos.desplante,
    sobresaliente: datos.sobresaliente,
    espesorSolado: datos.espesor_solado,
  });

  const pesoTotalAcero =
    (pedestalLongitudinales?.pesoTotal || 0) * 4 +
    (pedestalEstribos?.pesoTotal || 0) * 4 +
    (vigaLarga?.pesoTotal || 0) * 2 +
    (vigaCorta?.pesoTotal || 0) * 2 +
    (vigaLargaEstribos ? vigaLargaEstribos.pesoEstribo * vigaLargaEstribos.cantidad * 2 : 0) +
    (vigaCortaEstribos ? vigaCortaEstribos.pesoEstribo * vigaCortaEstribos.cantidad * 2 : 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Shelter · Centro de Transformación
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5 w-fit mx-auto">
        <CTVistas datos={datos} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. CT Tipo 1"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Resistencia del concreto</label>
          <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="border border-navy-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Datos compartidos del conjunto</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-navy-500 mb-1">Ancho (centro a centro, m)</label>
            <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="2.10" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Largo (centro a centro, m)</label>
            <input value={datos.largo} onChange={(e) => set('largo', e.target.value)} placeholder="2.90" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Desplante (m)</label>
            <input value={datos.desplante} onChange={(e) => set('desplante', e.target.value)} placeholder="0.90" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Sobresaliente (m)</label>
            <input value={datos.sobresaliente} onChange={(e) => set('sobresaliente', e.target.value)} placeholder="0.50" className={cellInput} />
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
            <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2">
          Altura del pedestal: <span className="font-mono text-navy-600">{alturaPedestal.toFixed(2)} m</span> (desplante + sobresaliente — el N.T.N. coincide con la parte de arriba de la viga)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Pedestal (4 iguales)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho (m)</label>
              <input value={datos.pedestal.ancho} onChange={(e) => setGrupo('pedestal', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo (m)</label>
              <input value={datos.pedestal.profundo} onChange={(e) => setGrupo('pedestal', 'profundo', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° barras</label>
              <input value={datos.pedestal.barras.cantidad} onChange={(e) => setSubgrupo('pedestal', 'barras', 'cantidad', e.target.value)} placeholder="4" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.pedestal.barras.calibre} onChange={(val) => setSubgrupo('pedestal', 'barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° ganchos</label>
              <input value={datos.pedestal.barras.ganchos} onChange={(e) => setSubgrupo('pedestal', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {pedestalLongitudinales && pedestalEstribos ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2 mb-3">
              <FilaResumenAcero label="Pedestales (4) — longitud c/u" valor={`${pedestalLongitudinales.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Pedestales (4) — peso total" valor={`${(pedestalLongitudinales.pesoTotal * 4).toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa altura, cantidad y calibre.</p>
          )}
          <p className="text-xs font-semibold text-navy-600 mb-2">Estribos</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.pedestal.estribos.calibre} onChange={(val) => setSubgrupo('pedestal', 'estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.pedestal.estribos.separacion} onChange={(e) => setSubgrupo('pedestal', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {pedestalEstribos ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.cantidad}</span> de{' '}
              <span className="font-mono font-semibold text-navy-700">{pedestalEstribos.longitud.toFixed(2)} m</span> — {(pedestalEstribos.pesoTotal * 4).toFixed(2)} kg (4 pedestales)
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, separación y calibre.</p>
          )}
        </div>

        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-3">Viga (4 iguales en sección, 2 largas + 2 cortas)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho de sección (m)</label>
              <input value={datos.viga.ancho} onChange={(e) => setGrupo('viga', 'ancho', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto de sección (m)</label>
              <input value={datos.viga.alto} onChange={(e) => setGrupo('viga', 'alto', e.target.value)} placeholder="0.30" className={cellInput} />
            </div>
          </div>
          <p className="text-xs font-semibold text-navy-600 mb-2">Barras longitudinales (continuas, sin traslapo — de cara externa a cara externa de pedestales)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° de barras</label>
              <input value={datos.viga.barras.cantidad} onChange={(e) => setSubgrupo('viga', 'barras', 'cantidad', e.target.value)} placeholder="6" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.barras.calibre} onChange={(val) => setSubgrupo('viga', 'barras', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">N.° de ganchos</label>
              <input value={datos.viga.barras.ganchos} onChange={(e) => setSubgrupo('viga', 'barras', 'ganchos', e.target.value)} placeholder="1" className={cellInput} />
            </div>
          </div>
          {vigaLarga && vigaCorta ? (
            <div className="bg-navy-50 rounded-lg px-3 py-2 mb-3">
              <FilaResumenAcero label="Vigas largas (2) — longitud c/u" valor={`${vigaLarga.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Vigas largas (2) — peso total" valor={`${(vigaLarga.pesoTotal * 2).toFixed(2)} kg`} />
              <FilaResumenAcero label="Vigas cortas (2) — longitud c/u" valor={`${vigaCorta.longitud.toFixed(2)} m`} />
              <FilaResumenAcero label="Vigas cortas (2) — peso total" valor={`${(vigaCorta.pesoTotal * 2).toFixed(2)} kg`} />
            </div>
          ) : (
            <p className="text-xs text-navy-300 italic mb-3">Completa ancho/largo del conjunto, dimensiones del pedestal, cantidad y calibre.</p>
          )}
          <p className="text-xs font-semibold text-navy-600 mb-2">Estribos (dentro del tramo libre entre pedestales)</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.viga.estribos.calibre} onChange={(val) => setSubgrupo('viga', 'estribos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.viga.estribos.separacion} onChange={(e) => setSubgrupo('viga', 'estribos', 'separacion', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
          </div>
          {vigaLargaEstribos && vigaCortaEstribos ? (
            <p className="text-xs text-navy-500">
              → Largas: <span className="font-mono font-semibold text-navy-700">{vigaLargaEstribos.cantidad}</span> de {vigaLargaEstribos.longitud.toFixed(2)} m ·
              Cortas: <span className="font-mono font-semibold text-navy-700">{vigaCortaEstribos.cantidad}</span> de {vigaCortaEstribos.longitud.toFixed(2)} m
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, separación y calibre.</p>
          )}
        </div>
      </div>

      {pesoTotalAcero > 0 && (
        <div className="mt-4 bg-white border border-navy-200 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-navy-700 mb-2">Peso de acero por elemento</p>
          <FilaResumenAcero label="Pedestales — barras longitudinales (4)" valor={`${((pedestalLongitudinales?.pesoTotal || 0) * 4).toFixed(2)} kg`} />
          <FilaResumenAcero label="Pedestales — estribos (4)" valor={`${((pedestalEstribos?.pesoTotal || 0) * 4).toFixed(2)} kg`} />
          <FilaResumenAcero label="Vigas largas — barras longitudinales (2)" valor={`${((vigaLarga?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Vigas largas — estribos (2)" valor={`${(vigaLargaEstribos ? vigaLargaEstribos.pesoEstribo * vigaLargaEstribos.cantidad * 2 : 0).toFixed(2)} kg`} />
          <FilaResumenAcero label="Vigas cortas — barras longitudinales (2)" valor={`${((vigaCorta?.pesoTotal || 0) * 2).toFixed(2)} kg`} />
          <FilaResumenAcero label="Vigas cortas — estribos (2)" valor={`${(vigaCortaEstribos ? vigaCortaEstribos.pesoEstribo * vigaCortaEstribos.cantidad * 2 : 0).toFixed(2)} kg`} />
        </div>
      )}
      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* ============================================================ */
/* SHELTER · TRAMPA DE ACEITE — caja de concreto (4 paredes +     */
/* losa inferior, sin losa superior), con anillos horizontales   */
/* y barras verticales en "U".                                   */
/* ============================================================ */
export const TRAMPA_VB_W = 300;
export const TRAMPA_VB_H = 260;
export const TRAMPA_M2PX = 90;
export const TRAMPA_CSS_SIZE = 'w-72 h-64';
export const TRAMPA_DESPIECE_CSS_SIZE = 'w-72 h-64';
export const TRAMPA_PLANTA_CSS_SIZE = 'w-72 h-64';

export function TrampaAceitePreview({ datos }) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const alto = parseFloat(datos.alto) || 0;
  const espesorPared = parseFloat(datos.espesor_pared) || 0;
  const espesorSolado = parseFloat(datos.espesor_solado) || 0;

  const anchoPx = clamp((ancho || 1.5) * TRAMPA_M2PX, 50, 110);
  const profundoPx = clamp((profundo || 1.2) * TRAMPA_M2PX, 40, 100);
  const altoPx = clamp((alto || 0.85) * TRAMPA_M2PX, 30, 80);
  const espesorParedPx = clamp((espesorPared || 0.15) * TRAMPA_M2PX, 6, 18);
  const soladoPx = clamp((espesorSolado || 0.05) * TRAMPA_M2PX, 4, 9);

  const halfW = anchoPx / 2;
  const halfD = profundoPx / 2;
  const innerHalfW = Math.max(4, halfW - espesorParedPx);
  const innerHalfD = Math.max(4, halfD - espesorParedPx);
  const ox = TRAMPA_VB_W / 2;
  const oy = 65 + halfW + altoPx + soladoPx;

  const wallZ0 = soladoPx;
  const wallZ1 = soladoPx + altoPx;

  // Cotas de ancho y profundo, paralelas a los bordes que se ven desde la
  // esquina trasera (igual convención que en Inversores/Paso de fauna).
  const dimPush = 22;
  const backModel = [-halfW, -halfD];
  const rightBackModel = [halfW, -halfD];
  const frontLeftModel = [-halfW, halfD];
  const backPt = isoPt(backModel[0], backModel[1], wallZ1, ox, oy);
  const rightBackPt = isoPt(rightBackModel[0], rightBackModel[1], wallZ1, ox, oy);
  const frontLeftPt = isoPt(frontLeftModel[0], frontLeftModel[1], wallZ1, ox, oy);
  const anchoP1 = isoPt(backModel[0], backModel[1] - dimPush, wallZ1, ox, oy);
  const anchoP2 = isoPt(rightBackModel[0], rightBackModel[1] - dimPush, wallZ1, ox, oy);
  const profP1 = isoPt(backModel[0] - dimPush, backModel[1], wallZ1, ox, oy);
  const profP2 = isoPt(frontLeftModel[0] - dimPush, frontLeftModel[1], wallZ1, ox, oy);
  const anchoLabel = isoPt((backModel[0] + rightBackModel[0]) / 2, backModel[1] - dimPush - 14, wallZ1, ox, oy);
  const profLabel = isoPt(backModel[0] - dimPush - 14, (backModel[1] + frontLeftModel[1]) / 2, wallZ1, ox, oy);

  // Anillo superior (marco): rectángulo exterior menos el interior — se
  // dibuja como UN solo path con dos subrutas y fill-rule "evenodd" para
  // que el interior quede realmente hueco (se ve lo que hay detrás/debajo).
  const topOuter = [
    isoPt(-halfW, -halfD, wallZ1, ox, oy), isoPt(halfW, -halfD, wallZ1, ox, oy),
    isoPt(halfW, halfD, wallZ1, ox, oy), isoPt(-halfW, halfD, wallZ1, ox, oy),
  ];
  const topInner = [
    isoPt(-innerHalfW, -innerHalfD, wallZ1, ox, oy), isoPt(innerHalfW, -innerHalfD, wallZ1, ox, oy),
    isoPt(innerHalfW, innerHalfD, wallZ1, ox, oy), isoPt(-innerHalfW, innerHalfD, wallZ1, ox, oy),
  ];
  const ringPath = `M ${topOuter.map((p) => p.join(',')).join(' L ')} Z M ${topInner.map((p) => p.join(',')).join(' L ')} Z`;

  // Nota: NO se dibuja el interior (paredes internas ni piso de la losa) —
  // el isométrico solo debe mostrar la caja exterior y la abertura superior
  // como un hueco (usando fill-rule evenodd en el marco), sin revelar lo
  // que hay dentro del tanque.

  // Caras exteriores de las paredes (derecha e izquierda, sin cara superior —
  // esa la reemplaza el "marco" con el hueco real).
  const outerRight = poly([
    isoPt(halfW, -halfD, wallZ1, ox, oy), isoPt(halfW, halfD, wallZ1, ox, oy),
    isoPt(halfW, halfD, wallZ0, ox, oy), isoPt(halfW, -halfD, wallZ0, ox, oy),
  ]);
  const outerLeft = poly([
    isoPt(-halfW, halfD, wallZ1, ox, oy), isoPt(halfW, halfD, wallZ1, ox, oy),
    isoPt(halfW, halfD, wallZ0, ox, oy), isoPt(-halfW, halfD, wallZ0, ox, oy),
  ]);

  // Cota de altura total (el valor que se digita en "Alto" — incluye la losa,
  // no solo la pared), a la derecha — en la arista trasera-derecha, que es el
  // punto más a la derecha de todo el dibujo (queda claramente separada).
  const [alturaTopX, alturaTopY] = isoPt(halfW, -halfD, wallZ1, ox, oy);
  const [alturaBotX, alturaBotY] = isoPt(halfW, -halfD, wallZ0, ox, oy);

  return (
    <svg viewBox={`0 0 ${TRAMPA_VB_W} ${TRAMPA_VB_H}`} className={TRAMPA_CSS_SIZE}>
      {/* Solado bajo toda la trampa — sin cara superior (showTop=false):
          su cara de arriba nunca se ve en un diseño real (queda cubierta por
          la caja de encima) y, por la proyección isométrica, esa cara podía
          asomarse (relleno y/o su borde) dentro de la abertura del tanque. */}
      <IsoBoxLineArt x0={-halfW} y0={-halfD} w={anchoPx} d={profundoPx} z0={0} z1={soladoPx} ox={ox} oy={oy} showTop={false} />
      {/* Caras exteriores de las paredes */}
      <polygon points={outerRight} fill="#F6F7F9" stroke="#152644" strokeWidth="1.1" />
      <polygon points={outerLeft} fill="#F6F7F9" stroke="#152644" strokeWidth="1.1" />
      {/* Marco superior (el espesor de pared visto desde arriba), con el hueco real en el medio — sin interior visible */}
      <path d={ringPath} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" fillRule="evenodd" />
      {/* Nivel de terreno natural: coincide con la parte de ARRIBA de las paredes (la abertura queda al nivel del suelo) */}
      <polygon
        points={poly([
          isoPt(-halfW - 16, -halfD - 16, wallZ1, ox, oy),
          isoPt(halfW + 16, -halfD - 16, wallZ1, ox, oy),
          isoPt(halfW + 16, halfD + 16, wallZ1, ox, oy),
          isoPt(-halfW - 16, halfD + 16, wallZ1, ox, oy),
        ])}
        fill="none"
        stroke="#6487C4"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={isoPt(-halfW - 16, -halfD - 16, wallZ1, ox, oy)[0] - 4}
        y={isoPt(-halfW - 16, -halfD - 16, wallZ1, ox, oy)[1] + 3}
        textAnchor="end"
        fontSize="7.5"
        fill="#6487C4"
        fontFamily="monospace"
      >
        N.T.N
      </text>
      {/* Cota de ancho: arriba, paralela al borde trasero */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={anchoP1[0]} y2={anchoP1[1]} />
        <line x1={rightBackPt[0]} y1={rightBackPt[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
        <line x1={anchoP1[0]} y1={anchoP1[1]} x2={anchoP2[0]} y2={anchoP2[1]} />
      </g>
      <text x={anchoLabel[0]} y={anchoLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo: a la izquierda, paralela al borde trasero-izquierdo */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={backPt[0]} y1={backPt[1]} x2={profP1[0]} y2={profP1[1]} />
        <line x1={frontLeftPt[0]} y1={frontLeftPt[1]} x2={profP2[0]} y2={profP2[1]} />
        <line x1={profP1[0]} y1={profP1[1]} x2={profP2[0]} y2={profP2[1]} />
      </g>
      <text x={profLabel[0]} y={profLabel[1]} textAnchor="middle" fontSize="8" fontWeight="600" fill="#152644">
        {profundo || '—'} m
      </text>
      {/* Cota de altura total, a la derecha, paralela a la arista vertical frontal */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={alturaTopX + 18} y1={alturaTopY} x2={alturaBotX + 18} y2={alturaBotY} />
        <line x1={alturaTopX + 14} y1={alturaTopY} x2={alturaTopX + 22} y2={alturaTopY} />
        <line x1={alturaBotX + 14} y1={alturaBotY} x2={alturaBotX + 22} y2={alturaBotY} />
      </g>
      <text x={alturaTopX + 30} y={(alturaTopY + alturaBotY) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${alturaTopX + 30}, ${(alturaTopY + alturaBotY) / 2})`}>
        {alto ? alto.toFixed(2) : '—'} m
      </text>
    </svg>
  );
}

/* Vista en planta (desde arriba) de la trampa, con el acero: el anillo de  */
/* refuerzo centrado en el espesor de pared (representa a TODOS los anillos, */
/* que son idénticos y solo cambian de altura) + las barras en U vistas de  */
/* canto — cada una es un punto en la pared por donde sube/baja, pareado    */
/* con su punto gemelo en la pared OPUESTA (misma barra, cruza por abajo).  */
export function TrampaAceitePlanta({ datos }) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const ancho = parseFloat(datos.ancho) || 0;
  const profundo = parseFloat(datos.profundo) || 0;
  const espesorPared = parseFloat(datos.espesor_pared) || 0;
  // "Alto" es la altura TOTAL de la caja (incluye la losa) — la altura de la
  // pared sola, que es lo que usan los cálculos de anillos y barras en U, es
  // esa altura menos el espesor de la losa.
  const altoTotal = parseFloat(datos.alto) || 0;
  const espesorLosa = parseFloat(datos.espesor_losa) || 0;
  const alturaPared = Math.max(0, altoTotal - espesorLosa);

  const scale = 110;
  const anchoPx = clamp((ancho || 1.5) * scale, 130, 230);
  const profundoPx = clamp((profundo || 1.2) * scale, 110, 210);
  const paredPx = clamp((espesorPared || 0.15) * scale, 12, 26);

  const uLargoCalc = calcularUTrampa({
    dimensionTransversal: datos.ancho, dimensionReparto: datos.profundo,
    alto: alturaPared, espesorPared: datos.espesor_pared,
    separacion: datos.u_largo?.separacion, calibre: datos.u_largo?.calibre,
  });
  const uCortoCalc = calcularUTrampa({
    dimensionTransversal: datos.profundo, dimensionReparto: datos.ancho,
    alto: alturaPared, espesorPared: datos.espesor_pared,
    separacion: datos.u_corto?.separacion, calibre: datos.u_corto?.calibre,
  });
  const anillos = calcularAnillosTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: alturaPared,
    espesorPared: datos.espesor_pared,
    separacion: datos.anillos?.separacion, calibre: datos.anillos?.calibre,
  });

  const cx = anchoPx / 2 + 70;
  const cy = profundoPx / 2 + 70;
  const x1 = cx - anchoPx / 2, x2 = cx + anchoPx / 2;
  const y1 = cy - profundoPx / 2, y2 = cy + profundoPx / 2;

  // Anillo de acero, centrado en el espesor de pared.
  const ringX1 = x1 + paredPx / 2, ringX2 = x2 - paredPx / 2;
  const ringY1 = y1 + paredPx / 2, ringY2 = y2 - paredPx / 2;

  // U · lado largo: repartidas en el espacio de la pared que corre en esa
  // dirección (izquierda/derecha, x = ringX1/ringX2) — SIN tocar las
  // esquinas (que son intersección con la pared perpendicular, no espacio
  // de esta pared).
  const nLargo = uLargoCalc ? uLargoCalc.cantidad : 0;
  const puntosLargo = [];
  for (let i = 0; i < nLargo; i++) {
    const frac = (i + 1) / (nLargo + 1);
    puntosLargo.push(ringY1 + frac * (ringY2 - ringY1));
  }
  // U · lado corto: repartidas en el espacio de la pared arriba/abajo, igual criterio.
  const nCorto = uCortoCalc ? uCortoCalc.cantidad : 0;
  const puntosCorto = [];
  for (let i = 0; i < nCorto; i++) {
    const frac = (i + 1) / (nCorto + 1);
    puntosCorto.push(ringX1 + frac * (ringX2 - ringX1));
  }

  return (
    <svg viewBox={`0 0 ${anchoPx + 160} ${profundoPx + 160}`} className={TRAMPA_PLANTA_CSS_SIZE}>
      <rect x={x1} y={y1} width={anchoPx} height={profundoPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={x1 + paredPx} y={y1 + paredPx} width={anchoPx - 2 * paredPx} height={profundoPx - 2 * paredPx} fill="white" stroke="#152644" strokeWidth="1" />
      {/* Anillo de refuerzo, centrado en el espesor de pared (representa a todos) */}
      <rect x={ringX1} y={ringY1} width={ringX2 - ringX1} height={ringY2 - ringY1} fill="none" stroke="#2563EB" strokeWidth="1.4" />
      {/* U · lado largo: un punto en cada pared larga, pareados (misma barra) */}
      {puntosLargo.map((y, i) => (
        <g key={`l${i}`}>
          <circle cx={ringX1} cy={y} r="2.8" fill="#059669" />
          <circle cx={ringX2} cy={y} r="2.8" fill="#059669" />
        </g>
      ))}
      {/* U · lado corto: un punto en cada pared corta, pareados (misma barra) */}
      {puntosCorto.map((x, i) => (
        <g key={`c${i}`}>
          <circle cx={x} cy={ringY1} r="2.8" fill="#059669" />
          <circle cx={x} cy={ringY2} r="2.8" fill="#059669" />
        </g>
      ))}
      {/* Cota de ancho, arriba */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1} y1={y1 - 20} x2={x2} y2={y1 - 20} />
        <line x1={x1} y1={y1 - 24} x2={x1} y2={y1 - 16} />
        <line x1={x2} y1={y1 - 24} x2={x2} y2={y1 - 16} />
      </g>
      <text x={cx} y={y1 - 28} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#152644">
        {ancho || '—'} m
      </text>
      {/* Cota de profundo, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={x1 - 20} y1={y1} x2={x1 - 20} y2={y2} />
        <line x1={x1 - 24} y1={y1} x2={x1 - 16} y2={y1} />
        <line x1={x1 - 24} y1={y2} x2={x1 - 16} y2={y2} />
      </g>
      <text x={x1 - 30} y={(y1 + y2) / 2} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#152644" transform={`rotate(-90, ${x1 - 30}, ${(y1 + y2) / 2})`}>
        {profundo || '—'} m
      </text>
      {/* Etiquetas de acero, debajo */}
      <text x={cx} y={y2 + 26} textAnchor="middle" fontSize="10" fontWeight="600" fill="#2563EB">
        {anillos?.cantidad || '—'} anillos {datos.anillos?.calibre || '#—'} @{datos.anillos?.separacion || '—'}
      </text>
      <text x={cx} y={y2 + 42} textAnchor="middle" fontSize="10" fontWeight="600" fill="#059669">
        U largo: {nLargo || '—'} {datos.u_largo?.calibre || '#—'} @{datos.u_largo?.separacion || '—'} · U corto: {nCorto || '—'} {datos.u_corto?.calibre || '#—'} @{datos.u_corto?.separacion || '—'}
      </text>
    </svg>
  );
}

/* Despiece de acero: corte vertical de la trampa (2 paredes + losa, como una */
/* "U" de concreto), mostrando la barra en U de ese lado COMPLETA en su      */
/* propio plano (baja por una pared, cruza el espesor de la losa, sube por  */
/* la opuesta, con gancho a 180° en ambos extremos de arriba) + los anillos */
/* horizontales vistos DE CANTO — como en un corte de estribos, cada anillo */
/* solo se ve como un punto en cada pared (la barra corre perpendicular al  */
/* plano de este corte, alrededor de todo el perímetro).                   */
/* "tipo": 'largo' → corte a lo ancho (la U que conecta las paredes largas, */
/* repartida a lo profundo); 'corto' → corte a lo profundo (la U que        */
/* conecta las paredes cortas, repartida a lo ancho).                      */
export function TrampaAceiteDespieceCorte({ datos, tipo }) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const dimensionTransversal = tipo === 'largo' ? (parseFloat(datos.ancho) || 0) : (parseFloat(datos.profundo) || 0);
  // "Alto" es la altura TOTAL de la caja (incluye la losa) — la altura de la
  // pared sola (lo que se dibuja como el tramo vertical de este corte) es
  // esa altura menos el espesor de la losa.
  const altoTotal = parseFloat(datos.alto) || 0;
  const espesorPared = parseFloat(datos.espesor_pared) || 0;
  const espesorLosa = parseFloat(datos.espesor_losa) || 0;
  const alturaPared = Math.max(0, altoTotal - espesorLosa);
  const uGrupo = tipo === 'largo' ? (datos.u_largo || {}) : (datos.u_corto || {});

  const uCalc = calcularUTrampa({
    dimensionTransversal: tipo === 'largo' ? datos.ancho : datos.profundo,
    dimensionReparto: tipo === 'largo' ? datos.profundo : datos.ancho,
    alto: alturaPared,
    espesorPared: datos.espesor_pared,
    separacion: uGrupo.separacion,
    calibre: uGrupo.calibre,
  });
  const anillos = calcularAnillosTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: alturaPared,
    espesorPared: datos.espesor_pared,
    separacion: datos.anillos?.separacion, calibre: datos.anillos?.calibre,
  });
  // El otro grupo de barras en U (perpendicular a esta) corre a lo largo del
  // ancho mostrado en esta vista, así que en este corte se ve cruzando la
  // losa como una fila de puntos (igual criterio que los anillos en la pared).
  const otroTipo = tipo === 'largo' ? 'corto' : 'largo';
  const otroGrupo = otroTipo === 'largo' ? (datos.u_largo || {}) : (datos.u_corto || {});
  const otroCalc = calcularUTrampa({
    dimensionTransversal: otroTipo === 'largo' ? datos.ancho : datos.profundo,
    dimensionReparto: otroTipo === 'largo' ? datos.profundo : datos.ancho,
    alto: alturaPared,
    espesorPared: datos.espesor_pared,
    separacion: otroGrupo.separacion,
    calibre: otroGrupo.calibre,
  });

  const scale = 130;
  const wPx = clamp((dimensionTransversal || 1.5) * scale, 140, 260);
  const hPx = clamp((alturaPared || 0.7) * scale, 90, 190);
  const paredPx = clamp((espesorPared || 0.15) * scale, 14, 32);
  const losaPx = clamp((espesorLosa || 0.15) * scale, 12, 28);

  const cx = wPx / 2 + 55;
  const topY = 48;
  const wallBotY = topY + hPx;
  const losaBotY = wallBotY + losaPx;
  const leftX = cx - wPx / 2;
  const rightX = cx + wPx / 2;
  const recubPx = 7;

  // Centerlines del acero: centrado en el espesor de cada pared y en el      */
  // espesor de la losa (mismo criterio de "perímetro centrado" del cálculo). */
  const barLeftX = leftX + paredPx / 2;
  const barRightX = rightX - paredPx / 2;
  const barTopY = topY + recubPx;
  const barBotY = wallBotY + losaPx / 2;
  const ganchoPx = 10;

  const separacionAnillos = parseFloat(datos.anillos?.separacion) || 0;
  const cantidadAnillos = anillos ? anillos.cantidad : 0;
  const anilloY = [];
  if (cantidadAnillos > 0) {
    // Repartidos en el tramo libre de la pared: desde el recubrimiento de
    // arriba (borde libre) hasta antes de llegar a la losa (para no quedar
    // justo en la intersección pared-losa).
    const escalaV = hPx / (alturaPared || 1);
    const margenInferior = recubPx * 1.5;
    const sepPxA = separacionAnillos > 0 ? separacionAnillos * escalaV : (hPx - recubPx - margenInferior) / Math.max(cantidadAnillos, 1);
    for (let i = 0; i < cantidadAnillos; i++) {
      const y = topY + recubPx + i * sepPxA;
      if (y <= wallBotY - margenInferior) anilloY.push(y);
    }
  }

  // Posiciones del acero perpendicular que cruza la losa en este corte,
  // repartidas en el espacio de la losa SIN tocar las intersecciones con
  // las paredes (que son donde va la barra en U de este mismo plano).
  const cantidadCruce = otroCalc ? otroCalc.cantidad : 0;
  const cruceX = [];
  for (let i = 0; i < cantidadCruce; i++) {
    const frac = (i + 1) / (cantidadCruce + 1);
    cruceX.push(barLeftX + frac * (barRightX - barLeftX));
  }

  return (
    <svg viewBox={`0 0 ${wPx + 110} ${losaBotY + 40}`} className={TRAMPA_DESPIECE_CSS_SIZE}>
      {/* Concreto en corte: 2 paredes + la losa que las une por debajo */}
      <rect x={leftX} y={topY} width={paredPx} height={hPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={rightX - paredPx} y={topY} width={paredPx} height={hPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />
      <rect x={leftX} y={wallBotY} width={wPx} height={losaPx} fill="#F6F7F9" stroke="#152644" strokeWidth="1.2" />

      {/* Barra en U, completa en este plano: baja, cruza la losa, sube */}
      <polyline
        points={`${barLeftX},${barTopY} ${barLeftX},${barBotY} ${barRightX},${barBotY} ${barRightX},${barTopY}`}
        fill="none" stroke="#059669" strokeWidth="1.8"
      />
      {/* Ganchos a 180°: casi paralelos a la pared (un tramo corto que se     */}
      {/* dobla de vuelta hacia abajo, junto a la barra principal), no hacia   */}
      {/* el lado — un gancho a 180° dobla en el mismo sentido, no perpendicular. */}
      <line x1={barLeftX + 3} y1={barTopY} x2={barLeftX + 3} y2={barTopY + ganchoPx} stroke="#059669" strokeWidth="1.8" />
      <line x1={barRightX - 3} y1={barTopY} x2={barRightX - 3} y2={barTopY + ganchoPx} stroke="#059669" strokeWidth="1.8" />

      {/* Anillos, vistos de canto: un punto en cada pared por cada altura */}
      {anilloY.map((y, i) => (
        <g key={i}>
          <circle cx={barLeftX} cy={y} r="2.6" fill="#2563EB" />
          <circle cx={barRightX} cy={y} r="2.6" fill="#2563EB" />
        </g>
      ))}

      {/* Acero perpendicular (la U del otro lado) que cruza la losa, visto de canto */}
      {cruceX.map((x, i) => (
        <circle key={`cr${i}`} cx={x} cy={barBotY} r="2.6" fill="#059669" />
      ))}

      {/* Cota de altura de la pared, a la izquierda */}
      <g stroke="#152644" strokeWidth="1">
        <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={wallBotY} />
        <line x1={leftX - 12} y1={topY} x2={leftX - 20} y2={topY} />
        <line x1={leftX - 12} y1={wallBotY} x2={leftX - 20} y2={wallBotY} />
      </g>
      <text x={leftX - 28} y={(topY + wallBotY) / 2} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#152644" transform={`rotate(90, ${leftX - 28}, ${(topY + wallBotY) / 2})`}>
        {alturaPared ? alturaPared.toFixed(2) : '—'} m
      </text>

      {/* Etiqueta de la barra en U, arriba */}
      <text x={cx} y={topY - 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#059669">
        {uCalc?.cantidad || '—'} U {uGrupo.calibre || '#—'} @{uGrupo.separacion || '—'} — {uCalc ? uCalc.longitud.toFixed(2) : '—'} m c/u
      </text>
      {/* Etiqueta de los anillos, a la derecha */}
      <text x={rightX + 16} y={(topY + wallBotY) / 2} fontSize="10" fontWeight="600" fill="#2563EB" transform={`rotate(90, ${rightX + 16}, ${(topY + wallBotY) / 2})`} textAnchor="middle">
        {anillos?.cantidad || '—'} anillos {datos.anillos?.calibre || '#—'} @{datos.anillos?.separacion || '—'}
      </text>
      {/* Etiqueta del acero que cruza, debajo de la losa */}
      <text x={cx} y={losaBotY + 26} textAnchor="middle" fontSize="10" fontWeight="600" fill="#059669">
        Cruza: {cantidadCruce || '—'} U {otroGrupo.calibre || '#—'} @{otroGrupo.separacion || '—'} ({otroTipo === 'largo' ? 'lado largo' : 'lado corto'})
      </text>
    </svg>
  );
}
export function TrampaAceiteDespieceLargo({ datos }) {
  return <TrampaAceiteDespieceCorte datos={datos} tipo="largo" />;
}
export function TrampaAceiteDespieceCorto({ datos }) {
  return <TrampaAceiteDespieceCorte datos={datos} tipo="corto" />;
}

export function TrampaAceiteVistas({ datos }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <div className="text-center">
        <TrampaAceitePreview datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Isométrico</p>
      </div>
      <div className="text-center">
        <TrampaAceitePlanta datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Planta con acero</p>
      </div>
      <div className="text-center">
        <TrampaAceiteDespieceLargo datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Despiece · U lado largo</p>
      </div>
      <div className="text-center">
        <TrampaAceiteDespieceCorto datos={datos} />
        <p className="text-xs text-navy-400 mt-0.5">Despiece · U lado corto</p>
      </div>
    </div>
  );
}

/* Garantiza que toda la estructura anidada exista, sin importar qué tan     */
/* vieja sea la plantilla guardada — mismo motivo que en Portón/CT: sin     */
/* esto, abrir una plantilla vieja (guardada antes de que existieran los    */
/* grupos de acero) para editarla revienta con pantalla en blanco.         */
export function normalizarDatosTrampa(datos) {
  const base = {
    ancho: '', profundo: '', alto: '',
    espesor_pared: '', espesor_losa: '', espesor_solado: '',
    resistencia: '',
    anillos: { calibre: '', separacion: '' },
    u_largo: { calibre: '', separacion: '' },
    u_corto: { calibre: '', separacion: '' },
  };
  if (!datos) return base;
  return {
    ...base,
    ...datos,
    anillos: { ...base.anillos, ...datos.anillos },
    u_largo: { ...base.u_largo, ...datos.u_largo },
    u_corto: { ...base.u_corto, ...datos.u_corto },
  };
}

export function TrampaAceiteForm({ plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [datos, setDatos] = useState(() => normalizarDatosTrampa(plantilla?.datos));

  function set(key, val) {
    setDatos((prev) => ({ ...prev, [key]: val }));
  }
  function setGrupo(grupo, key, val) {
    setDatos((prev) => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
  }

  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  // "Alto" es la altura TOTAL de la caja (incluye la losa) — la altura de la
  // pared sola, que usan los cálculos de anillos y barras en U, es esa altura
  // menos el espesor de la losa. calcularVolumenesTrampa SÍ espera el total.
  const altoTotal = parseFloat(datos.alto) || 0;
  const espesorLosaNum = parseFloat(datos.espesor_losa) || 0;
  const alturaPared = Math.max(0, altoTotal - espesorLosaNum);

  const anillos = calcularAnillosTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: alturaPared,
    espesorPared: datos.espesor_pared,
    separacion: datos.anillos?.separacion, calibre: datos.anillos?.calibre,
  });
  const uLargo = calcularUTrampa({
    dimensionTransversal: datos.ancho, dimensionReparto: datos.profundo,
    alto: alturaPared, espesorPared: datos.espesor_pared,
    separacion: datos.u_largo?.separacion, calibre: datos.u_largo?.calibre,
  });
  const uCorto = calcularUTrampa({
    dimensionTransversal: datos.profundo, dimensionReparto: datos.ancho,
    alto: alturaPared, espesorPared: datos.espesor_pared,
    separacion: datos.u_corto?.separacion, calibre: datos.u_corto?.calibre,
  });
  const volumenes = calcularVolumenesTrampa({
    ancho: datos.ancho, profundo: datos.profundo, alto: datos.alto,
    espesorPared: datos.espesor_pared, espesorLosa: datos.espesor_losa,
    espesorSolado: datos.espesor_solado,
  });
  const pesoTotalAcero = (anillos?.pesoTotal || 0) + (uLargo?.pesoTotal || 0) + (uCorto?.pesoTotal || 0);

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), datos);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · Shelter · Trampa de aceite
      </p>
      <div className="flex justify-center bg-navy-50 rounded-lg p-3 mb-5">
        <TrampaAceiteVistas datos={datos} />
      </div>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 space-y-3" style={{ minWidth: 280 }}>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Trampa de aceite Tipo 1"
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Ancho exterior (m)</label>
              <input value={datos.ancho} onChange={(e) => set('ancho', e.target.value)} placeholder="1.50" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Profundo exterior (m)</label>
              <input value={datos.profundo} onChange={(e) => set('profundo', e.target.value)} placeholder="1.20" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Alto total (m)</label>
              <input value={datos.alto} onChange={(e) => set('alto', e.target.value)} placeholder="0.85" className={cellInput} />
              <p className="text-[10px] text-navy-400 mt-0.5">Incluye la losa — no solo la pared</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de pared (m)</label>
              <input value={datos.espesor_pared} onChange={(e) => set('espesor_pared', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de losa (m)</label>
              <input value={datos.espesor_losa} onChange={(e) => set('espesor_losa', e.target.value)} placeholder="0.15" className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Espesor de solado (m)</label>
              <input value={datos.espesor_solado} onChange={(e) => set('espesor_solado', e.target.value)} placeholder="0.05" className={cellInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-navy-500 mb-1">Resistencia del concreto</label>
            <ResistenciaSelect value={datos.resistencia} onChange={(val) => set('resistencia', val)} className={cellInput} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">Anillos horizontales</p>
          <p className="text-xs text-navy-400 mb-3">Continuos, gancho a 180° en ambos extremos.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.anillos.calibre} onChange={(val) => setGrupo('anillos', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.anillos.separacion} onChange={(e) => setGrupo('anillos', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {anillos ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{anillos.cantidad}</span> anillos de{' '}
              <span className="font-mono font-semibold text-navy-700">{anillos.longitud.toFixed(2)} m</span> — {anillos.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">U · lado largo</p>
          <p className="text-xs text-navy-400 mb-3">Se reparten a lo largo.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.u_largo.calibre} onChange={(val) => setGrupo('u_largo', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.u_largo.separacion} onChange={(e) => setGrupo('u_largo', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {uLargo ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{uLargo.cantidad}</span> de{' '}
              <span className="font-mono font-semibold text-navy-700">{uLargo.longitud.toFixed(2)} m</span> — {uLargo.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
        <div className="border border-navy-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-600 mb-1">U · lado corto</p>
          <p className="text-xs text-navy-400 mb-3">Se reparten a lo ancho.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Calibre</label>
              <CalibreSelect value={datos.u_corto.calibre} onChange={(val) => setGrupo('u_corto', 'calibre', val)} className={cellInput} />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Separación (m)</label>
              <input value={datos.u_corto.separacion} onChange={(e) => setGrupo('u_corto', 'separacion', e.target.value)} placeholder="0.20" className={cellInput} />
            </div>
          </div>
          {uCorto ? (
            <p className="text-xs text-navy-500">
              → <span className="font-mono font-semibold text-navy-700">{uCorto.cantidad}</span> de{' '}
              <span className="font-mono font-semibold text-navy-700">{uCorto.longitud.toFixed(2)} m</span> — {uCorto.pesoTotal.toFixed(2)} kg
            </p>
          ) : (
            <p className="text-xs text-navy-300 italic">Completa dimensiones, espesor de pared, separación y calibre.</p>
          )}
        </div>
      </div>

      <ResumenVolumenes volumenes={volumenes} pesoAcero={pesoTotalAcero > 0 ? pesoTotalAcero : undefined} />

      <div className="flex gap-2 pt-4">
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar plantilla
        </button>
      </div>
    </form>
  );
}

/* Registro por tipo: qué formulario/vista/resumen usar en la lista según el */
/* tipo de cimentación activo. Se va llenando a medida que construimos cada  */
/* uno — los que faltan simplemente no aparecen aquí (CimentacionesView ya   */
/* filtra por "disponible" antes de llegar a este punto).                   */
/* Cada "resumen" devuelve un arreglo de líneas "Etiqueta: valor" (no un solo */
/* string) para poder mostrar subcategorías (Losa/Pedestales, Zapatas/       */
/* Pedestales/Viga, etc.) como líneas separadas y más legibles — se renderiza */
/* con <ResumenLineas>, que pone en negrita la parte antes de ":".           */
export const CIMENTACION_COMPONENTES = {
  postes_mt: {
    Form: PostesMtForm,
    Preview: PostesMtPreview,
    resumen: CIMENTACION_RESUMENES.postes_mt,
  },
  luminarias: {
    Form: LuminariasForm,
    Preview: LuminariasPreview,
    resumen: CIMENTACION_RESUMENES.luminarias,
  },
  camaras: {
    Form: CamarasForm,
    Preview: CamarasPreview,
    resumen: CIMENTACION_RESUMENES.camaras,
  },
  inversores: {
    Form: InversoresForm,
    Preview: InversoresIsometrico,
    resumen: CIMENTACION_RESUMENES.inversores,
  },
  cerramiento_postes: {
    Form: PostesMtForm,
    Preview: PostesMtPreview,
    resumen: CIMENTACION_RESUMENES.cerramiento_postes,
  },
  cerramiento_porton: {
    Form: PortonForm,
    Preview: PortonIsometrico,
    resumen: CIMENTACION_RESUMENES.cerramiento_porton,
  },
  cerramiento_paso_fauna: {
    Form: PasoFaunaForm,
    Preview: PasoFaunaPreview,
    resumen: CIMENTACION_RESUMENES.cerramiento_paso_fauna,
  },
  shelter_ct: {
    Form: CTForm,
    Preview: CTIsometrico,
    resumen: CIMENTACION_RESUMENES.shelter_ct,
  },
  shelter_trampa_aceite: {
    Form: TrampaAceiteForm,
    Preview: TrampaAceitePreview,
    resumen: CIMENTACION_RESUMENES.shelter_trampa_aceite,
  },
};


/* Vista principal de "Cimentaciones": elige el tipo (6 en total, hoy solo   */
/* Postes MT está construido) y administra sus plantillas (crear, editar,   */
/* eliminar). Las que no están listas muestran un aviso de "muy pronto".    */
/* Lista de fórmulas usadas en Cimentaciones, en texto plano — parte de la   */
/* "puerta trasera" de solo lectura para que un Desarrollador pueda          */
/* auditarlas sin tener que leer el código fuente. Se va ampliando a medida */
/* que se agregan más tipos de cimentación.                                */
export const FORMULAS_REFERENCIA = [
  { titulo: 'Longitud de barra longitudinal (pedestales)', formula: 'longitud = altura − 2×recubrimiento + (N.° de ganchos × gancho del calibre)' },
  { titulo: 'Peso de una barra', formula: 'peso = longitud × peso por metro del calibre' },
  { titulo: 'Cantidad de estribos (pedestales)', formula: 'cantidad = techo[ (altura − 2×recubrimiento) / separación ]' },
  { titulo: 'Longitud de un estribo', formula: 'longitud = 2×(ancho + profundo − 4×recubrimiento) + 2×gancho del calibre' },
  { titulo: 'Volumen de concreto — sección circular (Postes MT)', formula: 'concreto = π×(diámetro/2)² × (desplante + sobresaliente)' },
  { titulo: 'Volumen de concreto — sección rectangular (Luminarias, Cámaras, pedestales)', formula: 'concreto = ancho × profundo × (desplante + sobresaliente)' },
  { titulo: 'Volumen de excavación', formula: 'excavación = área de la sección × (desplante + espesor de solado)' },
  { titulo: 'Volumen de solado', formula: 'solado = área de la sección × espesor de solado' },
  { titulo: 'Inversores — volumen de excavación', formula: 'excavación = área de UN pedestal × (desplante + espesor de solado) × 2 — la losa no se excava, va sobre el nivel de terreno natural' },
  { titulo: 'Traslapo de barras (viga de amarre, Cerramiento)', formula: 'se busca en la tabla de traslapos por calibre y resistencia del concreto (NSR-10, redondeada hacia arriba al múltiplo de 0.05m más cercano) — no es una fórmula, es una tabla' },
  { titulo: 'Cantidad de barras de la parrilla (zapata del Portón)', formula: 'cantidad = techo[ (dimensión perpendicular − 2×recubrimiento) / separación ]  —  SIN sumar 1' },
  { titulo: 'Longitud de barra de la parrilla', formula: 'longitud = dimensión paralela − 2×recubrimiento + 2×gancho del calibre (2 ganchos, uno en cada extremo, hacia arriba)' },
  { titulo: 'Piezas de barra longitudinal (viga de amarre)', formula: 'traslapo a tercios, no a la mitad — arriba en L/3, abajo en 2L/3 (nunca en el mismo tercio). Pieza corta = L/3 + traslapo/2; pieza larga = 2L/3 + traslapo/2. Cada una de las 4 líneas (2 arriba + 2 abajo) usa 1 pieza corta + 1 larga = 8 piezas en total.' },
  { titulo: 'Longitud de barra del pedestal (Portón, sobre zapata)', formula: 'longitud = (altura sobre la zapata + empotramiento en la zapata) − 2×recubrimiento + (N.° de ganchos × gancho del calibre)' },
  { titulo: 'Volumen de excavación del conjunto Portón', formula: 'excavación = [2×(ancho×largo de zapata) + (separación entre zapatas − largo de zapata)×ancho de la viga] × (desplante + espesor de solado) — el pedestal no aporta, ya queda incluido' },
];

/* "Puerta trasera": solo el rol Desarrollador puede ver y editar estos       */
/* números (recubrimiento, gancho/peso por calibre, traslapos), y ver         */
/* (sin poder editar) las fórmulas que los combinan. Los números se guardan  */
/* en Supabase y se aplican de inmediato en toda la app sin necesitar un      */
/* despliegue nuevo.                                                         */
export function ParametrosIngenieriaView({ parametros, onGuardar }) {
  const [recubrimiento, setRecubrimiento] = useState(String(parametros.recubrimiento));
  const [barras, setBarras] = useState(() => JSON.parse(JSON.stringify(parametros.barras)));
  const [traslapos, setTraslapos] = useState(() => JSON.parse(JSON.stringify(parametros.traslapos)));
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const resistenciasTraslapo = ['21 MPa', '28 MPa', '35 MPa'];
  const cellInput = 'w-full rounded-md border border-navy-300 px-2 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-lime-400';

  function setBarraCampo(calibre, campo, val) {
    setBarras((prev) => ({ ...prev, [calibre]: { ...prev[calibre], [campo]: val } }));
  }
  function setTraslapoCampo(calibre, resistencia, val) {
    setTraslapos((prev) => ({ ...prev, [calibre]: { ...(prev[calibre] || {}), [resistencia]: val } }));
  }

  async function guardar() {
    setGuardando(true);
    const datosLimpios = {
      recubrimiento: parseFloat(recubrimiento) || 0,
      barras: Object.fromEntries(Object.entries(barras).map(([cal, v]) => [cal, { gancho: parseFloat(v.gancho) || 0, peso: parseFloat(v.peso) || 0 }])),
      traslapos: Object.fromEntries(
        Object.entries(traslapos).map(([cal, v]) => [cal, Object.fromEntries(Object.entries(v).map(([r, val]) => [r, parseFloat(val) || 0]))])
      ),
    };
    await onGuardar(datosLimpios);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-lime-600 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Parámetros de Ingeniería</h1>
          <p className="text-navy-500 text-sm">
            Solo visible para el rol Desarrollador. Estos valores alimentan todos los cálculos de acero de Cimentaciones.
          </p>
        </div>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Recubrimiento (m)</p>
        <input value={recubrimiento} onChange={(e) => setRecubrimiento(e.target.value)} className={`${cellInput} max-w-[140px]`} />
        <p className="text-xs text-navy-400 mt-1">Se usa igual en todas las cimentaciones (postes, zapatas, vigas, pedestales, estribos).</p>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5 overflow-x-auto">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Gancho y peso por calibre</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-navy-400 text-left">
              <th className="pb-2 pr-3">Calibre</th>
              <th className="pb-2 pr-3">Gancho (m)</th>
              <th className="pb-2">Peso (kg/m)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(barras).map((cal) => (
              <tr key={cal}>
                <td className="py-1 pr-3 font-mono font-semibold text-navy-700">{cal}</td>
                <td className="py-1 pr-3 w-32">
                  <input value={barras[cal].gancho} onChange={(e) => setBarraCampo(cal, 'gancho', e.target.value)} className={cellInput} />
                </td>
                <td className="py-1 w-32">
                  <input value={barras[cal].peso} onChange={(e) => setBarraCampo(cal, 'peso', e.target.value)} className={cellInput} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-navy-200 rounded-xl p-5 mb-5 overflow-x-auto">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-1">Traslapos (m) por calibre y resistencia</p>
        <p className="text-xs text-navy-400 mb-3">Tabla de traslapos tipo B a tensión (NSR-10). Solo cubre 21/28/35 MPa.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-navy-400 text-left">
              <th className="pb-2 pr-3">Calibre</th>
              {resistenciasTraslapo.map((r) => (
                <th key={r} className="pb-2 pr-3">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(barras).map((cal) => (
              <tr key={cal}>
                <td className="py-1 pr-3 font-mono font-semibold text-navy-700">{cal}</td>
                {resistenciasTraslapo.map((r) => (
                  <td key={r} className="py-1 pr-3 w-28">
                    <input value={traslapos[cal]?.[r] ?? ''} onChange={(e) => setTraslapoCampo(cal, r, e.target.value)} className={cellInput} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={guardar}
        disabled={guardando}
        className="bg-lime-500 hover:bg-lime-600 disabled:opacity-60 text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-lg mb-8 transition-colors"
      >
        {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      <div className="bg-navy-50 border border-navy-200 rounded-xl p-5">
        <p className="text-sm font-bold text-navy-700 mb-1">Fórmulas usadas (solo lectura)</p>
        <p className="text-xs text-navy-400 mb-3">Para corregir una fórmula (no solo un número) hay que pedir un cambio de código — esto es solo para verificarlas.</p>
        <div className="space-y-3">
          {FORMULAS_REFERENCIA.map((f, i) => (
            <div key={i} className="border-b border-navy-200 pb-2.5 last:border-0">
              <p className="text-xs font-semibold text-navy-700 mb-0.5">{f.titulo}</p>
              <p className="text-xs font-mono text-navy-600">{f.formula}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CimentacionesView({ plantillas, onAdd, onUpdate, onDelete, mallas, onAddMalla, perfil, parametrosIngenieria, onGuardarParametros }) {
  const [tipoActivo, setTipoActivo] = useState('postes_mt');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [duplicandoDesde, setDuplicandoDesde] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [mostrandoParametros, setMostrandoParametros] = useState(false);
  const [previewAmpliada, setPreviewAmpliada] = useState(null);

  // Solo Ing. Estructural (o Desarrollador) puede crear/editar/eliminar
  // plantillas de Cimentaciones — el resto solo las visualiza.
  const puedeEditar = isDeveloper(perfil) || (perfil?.roles || []).includes('estructural');

  const tipoDef = CIMENTACION_TIPOS.find((t) => t.id === tipoActivo);
  const plantillasDelTipo = plantillas.filter((p) => p.tipo === tipoActivo);
  const componentes = CIMENTACION_COMPONENTES[tipoActivo];

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
    setDuplicandoDesde(null);
  }
  function duplicar(p) {
    setDuplicandoDesde({ nombre: `${p.nombre} (copia)`, datos: JSON.parse(JSON.stringify(p.datos)), __duplicando: true });
    setCreando(true);
  }

  if (mostrandoParametros) {
    return (
      <div>
        <div className="px-4 md:px-8 pt-4 md:pt-8 max-w-4xl mx-auto">
          <button onClick={() => setMostrandoParametros(false)} className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-700 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver a Cimentaciones
          </button>
        </div>
        <ParametrosIngenieriaView parametros={parametrosIngenieria} onGuardar={onGuardarParametros} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Cimentaciones</h1>
          <p className="text-navy-500 text-sm mt-1">
            Plantillas reutilizables de dimensiones y despiece — se crean una vez y se usan en cualquier proyecto sin volver a digitarlas.
          </p>
        </div>
        {isDeveloper(perfil) && (
          <button
            onClick={() => setMostrandoParametros(true)}
            title="Solo Desarrollador: ver y editar los números que alimentan los cálculos de acero"
            className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 hover:text-navy-600 border border-navy-200 hover:border-navy-300 rounded-lg px-3 py-2 shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" /> Parámetros de ingeniería
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CIMENTACION_TIPOS.map((t) => {
          const TIcon = t.icon;
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
              <TIcon className="w-4 h-4" />
              {t.label}
              {t.disponible && <span className={activo ? 'text-navy-300' : 'text-navy-400'}>({cantidad})</span>}
              {!t.disponible && <span className="text-xs italic opacity-70">(pronto)</span>}
            </button>
          );
        })}
      </div>

      {!tipoDef.disponible ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center">
          <tipoDef.icon className="w-8 h-8 text-navy-300 mx-auto mb-3" />
          <p className="text-navy-600 font-semibold">"{tipoDef.label}" todavía no está disponible</p>
          <p className="text-sm text-navy-400 mt-1">Vamos construyendo las 6 cimentaciones de a una — esta sigue en la fila.</p>
        </div>
      ) : (
        <div>
          {!creando && !editandoId && puedeEditar && (
            <button
              onClick={() => setCreando(true)}
              className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg mb-5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva plantilla de {tipoDef.label}
            </button>
          )}
          {!puedeEditar && (
            <p className="flex items-center gap-1.5 text-xs text-navy-400 mb-5">
              <Lock className="w-3.5 h-3.5" /> Solo Ing. Estructural puede crear o editar estas plantillas — aquí puedes verlas.
            </p>
          )}

          {(creando || editandoId) && puedeEditar && (
            <componentes.Form
              plantilla={
                editandoId
                  ? plantillasDelTipo.find((p) => p.id === editandoId)
                  : duplicandoDesde || null
              }
              onCancel={cerrarFormulario}
              onSave={(nombre, datos) => {
                if (editandoId) onUpdate(editandoId, { nombre, datos });
                else onAdd(tipoActivo, nombre, datos);
                cerrarFormulario();
              }}
              mallas={mallas}
              onAddMalla={onAddMalla}
            />
          )}

          {!creando && !editandoId && (
            plantillasDelTipo.length === 0 ? (
              <p className="text-sm text-navy-400 italic text-center py-10">Aún no hay plantillas de {tipoDef.label}.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plantillasDelTipo.map((p) => (
                  <div key={p.id} className="bg-white border border-navy-200 rounded-xl p-4">
                    <button
                      onClick={() => setPreviewAmpliada(p)}
                      className="flex items-center justify-center mb-2 w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                      title="Click para ampliar"
                    >
                      <componentes.Preview datos={p.datos} className="w-full h-auto" />
                    </button>
                    <p className="font-semibold text-navy-800 text-sm text-center mb-1">{p.nombre}</p>
                    <div className="mb-3">
                      <ResumenLineas lineas={componentes.resumen(p.datos)} size="text-xs" align="center" />
                    </div>
                    {puedeEditar && (
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        <button onClick={() => setEditandoId(p.id)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button onClick={() => duplicar(p)} className="text-xs font-semibold text-navy-500 hover:text-navy-700 flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" /> Duplicar
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
        </div>
      )}

      {/* Vista de visualización ampliada — clic afuera o en la X la cierra. */}
      {previewAmpliada && (
        <div className="fixed inset-0 z-50 bg-navy-900/90 flex items-center justify-center p-6 cursor-zoom-out" onClick={() => setPreviewAmpliada(null)}>
          <button onClick={() => setPreviewAmpliada(null)} className="absolute top-4 right-4 text-white bg-navy-800/70 hover:bg-navy-800 rounded-full p-2" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-full overflow-y-auto cursor-default" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-navy-800 text-center mb-3">{previewAmpliada.nombre}</p>
            <componentes.Preview datos={previewAmpliada.datos} className="w-full h-auto" />
            <div className="mt-3">
              <ResumenLineas lineas={componentes.resumen(previewAmpliada.datos)} size="text-sm" align="center" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5C. CANALIZACIONES — plantillas reutilizables de secciones de zanja para
   líneas eléctricas/comunicaciones enterradas (basado en el documento de
   "Criterios de zanjas y canalizaciones": NTC 2050, RETIE, normas de OR).
   Cada TIPO tiene una profundidad sugerida por la norma (Tabla 3 del
   documento), editable. Dentro de un mismo tipo puede haber varias
   plantillas a través del tiempo; solo UNA se marca como "Principal" (la
   vigente/más actualizada) — la app garantiza que no quede más de una
   marcada por tipo.
   Fase 2 (pendiente, turno futuro): pestaña de "Cruces" que combina 2+ de
   estas plantillas aplicando las reglas de profundidad de la Tabla 4.
   ============================================================================ */

/* "profundidadNorma"/"distanciaCintaNorma" vienen de la Tabla 3 y de la      */
/* sección "Cinta de señalización de peligro" del documento de criterios —   */
/* son SUGERENCIAS iniciales (editables), no valores forzados.               */


/* --- Proyección isométrica simple, para que el ancho/profundo/alto se      */
/* distingan claramente en la previsualización. x = ancho, y = profundo,    */
/* z = altura (hacia arriba). Devuelve coordenadas de pantalla [sx, sy].     */
/* Con esta fórmula, la esquina "más cercana" al espectador es siempre la   */
/* de x máximo y y máximo — las dos caras visibles deben tocar esa esquina. */
export const ISO_COS = Math.cos(Math.PI / 6); // 30°
export const ISO_SIN = Math.sin(Math.PI / 6);
export function isoPt(x, y, z, ox, oy) {
  return [ox + (x - y) * ISO_COS, oy + (x + y) * ISO_SIN - z];
}
export function poly(points) {
  return points.map((p) => p.join(',')).join(' ');
}
/* Dibuja una caja isométrica (3 caras visibles: superior, derecha e         */
/* izquierda) entre z0 (abajo) y z1 (arriba), con ancho W y profundo D,      */
/* dentro de un origen (ox, oy). Colores en 3 tonos para dar volumen.       */
export function IsoBoxLineArt({ x0, y0, w, d, z0, z1, ox, oy, fillTop = 'white', fillSide = '#F6F7F9', showTop = true }) {
  const top = [
    isoPt(x0, y0, z1, ox, oy),
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0, y0 + d, z1, ox, oy),
  ];
  const right = [
    isoPt(x0 + w, y0, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0 + w, y0, z0, ox, oy),
  ];
  const left = [
    isoPt(x0, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z1, ox, oy),
    isoPt(x0 + w, y0 + d, z0, ox, oy),
    isoPt(x0, y0 + d, z0, ox, oy),
  ];
  return (
    <g>
      <polygon points={poly(left)} fill={fillSide} stroke="#152644" strokeWidth="1.1" />
      <polygon points={poly(right)} fill={fillSide} stroke="#152644" strokeWidth="1.1" />
      {showTop && <polygon points={poly(top)} fill={fillTop} stroke="#152644" strokeWidth="1.3" />}
    </g>
  );
}

/* Dibujo de una plantilla ya elegida, para usarlo FUERA de esta sección
   (hoy: la pestaña técnica de un proyecto). Existe para que quien lo necesite
   no tenga que conocer el registro de componentes ni importar la sección
   entera de forma directa: App.jsx lo carga con React.lazy, así el dibujo
   llega solo cuando de verdad hay una plantilla que pintar. */
export function PreviewPlantilla({ tipo, datos, className = 'w-full h-full' }) {
  const componentes = CIMENTACION_COMPONENTES[tipo];
  if (!componentes) return null;
  const { Preview } = componentes;
  return <Preview datos={datos} className={className} />;
}

export default CimentacionesView;
