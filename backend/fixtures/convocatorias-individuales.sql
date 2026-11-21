BEGIN;
CREATE TABLE IF NOT EXISTS s4.politica_convocatoria (
  revision integer PRIMARY KEY,
  reglas jsonb NOT NULL,
  actor text NOT NULL,
  registrada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO s4.politica_convocatoria(revision,reglas,actor)
VALUES (1,'{"mismoPeriodo":true,"otroPeriodo":true,"revisar":true,"escrita":"ELEGIR","dias":null,"inicio":"APERTURA"}','instalacion')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS s4.convocatoria_individual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso uuid NOT NULL REFERENCES s4.procesos_evaluacion,
  estudiante uuid NOT NULL REFERENCES gen.estudiante,
  periodo uuid NOT NULL REFERENCES gen.periodo_academico,
  numero integer NOT NULL CHECK(numero >= 2),
  politica integer NOT NULL REFERENCES s4.politica_convocatoria,
  estado text NOT NULL CHECK(estado IN ('ABIERTA','APROBADA','REPROBADA')),
  rubrica jsonb NOT NULL, evaluadores jsonb NOT NULL, conservar uuid[] NOT NULL,
  minimo numeric NOT NULL, escala numeric NOT NULL, redondeo text NOT NULL,
  nota numeric, abierta_por text NOT NULL, abierta_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  vence date, cerrada_en timestamptz,
  UNIQUE(proceso,estudiante,numero)
);
CREATE TABLE IF NOT EXISTS s4.nota_convocatoria (
  convocatoria uuid NOT NULL REFERENCES s4.convocatoria_individual,
  etapa uuid NOT NULL, evaluador uuid NOT NULL, valores jsonb NOT NULL, total numeric NOT NULL,
  origen uuid, actor text NOT NULL, cerrada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(convocatoria,etapa,evaluador)
);
CREATE TABLE IF NOT EXISTS s4.revision_convocatoria (
  proceso uuid NOT NULL REFERENCES s4.procesos_evaluacion,
  estudiante uuid NOT NULL REFERENCES gen.estudiante, numero integer NOT NULL,
  motivo text NOT NULL, actor text NOT NULL, fecha timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(proceso,estudiante,numero)
);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='genares') THEN
  GRANT SELECT,INSERT ON s4.politica_convocatoria,s4.convocatoria_individual,s4.nota_convocatoria,s4.revision_convocatoria TO genares;
  GRANT UPDATE(estado,nota,cerrada_en) ON s4.convocatoria_individual TO genares;
END IF; END $$;
COMMIT;
