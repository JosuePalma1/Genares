# Verificación del modelo actual

## Alcance y método

Se comparó estáticamente el SQL de las migraciones fuente con las entidades TypeORM. Las fuentes son las migraciones `1760000000000` a `1760000009000`, las entidades del backend y la configuración de TypeORM. La configuración mantiene `synchronize: false`.

Se identificaron 10 migraciones, 29 nombres de tabla distintos en SQL y 29 nombres de tabla en entidades TypeORM. Los conjuntos de nombres coinciden. También se compararon las columnas declaradas y se revisaron las claves foráneas, índices, checks y triggers expresados en SQL.

## Estado de PostgreSQL 9D

La configuración local apunta a `127.0.0.1:55441`, base `genares_9d_disposable`, marcada como desechable. No había proceso escuchando en el puerto 55441. No se inició el servidor, no se ejecutó SQL y no se consultó el marcador `GENARES:9D:DISPOSABLE` ni el catálogo real. Por eso las cifras de esta auditoría son del repositorio, no una verificación de la base viva. No se accedió al puerto 5432 ni a la base persistente 8E.

## Matriz de discrepancias

| Aspecto | Migraciones SQL | Entidades TypeORM | PostgreSQL 9D | Observación |
|---|---|---|---|---|
| Tablas | 29 tablas distintas | 29 nombres de tabla | No consultado | Los conjuntos coinciden estáticamente. |
| Columnas heredadas sin propiedad ORM | `versiones_rubrica.written_calificacion_maxima`, `oral_calificacion_maxima`; `categorias_rubrica.etapa` | No mapeadas como columnas físicas | No consultado | Las dos primeras son campos legacy conservados; `categorias_rubrica.etapa` es una columna enum nullable antigua. La propiedad ORM `etapa` representa la relación dinámica mediante `id_etapa_rubrica`, no la columna legacy. |
| Contexto compuesto de versión | FK autorreferente `(id_version_base,id_rubrica)`; en auditoría `(version_id,rubrica_id)` y `(version_anterior_id,rubrica_id)` | UUID escalar para `idVersionBase`; auditoría puede no expresar toda la regla compuesta | No consultado | SQL garantiza versión base y versiones auditadas de la misma familia. |
| Asociación versión/carrera | FKs compuestas de versión/contexto y rubrica/modalidad | `VersionRubricaCarrera` almacena UUID escalares; no declara relaciones TypeORM equivalentes | No consultado | No inferir ausencia de integridad física por falta de decorador. |
| Vigencia | FK compuesta a asociación de versión/carrera; índice único parcial para una vigencia abierta por carrera/modalidad/período | Propiedades escalares sin las restricciones completas | No consultado | El historial es append-only; cierre controlado por trigger. |
| Traspaso compartido | FK compuesta `(id_evaluacion,id_trabajo)` y FK a estudiante; trigger comprueba contexto y pertenencia | Tres relaciones ManyToOne simples; no expresan por sí solas la FK compuesta | No consultado | La integridad efectiva depende de SQL y del trigger, no solo de TypeORM. |
| Evaluaciones y notas | Índices únicos parciales por modalidad de evaluación; triggers de contexto, cierre e inmutabilidad | Entidades y validación de servicio | No consultado | El SQL implementa garantías que no están completamente descritas por decoradores. |
| Estructura de rúbrica | Triggers para suma exacta por etapa, inmutabilidad de versiones y protecciones de estructura | Entidades reflejan columnas y relaciones principales | No consultado | Restricciones de dominio importantes son de base. |
| Asignación tribunal | Índice parcial que mantiene la asignación actual por trabajo; trigger de cierre exige dos miembros | Entidades reflejan asignación y miembros | No consultado | Se conserva el requisito histórico de dos evaluadores. |
| Programación legacy | `programaciones_sustentacion`, una fila por trabajo por índice único, fecha, hora sin zona, sala textual y estado | Entidad correspondiente | No consultado | No es un cronograma versionado, ni hay catálogo de salas/duración/zonas. |

## Restricciones SQL relevantes

- Códigos de modalidades y carreras normalizados mediante índices únicos sobre `lower(btrim(codigo))`.
- Índices únicos parciales para versiones activas, asignaciones actuales y vigencias abiertas.
- Claves foráneas compuestas para conservar coherencia entre versión, rúbrica, modalidad, período, carrera y trabajo.
- Triggers de activación y estructura de rúbricas; validación de los 10.00 puntos por etapa; protecciones de versión configurada.
- Triggers de contexto de evaluación, cierre, conteo de dos evaluadores, protección de notas cerradas y transferencia a integrantes válidos.
- Triggers de append-only para auditorías, transferencias e historial de vigencias.
- La integridad reportada no debe atribuirse toda a las entidades TypeORM: varias reglas solo se expresan en las migraciones SQL.

## Hallazgos concretos para revisión

1. Las columnas `written_calificacion_maxima` y `oral_calificacion_maxima` siguen físicamente en `versiones_rubrica`; no equivalen al modelo dinámico actual y no deben reinterpretarse.
2. `categorias_rubrica.etapa` es una columna física legacy que coexiste con la FK dinámica `id_etapa_rubrica`.
3. `VersionRubricaCarrera` y `VigenciaRubricaCarrera` no expresan en decoradores todas las relaciones compuestas del SQL.
4. `TraspasoEvaluacionEstudiante` expresa relaciones simples en ORM, mientras que PostgreSQL exige además que evaluación y trabajo formen la pareja válida.
5. La programación actual no soporta historial de propuestas y reemplazos. La propuesta futura se separa en el modelo B y no se implementa aquí.

## Correcciones frente a los DER de 10.6A

- El modelo físico 10.6A llamaba al máximo capturado por indicador `maxima_instantanea`; la columna SQL es `calificaciones_evaluacion.instantanea_calificacion_maxima`.
- El modelo anterior omitía la columna nullable legacy `categorias_rubrica.etapa`, además de los dos máximos legacy nullable de `versiones_rubrica`. El DER actual los muestra con el tipo y nulabilidad del SQL, sin tratarlos como etapas dinámicas.
- La relación de evaluación a estudiante y la etapa dinámica son opcionales en evaluaciones históricas/legacy (`id_estudiante` e `id_etapa_rubrica` aceptan NULL). El DER actual refleja la opcionalidad y la FK compuesta etapa-versión.
- La versión base es nullable. La cardinalidad autorreferente ahora permite una versión sin base y varias versiones derivadas.
- `trabajos_titulacion.id_version_rubrica` es nullable; el DER actual no exige que cada trabajo tenga versión fijada.
- El traspaso usa una FK compuesta `(id_evaluacion,id_trabajo)` hacia la evaluación, no una FK independiente de `id_trabajo` a trabajo. El diagrama actual no dibuja una relación física separada que no existe.
- `auditoria_rubricas` mantiene relaciones distintas para `version_id`, la FK compuesta de `version_id` con `rubrica_id` y la FK compuesta de `version_anterior_id` con `rubrica_id`; se separan y nombran en el modelo actual.

## Limitación

El DER actual se generó desde el SQL del repositorio. No es evidencia de que todas las migraciones estén aplicadas ni de que el catálogo local coincida con ellas. Para confirmar eso habrá que arrancar y verificar explícitamente el entorno desechable 9D en una etapa autorizada.
