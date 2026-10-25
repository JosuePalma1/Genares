# 10.14B — Auditoría funcional comparativa de GENARES

Fecha: 24 de octubre de 2026

## 1. Alcance y método

Esta auditoría compara el modo de demostración local (`npm run dev:web`) con el modo integrado API/PostgreSQL (`npm run dev`) módulo por módulo.

Se revisaron:

- Rutas y menús de [Aplicacion.jsx](../prototipo-titulacion/src/Aplicacion.jsx) y [EstructuraAplicacion.jsx](../prototipo-titulacion/src/estructuras/EstructuraAplicacion.jsx).
- Páginas, servicios, adaptadores, configuración de fuentes y estado local del frontend.
- Controladores, servicios y módulos NestJS del backend.
- La configuración de ejecución en [scripts/dev.mjs](../scripts/dev.mjs).
- La superficie de navegador compartida disponible en `/consulta` y una pantalla de evaluación.

No se modificaron código, contratos API, migraciones, bases de datos ni datos. No se hizo commit ni push. No se accedió a 8E ni al puerto 5432.

### Definición de modos

| Modo | Fuente de datos | Configuración relevante | Propósito actual |
|---|---|---|---|
| Prototipo | `ContextoPrototipo`, `localStorage` (`genares-prototipo-v3`) y datos de demostración | `npm run dev:web`; fuentes API desactivadas | Demostración funcional local, con operaciones simuladas |
| API/PostgreSQL | NestJS + PostgreSQL local de desarrollo | `npm run dev`; fuentes de trabajos, evaluaciones y rúbricas en API; programaciones habilitadas | Integración y pruebas protegidas contra persistencia real |

La configuración no es todavía una selección global única: algunas pantallas cambian a API y otras siguen consultando el estado local o están deshabilitadas según la fuente.

## 2. Resumen ejecutivo

### Hallazgos principales

1. **No existe paridad funcional completa.** El prototipo sigue siendo la fuente exclusiva de varias pantallas operativas.
2. **La cobertura API está fragmentada por módulo.** Trabajos, evaluaciones y rúbricas tienen adaptadores API; tribunal, detalle de trabajo, dashboard, consulta, resultados y varias pantallas de seguimiento continúan dependiendo del prototipo.
3. **La programación es el módulo más cercano a una migración real de lectura/escritura**, aunque el modo web la deshabilita deliberadamente.
4. **Documentos tiene integración API**, incluyendo documento preliminar, rúbrica PDF, actas archivadas y configuración de nota mínima.
5. **La trazabilidad histórica no está integrada realmente en API.** El prototipo muestra una historia derivada de fechas locales; no existe controlador `trazabilidad` ni endpoint `GET /trabajos/:id/trazabilidad`.
6. **Las notificaciones son exclusivas del prototipo** y correctamente se ocultan cuando la aplicación detecta fuentes API.
7. **Eliminar el prototipo hoy rompería rutas y flujos de negocio**, no solo datos de demostración. Antes de retirarlo hay que completar las superficies API faltantes o retirar explícitamente las rutas que no se ofrecerán.

### Prioridades

| Prioridad | Área | Riesgo |
|---|---|---|
| P0 | Definir y completar la superficie API de trabajos, tribunal, dashboard y trazabilidad | La aplicación no puede operar únicamente con PostgreSQL |
| P0 | Integrar resultados, consulta/historial y detalle de trabajo con datos API | Se pueden mostrar estados o datos locales incorrectos |
| P1 | Migrar creación/asignación de trabajos y tribunal, si son parte del alcance operativo | El prototipo permite acciones que PostgreSQL no ofrece |
| P1 | Unificar capacidades, identidad y manejo de errores por módulo | Comportamientos inconsistentes entre lecturas y escrituras |
| P1 | Completar el contrato de trazabilidad histórica | La auditoría no es consultable desde el frontend API |
| P2 | Retirar `ContextoPrototipo`, datos de demostración y notificaciones locales | Solo después de retirar todas las dependencias |
| P2 | Eliminar adaptadores/configuración de compatibilidad | Limpieza final de la nueva rama, después de la migración |

## 3. Matriz funcional por módulo

### 3.1 Dashboard

**Prototipo:** disponible con métricas y actividad derivadas del estado local; usa `ContextoPrototipo`.

**API/PostgreSQL:** no hay un endpoint ni una página API equivalente identificada. La página sigue importando `usarPrototipo()`.

**Resultado:** exclusiva del prototipo en su implementación actual.

**Recomendación:** P0. Crear una consulta agregada API con métricas explícitas y separar métricas actuales de eventos históricos. No reutilizar el estado local como fallback silencioso.

### 3.2 Trabajos de titulación

**Prototipo:** incluye listado, alta local, detalle, estudiantes, tutoría, tribunal, programación e historial derivado. Las operaciones se actualizan mediante el reductor de `ContextoPrototipo`.

**API/PostgreSQL:**

- Existe `GET /api/v1/trabajos`.
- Existe `GET /api/v1/trabajos/:trabajoId`.
- El servicio SQL devuelve datos actuales de carrera, período, modalidad, rúbrica, estudiantes, tutores, tribunal y programación.
- El controlador restringe la consulta general al actor `GENARES:LOCAL_DEVELOPMENT` y a desarrollo/pruebas.
- No se identificaron endpoints API para crear o editar trabajos, estudiantes o tutorías.
- El detalle API no incorpora una línea de trazabilidad histórica.

**Resultado:** lectura parcial compartida; alta, edición y parte del detalle siguen siendo prototipo. La API es además de desarrollo local, no un contrato operativo general.

**Diferencias relevantes:**

- El prototipo puede crear trabajos; la API no ofrece ese flujo.
- El prototipo construye eventos de historial con marcas locales; la API no devuelve eventos.
- La API devuelve el estado actual del tribunal y la programación, no sus transiciones históricas.

**Recomendación:** P0 para lectura y trazabilidad; P1 para escritura si la operación de trabajos debe permanecer en el producto final.

### 3.3 Tribunal

**Prototipo:** asignación editable desde `PaginaAsignacionTribunal`, con validaciones locales, dos miembros y creación de evaluaciones/notificaciones en el reductor.

**API/PostgreSQL:** existen entidades y datos de tribunal usados por consultas de trabajos y evaluaciones, pero no se identificó `tribunales.controller.ts` ni endpoints API para crear, editar, confirmar o consultar una asignación como módulo independiente.

**Resultado:** operación exclusiva del prototipo; lectura indirecta parcial en API.

**Recomendación:** P0/P1. Definir el contrato de asignación y sus capacidades antes de retirar `PaginaAsignacionTribunal` y los reducers relacionados.

### 3.4 Evaluaciones

**Prototipo:** evaluación escrita y oral, guardado de borradores, cierre, observaciones, rúbrica local, resultados y navegación por estudiantes.

**API/PostgreSQL:** existe una integración sustancial:

- `GET /api/v1/evaluaciones/trabajos`.
- `POST /api/v1/evaluaciones/trabajos/:trabajoId`.
- `GET /api/v1/evaluaciones/trabajos/:trabajoId`.
- `GET /api/v1/evaluaciones/trabajos/:trabajoId/contexto-evaluador`.
- `GET /api/v1/evaluaciones/trabajos/:trabajoId/consolidados`.
- `PUT /api/v1/evaluaciones/:evaluacionId/puntajes`.
- `POST /api/v1/evaluaciones/:evaluacionId/cierre`.

También existe auditoría persistida de creación, puntajes y cierre de evaluaciones.

**Resultado:** funcionalidad principal compartida, pero con diferencias:

- El modo prototipo guarda evaluaciones en estado local y genera notificaciones.
- El modo API persiste evaluaciones y auditoría, aplica identidad/capacidades y devuelve estados del servidor.
- Las rutas escritas/orales conservan componentes de prototipo; la página API usa `EditorEvaluacionApi` y fuentes configurables.
- La creación y escritura API dependen de capacidades y de flags de desarrollo.

**Recomendación:** P1. Consolidar un único flujo API para edición y lectura, retirar gradualmente las páginas/reducers de evaluación local y conservar las pruebas API.

### 3.5 Resultados

**Prototipo:** `PaginaResultados` calcula y presenta resultados desde `ContextoPrototipo`, con el flujo académico local.

**API/PostgreSQL:** existe `GET /evaluaciones/trabajos/:trabajoId/consolidados`, consumido por las superficies API de evaluación; no se identificó una ruta de resultados completamente independiente que sustituya la pantalla local para todos los casos.

**Resultado:** integración parcial. El cálculo consolidado existe en backend, pero la ruta/pantalla histórica de resultados aún depende del contexto de la aplicación y debe verificarse por cada entrada.

**Riesgo:** presentar un resultado local después de operar una evaluación en API.

**Recomendación:** P0. Hacer que `PaginaResultados` o una página API equivalente consuma exclusivamente consolidaciones del servidor cuando el modo sea API; eliminar cualquier fallback local silencioso.

### 3.6 Consulta e historial / trazabilidad

**Prototipo:** `/consulta` muestra consulta e historial local. `PaginaDetalleTrabajo` muestra eventos derivados como trabajo registrado, tribunal asignado, revisión escrita cerrada y sustentación programada.

**API/PostgreSQL:** `PaginaConsulta` delega parcialmente a `SeguimientoApi`, que trabaja con estados actuales, consolidaciones y documentos. No existe controlador o servicio API transversal de trazabilidad. Tampoco se identificó `GET /api/v1/trabajos/:idTrabajo/trazabilidad`.

**Resultado:** la trazabilidad histórica no está integrada en API, aunque el análisis 10.14A haya definido el modelo propuesto. La evidencia persistida especializada de evaluación y rúbrica no está expuesta como una línea temporal del trabajo.

**Recomendación:** P0. Implementar primero el contrato de lectura y luego el registro transaccional. Hasta entonces, no presentar el historial local como historial institucional en modo API.

### 3.7 Documentos académicos

**Prototipo:** consulta documentos y actas desde datos locales, incluyendo vista previa y etiquetas de documento preliminar/acta.

**API/PostgreSQL:** integración amplia:

- `GET /api/v1/documentos/trabajos`.
- `GET /api/v1/documentos/trabajos/:trabajoId`.
- `GET /api/v1/documentos/configuracion/nota-minima`.
- `PUT /api/v1/documentos/configuracion/nota-minima`.
- Rúbrica PDF.
- Acta preliminar.
- Emisión de acta.
- Listado, detalle y PDF de actas archivadas.

La pantalla conserva el visor integrado y la apertura del PDF original en pestaña nueva.

**Resultado:** funcionalidad compartida con backend real, pero con dependencia de identidad/capacidades y de consolidaciones API. El modo prototipo sigue siendo una implementación paralela.

**Diferencias relevantes:**

- Las actas archivadas API son inmutables y tienen hash; el prototipo no representa esa persistencia institucional.
- La configuración de nota mínima API es global/persistida; el prototipo la simula en estado local.
- La API distingue preliminar de archivada con endpoints distintos.

**Recomendación:** P1. Validar todos los permisos y retirar la ruta de documentos local después de confirmar paridad visual y de autorización.

### 3.8 Rúbricas

**Prototipo:** listado, creación, edición de borradores, activación, versiones, categorías, indicadores y detalle local.

**API/PostgreSQL:** cobertura amplia:

- Listado y catálogos.
- Capacidades.
- Creación de rúbrica.
- Creación de versión.
- Creación de versión completa.
- Consulta de versiones.
- Actualización de versión.
- Activación de versión.
- Vigencias y auditoría de rúbricas.

La escritura API está protegida por flags y capacidades; versiones activas e históricas pueden quedar en solo lectura.

**Resultado:** funcionalidad compartida con diferencias de autorización y persistencia. El prototipo permite editar sin las garantías transaccionales de PostgreSQL.

**Recomendación:** P1. Mantener solo la implementación API en la nueva rama, después de migrar la creación/edición necesaria y retirar `ContextoPrototipo` de `PaginaRubricas`, `PaginaNuevaRubrica` y `PaginaDetalleRubrica`.

### 3.9 Modalidades y carreras

**Prototipo:** catálogos y edición local desde `ContextoPrototipo`.

**API/PostgreSQL:** ambos tienen controladores completos de lectura, creación, actualización y cambio de estado:

- Modalidades: `GET`, `POST`, `PUT`, `PATCH /estado`.
- Carreras: `GET`, `POST`, `PUT`, `PATCH /estado`.
- Capacidades específicas para cada catálogo.

Las páginas ya contienen llamadas API para operaciones de catálogo, pero todavía importan o comparten piezas del estado prototipo para lecturas y presentación.

**Resultado:** backend funcional; integración frontend parcialmente híbrida.

**Recomendación:** P1. Eliminar el origen local de estas páginas y conservar únicamente servicios/adaptadores API con invalidación de lectura posterior.

### 3.10 Cronograma y programación de sustentación

**Prototipo:** `PaginaProgramacionSustentacion` permite programar localmente y notifica al tribunal. `PaginaCronograma` puede mostrar el cronograma con datos de demostración.

**API/PostgreSQL:** `programaciones-sustentacion.controller.ts` ofrece:

- Capacidades.
- Trabajos disponibles.
- Impresión.
- Listado y detalle.
- Creación.
- Actualización.
- Cambio de estado.

La pantalla `PaginaCronograma` consume servicios API cuando `VITE_PROGRAMACIONES_SOURCE=api`; el modo web lo deja explícitamente `deshabilitada`.

**Resultado:** lectura y escritura API disponibles; la experiencia de prototipo tiene notificaciones y estado local no equivalentes.

**Diferencias relevantes:**

- La programación API guarda responsable técnico/cuenta y estados persistidos.
- El prototipo genera notificaciones locales.
- El historial de cambios de programación no está disponible como auditoría transversal.

**Recomendación:** P1. Mantener el módulo API, retirar `PaginaProgramacionSustentacion` local cuando el flujo API cubra el detalle y las capacidades; no retirar los contratos de impresión ni consultas.

### 3.11 Secretaría y Coordinación

**Prototipo:** `PaginaSecretaria` y `PaginaCoordinacion` consultan `ContextoPrototipo` y ofrecen paneles de seguimiento/gestión local.

**API/PostgreSQL:** no se identificaron controladores equivalentes de secretaría o coordinación. Existen capacidades repartidas en evaluaciones, documentos, programación y catálogos, pero no una API agregada que reemplace estas páginas.

**Resultado:** exclusivas del prototipo en su forma actual.

**Recomendación:** P0 si estas vistas son requisitos del producto. Definir si se reemplazarán por dashboards API por rol o si se retirarán del alcance de la rama PostgreSQL. No eliminarlas por accidente durante la limpieza.

### 3.12 Notificaciones

**Prototipo:** `CampanaNotificaciones` consume el estado local, y el reductor crea avisos al asignar tribunal, cerrar revisiones escritas y programar sustentación.

**API/PostgreSQL:** no hay módulo API de notificaciones consultable por el frontend. La campana se oculta con `!esModoApi`.

**Resultado:** exclusiva del prototipo y correctamente no disponible en API actual.

**Recomendación:** P2 para retirada. Si se requiere en el producto PostgreSQL, debe diseñarse un contrato y persistencia propios; no trasladar las notificaciones ficticias del prototipo.

## 4. Funcionalidades presentes en ambos modos

Con distinto nivel de integración o persistencia:

- Navegación general y estructura visual.
- Consulta de rúbricas y versiones.
- Evaluaciones escritas/orales y estados de evaluación.
- Consolidación de resultados, con distinta pantalla de entrada.
- Consulta de documentos y PDF.
- Actas preliminares y archivadas en el modo API; representación local en el prototipo.
- Catálogos de modalidades y carreras.
- Cronograma/programación de sustentaciones.
- Consulta de trabajos, aunque la API limita el acceso a desarrollo local.
- Panel de consulta e historial como concepto de UX, pero no como implementación histórica equivalente.

«Presente en ambos» no significa «mismo contrato»: el prototipo persiste en `localStorage`, mientras API aplica PostgreSQL, capacidades, UUID, revisiones, restricciones y auditoría.

## 5. Funcionalidades exclusivas del prototipo

### Exclusivas funcionales

- Alta local de trabajos y estudiantes.
- Asignación local de tribunal.
- Paneles de Dashboard basados en datos locales.
- Secretaría y Coordinación.
- Consulta/historial local.
- Historial derivado desde marcas temporales del prototipo.
- Notificaciones locales y campana.
- Programación local con avisos simulados.
- Edición de evaluaciones mediante reducer local.
- Edición local de rúbricas y catálogos cuando la página no entra por el adaptador API.

### Exclusivas técnicas

- `ContextoPrototipo` y su reducer.
- `datos/datosPrototipo` y `migracionesDemostracion`.
- Persistencia `localStorage` bajo `genares-prototipo-v3`.
- Adaptadores de escritura y lectura que traducen modelos locales a la forma API.
- Fallbacks de datos de demostración.
- Configuración de fuentes `prototipo` y flags de escritura.
- `CampanaNotificaciones` y estructuras locales de notificaciones.

Estas piezas no deben retirarse individualmente antes de comprobar todas sus importaciones. Varias páginas híbridas todavía las necesitan aunque ya existan servicios API.

## 6. Funcionalidades incompletas o con comportamiento diferente

| Área | Diferencia | Severidad |
|---|---|---|
| Trabajos | API solo lectura y restringida a desarrollo local; prototipo permite alta y edición | P0 |
| Tribunal | No hay controlador API de asignación equivalente | P0 |
| Dashboard | No hay consulta API equivalente | P0 |
| Trazabilidad | No hay endpoint ni integración API; el prototipo deriva eventos locales | P0 |
| Resultados | Consolidación API existe, pero la ruta general aún tiene dependencia local | P0 |
| Secretaría/Coordinación | Sin endpoints agregados equivalentes | P0/P1 |
| Evaluaciones | Backend real disponible, pero conviven páginas/reducers locales y API | P1 |
| Rúbricas | Backend amplio; frontend híbrido y escritura condicionada por flags | P1 |
| Catálogos | API disponible, pero algunas superficies aún importan estado local | P1 |
| Programación | API funcional; modo web la deshabilita y el prototipo notifica localmente | P1 |
| Documentos | API amplia; requiere validar permisos, capacidades y todos los estados vacíos/error | P1 |
| Notificaciones | Solo prototipo; no hay sustituto API | P2 |
| Identidad | Prototipo usa “Sistema local” sin cuentas; API usa identidad/capacidades | P1 |
| Historial de cambios | API conserva auditorías específicas, no una línea transversal | P0 |

## 7. Trazabilidad histórica: verificación de integración real

La trazabilidad debe considerarse un requisito funcional objetivo, pero **no está integrada actualmente en el modo API**:

- No hay controlador NestJS de trazabilidad.
- No hay servicio API que agregue auditoría de trabajo, tribunal, evaluación, programación y documentos.
- No hay servicio frontend que consuma `GET /api/v1/trabajos/:trabajoId/trazabilidad`.
- `PaginaDetalleTrabajo` importa `usarPrototipo()` y crea eventos derivados desde datos locales.
- `SeguimientoApi` consulta estado actual, consolidaciones y documentos; no expone una línea histórica.
- Las tablas `eventos_auditoria_evaluacion` y `auditoria_rubricas` son evidencias especializadas, no una integración transversal.

Por tanto, la migración a PostgreSQL debe incluir la implementación del contrato definido en 10.14A o, mientras tanto, mostrar explícitamente que la trazabilidad API no está disponible. No es aceptable reemplazarla con un fallback a `ContextoPrototipo`.

## 8. Código y dependencias candidatos a retirar

La retirada debe hacerse en una rama posterior y por etapas.

### Etapa A — después de completar las superficies API P0

Retirar o reemplazar:

- Imports de `usarPrototipo()` en Dashboard, trabajos, tribunal, detalle de trabajo, consulta, resultados, Secretaría y Coordinación.
- Rutas de escritura local para trabajos, tribunal y evaluaciones.
- Panel de historial local de `PaginaDetalleTrabajo`.
- Fallbacks que presenten datos de demostración cuando una llamada API falla.

### Etapa B — después de validar paridad API P1

Retirar:

- `src/estado/ContextoPrototipo.jsx`.
- `src/datos/datosPrototipo.*`.
- `src/datos/migracionesDemostracion.*`.
- Componentes y helpers exclusivos de notificaciones locales.
- `PaginaProgramacionSustentacion.jsx` local, si `PaginaCronograma` y el detalle API cubren el mismo flujo.
- Adaptadores de escritura locales de rúbricas, catálogos y evaluaciones.

### Etapa C — limpieza de configuración

Retirar:

- `VITE_RUBRICAS_SOURCE`.
- `VITE_EVALUACIONES_SOURCE`.
- `VITE_PROGRAMACIONES_SOURCE`.
- `VITE_*_WRITE_API` cuando la escritura API sea la única ruta soportada.
- Resolutores `resolverFuente*` y ramas `fuente === 'prototipo'`.
- Dependencias de `localStorage` del prototipo.

### Piezas que no deben retirarse todavía

- Servicios API, adaptadores de respuesta y pruebas asociadas.
- `clienteHttp` y manejo de identidad/capacidades.
- Componentes visuales compartidos.
- `PaginaDocumentos`, `PaginaCronograma`, `EditorEvaluacionApi` y sus pruebas.
- Entidades y auditorías backend.
- Migraciones existentes.
- Cualquier helper de dominio compartido por el modo API.

## 9. Plan recomendado para PostgreSQL como única fuente

### Fase 1 — contrato y cobertura P0

1. Definir una política de alcance: qué roles usarán trabajos, tribunal, resultados, consulta y paneles.
2. Exponer lectura de trabajos para la identidad prevista, no solo `GENARES:LOCAL_DEVELOPMENT`.
3. Crear endpoints de tribunal y de escritura de trabajos si siguen siendo requisitos.
4. Implementar resultados API como entrada única.
5. Implementar `GET /trabajos/:idTrabajo/trazabilidad` y conectar las auditorías existentes.
6. Crear dashboard y paneles de rol mediante consultas API agregadas.

### Fase 2 — convergencia P1

1. Consolidar evaluaciones en `EditorEvaluacionApi`.
2. Consolidar rúbricas y catálogos en los adaptadores API.
3. Mantener programación y documentos como módulos API únicos.
4. Unificar estados de carga, error, vacío, solo lectura y capacidades.
5. Probar trabajos completados, actas archivadas y documentos originales.

### Fase 3 — retirada controlada del prototipo

1. Activar una configuración API única en una rama de migración.
2. Ejecutar pruebas frontend, backend y e2e protegidas.
3. Retirar dependencias de `ContextoPrototipo` por importación, no por borrado masivo.
4. Eliminar flags y fallback solo cuando `rg` confirme que no existen consumidores.
5. Conservar historial Git del prototipo; no eliminar archivos institucionales ni materiales ajenos.

## 10. Criterios de aceptación para la nueva rama

- Ninguna ruta operativa lee `ContextoPrototipo`.
- Ningún error API muestra datos de demostración.
- Todos los módulos visibles tienen endpoint API documentado o son retirados explícitamente del alcance.
- Trabajos, tribunal, evaluaciones, resultados, documentos, cronograma y trazabilidad usan PostgreSQL.
- Auditoría histórica distingue eventos persistidos, reconstruidos y no disponibles.
- Las capacidades de lectura/escritura se validan por rol.
- No hay notificaciones ficticias en modo API.
- Los PDFs y actas provienen del servidor.
- Pruebas frontend y backend pasan; las pruebas e2e protegidas se ejecutan solo contra el entorno autorizado.
- `git diff --check` permanece limpio.

## Conclusión

GENARES tiene una base API/PostgreSQL sólida para evaluaciones, rúbricas, catálogos, programación y documentos, pero no es todavía equivalente al prototipo como aplicación completa. Las brechas críticas están en trabajos, tribunal, dashboard, resultados, Secretaría/Coordinación y trazabilidad transversal.

La recomendación es no retirar el prototipo inmediatamente. Primero debe completarse la cobertura API P0, especialmente la trazabilidad real, y después converger las páginas híbridas. Una vez que ninguna ruta dependa de `ContextoPrototipo`, se podrán retirar el estado local, los datos de demostración, las notificaciones ficticias y las banderas de fuente de manera segura.
