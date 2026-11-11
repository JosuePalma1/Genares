-- Ejecutar en pgAdmin como postgres, conectado a genares_integrado_dev.
-- Todas las modificaciones de prueba quedan en transacciones que terminan en ROLLBACK.
-- Se esperan dos avisos "VERIFICACIÓN S4" (comprobaciones generales y actores consecutivos).
BEGIN;

DO $$
DECLARE
  v_rubrica uuid;
  v_evento uuid;
  v_version uuid;
  v_evaluacion uuid;
  v_calificacion uuid;
  v_etapa uuid;
  v_vigencia uuid;
  v_rubrica_usada uuid;
  v_bloqueado boolean;
  v_conteo bigint;
  v_total text;
  v_proceso uuid;
  v_solicitud uuid;
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: se requiere genares_integrado_dev';
  END IF;

  PERFORM set_config('s4.actor_id', 'GENARES:LOCAL_DEVELOPMENT', true);
  PERFORM set_config('s4.correlation_id', 'PRUEBA-RETENCION-S4', true);

  SELECT id INTO v_rubrica FROM s4.rubricas WHERE estado_registro = 1 ORDER BY creado_en LIMIT 1;
  IF v_rubrica IS NULL THEN
    RAISE EXCEPTION 'No hay una rúbrica de prueba para verificar retención';
  END IF;

  UPDATE s4.rubricas SET estado_registro = 0 WHERE id = v_rubrica;
  IF NOT EXISTS (
    SELECT 1 FROM s4.eventos_cambio_registro
    WHERE esquema = 's4' AND tabla = 'rubricas'
      AND clave_registro->>'id' = v_rubrica::text
      AND actor_id = 'GENARES:LOCAL_DEVELOPMENT'
      AND correlation_id = 'PRUEBA-RETENCION-S4'
      AND antes->>'estado_registro' = '1'
      AND despues->>'estado_registro' = '0'
  ) THEN
    RAISE EXCEPTION 'No se registró estado, actor, correlación o antes/después de la rúbrica';
  END IF;

  v_bloqueado := false;
  BEGIN
    UPDATE s4.rubricas SET estado_registro = 2 WHERE id = v_rubrica;
  EXCEPTION WHEN check_violation THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se aceptó un estado distinto de 0/1';
  END IF;

  v_bloqueado := false;
  BEGIN
    DELETE FROM s4.rubricas WHERE id = v_rubrica;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado OR NOT EXISTS (SELECT 1 FROM s4.rubricas WHERE id = v_rubrica) THEN
    RAISE EXCEPTION 'El borrado físico no quedó bloqueado o la fila no se conservó';
  END IF;

  v_bloqueado := false;
  BEGIN
    TRUNCATE TABLE s4.eventos_cambio_registro;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'TRUNCATE no quedó bloqueado';
  END IF;

  SELECT id INTO v_evento FROM s4.eventos_cambio_registro
  WHERE esquema = 's4' AND tabla = 'rubricas'
    AND clave_registro->>'id' = v_rubrica::text
  ORDER BY ocurrido_en DESC LIMIT 1;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.eventos_cambio_registro SET actor_id = 'ALTERACION-PRUEBA' WHERE id = v_evento;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'La bitácora permitió una modificación';
  END IF;

  SELECT id INTO v_evaluacion FROM s4.evaluaciones
  WHERE estado = 'CERRADA' AND estado_registro = 1 LIMIT 1;
  IF v_evaluacion IS NULL THEN
    RAISE EXCEPTION 'No hay una evaluación cerrada de prueba para verificar inmutabilidad';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.evaluaciones SET revision = revision + 1 WHERE id = v_evaluacion;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se modificó una evaluación cerrada';
  END IF;

  UPDATE s4.evaluaciones SET estado_registro = 0 WHERE id = v_evaluacion;
  UPDATE s4.evaluaciones SET estado_registro = 1 WHERE id = v_evaluacion;
  SELECT id INTO v_calificacion FROM s4.calificaciones_evaluacion
  WHERE id_evaluacion = v_evaluacion AND estado_registro = 1 LIMIT 1;
  IF v_calificacion IS NOT NULL THEN
    -- Ocultar un puntaje no recalcula ni altera el total de la evaluación cerrada.
    SELECT calificacion_total::text INTO v_total FROM s4.evaluaciones WHERE id = v_evaluacion;
    UPDATE s4.calificaciones_evaluacion SET estado_registro = 0 WHERE id = v_calificacion;
    IF (SELECT calificacion_total::text FROM s4.evaluaciones WHERE id = v_evaluacion) IS DISTINCT FROM v_total THEN
      RAISE EXCEPTION 'Ocultar un puntaje alteró el total de una evaluación cerrada';
    END IF;
    UPDATE s4.calificaciones_evaluacion SET estado_registro = 1 WHERE id = v_calificacion;
  END IF;

  -- Mover un puntaje de un borrador hacia la evaluación cerrada también debe bloquearse.
  SELECT ce.id INTO v_calificacion
  FROM s4.calificaciones_evaluacion ce
  JOIN s4.evaluaciones e ON e.id = ce.id_evaluacion
  WHERE e.estado <> 'CERRADA' LIMIT 1;
  IF v_calificacion IS NULL THEN
    RAISE NOTICE 'Sin puntajes de borrador: se omite la prueba de traslado hacia una evaluación cerrada.';
  ELSE
    v_bloqueado := false;
    BEGIN
      UPDATE s4.calificaciones_evaluacion SET id_evaluacion = v_evaluacion WHERE id = v_calificacion;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Se trasladó un puntaje hacia una evaluación cerrada';
    END IF;
  END IF;

  SELECT p.id_version_rubrica INTO v_version
  FROM s4.procesos_evaluacion p
  JOIN s4.evaluaciones e ON e.id_proceso_evaluacion = p.id
  WHERE p.id_version_rubrica IS NOT NULL AND p.estado_registro = 1
    AND e.estado_registro = 1
  LIMIT 1;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'No hay una rúbrica usada de prueba para verificar inmutabilidad';
  END IF;
  SELECT vr.id_rubrica INTO v_rubrica_usada
  FROM s4.versiones_rubrica vr WHERE vr.id = v_version;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.rubricas SET nombre = nombre || '-PRUEBA' WHERE id = v_rubrica_usada;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se modificó la ficha de una rúbrica ya usada';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.versiones_rubrica SET version = version || '-PRUEBA' WHERE id = v_version;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se modificó el contenido de una versión de rúbrica usada';
  END IF;

  SELECT id INTO v_etapa FROM s4.etapas_rubrica
  WHERE id_version_rubrica = v_version AND estado_registro = 1 LIMIT 1;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.etapas_rubrica SET nombre = nombre || '-PRUEBA' WHERE id = v_etapa;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se modificó una etapa de una rúbrica ya usada';
  END IF;

  SELECT id INTO v_vigencia FROM s4.vigencias_rubrica_carrera
  WHERE id_version_rubrica = v_version LIMIT 1;
  IF v_vigencia IS NULL THEN
    RAISE EXCEPTION 'No hay una vigencia para verificar la inmutabilidad de rúbrica usada';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE s4.vigencias_rubrica_carrera
      SET vigente_desde = vigente_desde + interval '1 second' WHERE id = v_vigencia;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'Se modificó una vigencia de una rúbrica ya usada';
  END IF;

  SELECT count(*) INTO v_conteo FROM s4.procesos_evaluacion WHERE id_version_rubrica = v_version;
  UPDATE s4.versiones_rubrica SET estado_registro = 0 WHERE id = v_version;
  IF (SELECT count(*) FROM s4.procesos_evaluacion WHERE id_version_rubrica = v_version) <> v_conteo THEN
    RAISE EXCEPTION 'Retirar una versión usada alteró sus procesos existentes';
  END IF;

  -- RF-36: una evaluación cerrada solo se corrige con una solicitud APROBADA de esa evaluación,
  -- y solo en la nota, la observación, el total y la revisión.
  IF to_regclass('s4.solicitudes_correccion_evaluacion') IS NULL THEN
    RAISE NOTICE 'Sin s4-correccion-calificaciones.sql: se omite la prueba de corrección extraordinaria.';
  ELSE
    SELECT id INTO v_calificacion FROM s4.calificaciones_evaluacion
    WHERE id_evaluacion = v_evaluacion AND estado_registro = 1 LIMIT 1;
    IF v_calificacion IS NULL THEN
      RAISE EXCEPTION 'La evaluación cerrada de prueba no tiene puntajes para verificar RF-36';
    END IF;
    INSERT INTO s4.solicitudes_correccion_evaluacion
      (id_evaluacion, id_proceso_evaluacion, motivo, revision_base, puntajes_anteriores, puntajes_propuestos,
       total_anterior, total_propuesto, justificativo_ruta, justificativo_sha256, justificativo_nombre,
       justificativo_bytes, solicitado_por)
    SELECT e.id, e.id_proceso_evaluacion, 'Prueba de verificación RF-36', COALESCE(e.revision, 0), '[]', '[]',
      COALESCE(e.calificacion_total, 0), COALESCE(e.calificacion_total, 0),
      'auditoria/justificativos/00000000-0000-4000-8000-000000000000.pdf', repeat('a', 64), 'prueba.pdf', 1,
      'PRUEBA-SOLICITANTE'
    FROM s4.evaluaciones e WHERE e.id = v_evaluacion
    RETURNING id INTO v_solicitud;
    PERFORM set_config('s4.correccion_solicitud', v_solicitud::text, true);

    -- Pendiente: todavía no autoriza ningún cambio.
    v_bloqueado := false;
    BEGIN
      UPDATE s4.calificaciones_evaluacion SET observation = 'PRUEBA-PENDIENTE' WHERE id = v_calificacion;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Una solicitud pendiente permitió corregir una evaluación cerrada';
    END IF;

    UPDATE s4.solicitudes_correccion_evaluacion
      SET estado = 'APROBADA', resuelto_por = 'PRUEBA-AUTORIZADOR', resuelto_en = clock_timestamp()
      WHERE id = v_solicitud;
    -- Aprobada: se permiten la observación y el total, no reabrir la evaluación.
    UPDATE s4.calificaciones_evaluacion SET observation = 'PRUEBA-CORREGIDA' WHERE id = v_calificacion;
    UPDATE s4.evaluaciones SET revision = COALESCE(revision, 0) + 1,
      calificacion_total = calificacion_total WHERE id = v_evaluacion;
    v_bloqueado := false;
    BEGIN
      UPDATE s4.evaluaciones SET estado = 'BORRADOR' WHERE id = v_evaluacion;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Una corrección aprobada reabrió la evaluación cerrada';
    END IF;

    -- Sin la solicitud en la transacción, la evaluación vuelve a ser inmutable.
    PERFORM set_config('s4.correccion_solicitud', '', true);
    v_bloqueado := false;
    BEGIN
      UPDATE s4.calificaciones_evaluacion SET observation = 'PRUEBA-SIN-SOLICITUD' WHERE id = v_calificacion;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Se corrigió una evaluación cerrada sin solicitud aprobada';
    END IF;

    UPDATE s4.solicitudes_correccion_evaluacion SET estado = 'APLICADA', aplicada_en = clock_timestamp()
      WHERE id = v_solicitud;
    -- La solicitud resuelta conserva su contenido, no retrocede y no se borra.
    v_bloqueado := false;
    BEGIN
      UPDATE s4.solicitudes_correccion_evaluacion SET motivo = 'Motivo alterado en prueba' WHERE id = v_solicitud;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Se alteró el contenido de una solicitud de corrección';
    END IF;
    v_bloqueado := false;
    BEGIN
      UPDATE s4.solicitudes_correccion_evaluacion SET estado = 'PENDIENTE' WHERE id = v_solicitud;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Una solicitud aplicada volvió a pendiente';
    END IF;
    v_bloqueado := false;
    BEGIN
      DELETE FROM s4.solicitudes_correccion_evaluacion WHERE id = v_solicitud;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Se borró una solicitud de corrección';
    END IF;
  END IF;

  -- SE-03: un trabajo finalizado no vuelve a otro estado; ocultarlo sigue permitido.
  SELECT id INTO v_proceso FROM s4.procesos_evaluacion
  WHERE estado_registro = 1 AND estado IS DISTINCT FROM 'FINALIZADO' LIMIT 1;
  IF v_proceso IS NULL THEN
    RAISE NOTICE 'Sin procesos sin finalizar: se omite la prueba de trabajo finalizado.';
  ELSE
    UPDATE s4.procesos_evaluacion SET estado = 'FINALIZADO' WHERE id = v_proceso;
    v_bloqueado := false;
    BEGIN
      UPDATE s4.procesos_evaluacion SET estado = 'REGISTRADO' WHERE id = v_proceso;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      v_bloqueado := true;
    END;
    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'Un trabajo finalizado volvió a otro estado';
    END IF;
    UPDATE s4.procesos_evaluacion SET estado_registro = 0 WHERE id = v_proceso;
    UPDATE s4.procesos_evaluacion SET estado_registro = 1 WHERE id = v_proceso;
  END IF;

  RAISE NOTICE 'VERIFICACIÓN S4: todas las comprobaciones terminaron; el ROLLBACK final revertirá los cambios de prueba.';
END $$;

ROLLBACK;

-- Transacciones consecutivas en la misma sesión: el actor de una no se hereda en la siguiente.
BEGIN;
SELECT set_config('s4.actor_id', 'PRUEBA-ACTOR-A', true),
       set_config('genares.actor_id', 'PRUEBA-ACTOR-A', true),
       set_config('s4.correlation_id', 'PRUEBA-TX-A', true);
COMMIT;

BEGIN;
DO $$
DECLARE
  v_rubrica uuid;
BEGIN
  IF NULLIF(current_setting('s4.actor_id', true), '') IS NOT NULL
    OR NULLIF(current_setting('genares.actor_id', true), '') IS NOT NULL
    OR NULLIF(current_setting('s4.correlation_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'El contexto de auditoría de la transacción anterior se heredó';
  END IF;

  SELECT id INTO v_rubrica FROM s4.rubricas WHERE estado_registro = 1 ORDER BY creado_en LIMIT 1;
  IF v_rubrica IS NULL THEN
    RAISE EXCEPTION 'No hay una rúbrica de prueba para verificar actores consecutivos';
  END IF;

  -- Sin actor explícito, pgAdmin queda registrado con su rol de base.
  PERFORM set_config('s4.correlation_id', 'PRUEBA-TX-SIN-ACTOR', true);
  UPDATE s4.rubricas SET estado_registro = 0 WHERE id = v_rubrica;
  IF NOT EXISTS (
    SELECT 1 FROM s4.eventos_cambio_registro
    WHERE correlation_id = 'PRUEBA-TX-SIN-ACTOR' AND actor_id = session_user
  ) THEN
    RAISE EXCEPTION 'Sin actor explícito no se registró el rol de base';
  END IF;

  -- Con otro actor en la misma transacción, el evento lleva ese actor.
  PERFORM set_config('s4.actor_id', 'PRUEBA-ACTOR-B', true);
  PERFORM set_config('s4.correlation_id', 'PRUEBA-TX-B', true);
  UPDATE s4.rubricas SET estado_registro = 1 WHERE id = v_rubrica;
  IF NOT EXISTS (
    SELECT 1 FROM s4.eventos_cambio_registro
    WHERE correlation_id = 'PRUEBA-TX-B' AND actor_id = 'PRUEBA-ACTOR-B'
  ) THEN
    RAISE EXCEPTION 'El segundo actor no quedó registrado';
  END IF;
  IF EXISTS (SELECT 1 FROM s4.eventos_cambio_registro WHERE actor_id = 'PRUEBA-ACTOR-A') THEN
    RAISE EXCEPTION 'Se registró un evento con el actor de la transacción anterior';
  END IF;

  RAISE NOTICE 'VERIFICACIÓN S4: actores de transacciones consecutivas correctos; el ROLLBACK revertirá los cambios.';
END $$;
ROLLBACK;
