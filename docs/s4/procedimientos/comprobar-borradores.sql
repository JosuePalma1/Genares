-- Ejecutar en pgAdmin contra genares_integrado_dev después de guardar un borrador oral.
-- SOLO CONSULTA: no cambia ningún dato.
SELECT
  t.titulo AS tema,
  e.id_estudiante,
  e.id_asignacion_tribunal,
  e.etapa,
  e.estado,
  e.revision,
  e.calificacion_total,
  e.actualizado_en,
  COUNT(ce.id) AS indicadores_guardados
FROM s4.evaluaciones e
JOIN s4.procesos_evaluacion p ON p.id = e.id_proceso_evaluacion
JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
JOIN gen.tema t ON t.id = a.tema_id
LEFT JOIN s4.calificaciones_evaluacion ce ON ce.id_evaluacion = e.id
WHERE e.etapa = 'ORAL'
GROUP BY t.titulo, e.id, e.id_estudiante, e.id_asignacion_tribunal,
         e.etapa, e.estado, e.revision, e.calificacion_total, e.actualizado_en
ORDER BY t.titulo, e.actualizado_en;
