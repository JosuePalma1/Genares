import { MigrationInterface, QueryRunner } from 'typeorm';

export class BorradoresRubricaAuditoria1760000002000 implements MigrationInterface {
  nombre = 'BorradoresRubricaAuditoria1760000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "versiones_rubrica"
        ADD COLUMN "revision" integer NOT NULL DEFAULT 1,
        ADD CONSTRAINT "chk_versiones_rubrica_revision" CHECK ("revision" > 0);

      CREATE OR REPLACE FUNCTION "validar_revision_borrador_rubrica"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."revision" IS DISTINCT FROM OLD."revision" THEN
          IF OLD."estado" <> 'BORRADOR'
            OR NEW."estado" <> 'BORRADOR'
            OR NEW."revision" <> OLD."revision" + 1 THEN
            RAISE EXCEPTION 'La revisiÃ³n solo puede avanzar una unidad en una versiÃ³n borrador.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_validar_revision_borrador_rubrica"
      BEFORE UPDATE ON "versiones_rubrica"
      FOR EACH ROW EXECUTE FUNCTION "validar_revision_borrador_rubrica"();

      CREATE TABLE "auditoria_rubricas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" varchar(255) NOT NULL,
        "accion" varchar(64) NOT NULL,
        "rubrica_id" uuid NOT NULL,
        "version_id" uuid,
        "ocurrido_en" timestamptz NOT NULL DEFAULT now(),
        "correlation_id" varchar(100),
        CONSTRAINT "fk_auditoria_rubricas_rubrica"
          FOREIGN KEY ("rubrica_id") REFERENCES "rubricas"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_auditoria_rubricas_version"
          FOREIGN KEY ("version_id") REFERENCES "versiones_rubrica"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_auditoria_rubricas_actor"
          CHECK (btrim("actor_id") <> ''),
        CONSTRAINT "chk_auditoria_rubricas_action"
          CHECK (btrim("accion") <> '')
      );
      CREATE INDEX "idx_auditoria_rubricas_rubrica_fecha"
        ON "auditoria_rubricas" ("rubrica_id", "ocurrido_en");

      CREATE OR REPLACE FUNCTION "proteger_auditoria_rubricas_append_only"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Los eventos de auditorÃ­a son append-only.';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_auditoria_rubricas_no_update_delete"
      BEFORE UPDATE OR DELETE ON "auditoria_rubricas"
      FOR EACH ROW EXECUTE FUNCTION "proteger_auditoria_rubricas_append_only"();
      CREATE TRIGGER "trg_auditoria_rubricas_no_truncate"
      BEFORE TRUNCATE ON "auditoria_rubricas"
      FOR EACH STATEMENT EXECUTE FUNCTION "proteger_auditoria_rubricas_append_only"();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::integer AS count FROM "auditoria_rubricas"`,
    );
    if (Number(count) > 0) {
      throw new Error('No se revierte la auditorÃ­a de rÃºbricas mientras existan eventos; la migraciÃ³n protege el historial acadÃ©mico.');
    }
    await queryRunner.query(`
      DROP TABLE "auditoria_rubricas";
      DROP FUNCTION "proteger_auditoria_rubricas_append_only"();
      DROP TRIGGER "trg_validar_revision_borrador_rubrica" ON "versiones_rubrica";
      DROP FUNCTION "validar_revision_borrador_rubrica"();
      ALTER TABLE "versiones_rubrica"
        DROP CONSTRAINT "chk_versiones_rubrica_revision",
        DROP COLUMN "revision";
    `);
  }
}
