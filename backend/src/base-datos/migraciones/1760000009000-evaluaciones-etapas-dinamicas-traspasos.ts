import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluacionesEtapasDinamicasTraspasos1760000009000 implements MigrationInterface {
  nombre = 'EvaluacionesEtapasDinamicasTraspasos1760000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "etapas_rubrica"
        ADD CONSTRAINT "uq_etapas_rubrica_id_version" UNIQUE ("id", "id_version_rubrica");
      ALTER TABLE "evaluaciones"
        ADD COLUMN "id_etapa_rubrica" uuid,
        ADD COLUMN "revision" integer NOT NULL DEFAULT 1,
        ADD CONSTRAINT "uq_evaluaciones_id_trabajo" UNIQUE ("id", "id_trabajo"),
        DROP CONSTRAINT "chk_evaluaciones_stage_student",
        ADD CONSTRAINT "chk_evaluaciones_stage_student" CHECK (
          "id_etapa_rubrica" IS NOT NULL OR
          (("etapa" = 'ESCRITA' AND "id_estudiante" IS NULL) OR
           ("etapa" = 'ORAL' AND "id_estudiante" IS NOT NULL))
        ),
        ADD CONSTRAINT "chk_evaluaciones_revision_positive" CHECK ("revision" > 0),
        ADD CONSTRAINT "fk_evaluaciones_rubric_stage_version"
          FOREIGN KEY ("id_etapa_rubrica", "id_version_rubrica")
          REFERENCES "etapas_rubrica"("id", "id_version_rubrica") ON DELETE RESTRICT;

      DROP INDEX "uq_evaluaciones_written_member_work";
      DROP INDEX "uq_evaluaciones_oral_member_work_student";
      CREATE UNIQUE INDEX "uq_evaluaciones_written_member_work"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal")
        WHERE "id_etapa_rubrica" IS NULL AND "etapa" = 'ESCRITA';
      CREATE UNIQUE INDEX "uq_evaluaciones_oral_member_work_student"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal", "id_estudiante")
        WHERE "id_etapa_rubrica" IS NULL AND "etapa" = 'ORAL';
      CREATE UNIQUE INDEX "uq_evaluaciones_dynamic_shared_member_stage"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal", "id_etapa_rubrica")
        WHERE "id_etapa_rubrica" IS NOT NULL AND "id_estudiante" IS NULL;
      CREATE UNIQUE INDEX "uq_evaluaciones_dynamic_individual_member_stage_student"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal", "id_etapa_rubrica", "id_estudiante")
        WHERE "id_etapa_rubrica" IS NOT NULL AND "id_estudiante" IS NOT NULL;

      CREATE TABLE "traspasos_evaluacion_estudiante" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_evaluacion" uuid NOT NULL,
        "id_trabajo" uuid NOT NULL,
        "id_estudiante" uuid NOT NULL,
        "traspasado_en" timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT "uq_traspasos_evaluacion_estudiante_origen_estudiante"
          UNIQUE ("id_evaluacion", "id_estudiante"),
        CONSTRAINT "fk_traspasos_evaluacion_origen_trabajo"
          FOREIGN KEY ("id_evaluacion", "id_trabajo")
          REFERENCES "evaluaciones"("id", "id_trabajo") ON DELETE RESTRICT,
        CONSTRAINT "fk_traspasos_evaluacion_estudiante"
          FOREIGN KEY ("id_estudiante") REFERENCES "perfiles_estudiante"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "idx_traspasos_evaluacion_estudiante_consulta"
        ON "traspasos_evaluacion_estudiante" ("id_estudiante", "traspasado_en" DESC);

      CREATE TABLE "eventos_auditoria_evaluacion" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_evaluacion" uuid NOT NULL,
        "actor_id" varchar(255) NOT NULL,
        "accion" varchar(64) NOT NULL,
        "detalles" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "correlation_id" varchar(100),
        "ocurrido_en" timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT "fk_eventos_auditoria_evaluacion_origen"
          FOREIGN KEY ("id_evaluacion") REFERENCES "evaluaciones"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_eventos_auditoria_evaluacion_details"
          CHECK (jsonb_typeof("detalles") = 'object')
      );
      CREATE INDEX "idx_eventos_auditoria_evaluacion_origen_fecha"
        ON "eventos_auditoria_evaluacion" ("id_evaluacion", "ocurrido_en");

      CREATE OR REPLACE FUNCTION "validar_version_rubrica_trabajo"()
      RETURNS trigger AS $$
      DECLARE
        selected_status estado_version_rubrica_enum;
        selected_modality uuid;
        selected_period uuid;
        vigente_para_carrera boolean;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."id_version_rubrica" IS NOT NULL
          AND OLD."id_version_rubrica" IS DISTINCT FROM NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La versi\u00f3n de r\u00fabrica fijada a un trabajo no puede reemplazarse ni retirarse.';
        END IF;
        IF NEW."id_version_rubrica" IS NULL THEN RETURN NEW; END IF;

        SELECT rv."estado", r."id_modalidad", rv."periodo_academico_id"
          INTO selected_status, selected_modality, selected_period
        FROM "versiones_rubrica" rv JOIN "rubricas" r ON r."id" = rv."id_rubrica"
        WHERE rv."id" = NEW."id_version_rubrica";
        IF selected_modality IS DISTINCT FROM NEW."id_modalidad"
          OR selected_period IS DISTINCT FROM NEW."periodo_academico_id" THEN
          RAISE EXCEPTION 'La versi\u00f3n de r\u00fabrica no corresponde a modalidad y per\u00edodo del trabajo.';
        END IF;

        IF selected_status = 'ACTIVA' THEN RETURN NEW; END IF;
        IF selected_status = 'CONFIGURADA' THEN
          SELECT EXISTS (
            SELECT 1 FROM "vigencias_rubrica_carrera" vigencia
            WHERE vigencia."id_version_rubrica" = NEW."id_version_rubrica"
              AND vigencia."id_carrera" = NEW."id_carrera"
              AND vigencia."id_modalidad" = NEW."id_modalidad"
              AND vigencia."periodo_academico_id" = NEW."periodo_academico_id"
              AND vigencia."vigente_hasta" IS NULL
          ) INTO vigente_para_carrera;
          IF vigente_para_carrera THEN RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'El trabajo requiere una versi\u00f3n activa o vigente para su carrera.';
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "validar_contexto_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        configured_max numeric(5,2);
        configured_kind etapa_evaluacion_enum;
        configured_scope alcance_etapa_rubrica_enum;
        legacy_stage_count integer;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "miembros_tribunal" tm
          JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
          WHERE tm."id" = NEW."id_miembro_tribunal"
            AND ta."id_trabajo" = NEW."id_trabajo" AND ta."estado" = 'CONFIRMADO'
        ) THEN RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.'; END IF;
        IF NOT EXISTS (SELECT 1 FROM "estudiantes_trabajo" WHERE "id_trabajo" = NEW."id_trabajo") THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;
        SELECT "id_version_rubrica" INTO bound_rubric_version
        FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";
        IF bound_rubric_version IS NULL OR bound_rubric_version <> NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La evaluaci\u00f3n debe conservar la versi\u00f3n de r\u00fabrica fijada al trabajo.';
        END IF;

        IF NEW."id_etapa_rubrica" IS NOT NULL THEN
          SELECT "kind", "scope", "calificacion_maxima"
            INTO configured_kind, configured_scope, configured_max
          FROM "etapas_rubrica"
          WHERE "id" = NEW."id_etapa_rubrica" AND "id_version_rubrica" = NEW."id_version_rubrica";
          IF configured_max IS NULL THEN RAISE EXCEPTION 'La etapa no pertenece a la versi\u00f3n de r\u00fabrica fijada.'; END IF;
          IF NEW."etapa" <> configured_kind THEN RAISE EXCEPTION 'La etapa hist\u00f3rica no coincide con su etapa persistente.'; END IF;
          IF configured_scope = 'TRABAJO_COMPARTIDO' AND NEW."id_estudiante" IS NOT NULL THEN
            RAISE EXCEPTION 'Una evaluaci\u00f3n compartida corresponde al trabajo, no a un estudiante.';
          END IF;
          IF configured_scope = 'ESTUDIANTE_INDIVIDUAL' AND NEW."id_estudiante" IS NULL THEN
            RAISE EXCEPTION 'La etapa individual requiere un estudiante del trabajo.';
          END IF;
          IF NEW."id_estudiante" IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "estudiantes_trabajo"
            WHERE "id_trabajo" = NEW."id_trabajo" AND "id_estudiante" = NEW."id_estudiante"
          ) THEN RAISE EXCEPTION 'La evaluaci\u00f3n individual debe corresponder a un estudiante del trabajo.'; END IF;
        ELSE
          IF NEW."etapa" NOT IN ('ESCRITA', 'ORAL') THEN
            RAISE EXCEPTION 'Una evaluaci\u00f3n sin identidad de etapa solo puede usar una etapa hist\u00f3rica.';
          END IF;
          IF NEW."etapa" = 'ESCRITA' AND NEW."id_estudiante" IS NOT NULL THEN
            RAISE EXCEPTION 'La evaluaci\u00f3n escrita hist\u00f3rica corresponde al trabajo.';
          END IF;
          IF NEW."etapa" = 'ORAL' AND (NEW."id_estudiante" IS NULL OR NOT EXISTS (
            SELECT 1 FROM "estudiantes_trabajo"
            WHERE "id_trabajo" = NEW."id_trabajo" AND "id_estudiante" = NEW."id_estudiante"
          )) THEN RAISE EXCEPTION 'La evaluaci\u00f3n oral hist\u00f3rica requiere un estudiante del trabajo.'; END IF;
          IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
            SELECT 1 FROM "programaciones_sustentacion"
            WHERE "id_trabajo" = NEW."id_trabajo" AND "estado" <> 'CANCELADA'
          ) THEN RAISE EXCEPTION 'La evaluaci\u00f3n oral requiere una sustentaci\u00f3n programada.'; END IF;
          SELECT count(*), max("calificacion_maxima") INTO legacy_stage_count, configured_max
          FROM "etapas_rubrica"
          WHERE "id_version_rubrica" = NEW."id_version_rubrica" AND "kind" = NEW."etapa";
          IF legacy_stage_count <> 1 THEN RAISE EXCEPTION 'No hay una etapa hist\u00f3rica inequ\u00edvoca en la versi\u00f3n.'; END IF;
        END IF;
        IF NEW."instantanea_calificacion_maxima" <> configured_max THEN
          RAISE EXCEPTION 'El m\u00e1ximo de la evaluaci\u00f3n no coincide con la etapa de su versi\u00f3n de r\u00fabrica.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "validar_cierre_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        expected_indicators integer;
        recorded_indicators integer;
        calculated_total numeric(8,2);
      BEGIN
        IF NEW."estado" = 'CERRADA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'CERRADA') THEN
          IF NEW."id_etapa_rubrica" IS NOT NULL THEN
            SELECT count(*) INTO expected_indicators
            FROM "indicadores_rubrica" indicador
            JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
            WHERE categoria."id_etapa_rubrica" = NEW."id_etapa_rubrica";
          ELSE
            SELECT count(*) INTO expected_indicators
            FROM "indicadores_rubrica" indicador
            JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
            JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
            WHERE etapa."id_version_rubrica" = NEW."id_version_rubrica" AND etapa."kind" = NEW."etapa";
          END IF;
          SELECT count(*), COALESCE(sum("score"), 0)
            INTO recorded_indicators, calculated_total
          FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = NEW."id";
          IF expected_indicators = 0 OR recorded_indicators <> expected_indicators THEN
            RAISE EXCEPTION 'No se puede cerrar una evaluaci\u00f3n con indicadores incompletos.';
          END IF;
          IF calculated_total <> NEW."calificacion_total" THEN
            RAISE EXCEPTION 'El total de la evaluaci\u00f3n no coincide con sus indicadores.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "proteger_calificaciones_evaluacion_cerrada"()
      RETURNS trigger AS $$
      DECLARE
        target_id_evaluacion uuid;
        target_status estado_evaluacion_enum;
        target_version_id uuid;
        target_stage etapa_evaluacion_enum;
        target_stage_id uuid;
        indicator_version_id uuid;
        indicator_stage etapa_evaluacion_enum;
        indicator_stage_id uuid;
        indicator_max numeric(5,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND (
          OLD."id_evaluacion" IS DISTINCT FROM NEW."id_evaluacion" OR
          OLD."id_indicador" IS DISTINCT FROM NEW."id_indicador"
        ) THEN RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluaci\u00f3n o indicador.'; END IF;
        target_id_evaluacion := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_evaluacion" ELSE NEW."id_evaluacion" END;
        SELECT "estado", "id_version_rubrica", "etapa", "id_etapa_rubrica"
          INTO target_status, target_version_id, target_stage, target_stage_id
        FROM "evaluaciones" WHERE "id" = target_id_evaluacion;
        IF target_status = 'CERRADA' THEN RAISE EXCEPTION 'Los puntajes de una evaluaci\u00f3n cerrada no pueden modificarse.'; END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT etapa."id_version_rubrica", etapa."kind", etapa."id", indicador."calificacion_maxima"
            INTO indicator_version_id, indicator_stage, indicator_stage_id, indicator_max
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
          WHERE indicador."id" = NEW."id_indicador";
          IF indicator_version_id IS DISTINCT FROM target_version_id
            OR (target_stage_id IS NOT NULL AND indicator_stage_id IS DISTINCT FROM target_stage_id)
            OR (target_stage_id IS NULL AND indicator_stage IS DISTINCT FROM target_stage) THEN
            RAISE EXCEPTION 'El indicador no corresponde a la versi\u00f3n y etapa de la evaluaci\u00f3n.';
          END IF;
          IF NEW."instantanea_calificacion_maxima" IS DISTINCT FROM indicator_max THEN
            RAISE EXCEPTION 'El m\u00e1ximo capturado no coincide con el indicador de la r\u00fabrica.';
          END IF;
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "validar_traspaso_evaluacion_estudiante"()
      RETURNS trigger AS $$
      DECLARE
        source_work uuid;
        source_stage uuid;
        source_status estado_evaluacion_enum;
        source_scope alcance_etapa_rubrica_enum;
      BEGIN
        SELECT evaluacion."id_trabajo", evaluacion."id_etapa_rubrica", evaluacion."estado", etapa."scope"
          INTO source_work, source_stage, source_status, source_scope
        FROM "evaluaciones" evaluacion
        LEFT JOIN "etapas_rubrica" etapa ON etapa."id" = evaluacion."id_etapa_rubrica"
        WHERE evaluacion."id" = NEW."id_evaluacion";
        IF source_work IS DISTINCT FROM NEW."id_trabajo" OR source_stage IS NULL
          OR source_status <> 'CERRADA' OR source_scope <> 'TRABAJO_COMPARTIDO' THEN
          RAISE EXCEPTION 'El traspaso requiere una evaluaci\u00f3n compartida cerrada del mismo trabajo.';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo"
          WHERE "id_trabajo" = NEW."id_trabajo" AND "id_estudiante" = NEW."id_estudiante"
        ) THEN RAISE EXCEPTION 'El estudiante traspasado no pertenece al trabajo de origen.'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_traspaso_evaluacion_estudiante"
        BEFORE INSERT ON "traspasos_evaluacion_estudiante"
        FOR EACH ROW EXECUTE FUNCTION "validar_traspaso_evaluacion_estudiante"();

      CREATE OR REPLACE FUNCTION "proteger_historial_traspaso_evaluacion_estudiante"()
      RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Los traspasos de evaluaciones cerradas son inmutables.'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_historial_traspaso_evaluacion_estudiante"
        BEFORE UPDATE OR DELETE ON "traspasos_evaluacion_estudiante"
        FOR EACH ROW EXECUTE FUNCTION "proteger_historial_traspaso_evaluacion_estudiante"();

      CREATE OR REPLACE FUNCTION "proteger_truncate_traspaso_evaluacion_estudiante"()
      RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'El historial de traspasos no se trunca.'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_truncate_traspaso_evaluacion_estudiante"
        BEFORE TRUNCATE ON "traspasos_evaluacion_estudiante"
        FOR EACH STATEMENT EXECUTE FUNCTION "proteger_truncate_traspaso_evaluacion_estudiante"();

      CREATE OR REPLACE FUNCTION "proteger_evento_auditoria_evaluacion"()
      RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'La auditor\u00eda de evaluaciones es append-only.'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_evento_auditoria_evaluacion"
        BEFORE UPDATE OR DELETE ON "eventos_auditoria_evaluacion"
        FOR EACH ROW EXECUTE FUNCTION "proteger_evento_auditoria_evaluacion"();
      CREATE OR REPLACE FUNCTION "proteger_truncate_auditoria_evaluacion"()
      RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'La auditor\u00eda de evaluaciones no se trunca.'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_truncate_auditoria_evaluacion"
        BEFORE TRUNCATE ON "eventos_auditoria_evaluacion"
        FOR EACH STATEMENT EXECUTE FUNCTION "proteger_truncate_auditoria_evaluacion"();

      CREATE OR REPLACE FUNCTION "materializar_traspasos_evaluacion_compartida"()
      RETURNS trigger AS $$
      DECLARE
        source_scope alcance_etapa_rubrica_enum;
      BEGIN
        IF NEW."estado" <> 'CERRADA' OR (TG_OP = 'UPDATE' AND OLD."estado" = 'CERRADA')
          OR NEW."id_etapa_rubrica" IS NULL THEN RETURN NEW; END IF;
        SELECT "scope" INTO source_scope FROM "etapas_rubrica" WHERE "id" = NEW."id_etapa_rubrica";
        IF source_scope <> 'TRABAJO_COMPARTIDO' THEN RETURN NEW; END IF;
        PERFORM 1 FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo" FOR UPDATE;
        INSERT INTO "traspasos_evaluacion_estudiante" ("id_evaluacion", "id_trabajo", "id_estudiante")
        SELECT NEW."id", NEW."id_trabajo", estudiante."id_estudiante"
        FROM "estudiantes_trabajo" estudiante WHERE estudiante."id_trabajo" = NEW."id_trabajo"
        ON CONFLICT ("id_evaluacion", "id_estudiante") DO NOTHING;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_materializar_traspasos_evaluacion_compartida"
        AFTER INSERT OR UPDATE ON "evaluaciones"
        FOR EACH ROW EXECUTE FUNCTION "materializar_traspasos_evaluacion_compartida"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [usoNuevo] = await queryRunner.query(`
      SELECT
        (SELECT count(*) FROM "evaluaciones" WHERE "id_etapa_rubrica" IS NOT NULL) +
        (SELECT count(*) FROM "traspasos_evaluacion_estudiante") +
        (SELECT count(*) FROM "eventos_auditoria_evaluacion") AS total
    `) as Array<{ total: string }>;
    const [trabajosConfigurados] = await queryRunner.query(`
      SELECT count(*) AS total FROM "trabajos_titulacion" trabajo
      JOIN "versiones_rubrica" version ON version."id" = trabajo."id_version_rubrica"
      WHERE version."estado" = 'CONFIGURADA'
    `) as Array<{ total: string }>;
    if (Number(usoNuevo.total) || Number(trabajosConfigurados.total)) {
      throw new Error('No se revierte 9H.5A mientras existan evaluaciones din\u00e1micas, traspasos, auditor\u00eda o trabajos con versiones configuradas; use una migraci\u00f3n correctiva.');
    }

    await queryRunner.query(`
      DROP TRIGGER "trg_materializar_traspasos_evaluacion_compartida" ON "evaluaciones";
      DROP TRIGGER "trg_proteger_truncate_auditoria_evaluacion" ON "eventos_auditoria_evaluacion";
      DROP TRIGGER "trg_proteger_evento_auditoria_evaluacion" ON "eventos_auditoria_evaluacion";
      DROP TRIGGER "trg_proteger_truncate_traspaso_evaluacion_estudiante" ON "traspasos_evaluacion_estudiante";
      DROP TRIGGER "trg_proteger_historial_traspaso_evaluacion_estudiante" ON "traspasos_evaluacion_estudiante";
      DROP TRIGGER "trg_validar_traspaso_evaluacion_estudiante" ON "traspasos_evaluacion_estudiante";
      DROP FUNCTION "materializar_traspasos_evaluacion_compartida"();
      DROP FUNCTION "proteger_truncate_auditoria_evaluacion"();
      DROP FUNCTION "proteger_evento_auditoria_evaluacion"();
      DROP FUNCTION "proteger_truncate_traspaso_evaluacion_estudiante"();
      DROP FUNCTION "proteger_historial_traspaso_evaluacion_estudiante"();
      DROP FUNCTION "validar_traspaso_evaluacion_estudiante"();

      CREATE OR REPLACE FUNCTION "validar_contexto_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        configured_max numeric(5,2);
        stage_count integer;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "miembros_tribunal" tm JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
          WHERE tm."id" = NEW."id_miembro_tribunal" AND ta."id_trabajo" = NEW."id_trabajo" AND ta."estado" = 'CONFIRMADO'
        ) THEN RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.'; END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" WHERE "id_trabajo" = NEW."id_trabajo" AND "id_estudiante" = NEW."id_estudiante"
        ) THEN RAISE EXCEPTION 'La evaluaci\u00f3n oral debe corresponder a un estudiante del trabajo.'; END IF;
        IF NOT EXISTS (SELECT 1 FROM "estudiantes_trabajo" WHERE "id_trabajo" = NEW."id_trabajo") THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;
        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" WHERE "id_trabajo" = NEW."id_trabajo" AND "estado" <> 'CANCELADA'
        ) THEN RAISE EXCEPTION 'La evaluaci\u00f3n oral requiere una sustentaci\u00f3n programada.'; END IF;
        SELECT "id_version_rubrica" INTO bound_rubric_version FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";
        IF bound_rubric_version IS NULL OR bound_rubric_version <> NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La evaluaci\u00f3n debe conservar la versi\u00f3n de r\u00fabrica fijada al trabajo.';
        END IF;
        SELECT count(*), max("calificacion_maxima") INTO stage_count, configured_max FROM "etapas_rubrica"
        WHERE "id_version_rubrica" = NEW."id_version_rubrica" AND "kind" = NEW."etapa";
        IF stage_count <> 1 OR NEW."instantanea_calificacion_maxima" <> configured_max THEN
          RAISE EXCEPTION 'La etapa o su m\u00e1ximo no coincide con la versi\u00f3n de r\u00fabrica.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "validar_cierre_evaluacion"()
      RETURNS trigger AS $$
      DECLARE expected_indicators integer; recorded_indicators integer; calculated_total numeric(8,2);
      BEGIN
        IF NEW."estado" = 'CERRADA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'CERRADA') THEN
          SELECT count(*) INTO expected_indicators FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
          WHERE etapa."id_version_rubrica" = NEW."id_version_rubrica" AND etapa."kind" = NEW."etapa";
          SELECT count(*), COALESCE(sum("score"), 0) INTO recorded_indicators, calculated_total
          FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = NEW."id";
          IF expected_indicators = 0 OR recorded_indicators <> expected_indicators THEN
            RAISE EXCEPTION 'No se puede cerrar una evaluaci\u00f3n con indicadores incompletos.';
          END IF;
          IF calculated_total <> NEW."calificacion_total" THEN RAISE EXCEPTION 'El total de la evaluaci\u00f3n no coincide con sus indicadores.'; END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "proteger_calificaciones_evaluacion_cerrada"()
      RETURNS trigger AS $$
      DECLARE target_id_evaluacion uuid; target_status estado_evaluacion_enum; target_version_id uuid;
        target_stage etapa_evaluacion_enum; indicator_version_id uuid; indicator_stage etapa_evaluacion_enum; indicator_max numeric(5,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND (OLD."id_evaluacion" IS DISTINCT FROM NEW."id_evaluacion" OR OLD."id_indicador" IS DISTINCT FROM NEW."id_indicador") THEN
          RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluaci\u00f3n o indicador.';
        END IF;
        target_id_evaluacion := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_evaluacion" ELSE NEW."id_evaluacion" END;
        SELECT "estado", "id_version_rubrica", "etapa" INTO target_status, target_version_id, target_stage
        FROM "evaluaciones" WHERE "id" = target_id_evaluacion;
        IF target_status = 'CERRADA' THEN RAISE EXCEPTION 'Los puntajes de una evaluaci\u00f3n cerrada no pueden modificarse.'; END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT etapa."id_version_rubrica", etapa."kind", indicador."calificacion_maxima"
            INTO indicator_version_id, indicator_stage, indicator_max
          FROM "indicadores_rubrica" indicador JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
          WHERE indicador."id" = NEW."id_indicador";
          IF indicator_version_id IS DISTINCT FROM target_version_id OR indicator_stage IS DISTINCT FROM target_stage THEN
            RAISE EXCEPTION 'El indicador no corresponde a la versi\u00f3n y etapa de la evaluaci\u00f3n.';
          END IF;
          IF NEW."instantanea_calificacion_maxima" IS DISTINCT FROM indicator_max THEN
            RAISE EXCEPTION 'El m\u00e1ximo capturado no coincide con el indicador de la r\u00fabrica.';
          END IF;
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "validar_version_rubrica_trabajo"()
      RETURNS trigger AS $$
      DECLARE selected_status estado_version_rubrica_enum; selected_modality uuid; selected_period uuid;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."id_version_rubrica" IS NOT NULL
          AND OLD."id_version_rubrica" IS DISTINCT FROM NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La versi\u00f3n de r\u00fabrica fijada a un trabajo no puede reemplazarse ni retirarse.';
        END IF;
        IF NEW."id_version_rubrica" IS NULL THEN RETURN NEW; END IF;
        SELECT rv."estado", r."id_modalidad", rv."periodo_academico_id" INTO selected_status, selected_modality, selected_period
        FROM "versiones_rubrica" rv JOIN "rubricas" r ON r."id" = rv."id_rubrica" WHERE rv."id" = NEW."id_version_rubrica";
        IF selected_status <> 'ACTIVA' THEN RAISE EXCEPTION 'El trabajo solo puede fijar una versi\u00f3n activa de r\u00fabrica.'; END IF;
        IF selected_modality <> NEW."id_modalidad" OR selected_period <> NEW."periodo_academico_id" THEN
          RAISE EXCEPTION 'La versi\u00f3n de r\u00fabrica no corresponde a modalidad y per\u00edodo del trabajo.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP INDEX "uq_evaluaciones_dynamic_individual_member_stage_student";
      DROP INDEX "uq_evaluaciones_dynamic_shared_member_stage";
      DROP INDEX "uq_evaluaciones_oral_member_work_student";
      DROP INDEX "uq_evaluaciones_written_member_work";
      CREATE UNIQUE INDEX "uq_evaluaciones_written_member_work"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal") WHERE "etapa" = 'ESCRITA';
      CREATE UNIQUE INDEX "uq_evaluaciones_oral_member_work_student"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal", "id_estudiante") WHERE "etapa" = 'ORAL';
      ALTER TABLE "evaluaciones"
        DROP CONSTRAINT "fk_evaluaciones_rubric_stage_version",
        DROP CONSTRAINT "chk_evaluaciones_revision_positive",
        DROP CONSTRAINT "chk_evaluaciones_stage_student",
        ADD CONSTRAINT "chk_evaluaciones_stage_student" CHECK (
          ("etapa" = 'ESCRITA' AND "id_estudiante" IS NULL) OR
          ("etapa" = 'ORAL' AND "id_estudiante" IS NOT NULL)
        ),
        DROP CONSTRAINT "uq_evaluaciones_id_trabajo",
        DROP COLUMN "revision",
        DROP COLUMN "id_etapa_rubrica";
      ALTER TABLE "etapas_rubrica" DROP CONSTRAINT "uq_etapas_rubrica_id_version";
      DROP TABLE "eventos_auditoria_evaluacion";
      DROP TABLE "traspasos_evaluacion_estudiante";
    `);
  }
}
