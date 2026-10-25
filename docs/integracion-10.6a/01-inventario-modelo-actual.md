# 10.6A — Inventario del modelo actual

## Alcance y método

Auditoría estática del código NestJS/TypeORM, entidades, diez migraciones, consultas de consolidación, reglas del dominio y fixtures React. No se ejecutaron migraciones, pruebas PostgreSQL ni consultas a bases de datos. `backend/.env.9d.local` identifica el puerto `55441` y `genares_9d_disposable` con `DB_DISPOSABLE=true`, pero no hay servidor escuchando. No se accedió a `5432`, `55440` ni a otra base persistente.

TypeORM mantiene `synchronize: false`. Las migraciones son la fuente declarativa disponible para las restricciones SQL. El conjunto contiene 29 nombres de tablas migradas y 29 nombres de entidades, con correspondencia de nombres uno a uno. Esa comparación no acredita que la base real haya recibido todas las migraciones ni que su catálogo coincida.

## Módulos y límites de responsabilidad

| Dominio | Datos observados | Lectura de auditoría |
|---|---|---|
| Catálogos | carreras, modalidades y periodos | Catálogos institucionales locales; código estable y estado activo. |
| Identidad y autorización | personas, cuentas, roles, alcances por carrera y perfiles docente/estudiante | Una persona puede tener cuenta y perfiles; roles de cuenta y encargos académicos son conceptos separados. |
| Rúbricas | familia, versiones, etapas, categorías, indicadores, asociaciones y vigencias por carrera | La versión queda fijada al trabajo; las versiones configuradas/activas tienen protecciones SQL de inmutabilidad y validación. |
| Trabajos | trabajos, autorías, tutor y tribunal | El trabajo relaciona carrera, modalidad, periodo y versión; tribunal confirmado tiene dos miembros. |
| Sustentación | `programaciones_sustentacion` | Solo existe una programación básica por trabajo. No se encontró un módulo/API dedicado de cronograma, salas, sesiones versionadas o conflictos de recursos. |
| Evaluación | evaluaciones, calificaciones, traspasos y eventos de auditoría | Conviven filas legacy y evaluación dinámica por etapa. Las evaluaciones cerradas son inmutables. |
| Auditoría y avisos | auditoría de rúbricas, eventos de evaluación y notificaciones | Hay registros append-only en auditoría; notificaciones están ligadas a cuenta y trabajo. |

## Hallazgos de integridad y diferencias entre capas

- Las migraciones agregan índices parciales, triggers, comprobaciones cruzadas y claves foráneas compuestas que no se expresan enteramente en los decoradores TypeORM. Para explicar el comportamiento prevalece el SQL migrado, sujeto a verificación de despliegue.
- `versiones_rubrica_carreras` y `vigencias_rubrica_carrera` guardan IDs escalares en la entidad; las FK de contexto y claves compuestas existen en SQL.
- `traspasos_evaluacion_estudiante` tiene relaciones individuales en TypeORM; SQL añade la integridad compuesta evaluación/trabajo.
- Está presente en el árbol de trabajo `programacion-sustentacion.entity.ts` como archivo no rastreado previo. La migración inicial ya crea `programaciones_sustentacion`, pero no se identificó módulo de sustentaciones, controlador/servicio de cronograma ni registro mediante `forFeature`. El glob general de entidades debe confirmarse en despliegue. Esta etapa no altera ese archivo.
- Migración `1760000008000` elimina la restricción que forzaba el ámbito individual; el enum actual permite `TRABAJO_COMPARTIDO` y `ESTUDIANTE_INDIVIDUAL`. Las etapas son dinámicas. La validación SQL conserva 10.00 puntos exactos por etapa, sin inferir ámbito por nombre.
- La consolidación consulta en `REPEATABLE READ`, requiere tribunal confirmado de dos miembros, y calcula en el servidor bajo demanda. No hay tabla de resultado consolidado. No modifica estados, evaluaciones ni auditoría al consultar.
- Solo evaluaciones dinámicas cerradas alimentan un resultado. Las evaluaciones compartidas se leen con su asociación en `traspasos_evaluacion_estudiante`, una vez por estudiante/evaluador. Las individuales requieren el estudiante objetivo. El legado se informa como excluido/no consolidado y nunca se mezcla automáticamente.
- La respuesta distingue `SIN_EVALUACIONES`, `EN_PROGRESO`, `EVALUACIONES_CERRADAS_INCOMPLETAS`, `RESULTADO_COMPLETO` y `LEGACY_NO_CONSOLIDADA`; incluye etapas y evaluadores pendientes. El resultado completo calculado no equivale a resultado oficial o acta.
- `reglas-consolidacion.ts` utiliza racionales `bigint` y redondeo decimal HALF_UP para representación. No redondea promedios intermedios antes del promedio final.

## Migraciones encontradas

Diez archivos consecutivos identificados en el repositorio:

1. `1760000000000-esquema-inicial.ts`
2. `1760000001000-etapas-rubrica-dinamicas.ts`
3. `1760000002000-borradores-rubrica-auditoria.ts`
4. `1760000003000-grupos-vacios-borrador.ts`
5. `1760000004000-catalogo-modalidades.ts`
6. `1760000005000-vigencias-rubrica-carrera.ts`
7. `1760000006000-catalogo-carreras.ts`
8. `1760000007000-rubricas-completas-etapas-dinamicas.ts`
9. `1760000008000-alcances-etapa-rubrica-completos.ts`
10. `1760000009000-evaluaciones-etapas-dinamicas-traspasos.ts`

Incluyen el modelo inicial y sucesivas ampliaciones para borradores/auditoría, catálogos, vigencia por carrera, rúbricas/etapas completas, alcance de etapas y evaluaciones dinámicas con traspasos. No se debe editar ninguna migración aplicada; cualquier evolución futura requiere una nueva migración aditiva.

## Fixtures React

`prototipo-titulacion/src/datos/datosPrototipo.js` contiene arreglos locales de modalidades, periodos, personas, versiones de rúbrica, trabajos, tribunal, evaluaciones y avisos. Incluye objetos de programación y marcas de impresión/finalización simuladas. Son datos de demostración JavaScript, no tablas ni evidencia de persistencia institucional, y pueden diferir del API PostgreSQL.

## Sistemas institucionales externos

No se hallaron documentos del repositorio que definan los nombres, propietarios o estructura de los sistemas institucionales 1, 2 y 3, ni una confirmación de que los sistemas 2 y 3 compartan equipo. Esa relación se deja pendiente; el DER general conceptual no atribuye estructuras internas no verificadas.

## Riesgos y límites de esta auditoría

1. No se pudo consultar `information_schema`, restricciones ni versiones migradas de la base 9D; 9D no estaba en ejecución.
2. La igualdad entidad/migración se refiere a nombres encontrados en archivos, no a una introspección PostgreSQL.
3. El código actual representa la evaluación cerrada como inmutable. La aclaración nueva sobre nota escrita preliminar/corregible y resultado definitivo requiere una política de revisiones append-only y definición institucional antes de implementarse.
4. El esquema de programación existente no cubre calendarios publicados versionados, salas, solapamientos, aprobaciones externas ni trazabilidad de reprogramaciones.
5. No se ejecutó renderer Mermaid: no está instalado `mmdc`, Graphviz ni una dependencia Mermaid local. Los diagramas son editables `.mmd`; su estructura se revisa estáticamente y queda pendiente renderizado visual.
