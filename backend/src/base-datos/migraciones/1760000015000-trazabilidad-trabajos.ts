import { MigrationInterface, QueryRunner } from 'typeorm';

/** Proyecta evidencia ya persistida y habilita eventos nuevos append-only por expediente. */
export class TrazabilidadTrabajos1760000015000 implements MigrationInterface {
  name = 'TrazabilidadTrabajos1760000015000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "eventos_trazabilidad_trabajo" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "id_trabajo" uuid NOT NULL REFERENCES "trabajos_titulacion"("id") ON DELETE RESTRICT,
        "ocurrido_en" timestamptz NOT NULL,
        "tipo_evento" varchar(80) NOT NULL,
        "entidad_tipo" varchar(60),
        "entidad_id" uuid,
        "actor_id" varchar(255),
        "actor_tipo" varchar(40),
        "origen" varchar(40) NOT NULL,
        "correlation_id" varchar(100),
        "detalles" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "evidencia" varchar(20) NOT NULL,
        "fuente_tipo" varchar(60) NOT NULL,
        "fuente_id" uuid NOT NULL,
        CONSTRAINT "chk_eventos_trazabilidad_tipo" CHECK (btrim("tipo_evento") <> ''),
        CONSTRAINT "chk_eventos_trazabilidad_origen" CHECK (btrim("origen") <> ''),
        CONSTRAINT "chk_eventos_trazabilidad_evidencia"
          CHECK ("evidencia" IN ('DIRECTA', 'PARCIAL', 'RECONSTRUIDA')),
        CONSTRAINT "chk_eventos_trazabilidad_detalles"
          CHECK (jsonb_typeof("detalles") = 'object')
      );
      CREATE INDEX "idx_eventos_trazabilidad_trabajo_fecha"
        ON "eventos_trazabilidad_trabajo" ("id_trabajo", "ocurrido_en" DESC, "id" DESC);
      CREATE INDEX "idx_eventos_trazabilidad_tipo_fecha"
        ON "eventos_trazabilidad_trabajo" ("tipo_evento", "ocurrido_en" DESC);
      CREATE UNIQUE INDEX "uq_eventos_trazabilidad_fuente"
        ON "eventos_trazabilidad_trabajo" ("id_trabajo", "fuente_tipo", "fuente_id", "tipo_evento");

      CREATE FUNCTION "proteger_eventos_trazabilidad_append_only"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Los eventos de trazabilidad son append-only.';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_eventos_trazabilidad_no_update_delete"
        BEFORE UPDATE OR DELETE ON "eventos_trazabilidad_trabajo"
        FOR EACH ROW EXECUTE FUNCTION "proteger_eventos_trazabilidad_append_only"();
      CREATE TRIGGER "trg_eventos_trazabilidad_no_truncate"
        BEFORE TRUNCATE ON "eventos_trazabilidad_trabajo"
        FOR EACH STATEMENT EXECUTE FUNCTION "proteger_eventos_trazabilidad_append_only"();
    `);

    await queryRunner.query(`
      CREATE FUNCTION "registrar_evento_trazabilidad_trabajo"(
        p_trabajo_uuid uuid, p_momento timestamptz, p_tipo varchar, p_entidad_tipo varchar,
        p_entidad_uuid uuid, p_actor varchar, p_actor_tipo varchar, p_origen varchar,
        p_correlacion varchar, p_detalle jsonb, p_evidencia varchar,
        p_fuente_tipo varchar, p_fuente_uuid uuid
      ) RETURNS void AS $$
      BEGIN
        IF p_trabajo_uuid IS NULL OR p_momento IS NULL THEN RETURN; END IF;
        INSERT INTO "eventos_trazabilidad_trabajo" (
          "id_trabajo", "ocurrido_en", "tipo_evento", "entidad_tipo", "entidad_id",
          "actor_id", "actor_tipo", "origen", "correlation_id", "detalles", "evidencia",
          "fuente_tipo", "fuente_id"
        ) VALUES (
          p_trabajo_uuid, p_momento, p_tipo, p_entidad_tipo, p_entidad_uuid, p_actor, p_actor_tipo,
          p_origen, p_correlacion, COALESCE(p_detalle, '{}'::jsonb), p_evidencia,
          p_fuente_tipo, p_fuente_uuid
        ) ON CONFLICT ("id_trabajo", "fuente_tipo", "fuente_id", "tipo_evento") DO NOTHING;
      END;
      $$ LANGUAGE plpgsql;

      CREATE FUNCTION "trazabilidad_trabajo_creado"() RETURNS trigger AS $$
      BEGIN
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          NEW."id", NEW."creado_en", 'TRABAJO_REGISTRADO', 'trabajo', NEW."id",
          NEW."created_by_id_cuenta"::text, 'CUENTA', 'TRABAJO', NULL,
          jsonb_build_object('codigo', NEW."codigo"), 'DIRECTA', 'trabajo', NEW."id"
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_trabajo_creado"
        AFTER INSERT ON "trabajos_titulacion" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_trabajo_creado"();

      CREATE FUNCTION "trazabilidad_estado_trabajo"() RETURNS trigger AS $$
      DECLARE actor varchar(255);
      BEGIN
        IF NEW."estado" IS DISTINCT FROM OLD."estado" THEN
          actor := NULLIF(current_setting('genares.actor_id', true), '');
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id", clock_timestamp(), 'TRABAJO_ESTADO_CAMBIADO', 'trabajo', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'TRABAJO',
            NULLIF(current_setting('genares.correlation_id', true), ''),
            jsonb_build_object('estadoAnterior', OLD."estado"::text, 'estadoNuevo', NEW."estado"::text),
            CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END,
            'trabajo_transicion', gen_random_uuid()
          );
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_estado_trabajo"
        AFTER UPDATE OF "estado" ON "trabajos_titulacion" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_estado_trabajo"();

      CREATE FUNCTION "trazabilidad_estado_tribunal"() RETURNS trigger AS $$
      DECLARE actor varchar(255);
      BEGIN
        IF NEW."estado" IS DISTINCT FROM OLD."estado" THEN
          actor := NULLIF(current_setting('genares.actor_id', true), '');
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", clock_timestamp(), 'TRIBUNAL_ESTADO_CAMBIADO', 'asignacion_tribunal', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'TRIBUNAL',
            NULLIF(current_setting('genares.correlation_id', true), ''),
            jsonb_build_object('estadoAnterior', OLD."estado"::text, 'estadoNuevo', NEW."estado"::text),
            CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END,
            'tribunal_transicion', gen_random_uuid()
          );
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_estado_tribunal"
        AFTER UPDATE OF "estado" ON "asignaciones_tribunal" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_estado_tribunal"();

      CREATE FUNCTION "trazabilidad_tribunal_creado"() RETURNS trigger AS $$
      BEGIN
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          NEW."id_trabajo", NEW."creado_en", 'TRIBUNAL_ASIGNADO', 'asignacion_tribunal', NEW."id",
          NEW."assigned_by_id_cuenta"::text, 'CUENTA', 'TRIBUNAL', NULL, '{}'::jsonb,
          'DIRECTA', 'asignacion_tribunal', NEW."id"
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_tribunal_creado"
        AFTER INSERT ON "asignaciones_tribunal" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_tribunal_creado"();

      CREATE FUNCTION "trazabilidad_tutoria"() RETURNS trigger AS $$
      DECLARE actor varchar(255); momento timestamptz; evento varchar(80); evidencia varchar(20); fuente uuid;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          momento := NEW."asignada_en"; evento := 'TUTOR_ASIGNADO';
          actor := NEW."assigned_by_id_cuenta"::text; evidencia := 'DIRECTA'; fuente := NEW."id";
        ELSIF NEW."finalizada_en" IS DISTINCT FROM OLD."finalizada_en" AND NEW."finalizada_en" IS NOT NULL THEN
          momento := NEW."finalizada_en"; evento := 'TUTORIA_FINALIZADA';
          actor := NULLIF(current_setting('genares.actor_id', true), '');
          evidencia := CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END; fuente := gen_random_uuid();
        ELSE
          RETURN NEW;
        END IF;
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          NEW."id_trabajo", momento, evento, 'asignacion_tutor', NEW."id", actor,
          CASE WHEN TG_OP = 'INSERT' THEN 'CUENTA' WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END,
          'TUTORIA', NULLIF(current_setting('genares.correlation_id', true), ''),
          jsonb_build_object('idDocente', NEW."id_docente"), evidencia, 'asignacion_tutor', fuente
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_tutoria"
        AFTER INSERT OR UPDATE OF "finalizada_en" ON "asignaciones_tutor_trabajo" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_tutoria"();

      CREATE FUNCTION "trazabilidad_estudiantes_trabajo"() RETURNS trigger AS $$
      DECLARE trabajo_id uuid; estudiante_id uuid; relacion_id uuid; orden_anterior smallint;
        orden_nuevo smallint; actor varchar(255); momento timestamptz; evento varchar(80);
      BEGIN
        trabajo_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_trabajo" ELSE NEW."id_trabajo" END;
        estudiante_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_estudiante" ELSE NEW."id_estudiante" END;
        relacion_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
        orden_anterior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."orden_autoria" END;
        orden_nuevo := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW."orden_autoria" END;
        IF TG_OP = 'UPDATE' AND orden_anterior IS NOT DISTINCT FROM orden_nuevo THEN RETURN NEW; END IF;
        evento := CASE WHEN TG_OP = 'INSERT' THEN 'ESTUDIANTE_AGREGADO'
          WHEN TG_OP = 'DELETE' THEN 'ESTUDIANTE_RETIRADO' ELSE 'ORDEN_AUTORIA_CAMBIADO' END;
        momento := CASE WHEN TG_OP = 'INSERT' THEN NEW."creado_en" ELSE clock_timestamp() END;
        actor := NULLIF(current_setting('genares.actor_id', true), '');
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          trabajo_id, momento, evento, 'estudiante_trabajo', relacion_id, actor,
          CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'TRABAJO',
          NULLIF(current_setting('genares.correlation_id', true), ''),
          jsonb_build_object('idEstudiante', estudiante_id, 'ordenAnterior', orden_anterior, 'ordenNuevo', orden_nuevo),
          CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END,
          'estudiante_trabajo', gen_random_uuid()
        );
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_estudiantes_trabajo"
        AFTER INSERT OR UPDATE OR DELETE ON "estudiantes_trabajo" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_estudiantes_trabajo"();

      CREATE FUNCTION "trazabilidad_miembros_tribunal"() RETURNS trigger AS $$
      DECLARE asignacion_id uuid; trabajo_id uuid; docente_id uuid; miembro_id uuid; posicion smallint;
        actor varchar(255); momento timestamptz := clock_timestamp(); evento varchar(80);
      BEGIN
        asignacion_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_asignacion" ELSE NEW."id_asignacion" END;
        docente_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id_docente" ELSE NEW."id_docente" END;
        miembro_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
        posicion := CASE WHEN TG_OP = 'DELETE' THEN OLD."position" ELSE NEW."position" END;
        SELECT "id_trabajo" INTO trabajo_id FROM "asignaciones_tribunal" WHERE "id" = asignacion_id;
        actor := NULLIF(current_setting('genares.actor_id', true), '');
        evento := CASE WHEN TG_OP = 'INSERT' THEN 'TRIBUNAL_MIEMBRO_AGREGADO'
          WHEN TG_OP = 'DELETE' THEN 'TRIBUNAL_MIEMBRO_RETIRADO' ELSE 'TRIBUNAL_MIEMBRO_ACTUALIZADO' END;
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          trabajo_id, momento, evento, 'miembro_tribunal', miembro_id, actor,
          CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'TRIBUNAL',
          NULLIF(current_setting('genares.correlation_id', true), ''),
          jsonb_build_object('idDocente', docente_id, 'posicion', posicion),
          CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END,
          'miembro_tribunal', gen_random_uuid()
        );
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_miembros_tribunal"
        AFTER INSERT OR UPDATE OR DELETE ON "miembros_tribunal" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_miembros_tribunal"();

      CREATE FUNCTION "trazabilidad_programacion"() RETURNS trigger AS $$
      DECLARE actor varchar(255); correlacion varchar(100); momento timestamptz := clock_timestamp();
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", NEW."creado_en", 'SUSTENTACION_PROGRAMADA', 'programacion_sustentacion', NEW."id",
            COALESCE(NEW."scheduled_by_actor_id", NEW."scheduled_by_id_cuenta"::text),
            CASE WHEN NEW."scheduled_by_actor_id" IS NOT NULL THEN 'ACTOR_TECNICO'
                 WHEN NEW."scheduled_by_id_cuenta" IS NOT NULL THEN 'CUENTA' ELSE NULL END,
            'PROGRAMACION', NULL,
            jsonb_build_object('fecha', NEW."fecha_programada", 'hora', NEW."hora_programada", 'sala', NEW."sala", 'duracionMinutos', NEW."duracion_estimada_minutos"),
            'DIRECTA', 'programacion_sustentacion', NEW."id"
          );
          RETURN NEW;
        END IF;
        actor := NULLIF(current_setting('genares.actor_id', true), '');
        correlacion := NULLIF(current_setting('genares.correlation_id', true), '');
        IF ROW(NEW."fecha_programada", NEW."hora_programada", NEW."sala", NEW."duracion_estimada_minutos")
          IS DISTINCT FROM ROW(OLD."fecha_programada", OLD."hora_programada", OLD."sala", OLD."duracion_estimada_minutos") THEN
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", momento, 'SUSTENTACION_REPROGRAMADA', 'programacion_sustentacion', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'PROGRAMACION', correlacion,
            jsonb_build_object('anterior', jsonb_build_object('fecha', OLD."fecha_programada", 'hora', OLD."hora_programada", 'sala', OLD."sala", 'duracionMinutos', OLD."duracion_estimada_minutos"),
              'nuevo', jsonb_build_object('fecha', NEW."fecha_programada", 'hora', NEW."hora_programada", 'sala', NEW."sala", 'duracionMinutos', NEW."duracion_estimada_minutos")),
            CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END, 'programacion_sustentacion', gen_random_uuid()
          );
        END IF;
        IF NEW."estado" IS DISTINCT FROM OLD."estado" THEN
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", momento, 'SUSTENTACION_ESTADO_CAMBIADO', 'programacion_sustentacion', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'PROGRAMACION', correlacion,
            jsonb_build_object('estadoAnterior', OLD."estado"::text, 'estadoNuevo', NEW."estado"::text),
            CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END, 'programacion_sustentacion', gen_random_uuid()
          );
        END IF;
        IF NEW."inicio_real_en" IS DISTINCT FROM OLD."inicio_real_en" AND NEW."inicio_real_en" IS NOT NULL THEN
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", NEW."inicio_real_en", 'SUSTENTACION_INICIADA', 'programacion_sustentacion', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'PROGRAMACION', correlacion,
            '{}'::jsonb, CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END, 'programacion_sustentacion', gen_random_uuid()
          );
        END IF;
        IF NEW."finalizacion_real_en" IS DISTINCT FROM OLD."finalizacion_real_en" AND NEW."finalizacion_real_en" IS NOT NULL THEN
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            NEW."id_trabajo", NEW."finalizacion_real_en", 'SUSTENTACION_FINALIZADA', 'programacion_sustentacion', NEW."id",
            actor, CASE WHEN actor IS NULL THEN NULL ELSE 'IDENTIDAD_API' END, 'PROGRAMACION', correlacion,
            '{}'::jsonb, CASE WHEN actor IS NULL THEN 'PARCIAL' ELSE 'DIRECTA' END, 'programacion_sustentacion', gen_random_uuid()
          );
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_programacion"
        AFTER INSERT OR UPDATE ON "programaciones_sustentacion" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_programacion"();

      CREATE FUNCTION "trazabilidad_auditoria_evaluacion"() RETURNS trigger AS $$
      DECLARE trabajo_id uuid;
      BEGIN
        SELECT "id_trabajo" INTO trabajo_id FROM "evaluaciones" WHERE "id" = NEW."id_evaluacion";
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          trabajo_id, NEW."ocurrido_en", NEW."accion", 'evaluacion', NEW."id_evaluacion",
          NEW."actor_id", NULL, 'EVALUACION', NEW."correlation_id", NEW."detalles",
          'DIRECTA', 'auditoria_evaluacion', NEW."id"
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_auditoria_evaluacion"
        AFTER INSERT ON "eventos_auditoria_evaluacion" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_auditoria_evaluacion"();

      CREATE FUNCTION "trazabilidad_traspaso_evaluacion"() RETURNS trigger AS $$
      BEGIN
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          NEW."id_trabajo", NEW."traspasado_en", 'EVALUACION_TRASPASADA', 'evaluacion', NEW."id_evaluacion",
          NULL, NULL, 'TRASPASO', NULL,
          jsonb_build_object('idEstudianteReceptor', NEW."id_estudiante", 'actorNoConservado', true),
          'PARCIAL', 'traspaso_evaluacion', NEW."id"
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_traspaso_evaluacion"
        AFTER INSERT ON "traspasos_evaluacion_estudiante" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_traspaso_evaluacion"();

      CREATE FUNCTION "trazabilidad_acta_archivada"() RETURNS trigger AS $$
      BEGIN
        PERFORM "registrar_evento_trazabilidad_trabajo"(
          NEW."id_trabajo", NEW."generado_en", 'ACTA_ARCHIVADA', 'acta', NEW."id",
          NEW."generado_por", NULL, 'DOCUMENTO', NULL,
          jsonb_build_object('numero', NEW."numero", 'formato', NEW."formato", 'sha256', NEW."sha256"),
          'DIRECTA', 'acta_archivada', NEW."id"
        );
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_acta_archivada"
        AFTER INSERT ON "actas_archivadas" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_acta_archivada"();

      CREATE FUNCTION "trazabilidad_auditoria_rubrica"() RETURNS trigger AS $$
      DECLARE trabajo record;
      BEGIN
        FOR trabajo IN SELECT "id" FROM "trabajos_titulacion"
          WHERE "id_version_rubrica" IS NOT NULL
            AND "id_version_rubrica" IN (NEW."version_id", NEW."version_anterior_id")
        LOOP
          PERFORM "registrar_evento_trazabilidad_trabajo"(
            trabajo."id", NEW."ocurrido_en", 'RUBRICA_AUDITADA', 'version_rubrica', NEW."version_id",
            NEW."actor_id", NULL, 'RUBRICA', NEW."correlation_id",
            jsonb_build_object('accion', NEW."accion", 'versionAnteriorId', NEW."version_anterior_id"),
            'DIRECTA', 'auditoria_rubrica', NEW."id"
          );
        END LOOP;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER "trg_trazabilidad_auditoria_rubrica"
        AFTER INSERT ON "auditoria_rubricas" FOR EACH ROW
        EXECUTE FUNCTION "trazabilidad_auditoria_rubrica"();
    `);

    // El backfill copia únicamente fechas, actores y relaciones presentes en las tablas fuente.
    await queryRunner.query(`
      INSERT INTO "eventos_trazabilidad_trabajo" (
        "id_trabajo", "ocurrido_en", "tipo_evento", "entidad_tipo", "entidad_id",
        "actor_id", "actor_tipo", "origen", "correlation_id", "detalles", "evidencia",
        "fuente_tipo", "fuente_id"
      )
      SELECT trabajo."id", trabajo."creado_en", 'TRABAJO_REGISTRADO', 'trabajo', trabajo."id",
        trabajo."created_by_id_cuenta"::text, 'CUENTA', 'TRABAJO', NULL,
        jsonb_build_object('codigo', trabajo."codigo"), 'DIRECTA', 'trabajo', trabajo."id"
      FROM "trabajos_titulacion" trabajo
      UNION ALL
      SELECT asignacion."id_trabajo", asignacion."creado_en", 'TRIBUNAL_ASIGNADO', 'asignacion_tribunal', asignacion."id",
        asignacion."assigned_by_id_cuenta"::text, 'CUENTA', 'TRIBUNAL', NULL,
        '{}'::jsonb, 'DIRECTA', 'asignacion_tribunal', asignacion."id"
      FROM "asignaciones_tribunal" asignacion
      UNION ALL
      SELECT asignacion."id_trabajo", asignacion."confirmada_en", 'TRIBUNAL_CONFIRMADO', 'asignacion_tribunal', asignacion."id",
        NULL, NULL, 'TRIBUNAL', NULL,
        jsonb_build_object('actorNoConservado', true), 'PARCIAL', 'asignacion_tribunal', asignacion."id"
      FROM "asignaciones_tribunal" asignacion
      WHERE asignacion."confirmada_en" IS NOT NULL
      UNION ALL
      SELECT tutor."id_trabajo", tutor."asignada_en", 'TUTOR_ASIGNADO', 'asignacion_tutor', tutor."id",
        tutor."assigned_by_id_cuenta"::text, 'CUENTA', 'TUTORIA', NULL,
        jsonb_build_object('idDocente', tutor."id_docente"), 'DIRECTA', 'asignacion_tutor', tutor."id"
      FROM "asignaciones_tutor_trabajo" tutor
      UNION ALL
      SELECT tutor."id_trabajo", tutor."finalizada_en", 'TUTORIA_FINALIZADA', 'asignacion_tutor', tutor."id",
        NULL, NULL, 'TUTORIA', NULL,
        jsonb_build_object('idDocente', tutor."id_docente", 'actorNoConservado', true), 'PARCIAL', 'asignacion_tutor', tutor."id"
      FROM "asignaciones_tutor_trabajo" tutor
      WHERE tutor."finalizada_en" IS NOT NULL
      UNION ALL
      SELECT evaluacion."id_trabajo", auditoria."ocurrido_en", auditoria."accion", 'evaluacion', evaluacion."id",
        auditoria."actor_id", NULL, 'EVALUACION', auditoria."correlation_id", auditoria."detalles",
        'DIRECTA', 'auditoria_evaluacion', auditoria."id"
      FROM "eventos_auditoria_evaluacion" auditoria
      JOIN "evaluaciones" evaluacion ON evaluacion."id" = auditoria."id_evaluacion"
      UNION ALL
      SELECT traspaso."id_trabajo", traspaso."traspasado_en", 'EVALUACION_TRASPASADA', 'evaluacion', traspaso."id_evaluacion",
        NULL, NULL, 'TRASPASO', NULL,
        jsonb_build_object('idEstudianteReceptor', traspaso."id_estudiante", 'actorNoConservado', true),
        'PARCIAL', 'traspaso_evaluacion', traspaso."id"
      FROM "traspasos_evaluacion_estudiante" traspaso
      UNION ALL
      SELECT programacion."id_trabajo", programacion."creado_en", 'SUSTENTACION_PROGRAMADA', 'programacion_sustentacion', programacion."id",
        COALESCE(programacion."scheduled_by_actor_id", programacion."scheduled_by_id_cuenta"::text),
        CASE WHEN programacion."scheduled_by_actor_id" IS NOT NULL THEN 'ACTOR_TECNICO'
             WHEN programacion."scheduled_by_id_cuenta" IS NOT NULL THEN 'CUENTA' ELSE NULL END,
        'PROGRAMACION', NULL,
        jsonb_build_object('fecha', programacion."fecha_programada", 'hora', programacion."hora_programada", 'sala', programacion."sala"),
        'DIRECTA', 'programacion_sustentacion', programacion."id"
      FROM "programaciones_sustentacion" programacion
      UNION ALL
      SELECT programacion."id_trabajo", programacion."inicio_real_en", 'SUSTENTACION_INICIADA', 'programacion_sustentacion', programacion."id",
        NULL, NULL, 'PROGRAMACION', NULL, jsonb_build_object('actorNoConservado', true),
        'PARCIAL', 'programacion_sustentacion', programacion."id"
      FROM "programaciones_sustentacion" programacion
      WHERE programacion."inicio_real_en" IS NOT NULL
      UNION ALL
      SELECT programacion."id_trabajo", programacion."finalizacion_real_en", 'SUSTENTACION_FINALIZADA', 'programacion_sustentacion', programacion."id",
        NULL, NULL, 'PROGRAMACION', NULL, jsonb_build_object('actorNoConservado', true),
        'PARCIAL', 'programacion_sustentacion', programacion."id"
      FROM "programaciones_sustentacion" programacion
      WHERE programacion."finalizacion_real_en" IS NOT NULL
      UNION ALL
      SELECT acta."id_trabajo", acta."generado_en", 'ACTA_ARCHIVADA', 'acta', acta."id",
        acta."generado_por", NULL, 'DOCUMENTO', NULL,
        jsonb_build_object('numero', acta."numero", 'formato', acta."formato", 'sha256', acta."sha256"),
        'DIRECTA', 'acta_archivada', acta."id"
      FROM "actas_archivadas" acta
      UNION ALL
      SELECT trabajo."id", auditoria."ocurrido_en", 'RUBRICA_AUDITADA', 'version_rubrica', auditoria."version_id",
        auditoria."actor_id", NULL, 'RUBRICA', auditoria."correlation_id",
        jsonb_build_object('accion', auditoria."accion", 'versionAnteriorId', auditoria."version_anterior_id"),
        'DIRECTA', 'auditoria_rubrica', auditoria."id"
      FROM "auditoria_rubricas" auditoria
      JOIN "trabajos_titulacion" trabajo ON trabajo."id_version_rubrica" = auditoria."version_id"
      WHERE auditoria."version_id" IS NOT NULL
    `);
  }

  async down(): Promise<void> {
    throw new Error('La migración de trazabilidad contiene evidencia histórica append-only y no se puede revertir automáticamente.');
  }
}
