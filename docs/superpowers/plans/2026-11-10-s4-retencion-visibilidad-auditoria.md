# Plan de implementación: visibilidad y auditoría de S4

> **Para el agente que implemente:** usar la habilidad `executing-plans` y seguir las tareas en orden. Las casillas sirven para llevar el avance.

**Objetivo:** Conservar los registros de S4, mostrar el valor numérico `Estado: 1` en los registros visibles, ocultar de la interfaz los registros con `estado_registro=0` y auditar los cambios aceptados desde la API y desde operaciones SQL normales en pgAdmin.

**Arquitectura:** Un script SQL aditivo, limitado al esquema `s4`, agregará el estado numérico, la bitácora, la protección contra borrado físico y las reglas de integridad de evaluaciones cerradas y rúbricas ya usadas. NestJS seguirá aplicando permisos y filtrando respuestas; los disparadores de PostgreSQL reforzarán las reglas también para SQL directo; React mostrará solo registros visibles y su estado numérico.

**Tecnologías:** PostgreSQL, NestJS, TypeORM, React, Vite, Jest y Vitest.

**Diseño aprobado:** `docs/s4/decisiones/2026-11-10-retencion-visibilidad-auditoria.md`

**Estado de ejecución:** implementación aplicada en `genares_integrado_dev`; fixture idempotente y verificador transaccional completados. La casilla del baseline preinstalación queda pendiente porque esa consulta ya no se puede reproducir después de aplicar el esquema y no hay evidencia guardada de su salida original.

## Restricciones globales

- Modificar únicamente datos propiedad de S4 en `genares_integrado_dev`; no alterar `gen`, `s1`, `s2` ni `s3`.
- Usar `estado_registro SMALLINT NOT NULL DEFAULT 1 CHECK (estado_registro IN (0,1))`: `1` visible y `0` oculto. Conservar los valores académicos de `estado` que ya existen.
- La aplicación y las consultas SQL normales no pueden borrar ni truncar físicamente registros de S4.
- Conservar versiones inmutables, cierres de evaluación, calificaciones, reglas académicas e historial de auditoría.
- Registrar el actor provisional de la API como `GENARES:LOCAL_DEVELOPMENT`; si SQL directo no establece actor, guardar `session_user` y el nombre de la aplicación.
- No ejecutar migraciones antiguas, habilitar sincronización ORM, usar Docker, modificar S1–S3, crear ramas ni hacer commit o push.

## Enfoque de revisión

- Una fila S4 oculta no debe filtrarse por listas, detalles anidados, documentos, evaluaciones ni cronogramas; probar un padre y un hijo con `estado_registro=0`.
- Ocultar una versión de rúbrica no debe borrar ni reescribir evaluaciones asociadas; verificar que la fila y las relaciones permanezcan.
- PostgreSQL debe impedir modificar evaluaciones cerradas y el contenido de rúbricas ya usadas desde SQL y API; permitir únicamente retirar de futuros usos una versión ya usada.
- El actor debe configurarse por transacción para que una conexión reutilizada no atribuya el siguiente cambio al actor anterior; probar dos escrituras consecutivas con actores distintos.
- Ocultar una calificación no debe convertirla en cero ni cambiar resultados cerrados; probar completitud y consolidación.

---

### Task 1: PostgreSQL — retención, visibilidad y auditoría

**Archivos:**
- Crear: `backend/fixtures/s4-retencion-visibilidad-auditoria.sql`
- Crear: `backend/fixtures/verificar-retencion-visibilidad-auditoria.sql`

**Interfaces:**
- Contrato SQL: cada fila operativa visible tiene `estado_registro` 1 o 0; la tabla de eventos será `s4.eventos_cambio_registro`.
- Contrato del evento: fecha/hora, actor, rol de base de datos, contexto de aplicación/correlación, esquema/tabla, clave primaria JSON, operación y valores JSON anteriores/nuevos de los campos modificados.
- Las instantáneas de auditoría excluirán el binario `actas_archivadas.pdf` y conservarán sus metadatos SHA-256 existentes.

- [x] **Paso 1: Escribir el script SQL de verificación**

  Agregar comprobaciones que validen la base `genares_integrado_dev`, valores 0/1, rechazo de valores inválidos, rechazo de `DELETE` y `TRUNCATE`, evento con actor/fecha/antes/después, inmutabilidad de la tabla de auditoría, protección de evaluaciones cerradas y protección de rúbricas usadas. Las verificaciones con cambios se ejecutarán dentro de una transacción y terminarán con `ROLLBACK`.

- [ ] **Paso 2: Confirmar el estado RED con una consulta de solo lectura**

  Ejecutar una consulta equivalente a `SELECT estado_registro FROM s4.rubricas LIMIT 0` con el rol local `genares`.  
  Resultado esperado antes del SQL: PostgreSQL responde `42703` porque aún no existe la columna; la consulta no cambia filas ni imprime credenciales.

- [x] **Paso 3: Implementar el SQL aditivo e idempotente**

  Agregar `estado_registro` a `rubricas`, `versiones_rubrica`, `etapas_rubrica`, `categorias_rubrica`, `indicadores_rubrica`, `versiones_rubrica_carreras`, `vigencias_rubrica_carrera`, `procesos_evaluacion`, `evaluaciones`, `calificaciones_evaluacion`, `programaciones_sustentacion`, `programacion_estudiante`, `actas_archivadas` y `notificaciones`. Agregar metadatos de última modificación donde falten, preservar los valores existentes y no inventar el actor de filas históricas.

  Crear `s4.eventos_cambio_registro`, disparadores de auditoría de inserción/actualización y metadatos, protecciones append-only para auditorías/historiales y rechazo de `DELETE`/`TRUNCATE` para todas las tablas S4 actuales. Añadir disparadores que impidan modificar evaluaciones cerradas y la estructura/contenido de rúbricas ya usadas por un proceso; conservar transiciones existentes del ciclo de vida de versión, como `ACTIVA` a `ARCHIVADA`, y permitir poner `estado_registro=0` a una versión usada sin cambiar su contenido ni sus procesos. Fijar `search_path` de las funciones, revocar permisos de borrado al rol de aplicación y conceder solo los accesos requeridos.

- [x] **Paso 4: Aplicar el SQL a la base de desarrollo autorizada**

  Ejecutar el fixture únicamente en `genares_integrado_dev` local; usar pgAdmin como propietario del esquema si el rol de aplicación no puede modificar S4. No ejecutar migraciones históricas.

- [x] **Paso 5: Ejecutar la verificación de base de datos como propietario**

  Abrir `backend/fixtures/verificar-retencion-visibilidad-auditoria.sql` en pgAdmin conectado como `postgres` a `genares_integrado_dev`.  
  Resultado esperado: todas las comprobaciones pasan y la transacción se revierte limpiamente. Aplicar una segunda vez el SQL aditivo y repetir la verificación para comprobar idempotencia.

---

### Task 2: NestJS — estado y actor

**Archivos:**
- Crear: `backend/src/modules/s4-calificaciones/auditoria/auditoria.controller.ts`
- Crear: `backend/src/modules/s4-calificaciones/auditoria/auditoria.service.ts`
- Crear: `backend/src/modules/s4-calificaciones/auditoria/auditoria.module.ts`
- Crear: pruebas unitarias/de integración S4 de auditoría y estado junto a los módulos afectados.
- Modificar: `backend/src/modules/s4-calificaciones/s4-calificaciones.module.ts`.
- Modificar: entidades/servicios S4 de rúbricas, evaluaciones, trabajos/trazabilidad, programación y documentos que lean o escriban las tablas indicadas.

**Interfaces:**
- Ayudante de contexto de base por solicitud: `establecerActorAuditoria(manager, actorId)` establece `s4.actor_id` y el ID de correlación con `set_config(..., true)`, limitado a la transacción.
- API de auditoría: `GET /api/v1/auditoria/cambios` con paginación acotada y filtros opcionales por tabla/registro; exige la capacidad existente `configuracion-academica:administrar`.
- Las respuestas S4 exponen `estadoRegistro: 0 | 1`; el `estado` académico existente no cambia.

- [x] **Paso 1: Escribir pruebas fallidas de filtro de estado, aislamiento de actor y consulta de auditoría**

  Cubrir `estadoRegistro=1` por defecto en altas nuevas, exclusión de filas con estado 0 de listas/detalles, conservación del estado académico de texto, asignación de actor por transacción y autorización del endpoint de auditoría.

- [x] **Paso 2: Ejecutar pruebas enfocadas y confirmar los fallos esperados**

  Ejecutar las nuevas pruebas S4 de auditoría/estado.  
  Resultado esperado: fallan porque todavía no existen el filtro, el contexto transaccional o la consulta de auditoría.

- [x] **Paso 3: Implementar el comportamiento de API**

  Filtrar filas con estado 0 en consultas de rúbricas/catálogos/versiones, procesos de trabajo, evaluaciones/resultados, cronograma/participantes y documentos archivados. Mantener visibles trabajos de S2 no asignados a un proceso S4. Pasar el actor dentro de cada transacción de escritura. Reemplazar el borrado y recreación de etapas borrador de `RubricasService` por actualizaciones y `estado_registro=0` para las filas retiradas. Agregar el endpoint paginado y protegido de auditoría; no devolver bytes PDF en los eventos.

- [x] **Paso 4: Ejecutar pruebas enfocadas y la suite completa del backend**

  Ejecutar: `npm --prefix ./backend test -- --runInBand`  
  Resultado esperado: pasan todas las pruebas del backend; las protecciones de evaluación cerrada/rúbrica usada coinciden con los disparadores de PostgreSQL.

---

### Task 3: Frontend S4 — ocultar estado 0 y mostrar estado 1

**Archivos:**
- Crear: `frontend/src/modules/s4-calificaciones/domain/estadoRegistro.js` y su prueba.
- Crear: `frontend/src/modules/s4-calificaciones/presentation/services/auditoriaApi.js` y su prueba.
- Modificar: adaptadores HTTP S4 bajo `frontend/src/modules/s4-calificaciones/infrastructure/repositories/`.
- Modificar: `PaginaTrabajosApi.jsx`, `PaginaRubricas.jsx`, `PaginaMisEvaluaciones.jsx`, `PaginaCronograma.jsx`, `SeguimientoApi.jsx` y la navegación/layout S4 existente donde se muestre el historial de auditoría.

**Interfaces:**
- `esRegistroVisible(registro)` acepta solo estado numérico 1 o un campo ausente heredado; el 0 se oculta y un valor inválido se rechaza de forma segura.
- Las filas visibles muestran `Estado: 1`; las ocultas no se renderizan en listas, detalles, selectores, cronograma ni documentos.
- El servicio de auditoría consulta `GET /auditoria/cambios` protegido y presenta los metadatos de eventos sin volver a mostrar la fila oculta en vistas operativas.

- [x] **Paso 1: Escribir pruebas frontend fallidas para visibilidad numérica y presentación**

  Cubrir filtrado de estado 0, presentación de estado 1, rechazo seguro de estados desconocidos y conservación de etiquetas académicas como `BORRADOR` y `CERRADA`.

- [x] **Paso 2: Ejecutar las pruebas frontend enfocadas y confirmar que fallan**

  Ejecutar las nuevas pruebas de `estadoRegistro` y del servicio/página.  
  Resultado esperado: fallan porque las respuestas aceptan filas de estado 0 y no presentan `Estado: 1`.

- [x] **Paso 3: Implementar filtrado de adaptadores, presentación e historial**

  Filtrar las respuestas en adaptadores S4 como defensa adicional, mostrar el estado numérico separado del estado académico y agregar la sección de auditoría a la pantalla existente de consulta/historial para usuarios autorizados. Conservar formularios, cálculos y navegación ya aprobados.

- [x] **Paso 4: Ejecutar pruebas enfocadas y suite frontend completa**

  Ejecutar: `npm --prefix ./frontend run test`  
  Resultado esperado: pasan todas las pruebas frontend, incluidas las actuales de formulario, rutas, diseño adaptable y evaluaciones.

---

### Task 4: Verificación integrada

**Archivos:**
- Modificar: `docs/s4/decisiones/2026-11-10-retencion-visibilidad-auditoria.md` solo si la implementación requiere registrar una decisión.
- Crear: instrucciones locales breves junto al fixture SQL si se necesita aplicarlo con un propietario de base de datos.

- [x] **Paso 1: Confirmar el destino y conservar los registros de prueba**

  Consultar únicamente el nombre de la base, el rol actual, las filas S4 de prueba y los nuevos objetos de estado/auditoría. Confirmar `DB_NAME=genares_integrado_dev`, host loopback y que los ejemplos DEV continúan presentes. No imprimir credenciales ni modificar S1–S3.

- [x] **Paso 2: Ejecutar la verificación SQL y las compilaciones existentes**

  Ejecutar: `npm --prefix ./backend run build`  
  Ejecutar: `npm --prefix ./frontend run build`  
  Resultado esperado: verificación y ambas compilaciones terminan correctamente; los registros DEV siguen presentes y una fila con estado 0 no aparece en respuestas/API ni interfaz normal.

- [ ] **Paso 3: Revisar el diff e informar los resultados exactos**

  Confirmar que solo cambió el proyecto en la rama/worktree existente, que no se creó commit ni se hizo push, que no se ejecutaron migraciones antiguas y que no cambió esquema/datos de S1–S3. Informar archivos, compilaciones/pruebas realmente ejecutadas y la limitación de autenticación que siga pendiente.

## Autorrevisión

- Cobertura del diseño: estado 0/1, ausencia de borrado físico, actor/fecha, auditoría inmutable, protección SQL directo, evaluación cerrada/rúbrica usada, filtros API/frontend, consulta de auditoría y verificación PostgreSQL local están asignados a las tareas 1–4.
- Interfaces compartidas: SQL de estado/eventos y contexto transaccional son consumidos por NestJS; `estadoRegistro` y la API de auditoría son consumidos por React.
- Los riesgos del enfoque de revisión se prueban en la tarea 1 (base), tarea 2 (API) y tarea 3 (frontend).
- El plan no incluye cambios a S1/S2/S3, puntos globales de entrada, Docker, migraciones antiguas, commits ni pushes.
