# 10.10B — Auditoría funcional tras sistema abierto 10.9D

Fecha de revisión: 24 de octubre de 2026

## Resumen ejecutivo

La interfaz y los endpoints locales se recorren sin iniciar sesión ni elegir un perfil. El encabezado informa «Sistema local · Sin cuentas de usuario». Esto es el alcance previsto y no constituye un defecto. Los estudiantes siguen siendo datos académicos y no tienen acceso propio.

La integración todavía combina expedientes locales del prototipo y expedientes de PostgreSQL. Esto produce una rotura reproducible al abrir evaluaciones desde un trabajo local. Además, el defecto F-01 de adaptación permanece: NestJS entrega evaluaciones y consolidaciones válidas, pero React las rechaza porque algunos UUID de evaluación del fixture no son UUIDv4. El listado API de trabajos funciona, mientras que la vista de evaluación y resultados no presenta sus datos.

El modo integrado de desarrollo habilita escrituras en catálogos, rúbricas, evaluaciones, programación y algunas operaciones de documentos. El flujo de creación de trabajos, estudiantes, tutores y asignación de tribunal sigue siendo local a `localStorage`; no existe un controlador de persistencia de trabajos en NestJS.

## Alcance y método

Se revisaron las rutas React, navegación, páginas, adaptadores y servicios HTTP, configuración de `npm run dev`, controladores/capacidades NestJS y el fixture local 10.9B. Se usó el navegador conectado a la Vite existente en `127.0.0.1:5173` y se hicieron lecturas GET a la API mientras respondió. No se enviaron POST, PUT, PATCH o DELETE, no se ejecutaron migraciones y no se alteraron calificaciones, documentos ni otros datos.

El arranque conjunto `npm run dev` no pudo iniciar una segunda Vite porque el puerto 5173 ya estaba ocupado. La Vite que ya servía el proyecto se dejó intacta. `npm run dev:api` verificó la base 10.9B y permitió consultas GET; la sesión NestJS terminó encontrando el puerto 3001 ocupado. Por ello no se afirma que esa ejecución dejara el backend iniciado establemente. No se necesitó 9D para esta revisión documental. No se accedió a 55440 ni a 5432.

## Inventario de rutas y pantallas

Las 23 rutas concretas están dentro de la estructura visual común y no tienen guardas de acceso por usuario o perfil. `/` redirige a `/dashboard`; las rutas retiradas caen en la página no encontrada.

| Rutas | Pantalla | Acceso actual |
|---|---|---|
| `/dashboard` | Dashboard | Acceso directo, contenido local. |
| `/trabajos`, `/trabajos/nuevo`, `/trabajos/:idTrabajo` | Lista, alta y detalle de trabajo | Acceso directo; registros del prototipo. |
| `/trabajos/:idTrabajo/tribunal` | Asignación de tribunal | Acceso directo; asignación local. |
| `/trabajos/:idTrabajo/sustentacion` | Programación por trabajo | En modo integrado redirige al cronograma API; en prototipo usa datos locales. |
| `/cronograma` | Cronograma de sustentaciones | Acceso directo; API en modo integrado. |
| `/mis-evaluaciones` | Lista de trabajos para evaluar | Acceso directo; lista API en modo integrado y lista local en modo prototipo. |
| `/evaluaciones/:idTrabajo/escrita`, `/evaluaciones/:idTrabajo/oral/:idEstudiante` | Registro/consulta de evaluaciones | Acceso directo; API en modo integrado. El fixture 10.9B cae en F-01. |
| `/resultados/:idTrabajo/:idEstudiante` | Resultado individual | Acceso directo; API en modo integrado. El fixture 10.9B cae en F-01. |
| `/rubrica/:idTrabajo/:idEstudiante/:idMiembro` | Impresión de rúbrica del prototipo | Acceso directo, lee `ContextoPrototipo`; no consume la API. |
| `/consulta` | Consulta e historial | Acceso directo, datos locales. |
| `/documentos` | Rúbricas PDF y actas | Acceso directo; API en modo integrado. |
| `/rubricas`, `/rubricas/nueva`, `/rubricas/:idRubrica/nueva-version/:idVersion`, `/rubricas/:idRubrica` | Catálogo, creación, clonación y detalle | Acceso directo; API en modo integrado. |
| `/maestros/modalidades`, `/maestros/modalidades/:id`, `/maestros/carreras` | Catálogos institucionales | Acceso directo; API en modo integrado. |
| `/secretaria`, `/coordinacion` | Seguimiento | Acceso directo, datos locales. |

No hay rutas activas `/login`, `/usuarios` o `/mis-resultados`. La navegación lateral observada ofrece los módulos sin selector de usuario. La API rechaza el antiguo encabezado de identidad simulada.

## Matriz de origen de datos y escrituras

La columna «modo integrado» corresponde a `npm run dev`, que configura las fuentes API y sus indicadores de escritura para el uso local. `npm run dev:web` mantiene el prototipo local y desactiva escrituras API; sus formularios del prototipo pueden seguir cambiando `localStorage`.

| Módulo/pantallas | Fuente en modo integrado | Escrituras en modo integrado |
|---|---|---|
| Dashboard | Prototipo/localStorage | Solo estado local de demostración. |
| Trabajos, alta, detalle y tribunal | Prototipo/localStorage | Alta y asignación cambian solo datos locales; no existe API de persistencia de trabajos/tribunales. |
| Carreras y modalidades | PostgreSQL vía NestJS | Crear, editar y activar/desactivar habilitado por la configuración local y capacidades técnicas. |
| Rúbricas y versiones | PostgreSQL vía NestJS | Crear, actualizar borradores, crear versiones y activar habilitado localmente. |
| Cronograma | PostgreSQL vía NestJS | Crear, actualizar y cambiar estado habilitado localmente; la elegibilidad y validaciones de dominio siguen aplicando. |
| Lista/evaluaciones/resultados | PostgreSQL vía NestJS | Crear, guardar puntajes y cerrar habilitado localmente; hoy la adaptación de registros existentes impide completar la pantalla por F-01. |
| Documentos | PostgreSQL vía NestJS | Guardar nota mínima está habilitado localmente. La emisión de acta tiene endpoint/capacidad de desarrollo y depende de que el servidor indique elegibilidad; no se emitieron actas durante esta auditoría. |
| Consulta, Secretaría y Coordinación | Prototipo/localStorage | Consulta local; no persiste en PostgreSQL. |
| Impresión `/rubrica/...` | Prototipo/localStorage | No modifica la evaluación, pero tampoco usa la fuente API. Documentos tiene una ruta PDF API separada. |

El actor `GENARES:LOCAL_DEVELOPMENT` dispone en local de capacidades para los módulos API, y el middleware exige loopback, base local 10.9B verificada y protecciones de origen/intención para escrituras. Esto habilita el entorno de prueba local; no crea usuarios ni roles. El middleware local no se instala en producción. La autenticación institucional sigue siendo un requisito previo de despliegue, no un hallazgo contra el alcance actual.

## Datos consultados en 10.9B

Las solicitudes GET respondieron con estos resultados:

| API consultada | Respuesta observada |
|---|---|
| Carreras | HTTP 200, dos: TI y SOFT. |
| Modalidades | HTTP 200, una modalidad de desarrollo. |
| Rúbricas | HTTP 200, una rúbrica/version de demostración. |
| Trabajos en Evaluaciones/Documentos | HTTP 200, dos trabajos API: DEV-TI-001 y DEV-SOFT-001. |
| Programaciones | HTTP 200, cero registros; capacidades devuelven `puedeAdministrar: true`. |
| Actas archivadas | HTTP 200, cero registros. |
| Nota mínima | HTTP 200, `7.00`, marcada provisional; el servidor devuelve `puedeEditar: true`. |
| Consolidación TI | HTTP 200, dos estudiantes y resultado completo: 9.00 y 9.25. Escrita compartida 9.30; orales individuales 8.70 y 9.20. |
| Contexto de evaluador | HTTP 200, dos miembros del tribunal y `puedeCalificar: true` para el miembro consultado. |

Son datos sintéticos del entorno de desarrollo, no calificaciones históricas institucionales.

## F-01 — Adaptación de evaluaciones y consolidaciones: sigue vigente

Se reprodujo en navegador al abrir la evaluación del trabajo API TI y su resultado individual. Las dos pantallas muestran «Consulta no disponible». Al mismo tiempo, NestJS devuelve HTTP 200 y datos completos para evaluaciones y consolidación; no es una falta de registros ni un 401/403.

La respuesta contiene IDs de evaluación como `10000000-0000-0000-0000-000000000001`. Son UUID almacenables por PostgreSQL, pero el segmento de versión no es `4`. El adaptador `src/adaptadores/evaluacionesApi.js` usa `esUuidV4` para `evaluacion.id` y también para los IDs de evaluaciones anidadas en cada etapa de consolidación. La validación estricta falla y la interfaz convierte la respuesta en `ErrorRespuestaApi`. La consolidación de Andrea y Mateo sí contiene etapas, transferencias, promedios y resultados finales completos.

El selector del miembro en `EditorEvaluacionApi` usa la lista real de miembros de `contexto-evaluador`; no es un selector de usuario. El endpoint devolvió los dos miembros y autorización local para calificar. En el recorrido real no se llega a mostrar el editor ni su selector debido al error F-01.

## Navegación entre trabajo, tribunal, cronograma, evaluación, resultado y documentos

- Desde `/mis-evaluaciones`, la lista API entrega dos IDs UUID reales y enlaces correctos a Evaluaciones y Resultado. Al abrirlos reaparece F-01.
- Desde `/trabajos`, la lista local muestra cuatro expedientes con IDs como `trabajo-184`. El detalle ofrece «Registrar evaluación escrita», que navega a `/evaluaciones/trabajo-184/escrita`; la pantalla muestra «El identificador debe ser un UUID válido». También se construyen desde el expediente local enlaces a resultado con IDs locales. Este cruce local→API es un defecto nuevo y reproducible.
- El tribunal de `/trabajos/:id/tribunal` es local. El selector de evaluador en el editor API corresponde, en cambio, al tribunal confirmado que NestJS devuelve para el trabajo API.
- `/trabajos/:id/sustentacion` redirige a `/cronograma` en modo integrado. Cronograma consulta API y estaba vacío por tener cero programaciones; no es una respuesta fallida.
- `/documentos` lista trabajos API y actas API, actualmente vacías. El detalle del trabajo carga rúbricas PDF por API. La ruta antigua `/rubrica/...` sigue leyendo la evaluación local; son dos recorridos de impresión distintos.

## Hallazgos anteriores y clasificación actual

| Hallazgo de 10.10 | Estado después de 10.9D |
|---|---|
| F-01 Adaptador de evaluaciones/consolidaciones rechaza la respuesta 10.9B | **Sigue vigente.** Reproducido; causa en UUIDv4 requerido para IDs de evaluación. |
| F-02 Gestión de trabajos, estudiantes, tutor y tribunal sin API | **Sigue vigente.** El prototipo cambia `localStorage`; no hay controlador NestJS de creación/gestión de trabajos. |
| F-03 Evaluador escribe manualmente el UUID | **Resuelto en la lista API.** `/mis-evaluaciones` presenta los trabajos de PostgreSQL. Persiste un problema distinto: expedientes locales enlazan a rutas API con IDs no UUID. |
| F-04 Impresión de rúbrica antigua no conectada a API | **Sigue vigente.** `/rubrica/...` es local; Documentos ofrece PDF API. |
| F-05 Pantallas operativas locales | **Parcialmente vigente.** Dashboard, Trabajos/tribunal, Consulta, Secretaría y Coordinación siguen locales. Se eliminan del inventario Usuarios y roles. |
| F-06 Selector simulado y guards de rutas | **Resuelto/retirado por decisión de alcance.** No es defecto. No hay selector o guard por perfil en las rutas revisadas. |
| F-07 Perfil administrativo API solo de lectura | **Resuelto en modo local 10.9B.** La configuración integrada habilita las capacidades y flags de escritura; no se probó una mutación. |
| F-08 Sin programación/actas en fixture | **Dato vigente, no defecto.** Las listas API responden 200 vacías. |
| F-09 Nota mínima 7.00 provisional | **Sigue como decisión pendiente.** No se cambia ni se interpreta como regla institucional aprobada. |
| F-10 Falta autenticación institucional | **No se reporta como defecto funcional local.** No hay usuarios por alcance; el backend de producción permanece cerrado y la integración institucional será requisito de despliegue. |
| F-11 Fórmulas duplicadas en prototipo y backend | **Riesgo arquitectónico vigente.** Modo API muestra resultados del servidor; el cálculo local continúa separado. No se encontró evidencia en esta auditoría de divergencia numérica entre ambos. |

## Nuevos problemas y prioridades para 10.11

| Prioridad | Corrección propuesta | Criterio de aceptación |
|---|---|---|
| P0 | Alinear el contrato del adaptador de evaluaciones con los UUID reales del backend. No asumir versión UUIDv4 para un campo PostgreSQL `uuid`, o fijar un contrato que el servidor y el fixture cumplan. | Evaluaciones y consolidación reales del fixture 10.9B pasan por el adaptador; React presenta etapas, transferencias, pendientes y 9.00/9.25. Se prueban IDs de evaluación, de etapa y versión usando payloads obtenidos del servicio. |
| P0 | Unificar la fuente y los identificadores de trabajos en Trabajos y Evaluaciones. Implementar/pactar API para trabajo, estudiantes, tutor y tribunal; hasta entonces, no enlazar IDs locales con rutas API. | Desde Trabajos se llega a una evaluación solo para un trabajo API válido; creación y detalle comparten el mismo registro y sus relaciones. No aparece «UUID válido» por un ID del prototipo. |
| P1 | Unificar los recorridos API de resultados y documentos. En modo API, imprimir la rúbrica efectiva vía Documentos/PDF y evitar que rutas antiguas lean `localStorage`. | Desde evaluación y resultado se llega al PDF del evaluador/estudiante correcto; no se mezclan datos locales y API; actas siguen el consecutivo vigente y la consulta no escribe ni cambia estados. |
| P1 | Probar la cadena integrada trabajo→tribunal→cronograma→evaluaciones→resultado→documentos con datos aislados en 9D. | Se cubren estado vacío y caso completo con IDs de cada fuente; pruebas no usan 10.9B ni otras bases persistentes para mutaciones. |
| P2 | Marcar de forma consistente qué pantallas son locales mientras coexistan ambos recorridos y ordenar la navegación para no comparar los cuatro trabajos del prototipo con los dos de API. | Cada página indica su fuente y los enlaces no cruzan fuentes silenciosamente. |
| P2 | Confirmar el umbral provisional 7.00 con la Universidad; mantenerlo marcado provisional hasta entonces. | No se presenta como regla institucional sin aprobación documentada. |
| P2 | Mantener controladas las dos implementaciones de cálculo hasta que se decida unificar el modo prototipo/API. | La fórmula oficial permanece en backend para resultados API y se agregan pruebas de equivalencia si la institución exige que ambas fuentes coincidan. |

La falta de usuario, rol, inicio de sesión o acceso estudiantil no aparece en esta lista de defectos. Tampoco se plantea restaurar esas funciones.

## Validaciones realizadas y limitaciones

- Navegación de navegador sin seleccionar usuario: Evaluaciones, Trabajos, detalle/tribunal, Cronograma, Documentos, Rúbricas, Carreras, Modalidades, Consulta, Secretaría y Coordinación.
- Reproducción visual de F-01 en Evaluaciones y Resultado con IDs válidos del listado API.
- Reproducción del cruce local→API desde `trabajo-184`, con mensaje de UUID inválido.
- GET a carreras, modalidades, rúbricas, trabajos, programaciones, capacidades, actas, nota mínima, evaluaciones, contexto de evaluador y consolidaciones. No se hicieron mutaciones.
- Revisión estática de rutas, guardas, selector de tribunal, configuración Vite, servicios y controladores.
- No se ejecutaron suites unitarias, suite PostgreSQL 9D ni builds: el entregable es una actualización documental y no se modificó código funcional.
- Limitación operativa: la Vite existente ocupaba 5173; NestJS encontró 3001 ocupado durante el intento de inicio. La Vite del usuario se dejó activa/intacta. La selección del trabajo en Documentos quedó incompleta cuando la API dejó de responder; no se atribuye ese corte a una falla funcional de la pantalla.
- No se accedió a 55440, 5432 ni a PostgreSQL 9D. No hubo sentencias de escritura, cambios de datos ni migraciones.

Se detiene aquí la etapa 10.10B.
