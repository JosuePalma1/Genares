**GENARES**

ESPECIFICACIÓN
DE REQUISITOS
DEL SISTEMA

Evaluación y consolidación de trabajos de titulación

| **LÍNEA BASE DEFINITIVA PARA DESARROLLO**  **48 requisitos funcionales • 18 requisitos no funcionales • 30 reglas de negocio** |
| --- |

**VERSIÓN**

**1.1 — Integración S3/S4 confirmada**

**FECHA**

2 de noviembre de 2026

**ÁMBITO**

Facultad — carreras de Tecnologías de la Información y Software; plataforma académica integrada

# 1. Propósito y alcance

Su responsabilidad es gestionar rúbricas, evaluaciones, calificaciones, sesiones de sustentación, seguimiento, auditoría y documentos; no administra el proceso completo de titulación.

## 1.1. Problema para resolver

El registro y consolidación de evaluaciones de titulación requiere coordinar modalidades y rúbricas distintas, evaluadores independientes, calificaciones compartidas e individuales, sustentaciones conjuntas o separadas y documentación institucional. Sin una aplicación integrada surgen riesgos de cálculos inconsistentes, duplicación y falta de trazabilidad. Genares centraliza esas operaciones sobre el modelo de datos unificado.

## 1.2. Dentro y fuera del alcance

| **DENTRO DEL ALCANCE** | **FUERA DEL ALCANCE** |
| --- | --- |
| **Gestión de modalidades, versiones de rúbricas y evaluaciones.** | Inscripción del estudiante y gestión completa del proceso de titulación. |
| **Sesiones y reprogramaciones operativas de sustentación en S4.** | Asignación inicial de tribunales e integrantes (S3). |
| **Cálculos, cierre, auditoría, documentos PDF y consultas históricas.** | Registro automático de notas en SGA y firma electrónica de actas. |
| **Interfaz web y app de calificación para tablets.** | Acceso de estudiantes como usuarios de Genares. |

## 1.3. Decisiones de construcción

* Responsabilidades de integración: S3 registra y administra las asignaciones de tribunales y sus integrantes. Genares (S4) consulta estos datos en modo solo lectura directamente desde la base de datos unificada. Genares crea y reprograma las sesiones en s4.programaciones\_sustentacion; no duplica la programación en s3.defensa.
* La unidad de control distingue evaluación individual de un evaluador, resultado de cada estudiante y estado agregado del trabajo. Los trabajos con dos estudiantes pueden tener sesiones orales separadas.
* Los ocho estados definidos permanecen; «Finalizado» es un cierre administrativo posterior a «Evaluación completada», con documentos.
* La rúbrica es variable por modalidad. La plantilla actualmente descrita utiliza escrita 5 y oral 5.
* Genares opera como aplicación web; la experiencia de calificación en tablets admite almacenamiento local y sincronización, pero el cierre definitivo requiere servidor.

# 2. Actores y matriz de responsabilidad

| **ACTOR** | **CAPACIDADES PRINCIPALES** | **LÍMITE** |
| --- | --- | --- |
| **Comisión Académica** | Consulta y, con permiso explícito, gestión de rúbricas y procesos. | Solo carreras asignadas. |
| **Presidencia / Asistencia** | Consulta de las carreras de Tecnologías de la Información y Software; programación de sustentaciones y cierres administrativos únicamente cuando disponga de los permisos específicos correspondientes. | Acceso transversal no implica escritura universal. |
| **Secretaría** | Consulta escrita previa, resultados confirmados y documentos autorizados. | Sin edición de calificaciones ni rúbricas. |
| **Coordinación** | Supervisión, programación/reprogramación, gestión de rúbricas y cierre final según permisos. | Solo ámbito de carreras asignadas. |
| **Tribunal** | Calificación propia, observaciones, guardado automático y solicitud de cierre. | No modifica notas ajenas ni administra rúbricas. |
| **Administración del sistema** | Configuración de parámetros técnicos propios de S4, supervisión de sus componentes y aplicación de los permisos institucionales recibidos. | No administra cuentas ni roles institucionales. No modifica evaluaciones cerradas mediante operaciones ordinarias ni gestiona rúbricas sin autorización académica específica. |

Los estudiantes existen como entidades académicas de consulta y destinatarios de resultados, pero no como usuarios del sistema. Los permisos se verifican en el servidor y por carrera.

# 3. Comportamientos transversales obligatorios

## 3.1. Matriz de estados del proceso

| **ESTADO** | **SIGNIFICADO OPERATIVO** | **CONDICIÓN** |
| --- | --- | --- |
| **1. Registrado** | Trabajo recibido desde el MER con estudiantes vinculados. | Información de trabajo válida. |
| **2. Tribunal asignado** | Asignación válida de tribunal e integrantes consultada desde S3. | Tribunal e integrantes confirmados. |
| **3. Revisión escrita pendiente** | Versión de rúbrica aplicada y escrita exigible aún sin cerrar. | Al menos una escrita requerida no confirmada. |
| **4. Revisión escrita completada** | Todas las escritas aplicables cerradas por todos los evaluadores requeridos. | Sin pendientes. |
| **5. Sustentación programada** | El estudiante ya tiene una fecha y hora asignadas para sustentar, pero todavía no ha comenzado su sustentación. | Sesión y participantes válidos. |
| **6. Sustentación pendiente** | La sustentación ya comenzó, pero uno o más integrantes del tribunal todavía no han finalizado su evaluación oral. | La oral no está cerrada para ese estudiante. |
| **7. Evaluación completada** | Todos los integrantes del tribunal han finalizado sus evaluaciones obligatorias y el servidor ha confirmado las calificaciones. | Sin evaluaciones ni sincronizaciones pendientes. |
| **8. Finalizado** | Todos los estudiantes completados; PDFs requeridos generados/archivados y cierre autorizado del trabajo. | Operación de cierre del trabajo confirmada por servidor. |

Reglas de agregación: (a) cada estudiante mantiene su propio estado hasta Evaluación completada; (b) el estado del trabajo refleja el menor avance todavía pendiente entre sus estudiantes; (c) solo se marca Finalizado el trabajo y se refleja en sus estudiantes cuando el cierre administrativo está confirmado; (d) si una rúbrica no exige una etapa, se omite esa transición sin producir estados pendientes falsos. Una sesión reprogramada vuelve a «Sustentación programada» si su fecha vigente es futura.

## 3.2. Semántica de guardado, sincronización y cierre

| **EVENTO** | **SIGNIFICADO** | **PUEDE CONSIDERARSE CERRADO** |
| --- | --- | --- |
| **Guardado local** | La tablet conserva cambios sin confirmación remota. | No |
| **Guardado en servidor** | Servidor confirma datos del borrador; evaluación sigue editable. | No |
| **Sincronización** | Se aplican operaciones locales idempotentes con control de versiones. | No, salvo operación de cierre independiente |
| **Cierre de evaluador** | Solicitud validada y confirmada por servidor; registro protegido. | Sí, solo esa evaluación |
| **Evaluación completada** | Todas las evaluaciones requeridas del estudiante están cerradas. | Sí, ese estudiante |
| **Finalización del trabajo** | Todos los estudiantes completos; PDFs archivados y operación final autorizada. | Sí, el trabajo |

Sin Internet se permite calificar una evaluación ya descargada, pero no cerrar formalmente, crear/reprogramar sesiones ni generar documentos institucionales. Cuando una tablet se reconecta, el servidor confirma cada operación; ante conflicto se preserva la versión local sin sobrescribir.

## 3.3. Cálculo normativo y escalas

El resultado se calcula primero por evaluador y por componente comparable; luego se promedian los evaluadores requeridos para el mismo destinatario (estudiante o trabajo); por último, se suman los aportes según la versión de rúbrica. No se usa una nota pendiente como cero ni se redondea en cálculos intermedios.

Para el instrumento documentado: Revisión escrita máximo 5 puntos + sustentación oral máximo 5 puntos = resultado final máximo 10. Si el acta presenta cada componente sobre 10, se expresa «nota del componente sobre 5 × 2» y la calificación final conserva la suma original de sus aportes sobre 5. Ejemplo: escrita 4,20/5 → 8,40/10 en acta; oral 4,50/5 → 9,00/10; final 8,70/10.

Regla de presentación de dos decimales: se inspecciona el tercer decimal de la magnitud exacta; si es mayor que 5 se suma una centésima, en otro caso se conservan las centésimas. Casos obligatorios: 9,445 → 9,45; 9,446 → 9,45; 9,444 → 9,44.

# 4. Requisitos funcionales — 48 RF

Cada requisito incluye un comportamiento obligatorio y una verificación mínima para pruebas funcionales. Los requisitos están numerados sin saltos de RF-01 a RF-48.

## 4.1. Acceso, actores y permisos

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-01**  **Identificación de usuarios** | Identificar a los usuarios institucionales autorizados mediante un proveedor de identidad intercambiable y asociarles uno o más roles y ámbitos de carrera. No se habilitará acceso como usuario a estudiantes.  **Verificación:** Usuario válido recibe roles y ámbito; un estudiante sin rol institucional no puede ingresar. |
| **RF-02**  **Autorización por operación** | Autorizar en el servidor cada operación según rol, permiso y ámbito asignado, independientemente de los controles visuales.  **Verificación:** Una petición directa sin permiso es rechazada, aun si se modifica la interfaz. |
| **RF-03**  **Acceso de Comisión Académica** | Limitar la consulta y la gestión autorizada de Comisión Académica a los registros de sus carreras asignadas.  **Verificación:** Un miembro no puede consultar ni alterar datos de una carrera no asignada. |
| **RF-04**  **Acceso de Presidencia/Asistencia** | Permitir a Presidencia/Asistencia autorizada consultar la información correspondiente únicamente a las carreras de Tecnologías de la Información y Software, restringiendo cualquier operación de modificación a la existencia de un permiso explícito e independiente.  **Verificación:** El usuario autorizado accede exclusivamente a las dos carreras permitidas (TI y Software); cualquier intento de modificación sin permiso específico es rechazado por el servidor |
| **RF-05**  **Acceso de Coordinación** | Permitir a Coordinación supervisar, consultar y gestionar únicamente los procesos y carreras dentro de su ámbito institucional.  **Verificación:** No puede operar sobre una carrera fuera de su ámbito. |
| **RF-06**  **Acceso del tribunal** | Permitir a cada integrante del tribunal consultar y registrar exclusivamente las evaluaciones y sesiones que le hayan sido asignadas.  **Verificación:** Un evaluador no modifica las notas de otro integrante. |
| **RF-07**  **Consulta de Secretaría** | Permitir a Secretaría consultar evaluaciones escritas ya registradas y confirmadas antes de la sustentación, y resultados consolidados cuando estén disponibles, sin modificar calificaciones ni rúbricas.  **Verificación:** Acceso de solo lectura; distingue resultados provisionales de definitivos. |
| **RF-08**  **Administración y permisos** | El sistema debe permitir la configuración y administración de los parámetros técnicos propios de S4. La gestión de cuentas, roles institucionales y asignación de permisos corresponderá al sistema externo responsable.  S4 deberá consultar y aplicar los roles y permisos recibidos, verificando en el servidor las operaciones que cada usuario tiene autorizadas. La administración técnica de S4 no otorgará automáticamente permisos académicos para gestionar rúbricas, modificar evaluaciones o ejecutar cierres.  **Verificación:** S4 aplica los permisos institucionales recibidos sin crear ni modificar cuentas o roles externos. Un usuario con funciones técnicas no puede realizar operaciones académicas sin la autorización específica correspondiente. |

## 4.2. Integración y consulta académica

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-09**  **Lectura del MER unificado** | Consultar estudiantes, docentes, personas, carreras, períodos y trabajos desde las entidades compartidas del MER unificado, sin duplicar maestros académicos.  **Verificación:** Información mostrada corresponde a los identificadores compartidos. |
| **RF-10**  **Recepción de tribunales** | Consultar directamente en la base de datos unificada las asignaciones de tribunales y sus integrantes registradas por S3, sin crear ni modificar dichas asignaciones desde Genares.  **Verificación:** Sin tribunal válido no se habilita calificación. |
| **RF-11**  **Validación de relaciones** | Validar antes de habilitar una evaluación que existan trabajo, estudiante(s) vinculados, tribunal activo, evaluador asignado y versión de rúbrica aplicable.  **Verificación:** Una relación inexistente o incompatible impide crear la evaluación. |
| **RF-12**  **Consulta histórica** | Consultar trabajos y estudiantes de períodos anteriores conforme al ámbito de permisos y a la información histórica disponible.  **Verificación:** No mezcla datos históricos de carreras fuera del ámbito. |
| **RF-13**  **Búsqueda histórica** | Filtrar resultados por carrera, período, modalidad, estudiante, tema, tutor y estado, permitiendo combinar filtros y limpiar búsquedas.  **Verificación:** Los filtros combinados devuelven los registros correspondientes. |

## 4.3. Modalidades, instrumentos y rúbricas

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-14**  **Catálogo de modalidades** | Administrar un catálogo extensible de modalidades, inicialmente Implementación, Sistematización de Experiencias y Artículo Científico, sin limitar altas posteriores.  **Verificación:** Puede añadirse otra modalidad sin cambiar el código de cálculo. |
| **RF-15**  **Gestión de rúbricas autorizada** | Permitir a actores con permiso de rúbricas —excepto Tribunal y Secretaría— crear, editar borradores, activar y retirar versiones; una versión utilizada será inmutable.  **Verificación:** No se permite editar una versión que posee evaluaciones asociadas. |
| **RF-16**  **Estructura de rúbricas** | Configurar, por versión, etapas aplicables, categorías, criterios/indicadores, orden, valor máximo, observaciones y obligatoriedad, según el documento institucional.  **Verificación:** Cada indicador posee valor máximo y pertenencia identificables. |
| **RF-17**  **Etapas por modalidad** | Configurar las etapas de cada modalidad y su orden sin exigir etapas idénticas; una etapa de anexos solo existirá si una rúbrica documentada la define.  **Verificación:** No se crea automáticamente una etapa de anexos. |
| **RF-18**  **Validación de ponderaciones** | Validar antes de activar una rúbrica que no existan valores negativos, que cada subtotal respete su máximo configurado y que la suma de aportes coincida con la escala final definida.  **Verificación:** Una rúbrica con sumas incoherentes no puede activarse. |
| **RF-19**  **Versiones y vigencia** | Crear versiones diferenciadas y mantener una versión vigente según modalidad y período/alcance de aplicación; la evaluación conserva la versión asignada.  **Verificación:** Activar una versión nueva no altera evaluaciones existentes. |
| **RF-20**  **Conservación de versiones utilizadas** | Impedir eliminar o modificar el contenido de una versión de rúbrica que tenga evaluaciones; permitir desactivarla para futuros usos.  **Verificación:** La evaluación histórica continúa mostrando la versión original. |
| **RF-21**  **Identificación en la interfaz** | Representar las categorías con letras consecutivas y los indicadores numerados desde uno dentro de cada categoría, mostrando máximos y subtotales.  **Verificación:** La numeración se reinicia en cada categoría. |

## 4.4. Estados y seguimiento

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-22**  **Estados por estudiante y trabajo** | Calcular y mostrar el estado de evaluación de cada estudiante y un estado agregado del trabajo, respetando el flujo de ocho estados; el avance de uno no completa el de otro.  **Verificación:** Estudiante A puede estar completo y B con oral pendiente; trabajo sigue pendiente. |
| **RF-23**  **Tribunal asignado de origen externo** | Reconocer «Tribunal asignado» únicamente cuando exista una asignación válida registrada por S3 y consultada desde la base de datos unificada.  **Verificación:** Genares no crea una asignación inicial ficticia. |
| **RF-24**  **Transiciones controladas** | Aplicar las transiciones y condiciones de la matriz de estados de esta especificación; omitir etapas no aplicables sin generar pendientes artificiales.  **Verificación:** No avanza una etapa sin sus precondiciones confirmadas. |
| **RF-25**  **Panel de seguimiento** | Mostrar por trabajo y estudiante el estado, etapas pendientes/completadas, sesiones, evaluadores pendientes y causas que impiden la finalización.  **Verificación:** El usuario autorizado identifica cuál estudiante o evaluador bloquea el cierre. |

## 4.5. Registro, persistencia y auditoría

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-26**  **Registro independiente por evaluador** | Permitir a cada evaluador asignado registrar sus calificaciones y observaciones por indicador sin alterar registros de otros evaluadores.  **Verificación:** Cada evaluación guarda identificador inequívoco de su evaluador. |
| **RF-27**  **Evaluaciones compartidas e individuales** | Registrar una sola evaluación por trabajo y evaluador cuando la rúbrica la defina como compartida, o una por estudiante y evaluador cuando sea individual.  **Verificación:** Una escrita compartida no se duplica por cada estudiante. |
| **RF-28**  **Observaciones de evaluación** | Permitir registrar y conservar observaciones por criterio/indicador cuando la versión de rúbrica lo contemple.  **Verificación:** Las observaciones se vinculan a su indicador y evaluador. |
| **RF-29**  **Guardado automático** | Guardar automáticamente cada avance: con Internet, enviarlo al servidor; sin Internet, persistirlo en almacenamiento local duradero de la tablet, asociado a evaluación y evaluador.  **Verificación:** El progreso sobrevive una recarga dentro del dispositivo compatible. |
| **RF-30**  **Recuperación del último avance** | Al reabrir, recargar o recuperar conectividad, comparar la última versión confirmada del servidor con los cambios locales y recuperar el avance válido sin descartar cambios pendientes.  **Verificación:** La interfaz identifica datos locales aún no confirmados. |
| **RF-31**  **Sincronización confirmada** | Sincronizar automáticamente la cola local al volver la conexión, con identidad única de operación y control de versión; marcar «confirmado» solo tras aceptación del servidor.  **Verificación:** Reintentos no duplican registros; rechazos preservan la cola. |
| **RF-32**  **Visibilidad del estado de guardado** | Mostrar estados inequívocos: guardado en servidor, guardado local pendiente, sincronizando y conflicto; el guardado no equivale al cierre formal.  **Verificación:** Nunca muestra «confirmado» si solo existe almacenamiento local. |
| **RF-33**  **Validación visual y subtotales** | Resaltar indicadores obligatorios sin calificación y mantener visibles subtotal, máximo y puntos faltantes de la etapa en la interfaz del tribunal.  **Verificación:** El evaluador localiza las omisiones antes de cerrar. |
| **RF-34**  **Verificación de completitud** | Impedir solicitar cierre si faltan indicadores obligatorios, se exceden máximos o existen errores de validación de la rúbrica aplicada.  **Verificación:** El servidor devuelve errores por indicador identificables. |
| **RF-35**  **Cierre individual confirmado** | Permitir que cada evaluador cierre exclusivamente su evaluación completa; el cierre ocurre solo tras validación y confirmación del servidor.  **Verificación:** Sin conexión no se declara cerrada; otras evaluaciones siguen independientes. |
| **RF-36**  **Inmutabilidad tras el cierre** | Bloquear la edición ordinaria de evaluaciones cerradas; una corrección extraordinaria requiere autorización, motivo y auditoría, sin borrar la versión previa.  **Verificación:** Un evaluador no reabre por su cuenta un registro cerrado. Una corrección extraordinaria de una evaluación cerrada deberá solicitarse mediante un procedimiento de autorización dentro del sistema. La solicitud deberá incluir el motivo de la modificación y un documento adjunto que la respalde. La edición solo podrá realizarse después de la aprobación de un usuario con el permiso correspondiente. El sistema deberá conservar el registro original y auditar la solicitud, aprobación y modificación realizada.  La solicitud deberá incluir el motivo de la modificación y un archivo justificativo obligatorio en formato PDF. Dicho archivo se guardará en el servidor dentro del directorio /storage/auditoria/justificativos/, vinculando su ruta relativa, hash de integridad y metadata en la tabla s4.eventos\_auditoria\_evaluacion. La edición solo se habilitará tras la aprobación de un usuario autorizado, garantizando la inmutabilidad y consulta del registro histórico original. |
| **RF-37**  **Registro de auditoría** | Registrar servidor-side operaciones confirmadas sobre evaluaciones: acción, usuario, fecha/hora, versión, antes/después y motivo cuando aplique; restringir alteración del registro.  **Verificación:** Puede reconstruirse quién cambió un valor aceptado. |

## 4.6. Cálculo y resultados

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-38**  **Promedio por conjunto comparable** | Calcular el promedio aritmético exacto de las calificaciones confirmadas de los evaluadores requeridos para un mismo componente y destinatario (estudiante o trabajo).  **Verificación:** No incluye calificaciones faltantes como cero ni consolida conjuntos distintos. |
| **RF-39**  **Consolidación según ponderaciones** | Obtener la nota final sumando los aportes ponderados de las etapas aplicables de la versión de rúbrica; para el instrumento 5+5, sumar escrita/5 y oral/5 hasta 10.  **Verificación:** No se promedian arbitrariamente etapas con ponderaciones diferentes. |
| **RF-40**  **Precisión y redondeo estricto** | Conservar precisión decimal sin redondeos intermedios y mostrar dos decimales, aplicando el redondeo comercial estándar (HALF\_UP), donde el segundo decimal se incrementa en una unidad si el tercer decimal es mayor o igual a 5.  **Verificación:** 9,445→9,45; 9,446→9,45; 9,444→9,44. |
| **RF-41**  **Control de finalización individual y global** | Impedir cerrar una evaluación no confirmada; marcar completo al estudiante solo cuando todas sus evaluaciones obligatorias estén cerradas, y al trabajo solo cuando lo estén las de todos sus estudiantes.  **Verificación:** Una sesión de B pendiente impide completar el trabajo aunque A haya terminado. |
| **RF-42**  **Consulta controlada de resultados** | Mostrar calificaciones por evaluador, etapa, estudiante y trabajo a roles autorizados, distinguiendo claramente parcial, pendiente y definitivo.  **Verificación:** No muestra como definitiva una consolidación parcial. |

## 4.7. Documentos institucionales

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-43**  **PDF de rúbrica institucional** | Generar la «Rúbrica de evaluación de trabajo de integración curricular» con la estructura de la versión aplicable: categorías, indicadores, máximos, obtenidos, subtotales y final /10.  **Verificación:** El PDF conserva valores/estructura de la plantilla aplicable y no altera notas. |
| **RF-44**  **PDF de acta interna** | Generar el «Acta de calificación de titulación» con los componentes de evaluación aplicables a la modalidad y versión de rúbrica correspondiente, los datos del estudiante, tema, modalidad, fecha y hora, calificación final sobre 10, declaración prevista y espacios de firmas, respetando la estructura institucional autorizada.  **Verificación:** Si el origen es 5+5, normaliza los componentes para exhibición sin sumar 20. |
| **RF-45**  **Acceso y archivo documental** | Autorizar la generación/consulta de cada PDF por rol y carrera; archivar tipo, versión, trabajo, estudiante, fecha y referencia al archivo generado.  **Verificación:** Secretaría y autoridades solo acceden a documentos permitidos. |

## 4.8. Sustentaciones y concurrencia

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RF-46**  **Vinculación oral con sesión y estudiante** | Asociar toda evaluación oral con su sesión, estudiante y evaluador; soportar una sesión conjunta con dos estudiantes o sesiones separadas, manteniendo nota oral individual.  **Verificación:** No existe evaluación oral huérfana ni sesión atribuida a estudiante ajeno. |
| **RF-47**  **Conflictos de edición simultánea** | Detectar escrituras desde dos tablets sobre una versión desactualizada de la misma evaluación; impedir sobrescritura silenciosa y preservar cambios para resolución autorizada.  **Verificación:** Se presenta conflicto sin perder los cambios locales. |
| **RF-48**  **Programación y reprogramación en S4** | Permitir a Coordinación o Presidencia/Asistencia con permiso de programación crear sesiones y reprogramarlas en s4.programaciones\_sustentacion; conservar ID, fecha vigente e historial en s4.eventos\_trazabilidad\_trabajo.  **Verificación:** Reprogramar no crea otra sesión; separar estudiantes sí crea sesiones distintas. |

# 5. Requisitos no funcionales — 18 RNF

Los criterios cuantitativos se utilizan como metas técnicas de aceptación del proyecto, no como acuerdos de nivel de servicio institucional. Los criterios cualitativos se prueban con los escenarios indicados.

| **CÓDIGO / NOMBRE** | **REQUISITO Y VERIFICACIÓN** |
| --- | --- |
| **RNF-01**  **Usabilidad** | La interfaz debe organizar claramente acciones, validaciones y mensajes de estado para los seis actores.  **Verificación:** En pruebas de tareas básicas, ningún error de validación carece de explicación visible. |
| **RNF-02**  **Tablet del tribunal** | La experiencia de evaluación debe optimizarse para tablets táctiles, especialmente indicadores, notas, observaciones, subtotales y cierre. No obliga a los demás actores a usar tablets.  **Verificación:** Se realizan pruebas completas en una tablet Android y un iPad de referencia. |
| **RNF-03**  **Rendimiento** | Las operaciones habituales deben responder de forma utilizable bajo carga representativa del proyecto; la prueba técnica fija p95 ≤ 3 s para consultas/guardado online con 25 usuarios concurrentes y red estable.  **Verificación:** Prueba de carga reproducible sobre ambiente de aceptación; es meta técnica, no SLA institucional. |
| **RNF-04**  **Continuidad y recuperación** | Ante reinicio del servidor o interrupción de conexión, se preservarán cambios previamente confirmados y podrá reanudarse el servicio sin corrupción de datos.  **Verificación:** Simulación de interrupción y reinicio sin pérdida de operaciones confirmadas. |
| **RNF-05**  **Seguridad de comunicaciones e identidad** | Toda sesión y operación protegida usará TLS/HTTPS, sesiones seguras y gestión de credenciales conforme al proveedor seleccionado.  **Verificación:** No hay endpoints protegidos expuestos por HTTP sin protección. |
| **RNF-06**  **Autorización del servidor** | Toda operación protegida validará rol, ámbito de carrera, asignación del tribunal y propiedad de la evaluación en servidor.  **Verificación:** Pruebas negativas de acceso por URL y API. |
| **RNF-07**  **Integridad referencial** | Se aplicarán claves, restricciones y transacciones para evitar duplicados, vínculos inválidos y actualizaciones parcialmente confirmadas.  **Verificación:** Intentos de crear registros inconsistentes son rechazados. |
| **RNF-08**  **Exactitud decimal** | Los cálculos usarán aritmética decimal exacta y la regla de redondeo comercial estándar (HALF\_UP), evitando el uso de coma flotante binaria para decisiones de redondeo.  **Verificación:** Batería automatizada de pruebas unitarias y de límites decimales reproducible. |
| **RNF-09**  **Durabilidad del avance** | El almacenamiento local y del servidor garantizará persistencia de avances aceptados en el dispositivo bajo condiciones normales de reinicio/recarga, sin prometer recuperación tras desinstalación o borrado de datos.  **Verificación:** Cerrar/reabrir y recargar recupera cambios previamente persistidos. |
| **RNF-10**  **Recuperación no destructiva** | La conciliación entre versiones locales y remotas preservará los cambios divergentes y no impondrá automáticamente la versión aparentemente más reciente por reloj del dispositivo.  **Verificación:** Conflicto conserva ambas versiones para resolución. |
| **RNF-11**  **Compatibilidad** | La solución web para tablets operará en Chrome/Edge actuales y Safari de iPadOS, probando la versión actual y la inmediatamente anterior compatible al momento de aceptación.  **Verificación:** Matriz de pruebas con Android Chrome y iPad Safari; escritorio Chrome/Edge. |
| **RNF-12**  **Mantenibilidad** | La solución organizará módulos de permisos, rúbricas, evaluaciones, programación, sincronización, cálculo y documentos con interfaces y pruebas documentadas.  **Verificación:** Cada área tiene servicios y contratos de integración identificados. |
| **RNF-13**  **Interoperabilidad** | Genares reutilizará el MER unificado y sus claves compartidas mediante contratos versionados, sin replicar maestros de estudiantes y docentes.  **Verificación:** Prueba de lectura contra datos compartidos y de integridad de FK. |
| **RNF-14**  **Accesibilidad práctica** | Los controles críticos tendrán nombre accesible, foco visible, navegación por teclado, contraste legible y errores asociados al campo.  **Verificación:** Lista de comprobación funcional sobre pantallas principales. |
| **RNF-15**  **Trazabilidad protegida** | Los eventos confirmados de auditoría serán consultables por personal autorizado y no editables mediante flujos ordinarios de aplicación.  **Verificación:** No existe endpoint de edición/borrado de auditoría para usuarios normales. |
| **RNF-16**  **Confidencialidad** | Notas, observaciones, documentos y datos personales se presentarán solo según permiso; se evitarán filtraciones en logs, cachés compartidas y mensajes de error.  **Verificación:** Revisión de API, descargas y registros técnicos sin exposición de otros usuarios. |
| **RNF-17**  **Verificabilidad** | Se automatizarán pruebas de permisos, reglas de notas, cierre, rúbricas, sesiones separadas, sincronización, reintentos y conflictos.  **Verificación:** La suite de pruebas integrales de aceptación definida en la sección 9 ejecuta sin errores. |
| **RNF-18**  **Operación offline controlada** | En tablet, solo el registro del avance de una evaluación ya cargada deberá funcionar sin Internet; crear sesiones, cerrar evaluaciones y generar PDFs requieren servidor.  **Verificación:** Offline conserva notas locales; reconexión sincroniza y confirma sin duplicar. |

# 6. Reglas de negocio — 30 RN

## 6.1. Alcance académico y control de rúbricas

| **CÓDIGO / REGLA** | **DISPOSICIÓN OBLIGATORIA** |
| --- | --- |
| **RN-01**  **Validez previa** | Ninguna evaluación inicia sin trabajo, estudiantes, tribunal y evaluador asignado válidos; S3 es responsable de la asignación inicial del tribunal. |
| **RN-02**  **Fijación de versión** | Una evaluación queda vinculada a una versión de rúbrica identificable e inmutable durante su ciclo; activar otra no cambia el instrumento aplicado. |
| **RN-03**  **Modalidades distintas** | Las etapas, criterios, máximos y condición individual/compartida dependen de la rúbrica; no existe una etapa de anexos universal. |
| **RN-04**  **Unidad de calificación** | Una evaluación compartida se asigna al trabajo; una individual, al estudiante. La nota compartida se aplica a los estudiantes vinculados sin duplicar el registro. |
| **RN-05**  **Promedio comparable** | Solo se promedian calificaciones confirmadas del mismo componente, unidad evaluada y conjunto requerido de evaluadores; una nota ausente no vale cero. |
| **RN-06**  **Escala explícita** | Toda nota mostrada y exportada debe indicar denominador o máximo (por ejemplo /5 o /10), sin mezclar escalas al sumar. |
| **RN-07**  **Cierre de evaluación** | El evaluador solo puede solicitar el cierre cuando su evaluación esté completa y sin cambios pendientes; el cierre es válido tras confirmación del servidor. |
| **RN-08**  **Bloqueo tras cierre** | Una evaluación cerrada no se edita ordinariamente; cualquier corrección extraordinaria exige permiso, motivo, registro histórico y nueva operación confirmada. |
| **RN-09**  **No eliminación histórica** | Una versión usada no se elimina ni reescribe; se retira de futuros usos mediante estado de vigencia. |
| **RN-10**  **Carrera en Comisión** | Comisión Académica solo consulta o administra registros de sus carreras asignadas. |
| **RN-11**  **Restricción de rúbricas** | Tribunal y Secretaría no pueden crear, editar, activar ni retirar rúbricas. |
| **RN-12**  **Auditoría de servidor** | Las modificaciones aceptadas deben dejar identidad, instante, antes/después y contexto; los cambios solo locales no se declaran confirmados. |
| **RN-13**  **Separación de SGA** | El resultado de Genares no constituye automáticamente una nota registrada en SGA; queda excluida la escritura directa al SGA. |
| **RN-14**  **Documentación condicionada** | Los PDFs usan plantillas autorizadas y controles de acceso diferenciados, sin inventar firmas electrónicas. |

## 6.2. Evaluación, guardado y calificación

| **CÓDIGO / REGLA** | **DISPOSICIÓN OBLIGATORIA** |
| --- | --- |
| **RN-15**  **Escrita compartida** | Cuando escrita es compartida, se registra una vez por trabajo, etapa y evaluador; cuando es individual se registra por estudiante. |
| **RN-16**  **Oral por sesión** | Cada oral identifica sesión, estudiante y evaluador; una sesión conjunta produce registros individuales para los estudiantes evaluados. |
| **RN-17**  **Guardado no cierra** | Guardar o sincronizar un borrador no equivale a cerrar una evaluación; la operación de cierre es explícita y confirmada. |
| **RN-18**  **Confirmación remota** | Los cambios locales mantienen estado «pendiente» hasta aceptación del servidor, aunque el dispositivo los haya guardado exitosamente. |
| **RN-19**  **Redondeo estricto** | Se aplicará el redondeo comercial estándar (HALF\_UP) sobre la nota final calculada: el segundo decimal se incrementará en una unidad si el tercer decimal es mayor o igual a 5. No se aplicará redondeo en los cálculos intermedios. |
| **RN-20**  **Instrumento 5 + 5** | Para la rúbrica descrita, escrita aporta máximo 5 y oral máximo 5; la suma final es /10. Si el acta exhibe cada componente /10, se normaliza sin duplicar su peso. |
| **RN-21**  **Documento inalterante** | Generar o archivar PDFs no cambia valores, versiones, evaluadores, fecha de cierre ni estado de una evaluación ya registrada. |
| **RN-22**  **Idempotencia de sincronización** | Una operación de cambio identificada de forma única solo puede aplicarse una vez en servidor aunque la tablet la reenvíe. |
| **RN-23**  **Finalización por estudiantes** | El estudiante solo queda «Evaluación completada» cuando están cerradas todas sus evaluaciones exigibles; el trabajo solo alcanza esa condición cuando lo están las de todos. |
| **RN-24**  **Propiedad de evaluación** | Cada evaluador edita únicamente sus registros, salvo procedimiento extraordinario explícito y auditado. |
| **RN-25**  **Evitar duplicados compartidos** | La base de datos impedirá duplicar, para un mismo trabajo, etapa, rúbrica y evaluador, una evaluación configurada como compartida. |
| **RN-26**  **Integridad participante-sesión** | La evaluación oral solo puede vincular un estudiante inscrito como participante de la sesión y un evaluador asignado a su tribunal. |
| **RN-27**  **Reprogramación histórica** | Reprogramar conserva el ID de la sesión y actualiza fecha/hora vigentes; registra fecha anterior/nueva, actor, instante y motivo. |
| **RN-28**  **Sesiones distintas** | Si dos estudiantes de un trabajo sustentan en días distintos, deben existir sesiones diferentes, no una sesión reprogramada para ambos. |
| **RN-29**  **Conflicto sin sobrescritura** | Una modificación basada en versión obsoleta se rechaza o entra a conciliación; nunca sobrescribe silenciosamente una versión más reciente. |
| **RN-30**  **Límite documental** | La generación de rúbrica y acta no firma electrónicamente, no realiza aprobación administrativa automática ni registra calificaciones en SGA. |

# 7. Contrato de datos e integración

Este apartado fija responsabilidades y relaciones esperadas a partir de las estructuras del MER identificadas durante el proyecto. El documento define el contrato funcional; las migraciones deben respetar las columnas y restricciones efectivas del repositorio unificado.

| **PROPÓSITO** | **ENTIDADES / TABLAS** | **REGLA DE INTEGRACIÓN** |
| --- | --- | --- |
| **Identidades y ámbito** | gen.persona; gen.estudiante; gen.docente; gen.carrera; gen.periodo\_academico | Se consultan como datos maestros compartidos. |
| **Trabajos, estudiantes y tutores** | s4.trabajos\_titulacion; s4.estudiantes\_trabajo; s4.asignaciones\_tutor\_trabajo | El trabajo agrupa 1 o 2 estudiantes; no se crean clones de persona. |
| **Tribunales** | s4.asignaciones\_tribunal; s4.miembros\_tribunal | S3 registra y administra tribunales e integrantes; S4 los consulta en modo solo lectura desde la base de datos unificada, sin duplicarlos. Los nombres físicos se respetan según el MER. |
| **Programación** | s4.programaciones\_sustentacion; s4.eventos\_trazabilidad\_trabajo | S4 administra sesiones, reprograma manteniendo ID y registra historial. |
| **Rúbricas** | s4.rubricas; s4.versiones\_rubrica; s4.etapas\_rubrica; s4.categorias\_rubrica; s4.indicadores\_rubrica | Versiones utilizadas inmutables; etapa y tipo individual/compartido explícitos. |
| **Evaluación y notas** | s4.evaluaciones; s4.calificaciones\_evaluacion | Escrita compartida única; oral referida a sesión, estudiante y evaluador. |
| **Auditoría y PDFs** | s4.eventos\_auditoria\_evaluacion; s4.actas\_archivadas | Eventos confirmados y archivos asociados a versión/estudiante/trabajo. |

## 7.1. Restricciones relacionales obligatorias

* La programación de sustentación admite varias sesiones para un trabajo. No debe existir una restricción UNIQUE(id\_trabajo) que imposibilite sesiones distintas.
* La tabla s4.programaciones\_sustentacion no incluirá la restricción UNIQUE(id\_trabajo), permitiendo registrar múltiples sesiones por trabajo si fuera necesario. A nivel de interfaz, el sistema ofrecerá la opción unificada de "Reprogramar sustentación" para la bina. En el modelo relacional, los participantes se vincularán formalmente a través de la tabla asociativa s4.estudiantes\_sesion\_sustentacion (id\_sesion, id\_estudiante), asegurando el soporte técnico tanto para defensas conjuntas como para sesiones separadas.
* Cada sesión deberá identificar a sus estudiantes participantes mediante una relación consistente; si aún no existe, incorporar una asociación estudiante–sesión. La misma sesión puede incluir a los dos estudiantes y un estudiante puede tener su sesión propia.
* s4.evaluaciones incorporará una referencia opcional a s4.programaciones\_sustentacion para evaluación oral; debe ser obligatoria cuando el tipo de etapa sea oral e inexistente cuando se trate de escrita compartida.
* Las restricciones de unicidad deberán distinguir evaluación por trabajo/evaluador/etapa (compartida) de evaluación por estudiante/evaluador/etapa/sesión (individual oral). Una misma operación de sincronización incluirá un identificador único idempotente y versión base.
* Las reprogramaciones actualizarán fecha/hora de la programación conservando el identificador; cada actualización aceptada emitirá evento de trazabilidad con antes/después, actor y motivo.
* La cola de cambios offline reside en la tablet (almacenamiento persistente de la aplicación); el servidor almacena los datos confirmados, el identificador de operación y la versión del registro para garantizar idempotencia y concurrencia.

## 7.2. Integración con S3 y SGA

S3 será responsable de registrar y administrar las asignaciones de tribunales y sus integrantes. S4 consultará esta información directamente desde las tablas compartidas del MER unificado, en modo de solo lectura, sin crear, modificar ni duplicar dichas asignaciones.

S4 será responsable de administrar el cronograma de sustentaciones, incluyendo la creación, programación y reprogramación de sesiones mediante la tabla s4.programaciones\_sustentacion.

Esta tabla constituirá la fuente compartida de información de sustentaciones. S3 podrá consultar las sesiones programadas por S4 desde la base de datos unificada, evitando mantener una programación independiente del mismo evento académico.

Las reprogramaciones realizadas por S4 conservarán el identificador de la sesión y registrarán su historial mediante s4.eventos\_trazabilidad\_trabajo.

El tratamiento definitivo de s3.defensa, así como los ajustes de relaciones y restricciones del MER unificado, se establecerán mediante coordinación técnica entre los equipos involucrados.

S4 no registrará automáticamente las calificaciones en el Sistema de Gestión Académica (SGA), ya que esta operación se encuentra fuera del alcance actual.

# 8. Documentos generados

| **DOCUMENTO** | **CONTENIDO MÍNIMO** | **CONDICIONES** |
| --- | --- | --- |
| **PDF 1 — Rúbrica de evaluación del trabajo de integración curricular** | Plantilla aplicable; categorías A–E cuando correspondan; indicadores, máximos, notas, subtotales, resultado /10. | Basado en versión real; sin inventar categorías o etapas que la rúbrica no tenga. |
| **PDF 2 — Acta de calificación de titulación (uso interno)** | Institución, fecha/hora, estudiante e identificación, tema, modalidad, título académico, trabajo /10, oral /10, final /10, declaración y espacios para Decano, tribunal, graduado y Secretaría. | Componentes normalizados para visualizar /10; final /10; firmas solo como espacios físicos/documentales. |

Ambos PDFs son de salida controlada, se generan desde evaluaciones confirmadas, se archivan con identificación de versión y no cambian sus calificaciones de origen. No se implementa firma electrónica ni envío automático al SGA.

# 9. Pruebas integrales de aceptación

| **PRUEBA** | **ESCENARIO** | **RESULTADO ESPERADO** |
| --- | --- | --- |
| **PA-01** | Permisos — Comisión de carrera A intenta abrir trabajo de carrera B. | Acceso denegado en servidor. |
| **PA-02** | Asignación de S3 — Intentar iniciar evaluación sin tribunal válido consultable. | No inicia; no se crea asignación dentro de Genares. |
| **PA-03** | Versiones de rúbrica — Activar nueva versión con evaluaciones previas. | Históricas conservan versión original. |
| **PA-04** | Rubricas distintas — Modalidad sin anexos; otra con diferentes ponderaciones. | Solo aparecen etapas documentadas; máximos consistentes. |
| **PA-05** | Escrita compartida — Dos estudiantes y dos evaluadores para escrita compartida. | Dos registros de escrita, uno por evaluador; notas aplicadas a ambos. |
| **PA-06** | Oral conjunta — Dos estudiantes en una sola sesión. | Dos orales por evaluador; cada oral identifica estudiante y sesión. |
| **PA-07** | Oral separada — Estudiante A termina oral, B tiene sesión posterior. | A completado; B pendiente; trabajo no completado. |
| **PA-08** | Reprogramación — Modificar fecha de una sesión aún no cerrada. | Mismo ID, nueva fecha vigente y evento con motivo/historial. |
| **PA-09** | Guardado con Internet — Editar indicador y esperar confirmación. | Servidor almacena; UI muestra confirmado y no cierre. |
| **PA-10** | Recarga offline — Perder red, editar, cerrar navegador y reabrir en la misma tablet. | Recupera cambios locales e indica pendiente. |
| **PA-11** | Reintento offline — Reconectar y reenviar la misma operación dos veces. | Se aplica una sola vez, sin duplicar. |
| **PA-12** | Conflicto entre tablets — Editar mismo registro en tablet 1 y 2 con versión base idéntica. | Segunda escritura incompatible no sobrescribe; conflicto visible. |
| **PA-13** | Cierre de evaluador — Intentar cerrar con cambio local no confirmado. | Cierre rechazado hasta confirmar cambios y validaciones. |
| **PA-14** | Calificación de rubrica — Escrita 4,20/5 y oral 4,50/5. | Rúbrica final 8,70/10; acta escrita 8,40/10, oral 9,00/10, final 8,70/10. |
| **PA-15** | Redondeo estándar — Calcular valores 9,445; 9,446; 9,444. | Se muestran 9,45; 9,45; 9,44. |
| **PA-16** | Finalización del trabajo — A y B completos; intentar finalizar sin archivar PDFs. | No finaliza; tras PDFs y permiso, cierre confirmado. |
| **PA-17** | Auditoría — Corregir nota cerrada mediante operación extraordinaria. | Queda motivo, usuario, antes/después; nota previa reconstruible. |
| **PA-18** | Documentos / SGA — Generar ambos PDF con resultados confirmados. | Archiva documentos sin firma electrónica ni escritura a SGA. |

# 10. Criterio de cierre de la línea base

La implementación se considera conforme cuando: (1) todos los RF tienen verificación satisfactoria; (2) los RNF se comprueban con su criterio de aceptación; (3) ninguna operación contradice las 30 reglas de negocio; (4) los escenarios PA-01 a PA-18 pasan; y (5) los documentos generados conservan las escalas y datos originales.

Las decisiones de construcción de esta línea base son explícitas y prevalecen frente a interpretaciones anteriores que las contradigan. Cualquier futura modificación requerirá control de versiones del documento y actualización coordinada de diseño, datos y pruebas, sin alterar silenciosamente esta versión.