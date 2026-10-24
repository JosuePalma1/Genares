# 10.11A — Reparación de Evaluaciones y Resultados API

Fecha: 24 de octubre de 2026

## Resultado

Las pantallas React de Evaluaciones y Resultado individual leen ahora las respuestas reales de NestJS para el fixture local 10.9B. Se corrigieron dos causas del rechazo de respuestas HTTP 200: la exigencia incorrecta de UUIDv4 para identificadores de lectura y la falta de estructura detallada en algunas instantáneas JSON históricas de evaluación.

No se modificaron calificaciones, cierres, fórmulas, notas consolidadas, estados académicos ni datos de la base persistente. No fue necesaria una migración.

## Diagnóstico y correcciones

### Identificadores

El adaptador React validaba como UUIDv4 todos los identificadores recibidos. PostgreSQL admite valores UUID canónicos que no tienen versión RFC 4; el fixture 10.9B usa ese formato en los IDs de algunas evaluaciones (`10000000-0000-0000-0000-000000000001`, entre otros). El listado y la consulta de NestJS respondían correctamente, pero React rechazaba la evaluación y las referencias anidadas de la consolidación.

Se añadió `esUuidPostgres`, que valida la forma hexadecimal canónica `8-4-4-4-12` sin aceptar texto arbitrario ni restringir versión o variante. Se aplica a los identificadores recibidos de evaluaciones, trabajos, estudiantes, versiones, etapas, categorías, indicadores, traspasos, evaluadores y evaluaciones anidadas. Se conserva UUIDv4 para los IDs enviados por el cliente en operaciones de escritura, de acuerdo con los contratos y validadores actuales del API.

### Estructura de la rúbrica en las evaluaciones

Algunas filas del fixture guardan en `instantanea_rubrica` únicamente el ID de versión y metadatos mínimos, sin `stages` ni `categories`. El editor necesita la estructura completa para enlazar cada puntaje con su indicador, texto, máximo y etapa; el adaptador correctamente rechazaba esos datos insuficientes.

Para evaluaciones dinámicas con instantánea incompleta, `GET /api/v1/evaluaciones/trabajos/:trabajoId` completa **solo la respuesta** consultando la versión fijada, siempre que no esté en estado `BORRADOR`. La versión configurada tiene su estructura protegida contra edición por las restricciones SQL. La respuesta mantiene `instantaneaRubrica` y sus demás campos, incorporando las etapas, categorías e indicadores persistidos en esa versión. No se inventan puntajes ni se reconstruyen notas desde datos parciales.

La evaluación almacenada no se actualiza. Una prueba PostgreSQL reduce deliberadamente la instantánea en una base 9D aislada y verifica que el GET devuelve estructura completa mientras la fila, estado, revisión, total y auditoría permanecen idénticos. Las evaluaciones históricas con `idEtapaRubrica` nulo mantienen su instantánea legacy y no se reinterpretan como dinámicas.

### Validación del contrato de respuesta

Los adaptadores verifican además los estados reconocidos, los ámbitos admitidos, la correspondencia entre etapa y alcance, la pertenencia de categorías a etapas, y la coincidencia entre cada puntaje y su indicador (ID, texto y máximo). En consolidaciones se comprueban evaluaciones cerradas, estados, evaluadores pendientes y consistencia entre completitud y resultado final. Una consolidación incompleta sigue sin producir una nota definitiva.

El backend no declara un DTO de respuesta dedicado para estas lecturas; actualmente devuelve objetos JSON construidos por el servicio. Se mantuvieron las rutas y los campos existentes, y se completó el campo actual `instantaneaRubrica` de forma compatible.

## Archivos modificados

- `backend/src/evaluaciones/evaluaciones.service.ts`: completa en lectura la estructura fijada de instantáneas dinámicas incompletas.
- `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts`: verifica reconstrucción no persistente en PostgreSQL 9D aislado.
- `prototipo-titulacion/src/adaptadores/evaluacionesApi.js`: valida UUID canónicos y consistencia de estructuras, puntajes y consolidaciones.
- `prototipo-titulacion/src/adaptadores/evaluacionesApi.test.js`: cubre UUID no v4 de PostgreSQL, IDs malformados, etapas/ámbitos, instantáneas completas, legacy e inconsistencias.
- `prototipo-titulacion/src/servicios/evaluacionesApi.test.js`: alinea fixtures de servicio con la forma actual de respuestas NestJS.
- `docs/integracion-10.11a-informe.md`: este informe.

## Verificación funcional en navegador

Se inició `npm run dev` y se usaron el frontend local y la API conectada a `127.0.0.1:55442/genares_dev_10_9`. La lista de evaluaciones presentó los trabajos API existentes. En `DEV-TI-001`:

- La pantalla de evaluación mostró las etapas fijadas «ESCRITA» (`TRABAJO_COMPARTIDO`) y «ORAL» (`ESTUDIANTE_INDIVIDUAL`), sus indicadores, máximos y puntajes.
- Las seis evaluaciones existentes se identificaron como cerradas y solo lectura. El selector mostró miembros reales del tribunal del trabajo; no es un selector de cuentas de usuario.
- La etapa escrita compartida se representó como 9.30 para cada estudiante mediante su traspaso, sin duplicar ni alterar el registro original.
- El resultado de Andrea Sofía Mendoza Loor mostró escrita 9.30, oral 8.70 y final **9.00**. El de Mateo Andrés Alcívar Pico mostró escrita 9.30, oral 9.20 y final **9.25**.
- Ninguna de las dos pantallas mostró «Consulta no disponible» y no hubo errores en la consola del navegador.

Los valores son los del fixture sintético de desarrollo 10.9B; esta comprobación no representa expedientes institucionales históricos. Ese fixture contiene resultados completos. Los estados sin evaluaciones, en progreso, cerrados incompletos y legacy sin consolidación se cubren mediante pruebas de contrato; no se afirma haber mostrado en navegador un trabajo incompleto de 10.9B.

## Pruebas y builds

- Backend unitario: **16 suites, 88 pruebas aprobadas**.
- PostgreSQL 9D protegido: **40 pruebas aprobadas** en cuatro suites: Carreras (4), Vigencias (1), Rúbricas (21) y Evaluaciones (14). El runner se ejecutó con `-PreservarBasesPrueba`; conservó las bases temporales `genares_9d_test_69e78eb3`, `genares_9d_test_1ce65758`, `genares_9d_test_f95e4fff` y `genares_9d_test_742d672a`.
- Frontend Vitest: **40 archivos, 195 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado (1669 módulos transformados).
- `git diff --check`: aprobado; Git emitió avisos de conversión LF/CRLF en archivos existentes, sin errores de whitespace.
- Inicio conjunto y navegación real con `npm run dev`: aprobados para la API y pantallas descritas.

En la base 10.9B se hicieron únicamente lecturas GET para la comprobación. No se ejecutaron migraciones, escrituras ni cambios en evaluaciones o auditoría. Las únicas mutaciones para comprobar la lectura no persistente ocurrieron dentro de una base temporal del runner 9D, que quedó preservada. No se accedió a PostgreSQL 8E (55440) ni al puerto 5432.

## Pendientes para 10.11B

1. Unificar el origen de los trabajos: `/trabajos` y sus expedientes siguen usando `localStorage`, mientras Evaluaciones y Resultados consumen IDs y datos de PostgreSQL. No se integraron el alta de trabajo, estudiantes, tutor ni tribunal, tal como delimita 10.11A.
2. Alinear los enlaces de expedientes locales para que no naveguen a endpoints API con IDs locales que no son UUID.
3. Unificar el recorrido de impresión de rúbricas con la fuente API. La ruta antigua de impresión continúa consumiendo el contexto local; esta etapa no modificó Documentos ni actas.

Se preservan la navegación general, el modo local abierto de desarrollo y la separación de los estudiantes como registros académicos sin acceso propio. No se añadieron usuarios, roles, autenticación ni CORE, y no se hizo commit ni push.
