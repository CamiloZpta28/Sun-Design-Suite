/* ============================================================================
   DISEÑO DE VÍA — contra los dos ejemplos resueltos de la hoja de cálculo.
   ----------------------------------------------------------------------------
   El archivo que trajo el equipo traía dos diseños ya hechos, con números
   distintos en casi todo: materiales, CBR y estaciones de lluvia. Reproducir
   los dos de punta a punta es la única prueba que de verdad dice que la
   traducción quedó bien; lo demás son casos de borde alrededor.

   Los SN del Excel salieron de "Buscar objetivo", que se detiene con su propia
   tolerancia, así que contra ellos se compara con holgura de 1e-3. Todo lo que
   es cuenta cerrada —factor camión, W18, módulos, coeficientes— se compara
   estrecho, porque ahí no hay excusa para diferir.
   ============================================================================ */

import { describe, it, expect } from 'vitest';
import {
  MATERIALES, TIPOS_EJE, CALIDADES_DRENAJE, NIVELES_CONFIABILIDAD,
  factorCamion, ejesEquivalentes, porcentajeSaturacion, pesosCuadran, sumaDePesos,
  coeficienteDrenaje, modResilienteSubrasante, modResilienteMaterial,
  coeficienteEstructural, resolverSN, ecuacionAashto, zrDeConfiabilidad,
  calcularDiseno, entradasPorDefecto, textoDelDiseno, materialPorId,
  cmAPulgadas, pulgadasACm, estacionesVacias, FILAS_ESTACION,
  formularioPorDefecto, desdeFormulario, calcularDesdeFormulario, datosDelProyecto,
} from './disenoVia.js';

const cerca = (valor, esperado, tol = 1e-9) => expect(Math.abs(valor - esperado)).toBeLessThan(tol);

/* Los dos diseños tal como están en la hoja, con el resultado que dio Excel. */
const EJEMPLO_1 = {
  entradas: {
    ejes: [
      { tipo: 'simple', cantidad: 1, peso: 7 },
      { tipo: 'tandem', cantidad: 2, peso: 20 },
      { tipo: 'tridem', cantidad: 0, peso: 0 },
    ],
    tpd: 1 / 30, tasa: 0.01, periodo: 10, direccional: 1, comerciales: 1,
    estaciones: [
      { nombre: 'El Descanso', dias: 39.5, peso: 0.6 },
      { nombre: 'Manaure', dias: 142.52, peso: 0.05 },
      { nombre: 'Villa Carmelita', dias: 65.2, peso: 0.15 },
      { nombre: 'Paris De Francia', dias: 60.44, peso: 0.14 },
      { nombre: 'San Angel', dias: 41.13, peso: 0.06 },
    ],
    calidadDrenaje: 'bueno',
    materialCapa1: 'afirmado', materialCapa2: 'subbase',
    confiabilidad: 0.5, errorEstandar: 0.45, servInicial: 4.2, servFinal: 2,
    cbrSubrasante: 0.07,
    espesorCapa1: 5, espesorCapa2: 10,
  },
  excel: {
    factorCamion: 7.541368108736224,
    w18: 964.7344048681031,
    saturacion: 0.14119287671232875,
    m: 1.0816053424657535,
    mrSubrasante: 10500.000000000002,
    mrCapa1: 14214.26044259558,
    mrCapa2: 20810.895392449926,
    a1: 0.10366840897111373,
    a2: 0.14125200392976167,
    sn1: 0.48987820048359365,
    sn2: 0.35543756269480997,
    sn3: 0.6062917755109238,
    h1Calculado: 4.368907570088262,
    h1CalculadoCm: 11.097025228024187,
    sn1Ajustado: 0.22072500981905763,
    h2Calculado: 0.7619740566241293,
    h2CalculadoCm: 1.9354141038252886,
    sn2Ajustado: 0.6014918192300152,
    snTotal: 0.8222168290490728,
    cumple: true,
  },
};

const EJEMPLO_2 = {
  entradas: {
    ...EJEMPLO_1.entradas,
    estaciones: [
      { nombre: 'PUERTO MOSQUITO', dias: 42.29, peso: 0.03 },
      { nombre: 'VEGA LA', dias: 69.94, peso: 0.023 },
      { nombre: 'TOTUMAL', dias: 87.17, peso: 0.029 },
      { nombre: 'GAMARRA', dias: 91.96, peso: 0.888 },
      { nombre: 'AGUAS CLARAS', dias: 102, peso: 0.03 },
    ],
    materialCapa1: 'base',
    cbrSubrasante: 0.05,
  },
  excel: {
    factorCamion: 7.541368108736224,
    w18: 964.7344048681031,
    saturacion: 0.24691980821917806,
    m: 1.0023101438356166,
    mrSubrasante: 7500,
    mrCapa1: 35692.220635288504,
    mrCapa2: 20810.895392449926,
    a1: 0.1565908186710795,
    a2: 0.14125200392976167,
    sn1: 0.18577088972966652,
    sn3: 0.7459695880777213,
    h1Calculado: 1.1836116763250222,
    h1CalculadoCm: 3.006373657865556,
    sn1Ajustado: 0.3089617440660367,
    h2Calculado: 3.956811414967358,
    h2CalculadoCm: 10.050300994017089,
    sn2Ajustado: 0.5573949463618445,
    snTotal: 0.8663566904278812,
    cumple: true,
  },
};

describe.each([
  ['ejemplo 1 (Afirmado sobre SubBase, CBR 7%)', EJEMPLO_1],
  ['ejemplo 2 (Base sobre SubBase, CBR 5%)', EJEMPLO_2],
])('%s', (_nombre, caso) => {
  const r = calcularDiseno(caso.entradas);
  const x = caso.excel;

  it('reproduce el factor camión y los ejes equivalentes', () => {
    cerca(r.factorCamion, x.factorCamion);
    cerca(r.w18, x.w18, 1e-9);
  });

  it('reproduce el porcentaje de saturación y el coeficiente de drenaje', () => {
    cerca(r.saturacion, x.saturacion);
    cerca(r.m, x.m);
  });

  it('reproduce los módulos resilientes', () => {
    cerca(r.mrSubrasante, x.mrSubrasante, 1e-8);
    cerca(r.mrCapa1, x.mrCapa1, 1e-8);
    cerca(r.mrCapa2, x.mrCapa2, 1e-8);
  });

  it('reproduce los coeficientes estructurales', () => {
    cerca(r.a1, x.a1, 1e-12);
    cerca(r.a2, x.a2, 1e-12);
  });

  /* Aquí la holgura es de 1e-3: el Excel llegó a estos SN con "Buscar
     objetivo", que se conforma antes que la bisección. */
  it('reproduce los números estructurales', () => {
    cerca(r.sn1, x.sn1, 1e-3);
    cerca(r.sn3, x.sn3, 1e-3);
  });

  it('reproduce los espesores mínimos y los SN aportados', () => {
    cerca(r.h1Calculado, x.h1Calculado, 1e-3);
    cerca(r.h1CalculadoCm, x.h1CalculadoCm, 1e-3);
    cerca(r.sn1Ajustado, x.sn1Ajustado, 1e-9);
    /* El de la capa 2 arrastra el error de DOS de los SN del Excel, y encima
       dividido por a2*m (~0.15), que lo multiplica por seis. 5e-3 pulgadas son
       trece milésimas de centímetro: por debajo de lo que se puede construir. */
    cerca(r.h2Calculado, x.h2Calculado, 5e-3);
    cerca(r.h2CalculadoCm, x.h2CalculadoCm, 1.3e-2);
    cerca(r.sn2Ajustado, x.sn2Ajustado, 1e-9);
  });

  it('llega al mismo veredicto', () => {
    cerca(r.snTotal, x.snTotal, 1e-9);
    expect(r.cumple).toBe(x.cumple);
    expect(r.listo).toBe(true);
  });
});

describe('SN2, que se calcula pero no se usa', () => {
  /* Se conserva como referencia porque así estaba la hoja; si algún día
     entra en el espesor de la capa 2, esta prueba lo delata. */
  it('se calcula y coincide con el Excel', () => {
    const r = calcularDiseno(EJEMPLO_1.entradas);
    cerca(r.sn2, EJEMPLO_1.excel.sn2, 1e-3);
  });

  it('el espesor de la capa 2 sale de SN3, no de SN2', () => {
    const r = calcularDiseno(EJEMPLO_1.entradas);
    cerca(r.h2Calculado, (r.sn3 - r.sn1) / (r.a2 * r.m), 1e-9);
  });
});

describe('factor camión', () => {
  it('cada eje aporta la cuarta potencia de su peso relativo', () => {
    cerca(factorCamion([{ tipo: 'simple', cantidad: 1, peso: 6.66 }]), 1);
    cerca(factorCamion([{ tipo: 'tandem', cantidad: 1, peso: 15 }]), 1);
    cerca(factorCamion([{ tipo: 'tridem', cantidad: 1, peso: 23 }]), 1);
  });

  it('un eje en cero no aporta nada', () => {
    expect(factorCamion([{ tipo: 'simple', cantidad: 0, peso: 20 }])).toBe(0);
    expect(factorCamion([{ tipo: 'simple', cantidad: 2, peso: 0 }])).toBe(0);
  });

  it('aguanta filas vacías y tipos que no existen', () => {
    expect(factorCamion([])).toBe(0);
    expect(factorCamion(null)).toBe(0);
    expect(factorCamion([{ tipo: 'inventado', cantidad: 1, peso: 10 }])).toBe(0);
  });

  it('lee números escritos como texto, con coma o con punto', () => {
    cerca(factorCamion([{ tipo: 'simple', cantidad: '1', peso: '6,66' }]), 1);
  });

  /* El eje doble se quitó: la hoja lo traía con la misma referencia que el
     simple y siempre en cero, así que esa cuenta nunca se ejecutó. */
  it('no existe el eje doble', () => {
    expect(TIPOS_EJE.map((t) => t.id)).toEqual(['simple', 'tandem', 'tridem']);
  });
});

describe('ejes equivalentes', () => {
  it('sin tránsito no hay ejes equivalentes', () => {
    expect(ejesEquivalentes({ tpd: 0, tasa: 0.01, periodo: 10, direccional: 1, comerciales: 1, factorCamion: 7 })).toBe(0);
  });

  /* Con tasa cero la fórmula del Excel divide por ln(1) = 0. El crecimiento
     que corresponde ahí es el lineal: n años iguales. */
  it('con tasa de crecimiento cero no se indefine', () => {
    const w = ejesEquivalentes({ tpd: 1, tasa: 0, periodo: 10, direccional: 1, comerciales: 1, factorCamion: 1 });
    cerca(w, 365 * 10);
  });

  it('el factor direccional y el de comerciales recortan proporcionalmente', () => {
    const base = { tpd: 1, tasa: 0.01, periodo: 10, factorCamion: 1 };
    const entero = ejesEquivalentes({ ...base, direccional: 1, comerciales: 1 });
    const mitad = ejesEquivalentes({ ...base, direccional: 0.5, comerciales: 1 });
    cerca(mitad, entero / 2, 1e-9);
  });
});

describe('pluviometría', () => {
  it('promedia los días de lluvia ponderados sobre 365', () => {
    cerca(porcentajeSaturacion([{ dias: 365, peso: 1 }]), 1);
    cerca(porcentajeSaturacion([{ dias: 365, peso: 0.5 }, { dias: 0, peso: 0.5 }]), 0.5);
  });

  it('las filas vacías no estorban', () => {
    const con = [...EJEMPLO_1.entradas.estaciones, { nombre: '', dias: '', peso: '' }, { nombre: '', dias: '', peso: '' }];
    cerca(porcentajeSaturacion(con), EJEMPLO_1.excel.saturacion);
  });

  /* Los pesos son una repartición: si no suman 1, el promedio ponderado no
     significa lo que dice. No se corrige, se avisa. */
  it('avisa cuando los pesos no suman 1', () => {
    expect(pesosCuadran(EJEMPLO_1.entradas.estaciones)).toBe(true);
    expect(pesosCuadran([{ dias: 10, peso: 0.5 }])).toBe(false);
    cerca(sumaDePesos([{ peso: 0.3 }, { peso: 0.2 }]), 0.5, 1e-12);
  });

  it('la tabla tiene las mismas siete filas que guarda un proyecto', () => {
    expect(FILAS_ESTACION).toBe(7);
    expect(estacionesVacias()).toHaveLength(7);
  });
});

describe('coeficiente de drenaje', () => {
  it('reproduce los extremos de la tabla', () => {
    cerca(coeficienteDrenaje('excelente', 0), 1.4);
    cerca(coeficienteDrenaje('bueno', 0), 1.35);
    cerca(coeficienteDrenaje('muy_malo', 0), 1.05);
  });

  it('por encima del 25% se queda en el valor de piso', () => {
    CALIDADES_DRENAJE.forEach((c) => {
      cerca(coeficienteDrenaje(c.id, 0.3), c.sobre25);
      cerca(coeficienteDrenaje(c.id, 0.99), c.sobre25);
    });
  });

  it('interpola dentro de cada tramo', () => {
    /* Justo en el 25% termina el tercer tramo, así que vale su extremo. */
    cerca(coeficienteDrenaje('bueno', 0.25), 1.0, 1e-12);
    cerca(coeficienteDrenaje('bueno', 0.05), 1.15, 1e-12);
    cerca(coeficienteDrenaje('bueno', 0.15), 1.075, 1e-12);
  });

  it('una calidad que no existe no devuelve un número cualquiera', () => {
    expect(coeficienteDrenaje('inventada', 0.1)).toBe(null);
  });
});

describe('módulos y coeficientes estructurales', () => {
  it('la subrasante sale de su CBR', () => {
    cerca(modResilienteSubrasante(0.07), 10500, 1e-8);
  });

  /* Por debajo del 10% de CBR se usa una correlación y por encima otra. */
  it('el material cambia de correlación en el 10%', () => {
    cerca(modResilienteMaterial(0.1), 17.6 * 145.038 * Math.pow(10, 0.64), 1e-8);
    cerca(modResilienteMaterial(0.3), 22.1 * Math.pow(30, 0.55) * 145.038, 1e-8);
  });

  it('una base se comporta distinto de todo lo demás', () => {
    const mr = 30000;
    expect(coeficienteEstructural('Base', mr)).not.toBe(coeficienteEstructural('SubBase', mr));
  });

  /* Fuera de [0.06, 0.20] la correlación deja de tener respaldo. */
  it('el coeficiente queda acotado por arriba y por abajo', () => {
    expect(coeficienteEstructural('Base', 10 ** 9)).toBe(0.2);
    expect(coeficienteEstructural('SubBase', 100)).toBe(0.06);
  });

  it('los cuatro materiales traen su CBR de norma', () => {
    expect(MATERIALES.map((m) => [m.id, m.cbrMinimo])).toEqual([
      ['base', 0.8], ['subbase', 0.3], ['afirmado', 0.15], ['terraplen', 0.1],
    ]);
    expect(materialPorId('afirmado').comportamiento).toBe('Afirmado');
    expect(materialPorId('no_existe')).toBe(null);
  });
});

describe('resolver el número estructural', () => {
  /* Es la cuenta que en el Excel se hacía a mano con "Buscar objetivo". */
  it('el SN encontrado satisface la ecuación', () => {
    const datos = { w18: 964.7344, zr: 0, so: 0.45, deltaPsi: 2.2, mr: 14214.26 };
    const sn = resolverSN(datos);
    cerca(ecuacionAashto(sn, datos), Math.log10(datos.w18), 1e-9);
  });

  it('más tránsito pide más número estructural', () => {
    const base = { zr: 0, so: 0.45, deltaPsi: 2.2, mr: 10000 };
    expect(resolverSN({ ...base, w18: 1e6 })).toBeGreaterThan(resolverSN({ ...base, w18: 1e3 }));
  });

  it('una subrasante mejor pide menos número estructural', () => {
    const base = { w18: 1e5, zr: 0, so: 0.45, deltaPsi: 2.2 };
    expect(resolverSN({ ...base, mr: 30000 })).toBeLessThan(resolverSN({ ...base, mr: 5000 }));
  });

  /* Antes que devolver el tope y hacer pasar por diseño algo que no lo es. */
  it('si no hay solución razonable lo dice en vez de inventar', () => {
    expect(resolverSN({ w18: 1e12, zr: -3.09, so: 0.45, deltaPsi: 0.5, mr: 1000 })).toBe(null);
    expect(resolverSN({ w18: 0, zr: 0, so: 0.45, deltaPsi: 2.2, mr: 10000 })).toBe(null);
    expect(resolverSN({ w18: 1000, zr: 0, so: 0.45, deltaPsi: 0, mr: 10000 })).toBe(null);
  });
});

describe('confiabilidad', () => {
  it('Zr sale de R, no se escribe a mano', () => {
    expect(zrDeConfiabilidad(0.5)).toBe(0);
    expect(zrDeConfiabilidad(0.9)).toBe(-1.282);
    expect(zrDeConfiabilidad(0.95)).toBe(-1.645);
  });

  it('una confiabilidad fuera de la tabla no devuelve cero por descuido', () => {
    expect(zrDeConfiabilidad(0.77)).toBe(null);
  });

  /* Más confiabilidad es más margen, y más margen es más espesor. */
  it('subir la confiabilidad engorda el pavimento', () => {
    const flojo = calcularDiseno({ ...EJEMPLO_1.entradas, confiabilidad: 0.5 });
    const exigente = calcularDiseno({ ...EJEMPLO_1.entradas, confiabilidad: 0.95 });
    expect(exigente.sn3).toBeGreaterThan(flojo.sn3);
    expect(exigente.h1Calculado).toBeGreaterThan(flojo.h1Calculado);
  });

  it('la tabla va de menor a mayor exigencia, sin repetidos', () => {
    const rs = NIVELES_CONFIABILIDAD.map((n) => n.r);
    expect([...rs].sort((a, b) => a - b)).toEqual(rs);
    expect(new Set(rs).size).toBe(rs.length);
  });
});

describe('el cálculo completo', () => {
  it('con las entradas por defecto no revienta ni deja huecos', () => {
    const r = calcularDiseno(entradasPorDefecto());
    expect(Number.isFinite(r.factorCamion)).toBe(true);
    /* Sin estaciones no hay saturación, pero el resto sí se puede calcular. */
    cerca(r.saturacion, 0);
  });

  it('sin entradas se comporta como con las de por defecto', () => {
    expect(calcularDiseno(null).factorCamion).toBe(calcularDiseno(entradasPorDefecto()).factorCamion);
  });

  it('un espesor más grueso aporta más número estructural', () => {
    const delgado = calcularDiseno({ ...EJEMPLO_1.entradas, espesorCapa1: 5 });
    const grueso = calcularDiseno({ ...EJEMPLO_1.entradas, espesorCapa1: 20 });
    expect(grueso.sn1Ajustado).toBeGreaterThan(delgado.sn1Ajustado);
    expect(grueso.snTotal).toBeGreaterThan(delgado.snTotal);
  });

  it('unos espesores demasiado delgados no cumplen', () => {
    const r = calcularDiseno({ ...EJEMPLO_1.entradas, espesorCapa1: 1, espesorCapa2: 1 });
    expect(r.cumple).toBe(false);
  });

  it('una confiabilidad fuera de la tabla deja el diseño sin terminar', () => {
    const r = calcularDiseno({ ...EJEMPLO_1.entradas, confiabilidad: 0.77 });
    expect(r.zr).toBe(null);
  });

  it('las conversiones de unidades son la vuelta exacta', () => {
    cerca(pulgadasACm(cmAPulgadas(12.7)), 12.7, 1e-12);
    cerca(cmAPulgadas(2.54), 1, 1e-12);
  });
});

describe('el diseño como texto', () => {
  it('lleva lo que hay que poder pegar en una memoria', () => {
    const texto = textoDelDiseno({ ...EJEMPLO_1.entradas, nombre: 'Vía de acceso' });
    expect(texto.startsWith('Diseño de vía · Vía de acceso')).toBe(true);
    expect(texto).toContain('Factor camión: 7.541');
    expect(texto).toContain('Afirmado INVÍAS 311');
    expect(texto).toContain('-Capa 1: 5 cm (mínimo 11.1 cm)');
    expect(texto).toContain('-Cumple');
  });

  it('un diseño que no cumple lo dice', () => {
    const texto = textoDelDiseno({ ...EJEMPLO_1.entradas, espesorCapa1: 1, espesorCapa2: 1 });
    expect(texto).toContain('-No cumple');
  });

  it('sin nombre no deja un separador colgando', () => {
    expect(textoDelDiseno(EJEMPLO_1.entradas).startsWith('Diseño de vía\n')).toBe(true);
  });
});

describe('lo que se escribe en pantalla y lo que entra al cálculo', () => {
  /* Los porcentajes se escriben como porcentajes y el cálculo los quiere en
     fracción. Si esta conversión se aplica dos veces —o ninguna— el diseño
     sale mal sin que nada se rompa, así que va probada. */
  it('convierte cada porcentaje una sola vez', () => {
    const e = desdeFormulario({
      tasaPct: 1, direccionalPct: 100, comercialesPct: 50, confiabilidadPct: 95, cbrSubrasantePct: 7,
    });
    cerca(e.tasa, 0.01, 1e-12);
    cerca(e.direccional, 1, 1e-12);
    cerca(e.comerciales, 0.5, 1e-12);
    cerca(e.confiabilidad, 0.95, 1e-12);
    cerca(e.cbrSubrasante, 0.07, 1e-12);
  });

  /* Un proyecto guarda el peso de sus estaciones en PORCENTAJE (60), y el
     cálculo lo quiere en fracción (0.6). Es la conversión que, olvidada,
     dividiría por cien el tiempo de saturación sin avisar. */
  it('el peso de las estaciones pasa de porcentaje a fracción', () => {
    const e = desdeFormulario({ estaciones: [{ nombre: 'A', dias: 100, peso: 60 }] });
    cerca(e.estaciones[0].peso, 0.6, 1e-12);
  });

  it('el formulario por defecto reproduce las entradas por defecto', () => {
    const e = desdeFormulario(formularioPorDefecto());
    const d = entradasPorDefecto();
    cerca(e.tasa, d.tasa, 1e-12);
    cerca(e.confiabilidad, d.confiabilidad, 1e-12);
    cerca(e.cbrSubrasante, d.cbrSubrasante, 1e-12);
  });

  /* La prueba de fuego: el ejemplo 1 escrito como lo escribiría una persona
     en la pantalla tiene que dar exactamente lo mismo. */
  it('el ejemplo 1, escrito en unidades de pantalla, da lo mismo', () => {
    const r = calcularDesdeFormulario({
      ejes: EJEMPLO_1.entradas.ejes,
      tpd: 1 / 30, tasaPct: 1, periodo: 10, direccionalPct: 100, comercialesPct: 100,
      estaciones: EJEMPLO_1.entradas.estaciones.map((e) => ({ ...e, peso: e.peso * 100 })),
      calidadDrenaje: 'bueno', materialCapa1: 'afirmado', materialCapa2: 'subbase',
      confiabilidadPct: 50, errorEstandar: 0.45, servInicial: 4.2, servFinal: 2,
      cbrSubrasantePct: 7, espesorCapa1: 5, espesorCapa2: 10,
    });
    cerca(r.saturacion, EJEMPLO_1.excel.saturacion, 1e-12);
    cerca(r.m, EJEMPLO_1.excel.m, 1e-12);
    cerca(r.snTotal, EJEMPLO_1.excel.snTotal, 1e-9);
    expect(r.cumple).toBe(true);
  });
});

describe('traer datos de un proyecto', () => {
  const proyecto = (data) => ({ id: 'p1', nombre: 'Chinú 3', data });

  it('trae las estaciones y el CBR sumergido', () => {
    const t = datosDelProyecto(proyecto({
      hidraulico: { estaciones_pluviometricas: [{ nombre: 'El Descanso', dias: '39.5', peso: '60' }] },
      geotecnia: { cbr_sumergido: '7' },
    }));
    expect(t.estaciones).toEqual([{ nombre: 'El Descanso', dias: '39.5', peso: '60' }]);
    expect(t.cbrSubrasantePct).toBe(7);
  });

  /* El CBR sumergido NO es el CBR de arriba: si alguien solo llenó ese, no se
     trae nada, en vez de meter un número que parece el correcto. */
  it('no confunde el CBR normal con el sumergido', () => {
    const t = datosDelProyecto(proyecto({ geotecnia: { cbr: '12' } }));
    expect(t.cbrSubrasantePct).toBe(undefined);
  });

  /* Traer de un proyecto a medio llenar no puede borrar lo que ya se escribió
     en la pantalla. */
  it('un proyecto sin datos no devuelve nada que pisar', () => {
    expect(datosDelProyecto(proyecto({}))).toEqual({});
    expect(datosDelProyecto(proyecto({ hidraulico: { estaciones_pluviometricas: [{ nombre: '', dias: '', peso: '' }] } }))).toEqual({});
    expect(datosDelProyecto(null)).toEqual({});
  });
});
