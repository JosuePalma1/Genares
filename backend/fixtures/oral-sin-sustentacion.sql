BEGIN;
ALTER TABLE s4.version_flujo
  ADD COLUMN IF NOT EXISTS oral_sin_sesion boolean NOT NULL DEFAULT false;

ALTER TABLE s4.evaluaciones DROP CONSTRAINT IF EXISTS ck_s4_evaluaciones_sesion_oral;
ALTER TABLE s4.evaluaciones ADD CONSTRAINT ck_s4_evaluaciones_sesion_oral CHECK (
  CASE WHEN etapa = 'ORAL' THEN id_estudiante IS NOT NULL AND (
    id_programacion_sustentacion IS NOT NULL OR
    COALESCE(instantanea_rubrica -> 'oralSinSesion' = 'true'::jsonb, false)
  ) ELSE id_programacion_sustentacion IS NULL END
) NOT VALID;
COMMIT;
