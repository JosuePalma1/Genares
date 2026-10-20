import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoModalidades1760000004000 implements MigrationInterface {
  nombre = 'CatalogoModalidades1760000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "modalidades"
          GROUP BY lower(btrim("codigo")) HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Hay códigos de modalidad duplicados tras normalizar; se requiere revisión manual antes de migrar.';
        END IF;
        IF EXISTS (
          SELECT 1 FROM "modalidades"
          WHERE btrim("codigo") = '' OR btrim("nombre") = ''
        ) THEN
          RAISE EXCEPTION 'Hay modalidades sin código o nombre; se requiere revisión manual antes de migrar.';
        END IF;
      END $$;

      ALTER TABLE "modalidades"
        ADD COLUMN "descripcion" text,
        ADD COLUMN "revision" integer NOT NULL DEFAULT 1,
        ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT "chk_modalidades_revision" CHECK ("revision" > 0),
        ADD CONSTRAINT "chk_modalidades_texto_requerido" CHECK (
          btrim("codigo") <> '' AND btrim("nombre") <> ''
        );

      CREATE UNIQUE INDEX "uq_modalidades_codigo_normalizado"
        ON "modalidades" (lower(btrim("codigo")));

      CREATE FUNCTION "validar_actualizacion_modalidad"() RETURNS trigger AS $$
      BEGIN
        IF NEW."codigo" IS DISTINCT FROM OLD."codigo" THEN
          RAISE EXCEPTION 'El código de una modalidad existente es inmutable.';
        END IF;
        IF NEW."revision" <> OLD."revision" + 1 THEN
          RAISE EXCEPTION 'La revisión de modalidad debe avanzar una unidad.';
        END IF;
        NEW."actualizado_en" = clock_timestamp();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_validar_actualizacion_modalidad"
        BEFORE UPDATE ON "modalidades"
        FOR EACH ROW EXECUTE FUNCTION "validar_actualizacion_modalidad"();

      ALTER TABLE "auditoria_rubricas"
        ALTER COLUMN "rubrica_id" DROP NOT NULL,
        ADD COLUMN "modalidad_id" uuid,
        ADD CONSTRAINT "fk_auditoria_rubricas_modalidad"
          FOREIGN KEY ("modalidad_id") REFERENCES "modalidades"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "chk_auditoria_rubricas_entidad" CHECK (
          ("rubrica_id" IS NOT NULL AND "modalidad_id" IS NULL)
          OR ("rubrica_id" IS NULL AND "modalidad_id" IS NOT NULL AND "version_id" IS NULL)
        );
      CREATE INDEX "idx_auditoria_modalidad_fecha"
        ON "auditoria_rubricas" ("modalidad_id", "ocurrido_en");

      CREATE FUNCTION "proteger_modalidad_rubrica_con_versiones"() RETURNS trigger AS $$
      BEGIN
        IF NEW."id_modalidad" IS DISTINCT FROM OLD."id_modalidad"
          AND EXISTS (SELECT 1 FROM "versiones_rubrica" WHERE "id_rubrica" = OLD."id") THEN
          RAISE EXCEPTION 'No se puede cambiar la modalidad de una familia que ya tiene versiones.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_proteger_modalidad_rubrica_con_versiones"
        BEFORE UPDATE OF "id_modalidad" ON "rubricas"
        FOR EACH ROW EXECUTE FUNCTION "proteger_modalidad_rubrica_con_versiones"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::integer AS count FROM "auditoria_rubricas" WHERE "modalidad_id" IS NOT NULL`,
    );
    if (Number(count) > 0) {
      throw new Error('No se revierte el soporte de auditoría de modalidades mientras existan eventos; el historial se conserva.');
    }
    await queryRunner.query(`
      DROP TRIGGER "trg_proteger_modalidad_rubrica_con_versiones" ON "rubricas";
      DROP FUNCTION "proteger_modalidad_rubrica_con_versiones"();
      DROP INDEX "idx_auditoria_modalidad_fecha";
      ALTER TABLE "auditoria_rubricas"
        DROP CONSTRAINT "chk_auditoria_rubricas_entidad",
        DROP CONSTRAINT "fk_auditoria_rubricas_modalidad",
        DROP COLUMN "modalidad_id",
        ALTER COLUMN "rubrica_id" SET NOT NULL;
      DROP TRIGGER "trg_validar_actualizacion_modalidad" ON "modalidades";
      DROP FUNCTION "validar_actualizacion_modalidad"();
      DROP INDEX "uq_modalidades_codigo_normalizado";
      ALTER TABLE "modalidades"
        DROP CONSTRAINT "chk_modalidades_texto_requerido",
        DROP CONSTRAINT "chk_modalidades_revision",
        DROP COLUMN "actualizado_en",
        DROP COLUMN "creado_en",
        DROP COLUMN "revision",
        DROP COLUMN "descripcion";
    `);
  }
}
