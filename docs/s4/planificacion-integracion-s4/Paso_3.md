**PASO 03 / DISEÑO TÉCNICO**

GENARES

**Tecnologías y arquitectura del sistema**

Frontend • Backend • Base de datos • Comunicación

Sistema de gestión de evaluaciones de trabajos de titulación

|  |  |  |
| --- | --- | --- |
|  |  |  |

**DOCUMENTO** Paso 3 — Arquitectura tecnológica y comunicación

**ÁMBITO** S4 Genares integrado con S1, S2 y S3

**CARRERAS** Tecnologías de la Información y Software

**ESTADO** Diseño arquitectónico base para implementación

**FECHA** 2 de noviembre de 2026

**Criterio central**

Los cuatro subsistemas forman una sola solución: un repositorio compartido, un backend, una base de datos PostgreSQL y límites funcionales claros. Compartir tablas y claves foráneas no implica duplicar la administración de datos.

**Documentación de referencia:** Paso 1 (requisitos), Paso 2 (módulos funcionales), MER unificado actualizado y estructura del repositorio entregado.

Este documento fija la estructura técnica necesaria para construir Genares sin dividirlo en aplicaciones o bases de datos independientes. Las decisiones de implementación que aún no están cerradas se indican expresamente, sin cambiar el alcance funcional aprobado.

# 1. Propósito, alcance y decisiones de base

## 1.1. Objetivo

Definir cómo se construirán e integrarán el frontend, el backend, la base de datos y sus mecanismos de comunicación, tomando como base las funciones descritas en los Pasos 1 y 2 y el MER unificado de S1–S4.

## 1.2. Alcance de S4

Genares (S4) cubre las carreras de Tecnologías de la Información y Software. Consulta información académica y asignaciones creadas por otros subsistemas, administra rúbricas, evaluaciones y calificaciones, programa sustentaciones, sigue estados, genera documentos institucionales y mantiene auditoría.

|  |
| --- |
| **PRINCIPIO DE INTEGRACIÓN**  S1, S2, S3 y S4 funcionan como partes de una sola plataforma institucional. La separación en módulos organiza el código, los permisos y la responsabilidad de escritura; no supone bases de datos ni servidores independientes. |

## 1.3. Decisiones establecidas

| **Decisión** | **Definición adoptada** |
| --- | --- |
| Patrón general | Monolito modular; organización interna con Clean Architecture aplicada de forma práctica. |
| Frontend | React con TypeScript y Vite; interfaz administrativa web y APK Android únicamente para el tribunal de S4. |
| Backend | NestJS; TypeORM propuesto para persistencia PostgreSQL. |
| Persistencia | Una base PostgreSQL y un MER único, con esquemas gen, s1, s2, s3 y s4. |
| Comunicación | Clientes → API HTTP/JSON NestJS → base PostgreSQL; S3/S4 comparten datos mediante consultas del backend a la misma BD. |
| Identidad | S4 consume identidad/roles institucionales; no crea ni administra usuarios y roles institucionales. |

## 1.4. Relación con los documentos anteriores

El Paso 1 define qué debe hacer Genares y bajo qué reglas; el Paso 2 define quién implementa cada función; este Paso 3 define con qué tecnologías y cómo se conectan esas funciones. La actualización del prefijo físico de algunas tablas en el MER no modifica por sí sola las responsabilidades funcionales de los Pasos 1 y 2.

# 2. Visión general de la arquitectura

## 2.1. Vista lógica de la solución

Los clientes se conectan a un único backend, que concentra reglas de negocio, autorizaciones y acceso a la base de datos. Ningún cliente debe abrir conexiones directas a PostgreSQL.

| **CLIENTES** | **SERVIDOR DE APLICACIÓN** | **PERSISTENCIA** |
| --- | --- | --- |
| Web institucional React + TypeScript + Vite S1 / S2 / S3 / S4 | NestJS API HTTP/JSON Módulos S1–S4 + common | PostgreSQL Esquemas gen / s1 / s2 / s3 / s4 MER unificado |
| APK S4 tribunal React + Capacitor Evaluación y sincronización | Mismo backend NestJS Políticas de acceso y casos de uso S4 | Misma base de datos Sin duplicación de trabajos, tribunales ni cronograma |

Flujo: interfaz → controlador/API → caso de uso → repositorio de infraestructura → PostgreSQL. El resultado regresa por la misma API.

## 2.2. Responsabilidades entre subsistemas

| **Parte** | **Responsabilidad general** | **Qué utiliza S4** |
| --- | --- | --- |
| S1 | Verifica requisitos académicos de titulación. | Consulta información necesaria cuando corresponda. |
| S2 | Gestiona temas, estudiantes vinculados y tutores. | Consulta trabajos, estudiantes y tutor asignado. |
| S3 | Gestiona documentos académicos, trabajos en el MER actual y asignaciones de tribunal. | Consulta el trabajo evaluable y tribunal vigente. |
| S4 | Gestiona rúbricas, evaluaciones, notas, cronograma, resultados y documentos de calificación. | Registra únicamente las operaciones de su responsabilidad. |

La distinción entre responsable funcional y prefijo técnico se refleja en el MER actualizado: algunas tablas que originalmente aparecían bajo s4 fueron reubicadas a s2 o s3 sin eliminar las relaciones. S4 conserva sus claves foráneas hacia ellas.

# 3. Frontend

## 3.1. Tecnologías previstas y estado del repositorio

La base entregada contiene React y TypeScript con Vite. Las versiones se toman de los package.json del ZIP del repositorio y no de un README que conserva referencias a versiones anteriores.

| **Elemento** | **Situación documentada** | **Aplicación prevista** |
| --- | --- | --- |
| React + React DOM | Declarado en frontend/package.json: ^19.3.1. | Interfaces administrativas y vistas del tribunal. |
| TypeScript | Declarado: ~6.0.3. | Tipado de pantallas, contratos de API y lógica. |
| Vite | Declarado: ^8.3.4. | Desarrollo y compilación del frontend. |
| Enrutamiento / estado | React Router, Context API y hooks aparecen en el README; no como dependencias instaladas en el manifiesto examinado. | Integrar cuando se desarrollen pantallas y navegación. |
| Capacitor | Decisión de arquitectura para S4; no aparece instalado en la base examinada. | Empaquetado de la experiencia del tribunal en APK Android. |
| CSS / iconografía / alertas | Design system y bibliotecas propuestas en README; verificar e integrar dependencias al implementar. | Identidad visual institucional y experiencia consistente. |

## 3.2. Experiencias de uso

La web administrativa, accesible desde el navegador, incluirá las funciones de consulta, rúbricas, cronograma, seguimiento, resultados, documentos y auditoría de S4 según permisos. Las secciones visibles dependerán del rol; el catálogo de navegación está definido en el Paso 2.

La aplicación Android instalable es exclusiva del tribunal de S4. Reutiliza React y se distribuye con Capacitor como APK; no exige desarrollar una aplicación nativa independiente. Su interfaz priorizará rúbricas, calificación, observaciones, recuperación de avances y sincronización.

## 3.3. Organización del código frontend

Se conservará el repositorio compartido y la separación existente en src/modules. Cada módulo podrá usar domain, application, infrastructure y presentation; los recursos genéricos residirán en src/shared. No se deben crear capas vacías por obligación.

| **Ubicación lógica** | **Finalidad** |
| --- | --- |
| frontend/src/modules/s1-requisitos/ | Funciones de S1; mantenidas por su equipo. |
| frontend/src/modules/s2-temas/ | Funciones de S2; mantenidas por su equipo. |
| frontend/src/modules/s3-documentos/ | Funciones de S3; mantenidas por su equipo. |
| frontend/src/modules/s4-calificaciones/ | Dominio, casos de uso, adaptadores API y vistas S4. |
| frontend/src/shared/ | Componentes generales, estilos, utilidades y cliente HTTP compartidos. |
| Empaquetado Android de S4 (por organizar) | Configuración Capacitor y recursos Android aislados del resto de módulos. |

## 3.4. Identidad visual y accesibilidad

Se conservará una interfaz responsive con azul institucional (#123F68), azul profundo (#0B2D4C), teal (#0E7C72), ámbar (#D6A11D), superficies blancas y fondo #F3F6F9; se priorizará Inter con alternativas del sistema. Se usarán estados visibles, contraste apropiado, controles accesibles por teclado y tablas/formularios adaptables a tablets.

# 4. Backend

## 4.1. Plataforma y función

NestJS centralizará la API, la lógica de negocio y los controles de acceso. El ZIP actual declara @nestjs/common, @nestjs/core y @nestjs/platform-express ^11.0.1. TypeORM y el controlador PostgreSQL están previstos, pero su instalación no se considera realizada solo por aparecer en el README.

## 4.2. Organización de módulos y capas

| **Capa / espacio** | **Responsabilidad técnica** |
| --- | --- |
| domain | Entidades y reglas que no dependen de NestJS ni de PostgreSQL. |
| application | Casos de uso: registrar evaluación, cerrar, programar, reprogramar, calcular o generar documentos. |
| infrastructure | Adaptadores de persistencia TypeORM/SQL, clientes externos y almacenamiento documental. |
| presentation / controllers | Controladores REST, validación de solicitudes y formatos de respuesta. |
| backend/src/common/ | Errores, guardias, utilidades y componentes compartidos no específicos de una función. |
| backend/src/modules/s4-calificaciones/ | Implementación de reglas y operaciones propias de S4. |

Las clases de infraestructura pueden leer tablas administradas por otro equipo, por ejemplo s3.miembros\_tribunal, pero S4 no debe exponer acciones para asignar o sustituir miembros. El acceso al dato compartido se hace dentro del mismo backend y mediante la misma base.

## 4.3. Reglas transversales del backend

* Comprobar identidad y permisos en cada operación, no solo ocultar botones en React.
* Validar carrera (TI/Software), relación docente–tribunal, propiedad de evaluación y estado antes de modificar notas.
* Garantizar la consistencia de cierre con transacciones y evitar modificaciones ordinarias posteriores.
* Calcular con precisión decimal y mostrar dos decimales aplicando el redondeo comercial estándar (HALF\_UP), incrementando la centésima en una unidad si el tercer decimal es mayor o igual a 5.
* Registrar auditoría de cambios sensibles, incluyendo cierre, correcciones extraordinarias y reprogramaciones. En el caso de correcciones extraordinarias, el archivo justificativo en PDF se almacenará en la ruta local /storage/auditoria/justificativos/, registrando su ruta relativa, checksum e identificadores de aprobación en s4.eventos\_auditoria\_evaluacion.
* Entregar las respuestas de error y validación de manera consistente para web y APK.

# 5. Base de datos

## 5.1. Diseño de persistencia

Se utilizará una sola instancia lógica de PostgreSQL con el MER institucional unificado. Los esquemas gen, s1, s2, s3 y s4 separan tablas por ámbito, pero forman parte de la misma base, con relaciones mediante claves primarias y foráneas. La edición del diagrama no equivale a ejecutar cambios físicos en PostgreSQL.

## 5.2. Referencias de S4 al MER actualizado

| **Datos / tablas** | **Responsable** | **Uso desde S4** |
| --- | --- | --- |
| gen.persona, gen.estudiante, gen.docente, gen.carrera, gen.periodo\_academico, gen.tema | Compartido / módulos académicos | Contexto del expediente; lectura según permisos. |
| s2.estudiantes\_trabajo, s2.asignaciones\_tutor\_trabajo | S2 | Consultar integrantes y tutor del trabajo. |
| s3.trabajos\_titulacion | S3 en el MER vigente | Identificar el trabajo y su relación con las evaluaciones de S4. |
| s3.asignaciones\_tribunal, s3.miembros\_tribunal | S3 | Comprobar tribunal asignado y evaluadores habilitados. |
| s4.programaciones\_sustentacion | S4 | Registrar y reprogramar la sustentación oficial, consultada también por S3. |
| s4.rubricas, s4.versiones\_rubrica y componentes | S4 | Definir instrumentos de evaluación y sus versiones. |
| s4.evaluaciones, s4.calificaciones\_evaluacion | S4 | Guardar calificaciones escritas/orales por evaluador y estudiante cuando corresponda. |
| s4.eventos\_trazabilidad\_trabajo, s4.actas\_archivadas y auditoría | S4 | Trazabilidad y documentos de calificación. |

Según el paquete MER\_unificado\_S2\_S3\_S4\_tablas\_ubicadas.zip, el diseño documentado contiene 79 tablas vigentes y 186 relaciones. Ese dato describe el MER entregado; no constituye una verificación de una base implementada.

## 5.3. Acuerdo de programación y tribunales

La fuente oficial de programación será s4.programaciones\_sustentacion. S4 la crea y actualiza, mientras S3 consulta las fechas. La estructura s3.defensa fue retirada del modelo operativo para evitar un calendario paralelo; sus antecedentes permanecen en las fuentes originales del MER. Los tribunales son asignados por S3 y consultados por S4.

## 5.4. Aspectos del diseño físico por concretar

Se elimina la restricción UNIQUE(id\_trabajo) de la tabla s4.programaciones\_sustentacion para permitir múltiples sesiones si fuera necesario. Se incorpora formalmente la tabla asociativa s4.estudiantes\_sesion\_sustentacion (id\_sesion, id\_estudiante) y la clave foránea desde s4.evaluaciones hacia la sesión oral, garantizando el soporte físico completo tanto para defensas conjuntas como para sesiones separadas.

La estrategia de migraciones, restricciones adicionales, permisos SQL y semillas de desarrollo se resolverá al comenzar la persistencia. Los cambios sobre una base real deberán ser versionados y no destructivos.

|  |
| --- |
| **REGLA DE DISEÑO**  No crear tablas paralelas para repetir información de S2 o S3. S4 almacena sus propios eventos, instrumentos, evaluaciones y documentos, y referencia por FK los datos maestros o académicos compartidos. |

# 6. Comunicación e integración

## 6.1. Flujo cliente–backend

1. El usuario autorizado abre la interfaz web o la APK S4.
2. El cliente solicita la operación a una API HTTP/JSON de NestJS.
3. El backend valida identidad, permisos, carrera, estado y reglas de negocio.
4. El caso de uso consulta o actualiza PostgreSQL y confirma la transacción.
5. La API devuelve datos o errores estructurados para actualizar la interfaz.

La ruta específica, autenticación, nombres de endpoints y contratos DTO se definirán durante la implementación, manteniendo un diseño consistente entre web y tablet.

## 6.2. Integración S3–S4 sin servicios duplicados

| **Necesidad** | **Origen de datos** | **Mecanismo** |
| --- | --- | --- |
| ¿Quién integra el tribunal de un trabajo? | s3.asignaciones\_tribunal y s3.miembros\_tribunal | Consulta de S4 desde backend a PostgreSQL. |
| ¿Cuándo está programada la sustentación? | s4.programaciones\_sustentacion | S4 escribe y S3 lee desde la misma BD. |
| ¿Quiénes integran el trabajo? | s2.estudiantes\_trabajo / s3.trabajos\_titulacion | Consulta de relaciones y claves foráneas. |
| ¿Qué nota tiene el estudiante? | s4.evaluaciones y calificaciones | Cálculo y consulta autorizada por backend S4. |

No se requiere una API S3→S4 para leer estas tablas si los módulos se ejecutan dentro del mismo backend y la misma base. Sí se exige delimitar qué módulo puede modificar cada dato.

## 6.3. Funcionamiento de APK sin conexión

El tribunal podrá continuar sobre evaluaciones previamente descargadas cuando pierda conectividad. El avance se guardará localmente con persistencia duradera, se recuperará tras cierre o recarga de la aplicación y se enviará al servidor al restablecer conexión.

* La APK identifica si una operación está pendiente, sincronizándose o confirmada por el servidor.
* Las operaciones de sincronización deben evitar duplicados y pérdidas de cambios; los conflictos no se sobrescriben silenciosamente.
* Cerrar una evaluación es una operación definitiva del servidor: una nota guardada localmente no se considera cerrada hasta confirmarse.
* La tecnología específica de almacenamiento local (por ejemplo, IndexedDB o SQLite integrado) y la política detallada de conflictos se elegirán al implementar la APK.

## 6.4. Seguridad de la comunicación

Las conexiones cliente–API utilizarán HTTPS en los entornos de despliegue. Los permisos se comprobarán en NestJS. Las credenciales de base de datos residirán en configuración del servidor; nunca en el frontend ni dentro de la APK. Se evitará incluir información académica sensible en registros del navegador y mensajes de error.

# 7. Correspondencia con la modularización del Paso 2

La arquitectura técnica proporciona soporte a los siete módulos funcionales y tres componentes transversales ya establecidos, sin redefinirlos ni transformarlos en diez aplicaciones independientes.

| **Identificador / módulo** | **Soporte principal de arquitectura** |
| --- | --- |
| MF-01 · Consultas académicas | Consultas backend a gen.\*, S2 y S3; pantallas de búsqueda y ficha académica. |
| MF-02 · Modalidades y rúbricas | Reglas de versión/ponderación; gestión de estructura de rúbricas en S4. |
| MF-03 · Registro y cierre | API de evaluaciones; validaciones; transacciones; soporte local de APK. |
| MF-04 · Cronograma | s4.programaciones\_sustentacion; consultas del tribunal S3; reprogramación trazada. |
| MF-05 · Seguimiento | Casos de uso que derivan estados desde datos confirmados. |
| MF-06 · Cálculo y resultados | Motor de precisión decimal en backend; vistas web de resultados. |
| MF-07 · Documentos | Generación y referencia de PDFs desde información cerrada. |
| CT-01 · Identidad/autorización | Consumir identidad institucional y validar permisos desde backend. |
| CT-02 · Persistencia/sincronización | Recuperación local de APK, reconciliación y confirmación remota. |
| CT-03 · Auditoría/trazabilidad | Registro de acciones sensibles y reprogramaciones. |

# 8. Criterios técnicos de calidad

## 8.1. Consistencia, disponibilidad y recuperación

* Las claves foráneas aseguran integridad entre tablas compartidas; las autorizaciones controlan quién puede escribir cada una.
* Las evaluaciones y la información de rúbricas deben conservar su versión de referencia para consulta histórica.
* Las interrupciones de conexión no deben eliminar el avance local de una evaluación; el servidor es la fuente definitiva del cierre.
* La aplicación debe diferenciar información parcial, pendiente y confirmada.

## 8.2. Pruebas y verificación

* Pruebas de reglas de cálculo, rangos y redondeo; incluir 9,445 → 9,45 y 9,446 → 9,45.
* Pruebas de autorización por rol, carrera, tribunal y dueño de evaluación.
* Pruebas de programación, reprogramación, conflictos y trazabilidad.
* Pruebas de escritura compartida frente a oral individual y recuperación/sincronización en tablets.
* Pruebas de integración de FKs y consulta desde S4 a tablas S2/S3.

El repositorio examinado incluye scripts Jest en el backend; la selección de herramientas de prueba del frontend y automatización de CI se concretará cuando las funcionalidades estén presentes.

# 9. Decisiones diferidas sin bloquear el desarrollo

| **Asunto** | **Situación y criterio** |
| --- | --- |
| Proveedor exacto de identidad y sesiones | Pendiente de integrar con el mecanismo institucional. S4 no administra usuarios. |
| Endpoints y contratos JSON | Pendientes de diseñar en los casos de uso concretos. |
| Manejo local APK y conflictos de sincronización | Pendiente de elección técnica; requisitos funcionales ya establecidos. |
| Migraciones y permisos SQL | Pendiente del trabajo de implementación de PostgreSQL. |
| Sesiones excepcionales separadas | Requisito funcional definido; falta adaptación puntual del MER (unicidad, participantes, relación oral). |
| Entornos, despliegue, pruebas automatizadas y monitoreo | Se concretarán durante implementación sin alterar arquitectura base. |

Estos pendientes son detalles técnicos de realización. No implican volver a definir los requisitos funcionales ni la división modular de los Pasos 1 y 2.

# 10. Resultado del Paso 3 y ruta inmediata

Queda seleccionada una arquitectura de monolito modular: frontend React/TypeScript/Vite, backend NestJS, persistencia PostgreSQL unificada y API HTTP/JSON. La web sirve a los roles administrativos y la APK Android de S4, empaquetada con Capacitor, atiende al tribunal. Los módulos comparten información por claves foráneas sin duplicar sus responsabilidades.

## 10.1. Criterios para iniciar desarrollo

* Conservar la estructura compartida de repositorio y la separación por módulos S1–S4.
* Desarrollar primero contratos de consulta de trabajo/estudiante/tribunal sobre el MER actual.
* Integrar TypeORM y conexión a PostgreSQL mediante configuración de backend.
* Implementar casos de uso de S4 según las prioridades del Paso 2.
* Resolver el ajuste del MER para sustentaciones separadas antes de programar ese flujo.
* Preparar la distribución Android del tribunal, incluidos almacenamiento local y sincronización.
* Validar las reglas con las pruebas de aceptación del Paso 1.

# Anexo A. Fuentes de referencia y vigencia

| **Documento / artefacto** | **Aplicación al Paso 3** |
| --- | --- |
| Paso 1 — Especificación de requisitos Genares | Funciones, reglas de negocio, requisitos no funcionales y aceptación. |
| Paso 2 — División en módulos funcionales y delimitación de responsabilidades | Siete MF, tres CT, alcance TI/Software y acuerdos S3/S4. |
| Sistema-de-Gestion-Titulacion-main.zip | Estructura del repositorio y dependencias declaradas en package.json; el README contiene propuestas que no siempre están instaladas. |
| MER\_unificado\_S2\_S3\_S4\_tablas\_ubicadas.zip | Ubicación actual de tablas y relaciones documentadas en Modelo\_datos.json, UBICACION\_TABLAS\_S2\_S3\_S4.md y CAMBIOS\_S3\_S4.md. |