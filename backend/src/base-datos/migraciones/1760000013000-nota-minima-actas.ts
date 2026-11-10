import { MigrationInterface, QueryRunner } from 'typeorm';

/** Conserva el umbral usado por cada documento y audita su configuración vigente. */
export class NotaMinimaActas1760000013000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE actas_archivadas
        ADD COLUMN nota_final numeric(4,2),
        ADD COLUMN nota_minima_aplicada numeric(4,2),
        ADD COLUMN aprobado boolean,
        ADD CONSTRAINT acta_resultado_interno_valido CHECK (
          (nota_final IS NULL AND nota_minima_aplicada IS NULL AND aprobado IS NULL)
          OR (
            nota_final IS NOT NULL
            AND nota_minima_aplicada IS NOT NULL
            AND aprobado IS NOT NULL
            AND nota_final BETWEEN 0 AND 10
            AND nota_minima_aplicada BETWEEN 0 AND 10
            AND aprobado = (nota_final >= nota_minima_aplicada)
          )
        );

      CREATE TABLE configuracion_nota_minima (
        id smallint PRIMARY KEY CHECK (id = 1),
        valor numeric(4,2) NOT NULL CHECK (valor BETWEEN 0 AND 10),
        actualizado_en timestamptz NOT NULL DEFAULT now(),
        actualizado_por varchar(255) NOT NULL
      );
      CREATE TABLE historial_nota_minima (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        valor_anterior numeric(4,2),
        valor_nuevo numeric(4,2) NOT NULL CHECK (valor_nuevo BETWEEN 0 AND 10),
        CONSTRAINT ck_historial_nota_minima_anterior CHECK (valor_anterior IS NULL OR valor_anterior BETWEEN 0 AND 10),
        cambiado_en timestamptz NOT NULL DEFAULT now(),
        cambiado_por varchar(255) NOT NULL
      );
      CREATE FUNCTION proteger_historial_nota_minima() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'El historial de umbrales académicos es inmutable' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER historial_nota_minima_inmutable BEFORE UPDATE OR DELETE ON historial_nota_minima
        FOR EACH ROW EXECUTE FUNCTION proteger_historial_nota_minima();
      CREATE TRIGGER historial_nota_minima_no_truncar BEFORE TRUNCATE ON historial_nota_minima
        FOR EACH STATEMENT EXECUTE FUNCTION proteger_historial_nota_minima();

      INSERT INTO configuracion_nota_minima(id, valor, actualizado_por) VALUES (1, 7.00, 'sistema:valor-inicial');
      INSERT INTO historial_nota_minima(valor_anterior, valor_nuevo, cambiado_por)
        VALUES (NULL, 7.00, 'sistema:valor-inicial');
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM actas_archivadas WHERE nota_final IS NOT NULL)
        OR (SELECT count(*) FROM historial_nota_minima) > 1 THEN
        RAISE EXCEPTION 'No se puede revertir un umbral o resultado académico utilizado';
      END IF;
    END $$`);
    await q.query(`DROP TRIGGER historial_nota_minima_inmutable ON historial_nota_minima;
      DROP TRIGGER historial_nota_minima_no_truncar ON historial_nota_minima;
      DROP FUNCTION proteger_historial_nota_minima();
      DROP TABLE historial_nota_minima;
      DROP TABLE configuracion_nota_minima;
      ALTER TABLE actas_archivadas DROP CONSTRAINT acta_resultado_interno_valido,
        DROP COLUMN nota_final, DROP COLUMN nota_minima_aplicada, DROP COLUMN aprobado;`);
  }
}
