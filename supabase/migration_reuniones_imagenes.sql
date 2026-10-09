-- =============================================================
-- Sun Design Suite · Migración: imágenes en los temas y pendientes
-- de las reuniones.
--
-- Las imágenes no van dentro de las filas sino al almacenamiento de
-- Supabase, en un bucket PRIVADO llamado "reuniones": la fila guarda
-- solo la ruta. (Los pendientes y los resúmenes se cargan todos al
-- entrar; con los pantallazos adentro, cada entrada bajaría megas.)
--
--   - reuniones_pendientes.imagenes: las rutas de las imágenes del
--     pendiente.
--   - Los temas no necesitan columna: viven dentro del resumen
--     (bloques.temas), que ya es JSON.
--   - El bucket solo lo leen y escriben los usuarios del equipo; los
--     invitados no ven nada de las reuniones, tampoco las imágenes.
--
-- Si no se corre, nada se rompe: al intentar adjuntar una imagen, la
-- plataforma dice que falta esta migración, y todo lo demás sigue igual.
--
-- Pégalo en el SQL Editor de Supabase y presiona "Run". Es seguro
-- correrlo más de una vez.
-- =============================================================

alter table reuniones_pendientes
  add column if not exists imagenes jsonb not null default '[]'::jsonb;

-- 5 MB por imagen y solo imágenes: el mismo límite que pone la pantalla,
-- repetido aquí para que no dependa solo de ella.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reuniones', 'reuniones', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Imagenes de reuniones: lectura del equipo" on storage.objects;
create policy "Imagenes de reuniones: lectura del equipo"
  on storage.objects for select
  using (bucket_id = 'reuniones' and auth.role() = 'authenticated' and not es_invitado());

drop policy if exists "Imagenes de reuniones: el equipo sube" on storage.objects;
create policy "Imagenes de reuniones: el equipo sube"
  on storage.objects for insert
  with check (bucket_id = 'reuniones' and auth.role() = 'authenticated' and not es_invitado());
