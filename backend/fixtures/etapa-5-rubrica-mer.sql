BEGIN;

DO $$
DECLARE
  base s4.versiones_rubrica%ROWTYPE;
  version_prueba constant uuid := 'e5000000-0000-4000-8000-000000000001';
  escrita constant uuid := 'e5000000-0000-4000-8000-000000000002';
  oral constant uuid := 'e5000000-0000-4000-8000-000000000003';
  categoria record;
BEGIN
  IF current_database() <> 'genares_integrado_dev' THEN
    RAISE EXCEPTION 'Ejecuta este archivo en genares_integrado_dev';
  END IF;

  SELECT * INTO STRICT base FROM s4.versiones_rubrica
  WHERE id = '00db1712-d483-e1b5-e858-459f293ff7fa' AND version = 'DEV-1';

  IF NOT EXISTS (SELECT 1 FROM s4.versiones_rubrica WHERE id = version_prueba) THEN
    INSERT INTO s4.versiones_rubrica
      (id, id_rubrica, periodo_academico_id, id_version_base, version, estado, revision)
    VALUES (version_prueba, base.id_rubrica, base.periodo_academico_id, base.id,
      'DEV-ETAPA-5', 'BORRADOR', 1);

    INSERT INTO s4.etapas_rubrica
      (id, id_version_rubrica, kind, scope, codigo, nombre, calificacion_maxima, porcentaje, orden)
    VALUES
      (escrita, version_prueba, 'ESCRITA', 'TRABAJO_COMPARTIDO', 'DEV-E5', 'Escrita compartida', 10, 50, 1),
      (oral, version_prueba, 'ORAL', 'ESTUDIANTE_INDIVIDUAL', 'DEV-O5', 'Oral individual', 10, 50, 2);

    FOR categoria IN
      SELECT * FROM (VALUES
        (escrita, 'A', 'Planteamiento y método', 1, 'Problema y objetivos', 2.25, 'Diseño metodológico', 3.25),
        (escrita, 'B', 'Resultados y redacción', 2, 'Análisis de resultados', 3.00, 'Claridad del informe', 1.50),
        (oral, 'A', 'Presentación y dominio', 1, 'Exposición del trabajo', 2.50, 'Dominio del tema', 3.50),
        (oral, 'B', 'Argumentación y respuestas', 2, 'Sustento de las decisiones', 2.75, 'Respuesta al tribunal', 1.25)
      ) AS c(etapa, codigo, nombre, orden, indicador_1, maximo_1, indicador_2, maximo_2)
    LOOP
      WITH nueva AS (
        INSERT INTO s4.categorias_rubrica
          (id_version_rubrica, id_etapa_rubrica, codigo, nombre, orden, calificacion_maxima)
        VALUES (version_prueba, categoria.etapa, categoria.codigo, categoria.nombre, categoria.orden,
          categoria.maximo_1 + categoria.maximo_2)
        RETURNING id
      )
      INSERT INTO s4.indicadores_rubrica (id_categoria, label, calificacion_maxima, orden)
      SELECT id, categoria.indicador_1, categoria.maximo_1, 1 FROM nueva
      UNION ALL
      SELECT id, categoria.indicador_2, categoria.maximo_2, 2 FROM nueva;
    END LOOP;
  END IF;

  IF (SELECT count(*) FROM s4.etapas_rubrica WHERE id_version_rubrica = version_prueba) <> 2
    OR (SELECT sum(porcentaje) FROM s4.etapas_rubrica WHERE id_version_rubrica = version_prueba) IS DISTINCT FROM 100
    OR EXISTS (
      SELECT 1 FROM s4.etapas_rubrica e WHERE e.id_version_rubrica = version_prueba AND (
        SELECT sum(c.calificacion_maxima) FROM s4.categorias_rubrica c WHERE c.id_etapa_rubrica = e.id
      ) IS DISTINCT FROM e.calificacion_maxima
    )
    OR EXISTS (
      SELECT 1 FROM s4.categorias_rubrica c WHERE c.id_version_rubrica = version_prueba AND (
        SELECT sum(i.calificacion_maxima) FROM s4.indicadores_rubrica i WHERE i.id_categoria = c.id
      ) IS DISTINCT FROM c.calificacion_maxima
    )
  THEN
    RAISE EXCEPTION 'La estructura de DEV-ETAPA-5 tiene ponderaciones incompatibles';
  END IF;
END
$$;

GRANT UPDATE (estado, cerrada_en) ON s4.evaluaciones TO genares;

COMMIT;
