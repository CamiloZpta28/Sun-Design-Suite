/* ============================================================================
   DISEÑO DE VÍA — espesor de capas por el método AASHTO 93
   ----------------------------------------------------------------------------
   Traduce la hoja de cálculo "Diseño con 2 Capas" que el equipo ya usaba. Aquí
   vive solo el cálculo, sin nada de interfaz, porque es lo que hay que poder
   comprobar contra los dos ejemplos resueltos que traía el archivo: si estas
   funciones no reproducen esos números, la herramienta está mal por más bonita
   que se vea.

   La cadena es:

     ejes del vehículo  ->  factor camión
     factor camión + tránsito  ->  W18 (ejes equivalentes del periodo)
     estaciones de lluvia  ->  % del tiempo cerca de saturación  ->  m
     CBR de cada material  ->  módulo resiliente  ->  coeficiente estructural a
     W18 + módulo  ->  número estructural SN (se resuelve, ver resolverSN)
     SN + a + m  ->  espesor de cada capa

   Tres decisiones que vienen del equipo, no del método, y que conviene tener
   presentes al leer:

   1. El espesor de la segunda capa sale de SN3 —el de la subrasante—, no de
      SN2. SN2 se calcula y se muestra como referencia, pero no entra en
      ningún espesor. Así estaba en la hoja y así se conserva.

   2. El eje doble no existe aquí. La hoja lo traía con la misma referencia
      que el eje simple (6.66) y en cero en todos sus ejemplos, así que nunca
      se ejecutó esa cuenta; se quitó en vez de dejar una trampa.

   3. Zr sale de R por tabla, no se escribe a mano. En la hoja eran dos
      celdas sueltas, y nada impedía dejar R en 90% con Zr en 0 —que da un
      diseño inseguro sin avisar—.
   ============================================================================ */

/* Los cuatro materiales INVÍAS con su CBR mínimo de norma y el tipo de
   comportamiento, que es lo que decide con cuál fórmula sale su coeficiente
   estructural. Van fijos: son valores de norma, no preferencias del equipo. */
export const MATERIALES = [
  { id: 'base', nombre: 'Base INVÍAS 330', cbrMinimo: 0.8, comportamiento: 'Base' },
  { id: 'subbase', nombre: 'SubBase INVÍAS 320', cbrMinimo: 0.3, comportamiento: 'SubBase' },
  { id: 'afirmado', nombre: 'Afirmado INVÍAS 311', cbrMinimo: 0.15, comportamiento: 'Afirmado' },
  { id: 'terraplen', nombre: 'Terraplen INVÍAS 220', cbrMinimo: 0.1, comportamiento: 'Terraplen' },
];

export function materialPorId(id) {
  return MATERIALES.find((m) => m.id === id) || null;
}

/* Los ejes del vehículo de diseño, cada uno con el peso de referencia con que
   se convierte a ejes equivalentes. */
export const TIPOS_EJE = [
  { id: 'simple', label: 'Eje simple', referencia: 6.66 },
  { id: 'tandem', label: 'Eje tándem', referencia: 15 },
  { id: 'tridem', label: 'Eje trídem', referencia: 23 },
];

/* El vehículo de diseño del equipo es un 3S2: un eje simple de 7 t y dos
   tándem de 20 t. Es el punto de partida de una vía nueva. */
export function ejesPorDefecto() {
  return [
    { tipo: 'simple', cantidad: 1, peso: 7 },
    { tipo: 'tandem', cantidad: 2, peso: 20 },
    { tipo: 'tridem', cantidad: 0, peso: 0 },
  ];
}

/* Fractil de la distribución normal para cada nivel de confiabilidad. Es la
   tabla del método; R al 50% da Zr = 0, que es el caso sin margen. */
export const NIVELES_CONFIABILIDAD = [
  { r: 0.5, zr: 0 },
  { r: 0.6, zr: -0.253 },
  { r: 0.7, zr: -0.524 },
  { r: 0.75, zr: -0.674 },
  { r: 0.8, zr: -0.841 },
  { r: 0.85, zr: -1.037 },
  { r: 0.9, zr: -1.282 },
  { r: 0.91, zr: -1.34 },
  { r: 0.92, zr: -1.405 },
  { r: 0.93, zr: -1.476 },
  { r: 0.94, zr: -1.555 },
  { r: 0.95, zr: -1.645 },
  { r: 0.96, zr: -1.751 },
  { r: 0.97, zr: -1.881 },
  { r: 0.98, zr: -2.054 },
  { r: 0.99, zr: -2.327 },
  { r: 0.999, zr: -3.09 },
];

export function zrDeConfiabilidad(r) {
  const fila = NIVELES_CONFIABILIDAD.find((n) => Math.abs(n.r - r) < 1e-9);
  return fila ? fila.zr : null;
}

/* --------------------------------------------------------- factor camión */

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/* Cada eje aporta (peso/referencia)^4 por cada vez que aparece. Un eje en
   cero no aporta nada, así que las filas vacías no estorban. */
export function factorCamion(ejes) {
  return (ejes || []).reduce((total, eje) => {
    const tipo = TIPOS_EJE.find((t) => t.id === eje.tipo);
    if (!tipo) return total;
    const cantidad = num(eje.cantidad);
    const peso = num(eje.peso);
    if (cantidad === 0 || peso === 0) return total;
    return total + cantidad * Math.pow(peso / tipo.referencia, 4);
  }, 0);
}

export function pesoTotalVehiculo(ejes) {
  return (ejes || []).reduce((t, e) => t + num(e.cantidad) * num(e.peso), 0);
}

/* ------------------------------------------------------------------ W18 */

/* Ejes equivalentes acumulados en el periodo de diseño. La tasa de
   crecimiento entra por la integral del crecimiento continuo, que es lo que
   traía la hoja; con r = 0 esa división se indefine, así que ese caso se
   resuelve aparte con el crecimiento lineal que le corresponde. */
export function ejesEquivalentes({ tpd, tasa, periodo, direccional, comerciales, factorCamion: fc }) {
  const r = num(tasa);
  const n = num(periodo);
  const crecimiento = r === 0 ? n : (Math.pow(1 + r, n) - 1) / Math.log(1 + r);
  return num(tpd) * num(direccional) * num(comerciales) * (365 * crecimiento * num(fc));
}

/* ------------------------------------------------- pluviometría y drenaje */

/* Cuántas filas de estaciones se piden. Es el mismo número que guarda la
   pestaña Hidráulico de un proyecto, para que importarlas sea directo. */
export const FILAS_ESTACION = 7;

export function estacionesVacias() {
  return Array.from({ length: FILAS_ESTACION }, () => ({ nombre: '', dias: '', peso: '' }));
}

/* El promedio ponderado de días de lluvia al año, sobre 365: el porcentaje
   del tiempo que la estructura pasa cerca de la saturación. */
export function porcentajeSaturacion(estaciones) {
  const suma = (estaciones || []).reduce((t, e) => t + num(e.dias) * num(e.peso), 0);
  return suma / 365;
}

export function sumaDePesos(estaciones) {
  return (estaciones || []).reduce((t, e) => t + num(e.peso), 0);
}

/* Los pesos son una repartición: si no suman 1, el promedio ponderado no
   significa lo que dice significar. No se corrige solo —quién pesa más es
   decisión del diseñador— pero se avisa. */
export function pesosCuadran(estaciones) {
  const suma = sumaDePesos(estaciones);
  return Math.abs(suma - 1) < 1e-6;
}

/* La tabla de coeficientes de drenaje del método: por cada calidad, cómo cae
   el coeficiente a medida que el pavimento pasa más tiempo saturado. Cada
   tramo interpola linealmente entre sus dos extremos.

   Nota sobre "Regular": su segundo tramo termina en 1.05 y el tercero arranca
   en 1.00, así que el coeficiente da un salto al pasar del 5%. Está así en la
   tabla impresa del método y así lo traía la hoja; se conserva. */
export const CALIDADES_DRENAJE = [
  { id: 'excelente', label: 'Excelente', tramos: [[1.4, 1.35], [1.35, 1.3], [1.3, 1.2]], sobre25: 1.2 },
  { id: 'bueno', label: 'Bueno', tramos: [[1.35, 1.25], [1.25, 1.15], [1.15, 1.0]], sobre25: 1.0 },
  { id: 'regular', label: 'Regular', tramos: [[1.25, 1.15], [1.15, 1.05], [1.0, 0.8]], sobre25: 0.8 },
  { id: 'pobre', label: 'Pobre', tramos: [[1.15, 1.05], [1.05, 0.8], [0.8, 0.6]], sobre25: 0.6 },
  { id: 'muy_malo', label: 'Muy malo', tramos: [[1.05, 0.95], [0.95, 0.75], [0.75, 0.4]], sobre25: 0.4 },
];

const LIMITES_TRAMO = [[0, 0.01], [0.01, 0.05], [0.05, 0.25]];

export function coeficienteDrenaje(calidadId, porcentaje) {
  const calidad = CALIDADES_DRENAJE.find((c) => c.id === calidadId);
  if (!calidad) return null;
  const p = num(porcentaje);
  if (p > 0.25) return calidad.sobre25;
  const i = p < 0.01 ? 0 : p <= 0.05 ? 1 : 2;
  const [desde, hasta] = LIMITES_TRAMO[i];
  const [inicio, fin] = calidad.tramos[i];
  return inicio - ((p - desde) / (hasta - desde)) * (inicio - fin);
}

/* --------------------------------------------- módulos y coeficientes "a" */

/* Módulo resiliente de la subrasante, en psi, a partir de su CBR. La ecuación
   de Heukelom y Klomp; el CBR entra como fracción (0.07 = 7%). */
export function modResilienteSubrasante(cbr) {
  return 1500 * num(cbr) * 100;
}

/* Módulo resiliente de un material granular, en psi, desde su CBR mínimo.
   Por debajo del 10% se usa la primera correlación y por encima la segunda;
   las dos vienen convertidas a psi con el factor 145.038. */
export function modResilienteMaterial(cbr) {
  const c = num(cbr);
  const pct = c * 100;
  return c <= 0.1
    ? 17.6 * 145.038 * Math.pow(pct, 0.64)
    : 22.1 * Math.pow(pct, 0.55) * 145.038;
}

/* Coeficiente estructural. Una base se comporta distinto de todo lo demás, y
   el resultado se acota entre 0.06 y 0.20: fuera de ahí la correlación deja
   de tener respaldo. */
export function coeficienteEstructural(comportamiento, mr) {
  const log = Math.log10(num(mr));
  const bruto = comportamiento === 'Base' ? 0.249 * log - 0.977 : 0.227 * log - 0.839;
  return Math.max(0.06, Math.min(0.2, bruto));
}

/* ---------------------------------------------------- número estructural */

/* El lado izquierdo de la ecuación AASHTO 93 para un SN dado. Diseñar es
   encontrar el SN que hace que esto valga log10(W18). */
export function ecuacionAashto(sn, { zr, so, deltaPsi, mr }) {
  return num(zr) * num(so)
    + 9.36 * Math.log10(sn + 1)
    - 0.2
    + Math.log10(num(deltaPsi) / 2.7) / (0.4 + 1094 / Math.pow(sn + 1, 5.19))
    + 2.32 * Math.log10(num(mr))
    - 8.07;
}

/* El SN que resuelve la ecuación. En la hoja esto se hacía con "Buscar
   objetivo" y quedaba escrito a mano, con lo que un archivo guardado a medio
   converger daba espesores que nadie volvía a revisar.

   Se resuelve por bisección y no por Newton: la ecuación es monótona
   creciente en SN dentro del rango con sentido físico, así que bisecar no
   puede divergir ni depende de un punto de partida. 200 pasos sobre [0, 20]
   dejan un error muy por debajo de lo que significa un milímetro de
   espesor. */
export function resolverSN({ w18, zr, so, deltaPsi, mr }) {
  const objetivo = Math.log10(num(w18));
  if (!Number.isFinite(objetivo) || num(mr) <= 0 || num(deltaPsi) <= 0) return null;
  let lo = 0;
  let hi = 20;
  /* Si ni con SN = 20 se alcanza el tránsito pedido, no hay solución dentro
     de lo que un pavimento puede ser: se dice, en vez de devolver 20. */
  if (ecuacionAashto(hi, { zr, so, deltaPsi, mr }) < objetivo) return null;
  for (let i = 0; i < 200; i += 1) {
    const medio = (lo + hi) / 2;
    if (ecuacionAashto(medio, { zr, so, deltaPsi, mr }) < objetivo) lo = medio;
    else hi = medio;
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------- espesores */

export const CM_POR_PULGADA = 2.54;

export const cmAPulgadas = (cm) => num(cm) / CM_POR_PULGADA;
export const pulgadasACm = (pulg) => num(pulg) * CM_POR_PULGADA;

/* ------------------------------------------------------- el cálculo entero */

export function entradasPorDefecto() {
  return {
    nombre: '',
    ejes: ejesPorDefecto(),
    /* Tránsito. El TPD del equipo suele ser una fracción —un camión cada
       tantos días— porque son vías de minigranja, no carreteras. */
    tpd: 0.033,
    tasa: 0.01,
    periodo: 10,
    direccional: 1,
    comerciales: 1,
    estaciones: estacionesVacias(),
    calidadDrenaje: 'bueno',
    materialCapa1: 'afirmado',
    materialCapa2: 'subbase',
    confiabilidad: 0.5,
    errorEstandar: 0.45,
    servInicial: 4.2,
    servFinal: 2,
    cbrSubrasante: 0.07,
    espesorCapa1: 5,
    espesorCapa2: 10,
  };
}

/* Todo el diseño, de las entradas a los espesores. Devuelve también los pasos
   intermedios: en una memoria de cálculo hay que poder mostrar de dónde salió
   cada número, y cuando Supervisión pregunta, la respuesta no puede ser "lo
   dijo la aplicación". */
export function calcularDiseno(entradas) {
  const e = { ...entradasPorDefecto(), ...(entradas || {}) };

  const fc = factorCamion(e.ejes);
  const w18 = ejesEquivalentes({
    tpd: e.tpd, tasa: e.tasa, periodo: e.periodo,
    direccional: e.direccional, comerciales: e.comerciales, factorCamion: fc,
  });

  const saturacion = porcentajeSaturacion(e.estaciones);
  const m = coeficienteDrenaje(e.calidadDrenaje, saturacion);

  const capa1 = materialPorId(e.materialCapa1);
  const capa2 = materialPorId(e.materialCapa2);
  const zr = zrDeConfiabilidad(e.confiabilidad);
  const deltaPsi = num(e.servInicial) - num(e.servFinal);

  const mrSubrasante = modResilienteSubrasante(e.cbrSubrasante);
  const mrCapa1 = capa1 ? modResilienteMaterial(capa1.cbrMinimo) : null;
  const mrCapa2 = capa2 ? modResilienteMaterial(capa2.cbrMinimo) : null;

  const a1 = capa1 ? coeficienteEstructural(capa1.comportamiento, mrCapa1) : null;
  const a2 = capa2 ? coeficienteEstructural(capa2.comportamiento, mrCapa2) : null;

  const comun = { w18, zr, so: e.errorEstandar, deltaPsi };
  const sn1 = mrCapa1 ? resolverSN({ ...comun, mr: mrCapa1 }) : null;
  const sn2 = mrCapa2 ? resolverSN({ ...comun, mr: mrCapa2 }) : null;
  const sn3 = resolverSN({ ...comun, mr: mrSubrasante });

  /* Espesor mínimo de cada capa, en pulgadas, y el que el diseñador escogió.
     El escogido casi nunca es el calculado: se redondea a un valor que se
     pueda construir, y por eso la comprobación de abajo es la que manda. */
  const listo = !!(sn1 !== null && sn3 !== null && a1 && a2 && m);
  const h1Calculado = listo ? sn1 / (a1 * m) : null;
  const h1Escogido = cmAPulgadas(e.espesorCapa1);
  const sn1Ajustado = listo ? h1Escogido * a1 * m : null;

  const h2Calculado = listo ? (sn3 - (h1Calculado * a1 * m)) / (a2 * m) : null;
  const h2Escogido = cmAPulgadas(e.espesorCapa2);
  const sn2Ajustado = listo ? h2Escogido * a2 * m : null;

  const snTotal = listo ? sn1Ajustado + sn2Ajustado : null;
  const cumple = listo ? snTotal >= sn3 : null;

  return {
    factorCamion: fc,
    pesoTotal: pesoTotalVehiculo(e.ejes),
    w18,
    saturacion,
    sumaPesos: sumaDePesos(e.estaciones),
    pesosCuadran: pesosCuadran(e.estaciones),
    m,
    capa1,
    capa2,
    zr,
    deltaPsi,
    mrSubrasante,
    mrCapa1,
    mrCapa2,
    a1,
    a2,
    sn1,
    sn2,
    sn3,
    h1Calculado,
    h1CalculadoCm: h1Calculado === null ? null : pulgadasACm(h1Calculado),
    h1Escogido,
    sn1Ajustado,
    h2Calculado,
    h2CalculadoCm: h2Calculado === null ? null : pulgadasACm(h2Calculado),
    h2Escogido,
    sn2Ajustado,
    snTotal,
    cumple,
    listo,
  };
}

/* --------------------------------------------------------------- resumen */

const redondo = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));

/* El diseño en texto plano, para pegarlo en la memoria de cálculo o en el
   chat. Mismo formato de viñetas que el resto de la aplicación. */
export function textoDelDiseno(entradas, resultado) {
  const r = resultado || calcularDiseno(entradas);
  const e = { ...entradasPorDefecto(), ...(entradas || {}) };
  const partes = [`Diseño de vía${e.nombre ? ` · ${e.nombre}` : ''}`];

  partes.push('', 'Tránsito');
  partes.push(`-Factor camión: ${redondo(r.factorCamion, 3)}`);
  partes.push(`-Ejes equivalentes (W18): ${redondo(r.w18, 0)}`);
  partes.push(`-Periodo de diseño: ${e.periodo} años`);

  partes.push('', 'Drenaje');
  partes.push(`-Tiempo cerca de saturación: ${redondo(r.saturacion * 100, 1)}%`);
  partes.push(`-Coeficiente de drenaje (m): ${redondo(r.m, 3)}`);

  partes.push('', 'Materiales');
  partes.push(`-Capa 1 (rodadura): ${r.capa1 ? r.capa1.nombre : '—'}, a1 = ${redondo(r.a1, 3)}`);
  partes.push(`-Capa 2: ${r.capa2 ? r.capa2.nombre : '—'}, a2 = ${redondo(r.a2, 3)}`);
  partes.push(`-CBR sumergido de la subrasante: ${redondo(num(e.cbrSubrasante) * 100, 1)}%`);

  partes.push('', 'Números estructurales');
  partes.push(`-SN1: ${redondo(r.sn1, 3)}`);
  partes.push(`-SN3 (objetivo): ${redondo(r.sn3, 3)}`);

  partes.push('', 'Espesores');
  partes.push(`-Capa 1: ${e.espesorCapa1} cm (mínimo ${redondo(r.h1CalculadoCm, 1)} cm)`);
  partes.push(`-Capa 2: ${e.espesorCapa2} cm (mínimo ${redondo(r.h2CalculadoCm, 1)} cm)`);
  partes.push(`-Suma de SN aportados: ${redondo(r.snTotal, 3)} contra ${redondo(r.sn3, 3)} requeridos`);
  partes.push(`-${r.cumple ? 'Cumple' : 'No cumple'}`);

  return partes.join('\n');
}

/* ------------------------------------------------- lo que se ve y lo que se guarda */

/* En pantalla los porcentajes se escriben como porcentajes —7, no 0.07— y el
   cálculo los quiere en fracción. La conversión vive aquí y en un solo sitio,
   porque es justo el tipo de cosa que, repartida por la interfaz, termina
   aplicándose dos veces en un campo y ninguna en otro.

   El peso de las estaciones se queda en porcentaje a propósito: es como lo
   guarda la pestaña Hidráulico de un proyecto, así que traerlas es copiar sin
   traducir. */
export function formularioPorDefecto() {
  const e = entradasPorDefecto();
  return {
    nombre: '',
    ejes: e.ejes,
    tpd: e.tpd,
    tasaPct: 1,
    periodo: e.periodo,
    direccionalPct: 100,
    comercialesPct: 100,
    estaciones: estacionesVacias(),
    calidadDrenaje: e.calidadDrenaje,
    materialCapa1: e.materialCapa1,
    materialCapa2: e.materialCapa2,
    confiabilidadPct: 50,
    errorEstandar: e.errorEstandar,
    servInicial: e.servInicial,
    servFinal: e.servFinal,
    cbrSubrasantePct: 7,
    espesorCapa1: e.espesorCapa1,
    espesorCapa2: e.espesorCapa2,
  };
}

export function desdeFormulario(form) {
  const f = { ...formularioPorDefecto(), ...(form || {}) };
  return {
    ...f,
    tasa: num(f.tasaPct) / 100,
    direccional: num(f.direccionalPct) / 100,
    comerciales: num(f.comercialesPct) / 100,
    confiabilidad: num(f.confiabilidadPct) / 100,
    cbrSubrasante: num(f.cbrSubrasantePct) / 100,
    estaciones: (f.estaciones || []).map((e) => ({ ...e, peso: num(e.peso) / 100 })),
  };
}

/* Calcular directamente desde lo que hay en pantalla. */
export function calcularDesdeFormulario(form) {
  return calcularDiseno(desdeFormulario(form));
}

/* Lo que se puede traer de un proyecto: las estaciones de la pestaña
   Hidráulico y el CBR sumergido de Geotecnia. Se devuelve solo lo que el
   proyecto tenga de verdad, para no pisar con vacíos lo que ya se escribió. */
export function datosDelProyecto(project) {
  const data = (project && project.data) || {};
  const estaciones = (data.hidraulico || {}).estaciones_pluviometricas;
  const cbr = (data.geotecnia || {}).cbr_sumergido;
  const traidos = {};
  if (Array.isArray(estaciones) && estaciones.some((e) => e && (e.nombre || e.dias || e.peso))) {
    traidos.estaciones = estaciones.map((e) => ({
      nombre: e.nombre || '', dias: e.dias || '', peso: e.peso || '',
    }));
  }
  const cbrNum = parseFloat(String(cbr ?? '').replace(',', '.'));
  if (Number.isFinite(cbrNum) && cbrNum > 0) traidos.cbrSubrasantePct = cbrNum;
  return traidos;
}
