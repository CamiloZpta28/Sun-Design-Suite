/* ============================================================================
   ACTUALIZACIONES DE DISEÑO — registro global, por categoría
   ----------------------------------------------------------------------------
   Sección completa (movida literal desde App.jsx, sin cambiar su
   comportamiento). Se descarga solo cuando alguien abre Actualizaciones.

   La campanita de notificaciones NO está aquí: vive en App.jsx porque se
   pinta siempre, en la barra superior de cualquier sección.
   ============================================================================ */

import React, { useState, useEffect } from 'react';
import { ClipboardPaste, ExternalLink, MapPin, Pencil, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { ALL_ROLE_DEFS, isLeader } from '../shared/permisos.js';
import { formatoFechaHora } from '../shared/formatos.js';
import { normalizeUrl } from '../shared/dominio.jsx';


/* Quita tildes/mayúsculas para comparar texto "a ojo" (ej. para que        */
/* "tuberia" y "Tubería" se reconozcan como la misma etiqueta).             */
export function normalizarTexto(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* Las ubicaciones que ya se usaron, con su link. Hay unas pocas que se
   repiten siempre ("Biblioteca civil", "Carpeta de cantidades"…): en vez de
   una lista aparte que alguien tenga que mantener, la primera vez que se
   escribe una con su link queda disponible para las siguientes.

   Se comparan sin tildes ni mayúsculas, como las etiquetas, y se queda la
   escritura y el link de la más reciente que tenga link: si la carpeta se
   movió y alguien puso el link nuevo, ese es el que se sugiere. */
export function ubicacionesConocidas(actualizaciones) {
  const porNombre = new Map();
  [...(actualizaciones || [])]
    .filter((a) => (a.ubicacion || '').trim())
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .forEach((a) => {
      const clave = normalizarTexto(a.ubicacion.trim());
      const previa = porNombre.get(clave);
      if (!previa) porNombre.set(clave, { nombre: a.ubicacion.trim(), url: a.ubicacion_url || '' });
      else if (!previa.url && a.ubicacion_url) porNombre.set(clave, { ...previa, url: a.ubicacion_url });
    });
  return [...porNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* `categorias` solo llega cuando se crea desde la pestaña "Todas": ahí no
   hay una categoría activa que dé por sentada, así que se elige aquí. */
export function ActualizacionForm({ actualizacion, etiquetasConocidas, ubicacionesConocidas: conocidas, categorias, onCancel, onSave }) {
  const pideCategoria = !actualizacion && Array.isArray(categorias);
  const [categoriaId, setCategoriaId] = useState('');
  const [nombre, setNombre] = useState(actualizacion?.nombre || '');
  const [descripcion, setDescripcion] = useState(actualizacion?.descripcion || '');
  const [interesados, setInteresados] = useState(actualizacion?.interesados || []);
  const [ubicacion, setUbicacion] = useState(actualizacion?.ubicacion || '');
  const [ubicacionUrl, setUbicacionUrl] = useState(actualizacion?.ubicacion_url || '');
  /* El link que se llenó solo, para saber si se puede reemplazar: si la
     persona escribió el suyo, no se le pisa al cambiar la ubicación. */
  const [linkSugerido, setLinkSugerido] = useState('');

  function cambiarUbicacion(valor) {
    setUbicacion(valor);
    const conocida = (conocidas || []).find((u) => normalizarTexto(u.nombre) === normalizarTexto(valor.trim()));
    const linkPropio = ubicacionUrl.trim() && ubicacionUrl !== linkSugerido;
    if (linkPropio) return;
    const nuevo = conocida?.url || '';
    setUbicacionUrl(nuevo);
    setLinkSugerido(nuevo);
  }
  /* Al salir del campo, si es una ubicación conocida escrita distinto
     ("biblioteca civil"), queda con la escritura de siempre. */
  function fijarEscrituraDeUbicacion() {
    const conocida = (conocidas || []).find((u) => normalizarTexto(u.nombre) === normalizarTexto(ubicacion.trim()));
    if (conocida) setUbicacion(conocida.nombre);
  }
  const [etiquetas, setEtiquetas] = useState(actualizacion?.etiquetas || []);
  const [etiquetaEnCurso, setEtiquetaEnCurso] = useState('');
  const [imagen, setImagen] = useState(actualizacion?.imagen || null);
  const [errorImagen, setErrorImagen] = useState('');

  function toggleInteresado(key) {
    setInteresados((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function agregarEtiqueta(valorCrudo) {
    // Si lo que se digitó/eligió coincide (sin importar mayúsculas ni       */
    // tildes) con una etiqueta YA usada antes, se guarda con la            */
    // ORTOGRAFÍA EXACTA de esa etiqueta existente — así nunca queda        */
    // "Tubería" y "tuberia" como dos etiquetas distintas por accidente.    */
    const limpio = valorCrudo.trim();
    if (!limpio) return;
    const existente = (etiquetasConocidas || []).find((e) => normalizarTexto(e) === normalizarTexto(limpio));
    const final = existente || limpio;
    setEtiquetas((prev) => (prev.some((e) => normalizarTexto(e) === normalizarTexto(final)) ? prev : [...prev, final]));
    setEtiquetaEnCurso('');
  }
  function quitarEtiqueta(et) {
    setEtiquetas((prev) => prev.filter((e) => e !== et));
  }
  function handleEtiquetaKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      agregarEtiqueta(etiquetaEnCurso);
    }
  }
  /* La imagen llega por tres caminos —examinar, el botón de pegar y Ctrl+V—
     y los tres pasan por aquí, con el mismo límite. */
  function cargarImagen(archivo) {
    setErrorImagen('');
    if (archivo.size > 3 * 1024 * 1024) {
      setErrorImagen('La imagen no puede pesar más de 3 MB. Si es un pantallazo, recórtalo a la parte que importa.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagen(reader.result);
    reader.readAsDataURL(archivo);
  }
  function handleImagenChange(e) {
    const file = e.target.files?.[0];
    if (file) cargarImagen(file);
    e.target.value = '';
  }
  /* Ctrl+V en cualquier parte del formulario. Solo se intercepta si lo que se
     pega es una imagen: pegar texto en el nombre o la descripción sigue
     funcionando como siempre. */
  function handlePegar(e) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const archivo = item?.getAsFile();
    if (!archivo) return;
    e.preventDefault();
    cargarImagen(archivo);
  }
  /* El botón lee el portapapeles directamente. No todos los navegadores lo
     permiten (Firefox no, y Chrome pide permiso la primera vez); si no se
     puede, se dice cómo hacerlo con Ctrl+V, que funciona en todos. */
  async function pegarDelPortapapeles() {
    setErrorImagen('');
    if (!navigator.clipboard?.read) {
      setErrorImagen('Este navegador no deja leer el portapapeles desde el botón: haz clic en el formulario y pega con Ctrl+V.');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const tipo = item.types.find((t) => t.startsWith('image/'));
        if (tipo) {
          cargarImagen(await item.getType(tipo));
          return;
        }
      }
      setErrorImagen('No hay ninguna imagen en el portapapeles.');
    } catch {
      setErrorImagen('No se pudo leer el portapapeles (¿se negó el permiso?). Haz clic en el formulario y pega con Ctrl+V.');
    }
  }
  function submit(e) {
    e.preventDefault();
    if (!nombre.trim() || (pideCategoria && !categoriaId)) return;
    onSave({
      nombre: nombre.trim(), descripcion: descripcion.trim(), interesados,
      ubicacion: ubicacion.trim(), ubicacion_url: ubicacionUrl.trim(), etiquetas, imagen,
    }, categoriaId || null);
  }
  const cellInput = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';

  return (
    <form onSubmit={submit} onPaste={handlePegar} className="bg-white border border-navy-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-4">
        {actualizacion ? 'Editar actualización' : 'Nueva actualización'}
      </p>

      <div className="grid grid-cols-1 gap-4 mb-4">
        {pideCategoria && (
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Categoría</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoría" className={cellInput}>
              <option value="">Elige la categoría…</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Nombre de la actualización</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={cellInput} required />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Descripción de la actualización</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className={cellInput} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Interesados</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 border border-navy-100 rounded-lg p-3">
            {ALL_ROLE_DEFS.map((r) => (
              <label key={r.key} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                <input type="checkbox" checked={interesados.includes(r.key)} onChange={() => toggleInteresado(r.key)} className="w-3.5 h-3.5 accent-lime-500" />
                <span className="text-sm text-navy-700">{r.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Ubicación de la actualización</label>
          <input
            list="ubicaciones-conocidas"
            value={ubicacion}
            onChange={(e) => cambiarUbicacion(e.target.value)}
            onBlur={fijarEscrituraDeUbicacion}
            aria-label="Ubicación"
            placeholder="Ej. Plano estructural — hoja 3"
            className={cellInput}
          />
          <datalist id="ubicaciones-conocidas">
            {(conocidas || []).map((u) => <option key={u.nombre} value={u.nombre} />)}
          </datalist>
          <input
            value={ubicacionUrl}
            onChange={(e) => setUbicacionUrl(e.target.value)}
            aria-label="Link de la ubicación"
            placeholder="Link de la ubicación (opcional), ej. la carpeta de Drive"
            className={`${cellInput} mt-2`}
          />
          <p className="text-[11px] text-navy-400 mt-0.5">
            Si eliges una ubicación que ya se usó (ej. Biblioteca civil), su link se llena solo.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Etiquetas</label>
          {etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {etiquetas.map((et) => (
                <span key={et} className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded-full">
                  #{et}
                  <button type="button" onClick={() => quitarEtiqueta(et)} className="text-sky-400 hover:text-sky-700" title="Quitar">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              list="etiquetas-conocidas"
              value={etiquetaEnCurso}
              onChange={(e) => setEtiquetaEnCurso(e.target.value)}
              onKeyDown={handleEtiquetaKeyDown}
              placeholder="Escribe una etiqueta y presiona Enter…"
              className={cellInput}
            />
            <datalist id="etiquetas-conocidas">
              {(etiquetasConocidas || []).map((et) => <option key={et} value={et} />)}
            </datalist>
            <button type="button" onClick={() => agregarEtiqueta(etiquetaEnCurso)} className="shrink-0 text-sm font-semibold text-lime-600 hover:text-lime-700 px-3">
              + Agregar
            </button>
          </div>
          <p className="text-[11px] text-navy-400 mt-0.5">
            Si ya existe una etiqueta parecida, elígela de la lista para que quede escrita igual — así se encuentra mejor en el buscador.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Imagen de la actualización</label>
          <div className="flex items-center gap-3">
            {imagen && <img src={imagen} alt="" className="max-h-20 rounded border border-navy-200 object-contain" />}
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700 cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5" />
              {imagen ? 'Cambiar imagen' : 'Subir imagen'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
            </label>
            <button
              type="button"
              onClick={pegarDelPortapapeles}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 hover:text-lime-700"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Pegar del portapapeles
            </button>
            {imagen && (
              <button type="button" onClick={() => setImagen(null)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar imagen
              </button>
            )}
          </div>
          <p className="text-[11px] text-navy-400 mt-1">También puedes pegar un pantallazo con Ctrl+V en cualquier parte del formulario.</p>
          {errorImagen && <p className="text-xs text-red-500 mt-1">{errorImagen}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!nombre.trim() || (pideCategoria && !categoriaId)} className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          {actualizacion ? 'Guardar cambios' : 'Crear actualización'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-navy-500 hover:text-navy-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* La pestaña con las de todas las categorías. Es la que abre por defecto:
   lo que la gente quiere ver al entrar es qué cambió últimamente, no la
   primera categoría de la lista. */
export const TODAS = 'todas';

export function ActualizacionesView({ categorias, actualizaciones, perfil, onAddCategoria, onRenameCategoria, onDeleteCategoria, onAdd, onUpdate, onDelete, categoriaPreseleccionada }) {
  const [categoriaActiva, setCategoriaActiva] = useState(categoriaPreseleccionada || TODAS);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [confirmandoCategoria, setConfirmandoCategoria] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [imagenAmpliada, setImagenAmpliada] = useState(null);

  // Al llegar desde una notificación de actualización, salta directo a la
  // categoría correspondiente (en vez de quedarse en la primera).
  useEffect(() => {
    if (categoriaPreseleccionada) setCategoriaActiva(categoriaPreseleccionada);
  }, [categoriaPreseleccionada]);

  // Todas las etiquetas que ya se han usado alguna vez, en cualquier
  // categoría — para sugerirlas al escribir una nueva (así queda escrita
  // igual que la vez anterior, sin duplicados por mayúsculas/tildes).
  const etiquetasConocidas = Array.from(new Set(actualizaciones.flatMap((a) => a.etiquetas || []))).sort();

  /* Si la categoría activa se borró (aquí o desde otro computador), se
     vuelve a "Todas" en vez de saltar a otra categoría cualquiera. */
  const categoriaObj = categorias.find((c) => c.id === categoriaActiva) || null;
  const enTodas = !categoriaObj;
  const busquedaLimpia = normalizarTexto(busqueda.trim());
  // Con una búsqueda activa, el buscador es GLOBAL (no hace falta entrar a
  // la categoría): se buscan TODAS las actualizaciones, de cualquier
  // categoría, y cada resultado muestra a qué categoría pertenece.
  const buscandoGlobal = !!busquedaLimpia;
  function coincideBusqueda(a) {
    const enEtiquetas = (a.etiquetas || []).some((et) => normalizarTexto(et).includes(busquedaLimpia));
    const enNombre = normalizarTexto(a.nombre).includes(busquedaLimpia);
    const enDescripcion = normalizarTexto(a.descripcion).includes(busquedaLimpia);
    return enEtiquetas || enNombre || enDescripcion;
  }
  const deEstaCategoria = (buscandoGlobal || enTodas ? actualizaciones : actualizaciones.filter((a) => a.categoria_id === categoriaObj.id))
    .filter((a) => (buscandoGlobal ? coincideBusqueda(a) : true))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // más reciente primero

  function cerrarFormulario() {
    setCreando(false);
    setEditandoId(null);
  }
  function crearCategoria() {
    const nombre = prompt('Nombre de la nueva categoría:');
    if (nombre && nombre.trim()) onAddCategoria(nombre.trim());
  }
  function renombrarCategoria(cat) {
    const nombre = prompt('Nuevo nombre para esta categoría:', cat.nombre);
    if (nombre && nombre.trim() && nombre.trim() !== cat.nombre) onRenameCategoria(cat.id, nombre.trim());
  }
  const puedeGestionarCategorias = isLeader(perfil);

  if (categorias.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-navy-800 mb-4">Actualizaciones</h1>
        <button onClick={crearCategoria} className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nueva categoría
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Actualizaciones</h1>
        <p className="text-navy-500 text-sm mt-1">Registro de actualizaciones de diseño, por categoría. Se muestra primero la más reciente.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setCategoriaActiva(TODAS); setBusqueda(''); cerrarFormulario(); }}
          className={`text-sm font-semibold px-3 py-2 rounded-lg border ${
            enTodas ? 'bg-navy-800 border-navy-800 text-white' : 'bg-white border-navy-200 text-navy-600 hover:text-navy-800'
          }`}
        >
          Todas <span className={enTodas ? 'text-navy-300' : 'text-navy-400'}>({actualizaciones.length})</span>
        </button>
        {categorias.map((c) => {
          const activo = categoriaActiva === c.id;
          const cantidad = actualizaciones.filter((a) => a.categoria_id === c.id).length;
          return (
            <div key={c.id} className={`flex items-center gap-1 rounded-lg border ${activo ? 'bg-navy-800 border-navy-800' : 'bg-white border-navy-200'}`}>
              <button
                onClick={() => { setCategoriaActiva(c.id); setBusqueda(''); cerrarFormulario(); }}
                className={`text-sm font-semibold pl-3 pr-1.5 py-2 ${activo ? 'text-white' : 'text-navy-600 hover:text-navy-800'}`}
              >
                {c.nombre} <span className={activo ? 'text-navy-300' : 'text-navy-400'}>({cantidad})</span>
              </button>
              {puedeGestionarCategorias && (
                <>
                  <button onClick={() => renombrarCategoria(c)} title="Renombrar" className={`p-1.5 ${activo ? 'text-navy-300 hover:text-white' : 'text-navy-400 hover:text-navy-700'}`}>
                    <Pencil className="w-3 h-3" />
                  </button>
                  {confirmandoCategoria === c.id ? (
                    <span className="flex items-center gap-1 pr-2 text-xs">
                      <button onClick={() => { onDeleteCategoria(c.id); setConfirmandoCategoria(null); if (categoriaActiva === c.id) setCategoriaActiva(TODAS); }} className="font-bold text-red-500">Sí</button>
                      <button onClick={() => setConfirmandoCategoria(null)} className={activo ? 'text-navy-300' : 'text-navy-400'}>No</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmandoCategoria(c.id)} title="Eliminar categoría" className={`p-1.5 pr-2.5 ${activo ? 'text-navy-300 hover:text-red-300' : 'text-navy-400 hover:text-red-500'}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        <button onClick={crearCategoria} className="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg border border-dashed border-navy-300 text-navy-500 hover:border-navy-500 hover:text-navy-700">
          <Plus className="w-3.5 h-3.5" /> Nueva categoría
        </button>
      </div>

      {!creando && !editandoId && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> {enTodas ? 'Nueva actualización' : `Nueva actualización en "${categoriaObj.nombre}"`}
          </button>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en TODAS las categorías…"
              className="w-full pl-9 pr-8 py-2.5 text-sm rounded-lg border border-navy-200 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600" title="Limpiar búsqueda">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {buscandoGlobal && (
            <span className="text-xs text-navy-400 italic">
              Buscando en todas las categorías — {deEstaCategoria.length} resultado{deEstaCategoria.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      {(creando || editandoId) && (
        <ActualizacionForm
          actualizacion={editandoId ? deEstaCategoria.find((a) => a.id === editandoId) : null}
          etiquetasConocidas={etiquetasConocidas}
          ubicacionesConocidas={ubicacionesConocidas(actualizaciones)}
          categorias={enTodas ? categorias : undefined}
          onCancel={cerrarFormulario}
          onSave={(datos, categoriaElegida) => {
            if (editandoId) onUpdate(editandoId, datos);
            else onAdd(enTodas ? categoriaElegida : categoriaObj.id, datos);
            cerrarFormulario();
          }}
        />
      )}

      {!creando && !editandoId && (
        deEstaCategoria.length === 0 ? (
          <p className="text-sm text-navy-400 italic text-center py-10">
            {busquedaLimpia
              ? `Ninguna actualización (en ninguna categoría) coincide con "${busqueda}".`
              : enTodas ? 'Aún no hay actualizaciones.' : `Aún no hay actualizaciones en "${categoriaObj.nombre}".`}
          </p>
        ) : (
          <div className="space-y-4">
            {deEstaCategoria.map((a) => (
              <div key={a.id} className="bg-white border border-navy-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    {(buscandoGlobal || enTodas) && (
                      <button
                        onClick={() => { setCategoriaActiva(a.categoria_id); setBusqueda(''); }}
                        className="text-[11px] font-semibold uppercase text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full mb-1.5 inline-block hover:bg-lime-200"
                      >
                        {categorias.find((c) => c.id === a.categoria_id)?.nombre || 'Sin categoría'}
                      </button>
                    )}
                    <p className="font-semibold text-navy-800">{a.nombre}</p>
                    <p className="text-xs text-navy-400 mt-0.5">
                      Agregada por {a.creado_por || 'alguien del equipo'} · {formatoFechaHora(a.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setEditandoId(a.id)} className="text-xs font-semibold text-lime-600 hover:text-lime-700 flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    {confirmandoId === a.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-navy-500">¿Eliminar?</span>
                        <button onClick={() => { onDelete(a.id); setConfirmandoId(null); }} className="text-xs font-bold text-red-600 hover:text-red-700">Sí</button>
                        <button onClick={() => setConfirmandoId(null)} className="text-xs text-navy-400 hover:text-navy-600">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmandoId(a.id)} className="text-xs font-semibold text-navy-400 hover:text-red-500 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
                {a.descripcion && <p className="text-sm text-navy-600 mt-2">{a.descripcion}</p>}
                {a.imagen && (
                  <img
                    src={a.imagen}
                    alt=""
                    onClick={() => setImagenAmpliada(a.imagen)}
                    className="mt-3 max-h-56 rounded-lg border border-navy-200 object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                    title="Click para ampliar"
                  />
                )}

                {/* Ubicación: separada de Interesados/Etiquetas — línea propia, */}
                {/* estilo de texto simple (no una "pastilla" más), para que no */}
                {/* se confunda visualmente con los demás badges.              */}
                {/* Con link, la ubicación entera es el enlace; sin texto,  */}
                {/* el enlace se nombra solo, para no mostrar una URL larga.  */}
                {(a.ubicacion || a.ubicacion_url) && (
                  <p className="flex items-center gap-1.5 text-sm text-navy-600 mt-3">
                    <MapPin className="w-3.5 h-3.5 text-navy-400 shrink-0" />
                    {a.ubicacion_url ? (
                      <a
                        href={normalizeUrl(a.ubicacion_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-nashville-600 hover:text-nashville-700 underline underline-offset-2 break-all"
                      >
                        {a.ubicacion || 'Abrir ubicación'} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : a.ubicacion}
                  </p>
                )}

                {(a.interesados || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-[11px] font-semibold uppercase text-navy-400 mr-0.5">Interesados:</span>
                    {a.interesados.map((key) => {
                      const rol = ALL_ROLE_DEFS.find((r) => r.key === key);
                      if (!rol) return null;
                      return (
                        <span key={key} className="inline-flex items-center gap-1 text-xs font-medium text-lime-800 bg-lime-100 px-2 py-1 rounded-full">
                          {rol.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {(a.etiquetas || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-semibold uppercase text-navy-400 mr-0.5">Etiquetas:</span>
                    {a.etiquetas.map((et) => (
                      <span key={et} className="inline-flex items-center gap-0.5 text-xs font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded-full">
                        #{et}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Lightbox: clic en una imagen la agranda sobre toda la pantalla;    */}
      {/* clic afuera o en la X la cierra.                                   */}
      {imagenAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-navy-900/90 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setImagenAmpliada(null)}
        >
          <button
            onClick={() => setImagenAmpliada(null)}
            className="absolute top-4 right-4 text-white bg-navy-800/70 hover:bg-navy-800 rounded-full p-2"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={imagenAmpliada} alt="" className="max-w-full max-h-full object-contain rounded-lg cursor-default" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default ActualizacionesView;
