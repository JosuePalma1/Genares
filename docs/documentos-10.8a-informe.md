# 10.8A — Documentos académicos y adenda de impresión de rúbricas

## Alcance entregado

- Pantalla `/documentos`: selección de trabajos autorizados, estudiante y evaluador; visualización, descarga e impresión de rúbricas; vistas preliminares de ambos formatos de acta; consulta del archivo por estudiante, carrera y período.
- PDF generado por NestJS con PDFKit. React no calcula notas. El visor y la descarga utilizan los mismos bytes recibidos.
- Lecturas de contexto, estructura, notas, transferencias y consolidación dentro de una transacción `REPEATABLE READ`.
- Infraestructura transaccional de numeración y archivo inmutable. **La emisión definitiva está bloqueada en servidor y en interfaz** por los pendientes académicos descritos abajo. No existe un parámetro para ignorarlos.

## Fuentes institucionales

Se inspeccionaron los tres originales disponibles, sin modificarlos:

- `docs/PAT-01-F-019-ACTA-DE-TRABAJO-DE-TITULACIÓN-R1 (2).docx`: revisión 1; tabla escrita /10, sustentación /10 y sumatoria /20; Decano/Presidencia, dos miembros, graduado y Secretaría.
- `docs/PAT-04-F-017.docx`: revisión 2; tabla de trabajo escrito, componente oral y final; Presidencia, dos miembros, graduado, tutor y Analista 2.
- `docs/RUBRICA DEFENSA TRABAJO IC 5 PUNTOS.docx`: el archivo disponible no tiene el sufijo `(1)` mencionado en la adenda. Sirve como referencia para identificación, tabla indicador/valoración/calificación, subtotales, resumen y firma del evaluador.

Las actas generadas son **adaptaciones preliminares**, con texto reglamentario transcrito como referencia sin completar sus marcadores ni declarar aprobación. No se afirma que sean reproducciones oficiales aprobadas de los DOCX. La rúbrica imprimible utiliza los textos, máximos y etapas de la versión del trabajo y la instantánea de cada evaluación; no impone los indicadores del ejemplo ni convierte todas las configuraciones a 5 + 5.

## Fórmula y procedencia

- El documento contiene las notas registradas por indicador, subtotal por criterio y total registrado de cada evaluación cerrada.
- Los subtotales utilizan aritmética racional; no se recalcula el resultado académico en React ni se cambia la fórmula vigente.
- El resumen distingue las notas de **un evaluador** del resultado consolidado del estudiante. Este último procede del servicio existente: promedio de los dos evaluadores por etapa y promedio exacto de todas las etapas, presentado con `HALF_UP` a dos decimales sin redondeos intermedios.
- Una etapa compartida cerrada solo se utiliza cuando existe la asociación de traspaso del estudiante al registro original. Se muestra el identificador de evaluación de origen y se identifica la procedencia compartida. No se copian ni crean puntuaciones.
- Las etapas individuales se filtran por estudiante y miembro. No se deduce el ámbito por nombre.
- Notas faltantes se muestran como pendientes. Borradores y rúbricas sin todos los indicadores no se presentan como cerrados. Cada página lleva el estado documental.
- Las fuentes legacy no se reinterpretan ni se suman con las dinámicas; se informa de su exclusión. La ruta histórica de impresión existente permanece intacta. Este módulo no introduce un adaptador de impresión legacy de PostgreSQL.

## Datos reutilizados y migración

Se reutilizan trabajos, estudiantes del trabajo, personas, perfiles, cuentas, carreras, períodos, modalidades, asignaciones de tutor, tribunales, miembros, versiones/etapas/categorías/indicadores, evaluaciones, puntuaciones y traspasos. No se cambia la consolidación ni las tablas académicas existentes.

Nueva migración aditiva: `1760000012000-archivo-actas.ts`.

| Tabla nueva | Finalidad |
| --- | --- |
| `consecutivos_acta` | Último consecutivo por carrera y código canónico de período. |
| `actas_archivadas` | Número, referencias al trabajo/estudiante/carrera/período, formato/revisión, fecha, actor, PDF y SHA-256. |

El PDF se almacena como `bytea`: conserva exactamente el contenido emitido, sin duplicar calificaciones editables. La fila del archivo conserva actor y fecha como trazabilidad de emisión. Triggers impiden actualizar, eliminar o truncar las actas y validan la coherencia de la identidad documental. La migración no se puede revertir si hay documentos archivados. `synchronize: false` permanece intacto.

### Numeración

`NNN-AAAA-P-CARRERA`, mínimo tres dígitos, códigos `TI` o `SOFT`, período canónico `AAAA-1` o `AAAA-2`. No se infieren equivalencias de códigos de carrera o período.

`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` serializa la reserva por carrera/período. Ambos formatos comparten contador. El llamador ejecuta reserva, generación y archivo en una sola transacción; fallos revierten todo antes de publicar el número. Restricciones únicas protegen número, carrera/período/consecutivo y trabajo/estudiante/formato. Abrir, descargar y reimprimir leen el PDF archivado y no reservan otro número.

La función interna de archivo está probada con **fixtures técnicos**. No está conectada a un camino de emisión que permita eludir la validación académica. Las pruebas de concurrencia del archivo no representan actas reales emitidas.

## API

Prefijo `/api/v1/documentos`:

| Método y ruta | Uso |
| --- | --- |
| `GET /trabajos` | Trabajos accesibles a la identidad. |
| `GET /trabajos/:trabajoId` | Estudiantes, evaluadores y pendientes para actas. |
| `GET /trabajos/:trabajoId/estudiantes/:estudianteId/rubricas/:miembroId` | Modelo documental con notas y procedencia. |
| `GET /trabajos/:trabajoId/estudiantes/:estudianteId/rubricas/:miembroId/pdf` | PDF de la rúbrica de ese evaluador. |
| `GET /trabajos/:trabajoId/estudiantes/:estudianteId/acta-preliminar?formato=…` | PDF preliminar sin numeración. |
| `POST /trabajos/:trabajoId/estudiantes/:estudianteId/actas` | Puerta de emisión; devuelve conflicto por los pendientes institucionales actuales. Solo admite `formato`. |
| `GET /actas?estudiante=…&carrera=…&periodo=…` | Archivo filtrado por permisos. |
| `GET /actas/:id` | Identidad, número y huella del archivo. |
| `GET /actas/:id/pdf` | Bytes del PDF archivado para visualizar, guardar o reimprimir. |

Se exige `evaluaciones:leer` **y pertenecer al tribunal confirmado**, siguiendo la política existente de 10.1. El POST exige además `documentos:emitir`; esa capacidad no se otorga automáticamente a perfiles locales. No se amplió por inferencia el acceso de Secretaría/Coordinación o de administradores a notas de cualquier trabajo. Los PDF se entregan con `Cache-Control: no-store`.

## Bloqueos académicos explícitos

Hoy no existe fuente validada para oficialización de la nota, declaración de aprobación, título académico, presidencia, autoridad de Secretaría/Analista 2, lugar y datos reglamentarios de emisión. `CERRADA` no sustituye esos datos. Las etapas `PERSONALIZADA` tampoco autorizan inferir escrita/oral.

Por ello **ningún trabajo puede emitir todavía un acta definitiva desde este módulo**, incluso si la consolidación está completa. No se calcula una nota oficial /20 ni su expresión en letras con una fórmula no confirmada. La interfaz explica los pendientes y ofrece solo la vista preliminar. Será necesario incorporar una fuente institucional validada para esos datos y conectar el render definitivo al archivo cuando se autorice esa regla.

## Validación

| Validación | Resultado |
| --- | --- |
| Pruebas unitarias backend | 82 aprobadas; 39 casos PostgreSQL se omiten en esta fase unitaria. |
| PostgreSQL 9D protegido | 39 aprobadas: carreras 4, vigencias 1, rúbricas 21, evaluaciones/documentos 13. Incluye la migración aditiva, permisos, sumas/traspasos existentes, lectura concurrente, PDF, consecutivos, dos formatos, reinicios de contador, archivo inmutable y reimpresión con los mismos bytes. |
| Pruebas frontend | 188 aprobadas en 37 archivos, incluida la nueva pantalla de documentos. |
| Build NestJS | Aprobado. |
| Build Vite | Aprobado; persiste el aviso existente por chunk JavaScript de 672.44 kB. |
| Inspección PDF | Tres PDF con datos sintéticos: rúbrica de 3 páginas y dos formatos preliminares de acta de 2 páginas. Se verificó el encabezado preliminar en todas las páginas y que los bloques de texto queden dentro de cada página. |
| `git diff --check` | Aprobado; Git solo informó conversiones LF/CRLF en archivos preexistentes. |

La instalación de PDFKit y sus tipos reportó 5 alertas de dependencias en el árbol npm (1 moderada, 3 altas y 1 crítica). No ejecuté `npm audit fix` para evitar cambiar dependencias ajenas al alcance; conviene revisar el árbol antes de desplegar.

El primer intento de la prueba de concurrencia usó una expectativa de `8.00` incompatible con el máximo 5 de la etapa escrita de su fixture. Se corrigió para cotejar contra el total registrado por el cierre y la corrida completa posterior aprobó. No se borraron bases de prueba: el runner se ejecutó con `-PreservarBasesPrueba` y conservó también la base fallida diagnóstica del intento anterior. No se migró la base persistente 9D ni otra base externa.

No se modificaron notas reales, documentos originales, estados académicos ni bases persistentes. Las pruebas de documentos y numeración usan fixtures sintéticos; no prueban calificaciones históricas reales. No se creó commit ni push.

## Archivos de esta etapa

- `backend/src/documentos/`: DTO, módulo, controlador, servicio, modelo, render PDF, transcripción de plantillas, archivo transaccional y pruebas unitarias.
- Nueva migración `backend/src/base-datos/migraciones/1760000012000-archivo-actas.ts`.
- `backend/src/evaluaciones/evaluaciones.service.ts`: lectura documental consistente; `evaluaciones.module.ts`: exportación del servicio.
- `backend/src/evaluaciones/evaluaciones.postgres.e2e.spec.ts`: integración documental y migración nueva sobre fixtures aislados.
- `backend/src/aplicacion.module.ts`, `backend/package.json`, `backend/package-lock.json`: registro del módulo y PDFKit/tipos.
- `prototipo-titulacion/src/paginas/PaginaDocumentos.jsx`, su prueba y `documentos.css`.
- `prototipo-titulacion/src/servicios/documentosApi.js`, `Aplicacion.jsx` y `estructuras/EstructuraAplicacion.jsx`: cliente, ruta y navegación.

El resto de cambios previos del repositorio se conserva y no se atribuye a esta etapa.
