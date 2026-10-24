# 10.11C — Unificación de impresión de rúbricas con la API

Fecha: 24 de octubre de 2026

## Resultado

En el modo integrado, las acciones de rúbrica de Trabajos, Evaluaciones y Resultados terminan en la pantalla común de Documentos, que carga el PDF generado por NestJS desde PostgreSQL. La ruta antigua `/rubrica/:idTrabajo/:idEstudiante/:idMiembro` conserva compatibilidad: redirige a Documentos con los tres identificadores originales y mantiene la solicitud de impresión automática cuando el enlace la contiene.

El recorrido local de impresión sigue disponible únicamente cuando la fuente de Evaluaciones está configurada como prototipo. Si la fuente es API pero Documentos no está habilitado, o si la ruta trae IDs ficticios/malformados, no se usa `localStorage` para producir un documento institucional aparente.

## Auditoría de los recorridos

| Recorrido | Antes | Estado en 10.11C |
|---|---|---|
| `/rubrica/:trabajo/:estudiante/:miembro` | `PaginaImpresionRubrica` leía el contexto local, las evaluaciones y la rúbrica del prototipo, y construía una vista imprimible en React. | En modo API valida los UUID y delega en `/documentos` con trabajo, estudiante y miembro exactos. En `dev:web` conserva el documento local separado. |
| Expediente de Trabajo | La vista integrada mostraba estudiantes, tutor, tribunal y versión de PostgreSQL, pero no daba acceso directo a Documentos. | Añade “Rúbricas y documentos”; preselecciona el trabajo en Documentos. |
| Evaluaciones | La vista API mostraba notas y ámbitos del servidor, pero no enlazaba a una rúbrica PDF. | Una evaluación cerrada ofrece “Abrir rúbrica PDF”. Para etapas compartidas se elige aparte el estudiante destinatario del traspaso; no se crea una segunda evaluación. |
| Resultados | Los botones de rúbrica estaban en el recorrido local, no en el panel API. | El resultado individual ofrece un enlace a la rúbrica PDF de cada miembro esperado del tribunal. |
| Documentos | Ya solicitaba el PDF de NestJS, pero no podía recibir una selección preestablecida desde otras pantallas. | Mantiene su visor y sus acciones Guardar/Abrir/Imprimir; acepta IDs por query string y abre el PDF solicitado automáticamente. |

## Fuente y validaciones académicas

Se reutiliza el endpoint existente:

`GET /api/v1/documentos/trabajos/:trabajoId/estudiantes/:estudianteId/rubricas/:miembroId/pdf`

NestJS continúa resolviendo trabajo, estudiante, miembro del tribunal confirmado, versión fijada, evaluaciones cerradas y traspasos. `DocumentosService.rubricaPdf` reutiliza `EvaluacionesService.datosDocumentales` y `rubricaDocumental`; el frontend solo descarga, visualiza, guarda o imprime los bytes recibidos. No reconstruye la rúbrica, no recalcula notas y no completa datos académicos desde `localStorage`.

Para una etapa `TRABAJO_COMPARTIDO`, el servidor presenta el registro original solo si existe el traspaso al estudiante seleccionado. Para `ESTUDIANTE_INDIVIDUAL`, utiliza la evaluación del estudiante correspondiente. Las evaluaciones incompletas conservan su tratamiento existente: sus etapas se identifican como preliminares y no como cerradas; la impresión no cambia ese estado.

El controlador de Documentos usa ahora `ParseUUIDPipe()` sin restringir la versión RFC 4. Los campos PostgreSQL `uuid` admiten UUID canónicos de cualquier versión; esta validación acepta ese formato y conserva la validación de pertenencia y autorización ejecutada por el servicio. IDs malformados se rechazan antes de solicitar el PDF.

## Cambios realizados

- `backend/src/documentos/documentos.controller.ts`: deja de exigir UUIDv4 en los parámetros de lectura de documentos.
- `prototipo-titulacion/src/paginas/PaginaImpresionRubrica.jsx`: redirige la ruta compatible al flujo común de Documentos en modo API y bloquea el fallback local para IDs ficticios o API deshabilitada.
- `prototipo-titulacion/src/paginas/PaginaDocumentos.jsx`: preselecciona trabajo/estudiante/miembro recibidos, valida que pertenezcan al contexto devuelto por la API, abre el PDF solicitado y conserva impresión/descarga. La selección manual cancela la impresión pendiente para evitar imprimir otro destinatario.
- `prototipo-titulacion/src/paginas/PaginaTrabajosApi.jsx`: añade el acceso de expediente a Documentos.
- `prototipo-titulacion/src/paginas/EditorEvaluacionApi.jsx`: ofrece la rúbrica PDF para una evaluación cerrada y, en el caso compartido, permite elegir el estudiante al que se aplicó el traspaso.
- `prototipo-titulacion/src/paginas/PaginaEvaluacionesApi.jsx`: añade enlaces PDF por miembro al resultado individual.
- `prototipo-titulacion/src/dominio/documentosRubrica.js`: centraliza los destinos de Documentos y del endpoint PDF; incluye pruebas unitarias.
- Se actualizaron pruebas de `EditorEvaluacionApi`, `PaginaTrabajosApi` y `PaginaEvaluacionesApi`.
- Este informe.

No se modificó el generador PDF, el formato institucional, las actas, numeración, notas, fórmulas ni estados. No se necesitó migración.

## Verificación en navegador

Se inició `npm run dev`. El backend verificó el entorno local 10.9B en `127.0.0.1:55442/genares_dev_10_9`. En un contexto de navegador aislado:

1. El expediente `DEV-TI-001` mostró dos estudiantes, tribunal confirmado y la acción hacia Documentos.
2. Desde Documentos, el enlace con el UUID del trabajo preseleccionó `DEV-TI-001`, Andrea Sofía Mendoza Loor y María Elena López Vera. “Visualizar rúbrica” recibió HTTP 200 en el endpoint PDF; Chrome mostró un documento de tres páginas con controles de imprimir y descargar/guardar.
3. La ruta antigua con los UUID de trabajo, Andrea y María redirigió a `/documentos` con esos mismos tres IDs y cargó el PDF.
4. En Evaluaciones se observó la acción de impresión para la evaluación cerrada. La etapa compartida mantuvo un único registro y ofreció seleccionar el estudiante receptor.
5. En Resultado de Andrea se observaron los promedios de etapa 9.30 compartido y 8.70 individual, resultado final 9.00 y enlaces por los dos miembros. Al abrir la rúbrica del miembro 1, se solicitó el mismo endpoint PDF y respondió HTTP 200.
6. La ruta con IDs ficticios mostró “Rúbrica API no disponible”; no consultó datos locales ni produjo PDF.

La revisión del PDF confirmó su carga en el visor, tres páginas y controles disponibles; no se abrió el diálogo del sistema ni se guardó un archivo durante la auditoría. Las comprobaciones usaron registros sintéticos de 10.9B, no expedientes históricos reales.

## Pruebas y seguridad de datos

- Backend unitario mediante el runner protegido 9D: **16 suites, 88 pruebas aprobadas**.
- PostgreSQL 9D protegido: **4 suites, 41 pruebas aprobadas**: Carreras (4), Vigencia por carrera (1), Rúbricas (21), Evaluaciones/Documentos (15). La suite de Documentos valida pertenencia, versión, ámbitos/traspaso, PDF, lectura concurrente y que la consulta no modifique evaluaciones, trabajos ni auditoría.
- Frontend Vitest: **44 archivos, 207 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado, 1676 módulos transformados.
- `git diff --check`: aprobado; Git solo mostró avisos de conversión LF/CRLF en archivos existentes.

El runner comprobó el clúster 9D desechable en `127.0.0.1:55441` y se ejecutó con `-PreservarBasesPrueba`. Se conservaron sus cuatro bases temporales:

- `genares_9d_test_e3144ab4`
- `genares_9d_test_8de3e674`
- `genares_9d_test_69dc1721`
- `genares_9d_test_cf8da1c3`

En el entorno persistente 10.9B solo se hicieron lecturas GET. `npm run dev` terminó al acabar la inspección y los puertos 5173, 3001 y 55442 quedaron libres. No se accedió a PostgreSQL 8E (55440) ni al puerto 5432. No se creó base ni migración.

## Pendientes para 10.11D

1. Acordar con el sistema proveedor las referencias estables compartidas de trabajo, estudiante y docente antes de reemplazar los UUID locales en una integración institucional.
2. Validar visualmente las rúbricas preliminares e históricas con las modalidades y estructuras que entregue el proveedor, preservando sus reglas y formatos.
3. Mantener un único flujo API al integrar más pantallas académicas; Dashboard, Secretaría y Coordinación siguen fuera del alcance actual.
4. Incorporar autenticación institucional cuando se autorice la integración de producción. No forma parte del acceso local abierto ni de esta etapa.

No se hicieron commits ni push. Se detiene aquí la etapa 10.11C.
