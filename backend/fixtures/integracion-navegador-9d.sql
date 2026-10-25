-- Solo para una base nueva genares_9d_test_<uuid> marcada desechable.
-- Los eventos de trazabilidad se generan por los triggers de PostgreSQL.
BEGIN;

INSERT INTO carreras (id, codigo, nombre) VALUES
  ('11000000-0000-4000-8000-000000000001', 'TI', 'Tecnologías de la Información');
INSERT INTO modalidades (id, codigo, nombre) VALUES
  ('11000000-0000-4000-8000-000000000002', 'PROYECTO_INTEGRADOR', 'Proyecto integrador');
INSERT INTO periodos_academicos (id, codigo, fecha_inicio, fecha_fin) VALUES
  ('11000000-0000-4000-8000-000000000003', '2026-2', DATE '2026-08-01', DATE '2027-02-28');

INSERT INTO personas (id, identificacion_nacional, nombres, surnames) VALUES
  ('11000000-0000-4000-8000-000000000010', 'DEMO-9D-ADMIN', 'Cuenta', 'de preparación'),
  ('11000000-0000-4000-8000-000000000011', 'DEMO-9D-TUTOR', 'Tutor', 'de ejemplo'),
  ('11000000-0000-4000-8000-000000000012', 'DEMO-9D-JURADO-1', 'Jurada', 'uno de ejemplo'),
  ('11000000-0000-4000-8000-000000000013', 'DEMO-9D-JURADO-2', 'Jurado', 'dos de ejemplo'),
  ('11000000-0000-4000-8000-000000000014', 'DEMO-9D-ESTUDIANTE-1', 'Estudiante', 'de ejemplo');
INSERT INTO cuentas_usuario (id, id_persona, sujeto_autenticacion) VALUES
  ('11000000-0000-4000-8000-000000000020', '11000000-0000-4000-8000-000000000010', 'fixture-integracion-9d');
INSERT INTO perfiles_docente (id, id_persona, id_carrera) VALUES
  ('11000000-0000-4000-8000-000000000021', '11000000-0000-4000-8000-000000000011', '11000000-0000-4000-8000-000000000001'),
  ('11000000-0000-4000-8000-000000000022', '11000000-0000-4000-8000-000000000012', '11000000-0000-4000-8000-000000000001'),
  ('11000000-0000-4000-8000-000000000023', '11000000-0000-4000-8000-000000000013', '11000000-0000-4000-8000-000000000001');
INSERT INTO perfiles_estudiante (id, id_persona, id_carrera) VALUES
  ('11000000-0000-4000-8000-000000000024', '11000000-0000-4000-8000-000000000014', '11000000-0000-4000-8000-000000000001');

INSERT INTO rubricas (id, id_modalidad, nombre, descripcion) VALUES
  ('11000000-0000-4000-8000-000000000030', '11000000-0000-4000-8000-000000000002', 'Rúbrica de integración 9D', 'Fixture sintético para verificar consultas API.');
INSERT INTO versiones_rubrica (id, id_rubrica, periodo_academico_id, version) VALUES
  ('11000000-0000-4000-8000-000000000031', '11000000-0000-4000-8000-000000000030', '11000000-0000-4000-8000-000000000003', '9D-LECTURA-1');
INSERT INTO etapas_rubrica (
  id, id_version_rubrica, kind, scope, codigo, nombre, descripcion, calificacion_maxima, porcentaje, orden
) VALUES
  ('11000000-0000-4000-8000-000000000032', '11000000-0000-4000-8000-000000000031', 'ESCRITA', 'TRABAJO_COMPARTIDO', 'ESCRITA', 'Evaluación escrita', 'Calificación compartida del trabajo.', 10.00, 50.00, 1),
  ('11000000-0000-4000-8000-000000000033', '11000000-0000-4000-8000-000000000031', 'ORAL', 'ESTUDIANTE_INDIVIDUAL', 'ORAL', 'Sustentación oral', 'Calificación individual del estudiante.', 10.00, 50.00, 2);
INSERT INTO categorias_rubrica (id, id_version_rubrica, id_etapa_rubrica, codigo, nombre, calificacion_maxima, orden) VALUES
  ('11000000-0000-4000-8000-000000000034', '11000000-0000-4000-8000-000000000031', '11000000-0000-4000-8000-000000000032', 'ESC', 'Componente escrito', 10.00, 1),
  ('11000000-0000-4000-8000-000000000035', '11000000-0000-4000-8000-000000000031', '11000000-0000-4000-8000-000000000033', 'ORA', 'Componente oral', 10.00, 2);
INSERT INTO indicadores_rubrica (id, id_categoria, label, descripcion, calificacion_maxima, orden) VALUES
  ('11000000-0000-4000-8000-000000000036', '11000000-0000-4000-8000-000000000034', 'ESC-1', 'Claridad y desarrollo del trabajo.', 10.00, 1),
  ('11000000-0000-4000-8000-000000000037', '11000000-0000-4000-8000-000000000035', 'ORA-1', 'Dominio de la sustentación.', 10.00, 1);
INSERT INTO versiones_rubrica_carreras (
  id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id
) VALUES (
  '11000000-0000-4000-8000-000000000031', '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000030', '11000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000003'
);
INSERT INTO vigencias_rubrica_carrera (
  id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id
) VALUES (
  '11000000-0000-4000-8000-000000000031', '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000030', '11000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000003'
);
UPDATE versiones_rubrica
SET estado = 'ACTIVA', activada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000031';

INSERT INTO trabajos_titulacion (
  id, codigo, titulo, id_modalidad, periodo_academico_id, id_carrera, id_version_rubrica,
  estado, created_by_id_cuenta
) VALUES (
  '11000000-0000-4000-8000-000000000040', 'DEMO-9D-001',
  'Estrategia digital para servicios académicos',
  '11000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000003',
  '11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000031',
  'REGISTRADO', '11000000-0000-4000-8000-000000000020'
);
INSERT INTO estudiantes_trabajo (id, id_trabajo, id_estudiante, orden_autoria) VALUES
  ('11000000-0000-4000-8000-000000000041', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000024', 1);
INSERT INTO asignaciones_tutor_trabajo (id, id_trabajo, id_docente, assigned_by_id_cuenta) VALUES
  ('11000000-0000-4000-8000-000000000042', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000021', '11000000-0000-4000-8000-000000000020');
INSERT INTO asignaciones_tribunal (id, id_trabajo, estado, assigned_by_id_cuenta) VALUES
  ('11000000-0000-4000-8000-000000000043', '11000000-0000-4000-8000-000000000040', 'BORRADOR', '11000000-0000-4000-8000-000000000020');
INSERT INTO miembros_tribunal (id, id_asignacion, id_docente, position) VALUES
  ('11000000-0000-4000-8000-000000000044', '11000000-0000-4000-8000-000000000043', '11000000-0000-4000-8000-000000000022', 1),
  ('11000000-0000-4000-8000-000000000045', '11000000-0000-4000-8000-000000000043', '11000000-0000-4000-8000-000000000023', 2);
UPDATE asignaciones_tribunal
SET estado = 'CONFIRMADO', confirmada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000043';
-- Calificaciones cerradas sintéticas para validar resultados y consulta. No se
-- insertan auditorías: la trazabilidad refleja solo las relaciones registradas.
INSERT INTO evaluaciones (
  id, id_trabajo, id_miembro_tribunal, id_etapa_rubrica, id_version_rubrica, etapa, estado,
  instantanea_rubrica, calificacion_total, instantanea_calificacion_maxima, cerrada_en
) VALUES
  ('11000000-0000-4000-8000-000000000050', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000044', '11000000-0000-4000-8000-000000000032', '11000000-0000-4000-8000-000000000031', 'ESCRITA', 'BORRADOR', '{"rubricVersionId":"11000000-0000-4000-8000-000000000031"}', 0, 10.00, NULL),
  ('11000000-0000-4000-8000-000000000051', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000045', '11000000-0000-4000-8000-000000000032', '11000000-0000-4000-8000-000000000031', 'ESCRITA', 'BORRADOR', '{"rubricVersionId":"11000000-0000-4000-8000-000000000031"}', 0, 10.00, NULL);
INSERT INTO calificaciones_evaluacion (id_evaluacion, id_indicador, score, instantanea_calificacion_maxima) VALUES
  ('11000000-0000-4000-8000-000000000050', '11000000-0000-4000-8000-000000000036', 8.50, 10.00),
  ('11000000-0000-4000-8000-000000000051', '11000000-0000-4000-8000-000000000036', 9.00, 10.00);
UPDATE evaluaciones SET estado = 'CERRADA', calificacion_total = 8.50, cerrada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000050';
UPDATE evaluaciones SET estado = 'CERRADA', calificacion_total = 9.00, cerrada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000051';

INSERT INTO programaciones_sustentacion (
  id, id_trabajo, fecha_programada, hora_programada, sala, scheduled_by_id_cuenta
) VALUES (
  '11000000-0000-4000-8000-000000000046', '11000000-0000-4000-8000-000000000040',
  CURRENT_DATE + 7, TIME '10:00', 'Sala de integración 9D', '11000000-0000-4000-8000-000000000020'
);

INSERT INTO evaluaciones (
  id, id_trabajo, id_miembro_tribunal, id_estudiante, id_etapa_rubrica, id_version_rubrica, etapa, estado,
  instantanea_rubrica, calificacion_total, instantanea_calificacion_maxima, cerrada_en
) VALUES
  ('11000000-0000-4000-8000-000000000052', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000044', '11000000-0000-4000-8000-000000000024', '11000000-0000-4000-8000-000000000033', '11000000-0000-4000-8000-000000000031', 'ORAL', 'BORRADOR', '{"rubricVersionId":"11000000-0000-4000-8000-000000000031"}', 0, 10.00, NULL),
  ('11000000-0000-4000-8000-000000000053', '11000000-0000-4000-8000-000000000040', '11000000-0000-4000-8000-000000000045', '11000000-0000-4000-8000-000000000024', '11000000-0000-4000-8000-000000000033', '11000000-0000-4000-8000-000000000031', 'ORAL', 'BORRADOR', '{"rubricVersionId":"11000000-0000-4000-8000-000000000031"}', 0, 10.00, NULL);
INSERT INTO calificaciones_evaluacion (id_evaluacion, id_indicador, score, instantanea_calificacion_maxima) VALUES
  ('11000000-0000-4000-8000-000000000052', '11000000-0000-4000-8000-000000000037', 8.00, 10.00),
  ('11000000-0000-4000-8000-000000000053', '11000000-0000-4000-8000-000000000037', 8.50, 10.00);
UPDATE evaluaciones SET estado = 'CERRADA', calificacion_total = 8.00, cerrada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000052';
UPDATE evaluaciones SET estado = 'CERRADA', calificacion_total = 8.50, cerrada_en = clock_timestamp()
WHERE id = '11000000-0000-4000-8000-000000000053';

COMMIT;
