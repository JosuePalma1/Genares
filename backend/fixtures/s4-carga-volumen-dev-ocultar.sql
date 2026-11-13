-- SOLO DESARROLLO · Retira de la interfaz el volumen «CARGA» creado por s4-carga-volumen-dev.sql.
-- Ejecutar conectado como postgres a genares_integrado_dev. Es idempotente.
-- No borra nada: en S4 se oculta con estado_registro = 0 (regla de retención). Al ocultar el proceso,
-- el trabajo deja de aparecer en Trabajos, Inicio, Cronograma, Resultados y Finalización.
-- También se ocultan sus sesiones, evaluaciones y notas. Los datos de S2/S3/gen marcados CARGA
-- se quedan, pero no se muestran porque S4 solo lista trabajos con proceso visible.
-- Para volver a mostrarlos, basta con poner estado_registro = 1 en esas mismas filas.
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

UPDATE s4.calificaciones_evaluacion SET estado_registro = 0
WHERE estado_registro = 1 AND id_evaluacion IN (
  SELECT id FROM s4.evaluaciones WHERE id_proceso_evaluacion IN (SELECT id FROM procesos_carga));
UPDATE s4.evaluaciones SET estado_registro = 0
WHERE estado_registro = 1 AND id_proceso_evaluacion IN (SELECT id FROM procesos_carga);
UPDATE s4.programacion_estudiante SET estado_registro = 0
WHERE estado_registro = 1 AND programacion_sustentacion_id IN (
  SELECT id FROM s4.programaciones_sustentacion WHERE id_proceso_evaluacion IN (SELECT id FROM procesos_carga));
UPDATE s4.programaciones_sustentacion SET estado_registro = 0
WHERE estado_registro = 1 AND id_proceso_evaluacion IN (SELECT id FROM procesos_carga);
UPDATE s4.procesos_evaluacion SET estado_registro = 0
WHERE estado_registro = 1 AND id IN (SELECT id FROM procesos_carga);

DO $$
BEGIN
  RAISE NOTICE 'Volumen CARGA oculto: % procesos con estado_registro = 0.',
    (SELECT count(*) FROM s4.procesos_evaluacion p JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
       JOIN gen.tema t ON t.id = a.tema_id WHERE t.titulo LIKE 'CARGA - %' AND p.estado_registro = 0);
END
$$;

COMMIT;
