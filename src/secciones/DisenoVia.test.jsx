// @vitest-environment jsdom
/* ============================================================================
   DISEÑO DE VÍA — la pantalla, montada de verdad.
   ----------------------------------------------------------------------------
   Las cuentas ya están probadas contra los dos ejemplos del Excel en
   shared/disenoVia.test.js. Aquí se prueba lo que solo se rompe al montar:
   que los números lleguen a la pantalla, que traer datos de un proyecto no
   pise lo escrito, que guardar mande lo que dice mandar y que no pueda
   guardar quien no debe.

   Los números salen formateados en español —coma decimal—, así que las
   comparaciones van con coma.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DisenoViaView from './DisenoVia.jsx';

afterEach(cleanup);

const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };

/* El ejemplo 1 de la hoja, en las unidades que se escriben en pantalla. */
const EJEMPLO_1 = {
  nombre: 'Vía de acceso',
  ejes: [
    { tipo: 'simple', cantidad: 1, peso: 7 },
    { tipo: 'tandem', cantidad: 2, peso: 20 },
    { tipo: 'tridem', cantidad: 0, peso: 0 },
  ],
  tpd: 1 / 30, tasaPct: 1, periodo: 10, direccionalPct: 100, comercialesPct: 100,
  estaciones: [
    { nombre: 'El Descanso', dias: 39.5, peso: 60 },
    { nombre: 'Manaure', dias: 142.52, peso: 5 },
    { nombre: 'Villa Carmelita', dias: 65.2, peso: 15 },
    { nombre: 'Paris De Francia', dias: 60.44, peso: 14 },
    { nombre: 'San Angel', dias: 41.13, peso: 6 },
  ],
  calidadDrenaje: 'bueno', materialCapa1: 'afirmado', materialCapa2: 'subbase',
  confiabilidadPct: 50, errorEstandar: 0.45, servInicial: 4.2, servFinal: 2,
  cbrSubrasantePct: 7, espesorCapa1: 5, espesorCapa2: 10,
};

function proyecto(over = {}) {
  return {
    id: 'p1', nombre: 'Chinú 3',
    equipo: { civil: ['Ana'] },
    data: {
      hidraulico: {
        estaciones_pluviometricas: [
          { nombre: 'El Descanso', dias: '39.5', peso: '60' },
          { nombre: 'Manaure', dias: '142.52', peso: '5' },
        ],
      },
      geotecnia: { cbr: '12', cbr_sumergido: '7' },
    },
    ...over,
  };
}

function pintar(props = {}) {
  return render(
    <DisenoViaView
      perfil={perfil}
      projects={[proyecto()]}
      onGuardarEnProyecto={() => {}}
      onAbrirProyecto={() => {}}
      {...props}
    />,
  );
}

const elegirProyecto = (id = 'p1') => {
  const select = screen.getByText('Proyecto').parentElement.querySelector('select');
  fireEvent.change(select, { target: { value: id } });
};

describe('la pantalla', () => {
  it('abre sin proyecto y sin romperse', () => {
    pintar();
    expect(screen.getByText('Diseño de vía')).toBeTruthy();
    expect(screen.getByText('Sin proyecto — solo para tantear')).toBeTruthy();
  });

  /* La pestaña que se usa siempre pide solo lo que cambia de un proyecto a
     otro; lo demás vive detrás de la otra. */
  it('abre en "Diseño", con lo que cambia por proyecto y nada más', () => {
    pintar();
    ['Materiales y subrasante', 'Estaciones pluviométricas', 'Espesores', 'Perfil de la rasante']
      .forEach((t) => expect(screen.getByText(t), t).toBeTruthy());
    expect(screen.queryByText('Vehículo de diseño')).toBe(null);
    expect(screen.queryByText('Tránsito')).toBe(null);
  });

  it('los parámetros del cálculo están en la otra pestaña', () => {
    pintar();
    fireEvent.click(screen.getByText('Parámetros del cálculo'));
    ['Vehículo de diseño', 'Tránsito', 'Serviciabilidad, confiabilidad y drenaje',
      'Módulos y números estructurales'].forEach((t) => expect(screen.getByText(t), t).toBeTruthy());
    /* Y al irse allá, la pestaña de diseño se guarda. */
    expect(screen.queryByText('Estaciones pluviométricas')).toBe(null);
  });

  /* Sin estaciones no hay coeficiente de drenaje, y sin él no hay espesor.
     Eso no puede dejar "NaN" en pantalla. */
  it('con la pantalla recién abierta no muestra NaN en ninguna parte', () => {
    const { container } = pintar();
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
  });

  it('recalcula al cambiar un dato, sin apretar nada', () => {
    const { container } = pintar();
    const antes = container.textContent;
    const cbr = screen.getByText('CBR sumergido de la subrasante').parentElement.querySelector('input');
    fireEvent.change(cbr, { target: { value: '20' } });
    /* Una subrasante mucho mejor pide menos estructura: algo tiene que
       cambiar en pantalla sin apretar nada. */
    expect(container.textContent).not.toBe(antes);
  });
});

describe('el ejemplo de la hoja, armado desde la pantalla', () => {
  /* Ya no se reabre un diseño guardado —eso ahora vive en la pestaña Civil
     del proyecto—, así que la prueba de fuego se hace como lo haría una
     persona: se elige el proyecto, se traen sus estaciones y su CBR, y se
     ponen los materiales. Tiene que dar lo mismo que dio el Excel. */
  const conLasCinco = () => proyecto({
    data: {
      hidraulico: {
        estaciones_pluviometricas: [
          { nombre: 'El Descanso', dias: '39.5', peso: '60' },
          { nombre: 'Manaure', dias: '142.52', peso: '5' },
          { nombre: 'Villa Carmelita', dias: '65.2', peso: '15' },
          { nombre: 'Paris De Francia', dias: '60.44', peso: '14' },
          { nombre: 'San Angel', dias: '41.13', peso: '6' },
        ],
      },
      geotecnia: { cbr_sumergido: '7' },
    },
  });

  it('da los mismos números que el Excel', () => {
    /* Con perfil de Desarrollador porque el ejemplo de la hoja usa un TPD de
       un camión cada 30 días, y el que viene por defecto está redondeado.
       Todo lo demás sale de traer los datos del proyecto. */
    const { container } = pintar({
      projects: [conLasCinco()],
      perfil: { id: 'u9', nombre: 'Dev', roles: ['desarrollador'] },
    });
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));

    fireEvent.click(screen.getByText('Parámetros del cálculo'));
    const tpd = screen.getByText('Tránsito promedio diario (TPD)').parentElement.querySelector('input');
    fireEvent.change(tpd, { target: { value: String(1 / 30) } });
    expect(container.textContent).toContain('7,541');   // factor camión
    expect(container.textContent).toContain('965');     // W18

    fireEvent.click(screen.getByText('Diseño'));
    expect(container.textContent).toContain('1,082');   // coeficiente de drenaje
    expect(container.textContent).toContain('11,1');    // espesor mínimo capa 1, en cm
    expect(screen.getByText('Cumple')).toBeTruthy();
  });
});

describe('traer datos del proyecto', () => {
  it('trae las estaciones y el CBR sumergido', () => {
    pintar();
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    expect(screen.getByText(/Se trajo las estaciones y el CBR sumergido de Chinú 3/)).toBeTruthy();
    expect(screen.getByText('El Descanso')).toBeTruthy();
  });

  /* El dato es del proyecto: tenerlo en dos sitios donde se pueda cambiar es
     tener dos versiones distintas de la misma lluvia. */
  it('lo traído no se edita aquí, y dice dónde se corrige', () => {
    pintar();
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    const tabla = screen.getByText('Nombre de la estación').closest('table');
    expect(tabla.querySelectorAll('tbody input')).toHaveLength(0);
    expect(screen.getByText(/edítalas en su pestaña Hidráulico/)).toBeTruthy();
  });

  /* Sin proyecto —o antes de traer nada— la tabla sí se escribe: es el modo
     de tantear un diseño que no es de ningún proyecto todavía. */
  it('sin importar nada la tabla se puede escribir', () => {
    pintar();
    const tabla = screen.getByText('Nombre de la estación').closest('table');
    expect(tabla.querySelectorAll('tbody input').length).toBeGreaterThan(0);
  });

  it('cambiar de proyecto vuelve a soltar la tabla', () => {
    pintar();
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    elegirProyecto('');
    const tabla = screen.getByText('Nombre de la estación').closest('table');
    expect(tabla.querySelectorAll('tbody input').length).toBeGreaterThan(0);
  });

  /* El CBR sumergido no es el CBR de arriba: si el proyecto solo tiene ese
     otro, no se trae nada en vez de meter el número equivocado. */
  it('no confunde el CBR normal con el sumergido', () => {
    const sinSumergido = proyecto({ data: { geotecnia: { cbr: '12' } } });
    pintar({ projects: [sinSumergido] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    expect(screen.getByText(/todavía no tiene estaciones pluviométricas ni CBR sumergido/)).toBeTruthy();
  });

  /* El peso viaja en porcentaje desde el proyecto y en fracción hacia el
     cálculo. Si esa conversión se pierde, la saturación se divide por cien y
     el coeficiente de drenaje sube sin que nada se rompa. */
  it('el peso porcentual del proyecto llega bien al cálculo', () => {
    const unaSola = proyecto({
      data: { hidraulico: { estaciones_pluviometricas: [{ nombre: 'X', dias: '365', peso: '100' }] } },
    });
    const { container } = pintar({ projects: [unaSola] });
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    /* 365 días con peso 100% es saturación del 100%, no del 1%. */
    expect(container.textContent).toContain('100,0');
  });
});

describe('guardar en el proyecto', () => {
  it('sin proyecto elegido no se puede guardar', () => {
    pintar();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(true);
  });

  it('manda el diseño entero y los espesores para la pestaña Civil', () => {
    const guardados = [];
    pintar({ onGuardarEnProyecto: (id, d) => guardados.push([id, d]) });
    elegirProyecto();
    fireEvent.click(screen.getByText('Guardar en el proyecto'));
    expect(guardados).toHaveLength(1);
    const [id, { diseno, civil }] = guardados[0];
    expect(id).toBe('p1');
    /* El diseño completo, para poder rastrear de dónde salió cada número. */
    expect(diseno.entradas.materialCapa1).toBe('afirmado');
    expect(diseno.guardado_por).toBe('Ana');
    /* Y los espesores donde el equipo los busca. En METROS: aquí se trabaja
       en centímetros y el plano de rasante va en metros. */
    expect(civil).toEqual({
      via_material_capa1: 'Afirmado INVÍAS 311',
      via_espesor_capa1: '0.05',
      via_material_capa2: 'SubBase INVÍAS 320',
      via_espesor_capa2: '0.1',
    });
    expect(screen.getByText(/Espesores guardados en la pestaña Civil de Chinú 3/)).toBeTruthy();
  });

  /* Diseñar lo puede hacer cualquiera; guardar dentro de un proyecto ajeno,
     no. Es la misma regla de las pestañas técnicas. */
  it('quien no está en el equipo del proyecto no puede guardar ahí', () => {
    const ajeno = proyecto({ equipo: { civil: ['Beto'] } });
    pintar({ projects: [ajeno] });
    elegirProyecto();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(true);
    expect(screen.getByText(/guardar ahí es de quien está en su equipo/)).toBeTruthy();
  });

  it('el desarrollador sí puede, aunque no esté en el equipo', () => {
    const ajeno = proyecto({ equipo: { civil: ['Beto'] } });
    pintar({ projects: [ajeno], perfil: { id: 'u9', nombre: 'Dev', roles: ['desarrollador'] } });
    elegirProyecto();
    expect(screen.getByText('Guardar en el proyecto').closest('button').disabled).toBe(false);
  });
});

describe('el veredicto', () => {
  const escribirEspesores = (e1, e2) => {
    const campos = screen.getByText('Espesores').parentElement.querySelectorAll('input');
    fireEvent.change(campos[0], { target: { value: String(e1) } });
    fireEvent.change(campos[1], { target: { value: String(e2) } });
  };

  it('unos espesores que no alcanzan lo dicen, y explican qué hacer', () => {
    pintar();
    elegirProyecto();
    fireEvent.click(screen.getByText('Traer sus datos'));
    escribirEspesores(1, 1);
    expect(screen.getByText('No cumple')).toBeTruthy();
    expect(screen.getByText(/Sube el de\s+cualquiera de las dos capas/)).toBeTruthy();
  });
});

describe('el aviso de los pesos', () => {
  /* Con la tabla en blanco no hay nada que avisar: ese aviso en un formulario
     recién abierto solo enseña a ignorarlo. */
  it('no aparece en un formulario vacío', () => {
    pintar();
    expect(screen.queryByText(/Los pesos no suman 100%/)).toBe(null);
  });

  it('aparece en cuanto hay pesos escritos que no suman', () => {
    pintar();
    const primeraFila = screen.getByText('Nombre de la estación').closest('table').querySelectorAll('tbody tr')[0];
    fireEvent.change(primeraFila.querySelectorAll('input')[2], { target: { value: '50' } });
    expect(screen.getByText(/Los pesos suman 50%, no 100%/)).toBeTruthy();
  });
});

describe('los parámetros solo los edita el Desarrollador', () => {
  const irAParametros = () => fireEvent.click(screen.getByText('Parámetros del cálculo'));

  /* No se esconden: para revisar un resultado hay que poder ver con qué se
     calculó. Se ven, pero no se tocan. */
  it('un ingeniero los ve pero no los puede cambiar', () => {
    pintar();
    irAParametros();
    expect(screen.getByText(/solo el Desarrollador los edita/)).toBeTruthy();
    const bloque = screen.getByText('Tránsito').parentElement;
    expect(bloque.querySelectorAll('input')).toHaveLength(0);
    /* Pero el valor sigue a la vista. */
    expect(bloque.textContent).toContain('10');
  });

  it('el Desarrollador sí los edita', () => {
    pintar({ perfil: { id: 'u9', nombre: 'Dev', roles: ['desarrollador'] } });
    irAParametros();
    expect(screen.queryByText(/solo el Desarrollador los edita/)).toBe(null);
    const periodo = screen.getByText('Periodo de diseño').parentElement.querySelector('input');
    expect(periodo).toBeTruthy();
    fireEvent.change(periodo, { target: { value: '20' } });
    expect(periodo.value).toBe('20');
  });

  /* Un líder tampoco: el candado es contra el error, no contra la jerarquía. */
  it('un líder tampoco los edita', () => {
    pintar({ perfil: { id: 'u5', nombre: 'Jefa', roles: ['lider_diseno'] } });
    irAParametros();
    expect(screen.getByText(/solo el Desarrollador los edita/)).toBeTruthy();
  });

  /* Lo de la pestaña de diseño lo edita cualquiera: es lo que cambia por
     proyecto. */
  it('los datos del proyecto los edita cualquiera', () => {
    pintar();
    const cbr = screen.getByText('CBR sumergido de la subrasante').parentElement.querySelector('input');
    expect(cbr).toBeTruthy();
    fireEvent.change(cbr, { target: { value: '9' } });
    expect(cbr.value).toBe('9');
  });
});

describe('el perfil de la rasante', () => {
  it('dibuja las dos capas con su espesor en metros', () => {
    pintar();
    const dibujo = screen.getByRole('img');
    expect(dibujo.textContent).toContain('0,05 m');   // capa 1: 5 cm
    expect(dibujo.textContent).toContain('0,10 m');   // capa 2: 10 cm
    expect(dibujo.textContent).toContain('Estructura: 0,15 m');
    expect(dibujo.textContent).toContain('Afirmado INVÍAS 311');
  });

  it('sigue los espesores que se escriben', () => {
    pintar();
    const espesores = screen.getByText('Espesores').parentElement.querySelectorAll('input');
    fireEvent.change(espesores[0], { target: { value: '15' } });
    expect(screen.getByRole('img').textContent).toContain('0,15 m');
    expect(screen.getByRole('img').textContent).toContain('Estructura: 0,25 m');
  });

  /* Sin espesores no se pinta una estructura de altura cero, que parecería
     un error de la pantalla. */
  it('sin espesores lo dice en vez de dibujar nada', () => {
    pintar();
    const espesores = screen.getByText('Espesores').parentElement.querySelectorAll('input');
    fireEvent.change(espesores[0], { target: { value: '' } });
    fireEvent.change(espesores[1], { target: { value: '' } });
    expect(screen.getByText('Escribe los espesores para ver la sección.')).toBeTruthy();
  });
});

describe('el perfil, después del feedback', () => {
  /* Es lo primero que uno quiere ver al abrir, y lo que va cambiando
     mientras se tocan los espesores. */
  it('va arriba del todo, antes de los campos', () => {
    const { container } = pintar();
    const perfil = screen.getByText('Perfil de la rasante');
    const materiales = screen.getByText('Materiales y subrasante');
    const antes = perfil.compareDocumentPosition(materiales) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(Boolean(antes)).toBe(true);
    expect(container).toBeTruthy();
  });

  /* La línea de cota horizontal se leía como si acotara el ancho de la vía,
     que este dibujo no dice. El espesor total se queda como texto. */
  it('conserva el espesor total pero sin la cota horizontal', () => {
    pintar();
    const svg = screen.getByRole('img');
    expect(svg.textContent).toContain('Estructura: 0,15 m');
    /* Las únicas cotas que quedan son las verticales, una por capa: dos
       tramos punteados y su línea, por capa. */
    const punteadas = svg.querySelectorAll('line[stroke-dasharray]');
    expect(punteadas).toHaveLength(4);
  });

  it('ya no habla del terreno natural explanado', () => {
    pintar();
    expect(screen.getByRole('img').textContent).not.toContain('Terreno natural');
  });
});
