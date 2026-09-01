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
  SITUACION, situacionPorDocumento, sePuedeEnviar, ESTADO_POR_RESULTADO,
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
    fireEvent.click(screen.getByText('Todos APC'));
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
    fireEvent.click(screen.getByText('Todos con comentarios'));
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
