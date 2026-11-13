-- SOLO DESARROLLO · Vuelve a mostrar el volumen «CARGA» oculto por s4-carga-volumen-dev-ocultar.sql.
-- Ejecutar conectado como postgres a genares_integrado_dev. Es idempotente.
-- Solo cambia estado_registro de 0 a 1 en las filas S4 de los trabajos CARGA; no toca los datos DEV.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
END
$$;

CREATE TEMP TABLE procesos_carga ON COMMIT DROP AS
SELECT p.id FROM s4.procesos_evaluacion p
JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
JOIN gen.tema t ON t.id = a.tema_id
WHERE t.titulo LIKE 'CARGA - %';

-- En orden inverso al ocultado: primero el proceso y luego lo que cuelga de él.
UPDATE s4.procesos_evaluacion SET estado_registro = 1
WHERE estado_registro = 0 AND id IN (SELECT id FROM procesos_carga);
UPDATE s4.programaciones_sustentacion SET estado_registro = 1
WHERE estado_registro = 0 AND id_proceso_evaluacion IN (SELECT id FROM procesos_carga);
UPDATE s4.programacion_estudiante SET estado_registro = 1
WHERE estado_registro = 0 AND programacion_sustentacion_id IN (
  SELECT id FROM s4.programaciones_sustentacion WHERE id_proceso_evaluacion IN (SELECT id FROM procesos_carga));
UPDATE s4.evaluaciones SET estado_registro = 1
WHERE estado_registro = 0 AND id_proceso_evaluacion IN (SELECT id FROM procesos_carga);
UPDATE s4.calificaciones_evaluacion SET estado_registro = 1
WHERE estado_registro = 0 AND id_evaluacion IN (
  SELECT id FROM s4.evaluaciones WHERE id_proceso_evaluacion IN (SELECT id FROM procesos_carga));

DO $$
BEGIN
  RAISE NOTICE 'Volumen CARGA visible: % procesos con estado_registro = 1.',
    (SELECT count(*) FROM s4.procesos_evaluacion p JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
       JOIN gen.tema t ON t.id = a.tema_id WHERE t.titulo LIKE 'CARGA - %' AND p.estado_registro = 1);
END
$$;

COMMIT;
