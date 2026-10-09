// @vitest-environment jsdom
/* ============================================================================
   SUPERVISIÓN TÉCNICA — render real y ciclo completo.
   ----------------------------------------------------------------------------
   Se recorre el flujo entero como lo haría el ingeniero: armar un paquete,
   registrar la respuesta (unos APC, otros con comentarios), confirmar el
   cambio de estados en Control Documental y encadenar el paquete siguiente
   con los que quedaron con comentarios.
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import SupervisionTecnicaPanel, {
  PaqueteForm,
  SITUACION, situacionPorDocumento, sePuedeEnviar, estaAprobado, sePuedeEditarRespuesta,
  aplicarRespuesta, fechaDeRespuestaDe, pendientesDeRespuesta, comentariosSinResolver,
  tituloPaquete, ESTADO_POR_RESULTADO,
} from './SupervisionTecnica.jsx';
import { dossierPorEspecialidad, requiereSupervisionTecnica } from '../shared/dominio.jsx';

afterEach(cleanup);

const perfil = { id: 'u1', nombre: 'Ana', roles: ['civil'] };

/* Dossier chico y previsible, con la misma forma que arma
   dossierPorEspecialidad(). */
const GRUPOS = [
  {
    especialidad: 'CIVIL',
    docs: [
      { codigo: 'C-1', codigoFinal: 'COLBOYT147P1-CIV-001', nombre: 'Memoria civil' },
      { codigo: 'C-2', codigoFinal: 'COLBOYT147P1-CIV-002', nombre: 'Planos civiles' },
    ],
  },
  {
    especialidad: 'ELECTRICA',
    docs: [
      { codigo: 'E-1', codigoFinal: 'COLBOYT147P1-ELE-001', nombre: 'Memoria eléctrica' },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.docs.map((d) => d.codigo));

function paquete(over = {}) {
  return {
    id: 'paq-1',
    numero: 1,
    fecha_entrega: '2026-09-01',
    fecha_respuesta: '',
    documentos: TODOS.map((codigo) => ({ codigo, resultado: null })),
    creado_por: 'Ana',
    created_at: '2026-09-01T10:00:00.000Z',
    ...over,
  };
}

/* "Marcar todos: APC · APCC · Con comentarios" — el botón es el que está
   dentro de esa fila, no la etiqueta de un documento suelto. */
function marcarTodos(etiqueta) {
  const boton = screen.getAllByRole('button').filter((b) => b.textContent.trim() === etiqueta).pop();
  fireEvent.click(boton);
}

function montar(props = {}) {
  const onGuardar = vi.fn();
  const utils = render(
    <SupervisionTecnicaPanel
      grupos={GRUPOS}
      supervision={props.supervision}
      estadoDocs={props.estadoDocs || {}}
      puedeEditar={props.puedeEditar !== false}
      perfil={perfil}
      onGuardar={onGuardar}
    />,
  );
  return { ...utils, onGuardar };
}

describe('situación de cada documento', () => {
  it('sin paquetes, todos están sin enviar', () => {
    const mapa = situacionPorDocumento([]);
    expect(mapa.size).toBe(0);
    expect(sePuedeEnviar(SITUACION.SIN_ENVIAR)).toBe(true);
  });

  it('en un paquete sin responder quedan en revisión, y no se pueden reenviar', () => {
    const mapa = situacionPorDocumento([paquete()]);
    expect(mapa.get('C-1').situacion).toBe(SITUACION.EN_REVISION);
    expect(sePuedeEnviar(SITUACION.EN_REVISION)).toBe(false);
  });

  it('respondido, cada documento queda en APC o con comentarios', () => {
    const mapa = situacionPorDocumento([paquete({
      fecha_respuesta: '2026-09-15',
      documentos: [
        { codigo: 'C-1', resultado: 'apc' },
        { codigo: 'C-2', resultado: 'comentarios' },
        { codigo: 'E-1', resultado: 'apc' },
      ],
    })]);
    expect(mapa.get('C-1').situacion).toBe(SITUACION.APC);
    expect(mapa.get('C-2').situacion).toBe(SITUACION.CON_COMENTARIOS);
    expect(sePuedeEnviar(SITUACION.APC)).toBe(false);
    expect(sePuedeEnviar(SITUACION.CON_COMENTARIOS)).toBe(true);
  });

  /* Lo que manda es la última vuelta: un documento que volvió con comentarios
     y después quedó APC, está APC. */
  it('manda el paquete más reciente', () => {
    const mapa = situacionPorDocumento([
      paquete({ id: 'p1', numero: 1, fecha_respuesta: '2026-09-15', documentos: [{ codigo: 'C-1', resultado: 'comentarios' }] }),
      paquete({ id: 'p2', numero: 2, fecha_respuesta: '2026-10-01', documentos: [{ codigo: 'C-1', resultado: 'apc' }] }),
    ]);
    expect(mapa.get('C-1').situacion).toBe(SITUACION.APC);
  });
});

describe('panel', () => {
  it('se pinta sin ningún paquete', () => {
    montar();
    expect(screen.getByText('Supervisión técnica')).toBeTruthy();
    expect(screen.getByText(/Todavía no se ha entregado ningún paquete/)).toBeTruthy();
    /* El dossier se ve completo, con código y nombre. */
    expect(screen.getByText('COLBOYT147P1-CIV-001')).toBeTruthy();
    expect(screen.getByText('Memoria civil')).toBeTruthy();
  });

  it('sin permiso de edición no ofrece crear paquetes', () => {
    montar({ puedeEditar: false });
    expect(screen.queryByText('Nuevo paquete de entrega')).toBe(null);
    expect(screen.getByText(/Solo el equipo asignado/)).toBeTruthy();
  });

  it('crea un paquete con toda una especialidad', () => {
    const { onGuardar } = montar();
    fireEvent.click(screen.getByText('Nuevo paquete de entrega'));
    fireEvent.click(screen.getByLabelText(/CIVIL/));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByText(/Crear paquete \(2\)/));

    expect(onGuardar).toHaveBeenCalledTimes(1);
    const [nuevaSupervision, accion, cambios] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes).toHaveLength(1);
    expect(nuevaSupervision.paquetes[0].documentos.map((d) => d.codigo)).toEqual(['C-1', 'C-2']);
    expect(nuevaSupervision.paquetes[0].numero).toBe(1);
    expect(nuevaSupervision.paquetes[0].fecha_entrega).toBe('2026-09-01');
    expect(accion).toMatch(/paquete 1/);
    expect(cambios).toEqual([]);
  });

  it('no deja seleccionar un documento que ya está esperando respuesta', () => {
    montar({ supervision: { paquetes: [paquete()] } });
    fireEvent.click(screen.getByText('Nuevo paquete de entrega'));
    expect(screen.getByText(/No hay documentos disponibles/)).toBeTruthy();
  });

  it('registra la respuesta y pregunta antes de tocar Control Documental', () => {
    const { onGuardar } = montar({
      supervision: { paquetes: [paquete()] },
      estadoDocs: { 'C-1': { estado: 'Entregado' }, 'C-2': { estado: 'Entregado' }, 'E-1': { estado: 'Entregado' } },
    });

    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText('Registrar respuesta'));
    marcarTodos('APC');
    const fechas = document.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[fechas.length - 1], { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByText('Guardar respuesta'));

    /* Todavía no se guardó nada: primero el aviso. */
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Actualizar Control Documental')).toBeTruthy();
    expect(screen.getByText(/3 documentos cambiarían de estado/)).toBeTruthy();

    fireEvent.click(screen.getByText('Aplicar y guardar'));
    const [nuevaSupervision, , cambios] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[0].fecha_respuesta).toBe('2026-09-15');
    expect(cambios).toHaveLength(3);
    expect(cambios[0].nuevo).toBe(ESTADO_POR_RESULTADO.apc);
  });

  it('permite guardar la respuesta sin tocar Control Documental', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [paquete()] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText('Registrar respuesta'));
    marcarTodos('Con comentarios');
    const fechas = document.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[fechas.length - 1], { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByText('Guardar respuesta'));
    fireEvent.click(screen.getByText('Guardar sin cambiar estados'));

    const [nuevaSupervision, , cambios] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[0].documentos.every((d) => d.resultado === 'comentarios')).toBe(true);
    expect(cambios).toEqual([]);
  });

  it('encadena el paquete siguiente con los que tienen comentarios', () => {
    const respondido = paquete({
      fecha_respuesta: '2026-09-15',
      documentos: [
        { codigo: 'C-1', resultado: 'apc' },
        { codigo: 'C-2', resultado: 'comentarios' },
        { codigo: 'E-1', resultado: 'comentarios' },
      ],
    });
    const { onGuardar } = montar({ supervision: { paquetes: [respondido] } });

    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText(/Nuevo paquete con los 2 que siguen con comentarios/));

    const fechas = document.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[0], { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByText(/Crear paquete \(2\)/));

    const [nuevaSupervision] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes).toHaveLength(2);
    expect(nuevaSupervision.paquetes[1].numero).toBe(2);
    expect(nuevaSupervision.paquetes[1].documentos.map((d) => d.codigo).sort()).toEqual(['C-2', 'E-1']);
  });

  it('avisa cuando todo el dossier quedó en APC', () => {
    montar({
      supervision: {
        paquetes: [paquete({
          fecha_respuesta: '2026-09-15',
          documentos: TODOS.map((codigo) => ({ codigo, resultado: 'apc' })),
        })],
      },
    });
    expect(screen.getByText(/Todo el dossier quedó aprobado para construcción/)).toBeTruthy();
  });

  /* Un documento que se entregó y después salió del dossier (cambió la lista
     del inversionista) no puede romper la pantalla. */
  it('aguanta un documento que ya no está en el dossier', () => {
    montar({ supervision: { paquetes: [paquete({ documentos: [{ codigo: 'BORRADO', resultado: null }] })] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    expect(screen.getByText(/ya no está en el dossier/)).toBeTruthy();
  });
});

describe('nombre del paquete', () => {
  it('se puede poner al crearlo, y sale junto al número', () => {
    const { onGuardar } = montar();
    fireEvent.click(screen.getByText('Nuevo paquete de entrega'));
    fireEvent.click(screen.getByLabelText(/CIVIL/));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByPlaceholderText(/Civil — primera entrega/), { target: { value: 'Civil' } });
    fireEvent.click(screen.getByText(/Crear paquete \(2\)/));

    const [nuevaSupervision, accion] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[0].nombre).toBe('Civil');
    expect(accion).toMatch(/paquete 1 · civil/i);
  });

  it('se puede cambiar después', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [paquete({ nombre: 'Civil' })] } });
    expect(screen.getByText('Paquete 1 · Civil')).toBeTruthy();

    fireEvent.click(screen.getByText('Paquete 1 · Civil'));
    fireEvent.click(screen.getByText('Cambiar nombre'));
    fireEvent.change(screen.getByPlaceholderText(/Civil — primera entrega/), { target: { value: 'Civil y estructural' } });
    fireEvent.click(screen.getByText('Guardar nombre'));

    const [nuevaSupervision] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[0].nombre).toBe('Civil y estructural');
  });
});

describe('APCC — aprobado con comentarios menores', () => {
  const respondido = paquete({
    fecha_respuesta: '2026-09-15',
    documentos: [
      { codigo: 'C-1', resultado: 'apc' },
      { codigo: 'C-2', resultado: 'apcc' },
      { codigo: 'E-1', resultado: 'comentarios' },
    ],
  });

  it('cuenta como aprobado, pero aparte del APC', () => {
    const mapa = situacionPorDocumento([respondido]);
    expect(mapa.get('C-2').situacion).toBe(SITUACION.APCC);
    expect(estaAprobado(SITUACION.APCC)).toBe(true);
    expect(estaAprobado(SITUACION.CON_COMENTARIOS)).toBe(false);
  });

  /* Está aprobado, así que no se arrastra solo a la vuelta siguiente; pero se
     puede volver a entregar a mano si se corrigen esos comentarios menores. */
  it('no se arrastra al paquete siguiente, pero sí se puede elegir a mano', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [respondido] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText(/Nuevo paquete con el que sigue con comentarios/));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByText(/Crear paquete \(1\)/));

    const [nuevaSupervision] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[1].documentos.map((d) => d.codigo)).toEqual(['E-1']);
    expect(sePuedeEnviar(SITUACION.APCC)).toBe(true);
  });

  it('el dossier se da por terminado con APC y APCC juntos', () => {
    montar({
      supervision: {
        paquetes: [paquete({
          fecha_respuesta: '2026-09-15',
          documentos: [
            { codigo: 'C-1', resultado: 'apc' },
            { codigo: 'C-2', resultado: 'apcc' },
            { codigo: 'E-1', resultado: 'apc' },
          ],
        })],
      },
    });
    expect(screen.getByText(/Todo el dossier quedó aprobado.*1 con comentarios menores/)).toBeTruthy();
  });

  it('cada resultado lleva su estado de Control Documental', () => {
    expect(ESTADO_POR_RESULTADO.apc).toBe('Aprobado para construcción (APC)');
    expect(ESTADO_POR_RESULTADO.apcc).toBe('Aprobado para construcción con comentarios (APCC)');
    expect(ESTADO_POR_RESULTADO.comentarios).toBe('En proceso');
  });
});

describe('corregir una respuesta ya registrada', () => {
  const respondido = paquete({
    fecha_respuesta: '2026-09-15',
    documentos: [
      { codigo: 'C-1', resultado: 'apc' },
      { codigo: 'C-2', resultado: 'comentarios' },
      { codigo: 'E-1', resultado: 'apc' },
    ],
  });

  it('se permite mientras no haya un paquete posterior con sus documentos', () => {
    expect(sePuedeEditarRespuesta(respondido, [respondido]).permitido).toBe(true);
  });

  it('se bloquea si ya se armó la vuelta siguiente, y dice por qué', () => {
    const siguiente = paquete({ id: 'paq-2', numero: 2, documentos: [{ codigo: 'C-2', resultado: null }] });
    const veredicto = sePuedeEditarRespuesta(respondido, [respondido, siguiente]);
    expect(veredicto.permitido).toBe(false);
    expect(veredicto.motivo).toMatch(/paquete 2/);
  });

  it('un paquete sin responder no se "corrige": se responde', () => {
    expect(sePuedeEditarRespuesta(paquete(), [paquete()]).permitido).toBe(false);
  });

  it('desde la pantalla se corrige y se vuelve a preguntar por los estados', () => {
    const { onGuardar } = montar({
      supervision: { paquetes: [respondido] },
      estadoDocs: { 'C-1': { estado: 'Aprobado para construcción (APC)' } },
    });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText('Corregir respuesta'));
    /* La fecha ya viene puesta y los resultados también. */
    expect(document.querySelectorAll('input[type="date"]')[0].value).toBe('2026-09-15');
    marcarTodos('APCC');
    fireEvent.click(screen.getByText('Guardar corrección'));

    expect(screen.getByText('Actualizar Control Documental')).toBeTruthy();
    fireEvent.click(screen.getByText('Aplicar y guardar'));
    const [nuevaSupervision, , cambios] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[0].documentos.every((d) => d.resultado === 'apcc')).toBe(true);
    expect(cambios.every((c) => c.nuevo === ESTADO_POR_RESULTADO.apcc)).toBe(true);
  });

  it('con un paquete posterior, la pantalla explica que no se puede corregir', () => {
    const siguiente = paquete({ id: 'paq-2', numero: 2, documentos: [{ codigo: 'C-2', resultado: null }] });
    montar({ supervision: { paquetes: [respondido, siguiente] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    expect(screen.queryByText('Corregir respuesta')).toBe(null);
    expect(screen.getByText(/Ya se armó el paquete 2/)).toBeTruthy();
  });
});

describe('al abrir el formulario, la pantalla sube hasta él', () => {
  it('encadenar desde una respuesta lleva la vista al formulario', async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const respondido = paquete({
      fecha_respuesta: '2026-09-15',
      documentos: [{ codigo: 'C-1', resultado: 'comentarios' }],
    });
    montar({ supervision: { paquetes: [respondido] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText(/Nuevo paquete con el que sigue con comentarios/));
    await new Promise((r) => setTimeout(r, 5));
    expect(scrollIntoView).toHaveBeenCalled();
  });
});

describe('a quién le sale la pestaña', () => {
  const detalle = [
    { nombre: 'CFM', supervision_tecnica: true },
    { nombre: 'Skandia', supervision_tecnica: true },
    { nombre: 'FENOGE', supervision_tecnica: false },
    { nombre: 'FMO' },
  ];

  it('solo a los inversionistas marcados', () => {
    expect(requiereSupervisionTecnica('CFM', detalle)).toBe(true);
    expect(requiereSupervisionTecnica('Skandia', detalle)).toBe(true);
    expect(requiereSupervisionTecnica('FENOGE', detalle)).toBe(false);
    expect(requiereSupervisionTecnica('FMO', detalle)).toBe(false);
    expect(requiereSupervisionTecnica('', detalle)).toBe(false);
    expect(requiereSupervisionTecnica('CFM', [])).toBe(false);
    expect(requiereSupervisionTecnica('CFM', undefined)).toBe(false);
  });
});

describe('dossier del proyecto', () => {
  it('agrupa por especialidad y arma el código real', () => {
    const grupos = dossierPorEspecialidad({
      inversionista: 'CFM', departamento: 'Boyacá', numero_minigranja: '147', numero_predio: '1',
    });
    expect(grupos.length).toBeGreaterThan(0);
    const primero = grupos[0].docs[0];
    expect(primero.codigoFinal).toContain('COLBOYT147P1');
    expect(primero.codigoFinal).not.toContain('COLXXXXXXPX');
  });

  it('sin datos de General deja el código con su placeholder', () => {
    const grupos = dossierPorEspecialidad({});
    expect(grupos[0].docs[0].codigoFinal).toContain('COLXXXXXXPX');
  });

  it('no revienta sin "general"', () => {
    expect(() => dossierPorEspecialidad(undefined)).not.toThrow();
  });
});

describe('respuestas parciales', () => {
  /* Supervisión devolvió dos de los tres el 15; la memoria eléctrica sigue
     esperando. */
  const parcial = paquete({
    fecha_respuesta: '2026-09-15',
    documentos: [
      { codigo: 'C-1', resultado: 'apc', fecha_respuesta: '2026-09-15' },
      { codigo: 'C-2', resultado: 'comentarios', fecha_respuesta: '2026-09-15' },
      { codigo: 'E-1', resultado: null },
    ],
  });
  /* El radio de un documento: APC, APCC o Con comentarios, en ese orden. */
  const marcar = (codigo, cual) => {
    const radios = document.querySelectorAll(`input[type="radio"][name$="-${codigo}"]`);
    fireEvent.click(radios[{ apc: 0, apcc: 1, comentarios: 2 }[cual]]);
  };
  const ponerFecha = (valor) => {
    const fechas = document.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[fechas.length - 1], { target: { value: valor } });
  };

  it('el que no tiene resultado sigue en revisión, aunque el paquete ya tenga respuesta', () => {
    const mapa = situacionPorDocumento([parcial]);
    expect(mapa.get('C-1').situacion).toBe(SITUACION.APC);
    expect(mapa.get('C-2').situacion).toBe(SITUACION.CON_COMENTARIOS);
    expect(mapa.get('E-1').situacion).toBe(SITUACION.EN_REVISION);
    expect(pendientesDeRespuesta(parcial).map((d) => d.codigo)).toEqual(['E-1']);
  });

  it('aplicar una respuesta solo toca los documentos marcados, con su fecha', () => {
    const resto = aplicarRespuesta(parcial, '2026-09-22', { 'E-1': 'apcc' });
    expect(resto.documentos.find((d) => d.codigo === 'E-1')).toMatchObject({ resultado: 'apcc', fecha_respuesta: '2026-09-22' });
    expect(resto.documentos.find((d) => d.codigo === 'C-1')).toMatchObject({ resultado: 'apc', fecha_respuesta: '2026-09-15' });
    /* El paquete queda con la fecha de la respuesta más reciente… */
    expect(resto.fecha_respuesta).toBe('2026-09-22');
    /* …aunque la que se registre de último sea de un día anterior. */
    expect(aplicarRespuesta({ ...parcial, fecha_respuesta: '2026-09-22' }, '2026-09-18', { 'E-1': 'apc' }).fecha_respuesta).toBe('2026-09-22');
    /* Al corregir, la respuesta se reescribe con la fecha que se puso. */
    expect(aplicarRespuesta(parcial, '2026-09-10', { 'C-1': 'apcc' }, { esCorreccion: true }).fecha_respuesta).toBe('2026-09-10');
  });

  /* Los paquetes guardados antes no tienen fecha por documento. */
  it('un paquete viejo toma la fecha del paquete', () => {
    const viejo = paquete({ fecha_respuesta: '2026-08-01', documentos: [{ codigo: 'C-1', resultado: 'apc' }, { codigo: 'C-2', resultado: null }] });
    expect(fechaDeRespuestaDe(viejo, viejo.documentos[0])).toBe('2026-08-01');
    expect(fechaDeRespuestaDe(viejo, viejo.documentos[1])).toBe('');
  });

  it('se puede guardar una respuesta con solo algunos documentos', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [paquete()] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText('Registrar respuesta'));
    ponerFecha('2026-09-15');
    /* Sin marcar ninguno no hay nada que guardar. */
    expect(screen.getByText('Guardar respuesta').disabled).toBe(true);
    marcar('C-1', 'apc');
    marcar('C-2', 'comentarios');
    expect(screen.getByText(/El documento sin marcar sigue esperando respuesta/)).toBeTruthy();
    fireEvent.click(screen.getByText('Guardar respuesta parcial'));
    fireEvent.click(screen.getByText('Guardar sin cambiar estados'));

    const [nuevaSupervision, accion] = onGuardar.mock.calls[0];
    const docs = nuevaSupervision.paquetes[0].documentos;
    expect(docs.map((d) => d.resultado)).toEqual(['apc', 'comentarios', null]);
    expect(docs[0].fecha_respuesta).toBe('2026-09-15');
    expect(nuevaSupervision.paquetes[0].fecha_respuesta).toBe('2026-09-15');
    expect(accion).toMatch(/quedan 1 esperando respuesta/);
  });

  it('la tarjeta dice cuántos faltan y cuáles', () => {
    montar({ supervision: { paquetes: [parcial] } });
    expect(screen.getByText('1 esperando respuesta')).toBeTruthy();
    fireEvent.click(screen.getByText('Paquete 1'));
    expect(screen.getByText(/parcial, 2 de 3/)).toBeTruthy();
    const tarjeta = within(screen.getByText('Paquete 1').closest('div.overflow-hidden'));
    const filaElectrica = tarjeta.getByText('Memoria eléctrica').parentElement;
    expect(filaElectrica.textContent).toContain('Esperando respuesta');
  });

  it('lo que falta se registra después, con su propia fecha', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [parcial] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText('Registrar lo que falta (1)'));
    /* Solo el que falta, y la fecha en blanco: es otra respuesta. */
    const tarjeta = within(screen.getByText('Paquete 1').closest('div.overflow-hidden'));
    expect(tarjeta.queryByText('Memoria civil')).toBe(null);
    expect(tarjeta.getByText('Memoria eléctrica')).toBeTruthy();
    expect(document.querySelectorAll('input[type="date"]')[0].value).toBe('');
    marcar('E-1', 'apc');
    ponerFecha('2026-09-22');
    fireEvent.click(screen.getByText('Guardar respuesta'));
    fireEvent.click(screen.getByText('Guardar sin cambiar estados'));

    const paq = onGuardar.mock.calls[0][0].paquetes[0];
    expect(paq.documentos.map((d) => d.resultado)).toEqual(['apc', 'comentarios', 'apc']);
    expect(paq.documentos.map((d) => d.fecha_respuesta)).toEqual(['2026-09-15', '2026-09-15', '2026-09-22']);
    expect(paq.fecha_respuesta).toBe('2026-09-22');
  });

  /* Los que volvieron con comentarios no tienen que esperar al resto: se
     pueden mandar en el paquete siguiente, y lo que falta del primero se
     sigue pudiendo registrar. */
  it('no hay que esperar el resto para armar la vuelta siguiente', () => {
    const siguiente = paquete({ id: 'paq-2', numero: 2, fecha_entrega: '2026-09-20', documentos: [{ codigo: 'C-2', resultado: null }] });
    montar({ supervision: { paquetes: [parcial, siguiente] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    expect(screen.queryByText('Corregir respuesta')).toBe(null);
    expect(screen.getByText('Registrar lo que falta (1)')).toBeTruthy();
  });

  it('las cifras del dossier cuentan al que falta como en revisión', () => {
    montar({ supervision: { paquetes: [parcial] } });
    const cifra = (etiqueta) => screen.getAllByText(etiqueta).find((n) => n.tagName === 'P').previousSibling.textContent;
    expect(cifra('En revisión')).toBe('1');
    expect(cifra('Con comentarios')).toBe('1');
  });
});

/* El caso de Girón Oriente 1: el paquete 1 tuvo respuesta parcial con
   comentarios; algunos se corrigieron en un paquete posterior y quedaron APC.
   Al volver al paquete 1 a resolver lo que falta, lo ya aprobado no se puede
   colar en el paquete nuevo. */
describe('volver a un paquete viejo después de corregir parte en otro', () => {
  const p1 = paquete({
    id: 'p1', numero: 1, fecha_respuesta: '2026-08-04',
    documentos: [
      { codigo: 'C-1', resultado: 'comentarios', fecha_respuesta: '2026-08-04' },
      { codigo: 'C-2', resultado: 'comentarios', fecha_respuesta: '2026-08-04' },
      { codigo: 'E-1', resultado: null },
    ],
  });
  const p2 = paquete({
    id: 'p2', numero: 2, fecha_entrega: '2026-09-04', fecha_respuesta: '2026-09-19',
    documentos: [{ codigo: 'C-1', resultado: 'apc', fecha_respuesta: '2026-09-19' }],
  });

  it('solo cuenta como pendiente del paquete lo que sigue con comentarios por él', () => {
    const situaciones = situacionPorDocumento([p1, p2]);
    expect(comentariosSinResolver(p1, situaciones).map((d) => d.codigo)).toEqual(['C-2']);
    expect(comentariosSinResolver(p2, situaciones)).toEqual([]);
  });

  /* Si se corrigió y volvió a tener comentarios en el otro paquete, ese es
     el que lo tiene pendiente, no el viejo. */
  it('si se reenvió y volvió con comentarios, lo tiene pendiente el paquete nuevo', () => {
    const p2ConCom = { ...p2, documentos: [{ codigo: 'C-1', resultado: 'comentarios', fecha_respuesta: '2026-09-19' }] };
    const situaciones = situacionPorDocumento([p1, p2ConCom]);
    expect(comentariosSinResolver(p1, situaciones).map((d) => d.codigo)).toEqual(['C-2']);
    expect(comentariosSinResolver(p2ConCom, situaciones).map((d) => d.codigo)).toEqual(['C-1']);
  });

  it('el botón del paquete viejo arma el paquete solo con lo que falta', () => {
    const { onGuardar } = montar({ supervision: { paquetes: [p1, p2] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText(/Nuevo paquete con el que sigue con comentarios/));
    const fechas = document.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[0], { target: { value: '2026-10-09' } });
    fireEvent.click(screen.getByText(/Crear paquete \(1\)/));
    const [nuevaSupervision] = onGuardar.mock.calls[0];
    expect(nuevaSupervision.paquetes[2].documentos.map((d) => d.codigo)).toEqual(['C-2']);
  });

  /* C-1 se reenvió y volvió a tener comentarios en el paquete 2: se puede
     enviar, pero es pendiente del 2, no del 1. */
  it('el botón del paquete viejo no se lleva lo que es pendiente de otro', () => {
    const p2ConCom = { ...p2, documentos: [{ codigo: 'C-1', resultado: 'comentarios', fecha_respuesta: '2026-09-19' }] };
    montar({ supervision: { paquetes: [p1, p2ConCom] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    fireEvent.click(screen.getByText(/Nuevo paquete con el que sigue con comentarios/));
    expect(screen.getByText(/Crear paquete \(1\)/)).toBeTruthy();
  });

  /* Defensa propia del formulario: aunque le lleguen preseleccionados, los
     que no se pueden enviar no cuentan. */
  it('el formulario descarta de la preselección lo que no se puede enviar', () => {
    const onSave = vi.fn();
    render(
      <PaqueteForm
        grupos={GRUPOS} situaciones={situacionPorDocumento([p1, p2])} preseleccion={['C-1', 'C-2']}
        numero={3} onCancel={() => {}} onSave={onSave}
      />,
    );
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-10-09' } });
    fireEvent.click(screen.getByText(/Crear paquete \(1\)/));
    expect(onSave.mock.calls[0][0]).toEqual(['C-2']);
  });

  it('si ya se corrigieron todos, el paquete viejo no ofrece armar otro', () => {
    const p2Todos = { ...p2, documentos: [
      { codigo: 'C-1', resultado: 'apc', fecha_respuesta: '2026-09-19' },
      { codigo: 'C-2', resultado: 'apc', fecha_respuesta: '2026-09-19' },
    ] };
    montar({ supervision: { paquetes: [p1, p2Todos] } });
    fireEvent.click(screen.getByText('Paquete 1'));
    expect(screen.queryByText(/Nuevo paquete con/)).toBe(null);
  });
});

