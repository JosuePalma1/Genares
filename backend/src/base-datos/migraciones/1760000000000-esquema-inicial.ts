import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1760000000000 implements MigrationInterface {
  nombre = 'EsquemaInicial1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TYPE "fuente_directorio_enum" AS ENUM ('MANUAL', 'INSTITUCIONAL_SOLO_LECTURA');
      CREATE TYPE "estado_trabajo_enum" AS ENUM (
        'REGISTRADO',
        'TRIBUNAL_ASIGNADO',
        'REVISION_ESCRITA_PENDIENTE',
        'REVISION_ESCRITA_COMPLETADA',
        'SUSTENTACION_PROGRAMADA',
        'SUSTENTACION_PENDIENTE',
        'EVALUACION_COMPLETADA',
        'FINALIZADO'
      );
      CREATE TYPE "estado_asignacion_tribunal_enum" AS ENUM ('BORRADOR', 'CONFIRMADO', 'REEMPLAZADO');
      CREATE TYPE "estado_version_rubrica_enum" AS ENUM ('BORRADOR', 'ACTIVA', 'ARCHIVADA');
      CREATE TYPE "etapa_evaluacion_enum" AS ENUM ('ESCRITA', 'ORAL');
      CREATE TYPE "estado_evaluacion_enum" AS ENUM ('BORRADOR', 'CERRADA');
      CREATE TYPE "estado_sustentacion_enum" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'CANCELADA');
      CREATE TYPE "tipo_notificacion_enum" AS ENUM (
        'TRIBUNAL_ASIGNADO',
        'REVISION_ESCRITA_PENDIENTE',
        'SUSTENTACION_PROGRAMADA'
      );

      CREATE TABLE "carreras" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" varchar(30) NOT NULL,
        "nombre" varchar(160) NOT NULL,
        "esta_activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_carreras_code" UNIQUE ("codigo")
      );

      CREATE TABLE "modalidades" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" varchar(40) NOT NULL,
        "nombre" varchar(160) NOT NULL,
        "esta_activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_modalidades_code" UNIQUE ("codigo")
      );

      CREATE TABLE "periodos_academicos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" varchar(20) NOT NULL,
        "fecha_inicio" date,
        "fecha_fin" date,
        "esta_activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_periodos_academicos_code" UNIQUE ("codigo"),
        CONSTRAINT "chk_periodos_academicos_dates" CHECK (
          "fecha_inicio" IS NULL OR "fecha_fin" IS NULL OR "fecha_inicio" <= "fecha_fin"
        )
      );

      CREATE TABLE "personas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "identificacion_nacional" varchar(20) NOT NULL,
        "nombres" varchar(160) NOT NULL,
        "surnames" varchar(160) NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_personas_identificacion_nacional" UNIQUE ("identificacion_nacional"),
        CONSTRAINT "chk_personas_required_text" CHECK (
          btrim("identificacion_nacional") <> '' AND btrim("nombres") <> '' AND btrim("surnames") <> ''
        )
      );

      CREATE TABLE "perfiles_estudiante" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_persona" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        CONSTRAINT "uq_perfiles_estudiante_person" UNIQUE ("id_persona"),
        CONSTRAINT "fk_perfiles_estudiante_person" FOREIGN KEY ("id_persona") REFERENCES "personas"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_perfiles_estudiante_career" FOREIGN KEY ("id_carrera") REFERENCES "carreras"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "perfiles_docente" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_persona" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        "fuente" fuente_directorio_enum NOT NULL DEFAULT 'MANUAL',
        "referencia_externa" varchar(120),
        "esta_activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_perfiles_docente_person" UNIQUE ("id_persona"),
        CONSTRAINT "fk_perfiles_docente_person" FOREIGN KEY ("id_persona") REFERENCES "personas"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_perfiles_docente_career" FOREIGN KEY ("id_carrera") REFERENCES "carreras"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "cuentas_usuario" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_persona" uuid NOT NULL,
        "sujeto_autenticacion" varchar(255),
        "esta_activo" boolean NOT NULL DEFAULT true,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_cuentas_usuario_person" UNIQUE ("id_persona"),
        CONSTRAINT "uq_cuentas_usuario_sujeto_autenticacion" UNIQUE ("sujeto_autenticacion"),
        CONSTRAINT "fk_cuentas_usuario_person" FOREIGN KEY ("id_persona") REFERENCES "personas"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" varchar(60) NOT NULL,
        "nombre" varchar(120) NOT NULL,
        CONSTRAINT "uq_roles_code" UNIQUE ("codigo")
      );

      CREATE TABLE "roles_cuenta" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_cuenta" uuid NOT NULL,
        "id_rol" uuid NOT NULL,
        "asignada_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_roles_cuenta_account_role" UNIQUE ("id_cuenta", "id_rol"),
        CONSTRAINT "fk_roles_cuenta_account" FOREIGN KEY ("id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_roles_cuenta_role" FOREIGN KEY ("id_rol") REFERENCES "roles"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "alcances_carrera_cuenta" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_cuenta" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        CONSTRAINT "uq_alcances_carrera_cuenta_account_career" UNIQUE ("id_cuenta", "id_carrera"),
        CONSTRAINT "fk_alcances_carrera_cuenta_account" FOREIGN KEY ("id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_alcances_carrera_cuenta_career" FOREIGN KEY ("id_carrera") REFERENCES "carreras"("id") ON DELETE CASCADE
      );

      CREATE TABLE "rubricas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_modalidad" uuid NOT NULL,
        "nombre" varchar(220) NOT NULL,
        "descripcion" text,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_rubricas_modality" UNIQUE ("id_modalidad"),
        CONSTRAINT "fk_rubricas_modality" FOREIGN KEY ("id_modalidad") REFERENCES "modalidades"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "versiones_rubrica" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_rubrica" uuid NOT NULL,
        "periodo_academico_id" uuid NOT NULL,
        "version" varchar(30) NOT NULL,
        "estado" estado_version_rubrica_enum NOT NULL DEFAULT 'BORRADOR',
        "written_calificacion_maxima" numeric(4,2) NOT NULL DEFAULT 5.00,
        "oral_calificacion_maxima" numeric(4,2) NOT NULL DEFAULT 5.00,
        "activada_en" timestamptz,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_versiones_rubrica_rubric_version" UNIQUE ("id_rubrica", "version"),
        CONSTRAINT "chk_versiones_rubrica_scores" CHECK (
          "written_calificacion_maxima" > 0 AND "oral_calificacion_maxima" > 0 AND
          "written_calificacion_maxima" + "oral_calificacion_maxima" <= 99.99
        ),
        CONSTRAINT "chk_versiones_rubrica_activation" CHECK (
          ("estado" = 'BORRADOR' AND "activada_en" IS NULL) OR
          ("estado" IN ('ACTIVA', 'ARCHIVADA') AND "activada_en" IS NOT NULL)
        ),
        CONSTRAINT "fk_versiones_rubrica_rubric" FOREIGN KEY ("id_rubrica") REFERENCES "rubricas"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_versiones_rubrica_period" FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_versiones_rubrica_active_period"
        ON "versiones_rubrica" ("id_rubrica", "periodo_academico_id")
        WHERE "estado" = 'ACTIVA';

      CREATE TABLE "categorias_rubrica" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_version_rubrica" uuid NOT NULL,
        "etapa" etapa_evaluacion_enum NOT NULL,
        "codigo" varchar(10) NOT NULL,
        "nombre" varchar(240) NOT NULL,
        "calificacion_maxima" numeric(4,2) NOT NULL,
        "orden" smallint NOT NULL,
        CONSTRAINT "uq_categorias_rubrica_version_code" UNIQUE ("id_version_rubrica", "codigo"),
        CONSTRAINT "uq_categorias_rubrica_version_order" UNIQUE ("id_version_rubrica", "orden"),
        CONSTRAINT "chk_categorias_rubrica_values" CHECK ("calificacion_maxima" > 0 AND "orden" > 0),
        CONSTRAINT "fk_categorias_rubrica_version" FOREIGN KEY ("id_version_rubrica") REFERENCES "versiones_rubrica"("id") ON DELETE CASCADE
      );

      CREATE TABLE "indicadores_rubrica" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_categoria" uuid NOT NULL,
        "label" varchar(40) NOT NULL,
        "descripcion" text NOT NULL,
        "calificacion_maxima" numeric(4,2) NOT NULL,
        "orden" smallint NOT NULL,
        CONSTRAINT "uq_indicadores_rubrica_category_order" UNIQUE ("id_categoria", "orden"),
        CONSTRAINT "chk_indicadores_rubrica_values" CHECK ("calificacion_maxima" > 0 AND "orden" > 0),
        CONSTRAINT "fk_indicadores_rubrica_category" FOREIGN KEY ("id_categoria") REFERENCES "categorias_rubrica"("id") ON DELETE CASCADE
      );

      CREATE TABLE "trabajos_titulacion" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" varchar(40) NOT NULL,
        "titulo" text NOT NULL,
        "id_modalidad" uuid NOT NULL,
        "periodo_academico_id" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        "id_version_rubrica" uuid,
        "estado" estado_trabajo_enum NOT NULL DEFAULT 'REGISTRADO',
        "created_by_id_cuenta" uuid NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_trabajos_titulacion_code" UNIQUE ("codigo"),
        CONSTRAINT "chk_trabajos_titulacion_title" CHECK (btrim("titulo") <> ''),
        CONSTRAINT "fk_trabajos_titulacion_modality" FOREIGN KEY ("id_modalidad") REFERENCES "modalidades"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trabajos_titulacion_period" FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trabajos_titulacion_career" FOREIGN KEY ("id_carrera") REFERENCES "carreras"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trabajos_titulacion_rubric_version" FOREIGN KEY ("id_version_rubrica") REFERENCES "versiones_rubrica"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trabajos_titulacion_created_by" FOREIGN KEY ("created_by_id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "estudiantes_trabajo" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL,
        "id_estudiante" uuid NOT NULL,
        "orden_autoria" smallint NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_estudiantes_trabajo_work_student" UNIQUE ("id_trabajo", "id_estudiante"),
        CONSTRAINT "uq_estudiantes_trabajo_work_order" UNIQUE ("id_trabajo", "orden_autoria"),
        CONSTRAINT "chk_estudiantes_trabajo_order" CHECK ("orden_autoria" > 0),
        CONSTRAINT "fk_estudiantes_trabajo_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_estudiantes_trabajo_student" FOREIGN KEY ("id_estudiante") REFERENCES "perfiles_estudiante"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "asignaciones_tutor_trabajo" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL,
        "id_docente" uuid NOT NULL,
        "assigned_by_id_cuenta" uuid NOT NULL,
        "asignada_en" timestamptz NOT NULL DEFAULT now(),
        "finalizada_en" timestamptz,
        CONSTRAINT "chk_asignaciones_tutor_trabajo_dates" CHECK ("finalizada_en" IS NULL OR "finalizada_en" >= "asignada_en"),
        CONSTRAINT "fk_asignaciones_tutor_trabajo_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_asignaciones_tutor_trabajo_teacher" FOREIGN KEY ("id_docente") REFERENCES "perfiles_docente"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_asignaciones_tutor_trabajo_assigned_by" FOREIGN KEY ("assigned_by_id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_asignaciones_tutor_trabajo_active_work"
        ON "asignaciones_tutor_trabajo" ("id_trabajo") WHERE "finalizada_en" IS NULL;

      CREATE TABLE "asignaciones_tribunal" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL,
        "estado" estado_asignacion_tribunal_enum NOT NULL DEFAULT 'BORRADOR',
        "assigned_by_id_cuenta" uuid NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "confirmada_en" timestamptz,
        CONSTRAINT "chk_asignaciones_tribunal_confirmation" CHECK (
          ("estado" = 'BORRADOR' AND "confirmada_en" IS NULL) OR
          ("estado" IN ('CONFIRMADO', 'REEMPLAZADO') AND "confirmada_en" IS NOT NULL)
        ),
        CONSTRAINT "fk_asignaciones_tribunal_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_asignaciones_tribunal_assigned_by" FOREIGN KEY ("assigned_by_id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_asignaciones_tribunal_current_work"
        ON "asignaciones_tribunal" ("id_trabajo") WHERE "estado" IN ('BORRADOR', 'CONFIRMADO');

      CREATE TABLE "miembros_tribunal" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_asignacion" uuid NOT NULL,
        "id_docente" uuid NOT NULL,
        "position" smallint NOT NULL,
        CONSTRAINT "uq_miembros_tribunal_assignment_position" UNIQUE ("id_asignacion", "position"),
        CONSTRAINT "uq_miembros_tribunal_assignment_teacher" UNIQUE ("id_asignacion", "id_docente"),
        CONSTRAINT "chk_miembros_tribunal_position" CHECK ("position" IN (1, 2)),
        CONSTRAINT "fk_miembros_tribunal_assignment" FOREIGN KEY ("id_asignacion") REFERENCES "asignaciones_tribunal"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_miembros_tribunal_teacher" FOREIGN KEY ("id_docente") REFERENCES "perfiles_docente"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "programaciones_sustentacion" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL,
        "fecha_programada" date NOT NULL,
        "hora_programada" time without time zone NOT NULL,
        "sala" varchar(160) NOT NULL,
        "estado" estado_sustentacion_enum NOT NULL DEFAULT 'PROGRAMADA',
        "scheduled_by_id_cuenta" uuid NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_programaciones_sustentacion_work" UNIQUE ("id_trabajo"),
        CONSTRAINT "chk_programaciones_sustentacion_room" CHECK (btrim("sala") <> ''),
        CONSTRAINT "fk_programaciones_sustentacion_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_programaciones_sustentacion_scheduled_by" FOREIGN KEY ("scheduled_by_id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "evaluaciones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL,
        "id_miembro_tribunal" uuid NOT NULL,
        "id_estudiante" uuid,
        "id_version_rubrica" uuid NOT NULL,
        "etapa" etapa_evaluacion_enum NOT NULL,
        "estado" estado_evaluacion_enum NOT NULL DEFAULT 'BORRADOR',
        "instantanea_rubrica" jsonb NOT NULL,
        "calificacion_total" numeric(4,2) NOT NULL DEFAULT 0,
        "instantanea_calificacion_maxima" numeric(4,2) NOT NULL,
        "cerrada_en" timestamptz,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_evaluaciones_stage_student" CHECK (
          ("etapa" = 'ESCRITA' AND "id_estudiante" IS NULL) OR
          ("etapa" = 'ORAL' AND "id_estudiante" IS NOT NULL)
        ),
        CONSTRAINT "chk_evaluaciones_closed_timestamp" CHECK (
          ("estado" = 'BORRADOR' AND "cerrada_en" IS NULL) OR
          ("estado" = 'CERRADA' AND "cerrada_en" IS NOT NULL)
        ),
        CONSTRAINT "chk_evaluaciones_score_range" CHECK (
          "instantanea_calificacion_maxima" > 0 AND "calificacion_total" >= 0 AND "calificacion_total" <= "instantanea_calificacion_maxima"
        ),
        CONSTRAINT "chk_evaluaciones_snapshot_object" CHECK (jsonb_typeof("instantanea_rubrica") = 'object'),
        CONSTRAINT "chk_evaluaciones_snapshot_version" CHECK (
          "instantanea_rubrica" ? 'rubricVersionId' AND
          "instantanea_rubrica" ->> 'rubricVersionId' = "id_version_rubrica"::text
        ),
        CONSTRAINT "fk_evaluaciones_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluaciones_tribunal_member" FOREIGN KEY ("id_miembro_tribunal") REFERENCES "miembros_tribunal"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluaciones_student" FOREIGN KEY ("id_estudiante") REFERENCES "perfiles_estudiante"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluaciones_rubric_version" FOREIGN KEY ("id_version_rubrica") REFERENCES "versiones_rubrica"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_evaluaciones_written_member_work"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal") WHERE "etapa" = 'ESCRITA';
      CREATE UNIQUE INDEX "uq_evaluaciones_oral_member_work_student"
        ON "evaluaciones" ("id_trabajo", "id_miembro_tribunal", "id_estudiante") WHERE "etapa" = 'ORAL';

      CREATE TABLE "calificaciones_evaluacion" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_evaluacion" uuid NOT NULL,
        "id_indicador" uuid NOT NULL,
        "score" numeric(4,2) NOT NULL,
        "instantanea_calificacion_maxima" numeric(4,2) NOT NULL,
        "observation" text,
        CONSTRAINT "uq_calificaciones_evaluacion_evaluation_indicator" UNIQUE ("id_evaluacion", "id_indicador"),
        CONSTRAINT "chk_calificaciones_evaluacion_range" CHECK (
          "instantanea_calificacion_maxima" > 0 AND "score" >= 0 AND "score" <= "instantanea_calificacion_maxima"
        ),
        CONSTRAINT "fk_calificaciones_evaluacion_evaluation" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluaciones"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_calificaciones_evaluacion_indicator" FOREIGN KEY ("id_indicador") REFERENCES "indicadores_rubrica"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "notificaciones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipient_id_cuenta" uuid NOT NULL,
        "id_trabajo" uuid NOT NULL,
        "type" tipo_notificacion_enum NOT NULL,
        "titulo" varchar(180) NOT NULL,
        "mensaje" text NOT NULL,
        "ruta_accion" varchar(300) NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        "leida_en" timestamptz,
        CONSTRAINT "fk_notificaciones_recipient" FOREIGN KEY ("recipient_id_cuenta") REFERENCES "cuentas_usuario"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_notificaciones_work" FOREIGN KEY ("id_trabajo") REFERENCES "trabajos_titulacion"("id") ON DELETE CASCADE
      );
      CREATE INDEX "idx_notificaciones_recipient_unread"
        ON "notificaciones" ("recipient_id_cuenta", "creado_en" DESC) WHERE "leida_en" IS NULL;

      CREATE OR REPLACE FUNCTION "validar_cantidad_miembros_tribunal_confirmado"(assignment_uuid uuid)
      RETURNS void AS $$
      DECLARE
        assignment_status estado_asignacion_tribunal_enum;
        members_count integer;
      BEGIN
        SELECT "estado" INTO assignment_status
        FROM "asignaciones_tribunal"
        WHERE "id" = assignment_uuid;

        IF FOUND AND assignment_status = 'CONFIRMADO' THEN
          SELECT count(*) INTO members_count
          FROM "miembros_tribunal"
          WHERE "id_asignacion" = assignment_uuid;

          IF members_count <> 2 THEN
            RAISE EXCEPTION 'Un tribunal confirmado debe tener exactamente dos miembros.';
          END IF;
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "forzar_tribunal_confirmado_desde_asignacion"()
      RETURNS trigger AS $$
      BEGIN
        PERFORM "validar_cantidad_miembros_tribunal_confirmado"(NEW."id");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER "trg_confirmed_tribunal_assignment_count"
      AFTER INSERT OR UPDATE ON "asignaciones_tribunal"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION "forzar_tribunal_confirmado_desde_asignacion"();

      CREATE OR REPLACE FUNCTION "forzar_tribunal_confirmado_desde_miembro"()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM "validar_cantidad_miembros_tribunal_confirmado"(OLD."id_asignacion");
          RETURN OLD;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD."id_asignacion" <> NEW."id_asignacion" THEN
          PERFORM "validar_cantidad_miembros_tribunal_confirmado"(OLD."id_asignacion");
        END IF;

        PERFORM "validar_cantidad_miembros_tribunal_confirmado"(NEW."id_asignacion");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER "trg_confirmed_tribunal_member_count"
      AFTER INSERT OR UPDATE OR DELETE ON "miembros_tribunal"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION "forzar_tribunal_confirmado_desde_miembro"();

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
          SELECT "id_modalidad" INTO target_modality
          FROM "rubricas" WHERE "id" = NEW."id_rubrica";

          IF EXISTS (
            SELECT 1
            FROM "versiones_rubrica" existing_version
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
          FROM "categorias_rubrica"
          WHERE "id_version_rubrica" = NEW."id";

          IF written_categories_total <> NEW."written_calificacion_maxima"
            OR oral_categories_total <> NEW."oral_calificacion_maxima" THEN
            RAISE EXCEPTION 'Las categorías no coinciden con los máximos escrito y oral de la versión.';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM "categorias_rubrica" categoria
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

      CREATE OR REPLACE FUNCTION "validar_version_rubrica_trabajo"()
      RETURNS trigger AS $$
      DECLARE
        selected_status estado_version_rubrica_enum;
        selected_modality uuid;
        selected_period uuid;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."id_version_rubrica" IS NOT NULL
          AND OLD."id_version_rubrica" IS DISTINCT FROM NEW."id_version_rubrica" THEN
          RAISE EXCEPTION 'La versión de rúbrica fijada a un trabajo no puede reemplazarse ni retirarse.';
        END IF;

        IF NEW."id_version_rubrica" IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT rv."estado", r."id_modalidad", rv."periodo_academico_id"
          INTO selected_status, selected_modality, selected_period
        FROM "versiones_rubrica" rv
        JOIN "rubricas" r ON r."id" = rv."id_rubrica"
        WHERE rv."id" = NEW."id_version_rubrica";

        IF selected_status <> 'ACTIVA' THEN
          RAISE EXCEPTION 'El trabajo solo puede fijar una versión activa de rúbrica.';
        END IF;
        IF selected_modality <> NEW."id_modalidad" OR selected_period <> NEW."periodo_academico_id" THEN
          RAISE EXCEPTION 'La versión de rúbrica no corresponde a la modalidad y período del trabajo.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_version_rubrica_trabajo"
      BEFORE INSERT OR UPDATE OF "id_version_rubrica", "id_modalidad", "periodo_academico_id"
      ON "trabajos_titulacion"
      FOR EACH ROW EXECUTE FUNCTION "validar_version_rubrica_trabajo"();

      CREATE OR REPLACE FUNCTION "validar_contexto_evaluacion"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        written_max numeric(4,2);
        oral_max numeric(4,2);
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM "miembros_tribunal" tm
          JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
          WHERE tm."id" = NEW."id_miembro_tribunal"
            AND ta."id_trabajo" = NEW."id_trabajo"
            AND ta."estado" = 'CONFIRMADO'
        ) THEN
          RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.';
        END IF;

        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" ws
          WHERE ws."id_trabajo" = NEW."id_trabajo" AND ws."id_estudiante" = NEW."id_estudiante"
        ) THEN
          RAISE EXCEPTION 'La evaluación oral debe corresponder a un estudiante del trabajo.';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" ws WHERE ws."id_trabajo" = NEW."id_trabajo"
        ) THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;

        IF NEW."etapa" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" ds
          WHERE ds."id_trabajo" = NEW."id_trabajo" AND ds."estado" <> 'CANCELADA'
        ) THEN
          RAISE EXCEPTION 'La evaluación oral requiere una sustentación programada.';
        END IF;

        SELECT "id_version_rubrica" INTO bound_rubric_version
        FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";
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
      ON "evaluaciones"
      FOR EACH ROW EXECUTE FUNCTION "validar_contexto_evaluacion"();

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
          WHERE categoria."id_version_rubrica" = NEW."id_version_rubrica"
            AND categoria."etapa" = NEW."etapa";

          SELECT count(*), COALESCE(sum("score"), 0)
            INTO recorded_indicators, calculated_total
          FROM "calificaciones_evaluacion"
          WHERE "id_evaluacion" = NEW."id";

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

      CREATE OR REPLACE FUNCTION "proteger_evaluacion_cerrada"()
      RETURNS trigger AS $$
      BEGIN
        IF OLD."estado" = 'CERRADA' THEN
          RAISE EXCEPTION 'Una evaluación cerrada no puede modificarse ni eliminarse.';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_proteger_evaluacion_cerrada"
      BEFORE UPDATE OR DELETE ON "evaluaciones"
      FOR EACH ROW EXECUTE FUNCTION "proteger_evaluacion_cerrada"();

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
          OLD."id_evaluacion" IS DISTINCT FROM NEW."id_evaluacion" OR
          OLD."id_indicador" IS DISTINCT FROM NEW."id_indicador"
        ) THEN
          RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluación o indicador.';
        END IF;

        target_id_evaluacion := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_evaluacion" ELSE NEW."id_evaluacion" END;
        SELECT "estado", "id_version_rubrica", "etapa"
          INTO target_status, target_version_id, target_stage
        FROM "evaluaciones" WHERE "id" = target_id_evaluacion;
        IF target_status = 'CERRADA' THEN
          RAISE EXCEPTION 'Los puntajes de una evaluación cerrada no pueden modificarse.';
        END IF;

        IF TG_OP <> 'DELETE' THEN
          SELECT categoria."id_version_rubrica", categoria."etapa", indicador."calificacion_maxima"
            INTO indicator_version_id, indicator_stage, indicator_max
          FROM "indicadores_rubrica" indicador
          JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
          WHERE indicador."id" = NEW."id_indicador";

          IF indicator_version_id IS DISTINCT FROM target_version_id
            OR indicator_stage IS DISTINCT FROM target_stage THEN
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

      CREATE OR REPLACE FUNCTION "validar_revisiones_escritas_sustentacion"()
      RETURNS trigger AS $$
      DECLARE
        completed_reviews integer;
      BEGIN
        SELECT count(DISTINCT e."id_miembro_tribunal") INTO completed_reviews
        FROM "evaluaciones" e
        JOIN "miembros_tribunal" tm ON tm."id" = e."id_miembro_tribunal"
        JOIN "asignaciones_tribunal" ta ON ta."id" = tm."id_asignacion"
        WHERE e."id_trabajo" = NEW."id_trabajo"
          AND e."etapa" = 'ESCRITA'
          AND e."estado" = 'CERRADA'
          AND ta."id_trabajo" = NEW."id_trabajo"
          AND ta."estado" = 'CONFIRMADO';

        IF completed_reviews <> 2 THEN
          RAISE EXCEPTION 'La sustentación requiere dos revisiones escritas cerradas.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_revisiones_escritas_sustentacion"
      BEFORE INSERT OR UPDATE OF "id_trabajo" ON "programaciones_sustentacion"
      FOR EACH ROW EXECUTE FUNCTION "validar_revisiones_escritas_sustentacion"();

      CREATE OR REPLACE FUNCTION "notify_confirmed_miembros_tribunal"()
      RETURNS trigger AS $$
      DECLARE
        work_title text;
      BEGIN
        IF NEW."estado" = 'CONFIRMADO'
          AND (TG_OP = 'INSERT' OR OLD."estado" IS DISTINCT FROM 'CONFIRMADO') THEN
          SELECT "titulo" INTO work_title FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";

          INSERT INTO "notificaciones" (
            "recipient_id_cuenta", "id_trabajo", "type", "titulo", "mensaje", "ruta_accion"
          )
          SELECT
            cuenta."id",
            NEW."id_trabajo",
            'TRIBUNAL_ASIGNADO',
            'Asignación de tribunal',
            'Ha sido asignado como miembro del tribunal del trabajo: ' || work_title,
            '/mis-evaluaciones?trabajo=' || NEW."id_trabajo"::text
          FROM "miembros_tribunal" member
          JOIN "perfiles_docente" docente ON docente."id" = member."id_docente"
          JOIN "cuentas_usuario" cuenta ON cuenta."id_persona" = docente."id_persona" AND cuenta."esta_activo" = true
          WHERE member."id_asignacion" = NEW."id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_notify_confirmed_miembros_tribunal"
      AFTER INSERT OR UPDATE ON "asignaciones_tribunal"
      FOR EACH ROW EXECUTE FUNCTION "notify_confirmed_miembros_tribunal"();

      CREATE OR REPLACE FUNCTION "notificar_sustentacion_programada"()
      RETURNS trigger AS $$
      DECLARE
        work_title text;
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD."fecha_programada" IS NOT DISTINCT FROM NEW."fecha_programada"
          AND OLD."hora_programada" IS NOT DISTINCT FROM NEW."hora_programada"
          AND OLD."sala" IS NOT DISTINCT FROM NEW."sala" THEN
          RETURN NEW;
        END IF;

        SELECT "titulo" INTO work_title FROM "trabajos_titulacion" WHERE "id" = NEW."id_trabajo";

        INSERT INTO "notificaciones" (
          "recipient_id_cuenta", "id_trabajo", "type", "titulo", "mensaje", "ruta_accion"
        )
        SELECT
          cuenta."id",
          NEW."id_trabajo",
          'SUSTENTACION_PROGRAMADA',
          'Sustentación programada',
          'Se ha programado la sustentación del trabajo ' || work_title ||
            ' para el ' || to_char(NEW."fecha_programada", 'DD/MM/YYYY') ||
            ' a las ' || to_char(NEW."hora_programada", 'HH24:MI') ||
            ', ' || NEW."sala" || '.',
          '/mis-evaluaciones?trabajo=' || NEW."id_trabajo"::text
        FROM "asignaciones_tribunal" asignacion
        JOIN "miembros_tribunal" member ON member."id_asignacion" = asignacion."id"
        JOIN "perfiles_docente" docente ON docente."id" = member."id_docente"
        JOIN "cuentas_usuario" cuenta ON cuenta."id_persona" = docente."id_persona" AND cuenta."esta_activo" = true
        WHERE asignacion."id_trabajo" = NEW."id_trabajo" AND asignacion."estado" = 'CONFIRMADO';

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_notificar_sustentacion_programada"
      AFTER INSERT OR UPDATE OF "fecha_programada", "hora_programada", "sala" ON "programaciones_sustentacion"
      FOR EACH ROW EXECUTE FUNCTION "notificar_sustentacion_programada"();

      CREATE OR REPLACE FUNCTION "validar_version_rubrica_modificable"(version_uuid uuid)
      RETURNS void AS $$
      DECLARE
        version_status estado_version_rubrica_enum;
      BEGIN
        SELECT "estado" INTO version_status FROM "versiones_rubrica" WHERE "id" = version_uuid;
        IF version_status IS DISTINCT FROM 'BORRADOR' THEN
          RAISE EXCEPTION 'Solo una versión de rúbrica en borrador puede modificar su estructura.';
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "proteger_estructura_categoria_rubrica"()
      RETURNS trigger AS $$
      DECLARE
        version_uuid uuid;
      BEGIN
        version_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_version_rubrica" ELSE NEW."id_version_rubrica" END;
        PERFORM "validar_version_rubrica_modificable"(version_uuid);
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_proteger_estructura_categoria_rubrica"
      BEFORE INSERT OR UPDATE OR DELETE ON "categorias_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "proteger_estructura_categoria_rubrica"();

      CREATE OR REPLACE FUNCTION "proteger_estructura_indicador_rubrica"()
      RETURNS trigger AS $$
      DECLARE
        category_uuid uuid;
        version_uuid uuid;
      BEGIN
        category_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_categoria" ELSE NEW."id_categoria" END;
        SELECT "id_version_rubrica" INTO version_uuid FROM "categorias_rubrica" WHERE "id" = category_uuid;
        IF version_uuid IS NOT NULL THEN
          PERFORM "validar_version_rubrica_modificable"(version_uuid);
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_proteger_estructura_indicador_rubrica"
      BEFORE INSERT OR UPDATE OR DELETE ON "indicadores_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "proteger_estructura_indicador_rubrica"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "notificaciones" CASCADE;
      DROP TABLE IF EXISTS "calificaciones_evaluacion" CASCADE;
      DROP TABLE IF EXISTS "evaluaciones" CASCADE;
      DROP TABLE IF EXISTS "programaciones_sustentacion" CASCADE;
      DROP TABLE IF EXISTS "miembros_tribunal" CASCADE;
      DROP TABLE IF EXISTS "asignaciones_tribunal" CASCADE;
      DROP TABLE IF EXISTS "asignaciones_tutor_trabajo" CASCADE;
      DROP TABLE IF EXISTS "estudiantes_trabajo" CASCADE;
      DROP TABLE IF EXISTS "trabajos_titulacion" CASCADE;
      DROP TABLE IF EXISTS "indicadores_rubrica" CASCADE;
      DROP TABLE IF EXISTS "categorias_rubrica" CASCADE;
      DROP TABLE IF EXISTS "versiones_rubrica" CASCADE;
      DROP TABLE IF EXISTS "rubricas" CASCADE;
      DROP TABLE IF EXISTS "alcances_carrera_cuenta" CASCADE;
      DROP TABLE IF EXISTS "roles_cuenta" CASCADE;
      DROP TABLE IF EXISTS "roles" CASCADE;
      DROP TABLE IF EXISTS "cuentas_usuario" CASCADE;
      DROP TABLE IF EXISTS "perfiles_docente" CASCADE;
      DROP TABLE IF EXISTS "perfiles_estudiante" CASCADE;
      DROP TABLE IF EXISTS "personas" CASCADE;
      DROP TABLE IF EXISTS "periodos_academicos" CASCADE;
      DROP TABLE IF EXISTS "modalidades" CASCADE;
      DROP TABLE IF EXISTS "carreras" CASCADE;

      DROP FUNCTION IF EXISTS "proteger_estructura_indicador_rubrica"() CASCADE;
      DROP FUNCTION IF EXISTS "proteger_estructura_categoria_rubrica"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_version_rubrica_modificable"(uuid) CASCADE;
      DROP FUNCTION IF EXISTS "notificar_sustentacion_programada"() CASCADE;
      DROP FUNCTION IF EXISTS "notify_confirmed_miembros_tribunal"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_revisiones_escritas_sustentacion"() CASCADE;
      DROP FUNCTION IF EXISTS "proteger_calificaciones_evaluacion_cerrada"() CASCADE;
      DROP FUNCTION IF EXISTS "proteger_evaluacion_cerrada"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_cierre_evaluacion"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_contexto_evaluacion"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_version_rubrica_trabajo"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_activacion_version_rubrica"() CASCADE;
      DROP FUNCTION IF EXISTS "forzar_tribunal_confirmado_desde_miembro"() CASCADE;
      DROP FUNCTION IF EXISTS "forzar_tribunal_confirmado_desde_asignacion"() CASCADE;
      DROP FUNCTION IF EXISTS "validar_cantidad_miembros_tribunal_confirmado"(uuid) CASCADE;

      DROP TYPE IF EXISTS "tipo_notificacion_enum";
      DROP TYPE IF EXISTS "estado_sustentacion_enum";
      DROP TYPE IF EXISTS "estado_evaluacion_enum";
      DROP TYPE IF EXISTS "etapa_evaluacion_enum";
      DROP TYPE IF EXISTS "estado_version_rubrica_enum";
      DROP TYPE IF EXISTS "estado_asignacion_tribunal_enum";
      DROP TYPE IF EXISTS "estado_trabajo_enum";
      DROP TYPE IF EXISTS "fuente_directorio_enum";
    `);
  }
}
