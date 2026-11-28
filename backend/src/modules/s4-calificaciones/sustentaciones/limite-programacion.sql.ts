// Las carreras con cupo propio se cuentan aparte. Un límite nulo vuelve al cupo de Todas.
export const LIMITE_SIMULTANEAS_PREDETERMINADO = 2;

export const CONSULTA_LIMITE_SIMULTANEAS = `
WITH limites AS (
  SELECT DISTINCT ON (f.carrera) f.carrera,
    (to_jsonb(f)->'horario_programacion'->>'limiteSimultaneas')::int AS limite
  FROM s4.version_flujo f
  WHERE f.modalidad IS NULL AND f.periodo IS NULL
    AND to_jsonb(f)->'horario_programacion' ? 'limiteSimultaneas'
  ORDER BY f.carrera, f.version DESC
), ambito AS (
  SELECT l.carrera, COALESCE(l.limite, (SELECT limite FROM limites WHERE carrera IS NULL), $6::int) AS limite
  FROM s2.asignacion_tema a
  JOIN gen.tema t ON t.id = a.tema_id
  LEFT JOIN limites l ON l.carrera = t.carrera_id AND l.limite IS NOT NULL
  WHERE a.id = $5::uuid
), solicitado AS (
  SELECT $2::time AS inicio, $2::time + make_interval(mins => $3::int) AS fin
), cruces AS (
  SELECT GREATEST(s.hora_programada, r.inicio) AS inicio, LEAST(s.hora_fin_programada, r.fin) AS fin
  FROM s4.programaciones_sustentacion s
  JOIN s4.procesos_evaluacion p ON p.id = s.id_proceso_evaluacion
  JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
  JOIN gen.tema t ON t.id = a.tema_id
  LEFT JOIN limites l ON l.carrera = t.carrera_id AND l.limite IS NOT NULL
  CROSS JOIN solicitado r
  CROSS JOIN ambito b
  WHERE s.fecha_programada = $1::date
    AND s.hora_programada < r.fin AND r.inicio < s.hora_fin_programada
    AND s.estado_registro = 1 AND s.estado <> 'CANCELADA'
    AND ($4::uuid IS NULL OR s.id <> $4::uuid)
    AND l.carrera IS NOT DISTINCT FROM b.carrera
), marcas AS (
  SELECT inicio AS momento, 1 AS cambio FROM cruces
  UNION ALL
  SELECT fin, -1 FROM cruces
), ocupacion AS (
  -- Agrupar inicios y fines de un mismo instante permite sesiones consecutivas.
  SELECT SUM(SUM(cambio)) OVER (ORDER BY momento) AS cantidad
  FROM marcas GROUP BY momento
)
SELECT b.limite, EXISTS (SELECT 1 FROM ocupacion WHERE cantidad >= b.limite) AS "limiteAlcanzado"
FROM ambito b
`;
