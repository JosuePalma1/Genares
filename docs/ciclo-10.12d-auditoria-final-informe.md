# 10.12D — Auditoría final y cierre técnico del ciclo académico

Fecha: 24 de octubre de 2026

## 1. Resumen ejecutivo

El recorrido académico representado por el alcance actual de GENARES está **técnicamente verificado en entorno aislado** desde el expediente y la programación hasta las evaluaciones, consolidaciones, rúbricas PDF y actas archivadas. La principal evidencia integrada procede de pruebas HTTP iniciadas dentro de suites PostgreSQL 9D y con fixtures sintéticos. Las comprobaciones React de punta a punta no escribieron contra PostgreSQL 9D.

Las reglas cubiertas incluyen etapas compartidas e individuales, dos miembros confirmados del tribunal, traspasos sin puntajes duplicados, cierres, estados incompletos, consolidación racional exacta, redondeo `HALF_UP`, generación de PDFs, numeración concurrente e inmutabilidad del archivo. No se encontró un defecto crítico reproducible y no se cambió código productivo ni esquema en 10.12D.

Esto permite cerrar 10.12 como ciclo de **validación técnica local**, con límites explícitos. No demuestra integración institucional completa, no valida visualmente la emisión de actas en React contra 9D y no significa que GENARES esté listo para producción. Se puede comenzar 10.13 como revisión de interfaces y experiencia de usuario, manteniendo esas dependencias separadas.

## 2. Alcance y fuentes de evidencia

Se revisaron `integracion-10.11e-informe.md`, `ciclo-10.12a-uuid-escritura-informe.md`, `ciclo-10.12b-integracion-informe.md` y `ciclo-10.12c-actas-informe.md`, además de los informes 10.11D, 10.8A y 10.8B cuando aportaban antecedentes de navegación y documentos.

La auditoría se basa en cuatro tipos de evidencia, que no deben confundirse:

- **Unitarias:** reglas de dominio, validación UUID, estados, consolidación exacta y estructura documental.
- **PostgreSQL 9D:** pruebas aisladas con migraciones del proyecto, fixtures sintéticos y restricciones SQL reales del entorno desechable.
- **HTTP integrado:** la suite 9D inicia NestJS y recorre endpoints contra su propia base temporal. Prueba contratos y escrituras del servidor.
- **Frontend/navegador:** Vitest verifica componentes, adaptadores y servicios; el navegador de 10.11D/10.11E recorrió pantallas con lecturas GET en 10.9B. No se inspeccionó visualmente una sesión React que emitiera actas contra 9D.

No se consultó ni modificó 10.9B (`55442`), 8E (`55440`) ni el puerto `5432`. El runner protegido volvió a verificar 9D (`127.0.0.1:55441`) y preservó las cuatro bases temporales de esta ejecución. No se aplicaron migraciones fuera de ellas.

## 3. Matriz de cobertura del ciclo académico

| Paso | Endpoint o servicio responsable | Evidencia disponible | Tipo | Estado | Límite conocido |
|---|---|---|---|---|---|
| Expediente académico existente | `GET /api/v1/trabajos`, `GET /api/v1/trabajos/:id`; `TrabajosService` | 10.11E contrastó expedientes sintéticos en interfaz/API; 10.12B creó el caso integrado en fixture 9D y leyó el mismo expediente por HTTP. | Navegador GET, PostgreSQL, HTTP | Verificado para expedientes ya disponibles | No hay CRUD de alta institucional en GENARES; lo aporta el proveedor. |
| Estudiantes y tutor asociados | Relación de trabajo devuelta por `/api/v1/trabajos/:id` | Fixture 9D de 10.12B contiene dos estudiantes y tutor; 10.11E contrastó relaciones en lectura. | PostgreSQL, HTTP, navegador GET | Verificado | No se probó el alta institucional de estas relaciones; depende del proveedor. |
| Tribunal confirmado | Expediente y contexto de evaluaciones | GET devuelve dos miembros; las evaluaciones se autorizan contra pertenencia al tribunal confirmado. Fixtures y pruebas negativas rechazan miembro ajeno/no confirmado. | PostgreSQL, HTTP, unitarias, navegador GET | Verificado | GENARES no asigna ni confirma el tribunal institucionalmente. |
| Versión de rúbrica fijada | `TrabajosService` y `EvaluacionesService` | El ciclo 10.12B devuelve la versión vinculada al trabajo; evaluaciones y documentos conservan esa versión y sus snapshots. Pruebas de rúbricas cubren historial inmutable. | PostgreSQL, HTTP, unitarias | Verificado | La creación institucional de trabajos con referencia externa aún depende del contrato proveedor. |
| Programación de sustentación | `/api/v1/programaciones-sustentacion` | 10.12B probó creación, consulta y transiciones `PROGRAMADA` → `EN_SUSTENTACION` → `FINALIZADA`; 10.11E recorrió lectura en interfaz. | PostgreSQL, HTTP, navegador GET | Verificado en el flujo aislado | La escritura se probó por HTTP de backend, no visualmente desde React contra 9D. |
| Evaluación escrita compartida | `/api/v1/evaluaciones/trabajos/:id`, creación de evaluación | Un registro por miembro del tribunal; aplica a cada estudiante mediante traspasos asociados a la evaluación original. | PostgreSQL, HTTP, unitarias | Verificado | No se crea una calificación editable duplicada por estudiante. |
| Evaluación oral individual | Mismo controlador de evaluaciones, vinculada a estudiante y etapa | 10.12B registró y cerró una evaluación individual por estudiante y miembro. | PostgreSQL, HTTP | Verificado | No se inspeccionaron estados abiertos en un navegador conectado a 9D. |
| Guardado de puntajes | `PUT /api/v1/evaluaciones/:id/puntajes` | Límites por indicador, captura exacta, cambios atómicos y rechazo de puntajes sobre máximo. UUID PostgreSQL no v4 probado tras 10.12A. | PostgreSQL, HTTP, unitarias y frontend automatizadas | Verificado | No se hizo escritura visual de React contra el fixture 9D. |
| Concurrencia de puntajes | Revisión optimista del servicio | Dos escrituras con la misma revisión resultaron en una respuesta 200 y otra 409; al releer, sólo una revisión quedó aplicada. | PostgreSQL, HTTP | Verificado | La concurrencia de uso a escala institucional no fue sometida a prueba de carga. |
| Cierre de evaluación | `POST /api/v1/evaluaciones/:id/cierre` | Cierre con puntajes completos; rechazo de cierre incompleto y de edición posterior al cierre. UUID no v4 probado por HTTP. | PostgreSQL, HTTP | Verificado | No se cambió la regla de cierre. |
| Consolidación parcial | `GET /api/v1/evaluaciones/trabajos/:id/consolidados` | Estados `EN_PROGRESO` y `EVALUACIONES_CERRADAS_INCOMPLETAS`, evaluadores pendientes identificados y resultado final nulo. | PostgreSQL, HTTP, unitarias | Verificado | Estados especiales cubiertos con fixtures, no con expedientes históricos ni recorrido visual. |
| Consolidación completa | `EvaluacionesService` | Dos estudiantes del fixture 10.12B: escrita compartida 9.30; orales 8.70 y 9.20; resultados finales 9.00 y 9.25. Exactitud racional contrastada independientemente. | PostgreSQL, HTTP, unitarias | Verificado | Resultado generado bajo demanda; no se persiste una consolidación derivada. |
| Resultados individuales | `/resultados/:trabajo/:estudiante`, lectura del consolidado | 10.11E contrastó en navegador los resultados completos 9.00/9.25; frontend muestra finales sólo cuando la API declara estado completo. | Navegador GET, HTTP, frontend | Verificado en lectura | Incompletos/legacy se cubren en pruebas automatizadas, no en visualización contra 9D. |
| Rúbricas PDF | `/api/v1/documentos/trabajos/:trabajo/estudiantes/:estudiante/rubricas/:miembro/pdf` | 10.12B obtuvo cuatro PDFs del ciclo mixto; 10.11E abrió una rúbrica PDF en navegador con sus controles de guardar/imprimir. No cambia evaluaciones ni estados. | PostgreSQL, HTTP, navegador GET, frontend | Verificado | La legibilidad visual probada corresponde a rúbrica, no a acta. |
| Emisión de acta | `POST /api/v1/documentos/trabajos/:trabajo/estudiantes/:estudiante/actas` | 10.12C probó elegibilidad, resultado servidor, respuestas 201 y rechazos para faltantes, datos inválidos y relaciones incorrectas. | PostgreSQL, HTTP, unitarias | Verificado en servidor | La emisión no se envió desde React en navegador. |
| Numeración | `archivarActaEn`, `consecutivos_acta` | Tres solicitudes concurrentes SOFT/2026-2 generaron el conjunto `001`–`003`; una sola secuencia por carrera/período compartida por ambos formatos. También se probaron ámbitos distintos. | PostgreSQL, HTTP | Verificado | Orden de adjudicación entre solicitudes concurrentes no es determinista; la unicidad sí. |
| Archivo del documento | `actas_archivadas` | Persistencia `bytea`, snapshots, `generado_por`, `generado_en`, revisión y SHA-256; unicidad SQL y triggers de inmutabilidad. | PostgreSQL | Verificado | El registro inmutable funciona como evidencia de emisión; no hay evento separado de auditoría de acta. |
| Recuperación de PDF archivado | `GET /api/v1/documentos/actas/:id/pdf` | Igualdad de bytes HTTP/`bytea`, hash coincidente, cabecera PDF, `no-store`; reintento devuelve mismo ID, número y bytes. | PostgreSQL, HTTP, unitarias | Verificado | No se inspeccionó en pantalla el PDF de acta con React conectado a 9D. |

Los fixtures que crean el expediente del ciclo son sintéticos y viven en bases temporales; no representan ni modifican expedientes académicos reales.

## 4. Cobertura de reglas académicas

| Regla | Cobertura observada | Estado |
|---|---|---|
| Ámbitos compartido e individual, en varias etapas y orden configurado | Pruebas de 1, 2 y 3 etapas; escrita compartida, oral individual; evaluación asociada al ámbito de la etapa, no a su nombre. | Cubierta |
| Tribunal confirmado y dos evaluadores requeridos | Autorización y elegibilidad de acta con dos miembros; se rechaza tribunal no confirmado o evaluador ajeno. | Cubierta bajo el requisito actual de dos |
| Versión de rúbrica y cierre inmutables | Snapshots fijados a versión; escritura de evaluación cerrada rechazada; versiones activas/archivadas no se reescriben. | Cubierta |
| Pendientes y evaluaciones incompletas | Sin evaluaciones, en progreso y cierres obligatorios pendientes se representan sin nota final; el acta no se emite. | Cubierta por pruebas automatizadas |
| Máximos por indicador y captura exacta | Puntajes sobre máximo y totales/estructuras incorrectas rechazados; operaciones atómicas ante error. | Cubierta |
| Concurrencia optimista | Una escritura gana con revisión actual y la concurrente recibe conflicto; estado posterior consistente. | Cubierta |
| Traspasos compartidos sin duplicación | La evaluación original es la usada; asociación por estudiante y evaluación única, sin copiar puntajes. | Cubierta |
| Promedio de evaluadores y promedio aritmético de etapas | Cálculo racional exacto previo al redondeo final; caso de dos estudiantes y rúbrica de tres etapas. | Cubierta |
| Precisión y redondeo `HALF_UP` | Pruebas unitarias para puntos de mitad, periodicidad y prevención de redondeo intermedio; prueba PostgreSQL contra referencia racional independiente. | Cubierta para datos sintéticos probados |
| Resultado final sobre 10.00 | Consolidación completa `9.00`/`9.25`; documentos persisten resultado `/10`; no se suman etapas como escala 20/30. | Cubierta |
| Compatibilidad legacy | Filas ESCRITA/ORAL de fixture conservan IDs/estado/notas y no se reinterpretan como etapas dinámicas. | Cubierta con fixture, no con históricos reales |

No se modificaron fórmulas, ponderaciones, reglas de aprobación ni umbral provisional durante esta auditoría.

## 5. Integración de interfaces

La verificación visual reportada en 10.11D/10.11E usó la API local 10.9B mediante GET, en modo integrado, y recorrió Dashboard, Trabajos/detalle/tribunal, Cronograma, Evaluaciones, Resultados, Rúbricas, Documentos, Secretaría, Coordinación, Consulta, Carreras y Modalidades. En 10.11E el listado de actas de 10.9B estaba vacío; ver esa ausencia no equivale a comprobar una acta emitida. Las pantallas se contrastaron con las respuestas del servidor y no se usó `localStorage` como fallback del modo API.

| Módulos | Navegador contra 10.9B | Automatización / límite |
|---|---|---|
| Dashboard, Trabajos, Tribunal, Cronograma | Lecturas y navegación verificadas. | Escrituras de trabajo/tribunal no disponibles en GENARES; programación probada por HTTP 9D, sin escritura React visual. |
| Evaluaciones y Resultados | Listado, contexto, evaluaciones cerradas y resultados completos contrastados en lectura. | Crear, puntuar, concurrir y cerrar probado en HTTP/PG 9D y Vitest; no hubo recorrido visual de escritura con 9D. Estados pendientes se comprobaron automatizadamente. |
| Rúbricas | Catálogo, detalle, versiones y PDF observados; formularios podían recorrerse sin guardar. | Creación/clonación y contratos de API probados por suites; no se verificó escritura visual contra 9D. |
| Documentos | Recorrido y rúbrica PDF observados; archivo de actas vacío en 10.9B. | Emisión/archivo/listado/PDF de acta probados por HTTP/PG 9D; pruebas frontend cubren el servicio de lista y recuperación, no una sesión de navegador conectada a 9D. |
| Secretaría, Coordinación, Consulta | Lecturas, filtros y navegación a expedientes/resultados/documentos contrastados. | Vitest valida presentación y enlaces; son vistas de lectura. |
| Carreras y Modalidades | Catálogos y detalle leídos en navegador. | Escrituras de catálogos cubiertas por API/PG y pruebas automatizadas; no fueron objeto de validación visual de escritura en 10.12. |

**Conclusión visual:** sí hubo cobertura de lectura en navegador en 10.9B, pero 10.12B/10.12C verificaron las escrituras académicas y documentales contra 9D sólo por HTTP integrado dentro de pruebas. No se eludieron las protecciones para forzar React sobre 9D. El PDF de acta se examinó por bytes, hash y extracción de texto, no por su diagramación en navegador o diálogo de impresión.

## 6. Documentos, formatos y archivo

Los formatos internos usados son PAT-01-F-019 y PAT-04-F-017. La secuencia `NNN-AAAA-P-CARRERA` se asigna por carrera/período, y ambos formatos comparten el consecutivo. La emisión usa la consolidación del servidor; incompletos, estudiantes ajenos, identificadores o formatos inválidos, falta de tribunal y ausencia de versión se rechazan. Las solicitudes concurrentes no duplican números y una repetición para la misma combinación trabajo/estudiante/formato recupera el mismo documento.

La base conserva el PDF exacto, SHA-256, número, revisión, fecha/actor emisor y snapshot de nota final, umbral y decisión. El trigger bloquea `UPDATE`, `DELETE` y `TRUNCATE`; las lecturas no vuelven a renderizar el PDF ni alteran estados académicos. No se encontraron defectos críticos en estas reglas.

Limitaciones conocidas que se mantienen deliberadamente:

- La fecha de emisión se guarda en `generado_en`, pero no aparece visible en la plantilla PDF actual.
- La programación no es requisito actual de elegibilidad; la suite emitió correctamente para un trabajo sin programación.
- La emisión sin tutor no fue probada. El ciclo sin programación sí tenía tutor.
- No hay evento append-only separado de emisión; se conserva el registro inmutable con actor, fecha y hash.
- No hubo revisión visual del PDF de acta en navegador conectado a 9D. La prueba automática verificó contenido extraído, bytes archivados, SHA-256 y etiquetas de firma.
- El umbral 7.00 se conserva como provisional; esta etapa no decide políticas institucionales de aprobación.

No se cambió el formato PAT ni se creó un mecanismo alternativo de emisión.

## 7. Dependencias institucionales

Quedan fuera del dominio de escrituras de GENARES y requieren contratos/decisiones externos:

1. Alta institucional de trabajos y sus modificaciones.
2. Asociación oficial de estudiantes, carrera, tutor y período con un trabajo.
3. Asignación y confirmación institucional del tribunal.
4. Identificadores estables compartidos de trabajo, persona, estudiante y docente entre proveedor y GENARES.
5. Contratos de intercambio y responsabilidad de datos entre el sistema proveedor y los cuatro sistemas que compartirán el CORE en el futuro.
6. Autenticación institucional para cualquier despliegue no local.
7. Validación institucional de plantilla final, fecha visible, registro de auditoría requerido y requisitos de tutor/programación para emitir.

No se clasifica la falta de estos CRUD o de autenticación como defecto funcional de la etapa local: son límites y dependencias explícitos. La ausencia de autenticación sí impide considerar el backend preparado para producción.

## 8. Riesgos técnicos priorizados

| Nivel | Riesgo | Fundamento y efecto |
|---|---|---|
| Crítico | **Ninguno identificado en esta revisión.** | Las suites completas y builds pasaron; no apareció un fallo crítico reproducible. Esto no equivale a certificación ni a carga de producción. |
| Alto | Contratos externos e identificadores no integrados. | Sin la interfaz del proveedor para trabajos/relaciones y sin IDs comunes no se puede dar de alta y seguir un expediente institucional nuevo de extremo a extremo. No es una tarea de CRUD local autorizada. |
| Alto | No hay autenticación institucional para producción. | El acceso abierto sólo está protegido para el modo local. No desplegar fuera de localhost hasta definir identidad y seguridad institucional. |
| Medio | Carga de seguimiento sin paginación/resumen. | Se solicita una consolidación por cada trabajo elegible; el número de llamadas crecerá con el volumen de expedientes. |
| Medio | Divergencia potencial entre API y prototipo local. | Hay implementaciones paralelas de seguimiento/evaluación/impresión; pueden evolucionar con reglas distintas si no se mantienen límites y pruebas. |
| Medio | Escrituras React no validadas visualmente contra 9D. | Los contratos, controles y API están automatizados, pero falta evidencia de interacción visual integrada de formularios de evaluación y emisión con un fixture aislado. |
| Medio | Plantilla/registro de actas con decisiones pendientes. | No muestra fecha visible, no tiene evento independiente y no se determinó si se exige tutor o programación. Debe resolverse con la Universidad antes de institucionalizar el documento. |
| Medio | Estados especiales sin recorrido visual. | Legacy, incompletos y errores se validan con fixtures/pruebas; 10.9B sólo tenía cierres completos y el archivo de actas vacío. |
| Bajo | UUID de módulos ajenos a evaluaciones no contrastados con UUID no v4. | 10.12A alineó las escrituras de evaluación; 10.11E observó IDs de programación UUIDv4 y no reprodujo defecto. Revisar al recibir IDs del proveedor. |
| Bajo | No existe validación de carga con cientos de expedientes ni prueba de concurrencia a escala. | Se probaron carreras funcionales específicas, no estrés o rendimiento. |

## 9. Validación automatizada de cierre

Ejecutado nuevamente en esta auditoría:

- Backend unitario mediante `backend/scripts/pruebas-postgres-9d.ps1 -PreservarBasesPrueba`: **17 suites, 91 pruebas aprobadas**. Las suites PostgreSQL se excluyen en la fase unitaria del runner.
- PostgreSQL 9D protegido: **4 suites, 43 pruebas aprobadas** — Carreras (4), Vigencias por carrera (1), Rúbricas (21) y Evaluaciones/Documentos/Programaciones (17).
- Frontend Vitest: **48 archivos, 224 pruebas aprobadas**.
- Build NestJS: aprobado.
- Build Vite: aprobado, 1680 módulos transformados.
- `git diff --check`: código 0; Git mostró avisos de normalización LF/CRLF del árbol existente.

El runner verificó la instancia 9D desechable `127.0.0.1:55441`, creó una base temporal distinta por suite y utilizó `-PreservarBasesPrueba`. Las bases de esta ejecución que quedaron preservadas son `genares_9d_test_da3fadcd`, `genares_9d_test_c1594ee3`, `genares_9d_test_1e6f2266` y `genares_9d_test_698e411f`. Se observaron trazas de errores SQL inyectados intencionalmente por pruebas de rollback/auditoría; las suites correspondientes finalizaron aprobadas.

Las fixtures no son datos institucionales reales. No se ejecutó prueba de navegador para escritura ni se validó el documento visualmente contra una resolución final institucional. No se realizaron commits ni push.

## 10. Dictamen técnico

**10.12 puede cerrarse como validación técnica del ciclo académico en entorno local aislado.** El recorrido de servidor —incluida emisión y archivo inmutable de actas— tiene evidencia repetible de PostgreSQL 9D y HTTP integrado. La lectura React tiene comprobación visual previa en 10.9B y cobertura automatizada; la experiencia visual de escritura contra 9D no está verificada.

Este dictamen no certifica expedientes históricos, integración con el proveedor, identidad compartida, autenticación institucional, seguridad de un despliegue de red, experiencia visual de emisión ni aprobación universitaria de las plantillas. **GENARES no queda declarado listo para producción.** No apareció un defecto crítico que exija detener el cierre.

## 11. Recomendaciones para 10.13

Se puede comenzar 10.13 como revisión focalizada de interfaces y experiencia de usuario, conservando el modo API/prototipo separado y sin habilitar escrituras a bases persistentes durante pruebas. Recomiendo:

1. Priorizar tareas observables: completar una evaluación, atender pendientes, consultar resultado y encontrar/imprimir un documento archivado.
2. Probar estados vacío, carga, error, incompleto y completo; distinguir lectura de escritura y mostrar confirmaciones claras en los formularios.
3. Preparar un recorrido UI automatizado contra un entorno verdaderamente desechable 9D, usando el runner y las protecciones existentes, sin cambiar la configuración segura de `npm run dev`.
4. Revisar visualmente PDFs de acta con criterios institucionales antes de cambiar plantilla o agregar fecha/campos.
5. Mantener registradas como dependencias, no como funcionalidades asumidas de GENARES, las altas de expediente/tribunal y los identificadores del proveedor.
6. Mantener como puerta aparte previa a producción la autenticación institucional, la revisión de seguridad y una definición de auditoría documental.

No se modificó código productivo, esquema, migraciones, plantillas ni datos. Sólo se añade este informe y se detiene aquí 10.12D.
