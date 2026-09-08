/* ============================================================================
   DOSSIERS — qué documentos lleva cada proyecto y quién responde por ellos
   ----------------------------------------------------------------------------
   Antes las tres listas de documentos (estándar, CFM, FENOGE) vivían en el
   código y se elegían con un `if` por el nombre del inversionista: agregar un
   documento era un cambio de código y un despliegue. Ahora viven en la base y
   se gestionan desde aquí.

   La regla que sostiene todo lo demás: UN DOSSIER EN USO NO SE TOCA. Lo que
   un proyecto guarda de cada documento —estado, historial de entregas,
   observaciones, comentarios— se guarda con el CÓDIGO como llave. Si alguien
   le cambiara el código a un documento, o lo borrara, ese trabajo quedaría
   huérfano en todos los proyectos que lo usan: no se borraría, pero nadie
   volvería a encontrarlo, y en pantalla se vería como un documento en blanco,
   sin ningún error que lo delatara. Por eso, en cuanto un proyecto usa un
   dossier, su lista de documentos queda congelada y para cambiarla hay que
   sacar una versión nueva (duplicar) — igual que una plantilla que ya se usó.

   La excepción son los RESPONSABLES, que sí se editan siempre: no son parte
   de lo que el proyecto guarda, solo se leen al armar el resumen semanal. Si
   también se congelaran, confirmar que el hidráulico revisa el drenaje
   obligaría a sacar una versión nueva, y quedarían dos dossiers idénticos
   salvo por una letra.
   ============================================================================ */

import React, { useState } from 'react';
import { Archive, ArchiveRestore, ChevronLeft, Copy, FileText, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FiltroFichas, alternarEn } from '../shared/ui.jsx';
import { ROLES, puedeGestionarDossiers } from '../shared/permisos.js';
import { PAPELES_DOCUMENTO, etiquetaDossier } from '../shared/dominio.jsx';
import SelectOrOtro from '../technical-notes/SelectOrOtro.jsx';

/* Valores que ya usan los dossiers de hoy. No son una lista cerrada: el
   selector deja escribir otro, porque un inversionista nuevo puede traer una
   especialidad o un tipo que aquí no estén. */
export const ESPECIALIDADES_SUGERIDAS = ['GENERAL', 'CIVIL', 'MECANICA', 'COMUNICACIONES', 'ELECTRICA'];
export const TIPOS_SUGERIDOS = ['Plano', 'Informe', 'Memoria', 'Listado', 'Lista de materiales', 'Especificaciones tecnicas'];

/* Cuántos proyectos usan este dossier. Sale de los proyectos que la
   aplicación ya tiene cargados, no de una consulta aparte. */
export function proyectosQueUsan(dossierId, projects) {
  return (projects || []).filter((p) => p.dossier_id === dossierId);
}

/* Al duplicar "CFM 2" se propone "CFM 3": la versión siguiente de esa misma
   familia, no la siguiente de la que se copió (por si se duplica una vieja). */
export function siguienteVersion(nombre, dossiers) {
  const versiones = (dossiers || []).filter((d) => d.nombre === nombre).map((d) => d.version || 1);
  return versiones.length === 0 ? 1 : Math.max(...versiones) + 1;
}

/* ---------------------------------------------------------------- responsables */

/* Los 7 roles de un documento, en fila. Cada uno pasa por vacío → E → R →
   vacío con un clic, que es lo que hace llevadero repartir 254 documentos. */
function ChipsResponsables({ responsables, editable, onCambiar }) {
  const actual = responsables || {};
  function siguiente(papel) {
    if (!papel) return 'E';
    if (papel === 'E') return 'R';
    return null;
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      {ROLES.map((rol) => {
        const papel = actual[rol.key];
        const titulo = papel
          ? `${rol.label}: ${PAPELES_DOCUMENTO.find((p) => p.key === papel)?.label || papel}`
          : `${rol.label}: sin participación${editable ? ' — clic para asignar' : ''}`;
        const clase = papel === 'E'
          ? 'bg-lime-300 text-navy-900 border-lime-400'
          : papel === 'R'
            ? 'bg-nashville-200 text-navy-800 border-nashville-300'
            : 'bg-white text-navy-300 border-navy-200';
        const contenido = (
          <>
            <span className="font-semibold">{rol.corto}</span>
            {papel && <span className="font-bold">{papel}</span>}
          </>
        );
        if (!editable) {
          return (
            <span key={rol.key} title={titulo} className={`text-[10px] leading-none px-1.5 py-1 rounded border flex items-center gap-0.5 ${clase}`}>
              {contenido}
            </span>
          );
        }
        return (
          <button
            key={rol.key}
            type="button"
            title={titulo}
            onClick={() => {
              const papelNuevo = siguiente(papel);
              const copia = { ...actual };
              if (papelNuevo) copia[rol.key] = papelNuevo;
              else delete copia[rol.key];
              onCambiar(copia);
            }}
            className={`text-[10px] leading-none px-1.5 py-1 rounded border flex items-center gap-0.5 transition-colors hover:border-navy-400 ${clase}`}
          >
            {contenido}
          </button>
        );
      })}
    </div>
  );
}

function LeyendaResponsables() {
  return (
    <p className="text-xs text-navy-400">
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-lime-300 border-lime-400 text-navy-900 text-[10px] font-semibold">E</span>{' '}
      lo elabora o lo dibuja ·{' '}
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-nashville-200 border-nashville-300 text-navy-800 text-[10px] font-semibold">R</span>{' '}
      lo revisa · en gris, ese rol no participa. Un clic va cambiando de uno al otro.
    </p>
  );
}

/* ------------------------------------------------------------------ documento */

function FormularioDocumento({ documento, onGuardar, onCancelar }) {
  const [campos, setCampos] = useState({
    codigo: documento?.codigo || 'COLXXXXXXPX-',
    nombre: documento?.nombre || '',
    especialidad: documento?.especialidad || 'CIVIL',
    tipo: documento?.tipo || 'Plano',
  });
  const entrada = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  const listo = campos.codigo.trim() && campos.nombre.trim();

  return (
    <div className="border border-lime-400 bg-lime-50/40 rounded-lg p-3 mb-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-navy-500 mb-1">Nombre del documento</label>
          <input
            autoFocus
            value={campos.nombre}
            onChange={(e) => setCampos({ ...campos, nombre: e.target.value })}
            placeholder="Ej. Cerramiento"
            className={entrada}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-navy-500 mb-1">Código</label>
          <input
            value={campos.codigo}
            onChange={(e) => setCampos({ ...campos, codigo: e.target.value })}
            placeholder="COLXXXXXXPX-CIV-PL-009"
            className={`${entrada} font-mono`}
          />
          <p className="text-xs text-navy-400 mt-1">
            El prefijo <span className="font-mono">COLXXXXXXPX</span> se reemplaza solo con el código de cada proyecto.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1">Especialidad</label>
          <SelectOrOtro
            value={campos.especialidad}
            opciones={ESPECIALIDADES_SUGERIDAS}
            onChange={(val) => setCampos({ ...campos, especialidad: val })}
            className={entrada}
            placeholder="Ej. AMBIENTAL"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1">Tipo</label>
          <SelectOrOtro
            value={campos.tipo}
            opciones={TIPOS_SUGERIDOS}
            onChange={(val) => setCampos({ ...campos, tipo: val })}
            className={entrada}
            placeholder="Ej. Acta"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!listo}
          onClick={() => onGuardar({ ...campos, codigo: campos.codigo.trim(), nombre: campos.nombre.trim() })}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-4 py-1.5 rounded-lg"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detalle */

function DossierDetalle({
  dossier, projects, inversionistas, inversionistasDetalle, perfil, onVolver,
  onGuardarDocumento, onQuitarDocumento, onCambiarResponsables, onAsignarInversionista,
}) {
  const [especialidades, setEspecialidades] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const gestiona = puedeGestionarDossiers(perfil);
  const enUso = proyectosQueUsan(dossier.id, projects);
  /* La estructura se congela en cuanto un proyecto lo usa; los responsables no
     (ver la cabecera del archivo). */
  const puedeEditarEstructura = gestiona && enUso.length === 0;
  const documentos = dossier.documentos || [];

  const conteoPor = (campo) => {
    const mapa = new Map();
    documentos.forEach((d) => mapa.set(d[campo], (mapa.get(d[campo]) || 0) + 1));
    return [...mapa.entries()].map(([valor, conteo]) => ({ valor, conteo }));
  };
  const visibles = documentos.filter(
    (d) => (especialidades.length === 0 || especialidades.includes(d.especialidad))
      && (tipos.length === 0 || tipos.includes(d.tipo)),
  );

  const grupos = [];
  const porEspecialidad = new Map();
  visibles.forEach((doc) => {
    if (!porEspecialidad.has(doc.especialidad)) {
      porEspecialidad.set(doc.especialidad, grupos.length);
      grupos.push({ especialidad: doc.especialidad, docs: [] });
    }
    grupos[porEspecialidad.get(doc.especialidad)].docs.push(doc);
  });

  const sinResponsable = documentos.filter((d) => Object.keys(d.responsables || {}).length === 0).length;
  const usanEste = (inversionistasDetalle || []).filter((i) => i.dossier_id === dossier.id).map((i) => i.nombre);

  /* Dos documentos con el mismo código en un dossier son un choque de llaves:
     el proyecto guarda su trabajo POR código, así que el segundo se comería lo
     del primero. La base lo impide con un índice único, pero su error no dice
     nada — mejor avisarlo aquí, con el nombre del que ya lo tiene. */
  function guardarDocumento(campos) {
    const repetido = documentos.find((d) => d.codigo === campos.codigo && d.id !== campos.id);
    if (repetido) {
      window.alert(`Ya hay un documento con el código ${campos.codigo} en este dossier: "${repetido.nombre}". Los códigos no se pueden repetir, porque cada proyecto guarda su trabajo por código.`);
      return false;
    }
    onGuardarDocumento(dossier.id, campos);
    return true;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700 mb-4">
        <ChevronLeft className="w-4 h-4" /> Todos los dossiers
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-bold text-navy-800">{etiquetaDossier(dossier)}</h1>
        {dossier.archivado && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-navy-100 text-navy-500">Archivado</span>
        )}
      </div>
      <p className="text-sm text-navy-500 mb-4">
        {documentos.length} documentos ·{' '}
        {enUso.length === 0 ? 'sin usar todavía' : `en uso por ${enUso.length} ${enUso.length === 1 ? 'proyecto' : 'proyectos'}`}
        {sinResponsable > 0 && ` · ${sinResponsable} sin responsable`}
      </p>

      {enUso.length > 0 && (
        <div className="flex items-start gap-2 bg-nashville-50 border border-nashville-300 rounded-xl px-3 py-2.5 mb-5">
          <Lock className="w-4 h-4 text-navy-600 shrink-0 mt-0.5" />
          <p className="text-xs text-navy-600">
            <span className="font-semibold">La lista de documentos está congelada.</span> {enUso.length}{' '}
            {enUso.length === 1 ? 'proyecto guarda su trabajo' : 'proyectos guardan su trabajo'} contra estos códigos
            ({enUso.slice(0, 3).map((p) => p.nombre).join(', ')}{enUso.length > 3 ? '…' : ''}), y cambiarlos
            dejaría ese trabajo sin dónde aparecer. Para cambiar los documentos, duplica el dossier y modifica la
            copia. Los responsables sí se pueden seguir ajustando aquí.
          </p>
        </div>
      )}

      {/* ----------------------------------------- inversionistas que lo usan */}
      <div className="bg-white border border-navy-200 rounded-xl p-4 mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">Inversionistas que lo usan por defecto</p>
        <p className="text-xs text-navy-400 mb-3">
          Es solo la sugerencia que aparece al crear un proyecto: quien lo crea puede elegir otro, y lo que quede
          escogido ahí es lo que manda.
        </p>
        {usanEste.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {usanEste.map((nombre) => (
              <span key={nombre} className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy-100 text-navy-700 flex items-center gap-1.5">
                {nombre}
                {gestiona && (
                  <button onClick={() => onAsignarInversionista(nombre, null)} title="Quitar" className="text-navy-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-navy-300 italic mb-3">Ningún inversionista lo tiene puesto por defecto.</p>
        )}
        {gestiona && (
          <select
            value=""
            onChange={(e) => e.target.value && onAsignarInversionista(e.target.value, dossier.id)}
            className="rounded-md border border-navy-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">+ Asignar un inversionista…</option>
            {(inversionistas || []).filter((n) => !usanEste.includes(n)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}
      </div>

      {/* ------------------------------------------------------- documentos */}
      <div className="mb-3">
        <FiltroFichas
          etiqueta="Especialidad:"
          etiquetaTodas="Todas"
          total={documentos.length}
          opciones={conteoPor('especialidad')}
          seleccion={especialidades}
          onAlternar={(v) => setEspecialidades((prev) => alternarEn(prev, v))}
          onLimpiar={() => setEspecialidades([])}
        />
        <FiltroFichas
          etiqueta="Tipo:"
          etiquetaTodas="Todos"
          total={documentos.length}
          opciones={conteoPor('tipo')}
          seleccion={tipos}
          onAlternar={(v) => setTipos((prev) => alternarEn(prev, v))}
          onLimpiar={() => setTipos([])}
        />
      </div>

      {gestiona && <div className="mb-3"><LeyendaResponsables /></div>}

      {puedeEditarEstructura && !creando && !editandoId && (
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-lime-600 hover:text-lime-700 mb-3"
        >
          <Plus className="w-4 h-4" /> Agregar documento
        </button>
      )}
      {creando && (
        <FormularioDocumento
          onGuardar={(campos) => { if (guardarDocumento(campos)) setCreando(false); }}
          onCancelar={() => setCreando(false)}
        />
      )}

      {documentos.length === 0 && !creando && (
        <p className="text-sm text-navy-300 italic">Este dossier todavía no tiene documentos.</p>
      )}

      {grupos.map((grupo) => (
        <div key={grupo.especialidad} className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">
            {grupo.especialidad} <span className="text-navy-300">({grupo.docs.length})</span>
          </p>
          <div className="space-y-1.5">
            {grupo.docs.map((doc) => (
              editandoId === doc.id ? (
                <FormularioDocumento
                  key={doc.id}
                  documento={doc}
                  onGuardar={(campos) => { if (guardarDocumento({ ...doc, ...campos })) setEditandoId(null); }}
                  onCancelar={() => setEditandoId(null)}
                />
              ) : (
                <div key={doc.id} className="bg-white border border-navy-200 rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap">
                  <div className="min-w-[14rem] flex-1">
                    <p className="text-sm text-navy-700 font-medium leading-tight">{doc.nombre}</p>
                    <p className="text-xs text-navy-400 font-mono">{doc.codigo} · {doc.tipo}</p>
                  </div>
                  <ChipsResponsables
                    responsables={doc.responsables}
                    editable={gestiona}
                    onCambiar={(nuevos) => onCambiarResponsables(dossier.id, doc.id, nuevos)}
                  />
                  {puedeEditarEstructura && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditandoId(doc.id)} title="Editar documento" className="text-navy-300 hover:text-navy-600 p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`¿Quitar "${doc.nombre}" de este dossier?`)) onQuitarDocumento(dossier.id, doc.id); }}
                        title="Quitar documento"
                        className="text-navy-300 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- lista */

function FormularioDossier({ inicial, dossiers, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [version, setVersion] = useState(inicial?.version || 1);
  const entrada = 'w-full rounded-md border border-navy-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
  return (
    <div className="border border-lime-400 bg-lime-50/40 rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-navy-500 mb-1">Nombre</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!inicial) setVersion(siguienteVersion(e.target.value, dossiers));
            }}
            placeholder="Ej. CFM"
            className={entrada}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1">Versión</label>
          <input
            type="number"
            min="1"
            value={version}
            onChange={(e) => setVersion(parseInt(e.target.value, 10) || 1)}
            className={entrada}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!nombre.trim()}
          onClick={() => onGuardar(nombre.trim(), version)}
          className="bg-lime-500 hover:bg-lime-600 disabled:opacity-40 text-navy-900 font-semibold text-sm px-4 py-1.5 rounded-lg"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-navy-500 hover:text-navy-700 px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function TarjetaDossier({ dossier, projects, inversionistasDetalle, gestiona, onAbrir, onDuplicar, onRenombrar, onArchivar, onEliminar }) {
  const enUso = proyectosQueUsan(dossier.id, projects);
  const usanEste = (inversionistasDetalle || []).filter((i) => i.dossier_id === dossier.id).map((i) => i.nombre);
  const documentos = dossier.documentos || [];
  const sinResponsable = documentos.filter((d) => Object.keys(d.responsables || {}).length === 0).length;

  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 flex-wrap ${dossier.archivado ? 'border-navy-200 opacity-60' : 'border-navy-200'}`}>
      <button onClick={onAbrir} className="min-w-[12rem] flex-1 text-left">
        <p className="text-base font-bold text-navy-800 flex items-center gap-2">
          {etiquetaDossier(dossier)}
          {dossier.archivado && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-navy-100 text-navy-500">Archivado</span>}
          {enUso.length > 0 && <Lock className="w-3.5 h-3.5 text-navy-400" title="En uso: su lista de documentos está congelada" />}
        </p>
        <p className="text-xs text-navy-500 mt-0.5">
          {documentos.length} documentos ·{' '}
          {enUso.length === 0 ? 'sin usar' : `${enUso.length} ${enUso.length === 1 ? 'proyecto' : 'proyectos'}`}
          {sinResponsable > 0 && <span className="text-amber-600"> · {sinResponsable} sin responsable</span>}
        </p>
        {usanEste.length > 0 && (
          <p className="text-xs text-navy-400 mt-1">Por defecto para: {usanEste.join(', ')}</p>
        )}
      </button>
      {gestiona && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDuplicar} title="Duplicar como versión nueva" className="text-navy-400 hover:text-navy-700 p-1.5">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={onRenombrar} title="Cambiar nombre o versión" className="text-navy-400 hover:text-navy-700 p-1.5">
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onArchivar}
            title={dossier.archivado ? 'Volver a ofrecerlo al crear proyectos' : 'Archivar: deja de ofrecerse al crear proyectos'}
            className="text-navy-400 hover:text-navy-700 p-1.5"
          >
            {dossier.archivado ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          {enUso.length === 0 && (
            <button onClick={onEliminar} title="Eliminar dossier" className="text-navy-400 hover:text-red-500 p-1.5">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DossiersView({
  dossiers, projects, inversionistas, inversionistasDetalle, perfil,
  onCrearDossier, onActualizarDossier, onEliminarDossier,
  onGuardarDocumento, onQuitarDocumento, onCambiarResponsables, onAsignarInversionista,
}) {
  const [abiertoId, setAbiertoId] = useState(null);
  const [creando, setCreando] = useState(false);
  const [renombrando, setRenombrando] = useState(null);

  const gestiona = puedeGestionarDossiers(perfil);
  const lista = dossiers || [];
  const abierto = lista.find((d) => d.id === abiertoId);

  if (abierto) {
    return (
      <DossierDetalle
        dossier={abierto}
        projects={projects}
        inversionistas={inversionistas}
        inversionistasDetalle={inversionistasDetalle}
        perfil={perfil}
        onVolver={() => setAbiertoId(null)}
        onGuardarDocumento={onGuardarDocumento}
        onQuitarDocumento={onQuitarDocumento}
        onCambiarResponsables={onCambiarResponsables}
        onAsignarInversionista={onAsignarInversionista}
      />
    );
  }

  /* Agrupados por familia (CFM, FENOGE, Estándar…) y con las versiones de cada
     una en orden: si no, en un par de años esto es una pila plana. */
  const familias = [];
  const porNombre = new Map();
  [...lista]
    .sort((a, b) => a.nombre.localeCompare(b.nombre) || (a.version || 1) - (b.version || 1))
    .forEach((d) => {
      if (!porNombre.has(d.nombre)) {
        porNombre.set(d.nombre, familias.length);
        familias.push({ nombre: d.nombre, versiones: [] });
      }
      familias[porNombre.get(d.nombre)].versiones.push(d);
    });

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-navy-400" /> Dossiers
        </h1>
        {gestiona && !creando && (
          <button
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 bg-lime-500 hover:bg-lime-600 text-navy-900 font-semibold text-sm px-3 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Nuevo dossier
          </button>
        )}
      </div>
      <p className="text-sm text-navy-500 mb-5">
        Qué documentos lleva cada proyecto y quién responde por cada uno. Un dossier que ya usa algún proyecto no se
        modifica: se duplica y se cambia la copia.
      </p>

      {creando && (
        <FormularioDossier
          dossiers={lista}
          onGuardar={(nombre, version) => { onCrearDossier(nombre, version, []); setCreando(false); }}
          onCancelar={() => setCreando(false)}
        />
      )}
      {renombrando && (
        <FormularioDossier
          inicial={renombrando}
          dossiers={lista}
          onGuardar={(nombre, version) => { onActualizarDossier(renombrando.id, { nombre, version }); setRenombrando(null); }}
          onCancelar={() => setRenombrando(null)}
        />
      )}

      {lista.length === 0 && (
        <p className="text-sm text-navy-300 italic">
          Todavía no hay dossiers cargados. Si acabas de actualizar, falta correr la migración — mientras tanto los
          proyectos siguen viendo las listas de siempre.
        </p>
      )}

      {familias.map((familia) => (
        <div key={familia.nombre} className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-500 mb-2">{familia.nombre}</p>
          <div className="space-y-2">
            {familia.versiones.map((d) => (
              <TarjetaDossier
                key={d.id}
                dossier={d}
                projects={projects}
                inversionistasDetalle={inversionistasDetalle}
                gestiona={gestiona}
                onAbrir={() => setAbiertoId(d.id)}
                onDuplicar={() => onCrearDossier(d.nombre, siguienteVersion(d.nombre, lista), d.documentos || [])}
                onRenombrar={() => setRenombrando(d)}
                onArchivar={() => onActualizarDossier(d.id, { archivado: !d.archivado })}
                onEliminar={() => {
                  if (window.confirm(`¿Eliminar el dossier "${etiquetaDossier(d)}" y sus ${(d.documentos || []).length} documentos?`)) {
                    onEliminarDossier(d.id);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
