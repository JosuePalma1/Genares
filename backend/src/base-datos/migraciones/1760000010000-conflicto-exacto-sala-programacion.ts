import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConflictoExactoSalaProgramacion1760000010000 implements MigrationInterface {
  nombre = 'ConflictoExactoSalaProgramacion1760000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "programaciones_sustentacion"
          WHERE "estado" <> 'CANCELADA'
          GROUP BY "fecha_programada", "hora_programada", lower(btrim("sala"))
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Existen programaciones vigentes de la misma sala con idéntica fecha y hora; resuélvalas antes de aplicar la migración.';
        END IF;
      END $$;

      CREATE UNIQUE INDEX "uq_programaciones_sustentacion_sala_instante_vigente"
        ON "programaciones_sustentacion" (
          "fecha_programada", "hora_programada", lower(btrim("sala"))
        )
        WHERE "estado" <> 'CANCELADA';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_programaciones_sustentacion_sala_instante_vigente";`);
  }
}
