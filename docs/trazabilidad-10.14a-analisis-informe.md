# 10.14A — Análisis de trazabilidad académica de GENARES

Fecha: 24 de octubre de 2026

## Alcance y restricciones

Este documento es exclusivamente analítico. Se revisaron las entidades, migraciones, servicios, controladores y superficies frontend actuales. No se modificaron código, contratos API, migraciones, bases de datos ni datos.

No se accedió a 8E ni al puerto 5432. PostgreSQL 10.9B no se modificó; la propuesta debe validarse posteriormente con las pruebas protegidas correspondientes.

## Resumen ejecutivo

GENARES no perdió una funcionalidad de trazabilidad existente. Actualmente tiene tres capacidades distintas:

1. **Estado actual:** campos como `estado`, relaciones activas y fechas de última modificación.
2. **Evidencia temporal parcial:** fechas y responsables guardados en entidades operativas.
3. **Auditorías específicas:** eventos append-only para evaluaciones y rúbricas.

No existe todavía una bitácora transversal que reúna todos los eventos de un trabajo, preserve cada transición y exponga una línea histórica desde `/trabajos/:idTrabajo`.

La vista de prototipo ya muestra un panel «Trazabilidad disponible / Historial registrado», pero construye sus eventos a partir de fechas del estado local. La vista API de detalle de trabajo muestra relaciones y estados actuales, pero no consulta una colección de eventos históricos.

## Inventario de persistencia existente

### Trabajo y relaciones académicas

`trabajos_titulacion` conserva:

- `created_by_id_cuenta`.
- `creado_en`.
- `actualizado_en`.
- Estado actual del trabajo.
- Versión de rúbrica fijada.

Esto permite evidenciar la creación del expediente, su responsable de creación, fecha de creación y última actualización. `actualizado_en` no identifica qué cambio ocurrió ni quién lo produjo; no debe convertirse en un evento histórico específico.

`asignaciones_tutor_trabajo` conserva la relación tutor-trabajo, el responsable de asignación y fechas operativas según el esquema actual. Permite reconstruir asignaciones que todavía existen y algunas finalizadas, pero no necesariamente cada transición o motivo.

`estudiantes_trabajo` permite conocer la composición persistida del trabajo y el orden de autoría actual. No constituye por sí sola una historia de altas, bajas o cambios de orden si no conserva versiones temporales.

### Tribunal

`asignaciones_tribunal` conserva:

- Trabajo asociado.
- Estado actual de la asignación (`BORRADOR` o `CONFIRMADO` y estados definidos por dominio).
- `assigned_by_id_cuenta`.
- `creado_en`.
- `confirmada_en`.

`miembros_tribunal` conserva los miembros y posiciones de una asignación. Se puede mostrar la creación de una asignación, su responsable de asignación y la confirmación cuando `confirmada_en` existe. No hay una tabla general que registre quién ejecutó específicamente cada transición de estado ni todas las propuestas anteriores eliminadas o reemplazadas.

### Evaluaciones y traspasos

`evaluaciones` conserva:

- Trabajo, etapa, miembro del tribunal y, cuando corresponde, estudiante.
- Estado actual.
- Revisión.
- Calificación y máximo congelados.
- Instantánea de rúbrica.
- `creado_en`, `actualizado_en` y `cerrada_en`.

`eventos_auditoria_evaluacion` es un registro append-only con:

- Evaluación de origen.
- `actor_id`.
- `accion`.
- `detalles` JSONB.
- `correlation_id`.
- `ocurrido_en`.

El servicio registra al menos la creación, el registro de puntajes y el cierre de una evaluación. Esta es la evidencia histórica más completa del dominio evaluativo, aunque está anclada a la evaluación y no directamente al trabajo.

`traspasos_evaluacion_estudiante` conserva el estudiante receptor y `traspasado_en`, además de la evaluación y trabajo de origen. Evidencia que el traspaso ocurrió y cuándo, pero no conserva un responsable explícito ni un origen técnico adicional.

### Sustentación

`programaciones_sustentacion` conserva:

- Programación, fecha, hora, sala y duración.
- Estado actual.
- `inicio_real_en` y `finalizacion_real_en`.
- `scheduled_by_id_cuenta` y `scheduled_by_actor_id`.
- `creado_en` y `actualizado_en`.

Esto permite mostrar programación creada, responsable/origen de creación, inicio real y finalización real cuando están presentes. Las transiciones de estado actualizan la misma fila; no existe un historial de cambios de estado con actor y fecha por transición. Una modificación de fecha, hora o sala queda reemplazada por el último valor y no es reconstruible como secuencia completa.

### Documentos y actas

`actas_archivadas` es inmutable y conserva:

- Número y formato.
- Trabajo y estudiante.
- `generado_en`.
- `generado_por`.
- Revisión, hash SHA-256 y PDF.
- Nota final, umbral aplicado y resultado almacenado.

Esto permite evidenciar la generación y archivado de un acta concreta, su responsable/origen textual y el contenido verificable por hash. No demuestra intentos fallidos, vistas previas, descargas ni cambios de configuración que no hayan dejado otro registro.

### Rúbricas y catálogos

`auditoria_rubricas` es append-only y conserva actor, acción, rúbrica/versión relacionada, referencias de carrera/modalidad/período, fecha y correlación. Es útil para la historia de la rúbrica fijada al trabajo, pero no es una auditoría general del expediente.

La auditoría de rúbricas no debe mezclarse con la historia del trabajo sin conservar el tipo y origen del evento.

## Seguimiento actual frente a trazabilidad histórica

| Concepto | Qué responde | Fuentes actuales | Limitación |
|---|---|---|---|
| Estado actual | ¿En qué estado está ahora? | `estado` en trabajo, evaluación, tribunal y programación | No muestra estados anteriores |
| Última modificación | ¿Cuándo cambió la fila por última vez? | `actualizado_en` | No identifica evento, actor ni valores anteriores |
| Evidencia de creación | ¿Cuándo y por quién se creó? | `creado_en`, `created_by_id_cuenta`, campos `scheduled_by_*` | Solo aplica a entidades con esos campos |
| Auditoría evaluativa | ¿Qué acciones se registraron sobre la evaluación? | `eventos_auditoria_evaluacion` | Está centrada en evaluación; algunos detalles dependen del JSONB |
| Auditoría de rúbrica | ¿Qué cambios de rúbrica/catálogo se registraron? | `auditoria_rubricas` | No es una línea del expediente |
| Línea histórica del trabajo | ¿Qué ocurrió en orden y con qué responsable? | No existe una tabla transversal | Requiere nuevo registro o una proyección explícita |

Un estado actual no debe presentarse como si fuera una secuencia histórica. Por ejemplo, `CONFIRMADO` prueba el estado consultado; `confirmada_en` aporta una fecha, pero no reemplaza una auditoría de propuestas y transiciones.

## Eventos reconstruibles con la evidencia actual

Los siguientes eventos pueden mostrarse con una marca de evidencia y sin inventar datos:

| Evento propuesto | Evidencia | Responsable | Origen | Calidad |
|---|---|---|---|---|
| Trabajo registrado | `trabajos_titulacion.creado_en` | `created_by_id_cuenta` | Tabla de trabajos | Directa |
| Tribunal creado/asignado | `asignaciones_tribunal.creado_en`, `assigned_by_id_cuenta` | Cuenta asignadora | Asignación de tribunal | Directa para esa fila |
| Tribunal confirmado | `confirmada_en` y estado confirmado | No necesariamente disponible como actor de transición | Asignación de tribunal | Parcial |
| Tutor asignado/finalizado | Asignación existente y sus fechas/responsable | `assigned_by_id_cuenta` si existe | Asignación de tutor | Directa para filas conservadas |
| Evaluación creada | `EVALUACION_CREADA` | `actor_id` | Auditoría de evaluación | Directa |
| Puntajes registrados | `PUNTAJES_EVALUACION_REGISTRADOS` | `actor_id` | Auditoría de evaluación | Directa |
| Evaluación cerrada | `EVALUACION_CERRADA`, `cerrada_en` | `actor_id` | Auditoría de evaluación | Directa |
| Traspaso de evaluación | `traspasos_evaluacion_estudiante.traspasado_en` | No conservado | Tabla de traspasos | Directa en fecha, parcial en responsable |
| Sustentación creada | `creado_en`, campos `scheduled_by_*` | Cuenta/actor de programación | Programación | Directa |
| Sustentación iniciada | `inicio_real_en` y estado actual compatible | No hay actor de transición | Programación | Directa en fecha, parcial en responsable |
| Sustentación finalizada | `finalizacion_real_en` y estado actual compatible | No hay actor de transición | Programación | Directa en fecha, parcial en responsable |
| Acta archivada | `generado_en`, `generado_por`, hash y número | `generado_por` | Acta inmutable | Directa |

Para eventos reconstruidos desde una fila actual se debe indicar `origen = persistido` y `evidencia = directa` o `parcial`; nunca rellenar responsable, fecha o actor con el usuario de la consulta.

## Eventos que requieren auditoría nueva

Se requiere un registro nuevo para afirmar históricamente:

- Cada cambio de estado del trabajo.
- Altas, bajas y reordenamientos de estudiantes.
- Todas las versiones de tutoría, incluidos cambios y motivos.
- Cada transición de asignación de tribunal y el actor de confirmación/retiro.
- Cambios de fecha, hora, sala o duración de una programación.
- Actor y correlación de inicio, finalización o cancelación de una sustentación.
- Borradores, modificaciones de puntajes y conflictos rechazados, si se desea una historia completa y no solo acciones aceptadas.
- Consultas, descargas, impresiones o visualizaciones de documentos, si la política institucional las considera auditables.
- Cambios de configuración de nota mínima, con valor anterior y nuevo.
- Generación de documentos preliminares y reimpresiones, diferenciadas del acta archivada.

Los eventos no observados en las tablas actuales deben aparecer como «no disponible» o no aparecer. No se debe deducir que una transición ocurrió solo porque el estado final la hace posible.

## Modelo de datos propuesto

Se propone una tabla append-only específica para el expediente, sin reemplazar las auditorías especializadas:

```text
eventos_trazabilidad_trabajo
-----------------------------
id uuid primary key
id_trabajo uuid not null references trabajos_titulacion(id)
ocurrido_en timestamptz not null
tipo_evento varchar(80) not null
entidad_tipo varchar(60) null
entidad_id uuid null
actor_id varchar(255) null
actor_tipo varchar(40) null
origen varchar(40) not null
correlation_id varchar(100) null
detalles jsonb not null default '{}'
evidencia varchar(20) not null
creado_en timestamptz not null default clock_timestamp()
```

### Reglas del modelo

- Append-only: no `UPDATE`, `DELETE` ni `TRUNCATE` para eventos históricos.
- `id_trabajo` es obligatorio para poder consultar una línea por expediente.
- `ocurrido_en` representa el momento del evento, no la fecha de consulta.
- `actor_id` puede ser nulo cuando la evidencia existente no lo conserva.
- `origen` distingue, por ejemplo, `TRABAJO`, `TRIBUNAL`, `EVALUACION`, `TRASPASO`, `PROGRAMACION`, `DOCUMENTO`, `RUBRICA` y `RECONSTRUCCION`.
- `evidencia` distingue `DIRECTA`, `PARCIAL` y, si se requiere, `RECONSTRUIDA`; «reconstruida» debe reservarse para una transformación documentada de datos existentes, no para una inferencia.
- `detalles` debe contener únicamente datos no sensibles necesarios para explicar el evento y debe tener un esquema por `tipo_evento`.
- Una correlación permite unir las acciones de una operación distribuida sin convertirla en un actor.
- Las auditorías existentes pueden proyectarse en esta tabla o consultarse mediante un adaptador, pero no deben duplicarse sin una política de unicidad y origen.

## Endpoints necesarios

### Lectura propuesta

```http
GET /api/v1/trabajos/:trabajoId/trazabilidad
```

Respuesta conceptual:

```json
{
  "trabajoId": "uuid",
  "elementos": [
    {
      "id": "uuid",
      "ocurridoEn": "2026-10-24T15:30:00.000Z",
      "tipo": "EVALUACION_CERRADA",
      "etiqueta": "Evaluación cerrada",
      "actor": { "disponible": true, "id": "..." },
      "origen": "EVALUACION",
      "evidencia": "DIRECTA",
      "entidad": { "tipo": "evaluacion", "id": "..." },
      "detalles": {}
    }
  ],
  "metadatos": {
    "completa": false,
    "nota": "Algunos eventos históricos no están disponibles en las tablas existentes."
  }
}
```

Contrato recomendado:

- Orden descendente por `ocurridoEn`, con `id` como desempate estable.
- Paginación por cursor para expedientes grandes.
- Filtros opcionales por `tipo`, `origen`, intervalo temporal y `evidencia`.
- `404` si el trabajo no existe y `403` si la identidad no puede consultar el expediente.
- No devolver eventos de otro trabajo por correlación compartida.
- No exponer secretos, PDF, detalles de puntajes innecesarios ni identificadores internos que no sean parte de la política de lectura.

### Escritura interna

No se recomienda exponer un `POST` público para que el frontend registre auditoría. Los servicios de dominio deben registrar eventos dentro de la misma transacción que la operación aceptada. Las operaciones rechazadas pueden registrarse en una auditoría de seguridad separada si la política lo exige, sin mezclarlas con eventos académicos confirmados.

## Presentación en `/trabajos/:idTrabajo`

La sección debe aparecer tanto para trabajos activos como completados:

1. Encabezado «Trazabilidad del expediente».
2. Insignia de cobertura:
   - «Historial completo» solo si el backend lo garantiza.
   - «Historial parcial» cuando faltan eventos por limitaciones históricas.
3. Línea temporal ordenada por `ocurridoEn`.
4. Cada elemento muestra:
   - Fecha y hora con zona local.
   - Evento legible.
   - Responsable solo cuando está disponible.
   - Origen: evaluación, tribunal, programación, documento, etc.
   - Indicador de evidencia directa o parcial.
   - Enlace a la entidad relacionada si el contrato lo permite.
5. Para eventos ausentes no se deben crear filas ficticias. Debe mostrarse una nota clara: «No existe evidencia histórica persistida para este intervalo».
6. En un trabajo completado, la línea permanece disponible en modo solo lectura y se separa visualmente del estado actual y de la consulta de resultados.

En modo prototipo, el panel actual puede conservarse, pero debe distinguir explícitamente «historial derivado de fechas del prototipo» de una auditoría institucional. En modo API no debe reutilizar eventos locales ni presentar una lista sintética.

## Impacto y fases de implementación

### Fase 10.14B — Contrato y migración

- Acordar catálogo de `tipo_evento`, `origen` y niveles de evidencia.
- Crear la tabla append-only y sus restricciones.
- Definir actor institucional, actor técnico y acceso local.
- Añadir índices por trabajo/fecha y tipo/fecha.
- Establecer retención, privacidad y política de lectura.

### Fase 10.14C — Registro transaccional

- Registrar creación/cambios de trabajo, tribunal, tutoría y programación.
- Integrar evaluaciones y traspasos con deduplicación respecto a auditorías existentes.
- Registrar documentos y cambios de configuración cuando corresponda.
- Mantener correlación y actor desde la capa de identidad.
- Probar atomicidad: operación aceptada y evento aceptado, o ninguno.

### Fase 10.14D — Consulta API

- Implementar `GET /api/v1/trabajos/:trabajoId/trazabilidad`.
- Aplicar las mismas capacidades y alcance que la consulta del trabajo.
- Devolver cobertura y limitaciones explícitas.
- Añadir pruebas unitarias, integración y protección de acceso.

### Fase 10.14E — Frontend

- Añadir la línea temporal al detalle API de trabajo.
- Conservar el panel de prototipo con su etiqueta de origen.
- Añadir estados de carga, vacío parcial, error y solo lectura.
- Verificar teclado, foco, orden temporal, responsive y trabajos completados.

### Fase 10.14F — Backfill controlado

- Generar únicamente eventos cuya fecha, actor y relación tengan evidencia directa.
- Marcar como `RECONSTRUCCION` los eventos derivados de filas existentes.
- No inventar transiciones intermedias, responsables ni fechas.
- Mantener un informe de cobertura por trabajo y una estrategia de rollback que no borre auditoría.

## Riesgos y decisiones pendientes

- Definir si «consulta» o «visualización de PDF» es un evento académico o solo de seguridad.
- Resolver la identidad del actor para operaciones locales `GENARES:LOCAL_DEVELOPMENT`.
- Evitar duplicar `eventos_auditoria_evaluacion` y `auditoria_rubricas`.
- Establecer qué detalles pueden mostrarse a estudiantes, docentes, secretaría y coordinación.
- Decidir si los eventos rechazados se conservan en una auditoría técnica distinta.
- Definir zona horaria de presentación y precisión mínima.
- Acordar retención, exportación y corrección de datos personales.

## Conclusión

GENARES conserva evidencia suficiente para mostrar una trazabilidad parcial y verificable de evaluaciones, algunas asignaciones, programación y actas. No conserva suficiente información para reconstruir una historia completa de todos los cambios del expediente.

La solución segura es una bitácora append-only transversal, registrada dentro de las transacciones de dominio y expuesta mediante un endpoint de solo lectura con cobertura explícita. Hasta que exista ese contrato y su persistencia, la UI debe mostrar solo eventos respaldados por datos existentes y declarar claramente cualquier limitación histórica.
