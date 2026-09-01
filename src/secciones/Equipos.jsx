/* ============================================================================
   EQUIPOS ELÉCTRICOS — formulario y vista de la sección
   ----------------------------------------------------------------------------
   Movido literal desde App.jsx. Se descarga solo al abrir la sección; los
   tipos, la semilla y el ícono viven en equiposDatos.jsx porque también se
   usan dentro de un proyecto.
   ============================================================================ */

import React, { useState } from 'react';
import { Copy, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import { ResumenLineas, atributosLineas } from '../shared/ui.jsx';
import { EQUIPO_TIPOS, EquipoIcono } from './equiposDatos.jsx';

/* Ancho/estilo común de los campos de texto de esta sección. */
export const EQUIPO_INPUT_CSS = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';


export function EquipoForm({ tipoDef, plantilla, onCancel, onSave }) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [especificacion, setEspecificacion] = useState(plantilla?.datos?.especificacion || '');
  const [atributos, setAtributos] = useState(() => {
    const base = {};
    tipoDef.campos.forEach((c) => { base[c] = ''; });
    return { ...base, ...(plantilla?.datos?.atributos || {}) };
  });
  const [imagen, setImagen] = useState(plantilla?.datos?.imagen || null);
  const [errorImagen, setErrorImagen] = useState('');

  function setAtributo(campo, val) {
    setAtributos((prev) => ({ ...prev, [campo]: val }));
  }

  function handleImagenChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorImagen('');
    if (file.size > 3 * 1024 * 1024) {
      setErrorImagen('La imagen no puede pesar más de 3 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagen(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim(), { especificacion, atributos, imagen });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {plantilla?.__duplicando ? 'Nueva plantilla (copia)' : plantilla ? 'Editar plantilla' : 'Nueva plantilla'} · {tipoDef.label}
      </p>

      <div className="flex justify-center bg-navy-50 rounded-lg p-4 mb-5">
        <div className="text-center">
          {imagen ? (
            <div>
              <img src={imagen} alt={tipoDef.label} className="max-w-[16rem] max-h-52 rounded-lg border border-navy-200 object-contain mx-auto" />
              <button type="button" onClick={() => setImagen(null)} className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600">
                Quitar imagen
              </button>
            </div>
          ) : (
            <EquipoIcono tipoId={tipoDef.id} className="w-36 h-36 mx-auto" />
          )}
          <label className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700 cursor-pointer">
            <UploadCloud className="w-3.5 h-3.5" />
            {imagen ? 'Cambiar imagen' : 'Subir una foto/imagen'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
          </label>
          {!imagen && <p className="text-[11px] text-navy-400 mt-1">Si no subes una imagen, se muestra este ícono genérico.</p>}
          {errorImagen && <p className="text-[11px] text-red-500 mt-1">{errorImagen}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la plantilla</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={`${tipoDef.label} Marca Modelo`} className={EQUIPO_INPUT_CSS} required />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Especificación</label>
          <input value={especificacion} onChange={(e) => setEspecificacion(e.target.value)} placeholder="Ej. 655 Wp, 15 kV, 1250 A..." className={EQUIPO_INPUT_CSS} />
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-3">Atributos</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {tipoDef.campos.map((campo) => (
          <div key={campo}>
            <label className="block text-xs text-navy-500 mb-1">{campo}</label>
            <input value={atributos[campo] || ''} onChange={(e) => setAtributo(campo, e.target.value)} className={EQUIPO_INPUT_CSS} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          {plantilla ? 'Guardar cambios' : 'Crear plantilla'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* Vista principal de la pestaña — mismo patrón exacto que CimentacionesView: */
/* selector de tipo, botón "nueva plantilla", formulario, y grid de tarjetas. */
export function EquiposElectricosView({ plantillas, onAdd, onUpdate, onDelete }) {
  const [tipoActivo, setTipoActivo] = useState(EQUIPO_TIPOS[0].id);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [duplicandoDesde, setDuplicandoDesde] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);

  const tipoDef = EQUIPO_TIPOS.find((t) => t.id === tipoActivo);
  const plantillasDelTipo = plantillas.filter((p) => p.tipo === tipoActivo);

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
    setDuplicandoDesde(null);
  }
  function duplicar(p) {
    setDuplicandoDesde({ nombre: `${p.nombre} (copia)`, datos: JSON.parse(JSON.stringify(p.datos)), __duplicando: true });
    setCreando(true);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Equipos eléctricos</h1>
        <p className="text-navy-500 text-sm mt-1">
          Plantillas reutilizables de equipos eléctricos — se crean una vez y se usan en cualquier proyecto sin volver a digitarlas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {EQUIPO_TIPOS.map((t) => {
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
              {t.label}
              <span className={activo ? 'text-navy-300' : 'text-navy-400'}>({cantidad})</span>
            </button>
          );
        })}
      </div>

      {!creando && !editandoId && (
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg mb-5 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva plantilla de {tipoDef.label}
        </button>
      )}

      {(creando || editandoId) && (
        <EquipoForm
          tipoDef={tipoDef}
          plantilla={editandoId ? plantillasDelTipo.find((p) => p.id === editandoId) : (duplicandoDesde || null)}
          onCancel={cerrarFormulario}
          onSave={(nombre, datos) => {
            if (editandoId) onUpdate(editandoId, { nombre, datos });
            else onAdd(tipoActivo, nombre, datos);
            cerrarFormulario();
          }}
        />
      )}

      {!creando && !editandoId && (
        plantillasDelTipo.length === 0 ? (
          <p className="text-sm text-navy-400 italic text-center py-10">Aún no hay plantillas de {tipoDef.label}.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillasDelTipo.map((p) => (
              <div key={p.id} className="bg-white border border-navy-200 rounded-xl p-4">
                <div className="flex items-center justify-center mb-2" style={{ minHeight: '9rem' }}>
                  {p.datos?.imagen ? (
                    <img src={p.datos.imagen} alt={p.nombre} className="max-h-36 rounded-lg object-contain" />
                  ) : (
                    <EquipoIcono tipoId={p.tipo} className="w-28 h-28" />
                  )}
                </div>
                <p className="font-semibold text-navy-800 text-sm text-center mb-1">{p.nombre}</p>
                <div className="mb-3">
                  {p.datos?.especificacion && (
                    <p className="text-xs font-semibold text-navy-600 text-center mb-1">{p.datos.especificacion}</p>
                  )}
                  <ResumenLineas lineas={atributosLineas(p.datos)} size="text-xs" align="center" />
                  {!p.datos?.especificacion && atributosLineas(p.datos).length === 0 && (
                    <p className="text-xs text-navy-300 italic text-center">Sin atributos definidos</p>
                  )}
                </div>
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
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default EquiposElectricosView;
