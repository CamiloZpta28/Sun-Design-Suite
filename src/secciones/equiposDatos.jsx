/* ============================================================================
   EQUIPOS ELÉCTRICOS — tipos, semilla e íconos
   ----------------------------------------------------------------------------
   La parte de la sección que App.jsx necesita SIEMPRE: la lista de tipos y su
   ícono se usan también dentro de un proyecto (para elegir y mostrar la
   plantilla de equipo de una pestaña técnica), y la semilla se aplica al
   cargar los datos. Por eso vive aparte del formulario y la vista de la
   sección (Equipos.jsx), que sí se descargan solo al abrirla.
   ============================================================================ */

import React from 'react';

/* ============================================================================
   5B. EQUIPOS ELÉCTRICOS — plantillas reutilizables de equipos (paneles,
   inversores, transformadores, etc.). A diferencia de Cimentaciones, aquí NO
   hay cálculos ni previsualizaciones técnicas: cada "tipo" es simplemente un
   nombre + una especificación corta + una lista fija de atributos (texto
   libre) + una imagen opcional (si no se sube una, se muestra un ícono
   genérico representativo del tipo de equipo).
   ============================================================================ */

/* Cada tipo trae su propia lista de "campos" (los nombres exactos vienen del */
/* Excel de referencia entregado por Camilo). Cuando dentro de una misma      */
/* categoría había sub-tipos con listas de campos distintas (p. ej. los 3     */
/* tipos de Transformador, o Cable DC/AC/Cobre desnudo), cada uno quedó como  */
/* un tipo independiente con su propio formulario — mismo criterio que        */
/* Cerramiento en Cimentaciones.                                             */
export const EQUIPO_TIPOS = [
  { id: "panel", label: "Panel", campos: ["Potencia", "Bifacialidad", "Voltaje circuito abierto", "Voltaje de máxima potencia", "Corriente de cortocircuito", "Corriente de máxima potencia", "Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante"] },
  { id: "inversor", label: "Inversor", campos: ["Potencia", "Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "Voltaje de entrada", "Voltaje de salida", "Voltaje máximo de entrada", "Voltaje mínimo de entrada", "Potencia máxima"] },
  { id: "transformador_potencia", label: "Transformador de potencia", campos: ["Potencia", "Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje alta", "Voltaje baja", "Grupo horario", "Número de serie", "Tipo de transformador", "Número de fases", "Nivel de aislamiento"] },
  { id: "transformador_corriente", label: "Transformador de corriente", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Número de fases", "Nivel de aislamiento", "Clase Medición", "Corriente térmica de corta duración", "Burden", "Relación de transformación", "Corriente primario", "Corriente secundario", "Ancho", "Largo", "Alto", "Corriente nominal"] },
  { id: "transformador_potencial", label: "Transformador de potencial", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje alta", "Voltaje baja", "Número de fases", "Nivel de aislamiento", "Clase Medición", "Burden", "Relación de transformación", "Ancho", "Largo", "Alto"] },
  { id: "reconectador", label: "Reconectador", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "Nivel de aislamiento", "Ancho", "Largo", "Alto", "Corriente nominal"] },
  { id: "celda", label: "Celda", campos: ["Corriente de cortocircuito", "Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Nivel de aislamiento", "Corriente nominal", "Grado IP"] },
  { id: "tablero", label: "Tablero", campos: ["Corriente de cortocircuito", "Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Nivel de aislamiento", "Corriente nominal", "Grado IP"] },
  { id: "breaker", label: "Breaker", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "Corriente nominal", "Icu", "Rango de regulación", "Grado IP"] },
  { id: "dps", label: "DPS", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "BIL", "Tensión soportada al impulso tipo rayo", "Tensión soportada a frecuencia industrial", "MCOV"] },
  { id: "medidor", label: "Medidor", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje de entrada", "Consumo"] },
  { id: "cable_dc", label: "Cable DC", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "Nivel de aislamiento", "Calibre", "Diámetro conductor", "Diámetro externo", "Resistencia por km", "Peso por km", "Material conductor", "Material aislamiento", "Radio de curvatura mínimo", "Diámetro interno", "Material"] },
  { id: "cable_ac", label: "Cable AC", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal", "Nivel de aislamiento", "Calibre", "Diámetro conductor", "Diámetro externo", "Resistencia por km", "Peso por km", "Material conductor", "Material aislamiento", "Radio de curvatura mínimo", "Diámetro interno", "Material"] },
  { id: "cable_cobre_desnudo", label: "Cable · Cobre desnudo", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Calibre"] },
  { id: "bandeja", label: "Bandeja", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Ancho", "Largo", "Alto"] },
  { id: "tuberia_poliamida", label: "Tubería · Poliamida", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante"] },
  { id: "tuberia_pvc", label: "Tubería · PVC/rígida", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Diámetro externo", "Diámetro interno"] },
  { id: "shelter", label: "Shelter", campos: ["Marca", "Modelo / Referencia", "Normas técnicas", "Fabricante", "Voltaje nominal"] },
];

/* Las 68 plantillas de ejemplo del Excel de Camilo, precargadas la primera   */
/* vez que se abre esta pestaña (ver "cargarDatosIniciales" en el componente */
/* raíz — mismo patrón que "países/proveedores/mallas" semilla). Solo traen  */
/* nombre + especificación; los demás atributos quedan en blanco para que    */
/* cada quien los complete con sus propios datos reales.                    */
export const EQUIPO_SEED = [
  { tipo: "panel", nombre: "Panel Longi 655 Wp", especificacion: "655 Wp" },
  { tipo: "panel", nombre: "Panel Longi 620 Wp", especificacion: "620 Wp" },
  { tipo: "inversor", nombre: "Inversor Huawei 249 kW", especificacion: "249 kW" },
  { tipo: "inversor", nombre: "Inversor Huawei 247.5 kW", especificacion: "247.5 kW" },
  { tipo: "inversor", nombre: "Inversor Huawei 300 kW", especificacion: "300 kW" },
  { tipo: "inversor", nombre: "Inversor Huawei 200 kW", especificacion: "200 kW" },
  { tipo: "inversor", nombre: "Inversor Huawei 100 kW", especificacion: "100 kW" },
  { tipo: "transformador_potencia", nombre: "Transformador de potencia Tesla 1100 kVA seco", especificacion: "1100 kVA" },
  { tipo: "transformador_potencia", nombre: "Transformador de potencia Zentrack 1100 kVA aceite", especificacion: "1100 kVA" },
  { tipo: "transformador_potencia", nombre: "Transformador de potencia Zentrack 1250 kVA seco", especificacion: "1250 kVA" },
  { tipo: "transformador_corriente", nombre: "Transformador de corriente Rymel", especificacion: "" },
  { tipo: "transformador_potencial", nombre: "Transformador de potencial Rymel", especificacion: "" },
  { tipo: "transformador_potencial", nombre: "Transformador de potencial Rymel", especificacion: "" },
  { tipo: "reconectador", nombre: "Reconectador ABB", especificacion: "15 kV" },
  { tipo: "reconectador", nombre: "Reconectador ABB", especificacion: "38 kV" },
  { tipo: "reconectador", nombre: "Reconectador Noja", especificacion: "15 kV" },
  { tipo: "reconectador", nombre: "Reconectador Noja", especificacion: "27 kV" },
  { tipo: "reconectador", nombre: "Reconectador Noja", especificacion: "38 kV" },
  { tipo: "medidor", nombre: "Medidor Iskra", especificacion: "" },
  { tipo: "medidor", nombre: "Medidor Itron", especificacion: "" },
  { tipo: "medidor", nombre: "Medidor Metcom", especificacion: "" },
  { tipo: "dps", nombre: "DPS Celsa", especificacion: "15 kV" },
  { tipo: "dps", nombre: "DPS Celsa", especificacion: "36 kV" },
  { tipo: "dps", nombre: "DPS Shendian Electric", especificacion: "18 kV" },
  { tipo: "cable_dc", nombre: "Cable DC Procables", especificacion: "6 mm" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "2 AWG" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "2 AWG" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "1/0 AWG" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "2/0 AWG" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "4/0 AWG" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "250 MCM" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "350 MCM" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "500 MCM" },
  { tipo: "cable_ac", nombre: "Cable AC Procables", especificacion: "8 AWG" },
  { tipo: "breaker", nombre: "Breaker ABB 1250 A 1000V", especificacion: "1250 A 1000V" },
  { tipo: "breaker", nombre: "Breaker ABB 250 A 1000V", especificacion: "1250 A 1000V" },
  { tipo: "breaker", nombre: "Breaker ABB 160 A 480V", especificacion: "160 A 480V" },
  { tipo: "breaker", nombre: "Breaker ABB 80 A 480V", especificacion: "" },
  { tipo: "breaker", nombre: "Breaker ABB", especificacion: "" },
  { tipo: "breaker", nombre: "Breaker ABB", especificacion: "" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "Alt 8cm, L 2.4mt, A 10cm" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "Alt 5cm / L 2.4mt / A 30cm" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "Alt 5cm / L 3mt / A 10cm" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "Alt 5cm / L 3mt / A 20cm" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "" },
  { tipo: "bandeja", nombre: "Bandeja Escalera Galco", especificacion: "" },
  { tipo: "tuberia_poliamida", nombre: "Tubería Poliamida Interflex", especificacion: "AGT 12 N" },
  { tipo: "tuberia_poliamida", nombre: "Tubería Poliamida Interflex", especificacion: "AGT 48 N" },
  { tipo: "tuberia_poliamida", nombre: "Tubería Poliamida Interflex", especificacion: "AGT 95 N" },
  { tipo: "tuberia_pvc", nombre: "Tubería PVC Durman", especificacion: "4\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería PVC Durman", especificacion: "2\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería IMC Fuji", especificacion: "4\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería IMC Fuji", especificacion: "2\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería IMC Fuji", especificacion: "3/4\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería Aiscan TPI", especificacion: "3/4\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería Aiscan UV", especificacion: "2\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería Aiscan UV", especificacion: "4\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería Aiscan DNI", especificacion: "2\"" },
  { tipo: "tuberia_pvc", nombre: "Tubería Aiscan DNI", especificacion: "4\"" },
  { tipo: "cable_cobre_desnudo", nombre: "Cable Cobre Desnudo", especificacion: "1/0 AWG" },
  { tipo: "cable_cobre_desnudo", nombre: "Cable Cobre Desnudo", especificacion: "2 AWG" },
  { tipo: "shelter", nombre: "Shelter Zentrack 1100 KVA 13.8 kV", especificacion: "1100 KVA 13.8 kV" },
  { tipo: "shelter", nombre: "Shelter Zentrack 1100 KVA 34.5 kV", especificacion: "1100 KVA 34.5 kV" },
  { tipo: "shelter", nombre: "Shelter Zentrack 1250 kVA 34.5 kV", especificacion: "1250 KVA 34.5 kV" },
  { tipo: "shelter", nombre: "Shelter Zentrack 1250 kVA 13.8 kV", especificacion: "1250 KVA 13.8 kV" },
  { tipo: "celda", nombre: "Celda ABB 36 kV", especificacion: "36 kV" },
  { tipo: "celda", nombre: "Celda ABB 24 kV", especificacion: "24 kV" },
  { tipo: "tablero", nombre: "Tablero Zentrack 800 V", especificacion: "800 V" },
];

/* Ícono genérico simple por tipo — se usa como respaldo cuando la plantilla */
/* no tiene una imagen propia subida. Son símbolos esquemáticos, no dibujos  */
/* técnicos a escala (a diferencia de las cimentaciones, aquí no aplica).    */
export function EquipoIcono({ tipoId, className = 'w-28 h-28' }) {
  const stroke = '#152644';
  const accent = '#2563EB';
  let content;
  switch (tipoId) {
    case 'panel':
      content = (
        <g>
          <rect x="18" y="28" width="64" height="44" rx="2" fill="#EAF1FF" stroke={stroke} strokeWidth="1.4" />
          {[1, 2, 3].map((i) => <line key={`v${i}`} x1={18 + i * 16} y1="28" x2={18 + i * 16} y2="72" stroke={stroke} strokeWidth="1" />)}
          {[1, 2].map((i) => <line key={`h${i}`} x1="18" y1={28 + i * 14.6} x2="82" y2={28 + i * 14.6} stroke={stroke} strokeWidth="1" />)}
        </g>
      );
      break;
    case 'inversor':
      content = (
        <g>
          <rect x="24" y="24" width="52" height="52" rx="5" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <path d="M 32 50 Q 41 30, 50 50 T 68 50" fill="none" stroke={accent} strokeWidth="2.2" />
        </g>
      );
      break;
    case 'transformador_potencia':
      content = (
        <g>
          <rect x="24" y="46" width="52" height="30" rx="3" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <line x1="38" y1="46" x2="38" y2="30" stroke={stroke} strokeWidth="1.8" />
          <line x1="62" y1="46" x2="62" y2="30" stroke={stroke} strokeWidth="1.8" />
          <circle cx="38" cy="27" r="3.2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.2" />
          <circle cx="62" cy="27" r="3.2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.2" />
        </g>
      );
      break;
    case 'transformador_corriente':
      content = (
        <g>
          <circle cx="50" cy="50" r="24" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <circle cx="50" cy="50" r="11" fill="white" stroke={stroke} strokeWidth="1.2" />
          <line x1="16" y1="50" x2="84" y2="50" stroke={accent} strokeWidth="2.2" />
        </g>
      );
      break;
    case 'transformador_potencial':
      content = (
        <g>
          <rect x="34" y="46" width="32" height="26" rx="3" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <line x1="50" y1="46" x2="50" y2="28" stroke={stroke} strokeWidth="1.8" />
          <circle cx="50" cy="25" r="3.2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.2" />
        </g>
      );
      break;
    case 'reconectador':
      content = (
        <g>
          <rect x="37" y="40" width="26" height="36" rx="3" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <line x1="50" y1="40" x2="50" y2="25" stroke={stroke} strokeWidth="1.8" />
          <circle cx="50" cy="22" r="3.2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.2" />
          <line x1="28" y1="78" x2="72" y2="78" stroke={stroke} strokeWidth="1.4" />
        </g>
      );
      break;
    case 'celda':
      content = (
        <g>
          <rect x="27" y="22" width="46" height="54" rx="2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <line x1="50" y1="22" x2="50" y2="76" stroke={stroke} strokeWidth="1" />
          <circle cx="38.5" cy="34" r="2.2" fill={stroke} />
          <circle cx="61.5" cy="34" r="2.2" fill={stroke} />
          <rect x="32" y="55" width="14" height="11" fill="none" stroke={accent} strokeWidth="1.2" />
          <rect x="54" y="55" width="14" height="11" fill="none" stroke={accent} strokeWidth="1.2" />
        </g>
      );
      break;
    case 'tablero':
      content = (
        <g>
          <rect x="23" y="23" width="54" height="54" rx="2" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          {[0, 1, 2].map((r) => [0, 1].map((c) => (
            <rect key={`${r}-${c}`} x={31 + c * 22} y={31 + r * 14} width="15" height="9" fill="none" stroke={accent} strokeWidth="1" />
          )))}
        </g>
      );
      break;
    case 'breaker':
      content = (
        <g>
          <rect x="31" y="28" width="38" height="48" rx="3" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <line x1="50" y1="42" x2="50" y2="58" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="50" cy="63" r="2.6" fill={stroke} />
        </g>
      );
      break;
    case 'dps':
      content = (
        <g>
          <rect x="42" y="22" width="16" height="48" rx="7" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          {[0, 1, 2, 3].map((i) => <line key={i} x1="42" y1={30 + i * 9.5} x2="58" y2={30 + i * 9.5} stroke={stroke} strokeWidth="1" />)}
          <line x1="50" y1="70" x2="50" y2="80" stroke={stroke} strokeWidth="1.4" />
        </g>
      );
      break;
    case 'medidor':
      content = (
        <g>
          <circle cx="50" cy="50" r="27" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <circle cx="50" cy="50" r="18" fill="white" stroke={stroke} strokeWidth="1" />
          <line x1="50" y1="50" x2="61" y2="39" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="50" cy="50" r="1.8" fill={stroke} />
        </g>
      );
      break;
    case 'cable_dc':
    case 'cable_ac':
      content = (
        <path d="M 16 50 Q 33 28, 50 50 T 84 50" fill="none" stroke={accent} strokeWidth="3.2" strokeLinecap="round" />
      );
      break;
    case 'cable_cobre_desnudo':
      content = (
        <g>
          <path d="M 16 48 Q 33 32, 50 48 T 84 48" fill="none" stroke="#B45309" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M 16 53 Q 33 37, 50 53 T 84 53" fill="none" stroke="#B45309" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        </g>
      );
      break;
    case 'bandeja':
      content = (
        <g>
          <line x1="16" y1="34" x2="84" y2="34" stroke={stroke} strokeWidth="1.8" />
          <line x1="16" y1="66" x2="84" y2="66" stroke={stroke} strokeWidth="1.8" />
          {[25, 38, 51, 64, 77].map((x) => <line key={x} x1={x} y1="34" x2={x} y2="66" stroke={stroke} strokeWidth="1.2" />)}
        </g>
      );
      break;
    case 'tuberia_poliamida':
      content = (
        <line x1="16" y1="50" x2="84" y2="50" stroke={stroke} strokeWidth="7" strokeDasharray="3.5 3.5" strokeLinecap="round" />
      );
      break;
    case 'tuberia_pvc':
      content = (
        <rect x="16" y="43" width="68" height="14" rx="7" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
      );
      break;
    case 'shelter':
      content = (
        <g>
          <rect x="26" y="46" width="48" height="32" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />
          <polygon points="21,46 79,46 50,26" fill="#EAF1FF" stroke={stroke} strokeWidth="1.4" />
          <rect x="44" y="60" width="12" height="18" fill="none" stroke={stroke} strokeWidth="1.2" />
        </g>
      );
      break;
    default:
      content = <rect x="30" y="30" width="40" height="40" fill="#F6F7F9" stroke={stroke} strokeWidth="1.4" />;
  }
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {content}
    </svg>
  );
}

/* Formulario genérico: funciona para CUALQUIER tipo de equipo a partir de   */
/* su lista de "campos" (todos son texto libre — no hay cálculos aquí). La   */
/* imagen se guarda como data URL (base64) directamente en "datos.imagen";   */
/* si no se sube ninguna, se muestra el ícono genérico del tipo.             */
