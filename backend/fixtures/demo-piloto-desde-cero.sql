-- SOLO DESARROLLO · rama demo/accesos-por-rol · Trabajos «PILOTO» para recorrer S4 desde cero.
-- Ejecutar conectado como postgres a genares_integrado_dev. Es idempotente: si se repite, no duplica nada.
-- Todo va en una transacción: si algo falla, no queda nada a medias.
--
-- Requisitos, en este orden:
--   1. los scripts de docs/s4/base-datos-dev;
--   2. s4-retencion-visibilidad-auditoria.sql y s4-escalas-calificacion.sql;
--   3. La rúbrica oficial V1 debe estar ACTIVA y vigente en DEV-TI y DEV-SOFT (la carga 002 ya la incluye).
--
-- Qué crea (prefijo PILOTO, identificadores deterministas s4.uuid_fixture('piloto-…')):
--   · 8 docentes de tribunal con cuenta para entrar en la demo (contraseña Demo2026!):
--       TI:       tribunal.ti1 … tribunal.ti4
--       Software: tribunal.soft1 … tribunal.soft4
--   · 4 trabajos por carrera en DEV-2026B, modalidad DEV-PROYECTO; el tercero de cada carrera es una bina.
--     Tribunales (2 miembros de su carrera): trabajo 1 → 1 y 2 · trabajo 2 → 3 y 4 · trabajo 3 → 1 y 3 · trabajo 4 → 2 y 4.
--     Así cada docente califica 2 trabajos.
--   · Cada trabajo llega solo hasta «Trabajo registrado» y «Tribunal confirmado»: su proceso S4 existe con la rúbrica
--     vigente (V1). La trazabilidad registra los hitos iniciales del piloto y continúa
--     al usar el sistema (programar, reprogramar, corregir, finalizar…). El piloto empieza sin sesiones ni evaluaciones.
--
-- No toca los datos DEV ni CARGA. Para que Coordinación no vea los trabajos CARGA: s4-carga-volumen-dev-ocultar.sql.
-- Las cuentas de la demo están también en backend/src/common/api/identidad-demo.ts (los sujetos deben coincidir).
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Base incorrecta: ejecuta este archivo en genares_integrado_dev';
  END IF;
  IF to_regprocedure('s4.uuid_fixture(text)') IS NULL OR to_regprocedure('s4.incorporar_asignacion_desde_s3(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Ejecuta antes los scripts de docs/s4/base-datos-dev';
  END IF;
  IF (SELECT count(DISTINCT c.codigo) FROM s4.vigencias_rubrica_carrera vig
      JOIN s4.versiones_rubrica v ON v.id = vig.id_version_rubrica AND v.estado = 'ACTIVA' AND v.estado_registro = 1
      JOIN gen.carrera c ON c.id = vig.id_carrera
      WHERE c.codigo IN ('DEV-TI', 'DEV-SOFT') AND vig.vigente_hasta IS NULL AND vig.estado_registro = 1) <> 2 THEN
    RAISE EXCEPTION 'Ejecuta antes s4-rubrica-vigente-proyecto-integrador.sql: falta una rúbrica vigente en DEV-TI o DEV-SOFT';
  END IF;
END
$$;

-- 1. Docentes de tribunal, con su cuenta y su participación en el período.
INSERT INTO gen.persona (id, identificacion, nombres, apellidos)
SELECT s4.uuid_fixture('piloto-persona-doc-' || d.clave), 'PILOTO-ID-DOC-' || upper(d.clave), d.nombres, d.apellidos
FROM (VALUES
  ('ti-1', 'Andrea', 'Piloto TI 1'), ('ti-2', 'Bernardo', 'Piloto TI 2'),
  ('ti-3', 'Camila', 'Piloto TI 3'), ('ti-4', 'Daniel', 'Piloto TI 4'),
  ('soft-1', 'Elena', 'Piloto Software 1'), ('soft-2', 'Fernando', 'Piloto Software 2'),
  ('soft-3', 'Gabriela', 'Piloto Software 3'), ('soft-4', 'Héctor', 'Piloto Software 4')
) AS d(clave, nombres, apellidos)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.usuario (id, email, activo, persona_id, sujeto_autenticacion)
SELECT s4.uuid_fixture('piloto-usuario-' || d), 'demo-piloto-' || d || '@genares.invalid', true,
       s4.uuid_fixture('piloto-persona-doc-' || d), 'demo-piloto-' || d
FROM unnest(ARRAY['ti-1', 'ti-2', 'ti-3', 'ti-4', 'soft-1', 'soft-2', 'soft-3', 'soft-4']) d
ON CONFLICT (id) DO NOTHING;

INSERT INTO gen.docente (id, persona_id, carrera_id, activo, fuente, usuario_id)
SELECT s4.uuid_fixture('piloto-doc-' || d), s4.uuid_fixture('piloto-persona-doc-' || d),
       s4.uuid_fixture(CASE WHEN d LIKE 'ti-%' THEN 'carrera-ti' ELSE 'carrera-soft' END), true, 'MANUAL',
       s4.uuid_fixture('piloto-usuario-' || d)
FROM unnest(ARRAY['ti-1', 'ti-2', 'ti-3', 'ti-4', 'soft-1', 'soft-2', 'soft-3', 'soft-4']) d
ON CONFLICT (id) DO NOTHING;

INSERT INTO s3.docente_carrera_periodo (docente_carrera_periodo_id, docente_id, carrera_id, periodo_academico_id)
SELECT s4.uuid_fixture('piloto-dcp-' || d), s4.uuid_fixture('piloto-doc-' || d),
       s4.uuid_fixture(CASE WHEN d LIKE 'ti-%' THEN 'carrera-ti' ELSE 'carrera-soft' END), s4.uuid_fixture('periodo-2026b')
FROM unnest(ARRAY['ti-1', 'ti-2', 'ti-3', 'ti-4', 'soft-1', 'soft-2', 'soft-3', 'soft-4']) d
ON CONFLICT (docente_carrera_periodo_id) DO NOTHING;

INSERT INTO s3.miembros_tribunal (miembro_tribunal_id, docente_carrera_periodo_id)
SELECT s4.uuid_fixture('piloto-mt-' || d), s4.uuid_fixture('piloto-dcp-' || d)
FROM unnest(ARRAY['ti-1', 'ti-2', 'ti-3', 'ti-4', 'soft-1', 'soft-2', 'soft-3', 'soft-4']) d
ON CONFLICT (miembro_tribunal_id) DO NOTHING;

-- 2. Trabajos: S2 (tema, postulación, asignación y tutor) y S3 (tribunal). S4 solo crea su proceso con la rúbrica vigente.
DO $$
DECLARE
  car text; k integer; j integer; n integer; es_bina boolean;
  clave text; tema uuid; asig uuid; post uuid; grupo uuid; proceso uuid; version_proceso uuid; version_vigente uuid;
  estudiantes uuid[];
  miembros text[];
  hito record;
  pt uuid := s4.uuid_fixture('periodo-titulacion');
  -- Tribunal de cada trabajo (posición dentro de la carrera).
  tribunales constant integer[][] := ARRAY[[1, 2], [3, 4], [1, 3], [2, 4]];
BEGIN
  FOREACH car IN ARRAY ARRAY['ti', 'soft'] LOOP
    SELECT vig.id_version_rubrica INTO version_vigente
    FROM s4.vigencias_rubrica_carrera vig
    JOIN s4.versiones_rubrica v ON v.id = vig.id_version_rubrica AND v.estado = 'ACTIVA' AND v.estado_registro = 1
    WHERE vig.id_carrera = s4.uuid_fixture('carrera-' || car) AND vig.id_modalidad = s4.uuid_fixture('mod-proyecto')
      AND vig.periodo_academico_id = s4.uuid_fixture('periodo-2026b')
      AND vig.vigente_hasta IS NULL AND vig.estado_registro = 1;

    FOR k IN 1..4 LOOP
      clave := car || '-' || k;
      es_bina := k = 3;
      n := CASE WHEN es_bina THEN 2 ELSE 1 END;
      tema := s4.uuid_fixture('piloto-tema-' || clave);
      asig := s4.uuid_fixture('piloto-asig-' || clave);
      post := s4.uuid_fixture('piloto-post-' || clave);
      grupo := CASE WHEN es_bina THEN s4.uuid_fixture('piloto-grupo-' || clave) END;
      estudiantes := ARRAY[]::uuid[];

      FOR j IN 1..n LOOP
        INSERT INTO gen.persona (id, identificacion, nombres, apellidos)
        VALUES (s4.uuid_fixture('piloto-persona-' || clave || '-' || j), 'PILOTO-ID-E-' || upper(clave) || '-' || j,
                'Estudiante' || j, 'Piloto ' || CASE car WHEN 'ti' THEN 'TI' ELSE 'Software' END || ' ' || k)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO gen.estudiante (id, persona_id, carrera_id, matricula, codigo_institucional)
        VALUES (s4.uuid_fixture('piloto-est-' || clave || '-' || j), s4.uuid_fixture('piloto-persona-' || clave || '-' || j),
                s4.uuid_fixture('carrera-' || car), 'PILOTO-E-' || upper(clave) || '-' || j, 'PILOTO-E-' || upper(clave) || '-' || j)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO s2.estudiante_habilitado (id, periodo_id, estudiante_id, origen, estado, condicion_ingreso, situacion_ingreso, fecha_habilitacion)
        VALUES (s4.uuid_fixture('piloto-hab-' || clave || '-' || j), pt, s4.uuid_fixture('piloto-est-' || clave || '-' || j),
                'MANUAL', 'HABILITADO', 'SIN_CONDICION', 'REGULAR', now())
        ON CONFLICT (id) DO NOTHING;
        estudiantes := estudiantes || s4.uuid_fixture('piloto-est-' || clave || '-' || j);
      END LOOP;

      INSERT INTO gen.tema (id, periodo_titulacion_id, linea_id, docente_proponente_id, titulo, descripcion,
        min_integrantes, max_integrantes, estado, modalidad_id, tutor_usuario_id, carrera_id, periodo_academico_id, fecha_creacion)
      VALUES (tema, pt, s4.uuid_fixture('linea-demo'), s4.uuid_fixture('doc-tutor-' || car),
        'PILOTO - Trabajo ' || CASE car WHEN 'ti' THEN 'TI' ELSE 'Software' END || ' ' || k || CASE WHEN es_bina THEN ' (bina)' ELSE '' END,
        'Dato ficticio para recorrer S4 desde cero', n, n, 'ASIGNADO', s4.uuid_fixture('mod-proyecto'),
        s4.uuid_fixture('usuario-tutor-' || car), s4.uuid_fixture('carrera-' || car), s4.uuid_fixture('periodo-2026b'), current_date)
      ON CONFLICT (id) DO NOTHING;

      IF es_bina THEN
        INSERT INTO s2.grupo (id, periodo_id, nombre, estado, creado_en)
        VALUES (grupo, pt, 'PILOTO - Bina ' || clave, 'ACTIVO', now()) ON CONFLICT (id) DO NOTHING;
        FOR j IN 1..n LOOP
          INSERT INTO s2.grupo_integrante (id, grupo_id, periodo_id, estudiante_id, rol_en_grupo, estado, fecha_ingreso)
          VALUES (s4.uuid_fixture('piloto-gi-' || clave || '-' || j), grupo, pt, estudiantes[j],
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
      VALUES (s4.uuid_fixture('piloto-tutor-' || clave), asig, s4.uuid_fixture('doc-tutor-' || car), 'PRINCIPAL', 'ACTIVA',
              s4.uuid_fixture('usuario-admin'), now())
      ON CONFLICT (id) DO NOTHING;

      miembros := ARRAY[car || '-' || tribunales[k][1], car || '-' || tribunales[k][2]];
      INSERT INTO s3.asignacion_tribunal (asignacion_tribunal_id, miembro_tribunal_id, asignacion_tema_id)
      SELECT s4.uuid_fixture('piloto-at-' || clave || '-' || m), s4.uuid_fixture('piloto-mt-' || m), asig
      FROM unnest(miembros) m
      ON CONFLICT (asignacion_tribunal_id) DO NOTHING;

      -- El proceso toma la rúbrica ACTIVA y vigente de la carrera, igual que al abrir la evaluación.
      proceso := s4.incorporar_asignacion_desde_s3(asig);
      SELECT id_version_rubrica INTO version_proceso FROM s4.procesos_evaluacion WHERE id = proceso;
      IF version_proceso IS NULL OR version_proceso IS DISTINCT FROM version_vigente THEN
        RAISE EXCEPTION 'El trabajo PILOTO % no recibió la rúbrica vigente de su carrera', clave;
      END IF;

      -- S3 solo persiste asignaciones. S4 interpreta su presencia como tribunal confirmado.
      FOR hito IN
        SELECT * FROM (VALUES
          (1, 'TRABAJO_REGISTRADO', 'S2', 'DIRECTA', 'Asignación de tema vigente en el seeder piloto.'),
          (2, 'TRIBUNAL_ASIGNADO', 'S3', 'DIRECTA', 'Dos miembros de tribunal asignados por el seeder piloto.'),
          (3, 'TRIBUNAL_CONFIRMADO', 'S3', 'RECONSTRUIDA', 'S4 muestra como confirmado el tribunal asignado en el piloto.')
        ) AS eventos(orden, tipo, origen, evidencia, descripcion)
        ORDER BY orden
      LOOP
        INSERT INTO s4.eventos_trazabilidad_trabajo
          (id, id_proceso_evaluacion, ocurrido_en, tipo_evento, entidad_tipo, entidad_id, origen, evidencia, detalles)
        VALUES (s4.uuid_fixture('piloto-hito-' || clave || '-' || hito.tipo), proceso, clock_timestamp(),
                hito.tipo, 'ASIGNACION_TEMA', asig, hito.origen, hito.evidencia, jsonb_build_object('descripcion', hito.descripcion))
        ON CONFLICT (id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END
$$;

DO $$
DECLARE trabajos integer; estudiantes integer; docentes integer; con_actividad integer;
BEGIN
  SELECT count(*) INTO trabajos FROM s2.asignacion_tema a JOIN gen.tema t ON t.id = a.tema_id
    JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
   WHERE t.titulo LIKE 'PILOTO - %' AND a.estado = 'VIGENTE';
  SELECT count(*) INTO estudiantes FROM gen.estudiante WHERE matricula LIKE 'PILOTO-E-%';
  SELECT count(*) INTO docentes FROM gen.docente d JOIN gen.usuario u ON u.id = d.usuario_id
   WHERE u.sujeto_autenticacion LIKE 'demo-piloto-%';
  SELECT count(*) INTO con_actividad FROM s4.procesos_evaluacion p JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
    JOIN gen.tema t ON t.id = a.tema_id
   WHERE t.titulo LIKE 'PILOTO - %'
     AND (EXISTS (SELECT 1 FROM s4.evaluaciones e WHERE e.id_proceso_evaluacion = p.id)
       OR EXISTS (SELECT 1 FROM s4.programaciones_sustentacion s WHERE s.id_proceso_evaluacion = p.id));
  RAISE NOTICE 'PILOTO listo: % trabajos, % estudiantes, % docentes con cuenta; % trabajos ya tienen sesiones o evaluaciones.',
    trabajos, estudiantes, docentes, con_actividad;
END
$$;

COMMIT;
