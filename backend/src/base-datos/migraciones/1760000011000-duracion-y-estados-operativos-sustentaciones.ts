import { MigrationInterface, QueryRunner } from 'typeorm';

export class DuracionYEstadosOperativosSustentaciones1760000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // El índice de 10.7B.1 sigue siendo un resguardo para inicios idénticos. El
    // servicio añade la comprobación de intervalos bajo advisory lock transaccional.
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_programaciones_sustentacion_sala_instante_vigente";

      ALTER TABLE "programaciones_sustentacion"
        ADD COLUMN "duracion_estimada_minutos" smallint NOT NULL DEFAULT 60,
        ADD COLUMN "inicio_real_en" timestamptz NULL,
        ADD COLUMN "finalizacion_real_en" timestamptz NULL,
        ADD CONSTRAINT "chk_programaciones_sustentacion_duracion_estimada"
          CHECK ("duracion_estimada_minutos" BETWEEN 1 AND 240);

      ALTER TABLE "programaciones_sustentacion" ALTER COLUMN "estado" DROP DEFAULT;
      CREATE TYPE "estado_sustentacion_enum_10_7b2" AS ENUM (
        'PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA', 'CANCELADA'
      );
      ALTER TABLE "programaciones_sustentacion"
        ALTER COLUMN "estado" TYPE "estado_sustentacion_enum_10_7b2"
        USING (
          CASE "estado"::text
            WHEN 'COMPLETADA' THEN 'FINALIZADA'
            ELSE "estado"::text
          END
        )::"estado_sustentacion_enum_10_7b2";
      DROP TYPE "estado_sustentacion_enum";
      ALTER TYPE "estado_sustentacion_enum_10_7b2" RENAME TO "estado_sustentacion_enum";
      ALTER TABLE "programaciones_sustentacion"
        ALTER COLUMN "estado" SET DEFAULT 'PROGRAMADA';
    `);

    const [conflicto] = await queryRunner.query(`
      SELECT a."id" AS "id_a", b."id" AS "id_b"
      FROM "programaciones_sustentacion" a
      JOIN "programaciones_sustentacion" b
        ON a."id" < b."id"
       AND lower(btrim(a."sala")) = lower(btrim(b."sala"))
       AND a."estado" <> 'CANCELADA'
       AND b."estado" <> 'CANCELADA'
       AND a."fecha_programada" + a."hora_programada"
             < b."fecha_programada" + b."hora_programada"
                 + make_interval(mins => b."duracion_estimada_minutos")
       AND b."fecha_programada" + b."hora_programada"
             < a."fecha_programada" + a."hora_programada"
                 + make_interval(mins => a."duracion_estimada_minutos")
      LIMIT 1
    `) as Array<{ id_a: string; id_b: string }>;
    if (conflicto) {
      throw new Error(
        `No se puede aplicar 10.7B.2: las programaciones ${conflicto.id_a} y ${conflicto.id_b} se solapan en la misma sala. Resuelva el horario manualmente antes de migrar.`,
      );
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_programaciones_sustentacion_sala_instante_vigente"
        ON "programaciones_sustentacion" (
          "fecha_programada", "hora_programada", lower(btrim("sala"))
        )
        WHERE "estado" <> 'CANCELADA';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [enCurso] = await queryRunner.query(`
      SELECT "id" FROM "programaciones_sustentacion"
      WHERE "estado" = 'EN_SUSTENTACION' LIMIT 1
    `) as Array<{ id: string }>;
    if (enCurso) {
      throw new Error(`No se puede revertir 10.7B.2 mientras exista una sustentación en curso (${enCurso.id}).`);
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_programaciones_sustentacion_sala_instante_vigente";
      ALTER TABLE "programaciones_sustentacion" ALTER COLUMN "estado" DROP DEFAULT;
      CREATE TYPE "estado_sustentacion_enum_pre_10_7b2" AS ENUM (
        'PROGRAMADA', 'COMPLETADA', 'CANCELADA'
      );
      ALTER TABLE "programaciones_sustentacion"
        ALTER COLUMN "estado" TYPE "estado_sustentacion_enum_pre_10_7b2"
        USING (
          CASE "estado"::text
            WHEN 'FINALIZADA' THEN 'COMPLETADA'
            ELSE "estado"::text
          END
        )::"estado_sustentacion_enum_pre_10_7b2";
      DROP TYPE "estado_sustentacion_enum";
      ALTER TYPE "estado_sustentacion_enum_pre_10_7b2" RENAME TO "estado_sustentacion_enum";
      ALTER TABLE "programaciones_sustentacion"
        ALTER COLUMN "estado" SET DEFAULT 'PROGRAMADA',
        DROP CONSTRAINT IF EXISTS "chk_programaciones_sustentacion_duracion_estimada",
        DROP COLUMN IF EXISTS "duracion_estimada_minutos",
        DROP COLUMN IF EXISTS "inicio_real_en",
        DROP COLUMN IF EXISTS "finalizacion_real_en";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_programaciones_sustentacion_sala_instante_vigente"
        ON "programaciones_sustentacion" (
          "fecha_programada", "hora_programada", lower(btrim("sala"))
        )
        WHERE "estado" <> 'CANCELADA';
    `);
  }
}
