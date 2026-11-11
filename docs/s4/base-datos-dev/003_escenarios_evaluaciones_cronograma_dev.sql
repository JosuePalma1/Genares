-- SOLO DESARROLLO: ejemplo de evaluaciones escritas CERRADAS y dos sustentaciones
-- simultáneas en AULAS DIFERENTES con tribunales distintos. Notas simuladas.
-- Bina TI: una sesión con dos participantes. Software: una sesión individual.
-- No se crean fechas reales del usuario ni datos institucionales.

INSERT INTO s4.evaluaciones
 (id,id_proceso_evaluacion,id_asignacion_tribunal,id_version_rubrica,id_etapa_rubrica,
  etapa,estado,instantanea_rubrica,instantanea_calificacion_maxima,
  calificacion_total,cerrada_en,revision)
VALUES
(s4.uuid_fixture('eval-ti1'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-ti')),
 s4.uuid_fixture('at-ti1'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
 'ESCRITA','CERRADA',jsonb_build_object('rubricVersionId',s4.uuid_fixture('version-proyecto')::text,'fixture','DEV'),10.00,8.20,now(),1),
(s4.uuid_fixture('eval-ti2'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-ti')),
 s4.uuid_fixture('at-ti2'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
 'ESCRITA','CERRADA',jsonb_build_object('rubricVersionId',s4.uuid_fixture('version-proyecto')::text,'fixture','DEV'),10.00,8.60,now(),1),
(s4.uuid_fixture('eval-soft1'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-soft')),
 s4.uuid_fixture('at-soft1'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
 'ESCRITA','CERRADA',jsonb_build_object('rubricVersionId',s4.uuid_fixture('version-proyecto')::text,'fixture','DEV'),10.00,8.30,now(),1),
(s4.uuid_fixture('eval-soft2'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-soft')),
 s4.uuid_fixture('at-soft2'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
 'ESCRITA','CERRADA',jsonb_build_object('rubricVersionId',s4.uuid_fixture('version-proyecto')::text,'fixture','DEV'),10.00,8.50,now(),1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO s4.calificaciones_evaluacion
 (id,id_evaluacion,id_indicador,score,instantanea_calificacion_maxima)
VALUES
(s4.uuid_fixture('score-ti1'),s4.uuid_fixture('eval-ti1'),s4.uuid_fixture('ind-written'),8.20,10.00),
(s4.uuid_fixture('score-ti2'),s4.uuid_fixture('eval-ti2'),s4.uuid_fixture('ind-written'),8.60,10.00),
(s4.uuid_fixture('score-soft1'),s4.uuid_fixture('eval-soft1'),s4.uuid_fixture('ind-written'),8.30,10.00),
(s4.uuid_fixture('score-soft2'),s4.uuid_fixture('eval-soft2'),s4.uuid_fixture('ind-written'),8.50,10.00)
ON CONFLICT (id) DO NOTHING;

-- Dos sustentaciones el mismo día y hora: correcto porque aulas y docentes difieren.
INSERT INTO s4.programaciones_sustentacion
 (id,id_proceso_evaluacion,fecha_programada,hora_programada,hora_fin_programada,
  sala,estado,tipo,scheduled_by_id_cuenta,scheduled_by_actor_id)
VALUES
(s4.uuid_fixture('sesion-ti'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-ti')),
 DATE '2026-12-15',TIME '09:00',TIME '10:00','DEV-AULA-101','PROGRAMADA','CONJUNTA',
 s4.uuid_fixture('usuario-comision'),'dev-comision'),
(s4.uuid_fixture('sesion-soft'),(SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture('asig-soft')),
 DATE '2026-12-15',TIME '09:00',TIME '10:00','DEV-AULA-102','PROGRAMADA','INDIVIDUAL',
 s4.uuid_fixture('usuario-comision'),'dev-comision')
ON CONFLICT (id) DO NOTHING;

INSERT INTO s4.programacion_estudiante
 (programacion_estudiante_id,programacion_sustentacion_id,id_estudiante)
VALUES
(s4.uuid_fixture('pe-ti1'),s4.uuid_fixture('sesion-ti'),s4.uuid_fixture('est-ti1')),
(s4.uuid_fixture('pe-ti2'),s4.uuid_fixture('sesion-ti'),s4.uuid_fixture('est-ti2')),
(s4.uuid_fixture('pe-soft'),s4.uuid_fixture('sesion-soft'),s4.uuid_fixture('est-soft'))
ON CONFLICT (programacion_estudiante_id) DO NOTHING;
