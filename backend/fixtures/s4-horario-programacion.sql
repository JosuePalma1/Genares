ALTER TABLE s4.version_flujo
  ADD COLUMN IF NOT EXISTS horario_programacion jsonb;
