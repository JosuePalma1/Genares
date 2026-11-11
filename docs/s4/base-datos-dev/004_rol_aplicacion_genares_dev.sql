-- SOLO DESARROLLO. Crea el rol de aplicación genares y su acceso básico.
-- Ejecutar como postgres, conectado a genares_integrado_dev, después de 003 y antes
-- de los scripts de backend/fixtures (permisos, retención y verificación).
-- Repetible: no cambia un rol existente y los GRANT ya concedidos no tienen efecto.
--
-- No guarda contraseñas. Después de ejecutarlo, define la contraseña del rol (la misma
-- de DB_PASSWORD en backend/.env):
--   ALTER ROLE genares WITH PASSWORD 'tu-contraseña-local';
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Ejecuta este archivo en genares_integrado_dev';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genares') THEN
    -- Sin privilegios de administración: no es superusuario ni crea bases o roles.
    CREATE ROLE genares LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
    RAISE NOTICE 'Rol genares creado sin contraseña. Ejecuta: ALTER ROLE genares WITH PASSWORD ''...'';';
  ELSE
    RAISE NOTICE 'El rol genares ya existe; no se modifican sus atributos ni su contraseña.';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE genares_integrado_dev TO genares;

-- S4 consulta gen, S2 y S3, y escribe en s4. No necesita s1.
GRANT USAGE ON SCHEMA gen, s2, s3, s4 TO genares;

-- Lectura de datos de otros subsistemas (S4 no los modifica).
GRANT SELECT ON gen.carrera, gen.modalidad, gen.periodo_academico, gen.persona,
  gen.estudiante, gen.docente, gen.tema TO genares;
GRANT SELECT ON s2.asignacion_tema, s2.grupo_integrante TO genares;
GRANT SELECT ON s3.asignacion_tribunal, s3.miembros_tribunal,
  s3.docente_carrera_periodo TO genares;

-- Lectura de las tablas propias de S4. Las escrituras de rúbricas, cronograma y actas
-- se conceden en backend/fixtures/permisos-operacion-s4.sql.
GRANT SELECT ON s4.rubricas, s4.versiones_rubrica, s4.etapas_rubrica,
  s4.categorias_rubrica, s4.indicadores_rubrica, s4.procesos_evaluacion,
  s4.evaluaciones, s4.calificaciones_evaluacion, s4.programaciones_sustentacion,
  s4.programacion_estudiante TO genares;

-- Evaluaciones y puntajes: solo las columnas que escribe el backend.
GRANT INSERT (id_proceso_evaluacion, id_asignacion_tribunal, id_version_rubrica,
  id_etapa_rubrica, id_estudiante, etapa, estado, instantanea_rubrica, revision)
  ON s4.evaluaciones TO genares;
GRANT UPDATE (estado, cerrada_en, calificacion_total, revision, actualizado_en)
  ON s4.evaluaciones TO genares;
GRANT INSERT (id_evaluacion, id_indicador, score, observation,
  instantanea_calificacion_maxima) ON s4.calificaciones_evaluacion TO genares;
GRANT UPDATE (score, observation, instantanea_calificacion_maxima)
  ON s4.calificaciones_evaluacion TO genares;
GRANT INSERT (id_evaluacion, actor_id, accion, detalles, ocurrido_en)
  ON s4.eventos_auditoria_evaluacion TO genares;
GRANT UPDATE (actualizado_en) ON s4.procesos_evaluacion TO genares;

COMMIT;
