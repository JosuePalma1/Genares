-- SOLO DESARROLLO · Volumen para la prueba de carga (RNF-03): 200 trabajos ficticios «CARGA».
-- Ejecutar conectado como postgres a genares_integrado_dev, después de los scripts de docs/s4/base-datos-dev
-- y de s4-sesion-evaluacion-oral.sql. Es idempotente: si se repite, no duplica nada.
-- Todo va en una transacción: si algo falla, no queda nada a medias.
--
-- Qué crea (todo con el prefijo CARGA, identificadores deterministas s4.uuid_fixture('carga-…')):
--   · 200 temas y asignaciones VIGENTES de S2 en DEV-2026B, mitad DEV-TI y mitad DEV-SOFT;
--     40 % son binas. Unos 280 estudiantes ficticios.
--   · Un tribunal propio por carrera (2 docentes CARGA), para no ocupar el horario de los docentes DEV.
--   · El proceso S4 de cada trabajo con s4.incorporar_asignacion_desde_s3 (rúbrica DEV-1).
--   · Avance variado, para que haya todos los estados:
--       20 % sin evaluaciones · 20 % con una escrita cerrada · 20 % con las dos escritas cerradas
--       20 % además con sustentación programada · 20 % además con las orales cerradas.
--     Las sesiones son en enero de 2027, en aulas CARGA-AULA-*, sin solaparse.
--   · Las evaluaciones se crean en BORRADOR, se les ponen las notas y se cierran, como en Genares.
--
-- No toca los datos DEV existentes. Para retirar este volumen: s4-carga-volumen-dev-ocultar.sql
-- (oculta los procesos con estado_registro = 0; en S4 no se borra nada).
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
  IF to_regprocedure('s4.uuid_fixture(text)') IS NULL OR to_regprocedure('s4.incorporar_asignacion_desde_s3(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Ejecuta antes los scripts de docs/s4/base-datos-dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 's4' AND table_name = 'evaluaciones' AND column_name = 'id_programacion_sustentacion') THEN
    RAISE EXCEPTION 'Ejecuta antes s4-sesion-evaluacion-oral.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM s4.versiones_rubrica WHERE id = s4.uuid_fixture('version-proyecto') AND estado = 'ACTIVA') THEN
    RAISE EXCEPTION 'La versión DEV-1 debe estar ACTIVA para asignar la rúbrica a los trabajos CARGA';
  END IF;
END
$$;

-- Tribunal propio por carrera.
INSERT INTO gen.persona (id, identificacion, nombres, apellidos) VALUES
  (s4.uuid_fixture('carga-persona-doc-ti-a'), 'CARGA-ID-DOC-TI-A', 'Ana', 'Docente Carga TI A'),
  (s4.uuid_fixture('carga-persona-doc-ti-b'), 'CARGA-ID-DOC-TI-B', 'Bruno', 'Docente Carga TI B'),
  (s4.uuid_fixture('carga-persona-doc-soft-a'), 'CARGA-ID-DOC-SOFT-A', 'Clara', 'Docente Carga Software A'),
  (s4.uuid_fixture('carga-persona-doc-soft-b'), 'CARGA-ID-DOC-SOFT-B', 'Diego', 'Docente Carga Software B')
ON CONFLICT (id) DO NOTHING;
INSERT INTO gen.docente (id, persona_id, carrera_id, activo, fuente) VALUES
  (s4.uuid_fixture('carga-doc-ti-a'), s4.uuid_fixture('carga-persona-doc-ti-a'), s4.uuid_fixture('carrera-ti'), true, 'MANUAL'),
  (s4.uuid_fixture('carga-doc-ti-b'), s4.uuid_fixture('carga-persona-doc-ti-b'), s4.uuid_fixture('carrera-ti'), true, 'MANUAL'),
  (s4.uuid_fixture('carga-doc-soft-a'), s4.uuid_fixture('carga-persona-doc-soft-a'), s4.uuid_fixture('carrera-soft'), true, 'MANUAL'),
  (s4.uuid_fixture('carga-doc-soft-b'), s4.uuid_fixture('carga-persona-doc-soft-b'), s4.uuid_fixture('carrera-soft'), true, 'MANUAL')
ON CONFLICT (id) DO NOTHING;
INSERT INTO s3.docente_carrera_periodo (docente_carrera_periodo_id, docente_id, carrera_id, periodo_academico_id)
SELECT s4.uuid_fixture('carga-dcp-' || d), s4.uuid_fixture('carga-doc-' || d),
       s4.uuid_fixture(CASE WHEN d LIKE 'ti-%' THEN 'carrera-ti' ELSE 'carrera-soft' END), s4.uuid_fixture('periodo-2026b')
FROM unnest(ARRAY['ti-a', 'ti-b', 'soft-a', 'soft-b']) d
ON CONFLICT (docente_carrera_periodo_id) DO NOTHING;
INSERT INTO s3.miembros_tribunal (miembro_tribunal_id, docente_carrera_periodo_id)
SELECT s4.uuid_fixture('carga-mt-' || d), s4.uuid_fixture('carga-dcp-' || d)
FROM unnest(ARRAY['ti-a', 'ti-b', 'soft-a', 'soft-b']) d
ON CONFLICT (miembro_tribunal_id) DO NOTHING;

DO $$
DECLARE
  i integer; j integer; n integer;
  car text; es_bina boolean; avance integer; nota numeric(4, 2); hueco integer;
  tema uuid; asig uuid; post uuid; grupo uuid; proceso uuid; sesion uuid; ev uuid;
  estudiantes uuid[];
  v_version uuid := s4.uuid_fixture('version-proyecto');
  et_escrita uuid := s4.uuid_fixture('stage-written');
  et_oral uuid := s4.uuid_fixture('stage-oral');
  ind_escrito uuid := s4.uuid_fixture('ind-written');
  ind_oral uuid := s4.uuid_fixture('ind-oral');
  pt uuid := s4.uuid_fixture('periodo-titulacion');
  miembro text;
BEGIN
  FOR i IN 1..200 LOOP
    car := CASE WHEN i % 2 = 1 THEN 'ti' ELSE 'soft' END;
    es_bina := i % 5 IN (0, 1);
    avance := (i % 10) / 2;            -- 0..4, cada valor en el 20 % de los trabajos
    n := CASE WHEN es_bina THEN 2 ELSE 1 END;
    tema := s4.uuid_fixture('carga-tema-' || i);
    asig := s4.uuid_fixture('carga-asig-' || i);
    post := s4.uuid_fixture('carga-post-' || i);
    grupo := CASE WHEN es_bina THEN s4.uuid_fixture('carga-grupo-' || i) END;
    estudiantes := ARRAY[]::uuid[];

    FOR j IN 1..n LOOP
      INSERT INTO gen.persona (id, identificacion, nombres, apellidos)
      VALUES (s4.uuid_fixture('carga-persona-' || i || '-' || j), 'CARGA-ID-E-' || i || '-' || j,
              'Estudiante' || j, 'Carga ' || lpad(i::text, 3, '0'))
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO gen.estudiante (id, persona_id, carrera_id, matricula, codigo_institucional)
      VALUES (s4.uuid_fixture('carga-est-' || i || '-' || j), s4.uuid_fixture('carga-persona-' || i || '-' || j),
              s4.uuid_fixture('carrera-' || car), 'CARGA-E-' || i || '-' || j, 'CARGA-E-' || i || '-' || j)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO s2.estudiante_habilitado (id, periodo_id, estudiante_id, origen, estado, condicion_ingreso, situacion_ingreso, fecha_habilitacion)
      VALUES (s4.uuid_fixture('carga-hab-' || i || '-' || j), pt, s4.uuid_fixture('carga-est-' || i || '-' || j),
              'MANUAL', 'HABILITADO', 'SIN_CONDICION', 'REGULAR', now())
      ON CONFLICT (id) DO NOTHING;
      estudiantes := estudiantes || s4.uuid_fixture('carga-est-' || i || '-' || j);
    END LOOP;

    INSERT INTO gen.tema (id, periodo_titulacion_id, linea_id, docente_proponente_id, titulo, descripcion,
      min_integrantes, max_integrantes, estado, modalidad_id, tutor_usuario_id, carrera_id, periodo_academico_id, fecha_creacion)
    VALUES (tema, pt, s4.uuid_fixture('linea-demo'), s4.uuid_fixture('doc-tutor-' || car),
      'CARGA - Trabajo ' || lpad(i::text, 3, '0') || CASE WHEN es_bina THEN ' (bina)' ELSE '' END,
      'Dato ficticio para la prueba de carga', n, n, 'ASIGNADO', s4.uuid_fixture('mod-proyecto'),
      s4.uuid_fixture('usuario-tutor-' || car), s4.uuid_fixture('carrera-' || car), s4.uuid_fixture('periodo-2026b'), DATE '2026-09-01')
    ON CONFLICT (id) DO NOTHING;

    IF es_bina THEN
      INSERT INTO s2.grupo (id, periodo_id, nombre, estado, creado_en)
      VALUES (grupo, pt, 'CARGA - Bina ' || i, 'ACTIVO', now()) ON CONFLICT (id) DO NOTHING;
      FOR j IN 1..n LOOP
        INSERT INTO s2.grupo_integrante (id, grupo_id, periodo_id, estudiante_id, rol_en_grupo, estado, fecha_ingreso)
        VALUES (s4.uuid_fixture('carga-gi-' || i || '-' || j), grupo, pt, estudiantes[j],
                CASE WHEN j = 1 THEN 'REPRESENTANTE' ELSE 'INTEGRANTE' END, 'ACTIVO', now())
        ON CONFLICT (id) DO NOTHING;
      END LOOP;
    END IF;

    INSERT INTO s2.postulacion (id, tema_id, periodo_id, grupo_id, estudiante_id, num_integrantes, registrada_por_id, estado, fecha_postulacion)
    VALUES (post, tema, pt, grupo, CASE WHEN es_bina THEN NULL ELSE estudiantes[1] END, n,
            s4.uuid_fixture('usuario-admin'), 'APROBADA', now())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO s2.asignacion_tema (id, tema_id, postulacion_id, grupo_id, estudiante_id, aprobada_por_id, estado, fecha_asignacion)
    VALUES (asig, tema, post, grupo, CASE WHEN es_bina THEN NULL ELSE estudiantes[1] END,
            s4.uuid_fixture('usuario-admin'), 'VIGENTE', now())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO s2.asignacion_tutor (id, asignacion_tema_id, docente_id, tipo, estado, asignada_por_id, fecha_asignacion)
    VALUES (s4.uuid_fixture('carga-tutor-' || i), asig, s4.uuid_fixture('doc-tutor-' || car), 'PRINCIPAL', 'ACTIVA',
            s4.uuid_fixture('usuario-admin'), now())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO s3.asignacion_tribunal (asignacion_tribunal_id, miembro_tribunal_id, asignacion_tema_id)
    SELECT s4.uuid_fixture('carga-at-' || i || '-' || m), s4.uuid_fixture('carga-mt-' || car || '-' || m), asig
    FROM unnest(ARRAY['a', 'b']) m
    ON CONFLICT (asignacion_tribunal_id) DO NOTHING;

    proceso := s4.incorporar_asignacion_desde_s3(asig);
    IF (SELECT id_version_rubrica FROM s4.procesos_evaluacion WHERE id = proceso) IS DISTINCT FROM v_version THEN
      RAISE EXCEPTION 'El trabajo CARGA % no recibió la rúbrica DEV-1', i;
    END IF;

    -- Escritas: con avance 1 cierra solo el evaluador A; con avance ≥ 2, los dos.
    FOREACH miembro IN ARRAY ARRAY['a', 'b'] LOOP
      CONTINUE WHEN avance = 0 OR (avance = 1 AND miembro = 'b');
      ev := s4.uuid_fixture('carga-ev-escrita-' || i || '-' || miembro);
      nota := 6 + ((i * 7 + CASE WHEN miembro = 'a' THEN 0 ELSE 3 END) % 40) / 10.0;
      INSERT INTO s4.evaluaciones (id, id_proceso_evaluacion, id_asignacion_tribunal, id_version_rubrica, id_etapa_rubrica,
        etapa, estado, instantanea_rubrica, instantanea_calificacion_maxima, revision)
      VALUES (ev, proceso, s4.uuid_fixture('carga-at-' || i || '-' || miembro), v_version, et_escrita, 'ESCRITA', 'BORRADOR',
        jsonb_build_object('rubricVersionId', v_version::text, 'fixture', 'CARGA'), 10.00, 0)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO s4.calificaciones_evaluacion (id, id_evaluacion, id_indicador, score, instantanea_calificacion_maxima)
      SELECT s4.uuid_fixture('carga-cal-escrita-' || i || '-' || miembro), ev, ind_escrito, nota, 10.00
      WHERE EXISTS (SELECT 1 FROM s4.evaluaciones WHERE id = ev AND estado = 'BORRADOR')
      ON CONFLICT (id) DO NOTHING;
      UPDATE s4.evaluaciones SET estado = 'CERRADA', calificacion_total = nota, cerrada_en = now(), revision = 1
      WHERE id = ev AND estado = 'BORRADOR';
    END LOOP;

    -- Sesión (avance ≥ 3): una por trabajo, sin solaparse con las demás de la misma carrera.
    IF avance >= 3 THEN
      sesion := s4.uuid_fixture('carga-sesion-' || i);
      hueco := (i - 1) / 2;   -- mismo hueco para un trabajo TI y uno Software: tribunales y aulas distintos
      INSERT INTO s4.programaciones_sustentacion (id, id_proceso_evaluacion, fecha_programada, hora_programada,
        hora_fin_programada, sala, estado, tipo, scheduled_by_id_cuenta, scheduled_by_actor_id)
      VALUES (sesion, proceso, DATE '2027-01-04' + (hueco / 8), TIME '08:00' + make_interval(hours => hueco % 8),
        TIME '09:00' + make_interval(hours => hueco % 8), 'CARGA-AULA-' || upper(car), 'PROGRAMADA',
        CASE WHEN es_bina THEN 'CONJUNTA' ELSE 'INDIVIDUAL' END, s4.uuid_fixture('usuario-comision'), 'carga-dev')
      ON CONFLICT (id) DO NOTHING;
      FOR j IN 1..n LOOP
        INSERT INTO s4.programacion_estudiante (programacion_estudiante_id, programacion_sustentacion_id, id_estudiante)
        VALUES (s4.uuid_fixture('carga-pe-' || i || '-' || j), sesion, estudiantes[j])
        ON CONFLICT (programacion_estudiante_id) DO NOTHING;
      END LOOP;
    END IF;

    -- Orales (avance 4): cada evaluador califica a cada estudiante, ligada a su sesión.
    IF avance = 4 THEN
      FOR j IN 1..n LOOP
        FOREACH miembro IN ARRAY ARRAY['a', 'b'] LOOP
          ev := s4.uuid_fixture('carga-ev-oral-' || i || '-' || j || '-' || miembro);
          nota := 6.5 + ((i * 3 + j * 5 + CASE WHEN miembro = 'a' THEN 0 ELSE 2 END) % 35) / 10.0;
          INSERT INTO s4.evaluaciones (id, id_proceso_evaluacion, id_asignacion_tribunal, id_version_rubrica, id_etapa_rubrica,
            id_estudiante, etapa, estado, instantanea_rubrica, instantanea_calificacion_maxima, revision, id_programacion_sustentacion)
          VALUES (ev, proceso, s4.uuid_fixture('carga-at-' || i || '-' || miembro), v_version, et_oral, estudiantes[j], 'ORAL',
            'BORRADOR', jsonb_build_object('rubricVersionId', v_version::text, 'fixture', 'CARGA'), 10.00, 0,
            s4.uuid_fixture('carga-sesion-' || i))
          ON CONFLICT (id) DO NOTHING;
          INSERT INTO s4.calificaciones_evaluacion (id, id_evaluacion, id_indicador, score, instantanea_calificacion_maxima)
          SELECT s4.uuid_fixture('carga-cal-oral-' || i || '-' || j || '-' || miembro), ev, ind_oral, nota, 10.00
          WHERE EXISTS (SELECT 1 FROM s4.evaluaciones WHERE id = ev AND estado = 'BORRADOR')
          ON CONFLICT (id) DO NOTHING;
          UPDATE s4.evaluaciones SET estado = 'CERRADA', calificacion_total = nota, cerrada_en = now(), revision = 1
          WHERE id = ev AND estado = 'BORRADOR';
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE trabajos integer; estudiantes integer; evaluaciones integer; sesiones integer;
BEGIN
  SELECT count(*) INTO trabajos FROM s2.asignacion_tema a JOIN gen.tema t ON t.id = a.tema_id
    JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
   WHERE t.titulo LIKE 'CARGA - %' AND a.estado = 'VIGENTE';
  SELECT count(*) INTO estudiantes FROM gen.estudiante WHERE matricula LIKE 'CARGA-E-%';
  SELECT count(*) INTO evaluaciones FROM s4.evaluaciones WHERE instantanea_rubrica ->> 'fixture' = 'CARGA' AND estado = 'CERRADA';
  SELECT count(*) INTO sesiones FROM s4.programaciones_sustentacion WHERE sala LIKE 'CARGA-AULA-%';
  RAISE NOTICE 'Volumen CARGA listo: % trabajos visibles, % estudiantes, % evaluaciones cerradas, % sesiones.',
    trabajos, estudiantes, evaluaciones, sesiones;
END
$$;

COMMIT;
