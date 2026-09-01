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
  SITUACION, situacionPorDocumento, sePuedeEnviar, estaAprobado, sePuedeEditarRespuesta,
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
    fireEvent.click(screen.getByText(/Nuevo paquete con los 2 que tienen comentarios/));

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
    fireEvent.click(screen.getByText(/Nuevo paquete con los 1 que tienen comentarios/));
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
    fireEvent.click(screen.getByText(/Nuevo paquete con los 1 que tienen comentarios/));
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
