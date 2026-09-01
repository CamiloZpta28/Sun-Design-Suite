-- =============================================================
-- Cambios en vivo (Realtime)
-- -------------------------------------------------------------
-- Habilita las dos tablas que la aplicación escucha para enterarse cuando
-- otra persona guarda:
--
--   projects     -> refresca solo los proyectos que NADIE está mirando
--                   (Dashboard, listas, resumen por inversionista).
--   activity_log -> dice QUIÉN hizo el cambio y qué hizo, que es lo que se
--                   muestra en el aviso "Ver cambios" dentro de un proyecto.
--
-- Las políticas de seguridad de siempre se siguen aplicando: por Realtime
-- solo llega lo que esa persona ya podía leer.
--
-- Pega este archivo en Supabase > SQL Editor > New query y presiona "Run".
-- Correrlo dos veces no hace daño: si la tabla ya estaba habilitada, se
-- ignora sin error.
-- =============================================================

do $$
begin
  alter publication supabase_realtime add table projects;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table activity_log;
exception
  when duplicate_object then null;
end $$;
