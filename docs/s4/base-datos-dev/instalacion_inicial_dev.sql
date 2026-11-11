-- INSTALACION INICIAL (SOLO BASE NUEVA DE DESARROLLO).
-- Ejecutar con psql -X -v ON_ERROR_STOP=1 --single-transaction -f instalacion_inicial_dev.sql
-- NO ejecutar el mismo script sobre una base ya poblada.



-- ===== 001_esquemas_y_tablas.sql =====
-- GENARES: DDL DE DESARROLLO DESDE MER FINAL, NO PARA PRODUCCIÓN.
-- 80 tablas gen/s1/s2/s3/s4. Los tipos enum del MER se representan TEXT
-- hasta conocer valores finales. NOT NULL solo si inequívoco (PK o FK requerida).
-- Ejecutar una sola vez contra una base de desarrollo NUEVA.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS gen;
CREATE SCHEMA IF NOT EXISTS s1;
CREATE SCHEMA IF NOT EXISTS s2;
CREATE SCHEMA IF NOT EXISTS s3;
CREATE SCHEMA IF NOT EXISTS s4;


CREATE TABLE "gen"."carrera" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" varchar,
    "nombre" varchar,
    "activo" boolean,
    "facultad" varchar,
    "revision" integer,
    "creado_en" timestamptz DEFAULT now(),
    "actualizado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_gen_carrera" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_carrera_codigo" UNIQUE ("codigo")
);


CREATE TABLE "gen"."docente" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" uuid,
    "titulo_academico" varchar(120),
    "departamento" varchar(120),
    "habilitado_tutoria" boolean,
    "persona_id" uuid NOT NULL,
    "carrera_id" uuid NOT NULL,
    "fuente" text,
    "referencia_externa" varchar,
    "activo" boolean,
    CONSTRAINT "pk_gen_docente" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_docente_usuario_id" UNIQUE ("usuario_id"),
    CONSTRAINT "uq_gen_docente_persona_id" UNIQUE ("persona_id")
);

COMMENT ON COLUMN "gen"."docente"."fuente" IS 'MER: tipo lógico fuente_directorio_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "gen"."estudiante" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo_institucional" varchar,
    "usuario_id" uuid,
    "matricula" varchar(20),
    "carrera_reportada" varchar(120),
    "nivel" smallint,
    "carrera_id" uuid NOT NULL,
    "tema_id" uuid,
    "calificacion" numeric,
    "persona_id" uuid NOT NULL,
    CONSTRAINT "pk_gen_estudiante" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_estudiante_usuario_id" UNIQUE ("usuario_id"),
    CONSTRAINT "uq_gen_estudiante_matricula" UNIQUE ("matricula"),
    CONSTRAINT "uq_gen_estudiante_persona_id" UNIQUE ("persona_id")
);


CREATE TABLE "gen"."modalidad" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nombre" varchar,
    "activo" boolean,
    "codigo" varchar,
    "descripcion" text,
    "revision" integer,
    "creado_en" timestamptz DEFAULT now(),
    "actualizado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_gen_modalidad" PRIMARY KEY ("id")
);


CREATE TABLE "gen"."periodo_academico" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" varchar,
    "anio" smallint,
    "numero_periodo" smallint,
    "nombre" varchar,
    "fecha_inicio" date,
    "fecha_fin" date,
    "activo" boolean,
    CONSTRAINT "pk_gen_periodo_academico" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_periodo_academico_codigo" UNIQUE ("codigo")
);


CREATE TABLE "gen"."permiso" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" varchar,
    "descripcion" text,
    CONSTRAINT "pk_gen_permiso" PRIMARY KEY ("id")
);


CREATE TABLE "gen"."persona" (
    "identificacion" varchar,
    "apellidos" varchar,
    "nombres" varchar,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "creado_en" timestamptz DEFAULT now(),
    "actualizado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_gen_persona" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_persona_identificacion" UNIQUE ("identificacion")
);


CREATE TABLE "gen"."rol" (
    "codigo" varchar,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nombre" varchar,
    "descripcion" text,
    CONSTRAINT "pk_gen_rol" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_rol_codigo" UNIQUE ("codigo")
);


CREATE TABLE "gen"."rol_permiso" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "rol_id" uuid NOT NULL,
    "permiso_id" uuid NOT NULL,
    CONSTRAINT "pk_gen_rol_permiso" PRIMARY KEY ("id")
);


CREATE TABLE "gen"."tema" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_titulacion_id" uuid NOT NULL,
    "linea_id" uuid NOT NULL,
    "docente_proponente_id" uuid NOT NULL,
    "titulo" text,
    "descripcion" text,
    "min_integrantes" smallint,
    "max_integrantes" smallint,
    "estado" text,
    "creado_en" timestamptz DEFAULT now(),
    "modalidad_id" uuid NOT NULL,
    "tutor_usuario_id" uuid NOT NULL,
    "carrera_id" uuid NOT NULL,
    "periodo_academico_id" uuid NOT NULL,
    "fecha_creacion" date,
    CONSTRAINT "pk_gen_tema" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "gen"."tema"."estado" IS 'MER: tipo lógico enum_s2_tema_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "gen"."usuario" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "email" varchar,
    "activo" boolean,
    "id_externo_sso" varchar(100),
    "ultimo_acceso" timestamptz,
    "creado_en" timestamptz DEFAULT now(),
    "contrasena_legada" varchar,
    "fecha_caducidad" date,
    "persona_id" uuid NOT NULL,
    "sujeto_autenticacion" varchar,
    "actualizado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_gen_usuario" PRIMARY KEY ("id"),
    CONSTRAINT "uq_gen_usuario_email" UNIQUE ("email"),
    CONSTRAINT "uq_gen_usuario_id_externo_sso" UNIQUE ("id_externo_sso"),
    CONSTRAINT "uq_gen_usuario_persona_id" UNIQUE ("persona_id")
);


CREATE TABLE "gen"."usuario_carrera" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" uuid NOT NULL,
    "carrera_id" uuid NOT NULL,
    CONSTRAINT "pk_gen_usuario_carrera" PRIMARY KEY ("id")
);


CREATE TABLE "gen"."usuario_rol" (
    "rol_id" uuid NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" uuid NOT NULL,
    "asignada_en" timestamptz,
    CONSTRAINT "pk_gen_usuario_rol" PRIMARY KEY ("id")
);


CREATE TABLE "s1"."asignacion_malla" (
    "id_asignacion_malla" bigint NOT NULL,
    "id_estudiante" uuid NOT NULL,
    "id_version_malla" bigint NOT NULL,
    "periodo_desde" uuid,
    "periodo_hasta" uuid,
    "estado_confirmacion" varchar,
    CONSTRAINT "pk_s1_asignacion_malla" PRIMARY KEY ("id_asignacion_malla")
);


CREATE TABLE "s1"."asignatura_malla" (
    "id_asignatura_malla" bigint NOT NULL,
    "id_version_malla" bigint NOT NULL,
    "codigo_asignatura" varchar,
    "nombre" varchar,
    "nivel" smallint,
    "area" varchar,
    CONSTRAINT "pk_s1_asignatura_malla" PRIMARY KEY ("id_asignatura_malla")
);


CREATE TABLE "s1"."componente_nota" (
    "id_componente_nota" bigint NOT NULL,
    "id_registro" bigint NOT NULL,
    "numero_componente" smallint,
    "nota" numeric,
    "id_lote" bigint,
    CONSTRAINT "pk_s1_componente_nota" PRIMARY KEY ("id_componente_nota")
);


CREATE TABLE "s1"."detalle_validacion" (
    "id_detalle" bigint NOT NULL,
    "id_ejecucion" bigint NOT NULL,
    "codigo_revision" varchar,
    "estado_revision" varchar,
    "explicacion" text,
    "id_registro" bigint,
    "id_asignatura_requisito" bigint,
    CONSTRAINT "pk_s1_detalle_validacion" PRIMARY KEY ("id_detalle")
);


CREATE TABLE "s1"."ejecucion_validacion" (
    "id_ejecucion" bigint NOT NULL,
    "id_estudiante" uuid NOT NULL,
    "id_carrera" uuid NOT NULL,
    "id_proceso" bigint NOT NULL,
    "id_asignacion_malla" bigint,
    "id_periodo_evaluado" uuid,
    "resultado" varchar,
    "fecha_evaluacion" timestamptz,
    CONSTRAINT "pk_s1_ejecucion_validacion" PRIMARY KEY ("id_ejecucion")
);


CREATE TABLE "s1"."equivalencia_asignatura" (
    "id_equivalencia" bigint NOT NULL,
    "id_asignatura_origen" bigint NOT NULL,
    "id_asignatura_equivalente" bigint NOT NULL,
    "tipo_equivalencia" varchar,
    CONSTRAINT "pk_s1_equivalencia_asignatura" PRIMARY KEY ("id_equivalencia")
);


CREATE TABLE "s1"."esquema_notas" (
    "id_esquema_notas" bigint NOT NULL,
    "id_carrera" uuid NOT NULL,
    "id_periodo" uuid NOT NULL,
    "componentes_esperados" smallint,
    "metodo_agregacion" varchar,
    "nota_minima_aprobacion" numeric,
    CONSTRAINT "pk_s1_esquema_notas" PRIMARY KEY ("id_esquema_notas")
);


CREATE TABLE "s1"."grupo_prerrequisito" (
    "id_grupo_prerrequisito" bigint NOT NULL,
    "id_asignatura_objetivo" bigint NOT NULL,
    "operador" varchar,
    "texto_original" text,
    CONSTRAINT "pk_s1_grupo_prerrequisito" PRIMARY KEY ("id_grupo_prerrequisito")
);


CREATE TABLE "s1"."incidencia_importacion" (
    "id_incidencia" bigint NOT NULL,
    "id_lote" bigint NOT NULL,
    "numero_fila" integer,
    "campo" varchar,
    "codigo_error" varchar,
    "mensaje" text,
    CONSTRAINT "pk_s1_incidencia_importacion" PRIMARY KEY ("id_incidencia")
);


CREATE TABLE "s1"."item_prerrequisito" (
    "id_item_prerrequisito" bigint NOT NULL,
    "id_grupo_prerrequisito" bigint NOT NULL,
    "id_asignatura_requerida" bigint NOT NULL,
    "estado_resolucion" varchar,
    CONSTRAINT "pk_s1_item_prerrequisito" PRIMARY KEY ("id_item_prerrequisito")
);


CREATE TABLE "s1"."lote_importacion" (
    "id_lote" bigint NOT NULL,
    "id_carrera" uuid,
    "id_version_malla" bigint,
    "id_periodo" uuid,
    "tipo_importacion" varchar,
    "nombre_archivo" varchar,
    "formato_detectado" varchar,
    "estado" varchar,
    CONSTRAINT "pk_s1_lote_importacion" PRIMARY KEY ("id_lote")
);


CREATE TABLE "s1"."proceso_elegibilidad" (
    "id_proceso" bigint NOT NULL,
    "codigo" varchar,
    "nombre" varchar,
    "activo" boolean,
    CONSTRAINT "pk_s1_proceso_elegibilidad" PRIMARY KEY ("id_proceso"),
    CONSTRAINT "uq_s1_proceso_elegibilidad_codigo" UNIQUE ("codigo")
);


CREATE TABLE "s1"."registro_asignatura" (
    "id_registro" bigint NOT NULL,
    "id_estudiante" uuid NOT NULL,
    "id_carrera" uuid NOT NULL,
    "id_periodo" uuid NOT NULL,
    "id_asignatura_malla" bigint,
    "codigo_reportado" varchar,
    "nombre_reportado" varchar,
    "numero_intento" smallint,
    "id_lote" bigint,
    CONSTRAINT "pk_s1_registro_asignatura" PRIMARY KEY ("id_registro")
);


CREATE TABLE "s1"."version_malla" (
    "id_version_malla" bigint NOT NULL,
    "id_carrera" uuid NOT NULL,
    "identificador_pensum" varchar,
    "identificador_itinerario" varchar,
    "anio_malla" smallint,
    "nombre_version" varchar,
    CONSTRAINT "pk_s1_version_malla" PRIMARY KEY ("id_version_malla")
);


CREATE TABLE "s2"."asignacion_tema" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "postulacion_id" uuid NOT NULL,
    "grupo_id" uuid,
    "estudiante_id" uuid,
    "aprobada_por_id" uuid NOT NULL,
    "estado" text,
    "fecha_asignacion" timestamptz,
    "motivo" text,
    "causa_anulacion" text,
    "motivo_anulacion" text,
    "anulada_por_id" uuid,
    "fecha_anulacion" timestamptz,
    CONSTRAINT "pk_s2_asignacion_tema" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s2_asignacion_tema_postulacion_id" UNIQUE ("postulacion_id")
);

COMMENT ON COLUMN "s2"."asignacion_tema"."estado" IS 'MER: tipo lógico enum_s2_asignacion_tema_estado; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."asignacion_tema"."causa_anulacion" IS 'MER: tipo lógico enum_s2_asignacion_tema_causa_anulacion; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."asignacion_tutor" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_tema_id" uuid NOT NULL,
    "docente_id" uuid NOT NULL,
    "tutor_propuesto_id" uuid,
    "tipo" text,
    "estado" text,
    "asignada_por_id" uuid NOT NULL,
    "fecha_asignacion" timestamptz,
    "fecha_fin" timestamptz,
    "motivo_cambio" text,
    CONSTRAINT "pk_s2_asignacion_tutor" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."asignacion_tutor"."tipo" IS 'MER: tipo lógico enum_s2_asignacion_tutor_tipo; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."asignacion_tutor"."estado" IS 'MER: tipo lógico enum_s2_asignacion_tutor_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."auditoria" (
    "id" bigserial NOT NULL,
    "usuario_id" uuid NOT NULL,
    "accion" varchar(60),
    "entidad_tipo" varchar(60),
    "entidad_id" uuid,
    "valores_anteriores" jsonb,
    "valores_nuevos" jsonb,
    "ip_origen" inet,
    "fecha_hora" timestamptz,
    CONSTRAINT "pk_s2_auditoria" PRIMARY KEY ("id")
);


CREATE TABLE "s2"."config_carga_tutorial" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid NOT NULL,
    "docente_id" uuid,
    "max_trabajos" smallint,
    "bloquear_al_superar" boolean,
    CONSTRAINT "pk_s2_config_carga_tutorial" PRIMARY KEY ("id")
);


CREATE TABLE "s2"."conflicto_participante" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "resolucion_conflicto_id" uuid NOT NULL,
    "tema_id" uuid NOT NULL,
    "postulacion_id" uuid NOT NULL,
    "puntaje_criterio" numeric(6,2),
    CONSTRAINT "pk_s2_conflicto_participante" PRIMARY KEY ("id")
);


CREATE TABLE "s2"."documento_pat" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_tema_id" uuid NOT NULL,
    "plantilla_id" uuid NOT NULL,
    "version" smallint,
    "nombre_archivo" varchar(200),
    "ruta_almacenamiento" varchar(500),
    "formato" text,
    "tamano_bytes" bigint,
    "hash_sha256" char(64),
    "cargado_por_id" uuid NOT NULL,
    "fecha_carga" timestamptz,
    CONSTRAINT "pk_s2_documento_pat" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."documento_pat"."formato" IS 'MER: tipo lógico enum_s2_documento_pat_formato; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."estudiante_habilitado" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid NOT NULL,
    "estudiante_id" uuid NOT NULL,
    "origen" text,
    "lote_importacion_id" uuid,
    "estado" text,
    "condicion_ingreso" text,
    "requisito_pendiente" text,
    "situacion_ingreso" text,
    "fecha_habilitacion" timestamptz,
    "fecha_resolucion_ingreso" timestamptz,
    "resuelto_por_id" uuid,
    "observacion_ingreso" text,
    "ejecucion_validacion_id" bigint,
    CONSTRAINT "pk_s2_estudiante_habilitado" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."estudiante_habilitado"."origen" IS 'MER: tipo lógico enum_s2_estudiante_habilitado_origen; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."estudiante_habilitado"."estado" IS 'MER: tipo lógico enum_s2_estudiante_habilitado_estado; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."estudiante_habilitado"."condicion_ingreso" IS 'MER: tipo lógico enum_s2_estudiante_habilitado_condicion_ingreso; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."estudiante_habilitado"."situacion_ingreso" IS 'MER: tipo lógico enum_s2_estudiante_habilitado_situacion_ingreso; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."grupo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid NOT NULL,
    "nombre" varchar(120),
    "estado" text,
    "creado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_s2_grupo" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."grupo"."estado" IS 'MER: tipo lógico enum_s2_grupo_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."grupo_integrante" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" uuid NOT NULL,
    "periodo_id" uuid NOT NULL,
    "estudiante_id" uuid NOT NULL,
    "rol_en_grupo" text,
    "estado" text,
    "fecha_ingreso" timestamptz,
    "fecha_salida" timestamptz,
    "motivo_salida" text,
    CONSTRAINT "pk_s2_grupo_integrante" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."grupo_integrante"."rol_en_grupo" IS 'MER: tipo lógico enum_s2_grupo_integrante_rol_en_grupo; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."grupo_integrante"."estado" IS 'MER: tipo lógico enum_s2_grupo_integrante_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."invitacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" uuid NOT NULL,
    "periodo_id" uuid NOT NULL,
    "estudiante_emisor_id" uuid NOT NULL,
    "estudiante_destino_id" uuid NOT NULL,
    "estado" text,
    "fecha_envio" timestamptz,
    "expira_en" timestamptz,
    "fecha_respuesta" timestamptz,
    CONSTRAINT "pk_s2_invitacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."invitacion"."estado" IS 'MER: tipo lógico enum_s2_invitacion_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."linea_investigacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" varchar(20),
    "nombre" varchar(150),
    "descripcion" text,
    "activa" boolean,
    CONSTRAINT "pk_s2_linea_investigacion" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s2_linea_investigacion_codigo" UNIQUE ("codigo")
);


CREATE TABLE "s2"."lote_importacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid,
    "ejecutado_por_id" uuid NOT NULL,
    "tipo" text,
    "nombre_archivo" varchar(200),
    "ruta_almacenamiento" varchar(500),
    "estado" text,
    "total_filas" integer,
    "filas_ok" integer,
    "filas_error" integer,
    "errores" jsonb,
    "fecha_inicio" timestamptz,
    "fecha_fin" timestamptz,
    CONSTRAINT "pk_s2_lote_importacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."lote_importacion"."tipo" IS 'MER: tipo lógico enum_s2_lote_importacion_tipo; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."lote_importacion"."estado" IS 'MER: tipo lógico enum_s2_lote_importacion_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."notificacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" uuid NOT NULL,
    "tipo" varchar(60),
    "titulo" varchar(200),
    "mensaje" text,
    "entidad_tipo" varchar(60),
    "entidad_id" uuid,
    "canal" text,
    "leida" boolean,
    "fecha_creacion" timestamptz,
    "fecha_envio" timestamptz,
    CONSTRAINT "pk_s2_notificacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."notificacion"."canal" IS 'MER: tipo lógico enum_s2_notificacion_canal; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."periodo_titulacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" varchar(20),
    "nombre" varchar(120),
    "fecha_inicio_postulacion" timestamptz,
    "fecha_fin_postulacion" timestamptz,
    "fecha_inicio_titulacion" timestamptz,
    "estado" text,
    "max_integrantes_default" smallint,
    "periodo_academico_id" uuid,
    CONSTRAINT "pk_s2_periodo_titulacion" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s2_periodo_titulacion_codigo" UNIQUE ("codigo")
);

COMMENT ON COLUMN "s2"."periodo_titulacion"."estado" IS 'MER: tipo lógico enum_s2_periodo_titulacion_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."plantilla_pat" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid NOT NULL,
    "version" varchar(20),
    "nombre_archivo" varchar(200),
    "ruta_almacenamiento" varchar(500),
    "mime_type" varchar(100),
    "tamano_bytes" bigint,
    "fecha_vigencia_inicio" date,
    "fecha_vigencia_fin" date,
    "publicada_por_id" uuid NOT NULL,
    "activa" boolean,
    CONSTRAINT "pk_s2_plantilla_pat" PRIMARY KEY ("id")
);


CREATE TABLE "s2"."postulacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "periodo_id" uuid NOT NULL,
    "grupo_id" uuid,
    "estudiante_id" uuid,
    "num_integrantes" smallint,
    "registrada_por_id" uuid NOT NULL,
    "estado" text,
    "fecha_postulacion" timestamptz,
    "observacion" text,
    CONSTRAINT "pk_s2_postulacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."postulacion"."estado" IS 'MER: tipo lógico enum_s2_postulacion_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."resolucion_conflicto" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "periodo_id" uuid NOT NULL,
    "resuelto_por_id" uuid NOT NULL,
    "criterio_aplicado" text,
    "postulacion_ganadora_id" uuid NOT NULL,
    "justificacion" text,
    "fecha_resolucion" timestamptz,
    CONSTRAINT "pk_s2_resolucion_conflicto" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."resolucion_conflicto"."criterio_aplicado" IS 'MER: tipo lógico enum_s2_resolucion_conflicto_criterio_aplicado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."revision_pat" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "documento_pat_id" uuid NOT NULL,
    "revisor_id" uuid NOT NULL,
    "resultado" text,
    "observaciones" text,
    "fecha_revision" timestamptz,
    CONSTRAINT "pk_s2_revision_pat" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s2_revision_pat_documento_pat_id" UNIQUE ("documento_pat_id")
);

COMMENT ON COLUMN "s2"."revision_pat"."resultado" IS 'MER: tipo lógico enum_s2_revision_pat_resultado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."solicitud_exportacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "periodo_id" uuid,
    "solicitada_por_id" uuid NOT NULL,
    "tipo_reporte" text,
    "formato" text,
    "filtros" jsonb,
    "estado" text,
    "ruta_almacenamiento" varchar(500),
    "tamano_bytes" bigint,
    "expira_en" timestamptz,
    "fecha_solicitud" timestamptz,
    "fecha_generacion" timestamptz,
    CONSTRAINT "pk_s2_solicitud_exportacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."solicitud_exportacion"."tipo_reporte" IS 'MER: tipo lógico enum_s2_solicitud_exportacion_tipo_reporte; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."solicitud_exportacion"."formato" IS 'MER: tipo lógico enum_s2_solicitud_exportacion_formato; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."solicitud_exportacion"."estado" IS 'MER: tipo lógico enum_s2_solicitud_exportacion_estado; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."tema_historial" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "usuario_id" uuid NOT NULL,
    "estado_anterior" text,
    "estado_nuevo" text,
    "cambios" jsonb,
    "fecha" timestamptz,
    CONSTRAINT "pk_s2_tema_historial" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s2"."tema_historial"."estado_anterior" IS 'MER: tipo lógico enum_s2_tema_historial_estado_anterior; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s2"."tema_historial"."estado_nuevo" IS 'MER: tipo lógico enum_s2_tema_historial_estado_nuevo; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s2"."tutor_propuesto" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "postulacion_id" uuid NOT NULL,
    "docente_id" uuid NOT NULL,
    "orden_prioridad" smallint,
    CONSTRAINT "pk_s2_tutor_propuesto" PRIMARY KEY ("id")
);


CREATE TABLE "s3"."asignacion_tribunal" (
    "asignacion_tribunal_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "miembro_tribunal_id" uuid NOT NULL,
    "asignacion_tema_id" uuid NOT NULL,
    CONSTRAINT "pk_s3_asignacion_tribunal" PRIMARY KEY ("asignacion_tribunal_id")
);


CREATE TABLE "s3"."docente_carrera_periodo" (
    "docente_carrera_periodo_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" uuid NOT NULL,
    "carrera_id" uuid NOT NULL,
    "periodo_academico_id" uuid NOT NULL,
    CONSTRAINT "pk_s3_docente_carrera_periodo" PRIMARY KEY ("docente_carrera_periodo_id")
);


CREATE TABLE "s3"."documento" (
    "documento_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "tipo_documento_id" uuid NOT NULL,
    "fecha_creacion" date,
    CONSTRAINT "pk_s3_documento" PRIMARY KEY ("documento_id")
);


CREATE TABLE "s3"."documento_version" (
    "doc_version_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "documento_id" uuid NOT NULL,
    "numero_version" integer,
    "archivo_url" varchar,
    "subido_por_id" uuid NOT NULL,
    "fecha_subida" timestamp,
    "estado" varchar,
    "revisado_por_id" uuid,
    "fecha_revision" timestamp,
    "comentario" text,
    CONSTRAINT "pk_s3_documento_version" PRIMARY KEY ("doc_version_id")
);


CREATE TABLE "s3"."fase" (
    "fase_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nombre" varchar,
    "orden" integer,
    CONSTRAINT "pk_s3_fase" PRIMARY KEY ("fase_id")
);


CREATE TABLE "s3"."miembros_tribunal" (
    "miembro_tribunal_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "docente_carrera_periodo_id" uuid NOT NULL,
    CONSTRAINT "pk_s3_miembros_tribunal" PRIMARY KEY ("miembro_tribunal_id")
);


CREATE TABLE "s3"."modalidad_tipo_documento" (
    "modalidad_documento_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "modalidad_id" uuid NOT NULL,
    "tipo_documento_id" uuid NOT NULL,
    CONSTRAINT "pk_s3_modalidad_tipo_documento" PRIMARY KEY ("modalidad_documento_id")
);


CREATE TABLE "s3"."notificacion" (
    "notificacion_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" uuid NOT NULL,
    "mensaje" text,
    "fecha_creacion" timestamp,
    CONSTRAINT "pk_s3_notificacion" PRIMARY KEY ("notificacion_id")
);


CREATE TABLE "s3"."presidente_tribunal" (
    "presidente_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "docente_carrera_periodo_id" uuid NOT NULL,
    "puesto" varchar,
    CONSTRAINT "pk_s3_presidente_tribunal" PRIMARY KEY ("presidente_id")
);


CREATE TABLE "s3"."tema_historial" (
    "historial_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tema_id" uuid NOT NULL,
    "fase_id" uuid NOT NULL,
    "fecha_inicio" timestamp,
    "fecha_fin" timestamp,
    CONSTRAINT "pk_s3_tema_historial" PRIMARY KEY ("historial_id")
);


CREATE TABLE "s3"."tipo_documento" (
    "tipo_documento_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nombre" varchar,
    "fase_id" uuid NOT NULL,
    "obligatorio" boolean,
    CONSTRAINT "pk_s3_tipo_documento" PRIMARY KEY ("tipo_documento_id")
);


CREATE TABLE "s4"."actas_archivadas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "numero" varchar,
    "id_carrera" uuid NOT NULL,
    "id_periodo" uuid NOT NULL,
    "periodo" varchar,
    "consecutivo" integer,
    "id_estudiante" uuid NOT NULL,
    "formato" varchar,
    "revision" smallint,
    "generado_en" timestamptz,
    "generado_por" varchar,
    "pdf" bytea,
    "sha256" varchar,
    "nota_final" numeric,
    "nota_minima_aplicada" numeric,
    "aprobado" boolean,
    "id_proceso_evaluacion" uuid NOT NULL,
    CONSTRAINT "pk_s4_actas_archivadas" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."auditoria_rubricas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" varchar,
    "accion" varchar,
    "rubrica_id" uuid,
    "modalidad_id" uuid,
    "version_id" uuid,
    "version_anterior_id" uuid,
    "carrera_id" uuid,
    "periodo_academico_id" uuid,
    "ocurrido_en" timestamptz,
    "correlation_id" varchar,
    CONSTRAINT "pk_s4_auditoria_rubricas" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."calificaciones_evaluacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_evaluacion" uuid NOT NULL,
    "id_indicador" uuid NOT NULL,
    "score" numeric,
    "instantanea_calificacion_maxima" numeric,
    "observation" text,
    CONSTRAINT "pk_s4_calificaciones_evaluacion" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."categorias_rubrica" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_version_rubrica" uuid NOT NULL,
    "id_etapa_rubrica" uuid NOT NULL,
    "codigo" varchar,
    "nombre" varchar,
    "calificacion_maxima" numeric,
    "orden" smallint,
    CONSTRAINT "pk_s4_categorias_rubrica" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."configuracion_nota_minima" (
    "id" smallint NOT NULL,
    "valor" numeric,
    "actualizado_en" timestamptz DEFAULT now(),
    "actualizado_por" varchar,
    CONSTRAINT "pk_s4_configuracion_nota_minima" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."consecutivos_acta" (
    "id_carrera" uuid NOT NULL,
    "periodo" varchar NOT NULL,
    "ultimo" integer,
    CONSTRAINT "pk_s4_consecutivos_acta" PRIMARY KEY ("id_carrera", "periodo")
);


CREATE TABLE "s4"."etapas_rubrica" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_version_rubrica" uuid NOT NULL,
    "kind" text,
    "scope" text,
    "codigo" varchar,
    "nombre" varchar,
    "descripcion" text,
    "calificacion_maxima" numeric,
    "porcentaje" numeric,
    "orden" smallint,
    CONSTRAINT "pk_s4_etapas_rubrica" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s4"."etapas_rubrica"."kind" IS 'MER: tipo lógico etapa_evaluacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s4"."etapas_rubrica"."scope" IS 'MER: tipo lógico alcance_etapa_rubrica_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."evaluaciones" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_asignacion_tribunal" uuid NOT NULL,
    "id_version_rubrica" uuid NOT NULL,
    "id_etapa_rubrica" uuid,
    "etapa" text,
    "estado" text DEFAULT 'BORRADOR',
    "instantanea_rubrica" jsonb,
    "calificacion_total" numeric,
    "instantanea_calificacion_maxima" numeric,
    "revision" integer,
    "cerrada_en" timestamptz,
    "creado_en" timestamptz DEFAULT now(),
    "actualizado_en" timestamptz DEFAULT now(),
    "id_proceso_evaluacion" uuid NOT NULL,
    "id_estudiante" uuid,
    CONSTRAINT "pk_s4_evaluaciones" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s4"."evaluaciones"."etapa" IS 'MER: tipo lógico etapa_evaluacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s4"."evaluaciones"."estado" IS 'MER: tipo lógico estado_evaluacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."eventos_auditoria_evaluacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_evaluacion" uuid NOT NULL,
    "actor_id" varchar,
    "accion" varchar,
    "detalles" jsonb,
    "correlation_id" varchar,
    "ocurrido_en" timestamptz,
    CONSTRAINT "pk_s4_eventos_auditoria_evaluacion" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."eventos_trazabilidad_trabajo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ocurrido_en" timestamptz,
    "tipo_evento" varchar,
    "entidad_tipo" varchar,
    "entidad_id" uuid,
    "actor_id" varchar,
    "actor_tipo" varchar,
    "origen" varchar,
    "correlation_id" varchar,
    "detalles" jsonb,
    "evidencia" varchar,
    "fuente_tipo" varchar,
    "fuente_id" uuid,
    "id_proceso_evaluacion" uuid NOT NULL,
    CONSTRAINT "pk_s4_eventos_trazabilidad_trabajo" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."historial_nota_minima" (
    "id" bigint NOT NULL,
    "valor_anterior" numeric,
    "valor_nuevo" numeric,
    "cambiado_en" timestamptz,
    "cambiado_por" varchar,
    CONSTRAINT "pk_s4_historial_nota_minima" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."indicadores_rubrica" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_categoria" uuid NOT NULL,
    "label" varchar,
    "descripcion" text,
    "calificacion_maxima" numeric,
    "orden" smallint,
    CONSTRAINT "pk_s4_indicadores_rubrica" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."notificaciones" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id_cuenta" uuid NOT NULL,
    "type" text,
    "titulo" varchar,
    "mensaje" text,
    "ruta_accion" varchar,
    "creado_en" timestamptz DEFAULT now(),
    "leida_en" timestamptz,
    "id_proceso_evaluacion" uuid NOT NULL,
    CONSTRAINT "pk_s4_notificaciones" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s4"."notificaciones"."type" IS 'MER: tipo lógico tipo_notificacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."procesos_evaluacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_version_rubrica" uuid,
    "estado" text DEFAULT 'REGISTRADO',
    "creado_en" timestamptz DEFAULT now(),
    "actualizado_en" timestamptz DEFAULT now(),
    "asignacion_tema_id" uuid NOT NULL,
    CONSTRAINT "pk_s4_procesos_evaluacion" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s4_procesos_evaluacion_asignacion_tema_id" UNIQUE ("asignacion_tema_id")
);

COMMENT ON COLUMN "s4"."procesos_evaluacion"."estado" IS 'MER: tipo lógico estado_trabajo_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."programacion_estudiante" (
    "programacion_estudiante_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "programacion_sustentacion_id" uuid NOT NULL,
    "id_estudiante" uuid NOT NULL,
    CONSTRAINT "pk_s4_programacion_estudiante" PRIMARY KEY ("programacion_estudiante_id")
);


CREATE TABLE "s4"."programaciones_sustentacion" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "fecha_programada" date,
    "hora_programada" time,
    "hora_fin_programada" time,
    "sala" varchar,
    "duracion_estimada_minutos" smallint,
    "estado" text DEFAULT 'PROGRAMADA',
    "scheduled_by_id_cuenta" uuid,
    "scheduled_by_actor_id" varchar,
    "creado_en" timestamptz DEFAULT now(),
    "tipo" text,
    "actualizado_en" timestamptz DEFAULT now(),
    "id_proceso_evaluacion" uuid NOT NULL,
    CONSTRAINT "pk_s4_programaciones_sustentacion" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s4"."programaciones_sustentacion"."estado" IS 'MER: tipo lógico estado_sustentacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';
COMMENT ON COLUMN "s4"."programaciones_sustentacion"."tipo" IS 'MER: tipo lógico tipo_sustentacion_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."rubricas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_modalidad" uuid NOT NULL,
    "nombre" varchar,
    "descripcion" text,
    "creado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_s4_rubricas" PRIMARY KEY ("id"),
    CONSTRAINT "uq_s4_rubricas_id_modalidad" UNIQUE ("id_modalidad")
);


CREATE TABLE "s4"."traspasos_evaluacion_estudiante" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_evaluacion" uuid NOT NULL,
    "id_estudiante" uuid NOT NULL,
    "traspasado_en" timestamptz,
    "id_proceso_evaluacion" uuid NOT NULL,
    CONSTRAINT "pk_s4_traspasos_evaluacion_estudiante" PRIMARY KEY ("id")
);


CREATE TABLE "s4"."versiones_rubrica" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_rubrica" uuid NOT NULL,
    "periodo_academico_id" uuid NOT NULL,
    "id_version_base" uuid,
    "version" varchar,
    "estado" text DEFAULT 'BORRADOR',
    "revision" integer,
    "activada_en" timestamptz,
    "creado_en" timestamptz DEFAULT now(),
    CONSTRAINT "pk_s4_versiones_rubrica" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "s4"."versiones_rubrica"."estado" IS 'MER: tipo lógico estado_version_rubrica_enum; TEXT provisional hasta definir enumeración con el equipo propietario';

CREATE TABLE "s4"."versiones_rubrica_carreras" (
    "id_version_rubrica" uuid NOT NULL,
    "id_carrera" uuid NOT NULL,
    "id_rubrica" uuid NOT NULL,
    "id_modalidad" uuid NOT NULL,
    "periodo_academico_id" uuid NOT NULL,
    "asociado_en" timestamptz,
    CONSTRAINT "pk_s4_versiones_rubrica_carreras" PRIMARY KEY ("id_version_rubrica", "id_carrera")
);


CREATE TABLE "s4"."vigencias_rubrica_carrera" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "id_version_rubrica" uuid NOT NULL,
    "id_carrera" uuid NOT NULL,
    "id_rubrica" uuid NOT NULL,
    "id_modalidad" uuid NOT NULL,
    "periodo_academico_id" uuid NOT NULL,
    "vigente_desde" timestamptz,
    "vigente_hasta" timestamptz,
    CONSTRAINT "pk_s4_vigencias_rubrica_carrera" PRIMARY KEY ("id")
);




-- ===== 002_claves_foraneas.sql =====
-- Relaciones físicas: 181 aristas del MER integrado.
-- Un UNIQUE de soporte sobre referencia compuesta es necesario en PostgreSQL
-- si las columnas de destino no forman ya una clave candidata.
-- R152 es N:1 (varias sesiones por trabajo), no UNIQUE en el lado hijo.

ALTER TABLE "s2"."grupo" ADD CONSTRAINT "uq_ref_r069" UNIQUE ("id", "periodo_id");
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "uq_ref_r070" UNIQUE ("periodo_id", "estudiante_id");
ALTER TABLE "gen"."tema" ADD CONSTRAINT "uq_ref_r074" UNIQUE ("id", "periodo_titulacion_id");
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "uq_ref_r077" UNIQUE ("id", "tema_id");
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "uq_ref_r078" UNIQUE ("id", "grupo_id");
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "uq_ref_r079" UNIQUE ("id", "estudiante_id");
ALTER TABLE "s2"."tutor_propuesto" ADD CONSTRAINT "uq_ref_r080" UNIQUE ("id", "docente_id");
ALTER TABLE "s2"."conflicto_participante" ADD CONSTRAINT "uq_ref_r083" UNIQUE ("resolucion_conflicto_id", "postulacion_id");
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "uq_ref_r084" UNIQUE ("id", "tema_id");
ALTER TABLE "s4"."etapas_rubrica" ADD CONSTRAINT "uq_ref_r158" UNIQUE ("id", "id_version_rubrica");
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "uq_ref_r162" UNIQUE ("id", "id_proceso_evaluacion");
ALTER TABLE "s4"."versiones_rubrica" ADD CONSTRAINT "uq_ref_r171" UNIQUE ("id", "id_rubrica");
ALTER TABLE "s4"."versiones_rubrica" ADD CONSTRAINT "uq_ref_r173" UNIQUE ("id", "id_rubrica", "periodo_academico_id");
ALTER TABLE "s4"."rubricas" ADD CONSTRAINT "uq_ref_r174" UNIQUE ("id", "id_modalidad");
ALTER TABLE "s4"."versiones_rubrica_carreras" ADD CONSTRAINT "uq_ref_r176" UNIQUE ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id");

ALTER TABLE "s1"."version_malla" ADD CONSTRAINT "fk_r001" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."asignatura_malla" ADD CONSTRAINT "fk_r002" FOREIGN KEY ("id_version_malla") REFERENCES "s1"."version_malla" ("id_version_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."grupo_prerrequisito" ADD CONSTRAINT "fk_r003" FOREIGN KEY ("id_asignatura_objetivo") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."item_prerrequisito" ADD CONSTRAINT "fk_r004" FOREIGN KEY ("id_grupo_prerrequisito") REFERENCES "s1"."grupo_prerrequisito" ("id_grupo_prerrequisito") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."item_prerrequisito" ADD CONSTRAINT "fk_r005" FOREIGN KEY ("id_asignatura_requerida") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."equivalencia_asignatura" ADD CONSTRAINT "fk_r006" FOREIGN KEY ("id_asignatura_origen") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."equivalencia_asignatura" ADD CONSTRAINT "fk_r007" FOREIGN KEY ("id_asignatura_equivalente") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."asignacion_malla" ADD CONSTRAINT "fk_r008" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."asignacion_malla" ADD CONSTRAINT "fk_r009" FOREIGN KEY ("id_version_malla") REFERENCES "s1"."version_malla" ("id_version_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."asignacion_malla" ADD CONSTRAINT "fk_r010" FOREIGN KEY ("periodo_desde") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."asignacion_malla" ADD CONSTRAINT "fk_r011" FOREIGN KEY ("periodo_hasta") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."esquema_notas" ADD CONSTRAINT "fk_r012" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."esquema_notas" ADD CONSTRAINT "fk_r013" FOREIGN KEY ("id_periodo") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."lote_importacion" ADD CONSTRAINT "fk_r014" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."lote_importacion" ADD CONSTRAINT "fk_r015" FOREIGN KEY ("id_version_malla") REFERENCES "s1"."version_malla" ("id_version_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."lote_importacion" ADD CONSTRAINT "fk_r016" FOREIGN KEY ("id_periodo") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."incidencia_importacion" ADD CONSTRAINT "fk_r017" FOREIGN KEY ("id_lote") REFERENCES "s1"."lote_importacion" ("id_lote") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."registro_asignatura" ADD CONSTRAINT "fk_r018" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."registro_asignatura" ADD CONSTRAINT "fk_r019" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."registro_asignatura" ADD CONSTRAINT "fk_r020" FOREIGN KEY ("id_periodo") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."registro_asignatura" ADD CONSTRAINT "fk_r021" FOREIGN KEY ("id_asignatura_malla") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."registro_asignatura" ADD CONSTRAINT "fk_r022" FOREIGN KEY ("id_lote") REFERENCES "s1"."lote_importacion" ("id_lote") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."componente_nota" ADD CONSTRAINT "fk_r023" FOREIGN KEY ("id_registro") REFERENCES "s1"."registro_asignatura" ("id_registro") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."componente_nota" ADD CONSTRAINT "fk_r024" FOREIGN KEY ("id_lote") REFERENCES "s1"."lote_importacion" ("id_lote") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."ejecucion_validacion" ADD CONSTRAINT "fk_r025" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."ejecucion_validacion" ADD CONSTRAINT "fk_r026" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."ejecucion_validacion" ADD CONSTRAINT "fk_r027" FOREIGN KEY ("id_proceso") REFERENCES "s1"."proceso_elegibilidad" ("id_proceso") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."ejecucion_validacion" ADD CONSTRAINT "fk_r028" FOREIGN KEY ("id_asignacion_malla") REFERENCES "s1"."asignacion_malla" ("id_asignacion_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."ejecucion_validacion" ADD CONSTRAINT "fk_r029" FOREIGN KEY ("id_periodo_evaluado") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."detalle_validacion" ADD CONSTRAINT "fk_r030" FOREIGN KEY ("id_ejecucion") REFERENCES "s1"."ejecucion_validacion" ("id_ejecucion") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."detalle_validacion" ADD CONSTRAINT "fk_r031" FOREIGN KEY ("id_registro") REFERENCES "s1"."registro_asignatura" ("id_registro") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s1"."detalle_validacion" ADD CONSTRAINT "fk_r032" FOREIGN KEY ("id_asignatura_requisito") REFERENCES "s1"."asignatura_malla" ("id_asignatura_malla") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."estudiante" ADD CONSTRAINT "fk_r033" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."docente" ADD CONSTRAINT "fk_r034" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "fk_r035" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "fk_r036" FOREIGN KEY ("estudiante_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "fk_r037" FOREIGN KEY ("lote_importacion_id") REFERENCES "s2"."lote_importacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "fk_r038" FOREIGN KEY ("resuelto_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."lote_importacion" ADD CONSTRAINT "fk_r039" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."lote_importacion" ADD CONSTRAINT "fk_r040" FOREIGN KEY ("ejecutado_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."solicitud_exportacion" ADD CONSTRAINT "fk_r041" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."solicitud_exportacion" ADD CONSTRAINT "fk_r042" FOREIGN KEY ("solicitada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r043" FOREIGN KEY ("periodo_titulacion_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r044" FOREIGN KEY ("linea_id") REFERENCES "s2"."linea_investigacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r045" FOREIGN KEY ("docente_proponente_id") REFERENCES "gen"."docente" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."tema_historial" ADD CONSTRAINT "fk_r046" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."tema_historial" ADD CONSTRAINT "fk_r047" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."grupo" ADD CONSTRAINT "fk_r048" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r049" FOREIGN KEY ("registrada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."tutor_propuesto" ADD CONSTRAINT "fk_r050" FOREIGN KEY ("postulacion_id") REFERENCES "s2"."postulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."tutor_propuesto" ADD CONSTRAINT "fk_r051" FOREIGN KEY ("docente_id") REFERENCES "gen"."docente" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r052" FOREIGN KEY ("aprobada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r053" FOREIGN KEY ("anulada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tutor" ADD CONSTRAINT "fk_r054" FOREIGN KEY ("asignacion_tema_id") REFERENCES "s2"."asignacion_tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tutor" ADD CONSTRAINT "fk_r055" FOREIGN KEY ("docente_id") REFERENCES "gen"."docente" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tutor" ADD CONSTRAINT "fk_r056" FOREIGN KEY ("asignada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."config_carga_tutorial" ADD CONSTRAINT "fk_r057" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."config_carga_tutorial" ADD CONSTRAINT "fk_r058" FOREIGN KEY ("docente_id") REFERENCES "gen"."docente" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r059" FOREIGN KEY ("resuelto_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."plantilla_pat" ADD CONSTRAINT "fk_r060" FOREIGN KEY ("periodo_id") REFERENCES "s2"."periodo_titulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."plantilla_pat" ADD CONSTRAINT "fk_r061" FOREIGN KEY ("publicada_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."documento_pat" ADD CONSTRAINT "fk_r062" FOREIGN KEY ("asignacion_tema_id") REFERENCES "s2"."asignacion_tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."documento_pat" ADD CONSTRAINT "fk_r063" FOREIGN KEY ("plantilla_id") REFERENCES "s2"."plantilla_pat" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."documento_pat" ADD CONSTRAINT "fk_r064" FOREIGN KEY ("cargado_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."revision_pat" ADD CONSTRAINT "fk_r065" FOREIGN KEY ("documento_pat_id") REFERENCES "s2"."documento_pat" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."revision_pat" ADD CONSTRAINT "fk_r066" FOREIGN KEY ("revisor_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."notificacion" ADD CONSTRAINT "fk_r067" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."auditoria" ADD CONSTRAINT "fk_r068" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."grupo_integrante" ADD CONSTRAINT "fk_r069" FOREIGN KEY ("grupo_id", "periodo_id") REFERENCES "s2"."grupo" ("id", "periodo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."grupo_integrante" ADD CONSTRAINT "fk_r070" FOREIGN KEY ("periodo_id", "estudiante_id") REFERENCES "s2"."estudiante_habilitado" ("periodo_id", "estudiante_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r071" FOREIGN KEY ("grupo_id", "periodo_id") REFERENCES "s2"."grupo" ("id", "periodo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r072" FOREIGN KEY ("periodo_id", "estudiante_emisor_id") REFERENCES "s2"."estudiante_habilitado" ("periodo_id", "estudiante_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r073" FOREIGN KEY ("periodo_id", "estudiante_destino_id") REFERENCES "s2"."estudiante_habilitado" ("periodo_id", "estudiante_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r074" FOREIGN KEY ("tema_id", "periodo_id") REFERENCES "gen"."tema" ("id", "periodo_titulacion_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r075" FOREIGN KEY ("grupo_id", "periodo_id") REFERENCES "s2"."grupo" ("id", "periodo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r076" FOREIGN KEY ("periodo_id", "estudiante_id") REFERENCES "s2"."estudiante_habilitado" ("periodo_id", "estudiante_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r077" FOREIGN KEY ("postulacion_id", "tema_id") REFERENCES "s2"."postulacion" ("id", "tema_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r078" FOREIGN KEY ("postulacion_id", "grupo_id") REFERENCES "s2"."postulacion" ("id", "grupo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r079" FOREIGN KEY ("postulacion_id", "estudiante_id") REFERENCES "s2"."postulacion" ("id", "estudiante_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tutor" ADD CONSTRAINT "fk_r080" FOREIGN KEY ("tutor_propuesto_id", "docente_id") REFERENCES "s2"."tutor_propuesto" ("id", "docente_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r081" FOREIGN KEY ("tema_id", "periodo_id") REFERENCES "gen"."tema" ("id", "periodo_titulacion_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r082" FOREIGN KEY ("postulacion_ganadora_id", "tema_id") REFERENCES "s2"."postulacion" ("id", "tema_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r083" FOREIGN KEY ("id", "postulacion_ganadora_id") REFERENCES "s2"."conflicto_participante" ("resolucion_conflicto_id", "postulacion_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."conflicto_participante" ADD CONSTRAINT "fk_r084" FOREIGN KEY ("resolucion_conflicto_id", "tema_id") REFERENCES "s2"."resolucion_conflicto" ("id", "tema_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."conflicto_participante" ADD CONSTRAINT "fk_r085" FOREIGN KEY ("postulacion_id", "tema_id") REFERENCES "s2"."postulacion" ("id", "tema_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."grupo_integrante" ADD CONSTRAINT "fk_r086" FOREIGN KEY ("grupo_id") REFERENCES "s2"."grupo" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."grupo_integrante" ADD CONSTRAINT "fk_r087" FOREIGN KEY ("estudiante_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r088" FOREIGN KEY ("grupo_id") REFERENCES "s2"."grupo" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r089" FOREIGN KEY ("estudiante_emisor_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."invitacion" ADD CONSTRAINT "fk_r090" FOREIGN KEY ("estudiante_destino_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r091" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r092" FOREIGN KEY ("grupo_id") REFERENCES "s2"."grupo" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."postulacion" ADD CONSTRAINT "fk_r093" FOREIGN KEY ("estudiante_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r094" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r095" FOREIGN KEY ("postulacion_id") REFERENCES "s2"."postulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r096" FOREIGN KEY ("grupo_id") REFERENCES "s2"."grupo" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tema" ADD CONSTRAINT "fk_r097" FOREIGN KEY ("estudiante_id") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r098" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."resolucion_conflicto" ADD CONSTRAINT "fk_r099" FOREIGN KEY ("postulacion_ganadora_id") REFERENCES "s2"."postulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."conflicto_participante" ADD CONSTRAINT "fk_r100" FOREIGN KEY ("resolucion_conflicto_id") REFERENCES "s2"."resolucion_conflicto" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."conflicto_participante" ADD CONSTRAINT "fk_r101" FOREIGN KEY ("postulacion_id") REFERENCES "s2"."postulacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."asignacion_tutor" ADD CONSTRAINT "fk_r102" FOREIGN KEY ("tutor_propuesto_id") REFERENCES "s2"."tutor_propuesto" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."rol_permiso" ADD CONSTRAINT "fk_r103" FOREIGN KEY ("rol_id") REFERENCES "gen"."rol" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."rol_permiso" ADD CONSTRAINT "fk_r104" FOREIGN KEY ("permiso_id") REFERENCES "gen"."permiso" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."notificacion" ADD CONSTRAINT "fk_r105" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."estudiante" ADD CONSTRAINT "fk_r106" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."estudiante" ADD CONSTRAINT "fk_r107" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r108" FOREIGN KEY ("modalidad_id") REFERENCES "gen"."modalidad" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r109" FOREIGN KEY ("tutor_usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r110" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."tema" ADD CONSTRAINT "fk_r111" FOREIGN KEY ("periodo_academico_id") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."tema_historial" ADD CONSTRAINT "fk_r113" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."tema_historial" ADD CONSTRAINT "fk_r114" FOREIGN KEY ("fase_id") REFERENCES "s3"."fase" ("fase_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."documento" ADD CONSTRAINT "fk_r115" FOREIGN KEY ("tema_id") REFERENCES "gen"."tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."documento" ADD CONSTRAINT "fk_r116" FOREIGN KEY ("tipo_documento_id") REFERENCES "s3"."tipo_documento" ("tipo_documento_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."documento_version" ADD CONSTRAINT "fk_r117" FOREIGN KEY ("documento_id") REFERENCES "s3"."documento" ("documento_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."documento_version" ADD CONSTRAINT "fk_r118" FOREIGN KEY ("subido_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."documento_version" ADD CONSTRAINT "fk_r119" FOREIGN KEY ("revisado_por_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."tipo_documento" ADD CONSTRAINT "fk_r120" FOREIGN KEY ("fase_id") REFERENCES "s3"."fase" ("fase_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."modalidad_tipo_documento" ADD CONSTRAINT "fk_r121" FOREIGN KEY ("modalidad_id") REFERENCES "gen"."modalidad" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."modalidad_tipo_documento" ADD CONSTRAINT "fk_r122" FOREIGN KEY ("tipo_documento_id") REFERENCES "s3"."tipo_documento" ("tipo_documento_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."estudiante" ADD CONSTRAINT "fk_r123" FOREIGN KEY ("persona_id") REFERENCES "gen"."persona" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."docente" ADD CONSTRAINT "fk_r124" FOREIGN KEY ("persona_id") REFERENCES "gen"."persona" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."docente" ADD CONSTRAINT "fk_r125" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."usuario" ADD CONSTRAINT "fk_r126" FOREIGN KEY ("persona_id") REFERENCES "gen"."persona" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."usuario_rol" ADD CONSTRAINT "fk_r127" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."usuario_rol" ADD CONSTRAINT "fk_r128" FOREIGN KEY ("rol_id") REFERENCES "gen"."rol" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."usuario_carrera" ADD CONSTRAINT "fk_r129" FOREIGN KEY ("usuario_id") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "gen"."usuario_carrera" ADD CONSTRAINT "fk_r130" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."rubricas" ADD CONSTRAINT "fk_r131" FOREIGN KEY ("id_modalidad") REFERENCES "gen"."modalidad" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica" ADD CONSTRAINT "fk_r132" FOREIGN KEY ("id_rubrica") REFERENCES "s4"."rubricas" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica" ADD CONSTRAINT "fk_r133" FOREIGN KEY ("periodo_academico_id") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."categorias_rubrica" ADD CONSTRAINT "fk_r134" FOREIGN KEY ("id_version_rubrica") REFERENCES "s4"."versiones_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."categorias_rubrica" ADD CONSTRAINT "fk_r135" FOREIGN KEY ("id_etapa_rubrica") REFERENCES "s4"."etapas_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."indicadores_rubrica" ADD CONSTRAINT "fk_r136" FOREIGN KEY ("id_categoria") REFERENCES "s4"."categorias_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."etapas_rubrica" ADD CONSTRAINT "fk_r137" FOREIGN KEY ("id_version_rubrica") REFERENCES "s4"."versiones_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."procesos_evaluacion" ADD CONSTRAINT "fk_r141" FOREIGN KEY ("id_version_rubrica") REFERENCES "s4"."versiones_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."programaciones_sustentacion" ADD CONSTRAINT "fk_r152" FOREIGN KEY ("id_proceso_evaluacion") REFERENCES "s4"."procesos_evaluacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."programaciones_sustentacion" ADD CONSTRAINT "fk_r153" FOREIGN KEY ("scheduled_by_id_cuenta") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "fk_r154" FOREIGN KEY ("id_proceso_evaluacion") REFERENCES "s4"."procesos_evaluacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "fk_r155" FOREIGN KEY ("id_asignacion_tribunal") REFERENCES "s3"."asignacion_tribunal" ("asignacion_tribunal_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "fk_r156" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "fk_r157" FOREIGN KEY ("id_version_rubrica") REFERENCES "s4"."versiones_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."evaluaciones" ADD CONSTRAINT "fk_r158" FOREIGN KEY ("id_etapa_rubrica", "id_version_rubrica") REFERENCES "s4"."etapas_rubrica" ("id", "id_version_rubrica") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."calificaciones_evaluacion" ADD CONSTRAINT "fk_r159" FOREIGN KEY ("id_evaluacion") REFERENCES "s4"."evaluaciones" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."calificaciones_evaluacion" ADD CONSTRAINT "fk_r160" FOREIGN KEY ("id_indicador") REFERENCES "s4"."indicadores_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."eventos_auditoria_evaluacion" ADD CONSTRAINT "fk_r161" FOREIGN KEY ("id_evaluacion") REFERENCES "s4"."evaluaciones" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."traspasos_evaluacion_estudiante" ADD CONSTRAINT "fk_r162" FOREIGN KEY ("id_evaluacion", "id_proceso_evaluacion") REFERENCES "s4"."evaluaciones" ("id", "id_proceso_evaluacion") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."traspasos_evaluacion_estudiante" ADD CONSTRAINT "fk_r163" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."notificaciones" ADD CONSTRAINT "fk_r164" FOREIGN KEY ("recipient_id_cuenta") REFERENCES "gen"."usuario" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."notificaciones" ADD CONSTRAINT "fk_r165" FOREIGN KEY ("id_proceso_evaluacion") REFERENCES "s4"."procesos_evaluacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r166" FOREIGN KEY ("rubrica_id") REFERENCES "s4"."rubricas" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r167" FOREIGN KEY ("version_id") REFERENCES "s4"."versiones_rubrica" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r168" FOREIGN KEY ("modalidad_id") REFERENCES "gen"."modalidad" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r169" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r170" FOREIGN KEY ("periodo_academico_id") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r171" FOREIGN KEY ("version_id", "rubrica_id") REFERENCES "s4"."versiones_rubrica" ("id", "id_rubrica") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."auditoria_rubricas" ADD CONSTRAINT "fk_r172" FOREIGN KEY ("version_anterior_id", "rubrica_id") REFERENCES "s4"."versiones_rubrica" ("id", "id_rubrica") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica_carreras" ADD CONSTRAINT "fk_r173" FOREIGN KEY ("id_version_rubrica", "id_rubrica", "periodo_academico_id") REFERENCES "s4"."versiones_rubrica" ("id", "id_rubrica", "periodo_academico_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica_carreras" ADD CONSTRAINT "fk_r174" FOREIGN KEY ("id_rubrica", "id_modalidad") REFERENCES "s4"."rubricas" ("id", "id_modalidad") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica_carreras" ADD CONSTRAINT "fk_r175" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."vigencias_rubrica_carrera" ADD CONSTRAINT "fk_r176" FOREIGN KEY ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id") REFERENCES "s4"."versiones_rubrica_carreras" ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."versiones_rubrica" ADD CONSTRAINT "fk_r177" FOREIGN KEY ("id_version_base", "id_rubrica") REFERENCES "s4"."versiones_rubrica" ("id", "id_rubrica") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."consecutivos_acta" ADD CONSTRAINT "fk_r178" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."actas_archivadas" ADD CONSTRAINT "fk_r179" FOREIGN KEY ("id_carrera") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."actas_archivadas" ADD CONSTRAINT "fk_r180" FOREIGN KEY ("id_periodo") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."actas_archivadas" ADD CONSTRAINT "fk_r181" FOREIGN KEY ("id_proceso_evaluacion") REFERENCES "s4"."procesos_evaluacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."actas_archivadas" ADD CONSTRAINT "fk_r182" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."eventos_trazabilidad_trabajo" ADD CONSTRAINT "fk_r184" FOREIGN KEY ("id_proceso_evaluacion") REFERENCES "s4"."procesos_evaluacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."estudiante_habilitado" ADD CONSTRAINT "fk_r185" FOREIGN KEY ("ejecucion_validacion_id") REFERENCES "s1"."ejecucion_validacion" ("id_ejecucion") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s2"."periodo_titulacion" ADD CONSTRAINT "fk_r186" FOREIGN KEY ("periodo_academico_id") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."docente_carrera_periodo" ADD CONSTRAINT "fk_r188" FOREIGN KEY ("docente_id") REFERENCES "gen"."docente" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."docente_carrera_periodo" ADD CONSTRAINT "fk_r189" FOREIGN KEY ("carrera_id") REFERENCES "gen"."carrera" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."docente_carrera_periodo" ADD CONSTRAINT "fk_r190" FOREIGN KEY ("periodo_academico_id") REFERENCES "gen"."periodo_academico" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."miembros_tribunal" ADD CONSTRAINT "fk_r191" FOREIGN KEY ("docente_carrera_periodo_id") REFERENCES "s3"."docente_carrera_periodo" ("docente_carrera_periodo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."presidente_tribunal" ADD CONSTRAINT "fk_r192" FOREIGN KEY ("docente_carrera_periodo_id") REFERENCES "s3"."docente_carrera_periodo" ("docente_carrera_periodo_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."asignacion_tribunal" ADD CONSTRAINT "fk_r193" FOREIGN KEY ("miembro_tribunal_id") REFERENCES "s3"."miembros_tribunal" ("miembro_tribunal_id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s3"."asignacion_tribunal" ADD CONSTRAINT "fk_r194" FOREIGN KEY ("asignacion_tema_id") REFERENCES "s2"."asignacion_tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."programacion_estudiante" ADD CONSTRAINT "fk_r195" FOREIGN KEY ("programacion_sustentacion_id") REFERENCES "s4"."programaciones_sustentacion" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."programacion_estudiante" ADD CONSTRAINT "fk_r196" FOREIGN KEY ("id_estudiante") REFERENCES "gen"."estudiante" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "s4"."procesos_evaluacion" ADD CONSTRAINT "fk_r197" FOREIGN KEY ("asignacion_tema_id") REFERENCES "s2"."asignacion_tema" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

-- Índices de búsqueda en FKs centrales para evaluar y programar.
CREATE INDEX "idx_s4_procesos_evaluacion_asignacion_tema_id" ON "s4"."procesos_evaluacion" ("asignacion_tema_id");
CREATE INDEX "idx_s4_evaluaciones_id_proceso_evaluacion" ON "s4"."evaluaciones" ("id_proceso_evaluacion");
CREATE INDEX "idx_s4_evaluaciones_id_asignacion_tribunal" ON "s4"."evaluaciones" ("id_asignacion_tribunal");
CREATE INDEX "idx_s4_programaciones_sustentacion_id_proceso_evaluacion" ON "s4"."programaciones_sustentacion" ("id_proceso_evaluacion");
CREATE INDEX "idx_s4_programacion_estudiante_id_estudiante" ON "s4"."programacion_estudiante" ("id_estudiante");
CREATE INDEX "idx_s3_asignacion_tribunal_asignacion_tema_id" ON "s3"."asignacion_tribunal" ("asignacion_tema_id");
CREATE INDEX "idx_s2_asignacion_tema_tema_id" ON "s2"."asignacion_tema" ("tema_id");


-- ===== 003_reglas_integracion_s2_s3_s4.sql =====
-- DESARROLLO: reglas de integración S2-S3-S4 según el MER revisado.
-- Los equipos propietarios deben revisar estas restricciones antes de producción.
-- No se crea una entidad duplicada de trabajo, participantes ni tutores.

-- Reglas del S2 documentadas en su MER (replicadas únicamente en base DEV vacía).
ALTER TABLE s2.asignacion_tema ADD CONSTRAINT ck_s2_asignacion_tema_xor
  CHECK (num_nonnulls(grupo_id,estudiante_id)=1);
CREATE UNIQUE INDEX uq_s2_tema_vigente ON s2.asignacion_tema(tema_id)
  WHERE estado='VIGENTE';
CREATE UNIQUE INDEX uq_s2_grupo_vigente ON s2.asignacion_tema(grupo_id)
  WHERE estado='VIGENTE' AND grupo_id IS NOT NULL;
CREATE UNIQUE INDEX uq_s2_estudiante_vigente ON s2.asignacion_tema(estudiante_id)
  WHERE estado='VIGENTE' AND estudiante_id IS NOT NULL;

-- El tribunal de S3 se vincula a la asignación específica de S2, no al archivo ni a otro proyecto.
ALTER TABLE s3.asignacion_tribunal ADD CONSTRAINT uq_s3_asignacion_miembro_tema
  UNIQUE (asignacion_tema_id,miembro_tribunal_id);
-- Participante por sesión, con referencia directa a gen.estudiante y validación S2.
ALTER TABLE s4.programacion_estudiante ADD CONSTRAINT uq_s4_programacion_estudiante
  UNIQUE (programacion_sustentacion_id,id_estudiante);

-- Una evaluación compartida por evaluador/proceso/etapa, o individual por estudiante.
CREATE UNIQUE INDEX uq_s4_evaluacion_compartida
 ON s4.evaluaciones(id_proceso_evaluacion,id_asignacion_tribunal,id_etapa_rubrica)
 WHERE id_estudiante IS NULL;
CREATE UNIQUE INDEX uq_s4_evaluacion_individual
 ON s4.evaluaciones(id_proceso_evaluacion,id_asignacion_tribunal,id_etapa_rubrica,id_estudiante)
 WHERE id_estudiante IS NOT NULL;

ALTER TABLE s4.programaciones_sustentacion
 ALTER COLUMN id_proceso_evaluacion SET NOT NULL,
 ALTER COLUMN fecha_programada SET NOT NULL,
 ALTER COLUMN hora_programada SET NOT NULL,
 ALTER COLUMN hora_fin_programada SET NOT NULL,
 ALTER COLUMN sala SET NOT NULL,
 ALTER COLUMN estado SET NOT NULL;
ALTER TABLE s4.programaciones_sustentacion
 ADD CONSTRAINT ck_s4_horario_intervalo CHECK(hora_fin_programada>hora_programada),
 ADD CONSTRAINT ck_s4_sala_nombre CHECK(btrim(sala)<>'');
ALTER TABLE s4.evaluaciones
 ALTER COLUMN id_proceso_evaluacion SET NOT NULL,
 ALTER COLUMN id_asignacion_tribunal SET NOT NULL,
 ALTER COLUMN id_etapa_rubrica SET NOT NULL,
 ALTER COLUMN id_version_rubrica SET NOT NULL;

-- Reserva por sala: dos sustentaciones sí pueden coincidir si son en aulas diferentes.
ALTER TABLE s4.programaciones_sustentacion
 ADD CONSTRAINT ex_s4_sala_solapada EXCLUDE USING gist (
   (lower(btrim(sala))) WITH =,
   (tsrange(fecha_programada + hora_programada,
            fecha_programada + hora_fin_programada,'[)')) WITH &&
 ) WHERE (estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA'));

-- Predicado compartido: el estudiante pertenece a la asignación académica concreta.
-- Una asignación puede ser individual o grupal, nunca ambas (XOR de S2).
CREATE FUNCTION s4.estudiante_pertenece_asignacion(p_asignacion uuid,p_estudiante uuid)
 RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
    SELECT 1 FROM s2.asignacion_tema a
    WHERE a.id=p_asignacion AND (
       a.estudiante_id=p_estudiante OR
       (a.grupo_id IS NOT NULL AND EXISTS(
          SELECT 1 FROM s2.grupo_integrante gi
          WHERE gi.grupo_id=a.grupo_id AND gi.estudiante_id=p_estudiante
            AND gi.estado='ACTIVO'
       ))
    )
 );
$$;

-- 1. Contexto de evaluación: tribunal asignado por S3, estudiante validado por S2.
CREATE FUNCTION s4.validar_contexto_evaluacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
 v_asignacion uuid;
 v_version uuid;
 v_scope text;
 v_kind text;
BEGIN
 SELECT asignacion_tema_id,id_version_rubrica INTO v_asignacion,v_version
   FROM s4.procesos_evaluacion WHERE id=NEW.id_proceso_evaluacion;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso de evaluación S4 inexistente'; END IF;
 IF v_version IS DISTINCT FROM NEW.id_version_rubrica THEN
   RAISE EXCEPTION 'La versión de rúbrica no corresponde al proceso';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM s3.asignacion_tribunal a
                WHERE a.asignacion_tribunal_id=NEW.id_asignacion_tribunal
                  AND a.asignacion_tema_id=v_asignacion) THEN
    RAISE EXCEPTION 'Integrante de tribunal no asignado a esta asignación académica';
 END IF;
 SELECT scope,kind INTO v_scope,v_kind FROM s4.etapas_rubrica
 WHERE id=NEW.id_etapa_rubrica AND id_version_rubrica=NEW.id_version_rubrica;
 IF NOT FOUND OR v_kind IS DISTINCT FROM NEW.etapa THEN
    RAISE EXCEPTION 'Etapa incompatible con la versión de rúbrica';
 END IF;
 IF v_scope='ESTUDIANTE_INDIVIDUAL' THEN
   IF NEW.id_estudiante IS NULL OR
      NOT s4.estudiante_pertenece_asignacion(v_asignacion,NEW.id_estudiante) THEN
      RAISE EXCEPTION 'La evaluación individual no corresponde a un estudiante de S2';
   END IF;
 ELSIF v_scope='TRABAJO_COMPARTIDO' THEN
   IF NEW.id_estudiante IS NOT NULL THEN
      RAISE EXCEPTION 'Una evaluación compartida no lleva estudiante individual';
   END IF;
 ELSE
   RAISE EXCEPTION 'Alcance de etapa no reconocido: %',v_scope;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_contexto_evaluacion
 BEFORE INSERT OR UPDATE OF id_proceso_evaluacion,id_asignacion_tribunal,id_estudiante,
  id_etapa_rubrica,id_version_rubrica,etapa
 ON s4.evaluaciones FOR EACH ROW EXECUTE FUNCTION s4.validar_contexto_evaluacion();

-- 2. Rúbrica no modificable una vez iniciada cualquier evaluación.
CREATE FUNCTION s4.proteger_version_rubrica_proceso() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id_version_rubrica IS DISTINCT FROM OLD.id_version_rubrica
   AND EXISTS(SELECT 1 FROM s4.evaluaciones
              WHERE id_proceso_evaluacion=OLD.id) THEN
   RAISE EXCEPTION 'No se puede sustituir una rúbrica con evaluaciones iniciadas';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_version_rubrica_proceso
 BEFORE UPDATE OF id_version_rubrica ON s4.procesos_evaluacion
 FOR EACH ROW EXECUTE FUNCTION s4.proteger_version_rubrica_proceso();

-- Los datos académicos se leen de gen.tema a través de s2.asignacion_tema.
CREATE FUNCTION s4.validar_rubrica_proceso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_carrera uuid; v_modalidad uuid; v_periodo uuid;
BEGIN
 IF NEW.id_version_rubrica IS NULL THEN RETURN NEW; END IF;
 SELECT t.carrera_id,t.modalidad_id,t.periodo_academico_id
 INTO v_carrera,v_modalidad,v_periodo
 FROM s2.asignacion_tema a JOIN gen.tema t ON t.id=a.tema_id
 WHERE a.id=NEW.asignacion_tema_id;
 IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM s4.versiones_rubrica vr
    JOIN s4.rubricas r ON r.id=vr.id_rubrica
    JOIN s4.vigencias_rubrica_carrera vig ON vig.id_version_rubrica=vr.id
    WHERE vr.id=NEW.id_version_rubrica AND r.id_modalidad=v_modalidad
      AND vr.periodo_academico_id=v_periodo AND vig.id_carrera=v_carrera
      AND vig.vigente_desde<=now()
      AND (vig.vigente_hasta IS NULL OR vig.vigente_hasta>now())
      AND vr.estado='ACTIVA'
 ) THEN RAISE EXCEPTION 'Rúbrica no vigente para modalidad, carrera y período del tema';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_rubrica_proceso
 BEFORE INSERT OR UPDATE OF id_version_rubrica,asignacion_tema_id
 ON s4.procesos_evaluacion FOR EACH ROW EXECUTE FUNCTION s4.validar_rubrica_proceso();

-- 3. Tabla intermedia existente: participante pertenece a S2 y no se duplica.
CREATE FUNCTION s4.validar_participante_programacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sesion s4.programaciones_sustentacion%ROWTYPE; v_asignacion uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('genares-s4-participantes-dev')::bigint);
 SELECT * INTO v_sesion FROM s4.programaciones_sustentacion
 WHERE id=NEW.programacion_sustentacion_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sesión de sustentación inexistente'; END IF;
 SELECT asignacion_tema_id INTO v_asignacion FROM s4.procesos_evaluacion
 WHERE id=v_sesion.id_proceso_evaluacion;
 IF NOT s4.estudiante_pertenece_asignacion(v_asignacion,NEW.id_estudiante) THEN
   RAISE EXCEPTION 'El estudiante no pertenece a la asignación académica de la sesión';
 END IF;
 IF v_sesion.estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA') AND EXISTS (
    SELECT 1 FROM s4.programacion_estudiante pe
    JOIN s4.programaciones_sustentacion sp ON sp.id=pe.programacion_sustentacion_id
    WHERE pe.id_estudiante=NEW.id_estudiante
      AND sp.id_proceso_evaluacion=v_sesion.id_proceso_evaluacion
      AND pe.programacion_estudiante_id IS DISTINCT FROM NEW.programacion_estudiante_id
      AND sp.estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA')
 ) THEN RAISE EXCEPTION 'El estudiante ya tiene otra sesión vigente para este proceso';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_participante_programacion
 BEFORE INSERT OR UPDATE ON s4.programacion_estudiante
 FOR EACH ROW EXECUTE FUNCTION s4.validar_participante_programacion();

-- 4. Programación: escritas cerradas y sin choque de integrantes de tribunales.
-- Las horas son PREVISTAS; no registrar tiempo real ni exigir la duración completa.
CREATE FUNCTION s4.validar_programacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_asignacion uuid;v_version uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('genares-s4-horarios-dev')::bigint);
 SELECT asignacion_tema_id,id_version_rubrica INTO v_asignacion,v_version
 FROM s4.procesos_evaluacion WHERE id=NEW.id_proceso_evaluacion;
 IF NOT FOUND THEN RAISE EXCEPTION 'La sesión no tiene proceso S4 válido'; END IF;
 IF v_version IS NULL THEN RAISE EXCEPTION 'Falta rúbrica del proceso'; END IF;
 IF NEW.estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA') THEN
   IF EXISTS (
       SELECT 1 FROM s4.etapas_rubrica er
       JOIN s3.asignacion_tribunal at ON at.asignacion_tema_id=v_asignacion
       WHERE er.id_version_rubrica=v_version AND er.kind='ESCRITA'
         AND NOT EXISTS(SELECT 1 FROM s4.evaluaciones ev
           WHERE ev.id_proceso_evaluacion=NEW.id_proceso_evaluacion
             AND ev.id_etapa_rubrica=er.id
             AND ev.id_asignacion_tribunal=at.asignacion_tribunal_id
             AND ev.id_estudiante IS NULL AND ev.estado='CERRADA')
   ) THEN
     RAISE EXCEPTION 'Faltan evaluaciones escritas cerradas para programar';
   END IF;
   IF EXISTS (
     SELECT 1 FROM s4.programaciones_sustentacion otra
     JOIN s4.procesos_evaluacion p2 ON p2.id=otra.id_proceso_evaluacion
     JOIN s3.asignacion_tribunal asig2 ON asig2.asignacion_tema_id=p2.asignacion_tema_id
     JOIN s3.miembros_tribunal miembro2 ON miembro2.miembro_tribunal_id=asig2.miembro_tribunal_id
     JOIN s3.docente_carrera_periodo dcp2 ON dcp2.docente_carrera_periodo_id=miembro2.docente_carrera_periodo_id
     JOIN s3.docente_carrera_periodo dcp1 ON dcp1.docente_id=dcp2.docente_id
     JOIN s3.miembros_tribunal miembro1 ON miembro1.docente_carrera_periodo_id=dcp1.docente_carrera_periodo_id
     JOIN s3.asignacion_tribunal asig1 ON asig1.miembro_tribunal_id=miembro1.miembro_tribunal_id
     WHERE asig1.asignacion_tema_id=v_asignacion
       AND otra.id<>NEW.id
       AND otra.estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA')
       AND tsrange(otra.fecha_programada + otra.hora_programada,
                   otra.fecha_programada + otra.hora_fin_programada,'[)')
           && tsrange(NEW.fecha_programada + NEW.hora_programada,
                      NEW.fecha_programada + NEW.hora_fin_programada,'[)')
   ) THEN RAISE EXCEPTION 'Un evaluador tiene otra sustentación en ese horario'; END IF;
   IF EXISTS (
     SELECT 1 FROM s4.programacion_estudiante pe
     JOIN s4.programaciones_sustentacion otra ON otra.id=pe.programacion_sustentacion_id
     WHERE otra.id<>NEW.id
       AND otra.id_proceso_evaluacion=NEW.id_proceso_evaluacion
       AND otra.estado NOT IN ('CANCELADA','FINALIZADA','COMPLETADA')
       AND pe.id_estudiante IN (SELECT id_estudiante FROM s4.programacion_estudiante
                                WHERE programacion_sustentacion_id=NEW.id)
   ) THEN RAISE EXCEPTION 'Un estudiante tendría dos sesiones vigentes'; END IF;
 END IF;
 IF NEW.hora_fin_programada<=NEW.hora_programada THEN
   RAISE EXCEPTION 'La hora final prevista debe ser posterior a la inicial';
 END IF;
 NEW.duracion_estimada_minutos := (EXTRACT(EPOCH FROM
    (NEW.hora_fin_programada-NEW.hora_programada))/60)::smallint;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_programacion
 BEFORE INSERT OR UPDATE OF id_proceso_evaluacion,fecha_programada,
   hora_programada,hora_fin_programada,estado
 ON s4.programaciones_sustentacion FOR EACH ROW
 EXECUTE FUNCTION s4.validar_programacion();

-- 5. Historial sencillo, sin motivo obligatorio.
CREATE FUNCTION s4.auditar_reprogramacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.fecha_programada,OLD.hora_programada,OLD.hora_fin_programada,OLD.sala,OLD.estado)
  IS DISTINCT FROM
    (NEW.fecha_programada,NEW.hora_programada,NEW.hora_fin_programada,NEW.sala,NEW.estado) THEN
   INSERT INTO s4.eventos_trazabilidad_trabajo
    (id_proceso_evaluacion,ocurrido_en,tipo_evento,entidad_tipo,entidad_id,
     actor_id,actor_tipo,origen,detalles,evidencia,fuente_tipo,fuente_id)
   VALUES (NEW.id_proceso_evaluacion,clock_timestamp(),'SUSTENTACION_REPROGRAMADA',
    'programacion',NEW.id,
    COALESCE(NULLIF(current_setting('genares.actor_id',true),''),NEW.scheduled_by_actor_id),
    'USUARIO','CRONOGRAMA',
    jsonb_build_object('fecha_anterior',OLD.fecha_programada,'fecha_nueva',NEW.fecha_programada,
    'inicio_anterior',OLD.hora_programada,'inicio_nuevo',NEW.hora_programada,
    'fin_anterior',OLD.hora_fin_programada,'fin_nuevo',NEW.hora_fin_programada,
    'sala_anterior',OLD.sala,'sala_nueva',NEW.sala,
    'estado_anterior',OLD.estado,'estado_nuevo',NEW.estado),
    'DIRECTA','programacion_cambio',gen_random_uuid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER auditar_reprogramacion
 AFTER UPDATE OF fecha_programada,hora_programada,hora_fin_programada,sala,estado
 ON s4.programaciones_sustentacion FOR EACH ROW
 EXECUTE FUNCTION s4.auditar_reprogramacion();

CREATE FUNCTION s4.auditar_participante_programacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_proceso uuid;v_actor text;v_sesion uuid;v_estudiante uuid;
BEGIN
 v_sesion:=CASE WHEN TG_OP='DELETE' THEN OLD.programacion_sustentacion_id
                 ELSE NEW.programacion_sustentacion_id END;
 v_estudiante:=CASE WHEN TG_OP='DELETE' THEN OLD.id_estudiante ELSE NEW.id_estudiante END;
 SELECT id_proceso_evaluacion,scheduled_by_actor_id INTO v_proceso,v_actor
 FROM s4.programaciones_sustentacion WHERE id=v_sesion;
 INSERT INTO s4.eventos_trazabilidad_trabajo
   (id_proceso_evaluacion,ocurrido_en,tipo_evento,entidad_tipo,entidad_id,
    actor_id,actor_tipo,origen,detalles,evidencia,fuente_tipo,fuente_id)
 VALUES (v_proceso,clock_timestamp(),
    CASE WHEN TG_OP='DELETE' THEN 'PARTICIPANTE_RETIRADO' ELSE 'PARTICIPANTE_AGREGADO' END,
    'programacion',v_sesion,
    COALESCE(NULLIF(current_setting('genares.actor_id',true),''),v_actor),
    'USUARIO','CRONOGRAMA',jsonb_build_object('id_estudiante',v_estudiante),
    'DIRECTA','participante_programacion',gen_random_uuid());
 RETURN NULL;
END $$;
CREATE TRIGGER auditar_participante_programacion
 AFTER INSERT OR DELETE ON s4.programacion_estudiante FOR EACH ROW
 EXECUTE FUNCTION s4.auditar_participante_programacion();

-- 6. Alta idempotente de S4 al consultar una asignación VIGENTE con tribunal S3.
-- No confundir "existe al menos un integrante" con aprobación completa institucional.
-- Solo si existe UNA rúbrica activa/vigente compatible se asigna automáticamente;
-- si ninguna o varias, queda pendiente de selección manual autorizada.
CREATE FUNCTION s4.incorporar_asignacion_desde_s3(p_asignacion_tema_id uuid)
 RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;v_rubrica uuid;v_num integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM s2.asignacion_tema
    WHERE id=p_asignacion_tema_id AND estado='VIGENTE') THEN
    RAISE EXCEPTION 'Asignación académica inexistente o no vigente en S2';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM s3.asignacion_tribunal
    WHERE asignacion_tema_id=p_asignacion_tema_id) THEN
    RAISE EXCEPTION 'Todavía no existe tribunal asignado para este tema';
 END IF;
 SELECT count(DISTINCT vr.id),min(vr.id::text)::uuid INTO v_num,v_rubrica
 FROM s2.asignacion_tema a
 JOIN gen.tema t ON t.id=a.tema_id
 JOIN s4.rubricas r ON r.id_modalidad=t.modalidad_id
 JOIN s4.versiones_rubrica vr ON vr.id_rubrica=r.id
 JOIN s4.vigencias_rubrica_carrera vig ON vig.id_version_rubrica=vr.id
   AND vig.id_carrera=t.carrera_id
 WHERE a.id=p_asignacion_tema_id AND vr.periodo_academico_id=t.periodo_academico_id
   AND vr.estado='ACTIVA' AND vig.vigente_desde<=now()
   AND (vig.vigente_hasta IS NULL OR vig.vigente_hasta>now());
 IF v_num<>1 THEN v_rubrica:=NULL; END IF;
 INSERT INTO s4.procesos_evaluacion(asignacion_tema_id,id_version_rubrica,estado)
 VALUES(p_asignacion_tema_id,v_rubrica,'REGISTRADO')
 ON CONFLICT(asignacion_tema_id) DO NOTHING;
 SELECT id INTO v_id FROM s4.procesos_evaluacion
  WHERE asignacion_tema_id=p_asignacion_tema_id;
 RETURN v_id;
END $$;
