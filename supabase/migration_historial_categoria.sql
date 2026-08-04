-- =============================================================
-- Sun Design Suite · Migración: categoría del historial
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Agrega la columna "categoria" a activity_log (Civil, Notas,
-- Control Documental, etc.) para poder separar el historial por
-- pestaña en la aplicación. Los registros antiguos, que no tienen
-- categoría, se mostrarán agrupados como "General".
-- =============================================================

alter table activity_log add column if not exists categoria text default 'general';
