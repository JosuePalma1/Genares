# 10.11B — Integración de Trabajos y relaciones académicas con PostgreSQL

Fecha: 24 de octubre de 2026

## Resultado

El recorrido **Trabajos → expediente → estudiantes y tribunal → Evaluaciones → Resultados** usa ahora identificadores y relaciones provenientes de PostgreSQL en `npm run dev`. La pantalla de Trabajos ya no muestra el catálogo ficticio de `localStorage` en ese modo. La asignación de tribunal se presenta como consulta, y el alta no aparenta persistir un expediente institucional.

No se crearon migraciones. Las verificaciones con la base local 10.9B fueron únicamente lecturas. No se modificaron expedientes, relaciones, evaluaciones, calificaciones, rúbricas, programaciones ni actas.

## Endpoints

- `GET /api/v1/trabajos`: lista trabajos y relaciones en una consulta común.
- `GET /api/v1/trabajos/:trabajoId`: devuelve el mismo contrato para un expediente. El identificador debe tener formato UUID de PostgreSQL; un formato malformado recibe `400` y un UUID inexistente recibe `404`.
- `GET /api/v1/evaluaciones/trabajos`: se conserva como alias compatible y delega en la misma consulta que el nuevo listado. La pantalla de evaluaciones y la de trabajos no mantienen listas divergentes.

Los endpoints de trabajos exigen capacidad de lectura y la identidad técnica local habilitada en `development` o `test`. No se abrieron estas consultas para identidades verificadas generales ni para producción.

La respuesta incluye el estado del trabajo, carrera y código, período, modalidad, versión y estado de rúbrica, estudiantes en orden de autoría, tutorías activas e históricas, estado del tribunal, miembros únicamente cuando la asignación actual está confirmada, fecha de confirmación y programación vigente cuando existe. Las relaciones opcionales ausentes se devuelven vacías o como `null`; no se completan con datos del prototipo.

## Pantallas integradas

- `/trabajos` consulta el endpoint compartido con Evaluaciones, filtra por texto, período y estado, y presenta las relaciones devueltas por el servidor.
- `/trabajos/:idTrabajo` consulta el mismo origen, presenta estudiantes, tutores, carrera, modalidad, período, rúbrica/version, tribunal y programación. Cuando hay versión y tribunal confirmado, presenta también las etapas y los enlaces de evaluación y resultados devueltos para estudiantes del trabajo.
- `/trabajos/:idTrabajo/tribunal` muestra el estado y los miembros confirmados en modo de consulta. No ofrece asignación ni escritura local.
- `/trabajos/nuevo` informa que el alta del expediente corresponde al sistema institucional proveedor. No crea IDs ficticios ni registros en `localStorage` dentro del modo integrado.
- La selección del miembro del tribunal dentro de Evaluaciones sigue usando el tribunal del trabajo API. Identifica la asignación académica para evaluar; no es un selector de cuentas.
- `/trabajos/:idTrabajo/sustentacion` conserva el comportamiento existente que lleva al Cronograma API.

El modo `npm run dev:web` conserva la experiencia de prototipo local. El modo integrado resuelve la fuente de Trabajos con la configuración API de Evaluaciones; si la API falla, no sustituye sus datos por expedientes locales. `VITE_TRABAJOS_SOURCE` permite configurar explícitamente la fuente de Trabajos en desarrollo y la API no se habilita en producción.

## Relaciones y responsabilidad del sistema proveedor

La consulta reutiliza las tablas existentes de trabajos, carreras, períodos, modalidades, versiones de rúbrica, estudiantes, personas, tutores, asignaciones y miembros de tribunal, y programaciones. No hubo cambios de esquema ni se duplicaron entidades académicas.

La conformación y confirmación institucional del tribunal sigue perteneciendo al sistema proveedor. Para una futura integración conjunta, ese sistema deberá acordar cómo identifica de forma estable el trabajo y las personas docentes, y entregar el estado confirmado, los miembros, su posición y el momento de confirmación. También falta acordar el identificador compartido del expediente y el contrato para crear o actualizar sus relaciones. GENARES no implementa ese proceso ni crea asignaciones.

La vista de alta y asignación anteriores permanecen disponibles solo en el prototipo local separado; el modo conectado no afirma que sus cambios se hayan guardado en PostgreSQL. La creación de trabajos, estudiantes y tutorías no se implementó porque la institución aún no ha definido qué sistema es responsable de esas operaciones.

## Pruebas y verificación

- Backend unitario: **16 suites y 88 pruebas aprobadas** (`npm test -- --runInBand`). El runner protegido 9D volvió a ejecutar las unitarias con el mismo resultado.
- PostgreSQL 9D protegido: **4 suites y 41 pruebas aprobadas** (Carreras 4, Vigencias 1, Rúbricas 21, Evaluaciones 15). La suite de evaluaciones cubre listado/detalle coherentes, varios estudiantes, tutor, tribunal confirmado y borrador, relaciones opcionales ausentes, rechazo de UUID inválido, `404`, autorización y compatibilidad del alias.
- Bases temporales nuevas del runner preservadas: `genares_9d_test_96aa7cb6`, `genares_9d_test_c99c2a4d`, `genares_9d_test_744ba9fb` y `genares_9d_test_b39e6d35`. El runner verificó host `127.0.0.1`, puerto `55441` y marca desechable; no eliminó bases temporales.
- Frontend Vitest: **43 archivos y 203 pruebas aprobadas**, incluyendo validación del contrato, rechazo de IDs locales antes de llamar a la API, enlaces hacia evaluación/resultados y tribunal solo de lectura.
- Build NestJS: aprobado.
- Build Vite: aprobado, 1675 módulos transformados.
- `git diff --check`: aprobado. Git mostró avisos de conversión LF/CRLF en archivos ya modificados; no reportó errores de whitespace.

### Navegador y base local 10.9B

Se inició `npm run dev` tras verificar que los puertos de la aplicación estaban libres. NestJS confirmó la base `127.0.0.1:55442/genares_dev_10_9`. La solicitud `GET /api/v1/trabajos` respondió `200` con exactamente dos registros:

- `DEV-TI-001`: TI, Andrea Sofía Mendoza Loor y Mateo Andrés Alcívar Pico, tutor activo, dos miembros confirmados, rúbrica `10.9B-DEMO` y sin programación.
- `DEV-SOFT-001`: SOFT, Camila Alejandra Vélez Mera, tutor activo, dos miembros confirmados, rúbrica `10.9B-DEMO` y programación del 24 de octubre de 2026 a las 10:00 en Sala 1.

Desde el expediente TI se abrió Evaluaciones y el resultado individual de Mateo, que mostró `9.25` y escrita compartida `9.30`. Se consultaron también el expediente SOFT, el tribunal en modo de lectura y la ruta de alta informativa. No aparecieron errores en la consola del navegador. Son registros sintéticos de desarrollo 10.9B, no expedientes históricos institucionales. Las solicitudes a esa base durante esta comprobación fueron GET.

La primera tentativa de arranque dentro del sandbox falló porque esbuild no pudo crear un proceso (`EPERM`). El arranque se repitió con el permiso de proceso requerido, finalizó la comprobación y se detuvo con `Ctrl+C`. Los puertos 5173, 3001 y 55442 quedaron libres.

No se accedió a PostgreSQL 8E (55440) ni al puerto 5432. Las únicas escrituras de pruebas de esta etapa ocurrieron en las bases temporales aisladas de 9D.

## Archivos de esta etapa

- Backend: `backend/src/trabajos/trabajos.controller.ts`, `trabajos.module.ts` y `trabajos.service.ts`.
- Backend: integración de `TrabajosModule` y reutilización de `TrabajosService` desde Evaluaciones; pruebas PostgreSQL en `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts`.
- Frontend: adaptador y validación `src/adaptadores/trabajosApi.js`, `src/configuracion/trabajos.js`, servicio `src/servicios/trabajosApi.js` y hook `src/hooks/usarTrabajosApi.js`, con sus pruebas.
- Frontend: `src/paginas/PaginaTrabajosApi.jsx` y sus pruebas; selección por fuente API en `PaginaTrabajos.jsx`, `PaginaDetalleTrabajo.jsx`, `PaginaAsignacionTribunal.jsx` y `PaginaFormularioTrabajo.jsx`.
- Frontend: listado de evaluaciones redirigido al endpoint compartido `/trabajos`; expectativa actualizada en `src/servicios/evaluacionesApi.test.js`.
- Este informe: `docs/integracion-10.11b-informe.md`.

El árbol de trabajo ya contenía cambios de etapas anteriores; se conservaron y no se crearon commits ni se hizo push.

## Pendientes para 10.11C

1. Acordar el contrato y el identificador estable con el sistema que crea expedientes y asigna tribunales antes de agregar sincronización o escritura.
2. Definir con los sistemas integrados la correspondencia estable de trabajos y docentes, y la entrega de cambios de tutoría, miembros y confirmaciones.
3. Decidir si el alta de trabajos y relaciones pertenece a GENARES o a otro sistema. Hasta entonces, estas pantallas conectadas siguen siendo de consulta.
4. Integrar otros paneles locales solo si forman parte del siguiente alcance aprobado; Dashboard, Consulta, Secretaría y Coordinación no se modificaron en 10.11B.

Se detiene aquí la etapa 10.11B.
