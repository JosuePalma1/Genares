-- SOLO DESARROLLO: dos asignaciones de tema reales de S2 (una bina y un estudiante).
-- No se insertan s3.trabajos_titulacion ni relaciones estudiante-trabajo/tutor-trabajo ficticias.
-- S3 usa la asignación académica de S2 para identificar a quién se asignó el tribunal.

INSERT INTO s2.periodo_titulacion
 (id,codigo,nombre,periodo_academico_id,estado,max_integrantes_default) VALUES
 (s4.uuid_fixture('periodo-titulacion'),'DEV-PT-2026B','Titulación de prueba',
  s4.uuid_fixture('periodo-2026b'),'ACTIVO',2)
ON CONFLICT(id) DO NOTHING;
INSERT INTO s2.linea_investigacion(id,codigo,nombre,activa) VALUES
 (s4.uuid_fixture('linea-demo'),'DEV-LINEA','Línea de investigación ficticia',true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO gen.tema
 (id,periodo_titulacion_id,linea_id,docente_proponente_id,titulo,descripcion,
  min_integrantes,max_integrantes,estado,modalidad_id,tutor_usuario_id,
  carrera_id,periodo_academico_id,fecha_creacion)
VALUES
 (s4.uuid_fixture('tema-ti'),s4.uuid_fixture('periodo-titulacion'),s4.uuid_fixture('linea-demo'),
  s4.uuid_fixture('doc-tutor-ti'),'DEV - Tema de bina TI','Solo para pruebas',2,2,
  'ASIGNADO',s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('usuario-tutor-ti'),
  s4.uuid_fixture('carrera-ti'),s4.uuid_fixture('periodo-2026b'),DATE '2026-09-01'),
 (s4.uuid_fixture('tema-soft'),s4.uuid_fixture('periodo-titulacion'),s4.uuid_fixture('linea-demo'),
  s4.uuid_fixture('doc-tutor-soft'),'DEV - Tema individual Software','Solo para pruebas',1,1,
  'ASIGNADO',s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('usuario-tutor-soft'),
  s4.uuid_fixture('carrera-soft'),s4.uuid_fixture('periodo-2026b'),DATE '2026-09-01')
ON CONFLICT(id) DO NOTHING;

INSERT INTO s2.estudiante_habilitado
 (id,periodo_id,estudiante_id,origen,estado,condicion_ingreso,situacion_ingreso,fecha_habilitacion)
VALUES
 (s4.uuid_fixture('hab-ti1'),s4.uuid_fixture('periodo-titulacion'),s4.uuid_fixture('est-ti1'),
  'MANUAL','HABILITADO','SIN_CONDICION','REGULAR',now()),
 (s4.uuid_fixture('hab-ti2'),s4.uuid_fixture('periodo-titulacion'),s4.uuid_fixture('est-ti2'),
  'MANUAL','HABILITADO','SIN_CONDICION','REGULAR',now()),
 (s4.uuid_fixture('hab-soft'),s4.uuid_fixture('periodo-titulacion'),s4.uuid_fixture('est-soft'),
  'MANUAL','HABILITADO','SIN_CONDICION','REGULAR',now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO s2.grupo (id,periodo_id,nombre,estado,creado_en)
VALUES(s4.uuid_fixture('grupo-ti'),s4.uuid_fixture('periodo-titulacion'),
       'DEV - Bina TI','ACTIVO',now())
ON CONFLICT(id) DO NOTHING;
INSERT INTO s2.grupo_integrante
 (id,grupo_id,periodo_id,estudiante_id,rol_en_grupo,estado,fecha_ingreso)
VALUES
 (s4.uuid_fixture('gi-ti1'),s4.uuid_fixture('grupo-ti'),s4.uuid_fixture('periodo-titulacion'),
  s4.uuid_fixture('est-ti1'),'REPRESENTANTE','ACTIVO',now()),
 (s4.uuid_fixture('gi-ti2'),s4.uuid_fixture('grupo-ti'),s4.uuid_fixture('periodo-titulacion'),
  s4.uuid_fixture('est-ti2'),'INTEGRANTE','ACTIVO',now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO s2.postulacion
 (id,tema_id,periodo_id,grupo_id,estudiante_id,num_integrantes,registrada_por_id,estado,fecha_postulacion)
VALUES
 (s4.uuid_fixture('post-ti'),s4.uuid_fixture('tema-ti'),s4.uuid_fixture('periodo-titulacion'),
  s4.uuid_fixture('grupo-ti'),NULL,2,s4.uuid_fixture('usuario-admin'),'APROBADA',now()),
 (s4.uuid_fixture('post-soft'),s4.uuid_fixture('tema-soft'),s4.uuid_fixture('periodo-titulacion'),
  NULL,s4.uuid_fixture('est-soft'),1,s4.uuid_fixture('usuario-admin'),'APROBADA',now())
ON CONFLICT(id) DO NOTHING;
INSERT INTO s2.asignacion_tema
 (id,tema_id,postulacion_id,grupo_id,estudiante_id,aprobada_por_id,estado,fecha_asignacion)
VALUES
 (s4.uuid_fixture('asig-ti'),s4.uuid_fixture('tema-ti'),s4.uuid_fixture('post-ti'),
  s4.uuid_fixture('grupo-ti'),NULL,s4.uuid_fixture('usuario-admin'),'VIGENTE',now()),
 (s4.uuid_fixture('asig-soft'),s4.uuid_fixture('tema-soft'),s4.uuid_fixture('post-soft'),
  NULL,s4.uuid_fixture('est-soft'),s4.uuid_fixture('usuario-admin'),'VIGENTE',now())
ON CONFLICT(id) DO NOTHING;

-- Tutores: se usa la tabla real s2.asignacion_tutor (no otra tabla duplicada).
INSERT INTO s2.asignacion_tutor
 (id,asignacion_tema_id,docente_id,tipo,estado,asignada_por_id,fecha_asignacion)
VALUES
 (s4.uuid_fixture('asig-tutor-ti'),s4.uuid_fixture('asig-ti'),s4.uuid_fixture('doc-tutor-ti'),
  'PRINCIPAL','ACTIVA',s4.uuid_fixture('usuario-admin'),now()),
 (s4.uuid_fixture('asig-tutor-soft'),s4.uuid_fixture('asig-soft'),s4.uuid_fixture('doc-tutor-soft'),
  'PRINCIPAL','ACTIVA',s4.uuid_fixture('usuario-admin'),now())
ON CONFLICT(id) DO NOTHING;

-- Tribunal de S3: asignado a la asignación de tema S2, no a una tabla de proyectos paralela.
INSERT INTO s3.docente_carrera_periodo
 (docente_carrera_periodo_id,docente_id,carrera_id,periodo_academico_id)
VALUES
 (s4.uuid_fixture('dcp-ti1'),s4.uuid_fixture('doc-ti1'),s4.uuid_fixture('carrera-ti'),s4.uuid_fixture('periodo-2026b')),
 (s4.uuid_fixture('dcp-ti2'),s4.uuid_fixture('doc-ti2'),s4.uuid_fixture('carrera-ti'),s4.uuid_fixture('periodo-2026b')),
 (s4.uuid_fixture('dcp-soft1'),s4.uuid_fixture('doc-soft1'),s4.uuid_fixture('carrera-soft'),s4.uuid_fixture('periodo-2026b')),
 (s4.uuid_fixture('dcp-soft2'),s4.uuid_fixture('doc-soft2'),s4.uuid_fixture('carrera-soft'),s4.uuid_fixture('periodo-2026b'))
ON CONFLICT(docente_carrera_periodo_id) DO NOTHING;
INSERT INTO s3.miembros_tribunal(miembro_tribunal_id,docente_carrera_periodo_id) VALUES
 (s4.uuid_fixture('mt-ti1'),s4.uuid_fixture('dcp-ti1')),
 (s4.uuid_fixture('mt-ti2'),s4.uuid_fixture('dcp-ti2')),
 (s4.uuid_fixture('mt-soft1'),s4.uuid_fixture('dcp-soft1')),
 (s4.uuid_fixture('mt-soft2'),s4.uuid_fixture('dcp-soft2'))
ON CONFLICT(miembro_tribunal_id) DO NOTHING;
INSERT INTO s3.asignacion_tribunal
 (asignacion_tribunal_id,miembro_tribunal_id,asignacion_tema_id) VALUES
 (s4.uuid_fixture('at-ti1'),s4.uuid_fixture('mt-ti1'),s4.uuid_fixture('asig-ti')),
 (s4.uuid_fixture('at-ti2'),s4.uuid_fixture('mt-ti2'),s4.uuid_fixture('asig-ti')),
 (s4.uuid_fixture('at-soft1'),s4.uuid_fixture('mt-soft1'),s4.uuid_fixture('asig-soft')),
 (s4.uuid_fixture('at-soft2'),s4.uuid_fixture('mt-soft2'),s4.uuid_fixture('asig-soft'))
ON CONFLICT(asignacion_tribunal_id) DO NOTHING;

-- Rúbrica VIGENTE de Proyecto Integrador (Comisión Académica carreras TIC's, FCVT), tomada de
-- «RUBRICA DEFENSA TRABAJO IC 5 PUNTOS» (docs/s4/Plantillas-documentos):
--   Parte I  · Revisión proyecto escrito (50 %, 5 puntos): A 1.00 + B 1.00 + C 3.00
--   Parte II · Sustentación del proyecto (50 %, 5 puntos): D 2.50 + E 2.50
-- La misma estructura está en backend/fixtures/s4-rubrica-vigente-proyecto-integrador.sql (para bases ya
-- creadas o la base integrada): mantenga ambas iguales. Se conservan las claves 'version-proyecto',
-- 'stage-written' y 'stage-oral' porque las usan 003, s4-carga-volumen-dev.sql y etapa-5-rubrica-mer.sql.
INSERT INTO s4.rubricas(id,id_modalidad,nombre,descripcion) VALUES
 (s4.uuid_fixture('rubric-proyecto'),s4.uuid_fixture('mod-proyecto'),
  'Rúbrica de evaluación de trabajo de integración curricular',
  'Fuente: Comisión Académica carreras Tic´s Facultad de Ciencias de la Vida y Tecnologías')
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.versiones_rubrica
 (id,id_rubrica,periodo_academico_id,version,estado,revision,activada_en) VALUES
 (s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('rubric-proyecto'),
  s4.uuid_fixture('periodo-2026b'),'V1','ACTIVA',1,now())
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.etapas_rubrica
 (id,id_version_rubrica,kind,scope,codigo,nombre,calificacion_maxima,porcentaje,orden)
VALUES
 (s4.uuid_fixture('stage-written'),s4.uuid_fixture('version-proyecto'),'ESCRITA',
  'TRABAJO_COMPARTIDO','ESCRITA','Revisión proyecto escrito',5.00,50.00,1),
 (s4.uuid_fixture('stage-oral'),s4.uuid_fixture('version-proyecto'),'ORAL',
  'ESTUDIANTE_INDIVIDUAL','ORAL','Sustentación del proyecto',5.00,50.00,2)
ON CONFLICT(id) DO NOTHING;
-- El orden de las categorías es único en toda la versión (lo exige la activación).
INSERT INTO s4.categorias_rubrica
 (id,id_version_rubrica,id_etapa_rubrica,codigo,nombre,calificacion_maxima,orden)
SELECT s4.uuid_fixture('cat-' || lower(c.codigo)),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture(c.etapa),
  c.codigo,c.nombre,c.maximo,c.orden
FROM (VALUES
 ('stage-written','A','Resumen e introducción',1.00,1),
 ('stage-written','B','Marco teórico de la investigación',1.00,2),
 ('stage-written','C','Diagnóstico o estudio de campo',3.00,3),
 ('stage-oral','D','Empoderamiento y defensa del trabajo realizado',2.50,4),
 ('stage-oral','E','Conclusiones y Propuesta',2.50,5)
) AS c(etapa,codigo,nombre,maximo,orden)
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.indicadores_rubrica
 (id,id_categoria,label,descripcion,calificacion_maxima,orden)
SELECT s4.uuid_fixture('ind-' || lower(i.categoria) || i.orden),s4.uuid_fixture('cat-' || lower(i.categoria)),
  i.categoria || i.orden,i.descripcion,i.maximo,i.orden
FROM (VALUES
 ('A',1,'El resumen o síntesis hace referencia al objetivo planteado',0.33),
 ('A',2,'Aborda el problema, métodos y técnicas de manera lógica y coherente',0.33),
 ('A',3,'La introducción resume de manera descriptiva el contexto, justificación, interrogantes de estudio en relación con el tema investigado.',0.34),
 ('B',1,'En el marco teórico se evidencia el análisis de los principales conceptos y posiciones que se manejan en la teoría sobre el tema que se investiga.',0.33),
 ('B',2,'Se define de manera asertiva citas y ejemplos de otras investigaciones realizadas sobre la temática que direcciona a la investigación.',0.33),
 ('B',3,'Evidencia la adopción de una postura teórica y el análisis crítico en relación con qué criterios comparten y cuáles no comparten.',0.34),
 ('C',1,'Se aplica una metodología que cubra las etapas del desarrollo del proyecto integrador.',1.00),
 ('C',2,'Se evidencia en la propuesta y su relación con la temática planteada: análisis, diseño e implementación de Tecnologías de Información.',1.00),
 ('C',3,'El informe presenta coherencia, cohesión léxica, cohesión gramatical.',1.00),
 ('D',1,'Evidencia empoderamiento de la temática de manera lógica y coherente.',0.83),
 ('D',2,'Justifica el problema, desde las interrogantes de estudio en relación con el tema investigado, los objetivos planteados en el problema, métodos y técnicas aplicadas.',0.83),
 ('D',3,'Demuestra conocimientos sobre los principales conceptos del tema, evidenciando una postura desde el análisis crítico, hacia los criterios que comparte.',0.84),
 ('E',1,'Dominio sobre los resultados obtenidos, que permitan ver de manera clara los diferentes métodos y técnicas de investigación aplicadas.',0.83),
 ('E',2,'Demuestra que las conclusiones son pertinentes y coherentes con los resultados de la investigación.',0.83),
 ('E',3,'La propuesta es pertinente y se apoya en teorías que fortalecen la temática investigada',0.84)
) AS i(categoria,orden,descripcion,maximo)
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.versiones_rubrica_carreras
 (id_version_rubrica,id_carrera,id_rubrica,id_modalidad,periodo_academico_id,asociado_en)
VALUES
 (s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('carrera-ti'),s4.uuid_fixture('rubric-proyecto'),
  s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('periodo-2026b'),now()),
 (s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('carrera-soft'),s4.uuid_fixture('rubric-proyecto'),
  s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('periodo-2026b'),now())
ON CONFLICT(id_version_rubrica,id_carrera) DO NOTHING;
INSERT INTO s4.vigencias_rubrica_carrera
 (id,id_version_rubrica,id_carrera,id_rubrica,id_modalidad,periodo_academico_id,vigente_desde)
VALUES
 (s4.uuid_fixture('vig-ti'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('carrera-ti'),
  s4.uuid_fixture('rubric-proyecto'),s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('periodo-2026b'),now()),
 (s4.uuid_fixture('vig-soft'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('carrera-soft'),
  s4.uuid_fixture('rubric-proyecto'),s4.uuid_fixture('mod-proyecto'),s4.uuid_fixture('periodo-2026b'),now())
ON CONFLICT(id) DO NOTHING;

-- Incorporación S4 idempotente, con versión de rúbrica elegida automáticamente
-- solo cuando hay UNA coincidencia. El backend debe invocar al consultar elegibles.
SELECT s4.incorporar_asignacion_desde_s3(s4.uuid_fixture('asig-ti')) AS proceso_s4_bina;
SELECT s4.incorporar_asignacion_desde_s3(s4.uuid_fixture('asig-soft')) AS proceso_s4_individual;
