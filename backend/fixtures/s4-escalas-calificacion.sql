-- Escala final de las rúbricas y actas (10, 20 o 100) y nota mínima como porcentaje (70 % = 7/10, 14/20, 70/100).
-- Ejecútelo en pgAdmin como postgres (propietario del esquema S4):
--   - base nueva: el primero de backend/fixtures, antes de permisos-operacion-s4.sql (que ya usa «porcentaje»);
--   - base ya creada o la integrada: una vez, antes de arrancar la versión del backend que usa escalas.
-- Se puede repetir: las columnas se añaden solo si faltan y la nota mínima se convierte una sola vez (7.00 → 70.00).
-- Las rúbricas y las actas anteriores conservan la escala de 10 puntos.
BEGIN;

ALTER TABLE s4.versiones_rubrica
  ADD COLUMN IF NOT EXISTS escala_final smallint NOT NULL DEFAULT 10
    CHECK (escala_final IN (10, 20, 100));

ALTER TABLE s4.actas_archivadas
  ADD COLUMN IF NOT EXISTS escala_final smallint NOT NULL DEFAULT 10
    CHECK (escala_final IN (10, 20, 100)),
  ALTER COLUMN nota_final TYPE numeric(5,2),
  ALTER COLUMN nota_minima_aplicada TYPE numeric(5,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 's4' AND table_name = 'configuracion_nota_minima' AND column_name = 'valor'
  ) THEN
    -- Cambiar la unidad sin reescribir el historial mediante operaciones DML.
    ALTER TABLE s4.configuracion_nota_minima
      ALTER COLUMN valor TYPE numeric(5,2) USING (valor * 10);
    ALTER TABLE s4.configuracion_nota_minima RENAME COLUMN valor TO porcentaje;
    ALTER TABLE s4.configuracion_nota_minima
      ADD CONSTRAINT ck_s4_nota_minima_porcentaje CHECK (porcentaje BETWEEN 0 AND 100);

    ALTER TABLE s4.historial_nota_minima
      ALTER COLUMN valor_anterior TYPE numeric(5,2) USING (valor_anterior * 10),
      ALTER COLUMN valor_nuevo TYPE numeric(5,2) USING (valor_nuevo * 10);
    ALTER TABLE s4.historial_nota_minima RENAME COLUMN valor_anterior TO porcentaje_anterior;
    ALTER TABLE s4.historial_nota_minima RENAME COLUMN valor_nuevo TO porcentaje_nuevo;
  END IF;
END $$;

COMMIT;
