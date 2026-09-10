/* ============================================================================
   DISEÑO DE VÍA — la pantalla
   ----------------------------------------------------------------------------
   Reemplaza la hoja de cálculo que el equipo pasaba de correo en correo. El
   cálculo entero vive en shared/disenoVia.js y aquí solo se pinta: así lo que
   hay que comprobar contra los ejemplos resueltos se puede probar sin montar
   una pantalla.

   Va en DOS pestañas, y la razón es cuál dato cambia y cuál no:

   - "Diseño" es la que se usa siempre. De un proyecto a otro solo cambian
     tres cosas —las estaciones de lluvia, el CBR sumergido y los materiales—
     más el espesor que uno decide darle a cada capa. Eso es todo lo que pide,
     y termina mostrando la sección dibujada para ver en qué queda.

   - "Parámetros del cálculo" tiene el resto: el vehículo de diseño, el
     tránsito, la confiabilidad. Son constantes de cómo diseña la empresa, no
     decisiones de cada proyecto, y una equivocación ahí mueve todos los
     espesores sin que nada se vea raro. Por eso solo el Desarrollador los
     edita; los demás los ven, que es lo que hace falta para revisar un
     resultado — esconderlos volvería el cálculo una caja negra.

   Dos cosas que la hoja no podía hacer y son la razón de traerla aquí:

   - Los números estructurales se resuelven solos. En el Excel había que
     correr "Buscar objetivo" tres veces y el resultado quedaba escrito a
     mano, así que un archivo guardado a medio converger daba espesores que
     nadie volvía a mirar.

   - El diseño se guarda DENTRO del proyecto, con sus entradas. Meses después
     se reabre, se ve de dónde salió cada número y se recalcula si cambió el
     CBR. Un espesor suelto en un campo no se puede defender ante Supervisión.
   ============================================================================ */

import React, { useState, useMemo } from 'react';
import {
  Route, Save, Download, Check, Copy, TriangleAlert, ExternalLink, Lock, SlidersHorizontal,
} from 'lucide-react';
import { isDeveloper, isAssignedToProject } from '../shared/permisos.js';
import { copiarTexto } from '../shared/copiar.jsx';
import { formatoFechaHora } from '../shared/formatos.js';
import { SeccionDeVia } from './seccionDeVia.jsx';
import { TablaEstaciones } from '../shared/TablaEstaciones.jsx';
import {
  MATERIALES, TIPOS_EJE, CALIDADES_DRENAJE, NIVELES_CONFIABILIDAD,
  formularioPorDefecto, calcularDesdeFormulario, datosDelProyecto,
  textoDelDiseno, desdeFormulario, estacionesVacias,
} from '../shared/disenoVia.js';

/* Un número con las cifras que tiene sentido mostrar, o una raya si todavía
   no se puede calcular. Nunca "NaN" ni "null" en pantalla. */
function cifra(valor, decimales = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

const ENTRADA = 'w-full rounded-md border border-navy-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
const LEIDO = 'w-full rounded-md border border-navy-200 bg-navy-50 px-2 py-1.5 text-sm text-navy-500 font-mono';

/* Con `soloLectura` el campo se ve pero no se toca. No se esconde: para
   revisar un resultado hay que poder ver con qué se calculó. */
function Campo({ label, sufijo, valor, onChange, ancho = '', soloLectura }) {
  return (
    <label className={`flex flex-col gap-1 ${ancho}`}>
      <span className="text-xs font-semibold text-navy-500">{label}</span>
      <span className="flex items-center gap-1.5">
        {soloLectura
          ? <span className={LEIDO}>{valor === '' || valor === null || valor === undefined ? '—' : valor}</span>
          : <input className={ENTRADA} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} />}
        {sufijo && <span className="text-xs text-navy-400 shrink-0">{sufijo}</span>}
      </span>
    </label>
  );
}

function Selector({ label, valor, onChange, opciones, ancho = '', soloLectura }) {
  const elegida = opciones.find((o) => String(o.valor) === String(valor));
  return (
    <label className={`flex flex-col gap-1 ${ancho}`}>
      <span className="text-xs font-semibold text-navy-500">{label}</span>
      {soloLectura
        ? <span className={LEIDO}>{elegida ? elegida.label : '—'}</span>
        : (
          <select className={ENTRADA} value={valor} onChange={(e) => onChange(e.target.value)}>
            {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
        )}
    </label>
  );
}

function Panel({ titulo, children, pie }) {
  return (
    <div className="bg-white border border-navy-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">{titulo}</p>
      {children}
      {pie && <div className="mt-3 pt-3 border-t border-navy-100">{pie}</div>}
    </div>
  );
}

/* Un resultado calculado: etiqueta, valor y unidad. Se ven distintos de los
   campos que se escriben, para que nadie intente corregir uno de estos. */
function Dato({ label, valor, unidad, destacado }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${destacado ? 'bg-lime-50 border border-lime-200' : 'bg-navy-50'}`}>
      <p className="text-[11px] text-navy-500">{label}</p>
      <p className={`font-mono ${destacado ? 'text-base font-bold text-navy-800' : 'text-sm text-navy-700'}`}>
        {valor} {unidad && <span className="text-xs font-normal text-navy-400">{unidad}</span>}
      </p>
    </div>
  );
}

export default function DisenoViaView({ perfil, projects, onGuardarEnProyecto, onAbrirProyecto }) {
  const [form, setForm] = useState(() => formularioPorDefecto());
  const [proyectoId, setProyectoId] = useState('');
  const [pestana, setPestana] = useState('diseno');
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const r = useMemo(() => calcularDesdeFormulario(form), [form]);

  const proyecto = (projects || []).find((p) => p.id === proyectoId) || null;
  const guardado = proyecto ? (proyecto.data || {}).diseno_via : null;
  const puedeGuardar = !!proyecto && (isDeveloper(perfil) || isAssignedToProject(perfil, proyecto));
  /* Los parámetros del cálculo son de la empresa, no del proyecto: una
     equivocación ahí mueve todos los espesores sin que nada se vea raro. */
  const soloLectura = !isDeveloper(perfil);

  const set = (clave) => (valor) => { setForm((p) => ({ ...p, [clave]: valor })); setAviso(null); };

  function setEje(i, clave, valor) {
    setForm((p) => ({ ...p, ejes: p.ejes.map((e, j) => (j === i ? { ...e, [clave]: valor } : e)) }));
  }

  /* Traer del proyecto NO pisa lo que el proyecto no tiene: si allá no hay
     CBR sumergido, aquí se queda el que estuviera escrito. */
  function traerDelProyecto() {
    if (!proyecto) return;
    const traidos = datosDelProyecto(proyecto);
    if (Object.keys(traidos).length === 0) {
      setAviso({ tipo: 'nada', texto: 'Ese proyecto todavía no tiene estaciones pluviométricas ni CBR sumergido.' });
      return;
    }
    setForm((p) => ({ ...p, ...traidos }));
    const qué = [traidos.estaciones && 'las estaciones', traidos.cbrSubrasantePct !== undefined && 'el CBR sumergido']
      .filter(Boolean).join(' y ');
    setAviso({ tipo: 'ok', texto: `Se trajo ${qué} de ${proyecto.nombre}.` });
  }

  function abrirGuardado() {
    if (!guardado) return;
    setForm({ ...formularioPorDefecto(), ...guardado.entradas });
    setAviso({ tipo: 'ok', texto: `Se abrió el diseño guardado en ${proyecto.nombre}.` });
  }

  function guardar() {
    if (!puedeGuardar) return;
    onGuardarEnProyecto(proyecto.id, {
      entradas: form,
      resumen: {
        espesorCapa1: form.espesorCapa1,
        espesorCapa2: form.espesorCapa2,
        materialCapa1: r.capa1 ? r.capa1.nombre : null,
        materialCapa2: r.capa2 ? r.capa2.nombre : null,
        cumple: r.cumple,
      },
      guardado_por: perfil?.nombre || null,
      updated_at: new Date().toISOString(),
    });
    setAviso({ tipo: 'ok', texto: `Diseño guardado en ${proyecto.nombre}.` });
  }

  async function copiar() {
    if (!(await copiarTexto(textoDelDiseno(desdeFormulario(form), r)))) {
      window.alert('El navegador no dejó copiar. Selecciona el texto a mano.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  const filas = form.estaciones && form.estaciones.length ? form.estaciones : estacionesVacias();

  const pestanas = [
    { key: 'diseno', label: 'Diseño', icon: Route },
    { key: 'parametros', label: 'Parámetros del cálculo', icon: SlidersHorizontal },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2 mb-1">
        <Route className="w-6 h-6 text-navy-400" /> Diseño de vía
      </h1>
      <p className="text-sm text-navy-500 mb-5">
        Espesor de las capas por el método AASHTO 93, con dos capas sobre la subrasante.
      </p>

      {/* ---------------------------------------------------- el proyecto */}
      <div className="bg-navy-50 border border-navy-200 rounded-xl p-3 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 flex-1 min-w-[14rem]">
            <span className="text-xs font-semibold text-navy-500">Proyecto</span>
            <select className={ENTRADA} value={proyectoId} onChange={(e) => { setProyectoId(e.target.value); setAviso(null); }}>
              <option value="">Sin proyecto — solo para tantear</option>
              {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <button
            onClick={traerDelProyecto}
            disabled={!proyecto}
            className="flex items-center gap-1.5 text-sm font-semibold text-navy-600 bg-white border border-navy-300 rounded-lg px-3 py-1.5 hover:border-navy-400 disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Traer sus datos
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            title={proyecto && !puedeGuardar ? 'Solo quien está en el equipo del proyecto puede guardar ahí' : undefined}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy-800 rounded-lg px-3 py-1.5 hover:bg-navy-900 disabled:opacity-40"
          >
            <Save className="w-4 h-4" /> Guardar en el proyecto
          </button>
          <button
            onClick={copiar}
            className="flex items-center gap-1.5 text-sm font-semibold text-navy-600 bg-white border border-navy-300 rounded-lg px-3 py-1.5 hover:border-navy-400"
          >
            {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {proyecto && !puedeGuardar && (
          <p className="text-xs text-navy-500 mt-2">
            Puedes traer sus datos y diseñar, pero guardar ahí es de quien está en su equipo.
          </p>
        )}

        {guardado && (
          <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-navy-600">
            <span>
              Ya tiene un diseño guardado
              {guardado.guardado_por ? ` por ${guardado.guardado_por}` : ''}
              {guardado.updated_at ? ` · ${formatoFechaHora(guardado.updated_at)}` : ''}.
            </span>
            <button onClick={abrirGuardado} className="font-semibold text-lime-600 hover:text-lime-700 underline">
              Abrirlo
            </button>
            {onAbrirProyecto && (
              <button onClick={() => onAbrirProyecto(proyecto.id)} className="flex items-center gap-1 text-navy-500 hover:text-navy-700">
                <ExternalLink className="w-3.5 h-3.5" /> Ir al proyecto
              </button>
            )}
          </div>
        )}

        {aviso && (
          <p className={`text-xs mt-2 ${aviso.tipo === 'ok' ? 'text-emerald-700' : 'text-navy-500'}`}>{aviso.texto}</p>
        )}
      </div>

      {/* ------------------------------------------------------- pestañas */}
      <div className="flex gap-1 flex-wrap mb-5">
        {pestanas.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              onClick={() => setPestana(p.key)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                pestana === p.key ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-500 border-navy-300 hover:border-navy-400'
              }`}
            >
              <Icon className="w-4 h-4" /> {p.label}
              {p.key === 'parametros' && soloLectura && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      {pestana === 'diseno' ? (
        <>
          <Panel titulo="Perfil de la rasante">
            <SeccionDeVia
              nombreCapa1={r.capa1 ? r.capa1.nombre : null}
              nombreCapa2={r.capa2 ? r.capa2.nombre : null}
              espesorCapa1={form.espesorCapa1}
              espesorCapa2={form.espesorCapa2}
            />
          </Panel>

          <Campo label="Nombre del diseño" valor={form.nombre} onChange={set('nombre')} ancho="mb-4 max-w-md" />

          <Panel titulo="Materiales y subrasante">
            <div className="flex flex-wrap gap-3">
              <Selector
                label="Capa 1 — rodadura"
                valor={form.materialCapa1}
                onChange={set('materialCapa1')}
                opciones={MATERIALES.map((m) => ({ valor: m.id, label: m.nombre }))}
                ancho="w-60"
              />
              <Selector
                label="Capa 2"
                valor={form.materialCapa2}
                onChange={set('materialCapa2')}
                opciones={MATERIALES.map((m) => ({ valor: m.id, label: m.nombre }))}
                ancho="w-60"
              />
              <Campo label="CBR sumergido de la subrasante" sufijo="%" valor={form.cbrSubrasantePct} onChange={set('cbrSubrasantePct')} ancho="w-56" />
            </div>
          </Panel>

          <Panel
            titulo="Estaciones pluviométricas"
            pie={<div className="grid grid-cols-2 gap-2">
              <Dato label="Tiempo cerca de saturación" valor={cifra(r.saturacion * 100, 1)} unidad="%" />
              <Dato label="Coeficiente de drenaje (m)" valor={cifra(r.m, 3)} />
            </div>}
          >
            <TablaEstaciones filas={filas} onChange={set('estaciones')} />

            {/* Con la tabla en blanco no hay nada que avisar todavía: el aviso
                es para quien ya escribió pesos y no le suman. */}
            {r.sumaPesos > 0 && !r.pesosCuadran && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-3">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Los pesos no suman 100%. El promedio ponderado —y con él el coeficiente de drenaje— sale de lo que haya.
              </p>
            )}
          </Panel>

          <Panel titulo="Espesores">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy-50">
                    <th className="text-left font-semibold text-navy-500 px-2 py-1.5">Capa</th>
                    <th className="text-left font-semibold text-navy-500 px-2 py-1.5 w-32">Mínimo</th>
                    <th className="text-left font-semibold text-navy-500 px-2 py-1.5 w-36">Escogido (cm)</th>
                    <th className="text-left font-semibold text-navy-500 px-2 py-1.5 w-32">SN que aporta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-navy-100">
                    <td className="px-2 py-2 text-navy-700">{r.capa1 ? r.capa1.nombre : 'Capa 1'}</td>
                    <td className="px-2 py-2 font-mono text-navy-500">{cifra(r.h1CalculadoCm, 1)} cm</td>
                    <td className="p-1.5"><input className={ENTRADA} value={form.espesorCapa1 ?? ''} onChange={(e) => set('espesorCapa1')(e.target.value)} /></td>
                    <td className="px-2 py-2 font-mono text-navy-700">{cifra(r.sn1Ajustado, 3)}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 text-navy-700">{r.capa2 ? r.capa2.nombre : 'Capa 2'}</td>
                    <td className="px-2 py-2 font-mono text-navy-500">{cifra(r.h2CalculadoCm, 1)} cm</td>
                    <td className="p-1.5"><input className={ENTRADA} value={form.espesorCapa2 ?? ''} onChange={(e) => set('espesorCapa2')(e.target.value)} /></td>
                    <td className="px-2 py-2 font-mono text-navy-700">{cifra(r.sn2Ajustado, 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-4 pt-3 border-t border-navy-100">
              <Dato label="Suma de SN aportados" valor={cifra(r.snTotal, 3)} />
              <Dato label="SN requerido" valor={cifra(r.sn3, 3)} />
              <span className={`text-sm font-bold px-3 py-2 rounded-lg ${
                r.cumple === null ? 'bg-navy-100 text-navy-500'
                  : r.cumple ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
              }`}>
                {r.cumple === null ? 'Faltan datos' : r.cumple ? 'Cumple' : 'No cumple'}
              </span>
            </div>

            {r.cumple === false && (
              <p className="text-xs text-navy-500 mt-2">
                Con esos espesores la estructura no alcanza el número estructural que pide el tránsito. Sube el de
                cualquiera de las dos capas, o usa un material con mejor CBR.
              </p>
            )}
          </Panel>
        </>
      ) : (
        <>
          {soloLectura && (
            <p className="flex items-start gap-1.5 text-xs text-navy-600 bg-nashville-50 border border-nashville-300 rounded-xl px-3 py-2.5 mb-4">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Estos valores no cambian de un proyecto a otro: son la forma en que la empresa diseña. Se pueden
              consultar para revisar un resultado, pero solo el Desarrollador los edita.
            </p>
          )}

          <Panel
            titulo="Vehículo de diseño"
            pie={<div className="grid grid-cols-2 gap-2">
              <Dato label="Factor camión" valor={cifra(r.factorCamion, 3)} />
              <Dato label="Peso total" valor={cifra(r.pesoTotal, 1)} unidad="ton" />
            </div>}
          >
            <div className="space-y-2">
              {(form.ejes || []).map((eje, i) => {
                const tipo = TIPOS_EJE.find((t) => t.id === eje.tipo);
                return (
                  <div key={eje.tipo} className="flex items-end gap-2 flex-wrap">
                    <span className="text-sm text-navy-600 w-28 shrink-0 pb-1.5">{tipo ? tipo.label : eje.tipo}</span>
                    <Campo label="Cantidad" valor={eje.cantidad} onChange={(v) => setEje(i, 'cantidad', v)} ancho="w-28" soloLectura={soloLectura} />
                    <Campo label="Peso por eje" sufijo="ton" valor={eje.peso} onChange={(v) => setEje(i, 'peso', v)} ancho="w-36" soloLectura={soloLectura} />
                    <span className="text-xs text-navy-400 pb-2">referencia {tipo ? tipo.referencia : '—'} ton</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            titulo="Tránsito"
            pie={<Dato label="Ejes equivalentes en el periodo (W18)" valor={cifra(r.w18, 0)} destacado />}
          >
            <div className="flex flex-wrap gap-3">
              <Campo label="Tránsito promedio diario (TPD)" valor={form.tpd} onChange={set('tpd')} ancho="w-52" soloLectura={soloLectura} />
              <Campo label="Tasa de crecimiento" sufijo="%" valor={form.tasaPct} onChange={set('tasaPct')} ancho="w-40" soloLectura={soloLectura} />
              <Campo label="Periodo de diseño" sufijo="años" valor={form.periodo} onChange={set('periodo')} ancho="w-40" soloLectura={soloLectura} />
              <Campo label="Factor direccional" sufijo="%" valor={form.direccionalPct} onChange={set('direccionalPct')} ancho="w-40" soloLectura={soloLectura} />
              <Campo label="Vehículos comerciales" sufijo="%" valor={form.comercialesPct} onChange={set('comercialesPct')} ancho="w-44" soloLectura={soloLectura} />
            </div>
          </Panel>

          <Panel titulo="Serviciabilidad, confiabilidad y drenaje">
            <div className="flex flex-wrap gap-3">
              <Selector
                label="Confiabilidad (R)"
                valor={String(form.confiabilidadPct)}
                onChange={(v) => set('confiabilidadPct')(Number(v))}
                opciones={NIVELES_CONFIABILIDAD.map((n) => ({
                  valor: String(n.r * 100),
                  label: `${(n.r * 100).toFixed(n.r * 100 % 1 === 0 ? 0 : 1)}% — Zr ${n.zr}`,
                }))}
                ancho="w-56"
                soloLectura={soloLectura}
              />
              <Campo label="Error estándar (So)" valor={form.errorEstandar} onChange={set('errorEstandar')} ancho="w-40" soloLectura={soloLectura} />
              <Campo label="Serviciabilidad inicial" valor={form.servInicial} onChange={set('servInicial')} ancho="w-44" soloLectura={soloLectura} />
              <Campo label="Serviciabilidad final" valor={form.servFinal} onChange={set('servFinal')} ancho="w-44" soloLectura={soloLectura} />
              <Selector
                label="Calidad del drenaje"
                valor={form.calidadDrenaje}
                onChange={set('calidadDrenaje')}
                opciones={CALIDADES_DRENAJE.map((c) => ({ valor: c.id, label: c.label }))}
                ancho="w-52"
                soloLectura={soloLectura}
              />
            </div>
          </Panel>

          <Panel titulo="Módulos y números estructurales">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              <Dato label="Mr subrasante" valor={cifra(r.mrSubrasante, 0)} unidad="psi" />
              <Dato label={`Mr ${r.capa1 ? r.capa1.nombre : 'capa 1'}`} valor={cifra(r.mrCapa1, 0)} unidad="psi" />
              <Dato label={`Mr ${r.capa2 ? r.capa2.nombre : 'capa 2'}`} valor={cifra(r.mrCapa2, 0)} unidad="psi" />
              <Dato label="Coeficiente a1" valor={cifra(r.a1, 3)} />
              <Dato label="Coeficiente a2" valor={cifra(r.a2, 3)} />
              <Dato label="ΔPSI" valor={cifra(r.deltaPsi, 2)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Dato label="SN1" valor={cifra(r.sn1, 3)} />
              <Dato label="SN2 (referencia)" valor={cifra(r.sn2, 3)} />
              <Dato label="SN3 — el que hay que alcanzar" valor={cifra(r.sn3, 3)} destacado />
            </div>
            {/* SN2 se calcula porque estaba en la hoja, pero no entra en ningún
                espesor: los de la capa 2 salen de SN3. */}
            <p className="text-xs text-navy-400 mt-2">
              SN2 se muestra como referencia: el espesor de la capa 2 se mide contra SN3, el de la subrasante.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
