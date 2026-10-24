# 10.11D — Integración de seguimiento y consulta con PostgreSQL

Fecha: 24 de octubre de 2026

## Resultado

En el modo integrado, Dashboard, Secretaría, Coordinación y Consulta/Historial leen trabajos, relaciones académicas, programaciones, consolidaciones y actas archivadas mediante NestJS. Las cuatro pantallas usan el mismo listado de trabajos que el módulo Trabajos y no sustituyen errores de API con registros de `localStorage`.

`npm run dev:web` conserva las pantallas y datos locales del prototipo como un recorrido separado. No se añadieron endpoints, escrituras, migraciones ni cambios de esquema para esta etapa.

## Auditoría y pantallas integradas

Las cuatro pantallas anteriores dependían de `ContextoPrototipo` y presentaban métricas derivadas de datos del navegador. Se conservaron esas versiones para `dev:web`; con `FUENTE_TRABAJOS=api`, las páginas delegan en las vistas de seguimiento API.

| Ruta | Datos e indicadores | Filtros y navegación | Escritura |
|---|---|---|---|
| `/dashboard` | Cantidad de trabajos, distribución TI/SOFT, estados, programaciones, resultados individuales completos y actas archivadas. Cada indicador distingue carga, error, ausencia e indisponibilidad. | Acceso a expedientes API reales. | Solo lectura. |
| `/secretaria` | Trabajos y estudiantes, carrera, modalidad, período, tutoría, tribunal confirmado, programación, consolidación completa y actas archivadas. | Enlaces a expediente, resultado individual y Documentos. | Solo lectura; las acciones existentes de documentos permanecen en ese módulo. |
| `/coordinacion` | Los mismos trabajos, estudiantes, tutores, tribunales, agenda y estados que los otros módulos. | Filtros TI/SOFT, estado, período y búsqueda; enlace a expediente y consultas individuales. | Solo lectura. |
| `/consulta` | Estudiantes asociados a trabajos actuales, estados de evaluación, notas finales únicamente cuando el servidor declara resultado completo y archivo de actas por separado. | Filtros de carrera, estado y búsqueda; enlaces con UUID a expediente, resultado y Documentos. | Solo lectura. |

El evaluador/miembro del tribunal no se convierte en una cuenta ni en un perfil de acceso: sigue siendo una relación académica que aparece en el expediente y las evaluaciones.

## Fuentes y contratos reutilizados

El hook `usarSeguimientoApi` centraliza la lectura compartida y valida los formatos antes de presentarlos. Reutiliza:

- `GET /api/v1/trabajos` para el universo de expedientes, estudiantes, tutores, tribunal confirmado, carrera, modalidad, período y versión de rúbrica.
- `GET /api/v1/programaciones-sustentacion` para programaciones registradas.
- `GET /api/v1/evaluaciones/trabajos/:id/consolidados` para estados, pendientes y resultados individuales de trabajos con versión dinámica fijada, tribunal confirmado de dos miembros y estudiantes.
- `GET /api/v1/documentos/actas` para documentos archivados.

No se creó una consulta duplicada ni se hizo CRUD desde estas pantallas. Las llamadas de consolidación se limitan a trabajos que cumplen las condiciones existentes del dominio. Un `409` se representa como consolidación todavía no disponible; otros errores se muestran como errores. No se convierten respuestas vacías en fallos.

Los resultados no se recalculan en React: se presenta `resultadoFinal` solo para estudiantes cuyo estado es `RESULTADO_COMPLETO`. Para casos incompletos se conserva el estado del servidor, se muestran los evaluadores/etapas pendientes que informa la consolidación y no se imprime una nota cero ni se promedian solo las evaluaciones disponibles. El estado `LEGACY_NO_CONSOLIDADA` se etiqueta como histórico sin consolidación dinámica; las evaluaciones antiguas no se reinterpretan ni se mezclan con las etapas actuales. Las actas archivadas se consultan en una sección separada.

Cuando una fuente está deshabilitada, la interfaz informa que no está disponible. Cuando NestJS no responde, informa el error y permite reintentar; nunca vuelve silenciosamente al prototipo local. Los trabajos sin precondiciones para la consolidación no se cuentan falsamente como resultados incompletos ni completos.

## Cambios de navegación y archivos

Las páginas integradas enlazan con UUID del API. Consulta y Secretaría enlazan a expedientes y a resultados solo cuando existe una consolidación individual consultable. Los documentos reciben el trabajo y estudiante seleccionados por query string. Las pantallas no ofrecen aprobación, firma, emisión automática de actas ni cambios de relaciones.

Archivos actualizados:

- `prototipo-titulacion/src/paginas/DashboardPage.jsx`
- `prototipo-titulacion/src/paginas/PaginaSecretaria.jsx`
- `prototipo-titulacion/src/paginas/PaginaCoordinacion.jsx`
- `prototipo-titulacion/src/paginas/PaginaConsulta.jsx`

Archivos añadidos:

- `prototipo-titulacion/src/hooks/usarSeguimientoApi.js` y `usarSeguimientoApi.test.js`
- `prototipo-titulacion/src/dominio/seguimientoAcademico.js` y `seguimientoAcademico.test.js`
- `prototipo-titulacion/src/paginas/SeguimientoApi.jsx`, `SeguimientoApi.test.jsx` y `seguimientoApi.css`
- Este informe.

La lógica académica y los contratos NestJS existentes no cambiaron en 10.11D. No se requirió migración. El modo local sigue disponible con `npm run dev:web`.

## Verificación en navegador

Se inició el entorno mediante `npm run dev` después de comprobar que 5173 y 3001 estaban libres. La API verificó la base local `127.0.0.1:55442/genares_dev_10_9`. Tras esperar el inicio de NestJS, se recorrieron las cuatro pantallas y enlaces en un contexto de navegador aislado:

- Dashboard mostró 2 trabajos (1 TI y 1 SOFT), 1 programación y 3 resultados individuales completos.
- Secretaría presentó esos mismos 2 trabajos y los mismos 3 resultados; registró una programación y 0 actas archivadas.
- Coordinación filtró TI y SOFT y mostró los expedientes correspondientes.
- Consulta mostró 3 estudiantes en los mismos 2 trabajos y resultados 9.00, 9.00 y 9.25. El listado vacío de actas se presentó como ausencia correcta.
- Desde Consulta se abrieron un expediente API y un resultado individual por sus UUID. Desde Consulta se abrió Documentos con el trabajo y estudiante seleccionados.
- La respuesta de Documentos, programación, trabajos y consolidaciones se obtuvo mediante solicitudes GET. No se encontraron errores de consola en la revisión final.

Los registros `DEV-TI-001` y `DEV-SOFT-001` son fixtures sintéticos de la base local 10.9B; no representan expedientes históricos reales. Durante el arranque inicial aparecieron errores transitorios del proxy mientras NestJS todavía compilaba; una vez listo, las pantallas cargaron desde la API. El servidor iniciado para la revisión se detuvo al terminar; los puertos 5173, 3001 y 55442 quedaron sin listeners.

## Pruebas y protección de datos

- Pruebas frontend: **47 archivos, 220 pruebas aprobadas**.
- Pruebas unitarias backend: **16 suites, 88 pruebas aprobadas**; 4 suites PostgreSQL se omiten en esa ejecución unitaria.
- Suite PostgreSQL 9D protegida: **4 suites, 41 pruebas aprobadas** (Carreras 4, Vigencia 1, Rúbricas 21, Evaluaciones/Documentos 15).
- Build NestJS: aprobado.
- Build Vite: aprobado; 1680 módulos transformados.
- `git diff --check`: aprobado.

El runner PostgreSQL verificó el entorno desechable 9D `127.0.0.1:55441` y se ejecutó con `-PreservarBasesPrueba`. Se preservaron sus bases temporales `genares_9d_test_88ddf8a6`, `genares_9d_test_965e983d`, `genares_9d_test_11f54905` y `genares_9d_test_c67bf120`. En 10.9B se hicieron lecturas GET para la comprobación de navegador; no se alteraron trabajos, evaluaciones, calificaciones, programaciones, actas ni auditoría. No se accedió a 55440 ni a 5432. No se hicieron commits ni push.

## Limitaciones y pendientes para 10.11E

- Las listas actuales no tienen paginación; la consulta de resultados solicita una consolidación por cada trabajo elegible. Para volúmenes mayores conviene acordar un contrato paginado o de resumen en NestJS antes de expandir esta vista.
- Los endpoints actuales exponen trabajos y consolidaciones dinámicas, más actas archivadas; no reconstruyen un historial integral de evaluaciones legacy. Si se requiere ese historial, definir una consulta de lectura explícita que mantenga separados los datos legacy y dinámicos.
- Dashboard, Secretaría, Coordinación y Consulta son de lectura. Las operaciones de expediente, evaluación, programación y documentos siguen perteneciendo a sus módulos existentes.
- Los resultados observados corresponden a datos sintéticos 10.9B; la auditoría no verificó expedientes institucionales reales.

Se detiene aquí la etapa 10.11D.
