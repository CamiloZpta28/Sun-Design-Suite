-- =============================================================
-- Sun Design Suite · Migración: guardado parcial (evita perder
-- cambios cuando dos personas editan el mismo proyecto a la vez)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Qué problema resuelve: antes, cada guardado (editar una pestaña,
-- cambiar un documento, agregar una nota, subir un archivo, asignar
-- un rol) reescribía la fila COMPLETA del proyecto con lo que el
-- navegador tenía cargado en ese momento. Si dos personas tenían el
-- proyecto abierto y guardaban casi al mismo tiempo, la segunda
-- guardada borraba silenciosamente lo que la primera acababa de
-- guardar (aunque fuera algo totalmente distinto, como una pestaña
-- diferente).
--
-- Con estas funciones, cada guardado modifica en la base de datos
-- SOLO la pieza que cambió (una pestaña específica, un documento
-- específico, un rol específico, o agrega/quita un elemento de una
-- lista) en vez de reemplazar todo. Dos personas editando cosas
-- distintas del mismo proyecto (o incluso agregando notas/archivos
-- al mismo tiempo) ya no se pisan los cambios.
--
-- Si vas a crear el proyecto de Supabase desde cero, no necesitas
-- este archivo: usa schema.sql, que ya incluye todo esto.
-- =============================================================

create or replace function merge_project_data_section(p_id text, p_section text, p_value jsonb)
returns void
language sql
as $$
  update projects
  set data = jsonb_set(coalesce(data, '{}'::jsonb), array[p_section], p_value, true),
      updated_at = now()
  where id = p_id;
$$;

create or replace function merge_project_equipo_role(p_id text, p_role text, p_value jsonb)
returns void
language sql
as $$
  update projects
  set equipo = jsonb_set(coalesce(equipo, '{}'::jsonb), array[p_role], p_value, true),
      updated_at = now()
  where id = p_id;
$$;

create or replace function merge_project_documento(p_id text, p_codigo text, p_patch jsonb)
returns void
language sql
as $$
  update projects
  set documentos = jsonb_set(
        coalesce(documentos, '{}'::jsonb),
        array[p_codigo],
        coalesce(documentos->p_codigo, '{}'::jsonb) || p_patch,
        true
      ),
      updated_at = now()
  where id = p_id;
$$;

create or replace function append_project_nota(p_id text, p_nota jsonb)
returns void
language sql
as $$
  update projects
  set notas = coalesce(notas, '[]'::jsonb) || jsonb_build_array(p_nota),
      updated_at = now()
  where id = p_id;
$$;

create or replace function remove_project_nota(p_id text, p_nota_id text)
returns void
language sql
as $$
  update projects
  set notas = coalesce((
        select jsonb_agg(elem) from jsonb_array_elements(coalesce(notas, '[]'::jsonb)) elem
        where elem->>'id' <> p_nota_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_id;
$$;

create or replace function append_project_archivos(p_id text, p_nuevos jsonb)
returns void
language sql
as $$
  update projects
  set archivos = coalesce(archivos, '[]'::jsonb) || p_nuevos,
      updated_at = now()
  where id = p_id;
$$;

create or replace function remove_project_archivo(p_id text, p_archivo_id text)
returns void
language sql
as $$
  update projects
  set archivos = coalesce((
        select jsonb_agg(elem) from jsonb_array_elements(coalesce(archivos, '[]'::jsonb)) elem
        where elem->>'id' <> p_archivo_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_id;
$$;

grant execute on function merge_project_data_section(text, text, jsonb) to authenticated;
grant execute on function merge_project_equipo_role(text, text, jsonb) to authenticated;
grant execute on function merge_project_documento(text, text, jsonb) to authenticated;
grant execute on function append_project_nota(text, jsonb) to authenticated;
grant execute on function remove_project_nota(text, text) to authenticated;
grant execute on function append_project_archivos(text, jsonb) to authenticated;
grant execute on function remove_project_archivo(text, text) to authenticated;
