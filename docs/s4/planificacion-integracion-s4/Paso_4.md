DOCUMENTACIÓN DE DISEÑO · PASO 04

GENARES

Estructura de carpetas y responsabilidades

Ubicación de componentes · Límites de modificación · Reglas para trabajar en un repositorio compartido

| **Documento** | **Cobertura** |
| --- | --- |
| Paso 4 — Organización del código | Frontend, backend, datos y APK Android de S4 |
| Sistema | Genares (S4), integrado con S1, S2 y S3 |
| Carreras | Tecnologías de la Información y Software |
| Base del diseño | Pasos 1, 2 y 3; repositorio y MER unificado entregados |
| Fecha / estado | 2 de noviembre de 2026 / estructura propuesta para implementación. **Versión 1.1 (12/11/2026):** nombres del MER vigente y estado real de la estructura (sección 2.1 y «Control de cambios»). |

|  |
| --- |
| **IDEA CENTRAL**  Todos trabajan en una sola solución, un solo backend y una sola base PostgreSQL. Cada equipo modifica su módulo; los componentes globales y los cambios al esquema compartido se revisan entre los equipos afectados. |

Este paso indica dónde debe vivir el código y quién es responsable de modificarlo. No obliga a renombrar carpetas existentes, ni modifica el ZIP o el MER, ni redefine los requisitos.

# 1. Qué resolvemos en el Paso 4

Convertimos las decisiones arquitectónicas del Paso 3 en rutas de trabajo concretas. La separación es organizativa, no física: S1, S2, S3 y S4 continúan formando un único sistema.

| **Ya estaba definido** | **Este paso agrega** |
| --- | --- |
| React + TypeScript + Vite; NestJS; PostgreSQL; API HTTP/JSON. | Carpetas, subcarpetas, responsables y reglas para modificarlas. |
| S4: web administrativa y APK del tribunal con Capacitor. | Entradas separadas para las interfaces, reutilizando la lógica de S4. |
| S2: temas y tutores; S3: trabajos y tribunales; S4: evaluaciones y cronograma. | Reglas de consulta/escritura y ubicación de los adaptadores hacia las tablas compartidas. |

# 2. Punto de partida real del repositorio

Se inspeccionó el ZIP «Sistema-de-Gestion-Titulacion-main.zip». Las carpetas siguientes YA existen y deben aprovecharse, en vez de rehacer el proyecto:

|  |
| --- |
| Sistema-de-Gestion-Titulacion-main/  |-- frontend/  | |-- src/main.tsx, App.tsx  | |-- src/modules/{s1-requisitos,s2-temas,s3-documentos,s4-calificaciones}/  | |-- src/shared/  | `-- package.json  |-- backend/  | |-- src/main.ts, app.module.ts  | |-- src/modules/{s1-requisitos,s2-temas,s3-documentos,s4-calificaciones}/  | |-- src/auth/, common/, config/database.ts  | `-- package.json  `-- docs/ |

En el frontend, S4 ya tiene domain/, application/useCase/, infrastructure/, presentation/ y routes.tsx. En el backend sus carpetas están preparadas, pero todavía no incluyen todas las capas y funciones. El documento propone ampliaciones conforme se implementen; NO afirma que ya existan.

# 2.1. Estado real de la estructura (12/11/2026)

| **Parte** | **Cómo quedó** | **Respecto de este documento** |
| --- | --- | --- |
| Módulo frontend S4 | `domain/`, `infrastructure/`, `presentation/` (pages, components, hooks, services, layouts) y `routes.jsx`, en JavaScript (JSX). | Coincide. No se creó `application/` porque no hizo falta, como permite la sección 4.1. |
| Módulo backend S4 | Una carpeta por función: `rubricas/`, `trabajos/`, `evaluaciones/`, `sustentaciones/`, `seguimiento/`, `finalizacion/`, `documentos/`, `correcciones/`, `auditoria/`… Cada una con su controlador, servicio, reglas y pruebas. | Distinto de las capas propuestas en 5.1. Se mantiene, porque 5.1 es una propuesta gradual y las reglas del módulo prohíben reorganizar solo por estética. |
| Aplicación del tribunal | Capacitor instalado; `frontend/android/` y `capacitor.config.json` generados; APK de desarrollo funcionando. | **Pendiente.** La APK empaqueta toda la web. Falta la entrada propia `frontend/src/apps/tribunal/`, con navegación reducida (sección 4.2). |
| Cambios de base de datos | Scripts SQL manuales e idempotentes en `backend/fixtures/`, más la base de prueba en `docs/s4/base-datos-dev/`. | Sustituye a `backend/src/database/` (sección 6.1), porque no se usan migraciones automáticas (Paso 3, sección 5.4). |
| Justificativos PDF | `storage/auditoria/justificativos/` en la raíz del repositorio. | Coincide con la sección 6.1. |
| Documentación | `docs/s4/`: decisiones, instalación, validaciones, primeros pasos y pendientes. | Aún no existen `docs/architecture/` ni `docs/contracts/` para los acuerdos entre equipos. |

# 3. Vista global de carpetas

|  |
| --- |
| repositorio/  |-- frontend/ # Web institucional + entrada tablet S4  |-- backend/ # API unica y logica S1-S4  |-- docs/ # Acuerdos, arquitectura y contratos  |-- README.md # Instrucciones generales  `-- [archivos de configuracion actuales] |

Los scripts de migración y datos de prueba deberán quedar en una ubicación coordinada dentro del backend (propuesta: backend/src/database/). Esa ubicación es futura; no se creará por obligación antes de que exista la persistencia real.

# 4. Frontend: módulos y puntos de entrada

Todos los equipos comparten una aplicación React. Cada uno trabaja dentro de su módulo y puede utilizar src/shared sin duplicar componentes institucionales.

|  |
| --- |
| frontend/  |-- index.html # Entrada web (EXISTE)  |-- src/  | |-- main.tsx, App.tsx # Inicio/rutas globales (EXISTEN)  | |-- modules/  | | |-- s1-requisitos/ # Equipo S1  | | |-- s2-temas/ # Equipo S2  | | |-- s3-documentos/ # Equipo S3  | | `-- s4-calificaciones/ # Equipo S4  | |-- shared/ # UI/API genericas compartidas  | `-- apps/tribunal/ # POR CREAR: entrada APK S4  |-- tribunal.html # POR CREAR: entrada tablet S4  |-- capacitor.config.ts # POR CREAR al integrar Capacitor  `-- android/ # POR GENERAR: proyecto Android |

«POR CREAR» indica una propuesta del Paso 4, no un archivo ya existente. La configuración de empaquetado deberá producir una compilación específica para tribunal, no copiar toda la navegación administrativa a la APK.

# 4.1. Interior del módulo frontend de S4

|  |
| --- |
| frontend/src/modules/s4-calificaciones/  |-- domain/  | |-- entities/ # Modelos de rubricas y evaluaciones  | `-- repositories/ # Contratos de acceso a datos  |-- application/  | `-- useCase/ # Casos de uso por funcion S4  |-- infrastructure/  | |-- repositories/ # Implementaciones de contratos  | |-- api/ # POR CREAR: clientes HTTP S4  | |-- local/ # POR CREAR: borradores tablet  | `-- sync/ # POR CREAR: sincronizacion tablet  |-- presentation/  | |-- pages/ # Consultas, rubricas, evaluaciones...  | |-- components/ # Componentes exclusivos S4  | |-- hooks/ # Estado y logica de interfaz  | `-- services/ # EXISTE: no poner aqui BD/HTTP  `-- routes.tsx # Rutas del modulo S4 (EXISTE) |

No es necesario crear simultáneamente todos los directorios. Cada carpeta se añade cuando un componente real lo necesita. El estilo institucional que sirva a S1–S4 va en shared; un formulario de calificación específico pertenece a s4-calificaciones.

# 4.2. Aplicación del tribunal (solo S4)

|  |
| --- |
| frontend/src/apps/tribunal/ # POR CREAR  |-- main.tsx # Inicio exclusivo de la APK  |-- AppTribunal.tsx # Navegacion reducida  |-- pages/ # Agenda, evaluacion, recuperacion  `-- components/ # Controles exclusivos de tablet |

Las reglas de cálculo, contratos de evaluación y servicios de sincronización NO se copian aquí: se importan del módulo s4-calificaciones. La web y la APK consumen la misma API del backend.

# 5. Backend: estructura y capas

NestJS sigue siendo único. Cada equipo aporta casos de uso, controladores y adaptadores dentro de su módulo. El backend valida permisos, pertenencia al tribunal, estados y cierres, aunque React o la APK ya hayan validado la pantalla.

|  |
| --- |
| backend/src/  |-- main.ts, app.module.ts # Arranque e integracion global  |-- auth/ # Integracion identidad comun  |-- common/ # Errores, guards, utilidades  |-- config/database.ts # Configuracion BD existente  |-- modules/  | |-- s1-requisitos/ # Equipo S1  | |-- s2-temas/ # Equipo S2  | |-- s3-documentos/ # Equipo S3  | `-- s4-calificaciones/ # Equipo S4  `-- database/ # POR CREAR, coordinado |

# 5.1. Interior propuesto del módulo backend de S4

|  |
| --- |
| backend/src/modules/s4-calificaciones/  |-- domain/  | |-- entities/ # Conceptos y reglas del dominio  | `-- repositories/ # Interfaces de persistencia  |-- application/  | `-- use-cases/ # Programar, evaluar, calcular, cerrar...  |-- infrastructure/  | |-- persistence/ # ORM, consultas y repositorios  | |-- external/ # Adaptadores a servicios autorizados  | `-- documents/ # Generacion de PDF de evaluaciones  |-- presentation/  | `-- http/ # Controladores y DTO de la API  `-- s4.module.ts # Registro NestJS del modulo |

La estructura interna del backend de S4 es una propuesta de creación gradual. No requiere cambiar ni renombrar los directorios de S1–S3. Los controladores reciben solicitudes; los casos de uso aplican reglas; los repositorios interactúan con PostgreSQL.

# 5.2. Reglas simples entre capas

| **Capa** | **Puede hacer** | **No debe hacer** |
| --- | --- | --- |
| domain | Reglas del negocio, entidades, contratos. | Importar React, NestJS, TypeORM o SQL. |
| application | Coordinar casos de uso y verificar condiciones. | Depender directamente de controladores/UI. |
| infrastructure | HTTP, SQL/ORM, almacenamiento local, PDF. | Decidir por sí sola las reglas académicas. |
| presentation | Pantallas React o controladores HTTP. | Conectar directamente a PostgreSQL. |

# 6. Base de datos: una sola, con responsabilidades

La ubicación de una tabla en S2, S3 o S4 indica quién administra sus registros; NO significa que estén en bases distintas. Los módulos consultan por claves foráneas y consultas del backend.

| **Dato / entidad en MER actualizado** | **Escribe / administra** | **Consulta** |
| --- | --- | --- |
| s2.asignacion\_tema; s2.grupo\_integrante; s2.asignacion\_tutor | S2 | S3 y S4 según permisos (la asignación de tema identifica el trabajo evaluable) |
| s3.asignacion\_tribunal; s3.miembros\_tribunal; s3.docente\_carrera\_periodo | S3 | S4 para verificar evaluadores |
| s4.procesos\_evaluacion | S4 | Enlaza cada asignación de S2 con su versión de rúbrica |
| s4.programaciones\_sustentacion; s4.programacion\_estudiante | S4 | S3 y otros módulos autorizados |
| s4.rubricas, s4.evaluaciones y calificaciones | S4 | Módulos autorizados a consultar |

Nota de alcance: el MER más reciente reubicó cinco tablas entre S2/S3. La documentación de código debe ajustarse a esos nombres de diseño; si existe una base física con nombres anteriores, su adecuación se hará mediante migraciones coordinadas, no simplemente moviendo archivos.

# 6.1. Ubicación recomendada de artefactos de base de datos

|  |
| --- |
| backend/src/database/ # POR CREAR  |-- migrations/ # Cambios versionados del esquema  |-- seeds/ # Datos de prueba; nunca produccion  `-- README.md # Reglas, ejecucion y responsables  storage/ # POR CREAR `-- auditoria/ `--  justificativos/ # Archivos PDF respaldos de correcciones extraordinarias (RF-36)`  docs/  |-- architecture/ # POR CREAR: decisiones de diseño  `-- contracts/ # POR CREAR: acuerdos S1-S4 |

Regla: cada equipo propone los cambios que necesita en sus entidades. El responsable de integración revisa toda migración que afecte otras tablas. Nunca se usa sincronización destructiva automática de TypeORM sobre una base institucional.

|  |
| --- |
| **PUNTO IMPORTANTE**  La tabla s3.defensa se retiró del MER operativo de diseño. s4.programaciones\_sustentacion es el calendario oficial. Ya está implementado en la base de desarrollo: no hay restricción de una sola sesión por trabajo, los participantes se registran en la tabla asociativa s4.programacion\_estudiante (programacion\_sustentacion\_id, id\_estudiante) y cada evaluación oral apunta a su sesión (s4.evaluaciones.id\_programacion\_sustentacion). Así se cubren las defensas conjuntas y las sesiones separadas. Queda por acordar con S3 qué hacer con las referencias antiguas a s3.defensa. |

# 7. Dónde van los siete módulos funcionales de S4

La ruta base del frontend es frontend/src/modules/s4-calificaciones y la del backend es backend/src/modules/s4-calificaciones. Las carpetas siguientes se crearán conforme se desarrollen las funciones.

| **Módulo del Paso 2** | **Frontend S4 / presentation/pages** | **Backend S4 / application/use-cases** |
| --- | --- | --- |
| MF-01 Consultas e integración | consultas/ | consultas/ (lectura de S2 y S3) |
| MF-02 Modalidades y rúbricas | rubricas/ | rubricas/ |
| MF-03 Registro/cierre de evaluaciones | evaluaciones/ | evaluaciones/ |
| MF-04 Cronograma y sustentaciones | cronograma/ | cronograma/ |
| MF-05 Seguimiento y finalización | seguimiento/ | seguimiento/ |
| MF-06 Cálculo y resultados | resultados/ | resultados/ |
| MF-07 Documentos institucionales | documentos/ | documentos/ |

# 7.1. Componentes transversales de S4

| **Componente** | **Ubicación principal** | **Regla** |
| --- | --- | --- |
| CT-01 Identidad y permisos | backend/src/auth + common; controles S4 en su módulo | Identidad externa; S4 valida acceso sin gestionar usuarios institucionales. |
| CT-02 Guardado local y sincronización | frontend/.../s4-calificaciones/infrastructure/{local,sync}; backend S4 | Solo tribunal; cambios pendientes hasta confirmación del servidor. |
| CT-03 Auditoría y trazabilidad | backend/.../s4-calificaciones/{application,infrastructure}; BD S4; /storage/auditoria/justificativos/ | Registra acciones, reprogramaciones y almacena archivos PDF justificativos de correcciones extraordinarias (RF-36). |

Ejemplos concretos: Editor de rúbricas → presentation/pages/rubricas y application/useCase/rubricas. Guardado de evaluación oral → presentation/pages/evaluaciones + infrastructure/local + backend/application/use-cases/evaluaciones. PDF del acta → backend/infrastructure/documents.

# 8. Quién modifica cada carpeta

| **Carpeta o archivo** | **Responsable de edición** | **Condición** |
| --- | --- | --- |
| frontend/src/modules/s1-requisitos/; backend/src/modules/s1-requisitos/ | Equipo S1 | Los demás equipos los consumen, no los editan directamente. |
| frontend/src/modules/s2-temas/; backend/src/modules/s2-temas/ | Equipo S2 | Dueño de funciones académicas S2. |
| frontend/src/modules/s3-documentos/; backend/src/modules/s3-documentos/ | Equipo S3 | Dueño de documentos y asignación de tribunales. |
| frontend/src/modules/s4-calificaciones/; backend/src/modules/s4-calificaciones/ | Equipo S4 | Dueño de rúbricas, calificaciones y cronograma. |
| frontend/src/apps/tribunal/; frontend/android/; configuración Capacitor | Equipo S4 | Solo APK tribunal; cambios globales de build requieren revisión. |
| frontend/src/shared/; backend/src/common/; backend/src/auth/ | Compartido | Revisión del responsable de integración y equipos afectados. |
| frontend/src/App.tsx, main.tsx; backend/src/app.module.ts, main.ts | Integración del repositorio | Coordinar rutas, registro de módulos y configuración. |
| backend/src/config/database.ts; migrations/; package.json y archivos raíz | Integración + equipo proponente | Cambios de esquema/dependencias necesitan revisión cruzada. |
| docs/architecture/; docs/contracts/ | Integración, con aportes de cada equipo | Mantener acuerdos actualizados y trazables. |

«Integración» es una responsabilidad de coordinación, no un quinto subsistema ni necesariamente una persona nueva. Puede asumirla quien mantenga el repositorio compartido.

# 9. Reglas de colaboración sin burocracia

**•** Trabaja dentro de tu carpeta de módulo. Si necesitas un dato de otro equipo, consúmelo mediante la API y/o consultas del backend a la base unificada; no copies su módulo.

**•** Un cambio en shared/, common/, auth/, las rutas globales, dependencias o configuración de base requiere revisión de los equipos afectados antes de fusionarlo.

**•** S4 no crea estudiantes, no asigna tutores y no asigna tribunales. Sus acciones sobre el cronograma, rúbricas y evaluaciones sí pertenecen a S4.

**•** No se renombra ni elimina una tabla compartida para acomodar un archivo de código. Se actualiza el MER y se coordina la migración física cuando corresponda.

**•** Cada funcionalidad incorpora su UI, caso de uso, adaptador y pruebas correspondientes; no se crean carpetas vacías solo para llenar el árbol.

**•** Las ramas y solicitudes de integración deben describir: objetivo, rutas tocadas, contrato de datos afectado y verificación ejecutada.

# 10. Orden práctico para empezar a usar esta estructura

| **Orden** | **Acción** | **Resultado** |
| --- | --- | --- |
| 1 | Conservar el repositorio actual; no regenerar React ni NestJS. | Punto de partida común intacto. |
| 2 | Configurar S4 dentro de sus directorios actuales, añadiendo capas backend solo cuando se necesiten. | S4 aislado funcionalmente. |
| 3 | Crear consultas backend de lectura hacia las tablas de S2/S3 definidas en el MER. | Datos para las pantallas S4 sin duplicación. |
| 4 | Implementar casos de uso y pantallas por MF-01…MF-07. | Avance trazable al Paso 2. |
| 5 | Preparar la entrada tribunal y Capacitor cuando exista el flujo de evaluación. | APK aislada de la web administrativa. |
| 6 | Añadir scripts SQL revisados (backend/fixtures/) y pruebas con revisión cruzada cuando existan cambios físicos. | Base unificada protegida. |

# 11. Criterio de cierre del Paso 4

El Paso 4 queda diseñado cuando cada componente de Genares tenga una ruta propuesta, S1–S4 conozcan los límites de edición, los puntos globales estén identificados y la APK no mezcle sus pantallas con las administrativas. No se requiere ejecutar migraciones ni construir todavía todas las carpetas para cerrar esta fase.

|  |
| --- |
| **RESULTADO**  La estructura aprovecha el repositorio existente, conserva la independencia de los cuatro equipos, reutiliza las mismas entidades de PostgreSQL y deja el código de S4 listo para crecer sin rehacer los Pasos 1, 2 o 3. |

# 12. Tres ejemplos para ubicar archivos sin confundirse

| **Funcionalidad** | **Lugar del código S4** | **Quién lo modifica** |
| --- | --- | --- |
| Programar sustentación | Frontend: presentation/pages/cronograma/; backend: application/use-cases/cronograma/ y persistence/. | Equipo S4; consulta tablas de S3 sin editarlas. |
| Calificar desde una tablet | APK: apps/tribunal/pages/; lógica: módulo S4/evaluaciones/; borrador y sincronización: infrastructure/{local,sync}. | Equipo S4, con validaciones obligatorias en el backend. |
| Generar acta de evaluación | Frontend: presentation/pages/documentos/; backend: application/use-cases/documentos/ + infrastructure/documents/. | Equipo S4; consulta únicamente los datos autorizados. |
| Corrección extraordinaria de nota | Frontend: presentation/pages/auditoria/; backend: application/use-cases/auditoria/; adjunto: /storage/auditoria/justificativos/. | Equipo S4; registra motivo, guarda PDF y audita la acción. |

# 13. Lista breve de comprobación antes de crear un archivo

**•** ¿Es exclusivo de S4? Colócalo dentro de s4-calificaciones o apps/tribunal.

**•** ¿Lo usarán varios sistemas? Propónlo en shared o common y pide revisión.

**•** ¿Cambia una tabla o configuración global? Documenta el impacto y coordina la integración.

**•** ¿Pertenece a S2 o S3? Consúmelo, no copies su lógica ni su información.

# Control de cambios

| **Versión** | **Cambios** |
| --- | --- |
| 1.1 — 12/11/2026 | Nueva sección 2.1 con el estado real de la estructura. Tabla de la sección 6 y «Punto importante» con los nombres del MER vigente: s2.asignacion\_tema, s3.asignacion\_tribunal, s4.programacion\_estudiante y s4.procesos\_evaluacion, en lugar de s2.estudiantes\_trabajo, s3.trabajos\_titulacion y s4.estudiantes\_sesion\_sustentacion. Cambios de base mediante scripts SQL en lugar de migraciones. La propuesta de carpetas y las reglas de colaboración no cambian. |
| 1.0 — 02/11/2026 | Estructura propuesta para implementación. |

# Referencias utilizadas

Paso 2: modularización y responsabilidades de S4; Paso 3: tecnologías y arquitectura; ZIP de código Sistema-de-Gestion-Titulacion-main.zip; MER\_unificado\_S2\_S3\_S4\_tablas\_ubicadas.zip y su archivo UBICACION\_TABLAS\_S2\_S3\_S4.md.