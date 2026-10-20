import { MigrationInterface, QueryRunner } from 'typeorm';

/** Un grupo vacío tiene subtotal cero; solamente puede persistir dentro de un borrador. */
export class GruposVaciosBorrador1760000003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categorias_rubrica" DROP CONSTRAINT "chk_categorias_rubrica_values";
      ALTER TABLE "categorias_rubrica" ADD CONSTRAINT "chk_categorias_rubrica_values"
        CHECK ("calificacion_maxima" >= 0 AND "orden" > 0);
      ALTER TABLE "etapas_rubrica" DROP CONSTRAINT "chk_etapas_rubrica_values";
      ALTER TABLE "etapas_rubrica" ADD CONSTRAINT "chk_etapas_rubrica_values"
        CHECK ("calificacion_maxima" >= 0 AND "orden" > 0 AND
          ("porcentaje" IS NULL OR ("porcentaje" > 0 AND "porcentaje" <= 100)));

      CREATE FUNCTION "proteger_maximo_cero_borrador"() RETURNS trigger AS $$
      BEGIN
        IF NEW."calificacion_maxima" = 0 AND NOT EXISTS (
          SELECT 1 FROM "versiones_rubrica" WHERE "id" = NEW."id_version_rubrica" AND "estado" = 'BORRADOR'
        ) THEN
          RAISE EXCEPTION 'El subtotal cero solamente se admite en grupos de un borrador.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_maximo_cero_etapa_borrador" BEFORE INSERT OR UPDATE ON "etapas_rubrica"
        FOR EACH ROW EXECUTE FUNCTION "proteger_maximo_cero_borrador"();
      CREATE TRIGGER "trg_maximo_cero_categoria_borrador" BEFORE INSERT OR UPDATE ON "categorias_rubrica"
        FOR EACH ROW EXECUTE FUNCTION "proteger_maximo_cero_borrador"();

      CREATE FUNCTION "proteger_activacion_subtotales_cero"() RETURNS trigger AS $$
      BEGIN
        IF NEW."estado" <> 'BORRADOR' AND (
          EXISTS (SELECT 1 FROM "etapas_rubrica" WHERE "id_version_rubrica" = NEW."id" AND "calificacion_maxima" = 0)
          OR EXISTS (SELECT 1 FROM "categorias_rubrica" WHERE "id_version_rubrica" = NEW."id" AND "calificacion_maxima" = 0)
        ) THEN
          RAISE EXCEPTION 'Una versión activa o histórica no puede contener subtotales cero.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_activacion_subtotales_cero" BEFORE INSERT OR UPDATE ON "versiones_rubrica"
        FOR EACH ROW EXECUTE FUNCTION "proteger_activacion_subtotales_cero"();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [fila] = await queryRunner.query(`SELECT
      EXISTS (SELECT 1 FROM "etapas_rubrica" WHERE "calificacion_maxima" = 0)
      OR EXISTS (SELECT 1 FROM "categorias_rubrica" WHERE "calificacion_maxima" = 0) AS "hayCeros"`);
    if (fila.hayCeros) throw new Error('Existen grupos vacíos en borradores; no se revierten restricciones ni se eliminan datos.');
    await queryRunner.query(`
      DROP TRIGGER "trg_activacion_subtotales_cero" ON "versiones_rubrica";
      DROP FUNCTION "proteger_activacion_subtotales_cero"();
      DROP TRIGGER "trg_maximo_cero_categoria_borrador" ON "categorias_rubrica";
      DROP TRIGGER "trg_maximo_cero_etapa_borrador" ON "etapas_rubrica";
      DROP FUNCTION "proteger_maximo_cero_borrador"();
      ALTER TABLE "categorias_rubrica" DROP CONSTRAINT "chk_categorias_rubrica_values";
      ALTER TABLE "categorias_rubrica" ADD CONSTRAINT "chk_categorias_rubrica_values"
        CHECK ("calificacion_maxima" > 0 AND "orden" > 0);
      ALTER TABLE "etapas_rubrica" DROP CONSTRAINT "chk_etapas_rubrica_values";
      ALTER TABLE "etapas_rubrica" ADD CONSTRAINT "chk_etapas_rubrica_values"
        CHECK ("calificacion_maxima" > 0 AND "orden" > 0 AND
          ("porcentaje" IS NULL OR ("porcentaje" > 0 AND "porcentaje" <= 100)));
    `);
  }
}
