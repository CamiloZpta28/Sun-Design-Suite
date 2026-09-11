-- =============================================================
-- Sun Design Suite · Migración: notificaciones en vivo
--
-- Hasta ahora las notificaciones se leían una sola vez, al entrar a la
-- plataforma: quien la dejaba abierta toda la tarde no se enteraba de nada
-- hasta refrescar. Con la tabla publicada para Realtime llegan solas, y con
-- ellas los avisos del navegador.
--
-- Si NO la corres no se rompe nada: las notificaciones siguen apareciendo al
-- entrar, como hasta ahora, y los avisos del navegador no salen.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

do $$
begin
  alter publication supabase_realtime add table notificaciones;
exception
  when duplicate_object then null;
end $$;
