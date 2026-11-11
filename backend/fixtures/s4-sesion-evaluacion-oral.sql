-- Evaluación oral ligada a su sesión y motivo de reprogramación (RF-46, RF-48, RN-16, RN-26, RN-27, Paso 1 §7.1).
-- Ejecutar conectado como postgres a genares_integrado_dev, después de s4-retencion-visibilidad-auditoria.sql.
-- Es idempotente: puede repetirse. No borra datos ni cambia notas, estados ni revisiones.
--
-- Qué hace:
--   1. Agrega s4.evaluaciones.id_programacion_sustentacion (sesión de la evaluación oral).
--   2. Garantiza en PostgreSQL que la sesión sea del mismo proceso y que el estudiante sea participante.
--   3. Completa la sesión de las orales existentes solo cuando hay una única sesión posible.
--      Incluye orales CERRADAS: se desactiva el disparador s4_10_evaluacion_cerrada únicamente para ese
--      UPDATE, dentro de esta transacción. Solo se escribe la referencia; la bitácora
--      s4.eventos_cambio_registro registra el cambio de cada fila.
--   4. Exige que una oral tenga sesión y que una evaluación no oral no la tenga. Si quedan orales sin
--      sesión posible, la regla se instala sin validar las filas antiguas y se avisa cuántas son.
--   5. Registra el motivo de cada reprogramación en s4.eventos_trazabilidad_trabajo.
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

ALTER TABLE s4.evaluaciones ADD COLUMN IF NOT EXISTS id_programacion_sustentacion uuid;
COMMENT ON COLUMN s4.evaluaciones.id_programacion_sustentacion IS
  'Sesión de sustentación de la evaluación oral. Obligatoria si etapa = ORAL; vacía en las demás.';

DO $$
BEGIN
  -- Destino de la clave compuesta (sesión, proceso).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'uq_s4_programaciones_sustentacion_id_proceso') THEN
    ALTER TABLE s4.programaciones_sustentacion
      ADD CONSTRAINT uq_s4_programaciones_sustentacion_id_proceso UNIQUE (id, id_proceso_evaluacion);
  END IF;

  -- La sesión pertenece al mismo proceso de evaluación.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_s4_evaluaciones_sesion_proceso') THEN
    ALTER TABLE s4.evaluaciones
      ADD CONSTRAINT fk_s4_evaluaciones_sesion_proceso
      FOREIGN KEY (id_programacion_sustentacion, id_proceso_evaluacion)
      REFERENCES s4.programaciones_sustentacion (id, id_proceso_evaluacion)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;

  -- El estudiante evaluado es participante de esa sesión (usa uq_s4_programacion_estudiante).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_s4_evaluaciones_sesion_estudiante') THEN
    ALTER TABLE s4.evaluaciones
      ADD CONSTRAINT fk_s4_evaluaciones_sesion_estudiante
      FOREIGN KEY (id_programacion_sustentacion, id_estudiante)
      REFERENCES s4.programacion_estudiante (programacion_sustentacion_id, id_estudiante)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_s4_evaluaciones_programacion_sustentacion
  ON s4.evaluaciones (id_programacion_sustentacion)
  WHERE id_programacion_sustentacion IS NOT NULL;

-- Orales existentes: se usa la única sesión vigente (no cancelada) del estudiante en su proceso;
-- si no tiene ninguna vigente, la única sesión que tenga. Si hay varias posibles, no se elige.
ALTER TABLE s4.evaluaciones DISABLE TRIGGER s4_10_evaluacion_cerrada;

WITH candidatas AS (
  SELECT ev.id AS id_evaluacion, ps.id AS id_sesion, ps.estado <> 'CANCELADA' AS vigente
  FROM s4.evaluaciones ev
  JOIN s4.programaciones_sustentacion ps
    ON ps.id_proceso_evaluacion = ev.id_proceso_evaluacion AND ps.estado_registro = 1
  JOIN s4.programacion_estudiante pe
    ON pe.programacion_sustentacion_id = ps.id AND pe.id_estudiante = ev.id_estudiante
   AND pe.estado_registro = 1
  WHERE ev.etapa = 'ORAL' AND ev.id_estudiante IS NOT NULL
    AND ev.id_programacion_sustentacion IS NULL
), elegidas AS (
  SELECT id_evaluacion,
    CASE
      WHEN count(*) FILTER (WHERE vigente) = 1 THEN (array_agg(id_sesion) FILTER (WHERE vigente))[1]
      WHEN count(*) FILTER (WHERE vigente) = 0 AND count(*) = 1 THEN (array_agg(id_sesion))[1]
    END AS id_sesion
  FROM candidatas
  GROUP BY id_evaluacion
)
UPDATE s4.evaluaciones ev
SET id_programacion_sustentacion = elegidas.id_sesion
FROM elegidas
WHERE ev.id = elegidas.id_evaluacion AND elegidas.id_sesion IS NOT NULL;

ALTER TABLE s4.evaluaciones ENABLE TRIGGER s4_10_evaluacion_cerrada;

DO $$
DECLARE v_sin_sesion integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_s4_evaluaciones_sesion_oral') THEN
    ALTER TABLE s4.evaluaciones
      ADD CONSTRAINT ck_s4_evaluaciones_sesion_oral CHECK (
        CASE WHEN etapa = 'ORAL'
          THEN id_programacion_sustentacion IS NOT NULL AND id_estudiante IS NOT NULL
          ELSE id_programacion_sustentacion IS NULL
        END
      ) NOT VALID;
  END IF;

  SELECT count(*) INTO v_sin_sesion FROM s4.evaluaciones
  WHERE NOT (CASE WHEN etapa = 'ORAL'
    THEN id_programacion_sustentacion IS NOT NULL AND id_estudiante IS NOT NULL
    ELSE id_programacion_sustentacion IS NULL END);

  IF v_sin_sesion = 0 THEN
    ALTER TABLE s4.evaluaciones VALIDATE CONSTRAINT ck_s4_evaluaciones_sesion_oral;
  ELSE
    RAISE NOTICE 'S4: % evaluación(es) oral(es) antigua(s) sin una sesión única; la regla se aplica a filas nuevas y modificadas. Revísalas con la consulta final de este archivo.', v_sin_sesion;
  END IF;
END
$$;

-- El backend solo fija la sesión al crear la evaluación; no la cambia después.
GRANT INSERT (id_programacion_sustentacion) ON s4.evaluaciones TO genares;

-- Reprogramación: misma lógica anterior más el motivo que fija el backend en s4.motivo_cambio.
CREATE OR REPLACE FUNCTION s4.auditar_reprogramacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.fecha_programada,OLD.hora_programada,OLD.hora_fin_programada,OLD.sala,OLD.estado)
  IS DISTINCT FROM
    (NEW.fecha_programada,NEW.hora_programada,NEW.hora_fin_programada,NEW.sala,NEW.estado) THEN
   INSERT INTO s4.eventos_trazabilidad_trabajo
    (id_proceso_evaluacion,ocurrido_en,tipo_evento,entidad_tipo,entidad_id,
     actor_id,actor_tipo,origen,detalles,evidencia,fuente_tipo,fuente_id)
   VALUES (NEW.id_proceso_evaluacion,clock_timestamp(),'SUSTENTACION_REPROGRAMADA',
    'programacion',NEW.id,
    COALESCE(NULLIF(current_setting('genares.actor_id',true),''),NEW.scheduled_by_actor_id),
    'USUARIO','CRONOGRAMA',
    jsonb_build_object('fecha_anterior',OLD.fecha_programada,'fecha_nueva',NEW.fecha_programada,
    'inicio_anterior',OLD.hora_programada,'inicio_nuevo',NEW.hora_programada,
    'fin_anterior',OLD.hora_fin_programada,'fin_nuevo',NEW.hora_fin_programada,
    'sala_anterior',OLD.sala,'sala_nueva',NEW.sala,
    'estado_anterior',OLD.estado,'estado_nuevo',NEW.estado,
    'motivo',NULLIF(current_setting('s4.motivo_cambio',true),'')),
    'DIRECTA','programacion_cambio',gen_random_uuid());
 END IF;
 RETURN NEW;
END $$;

COMMIT;

-- Comprobación 1: deben aparecer la columna y las cuatro restricciones.
SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN ('uq_s4_programaciones_sustentacion_id_proceso', 'fk_s4_evaluaciones_sesion_proceso',
  'fk_s4_evaluaciones_sesion_estudiante', 'ck_s4_evaluaciones_sesion_oral')
ORDER BY conname;

-- Comprobación 2: orales que quedaron sin sesión (debería salir vacía).
SELECT id, id_proceso_evaluacion, id_estudiante, estado
FROM s4.evaluaciones
WHERE etapa = 'ORAL' AND id_programacion_sustentacion IS NULL;
