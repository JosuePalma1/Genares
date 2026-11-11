BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Ejecuta este archivo en genares_integrado_dev';
  END IF;
END
$$;

GRANT SELECT (id, activo, sujeto_autenticacion) ON gen.usuario TO genares;

GRANT INSERT, UPDATE ON s4.rubricas, s4.versiones_rubrica,
  s4.vigencias_rubrica_carrera TO genares;
GRANT INSERT, DELETE ON s4.versiones_rubrica_carreras TO genares;
GRANT INSERT, UPDATE, DELETE ON s4.etapas_rubrica,
  s4.categorias_rubrica, s4.indicadores_rubrica TO genares;
GRANT INSERT, SELECT ON s4.auditoria_rubricas TO genares;

GRANT INSERT, UPDATE ON s4.programaciones_sustentacion TO genares;
GRANT INSERT ON s4.programacion_estudiante, s4.traspasos_evaluacion_estudiante TO genares;
-- Los disparadores del cronograma registran cambios y participantes en S4.
GRANT INSERT ON s4.eventos_trazabilidad_trabajo TO genares;

GRANT INSERT ON s4.actas_archivadas, s4.historial_nota_minima TO genares;
GRANT SELECT (id) ON s4.historial_nota_minima TO genares;
GRANT SELECT, INSERT, UPDATE ON s4.consecutivos_acta TO genares;
GRANT UPDATE (valor, actualizado_en, actualizado_por) ON s4.configuracion_nota_minima TO genares;
-- SE-03: la finalización administrativa cambia el estado del proceso a FINALIZADO.
GRANT UPDATE (estado) ON s4.procesos_evaluacion TO genares;

-- Valor provisional vigente en Genares, con historial solo si se inicializa.
WITH inicial AS (
  INSERT INTO s4.configuracion_nota_minima (id, valor, actualizado_en, actualizado_por)
  VALUES (1, 7.00, now(), 'sistema:valor-inicial')
  ON CONFLICT (id) DO NOTHING
  RETURNING valor
)
INSERT INTO s4.historial_nota_minima (id, valor_anterior, valor_nuevo, cambiado_en, cambiado_por)
SELECT (SELECT COALESCE(max(id), 0) + 1 FROM s4.historial_nota_minima),
  NULL, valor, now(), 'sistema:valor-inicial' FROM inicial;

COMMIT;
