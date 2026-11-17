-- SOLO DESARROLLO: ejemplo de evaluaciones escritas CERRADAS y dos sustentaciones
-- simultáneas en AULAS DIFERENTES con tribunales distintos. Notas simuladas.
-- Bina TI: una sesión con dos participantes. Software: una sesión individual.
-- No se crean fechas reales del usuario ni datos institucionales.

-- Cada evaluador puntúa los 9 indicadores de la parte escrita (A–C, sobre 5.00). La nota de cada indicador
-- es su máximo por el factor del evaluador, redondeada a 2 decimales; el total es la suma de esas notas.
INSERT INTO s4.evaluaciones
 (id,id_proceso_evaluacion,id_asignacion_tribunal,id_version_rubrica,id_etapa_rubrica,
  etapa,estado,instantanea_rubrica,instantanea_calificacion_maxima,
  calificacion_total,cerrada_en,revision)
SELECT s4.uuid_fixture('eval-' || e.clave),
 (SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id=s4.uuid_fixture(e.asignacion)),
 s4.uuid_fixture(e.tribunal),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
 'ESCRITA','CERRADA',jsonb_build_object('rubricVersionId',s4.uuid_fixture('version-proyecto')::text,'fixture','DEV'),
 (SELECT calificacion_maxima FROM s4.etapas_rubrica WHERE id=s4.uuid_fixture('stage-written')),
 (SELECT sum(round(i.calificacion_maxima*e.factor,2)) FROM s4.indicadores_rubrica i
    JOIN s4.categorias_rubrica c ON c.id=i.id_categoria WHERE c.id_etapa_rubrica=s4.uuid_fixture('stage-written')),
 now(),1
FROM (VALUES
 ('ti1','asig-ti','at-ti1',0.82),('ti2','asig-ti','at-ti2',0.86),
 ('soft1','asig-soft','at-soft1',0.83),('soft2','asig-soft','at-soft2',0.85)
) AS e(clave,asignacion,tribunal,factor)
ON CONFLICT (id) DO NOTHING;

INSERT INTO s4.calificaciones_evaluacion
 (id,id_evaluacion,id_indicador,score,instantanea_calificacion_maxima)
SELECT s4.uuid_fixture('score-' || e.clave || '-' || i.label),s4.uuid_fixture('eval-' || e.clave),
 i.id,round(i.calificacion_maxima*e.factor,2),i.calificacion_maxima
FROM (VALUES ('ti1',0.82),('ti2',0.86),('soft1',0.83),('soft2',0.85)) AS e(clave,factor)
CROSS JOIN s4.indicadores_rubrica i
JOIN s4.categorias_rubrica c ON c.id=i.id_categoria
WHERE c.id_etapa_rubrica=s4.uuid_fixture('stage-written')
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
