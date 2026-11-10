BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Ejecuta este archivo en genares_integrado_dev';
  END IF;
END
$$;

GRANT SELECT ON gen.carrera, gen.periodo_academico, s2.asignacion_tutor,
  s4.eventos_trazabilidad_trabajo, s4.versiones_rubrica_carreras,
  s4.vigencias_rubrica_carrera, s4.configuracion_nota_minima,
  s4.actas_archivadas, s4.traspasos_evaluacion_estudiante TO genares;

COMMIT;
