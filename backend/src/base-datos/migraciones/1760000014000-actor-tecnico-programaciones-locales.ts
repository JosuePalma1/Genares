import { MigrationInterface, QueryRunner } from 'typeorm';

/** Conserva las cuentas históricas y permite atribuir nuevas programaciones del entorno local al actor técnico. */
export class ActorTecnicoProgramacionesLocales1760000014000 implements MigrationInterface {
  name = 'ActorTecnicoProgramacionesLocales1760000014000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "programaciones_sustentacion"
        ALTER COLUMN "scheduled_by_id_cuenta" DROP NOT NULL,
        ADD COLUMN "scheduled_by_actor_id" varchar(255),
        ADD CONSTRAINT "chk_programacion_actor_or_cuenta"
          CHECK (num_nonnulls("scheduled_by_id_cuenta", "scheduled_by_actor_id") = 1);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" WHERE "scheduled_by_actor_id" IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Hay programaciones atribuidas al actor técnico; no se puede revertir sin perder su auditoría.';
        END IF;
      END $$;
      ALTER TABLE "programaciones_sustentacion"
        DROP CONSTRAINT "chk_programacion_actor_or_cuenta",
        DROP COLUMN "scheduled_by_actor_id",
        ALTER COLUMN "scheduled_by_id_cuenta" SET NOT NULL;
    `);
  }
}
