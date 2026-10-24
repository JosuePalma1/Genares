# 10.9C — Identidades simuladas integradas

## Resultado

El selector de personas simuladas ahora determina la identidad que React envía a NestJS en cada solicitud. La API solo acepta perfiles de demostración registrados y únicamente cuando corre en desarrollo, desde loopback y con el perfil local 10.9B habilitado. Cada pestaña conserva su selección por separado; cambiarla desmonta la vista anterior y vuelve a cargar sus consultas.

No se añadieron migraciones. Se mantuvo `synchronize: false` y no se ejecutaron escrituras académicas durante las verificaciones de cambio de identidad.

## Problemas encontrados

- El backend usaba una identidad local fija definida por entorno. El selector visual podía cambiar de persona sin cambiar el sujeto reconocido por la API.
- Las consultas podían conservar en pantalla datos cargados bajo el perfil anterior.
- La API no ofrecía una ruta de consolidación que resolviera al estudiante actual desde la identidad autenticada.
- Los actores simulados que no tenían correspondencia API no debían presentarse como si fueran identidades respaldadas por PostgreSQL.

## Cambios realizados

- Se agregó un catálogo cerrado de perfiles: `administracion`, `secretaria`, `evaluador-uno`, `evaluador-dos`, `estudiante-ti-uno`, `estudiante-ti-dos` y `estudiante-soft-uno`.
- NestJS resuelve el encabezado `X-Genares-Dev-Identity` solo en `development`, con origen de conexión loopback y `LOCAL_DEV_IDENTITY_PROFILE=lector-academico-desarrollo`. La clave se valida contra el catálogo; no se aceptan sujetos, roles ni capacidades enviados por el cliente. Una identidad confiable ya establecida no se sustituye. En producción el encabezado se rechaza.
- Administración y secretaría tienen lectura amplia de demostración para consultas. Los perfiles de tribunal conservan la comprobación de pertenencia al tribunal y no reciben `evaluaciones:calificar`. Un estudiante consulta su consolidado mediante la identidad de su propia cuenta; no puede pedir el resultado de otro estudiante.
- Se incorporó `GET /api/v1/evaluaciones/estudiantes/actual/consolidado`, de solo lectura, que resuelve la cuenta y el perfil de estudiante en el servidor.
- El selector se conserva en las vistas API, pero solo ofrece actores con perfil API asociado. El encabezado se agrega a las solicitudes de datos y documentos con `cache: no-store`. La selección usa almacenamiento por pestaña y respaldo en memoria si el navegador bloquea `sessionStorage`.
- Se agregó la vista y ruta de estudiante `/mis-resultados`. Los roles de estudiante no heredan los menús de gestión, tribunal ni administración.
- El fixture local mantiene TI y SOFT y sus relaciones sintéticas entre estudiantes, trabajos, carrera, tutor, tribunal, evaluadores, rúbrica y evaluaciones. Andrea y Mateo corresponden al trabajo TI compartido; Camila al trabajo SOFT. Los sujetos de María y José corresponden a los dos miembros evaluadores. El fixture no altera notas históricas institucionales.

## Correspondencia de perfiles

| Selector de demostración | Sujeto local de la API | Alcance comprobado |
| --- | --- | --- |
| Daniela Cedeño | `desarrollo-local-administrador` | Consulta amplia de trabajos y documentos de demostración |
| Lucía Santamaría | `desarrollo-local-secretaria` | Consulta amplia de trabajos y documentos de demostración |
| María López | `desarrollo-local-evaluador-uno` | Lectura de los trabajos asignados; miembro 1 del tribunal |
| José Mendoza | `desarrollo-local-evaluador-dos` | Lectura de los trabajos asignados; miembro 2 del tribunal |
| Andrea Sofía Mendoza | `desarrollo-local-estudiante-ti-uno` | Consolidado propio del trabajo TI |
| Mateo Andrés Alcívar | `desarrollo-local-estudiante-ti-dos` | Consolidado propio del mismo trabajo TI |
| Camila Alejandra Vélez | `desarrollo-local-estudiante-soft-uno` | Consolidado propio del trabajo SOFT |

Los otros actores del prototipo permanecen disponibles en el modo puramente local, pero no se anuncian como identidades de la API porque aún no tienen perfil 10.9C asociado.

## Entorno de datos y seguridad

- Desarrollo cotidiano: `127.0.0.1:55442/genares_dev_10_9`, marcado como base exclusiva de desarrollo 10.9B. `npm run dev` inició este clúster y NestJS confirmó el marcador antes de atender solicitudes.
- Integración PostgreSQL: exclusivamente el clúster desechable 9D en `127.0.0.1:55441`. La suite se ejecutó con preservación de las bases temporales y no las eliminó.
- No se accedió a PostgreSQL 8E, al puerto 55440 ni al puerto 5432. No se creó, eliminó ni modificó una base persistente protegida.
- No fue necesaria una migración para asociar identidades: los perfiles se resuelven desde el catálogo de desarrollo y las cuentas sintéticas ya presentes en el fixture local.

## Validaciones

- Backend unitario (`npm test -- --runInBand`): 16 suites aprobadas, 105 pruebas aprobadas y 4 suites PostgreSQL omitidas en esta ejecución unitaria.
- PostgreSQL 9D protegido: 4 suites y 39 pruebas aprobadas —carreras (4), vigencias de rúbrica (1), rúbricas (21) y evaluaciones (13)—. Las bases temporales de prueba quedaron preservadas.
- Frontend (`npm test`): 41 archivos de prueba y 198 pruebas aprobadas.
- Build NestJS (`npm run build`): aprobado.
- Build Vite (`npm run build`): aprobado.
- `git diff --check`: aprobado.
- Arranque real con `npm run dev`: Vite respondió en `127.0.0.1:5173`, NestJS en `127.0.0.1:3001` y la API conectó a la base local marcada en 55442.
- Smoke test a través del proxy Vite con perfiles distintos: administración y secretaría recibieron 200; los dos evaluadores recibieron 200 y posiciones de tribunal distintas (1 y 2); cada uno de los tres estudiantes recibió únicamente su trabajo propio; TI compartió un trabajo entre Andrea y Mateo y SOFT devolvió el trabajo de Camila; consultar el consolidado de otro estudiante devolvió 403; una clave de perfil inexistente devolvió 400.
- Las solicitudes de smoke test fueron GET. No se modificaron calificaciones, evaluaciones, estados académicos ni actas al cambiar de perfil o consultar resultados. Las pruebas PostgreSQL existentes cubrieron por separado transacciones, auditoría, cierre e inmutabilidad.

## Compatibilidad e integración futura

No se cambió la autenticación real ni se habilitaron capacidades de escritura. El modo de identidad sintética no se activa en producción; el middleware del servidor rechaza el encabezado y la aplicación solo lo genera en modo de desarrollo sobre loopback.

Los acoplamientos que convendrá aislar al integrar el CORE son el catálogo de perfiles y sujetos en `identidad-desarrollo-local.ts`, el mapeo de actores en `datosPrototipo.js` y la incorporación del encabezado local en `clienteHttp.js` y `documentosApi.js`. El CORE futuro deberá reemplazar ese adaptador con el contexto de identidad compartido. Esta etapa no construye ese CORE ni traslada el proyecto a `apps/`.

## Pendientes y límites

- Las identidades son demostrativas, no sustituyen inicio de sesión ni autorización institucional.
- Las personas de demostración que no tienen cuenta sintética API siguen disponibles únicamente en las vistas locales del prototipo.
- No se implementó escritura de evaluaciones desde las identidades simuladas ni se modificaron fórmulas, actas o resultados históricos.
