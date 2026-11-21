BEGIN;
DO $$ BEGIN IF current_database() <> 'genares_integrado_dev' THEN RAISE EXCEPTION 'Base de desarrollo incorrecta'; END IF; END $$;
-- Versiones inmutables del flujo. Cada proceso conserva la versión asignada al crearse.
CREATE TABLE IF NOT EXISTS s4.version_flujo (
  version integer PRIMARY KEY, pasos jsonb NOT NULL, publicado_por text NOT NULL,
  publicado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO s4.version_flujo(version,pasos,publicado_por,publicado_en) VALUES (1,'[]','instalacion',now()) ON CONFLICT DO NOTHING;
ALTER TABLE s4.version_flujo ADD COLUMN IF NOT EXISTS carrera uuid REFERENCES gen.carrera(id),
  ADD COLUMN IF NOT EXISTS modalidad uuid REFERENCES gen.modalidad(id),
  ADD COLUMN IF NOT EXISTS periodo uuid REFERENCES gen.periodo_academico(id),
  ADD COLUMN IF NOT EXISTS umbral numeric(5,2) CHECK(umbral BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS redondeo text NOT NULL DEFAULT 'HALF_UP' CHECK(redondeo IN ('HALF_UP','TRUNCAR'));
ALTER TABLE s4.procesos_evaluacion ADD COLUMN IF NOT EXISTS version_flujo integer NOT NULL DEFAULT 1 REFERENCES s4.version_flujo;
ALTER TABLE s4.procesos_evaluacion ADD COLUMN IF NOT EXISTS redondeo_final text NOT NULL DEFAULT 'HALF_UP';
ALTER TABLE s4.procesos_evaluacion ADD COLUMN IF NOT EXISTS porcentaje_aprobacion numeric(5,2) CHECK (porcentaje_aprobacion BETWEEN 0 AND 100);
UPDATE s4.procesos_evaluacion SET porcentaje_aprobacion=(SELECT COALESCE((to_jsonb(c)->>'porcentaje')::numeric,10*(to_jsonb(c)->>'valor')::numeric) FROM s4.configuracion_nota_minima c WHERE id=1)
WHERE porcentaje_aprobacion IS NULL AND EXISTS(SELECT 1 FROM s4.configuracion_nota_minima WHERE id=1);
CREATE OR REPLACE FUNCTION s4.asignar_version_flujo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT f.version INTO STRICT NEW.version_flujo FROM s4.version_flujo f
  JOIN s2.asignacion_tema a ON a.id=NEW.asignacion_tema_id JOIN gen.tema t ON t.id=a.tema_id
  WHERE (f.carrera IS NULL OR f.carrera=t.carrera_id) AND (f.modalidad IS NULL OR f.modalidad=t.modalidad_id)
    AND (f.periodo IS NULL OR f.periodo=t.periodo_academico_id)
  ORDER BY num_nonnulls(f.carrera,f.modalidad,f.periodo) DESC,f.version DESC LIMIT 1;
  SELECT COALESCE((to_jsonb(c)->>'porcentaje')::numeric,10*(to_jsonb(c)->>'valor')::numeric) INTO NEW.porcentaje_aprobacion FROM s4.configuracion_nota_minima c WHERE id=1;
  SELECT f.redondeo,COALESCE(f.umbral,NEW.porcentaje_aprobacion) INTO NEW.redondeo_final,NEW.porcentaje_aprobacion FROM s4.version_flujo f WHERE f.version=NEW.version_flujo;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS asignar_version_flujo ON s4.procesos_evaluacion;
CREATE TRIGGER asignar_version_flujo BEFORE INSERT ON s4.procesos_evaluacion
FOR EACH ROW EXECUTE FUNCTION s4.asignar_version_flujo();
CREATE TABLE IF NOT EXISTS s4.historial_paso (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proceso uuid NOT NULL REFERENCES s4.procesos_evaluacion(id),
  paso text NOT NULL, accion text NOT NULL CHECK (accion IN ('SOLICITADO','CUMPLIDO','RECHAZADO')),
  actor text NOT NULL, fecha timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS historial_paso_proceso ON s4.historial_paso(proceso,paso,id DESC);
GRANT SELECT,INSERT ON s4.version_flujo,s4.historial_paso TO genares;
CREATE TABLE IF NOT EXISTS s4.continuidad_estudiante (
  proceso uuid NOT NULL REFERENCES s4.procesos_evaluacion(id),
  estudiante uuid NOT NULL REFERENCES gen.estudiante(id),
  periodo_destino uuid NOT NULL REFERENCES gen.periodo_academico(id),
  nota numeric NOT NULL, minimo numeric NOT NULL, escala numeric NOT NULL,
  actor text NOT NULL, registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(proceso,estudiante)
);
GRANT SELECT,INSERT ON s4.continuidad_estudiante TO genares;
CREATE TABLE IF NOT EXISTS s4.permisos_rol_version (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, rol text NOT NULL,
  permisos text[] NOT NULL, actor text NOT NULL, cambiado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS permisos_rol_ultima ON s4.permisos_rol_version(rol,id DESC);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='genares') THEN
  GRANT SELECT, INSERT ON s4.permisos_rol_version TO genares;
END IF; END $$;
COMMIT;
