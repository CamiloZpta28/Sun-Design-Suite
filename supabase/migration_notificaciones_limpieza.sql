-- =============================================================
-- Sun Design Suite · Migración: limpieza de notificaciones leídas.
-- Agrega la hora en que cada notificación se marcó como leída y el
-- permiso para que cada quien borre las suyas. Con eso, la aplicación
-- borra las leídas un día después de leerlas (no de haberse creado).
-- Pégalo en el SQL Editor de Supabase y presiona "Run".
--
-- Es seguro correr este archivo más de una vez.
-- =============================================================

-- 1. La hora de lectura. Es lo que le da el punto de partida al día:
--    sin ella no se sabría desde cuándo contar.
alter table notificaciones add column if not exists leida_at timestamptz;

-- 2. Las que ya estaban leídas antes de esta migración no tienen hora;
--    se les pone la de creación para que también entren a la limpieza.
update notificaciones set leida_at = created_at
  where leida = true and leida_at is null;

-- 3. Permiso para borrar las propias (antes solo se podían leer y marcar).
drop policy if exists "Borrar mis notificaciones" on notificaciones;
create policy "Borrar mis notificaciones" on notificaciones
  for delete using (auth.uid() = usuario_id);
