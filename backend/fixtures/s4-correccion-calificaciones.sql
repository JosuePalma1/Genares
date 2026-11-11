-- RF-36 · Corrección extraordinaria de evaluaciones cerradas (AU-02 / AU-03).
-- Ejecutar como postgres en genares_integrado_dev DESPUÉS de s4-retencion-visibilidad-auditoria.sql.
-- Idempotente: puede repetirse sin duplicar objetos. No modifica S1, S2 ni S3.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
  IF to_regprocedure('s4.correccion_autorizada(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Ejecuta primero s4-retencion-visibilidad-auditoria.sql';
  END IF;
END
$$;

-- Una solicitud guarda el cambio exacto que se autoriza: notas anteriores y propuestas,
-- totales, motivo, PDF justificativo (ruta relativa y SHA-256) y quién resolvió.
CREATE TABLE IF NOT EXISTS s4.solicitudes_correccion_evaluacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_evaluacion uuid NOT NULL REFERENCES s4.evaluaciones (id),
  id_proceso_evaluacion uuid NOT NULL REFERENCES s4.procesos_evaluacion (id),
  estado text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'APLICADA')),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 10 AND 2000),
  revision_base integer NOT NULL,
  puntajes_anteriores jsonb NOT NULL,
  puntajes_propuestos jsonb NOT NULL,
  total_anterior numeric NOT NULL,
  total_propuesto numeric NOT NULL,
  justificativo_ruta text NOT NULL CHECK (justificativo_ruta ~ '^auditoria/justificativos/[0-9a-f-]{36}\.pdf$'),
  justificativo_sha256 char(64) NOT NULL CHECK (justificativo_sha256 ~ '^[0-9a-f]{64}$'),
  justificativo_nombre text NOT NULL,
  justificativo_bytes integer NOT NULL CHECK (justificativo_bytes > 0),
  solicitado_por varchar NOT NULL,
  solicitado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  resuelto_por varchar,
  resuelto_en timestamptz,
  comentario_resolucion text,
  aplicada_en timestamptz,
  estado_registro smallint NOT NULL DEFAULT 1 CHECK (estado_registro IN (0, 1)),
  creado_por varchar,
  actualizado_por varchar,
  actualizado_en timestamptz
);

-- Una sola solicitud abierta por evaluación.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_correccion_abierta
  ON s4.solicitudes_correccion_evaluacion (id_evaluacion)
  WHERE estado IN ('PENDIENTE', 'APROBADA') AND estado_registro = 1;
CREATE INDEX IF NOT EXISTS idx_solicitudes_correccion_estado
  ON s4.solicitudes_correccion_evaluacion (estado, solicitado_en DESC);

-- Máquina de estados: PENDIENTE → APROBADA | RECHAZADA; APROBADA → APLICADA.
-- El contenido solicitado y una resolución tomada no se modifican.
CREATE OR REPLACE FUNCTION s4.proteger_solicitud_correccion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, s4
AS $$
DECLARE
  editables constant text[] := ARRAY['estado', 'resuelto_por', 'resuelto_en', 'comentario_resolucion',
    'aplicada_en', 'estado_registro', 'creado_por', 'actualizado_por', 'actualizado_en'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'PENDIENTE' OR NEW.resuelto_por IS NOT NULL OR NEW.resuelto_en IS NOT NULL
       OR NEW.comentario_resolucion IS NOT NULL OR NEW.aplicada_en IS NOT NULL THEN
      RAISE EXCEPTION 'Una solicitud de corrección se registra siempre como PENDIENTE.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - editables) IS DISTINCT FROM (to_jsonb(OLD) - editables) THEN
    RAISE EXCEPTION 'El contenido de una solicitud de corrección no se modifica.' USING ERRCODE = '55000';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT ((OLD.estado = 'PENDIENTE' AND NEW.estado IN ('APROBADA', 'RECHAZADA'))
         OR (OLD.estado = 'APROBADA' AND NEW.estado = 'APLICADA')) THEN
      RAISE EXCEPTION 'Transición no permitida: % → %.', OLD.estado, NEW.estado USING ERRCODE = '55000';
    END IF;
    IF NEW.estado IN ('APROBADA', 'RECHAZADA') AND (NEW.resuelto_por IS NULL OR NEW.resuelto_en IS NULL) THEN
      RAISE EXCEPTION 'La resolución requiere responsable y fecha.' USING ERRCODE = '55000';
    END IF;
    IF NEW.estado = 'RECHAZADA' AND char_length(btrim(COALESCE(NEW.comentario_resolucion, ''))) < 10 THEN
      RAISE EXCEPTION 'El rechazo requiere un motivo de al menos 10 caracteres.' USING ERRCODE = '55000';
    END IF;
    IF NEW.estado = 'APLICADA' AND NEW.aplicada_en IS NULL THEN
      RAISE EXCEPTION 'La aplicación requiere fecha.' USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Una vez resuelta, la resolución no cambia (solo puede completarse la aplicación).
  IF OLD.resuelto_por IS NOT NULL AND (
       NEW.resuelto_por IS DISTINCT FROM OLD.resuelto_por
       OR NEW.resuelto_en IS DISTINCT FROM OLD.resuelto_en
       OR NEW.comentario_resolucion IS DISTINCT FROM OLD.comentario_resolucion) THEN
    RAISE EXCEPTION 'La resolución de una solicitud no se modifica.' USING ERRCODE = '55000';
  END IF;
  IF OLD.aplicada_en IS NOT NULL AND NEW.aplicada_en IS DISTINCT FROM OLD.aplicada_en THEN
    RAISE EXCEPTION 'La fecha de aplicación no se modifica.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS s4_10_solicitud_correccion ON s4.solicitudes_correccion_evaluacion;
  CREATE TRIGGER s4_10_solicitud_correccion BEFORE INSERT OR UPDATE ON s4.solicitudes_correccion_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.proteger_solicitud_correccion();
  -- Mismas protecciones de retención y auditoría que el resto de S4.
  DROP TRIGGER IF EXISTS s4_no_delete ON s4.solicitudes_correccion_evaluacion;
  CREATE TRIGGER s4_no_delete BEFORE DELETE ON s4.solicitudes_correccion_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.rechazar_borrado_fisico();
  DROP TRIGGER IF EXISTS s4_no_truncate ON s4.solicitudes_correccion_evaluacion;
  CREATE TRIGGER s4_no_truncate BEFORE TRUNCATE ON s4.solicitudes_correccion_evaluacion
    FOR EACH STATEMENT EXECUTE FUNCTION s4.rechazar_truncate_fisico();
  DROP TRIGGER IF EXISTS s4_00_metadatos ON s4.solicitudes_correccion_evaluacion;
  CREATE TRIGGER s4_00_metadatos BEFORE INSERT OR UPDATE ON s4.solicitudes_correccion_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.establecer_metadatos_registro();
  DROP TRIGGER IF EXISTS s4_90_auditoria ON s4.solicitudes_correccion_evaluacion;
  CREATE TRIGGER s4_90_auditoria AFTER INSERT OR UPDATE ON s4.solicitudes_correccion_evaluacion
    FOR EACH ROW EXECUTE FUNCTION s4.registrar_cambio_registro();
END
$$;

-- El rol de aplicación registra y resuelve solicitudes; no las borra ni reescribe su contenido.
REVOKE DELETE, TRUNCATE ON s4.solicitudes_correccion_evaluacion FROM genares;
GRANT SELECT, INSERT ON s4.solicitudes_correccion_evaluacion TO genares;
GRANT UPDATE (estado, resuelto_por, resuelto_en, comentario_resolucion, aplicada_en, estado_registro)
  ON s4.solicitudes_correccion_evaluacion TO genares;
-- Lectura del historial de cierres y correcciones de una evaluación.
GRANT SELECT ON s4.eventos_auditoria_evaluacion TO genares;

COMMIT;
