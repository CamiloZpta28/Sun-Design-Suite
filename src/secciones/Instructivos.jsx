/* ============================================================================
   INSTRUCTIVOS — carpetas y videos de YouTube
   ----------------------------------------------------------------------------
   Sección completa (movida literal desde App.jsx, sin cambiar su
   comportamiento). Vive aparte para que su código se descargue solo cuando
   alguien entra a Instructivos: quien únicamente mira el Dashboard nunca lo
   baja. App.jsx la carga con React.lazy — ver la constante SECCIONES allí.
   ============================================================================ */

import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Folder, FolderPlus, Pencil, PlayCircle, Plus,
  Trash2, Video, X,
} from 'lucide-react';

/* Reconoce youtube.com/watch?v=, youtu.be/, /embed/ y /shorts/ y devuelve  */
/* solo el ID del video, o null si el link no se pudo reconocer.           */
export function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1].split('/')[0];
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1].split('/')[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}


export function VideoCard({ video, abierto, onToggle, onEdit, onDelete }) {
  const [confirmando, setConfirmando] = useState(false);
  const videoId = extractYouTubeId(video.url);

  return (
    <div className="border border-navy-200 rounded-lg overflow-hidden bg-white">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-navy-50 transition-colors">
        {videoId ? (
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            className="w-24 h-14 object-cover rounded-md shrink-0 bg-navy-100"
          />
        ) : (
          <div className="w-24 h-14 rounded-md bg-navy-100 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-navy-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-700 truncate">{video.titulo}</p>
          {video.descripcion && <p className="text-xs text-navy-400 truncate">{video.descripcion}</p>}
        </div>
        <PlayCircle className="w-5 h-5 text-lime-500 shrink-0" />
      </button>
      {abierto && (
        <div className="border-t border-navy-200">
          {videoId ? (
            <div className="aspect-video bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={video.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-red-500 p-3">No se pudo reconocer el link de YouTube de este video.</p>
          )}
          <div className="flex items-center justify-end gap-3 px-3 py-2 bg-navy-50">
            <button onClick={onEdit} className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-lime-600">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {confirmando ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-navy-500">¿Eliminar?</span>
                <button onClick={() => { onDelete(); setConfirmando(false); }} className="text-xs font-bold text-red-600 hover:text-red-700">
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmando(false)} className="text-xs text-navy-400 hover:text-navy-600">
                  Cancelar
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmando(true)} className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FolderFormModal({ initial, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSave(nombre.trim());
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy-800">{initial ? 'Renombrar carpeta' : 'Nueva carpeta'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            autoFocus
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Diseño Eléctrico"
            className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-navy-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VideoFormModal({ initial, carpetas, onClose, onSave }) {
  const [titulo, setTitulo] = useState(initial?.titulo || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion || '');
  const [carpetaId, setCarpetaId] = useState(initial?.carpeta_id || '');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;
    if (!extractYouTubeId(url)) {
      setError('No se reconoce ese link como un video de YouTube válido.');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      url: url.trim(),
      descripcion: descripcion.trim() || null,
      carpeta_id: carpetaId || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-900 bg-opacity-50 overflow-y-auto flex items-start justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy-800">{initial ? 'Editar video' : 'Nuevo video'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Título *</label>
            <input
              required
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="Ej. Cómo calcular la zona de viento"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Link de YouTube *</label>
            <input
              required
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-400"
              placeholder="https://youtu.be/… o https://www.youtube.com/watch?v=…"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Descripción (opcional)</label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-navy-500 mb-1">Carpeta</label>
            <select value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)} className="w-full rounded-lg border border-navy-300 px-3 py-2 text-sm">
              <option value="">Sin carpeta</option>
              {carpetas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-navy-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-lime-500 hover:bg-lime-600 text-navy-900 rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InstructivosView({ carpetas, videos, onAddCarpeta, onUpdateCarpeta, onDeleteCarpeta, onAddVideo, onUpdateVideo, onDeleteVideo }) {
  const [openFolders, setOpenFolders] = useState({});
  const [openVideoId, setOpenVideoId] = useState(null);
  const [folderModal, setFolderModal] = useState(null); // null | 'new' | {id, nombre}
  const [videoModal, setVideoModal] = useState(null); // null | 'new' | video
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);

  function toggleFolder(id) {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleVideo(id) {
    setOpenVideoId((prev) => (prev === id ? null : id));
  }

  const sinCarpeta = videos.filter((v) => !v.carpeta_id);
  const gruposCarpeta = carpetas.map((c) => ({ carpeta: c, videos: videos.filter((v) => v.carpeta_id === c.id) }));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Instructivos</h1>
          <p className="text-navy-500 text-sm mt-1">Videos explicando procesos de la etapa de diseño, organizados en carpetas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFolderModal('new')}
            className="flex items-center gap-2 bg-white border border-navy-300 hover:border-lime-400 text-navy-700 font-semibold text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <FolderPlus className="w-4 h-4" /> Nueva carpeta
          </button>
          <button
            onClick={() => setVideoModal('new')}
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-3 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo video
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {gruposCarpeta.map(({ carpeta, videos: videosCarpeta }) => (
          <div key={carpeta.id} className="bg-white border border-navy-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-navy-50 border-b border-navy-200">
              <button onClick={() => toggleFolder(carpeta.id)} className="flex items-center gap-2 text-sm font-bold text-navy-700 flex-1 text-left min-w-0">
                {openFolders[carpeta.id] ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <Folder className="w-4 h-4 text-nashville-500 shrink-0" />
                <span className="truncate">{carpeta.nombre}</span>
                <span className="text-xs font-normal text-navy-400 shrink-0">({videosCarpeta.length})</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setFolderModal(carpeta)} title="Renombrar carpeta" className="text-navy-400 hover:text-lime-600 p-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {confirmDeleteFolder === carpeta.id ? (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-xs text-navy-500 whitespace-nowrap">¿Eliminar carpeta y sus {videosCarpeta.length} video(s)?</span>
                    <button
                      onClick={() => { onDeleteCarpeta(carpeta.id); setConfirmDeleteFolder(null); }}
                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md whitespace-nowrap"
                    >
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmDeleteFolder(null)} className="text-xs text-navy-400 hover:text-navy-600 px-1">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteFolder(carpeta.id)} title="Eliminar carpeta" className="text-navy-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {openFolders[carpeta.id] && (
              <div className="p-3 space-y-2">
                {videosCarpeta.length === 0 ? (
                  <p className="text-sm text-navy-400 italic text-center py-4">Esta carpeta no tiene videos todavía.</p>
                ) : (
                  videosCarpeta.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      abierto={openVideoId === v.id}
                      onToggle={() => toggleVideo(v.id)}
                      onEdit={() => setVideoModal(v)}
                      onDelete={() => onDeleteVideo(v.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        <div className="bg-white border border-navy-200 rounded-xl overflow-hidden">
          <div className="flex items-center px-4 py-3 bg-navy-50 border-b border-navy-200">
            <p className="flex items-center gap-2 text-sm font-bold text-navy-700 flex-1">
              <Folder className="w-4 h-4 text-navy-400" /> Sin carpeta <span className="text-xs font-normal text-navy-400">({sinCarpeta.length})</span>
            </p>
          </div>
          <div className="p-3 space-y-2">
            {sinCarpeta.length === 0 ? (
              <p className="text-sm text-navy-400 italic text-center py-4">No hay videos sueltos.</p>
            ) : (
              sinCarpeta.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  abierto={openVideoId === v.id}
                  onToggle={() => toggleVideo(v.id)}
                  onEdit={() => setVideoModal(v)}
                  onDelete={() => onDeleteVideo(v.id)}
                />
              ))
            )}
          </div>
        </div>

        {carpetas.length === 0 && videos.length === 0 && (
          <p className="text-sm text-navy-400 italic text-center py-12">
            Aún no hay instructivos. Crea una carpeta o agrega tu primer video.
          </p>
        )}
      </div>

      {folderModal && (
        <FolderFormModal
          initial={folderModal === 'new' ? null : folderModal}
          onClose={() => setFolderModal(null)}
          onSave={(nombre) => {
            if (folderModal === 'new') onAddCarpeta(nombre);
            else onUpdateCarpeta(folderModal.id, nombre);
            setFolderModal(null);
          }}
        />
      )}

      {videoModal && (
        <VideoFormModal
          initial={videoModal === 'new' ? null : videoModal}
          carpetas={carpetas}
          onClose={() => setVideoModal(null)}
          onSave={(data) => {
            if (videoModal === 'new') onAddVideo(data);
            else onUpdateVideo(videoModal.id, data);
            setVideoModal(null);
          }}
        />
      )}
    </div>
  );
}

export default InstructivosView;
