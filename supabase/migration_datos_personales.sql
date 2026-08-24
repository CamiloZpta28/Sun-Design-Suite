-- =============================================================
-- Sun Design Suite · Migración: datos personales del perfil
-- (cédula, ciudad de expedición, matrícula profesional, celular,
-- dirección, correo personal). Solo necesitas correr este archivo
-- si YA habías ejecutado schema.sql antes de esta actualización.
-- Pégalo en el SQL Editor de Supabase y presiona "Run".
-- =============================================================

alter table profiles add column if not exists cedula text;
alter table profiles add column if not exists ciudad_expedicion_cedula text;
alter table profiles add column if not exists matricula_profesional text;
alter table profiles add column if not exists celular text;
alter table profiles add column if not exists direccion text;
alter table profiles add column if not exists correo_personal text;

-- No se necesita ninguna política nueva: la de
-- "Lider de diseno edita cualquier perfil" (ver migration_perfil_fechas.sql)
-- ya cubre cualquier columna de "profiles", incluidas estas.
