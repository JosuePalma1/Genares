BEGIN;
CREATE TABLE IF NOT EXISTS s4.excepcion_programacion (
  programacion uuid PRIMARY KEY REFERENCES s4.programaciones_sustentacion(id),
  version_flujo integer NOT NULL REFERENCES s4.version_flujo(version),
  actor text NOT NULL, rol text NOT NULL, fecha timestamptz NOT NULL DEFAULT clock_timestamp(),
  advertencias text[] NOT NULL, excepciones text[] NOT NULL, motivo text,
  CHECK (cardinality(advertencias) + cardinality(excepciones) > 0),
  CHECK (cardinality(excepciones) = 0 OR (motivo IS NOT NULL AND length(trim(motivo)) > 0))
);
GRANT SELECT,INSERT ON s4.excepcion_programacion TO genares;
COMMIT;
