# Diccionario corregido del esquema Genares

Este diccionario describe nombres encontrados en las migraciones del repositorio. No implica que 9D esté aplicada actualmente. Para columnas y tipos completos, consultar [DER actual](02-der-actual.mmd).

## Catálogos, identidad y permisos

| Tabla | Columnas/relaciones representativas | Observaciones |
|---|---|---|
| `personas` | `id`, `identificacion_nacional`, `nombres`, `surnames`, `creado_en`, `actualizado_en` | El nombre físico es `surnames`; no traducirlo a `apellidos` en una consulta SQL. |
| `cuentas_usuario` | `id`, `id_persona`, `sujeto_autenticacion`, `esta_activo` | La cuenta se asocia a una persona. |
| `roles`, `roles_cuenta` | `codigo`, `nombre`; `id_cuenta`, `id_rol`, `asignada_en` | Asignación de roles. |
| `alcances_carrera_cuenta` | `id_cuenta`, `id_carrera` | Limita alcance administrativo por carrera. |
| `perfiles_estudiante` | `id_persona`, `id_carrera` | Perfil y carrera local. |
| `perfiles_docente` | `id_persona`, `id_carrera`, `fuente`, `referencia_externa`, `esta_activo` | `referencia_externa` es nullable. |
| `carreras` | `codigo`, `nombre`, `esta_activo`, `revision`, marcas de tiempo | El código tiene unicidad normalizada en SQL. |
| `modalidades` | `codigo`, `nombre`, `esta_activo`, `descripcion`, `revision`, marcas de tiempo | Código normalizado único; trigger protege modalidades asociadas a versiones. |
| `periodos_academicos` | `codigo`, `fecha_inicio`, `fecha_fin`, `esta_activo` | Fechas pueden ser nulas. |

## Trabajo y tribunal

| Tabla | Columnas/relaciones representativas | Observaciones |
|---|---|---|
| `trabajos_titulacion` | `codigo`, `titulo`, `id_modalidad`, `periodo_academico_id`, `id_carrera`, `id_version_rubrica`, `estado`, `created_by_id_cuenta` | La versión de rúbrica es nullable en el esquema base. |
| `estudiantes_trabajo` | `id_trabajo`, `id_estudiante`, `orden_autoria` | Relaciona integrantes; las validaciones adicionales son SQL/servicio. |
| `asignaciones_tutor_trabajo` | `id_trabajo`, `id_docente`, `assigned_by_id_cuenta`, `asignada_en`, `finalizada_en` | Índice parcial conserva asignación activa. |
| `asignaciones_tribunal` | `id_trabajo`, `estado`, `assigned_by_id_cuenta`, `creado_en`, `confirmada_en` | Índice parcial para asignación vigente; trigger exige dos miembros al confirmar. |
| `miembros_tribunal` | `id_asignacion`, `id_docente`, `position` | La posición identifica los dos lectores según el modelo vigente. |
| `programaciones_sustentacion` | `id_trabajo`, `fecha_programada date`, `hora_programada time without time zone`, `sala varchar(160)`, `estado`, `scheduled_by_id_cuenta` | Una fila por trabajo. No hay hora de fin, zona horaria, sala normalizada ni versiones. |

## Rúbricas y vigencia

| Tabla | Columnas físicas relevantes | Observaciones |
|---|---|---|
| `rubricas` | `id_modalidad`, `nombre`, `descripcion` | Una familia asociada a una modalidad. |
| `versiones_rubrica` | `id_rubrica`, `periodo_academico_id`, `version`, `estado`, `activada_en`, `revision`, `id_version_base` | `written_calificacion_maxima` y `oral_calificacion_maxima` permanecen como columnas legacy nullable y no son campos dinámicos. FK compuesta asegura versión base de la misma familia. |
| `etapas_rubrica` | `id_version_rubrica`, `kind`, `scope`, `codigo`, `nombre`, `descripcion`, `calificacion_maxima`, `porcentaje`, `orden` | `scope` explicita ámbito compartido/individual; no se infiere del nombre. Trigger valida suma exacta por etapa. |
| `categorias_rubrica` | `id_version_rubrica`, `codigo`, `nombre`, `calificacion_maxima`, `orden`, `id_etapa_rubrica` | `id_etapa_rubrica` es la relación dinámica. La columna física nullable `etapa` es legacy y no está mapeada como tal en TypeORM. |
| `indicadores_rubrica` | `id_categoria`, `label`, `descripcion`, `calificacion_maxima`, `orden` | `calificacion_maxima` no debe confundirse con calificación obtenida. |
| `versiones_rubrica_carreras` | `id_version_rubrica`, `id_carrera`, `id_rubrica`, `id_modalidad`, `periodo_academico_id`, `asociado_en` | PK compuesta versión/carrera; FKs compuestas conservan el contexto. |
| `vigencias_rubrica_carrera` | `id_version_rubrica`, `id_carrera`, `id_rubrica`, `id_modalidad`, `periodo_academico_id`, `vigente_desde`, `vigente_hasta` | `vigente_hasta IS NULL` señala la vigencia abierta; índice único parcial permite solo una por carrera/modalidad/período. La asociación contextual es una FK compuesta. |
| `auditoria_rubricas` | `actor_id`, `accion`, `rubrica_id`, `version_id`, `version_anterior_id`, `ocurrido_en`, `correlation_id`, contexto opcional | Append-only por triggers. SQL conserva FKs compuestas `(version_id,rubrica_id)` y `(version_anterior_id,rubrica_id)` para mantener la misma familia; ambas versiones son opcionales. |

## Evaluaciones y trazabilidad

| Tabla | Columnas físicas relevantes | Observaciones |
|---|---|---|
| `evaluaciones` | `id_trabajo`, `id_miembro_tribunal`, `id_estudiante` nullable, `id_version_rubrica`, `etapa`, `estado`, `instantanea_rubrica`, `calificacion_total numeric(4,2)`, `instantanea_calificacion_maxima numeric(4,2)`, `cerrada_en`, `id_etapa_rubrica` nullable, `revision` | La combinación de FKs compuestas e índices únicos parciales y triggers valida contexto, ámbito y cierre. |
| `calificaciones_evaluacion` | `id_evaluacion`, `id_indicador`, `score numeric(4,2)`, `instantanea_calificacion_maxima numeric(4,2)`, `observation text` nullable | Nombres SQL exactos. La columna es `instantanea_calificacion_maxima`, no `maxima_instantanea`. |
| `traspasos_evaluacion_estudiante` | `id_evaluacion`, `id_trabajo`, `id_estudiante`, `traspasado_en` | La FK compuesta `(id_evaluacion,id_trabajo)` asegura pertenencia al mismo trabajo; no se duplica la evaluación original. |
| `eventos_auditoria_evaluacion` | `id_evaluacion`, `actor_id`, `accion`, `detalles`, `correlation_id`, `ocurrido_en` | Historial append-only. |
| `notificaciones` | `recipient_id_cuenta`, `id_trabajo`, `type`, `titulo`, `mensaje`, `ruta_accion`, `creado_en`, `leida_en` | Registro local de notificaciones. |

## Nombres físicos sensibles a errores de lectura

- Carrera del trabajo: `id_carrera`; período: `periodo_academico_id`.
- Vigencia por carrera: `vigente_desde` y `vigente_hasta`.
- Puntaje por indicador: `score`; máximo capturado: `instantanea_calificacion_maxima`; observación: `observation`.
- Etapa dinámica: `etapas_rubrica.scope`; categoría usa `id_etapa_rubrica`. La vieja `categorias_rubrica.etapa` sigue existiendo y es nullable.
- El campo `written_calificacion_maxima` no representa el total de una etapa dinámica.

## Integridad no visible solo desde los decoradores

Las claves compuestas, los índices únicos parciales y normalizados, la suma de 10.00 por etapa, el máximo de dos lectores, los checks contextuales y las protecciones append-only/inmutables se definen total o parcialmente en SQL. Para operar o migrar se debe consultar también la migración correspondiente; inspeccionar solo las entidades no reproduce toda la integridad real.
