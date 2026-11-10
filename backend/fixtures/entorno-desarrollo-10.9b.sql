-- Datos enteramente ficticios del entorno local 10.9B.
-- Repetible: usa códigos/identificadores estables, no elimina registros y evita duplicar transferencias o auditoría.
BEGIN;

INSERT INTO carreras (codigo, nombre, esta_activo) VALUES
  ('TI', 'Tecnologías de la Información', TRUE),
  ('SOFT', 'Ingeniería en Software', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO modalidades (codigo, nombre, esta_activo)
VALUES ('DEV-PROYECTO-INTEGRADOR', 'Proyecto Integrador (datos de desarrollo)', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO periodos_academicos (codigo, fecha_inicio, fecha_fin, esta_activo)
VALUES ('DEV-2026-2', DATE '2026-08-01', DATE '2027-02-28', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO personas (identificacion_nacional, nombres, surnames) VALUES
  ('DEV-EVAL-01', 'María Elena', 'López Vera'),
  ('DEV-EVAL-02', 'José Antonio', 'Mendoza Ruiz'),
  ('DEV-TUTOR-TI', 'Taylor', 'Tutor TI'),
  ('DEV-TUTOR-SOFT', 'Jordan', 'Tutor Software'),
  ('DEV-EST-TI-01', 'Andrea Sofía', 'Mendoza Loor'),
  ('DEV-EST-TI-02', 'Mateo Andrés', 'Alcívar Pico'),
  ('DEV-EST-SOFT-01', 'Camila Alejandra', 'Vélez Mera'),
  ('DEV-ADMIN-10.9', 'Daniela', 'Administración Demo'),
  ('DEV-SECRETARIA-10.9', 'Lucía', 'Santamaría Demo')
ON CONFLICT (identificacion_nacional) DO UPDATE
SET nombres = EXCLUDED.nombres, surnames = EXCLUDED.surnames;

INSERT INTO perfiles_docente (id_persona, id_carrera, fuente, esta_activo)
SELECT persona.id, carrera.id, 'MANUAL', TRUE
FROM (VALUES
  ('DEV-EVAL-01', 'TI'), ('DEV-EVAL-02', 'TI'),
  ('DEV-TUTOR-TI', 'TI'), ('DEV-TUTOR-SOFT', 'SOFT')
) AS fixture(identificacion, codigo_carrera)
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion
JOIN carreras carrera ON carrera.codigo = fixture.codigo_carrera
ON CONFLICT (id_persona) DO UPDATE
SET id_carrera = EXCLUDED.id_carrera, fuente = 'MANUAL', esta_activo = TRUE;

INSERT INTO perfiles_estudiante (id_persona, id_carrera)
SELECT persona.id, carrera.id
FROM (VALUES
  ('DEV-EST-TI-01', 'TI'), ('DEV-EST-TI-02', 'TI'), ('DEV-EST-SOFT-01', 'SOFT')
) AS fixture(identificacion, codigo_carrera)
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion
JOIN carreras carrera ON carrera.codigo = fixture.codigo_carrera
ON CONFLICT (id_persona) DO UPDATE SET id_carrera = EXCLUDED.id_carrera;

INSERT INTO cuentas_usuario (id_persona, sujeto_autenticacion, esta_activo)
SELECT persona.id, fixture.sujeto, TRUE
FROM (VALUES
  ('DEV-EVAL-01', 'desarrollo-local-evaluador-uno'),
  ('DEV-EVAL-02', 'desarrollo-local-evaluador-dos'),
  ('DEV-EST-TI-01', 'desarrollo-local-estudiante-ti-uno'),
  ('DEV-EST-TI-02', 'desarrollo-local-estudiante-ti-dos'),
  ('DEV-EST-SOFT-01', 'desarrollo-local-estudiante-soft-uno'),
  ('DEV-ADMIN-10.9', 'desarrollo-local-administrador'),
  ('DEV-SECRETARIA-10.9', 'desarrollo-local-secretaria')
) AS fixture(identificacion, sujeto)
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion
ON CONFLICT (sujeto_autenticacion) DO UPDATE SET esta_activo = TRUE;

INSERT INTO rubricas (id_modalidad, nombre, descripcion)
SELECT modalidad.id, 'Rúbrica dinámica de demostración',
  'Fixture sintético con etapa escrita compartida y etapa oral individual.'
FROM modalidades modalidad
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
ON CONFLICT (id_modalidad) DO NOTHING;

INSERT INTO versiones_rubrica (id_rubrica, periodo_academico_id, version, estado)
SELECT rubrica.id, periodo.id, '10.9B-DEMO', 'BORRADOR'
FROM rubricas rubrica
JOIN modalidades modalidad ON modalidad.id = rubrica.id_modalidad
JOIN periodos_academicos periodo ON periodo.codigo = 'DEV-2026-2'
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
ON CONFLICT (id_rubrica, version) DO NOTHING;

INSERT INTO etapas_rubrica (
  id_version_rubrica, kind, scope, codigo, nombre, descripcion, calificacion_maxima, porcentaje, orden
)
SELECT version.id, fixture.kind::etapa_evaluacion_enum, fixture.scope::alcance_etapa_rubrica_enum,
  fixture.codigo, fixture.nombre, fixture.descripcion, 10.00, fixture.porcentaje, fixture.orden
FROM versiones_rubrica version
JOIN rubricas rubrica ON rubrica.id = version.id_rubrica
JOIN modalidades modalidad ON modalidad.id = rubrica.id_modalidad
CROSS JOIN (VALUES
  ('ESCRITA', 'TRABAJO_COMPARTIDO', 'ESCRITA', 'Revisión del proyecto escrito',
   'Una evaluación por miembro del tribunal y trabajo; se comparte con cada estudiante.', 50.00, 1),
  ('ORAL', 'ESTUDIANTE_INDIVIDUAL', 'ORAL', 'Sustentación individual',
   'Cada miembro evalúa a cada estudiante por separado.', 50.00, 2)
) AS fixture(kind, scope, codigo, nombre, descripcion, porcentaje, orden)
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
  AND version.version = '10.9B-DEMO' AND version.estado = 'BORRADOR'
ON CONFLICT (id_version_rubrica, codigo) DO NOTHING;

INSERT INTO categorias_rubrica (id_version_rubrica, id_etapa_rubrica, codigo, nombre, calificacion_maxima, orden)
SELECT version.id, etapa.id, 'CRIT-GEN', 'Calidad y dominio del proyecto', 10.00, 1
FROM versiones_rubrica version
JOIN rubricas rubrica ON rubrica.id = version.id_rubrica
JOIN modalidades modalidad ON modalidad.id = rubrica.id_modalidad
JOIN etapas_rubrica etapa ON etapa.id_version_rubrica = version.id
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
  AND version.version = '10.9B-DEMO' AND version.estado = 'BORRADOR'
ON CONFLICT (id_etapa_rubrica, codigo) DO NOTHING;

INSERT INTO indicadores_rubrica (id_categoria, label, descripcion, calificacion_maxima, orden)
SELECT categoria.id, fixture.label, fixture.descripcion, 5.00, fixture.orden
FROM categorias_rubrica categoria
JOIN etapas_rubrica etapa ON etapa.id = categoria.id_etapa_rubrica
JOIN versiones_rubrica version ON version.id = etapa.id_version_rubrica
JOIN rubricas rubrica ON rubrica.id = version.id_rubrica
JOIN modalidades modalidad ON modalidad.id = rubrica.id_modalidad
CROSS JOIN (VALUES
  ('I1', 'Solidez y organización del contenido.', 1),
  ('I2', 'Dominio y comunicación de la propuesta.', 2)
) AS fixture(label, descripcion, orden)
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
  AND version.version = '10.9B-DEMO' AND version.estado = 'BORRADOR'
ON CONFLICT (id_categoria, orden) DO NOTHING;

UPDATE versiones_rubrica version
SET estado = 'CONFIGURADA'
FROM rubricas rubrica, modalidades modalidad
WHERE version.id_rubrica = rubrica.id AND rubrica.id_modalidad = modalidad.id
  AND modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
  AND version.version = '10.9B-DEMO' AND version.estado = 'BORRADOR';

INSERT INTO versiones_rubrica_carreras (
  id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id
)
SELECT version.id, carrera.id, rubrica.id, modalidad.id, version.periodo_academico_id
FROM versiones_rubrica version
JOIN rubricas rubrica ON rubrica.id = version.id_rubrica
JOIN modalidades modalidad ON modalidad.id = rubrica.id_modalidad
CROSS JOIN carreras carrera
WHERE modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
  AND version.version = '10.9B-DEMO' AND carrera.codigo IN ('TI', 'SOFT')
ON CONFLICT (id_version_rubrica, id_carrera) DO NOTHING;

INSERT INTO vigencias_rubrica_carrera (
  id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id
)
SELECT relacion.id_version_rubrica, relacion.id_carrera, relacion.id_rubrica,
  relacion.id_modalidad, relacion.periodo_academico_id
FROM versiones_rubrica_carreras relacion
JOIN versiones_rubrica version ON version.id = relacion.id_version_rubrica
JOIN carreras carrera ON carrera.id = relacion.id_carrera
WHERE version.version = '10.9B-DEMO' AND carrera.codigo IN ('TI', 'SOFT')
  AND NOT EXISTS (
    SELECT 1 FROM vigencias_rubrica_carrera actual
    WHERE actual.id_version_rubrica = relacion.id_version_rubrica
      AND actual.id_carrera = relacion.id_carrera AND actual.vigente_hasta IS NULL
  );

INSERT INTO trabajos_titulacion (
  codigo, titulo, id_modalidad, periodo_academico_id, id_carrera,
  id_version_rubrica, estado, created_by_id_cuenta
)
SELECT fixture.codigo, fixture.titulo, modalidad.id, periodo.id, carrera.id,
  version.id, 'EVALUACION_COMPLETADA', cuenta.id
FROM (VALUES
  ('DEV-TI-001', 'Prototipo de gestión de información institucional', 'TI'),
  ('DEV-SOFT-001', 'Aplicación de seguimiento de proyectos académicos', 'SOFT')
) AS fixture(codigo, titulo, codigo_carrera)
JOIN carreras carrera ON carrera.codigo = fixture.codigo_carrera
JOIN modalidades modalidad ON modalidad.codigo = 'DEV-PROYECTO-INTEGRADOR'
JOIN periodos_academicos periodo ON periodo.codigo = 'DEV-2026-2'
JOIN rubricas rubrica ON rubrica.id_modalidad = modalidad.id
JOIN versiones_rubrica version ON version.id_rubrica = rubrica.id AND version.version = '10.9B-DEMO'
JOIN personas persona ON persona.identificacion_nacional = 'DEV-EVAL-01'
JOIN cuentas_usuario cuenta ON cuenta.id_persona = persona.id
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO estudiantes_trabajo (id_trabajo, id_estudiante, orden_autoria)
SELECT trabajo.id, estudiante.id, fixture.orden
FROM (VALUES
  ('DEV-TI-001', 'DEV-EST-TI-01', 1),
  ('DEV-TI-001', 'DEV-EST-TI-02', 2),
  ('DEV-SOFT-001', 'DEV-EST-SOFT-01', 1)
) AS fixture(codigo_trabajo, identificacion, orden)
JOIN trabajos_titulacion trabajo ON trabajo.codigo = fixture.codigo_trabajo
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion
JOIN perfiles_estudiante estudiante ON estudiante.id_persona = persona.id
ON CONFLICT (id_trabajo, id_estudiante) DO NOTHING;

INSERT INTO asignaciones_tutor_trabajo (id_trabajo, id_docente, assigned_by_id_cuenta)
SELECT trabajo.id, docente.id, cuenta.id
FROM (VALUES ('DEV-TI-001', 'DEV-TUTOR-TI'), ('DEV-SOFT-001', 'DEV-TUTOR-SOFT')) AS fixture(codigo_trabajo, identificacion_tutor)
JOIN trabajos_titulacion trabajo ON trabajo.codigo = fixture.codigo_trabajo
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion_tutor
JOIN perfiles_docente docente ON docente.id_persona = persona.id
JOIN personas actor ON actor.identificacion_nacional = 'DEV-EVAL-01'
JOIN cuentas_usuario cuenta ON cuenta.id_persona = actor.id
WHERE NOT EXISTS (
  SELECT 1 FROM asignaciones_tutor_trabajo actual
  WHERE actual.id_trabajo = trabajo.id AND actual.finalizada_en IS NULL
);

INSERT INTO asignaciones_tribunal (id_trabajo, estado, assigned_by_id_cuenta, confirmada_en)
SELECT trabajo.id, 'CONFIRMADO', cuenta.id, clock_timestamp()
FROM trabajos_titulacion trabajo
JOIN personas actor ON actor.identificacion_nacional = 'DEV-EVAL-01'
JOIN cuentas_usuario cuenta ON cuenta.id_persona = actor.id
WHERE trabajo.codigo IN ('DEV-TI-001', 'DEV-SOFT-001')
  AND NOT EXISTS (
    SELECT 1 FROM asignaciones_tribunal actual
    WHERE actual.id_trabajo = trabajo.id AND actual.estado IN ('BORRADOR', 'CONFIRMADO')
  );

INSERT INTO miembros_tribunal (id_asignacion, id_docente, position)
SELECT asignacion.id, docente.id, fixture.position
FROM asignaciones_tribunal asignacion
JOIN trabajos_titulacion trabajo ON trabajo.id = asignacion.id_trabajo
CROSS JOIN (VALUES ('DEV-EVAL-01', 1), ('DEV-EVAL-02', 2)) AS fixture(identificacion, position)
JOIN personas persona ON persona.identificacion_nacional = fixture.identificacion
JOIN perfiles_docente docente ON docente.id_persona = persona.id
WHERE trabajo.codigo IN ('DEV-TI-001', 'DEV-SOFT-001') AND asignacion.estado = 'CONFIRMADO'
ON CONFLICT (id_asignacion, position) DO NOTHING;

-- Las notas son sintéticas; cada evaluación queda cerrada por indicador y la etapa escrita
-- genera los traspasos académicos mediante el trigger instalado por la migración 9H.5A.
WITH fixture(id, codigo, trabajo, posicion, etapa_codigo, estudiante, total, puntaje1, puntaje2) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001', 'DEV-EVAL-TI-ESCRITA-01', 'DEV-TI-001', 1, 'ESCRITA', NULL, 9.20, 4.60, 4.60),
    ('10000000-0000-0000-0000-000000000002', 'DEV-EVAL-TI-ESCRITA-02', 'DEV-TI-001', 2, 'ESCRITA', NULL, 9.40, 4.70, 4.70),
    ('10000000-0000-0000-0000-000000000003', 'DEV-EVAL-TI-ORAL-A-01', 'DEV-TI-001', 1, 'ORAL', 'DEV-EST-TI-01', 8.50, 4.25, 4.25),
    ('10000000-0000-0000-0000-000000000004', 'DEV-EVAL-TI-ORAL-A-02', 'DEV-TI-001', 2, 'ORAL', 'DEV-EST-TI-01', 8.90, 4.45, 4.45),
    ('10000000-0000-0000-0000-000000000005', 'DEV-EVAL-TI-ORAL-B-01', 'DEV-TI-001', 1, 'ORAL', 'DEV-EST-TI-02', 9.10, 4.55, 4.55),
    ('10000000-0000-0000-0000-000000000006', 'DEV-EVAL-TI-ORAL-B-02', 'DEV-TI-001', 2, 'ORAL', 'DEV-EST-TI-02', 9.30, 4.65, 4.65),
    ('10000000-0000-0000-0000-000000000007', 'DEV-EVAL-SOFT-ESCRITA-01', 'DEV-SOFT-001', 1, 'ESCRITA', NULL, 8.80, 4.40, 4.40),
    ('10000000-0000-0000-0000-000000000008', 'DEV-EVAL-SOFT-ESCRITA-02', 'DEV-SOFT-001', 2, 'ESCRITA', NULL, 9.00, 4.50, 4.50),
    ('10000000-0000-0000-0000-000000000009', 'DEV-EVAL-SOFT-ORAL-01', 'DEV-SOFT-001', 1, 'ORAL', 'DEV-EST-SOFT-01', 9.00, 4.50, 4.50),
    ('10000000-0000-0000-0000-00000000000a', 'DEV-EVAL-SOFT-ORAL-02', 'DEV-SOFT-001', 2, 'ORAL', 'DEV-EST-SOFT-01', 9.20, 4.60, 4.60)
)
INSERT INTO evaluaciones (
  id, id_trabajo, id_miembro_tribunal, id_estudiante, id_version_rubrica,
  id_etapa_rubrica, etapa, estado, instantanea_rubrica,
  calificacion_total, instantanea_calificacion_maxima
)
SELECT fixture.id::uuid, trabajo.id, miembro.id, estudiante.id, version.id, etapa.id,
  etapa.kind, 'BORRADOR', jsonb_build_object('rubricVersionId', version.id::text, 'fixture', '10.9B'),
  fixture.total, etapa.calificacion_maxima
FROM fixture
JOIN trabajos_titulacion trabajo ON trabajo.codigo = fixture.trabajo
JOIN asignaciones_tribunal asignacion ON asignacion.id_trabajo = trabajo.id AND asignacion.estado = 'CONFIRMADO'
JOIN miembros_tribunal miembro ON miembro.id_asignacion = asignacion.id AND miembro.position = fixture.posicion
JOIN versiones_rubrica version ON version.id = trabajo.id_version_rubrica
JOIN etapas_rubrica etapa ON etapa.id_version_rubrica = version.id AND etapa.codigo = fixture.etapa_codigo
LEFT JOIN personas persona ON persona.identificacion_nacional = fixture.estudiante
LEFT JOIN perfiles_estudiante estudiante ON estudiante.id_persona = persona.id
WHERE NOT EXISTS (SELECT 1 FROM evaluaciones ya_insertada WHERE ya_insertada.id = fixture.id::uuid)
ON CONFLICT (id) DO NOTHING;

WITH fixture(id, puntaje1, puntaje2) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001', 4.60, 4.60), ('10000000-0000-0000-0000-000000000002', 4.70, 4.70),
    ('10000000-0000-0000-0000-000000000003', 4.25, 4.25), ('10000000-0000-0000-0000-000000000004', 4.45, 4.45),
    ('10000000-0000-0000-0000-000000000005', 4.55, 4.55), ('10000000-0000-0000-0000-000000000006', 4.65, 4.65),
    ('10000000-0000-0000-0000-000000000007', 4.40, 4.40), ('10000000-0000-0000-0000-000000000008', 4.50, 4.50),
    ('10000000-0000-0000-0000-000000000009', 4.50, 4.50), ('10000000-0000-0000-0000-00000000000a', 4.60, 4.60)
), calificaciones AS (
  SELECT evaluacion.id AS id_evaluacion, indicador.id AS id_indicador,
    CASE indicador.orden WHEN 1 THEN fixture.puntaje1 ELSE fixture.puntaje2 END AS puntaje
  FROM fixture
  JOIN evaluaciones evaluacion ON evaluacion.id = fixture.id::uuid AND evaluacion.estado = 'BORRADOR'
  JOIN etapas_rubrica etapa ON etapa.id = evaluacion.id_etapa_rubrica
  JOIN categorias_rubrica categoria ON categoria.id_etapa_rubrica = etapa.id
  JOIN indicadores_rubrica indicador ON indicador.id_categoria = categoria.id
)
INSERT INTO calificaciones_evaluacion (id_evaluacion, id_indicador, score, instantanea_calificacion_maxima)
SELECT id_evaluacion, id_indicador, puntaje, 5.00 FROM calificaciones
ON CONFLICT (id_evaluacion, id_indicador) DO NOTHING;

UPDATE evaluaciones evaluacion
SET estado = 'CERRADA', cerrada_en = clock_timestamp(), actualizado_en = clock_timestamp()
WHERE evaluacion.instantanea_rubrica->>'fixture' = '10.9B' AND evaluacion.estado = 'BORRADOR'
  AND (SELECT count(*) FROM calificaciones_evaluacion nota WHERE nota.id_evaluacion = evaluacion.id) =
      (SELECT count(*) FROM indicadores_rubrica indicador
       JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
       JOIN etapas_rubrica etapa ON etapa.id = categoria.id_etapa_rubrica
       WHERE etapa.id = evaluacion.id_etapa_rubrica);

INSERT INTO eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles, correlation_id)
SELECT evaluacion.id, 'fixture:10.9B', 'EVALUACION_CERRADA',
  jsonb_build_object('fixture', TRUE, 'calificacionTotal', evaluacion.calificacion_total),
  'fixture-10.9b-' || evaluacion.id::text
FROM evaluaciones evaluacion
WHERE evaluacion.instantanea_rubrica->>'fixture' = '10.9B' AND evaluacion.estado = 'CERRADA'
  AND NOT EXISTS (
    SELECT 1 FROM eventos_auditoria_evaluacion evento
    WHERE evento.id_evaluacion = evaluacion.id AND evento.correlation_id = 'fixture-10.9b-' || evaluacion.id::text
  );

COMMIT;
