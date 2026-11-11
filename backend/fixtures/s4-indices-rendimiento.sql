-- Índices de rendimiento de S4 para el volumen previsto (cientos de trabajos por periodo,
-- miles acumulados). Solo crea índices: no cambia datos, columnas, restricciones ni reglas.
-- Ejecutar conectado como postgres a genares_integrado_dev. Es idempotente: puede repetirse.
-- No modifica schemas gen, s1, s2 ni s3.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
END
$$;

-- Notas de cada evaluación: se leen al abrir, consolidar, corregir y emitir documentos,
-- y cada guardado de borrador actualiza por (id_evaluacion, id_indicador). Es la tabla más grande de S4.
CREATE INDEX IF NOT EXISTS idx_s4_calificaciones_evaluacion_evaluacion_indicador
  ON s4.calificaciones_evaluacion (id_evaluacion, id_indicador);

-- Historial del trabajo: paginado por proceso, del más reciente al más antiguo;
-- también lo usa la consulta de trabajos para la hora real de cada sesión.
CREATE INDEX IF NOT EXISTS idx_s4_eventos_trazabilidad_proceso_fecha
  ON s4.eventos_trazabilidad_trabajo (id_proceso_evaluacion, ocurrido_en DESC, id DESC);

-- Actas archivadas por trabajo y estudiante: finalización, correcciones y emisión.
CREATE INDEX IF NOT EXISTS idx_s4_actas_archivadas_proceso_estudiante
  ON s4.actas_archivadas (id_proceso_evaluacion, id_estudiante, formato);

-- Reintentos idempotentes del guardado de borradores (comprueba la operación ya confirmada).
CREATE INDEX IF NOT EXISTS idx_s4_eventos_auditoria_evaluacion_evaluacion_accion
  ON s4.eventos_auditoria_evaluacion (id_evaluacion, accion);

ANALYZE s4.calificaciones_evaluacion;
ANALYZE s4.eventos_trazabilidad_trabajo;
ANALYZE s4.actas_archivadas;
ANALYZE s4.eventos_auditoria_evaluacion;

COMMIT;

-- Comprobación: deben aparecer los cuatro índices.
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 's4' AND indexname IN (
  'idx_s4_calificaciones_evaluacion_evaluacion_indicador',
  'idx_s4_eventos_trazabilidad_proceso_fecha',
  'idx_s4_actas_archivadas_proceso_estudiante',
  'idx_s4_eventos_auditoria_evaluacion_evaluacion_accion'
)
ORDER BY indexname;
