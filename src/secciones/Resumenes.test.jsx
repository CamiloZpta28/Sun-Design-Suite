// @vitest-environment jsdom
/* ============================================================================
   RESÚMENES SEMANALES — render real.
   ----------------------------------------------------------------------------
   Además de que pinte, aquí se comprueban las dos reglas que hacen que el
   bloque de avance signifique algo: que un resumen ya enviado muestre la foto
   GUARDADA y no una recalculada, y que al enviarlo se guarde justamente esa
   foto para que la semana siguiente tenga contra qué compararse.

   Las semanas se calculan con la fecha de hoy, así que nada aquí puede estar
   anclado a un lunes concreto.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ResumenesView from './Resumenes.jsx';
import { lunesDe, sumarDias } from '../shared/resumenes.js';

afterEach(cleanup);

const SEMANA = lunesDe();
const ANTERIOR = sumarDias(SEMANA, -7);

const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };
const directorio = [
  { id: 'u1', nombre: 'Ana', roles: ['civil'] },
  { id: 'u2', nombre: 'Beto', roles: ['delineante'] },
  { id: 'u3', nombre: 'Caro', roles: ['electrico'] },
];

const dossiers = [{
  id: 'dos-1', nombre: 'CFM', version: 1,
  documentos: [
    { id: 'a', codigo: 'C-PL-001', nombre: 'Cerramiento', especialidad: 'CIVIL', tipo: 'Plano', responsables: { civil: 'R', delineante: 'E' } },
    { id: 'b', codigo: 'C-INF-001', nombre: 'Vías de acceso', especialidad: 'CIVIL', tipo: 'Informe', responsables: { civil: 'E' } },
  ],
}];

function proyecto(over = {}) {
  return {
    id: 'p1', nombre: 'Chinú 3', dossier_id: 'dos-1',
    equipo: { civil: ['Ana'] },
    documentos: { 'C-PL-001': { estado: 'Entregado' } },
    data: { general: {} },
    ...over,
  };
}

function pintar(props = {}) {
  return render(
    <ResumenesView
      perfil={perfil}
      directorio={directorio}
      projects={[proyecto()]}
      dossiers={dossiers}
      resumenes={[]}
      onGuardar={() => {}}
      {...props}
    />,
  );
}

/* Un resumen guardado de la semana pasada, con su foto. */
function resumenPrevio(estados) {
  return {
    id: 'r0', usuario_id: 'u1', semana: ANTERIOR, hasta: null, enviado: true,
    bloques: {},
    proyectos: [{ id: 'p1', nombre: 'Chinú 3', total: 2, porEstado: {}, estados, nombres: {} }],
  };
}

describe('mi resumen', () => {
  it('abre en la semana actual con los cuatro bloques', () => {
    pintar();
    ['Lo mejor', 'Pendientes', 'Dificultades', 'Temas'].forEach((b) => {
      expect(screen.getByText(b), b).toBeTruthy();
    });
  });

  it('sin documentos a cargo lo explica en vez de mostrar un bloque vacío', () => {
    pintar({ projects: [proyecto({ equipo: { electrico: ['Otro'] } })] });
    expect(screen.getByText(/No tienes documentos a cargo esta semana/)).toBeTruthy();
  });

  it('la primera semana lo dice, en vez de anunciar que no hubo avances', () => {
    pintar();
    expect(screen.getByText('Chinú 3')).toBeTruthy();
    expect(screen.getByText(/primera semana registrada/)).toBeTruthy();
  });

  it('con la foto de la semana pasada dice qué se movió y cuál fue', () => {
    pintar({ resumenes: [resumenPrevio({ 'C-PL-001': 'Pendiente', 'C-INF-001': 'Pendiente' })] });
    fireEvent.click(screen.getByText(/1 documento avanzó/));
    expect(screen.getByText(/Cerramiento/)).toBeTruthy();
    expect(screen.getByText(/Pendiente → Entregado/)).toBeTruthy();
  });

  it('un documento que ya estaba igual no se reporta como avance', () => {
    pintar({ resumenes: [resumenPrevio({ 'C-PL-001': 'Entregado', 'C-INF-001': 'Pendiente' })] });
    expect(screen.getByText(/sin cambios esta semana/)).toBeTruthy();
  });
});

describe('guardar', () => {
  it('manda lo escrito y la foto del avance', async () => {
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    const [primerRenglon] = screen.getAllByPlaceholderText(/Lo que sacaste esta semana/);
    fireEvent.change(primerRenglon, { target: { value: 'Reunión Drawing Team' } });
    fireEvent.click(screen.getByText('Guardar borrador'));
    expect(guardados.length).toBe(1);
    expect(guardados[0].semana).toBe(SEMANA);
    expect(guardados[0].enviado).toBe(false);
    expect(guardados[0].bloques.lo_mejor).toEqual(['Reunión Drawing Team']);
    expect(guardados[0].proyectos[0]).toMatchObject({ id: 'p1', nombre: 'Chinú 3' });
    /* La foto lleva el estado de cada documento: es lo único con lo que la
       semana siguiente puede comparar. */
    expect(guardados[0].proyectos[0].estados).toEqual({ 'C-PL-001': 'Entregado', 'C-INF-001': 'Pendiente' });
  });

  it('marcar como enviado guarda con la bandera puesta', () => {
    const guardados = [];
    pintar({ onGuardar: (r) => { guardados.push(r); } });
    fireEvent.click(screen.getByText('Marcar como enviado'));
    expect(guardados[0].enviado).toBe(true);
  });
});

describe('un resumen ya enviado', () => {
  const enviado = {
    id: 'r1', usuario_id: 'u1', semana: SEMANA, hasta: null, enviado: true,
    bloques: { lo_mejor: ['Algo que hice'] },
    proyectos: [{
      id: 'p1', nombre: 'Chinú 3', total: 2,
      porEstado: { 'Aprobado para construcción (APC)': 2 },
      estados: {}, nombres: {}, hayComparacion: true, avanzaron: 2, cambios: [],
    }],
  };

  it('se ve en lectura, sin renglones para escribir', () => {
    pintar({ resumenes: [enviado] });
    expect(screen.getByText('- Algo que hice')).toBeTruthy();
    expect(screen.queryByText('Guardar borrador')).toBe(null);
    expect(screen.queryAllByPlaceholderText(/Lo que sacaste esta semana/).length).toBe(0);
  });

  /* Lo importante: muestra la foto GUARDADA (2 en APC, 100%) y no una
     recalculada contra los proyectos de ahora, que daría 0%. */
  it('muestra la foto congelada, no una recalculada', () => {
    pintar({ resumenes: [enviado] });
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('2 de 2 en APC')).toBeTruthy();
  });

  it('se puede reabrir para editarlo', () => {
    const guardados = [];
    pintar({ resumenes: [enviado], onGuardar: (r) => { guardados.push(r); } });
    fireEvent.click(screen.getByText('Volver a editar'));
    expect(guardados[0].enviado).toBe(false);
  });
});

describe('copiar para el chat', () => {
  it('arma el texto con el formato del equipo', async () => {
    let copiado = null;
    Object.assign(navigator, { clipboard: { writeText: (t) => { copiado = t; return Promise.resolve(); } } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    pintar();
    const [primerRenglon] = screen.getAllByPlaceholderText(/Lo que sacaste esta semana/);
    fireEvent.change(primerRenglon, { target: { value: 'Mesa técnica' } });
    await fireEvent.click(screen.getByText('Copiar para el chat'));
    await Promise.resolve();

    expect(copiado).toContain('Buenas tardes');
    expect(copiado).toContain('Lo mejor\n-Mesa técnica');
    expect(copiado).toContain('Dificultades\n-Ninguna');
    expect(copiado).toContain('Temas\n-Ninguno');
    expect(copiado).toContain('Avance de mis proyectos');
  });
});

describe('la vista del equipo', () => {
  const soloBeto = {
    id: 'r2', usuario_id: 'u2', semana: SEMANA, enviado: true,
    bloques: { lo_mejor: ['Planos de Chinú 4'] }, proyectos: [],
  };

  it('dice quién ya envió y quién no', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getByText('1 de 3 ya enviaron su resumen de esta semana.')).toBeTruthy();
    expect(screen.getByText('Enviado')).toBeTruthy();
    expect(screen.getAllByText('Sin registrar').length).toBe(2);
  });

  it('distingue el borrador del enviado', () => {
    pintar({ resumenes: [{ ...soloBeto, enviado: false }] });
    fireEvent.click(screen.getByText('El equipo'));
    expect(screen.getByText('Borrador')).toBeTruthy();
    expect(screen.getByText('0 de 3 ya enviaron su resumen de esta semana.')).toBeTruthy();
  });

  it('el resumen ajeno se despliega y se lee, pero no se edita', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    fireEvent.click(screen.getByText('Beto'));
    expect(screen.getByText('- Planos de Chinú 4')).toBeTruthy();
    expect(screen.queryByText('Guardar borrador')).toBe(null);
  });

  it('el filtro por rol deja solo a los de esa área', () => {
    pintar({ resumenes: [soloBeto] });
    fireEvent.click(screen.getByText('El equipo'));
    fireEvent.click(screen.getByText('Delineante (1)'));
    expect(screen.getByText('Beto')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBe(null);
    expect(screen.getByText('1 de 1 ya enviaron su resumen de esta semana.')).toBeTruthy();
  });
});

describe('cambiar de semana', () => {
  it('no arrastra lo que se estaba escribiendo en la otra', () => {
    pintar();
    const [renglon] = screen.getAllByPlaceholderText(/Lo que sacaste esta semana/);
    fireEvent.change(renglon, { target: { value: 'De esta semana' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ANTERIOR } });
    const [otro] = screen.getAllByPlaceholderText(/Lo que sacaste esta semana/);
    expect(otro.value).toBe('');
  });
});
