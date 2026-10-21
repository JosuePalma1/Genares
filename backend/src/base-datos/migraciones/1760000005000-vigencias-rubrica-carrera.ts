import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registra disponibilidad histórica por carrera y vigencia temporal por
 * combinación carrera/modalidad/período. Los estados heredados de versión se
 * conservan y no se usan como sustituto de esta relación.
 */
export class VigenciasRubricaCarrera1760000005000 implements MigrationInterface {
  nombre = 'VigenciasRubricaCarrera1760000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rubricas"
        ADD CONSTRAINT "uq_rubricas_id_modalidad" UNIQUE ("id", "id_modalidad");
      ALTER TABLE "versiones_rubrica"
        ADD CONSTRAINT "uq_versiones_rubrica_id_familia" UNIQUE ("id", "id_rubrica"),
        ADD CONSTRAINT "uq_versiones_rubrica_id_contexto" UNIQUE ("id", "id_rubrica", "periodo_academico_id");

      CREATE TABLE "versiones_rubrica_carreras" (
        "id_version_rubrica" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        "id_rubrica" uuid NOT NULL,
        "id_modalidad" uuid NOT NULL,
        "periodo_academico_id" uuid NOT NULL,
        "asociado_en" timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT "pk_versiones_rubrica_carreras" PRIMARY KEY ("id_version_rubrica", "id_carrera"),
        CONSTRAINT "uq_version_rubrica_carrera_contexto"
          UNIQUE ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id"),
        CONSTRAINT "fk_version_rubrica_carrera_version_contexto"
          FOREIGN KEY ("id_version_rubrica", "id_rubrica", "periodo_academico_id")
          REFERENCES "versiones_rubrica"("id", "id_rubrica", "periodo_academico_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_version_rubrica_carrera_rubrica_modalidad"
          FOREIGN KEY ("id_rubrica", "id_modalidad")
          REFERENCES "rubricas"("id", "id_modalidad") ON DELETE RESTRICT,
        CONSTRAINT "fk_version_rubrica_carrera_carrera"
          FOREIGN KEY ("id_carrera") REFERENCES "carreras"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "idx_versiones_rubrica_carreras_carrera"
        ON "versiones_rubrica_carreras" ("id_carrera", "id_modalidad", "periodo_academico_id");
      CREATE INDEX "idx_versiones_rubrica_carreras_rubrica"
        ON "versiones_rubrica_carreras" ("id_rubrica", "id_version_rubrica");

      CREATE TABLE "vigencias_rubrica_carrera" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_version_rubrica" uuid NOT NULL,
        "id_carrera" uuid NOT NULL,
        "id_rubrica" uuid NOT NULL,
        "id_modalidad" uuid NOT NULL,
        "periodo_academico_id" uuid NOT NULL,
        "vigente_desde" timestamptz NOT NULL DEFAULT clock_timestamp(),
        "vigente_hasta" timestamptz,
        CONSTRAINT "chk_vigencia_rubrica_carrera_intervalo"
          CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" > "vigente_desde"),
        CONSTRAINT "fk_vigencia_rubrica_carrera_asociacion"
          FOREIGN KEY ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id")
          REFERENCES "versiones_rubrica_carreras"(
            "id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id"
          ) ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "uq_vigencia_rubrica_actual_carrera_modalidad_periodo"
        ON "vigencias_rubrica_carrera" ("id_carrera", "id_modalidad", "periodo_academico_id")
        WHERE "vigente_hasta" IS NULL;
      CREATE INDEX "idx_vigencias_rubrica_carrera_historial"
        ON "vigencias_rubrica_carrera" ("id_carrera", "id_modalidad", "periodo_academico_id", "vigente_desde" DESC);
      CREATE INDEX "idx_vigencias_rubrica_version_historial"
        ON "vigencias_rubrica_carrera" ("id_version_rubrica", "id_carrera", "vigente_desde" DESC);

      CREATE FUNCTION "proteger_historial_vigencia_rubrica_carrera"() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'El historial de vigencia de rúbricas no se elimina.';
        END IF;
        IF OLD."vigente_hasta" IS NOT NULL
          OR NEW."vigente_hasta" IS NULL
          OR NEW."vigente_hasta" <= OLD."vigente_desde"
          OR NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."id_version_rubrica" IS DISTINCT FROM OLD."id_version_rubrica"
          OR NEW."id_carrera" IS DISTINCT FROM OLD."id_carrera"
          OR NEW."id_rubrica" IS DISTINCT FROM OLD."id_rubrica"
          OR NEW."id_modalidad" IS DISTINCT FROM OLD."id_modalidad"
          OR NEW."periodo_academico_id" IS DISTINCT FROM OLD."periodo_academico_id"
          OR NEW."vigente_desde" IS DISTINCT FROM OLD."vigente_desde" THEN
          RAISE EXCEPTION 'Solo se permite cerrar una vigencia abierta; sus referencias son inmutables.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_historial_vigencia_rubrica_carrera"
        BEFORE UPDATE OR DELETE ON "vigencias_rubrica_carrera"
        FOR EACH ROW EXECUTE FUNCTION "proteger_historial_vigencia_rubrica_carrera"();
      CREATE FUNCTION "proteger_truncate_vigencia_rubrica_carrera"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'El historial de vigencia de rúbricas no se trunca.';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_truncate_vigencia_rubrica_carrera"
        BEFORE TRUNCATE ON "vigencias_rubrica_carrera"
        FOR EACH STATEMENT EXECUTE FUNCTION "proteger_truncate_vigencia_rubrica_carrera"();

      ALTER TABLE "auditoria_rubricas"
        ADD COLUMN "carrera_id" uuid,
        ADD COLUMN "periodo_academico_id" uuid,
        ADD COLUMN "version_anterior_id" uuid;
      ALTER TABLE "auditoria_rubricas"
        DROP CONSTRAINT "chk_auditoria_rubricas_entidad",
        ADD CONSTRAINT "fk_auditoria_rubricas_carrera"
          FOREIGN KEY ("carrera_id") REFERENCES "carreras"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_auditoria_rubricas_periodo"
          FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_auditoria_rubricas_version_familia"
          FOREIGN KEY ("version_id", "rubrica_id") REFERENCES "versiones_rubrica"("id", "id_rubrica") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_auditoria_rubricas_version_anterior_familia"
          FOREIGN KEY ("version_anterior_id", "rubrica_id") REFERENCES "versiones_rubrica"("id", "id_rubrica") ON DELETE RESTRICT,
        ADD CONSTRAINT "chk_auditoria_rubricas_entidad" CHECK (
          ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NULL AND "carrera_id" IS NULL
            AND "periodo_academico_id" IS NULL AND "version_anterior_id" IS NULL)
          OR
          ("rubrica_id" IS NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NULL
            AND "periodo_academico_id" IS NULL AND "version_id" IS NULL AND "version_anterior_id" IS NULL)
          OR
          ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NOT NULL
            AND "periodo_academico_id" IS NOT NULL AND "version_id" IS NOT NULL)
        );
      CREATE INDEX "idx_auditoria_rubricas_carrera_fecha"
        ON "auditoria_rubricas" ("carrera_id", "ocurrido_en")
        WHERE "carrera_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [asociaciones] = await queryRunner.query(
      'SELECT count(*)::int AS total FROM "versiones_rubrica_carreras"',
    ) as Array<{ total: number }>;
    const [vigencias] = await queryRunner.query(
      'SELECT count(*)::int AS total FROM "vigencias_rubrica_carrera"',
    ) as Array<{ total: number }>;
    const [eventos] = await queryRunner.query(
      'SELECT count(*)::int AS total FROM "auditoria_rubricas" WHERE "carrera_id" IS NOT NULL',
    ) as Array<{ total: number }>;
    if (Number(asociaciones.total) || Number(vigencias.total) || Number(eventos.total)) {
      throw new Error(
        'No se revierte la migración de carreras y vigencias mientras existan asociaciones o historial; se requiere una migración correctiva.',
      );
    }

    await queryRunner.query(`
      DROP INDEX "idx_auditoria_rubricas_carrera_fecha";
      ALTER TABLE "auditoria_rubricas"
        DROP CONSTRAINT "chk_auditoria_rubricas_entidad",
        DROP CONSTRAINT "fk_auditoria_rubricas_version_anterior_familia",
        DROP CONSTRAINT "fk_auditoria_rubricas_version_familia",
        DROP CONSTRAINT "fk_auditoria_rubricas_periodo",
        DROP CONSTRAINT "fk_auditoria_rubricas_carrera",
        DROP COLUMN "version_anterior_id",
        DROP COLUMN "periodo_academico_id",
        DROP COLUMN "carrera_id",
        ADD CONSTRAINT "chk_auditoria_rubricas_entidad" CHECK (
          ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NULL)
          OR ("rubrica_id" IS NULL AND "modalidad_id" IS NOT NULL AND "version_id" IS NULL)
        );
      DROP TRIGGER "trg_proteger_truncate_vigencia_rubrica_carrera" ON "vigencias_rubrica_carrera";
      DROP TRIGGER "trg_proteger_historial_vigencia_rubrica_carrera" ON "vigencias_rubrica_carrera";
      DROP FUNCTION "proteger_truncate_vigencia_rubrica_carrera"();
      DROP FUNCTION "proteger_historial_vigencia_rubrica_carrera"();
      DROP TABLE "vigencias_rubrica_carrera";
      DROP TABLE "versiones_rubrica_carreras";
      ALTER TABLE "versiones_rubrica"
        DROP CONSTRAINT "uq_versiones_rubrica_id_contexto",
        DROP CONSTRAINT "uq_versiones_rubrica_id_familia";
      ALTER TABLE "rubricas"
        DROP CONSTRAINT "uq_rubricas_id_modalidad";
    `);
  }
}
