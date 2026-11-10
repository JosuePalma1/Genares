DOCUMENTACIÓN DE DISEÑO · PASO 2

GENARES

División en módulos funcionales
y delimitación de responsabilidades

Sistema de gestión de evaluaciones de trabajos de titulación

|  |
| --- |
| **FINALIDAD DE ESTE DOCUMENTO**  Definir lo que desarrolla S4, la información que consulta de S3 y de los datos compartidos, y los contratos técnicos que siguen pendientes, incorporando la decisión de propiedad del cronograma. |

| **Control del documento** | **Detalle** |
| --- | --- |
| Etapa | Paso 2 — Modularización funcional y responsabilidades |
| Versión / fecha | 1.1 — acuerdos S3/S4 · 2 de noviembre de 2026 |
| Ámbito académico | Carreras de Tecnologías de la Información (TI) y Software |
| Base de análisis | Especificación de requisitos de Genares v1.0 (48 RF, 18 RNF, 30 RN); MER unificado revisado; conversación recibida del equipo S3. |
| Estado | Modularización actualizada: responsables funcionales confirmados; detalles físicos del MER y otros contratos por validar. |

Criterio rector: una función tiene un único responsable operativo; compartir datos no equivale a duplicar su administración.

# Resumen ejecutivo y decisión de avance

La distribución funcional S3/S4 quedó aclarada por comunicación del equipo: S3 asigna los tribunales y sus integrantes; S4 crea, administra y reprograma el cronograma de sustentaciones. S3 consultará s4.programaciones\_sustentacion, y S4 consultará las asignaciones de tribunal en la base de datos unificada. Queda pendiente revisar las relaciones físicas y validar los contratos con el resto de los equipos.

| **Clasificación** | **Decisión de trabajo** |
| --- | --- |
| PROPIO DE S4 | Modalidades y rúbricas; programación, cronograma y reprogramación de sustentaciones; evaluaciones escritas y orales; guardado, sincronización, estados, resultados, PDF y auditoría de S4. |
| CONSUMIDO DE OTROS | Identidad, roles y ámbitos institucionales; estudiantes, docentes, carreras, períodos y trabajos; asignaciones iniciales y miembros de tribunal gestionados por S3. |
| PENDIENTE TÉCNICO | Cardinalidad de sesiones, participantes por sesión, claves externas oral/sesión y ajustes a la relación de tribunal. Acordar tratamiento físico de s3.defensa sin duplicar escrituras. |
| FUERA DEL ALCANCE | Gestión de usuarios/roles institucionales, inscripción y proceso integral de titulación, asignación inicial de tribunales, firma electrónica y escritura automática de notas en SGA. |

|  |
| --- |
| **ACUERDO DE EQUIPOS**  S3 registra asignaciones y miembros de tribunal. S4 crea y reprograma sustentaciones en s4.programaciones\_sustentacion; S3 consulta esta misma tabla. No duplicar s3.defensa como un segundo calendario oficial. Los cambios de estructura del MER siguen sujetos a revisión técnica conjunta. |

# 1. Bases, alcance y criterios de separación

## 1.1. Fuentes consideradas

* Especificación de requisitos de Genares v1.0, fechada el 2 de noviembre de 2026: 48 requisitos funcionales (RF-01 a RF-48), 18 no funcionales (RNF-01 a RNF-18), 30 reglas de negocio (RN-01 a RN-30) y 18 pruebas de aceptación (PA-01 a PA-18).
* Archivo MER\_unificado\_revisado.zip: catálogos, relaciones y reglas del modelo integrado. Es un modelo documental; la existencia de tablas o cardinalidades en el diagrama no prueba que las migraciones físicas ya se hayan ejecutado.
* Conversación posterior comunicada por el usuario: S3 asumirá la asignación inicial de tribunales; S4 administrará el cronograma de sustentaciones; ambos equipos reutilizarán s4.programaciones\_sustentacion como fuente de sesiones.
* Decisiones del equipo de Genares comunicadas por el usuario: el acceso académico se limita a TI y Software, y la administración institucional de roles no la desarrollará S4.

## 1.2. Principios de modularización

* Dividir por responsabilidad académica y comportamiento, no por nombres de tablas o pantallas.
* Mantener cada requisito funcional asignado a un módulo responsable principal; señalar componentes colaboradores.
* No implementar en S4 funciones con dueño institucional externo. Solo consumir información y aplicar autorizaciones dentro de S4.
* No duplicar las sustentaciones entre s3.defensa y s4.programaciones\_sustentacion; el uso compartido de la tabla de S4 está acordado, aunque su implementación técnica y la adecuación de s3.defensa siguen por revisar.
* Permitir pruebas autónomas con una base temporal o esquema de desarrollo poblado con seeders, sin convertir datos de prueba en maestros de producción.
* Usar control de cambios cuando una decisión contradiga la especificación de requisitos vigente.

## 1.3. Alcance geográfico/académico

Genares atiende únicamente las carreras TI y Software. Los permisos se validarán con los identificadores de esas carreras recibidos del MER; no se presupone un número fijo de registros ni se codifican IDs directamente en la lógica. La referencia previa a “siete carreras” debe corregirse formalmente en el RF-04 y en la sección de actores de la especificación del Paso 1.

# 2. Propiedad de funciones y límites entre equipos

| **Proceso / dato** | **Responsable de negocio** | **Genares (S4)** | **Estado** |
| --- | --- | --- | --- |
| Usuarios, altas y bajas | Sistema institucional por definir | No administra; consume identidad | Externo |
| Roles institucionales y asignaciones | Sistema institucional por definir | No crea roles; valida permisos de S4 | Externo |
| Carreras, estudiantes, docentes y períodos | Módulos maestros integrados | Consulta y valida pertenencia | Externo |
| Trabajos y vinculación de estudiantes | Responsable académico por confirmar | Consulta; no crea duplicados académicos | Por acordar |
| Asignación inicial de tribunal | S3 | Consulta tribunal, integrantes y funciones; no asigna | Externo |
| Modalidades y rúbricas de evaluación | S4 | Crea, versiona y activa | Propio |
| Evaluación escrita, compartida/individual | S4 | Registra, protege y cierra | Propio |
| Evaluación oral por estudiante/evaluador | S4 | Registra contra sesión válida | Propio |
| Programación y horario de sustentación | S4 | Crea sesiones y administra el cronograma | Propio |
| Reprogramación e historial de fechas | S4 | Reprograma con trazabilidad en S4 | Propio |
| Cronograma general de titulación | Sistema académico por definir | No administra de oficio | Por acordar |
| Estados de evaluación por estudiante/trabajo | S4 | Calcula seguimiento de sus etapas | Propio |
| Consolidación de calificaciones | S4 | Calcula y publica según permisos | Propio |
| PDF de rúbrica y acta de calificación | S4 | Genera y archiva PDFs permitidos | Propio |
| Notas registradas en SGA | SGA / integración posterior | No escribe automáticamente | Fuera |
| Auditoría de evaluaciones S4 | S4 | Conserva modificaciones confirmadas | Propio |

|  |
| --- |
| **SIGNIFICADO DE “HISTÓRICO”**  No confundir: S4 es dueño del historial de evaluaciones, correcciones y resultados que genere. El historial de fechas de sustentación queda bajo S4, como responsable de programar y reprogramar; S3 puede consultarlo según permisos y contrato. |

# 3. Catálogo de módulos del sistema

El siguiente catálogo consta de siete módulos funcionales y tres componentes transversales. No implica diez aplicaciones, diez bases de datos ni diez elementos obligatorios en el menú.

| **Código** | **Nombre** | **RF principal / papel** |
| --- | --- | --- |
| MF-01 | Consultas académicas e integración de expedientes | RF-09 a RF-13 |
| MF-02 | Modalidades y rúbricas | RF-14 a RF-21 |
| MF-03 | Registro y cierre de evaluaciones | RF-26 a RF-28, RF-33 a RF-36 |
| MF-04 | Cronograma, programación y sustentaciones | RF-46 y RF-48 |
| MF-05 | Seguimiento, estados y finalización | RF-22 a RF-25 y RF-41 |
| MF-06 | Motor de cálculo y consulta de resultados | RF-38 a RF-40 y RF-42 |
| MF-07 | Documentos institucionales | RF-43 a RF-45 |
| CT-01 | Identidad y autorización de S4 | RF-01 a RF-08 |
| CT-02 | Persistencia local y sincronización | RF-29 a RF-32 y RF-47 |
| CT-03 | Auditoría y trazabilidad | RF-37; soporte a RF-36 |

# 4. Fichas funcionales por módulo

## MF-01 — Consultas académicas e integración de expedientes

RF principales: RF-09, RF-10, RF-11, RF-12, RF-13

**Objetivo.** Ofrecer a los actores autorizados la información académica necesaria para localizar trabajos, conocer integrantes, modalidades, tribunal, tutor y antecedentes.

Funciones y subfunciones:

* Consultar trabajos del ámbito TI o Software y sus estudiantes vinculados.
* Consultar personas, docentes, carreras, períodos, tema y tutor sin duplicar maestros.
* Consultar desde la base unificada la asignación de tribunal y sus integrantes registrados por S3.
* Buscar trabajos históricos combinando carrera, período, modalidad, estudiante, tema, tutor y estado.
* Validar existencia y consistencia del trabajo, estudiantes, tribunal y versión de rúbrica antes de habilitar una evaluación.

**Entradas y dependencias.** Entidades compartidas gen.\*; s4.trabajos\_titulacion, s4.estudiantes\_trabajo, s4.asignaciones\_tribunal, s4.miembros\_tribunal; tablas de tribunal gestionadas por S3 (lectura).

**Salida / producto.** Ficha/consulta del trabajo y estudiante; contexto validado para módulos MF-03, MF-04 y MF-05.

**Exclusiones.** No inscribe estudiantes, no crea cuentas, no designa el tribunal inicial y no modifica procesos académicos de S3.

**Verificación mínima.** Un docente no puede abrir un trabajo fuera de su autorización; no se habilita evaluación sin tribunal válido.

## MF-02 — Modalidades y rúbricas

RF principales: RF-14 a RF-21

**Objetivo.** Gestionar instrumentos institucionales de calificación y sus versiones aplicables a cada modalidad.

Funciones y subfunciones:

* Catálogo extensible de modalidades: Implementación, Sistematización de Experiencias, Artículo Científico y otras futuras.
* Crear y editar versiones de rúbrica en borrador; configurar etapas, categorías, indicadores, máximos, obligatoriedad, alcance compartido o individual y orden.
* Validar ponderaciones y escala final antes de activar.
* Vincular versión vigente a modalidad/período/ámbito; inmovilizar versión usada y permitir retiro para futuros usos.
* Mostrar letras por categoría y números reiniciados por indicador.

**Entradas y dependencias.** Información del período y carreras desde gen.\*; tablas s4.rubricas, s4.versiones\_rubrica, s4.etapas\_rubrica, s4.categorias\_rubrica, s4.indicadores\_rubrica.

**Salida / producto.** Versiones activas inmutables y estructura evaluable para MF-03 y MF-06.

**Exclusiones.** No crea evaluaciones en nombre del tribunal; no obliga a incluir anexos si una rúbrica no los define.

**Verificación mínima.** Una versión con evaluaciones no cambia; una rúbrica inconsistente no se activa.

## MF-03 — Registro y cierre de evaluaciones

RF principales: RF-26 a RF-28; RF-33 a RF-36

**Objetivo.** Permitir al tribunal registrar, revisar y cerrar sus notas y observaciones de manera independiente y segura.

Funciones y subfunciones:

* Crear o recuperar evaluación por evaluador, trabajo, etapa y destinatario conforme a la rúbrica.
* Escrita compartida: una evaluación por trabajo y evaluador cuando la rúbrica así lo establezca; oral: evaluación individual por estudiante/evaluador.
* Registrar indicadores, observaciones, subtotales y faltantes; resaltar obligatorios incompletos.
* Validar máximos y completitud; permitir cierre solo confirmado por servidor.
* Bloquear edición ordinaria tras cierre y tramitar corrección extraordinaria con autorización, motivo, documento y auditoría.

**Entradas y dependencias.** MF-01, MF-02, MF-04 para oral; CT-01, CT-02 y CT-03; tablas s4.evaluaciones, s4.calificaciones\_evaluacion.

**Salida / producto.** Evaluaciones confirmadas y cerradas que alimentan cálculo, seguimiento y documentos.

**Exclusiones.** No modifica las notas de otros evaluadores y no programa la sesión oral.

**Verificación mínima.** Con dos estudiantes y escrita compartida se crea un registro por evaluador; cada oral identifica estudiante, evaluador y sesión.

## MF-04 — Cronograma, programación y sustentaciones

RF principales: RF-46 y RF-48

**Objetivo.** Administrar sesiones y reprogramaciones oficiales de S4, mostrar el cronograma al tribunal y vincular cada evaluación oral con su sesión y participantes.

Funciones y subfunciones:

* Crear y administrar s4.programaciones\_sustentacion con trabajo, fecha, hora, sala, duración, estado y participantes válidos.
* Mostrar “Mis sustentaciones” y el cronograma filtrado por permisos y tribunal asignado por S3.
* Reprogramar la sesión existente conservando su ID y guardando fecha anterior, nueva fecha, responsable y motivo.
* Admitir sesión conjunta para dos estudiantes o sesiones excepcionales separadas del mismo trabajo.
* Vincular cada evaluación oral con sesión, estudiante y evaluador; detectar conflictos de horario antes de confirmar.

**Entradas y dependencias.** s4.programaciones\_sustentacion y s4.eventos\_trazabilidad\_trabajo bajo escritura de S4; miembros de tribunal de S3 por lectura; asociación participante–sesión y FK oral por implementar.

**Salida / producto.** Cronograma oficial, sesiones reprogramables con historial y referencia estable de sesión para evaluaciones orales.

**Exclusiones.** No asigna ni sustituye integrantes de tribunal; no gestiona el cronograma general de titulación ni mantiene un segundo calendario en s3.defensa.

**Verificación mínima.** A puede finalizar su oral y B quedar pendiente en otra sesión; reprogramar conserva ID y emite auditoría; no se permite solapamiento del mismo tribunal.

## MF-05 — Seguimiento, estados y finalización

RF principales: RF-22 a RF-25, RF-41

**Objetivo.** Mostrar el avance normativo de cada estudiante y el estado agregado del trabajo en función de evidencias confirmadas.

Funciones y subfunciones:

* Calcular ocho estados: Registrado, Tribunal asignado, Revisión escrita pendiente, Revisión escrita completada, Sustentación programada, Sustentación pendiente, Evaluación completada y Finalizado.
* Aplicar condiciones de transición y omitir etapas que no corresponden a la rúbrica.
* Mantener progreso independiente por estudiante y agregado del trabajo según el menor avance pendiente.
* Mostrar evaluadores, etapas, sesiones y bloqueos; autorizar cierre administrativo solo con todos los estudiantes completos y PDFs requeridos archivados.

**Entradas y dependencias.** MF-01, MF-03, MF-04, MF-06, MF-07; eventos confirmados de servidor.

**Salida / producto.** Panel de seguimiento e indicadores de bloqueo por estudiante y trabajo.

**Exclusiones.** No controla por sí mismo la inscripción ni fija cronograma general de titulación.

**Verificación mínima.** A completo y B con oral pendiente: A está completo, el trabajo no; ninguna nota local sin confirmar habilita finalización.

## MF-06 — Motor de cálculo y consulta de resultados

RF principales: RF-38 a RF-40, RF-42

**Objetivo.** Calcular resultados consistentes según la versión de rúbrica y presentar su precisión normativa.

Funciones y subfunciones:

* Calcular aportes por evaluador y componente comparable, diferenciando unidad trabajo y estudiante.
* Promediar evaluadores requeridos sin convertir pendientes en cero.
* Consolidar aportes según ponderaciones por versión; la rúbrica documentada aporta escrita 5 + oral 5 = 10.
* Conservar precisión decimal exacta en operaciones intermedias.
* Presentar dos decimales aplicando la regla de redondeo comercial estándar (HALF\_UP), incrementando la centésima en una unidad si el tercer decimal es mayor o igual a 5; diferenciar parcial, pendiente y definitivo.

**Entradas y dependencias.** Evaluaciones confirmadas MF-03; alcance y máximos MF-02; ámbitos CT-01.

**Salida / producto.** Notas y consolidaciones consultables para MF-05 y MF-07.

**Exclusiones.** No escribe notas al SGA, no aplica HALF\_UP ni inventa una etapa de anexos.

**Verificación mínima.** 9,445→9,45; 9,446→9,45; 9,444→9,44. Instrumento escrito 4,20/5 + oral 4,50/5 da 8,70/10.

## MF-07 — Documentos institucionales

RF principales: RF-43 a RF-45

**Objetivo.** Generar, proteger y archivar los documentos institucionales previstos a partir de evaluaciones confirmadas.

Funciones y subfunciones:

* Generar PDF de rúbrica según versión vigente de la evaluación, con indicadores, máximos y subtotales.
* Generar acta interna de calificación con datos, fecha/hora, componentes, resultado /10 y espacios de firmas.
* Normalizar componentes para exhibición /10 sin sumar indebidamente 20 puntos.
* Registrar referencia al PDF, versión, estudiante, trabajo y fecha; controlar acceso por rol y carrera.

**Entradas y dependencias.** MF-01, MF-02, MF-03, MF-06 y CT-01/CT-03; tablas s4.actas\_archivadas y documentos referenciados.

**Salida / producto.** PDFs autorizados archivados y disponibles para consulta histórica.

**Exclusiones.** No firma electrónicamente, no aprueba automáticamente trámites y no registra notas en SGA.

**Verificación mínima.** Generar PDF no cambia ninguna calificación ni reemplaza la evaluación original.

## CT-01 — Integración de identidad y autorización

RF principales: RF-01 a RF-08 (RF-04 y RF-08 requieren alineación de texto)

**Objetivo.** Consumir la identidad institucional y garantizar que todas las acciones de Genares estén autorizadas en el servidor.

Funciones y subfunciones:

* Reconocer sesión/identidad y roles proporcionados externamente.
* Aplicar permisos específicos por operación, carrera, tribunal y propiedad de evaluación.
* Aplicar acceso de Comisión, Presidencia/Asistencia, Coordinación, Secretaría y Tribunal sin crear roles institucionales.
* Simular usuarios, roles y ámbitos TI/Software con seeders solo en pruebas.

**Entradas y dependencias.** Proveedor de identidad y tablas gen.usuario, gen.usuario\_rol, gen.rol, gen.usuario\_carrera y permisos; sujeto a contrato real.

**Salida / producto.** Contexto de actor y política de autorización para todos los módulos.

**Exclusiones.** No implementa CRUD de usuarios ni administración institucional de roles; estudiantes no acceden como usuarios.

**Verificación mínima.** La API deniega una operación aunque el cliente la muestre o se altere la URL.

## CT-02 — Persistencia local y sincronización

RF principales: RF-29 a RF-32, RF-47

**Objetivo.** Proteger el avance del tribunal durante recargas, pérdida de conexión y acceso desde distintas tablets.

Funciones y subfunciones:

* Autoguardar online y mantener cambios persistentes locales offline para evaluaciones ya descargadas.
* Recuperar y mostrar diferencias entre datos locales pendientes y última confirmación remota.
* Sincronizar operaciones con identificador idempotente y versión base.
* Rechazar sobrescritura silenciosa; preservar ambas versiones en conflicto.
* Separar “guardado local”, “confirmado en servidor”, “sincronizando” y “conflicto”.

**Entradas y dependencias.** MF-03 y servicios de servidor; almacenamiento local persistente de la tablet, cola idempotente y revisión/versionado.

**Salida / producto.** Borradores seguros con estado de sincronización verificable.

**Exclusiones.** No permite cierre definitivo offline, crear/reprogramar sesiones ni generar PDFs institucionales sin servidor.

**Verificación mínima.** Recarga offline recupera cambios locales y el reenvío duplicado aplica una sola vez.

## CT-03 — Auditoría y trazabilidad

RF principales: RF-37; participa en RF-36

**Objetivo.** Registrar cambios confirmados en Genares y conservar evidencia verificable de correcciones y cierres.

Funciones y subfunciones:

* Auditar acción, actor, momento, antes/después y contexto de operaciones sobre evaluaciones.
* Mantener registro histórico de solicitudes, aprobaciones y modificaciones extraordinarias.
* Proteger auditorías de edición ordinaria y permitir consulta autorizada.
* Registrar en S4 los cambios de fechas y horarios de s4.programaciones\_sustentacion, además de la auditoría de evaluaciones.

**Entradas y dependencias.** MF-03, MF-02, MF-05 y CT-01; s4.eventos\_auditoria\_evaluacion y s4.eventos\_trazabilidad\_trabajo según operación y acuerdo.

**Salida / producto.** Evidencia trazable de modificaciones aceptadas por S4.

**Exclusiones.** No modifica ni duplica la asignación de tribunales gestionada por S3.

**Verificación mínima.** Una nota cerrada corregida conserva valor previo, adjunto justificativo y autores de aprobación/cambio.

# 5. Dependencias y contratos de integración

Los contratos siguientes describen la información mínima que Genares necesita. No se asume que exista ya una API, endpoint o migración con esos nombres. El equipo integrador deberá confirmar tecnología, disponibilidad, autorización, versionado y correspondencia de identificadores.

| **Contrato lógico** | **Proveedor / operación** | **Datos mínimos para S4** | **Regla de dependencia** |
| --- | --- | --- | --- |
| CI-01 Identidad | Institucional; consumo | ID actor, roles/atributos, carreras autorizadas, vigencia. | El servidor valida permisos; seeders solo en desarrollo. |
| CI-02 Maestros | MER; lectura | Estudiante, docente, carrera, período, tema/trabajo, estudiantes del trabajo. | No duplicar entidades de origen. |
| CI-03 Tribunal | S3; lectura | Trabajo, asignación activa, miembros, función, identificador de docente, vigencia. | No abrir evaluación sin tribunal válido. |
| CI-04 Sesiones | S4; escritura propia y lectura S3 | ID de sesión, trabajo, participantes, fecha/hora, sala, estado, historial. | S4 es fuente oficial; S3 consulta; soportar sesiones conjuntas y separadas. |
| CI-05 Resultados | S4; publicación eventual | Resultado consolidado/estado, unidad evaluada y versión. | Cualquier lectura desde S3 exige acuerdo y permisos. |
| CI-06 SGA | No aplica en línea base | Ninguno para escritura automática. | Fuera del alcance actual. |

## 5.1. Riesgos de la base unificada

* El MER del 24 de octubre aún contiene s3.defensa y s4.programaciones\_sustentacion. Se acordó usar la tabla S4 para el cronograma; falta definir el tratamiento de relaciones antiguas de s3.defensa sin eliminar referencias útiles unilateralmente.
* En el MER, la relación documentada s4.programaciones\_sustentacion ↔ trabajo es 0..1; esto no cubre todavía varias sesiones de una bina. Hay que definir participantes y cardinalidad antes de las migraciones definitivas.
* s4.evaluaciones dispone de identificadores de trabajo, estudiante y evaluador, pero el esquema fuente examinado no incluye una FK explícita hacia sesión. Su necesidad deriva del RF-46 y requiere coordinación.
* Aunque las tablas s4.asignaciones\_tribunal y s4.miembros\_tribunal figuren en el esquema S4 del MER, el acuerdo funcional asigna su gestión a S3; S4 solo las consulta. No renombrarlas automáticamente sin revisar migraciones.
* Una tabla ubicada en s4 no obliga a que S4 sea propietario funcional de todos sus datos. La propiedad se decide por operación y contrato de integración.

# 6. Acuerdo de cronograma y gestión del historial

## 6.1. Dos conceptos que no deben confundirse

| **Concepto** | **Contenido** | **Propuesta actual** |
| --- | --- | --- |
| Cronograma general de titulación | Fases, plazos y actividades del proceso académico completo. | Fuera de administración de S4; dueño pendiente. |
| Agenda de sustentaciones | Sesiones concretas, participantes, fecha, hora, lugar, tribunal y reprogramaciones. | S4 administra; S3 consulta. |
| Estados de evaluación | Escrita pendiente/cerrada, oral pendiente/cerrada, estudiante completo, trabajo finalizado. | Propiedad propia de S4. |
| Historial de reprogramaciones | Cambio de fecha/hora, responsable, causa y vigencia. | S4 registra cambios en su trazabilidad. |
| Historial de evaluaciones | Cierre, cambios autorizados, versión de rúbrica, valor antes/después. | Propiedad de S4. |

## 6.2. Política de implementación acordada

* Construir en S4 la creación y consulta de sesiones, cronograma por tribunal y acceso a evaluación oral; utilizar datos de prueba de S3 mientras no esté disponible la asignación real.
* Implementar en S4 programación y reprogramación sobre su tabla oficial; no modificar unilateralmente tablas de S3 ni su asignación de tribunales.
* Mantener RF-48 como requisito propio de S4, confirmado por la decisión entre equipos; registrar dicha confirmación como precisión de integración.
* Completar el diseño de participantes de sesión y de la referencia oral–sesión para permitir binas conjuntas o separadas.
* S3 consultará s4.programaciones\_sustentacion como fuente común; el contrato de lectura y el tratamiento de s3.defensa deben verificarse en migraciones.

|  |
| --- |
| **LÍMITE DE LA CONFIRMACIÓN**  La distribución de responsabilidades está comunicada y acordada funcionalmente. Sigue pendiente revisar tablas, claves, restricciones, permisos y migraciones efectivas; el acuerdo no implica que esas modificaciones ya estén implementadas. |

# 7. Decisiones cerradas y verificaciones técnicas pendientes

| **ID / prioridad** | **Decisión que falta** | **Quién debe responder** | **Impacto en S4** |
| --- | --- | --- | --- |
| D-01 / Cerrada | S4 programa y reprograma; S3 consulta el cronograma. | S3 + S4 | RF-48 propio; fuente s4.programaciones\_sustentacion. |
| D-02 / Cerrada | Ambos equipos utilizarán s4.programaciones\_sustentacion; revisar legado s3.defensa. | S3 + S4 | No duplicar sesiones; adecuación física pendiente. |
| D-03 / Cerrada | Incorporación de la tabla asociativa s4.estudiantes\_sesion\_sustentacion (id\_sesion, id\_estudiante) y eliminación de la restricción UNIQUE(id\_trabajo) en s4.programaciones\_sustentacion para soportar sesiones conjuntas y separadas. | S4 + integrador | RF-46, RF-48, RN-28; soporte técnico confirmado. |
| D-04 / Cerrada | S3 registra asignaciones e integrantes; validar columnas, vigencia y cambios. | S3 + S4 | RF-10 y RF-23: consumo de información de S3. |
| D-05 / Media | Contrato de identidad, roles y permisos por carrera. | Equipo de identidad | RF-01, RF-08; CT-01. |
| D-06 / Media | Quién crea y actualiza trabajos y estudiantes asociados. | Equipo dueño del proceso | RF-09, RF-11; referencia académica. |
| D-07 / Técnica | S4 almacena el historial; definir detalle JSON, permisos y lectura por S3. | S4 + S3 | s4.eventos\_trazabilidad\_trabajo; evento por cambio. |
| D-08 / Baja | Si S3 consultará resultados de S4 y con qué permisos. | S3 + S4 | Posible contrato de lectura futuro. |

Regla para cerrar un acuerdo: responsable de escritura, origen/identificador, cardinalidades, permisos de lectura, actualización y eventos, manejo de errores, validación con caso conjunto/separado y versión del contrato.

# 8. Desarrollo autónomo con MER y seeders

La independencia temporal no requiere simular las interfaces de los demás sistemas. Se necesita una base de desarrollo fiel a los identificadores y relaciones que consume S4, más adaptadores para contratos aún no aprobados.

## 8.1. Preparación técnica recomendada

1. Congelar una copia versionada del MER unificado para desarrollo; documentar qué tablas son compartidas, propias de S4 o simuladas. No usar el diagrama como SQL ejecutable sin traducir y validar sus restricciones.
2. Crear scripts reproducibles de base temporal PostgreSQL para las tablas mínimas necesarias. Separar migraciones propias de S4 de datos maestros de prueba o estructuras de compatibilidad externas.
3. Implementar seeders deterministas para dos carreras (TI y Software), períodos, trabajos con uno y dos estudiantes, docentes, cuentas simuladas, roles/permisos y tribunales asignados.
4. Crear proveedores falsos de identidad y tribunal; la programación oficial se implementa en S4 y se prueba con sus propios datos y sesiones simuladas.
5. Probar los módulos con datos suficientes para modalidades/rúbricas diferentes, escrita compartida, oral conjunta y separada, notas pendientes, cierres, PDF, offline y conflictos.
6. Cuando exista contrato real, ejecutar pruebas de integración con la fuente compartida y retirar o aislar por completo los seeders de desarrollo en producción.

## 8.2. Datos de prueba mínimos

| **Escenario** | **Datos simulados** | **Resultado esperado** |
| --- | --- | --- |
| TI / Software | Dos carreras y usuarios con distintos ámbitos. | Sin accesos cruzados no autorizados. |
| Trabajo individual | 1 trabajo, 1 estudiante, tribunal asignado. | Evaluación escrita y oral válida. |
| Bina conjunta | 1 trabajo, 2 estudiantes, una sesión y 2 evaluadores. | Una escrita por evaluador; oral por estudiante y evaluador. |
| Bina separada | 1 trabajo, 2 estudiantes, sesiones diferentes. | A completa su oral aunque B no la haya sustentado. |
| Rúbricas distintas | Versión 5+5 y otra versión con etapas distintas. | Cálculo por ponderación; no se obliga anexos. |
| Sin conexión | Evaluación precargada; cambios locales y dos tablets. | Recuperación, reintento idempotente y conflictos. |
| Protección | Evaluación cerrada y solicitud de corrección. | No hay modificación sin autorización y traza. |
| Cambio de agenda | S4 reprograma una sesión con motivo. | Se conserva ID y queda evento de historial con antes/después. |

# 9. Matriz de trazabilidad: 48 requisitos funcionales

La asignación es de RESPONSABLE PRINCIPAL de implementación. “Dependiente” significa que S4 desarrolla parte del comportamiento pero necesita información externa; “Propio” indica la operación cuyo desarrollo asume S4. No elimina los RF de la línea base.

| **RF** | **Denominación de línea base** | **Principal** | **Estado** |
| --- | --- | --- | --- |
| RF-01 | Identificación de usuarios | CT-01 | Dependiente |
| RF-02 | Autorización por operación | CT-01 | Propio |
| RF-03 | Acceso de Comisión Académica | CT-01 | Propio |
| RF-04 | Acceso de Presidencia/Asistencia | CT-01 | Alinear TI/Software |
| RF-05 | Acceso de Coordinación | CT-01 | Propio |
| RF-06 | Acceso del tribunal | CT-01 | Propio |
| RF-07 | Consulta de Secretaría | CT-01 | Propio |
| RF-08 | Administración y permisos | CT-01 | Ajustar: externo |
| RF-09 | Lectura del MER unificado | MF-01 | Dependiente |
| RF-10 | Recepción de tribunales | MF-01 | Dependiente |
| RF-11 | Validación de relaciones | MF-01 | Dependiente |
| RF-12 | Consulta histórica | MF-01 | Propio |
| RF-13 | Búsqueda histórica | MF-01 | Propio |
| RF-14 | Catálogo de modalidades | MF-02 | Propio |
| RF-15 | Gestión de rúbricas autorizada | MF-02 | Propio |
| RF-16 | Estructura de rúbricas | MF-02 | Propio |
| RF-17 | Etapas por modalidad | MF-02 | Propio |
| RF-18 | Validación de ponderaciones | MF-02 | Propio |
| RF-19 | Versiones y vigencia | MF-02 | Propio |
| RF-20 | Conservación de versiones utilizadas | MF-02 | Propio |
| RF-21 | Identificación en la interfaz | MF-02 | Propio |
| RF-22 | Estados por estudiante y trabajo | MF-05 | Propio |
| RF-23 | Tribunal asignado de origen externo | MF-05 | Dependiente |
| RF-24 | Transiciones controladas | MF-05 | Propio |
| RF-25 | Panel de seguimiento | MF-05 | Propio |
| RF-26 | Registro independiente por evaluador | MF-03 | Propio |
| RF-27 | Evaluaciones compartidas e individuales | MF-03 | Propio |
| RF-28 | Observaciones de evaluación | MF-03 | Propio |
| RF-29 | Guardado automático | CT-02 | Propio |
| RF-30 | Recuperación del último avance | CT-02 | Propio |
| RF-31 | Sincronización confirmada | CT-02 | Propio |
| RF-32 | Visibilidad del estado de guardado | CT-02 | Propio |
| RF-33 | Validación visual y subtotales | MF-03 | Propio |
| RF-34 | Verificación de completitud | MF-03 | Propio |
| RF-35 | Cierre individual confirmado | MF-03 | Propio |
| RF-36 | Inmutabilidad tras el cierre | MF-03 | Propio |
| RF-37 | Registro de auditoría | CT-03 | Propio |
| RF-38 | Promedio por conjunto comparable | MF-06 | Propio |
| RF-39 | Consolidación según ponderaciones | MF-06 | Propio |
| RF-40 | Precisión y redondeo estricto | MF-06 | Propio |
| RF-41 | Control de finalización individual y global | MF-05 | Propio |
| RF-42 | Consulta controlada de resultados | MF-06 | Propio |
| RF-43 | PDF de rúbrica institucional | MF-07 | Propio |
| RF-44 | PDF de acta interna | MF-07 | Propio |
| RF-45 | Acceso y archivo documental | MF-07 | Propio |
| RF-46 | Vinculación oral con sesión y estudiante | MF-04 | Dependiente |
| RF-47 | Conflictos de edición simultánea | CT-02 | Propio |
| RF-48 | Programación y reprogramación en S4 | MF-04 | Propio |

|  |
| --- |
| **RESULTADO DE COBERTURA**  48 de 48 RF tienen un módulo responsable de seguimiento. Eso no significa que todos estén listos para implementar sin dependencias: RF-04 y RF-08 requieren verificar alineación con la versión vigente del Paso 1; RF-01, RF-09 a RF-11, RF-23 y RF-46 dependen de contratos externos. |

# 10. Cobertura de RNF, reglas de negocio y aceptación

## 10.1. Requisitos no funcionales (18)

| **RNF** | **Aplicación principal** |
| --- | --- |
| RNF-01 Usabilidad | Todos los módulos con interfaz |
| RNF-02 Tablet del tribunal | MF-03, MF-04, CT-02 |
| RNF-03 Rendimiento | Todos; contratos y persistencia |
| RNF-04 Continuidad | CT-02 / infraestructura |
| RNF-05 Seguridad de comunicaciones | CT-01 / infraestructura |
| RNF-06 Autorización de servidor | CT-01, todos |
| RNF-07 Integridad referencial | MF-01 a MF-07 / base de datos |
| RNF-08 Exactitud decimal | MF-06 |
| RNF-09 Durabilidad del avance | CT-02 |
| RNF-10 Recuperación no destructiva | CT-02 |
| RNF-11 Compatibilidad | Interfaces, tablet y escritorio |
| RNF-12 Mantenibilidad | Arquitectura de todos los módulos |
| RNF-13 Interoperabilidad | MF-01, MF-04 y CT-01 |
| RNF-14 Accesibilidad práctica | Todas las pantallas |
| RNF-15 Trazabilidad protegida | CT-03 |
| RNF-16 Confidencialidad | CT-01, MF-06, MF-07 |
| RNF-17 Verificabilidad | Pruebas por módulo |
| RNF-18 Offline controlada | CT-02 y MF-03 |

## 10.2. Reglas de negocio (30)

| **RN** | **Tema** | **Módulo / dependencia** |
| --- | --- | --- |
| RN-01 | Validez previa | MF-01, CT-01 |
| RN-02 | Fijación de versión | MF-02, MF-03 |
| RN-03 | Modalidades distintas | MF-02 |
| RN-04 | Unidad de calificación | MF-03, MF-06 |
| RN-05 | Promedio comparable | MF-06 |
| RN-06 | Escala explícita | MF-06, MF-07 |
| RN-07 | Cierre de evaluación | MF-03, CT-02 |
| RN-08 | Bloqueo tras cierre | MF-03, CT-03 |
| RN-09 | No eliminación histórica | MF-02 |
| RN-10 | Carrera en Comisión | CT-01 |
| RN-11 | Restricción de rúbricas | CT-01, MF-02 |
| RN-12 | Auditoría de servidor | CT-03 |
| RN-13 | Separación de SGA | MF-06, MF-07 |
| RN-14 | Documentación condicionada | MF-07 |
| RN-15 | Escrita compartida | MF-03 |
| RN-16 | Oral por sesión | MF-03, MF-04 |
| RN-17 | Guardado no cierra | CT-02, MF-03 |
| RN-18 | Confirmación remota | CT-02 |
| RN-19 | Redondeo comercial estándar (HALF\_UP) | MF-06 |
| RN-20 | Instrumento 5+5 | MF-02, MF-06 |
| RN-21 | Documento inalterante | MF-07 |
| RN-22 | Idempotencia | CT-02 |
| RN-23 | Finalización por estudiantes | MF-05 |
| RN-24 | Propiedad de evaluación | MF-03, CT-01 |
| RN-25 | Evitar duplicados compartidos | MF-03 / DB |
| RN-26 | Integridad participante–sesión | MF-04, MF-03 |
| RN-27 | Reprogramación histórica | MF-04 / S4 |
| RN-28 | Sesiones distintas | MF-04 / S4 |
| RN-29 | Conflicto sin sobrescritura | CT-02 |
| RN-30 | Límite documental | MF-07 |

## 10.3. Pruebas de aceptación integrales (18)

| **Prueba** | **Objetivo** | **Módulos** |
| --- | --- | --- |
| PA-01 a PA-02 | Permisos por carrera y tribunal externo | CT-01, MF-01 |
| PA-03 a PA-04 | Versionado y rúbricas variables | MF-02 |
| PA-05 a PA-07 | Escrita compartida, oral conjunta y separada | MF-03, MF-04, MF-05 |
| PA-08 | Reprogramación con historial | MF-04 y CT-03; prueba propia de S4 |
| PA-09 a PA-13 | Guardado, offline, idempotencia, conflictos y cierre | CT-02, MF-03 |
| PA-14 a PA-15 | Calificación 5+5 y redondeo estándar (HALF\_UP) | MF-06 |
| PA-16 | Finalización del trabajo con PDFs | MF-05, MF-07 |
| PA-17 | Auditoría de correcciones | MF-03, CT-03 |
| PA-18 | Documentos y no escritura en SGA | MF-07 |

# 11. Plan de ejecución desde este documento

| **Orden** | **Entregable** | **Condición de salida** |
| --- | --- | --- |
| 2.1 | Catálogo de módulos | 7 módulos y 3 transversales identificados. |
| 2.2 | Fichas y límites | Objetivo, operaciones, entradas, salidas, exclusiones y pruebas por módulo. |
| 2.3 | Matriz de propiedad | Funciones propias, externas y pendientes separadas. |
| 2.4 | Trazabilidad | 48 RF, 18 RNF, 30 RN y 18 PA asignados. |
| 2.5 | Registro de acuerdos | D-01, D-02 y D-04 cerrados; restantes técnicos identificados. |
| Paso 3 | Arquitectura y contratos técnicos | Lectura de identidad/tribunal y escritura del cronograma S4. |
| Paso 4 | Base de datos de desarrollo | SQL del subconjunto requerido y validación de restricciones. |
| Paso 5 | Seeders y pruebas de integración simulada | Escenarios TI/Software y sustitución de proveedores simulados. |
| Paso 6 | Construcción incremental | Desarrollo de módulos independientes con tests verificables. |

## 11.1. Qué sí puede avanzar sin S3

MF-02 (rúbricas), MF-03 (escrita y lógica de oral sobre sesión simulada), MF-05 (estados), MF-06 (cálculo), MF-07 (documentos) y CT-02/CT-03 pueden diseñarse y probarse. MF-01 y CT-01 se construyen con contratos de lectura e identidad simulados. MF-04 crea, reprograma y consulta sesiones propias, con lectura simulada de los tribunales asignados por S3.

## 11.2. Qué queda por validar técnicamente

Quedan por diseñar y verificar la asociación participante–sesión, la FK física de evaluación oral hacia sesión, conflictos de horario, el acceso de lectura a tribunales de S3 y el tratamiento de las referencias de s3.defensa.

# 12. Control de cambios respecto del Paso 1

El acuerdo funcional S3/S4 está confirmado. Este documento no modifica automáticamente el Paso 1: se muestran diferencias respecto a la versión v1.0 examinada y verificaciones a cotejar con la actualización v1.1 comunicada por el equipo.

| **Referencia** | **Situación de la línea base** | **Tratamiento solicitado** |
| --- | --- | --- |
| Ámbito / RF-04 | Se menciona consulta de siete carreras. | Corregir a TI y Software; conservar el control de ámbitos y permisos. |
| RF-08 / actor Administración | La línea base incluye administrar cuentas/roles/parámetros. | Separar administración institucional externa de autorización S4; mantener permisos académicos propios donde apliquen. |
| RF-48 / RN-27 | La línea base asigna programación y reprogramación a S4. | Confirmado por los equipos: mantener en S4 la programación, el historial y la prueba PA-08. |
| RF-46 / RN-26 / RN-28 | Exigen relación oral–sesión–estudiante y sesiones separadas. | Mantener comportamiento funcional; acordar entidad, identificadores y participantes con el equipo de integración. |
| Contrato de datos / sección 7 | Se nombran tablas s4 de tribunal y programación. | S3 escribe tribunal, S4 consulta; S4 escribe sustentaciones, S3 consulta. Revisar cardinalidades y FK. |
| Cronograma general | No hay propiedad clara en S4. | No convertirlo en un módulo nuevo sin autorización de alcance. |

# 13. Criterio de cierre del Paso 2

* Está documentada la estructura de módulos, las funciones, los actores consumidores, las exclusiones y las dependencias.
* Los 48 RF tienen responsable principal y las reglas/transversales tienen rutas de implementación.
* No se asigna al equipo S4 administración de roles institucionales ni asignación inicial de tribunales.
* El sistema se restringe a TI y Software, sin dejar controles de acceso abiertos por defecto.
* La programación de sustentaciones y su historial pertenecen a S4, mientras S3 asume la asignación y actualización de tribunales.
* Existe una ruta para desarrollar y probar Genares con SQL/seeders temporales hasta disponer de contratos reales.
* Verificar que el Paso 1 vigente ya incluya TI y Software y excluya la administración institucional de roles; RF-48 permanece propio de S4.

Resultado: Paso 2 documentado y apto para avanzar al diseño de arquitectura, conservando pendientes técnicos de integración.

# ANEXO A. Matriz de navegación funcional de S4

**Estado:** Propuesta de navegación para el Paso 2. Define vistas y permisos esperados; no significa que las interfaces o las migraciones ya estén implementadas.

Objetivo. Traducir los siete módulos funcionales y tres componentes transversales del Paso 2 en opciones visibles, pantallas, operaciones y controles de acceso. El menú se construye según permisos efectivos de usuario y se limita a las carreras de Tecnologías de la Información (TI) y Software.

## A.1. Menú lateral propuesto y correspondencia con módulos

| **Opción principal** | **Alcance visual** | **Módulo responsable** |
| --- | --- | --- |
| **Inicio** | Panel personal de tareas y estados | MF-05, MF-06; CT-01 |
| **Trabajos de titulación** | Consulta de expedientes y datos académicos | MF-01 |
| **Cronograma** | Programaciones, sesiones e historial de reprogramaciones | MF-04; CT-03 |
| **Mis evaluaciones** | Calificar trabajos asignados y consultar cierres propios | MF-03; CT-02 |
| **Rúbricas** | Modalidades, instrumentos y versiones | MF-02 |
| **Seguimiento** | Avance de estudiantes y trabajos; cierre administrativo | MF-05 |
| **Resultados** | Consolidación, desglose e históricos autorizados | MF-06 |
| **Documentos** | PDF institucionales y archivo | MF-07 |
| **Auditoría** | Trazabilidad y correcciones excepcionales autorizadas | CT-03 |

**Regla de presentación:** “Mis evaluaciones” se muestra al tribunal asignado. “Auditoría” y las acciones de cierre/corrección solo se muestran con permisos explícitos. La sincronización, el cálculo y la autorización del servidor son transversales, no tres menús adicionales.

## A.2. Convenciones de acceso a pantallas

| **Convención** | **Quién / condición** |
| --- | --- |
| **Consulta autorizada** | Actor autenticado con permiso de lectura y ámbito de carrera vigente; no implica acceso a todos los registros. |
| **Tribunal asignado** | Docente integrante del tribunal vigente del trabajo, informado por S3; solo accede a sus propias evaluaciones. |
| **Programador autorizado** | Coordinación o Presidencia/Asistencia con permiso específico para programar o reprogramar en S4. |
| **Gestor de rúbricas** | Actor académico con permiso expreso de rúbricas. Tribunal y Secretaría excluidos; Administración técnica no lo recibe por defecto. |
| **Cierre autorizado** | Usuario con permiso específico de cierre administrativo, previa validación de estudiante, trabajo y documentos. |
| **Auditor autorizado** | Usuario expresamente autorizado para consultar auditoría o tramitar correcciones de notas cerradas. |

La visibilidad del menú es solo una ayuda. Cada consulta y cambio debe repetir la autorización en el servidor según identidad, permiso, carrera, tribunal, etapa y propiedad de la evaluación (RF-01 a RF-08).

## A.3. Pantallas, operaciones y RF por opción de menú

## A.3.1. Inicio

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **IN-01 · Resumen general** | Ver pendientes, próximos eventos, etapas bloqueadas y resultados permitidos. | Consulta autorizada | RF-22, RF-25, RF-42 |
| **IN-02 · Actividades pendientes** | Mostrar avisos de confirmación, cambios pendientes de sincronizar o conflictos; no es menú aparte. | Tribunal / usuario aplicable | RF-29–32, RF-47 |

**Origen y límites.** Datos: estados y resultados S4, cronograma S4, identidad externa; filtros por carrera y tribunal.

## A.3.2. Trabajos de titulación

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **TR-01 · Consultar trabajos** | Buscar y filtrar por carrera, período, modalidad, estudiante, tema, tutor y estado. | Consulta autorizada | RF-09, RF-12–13 |
| **TR-02 · Detalle del trabajo** | Ver estudiantes vinculados, tutor, rúbrica, tribunal asignado, sesiones y estado; acceso a subdetalles autorizados. | Consulta autorizada | RF-09–11, RF-22, RF-25 |
| **TR-03 · Estudiantes y tribunal asignado** | Consultar los estudiantes vinculados al trabajo de titulación, así como el tribunal asignado por S3, sus integrantes, funciones y estado de asignación. Esta información será únicamente de consulta y no podrá modificarse desde S4. | Consulta autorizada según carrera, rol y permisos | RF-09, RF-10, RF-11 |

**Origen y límites.** Datos: gen.persona, gen.estudiante, gen.docente, gen.carrera, gen.periodo\_academico y tablas de trabajos; tribunal de S3 en lectura. No se inscribe ni asigna tribunal.

## A.3.3. Cronograma

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **CR-01 · Calendario de sustentaciones** | Consultar por fecha, carrera, trabajo y tribunal; tribunal observa solo sus sesiones. | Consulta autorizada | RF-10, RF-46, RF-48 |
| **CR-02 · Programar sustentación** | Elegir trabajo con tribunal válido; fecha, hora, sala, duración y estudiantes participantes; validar solapamientos. | Programador autorizado | RF-11, RF-48 |
| **CR-03 · Detalle de sesión** | Consultar participantes, tribunal, estado y vínculo a evaluaciones orales disponibles. | Consulta autorizada | RF-46, RF-48 |
| **CR-04 · Reprogramar sesión** | Cambiar fecha/hora de sesión existente, con motivo y conservación de ID; validaciones de disponibilidad. | Programador autorizado | RF-48 |
| **CR-05 · Historial de reprogramación** | Mostrar valor anterior y nuevo, responsable, instante y motivo de cada modificación confirmada. | Consulta autorizada / auditor | RF-37, RF-48 |

**Origen y límites.** Datos: S4 escribe s4.programaciones\_sustentacion y s4.eventos\_trazabilidad\_trabajo; S3 administra y S4 lee tribunal. Relación participante–sesión pendiente de concretar en esquema físico.

## A.3.4. Mis evaluaciones

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **EV-01 · Bandeja de evaluaciones** | Ver evaluaciones asignadas, estado, fecha oral y progreso de guardado; abrir solamente las propias. | Tribunal asignado | RF-06, RF-26–27, RF-32 |
| **EV-02 · Evaluaciones escritas pendientes** | Calificar indicadores y observaciones; borrador automático; validar y solicitar cierre; una escrita compartida por evaluador/trabajo cuando corresponda. | Tribunal asignado | RF-26–35 |
| **EV-03 · Evaluaciones orales pendientes** | Calificar de forma individual por estudiante, evaluador y sesión, incluso en una defensa conjunta. | Tribunal asignado | RF-26, RF-28–35, RF-46 |
| **EV-04 · Evaluación cerrada** | Leer calificación confirmada; no modificar, salvo procedimiento extraordinario autorizado. | Propietario / consulta autorizada | RF-35–36, RF-42 |

**Origen y límites.** Datos: s4.evaluaciones, s4.calificaciones\_evaluacion, rúbricas S4 y programación S4; tribunal de S3 en lectura. Offline solo en evaluaciones previamente descargadas, nunca cierre definitivo.

## A.3.5. Rúbricas

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **RU-01 · Modalidades** | Consultar modalidades y administrar el catálogo cuando el permiso lo autorice. | Gestor de rúbricas | RF-14 |
| **RU-02 · Rúbricas y versiones** | Filtrar por modalidad, período, estado y versión; consultar estructura histórica usada. | Consulta / gestor autorizado | RF-15, RF-19–20 |
| **RU-03 · Crear o editar rúbrica** | Crear o editar etapas, categorías, criterios, indicadores, máximos, orden y alcance individual/compartido. | Gestor de rúbricas | RF-15–18, RF-21 |
| **RU-04 · Vigencia de rúbricas** | Validar totales, vigencia y aplicabilidad; activar, retirar o revisar versiones inmutables. | Gestor de rúbricas | RF-15, RF-18–20 |

**Origen y límites.** Datos: catálogos y versiones de rúbrica S4; ámbitos y períodos del MER. Una versión utilizada no puede reescribirse; no se impone etapa de anexos a toda modalidad.

## A.3.6. Seguimiento

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **SE-01 · Panel de seguimiento** | Ver ocho estados, evaluadores pendientes, sesiones y alertas por trabajo. | Consulta autorizada | RF-22–25 |
| **SE-02 · Avance por estudiante** | Ver etapas completadas, pendientes y motivos que bloquean el cierre; A y B progresan de forma independiente. | Consulta autorizada | RF-22, RF-25, RF-41 |
| **SE-03 · Finalización del trabajo** | Confirmar cierre administrativo solo si todos los estudiantes completaron evaluación y PDFs requeridos están archivados. | Cierre autorizado | RF-22, RF-24, RF-41, RF-45 |

**Origen y límites.** Datos: estados derivados de evaluaciones S4, tribunal de S3, sesiones S4 y archivo documental S4. Consulta y cierre son permisos diferentes.

## A.3.7. Resultados

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **RE-01 · Calificaciones consolidadas** | Consultar promedios y nota final cuando existe confirmación suficiente; distinguir pendiente, parcial y definitivo. | Consulta autorizada | RF-38–42 |
| **RE-02 · Resultados por estudiantes** | Ver por estudiante/trabajo, etapa y evaluador según el permiso; escala y redondeo estricto. | Consulta autorizada | RF-38–40, RF-42 |
| **RE-03 · Consulta histórica** | Consultar resultados de períodos anteriores dentro del ámbito permitido. | Consulta histórica autorizada | RF-12–13, RF-42 |

**Origen y límites.** Datos: evaluaciones y rúbricas confirmadas S4; trabajo/estudiantes del MER. No registra notas directamente en el SGA.

## A.3.8. Documentos

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **DO-01 · Rúbrica institucional PDF** | Generar y consultar PDF desde la rúbrica aplicada y notas confirmadas, según autorización. | Consulta / emisión autorizada | RF-43, RF-45 |
| **DO-02 · Acta de calificación** | Generar y consultar acta interna con componentes y escala correctamente normalizados. | Consulta / emisión autorizada | RF-44–45 |
| **DO-03 · Archivo documental** | Listar, consultar y descargar versiones archivadas vinculadas a trabajo y estudiante. | Consulta autorizada | RF-45 |

**Origen y límites.** Datos: evaluaciones confirmadas S4, plantillas institucionales autorizadas y s4.actas\_archivadas. No incluye firma electrónica ni registro automático en SGA.

## A.3.9. Auditoría

| **Vista** | **Acciones en la pantalla** | **Acceso** | **RF** |
| --- | --- | --- | --- |
| **AU-01 · Historial de cambios** | Consultar operaciones aceptadas, antes/después, actor e instante; sin edición de la bitácora. | Auditor autorizado | RF-37, RF-48 |
| **AU-02 · Solicitud de corrección** | Presentar motivo y documento de respaldo para solicitar modificación excepcional de nota cerrada. | Solicitante autorizado | RF-36 |
| **AU-03 · Solicitudes y autorizaciones** | Aprobar o rechazar solicitud con permiso específico; documentar resolución y corrección sin borrar el original. | Autorizador habilitado | RF-36–37 |

**Origen y límites.** Datos: eventos y solicitudes bajo control de S4. El registro de auditoría no es un CRUD; los cambios locales no confirmados no constan como cambios aceptados.

## A.4. Visibilidad inicial por actor (siempre condicionada a permisos)

| **Actor** | **Opciones visibles de referencia** | **No debe habilitar por defecto** |
| --- | --- | --- |
| **Tribunal** | Inicio, Trabajos asignados, Mis sustentaciones, Mis evaluaciones; consulta de resultados autorizados. | Rúbricas, programación, calificación ajena, corrección de cierre. |
| **Coordinación** | Inicio, Trabajos, Cronograma, Seguimiento, Resultados, Documentos; Rúbricas y Auditoría si cuenta con permiso. | Carreras fuera de ámbito, asignación de tribunales. |
| **Presidencia / Asistencia** | Inicio, Trabajos, Cronograma y consultas transversales TI/Software; edición solo con permiso expreso. | Escritura universal por tener consulta transversal. |
| **Comisión Académica** | Trabajos, Seguimiento, Resultados; Rúbricas si tiene permiso académico específico. | Carrera ajena o edición de notas de tribunal. |
| **Secretaría** | Consulta de escrita confirmada, resultados consolidados y documentos autorizados. | Edición de rúbricas, programación o notas. |
| **Administración técnica** | Solo funciones técnicas autorizadas dentro de S4, si se definieran; autorización transversal en servidor. | CRUD institucional de usuarios/roles; edición académica automática. |

**Importante:** No se crean perfiles de usuario en S4. Los nombres de actores son categorías de acceso para diseñar la navegación; la identidad, los roles y los permisos proceden de la plataforma externa.

## A.5. Navegación esperada en los dos recorridos principales

Recorrido A — sustentación oral: Trabajos de titulación → Validar tribunal registrado por S3 → Cronograma / Programar o consultar sesión → Mis evaluaciones / Oral del estudiante → Guardado y cierre confirmados → Resultados → Documentos. Si el trabajo tiene dos estudiantes con sesiones separadas, cada oral conserva su estudiante y sesión; la finalización del trabajo espera a ambos.

Recorrido B — revisión escrita: Mis evaluaciones → Evaluación escrita compartida cuando la rúbrica lo defina → Guardado automático local/servidor → Cierre individual del evaluador → Seguimiento → Consolidación y documentos cuando correspondan. El registro escrito compartido no se duplica por estudiante.

## A.6. Componentes que NO tendrán una entrada independiente

| **Componente o acción** | **Ubicación propuesta** |
| --- | --- |
| **Autorización / roles** | Middleware/servidor y controles de navegación. No habrá administración de usuarios o roles dentro de S4. |
| **Autoguardado / sincronización** | Estado visible en la pantalla de evaluación y encabezado contextual; recuperación automática al reabrir. |
| **Motor de cálculo** | Servicio de resultados usado por Seguimiento, Resultados, PDFs y cierre; no pantalla para ejecutar cálculos a mano. |
| **Administración del tribunal** | Solo lectura desde la ficha del trabajo y Cronograma; asignación y sustitución pertenecen a S3. |
| **Cronograma general de titulación** | Fuera de alcance; “Cronograma” se refiere exclusivamente a las sesiones de sustentación programadas por S4. |
| **SGA / actas firmadas** | No se incluye envío de calificaciones a SGA ni firma electrónica como parte del proyecto. |

## A.7. Dependencias por origen y verificación pendiente

| **Origen** | **Información que S4 usa** | **Operación de S4** |
| --- | --- | --- |
| **Tablas comunes gen.\*** | Persona, estudiante, docente, carrera, período; identidad/permiso según contrato institucional. | Lectura / autorización. Seeders temporales solo en desarrollo. |
| **S3 — tribunal** | Tribunal vigente por trabajo, miembros docentes, funciones y modificaciones. | Consulta. Nunca asigna o reemplaza miembros. |
| **S4 — trabajos e integrantes** | Trabajo, estudiante(s) vinculados, tutor y modalidad. | Consulta y validaciones; dueño de altas académicas por confirmar. |
| **S4 — sesiones** | Fecha, hora, sala, duración, participantes, estado y cambios. | Crea, consulta y reprograma en s4.programaciones\_sustentacion. |
| **S4 — evaluaciones / rúbricas** | Versiones, indicadores, notas, cierres y resultados. | Gestión y cálculo propios de S4. |
| **S4 — trazabilidad / PDF** | Cambios de sesión, auditoría de evaluación y documentos archivados. | Registro, consulta y generación con permisos. |

**Pendientes de diseño físico:** Asociación estudiante–sesión; cardinalidad de varias sesiones por trabajo; FK evaluación oral–sesión; validación de cruces de horarios; lectura de asignaciones escritas por S3; tratamiento de s3.defensa sin registros duplicados. No cambian la propiedad funcional acordada.

## A.8. Criterios para aprobar la matriz de navegación

* Cada opción del menú tiene pantalla o componente concreto y un módulo responsable; no hay menús que dupliquen funciones externas.
* Todos los controles y accesos son acordes con los 48 RF y los permisos de servidor; la navegación no sustituye seguridad.
* El menú de tribunal prioriza la tablet y no expone registros de otros evaluadores.
* S4 programa y reprograma sesiones; S3 asigna tribunales y consulta la programación compartida.
* Las vistas admiten escrita compartida, oral individual y sesiones conjuntas o separadas.
* La interfaz distingue guardado local, confirmación remota, cierre de evaluador y cierre administrativo.
* Las consultas se limitan a TI y Software y respetan el ámbito definido externamente.
* Las rutas y pantallas son propuestas de diseño; las estructuras SQL pendientes no se presentan como ya implementadas.

**Resultado:** La matriz de navegación es una ampliación del Paso 2. El siguiente paso de diseño podrá convertir estas vistas en mapa de pantallas, flujos y contratos API, sin cambiar las responsabilidades de S3 y S4.