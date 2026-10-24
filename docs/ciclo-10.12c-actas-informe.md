# 10.12C — Validación de actas, numeración y archivo documental

Fecha: 24 de octubre de 2026

## Resultado

Se verificó en PostgreSQL 9D desechable el ciclo **consolidación completa → emisión → numeración → archivo del PDF → recuperación del mismo archivo**. Se reutilizó el expediente sintético integrado de 10.12B, con dos estudiantes, tutor, tribunal de dos miembros y rúbrica dinámica de Escrita compartida y Oral individual. Los resultados archivados para los dos estudiantes fueron 9.00 y 9.25 sobre 10. No se cambiaron las reglas documentales ni se agregó un endpoint o migración.

Las verificaciones HTTP se ejecutaron dentro de la suite NestJS/PostgreSQL protegida. La interfaz de Documentos, Secretaría y Consulta se comprobó mediante pruebas frontend; no se conectó un navegador en vivo a PostgreSQL 9D.

## Contratos y reglas existentes

La API existente ofrece:

- `POST /api/v1/documentos/trabajos/:trabajoId/estudiantes/:estudianteId/actas` para emitir.
- `GET /api/v1/documentos/actas` y `GET /api/v1/documentos/actas/:id` para consultar archivo y metadatos.
- `GET /api/v1/documentos/actas/:id/pdf` para recuperar el PDF archivado.

La emisión requiere las capacidades existentes de lectura de evaluaciones y emisión de documentos. El servicio obtiene el resultado final de `EvaluacionesService`; no acepta una calificación enviada por el cliente ni vuelve a calcularla en React. Rechaza con conflicto la falta de una rúbrica dinámica utilizable, evaluadores confirmados requeridos, datos de identificación o consolidación completa. Los evaluadores pendientes, evaluaciones sin cerrar y casos legacy sin consolidación dinámica no producen un acta numerada.

La elegibilidad verifica que el estudiante pertenezca al trabajo, que el período cumpla `AAAA-1`/`AAAA-2`, que la carrera tenga código TI o SOFT, y que exista resultado completo sobre 10.00. Una programación de sustentación no aparece como requisito de `pendientesActa`: el ciclo aislado confirmó que la emisión puede completarse con un trabajo sin programación. El fixture sin programación sí tenía tutor; no se probó la emisión sin tutor y el módulo no incorpora un requisito nuevo al respecto.

La numeración es `NNN-AAAA-P-CARRERA`, con un consecutivo por carrera y período que comparten los formatos PAT-01-F-019 y PAT-04-F-017. El contador se incrementa transaccionalmente mediante `UPSERT`; los registros archivan carrera, período, consecutivo y número, con restricciones de unicidad. La repetición para el mismo estudiante, trabajo y formato devuelve el documento existente y no consume otro número.

El archivo almacena bytes PDF en `bytea`, SHA-256, formato/revisión, fecha y actor emisor, junto con snapshots de calificación final, umbral aplicado y decisión. Restricciones y triggers SQL impiden actualizar, borrar o truncar actas archivadas. El PDF recuperado se lee del archivo: la consulta no lo regenera. El registro inmutable y sus campos `generado_por`/`generado_en` son la evidencia de emisión disponible; no hay una tabla aparte de eventos de emisión de actas.

## Casos de emisión y elegibilidad

El ciclo 10.12B se completó por HTTP con los resultados 9.00 y 9.25. Antes de completarlo se intentó emitir con evaluaciones ausentes y con cierres obligatorios pendientes; ambas peticiones fueron rechazadas y no generaron actas. También se verificaron las respuestas de rechazo para identificadores malformados (400), trabajo inexistente (404), estudiante ajeno (404), formato no admitido (400), tribunal no confirmado (409) y trabajo sin versión de rúbrica (409). Las operaciones rechazadas no adelantaron el consecutivo SOFT/2026-2.

Se agregó un expediente sintético completo adicional de SOFT/2026-2, con tutor y tribunal confirmados, pero sin programación. Tres emisiones concurrentes cubrieron dos estudiantes del expediente 10.12B y un estudiante del expediente adicional, para el mismo período/carrera. Las respuestas fueron HTTP 201 y los tres números únicos fueron:

- `001-2026-2-SOFT`
- `002-2026-2-SOFT`
- `003-2026-2-SOFT`

Los números se asignan conforme al orden que serializa la base; las pruebas comparan el conjunto y verifican la relación de cada número con su documento sin presuponer qué solicitud concurrente gana primero. Se repitieron simultáneamente dos solicitudes de la misma acta: ambas devolvieron el mismo ID y número, indicaron reimpresión y mantuvieron el contador en 3. Las pruebas de archivo existentes también verifican que la secuencia se separa por carrera/período y que los dos formatos comparten el ámbito.

## PDF, archivo, auditoría e integridad

Para cada acta emitida se consultaron los metadatos y el PDF por HTTP. Se comprobó el encabezado `%PDF-`, el tipo `application/pdf`, `Cache-Control: no-store`, igualdad exacta entre los bytes servidos y el `bytea`, y coincidencia del SHA-256 almacenado. La extracción de texto del PDF validó número, trabajo, estudiante e identificación, carrera, modalidad, tutor, tribunal, nota final, etapas y espacios de firma. El PDF refleja el resultado del servidor y no añade notas.

Antes y después de emitir/reintentar/leer se compararon la versión de rúbrica, el estado del trabajo, tribunal confirmado, programaciones, evaluaciones, puntajes, traspasos, eventos de auditoría de evaluaciones y consolidaciones. Permanecieron iguales. La lectura y la emisión no alteraron notas ni estados académicos, ni añadieron eventos a la auditoría de evaluaciones. Cada acta conserva su actor, fecha de generación y hash en el archivo inmutable.

**Limitación de formato:** la plantilla interna actual incluye la fecha de generación en los metadatos del archivo, pero no presenta una fecha de emisión visible en el texto del PDF. No se alteró la plantilla en esta etapa, porque es una adaptación documental interna y añadir campos institucionales requiere validación. Sus rótulos de firma se conservan en blanco; no se incorporó firma electrónica, aprobación u oficialización.

## Recorrido desde React

Documentos ya consulta `GET /actas`, permite filtrar por estudiante/carrera/período y abre el archivo por `GET /actas/:id/pdf`. Secretaría y Consulta incluyen enlaces a Documentos; el expediente también conserva su enlace al módulo. Se añadieron pruebas frontend para los enlaces desde Secretaría/Consulta y para consultar el listado de actas y recuperar el PDF por ID con `no-store`.

No se abrió un navegador contra 9D. La protección del arranque local de NestJS limita la aplicación de desarrollo a la base 10.9B verificada; no se debilitó esa protección ni se usó la base persistente para emitir. La integración HTTP se probó con NestJS iniciado dentro de la suite contra cada base temporal 9D. Por ello la disponibilidad funcional queda verificada por HTTP y pruebas de interfaz/servicio, pero no por inspección visual de una sesión React conectada a ese fixture. La prueba del PDF verificó estructura, bytes y texto extraído (incluidas firmas); no evaluó visualmente la diagramación ni abrió el diálogo de impresión.

## Cambios y migraciones

- `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts`: pruebas de elegibilidad, emisión concurrente en carrera/período, contenido PDF, hash, reintento, archivo inmutable y no mutación de datos académicos; el helper extrae texto del PDF para contrastar las identidades archivadas.
- `prototipo-titulacion/src/paginas/SeguimientoApi.test.jsx`: verifica los destinos de Documentos desde Secretaría y Consulta.
- `prototipo-titulacion/src/servicios/documentosApi.test.js`: prueba la consulta de actas archivadas y la recuperación del PDF.
- Este informe.

No se modificaron servicios de emisión, controladores, plantillas, entidades, contratos API ni datos académicos. No se necesitó una migración nueva. La migración `1760000012000-archivo-actas.ts` es parte del esquema documental ya existente y solo fue ejecutada por el runner dentro de bases 9D temporales desechables.

## Validaciones ejecutadas

- Backend unitario con el runner protegido: **17 suites y 91 pruebas aprobadas**.
- PostgreSQL 9D protegido: **4 suites y 43 pruebas aprobadas**: Carreras (4), Vigencias (1), Rúbricas (21), Evaluaciones/Documentos/Programaciones (17). Las llamadas HTTP de emisión y recuperación usaron la aplicación NestJS de prueba conectada a una base temporal de esa suite.
- Pruebas frontend Vitest: **48 archivos y 224 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado, **1680 módulos transformados**.
- `git diff --check`: código de salida 0. Git emitió solo avisos de normalización LF/CRLF.

Se ejecutó el runner `backend/scripts/pruebas-postgres-9d.ps1 -PreservarBasesPrueba`. Verificó el clúster desechable `127.0.0.1:55441` y las marcas de las bases. Todas las bases temporales de las ejecuciones 9D de esta etapa se conservaron, incluidas la base de diagnóstico de una primera aserción fallida: `genares_9d_test_f18c12ed`, `genares_9d_test_8271d11a`, `genares_9d_test_eb62e1d3`, `genares_9d_test_e35620d9`, `genares_9d_test_b1b62a06`, `genares_9d_test_554cc33c`, `genares_9d_test_1c82bd02` y `genares_9d_test_b01001df`. La ejecución final pasó; las fallas anteriores fueron una sintaxis de prueba corregida y una comparación textual sensible al salto de línea del PDF, corregida normalizando separadores al verificar nombres.

No se consultó ni modificó la base local 10.9B (55442), PostgreSQL 8E (55440) ni el puerto 5432. No se ejecutaron escrituras o migraciones fuera de las bases 9D desechables. No se hicieron commits ni push.

## Pendientes para 10.12D

1. Validar con la Universidad si el formato interno debe mostrar fecha visible y confirmar la plantilla institucional final antes de modificarla.
2. Confirmar si la ausencia de tutor o programación debe impedir la emisión; la conducta probada actual no exige programación y no se probó un expediente sin tutor.
3. Definir si la auditoría institucional requiere un evento de emisión separado del registro inmutable con emisor, fecha y hash.
4. Si se necesita validación visual con datos sintéticos, habilitar un canal de navegador aislado que no relaje las protecciones del arranque local ni use bases persistentes.

Se detiene aquí la etapa 10.12C.
