import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchivoActas1760000012000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE consecutivos_acta (
        id_carrera uuid NOT NULL REFERENCES carreras(id) ON DELETE RESTRICT,
        periodo varchar(6) NOT NULL CHECK (periodo ~ '^[0-9]{4}-[12]$'),
        ultimo integer NOT NULL CHECK (ultimo > 0),
        PRIMARY KEY (id_carrera, periodo)
      );
      CREATE TABLE actas_archivadas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        numero varchar(80) NOT NULL UNIQUE,
        id_carrera uuid NOT NULL REFERENCES carreras(id) ON DELETE RESTRICT,
        id_periodo uuid NOT NULL REFERENCES periodos_academicos(id) ON DELETE RESTRICT,
        periodo varchar(6) NOT NULL CHECK (periodo ~ '^[0-9]{4}-[12]$'),
        consecutivo integer NOT NULL CHECK (consecutivo > 0),
        id_trabajo uuid NOT NULL REFERENCES trabajos_titulacion(id) ON DELETE RESTRICT,
        id_estudiante uuid NOT NULL REFERENCES perfiles_estudiante(id) ON DELETE RESTRICT,
        formato varchar(20) NOT NULL CHECK (formato IN ('PAT-01-F-019','PAT-04-F-017')),
        revision smallint NOT NULL,
        generado_en timestamptz NOT NULL DEFAULT now(),
        generado_por varchar(255) NOT NULL,
        pdf bytea NOT NULL CHECK (octet_length(pdf) > 0),
        sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        UNIQUE (id_carrera, periodo, consecutivo),
        UNIQUE (id_trabajo, id_estudiante, formato),
        FOREIGN KEY (id_trabajo,id_estudiante) REFERENCES estudiantes_trabajo(id_trabajo,id_estudiante) ON DELETE RESTRICT,
        CHECK ((formato='PAT-01-F-019' AND revision=1) OR (formato='PAT-04-F-017' AND revision=2))
      );
      CREATE FUNCTION proteger_archivo_acta() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Las actas archivadas son inmutables' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER acta_inmutable BEFORE UPDATE OR DELETE ON actas_archivadas
        FOR EACH ROW EXECUTE FUNCTION proteger_archivo_acta();
      CREATE TRIGGER acta_no_truncar BEFORE TRUNCATE ON actas_archivadas
        FOR EACH STATEMENT EXECUTE FUNCTION proteger_archivo_acta();
      CREATE FUNCTION validar_identidad_acta() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE codigo_carrera text; codigo_periodo text; BEGIN
        SELECT c.codigo,p.codigo INTO codigo_carrera,codigo_periodo
        FROM trabajos_titulacion t JOIN carreras c ON c.id=t.id_carrera
        JOIN periodos_academicos p ON p.id=t.periodo_academico_id
        WHERE t.id=NEW.id_trabajo AND c.id=NEW.id_carrera AND p.id=NEW.id_periodo;
        IF codigo_carrera IS NULL OR codigo_carrera NOT IN ('TI','SOFT') OR codigo_periodo<>NEW.periodo
          OR NEW.numero <> lpad(NEW.consecutivo::text,greatest(3,length(NEW.consecutivo::text)),'0') || '-' || NEW.periodo || '-' || codigo_carrera THEN
          RAISE EXCEPTION 'Identidad documental incoherente' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER acta_identidad BEFORE INSERT ON actas_archivadas
        FOR EACH ROW EXECUTE FUNCTION validar_identidad_acta();
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    // No borrar documentos emitidos al revertir por accidente.
    await q.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM actas_archivadas) THEN
      RAISE EXCEPTION 'No se puede revertir un archivo con actas emitidas'; END IF; END $$`);
    await q.query('DROP TABLE actas_archivadas; DROP FUNCTION proteger_archivo_acta(); DROP FUNCTION validar_identidad_acta(); DROP TABLE consecutivos_acta');
  }
}
