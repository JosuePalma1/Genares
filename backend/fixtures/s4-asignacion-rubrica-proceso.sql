-- Asignación de la rúbrica al abrir la evaluación (RF-11, RF-19).
-- Ejecutar conectado como postgres a genares_integrado_dev, después de s4-retencion-visibilidad-auditoria.sql.
-- Es idempotente: puede repetirse. Solo concede un permiso; no crea ni modifica filas.
--
-- Qué hace:
--   Permite al rol de aplicación crear el proceso de evaluación de un trabajo que aún no lo tiene.
--   La versión de rúbrica la sigue validando s4.validar_rubrica_proceso: solo una versión ACTIVA y
--   vigente para la modalidad, la carrera y el período del tema. Una vez creada, la protege
--   proteger_version_rubrica_proceso.
--   Solo concede INSERT. Sin UPDATE, la aplicación tampoco puede ocultar un proceso
--   (estado_registro 1 → 0). El borrado físico sigue bloqueado por s4_no_delete, como en todo S4.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
  IF to_regclass('s4.eventos_cambio_registro') IS NULL THEN
    RAISE EXCEPTION 'Ejecuta antes s4-retencion-visibilidad-auditoria.sql';
  END IF;
END
$$;

GRANT INSERT ON s4.procesos_evaluacion TO genares;

DO $$
BEGIN
  IF NOT has_table_privilege('genares', 's4.procesos_evaluacion', 'INSERT') THEN
    RAISE EXCEPTION 'No se pudo conceder INSERT sobre s4.procesos_evaluacion a genares';
  END IF;
  RAISE NOTICE 'Listo: genares puede crear procesos de evaluación; la rúbrica la valida s4.validar_rubrica_proceso.';
END
$$;

COMMIT;
