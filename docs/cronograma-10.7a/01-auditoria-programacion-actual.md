# 01 — Auditoría de la programación actual

## Alcance y evidencia

Revisión estática de las diez migraciones disponibles, entidades y módulos TypeORM/NestJS y consumidores React. 10.6B hizo una comparación estática de 29 tablas/29 entidades, pero PostgreSQL 9D estaba apagado. Esta etapa no se conectó a ninguna base y no afirma que los datos desplegados coincidan con los archivos del repositorio.

## Tabla y relaciones

La migración inicial `backend/src/base-datos/migraciones/1760000000000-esquema-inicial.ts` crea:

| Columna | Tipo SQL | Nulabilidad/valor inicial | Uso observado |
|---|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` | Identidad de la fila. |
| `id_trabajo` | `uuid` | NOT NULL, único | Trabajo al que corresponde la programación. |
| `fecha_programada` | `date` | NOT NULL | Fecha local sin zona horaria. |
| `hora_programada` | `time without time zone` | NOT NULL | Hora local sin zona horaria. |
| `sala` | `varchar(160)` | NOT NULL | Nombre textual, no catálogo de recursos. |
| `estado` | `estado_sustentacion_enum` | NOT NULL, default `PROGRAMADA` | Estado de programación. |
| `scheduled_by_id_cuenta` | `uuid` | NOT NULL | Cuenta que registró la fila. |
| `creado_en` | `timestamptz` | NOT NULL, `now()` | Alta. |
| `actualizado_en` | `timestamptz` | NOT NULL, `now()` | Última actualización, no historial de cambios. |

Relaciones y restricciones declaradas:

- PK UUID en `id`.
- `UNIQUE(id_trabajo)`: máximo una fila por trabajo.
- `CHECK (btrim(sala) <> '')`.
- FK `id_trabajo → trabajos_titulacion.id ON DELETE RESTRICT`.
- FK `scheduled_by_id_cuenta → cuentas_usuario.id ON DELETE RESTRICT`.
- TypeORM usa `OneToOne` obligatorio hacia `TrabajoTitulacion` y `ManyToOne` obligatorio hacia `CuentaUsuario`; concuerda con la unicidad física.
- Enum exacto: `PROGRAMADA`, `COMPLETADA`, `CANCELADA`.

No se encontraron restricciones para fecha futura, inicio/fin, duración, zona horaria, disponibilidad de sala, docente, tribunal o estudiante. Tampoco una tabla de auditoría de cambios de programación. El nombre de sala libre no permite identificar dos nombres distintos que refieran al mismo espacio.

## Servicios, módulos, rutas y pantalla

| Capa | Hallazgo del repositorio |
|---|---|
| Entidad | Existe `backend/src/sustentaciones/entidades/programacion-sustentacion.entity.ts`. El glob de entidades la detecta. |
| Módulo NestJS | No existe módulo de sustentaciones; `ModuloAplicacion` importa carreras, modalidades, rúbricas y evaluaciones, pero no un módulo de programación. |
| Servicio/controlador de programación | No existen en `backend/src`; la búsqueda no encontró servicio, controlador ni DTO de programación. |
| API | No existe ruta `/api/v1/...` para leer o escribir programaciones. El controlador de evaluaciones expone evaluación y consolidación, no programación. |
| Trabajo y tribunal | Hay entidades TypeORM para trabajos, integrantes, asignación y miembros, pero no módulos/servicios/controladores NestJS para administrarlos en este repositorio. La consulta de evaluaciones usa estas tablas directamente. |
| React | La ruta `/trabajos/:idTrabajo/sustentacion` está en `Aplicacion.jsx` y restringida a Comisión/Admin. `PaginaProgramacionSustentacion` edita fecha, hora y sala; despacha `PROGRAMAR_SUSTENTACION` al `ContextoPrototipo`. Ese reducer modifica el estado local y genera notificaciones simuladas; no llama a API. |
| Pantallas consumidoras | `PaginaDetalleTrabajo`, `PaginaEvaluacionOral`, `PaginaMisEvaluaciones`, `PaginaResultados`, `PaginaCoordinacion`, `PaginaSecretaria`, `DashboardPage` y `AvanceTrabajo` leen `trabajo.programacion` del prototipo para mostrar agenda o decidir disponibilidad oral. |

La lectura de la pantalla demuestra el comportamiento del prototipo, no una operación persistida en PostgreSQL. La presencia de la entidad y de la migración tampoco demuestra que exista un endpoint productivo.

## Dependencias SQL que sí están implementadas

La ausencia de un CRUD backend no hace que la tabla sea prescindible:

1. Un trigger `BEFORE INSERT OR UPDATE OF id_trabajo` sobre `programaciones_sustentacion` exige dos revisiones escritas cerradas de miembros del tribunal confirmado antes de programar. Es la compuerta SQL de programación.
2. Las funciones de validación de evaluaciones de las migraciones `1760000000000`, `1760000001000` y `1760000009000` consultan por `id_trabajo` una fila con estado distinto de `CANCELADA` antes de permitir una evaluación ORAL. En las evaluaciones dinámicas, el control académico sigue enlazando la etapa oral con la existencia de programación.
3. Un trigger `AFTER INSERT OR UPDATE OF fecha_programada, hora_programada, sala` registra notificaciones `SUSTENTACION_PROGRAMADA` para cuentas activas de miembros del tribunal confirmado. No notifica por cambio exclusivo de estado y no escribe un historial de agenda.
4. El prototipo enlaza la programación al trabajo para mostrar el horario en coordinación, secretaría, evaluación oral y resultados.

El estado `COMPLETADA` también satisface el chequeo `estado <> 'CANCELADA'`; por ello puede seguir habilitando el registro de resultados orales después del día de sustentación. Cambiarlo por una condición “solo futura/programada” podría bloquear cierres legítimos.

## Comportamiento actual, definido y ausente

| Comportamiento | Estado |
|---|---|
| Una fila por trabajo, con fecha, hora local, sala escrita y estado | Definido por migración y entidad. |
| Evitar programar antes de dos cierres escritos confirmados | Trigger PostgreSQL; no hay servicio NestJS. |
| Exigir programación no cancelada al iniciar evaluación ORAL | Funciones SQL; el API no administra la programación. |
| Notificar a miembros con cuenta activa al insertar/cambiar datos de agenda | Trigger SQL; el prototipo también genera aviso local. |
| UI para consultar/editar dentro del estado simulado local | Implementado en React prototipo. |
| Guardado real de programación por endpoint, consulta API o autorización backend | No implementado en este repositorio. |
| Cronograma por período/carrera, sesiones con hora de fin/zona, salas normalizadas y disponibilidad | Propuesta 10.6A/10.6B; no implementada. |
| Versiones, aprobación externa, publicación, reemplazo auditable y reprogramación parcial | Propuesta; no implementada. |
| Prevención transaccional de choque de sala/persona | No existe en la tabla actual. |

## Qué se rompería si se sustituyera la tabla

- Los triggers SQL de evaluaciones dejarían de encontrar la sustentación y rechazarían inserciones/cierres ORAL o perderían la compuerta si se eliminan sin reemplazo.
- La validación previa de dos evaluaciones escritas dejaría de ejecutarse al programar.
- El trigger de notificaciones dejaría de activarse o podría duplicar avisos si se copian filas a otro esquema sin migrar su función.
- La entidad TypeORM y la relación uno-a-uno dejarían de coincidir con el nuevo modelo.
- Los consumidores locales dependen del campo de forma `programacion.fecha`, `.hora` y `.sala`; cualquier integración futura necesita un adaptador con ese contrato de lectura.
- El enum, las filas `COMPLETADA/CANCELADA` y la fecha/hora ya registrada contienen la única representación SQL actual de esa programación. No se debe borrar ni convertir sin inventario y conciliación.

## Implicación

La recomendación es evolucionar el mismo registro físico como sesión versionada y mantener sus columnas legacy para las filas existentes. La migración futura debe primero inventariar filas y resultados orales, sustituir explícitamente los triggers, habilitar lectura compatible y cortar toda escritura legacy. El repositorio no permite conocer cuántas filas reales existen ni si una programación activa tiene evidencia del Consejo; esa verificación se pospone a una etapa autorizada con la base objetivo claramente identificada.
