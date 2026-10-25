# 10.6A — Diccionario de datos actual

Inventario lógico derivado de entidades y migraciones del repositorio. Los nombres entre backticks son columnas SQL principales; `?` significa nullable. Las definiciones exactas de tipos PostgreSQL y columnas completas están en las migraciones enumeradas en el inventario. Las claves y restricciones indicadas por SQL deben confirmarse contra una instancia desplegada, ya que 9D no estaba ejecutándose durante esta auditoría.

| Tabla | Propósito y campos principales | Claves y reglas destacadas |
|---|---|---|
| `carreras` | `id`, `codigo`, `nombre`, `esta_activo`, `revision`, `creado_en`, `actualizado_en`. | PK UUID; código único literal y normalizado; texto no vacío; código estable y revisión incrementada por trigger. |
| `modalidades` | `id`, `codigo`, `nombre`, `esta_activo`, `descripcion?`, `revision`, `creado_en`, `actualizado_en`. | PK; código literal/normalizado único; no vacíos; código inmutable después del alta. |
| `periodos_academicos` | `id`, `codigo`, `fecha_inicio?`, `fecha_fin?`, `esta_activo`. | PK; código único; inicio no posterior al fin. |
| `personas` | `id`, `identificacion_nacional`, `nombres`, `surnames`, `creado_en`, `actualizado_en`. | PK; identificación única; textos requeridos no vacíos. |
| `perfiles_estudiante` | `id`, `id_persona`, `id_carrera`. | PK; `id_persona` único (1:1), carrera FK restrict. |
| `perfiles_docente` | `id`, `id_persona`, `id_carrera`, `fuente`, `referencia_externa?`, `esta_activo`. | PK; persona única; carrera FK restrict; `fuente` es enum. |
| `cuentas_usuario` | `id`, `id_persona`, `sujeto_autenticacion?`, `esta_activo`, `creado_en`, `actualizado_en`. | PK; persona única; sujeto externo único cuando no es NULL; FK restrict. |
| `roles` | `id`, `codigo`, `nombre`. | PK; código único. |
| `roles_cuenta` | `id`, `id_cuenta`, `id_rol`, `asignada_en`. | PK; cuenta FK cascade, rol FK restrict; pareja única. |
| `alcances_carrera_cuenta` | `id`, `id_cuenta`, `id_carrera`. | PK; cuenta/carrera FKs cascade; pareja única. |
| `rubricas` | `id`, `id_modalidad`, `nombre`, `descripcion?`, `creado_en`. | PK; modalidad única FK restrict (1:1). |
| `versiones_rubrica` | `id`, `id_rubrica`, `periodo_academico_id`, `version`, `estado`, `written_calificacion_maxima`, `oral_calificacion_maxima`, `activada_en?`, `creado_en`, `revision`, `id_version_base?`. | PK; familia/periodo/base FKs restrict; familia+versión únicos; checks estado/activación; máximo una activa por modalidad/periodo vía trigger/índice. |
| `etapas_rubrica` | `id`, `id_version_rubrica`, `kind`, `scope`, `codigo`, `nombre`, `descripcion?`, `calificacion_maxima`, `porcentaje?`, `orden`. | PK; versión FK cascade; código y orden únicos por versión; ámbito enum compartido/individual; orden positivo, porcentaje 0–100; estructura protegida al cerrar configuración. |
| `categorias_rubrica` | `id`, `id_version_rubrica`, `etapa`, `codigo`, `nombre`, `calificacion_maxima`, `orden`, `id_etapa_rubrica`. | PK; FKs cascade; código y orden únicos por etapa; trigger valida que etapa y versión coincidan. `etapa` conserva la clasificación histórica. |
| `indicadores_rubrica` | `id`, `id_categoria`, `label`, `descripcion`, `calificacion_maxima`, `orden`. | PK; categoría FK cascade; orden único por categoría; máximo/orden positivos. |
| `trabajos_titulacion` | `id`, `codigo`, `titulo`, `id_modalidad`, `periodo_academico_id`, `id_carrera`, `id_version_rubrica?`, `estado`, `created_by_id_cuenta`, `creado_en`, `actualizado_en`. | PK; código único; FKs restrict; trigger valida que versión corresponda a modalidad/periodo y fija la versión. |
| `estudiantes_trabajo` | `id`, `id_trabajo`, `id_estudiante`, `orden_autoria`, `creado_en`. | PK; trabajo cascade, perfil estudiante restrict; estudiante y orden únicos por trabajo; orden positivo. |
| `asignaciones_tutor_trabajo` | `id`, `id_trabajo`, `id_docente`, `assigned_by_id_cuenta`, `asignada_en`, `finalizada_en?`. | PK; FKs restrict; fin posterior a asignación; una asignación vigente por trabajo. |
| `asignaciones_tribunal` | `id`, `id_trabajo`, `estado`, `assigned_by_id_cuenta`, `creado_en`, `confirmada_en?`. | PK; trabajo y cuenta asignadora restrict; marcas de creación/confirmación coherentes; una asignación vigente por trabajo; confirmación exige dos miembros. |
| `miembros_tribunal` | `id`, `id_asignacion`, `id_docente`, `position`. | PK; tribunal cascade, perfil docente restrict; docente/posición únicos; posición 1 o 2. |
| `programaciones_sustentacion` | `id`, `id_trabajo`, `fecha_programada`, `hora_programada`, `sala`, `estado`, `scheduled_by_id_cuenta`, `creado_en`, `actualizado_en`. | PK; trabajo único FK restrict; sala no vacía; enum programada/completada/cancelada. Hora sin zona; no modela duración, recurso normalizado o historial. |
| `evaluaciones` | `id`, `id_trabajo`, `id_miembro_tribunal`, `id_estudiante?`, `id_version_rubrica`, `etapa`, `estado`, `instantanea_rubrica`, `calificacion_total`, `instantanea_calificacion_maxima`, `cerrada_en?`, `creado_en`, `actualizado_en`, `id_etapa_rubrica?`, `revision`. | PK; FKs restrict y FK compuesta etapa+versión; índices únicos condicionales para legado/dinámico compartido/individual; total dentro del máximo; snapshot consistente; cierre coherente; triggers validan ámbito y bloquean mutación cerrada. |
| `calificaciones_evaluacion` | `id`, `id_evaluacion`, `id_indicador`, `score`, `instantanea_calificacion_maxima`, `observation?`. | PK; evaluación cascade, indicador restrict; evaluación+indicador únicos; puntaje no negativo, no supera máximo positivo; trigger valida rúbrica/etapa e inmutabilidad al cerrar. |
| `traspasos_evaluacion_estudiante` | `id`, `id_evaluacion`, `id_trabajo`, `id_estudiante`, `traspasado_en`. | PK; evaluación/trabajo mediante FK compuesta, estudiante restrict; evaluación+estudiante únicos; trigger exige etapa compartida, cerrada y pertenencia al trabajo; inmutable/append-only. |
| `eventos_auditoria_evaluacion` | `id`, `id_evaluacion`, `actor_id`, `accion`, `detalles`, `correlation_id?`, `ocurrido_en`. | PK; evaluación restrict; detalles deben ser objeto JSON; índice evaluación/fecha; append-only. |
| `notificaciones` | `id`, `recipient_id_cuenta`, `id_trabajo`, `type`, `titulo`, `mensaje`, `ruta_accion`, `creado_en`, `leida_en?`. | PK; cuenta/trabajo cascade; tipo enum. |
| `auditoria_rubricas` | `id`, `actor_id`, `accion`, `rubrica_id?`, `modalidad_id?`, `carrera_id?`, `periodo_academico_id?`, `version_id?`, `version_anterior_id?`, `ocurrido_en`, `correlation_id?`. | PK; FKs restrict; check de combinaciones de objetivos; índices por objetivo/fecha; prohibidos update/delete/truncate. |
| `versiones_rubrica_carreras` | `id_version_rubrica`, `id_carrera`, `id_rubrica`, `id_modalidad`, `periodo_academico_id`, `asociado_en`. | PK compuesta versión+carrera; FKs compuestas que garantizan contexto; contexto completo único; índices por carrera y familia. Entidad TypeORM conserva IDs escalares. |
| `vigencias_rubrica_carrera` | `id`, `id_version_rubrica`, `id_carrera`, `id_rubrica`, `id_modalidad`, `periodo_academico_id`, `vigente_desde`, `vigente_hasta?`. | PK; FK compuesta a asociación/contexto; fin posterior al inicio; solo una vigencia abierta por carrera/modalidad/periodo; historial append-only salvo cierre controlado del intervalo. |

## Enumeraciones observadas

Los nombres exactos son los utilizados por el código/migraciones. Entre ellos: `EstadoTrabajo` (`REGISTRADO`, `TRIBUNAL_ASIGNADO`, `REVISION_ESCRITA_PENDIENTE`, `REVISION_ESCRITA_COMPLETADA`, `SUSTENTACION_PROGRAMADA`, `SUSTENTACION_PENDIENTE`, `EVALUACION_COMPLETADA`, `FINALIZADO`); tribunal (`BORRADOR`, `CONFIRMADO`, `REEMPLAZADO`); versión (`BORRADOR`, `CONFIGURADA`, `ACTIVA`, `ARCHIVADA`); etapa (`ESCRITA`, `ORAL`, `PERSONALIZADA`, ámbito `TRABAJO_COMPARTIDO`/`ESTUDIANTE_INDIVIDUAL`); evaluación (`BORRADOR`, `CERRADA`); programación (`PROGRAMADA`, `COMPLETADA`, `CANCELADA`).

La aclaración académica sobre la revisión escrita y el resultado definitivo aún no está expresada por estos estados: `CERRADA` significa inmutable en el esquema presente.
