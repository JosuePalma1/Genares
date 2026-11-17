-- =============================================================================================
-- Rúbrica VIGENTE de Proyecto Integrador: la carga y la deja vigente para las carreras indicadas.
--
-- Origen: «RUBRICA DEFENSA TRABAJO IC 5 PUNTOS» (docs/s4/Plantillas-documentos), Comisión
-- Académica carreras TIC's, Facultad de Ciencias de la Vida y Tecnologías.
--   Parte I  · Revisión proyecto escrito (50 %, 5 puntos): A 1.00 + B 1.00 + C 3.00
--   Parte II · Sustentación del proyecto (50 %, 5 puntos): D 2.50 + E 2.50
--   Calificación final sobre 10.00.
--
-- Cómo usarlo:
--   1. Cambie SOLO el bloque PARÁMETROS si la base no es la de desarrollo (por ejemplo, la base
--      integrada con S1, S2 y S3): códigos de modalidad, período y carreras.
--   2. Ejecútelo en pgAdmin como postgres. Necesita la retención de S4 instalada
--      (s4-retencion-visibilidad-auditoria.sql).
--
-- Qué hace (se puede repetir; no duplica nada):
--   - crea la versión en la rúbrica de la modalidad (la base admite una rúbrica por modalidad);
--     una versión ya creada no se modifica;
--   - la activa; la versión activa anterior de ese período pasa a ARCHIVADA (por ejemplo, DEV-1);
--   - para cada carrera cierra la vigencia anterior (de otra versión) y abre la de esta, igual que
--     la pantalla de Rúbricas. Así la asignación automática elige esta versión para los trabajos nuevos.
--   - No toca los trabajos que ya tienen rúbrica: una versión ya aplicada no se cambia.
--
-- Si la norma cambia, cree una versión nueva (p_version = 'V2', con su estructura) en vez de editar esta.
-- La misma estructura está en docs/s4/base-datos-dev/002_integracion_s2_s3_s4_dev.sql: mantenga ambas iguales.
-- =============================================================================================
BEGIN;

-- Queda registrado como autor en el historial de cambios de S4.
SELECT set_config('s4.actor_id', 'FIXTURE:RUBRICA_VIGENTE_PROYECTO_INTEGRADOR', true);

DO $$
DECLARE
  -- ============================== PARÁMETROS ==============================
  p_modalidad constant text := 'DEV-PROYECTO';                 -- gen.modalidad.codigo
  p_periodo   constant text := 'DEV-2026B';                    -- gen.periodo_academico.codigo
  p_carreras  constant text[] := ARRAY['DEV-TI', 'DEV-SOFT'];  -- gen.carrera.codigo
  p_version   constant text := 'V1';
  -- ========================================================================
  c_nombre constant text := 'Rúbrica de evaluación de trabajo de integración curricular';
  c_descripcion constant text := 'Fuente: Comisión Académica carreras Tic´s Facultad de Ciencias de la Vida y Tecnologías';
  v_modalidad uuid; v_periodo uuid; v_rubrica uuid; v_version uuid; v_etapa uuid; v_categoria uuid;
  v_estado text; v_cierre timestamptz;
  v_codigo text; v_carrera uuid; v_anterior record;
  etapa record; categoria record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 's4' AND table_name = 'vigencias_rubrica_carrera' AND column_name = 'estado_registro') THEN
    RAISE EXCEPTION 'Ejecute antes s4-retencion-visibilidad-auditoria.sql';
  END IF;

  SELECT id INTO v_modalidad FROM gen.modalidad WHERE codigo = p_modalidad;
  IF v_modalidad IS NULL THEN RAISE EXCEPTION 'No existe la modalidad con código %', p_modalidad; END IF;
  SELECT id INTO v_periodo FROM gen.periodo_academico WHERE codigo = p_periodo;
  IF v_periodo IS NULL THEN RAISE EXCEPTION 'No existe el período académico con código %', p_periodo; END IF;
  FOREACH v_codigo IN ARRAY p_carreras LOOP
    IF NOT EXISTS (SELECT 1 FROM gen.carrera WHERE codigo = v_codigo) THEN
      RAISE EXCEPTION 'No existe la carrera con código %', v_codigo;
    END IF;
  END LOOP;

  -- 1. Rúbrica de la modalidad. La base admite una sola por modalidad (uq_s4_rubricas_id_modalidad):
  --    la oficial es una VERSIÓN nueva de esa rúbrica. Si la rúbrica ya existe se conserva su nombre,
  --    porque una rúbrica con versiones usadas no se puede modificar (retención de S4).
  SELECT id INTO v_rubrica FROM s4.rubricas WHERE id_modalidad = v_modalidad;
  IF v_rubrica IS NULL THEN
    INSERT INTO s4.rubricas (id_modalidad, nombre, descripcion)
    VALUES (v_modalidad, c_nombre, c_descripcion) RETURNING id INTO v_rubrica;
  END IF;

  -- 2. Versión con su estructura. Si ya existe, no se modifica.
  SELECT id, estado INTO v_version, v_estado FROM s4.versiones_rubrica
  WHERE id_rubrica = v_rubrica AND version = p_version AND estado_registro = 1;
  IF v_version IS NULL THEN
    INSERT INTO s4.versiones_rubrica (id_rubrica, periodo_academico_id, version, estado, revision)
    VALUES (v_rubrica, v_periodo, p_version, 'BORRADOR', 1) RETURNING id, estado INTO v_version, v_estado;

    FOR etapa IN SELECT * FROM (VALUES
      ('ESCRITA', 'TRABAJO_COMPARTIDO',    'ESCRITA', 'Revisión proyecto escrito', 5.00, 50.00, 1),
      ('ORAL',    'ESTUDIANTE_INDIVIDUAL', 'ORAL',    'Sustentación del proyecto', 5.00, 50.00, 2)
    ) AS e(kind, scope, codigo, nombre, maximo, porcentaje, orden) LOOP
      INSERT INTO s4.etapas_rubrica (id_version_rubrica, kind, scope, codigo, nombre, calificacion_maxima, porcentaje, orden)
      VALUES (v_version, etapa.kind, etapa.scope, etapa.codigo, etapa.nombre, etapa.maximo, etapa.porcentaje, etapa.orden)
      RETURNING id INTO v_etapa;

      -- El orden de las categorías es único en toda la versión (lo exige la activación).
      FOR categoria IN SELECT * FROM (VALUES
        ('ESCRITA', 'A', 'Resumen e introducción', 1.00, 1),
        ('ESCRITA', 'B', 'Marco teórico de la investigación', 1.00, 2),
        ('ESCRITA', 'C', 'Diagnóstico o estudio de campo', 3.00, 3),
        ('ORAL',    'D', 'Empoderamiento y defensa del trabajo realizado', 2.50, 4),
        ('ORAL',    'E', 'Conclusiones y Propuesta', 2.50, 5)
      ) AS c(etapa, codigo, nombre, maximo, orden) WHERE c.etapa = etapa.codigo LOOP
        INSERT INTO s4.categorias_rubrica (id_version_rubrica, id_etapa_rubrica, codigo, nombre, calificacion_maxima, orden)
        VALUES (v_version, v_etapa, categoria.codigo, categoria.nombre, categoria.maximo, categoria.orden)
        RETURNING id INTO v_categoria;

        INSERT INTO s4.indicadores_rubrica (id_categoria, label, descripcion, calificacion_maxima, orden)
        SELECT v_categoria, i.categoria || i.orden, i.descripcion, i.maximo, i.orden
        FROM (VALUES
          ('A', 1, 'El resumen o síntesis hace referencia al objetivo planteado', 0.33),
          ('A', 2, 'Aborda el problema, métodos y técnicas de manera lógica y coherente', 0.33),
          ('A', 3, 'La introducción resume de manera descriptiva el contexto, justificación, interrogantes de estudio en relación con el tema investigado.', 0.34),
          ('B', 1, 'En el marco teórico se evidencia el análisis de los principales conceptos y posiciones que se manejan en la teoría sobre el tema que se investiga.', 0.33),
          ('B', 2, 'Se define de manera asertiva citas y ejemplos de otras investigaciones realizadas sobre la temática que direcciona a la investigación.', 0.33),
          ('B', 3, 'Evidencia la adopción de una postura teórica y el análisis crítico en relación con qué criterios comparten y cuáles no comparten.', 0.34),
          ('C', 1, 'Se aplica una metodología que cubra las etapas del desarrollo del proyecto integrador.', 1.00),
          ('C', 2, 'Se evidencia en la propuesta y su relación con la temática planteada: análisis, diseño e implementación de Tecnologías de Información.', 1.00),
          ('C', 3, 'El informe presenta coherencia, cohesión léxica, cohesión gramatical.', 1.00),
          ('D', 1, 'Evidencia empoderamiento de la temática de manera lógica y coherente.', 0.83),
          ('D', 2, 'Justifica el problema, desde las interrogantes de estudio en relación con el tema investigado, los objetivos planteados en el problema, métodos y técnicas aplicadas.', 0.83),
          ('D', 3, 'Demuestra conocimientos sobre los principales conceptos del tema, evidenciando una postura desde el análisis crítico, hacia los criterios que comparte.', 0.84),
          ('E', 1, 'Dominio sobre los resultados obtenidos, que permitan ver de manera clara los diferentes métodos y técnicas de investigación aplicadas.', 0.83),
          ('E', 2, 'Demuestra que las conclusiones son pertinentes y coherentes con los resultados de la investigación.', 0.83),
          ('E', 3, 'La propuesta es pertinente y se apoya en teorías que fortalecen la temática investigada', 0.84)
        ) AS i(categoria, orden, descripcion, maximo)
        WHERE i.categoria = categoria.codigo;
      END LOOP;
    END LOOP;
  ELSIF (SELECT periodo_academico_id FROM s4.versiones_rubrica WHERE id = v_version) <> v_periodo THEN
    RAISE EXCEPTION 'La versión % ya existe para otro período; use otro p_version', p_version;
  END IF;

  -- 3. Comprobaciones: cada indicador, categoría y etapa cuadra, y las partes suman 100 %.
  IF (SELECT count(*) FROM s4.etapas_rubrica WHERE id_version_rubrica = v_version AND estado_registro = 1) <> 2
    OR (SELECT sum(porcentaje) FROM s4.etapas_rubrica WHERE id_version_rubrica = v_version AND estado_registro = 1) IS DISTINCT FROM 100
    OR (SELECT count(*) FROM s4.indicadores_rubrica i JOIN s4.categorias_rubrica c ON c.id = i.id_categoria
        WHERE c.id_version_rubrica = v_version AND i.estado_registro = 1 AND c.estado_registro = 1) <> 15
    OR EXISTS (SELECT 1 FROM s4.etapas_rubrica e WHERE e.id_version_rubrica = v_version AND e.estado_registro = 1
      AND (SELECT sum(c.calificacion_maxima) FROM s4.categorias_rubrica c WHERE c.id_etapa_rubrica = e.id AND c.estado_registro = 1)
        IS DISTINCT FROM e.calificacion_maxima)
    OR EXISTS (SELECT 1 FROM s4.categorias_rubrica c WHERE c.id_version_rubrica = v_version AND c.estado_registro = 1
      AND (SELECT sum(i.calificacion_maxima) FROM s4.indicadores_rubrica i WHERE i.id_categoria = c.id AND i.estado_registro = 1)
        IS DISTINCT FROM c.calificacion_maxima)
  THEN
    RAISE EXCEPTION 'La versión % de la rúbrica no tiene la estructura esperada (A–E, 5 + 5 puntos)', p_version;
  END IF;

  -- 4. Activar la versión. Como en la pantalla de Rúbricas, la versión activa anterior de la misma rúbrica y
  --    período pasa a ARCHIVADA: deja de asignarse a trabajos nuevos, pero los que ya la tienen la conservan.
  IF v_estado <> 'ACTIVA' THEN
    UPDATE s4.versiones_rubrica SET estado = 'ARCHIVADA'
    WHERE id_rubrica = v_rubrica AND periodo_academico_id = v_periodo AND estado = 'ACTIVA' AND id <> v_version;
    UPDATE s4.versiones_rubrica SET estado = 'ACTIVA', activada_en = COALESCE(activada_en, now()) WHERE id = v_version;
  END IF;

  -- 5. Vigencia por carrera: se cierra la de otra versión y se abre la de esta.
  FOREACH v_codigo IN ARRAY p_carreras LOOP
    SELECT id INTO v_carrera FROM gen.carrera WHERE codigo = v_codigo;
    INSERT INTO s4.versiones_rubrica_carreras (id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id, asociado_en)
    VALUES (v_version, v_carrera, v_rubrica, v_modalidad, v_periodo, now())
    ON CONFLICT (id_version_rubrica, id_carrera) DO NOTHING;

    SELECT id, id_version_rubrica INTO v_anterior FROM s4.vigencias_rubrica_carrera
    WHERE id_carrera = v_carrera AND id_modalidad = v_modalidad AND periodo_academico_id = v_periodo
      AND vigente_hasta IS NULL AND estado_registro = 1
    FOR UPDATE;
    CONTINUE WHEN v_anterior.id IS NOT NULL AND v_anterior.id_version_rubrica = v_version;

    v_cierre := clock_timestamp();
    IF v_anterior.id IS NOT NULL THEN
      UPDATE s4.vigencias_rubrica_carrera SET vigente_hasta = v_cierre WHERE id = v_anterior.id;
    END IF;
    INSERT INTO s4.vigencias_rubrica_carrera (id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id, vigente_desde)
    VALUES (v_version, v_carrera, v_rubrica, v_modalidad, v_periodo, v_cierre);
    RAISE NOTICE 'Carrera %: rúbrica % vigente%', v_codigo, p_version,
      CASE WHEN v_anterior.id IS NOT NULL THEN ' (sustituye a la versión anterior)' ELSE '' END;
  END LOOP;
END
$$;

COMMIT;
