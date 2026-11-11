-- Retención, estado 0/1 y auditoría de datos S4.
-- Ejecutar una sola vez o repetir para verificar idempotencia, conectado como postgres
-- a genares_integrado_dev. No modifica schemas gen, s1, s2 ni s3.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
END
$$;

-- El estado de visibilidad no reemplaza estado académico (BORRADOR/CERRADA/ACTIVA).
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'rubricas', 'versiones_rubrica', 'etapas_rubrica', 'categorias_rubrica',
    'indicadores_rubrica', 'versiones_rubrica_carreras', 'vigencias_rubrica_carrera',
    'procesos_evaluacion', 'evaluaciones', 'calificaciones_evaluacion',
    'programaciones_sustentacion', 'programacion_estudiante', 'actas_archivadas',
    'notificaciones'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE s4.%I ADD COLUMN IF NOT EXISTS estado_registro smallint NOT NULL DEFAULT 1',
      tabla
    );
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 's4' AND t.relname = tabla
        AND c.conname = 'ck_' || tabla || '_estado_registro'
    ) THEN
      EXECUTE format(
        'ALTER TABLE s4.%I ADD CONSTRAINT %I CHECK (estado_registro IN (0, 1))',
        tabla, 'ck_' || tabla || '_estado_registro'
      );
    END IF;
  END LOOP;
END
$$;

-- No se inventa autor histórico. Las filas existentes conservan NULL hasta su siguiente cambio.
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'rubricas', 'versiones_rubrica', 'etapas_rubrica', 'categorias_rubrica',
    'indicadores_rubrica', 'versiones_rubrica_carreras', 'vigencias_rubrica_carrera',
    'procesos_evaluacion', 'evaluaciones', 'calificaciones_evaluacion',
    'programaciones_sustentacion', 'programacion_estudiante', 'actas_archivadas',
    'notificaciones', 'configuracion_nota_minima', 'consecutivos_acta'
  ] LOOP
    EXECUTE format('ALTER TABLE s4.%I ADD COLUMN IF NOT EXISTS creado_por varchar(255)', tabla);
    EXECUTE format('ALTER TABLE s4.%I ADD COLUMN IF NOT EXISTS actualizado_por varchar(255)', tabla);
    EXECUTE format('ALTER TABLE s4.%I ADD COLUMN IF NOT EXISTS actualizado_en timestamptz', tabla);
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS s4.eventos_cambio_registro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocurrido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id varchar(255) NOT NULL,
  rol_bd varchar(255) NOT NULL,
  aplicacion varchar(255),
  correlation_id varchar(100),
  esquema varchar(63) NOT NULL,
  tabla varchar(63) NOT NULL,
  clave_registro jsonb NOT NULL,
  operacion varchar(16) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE')),
  antes jsonb,
  despues jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_s4_eventos_cambio_fecha
  ON s4.eventos_cambio_registro (ocurrido_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_s4_eventos_cambio_tabla_fecha
  ON s4.eventos_cambio_registro (tabla, ocurrido_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_s4_eventos_cambio_clave
  ON s4.eventos_cambio_registro USING gin (clave_registro);

CREATE OR REPLACE FUNCTION s4.establecer_metadatos_registro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, s4
AS $$
DECLARE
  actor text := CASE WHEN session_user = 'genares' THEN 'GENARES:LOCAL_DEVELOPMENT'
    ELSE COALESCE(NULLIF(current_setting('s4.actor_id', true), ''), session_user) END;
  instante timestamptz := clock_timestamp();
  datos jsonb;
BEGIN
  datos := to_jsonb(NEW);
  IF TG_OP = 'INSERT' THEN
    datos := jsonb_set(datos, '{creado_por}', to_jsonb(actor), true);
  END IF;
  datos := jsonb_set(datos, '{actualizado_por}', to_jsonb(actor), true);
  datos := jsonb_set(datos, '{actualizado_en}', to_jsonb(instante), true);
  NEW := jsonb_populate_record(NEW, datos);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.registrar_cambio_registro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, s4
AS $$
DECLARE
  nuevo jsonb := to_jsonb(NEW);
  anterior jsonb;
  clave jsonb;
  actor text := CASE WHEN session_user = 'genares' THEN 'GENARES:LOCAL_DEVELOPMENT'
    ELSE COALESCE(NULLIF(current_setting('s4.actor_id', true), ''), session_user) END;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    anterior := to_jsonb(OLD) - 'pdf';
  END IF;
  nuevo := nuevo - 'pdf';

  SELECT jsonb_object_agg(a.attname, nuevo -> a.attname ORDER BY k.orden)
  INTO clave
  FROM pg_index i
  CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, orden)
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
  WHERE i.indrelid = TG_RELID AND i.indisprimary;

  IF clave IS NULL THEN
    RAISE EXCEPTION 'La tabla %.% requiere una clave primaria para auditoría', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO s4.eventos_cambio_registro (
    actor_id, rol_bd, aplicacion, correlation_id, esquema, tabla,
    clave_registro, operacion, antes, despues
  ) VALUES (
    actor,
    session_user,
    NULLIF(current_setting('application_name', true), ''),
    NULLIF(current_setting('s4.correlation_id', true), ''),
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    clave,
    TG_OP,
    anterior,
    nuevo
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.rechazar_borrado_fisico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  RAISE EXCEPTION 'No se permite borrar físicamente datos S4; cambia estado_registro cuando aplique.'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION s4.rechazar_truncate_fisico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  RAISE EXCEPTION 'No se permite TRUNCATE en datos S4.' USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION s4.rechazar_edicion_historial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de auditoría e historial son inmutables.' USING ERRCODE = '55000';
END;
$$;

-- RF-36: una corrección extraordinaria solo modifica una evaluación cerrada si la
-- transacción apunta (s4.correccion_solicitud) a una solicitud APROBADA de esa evaluación.
-- La tabla la crea s4-correccion-calificaciones.sql; sin ella, nunca se autoriza.
CREATE OR REPLACE FUNCTION s4.correccion_autorizada(p_evaluacion uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, s4
AS $$
DECLARE
  v_solicitud text := NULLIF(current_setting('s4.correccion_solicitud', true), '');
BEGIN
  IF v_solicitud IS NULL OR to_regclass('s4.solicitudes_correccion_evaluacion') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM s4.solicitudes_correccion_evaluacion s
    WHERE s.id::text = v_solicitud AND s.id_evaluacion = p_evaluacion
      AND s.estado = 'APROBADA' AND s.estado_registro = 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_evaluacion_cerrada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado = 'CERRADA' THEN
      RAISE EXCEPTION 'Las evaluaciones deben cerrarse desde el flujo validado de Genares.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.estado = 'CERRADA'
     AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    -- Corrección aprobada (RF-36): solo cambian el total recalculado y la revisión.
    IF s4.correccion_autorizada(OLD.id)
       AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en',
             'calificacion_total', 'revision'])
           IS NOT DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en',
             'calificacion_total', 'revision']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Una evaluación cerrada no se modifica por operaciones ordinarias.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_calificacion_cerrada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM s4.evaluaciones e
      WHERE e.id = NEW.id_evaluacion AND e.estado = 'CERRADA'
    ) THEN
      RAISE EXCEPTION 'No se agregan puntajes a una evaluación cerrada.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  -- Se revisan origen y destino: mover un puntaje hacia una evaluación cerrada
  -- también la modificaría.
  IF EXISTS (
    SELECT 1 FROM s4.evaluaciones e
    WHERE e.id IN (OLD.id_evaluacion, NEW.id_evaluacion) AND e.estado = 'CERRADA'
  ) AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
        IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    -- Corrección aprobada (RF-36): solo la nota y la observación, sin mover el puntaje.
    IF NEW.id_evaluacion = OLD.id_evaluacion
       AND s4.correccion_autorizada(OLD.id_evaluacion)
       AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en',
             'score', 'observation'])
           IS NOT DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en',
             'score', 'observation']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La calificación de una evaluación cerrada es inmutable.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_rubrica_usada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM s4.versiones_rubrica vr
    JOIN s4.procesos_evaluacion p ON p.id_version_rubrica = vr.id
    WHERE vr.id_rubrica = OLD.id
  ) AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
        IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    RAISE EXCEPTION 'Una rúbrica con versiones usadas no se modifica; solo puede cambiar su visibilidad.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

-- Las claves únicas solo aplican a la estructura vigente; las filas retiradas
-- conservan su contenido y pueden coexistir con una nueva estructura del borrador.
ALTER TABLE s4.etapas_rubrica
  DROP CONSTRAINT IF EXISTS uq_etapas_rubrica_version_code,
  DROP CONSTRAINT IF EXISTS uq_etapas_rubrica_version_order;
ALTER TABLE s4.categorias_rubrica
  DROP CONSTRAINT IF EXISTS uq_categorias_rubrica_stage_code,
  DROP CONSTRAINT IF EXISTS uq_categorias_rubrica_stage_order;
ALTER TABLE s4.indicadores_rubrica
  DROP CONSTRAINT IF EXISTS uq_indicadores_rubrica_category_order;

-- Una base anterior puede tener estos índices con el mismo nombre pero sin el filtro
-- estado_registro = 1; IF NOT EXISTS los conservaría. Se recrean solo en ese caso.
DO $$
DECLARE indice text;
BEGIN
  FOREACH indice IN ARRAY ARRAY[
    'uq_etapas_rubrica_version_code', 'uq_etapas_rubrica_version_order',
    'uq_categorias_rubrica_stage_code', 'uq_categorias_rubrica_stage_order',
    'uq_indicadores_rubrica_category_order',
    'uq_vigencia_rubrica_actual_carrera_modalidad_periodo'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 's4' AND indexname = indice
        AND indexdef NOT LIKE '%estado_registro = 1%'
    ) THEN
      EXECUTE format('DROP INDEX s4.%I', indice);
    END IF;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_etapas_rubrica_version_code
  ON s4.etapas_rubrica (id_version_rubrica, codigo) WHERE estado_registro = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_etapas_rubrica_version_order
  ON s4.etapas_rubrica (id_version_rubrica, orden) WHERE estado_registro = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_rubrica_stage_code
  ON s4.categorias_rubrica (id_etapa_rubrica, codigo) WHERE estado_registro = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_rubrica_stage_order
  ON s4.categorias_rubrica (id_etapa_rubrica, orden) WHERE estado_registro = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_indicadores_rubrica_category_order
  ON s4.indicadores_rubrica (id_categoria, orden) WHERE estado_registro = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vigencia_rubrica_actual_carrera_modalidad_periodo
  ON s4.vigencias_rubrica_carrera (id_carrera, id_modalidad, periodo_academico_id)
  WHERE vigente_hasta IS NULL AND estado_registro = 1;

CREATE OR REPLACE FUNCTION s4.proteger_version_rubrica_usada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM s4.procesos_evaluacion p
    WHERE p.id_version_rubrica = OLD.id
  ) AND (to_jsonb(NEW) - ARRAY[
        'estado', 'estado_registro', 'activada_en', 'creado_por', 'actualizado_por', 'actualizado_en'
      ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
        'estado', 'estado_registro', 'activada_en', 'creado_por', 'actualizado_por', 'actualizado_en'
      ]) THEN
    RAISE EXCEPTION 'El contenido de una versión de rúbrica usada es inmutable.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_estructura_rubrica_usada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
DECLARE
  version_id uuid;
  version_destino_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'indicadores_rubrica' THEN
      SELECT c.id_version_rubrica INTO version_id
      FROM s4.categorias_rubrica c WHERE c.id = NEW.id_categoria;
    ELSE
      version_id := NEW.id_version_rubrica;
    END IF;
    IF EXISTS (SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = version_id) THEN
      RAISE EXCEPTION 'No se amplía la estructura de una versión de rúbrica ya usada.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'indicadores_rubrica' THEN
    SELECT c.id_version_rubrica INTO version_id
    FROM s4.categorias_rubrica c WHERE c.id = OLD.id_categoria;
    SELECT c.id_version_rubrica INTO version_destino_id
    FROM s4.categorias_rubrica c WHERE c.id = NEW.id_categoria;
  ELSE
    version_id := OLD.id_version_rubrica;
    version_destino_id := NEW.id_version_rubrica;
  END IF;

  IF (EXISTS (
    SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = version_id
  ) OR EXISTS (
    SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = version_destino_id
  )) AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
        IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    RAISE EXCEPTION 'La estructura de una versión de rúbrica usada es inmutable.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_asociacion_rubrica_usada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = NEW.id_version_rubrica
    ) AND NOT EXISTS (
      SELECT 1 FROM s4.versiones_rubrica_carreras asociacion
      WHERE asociacion.id_version_rubrica = NEW.id_version_rubrica
        AND asociacion.id_carrera = NEW.id_carrera
        AND asociacion.estado_registro = 0
    ) THEN
      RAISE EXCEPTION 'No se amplían las asignaciones de una versión de rúbrica ya utilizada.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = OLD.id_version_rubrica
  ) AND (to_jsonb(NEW) - ARRAY[
        'estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'
      ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
        'estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'
      ]) THEN
    RAISE EXCEPTION 'No se modifica la asignación de una versión ya utilizada.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_vigencia_rubrica_usada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = NEW.id_version_rubrica
    ) THEN
      RAISE EXCEPTION 'No se agregan vigencias a una versión de rúbrica ya utilizada.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM s4.procesos_evaluacion p WHERE p.id_version_rubrica = OLD.id_version_rubrica
  ) AND NOT (
    (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en', 'vigente_hasta'])
      IS NOT DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en', 'vigente_hasta'])
    AND (
      NEW.vigente_hasta IS NOT DISTINCT FROM OLD.vigente_hasta
      OR (OLD.vigente_hasta IS NULL AND NEW.vigente_hasta IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'No se modifica una vigencia de rúbrica ya utilizada; solo puede cambiar su visibilidad.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s4.proteger_acta_archivada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    RAISE EXCEPTION 'Un acta archivada no se sobrescribe; solo puede cambiar su visibilidad.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

-- SE-03: un trabajo finalizado no vuelve a otro estado ni cambia su rúbrica por
-- operaciones ordinarias. Solo puede cambiar su visibilidad (estado_registro).
CREATE OR REPLACE FUNCTION s4.proteger_trabajo_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
BEGIN
  IF OLD.estado = 'FINALIZADO'
     AND (to_jsonb(NEW) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en']) THEN
    RAISE EXCEPTION 'Un trabajo finalizado no se modifica por operaciones ordinarias.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

-- Reemplaza únicamente el validador de asignación para que no se asigne una versión oculta.
CREATE OR REPLACE FUNCTION s4.validar_rubrica_proceso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_carrera uuid;
  v_modalidad uuid;
  v_periodo uuid;
BEGIN
  IF NEW.id_version_rubrica IS NULL THEN RETURN NEW; END IF;
  SELECT t.carrera_id, t.modalidad_id, t.periodo_academico_id
  INTO v_carrera, v_modalidad, v_periodo
  FROM s2.asignacion_tema a
  JOIN gen.tema t ON t.id = a.tema_id
  WHERE a.id = NEW.asignacion_tema_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM s4.versiones_rubrica vr
    JOIN s4.rubricas r ON r.id = vr.id_rubrica
    JOIN s4.vigencias_rubrica_carrera vig ON vig.id_version_rubrica = vr.id
    WHERE vr.id = NEW.id_version_rubrica
      AND r.id_modalidad = v_modalidad
      AND vr.periodo_academico_id = v_periodo
      AND vig.id_carrera = v_carrera
      AND vr.estado = 'ACTIVA'
      AND vr.estado_registro = 1
      AND r.estado_registro = 1
      AND vig.estado_registro = 1
      AND vig.vigente_desde <= now()
      AND (vig.vigente_hasta IS NULL OR vig.vigente_hasta > now())
  ) THEN
    RAISE EXCEPTION 'Rúbrica no vigente/visible para modalidad, carrera y período del tema';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabla text;
  mutable text[] := ARRAY[
    'rubricas', 'versiones_rubrica', 'etapas_rubrica', 'categorias_rubrica',
    'indicadores_rubrica', 'versiones_rubrica_carreras', 'vigencias_rubrica_carrera',
    'procesos_evaluacion', 'evaluaciones', 'calificaciones_evaluacion',
    'programaciones_sustentacion', 'programacion_estudiante', 'actas_archivadas',
    'notificaciones', 'configuracion_nota_minima', 'consecutivos_acta'
  ];
  append_only text[] := ARRAY[
    'auditoria_rubricas', 'eventos_auditoria_evaluacion',
    'eventos_trazabilidad_trabajo', 'historial_nota_minima',
    'traspasos_evaluacion_estudiante'
  ];
BEGIN
  -- Bloqueo contra DELETE/TRUNCATE en cada tabla actual de S4, incluidas las de historial.
  FOR tabla IN SELECT tablename FROM pg_tables WHERE schemaname = 's4' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS s4_no_delete ON s4.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER s4_no_delete BEFORE DELETE ON s4.%I FOR EACH ROW EXECUTE FUNCTION s4.rechazar_borrado_fisico()',
      tabla
    );
    EXECUTE format('DROP TRIGGER IF EXISTS s4_no_truncate ON s4.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER s4_no_truncate BEFORE TRUNCATE ON s4.%I FOR EACH STATEMENT EXECUTE FUNCTION s4.rechazar_truncate_fisico()',
      tabla
    );
  END LOOP;

  -- Auditoría de filas mutables; los eventos de historial ya son su propia bitácora.
  FOREACH tabla IN ARRAY mutable LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS s4_00_metadatos ON s4.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER s4_00_metadatos BEFORE INSERT OR UPDATE ON s4.%I FOR EACH ROW EXECUTE FUNCTION s4.establecer_metadatos_registro()',
      tabla
    );
    EXECUTE format('DROP TRIGGER IF EXISTS s4_90_auditoria ON s4.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER s4_90_auditoria AFTER INSERT OR UPDATE ON s4.%I FOR EACH ROW EXECUTE FUNCTION s4.registrar_cambio_registro()',
      tabla
    );
  END LOOP;

  FOREACH tabla IN ARRAY append_only LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS s4_inmutable ON s4.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER s4_inmutable BEFORE UPDATE ON s4.%I FOR EACH ROW EXECUTE FUNCTION s4.rechazar_edicion_historial()',
      tabla
    );
  END LOOP;

  -- Auditoría append-only: permite INSERT únicamente desde el disparador de seguridad.
  DROP TRIGGER IF EXISTS s4_inmutable ON s4.eventos_cambio_registro;
  CREATE TRIGGER s4_inmutable BEFORE UPDATE ON s4.eventos_cambio_registro
    FOR EACH ROW EXECUTE FUNCTION s4.rechazar_edicion_historial();

  DROP TRIGGER IF EXISTS s4_10_evaluacion_cerrada ON s4.evaluaciones;
  CREATE TRIGGER s4_10_evaluacion_cerrada BEFORE INSERT OR UPDATE ON s4.evaluaciones
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_evaluacion_cerrada();
  DROP TRIGGER IF EXISTS s4_10_calificacion_cerrada ON s4.calificaciones_evaluacion;
  CREATE TRIGGER s4_10_calificacion_cerrada BEFORE INSERT OR UPDATE ON s4.calificaciones_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_calificacion_cerrada();
  DROP TRIGGER IF EXISTS s4_10_version_usada ON s4.versiones_rubrica;
  CREATE TRIGGER s4_10_version_usada BEFORE UPDATE ON s4.versiones_rubrica
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_version_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_etapa_usada ON s4.etapas_rubrica;
  CREATE TRIGGER s4_10_etapa_usada BEFORE INSERT OR UPDATE ON s4.etapas_rubrica
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_estructura_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_categoria_usada ON s4.categorias_rubrica;
  CREATE TRIGGER s4_10_categoria_usada BEFORE INSERT OR UPDATE ON s4.categorias_rubrica
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_estructura_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_indicador_usado ON s4.indicadores_rubrica;
  CREATE TRIGGER s4_10_indicador_usado BEFORE INSERT OR UPDATE ON s4.indicadores_rubrica
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_estructura_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_asignacion_version_usada ON s4.versiones_rubrica_carreras;
  CREATE TRIGGER s4_10_asignacion_version_usada BEFORE INSERT OR UPDATE ON s4.versiones_rubrica_carreras
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_asociacion_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_acta_archivada ON s4.actas_archivadas;
  CREATE TRIGGER s4_10_acta_archivada BEFORE UPDATE ON s4.actas_archivadas
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_acta_archivada();
  DROP TRIGGER IF EXISTS s4_10_trabajo_finalizado ON s4.procesos_evaluacion;
  CREATE TRIGGER s4_10_trabajo_finalizado BEFORE UPDATE ON s4.procesos_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_trabajo_finalizado();
  DROP TRIGGER IF EXISTS s4_10_rubrica_usada ON s4.rubricas;
  CREATE TRIGGER s4_10_rubrica_usada BEFORE UPDATE ON s4.rubricas
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_rubrica_usada();
  DROP TRIGGER IF EXISTS s4_10_vigencia_usada ON s4.vigencias_rubrica_carrera;
  CREATE TRIGGER s4_10_vigencia_usada BEFORE INSERT OR UPDATE ON s4.vigencias_rubrica_carrera
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_vigencia_rubrica_usada();
END
$$;

-- Los disparadores existentes usan genares.actor_id; el helper backend establecerá ambos contextos.
CREATE OR REPLACE FUNCTION s4.auditar_estado_participante_programacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor text;
  v_estado_anterior smallint;
  v_estado_nuevo smallint;
BEGIN
  IF OLD.estado_registro IS NOT DISTINCT FROM NEW.estado_registro THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(current_setting('genares.actor_id', true), ''), p.scheduled_by_actor_id)
  INTO v_actor
  FROM s4.programaciones_sustentacion p
  WHERE p.id = NEW.programacion_sustentacion_id;
  v_estado_anterior := OLD.estado_registro;
  v_estado_nuevo := NEW.estado_registro;
  INSERT INTO s4.eventos_trazabilidad_trabajo (
    id_proceso_evaluacion, ocurrido_en, tipo_evento, entidad_tipo, entidad_id,
    actor_id, actor_tipo, origen, detalles, evidencia, fuente_tipo, fuente_id
  )
  SELECT p.id_proceso_evaluacion, clock_timestamp(),
    CASE WHEN v_estado_nuevo = 0 THEN 'PARTICIPANTE_RETIRADO' ELSE 'PARTICIPANTE_REACTIVADO' END,
    'programacion', p.id,
    COALESCE(v_actor, session_user), 'USUARIO', 'CRONOGRAMA',
    jsonb_build_object('id_estudiante', NEW.id_estudiante,
      'estado_anterior', v_estado_anterior, 'estado_nuevo', v_estado_nuevo),
    'DIRECTA', 'participante_estado', gen_random_uuid()
  FROM s4.programaciones_sustentacion p
  WHERE p.id = NEW.programacion_sustentacion_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auditar_estado_participante_programacion ON s4.programacion_estudiante;
CREATE TRIGGER auditar_estado_participante_programacion
AFTER UPDATE OF estado_registro ON s4.programacion_estudiante
FOR EACH ROW EXECUTE FUNCTION s4.auditar_estado_participante_programacion();

-- El rol de ejecución conserva DML ya autorizado, pero no borrado ni truncado.
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA s4 FROM genares;
GRANT SELECT ON s4.eventos_cambio_registro TO genares;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON s4.eventos_cambio_registro FROM genares;

DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'rubricas', 'versiones_rubrica', 'etapas_rubrica', 'categorias_rubrica',
    'indicadores_rubrica', 'versiones_rubrica_carreras', 'vigencias_rubrica_carrera',
    'procesos_evaluacion', 'evaluaciones', 'calificaciones_evaluacion',
    'programaciones_sustentacion', 'programacion_estudiante', 'actas_archivadas',
    'notificaciones'
  ] LOOP
    EXECUTE format('GRANT UPDATE (estado_registro) ON s4.%I TO genares', tabla);
  END LOOP;
END
$$;

COMMIT;
