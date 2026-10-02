import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TYPE "directory_source_enum" AS ENUM ('MANUAL', 'INSTITUTIONAL_READ_ONLY');
      CREATE TYPE "work_status_enum" AS ENUM (
        'REGISTERED',
        'TRIBUNAL_ASSIGNED',
        'WRITTEN_REVIEW_PENDING',
        'WRITTEN_REVIEW_COMPLETED',
        'DEFENSE_SCHEDULED',
        'DEFENSE_PENDING',
        'EVALUATION_COMPLETED',
        'FINALIZED'
      );
      CREATE TYPE "tribunal_assignment_status_enum" AS ENUM ('DRAFT', 'CONFIRMED', 'SUPERSEDED');
      CREATE TYPE "rubric_version_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
      CREATE TYPE "evaluation_stage_enum" AS ENUM ('WRITTEN', 'ORAL');
      CREATE TYPE "evaluation_status_enum" AS ENUM ('DRAFT', 'CLOSED');
      CREATE TYPE "defense_status_enum" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
      CREATE TYPE "notification_type_enum" AS ENUM (
        'TRIBUNAL_ASSIGNED',
        'WRITTEN_REVIEW_PENDING',
        'DEFENSE_SCHEDULED'
      );

      CREATE TABLE "careers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(30) NOT NULL,
        "name" varchar(160) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_careers_code" UNIQUE ("code")
      );

      CREATE TABLE "modalities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar(160) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_modalities_code" UNIQUE ("code")
      );

      CREATE TABLE "academic_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(20) NOT NULL,
        "starts_on" date,
        "ends_on" date,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_academic_periods_code" UNIQUE ("code"),
        CONSTRAINT "chk_academic_periods_dates" CHECK (
          "starts_on" IS NULL OR "ends_on" IS NULL OR "starts_on" <= "ends_on"
        )
      );

      CREATE TABLE "persons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "national_id" varchar(20) NOT NULL,
        "given_names" varchar(160) NOT NULL,
        "surnames" varchar(160) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_persons_national_id" UNIQUE ("national_id"),
        CONSTRAINT "chk_persons_required_text" CHECK (
          btrim("national_id") <> '' AND btrim("given_names") <> '' AND btrim("surnames") <> ''
        )
      );

      CREATE TABLE "student_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "career_id" uuid NOT NULL,
        CONSTRAINT "uq_student_profiles_person" UNIQUE ("person_id"),
        CONSTRAINT "fk_student_profiles_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_student_profiles_career" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "teacher_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "career_id" uuid NOT NULL,
        "source" directory_source_enum NOT NULL DEFAULT 'MANUAL',
        "external_reference" varchar(120),
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_teacher_profiles_person" UNIQUE ("person_id"),
        CONSTRAINT "fk_teacher_profiles_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_teacher_profiles_career" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "user_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "auth_subject" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_accounts_person" UNIQUE ("person_id"),
        CONSTRAINT "uq_user_accounts_auth_subject" UNIQUE ("auth_subject"),
        CONSTRAINT "fk_user_accounts_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(60) NOT NULL,
        "name" varchar(120) NOT NULL,
        CONSTRAINT "uq_roles_code" UNIQUE ("code")
      );

      CREATE TABLE "account_roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "account_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "assigned_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_account_roles_account_role" UNIQUE ("account_id", "role_id"),
        CONSTRAINT "fk_account_roles_account" FOREIGN KEY ("account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_account_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "account_career_scopes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "account_id" uuid NOT NULL,
        "career_id" uuid NOT NULL,
        CONSTRAINT "uq_account_career_scopes_account_career" UNIQUE ("account_id", "career_id"),
        CONSTRAINT "fk_account_career_scopes_account" FOREIGN KEY ("account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_account_career_scopes_career" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE CASCADE
      );

      CREATE TABLE "rubrics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "modality_id" uuid NOT NULL,
        "name" varchar(220) NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_rubrics_modality" UNIQUE ("modality_id"),
        CONSTRAINT "fk_rubrics_modality" FOREIGN KEY ("modality_id") REFERENCES "modalities"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "rubric_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "rubric_id" uuid NOT NULL,
        "academic_period_id" uuid NOT NULL,
        "version" varchar(30) NOT NULL,
        "status" rubric_version_status_enum NOT NULL DEFAULT 'DRAFT',
        "written_max_score" numeric(4,2) NOT NULL DEFAULT 5.00,
        "oral_max_score" numeric(4,2) NOT NULL DEFAULT 5.00,
        "activated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_rubric_versions_rubric_version" UNIQUE ("rubric_id", "version"),
        CONSTRAINT "chk_rubric_versions_scores" CHECK (
          "written_max_score" > 0 AND "oral_max_score" > 0 AND
          "written_max_score" + "oral_max_score" <= 99.99
        ),
        CONSTRAINT "chk_rubric_versions_activation" CHECK (
          ("status" = 'DRAFT' AND "activated_at" IS NULL) OR
          ("status" IN ('ACTIVE', 'ARCHIVED') AND "activated_at" IS NOT NULL)
        ),
        CONSTRAINT "fk_rubric_versions_rubric" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_rubric_versions_period" FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_rubric_versions_active_period"
        ON "rubric_versions" ("rubric_id", "academic_period_id")
        WHERE "status" = 'ACTIVE';

      CREATE TABLE "rubric_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "rubric_version_id" uuid NOT NULL,
        "stage" evaluation_stage_enum NOT NULL,
        "code" varchar(10) NOT NULL,
        "name" varchar(240) NOT NULL,
        "max_score" numeric(4,2) NOT NULL,
        "order" smallint NOT NULL,
        CONSTRAINT "uq_rubric_categories_version_code" UNIQUE ("rubric_version_id", "code"),
        CONSTRAINT "uq_rubric_categories_version_order" UNIQUE ("rubric_version_id", "order"),
        CONSTRAINT "chk_rubric_categories_values" CHECK ("max_score" > 0 AND "order" > 0),
        CONSTRAINT "fk_rubric_categories_version" FOREIGN KEY ("rubric_version_id") REFERENCES "rubric_versions"("id") ON DELETE CASCADE
      );

      CREATE TABLE "rubric_indicators" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "label" varchar(40) NOT NULL,
        "description" text NOT NULL,
        "max_score" numeric(4,2) NOT NULL,
        "order" smallint NOT NULL,
        CONSTRAINT "uq_rubric_indicators_category_order" UNIQUE ("category_id", "order"),
        CONSTRAINT "chk_rubric_indicators_values" CHECK ("max_score" > 0 AND "order" > 0),
        CONSTRAINT "fk_rubric_indicators_category" FOREIGN KEY ("category_id") REFERENCES "rubric_categories"("id") ON DELETE CASCADE
      );

      CREATE TABLE "thesis_works" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "title" text NOT NULL,
        "modality_id" uuid NOT NULL,
        "academic_period_id" uuid NOT NULL,
        "career_id" uuid NOT NULL,
        "rubric_version_id" uuid,
        "status" work_status_enum NOT NULL DEFAULT 'REGISTERED',
        "created_by_account_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_thesis_works_code" UNIQUE ("code"),
        CONSTRAINT "chk_thesis_works_title" CHECK (btrim("title") <> ''),
        CONSTRAINT "fk_thesis_works_modality" FOREIGN KEY ("modality_id") REFERENCES "modalities"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_thesis_works_period" FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_thesis_works_career" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_thesis_works_rubric_version" FOREIGN KEY ("rubric_version_id") REFERENCES "rubric_versions"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_thesis_works_created_by" FOREIGN KEY ("created_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "work_students" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "work_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "author_order" smallint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_work_students_work_student" UNIQUE ("work_id", "student_id"),
        CONSTRAINT "uq_work_students_work_order" UNIQUE ("work_id", "author_order"),
        CONSTRAINT "chk_work_students_order" CHECK ("author_order" > 0),
        CONSTRAINT "fk_work_students_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_work_students_student" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "work_tutor_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "work_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "assigned_by_account_id" uuid NOT NULL,
        "assigned_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at" timestamptz,
        CONSTRAINT "chk_work_tutor_assignments_dates" CHECK ("ended_at" IS NULL OR "ended_at" >= "assigned_at"),
        CONSTRAINT "fk_work_tutor_assignments_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_work_tutor_assignments_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_work_tutor_assignments_assigned_by" FOREIGN KEY ("assigned_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_work_tutor_assignments_active_work"
        ON "work_tutor_assignments" ("work_id") WHERE "ended_at" IS NULL;

      CREATE TABLE "tribunal_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "work_id" uuid NOT NULL,
        "status" tribunal_assignment_status_enum NOT NULL DEFAULT 'DRAFT',
        "assigned_by_account_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "confirmed_at" timestamptz,
        CONSTRAINT "chk_tribunal_assignments_confirmation" CHECK (
          ("status" = 'DRAFT' AND "confirmed_at" IS NULL) OR
          ("status" IN ('CONFIRMED', 'SUPERSEDED') AND "confirmed_at" IS NOT NULL)
        ),
        CONSTRAINT "fk_tribunal_assignments_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tribunal_assignments_assigned_by" FOREIGN KEY ("assigned_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_tribunal_assignments_current_work"
        ON "tribunal_assignments" ("work_id") WHERE "status" IN ('DRAFT', 'CONFIRMED');

      CREATE TABLE "tribunal_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        CONSTRAINT "uq_tribunal_members_assignment_position" UNIQUE ("assignment_id", "position"),
        CONSTRAINT "uq_tribunal_members_assignment_teacher" UNIQUE ("assignment_id", "teacher_id"),
        CONSTRAINT "chk_tribunal_members_position" CHECK ("position" IN (1, 2)),
        CONSTRAINT "fk_tribunal_members_assignment" FOREIGN KEY ("assignment_id") REFERENCES "tribunal_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tribunal_members_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "defense_schedules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "work_id" uuid NOT NULL,
        "scheduled_date" date NOT NULL,
        "scheduled_time" time without time zone NOT NULL,
        "room" varchar(160) NOT NULL,
        "status" defense_status_enum NOT NULL DEFAULT 'SCHEDULED',
        "scheduled_by_account_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_defense_schedules_work" UNIQUE ("work_id"),
        CONSTRAINT "chk_defense_schedules_room" CHECK (btrim("room") <> ''),
        CONSTRAINT "fk_defense_schedules_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_defense_schedules_scheduled_by" FOREIGN KEY ("scheduled_by_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "evaluations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "work_id" uuid NOT NULL,
        "tribunal_member_id" uuid NOT NULL,
        "student_id" uuid,
        "rubric_version_id" uuid NOT NULL,
        "stage" evaluation_stage_enum NOT NULL,
        "status" evaluation_status_enum NOT NULL DEFAULT 'DRAFT',
        "rubric_snapshot" jsonb NOT NULL,
        "total_score" numeric(4,2) NOT NULL DEFAULT 0,
        "max_score_snapshot" numeric(4,2) NOT NULL,
        "closed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_evaluations_stage_student" CHECK (
          ("stage" = 'WRITTEN' AND "student_id" IS NULL) OR
          ("stage" = 'ORAL' AND "student_id" IS NOT NULL)
        ),
        CONSTRAINT "chk_evaluations_closed_timestamp" CHECK (
          ("status" = 'DRAFT' AND "closed_at" IS NULL) OR
          ("status" = 'CLOSED' AND "closed_at" IS NOT NULL)
        ),
        CONSTRAINT "chk_evaluations_score_range" CHECK (
          "max_score_snapshot" > 0 AND "total_score" >= 0 AND "total_score" <= "max_score_snapshot"
        ),
        CONSTRAINT "chk_evaluations_snapshot_object" CHECK (jsonb_typeof("rubric_snapshot") = 'object'),
        CONSTRAINT "chk_evaluations_snapshot_version" CHECK (
          "rubric_snapshot" ? 'rubricVersionId' AND
          "rubric_snapshot" ->> 'rubricVersionId' = "rubric_version_id"::text
        ),
        CONSTRAINT "fk_evaluations_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluations_tribunal_member" FOREIGN KEY ("tribunal_member_id") REFERENCES "tribunal_members"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluations_student" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_evaluations_rubric_version" FOREIGN KEY ("rubric_version_id") REFERENCES "rubric_versions"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_evaluations_written_member_work"
        ON "evaluations" ("work_id", "tribunal_member_id") WHERE "stage" = 'WRITTEN';
      CREATE UNIQUE INDEX "uq_evaluations_oral_member_work_student"
        ON "evaluations" ("work_id", "tribunal_member_id", "student_id") WHERE "stage" = 'ORAL';

      CREATE TABLE "evaluation_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "evaluation_id" uuid NOT NULL,
        "indicator_id" uuid NOT NULL,
        "score" numeric(4,2) NOT NULL,
        "max_score_snapshot" numeric(4,2) NOT NULL,
        "observation" text,
        CONSTRAINT "uq_evaluation_scores_evaluation_indicator" UNIQUE ("evaluation_id", "indicator_id"),
        CONSTRAINT "chk_evaluation_scores_range" CHECK (
          "max_score_snapshot" > 0 AND "score" >= 0 AND "score" <= "max_score_snapshot"
        ),
        CONSTRAINT "fk_evaluation_scores_evaluation" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_evaluation_scores_indicator" FOREIGN KEY ("indicator_id") REFERENCES "rubric_indicators"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipient_account_id" uuid NOT NULL,
        "work_id" uuid NOT NULL,
        "type" notification_type_enum NOT NULL,
        "title" varchar(180) NOT NULL,
        "message" text NOT NULL,
        "action_path" varchar(300) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "read_at" timestamptz,
        CONSTRAINT "fk_notifications_recipient" FOREIGN KEY ("recipient_account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_notifications_work" FOREIGN KEY ("work_id") REFERENCES "thesis_works"("id") ON DELETE CASCADE
      );
      CREATE INDEX "idx_notifications_recipient_unread"
        ON "notifications" ("recipient_account_id", "created_at" DESC) WHERE "read_at" IS NULL;

      CREATE OR REPLACE FUNCTION "assert_confirmed_tribunal_member_count"(assignment_uuid uuid)
      RETURNS void AS $$
      DECLARE
        assignment_status tribunal_assignment_status_enum;
        members_count integer;
      BEGIN
        SELECT "status" INTO assignment_status
        FROM "tribunal_assignments"
        WHERE "id" = assignment_uuid;

        IF FOUND AND assignment_status = 'CONFIRMED' THEN
          SELECT count(*) INTO members_count
          FROM "tribunal_members"
          WHERE "assignment_id" = assignment_uuid;

          IF members_count <> 2 THEN
            RAISE EXCEPTION 'Un tribunal confirmado debe tener exactamente dos miembros.';
          END IF;
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "enforce_confirmed_tribunal_from_assignment"()
      RETURNS trigger AS $$
      BEGIN
        PERFORM "assert_confirmed_tribunal_member_count"(NEW."id");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER "trg_confirmed_tribunal_assignment_count"
      AFTER INSERT OR UPDATE ON "tribunal_assignments"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION "enforce_confirmed_tribunal_from_assignment"();

      CREATE OR REPLACE FUNCTION "enforce_confirmed_tribunal_from_member"()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM "assert_confirmed_tribunal_member_count"(OLD."assignment_id");
          RETURN OLD;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD."assignment_id" <> NEW."assignment_id" THEN
          PERFORM "assert_confirmed_tribunal_member_count"(OLD."assignment_id");
        END IF;

        PERFORM "assert_confirmed_tribunal_member_count"(NEW."assignment_id");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER "trg_confirmed_tribunal_member_count"
      AFTER INSERT OR UPDATE OR DELETE ON "tribunal_members"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION "enforce_confirmed_tribunal_from_member"();

      CREATE OR REPLACE FUNCTION "validate_rubric_version_activation"()
      RETURNS trigger AS $$
      DECLARE
        target_modality uuid;
        written_categories_total numeric(8,2);
        oral_categories_total numeric(8,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."status" <> 'DRAFT' THEN
          IF OLD."rubric_id" IS DISTINCT FROM NEW."rubric_id"
            OR OLD."academic_period_id" IS DISTINCT FROM NEW."academic_period_id"
            OR OLD."version" IS DISTINCT FROM NEW."version"
            OR OLD."written_max_score" IS DISTINCT FROM NEW."written_max_score"
            OR OLD."oral_max_score" IS DISTINCT FROM NEW."oral_max_score"
            OR OLD."activated_at" IS DISTINCT FROM NEW."activated_at" THEN
            RAISE EXCEPTION 'Una versión de rúbrica activa o archivada es inmutable.';
          END IF;

          IF OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED' THEN
            RAISE EXCEPTION 'Una versión de rúbrica archivada no puede reactivarse.';
          END IF;
        END IF;

        IF NEW."status" = 'ACTIVE' AND (TG_OP = 'INSERT' OR OLD."status" <> 'ACTIVE') THEN
          SELECT "modality_id" INTO target_modality
          FROM "rubrics" WHERE "id" = NEW."rubric_id";

          IF EXISTS (
            SELECT 1
            FROM "rubric_versions" existing_version
            JOIN "rubrics" existing_rubric ON existing_rubric."id" = existing_version."rubric_id"
            WHERE existing_version."status" = 'ACTIVE'
              AND existing_version."academic_period_id" = NEW."academic_period_id"
              AND existing_rubric."modality_id" = target_modality
              AND existing_version."id" <> NEW."id"
          ) THEN
            RAISE EXCEPTION 'Ya existe una versión activa para esta modalidad y período.';
          END IF;

          SELECT
            COALESCE(sum("max_score") FILTER (WHERE "stage" = 'WRITTEN'), 0),
            COALESCE(sum("max_score") FILTER (WHERE "stage" = 'ORAL'), 0)
            INTO written_categories_total, oral_categories_total
          FROM "rubric_categories"
          WHERE "rubric_version_id" = NEW."id";

          IF written_categories_total <> NEW."written_max_score"
            OR oral_categories_total <> NEW."oral_max_score" THEN
            RAISE EXCEPTION 'Las categorías no coinciden con los máximos escrito y oral de la versión.';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM "rubric_categories" category
            LEFT JOIN "rubric_indicators" indicator ON indicator."category_id" = category."id"
            WHERE category."rubric_version_id" = NEW."id"
            GROUP BY category."id", category."max_score"
            HAVING count(indicator."id") = 0 OR COALESCE(sum(indicator."max_score"), 0) <> category."max_score"
          ) THEN
            RAISE EXCEPTION 'Los indicadores no coinciden con el máximo de su categoría.';
          END IF;

          NEW."activated_at" := COALESCE(NEW."activated_at", now());
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_rubric_version_activation"
      BEFORE INSERT OR UPDATE ON "rubric_versions"
      FOR EACH ROW EXECUTE FUNCTION "validate_rubric_version_activation"();

      CREATE OR REPLACE FUNCTION "validate_work_rubric_version"()
      RETURNS trigger AS $$
      DECLARE
        selected_status rubric_version_status_enum;
        selected_modality uuid;
        selected_period uuid;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."rubric_version_id" IS NOT NULL
          AND OLD."rubric_version_id" IS DISTINCT FROM NEW."rubric_version_id" THEN
          RAISE EXCEPTION 'La versión de rúbrica fijada a un trabajo no puede reemplazarse ni retirarse.';
        END IF;

        IF NEW."rubric_version_id" IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT rv."status", r."modality_id", rv."academic_period_id"
          INTO selected_status, selected_modality, selected_period
        FROM "rubric_versions" rv
        JOIN "rubrics" r ON r."id" = rv."rubric_id"
        WHERE rv."id" = NEW."rubric_version_id";

        IF selected_status <> 'ACTIVE' THEN
          RAISE EXCEPTION 'El trabajo solo puede fijar una versión activa de rúbrica.';
        END IF;
        IF selected_modality <> NEW."modality_id" OR selected_period <> NEW."academic_period_id" THEN
          RAISE EXCEPTION 'La versión de rúbrica no corresponde a la modalidad y período del trabajo.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_work_rubric_version"
      BEFORE INSERT OR UPDATE OF "rubric_version_id", "modality_id", "academic_period_id"
      ON "thesis_works"
      FOR EACH ROW EXECUTE FUNCTION "validate_work_rubric_version"();

      CREATE OR REPLACE FUNCTION "validate_evaluation_context"()
      RETURNS trigger AS $$
      DECLARE
        bound_rubric_version uuid;
        written_max numeric(4,2);
        oral_max numeric(4,2);
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM "tribunal_members" tm
          JOIN "tribunal_assignments" ta ON ta."id" = tm."assignment_id"
          WHERE tm."id" = NEW."tribunal_member_id"
            AND ta."work_id" = NEW."work_id"
            AND ta."status" = 'CONFIRMED'
        ) THEN
          RAISE EXCEPTION 'El evaluador no pertenece al tribunal confirmado del trabajo.';
        END IF;

        IF NEW."stage" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "work_students" ws
          WHERE ws."work_id" = NEW."work_id" AND ws."student_id" = NEW."student_id"
        ) THEN
          RAISE EXCEPTION 'La evaluación oral debe corresponder a un estudiante del trabajo.';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM "work_students" ws WHERE ws."work_id" = NEW."work_id"
        ) THEN
          RAISE EXCEPTION 'El trabajo debe tener al menos un estudiante antes de ser evaluado.';
        END IF;

        IF NEW."stage" = 'ORAL' AND NOT EXISTS (
          SELECT 1 FROM "defense_schedules" ds
          WHERE ds."work_id" = NEW."work_id" AND ds."status" <> 'CANCELLED'
        ) THEN
          RAISE EXCEPTION 'La evaluación oral requiere una sustentación programada.';
        END IF;

        SELECT "rubric_version_id" INTO bound_rubric_version
        FROM "thesis_works" WHERE "id" = NEW."work_id";
        IF bound_rubric_version IS NULL OR bound_rubric_version <> NEW."rubric_version_id" THEN
          RAISE EXCEPTION 'La evaluación debe conservar la versión de rúbrica fijada al trabajo.';
        END IF;

        SELECT "written_max_score", "oral_max_score" INTO written_max, oral_max
        FROM "rubric_versions" WHERE "id" = NEW."rubric_version_id";
        IF (NEW."stage" = 'WRITTEN' AND NEW."max_score_snapshot" <> written_max)
          OR (NEW."stage" = 'ORAL' AND NEW."max_score_snapshot" <> oral_max) THEN
          RAISE EXCEPTION 'El máximo de la evaluación no coincide con la versión de rúbrica.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_evaluation_context"
      BEFORE INSERT OR UPDATE OF "work_id", "tribunal_member_id", "student_id", "rubric_version_id", "stage", "max_score_snapshot"
      ON "evaluations"
      FOR EACH ROW EXECUTE FUNCTION "validate_evaluation_context"();

      CREATE OR REPLACE FUNCTION "validate_evaluation_closure"()
      RETURNS trigger AS $$
      DECLARE
        expected_indicators integer;
        recorded_indicators integer;
        calculated_total numeric(8,2);
      BEGIN
        IF NEW."status" = 'CLOSED' AND (TG_OP = 'INSERT' OR OLD."status" <> 'CLOSED') THEN
          SELECT count(*) INTO expected_indicators
          FROM "rubric_indicators" indicator
          JOIN "rubric_categories" category ON category."id" = indicator."category_id"
          WHERE category."rubric_version_id" = NEW."rubric_version_id"
            AND category."stage" = NEW."stage";

          SELECT count(*), COALESCE(sum("score"), 0)
            INTO recorded_indicators, calculated_total
          FROM "evaluation_scores"
          WHERE "evaluation_id" = NEW."id";

          IF expected_indicators = 0 OR recorded_indicators <> expected_indicators THEN
            RAISE EXCEPTION 'No se puede cerrar una evaluación con indicadores incompletos.';
          END IF;
          IF calculated_total <> NEW."total_score" THEN
            RAISE EXCEPTION 'El total de la evaluación no coincide con sus indicadores.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_evaluation_closure"
      BEFORE INSERT OR UPDATE OF "status", "total_score" ON "evaluations"
      FOR EACH ROW EXECUTE FUNCTION "validate_evaluation_closure"();

      CREATE OR REPLACE FUNCTION "protect_closed_evaluation"()
      RETURNS trigger AS $$
      BEGIN
        IF OLD."status" = 'CLOSED' THEN
          RAISE EXCEPTION 'Una evaluación cerrada no puede modificarse ni eliminarse.';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_protect_closed_evaluation"
      BEFORE UPDATE OR DELETE ON "evaluations"
      FOR EACH ROW EXECUTE FUNCTION "protect_closed_evaluation"();

      CREATE OR REPLACE FUNCTION "protect_scores_of_closed_evaluation"()
      RETURNS trigger AS $$
      DECLARE
        target_evaluation_id uuid;
        target_status evaluation_status_enum;
        target_version_id uuid;
        target_stage evaluation_stage_enum;
        indicator_version_id uuid;
        indicator_stage evaluation_stage_enum;
        indicator_max numeric(4,2);
      BEGIN
        IF TG_OP = 'UPDATE' AND (
          OLD."evaluation_id" IS DISTINCT FROM NEW."evaluation_id" OR
          OLD."indicator_id" IS DISTINCT FROM NEW."indicator_id"
        ) THEN
          RAISE EXCEPTION 'Un puntaje no puede moverse a otra evaluación o indicador.';
        END IF;

        target_evaluation_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."evaluation_id" ELSE NEW."evaluation_id" END;
        SELECT "status", "rubric_version_id", "stage"
          INTO target_status, target_version_id, target_stage
        FROM "evaluations" WHERE "id" = target_evaluation_id;
        IF target_status = 'CLOSED' THEN
          RAISE EXCEPTION 'Los puntajes de una evaluación cerrada no pueden modificarse.';
        END IF;

        IF TG_OP <> 'DELETE' THEN
          SELECT category."rubric_version_id", category."stage", indicator."max_score"
            INTO indicator_version_id, indicator_stage, indicator_max
          FROM "rubric_indicators" indicator
          JOIN "rubric_categories" category ON category."id" = indicator."category_id"
          WHERE indicator."id" = NEW."indicator_id";

          IF indicator_version_id IS DISTINCT FROM target_version_id
            OR indicator_stage IS DISTINCT FROM target_stage THEN
            RAISE EXCEPTION 'El indicador no corresponde a la versión y etapa de la evaluación.';
          END IF;
          IF NEW."max_score_snapshot" IS DISTINCT FROM indicator_max THEN
            RAISE EXCEPTION 'El máximo capturado no coincide con el indicador de la rúbrica.';
          END IF;
        END IF;

        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_protect_scores_of_closed_evaluation"
      BEFORE INSERT OR UPDATE OR DELETE ON "evaluation_scores"
      FOR EACH ROW EXECUTE FUNCTION "protect_scores_of_closed_evaluation"();

      CREATE OR REPLACE FUNCTION "validate_defense_written_reviews"()
      RETURNS trigger AS $$
      DECLARE
        completed_reviews integer;
      BEGIN
        SELECT count(DISTINCT e."tribunal_member_id") INTO completed_reviews
        FROM "evaluations" e
        JOIN "tribunal_members" tm ON tm."id" = e."tribunal_member_id"
        JOIN "tribunal_assignments" ta ON ta."id" = tm."assignment_id"
        WHERE e."work_id" = NEW."work_id"
          AND e."stage" = 'WRITTEN'
          AND e."status" = 'CLOSED'
          AND ta."work_id" = NEW."work_id"
          AND ta."status" = 'CONFIRMED';

        IF completed_reviews <> 2 THEN
          RAISE EXCEPTION 'La sustentación requiere dos revisiones escritas cerradas.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validate_defense_written_reviews"
      BEFORE INSERT OR UPDATE OF "work_id" ON "defense_schedules"
      FOR EACH ROW EXECUTE FUNCTION "validate_defense_written_reviews"();

      CREATE OR REPLACE FUNCTION "notify_confirmed_tribunal_members"()
      RETURNS trigger AS $$
      DECLARE
        work_title text;
      BEGIN
        IF NEW."status" = 'CONFIRMED'
          AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM 'CONFIRMED') THEN
          SELECT "title" INTO work_title FROM "thesis_works" WHERE "id" = NEW."work_id";

          INSERT INTO "notifications" (
            "recipient_account_id", "work_id", "type", "title", "message", "action_path"
          )
          SELECT
            account."id",
            NEW."work_id",
            'TRIBUNAL_ASSIGNED',
            'Asignación de tribunal',
            'Ha sido asignado como miembro del tribunal del trabajo: ' || work_title,
            '/mis-evaluaciones?trabajo=' || NEW."work_id"::text
          FROM "tribunal_members" member
          JOIN "teacher_profiles" teacher ON teacher."id" = member."teacher_id"
          JOIN "user_accounts" account ON account."person_id" = teacher."person_id" AND account."is_active" = true
          WHERE member."assignment_id" = NEW."id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_notify_confirmed_tribunal_members"
      AFTER INSERT OR UPDATE ON "tribunal_assignments"
      FOR EACH ROW EXECUTE FUNCTION "notify_confirmed_tribunal_members"();

      CREATE OR REPLACE FUNCTION "notify_scheduled_defense"()
      RETURNS trigger AS $$
      DECLARE
        work_title text;
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD."scheduled_date" IS NOT DISTINCT FROM NEW."scheduled_date"
          AND OLD."scheduled_time" IS NOT DISTINCT FROM NEW."scheduled_time"
          AND OLD."room" IS NOT DISTINCT FROM NEW."room" THEN
          RETURN NEW;
        END IF;

        SELECT "title" INTO work_title FROM "thesis_works" WHERE "id" = NEW."work_id";

        INSERT INTO "notifications" (
          "recipient_account_id", "work_id", "type", "title", "message", "action_path"
        )
        SELECT
          account."id",
          NEW."work_id",
          'DEFENSE_SCHEDULED',
          'Sustentación programada',
          'Se ha programado la sustentación del trabajo ' || work_title ||
            ' para el ' || to_char(NEW."scheduled_date", 'DD/MM/YYYY') ||
            ' a las ' || to_char(NEW."scheduled_time", 'HH24:MI') ||
            ', ' || NEW."room" || '.',
          '/mis-evaluaciones?trabajo=' || NEW."work_id"::text
        FROM "tribunal_assignments" assignment
        JOIN "tribunal_members" member ON member."assignment_id" = assignment."id"
        JOIN "teacher_profiles" teacher ON teacher."id" = member."teacher_id"
        JOIN "user_accounts" account ON account."person_id" = teacher."person_id" AND account."is_active" = true
        WHERE assignment."work_id" = NEW."work_id" AND assignment."status" = 'CONFIRMED';

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_notify_scheduled_defense"
      AFTER INSERT OR UPDATE OF "scheduled_date", "scheduled_time", "room" ON "defense_schedules"
      FOR EACH ROW EXECUTE FUNCTION "notify_scheduled_defense"();

      CREATE OR REPLACE FUNCTION "assert_rubric_version_mutable"(version_uuid uuid)
      RETURNS void AS $$
      DECLARE
        version_status rubric_version_status_enum;
      BEGIN
        SELECT "status" INTO version_status FROM "rubric_versions" WHERE "id" = version_uuid;
        IF version_status IS DISTINCT FROM 'DRAFT' THEN
          RAISE EXCEPTION 'Solo una versión de rúbrica en borrador puede modificar su estructura.';
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION "protect_rubric_category_structure"()
      RETURNS trigger AS $$
      DECLARE
        version_uuid uuid;
      BEGIN
        version_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."rubric_version_id" ELSE NEW."rubric_version_id" END;
        PERFORM "assert_rubric_version_mutable"(version_uuid);
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_protect_rubric_category_structure"
      BEFORE INSERT OR UPDATE OR DELETE ON "rubric_categories"
      FOR EACH ROW EXECUTE FUNCTION "protect_rubric_category_structure"();

      CREATE OR REPLACE FUNCTION "protect_rubric_indicator_structure"()
      RETURNS trigger AS $$
      DECLARE
        category_uuid uuid;
        version_uuid uuid;
      BEGIN
        category_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."category_id" ELSE NEW."category_id" END;
        SELECT "rubric_version_id" INTO version_uuid FROM "rubric_categories" WHERE "id" = category_uuid;
        IF version_uuid IS NOT NULL THEN
          PERFORM "assert_rubric_version_mutable"(version_uuid);
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_protect_rubric_indicator_structure"
      BEFORE INSERT OR UPDATE OR DELETE ON "rubric_indicators"
      FOR EACH ROW EXECUTE FUNCTION "protect_rubric_indicator_structure"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "notifications" CASCADE;
      DROP TABLE IF EXISTS "evaluation_scores" CASCADE;
      DROP TABLE IF EXISTS "evaluations" CASCADE;
      DROP TABLE IF EXISTS "defense_schedules" CASCADE;
      DROP TABLE IF EXISTS "tribunal_members" CASCADE;
      DROP TABLE IF EXISTS "tribunal_assignments" CASCADE;
      DROP TABLE IF EXISTS "work_tutor_assignments" CASCADE;
      DROP TABLE IF EXISTS "work_students" CASCADE;
      DROP TABLE IF EXISTS "thesis_works" CASCADE;
      DROP TABLE IF EXISTS "rubric_indicators" CASCADE;
      DROP TABLE IF EXISTS "rubric_categories" CASCADE;
      DROP TABLE IF EXISTS "rubric_versions" CASCADE;
      DROP TABLE IF EXISTS "rubrics" CASCADE;
      DROP TABLE IF EXISTS "account_career_scopes" CASCADE;
      DROP TABLE IF EXISTS "account_roles" CASCADE;
      DROP TABLE IF EXISTS "roles" CASCADE;
      DROP TABLE IF EXISTS "user_accounts" CASCADE;
      DROP TABLE IF EXISTS "teacher_profiles" CASCADE;
      DROP TABLE IF EXISTS "student_profiles" CASCADE;
      DROP TABLE IF EXISTS "persons" CASCADE;
      DROP TABLE IF EXISTS "academic_periods" CASCADE;
      DROP TABLE IF EXISTS "modalities" CASCADE;
      DROP TABLE IF EXISTS "careers" CASCADE;

      DROP FUNCTION IF EXISTS "protect_rubric_indicator_structure"() CASCADE;
      DROP FUNCTION IF EXISTS "protect_rubric_category_structure"() CASCADE;
      DROP FUNCTION IF EXISTS "assert_rubric_version_mutable"(uuid) CASCADE;
      DROP FUNCTION IF EXISTS "notify_scheduled_defense"() CASCADE;
      DROP FUNCTION IF EXISTS "notify_confirmed_tribunal_members"() CASCADE;
      DROP FUNCTION IF EXISTS "validate_defense_written_reviews"() CASCADE;
      DROP FUNCTION IF EXISTS "protect_scores_of_closed_evaluation"() CASCADE;
      DROP FUNCTION IF EXISTS "protect_closed_evaluation"() CASCADE;
      DROP FUNCTION IF EXISTS "validate_evaluation_closure"() CASCADE;
      DROP FUNCTION IF EXISTS "validate_evaluation_context"() CASCADE;
      DROP FUNCTION IF EXISTS "validate_work_rubric_version"() CASCADE;
      DROP FUNCTION IF EXISTS "validate_rubric_version_activation"() CASCADE;
      DROP FUNCTION IF EXISTS "enforce_confirmed_tribunal_from_member"() CASCADE;
      DROP FUNCTION IF EXISTS "enforce_confirmed_tribunal_from_assignment"() CASCADE;
      DROP FUNCTION IF EXISTS "assert_confirmed_tribunal_member_count"(uuid) CASCADE;

      DROP TYPE IF EXISTS "notification_type_enum";
      DROP TYPE IF EXISTS "defense_status_enum";
      DROP TYPE IF EXISTS "evaluation_status_enum";
      DROP TYPE IF EXISTS "evaluation_stage_enum";
      DROP TYPE IF EXISTS "rubric_version_status_enum";
      DROP TYPE IF EXISTS "tribunal_assignment_status_enum";
      DROP TYPE IF EXISTS "work_status_enum";
      DROP TYPE IF EXISTS "directory_source_enum";
    `);
  }
}
