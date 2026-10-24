# 10.12B — Validación del ciclo académico integrado en PostgreSQL 9D

Fecha: 24 de octubre de 2026

## Resultado

Se añadió a la suite PostgreSQL protegida un ciclo HTTP integrado que recorre expediente, programación, evaluaciones dinámicas compartidas e individuales, consolidación y rúbricas PDF. El caso se ejecuta con datos sintéticos nuevos en una base temporal 9D creada por el runner y marcada como desechable. No modifica las bases locales persistentes ni emite un acta para este ciclo.

El trabajo de ejemplo corresponde a Ingeniería en Software (`SOFT`), tiene dos estudiantes, tutor, dos miembros confirmados de tribunal y una versión dinámica de rúbrica fijada al expediente. La versión contiene Escrita (`TRABAJO_COMPARTIDO`) y Oral (`ESTUDIANTE_INDIVIDUAL`), con indicadores de máximo 5.00 que suman 10.00 por etapa.

## Ciclo y resultados

1. El endpoint de expediente devolvió carrera, versión, estudiantes, tutor y los dos miembros del tribunal asociados al mismo trabajo. La lista de evaluaciones comenzó vacía.
2. Cada miembro registró una evaluación escrita compartida. Se rechazó el cierre sin puntajes y un puntaje superior al máximo del indicador. Las evaluaciones cerradas quedaron vinculadas a la versión fijada.
3. Se programó la sustentación para el 28 de octubre de 2026 a las 10:30. Se comprobó listado y detalle; una fecha calendario inválida respondió 400 y el duplicado de programación del mismo trabajo respondió 409.
4. Antes de las evaluaciones orales, ambos estudiantes figuraron como `EVALUACIONES_CERRADAS_INCOMPLETAS`, sin nota final.
5. Se abrieron las evaluaciones orales individuales. Una se insertó con un UUID PostgreSQL canónico que no es UUIDv4. El guardado concurrente con la misma revisión produjo una respuesta 200 y otra 409; al releer, la revisión avanzó una vez y los puntajes quedaron consistentes. Se cerró esa evaluación mediante HTTP usando el UUID no v4.
6. Con un miembro aún pendiente, ambos resultados aparecieron `EN_PROGRESO`, sin resultado final y con el evaluador pendiente identificado. Tras cerrar las cuatro evaluaciones orales, la programación transitó `PROGRAMADA` → `EN_SUSTENTACION` → `FINALIZADA`.

Los consolidados finales fueron:

| Estudiante | Escrita compartida | Oral individual | Resultado final |
|---|---:|---:|---:|
| Estudiante A | 9.30 | 8.70 | 9.00 |
| Estudiante B | 9.30 | 9.20 | 9.25 |

El resultado conserva la fracción exacta de cada promedio y presenta su valor a dos decimales según el contrato actual. Para la etapa compartida, cada estudiante referencia las mismas dos evaluaciones originales cerradas y su traspaso correspondiente: no se crean evaluaciones ni puntajes editables duplicados. La etapa oral se obtiene de las evaluaciones individuales del estudiante.

## Documentos, auditoría e integridad

Se generaron por lectura los cuatro PDF esperados (dos estudiantes por dos evaluadores). Las respuestas fueron HTTP 200, `application/pdf`, con cabecera `%PDF-`; el modelo documental devolvió la versión y los ámbitos de etapa fijados en el expediente, así como los totales registrados.

Antes y después de consultar los documentos se compararon evaluaciones, puntajes, eventos de auditoría, traspasos y estado académico del trabajo. Los datos permanecieron iguales. La auditoría del ciclo registra 6 creaciones, 6 registros de puntajes y 6 cierres (18 eventos); los eventos de puntuación y cierre se atribuyen al miembro del tribunal correspondiente. El traspaso compartido contiene cuatro asociaciones únicas, una por estudiante y evaluación original. No se alteró el estado del trabajo ni se creó acta en este ciclo.

La suite también conserva comprobaciones independientes de conflictos de sala y concurrencia de programación, fallos atómicos y compatibilidad histórica. Esas pruebas usan sus propios registros sintéticos; no se presentan como expedientes históricos reales.

## Cambios y migraciones

- Se amplió `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts` con el escenario integrado HTTP descrito y sus comprobaciones de consolidación, auditoría y PDF.
- Se ajustó el fixture común de carrera para usar el código `SOFT`; el caso sintético posterior de archivo de actas reutiliza esa carrera, respetando la restricción de unicidad del catálogo.
- Se añadió este informe.

No se modificaron servicios de dominio ni React y no se requirieron migraciones. Las migraciones existentes se ejecutaron únicamente contra las bases temporales creadas por el runner protegido.

## Validación ejecutada

- Pruebas unitarias backend: **17 suites aprobadas, 91 pruebas aprobadas**. Cuatro suites PostgreSQL se omitieron en esta fase unitaria.
- PostgreSQL 9D protegido: **4 suites aprobadas, 43 pruebas aprobadas**: carreras (4), vigencias por carrera (1), rúbricas (21), evaluaciones/documentos/programaciones (17). La suite de evaluaciones ejecutó las llamadas HTTP contra la aplicación NestJS iniciada dentro de la prueba y conectada exclusivamente a su base temporal 9D.
- Pruebas frontend Vitest: **47 archivos, 223 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado, 1680 módulos transformados.
- `git diff --check`: código de salida 0. Git mostró únicamente avisos de normalización LF/CRLF en archivos del árbol de trabajo.

El runner verificó el clúster desechable `127.0.0.1:55441` con su marca de entorno 9D y se ejecutó con `-PreservarBasesPrueba`. Se preservaron las bases de esta ejecución:

- `genares_9d_test_d6bdaf6e`
- `genares_9d_test_e4c10acf`
- `genares_9d_test_bf73ade4`
- `genares_9d_test_c1385f95`

El runner no elimina las bases de prueba cuando se utiliza esa opción. No se usaron las bases persistentes 10.9B (55442), 8E (55440) ni el puerto 5432; tampoco se aplicaron escrituras o migraciones fuera de las bases temporales verificadas.

## Navegador y limitaciones

No se realizó un recorrido visual de React conectado en vivo a 9D. La protección de arranque de NestJS en desarrollo solo permite la base local marcada 10.9B en 55442 y rechaza usar 9D como base de un servidor de desarrollo. No se debilitó esa protección ni se abrió 10.9B para compensarlo. La integración real se verificó con HTTP en la aplicación de prueba NestJS dentro de la suite PostgreSQL; los contratos y componentes React quedaron cubiertos por las pruebas frontend, no por una sesión de navegador contra 9D.

Los estudiantes, trabajo, calificaciones, tribunal y fechas del escenario son fixtures sintéticos creados para la prueba. No se verificaron expedientes institucionales reales. No se implementó el traspaso académico posterior a la evaluación, nuevas reglas de actas, cálculo o funcionalidades fuera de la validación solicitada.

No se hicieron commits ni push. Se detiene aquí la etapa 10.12B.
