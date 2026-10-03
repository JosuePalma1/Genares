import { MigrationInterface, QueryRunner } from 'typeorm';

export class EtapasRubricaDinamicas1760000001000 implements MigrationInterface {
  nombre = 'EtapasRubricaDinamicas1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "alcance_etapa_rubrica_enum" AS ENUM ('TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL');

      CREATE TABLE "etapas_rubrica" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_version_rubrica" uuid NOT NULL,
        "kind" etapa_evaluacion_enum NOT NULL,
        "scope" alcance_etapa_rubrica_enum NOT NULL,
        "codigo" varchar(40) NOT NULL,
        "nombre" varchar(220) NOT NULL,
        "descripcion" text,
        "calificacion_maxima" numeric(5,2) NOT NULL,
        "porcentaje" numeric(5,2),
        "orden" smallint NOT NULL,
        CONSTRAINT "uq_etapas_rubrica_version_kind" UNIQUE ("id_version_rubrica", "kind"),
        CONSTRAINT "uq_etapas_rubrica_version_order" UNIQUE ("id_version_rubrica", "orden"),
        CONSTRAINT "chk_etapas_rubrica_values" CHECK (
          "calificacion_maxima" > 0 AND "orden" > 0 AND
          ("porcentaje" IS NULL OR ("porcentaje" > 0 AND "porcentaje" <= 100))
        ),
        CONSTRAINT "chk_etapas_rubrica_scope" CHECK (
          ("kind" = 'ESCRITA' AND "scope" = 'TRABAJO_COMPARTIDO') OR
          ("kind" = 'ORAL' AND "scope" = 'ESTUDIANTE_INDIVIDUAL')
        ),
        CONSTRAINT "fk_etapas_rubrica_version" FOREIGN KEY ("id_version_rubrica")
          REFERENCES "versiones_rubrica"("id") ON DELETE CASCADE
      );

      INSERT INTO "etapas_rubrica" (
        "id_version_rubrica", "kind", "scope", "codigo", "nombre", "descripcion", "calificacion_maxima", "porcentaje", "orden"
      )
      SELECT "id", 'ESCRITA', 'TRABAJO_COMPARTIDO', 'PARTE_I', 'Revisión proyecto escrito',
        'La calificación corresponde al trabajo y se comparte entre sus autores.',
        "written_calificacion_maxima", 50.00, 1
      FROM "versiones_rubrica";

      INSERT INTO "etapas_rubrica" (
        "id_version_rubrica", "kind", "scope", "codigo", "nombre", "descripcion", "calificacion_maxima", "porcentaje", "orden"
      )
      SELECT "id", 'ORAL', 'ESTUDIANTE_INDIVIDUAL', 'PARTE_II', 'Sustentación del proyecto',
        'La calificación corresponde individualmente al estudiante seleccionado.',
        "oral_calificacion_maxima", 50.00, 2
      FROM "versiones_rubrica";

      ALTER TABLE "categorias_rubrica" ADD COLUMN "id_etapa_rubrica" uuid;
      UPDATE "categorias_rubrica" categoria
      SET "id_etapa_rubrica" = etapa."id"
      FROM "etapas_rubrica" etapa
      WHERE etapa."id_version_rubrica" = categoria."id_version_rubrica"
        AND etapa."kind" = categoria."etapa";
      ALTER TABLE "categorias_rubrica" ALTER COLUMN "id_etapa_rubrica" SET NOT NULL;
      ALTER TABLE "categorias_rubrica" ADD CONSTRAINT "fk_categorias_rubrica_stage"
        FOREIGN KEY ("id_etapa_rubrica") REFERENCES "etapas_rubrica"("id") ON DELETE CASCADE;

      DROP TRIGGER IF EXISTS "trg_validar_activacion_version_rubrica" ON "versiones_rubrica";
      DROP TRIGGER IF EXISTS "trg_validar_contexto_evaluacion" ON "evaluaciones";
      DROP TRIGGER IF EXISTS "trg_validar_cierre_evaluacion" ON "evaluaciones";
      DROP TRIGGER IF EXISTS "trg_proteger_calificaciones_evaluacion_cerrada" ON "calificaciones_evaluacion";
      DROP FUNCTION IF EXISTS "validar_activacion_version_rubrica"();
      DROP FUNCTION IF EXISTS "validar_contexto_evaluacion"();
      DROP FUNCTION IF EXISTS "validar_cierre_evaluacion"();
      DROP FUNCTION IF EXISTS "proteger_calificaciones_evaluacion_cerrada"();

      ALTER TABLE "categorias_rubrica" DROP COLUMN "etapa";
      ALTER TABLE "versiones_rubrica" DROP COLUMN "written_calificacion_maxima";
      ALTER TABLE "versiones_rubrica" DROP COLUMN "oral_calificacion_maxima";

      CREATE OR REPLACE FUNCTION "validar_activacion_version_rubrica"()
      RETURNS trigger AS $$
      DECLARE
        target_modality uuid;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."estado" <> 'BORRADOR' THEN
          IF OLD."id_rubrica" IS DISTINCT FROM NEW."id_rubrica"
            OR OLD."periodo_academico_id" IS DISTINCT FROM NEW."periodo_academico_id"
            OR OLD."version" IS DISTINCT FROM NEW."version"
            OR OLD."activada_en" IS DISTINCT FROM NEW."activada_en" THEN
            RAISE EXCEPTION 'Una versión de rúbrica activa o archivada es inmutable.';
          END IF;
          IF OLD."estado" = 'ARCHIVADA' AND NEW."estado" <> 'ARCHIVADA' THEN
            RAISE EXCEPTION 'Una versión de rúbrica archivada no puede reactivarse.';
          END IF;
        END IF;

        IF NEW."estado" = 'ACTIVA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'ACTIVA') THEN
          SELECT "id_modalidad" INTO target_modality FROM "rubricas" WHERE "id" = NEW."id_rubrica";
          IF EXISTS (
            SELECT 1 FROM "versiones_rubrica" existing_version
            JOIN "rubricas" existing_rubric ON existing_rubric."id" = existing_version."id_rubrica"
            WHERE existing_version."estado" = 'ACTIVA'
              AND existing_version."periodo_academico_id" = NEW."periodo_academico_id"
              AND existing_rubric."id_modalidad" = target_modality
              AND existing_version."id" <> NEW."id"
          ) THEN
            RAISE EXCEPTION 'Ya existe una versión activa para esta modalidad y período.';
          END IF;

          IF (SELECT count(*) FROM "etapas_rubrica" WHERE "id_version_rubrica" = NEW."id") <> 2 THEN
            RAISE EXCEPTION 'La versión debe configurar las etapas escrita compartida y oral individual.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "etapas_rubrica" etapa
            LEFT JOIN "categorias_rubrica" categoria ON categoria."id_etapa_rubrica" = etapa."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY etapa."id", etapa."calificacion_maxima"
            HAVING count(categoria."id") = 0 OR COALESCE(sum(categoria."calificacion_maxima"), 0) <> etapa."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Las categorías no coinciden con el máximo configurado para su etapa.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "categorias_rubrica" categoria
            JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
            LEFT JOIN "indicadores_rubrica" indicador ON indicador."id_categoria" = categoria."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY categoria."id", categoria."calificacion_maxima"
            HAVING count(indicador."id") = 0 OR COALESCE(sum(indicador."calificacion_maxima"), 0) <> categoria."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Los indicadores no coinciden con el máximo de su categoría.';
          END IF;
          NEW."activada_en" := COALESCE(NEW."activada_en", now());
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_activacion_version_rubrica"
      BEFORE INSERT OR UPDATE ON "versiones_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "validar_activacion_version_rubrica"();

      CREATE OR REPLACE FUNCTION "validar_contexto_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        configured_max numeric(5,2);
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "miembros_tribunal" tm
          JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
          WHERE tm."id" = NEW."id_miembro_tribunal" AND ta."id_trabajo" = NEW."id_trabajo" AND ta."estado" = 'CONFIRMADO'
        ) THEN
          RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.';
        END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" ws WHERE ws."id_trabajo" = NEW."id_trabajo" AND ws."id_estudiante" = NEW."id_estudiante"
        ) THEN
          RAISE EXCEPTION 'La evaluación oral debe corresponder a un estudiante del trabajo.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM "estudiantes_trabajo" ws WHERE ws."id_trabajo" = NEW."id_trabajo") THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" ds WHERE ds."id_trabajo" = NEW."id_trabajo" AND ds."estado" <> 'CANCELADA'
        ) THEN
          RAISE EXCEPTION 'La evaluación oral requiere una sustentación programada.';
        END IF;
        SELECT "id_version_rubrica" INTO bound_rubric_version FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";
        IF bound_rubric_version IS NULL OR bound_rubric_version <> NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La evaluación debe conservar la versión de rúbrica fijada al trabajo.';
        END IF;
        SELECT "calificacion_maxima" INTO configured_max FROM "etapas_rubrica"
        WHERE "id_version_rubrica" = NEW."id_version_rubrica" AND "kind" = NEW."etapa";
        IF configured_max IS NULL OR NEW."instantanea_calificacion_maxima" <> configured_max THEN
          RAISE EXCEPTION 'El máximo de la evaluación no coincide con la etapa de la versión de rúbrica.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_contexto_evaluacion"
      BEFORE INSERT OR UPDATE OF "id_trabajo", "id_miembro_tribunal", "id_estudiante", "id_version_rubrica", "etapa", "instantanea_calificacion_maxima"
      ON "evaluaciones" FOR EACH ROW EXECUTE FUNCTION "validar_contexto_evaluacion"();

      CREATE OR REPLACE FUNCTION "validar_cierre_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        expected_indicators integer;
        recorded_indicators integer;
        calculated_total numeric(8,2);
      BEGIN
        IF NEW."estado" = 'CERRADA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'CERRADA') THEN
          SELECT count(*) INTO expected_indicators
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
          WHERE etapa."id_version_rubrica" = NEW."id_version_rubrica" AND etapa."kind" = NEW."etapa";
          SELECT count(*), COALESCE(sum("score"), 0) INTO recorded_indicators, calculated_total
          FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = NEW."id";
          IF expected_indicators = 0 OR recorded_indicators <> expected_indicators THEN
            RAISE EXCEPTION 'No se puede cerrar una evaluación con indicadores incompletos.';
          END IF;
          IF calculated_total <> NEW."calificacion_total" THEN
            RAISE EXCEPTION 'El total de la evaluación no coincide con sus indicadores.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_cierre_evaluacion"
      BEFORE INSERT OR UPDATE OF "estado", "calificacion_total" ON "evaluaciones"
      FOR EACH ROW EXECUTE FUNCTION "validar_cierre_evaluacion"();

      CREATE OR REPLACE FUNCTION "proteger_calificaciones_evaluacion_cerrada"()
      RETURNS trigger AS $$
      DECLARE
        target_id_evaluacion uuid;
        target_status estado_evaluacion_enum;
        target_version_id uuid;
        target_stage etapa_evaluacion_enum;
        indicator_version_id uuid;
        indicator_stage etapa_evaluacion_enum;
        indicator_max numeric(5,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND (
          OLD."id_evaluacion" IS DISTINCT FROM NEW."id_evaluacion" OR OLD."id_indicador" IS DISTINCT FROM NEW."id_indicador"
        ) THEN
          RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluación o indicador.';
        END IF;
        target_id_evaluacion := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_evaluacion" ELSE NEW."id_evaluacion" END;
        SELECT "estado", "id_version_rubrica", "etapa" INTO target_status, target_version_id, target_stage
        FROM "evaluaciones" WHERE "id" = target_id_evaluacion;
        IF target_status = 'CERRADA' THEN
          RAISE EXCEPTION 'Los puntajes de una evaluación cerrada no pueden modificarse.';
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT etapa."id_version_rubrica", etapa."kind", indicador."calificacion_maxima"
            INTO indicator_version_id, indicator_stage, indicator_max
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
          WHERE indicador."id" = NEW."id_indicador";
          IF indicator_version_id IS DISTINCT FROM target_version_id OR indicator_stage IS DISTINCT FROM target_stage THEN
            RAISE EXCEPTION 'El indicador no corresponde a la versión y etapa de la evaluación.';
          END IF;
          IF NEW."instantanea_calificacion_maxima" IS DISTINCT FROM indicator_max THEN
            RAISE EXCEPTION 'El máximo capturado no coincide con el indicador de la rúbrica.';
          END IF;
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_proteger_calificaciones_evaluacion_cerrada"
      BEFORE INSERT OR UPDATE OR DELETE ON "calificaciones_evaluacion"
      FOR EACH ROW EXECUTE FUNCTION "proteger_calificaciones_evaluacion_cerrada"();

      CREATE OR REPLACE FUNCTION "protect_rubric_stage_structure"()
      RETURNS trigger AS $$
      DECLARE
        version_uuid uuid;
      BEGIN
        version_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_version_rubrica" ELSE NEW."id_version_rubrica" END;
        PERFORM "validar_version_rubrica_modificable"(version_uuid);
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_protect_rubric_stage_structure"
      BEFORE INSERT OR UPDATE OR DELETE ON "etapas_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "protect_rubric_stage_structure"();

      CREATE OR REPLACE FUNCTION "validate_rubric_category_stage"()
      RETURNS trigger AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "etapas_rubrica" etapa
          WHERE etapa."id" = NEW."id_etapa_rubrica"
            AND etapa."id_version_rubrica" = NEW."id_version_rubrica"
        ) THEN
          RAISE EXCEPTION 'La categoría y su etapa deben pertenecer a la misma versión de rúbrica.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_rubric_category_stage"
      BEFORE INSERT OR UPDATE OF "id_version_rubrica", "id_etapa_rubrica" ON "categorias_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "validate_rubric_category_stage"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_protect_rubric_stage_structure" ON "etapas_rubrica";
      DROP FUNCTION IF EXISTS "protect_rubric_stage_structure"();
      DROP TRIGGER IF EXISTS "trg_validate_rubric_category_stage" ON "categorias_rubrica";
      DROP FUNCTION IF EXISTS "validate_rubric_category_stage"();
      DROP TRIGGER IF EXISTS "trg_validar_activacion_version_rubrica" ON "versiones_rubrica";
      DROP TRIGGER IF EXISTS "trg_validar_contexto_evaluacion" ON "evaluaciones";
      DROP TRIGGER IF EXISTS "trg_validar_cierre_evaluacion" ON "evaluaciones";
      DROP TRIGGER IF EXISTS "trg_proteger_calificaciones_evaluacion_cerrada" ON "calificaciones_evaluacion";
      DROP FUNCTION IF EXISTS "validar_activacion_version_rubrica"();
      DROP FUNCTION IF EXISTS "validar_contexto_evaluacion"();
      DROP FUNCTION IF EXISTS "validar_cierre_evaluacion"();
      DROP FUNCTION IF EXISTS "proteger_calificaciones_evaluacion_cerrada"();

      ALTER TABLE "versiones_rubrica" ADD COLUMN "written_calificacion_maxima" numeric(4,2);
      ALTER TABLE "versiones_rubrica" ADD COLUMN "oral_calificacion_maxima" numeric(4,2);
      UPDATE "versiones_rubrica" version SET
        "written_calificacion_maxima" = written."calificacion_maxima",
        "oral_calificacion_maxima" = oral."calificacion_maxima"
      FROM "etapas_rubrica" written, "etapas_rubrica" oral
      WHERE written."id_version_rubrica" = version."id" AND written."kind" = 'ESCRITA'
        AND oral."id_version_rubrica" = version."id" AND oral."kind" = 'ORAL';
      ALTER TABLE "versiones_rubrica" ALTER COLUMN "written_calificacion_maxima" SET NOT NULL;
      ALTER TABLE "versiones_rubrica" ALTER COLUMN "oral_calificacion_maxima" SET NOT NULL;
      ALTER TABLE "versiones_rubrica" ALTER COLUMN "written_calificacion_maxima" SET DEFAULT 5.00;
      ALTER TABLE "versiones_rubrica" ALTER COLUMN "oral_calificacion_maxima" SET DEFAULT 5.00;
      ALTER TABLE "versiones_rubrica" ADD CONSTRAINT "chk_versiones_rubrica_scores" CHECK (
        "written_calificacion_maxima" > 0 AND "oral_calificacion_maxima" > 0 AND "written_calificacion_maxima" + "oral_calificacion_maxima" <= 99.99
      );

      ALTER TABLE "categorias_rubrica" ADD COLUMN "etapa" etapa_evaluacion_enum;
      UPDATE "categorias_rubrica" categoria SET "etapa" = etapa."kind"
      FROM "etapas_rubrica" etapa WHERE etapa."id" = categoria."id_etapa_rubrica";
      ALTER TABLE "categorias_rubrica" ALTER COLUMN "etapa" SET NOT NULL;
      ALTER TABLE "categorias_rubrica" DROP CONSTRAINT "fk_categorias_rubrica_stage";
      ALTER TABLE "categorias_rubrica" DROP COLUMN "id_etapa_rubrica";
      DROP TABLE "etapas_rubrica";
      DROP TYPE "alcance_etapa_rubrica_enum";

      CREATE OR REPLACE FUNCTION "validar_activacion_version_rubrica"()
      RETURNS trigger AS $$
      DECLARE
        target_modality uuid;
        written_categories_total numeric(8,2);
        oral_categories_total numeric(8,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."estado" <> 'BORRADOR' THEN
          IF OLD."id_rubrica" IS DISTINCT FROM NEW."id_rubrica"
            OR OLD."periodo_academico_id" IS DISTINCT FROM NEW."periodo_academico_id"
            OR OLD."version" IS DISTINCT FROM NEW."version"
            OR OLD."written_calificacion_maxima" IS DISTINCT FROM NEW."written_calificacion_maxima"
            OR OLD."oral_calificacion_maxima" IS DISTINCT FROM NEW."oral_calificacion_maxima"
            OR OLD."activada_en" IS DISTINCT FROM NEW."activada_en" THEN
            RAISE EXCEPTION 'Una versión de rúbrica activa o archivada es inmutable.';
          END IF;
          IF OLD."estado" = 'ARCHIVADA' AND NEW."estado" <> 'ARCHIVADA' THEN
            RAISE EXCEPTION 'Una versión de rúbrica archivada no puede reactivarse.';
          END IF;
        END IF;
        IF NEW."estado" = 'ACTIVA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'ACTIVA') THEN
          SELECT "id_modalidad" INTO target_modality FROM "rubricas" WHERE "id" = NEW."id_rubrica";
          IF EXISTS (
            SELECT 1 FROM "versiones_rubrica" existing_version
            JOIN "rubricas" existing_rubric ON existing_rubric."id" = existing_version."id_rubrica"
            WHERE existing_version."estado" = 'ACTIVA'
              AND existing_version."periodo_academico_id" = NEW."periodo_academico_id"
              AND existing_rubric."id_modalidad" = target_modality
              AND existing_version."id" <> NEW."id"
          ) THEN
            RAISE EXCEPTION 'Ya existe una versión activa para esta modalidad y período.';
          END IF;
          SELECT
            COALESCE(sum("calificacion_maxima") FILTER (WHERE "etapa" = 'ESCRITA'), 0),
            COALESCE(sum("calificacion_maxima") FILTER (WHERE "etapa" = 'ORAL'), 0)
            INTO written_categories_total, oral_categories_total
          FROM "categorias_rubrica" WHERE "id_version_rubrica" = NEW."id";
          IF written_categories_total <> NEW."written_calificacion_maxima" OR oral_categories_total <> NEW."oral_calificacion_maxima" THEN
            RAISE EXCEPTION 'Las categorías no coinciden con los máximos escrito y oral de la versión.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "categorias_rubrica" categoria
            LEFT JOIN "indicadores_rubrica" indicador ON indicador."id_categoria" = categoria."id"
            WHERE categoria."id_version_rubrica" = NEW."id"
            GROUP BY categoria."id", categoria."calificacion_maxima"
            HAVING count(indicador."id") = 0 OR COALESCE(sum(indicador."calificacion_maxima"), 0) <> categoria."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Los indicadores no coinciden con el máximo de su categoría.';
          END IF;
          NEW."activada_en" := COALESCE(NEW."activada_en", now());
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_activacion_version_rubrica"
      BEFORE INSERT OR UPDATE ON "versiones_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "validar_activacion_version_rubrica"();

      CREATE OR REPLACE FUNCTION "validar_contexto_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        written_max numeric(4,2);
        oral_max numeric(4,2);
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "miembros_tribunal" tm
          JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
          WHERE tm."id" = NEW."id_miembro_tribunal" AND ta."id_trabajo" = NEW."id_trabajo" AND ta."estado" = 'CONFIRMADO'
        ) THEN RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.'; END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" ws WHERE ws."id_trabajo" = NEW."id_trabajo" AND ws."id_estudiante" = NEW."id_estudiante"
        ) THEN RAISE EXCEPTION 'La evaluación oral debe corresponder a un estudiante del trabajo.'; END IF;
        IF NOT EXISTS (SELECT 1 FROM "estudiantes_trabajo" ws WHERE ws."id_trabajo" = NEW."id_trabajo") THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" ds WHERE ds."id_trabajo" = NEW."id_trabajo" AND ds."estado" <> 'CANCELADA'
        ) THEN RAISE EXCEPTION 'La evaluación oral requiere una sustentación programada.'; END IF;
        SELECT "id_version_rubrica" INTO bound_rubric_version FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";
        IF bound_rubric_version IS NULL OR bound_rubric_version <> NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La evaluación debe conservar la versión de rúbrica fijada al trabajo.';
        END IF;
        SELECT "written_calificacion_maxima", "oral_calificacion_maxima" INTO written_max, oral_max
        FROM "versiones_rubrica" WHERE "id" = NEW."id_version_rubrica";
        IF (NEW."etapa" = 'ESCRITA' AND NEW."instantanea_calificacion_maxima" <> written_max)
          OR (NEW."etapa" = 'ORAL' AND NEW."instantanea_calificacion_maxima" <> oral_max) THEN
          RAISE EXCEPTION 'El máximo de la evaluación no coincide con la versión de rúbrica.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_contexto_evaluacion"
      BEFORE INSERT OR UPDATE OF "id_trabajo", "id_miembro_tribunal", "id_estudiante", "id_version_rubrica", "etapa", "instantanea_calificacion_maxima"
      ON "evaluaciones" FOR EACH ROW EXECUTE FUNCTION "validar_contexto_evaluacion"();

      CREATE OR REPLACE FUNCTION "validar_cierre_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        expected_indicators integer;
        recorded_indicators integer;
        calculated_total numeric(8,2);
      BEGIN
        IF NEW."estado" = 'CERRADA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'CERRADA') THEN
          SELECT count(*) INTO expected_indicators
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          WHERE categoria."id_version_rubrica" = NEW."id_version_rubrica" AND categoria."etapa" = NEW."etapa";
          SELECT count(*), COALESCE(sum("score"), 0) INTO recorded_indicators, calculated_total
          FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = NEW."id";
          IF expected_indicators = 0 OR recorded_indicators <> expected_indicators THEN
            RAISE EXCEPTION 'No se puede cerrar una evaluación con indicadores incompletos.';
          END IF;
          IF calculated_total <> NEW."calificacion_total" THEN
            RAISE EXCEPTION 'El total de la evaluación no coincide con sus indicadores.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_cierre_evaluacion"
      BEFORE INSERT OR UPDATE OF "estado", "calificacion_total" ON "evaluaciones"
      FOR EACH ROW EXECUTE FUNCTION "validar_cierre_evaluacion"();

      CREATE OR REPLACE FUNCTION "proteger_calificaciones_evaluacion_cerrada"()
      RETURNS trigger AS $$
      DECLARE
        target_id_evaluacion uuid;
        target_status estado_evaluacion_enum;
        target_version_id uuid;
        target_stage etapa_evaluacion_enum;
        indicator_version_id uuid;
        indicator_stage etapa_evaluacion_enum;
        indicator_max numeric(4,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND (
          OLD."id_evaluacion" IS DISTINCT FROM NEW."id_evaluacion" OR OLD."id_indicador" IS DISTINCT FROM NEW."id_indicador"
        ) THEN RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluación o indicador.'; END IF;
        target_id_evaluacion := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_evaluacion" ELSE NEW."id_evaluacion" END;
        SELECT "estado", "id_version_rubrica", "etapa" INTO target_status, target_version_id, target_stage
        FROM "evaluaciones" WHERE "id" = target_id_evaluacion;
        IF target_status = 'CERRADA' THEN RAISE EXCEPTION 'Los puntajes de una evaluación cerrada no pueden modificarse.'; END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT categoria."id_version_rubrica", categoria."etapa", indicador."calificacion_maxima"
            INTO indicator_version_id, indicator_stage, indicator_max
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          WHERE indicador."id" = NEW."id_indicador";
          IF indicator_version_id IS DISTINCT FROM target_version_id OR indicator_stage IS DISTINCT FROM target_stage THEN
            RAISE EXCEPTION 'El indicador no corresponde a la versión y etapa de la evaluación.';
          END IF;
          IF NEW."instantanea_calificacion_maxima" IS DISTINCT FROM indicator_max THEN
            RAISE EXCEPTION 'El máximo capturado no coincide con el indicador de la rúbrica.';
          END IF;
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_calificaciones_evaluacion_cerrada"
      BEFORE INSERT OR UPDATE OR DELETE ON "calificaciones_evaluacion"
      FOR EACH ROW EXECUTE FUNCTION "proteger_calificaciones_evaluacion_cerrada"();
    `);
  }
}
