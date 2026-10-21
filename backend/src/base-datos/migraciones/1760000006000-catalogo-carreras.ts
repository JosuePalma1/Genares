import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoCarreras1760000006000 implements MigrationInterface {
  nombre = 'CatalogoCarreras1760000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM "carreras" GROUP BY lower(btrim("codigo")) HAVING count(*) > 1) THEN
          RAISE EXCEPTION 'Hay códigos de carrera duplicados tras normalizar; revise los datos antes de migrar.';
        END IF;
        IF EXISTS (SELECT 1 FROM "carreras" WHERE btrim("codigo") = '' OR btrim("nombre") = '') THEN
          RAISE EXCEPTION 'Hay carreras sin código o nombre; revise los datos antes de migrar.';
        END IF;
      END $$;

      ALTER TABLE "carreras"
        ADD COLUMN "revision" integer NOT NULL DEFAULT 1,
        ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT "chk_carreras_revision" CHECK ("revision" > 0),
        ADD CONSTRAINT "chk_carreras_texto_requerido" CHECK (btrim("codigo") <> '' AND btrim("nombre") <> '');
      CREATE UNIQUE INDEX "uq_carreras_codigo_normalizado" ON "carreras" (lower(btrim("codigo")));

      CREATE FUNCTION "validar_actualizacion_carrera"() RETURNS trigger AS $$
      BEGIN
        IF NEW."codigo" IS DISTINCT FROM OLD."codigo" THEN
          RAISE EXCEPTION 'El código de una carrera existente es inmutable.';
        END IF;
        IF NEW."revision" <> OLD."revision" + 1 THEN
          RAISE EXCEPTION 'La revisión de carrera debe avanzar una unidad.';
        END IF;
        NEW."actualizado_en" = clock_timestamp();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_actualizacion_carrera"
        BEFORE UPDATE ON "carreras" FOR EACH ROW EXECUTE FUNCTION "validar_actualizacion_carrera"();

      ALTER TABLE "auditoria_rubricas" DROP CONSTRAINT "chk_auditoria_rubricas_entidad";
      ALTER TABLE "auditoria_rubricas" ADD CONSTRAINT "chk_auditoria_rubricas_entidad" CHECK (
        ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NULL AND "carrera_id" IS NULL
          AND "periodo_academico_id" IS NULL AND "version_anterior_id" IS NULL)
        OR ("rubrica_id" IS NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NULL
          AND "periodo_academico_id" IS NULL AND "version_id" IS NULL AND "version_anterior_id" IS NULL)
        OR ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NOT NULL
          AND "periodo_academico_id" IS NOT NULL AND "version_id" IS NOT NULL)
        OR ("rubrica_id" IS NULL AND "modalidad_id" IS NULL AND "carrera_id" IS NOT NULL
          AND "periodo_academico_id" IS NULL AND "version_id" IS NULL AND "version_anterior_id" IS NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`
      SELECT count(*)::int AS total FROM "auditoria_rubricas"
      WHERE "carrera_id" IS NOT NULL AND "rubrica_id" IS NULL AND "modalidad_id" IS NULL
    `) as Array<{ total: number }>;
    if (Number(total) > 0) {
      throw new Error('No se revierte el catálogo de carreras con auditoría histórica; se requiere una migración correctiva.');
    }
    const [{ carreras }] = await queryRunner.query('SELECT count(*)::int AS carreras FROM "carreras"') as Array<{ carreras: number }>;
    if (Number(carreras) > 0) {
      throw new Error('No se eliminan revisiones ni fechas de carreras existentes; se requiere una migración correctiva.');
    }
    await queryRunner.query(`
      ALTER TABLE "auditoria_rubricas" DROP CONSTRAINT "chk_auditoria_rubricas_entidad";
      ALTER TABLE "auditoria_rubricas" ADD CONSTRAINT "chk_auditoria_rubricas_entidad" CHECK (
        ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NULL AND "carrera_id" IS NULL
          AND "periodo_academico_id" IS NULL AND "version_anterior_id" IS NULL)
        OR ("rubrica_id" IS NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NULL
          AND "periodo_academico_id" IS NULL AND "version_id" IS NULL AND "version_anterior_id" IS NULL)
        OR ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NOT NULL AND "carrera_id" IS NOT NULL
          AND "periodo_academico_id" IS NOT NULL AND "version_id" IS NOT NULL)
      );
      DROP TRIGGER "trg_validar_actualizacion_carrera" ON "carreras";
      DROP FUNCTION "validar_actualizacion_carrera"();
      DROP INDEX "uq_carreras_codigo_normalizado";
      ALTER TABLE "carreras"
        DROP CONSTRAINT "chk_carreras_texto_requerido",
        DROP CONSTRAINT "chk_carreras_revision",
        DROP COLUMN "actualizado_en",
        DROP COLUMN "creado_en",
        DROP COLUMN "revision";
    `);
  }
}
