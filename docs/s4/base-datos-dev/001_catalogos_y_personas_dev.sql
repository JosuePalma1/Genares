-- SOLO DESARROLLO. Personas/códigos/matrículas ficticios. Repetible.
-- No importa ningún dato institucional ni certifica las rúbricas oficiales.
CREATE OR REPLACE FUNCTION s4.uuid_fixture(p_codigo text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT md5('GENARES-DEV-NO-PROD:' || p_codigo)::uuid;
$$;

-- revision empieza en 1: S4 la usa para detectar cambios concurrentes y rechaza NULL.
-- Al repetir el script, solo se completa una revision vacía; no se sobrescribe otra.
INSERT INTO gen.carrera (id,codigo,nombre,activo,revision) VALUES
(s4.uuid_fixture('carrera-ti'),'DEV-TI','Tecnologías de la Información (DEV)',true,1),
(s4.uuid_fixture('carrera-soft'),'DEV-SOFT','Software (DEV)',true,1)
ON CONFLICT (id) DO UPDATE SET revision = 1 WHERE gen.carrera.revision IS NULL;

INSERT INTO gen.modalidad (id,codigo,nombre,descripcion,activo,revision) VALUES
(s4.uuid_fixture('mod-proyecto'),'DEV-PROYECTO','Proyecto integrador de demostración',
 'Modalidad sintética: reemplazar por catálogo institucional',true,1)
ON CONFLICT (id) DO UPDATE SET revision = 1 WHERE gen.modalidad.revision IS NULL;

INSERT INTO gen.periodo_academico
 (id,codigo,nombre,anio,numero_periodo,fecha_inicio,fecha_fin,activo) VALUES
(s4.uuid_fixture('periodo-2026b'),'DEV-2026B','Período de pruebas 2026 B',2026,2,
 DATE '2026-08-01',DATE '2027-02-28',true)
ON CONFLICT (id) DO NOTHING;

-- Cuentas y roles DEMO, no equivalentes a permisos reales de la institución.
INSERT INTO gen.rol (id,codigo,nombre,descripcion) VALUES
(s4.uuid_fixture('rol-admin'),'DEV-ADMIN','Administrador de pruebas','Rol simulado'),
(s4.uuid_fixture('rol-comision'),'DEV-COMISION','Comisión académica de pruebas','Rol simulado'),
(s4.uuid_fixture('rol-evaluador'),'DEV-EVALUADOR','Tribunal de pruebas','Rol simulado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.permiso (id,codigo,descripcion) VALUES
(s4.uuid_fixture('perm-rubrica'),'DEV-ASIGNAR-RUBRICA','Permiso de desarrollo'),
(s4.uuid_fixture('perm-agenda'),'DEV-PROGRAMAR','Permiso de desarrollo'),
(s4.uuid_fixture('perm-evaluar'),'DEV-EVALUAR','Permiso de desarrollo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.rol_permiso (id,rol_id,permiso_id) VALUES
(s4.uuid_fixture('rp-admin-rubrica'),s4.uuid_fixture('rol-admin'),s4.uuid_fixture('perm-rubrica')),
(s4.uuid_fixture('rp-admin-agenda'),s4.uuid_fixture('rol-admin'),s4.uuid_fixture('perm-agenda')),
(s4.uuid_fixture('rp-comi-rubrica'),s4.uuid_fixture('rol-comision'),s4.uuid_fixture('perm-rubrica')),
(s4.uuid_fixture('rp-comi-agenda'),s4.uuid_fixture('rol-comision'),s4.uuid_fixture('perm-agenda')),
(s4.uuid_fixture('rp-tribunal-evaluar'),s4.uuid_fixture('rol-evaluador'),s4.uuid_fixture('perm-evaluar'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.persona (id,identificacion,nombres,apellidos) VALUES
(s4.uuid_fixture('persona-admin'),'DEV-ID-ADMIN','Daniela','Administradora Demo'),
(s4.uuid_fixture('persona-comision'),'DEV-ID-COMI','Andrea','Comisión Demo'),
(s4.uuid_fixture('persona-t1'),'DEV-ID-T1','María','Docente TI A'),
(s4.uuid_fixture('persona-t2'),'DEV-ID-T2','Carlos','Docente TI B'),
(s4.uuid_fixture('persona-s1'),'DEV-ID-S1','Lucía','Docente Software A'),
(s4.uuid_fixture('persona-s2'),'DEV-ID-S2','David','Docente Software B'),
(s4.uuid_fixture('persona-tutor-ti'),'DEV-ID-TUTOR-TI','Taylor','Tutor TI Demo'),
(s4.uuid_fixture('persona-tutor-soft'),'DEV-ID-TUTOR-SOFT','Jordan','Tutor Software Demo'),
(s4.uuid_fixture('persona-est1'),'DEV-ID-E1','Juan','Estudiante TI A'),
(s4.uuid_fixture('persona-est2'),'DEV-ID-E2','María','Estudiante TI B'),
(s4.uuid_fixture('persona-est3'),'DEV-ID-E3','Pedro','Estudiante Software')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario (id,email,activo,persona_id,sujeto_autenticacion) VALUES
(s4.uuid_fixture('usuario-admin'),'dev-admin@genares.invalid',true,s4.uuid_fixture('persona-admin'),'dev-admin'),
(s4.uuid_fixture('usuario-comision'),'dev-comision@genares.invalid',true,s4.uuid_fixture('persona-comision'),'dev-comision'),
(s4.uuid_fixture('usuario-t1'),'dev-ti-a@genares.invalid',true,s4.uuid_fixture('persona-t1'),'dev-ti-a'),
(s4.uuid_fixture('usuario-t2'),'dev-ti-b@genares.invalid',true,s4.uuid_fixture('persona-t2'),'dev-ti-b'),
(s4.uuid_fixture('usuario-s1'),'dev-soft-a@genares.invalid',true,s4.uuid_fixture('persona-s1'),'dev-soft-a'),
(s4.uuid_fixture('usuario-s2'),'dev-soft-b@genares.invalid',true,s4.uuid_fixture('persona-s2'),'dev-soft-b'),
(s4.uuid_fixture('usuario-tutor-ti'),'dev-tutor-ti@genares.invalid',true,s4.uuid_fixture('persona-tutor-ti'),'dev-tutor-ti'),
(s4.uuid_fixture('usuario-tutor-soft'),'dev-tutor-soft@genares.invalid',true,s4.uuid_fixture('persona-tutor-soft'),'dev-tutor-soft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario_rol (id,usuario_id,rol_id) VALUES
(s4.uuid_fixture('ur-admin'),s4.uuid_fixture('usuario-admin'),s4.uuid_fixture('rol-admin')),
(s4.uuid_fixture('ur-comi'),s4.uuid_fixture('usuario-comision'),s4.uuid_fixture('rol-comision')),
(s4.uuid_fixture('ur-t1'),s4.uuid_fixture('usuario-t1'),s4.uuid_fixture('rol-evaluador')),
(s4.uuid_fixture('ur-t2'),s4.uuid_fixture('usuario-t2'),s4.uuid_fixture('rol-evaluador')),
(s4.uuid_fixture('ur-s1'),s4.uuid_fixture('usuario-s1'),s4.uuid_fixture('rol-evaluador')),
(s4.uuid_fixture('ur-s2'),s4.uuid_fixture('usuario-s2'),s4.uuid_fixture('rol-evaluador'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario_carrera (id,usuario_id,carrera_id) VALUES
(s4.uuid_fixture('uc-comi-ti'),s4.uuid_fixture('usuario-comision'),s4.uuid_fixture('carrera-ti')),
(s4.uuid_fixture('uc-comi-soft'),s4.uuid_fixture('usuario-comision'),s4.uuid_fixture('carrera-soft'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.docente (id,persona_id,usuario_id,carrera_id,activo,fuente) VALUES
(s4.uuid_fixture('doc-ti1'),s4.uuid_fixture('persona-t1'),s4.uuid_fixture('usuario-t1'),s4.uuid_fixture('carrera-ti'),true,'MANUAL'),
(s4.uuid_fixture('doc-ti2'),s4.uuid_fixture('persona-t2'),s4.uuid_fixture('usuario-t2'),s4.uuid_fixture('carrera-ti'),true,'MANUAL'),
(s4.uuid_fixture('doc-soft1'),s4.uuid_fixture('persona-s1'),s4.uuid_fixture('usuario-s1'),s4.uuid_fixture('carrera-soft'),true,'MANUAL'),
(s4.uuid_fixture('doc-soft2'),s4.uuid_fixture('persona-s2'),s4.uuid_fixture('usuario-s2'),s4.uuid_fixture('carrera-soft'),true,'MANUAL'),
(s4.uuid_fixture('doc-tutor-ti'),s4.uuid_fixture('persona-tutor-ti'),s4.uuid_fixture('usuario-tutor-ti'),s4.uuid_fixture('carrera-ti'),true,'MANUAL'),
(s4.uuid_fixture('doc-tutor-soft'),s4.uuid_fixture('persona-tutor-soft'),s4.uuid_fixture('usuario-tutor-soft'),s4.uuid_fixture('carrera-soft'),true,'MANUAL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.estudiante (id,persona_id,carrera_id,matricula,codigo_institucional) VALUES
(s4.uuid_fixture('est-ti1'),s4.uuid_fixture('persona-est1'),s4.uuid_fixture('carrera-ti'),'DEV-TI-001','DEV-TI-001'),
(s4.uuid_fixture('est-ti2'),s4.uuid_fixture('persona-est2'),s4.uuid_fixture('carrera-ti'),'DEV-TI-002','DEV-TI-002'),
(s4.uuid_fixture('est-soft'),s4.uuid_fixture('persona-est3'),s4.uuid_fixture('carrera-soft'),'DEV-SOFT-001','DEV-SOFT-001')
ON CONFLICT (id) DO NOTHING;
