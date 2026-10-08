-- =============================================================
-- Sun Design Suite · Migración: link de la ubicación en las
-- actualizaciones de diseño.
--
-- La ubicación ("Plano estructural — hoja 3") ahora puede llevar,
-- opcional, el link para abrirla directamente. Solo necesitas correr
-- este archivo si YA habías ejecutado schema.sql antes de este cambio.
-- Pégalo en el SQL Editor de Supabase y presiona "Run".
--
-- Si no se corre, nada se rompe: las actualizaciones se siguen
-- guardando, solo que sin el link (y la plataforma avisa si alguien
-- escribió uno).
--
-- Es seguro correr este archivo más de una vez.
-- =============================================================

alter table actualizaciones add column if not exists ubicacion_url text;
