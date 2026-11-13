DOCUMENTACIÓN DE DISEÑO · PASO 05

GENARES

Distribución de trabajo, GitHub y entregas

Plan ejecutable para el equipo de Genares (S4), sin asignar tareas a S1, S2 ni S3

| **Control del documento** | **Detalle** |
| --- | --- |
| Paso | 05 — Distribución del desarrollo y entregas S4 |
| Ámbito | Solo equipo Genares (S4); carreras TI y Software |
| Referencias | Pasos 1, 2, 3 y 4; MER unificado; repositorio compartido |
| Responsables propuestos | S4-A (frontend / APK) y S4-B (backend / datos), nombres por completar |
| Planificación | Entregas secuenciales por criterios de aceptación; sin fechas fijadas |
| Estado | Propuesta operativa para iniciar desarrollo — 02 nov 2026. **Versión 1.1 (12 nov 2026):** nombres del MER vigente y estado de las tareas (sección 4.1). |

|  |
| --- |
| **DECISIÓN CLAVE**  Un solo repositorio GitHub para S1–S4 y una única base de datos PostgreSQL. Este documento organiza solo el trabajo de S4: quién implementa cada componente, cómo se revisa el código y qué debe entregarse para considerar cada etapa terminada. |

Los identificadores S4-A / S4-B son puestos de trabajo, no personas confirmadas. Si el equipo tiene más o menos integrantes, se redistribuye la carga sin cambiar los módulos ni las entregas.

# 1. Alcance y reglas de este plan

El Paso 5 convierte los siete módulos funcionales y tres componentes transversales del Paso 2, la arquitectura del Paso 3 y las carpetas del Paso 4 en tareas verificables. No modifica los requisitos, el MER ni el repositorio: define cómo se implementarán.

**•** S4 desarrolla rúbricas, evaluaciones, cronograma de sustentaciones, cálculo, seguimiento, documentos, auditoría y experiencia del tribunal en Android.

**•** S4 solo consulta trabajos, estudiantes, tutores y tribunales administrados por los otros sistemas; no crea una segunda administración académica.

**•** Los cambios se proponen sobre el repositorio compartido mediante ramas y pull requests (PR); no se desarrolla un repositorio paralelo de S4.

**•** Las fechas y nombres no están confirmados; se usa orden de dependencias y una asignación inicial S4-A / S4-B.

# 2. Responsables dentro del equipo S4

| **Puesto propuesto** | **Responsabilidad principal** | **Revisión / apoyo** |
| --- | --- | --- |
| S4-A — Frontend y APK | Rutas React, pantallas, formularios, experiencia del tribunal, Capacitor, persistencia local y sincronización del cliente. | Revisa cambios de API y valida experiencia de usuario. |
| S4-B — Backend y datos | NestJS, casos de uso, permisos, consultas al MER, evaluación, cálculo, PDFs, auditoría, scripts SQL de S4 (backend/fixtures/). | Revisa contratos usados por frontend y las pruebas. |
| Ambos — integración y calidad | Criterios de aceptación, pruebas de flujo completo, documentación, demostraciones, revisión cruzada y entregas. | Cada PR tiene autor y revisor diferentes cuando sea posible. |
| Coordinación S4 — rol rotativo o designado | Ordena prioridades, mantiene tablero GitHub y confirma que las entregas cumplan su lista de verificación. | No sustituye la revisión técnica de ambos. |

Convención: cada issue de S4 debe tener una sola persona responsable de cerrarlo (owner) y, preferentemente, otra que revise. Si son dos integrantes, S4-A y S4-B pueden corresponder a cada uno; no se asignan nombres sin confirmación.

# 3. División del trabajo por módulos funcionales

| **Módulo S4** | **Responsable principal** | **Colaboración / resultado** |
| --- | --- | --- |
| MF-01 Consultas académicas | S4-B (API) / S4-A (UI) | Lectura autorizada de trabajos, estudiantes y tribunales; ficha de contexto. |
| MF-02 Modalidades y rúbricas | S4-B (reglas) / S4-A (UI) | Versiones, categorías, indicadores, ponderaciones y validación. |
| MF-03 Evaluaciones | S4-B (API/cierre) / S4-A (formularios) | Borradores, evaluador asignado, notas, cierre y confirmación. |
| MF-04 Cronograma | S4-B (validaciones) / S4-A (agenda) | Programar y reprogramar; consulta del tribunal y registro de cambios. |
| MF-05 Seguimiento | S4-B (estados) / S4-A (tableros) | Estados por estudiante y trabajo basados en datos confirmados. |
| MF-06 Cálculo y resultados | S4-B (motor) / S4-A (consulta) | Cálculo con precisión completa; exhibición reglada a dos decimales. |
| MF-07 Documentos | S4-B (PDF/archivo) / S4-A (descargas) | Rúbricas, actas y consulta autorizada. |

# 3.1. Componentes transversales

| **Componente** | **Responsable en S4** | **Condición de cierre** |
| --- | --- | --- |
| CT-01 Identidad y permisos | S4-B + S4-A | Backend valida rol/carrera/asignación; S4 consume identidad externa. |
| CT-02 Guardado local y sincronización | S4-A (cliente) + S4-B (API) | Reinicio offline conserva avance; reintento no duplica; conflicto visible. |
| CT-03 Auditoría | S4-B + S4-A (consulta) | Registra actor, acción, antes/después y motivo; visualización autorizada. |

# 4. Tareas concretas y criterios de terminación

Las siguientes tareas son tarjetas de trabajo iniciales para GitHub Projects. Se subdividen solo cuando el tamaño de una implementación lo requiera. “Listo” significa código integrado, revisado y verificable, no únicamente una pantalla dibujada.

| **Issue** | **Tarea / alcance** | **Owner** | **Evidencia mínima** |
| --- | --- | --- | --- |
| S4-01 | Preparar rutas S4 y scripts de desarrollo sin alterar módulos ajenos. | S4-A | Inicio S4 en frontend; build satisfactorio. |
| S4-02 | Preparar módulo NestJS S4, contrato HTTP y ambiente de pruebas. | S4-B | API compilable y documentación breve. |
| S4-03 | Consultas de lectura a trabajos, estudiantes, tutores y tribunales. | S4-B | API con datos de prueba y permisos. |
| S4-04 | Ficha de trabajo y consulta académica S4. | S4-A | Flujo de búsqueda y ficha visible. |
| S4-05 | Reglas, versiones y validación de rúbricas. | S4-B | Pruebas de máximos y versión utilizada. |
| S4-06 | Editor/consulta de rúbricas S4. | S4-A | Validaciones UI conectadas al backend. |
| S4-07 | Programar/reprogramar sesiones, soporte a s4.programacion\_estudiante (participantes) y registrar cambios. | S4-B | API que conserva ID; varias sesiones por trabajo; trazabilidad con motivo. |
| S4-08 | Cronograma y agenda por permisos. | S4-A | Pantalla de consulta/programación funcional. |
| S4-09 | Crear, guardar y cerrar evaluaciones con validaciones. | S4-B | API con estados y cierre confirmado. |
| S4-10 | Formulario de evaluación y revisión de faltantes. | S4-A | Notas/observaciones y subtotales operativos. |
| S4-11 | Cálculo consolidado, resultados y reglas de precisión. | S4-B | Pruebas unitarias de redondeo comercial (HALF\_UP): 9,445→9,45; 9,446→9,45 |
| S4-12 | Seguimiento, estados y resultados en pantallas. | S4-A | Estados coherentes con API; sin notas ficticias. |
| S4-13 | Generación de PDFs y archivo con permisos. | S4-B | Acta/rúbrica PDF a partir de cierre real. |
| S4-14 | Pantalla de documentos, auditoría de lectura y módulo de justificativos de corrección. | S4-A | Descarga/consulta según autorización y visualización de respaldos PDF en /storage/auditoria/justificativos/. |
| S4-15 | APK tribunal con Capacitor y entrada separada. | S4-A | APK instalable con acceso al flujo S4. |
| S4-16 | Persistencia local, sync idempotente y conflictos. | S4-A | Recuperación offline y sincronización probadas; S4-B apoya API. |
| S4-17 | Pruebas end-to-end, seguridad y correcciones. | S4-B | Flujos de aceptación ejecutados; S4-A revisa y apoya. |

El orden real permite trabajo paralelo: por ejemplo, S4-A puede desarrollar las pantallas con contratos simulados mientras S4-B desarrolla la API. Antes de marcar “Terminado”, ambas partes deben funcionar integradas.

## 4.1. Estado de las tareas (12/11/2026)

Estado funcional en la rama `feature/mer-unificado-pasos-3-4`. Según la sección 7, ninguna tarea cuenta como «Terminado» hasta tener su PR fusionado: todavía no hay issues ni PR en GitHub.

| **Estado** | **Tareas** |
| --- | --- |
| Hecha en la rama | S4-01, S4-02, S4-03, S4-04, S4-05, S4-06, S4-07, S4-08, S4-10, S4-11, S4-12, S4-14, S4-16 |
| Parcial | **S4-09:** guardar y cerrar solo en modo de desarrollo, sin identidad real. **S4-13:** actas sin códigos académicos reales. **S4-15:** la APK funciona, pero sin entrada propia del tribunal. |
| Pendiente | **S4-17:** pruebas de aceptación de extremo a extremo y revisión de seguridad. |

Detalle y orden sugerido: [docs/s4/PENDIENTES.md](../PENDIENTES.md).

# 5. GitHub: organización del trabajo S4

## 5.1. Repositorio, ramas y solicitudes de integración

Se utilizará el repositorio único de la solución. S4 modificará sus carpetas definidas en el Paso 4; los archivos globales se revisarán con el responsable de integración del repositorio.

|  |
| --- |
| main # Rama integrada y estable  feature/s4-05-rubricas-api # Ejemplo: tarea de S4  feature/s4-06-rubricas-ui # Ejemplo: tarea de S4  fix/s4-11-redondeo # Correccion de regla de notas  docs/s4-paso5-plan # Documentacion S4 |

| **Regla** | **Aplicación práctica** |
| --- | --- |
| Una tarea = un issue | Código S4-xx, objetivo, checklist, criterios de aceptación y responsable. |
| Una rama por cambio | Abrir desde la base acordada; sin commits directos a main. |
| PR revisado | Vincular issue, describir rutas tocadas, pruebas, imágenes si hay UI y efecto en BD. |
| Revisión cruzada | S4-A revisa la integración que expone S4-B, y viceversa; nadie aprueba su propio PR cuando haya dos integrantes. |
| Cambios globales | App.tsx, app.module.ts, auth, shared/common, paquetes y migraciones compartidas requieren revisión del responsable de integración. |
| Secretos y datos | Nunca incluir claves, tokens ni datos reales de estudiantes en GitHub. |

## 5.2. Tablero S4 en GitHub Projects

| **Estado** | **Se usa cuando...** |
| --- | --- |
| Por hacer | Existe el issue, dependencia y criterio de aceptación. |
| En progreso | Tiene owner, rama de trabajo y primera implementación. |
| En revisión | Existe PR, las pruebas locales pasan y otro integrante revisa. |
| Bloqueado | Falta un dato o cambio externo; se documenta qué impide seguir y una alternativa de prueba. |
| Terminado | PR fusionado; verificación y evidencia registradas. |

Etiquetas propuestas: s4, frontend, backend, android, database, integracion, prueba, bug, bloqueo. El tablero organiza las tareas S4 y no impone obligaciones a S1–S3.

## 5.3. Plantilla corta para cada issue

|  |
| --- |
| ID: S4-xx | Modulo: MF-xx o CT-xx  Objetivo: que debe poder hacer el usuario o el sistema  Responsable: S4-A / S4-B  Carpetas: rutas de frontend/backend afectadas  Dependencias: issue o dato de S2/S3 que se consulta  Criterios de aceptacion: 2 a 5 comprobaciones observables  Evidencia: PR, prueba, captura, respuesta API o PDF |

# 6. Entregas de S4 y dependencias

Las entregas son hitos verificables, no fechas prometidas. Se aprueban en secuencia lógica; varias tareas de una misma etapa pueden ejecutarse en paralelo. La coordinación S4 asignará fechas reales una vez conocida la disponibilidad del equipo.

| **Hito** | **Qué entrega S4** | **Prerequisito / validación** |
| --- | --- | --- |
| E0 · Base de desarrollo | Rutas del módulo, API S4 compilable, datos de prueba y tablero de issues. | Repositorio compartido accesible; build de frontend y backend. |
| E1 · Contexto y rúbricas | Consultas MF-01; versionado/validación MF-02; permisos S4 iniciales. | Trabajo y tribunal de prueba; no duplicar administración S2/S3. |
| E2 · Cronograma | Crear/consultar/reprogramar sustentaciones con auditoría de fecha. | Lectura de tribunal; usar programación S4 como calendario oficial. |
| E3 · Evaluación operativa | Registrar, recuperar y cerrar escrita/oral en API y web. | Rúbrica válida; evaluador autorizado; cierre servidor. |
| E4 · Tablet y recuperación | APK del tribunal; autoguardado local; reintentos y conflictos controlados. | Flujo E3 disponible; cierre definitivo solo en línea. |
| E5 · Resultados y seguimiento | Motor de cálculo, estados y consultas consolidadas. | Evaluaciones confirmadas; pruebas de precisión y pendientes. |
| E6 · Documentos y trazabilidad | PDFs, archivo, consulta autorizada y auditoría de correcciones. | Resultados finales válidos; documentos no alteran notas. |
| E7 · Integración y demostración | Pruebas completas, correcciones, documentación y demostración S4. | Flujos web y APK consistentes en base de prueba. |

## 6.1. Qué se entrega en cada hito

**•** Un enlace al PR fusionado y al issue cerrado de cada tarea comprometida.

**•** Una demostración verificable: pantalla, endpoint, archivo PDF o instalación de APK, según corresponda.

**•** Evidencia de pruebas, indicando qué se probó y qué todavía no está disponible.

**•** Una nota de integración cuando se modifica un contrato o una estructura compartida.

**•** Lista corta de errores abiertos, sin presentar un avance parcial como entrega final.

## 6.2. Qué no bloquea el desarrollo de S4

Mientras el backend compartido se integra, S4 puede usar datos de prueba consistentes con el MER para desarrollar su lógica. No se debe inventar una segunda tabla oficial de trabajos, tutores, tribunales o sustentaciones. Al integrarse los datos reales, solo se reemplazan adaptadores o configuraciones previstas.

# 7. Condiciones para cerrar una tarea y una entrega

| **Control** | **Criterio de aceptación** |
| --- | --- |
| Código integrado | El PR está fusionado, compila y mantiene funcionando rutas ajenas a S4. |
| Responsabilidad | El módulo escribe solo tablas bajo responsabilidad S4; consulta datos de S2/S3 conforme al MER. |
| Permisos | Operaciones sensibles se validan en backend por usuario, carrera y tribunal, no solo en React. |
| Evaluación | Escrita compartida y oral individual según rúbrica; no existen duplicados indebidos. |
| Cronograma | Reprogramar conserva ID, usa la tabla asociativa s4.programacion\_estudiante y deja historial; no se recrea s3.defensa. |
| Notas | Cálculo mantiene precisión completa y muestra dos decimales aplicando la regla de redondeo comercial estándar (HALF\_UP, donde el tercer decimal ≥ 5 incrementa la centésima). |
| Sincronización | Un corte de Internet no borra el avance; reenvíos no duplican; conflictos no sobrescriben en silencio. |
| Cierre y documentos | Cierre solo con confirmación de servidor; PDFs se generan a partir de resultados cerrados; respaldos PDF de correcciones extraordinarias almacenados en /storage/auditoria/justificativos/. |
| QA y respaldo | Pruebas y evidencia adjuntas; entorno de desarrollo sin datos institucionales reales. |

# 8. Coordinación y tratamiento de bloqueos

La coordinación de S4 revisa el tablero con frecuencia acordada por el equipo. Cada integrante actualiza sus propias tareas; no se necesitan reuniones extensas si los issues y PR explican el estado.

| **Situación** | **Respuesta del equipo S4** |
| --- | --- |
| Falta una consulta de S2 o S3 | Continuar con datos de prueba y documentar exactamente tabla, columnas y permiso que se necesitan. |
| Un cambio afecta el MER | Preparar propuesta mínima, describir impacto sobre FKs y someter la modificación compartida a revisión antes de integrarla. |
| Una tarea no tiene revisor disponible | Registrar pruebas y conservar el PR abierto hasta revisión; no declarar entrega cerrada. |
| Aparece un error crítico | Crear issue bug, priorizar corrección, asociar el PR y repetir la prueba fallida. |
| Se cambia una prioridad | Reordenar los hitos del tablero sin modificar requisitos funcionales ya acordados. |

# 9. Primera sesión de trabajo en GitHub

Para comenzar sin bloquearse, el equipo S4 solo necesita ejecutar estas acciones:

**•** Verificar acceso al repositorio compartido y ubicar frontend/src/modules/s4-calificaciones y backend/src/modules/s4-calificaciones.

**•** Crear el tablero S4 y registrar S4-01 a S4-17, asignando una persona real a cada issue.

**•** Elegir al coordinador de S4 y acordar quién revisa PR de cada integrante.

**•** Abrir las primeras ramas S4-01 y S4-02; levantar frontend y backend sin alterar S1–S3.

**•** Registrar como pendientes técnicos las integraciones que aún no estén materializadas, sin detener los módulos independientes.

|  |
| --- |
| **RESULTADO DEL PASO 5**  Quedan definidos el reparto inicial de trabajo de Genares, las tareas por módulo, la colaboración mediante GitHub, las entregas E0–E7 y cómo verificar cada una. El siguiente trabajo ya es ejecución sobre S4, no volver a redefinir las responsabilidades de S1, S2 o S3. |

# 10. Referencias de continuidad

Paso 1: Especificación de requisitos S4. Paso 2: Módulos funcionales MF-01…MF-07 y componentes transversales CT-01…CT-03. Paso 3: Arquitectura y tecnologías. Paso 4: Estructura de carpetas y responsables. MER unificado y repositorio compartido de Gestión de Titulación.
# Control de cambios

| **Versión** | **Cambios** |
| --- | --- |
| 1.1 — 12/11/2026 | Tabla asociativa con su nombre del MER vigente, s4.programacion\_estudiante, en S4-07 y en el criterio de cronograma. Scripts SQL de S4 en lugar de migraciones. Nueva sección 4.1 con el estado de las tareas. El plan, los responsables, las reglas de GitHub y los hitos E0–E7 no cambian. |
| 1.0 — 02/11/2026 | Propuesta operativa para iniciar desarrollo. |
