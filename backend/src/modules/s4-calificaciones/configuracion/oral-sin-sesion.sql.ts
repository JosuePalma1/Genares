// El alias t corresponde al tema de la asignacion evaluada.
export const ORAL_SIN_SESION_VIGENTE_SQL = `COALESCE((
  SELECT (to_jsonb(f)->>'oral_sin_sesion')::boolean
  FROM s4.version_flujo f
  WHERE (f.carrera IS NULL OR f.carrera = t.carrera_id)
    AND (f.modalidad IS NULL OR f.modalidad = t.modalidad_id)
    AND (f.periodo IS NULL OR f.periodo = t.periodo_academico_id)
  ORDER BY num_nonnulls(f.carrera, f.modalidad, f.periodo) DESC, f.version DESC
  LIMIT 1
), false)`;
