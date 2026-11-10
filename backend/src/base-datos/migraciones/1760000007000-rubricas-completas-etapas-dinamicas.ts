import { MigrationInterface, QueryRunner } from 'typeorm';

export class RubricasCompletasEtapasDinamicas1760000007000 implements MigrationInterface {
  // PostgreSQL exige confirmar ALTER TYPE ADD VALUE antes de usar los valores nuevos.
  transaction = false;
  nombre = 'RubricasCompletasEtapasDinamicas1760000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "estado_version_rubrica_enum" ADD VALUE 'CONFIGURADA'`);
    await queryRunner.query(`ALTER TYPE "etapa_evaluacion_enum" ADD VALUE 'PERSONALIZADA'`);

    await queryRunner.query(`
      ALTER TABLE "versiones_rubrica"
        ADD COLUMN "id_version_base" uuid,
        DROP CONSTRAINT "chk_versiones_rubrica_activation",
        ADD CONSTRAINT "chk_versiones_rubrica_activation" CHECK (
          ("estado" IN ('BORRADOR', 'CONFIGURADA') AND "activada_en" IS NULL) OR
          ("estado" IN ('ACTIVA', 'ARCHIVADA') AND "activada_en" IS NOT NULL)
        ),
        ADD CONSTRAINT "fk_versiones_rubrica_base_misma_familia"
          FOREIGN KEY ("id_version_base", "id_rubrica")
          REFERENCES "versiones_rubrica"("id", "id_rubrica") ON DELETE RESTRICT;
      CREATE INDEX "idx_versiones_rubrica_base" ON "versiones_rubrica" ("id_version_base")
        WHERE "id_version_base" IS NOT NULL;

      ALTER TABLE "etapas_rubrica"
        DROP CONSTRAINT "uq_etapas_rubrica_version_kind",
        DROP CONSTRAINT "chk_etapas_rubrica_scope",
        ADD CONSTRAINT "uq_etapas_rubrica_version_code" UNIQUE ("id_version_rubrica", "codigo");

      ALTER TABLE "categorias_rubrica"
        DROP CONSTRAINT "uq_categorias_rubrica_version_code",
        DROP CONSTRAINT "uq_categorias_rubrica_version_order",
        ADD CONSTRAINT "uq_categorias_rubrica_stage_code" UNIQUE ("id_etapa_rubrica", "codigo"),
        ADD CONSTRAINT "uq_categorias_rubrica_stage_order" UNIQUE ("id_etapa_rubrica", "orden");

      CREATE OR REPLACE FUNCTION "validar_activacion_version_rubrica"()
      RETURNS trigger AS $$
      DECLARE
        target_modality uuid;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD."estado" = 'CONFIGURADA' THEN
          RAISE EXCEPTION 'Una versi\u00f3n completa es inmutable.';
        END IF;

        IF TG_OP = 'UPDATE' AND OLD."estado" <> 'BORRADOR' THEN
          IF OLD."id_rubrica" IS DISTINCT FROM NEW."id_rubrica"
            OR OLD."periodo_academico_id" IS DISTINCT FROM NEW."periodo_academico_id"
            OR OLD."version" IS DISTINCT FROM NEW."version"
            OR OLD."activada_en" IS DISTINCT FROM NEW."activada_en"
            OR OLD."id_version_base" IS DISTINCT FROM NEW."id_version_base" THEN
            RAISE EXCEPTION 'Una versi\u00f3n de r\u00fabrica activa, configurada o archivada es inmutable.';
          END IF;
          IF OLD."estado" = 'ARCHIVADA' AND NEW."estado" <> 'ARCHIVADA' THEN
            RAISE EXCEPTION 'Una versi\u00f3n de r\u00fabrica archivada no puede reactivarse.';
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
            RAISE EXCEPTION 'Ya existe una versi\u00f3n activa para esta modalidad y per\u00edodo.';
          END IF;

          IF (SELECT count(*) FROM "etapas_rubrica" WHERE "id_version_rubrica" = NEW."id") <> 2 THEN
            RAISE EXCEPTION 'La versi\u00f3n debe configurar las etapas escrita compartida y oral individual.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "etapas_rubrica" etapa
            LEFT JOIN "categorias_rubrica" categoria ON categoria."id_etapa_rubrica" = etapa."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY etapa."id", etapa."calificacion_maxima"
            HAVING count(categoria."id") = 0 OR COALESCE(sum(categoria."calificacion_maxima"), 0) <> etapa."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Las categor\u00edas no coinciden con el m\u00e1ximo configurado para su etapa.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "categorias_rubrica" categoria
            JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
            LEFT JOIN "indicadores_rubrica" indicador ON indicador."id_categoria" = categoria."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY categoria."id", categoria."calificacion_maxima"
            HAVING count(indicador."id") = 0 OR COALESCE(sum(indicador."calificacion_maxima"), 0) <> categoria."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Los indicadores no coinciden con el m\u00e1ximo de su categor\u00eda.';
          END IF;
          NEW."activada_en" := COALESCE(NEW."activada_en", now());
        ELSIF NEW."estado" = 'CONFIGURADA' AND (TG_OP = 'INSERT' OR OLD."estado" <> 'CONFIGURADA') THEN
          IF (SELECT count(*) FROM "etapas_rubrica" WHERE "id_version_rubrica" = NEW."id") < 1 THEN
            RAISE EXCEPTION 'La versi\u00f3n completa debe tener al menos una etapa.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "etapas_rubrica" etapa
            LEFT JOIN "categorias_rubrica" categoria ON categoria."id_etapa_rubrica" = etapa."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY etapa."id", etapa."calificacion_maxima", etapa."scope"
            HAVING etapa."calificacion_maxima" <> 10.00
              OR etapa."scope" <> 'ESTUDIANTE_INDIVIDUAL'
              OR count(categoria."id") = 0
              OR COALESCE(sum(categoria."calificacion_maxima"), 0) <> 10.00
          ) THEN
            RAISE EXCEPTION 'Cada etapa debe ser individual, completa y sumar exactamente 10.00 puntos.';
          END IF;
          IF EXISTS (
            SELECT 1 FROM "categorias_rubrica" categoria
            JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
            LEFT JOIN "indicadores_rubrica" indicador ON indicador."id_categoria" = categoria."id"
            WHERE etapa."id_version_rubrica" = NEW."id"
            GROUP BY categoria."id", categoria."calificacion_maxima"
            HAVING count(indicador."id") = 0
              OR COALESCE(sum(indicador."calificacion_maxima"), 0) <> categoria."calificacion_maxima"
          ) THEN
            RAISE EXCEPTION 'Los indicadores deben sumar exactamente el subtotal de su categor\u00eda.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`
      SELECT count(*)::int AS total FROM "versiones_rubrica"
      WHERE "estado" = 'CONFIGURADA' OR "id_version_base" IS NOT NULL
    `) as Array<{ total: number }>;
    const [{ codigosRepetidos }] = await queryRunner.query(`
      SELECT count(*)::int AS "codigosRepetidos" FROM (
        SELECT categoria."id_version_rubrica", categoria."codigo"
        FROM "categorias_rubrica" categoria GROUP BY 1, 2 HAVING count(*) > 1
      ) duplicados
    `) as Array<{ codigosRepetidos: number }>;
    if (Number(total) || Number(codigosRepetidos)) {
      throw new Error('No se revierte 9H.4 mientras existan versiones completas o c\u00f3digos que quedar\u00edan duplicados; use una migraci\u00f3n correctiva.');
    }

    await queryRunner.query(`
      DROP INDEX "idx_versiones_rubrica_base";
      ALTER TABLE "versiones_rubrica"
        DROP CONSTRAINT "fk_versiones_rubrica_base_misma_familia",
        DROP COLUMN "id_version_base",
        DROP CONSTRAINT "chk_versiones_rubrica_activation",
        ADD CONSTRAINT "chk_versiones_rubrica_activation" CHECK (
          ("estado" = 'BORRADOR' AND "activada_en" IS NULL) OR
          ("estado" IN ('ACTIVA', 'ARCHIVADA') AND "activada_en" IS NOT NULL)
        );
      ALTER TABLE "etapas_rubrica"
        DROP CONSTRAINT "uq_etapas_rubrica_version_code",
        ADD CONSTRAINT "uq_etapas_rubrica_version_kind" UNIQUE ("id_version_rubrica", "kind"),
        ADD CONSTRAINT "chk_etapas_rubrica_scope" CHECK (
          ("kind" = 'ESCRITA' AND "scope" = 'TRABAJO_COMPARTIDO') OR
          ("kind" = 'ORAL' AND "scope" = 'ESTUDIANTE_INDIVIDUAL')
        );
      ALTER TABLE "categorias_rubrica"
        DROP CONSTRAINT "uq_categorias_rubrica_stage_code",
        DROP CONSTRAINT "uq_categorias_rubrica_stage_order",
        ADD CONSTRAINT "uq_categorias_rubrica_version_code" UNIQUE ("id_version_rubrica", "codigo"),
        ADD CONSTRAINT "uq_categorias_rubrica_version_order" UNIQUE ("id_version_rubrica", "orden");
    `);
    // PostgreSQL no permite quitar valores enum; los dos valores nuevos quedan sin uso.
  }
}
