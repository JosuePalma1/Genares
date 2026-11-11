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

-- Rúbrica de prueba; NO ES una rúbrica oficial.
INSERT INTO s4.rubricas(id,id_modalidad,nombre,descripcion) VALUES
 (s4.uuid_fixture('rubric-proyecto'),s4.uuid_fixture('mod-proyecto'),
  'DEV - Rúbrica ficticia de integración','No usar en producción')
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.versiones_rubrica
 (id,id_rubrica,periodo_academico_id,version,estado,revision,activada_en) VALUES
 (s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('rubric-proyecto'),
  s4.uuid_fixture('periodo-2026b'),'DEV-1','ACTIVA',1,now())
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.etapas_rubrica
 (id,id_version_rubrica,kind,scope,codigo,nombre,calificacion_maxima,porcentaje,orden)
VALUES
 (s4.uuid_fixture('stage-written'),s4.uuid_fixture('version-proyecto'),'ESCRITA',
  'TRABAJO_COMPARTIDO','DEV-E','Escrita compartida',10.00,50.00,1),
 (s4.uuid_fixture('stage-oral'),s4.uuid_fixture('version-proyecto'),'ORAL',
  'ESTUDIANTE_INDIVIDUAL','DEV-O','Oral individual',10.00,50.00,2)
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.categorias_rubrica
 (id,id_version_rubrica,id_etapa_rubrica,codigo,nombre,calificacion_maxima,orden) VALUES
 (s4.uuid_fixture('cat-written'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-written'),
  'DEV-A','Categoría escrita ficticia',10.00,1),
 (s4.uuid_fixture('cat-oral'),s4.uuid_fixture('version-proyecto'),s4.uuid_fixture('stage-oral'),
  'DEV-B','Categoría oral ficticia',10.00,1)
ON CONFLICT(id) DO NOTHING;
INSERT INTO s4.indicadores_rubrica
 (id,id_categoria,label,descripcion,calificacion_maxima,orden) VALUES
 (s4.uuid_fixture('ind-written'),s4.uuid_fixture('cat-written'),'DEV-1','Indicador escrito',10.00,1),
 (s4.uuid_fixture('ind-oral'),s4.uuid_fixture('cat-oral'),'DEV-1','Indicador oral',10.00,1)
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
