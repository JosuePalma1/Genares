BEGIN;
ALTER TABLE s4.version_flujo
  ADD COLUMN IF NOT EXISTS evidencia_correccion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dias_correccion integer CHECK (dias_correccion BETWEEN 0 AND 36500);
ALTER TABLE IF EXISTS s4.solicitudes_correccion_evaluacion
  ALTER COLUMN justificativo_ruta DROP NOT NULL, ALTER COLUMN justificativo_sha256 DROP NOT NULL,
  ALTER COLUMN justificativo_nombre DROP NOT NULL, ALTER COLUMN justificativo_bytes DROP NOT NULL;

CREATE TABLE IF NOT EXISTS s4.reemplazos_etapa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proceso uuid NOT NULL REFERENCES s4.procesos_evaluacion(id),
  etapa uuid NOT NULL REFERENCES s4.etapas_rubrica(id),
  puesto uuid NOT NULL REFERENCES s3.asignacion_tribunal(asignacion_tribunal_id),
  anterior uuid NOT NULL REFERENCES gen.docente(id),
  docente uuid NOT NULL REFERENCES gen.docente(id),
  motivo text NOT NULL CHECK(length(trim(motivo)) BETWEEN 1 AND 1000),
  actor text NOT NULL, fecha timestamptz NOT NULL DEFAULT now(),
  CHECK(docente <> anterior)
);
CREATE INDEX IF NOT EXISTS reemplazos_etapa_puesto ON s4.reemplazos_etapa(proceso,etapa,puesto,id DESC);
CREATE OR REPLACE VIEW s4.reemplazos_etapa_actuales AS
 SELECT DISTINCT ON (proceso,etapa,puesto) proceso,etapa,puesto,docente FROM s4.reemplazos_etapa ORDER BY proceso,etapa,puesto,id DESC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='genares') THEN
   GRANT SELECT,INSERT ON s4.reemplazos_etapa TO genares;
   GRANT SELECT ON s4.reemplazos_etapa_actuales TO genares;
   GRANT USAGE ON SEQUENCE s4.reemplazos_etapa_id_seq TO genares;
 END IF;
END $$;
COMMIT;
