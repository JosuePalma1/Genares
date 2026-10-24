# 10.12A — Contrato UUID PostgreSQL en escrituras de evaluaciones

Fecha: 24 de octubre de 2026

## Resultado

Las operaciones de evaluaciones aceptan ahora UUID PostgreSQL en su forma canónica hexadecimal `8-4-4-4-12`, sin exigir versión ni bits de variante RFC específicos. Esto incluye UUIDv4 y valores existentes como `10000000-0000-0000-0000-000000000001`. Las cadenas malformadas siguen rechazándose.

El backend mantiene la validación de pertenencia del trabajo, etapa, estudiante, evaluador e indicador; también conserva permisos, estado, revisión optimista, concurrencia, límites de puntuación y auditoría. Los identificadores generados por la aplicación no cambiaron y siguen usando el generador UUIDv4 existente.

## Causa corregida

El requisito UUIDv4 aparecía en tres lugares:

- El servicio React usaba `esUuidV4` para los parámetros de consulta y escritura, así como para los IDs de indicadores.
- Los DTO de creación, puntajes y cierre usaban `@IsUUID('4')` en los IDs de etapa, estudiante, miembro e indicador.
- El controlador NestJS configuraba `ParseUUIDPipe` con `version: '4'` para trabajo, evaluación y miembro de tribunal.

Aunque PostgreSQL acepta el formato UUID sin exigir una versión RFC, esas validaciones reducían el conjunto de IDs permitidos a UUIDv4.

## Cambios realizados

- Se añadió `backend/src/comun/uuid-postgres.ts` con una expresión regular compartida por los DTO, que valida la forma canónica completa sin restringir versión o variante.
- Los DTO de creación, puntajes y cierre validan ahora con `@Matches(UUID_POSTGRES_PATTERN)`. Se incluyen etapa, estudiante, miembro del tribunal e indicador.
- Los parámetros y la consulta de miembro del controlador usan `ParseUUIDPipe()` sin una versión explícita. NestJS aplica su patrón `all`, que comprueba los grupos hexadecimales canónicos sin imponer la versión RFC.
- El servicio React valida los IDs de consultas y escrituras con `esUuidPostgres`, incluido el ID del evaluador de cada indicador.
- Se añadieron pruebas unitarias del patrón, los DTO y el pipe; pruebas frontend para IDs UUIDv4 y UUID sin versión RFC, rechazos previos al envío y propagación de errores HTTP.
- Se añadió una prueba PostgreSQL 9D con una evaluación cuyo ID es un UUID válido no v4. La fixture se crea exclusivamente dentro de la base temporal: copia una evaluación del mismo trabajo a un segundo estudiante y registra su evento sintético de creación.

La prueba 9D verifica lectura API, edición concurrente con resultados `200/409`, lectura posterior, cierre, auditoría y rechazo de una edición después del cierre. También verifica que IDs canónicos no existentes llegan a las validaciones de recurso, que las cadenas malformadas reciben `400` y que las relaciones de etapa, estudiante y miembro siguen protegiéndose.

No se modificaron las fórmulas, la precisión académica, el cierre, el versionado, las evaluaciones legacy, la generación de IDs, las relaciones de dominio ni las restricciones SQL.

## Contrato y compatibilidad

- **Formato aceptado:** grupos hexadecimales canónicos `8-4-4-4-12`, en mayúsculas o minúsculas; no se validan bits de versión o variante RFC.
- **Formato rechazado:** texto malformado, grupos incompletos, separadores incorrectos u otros formatos que no corresponden a la columna PostgreSQL `uuid`.
- **Recursos:** aceptar el formato no concede acceso. El backend continúa verificando la existencia y pertenencia al trabajo, la versión/etapa fijada, el estudiante vinculado y el miembro confirmado del tribunal.
- **Estados y concurrencia:** se conservaron los conflictos por revisión desactualizada y la inmutabilidad de evaluaciones cerradas.
- **Histórico:** no se reescribieron evaluaciones, notas ni auditorías persistentes. La compatibilidad legacy y su fixture de migración permanecieron intactos.
- **Esquema:** no se requiere migración. No cambió la estructura de la base ni `synchronize: false`.

## Archivos de esta etapa

- `backend/src/comun/uuid-postgres.ts`
- `backend/src/evaluaciones/dto/crear-evaluacion.dto.ts`
- `backend/src/evaluaciones/dto/guardar-puntajes-evaluacion.dto.ts`
- `backend/src/evaluaciones/dto/cerrar-evaluacion.dto.ts`
- `backend/src/evaluaciones/evaluaciones.controller.ts`
- `backend/src/evaluaciones/uuid-postgres-contract.spec.ts`
- `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts`
- `prototipo-titulacion/src/servicios/evaluacionesApi.js`
- `prototipo-titulacion/src/servicios/evaluacionesApi.test.js`
- `docs/ciclo-10.12a-uuid-escritura-informe.md`

## Validaciones ejecutadas

- Backend unitario mediante runner: **17 suites aprobadas, 91 pruebas aprobadas**; las 4 suites PostgreSQL se omitieron en esta ejecución unitaria y se ejecutaron aparte.
- PostgreSQL 9D protegido: **4 suites, 42 pruebas aprobadas**: Carreras (4), Vigencia por carrera (1), Rúbricas (21), Evaluaciones (16).
- Frontend Vitest: **47 archivos, 223 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado, 1680 módulos transformados.
- `git diff --check`: aprobado, código de salida 0. Git mostró avisos de normalización LF/CRLF en archivos existentes.

El runner de 9D verificó su clúster marcado en `127.0.0.1:55441`, creó bases aisladas por suite y se ejecutó con `-PreservarBasesPrueba`. Se preservaron las bases del último recorrido exitoso:

- `genares_9d_test_37f1d48e`
- `genares_9d_test_59a83289`
- `genares_9d_test_9f153aba`
- `genares_9d_test_69bcf453`

Los dos intentos anteriores preservaron sus bases diagnósticas porque las expectativas del test buscaban mensajes específicos que el filtro API reemplaza por mensajes genéricos. Esas bases también se dejaron intactas:

- `genares_9d_test_ea020afe`, `genares_9d_test_d6149b5c`, `genares_9d_test_f9fc54a7`, `genares_9d_test_a0a564e4`
- `genares_9d_test_aff86f95`, `genares_9d_test_68ea8e74`, `genares_9d_test_1c93e1e4`, `genares_9d_test_7bfed3f7`

No se consultó ni modificó 10.9B (`55442`), no se accedió a 8E (`55440`) ni al puerto `5432`, y no se crearon migraciones. No se hicieron commits ni push.

## Pendientes y recomendación para 10.12B

La forma UUID está validada de manera equivalente en ambos proyectos, pero el patrón se define localmente en cada uno porque no existe un paquete compartido de contratos entre React y NestJS. Si se formaliza ese paquete en una etapa futura, conviene trasladar allí el contrato y cubrirlo con pruebas de compatibilidad.

Para 10.12B se recomienda completar un recorrido de escritura integrado con una evaluación editable no v4 desde React, incluyendo conflictos de concurrencia y reintento con revisión actualizada. Esta etapa no hizo escrituras en la base persistente local ni cambió pantallas fuera del servicio API de evaluaciones.

Se detiene aquí la etapa 10.12A.
