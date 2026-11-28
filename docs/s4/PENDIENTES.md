# Lo que falta en Genares S4

**Actualizado el 28/11/2026.** El orden de trabajo refleja lo que se puede avanzar en el sistema local.
Para poner el proyecto en marcha, ver [PRIMEROS-PASOS.md](PRIMEROS-PASOS.md). El detalle de cada requisito está en [estado-paso-1.md](estado-paso-1.md). Los Pasos 3, 4 y 5 se actualizaron a la versión 1.1, con los nombres reales de las tablas y el estado de la estructura y de las tareas.

## Por dónde empezar

**Siguiente tarea.** Confirmar con Coordinación qué eventos requieren correo automático.

| N.º | Tarea | Descripción |
| --- | --- | --- |
| 1 | Incorporar correos automáticos si se aprueban | Acordar con Coordinación qué eventos requieren un correo antes de implementarlos. |
| 2 | Automatizar la reportería de cohortes, deserción y permanencia | Añadir al panel de Secretaría y Coordinación una vista con filtros por período de ingreso y tipo de estudiante (regular u homologado). Calcular los indicadores desde la base de estudiantes de 2018-1 a 2026 y usar el Excel local de matrículas como referencia. <br>**Cohorte buena (tasa de graduación):** 8 semestres para la malla actual y 9 para la malla antigua vigente hasta 2022, con hasta 3 semestres de tolerancia para graduarse. Solo cuentan los estudiantes que ingresaron a primer nivel con cupo regular. Se excluyen homologaciones externas y cambios de carrera. <br>**Deserción:** un estudiante regular se considera desertor tras 3 semestres consecutivos sin matrícula. <br>**Permanencia y reingreso:** si vuelve a matricularse, pasa a permanencia y se conserva el historial de deserción. El reingreso queda fuera de la cohorte buena. |
| 3 | Actualizar el MER y los Pasos 1 a 5 | Alinear el MER con el esquema de S4 y sus dependencias en la base compartida. Actualizar el [Paso 1](planificacion-integracion-s4/Paso_1.md) para requisitos y reglas, el [Paso 2](planificacion-integracion-s4/Paso_2.md) para responsabilidades e integración, el [Paso 3](planificacion-integracion-s4/Paso_3.md) para arquitectura y base de datos, el [Paso 4](planificacion-integracion-s4/Paso_4.md) para estructura y componentes, y el [Paso 5](planificacion-integracion-s4/Paso_5.md) para tareas y entregas. En el Paso 5, registrar el orden de las migraciones y los datos iniciales autorizados para producción. |

## Qué ya existe y qué queda para después

- **Detalle de Modalidad.** La pantalla admite cualquier UUID válido de PostgreSQL, incluidos los identificadores de la base de pruebas que no son v4.
- **Nombres y estados en pantalla.** Trabajos, Cronograma y Seguimiento muestran el título en lugar del UUID. Evaluaciones y Resultados muestran los nombres de estudiantes, miembros del tribunal y rúbricas cuando están registrados, con estados en lenguaje claro.
- **Mis evaluaciones.** La lista muestra la escrita compartida, la oral y los resultados por estudiante, y el motivo de los bloqueos. Los filtros de etapa y estado consultan todas las páginas en el servidor.
- **Edición, filtros y PDF del Cronograma.** Se puede crear o editar en una ventana modal desde la lista. Para crear, se puede buscar por código, título, carrera o estudiante entre los trabajos habilitados. La agenda ofrece filtros para hoy, mañana y esta semana, permite restablecerlos y ordenar por fecha y hora. El PDF contiene todos los resultados de los filtros activos, en el mismo orden.
- **Estados y búsqueda del Cronograma.** La tabla y el PDF muestran «Programada» antes de la hora prevista y «En curso o pendiente» desde esa hora. Se conserva «Cancelada» y el estado de los registros históricos finalizados. La búsqueda admite el nombre de la sala y se aplica junto con los filtros del Cronograma.
- **Horarios de sustentación.** El formulario y el servidor aplican los límites al crear o reprogramar. El formulario avisa si la sala está ocupada antes de guardar. Al reprogramar, excluye la propia sesión. El servidor vuelve a comprobar los cruces al guardar. En Configuración general se puede decidir si se bloquean fechas pasadas y fijar el horario de inicio por carrera, modalidad y período. Los valores por defecto bloquean fechas pasadas y admiten inicios de 06:00 a 23:00, hora de Ecuador continental. El [script de horario](../../backend/fixtures/s4-horario-programacion.sql) ya se ejecutó en la base local, según confirmó Josué.
- **Importación de rúbricas desde Word y PDF.** En Rúbricas → Nueva rúbrica, el editor carga las etapas, categorías e indicadores con sus máximos desde tablas de valoración en un archivo .docx o PDF con texto seleccionable. El archivo se procesa en el navegador. Después de la revisión, la estructura se guarda como borrador desde el editor. El lector de PDF usa PDF.js y el de Word usa fflate como dependencias del frontend.
- **Rúbricas.** El sistema admite varias rúbricas y versiones configurables. La aplicación conserva la versión usada en cada evaluación. La asignación automática ya resuelve los casos con una candidata y pide una elección si encuentra varias aplicables. Los ejemplos de 5 + 5 y 10 + 10 son referencias para configurar, no tareas para elegir una rúbrica única.
- **Sustentaciones simultáneas.** El cupo compartido inicia en 2. Configuración general permite cambiarlo y dar cupos independientes a las carreras que los necesiten. El Cronograma avisa con SweetAlert2 si hay un cruce de sala o se alcanza el cupo. La validación se aplica al crear y reprogramar.
- **Redondeo.** Configuración general ya permite redondear o truncar a dos decimales y comparar el resultado publicado con el umbral. Las pruebas confirman que 6,995 aprueba al publicarse como 7,00 y reprueba al truncarse a 6,99 con mínimo de 7. El cálculo conserva precisión exacta antes de publicar. La regla histórica de los pasos 4 → 3 → 2 queda como antecedente de la discusión.
- **Cambio de una nota cerrada.** El flujo de solicitud, aprobación y rechazo ya está implementado. Las pruebas del backend cubren permisos, plazos, evidencia configurable, auditoría, aplicación de la corrección y bloqueo si el trabajo finalizó o tiene acta archivada.
- **Inicio, navegación y filtros de Trabajos.** Inicio destaca los trabajos, las sustentaciones programadas y los resultados completos, con un acceso visible en la cabecera para los perfiles que pueden consultarlo. Trabajos deja a la vista búsqueda, período y estado. «Más filtros» reúne los demás campos. Los expedientes y resultados se abren en otra pestaña. En Trabajos, «Volver» recupera los filtros y la página de origen.
- **Resumen al cerrar la evaluación oral.** Muestra la nota confirmada de cada estudiante, el estado de los demás evaluadores y la rúbrica PDF. «Siguiente estudiante» enfoca el indicador pendiente en una bina. Mientras el resumen está abierto, consulta las notas y habilita el enlace al acta en Documentos cuando llega el consolidado de ese estudiante.
- **Acceso a los PDF.** El expediente, Mis evaluaciones, Coordinación y Secretaría abren la rúbrica PDF de cada estudiante y miembro aplicable desde el registro. Coordinación y Secretaría abren el PDF de las actas archivadas. La consulta de resultados enlaza con Documentos y el historial de cambios se consulta desde Auditoría.
- **Numeración de actas.** Las actas archivadas ya usan un consecutivo compartido por los dos formatos PAT, por carrera y período. El código actual genera, por ejemplo, `001-2026-2-SOFT`. La vista previa se muestra sin número. En «Nombre de las actas», dentro de Configuración general, se consulta el último código emitido tal como está en el archivo y el siguiente previsto por carrera y período. El contador se incrementa al emitir el acta.
- **Acuerdos con S2 y S3.** El Paso 2 confirma que S3 administra los tribunales y S4 administra el calendario. Los puntos D-05 a D-08 siguen como asuntos de integración en esa documentación. Incluyen identidad, propiedad de los datos del trabajo y acceso de S3 al historial y a resultados.
- **Acceso institucional, revisión de seguridad y despliegue.** Se retoman más adelante. La integración con el repositorio común queda para cuando el sistema llegue al 70 % de avance. Los asuntos de GitHub de la lista anterior son gestión del trabajo y automatización de comprobaciones de los PR.
- **Seguimiento de la entrega.** Mantener actualizada la demostración, preparar el manual y completar el README, y actualizar la evaluación ISO/IEC 25010. El detalle de cada punto sigue en la lista de referencia.

## Plan de aceptación para más adelante

- Recorrer PA-02 a PA-18 con el sistema en funcionamiento. Incluir asignación de rúbricas, cierre escrito y oral, nota consolidada, corrección de notas, actas y finalización.
- Revisar en el mismo recorrido las políticas por ámbito, los reemplazos, las convocatorias, las etapas personalizadas y las excepciones de programación y cierre.
- Probar con el tribunal el recorrido en los dispositivos previstos. Revisar agenda, evaluaciones, rueda de notas, menú y PDF. Comprobar la recuperación de borradores, la sincronización y el cierre con confirmación del servidor. Los detalles de funcionamiento sin conexión y del alcance de la APK siguen en la revisión técnica.
- Repetir las mediciones de rendimiento en el ambiente de aceptación.

<details>
<summary>Lista anterior de 30 puntos y contexto técnico completo</summary>

La lista anterior y las revisiones fechadas se conservan como referencia. Para elegir el siguiente cambio, usa la tabla de «Por dónde empezar».

## Lista anterior

| N.º | Tarea | Descripción | Dependencia, cuando aplica |
| --- | --- | --- | --- |
| 1 | Habilitar el acceso institucional y los permisos | Conectar S4 al inicio de sesión real, aplicar los roles por ámbito y comprobar quién guarda, cierra o firma cada evaluación. | Institución y responsable de `auth/` en el repositorio común. |
| 2 | Revisar la seguridad y proteger los datos personales | Revisar permisos del servidor, validación de entradas y mensajes de error. Sustituir por ejemplos los datos reales en las plantillas Word y PDF del repositorio y retirar los temporales de Word. | |
| 3 | Confirmar y validar la rúbrica vigente | Acordar qué versión de Proyecto Integrador corresponde a cada carrera, modalidad y período. En la base de uso, verificar la asignación, dejar una sola versión aplicable por ámbito y comprobar qué pasa con los trabajos DEV ya evaluados y los que pueden reasignarse. | Coordinación y autoridades de la facultad. |
| 4 | Cerrar la regla institucional de redondeo | Confirmar por escrito cómo tratar las cifras que exceden cuatro decimales y en qué períodos se aplica la regla en pasos. Según lo acordado, completar la configuración, las pruebas, la trazabilidad y la documentación normativa. | Coordinación y autoridades de la facultad. |
| 5 | Cerrar los contratos con S2, S3 e identidad | Documentar identidad, creación de trabajos y estudiantes, consulta de historial y resultados, uso de la tabla antigua `s3.defensa` y señal de trabajo terminado para las consultas históricas. | Equipos de S2, S3 e identidad. Paso 2, D-05 a D-08. |
| 6 | Integrar S4 con el repositorio común | Trasladar los cambios de S4 mediante PR revisados, coordinar los archivos compartidos y comunicar las dependencias nuevas de Capacitor para el visor de PDF. | Responsable de integración. Paso 5. |
| 7 | Preparar el ambiente de aceptación | Publicar con HTTPS. En bases existentes, aplicar y comprobar las migraciones y scripts de la [guía de instalación](instalacion/local.md), incluido el umbral de aprobación y las políticas académicas vigentes. | Responsable de despliegue. |
| 8 | Validar el flujo completo de aceptación | Automatizar PA-02 a PA-18 con datos propios de E2E. Incluir asignación de rúbrica, cierre escrito y oral, cálculo, actas, finalización y recuperación de borradores. Repetir las mediciones de rendimiento en aceptación. | Ambiente de aceptación. RNF-17, S4-17 y [prueba de carga](validacion-rnf-03-carga.md). |
| 9 | Validar correcciones de notas cerradas | Probar una solicitud con evaluación cerrada, sin acta archivada y con el trabajo sin finalizar. Confirmar quién tramita la corrección, cuándo exige evidencia y cómo se gestiona externamente un acta emitida. | Coordinación y autoridades de la facultad. |
| 10 | Validar las políticas académicas de cada ámbito | Probar las configuraciones ya disponibles para reemplazos por etapa, convocatorias por reprobación, etapas personalizadas y excepciones de programación y cierre. Verificar la trazabilidad y que la presidencia no agregue una tercera nota. | [Configuración general](configuracion-general.md) y Coordinación. |
| 11 | Validar fechas, horas y salas del Cronograma | Impedir fechas pasadas, admitir horas entre 06:00 y 23:00, validar en pantalla y servidor, y avisar si la sala está ocupada antes de guardar. | |
| 12 | Confirmar el contenido y la escala de las actas oficiales | Confirmar códigos académicos, origen de los datos que debe completar Genares y plantilla PAT por período. Probar la escala y la nota en letras en las actas y mostrar la escala correspondiente en los listados que mezclen períodos. Mantener los campos manuales acordados en el plan del núcleo. | Institución, Coordinación y equipos que provean los datos. |
| 13 | Completar el cierre de calificación para el tribunal | Mostrar al cerrar la oral la nota del miembro, el estado de los demás, el PDF y el acceso al siguiente estudiante. Mostrar la nota consolidada y el acta cuando estén listas. Dar visibilidad a las evaluaciones pendientes y facilitar el cierre de la escrita antes de la defensa. | Ver «Al terminar de calificar y nota final del tribunal». |
| 14 | Probar la APK con tribunales en dispositivos reales | Revisar desplazamiento, gestos simultáneos, rueda de notas, menú y apertura de PDF en Android. Comprobar el caso sin lector PDF y los enlaces antiguos de rúbricas. Probar también la interfaz web en iPad. | Tribunales y ambiente de aceptación. |
| 15 | Completar el trabajo sin conexión | Descargar y actualizar la agenda, las rúbricas y los trabajos asignados. Medir el tamaño, descargar los PDF de tesis bajo demanda y probar la sincronización ante cambios de tribunal o sesión. Mantener el cierre con confirmación del servidor. | Acordar con la institución el almacenamiento, el cifrado y el borrado al cerrar sesión. |
| 16 | Preparar la APK exclusiva del tribunal | Darle una entrada con agenda, evaluaciones y recuperación de borradores, reutilizando las pantallas de S4. | Paso 4, S4-15. |
| 17 | Corregir los estados y la búsqueda del Cronograma | Mostrar y filtrar «Programada», «En curso o pendiente» y «Cancelada» según la hora. Retirar estados sin resultados y el aviso «Sin inicio real registrado». Permitir buscar por sala. | |
| 18 | Corregir el detalle de Modalidad | Aceptar identificadores válidos de PostgreSQL, como en Carreras, y comprobar que abren las modalidades de prueba. | Ver «Errores encontrados». |
| 19 | Simplificar Mis evaluaciones | Agrupar por trabajo, estudiantes y tribunal. Mostrar las acciones disponibles, explicar los bloqueos y filtrar por evaluaciones pendientes o cerradas por etapa. Revisar con el tribunal que el formulario, el total y los indicadores faltantes se entiendan en los cambios recientes. | Probar en móvil, tablet y escritorio. |
| 20 | Mostrar nombres y estados legibles | Usar títulos, nombres de estudiantes y versiones de rúbrica donde aparecen identificadores internos. Unificar nombres del menú, títulos, rutas, estados y mensajes que hoy usan términos técnicos. | Ver la revisión de UX/UI. |
| 21 | Mejorar la edición, los filtros y el PDF del Cronograma | Editar desde la lista, buscar trabajos habilitados, alinear los campos, añadir filtros rápidos, limpiar filtros y ordenar por fecha y hora. Aplicar los mismos filtros y orden al PDF. | |
| 22 | Completar los datos de la rúbrica en PDF | Guardar la letra explícita de cada categoría y usarla en el PDF. Revisar si la línea de fuente debe configurarse por versión y comprobar la presentación de la escala en los documentos. | Ver el plan del núcleo y las diferencias de plantilla. |
| 23 | Dar acceso directo a rúbricas y documentos | Facilitar el acceso al PDF desde el expediente, Mis evaluaciones, Coordinación y Secretaría. Confirmar qué se muestra en Resultados y en Documentos, retirar bloques duplicados y revisar los nombres de descarga al usar el visor. | El nombre al guardar desde el visor depende del navegador y del acceso institucional. |
| 24 | Mejorar Inicio, navegación y filtros generales | Dar jerarquía a Inicio, facilitar «Volver» y el acceso a consultas, reducir avisos repetidos, simplificar los filtros de Trabajos y ajustar detalles visuales de formularios y listados. | Probar a 360, 768 y 1440 px. Acordar cualquier cambio de la insignia de visibilidad. |
| 25 | Organizar las entregas y automatizar las comprobaciones | Fijar la fecha de entrega o de la primera sustentación. Crear o actualizar las tareas S4-01 a S4-17, organizar el tablero y configurar GitHub para compilar y probar cada PR. | Paso 5, sección 4.1. |
| 26 | Mantener la demostración al día | Verificar que la rama `demo/accesos-por-rol` incluya los avances que se mostrarán y que los usuarios de prueba puedan recorrer el flujo previsto. | [Usuarios de prueba](demo-usuarios.md). |
| 27 | Actualizar la documentación de uso e instalación | Preparar un manual breve para docentes y coordinación sobre calificación, cierre, modo sin conexión y PDF. Añadir `s4-asignacion-rubrica-proceso.sql` a la tabla de scripts del README y documentar el cálculo con ejemplos. | Para el redondeo, usar la regla institucional confirmada. |
| 28 | Actualizar la evaluación de calidad | Registrar los resultados de seguridad, pruebas con usuarios y mediciones en aceptación y actualizar [calidad-iso-25010.md](calidad-iso-25010.md). | Resultados de las pruebas y revisión de seguridad. |
| 29 | Confirmar si se requieren correos automáticos | Acordar si los avisos por correo entran en el alcance y en qué eventos se enviarían. | Coordinación. |
| 30 | Evaluar la importación de rúbricas desde Word | Si hay tiempo, leer categorías, indicadores y puntos, abrir el formulario existente con los datos y guardar la versión revisada como borrador. | La opción «Nueva versión basada en…» ya está disponible. |

## En pocas palabras

Las funciones de S4 están hechas y probadas en local:

- rúbricas y sus versiones;
- cronograma de sustentaciones;
- evaluaciones escrita y oral, con borradores que se guardan aunque se corte la conexión;
- cálculo de notas y redondeo;
- estados de cada trabajo y de cada estudiante;
- seguimiento, documentos PDF y auditoría;
- la app del tribunal para Android.

Las secciones siguientes conservan los detalles técnicos y las decisiones de las revisiones anteriores. Consulta la tabla para ver el orden de trabajo y la [guía de Configuración general](configuracion-general.md) para conocer las opciones ya implementadas. La [guía de instalación](instalacion/local.md) detalla los scripts de cada base existente.

## Plan del núcleo: rúbricas y calificación (decidido el 16/11/2026)

El núcleo de S4 es **crear la rúbrica, asignarla y calificar con ella**. Lo demás depende de eso. Se separan dos cosas:
- **La rúbrica como datos:** etapas, categorías, indicadores, puntos y porcentajes. Con ellos se califica y se calcula la nota.
- **La rúbrica como documento:** su aspecto en PDF. Se dibuja a partir de esos datos.

Así, una rúbrica nueva funciona sin diseñar ningún PDF.

**Principio: todo adaptable, nada único** (17/11/2026). Las rúbricas cambian según la modalidad y el año, y no siempre se puede preguntar a las autoridades. Por eso el sistema no fija ninguna rúbrica: quien coordina la configura, el sistema comprueba que cuadre y todo lo demás sale de ahí (cálculo, nota mínima, redondeo y PDF). Hay dos versiones distintas de la rúbrica de Proyecto Integrador:

| | Word «RUBRICA DEFENSA TRABAJO IC 5 PUNTOS» | Plan de titulación PAT-04-F-001, revisión 1, apartado 6.2 |
| --- | --- | --- |
| **Escrita** (documento, compartida) | A Resumen 1,00 + B Marco teórico 1,00 + C Diagnóstico 3,00 = **5** (50 %) | A Resumen 2,50 + B Marco teórico 2,50 + C Diagnóstico 5,00 = **10** (50 %) |
| **Oral** (sustentación, por estudiante) | D Empoderamiento 2,50 + E Conclusiones 2,50 = **5** (50 %) | A Empoderamiento 2,50 + B Conclusiones 2,50 + **C Producto 5,00** = **10** (50 %) |
| **Nota final** | 5 + 5 = **10** | 50 % de 10 + 50 % de 10 = **sobre 10** |
| **Letras** | Seguidas: A–E | Empiezan de nuevo en cada parte: A–C y A–C |

- **No son equivalentes.** Cambian los pesos (en el Plan, el Resumen vale el 12,5 % de la nota; en el Word, el 10 %), y solo el Plan califica el **Producto**. Hay que preguntar cuál está vigente. El sistema puede tener las dos y activar la que corresponda.
- **El Plan no da 20.** Dice que cada parte vale 10 puntos «que serán considerados como el 50 % de la nota final», así que la nota final es sobre 10. Por ejemplo, documento 8 y sustentación 9 dan 8,50. Es justo lo que ya calcula hoy el sistema: cada parte sobre 10 y con peso del 50 %. El acta PAT-04-F-017 escribe la suma (16/20), que equivale a lo mismo (8/10). Con la nota mínima en porcentaje (70 %), aprueba o reprueba igual en las dos formas. Falta preguntar cómo quieren que aparezca en el acta.
- **Errata en el Plan:** la categoría A del documento dice «(2.20 puntos)», pero sus indicadores suman 2,50 (0,83 + 0,83 + 0,84). El sistema lo detectaría al validar.

Las dos versiones caben en el modelo actual: una parte escrita compartida y una oral individual. Qué hay que configurar y dónde:

| Qué | Dónde | Hoy |
| --- | --- | --- |
| Una rúbrica para cada modalidad | Rúbricas | Ya existe |
| Categorías, indicadores, puntos y **letra de cada categoría** | Versión de rúbrica | Categorías, indicadores y puntos configurables. Letra explícita pendiente |
| Puntos y porcentaje de cada parte | Versión de rúbrica | Configurable para escrita y oral |
| Escala de la nota final (10, 20 o 100) | Versión de rúbrica | Implementada (`backend/fixtures/s4-escalas-calificacion.sql`) |
| Nota mínima (70 % de la escala) | Configuración académica | Implementada como porcentaje (mismo script) |
| Regla de redondeo | Cálculo de la nota final | HALF_UP directo a dos decimales. La decisión de aprobación usa la nota publicada |
| PDF de la rúbrica | Se dibuja desde la versión | Incluye la escala final de la versión |

**La letra de cada categoría se guarda, no se calcula.**
- Hoy el PDF pone las letras seguidas en todo el documento, y le funciona al Word (A–E).
- Con la rúbrica del Plan, la sustentación saldría como **D. Empoderamiento, E. Conclusiones, F. Producto**, cuando el original dice A, B, C.
- El PDF debe usar la letra guardada en cada categoría.

**Si aparece una modalidad sin parte escrita o con tres partes**, hay que revisar la decisión de [decisiones/2026-11-12-etapas-escrita-oral.md](decisiones/2026-11-12-etapas-escrita-oral.md). Las dos versiones conocidas no lo necesitan.

Orden de trabajo:

1. **La rúbrica admite sus puntos reales y una escala configurable.**
   - Cada etapa con sus puntos (5 + 5), sin el 10 fijo. **Hecho el 17/11/2026 en «Nueva rúbrica» y «Nueva versión»:**
     - cada etapa vale lo que suman sus indicadores, con un máximo de 100;
     - cada etapa se divide entre lo que vale y se pondera; la nota final sale en la escala de la versión;
     - el PDF imprime «(50%)» cuando no hay porcentajes guardados.

     **Esquema de calificación (17/11/2026), primer paso de «Nueva rúbrica»:**
     - **«Sumar puntos»:** las partes suman la nota final (5 + 5 = 10, 3 + 7 = 10, 10 + 10 = 20). No se guardan porcentajes y cada parte pesa según lo que vale.
     - **«Porcentajes»:** cada parte vale lo que quiera y se indica su peso; los pesos suman 100 %.
     - **Atajos** «Oficial: 5 + 5 = 10» y «10 + 10 al 50 % cada una».
     - **Valor de cada parte declarado de antemano:** el formulario avisa «faltan X de Y».
     - **Validaciones iguales en el servidor**, que ahora guarda el porcentaje elegido. «Nueva versión basada en…» hereda el esquema de la versión base.

     **Escala final y nota mínima (17/11/2026):**
     - escala de 10, 20 o 100 por versión de rúbrica, elegida en el paso «B. Esquema»;
     - nota mínima en porcentaje (70 %), convertida a cada escala;
     - la aprobación se compara con la nota final redondeada una sola vez.

     Para una base ya creada hay que ejecutar una vez `backend/fixtures/s4-escalas-calificacion.sql`. En la base local ya está aplicado.

     **Límite actual:** solo dos partes (escrita y oral), por la decisión del 12/11. Las actas PAT muestran las notas de cada parte sobre 10 aunque la escala final sea 100.
   - La escala final y la nota mínima, en la versión de rúbrica y en la configuración académica.
   - Después se carga la **rúbrica oficial** de Proyecto Integrador con un fixture y se deja activa. **Hecho el 17/11/2026:**
     - `002` la crea en las bases nuevas como versión V1;
     - `backend/fixtures/s4-rubrica-vigente-proyecto-integrador.sql` la carga en una base existente o en la integrada, con parámetros: crea la versión, la activa, archiva la anterior y la deja vigente por carrera;
     - ensayado en la base local dentro de una transacción deshecha, dos veces seguidas sin duplicar nada.

     Por la retención, la rúbrica de la base local conserva su nombre «DEV - …», porque una rúbrica usada no se renombra. `003` y la carga ahora puntúan cada indicador.

   Detalle en la sección 4, «Configuración académica de escalas».
2. **Calificar rápido.**
   - Una ventana al cerrar la oral, con la nota, el estado del otro miembro, «Generar mi rúbrica PDF», «Siguiente estudiante» y «Volver».
   - La nota final aparece en cuanto cierra el último miembro.
   - Cerrar la escrita antes del día de la defensa.

   Detalle en la sección 4, «Al terminar de calificar».
3. **El PDF de la rúbrica se dibuja desde los datos.** **Hecho el 17/11/2026, junto con las actas PAT-01 y PAT-04: ya no se usan Word ni PowerShell.**
   - Se dibuja con `pdfkit`, que ya estaba instalado.
   - Lleva el encabezado, el pie y la marca de la plantilla oficial; las imágenes están en `Plantillas-documentos/imagenes/`.
   - Los textos largos bajan solos y se añaden páginas si hace falta.
   - Comprobado con datos de ejemplo y con datos de la base local:
     - la rúbrica sale en 2 páginas, como el original;
     - cada acta en 1 página;
     - tardan menos de 0,2 s.
   - **Hecho (17/11/2026):**
     - el PDF lleva el **nombre completo del estudiante** en su nombre de archivo («María Estudiante TI B - rúbrica miembro 2.pdf») y en su título;
     - la línea «Fuente: Comisión Académica…» bajo la última tabla de cada parte, fija para la Facultad de Ciencias de la Vida y Tecnologías;
     - en las actas, la vista previa dice «No. (sin número)»;
     - la rúbrica se ve aunque no haya evaluaciones, con las casillas de calificación vacías.
   - **Aviso:** el visor del navegador abre el PDF desde una dirección temporal y puede proponer otro nombre al guardar. Para que siempre use el del servidor habría que abrir la dirección real, lo que depende de cómo sea la autenticación institucional.
   - **Falta:**
     - la letra de cada categoría (ver arriba);
     - la escala real en el resumen: sigue «10.00» fijo, que se resuelve en el paso 1.
     - **Rúbrica igual a la plantilla (17/11/2026).** Se midió el PDF oficial (posiciones, tamaños, bordes e imágenes) y se copió. Usa **Carlito**, una letra libre (licencia OFL, en `Plantillas-documentos/fuentes/`) con las mismas medidas que la Calibri del original. Lleva:
       - el cuadro de título, estudiante y tutor con bordes;
       - «PARTE I/II» y «(50%) 5 PUNTOS»;
       - los indicadores con sangría francesa;
       - casillas vacías mientras la parte no esté cerrada;
       - «CALIFICACIÓN FINAL»;
       - la firma «MIEMBRO TRIBUNAL» sin nombre;
       - el pie recortado como en Word.

       Ya no sale «PRELIMINAR» ni la línea de estado. Con el mismo contenido ocupa 2 páginas, como el original; las líneas caen a menos de 12 pt de su sitio.
     - **Diferencias que quedan:**
       - «Página X de Y» usa Carlito en vez de Century Gothic, que es de pago;
       - falta la línea «Fuente: Comisión Académica…», que debe guardarse en cada versión de rúbrica y necesita un cambio en la base;
       - algunas rarezas del Word no se copian: espacios dobles, «(1. punto)» y «(3.0 puntos)», y un renglón vacío de más antes de la categoría C;
       - alguna línea justificada puede cortarse en otra palabra.
     - La «CALIFICACIÓN FINAL» de la rúbrica de cada miembro muestra el resultado consolidado del tribunal. **Decidido el 17/11/2026:** se queda así. Las filas de categorías muestran las notas de ese miembro; la casilla final, la nota consolidada, y queda vacía mientras falten evaluaciones.
4. **Importar una rúbrica desde el Word oficial** (si da tiempo):
   1. se sube el Word;
   2. el sistema lee las categorías, los indicadores y los valores de sus tablas;
   3. muestra el formulario ya relleno para revisarlo;
   4. se guarda como borrador.

   Mientras tanto, para un año nuevo se usa **«Nueva versión basada en…»**, que ya existe: se copia la versión anterior y se cambian solo los números.
5. **Actas PAT-01 y PAT-04.** Ya se dibujan con `pdfkit` (ver el paso 3), así que no hace falta `pdf-lib` ni crear casillas en el PDF. El texto de cada acta está copiado literalmente en `documentos/pdf-actas.ts`. Si la institución publica una revisión nueva, hay que copiar ahí el texto nuevo.

   **Datos que Genares ya rellena (17/11/2026):**
   - estudiante, cédula, título del trabajo, modalidad, carrera, notas y resultado;
   - la fecha y la hora de la última sesión programada del estudiante, en letras y en número. Sin sesión programada se conservan los «xx» del formato.

   Comprobado con un acta real de la base local.

   **Firmas: no las rellena el sistema (decisión de Josué, 17/11/2026).**
   - Los títulos y nombres de presidente, miembros, graduado, tutor y autoridades los completa la facultad a mano; es información interna suya.
   - El acta imprime esa parte tal cual el formato.
   - Por eso no hace falta pedir a S3 quién preside cada tribunal.

   **El resto de huecos se queda como en el formato (decisión de Josué, 17/11/2026):** ciudad, literal (a o b) y título que se obtiene. Para las actas PAT no hace falta tanta precisión, así que **no** se construye el modal de «Datos pendientes del acta» ni la configuración por carrera.

   Si en el futuro llega otro documento que sí los necesite, la idea sigue siendo:
   1. configurar una vez los datos fijos;
   2. un modal solo para lo que cambie en cada documento;
   3. archivar esos valores junto al PDF.

   **Descartado (17/11/2026):** subir el PDF oficial y marcar los espacios a mano. Exigiría un editor visual de PDF y es frágil con textos largos. Para la rúbrica no sirve, porque sus tablas crecen con cada versión.

**Descartado:** subir el PDF de la rúbrica y dibujar encima los campos a mano. Exigiría construir un editor visual de PDF dentro del sistema, sería engorroso para coordinación y se rompería con cualquier cambio de formato.

## 3. Experiencia e interfaz (UX/UI)

Observaciones de revisar las pantallas principales a 1440 px. La accesibilidad básica ya se corrigió; ver RNF-14 en [estado-paso-1.md](estado-paso-1.md).

### Lo más importante

1. **Se muestran identificadores internos en vez de nombres.** En Trabajos, el detalle del trabajo, Mis evaluaciones y Resultados aparecen códigos largos como `a6cf3b0c-d212-75ed-…` como si fueran el código del trabajo, el del estudiante o el de la rúbrica. El usuario debería ver el título del trabajo, el nombre del estudiante y la versión («DEV-1»), no esos códigos.
2. **Hay lenguaje técnico a la vista:**
   - «MER UNIFICADO · S2 + S3 + S4»;
   - «Tribunal de S3», «Evaluadores de S3», «Estudiante de S2»;
   - «Prueba local con PostgreSQL»;
   - «Se consultan desde S4»;
   - «Dashboard» en la ruta de navegación.

   Quien evalúa no necesita saber de qué subsistema viene cada dato. Mejor: «Tribunal», «Evaluadores», «Estudiante».
3. **Mis evaluaciones está muy cargada.** Cada trabajo muestra muchos botones («Evaluar oral | Estudiante1…», «Resultado | Estudiante1…»…) y datos separados por barras «|». Mejor: un botón principal por trabajo y lo demás dentro.

### También conviene

4. **Avisos al inicio de cada pantalla.** Recuadros como «Alcance institucional», «Resultado consultivo» o «Prueba local» empujan el contenido hacia abajo. Se pueden acortar, juntar o mostrar una sola vez.
5. **Nombres que no coinciden:**
   - el menú dice «Mis evaluaciones», pero la página se titula «Evaluaciones» y su ruta empieza en «Gestión académica»;
   - el menú dice «Inicio», pero la página se llama «Resumen operativo».
6. **Evaluación oral.** Antes de llegar al formulario hay que pasar por la estructura completa de la rúbrica y la lista de escritas. Mejor poner primero el formulario y dejar lo demás plegado.
7. **Estados en mayúsculas.** En la lista de escritas aparece «CERRADA»; mejor «Cerrada», como en el resto de pantallas.
8. **Filtros de Trabajos.** Se ven nueve filtros a la vez y el del período se corta («DEV-2026B (ac»). Mejor mostrar los principales y dejar el resto en «Más filtros».
9. **Detalles menores:**
   - «202 trabajo(s)» podría ser «202 trabajos»;
   - en Resultados, las etiquetas redondas de estado («Completa») son muy grandes. **Corregido el 17/11/2026:** la etiqueta de cada etapa ya no se estira hasta el alto de la tarjeta.

### Antes de cambiar

- **La insignia «Estado: 1 · visible»** de cada tarjeta se puso por una decisión aprobada sobre registros visibles y ocultos ([decisiones/2026-11-10-retencion-visibilidad-auditoria.md](decisiones/2026-11-10-retencion-visibilidad-auditoria.md)). Si confunde, hay que acordar el cambio antes de quitarla.
- **Revisar a 360, 768 y 1440 px.** Probar cada cambio en móvil, tablet y escritorio, como piden las reglas del módulo.
- **No crear un formulario de rúbrica nuevo:** las reglas piden mejorar el que ya existe (`FormularioRubrica`).

## 4. Revisión de pantallas (16/11/2026)

Observaciones de Josué al probar el sistema el 16/11/2026. Las notas fechadas documentan los cambios posteriores, y la tabla inicial recoge lo que falta.

### Errores encontrados

| Dónde | Qué pasa | Causa comprobada |
| --- | --- | --- |
| Detalle de una modalidad | Sale «No fue posible cargar el detalle · Seleccione una modalidad válida» | La pantalla exige un formato concreto de identificador (UUID versión 4), y los de la base de prueba no lo cumplen. Debe aceptar cualquier identificador válido de PostgreSQL, como ya hacen Carreras y otras pantallas (`esUuidPostgres`). Archivo: `presentation/services/modalidadesApi.js`. |
| Crear la rúbrica oficial | La rúbrica real (Parte I: A 1,00 + B 1,00 + C 3,00 = 5 puntos; Parte II: D 2,50 + E 2,50 = 5 puntos) **no se puede crear tal cual** | «Nueva rúbrica» obliga a que cada etapa sume exactamente 10,00. Hay que permitir que cada etapa tenga sus puntos reales (5 + 5) y que la nota final salga sobre la escala de la rúbrica (en este caso, 10). Ver «Configuración académica de escalas». |
| Cronograma | Se pueden programar fechas pasadas y a cualquier hora (00:00–23:59) | El servidor solo comprueba que la fecha exista y que la hora sea válida. |

### Inicio y navegación

- Inicio necesita más color y jerarquía. Los indicadores se ven todos iguales.
- Es fácil perderse con tantos saltos entre pantallas. La ruta «Inicio > Dashboard» confunde, y el acceso a Inicio debería ser más visible desde cualquier pantalla.
- Abrir en otra pestaña lo que es consulta (expediente, resultado, PDF), para no perder la lista desde la que se viene, y tener siempre un «Volver» claro.

### Cronograma

1. **Agregar y editar en una ventana emergente** (modal) que no saque al usuario de la lista. Hoy el formulario ocupa toda la pantalla.
2. **Trabajo habilitado:** un buscador en vez de una lista desplegable larga.
3. **Fechas y horas:**
   - no permitir fechas pasadas;
   - horas solo de 06:00 a 23:00;
   - comprobarlo también en el servidor, no solo en la pantalla.
4. **Sala:** avisar **antes de guardar** si la sala ya está ocupada a esa hora. Hoy la base lo rechaza al guardar.
5. **Campos alineados:** «Duración estimada» queda más alto que Fecha, Hora y Sala.
6. **Tabla:**
   - más sencilla;
   - filtros rápidos «Hoy», «Mañana» y «Esta semana»;
   - ordenar por fecha y hora, en orden ascendente o descendente.
7. **PDF del cronograma** con los mismos filtros y el mismo orden que la tabla. Hoy respeta carrera, período, estado y búsqueda, pero no tendrá los filtros nuevos.
8. **Botón «Borrar filtros»**, en el Cronograma y en todas las pantallas con filtros.
9. Mostrar el estado según la hora, retirar las opciones de estado sin resultados y buscar por sala. Ver la tarea «Corregir los estados y la búsqueda del Cronograma».

### Mis evaluaciones

1. **La tarjeta se ve desordenada** («información flotando»). Hay que agrupar trabajo, estudiantes y tribunal con una jerarquía clara.
2. **Menos botones, y solo los que sirven:**
   - **«Calificar escrita»** para la parte escrita, que es compartida;
   - **«Calificar oral»** por estudiante, solo si el estudiante ya tiene sesión de sustentación;
   - **«Ver resultado»** solo si ya hay alguna calificación.

   Con nombres fáciles de distinguir, y abriendo en otra pestaña.
3. **Filtro por estado de calificación:**
   - me falta calificar;
   - ya califiqué la escrita;
   - ya califiqué la oral;
   - ya califiqué las dos.

   No existe todavía.
4. **Calificar debe ser rápido y sencillo**, en la escrita y en la oral: menos desplazamiento, el formulario primero y el total siempre a la vista.

   **Prioridad alta (17/11/2026).** Josué lo probó con la demo por roles y calificar la escrita le resultó muy engorroso. Lo que lo complica hoy:
   - **Encontrar dónde empezar:**
     - el recorrido es Mis evaluaciones → «Registrar evaluación escrita»;
     - ese botón solo aparece si el trabajo tiene exactamente dos miembros de tribunal (`PaginaMisEvaluaciones.jsx`);
     - si no los tiene, no hay ningún aviso de por qué falta.
   - **Pantalla mezclada:** la de la escrita (`PaginaEvaluacionesIntegradasDev.jsx`) junta la estructura de la rúbrica, las evaluaciones de los demás y el formulario de calificación. Quien califica tiene que buscar dónde poner la nota.
   - **Dos pasos poco claros:** «Guardar borrador escrita» y «Cerrar evaluación escrita». Cerrar exige todos los indicadores, pero no se ve cuántos faltan.

   Propuesta:
   - pantalla con solo el formulario de la rúbrica, con los indicadores en orden y la nota de cada uno al lado;
   - el total y «faltan N indicadores» siempre a la vista;
   - guardado automático del borrador;
   - un solo botón «Cerrar», que diga qué falta;
   - lo demás (rúbrica completa, notas de los otros miembros) en una pestaña o un panel aparte.

### Resultados, Documentos y PDF

1. **«Ver rúbrica PDF · miembro 1 y 2» debe abrir el PDF en otra pestaña**, no llevar a Documentos. **Hecho el 17/11/2026, para todos los PDF:** se abren en una **pestaña nueva, directamente en el visor de PDF del navegador**, que ya trae descargar, imprimir y zoom. No hay pantalla de Genares alrededor. Afecta a:
   - «Ver rúbrica PDF · Miembro N» (Resultados);
   - «Abrir rúbrica PDF de…» (evaluación cerrada);
   - los botones de Documentos (rúbrica, vista previa del acta, generar acta y abrir acta archivada);
   - el justificativo de Correcciones;
   - la nueva «Vista previa PDF» de Rúbricas.

   Cómo funciona:
   - la pestaña se abre en el mismo clic, así el navegador no la bloquea;
   - si el PDF falla, se cierra y el error se explica en la pantalla de origen;
   - código: `presentation/services/pestanaPdf.js` y `components/BotonPdf.jsx`.

   Comprobado en Chrome con la base local: Rúbricas y Resultados abren el visor de PDF y la pantalla de origen no se mueve.

   **Falta:**
   - **APK Android, hecho el 17/11/2026 sin probar en un teléfono:**
     - el WebView no tiene visor de PDF ni pestañas: en la APK, todos los botones PDF guardan el archivo en la caché de la app con el nombre del estudiante y lo abren con la aplicación de PDF del teléfono, que permite guardarlo, compartirlo o imprimirlo;
     - se añadieron `@capacitor/filesystem` 8.1.5 y `@capacitor/file-viewer` 2.0.4 a `frontend/package.json`, autorizados por Josué. Al integrar con el repositorio común hay que avisar al responsable;
     - el servidor envía `Access-Control-Expose-Headers: Content-Disposition` en los PDF de Documentos y en la vista previa de Rúbricas, para que la APK lea el nombre del archivo;
     - código: `infrastructure/dispositivo/pdfNativo.js` y `presentation/services/pestanaPdf.js`;
     - la APK de depuración compila (`gradlew assembleDebug` con el JDK 21 de Android Studio; el JBR 25 no sirve para esta versión de Gradle).

     **Falta:**
     - probarlo en un teléfono o un emulador: aquí no había ninguno conectado;
     - si el teléfono no tiene lector de PDF, se avisa con un mensaje;
     - los enlaces antiguos `/rubrica/…` (`PaginaImpresionRubrica.jsx`) siguen yendo a la URL del PDF y en la APK no funcionan. Ningún botón actual lleva ahí.
   - **Nombre al descargar desde el visor:** el servidor ya envía el nombre del estudiante, pero el visor puede proponer otro (ver «Aviso» en el plan del núcleo).
   - **Documentos:** un enlace con trabajo, estudiante y miembro ya no abre la rúbrica solo (el navegador lo bloquearía); deja todo seleccionado para pulsar «Visualizar rúbrica».
   - Coordinación y Secretaría mantienen el enlace a Documentos para emitir actas y consultar vistas previas. Las rúbricas y las actas archivadas se abren directamente desde sus propios botones.

2. **Rúbrica PDF antes de calificar.** Al haber una versión de rúbrica fijada y un tribunal confirmado, el PDF muestra la estructura de la rúbrica y los puntajes de las etapas cerradas. Las casillas de las demás etapas aparecen vacías.
3. **Rúbrica de cada estudiante.** El PDF se abre desde el expediente y desde Mis evaluaciones. Mis evaluaciones muestra el acceso para los puestos devueltos por la asignación de cada estudiante.
4. **Diferencia entre Resultados y Documentos.** Propuesta, por confirmar:
   - Resultados = notas;
   - Documentos = consulta de los PDF de **un estudiante concreto**.
5. **Resultados (pantalla Consulta).** Los bloques de auditoría y documentos archivados se retiraron de esta pantalla. Se consultan desde Auditoría y Documentos.
6. **Textos de estado** como `SIN_EVALUACION`: mostrarlos legibles («Sin evaluación»).

### Rúbricas

1. **Crear una rúbrica es engorroso.** Decidido en el plan del núcleo: «Nueva versión basada en…» y, más adelante, importar desde el Word. Opciones que se barajaron:
   - partir de una plantilla o de una versión anterior;
   - un asistente paso a paso;
   - pegar la estructura de la rúbrica oficial.
2. En «Nueva rúbrica» los campos no son proporcionales: «Nombre de la rúbrica» es más alto que «Versión».
3. **Rúbrica oficial vigente por defecto:** la de Proyecto Integrador debe cargarse tal cual y quedar activa para su modalidad y período, sin que nadie tenga que crearla a mano. El original está en [Plantillas-documentos/RUBRICA DEFENSA TRABAJO IC 5 PUNTOS.docx](Plantillas-documentos/RUBRICA%20DEFENSA%20TRABAJO%20IC%205%20PUNTOS.docx):

   | Parte | Categoría | Puntos | Indicadores |
   | --- | --- | --- | --- |
   | I · Proyecto escrito (50 %, 5 puntos) | A. Resumen e introducción | 1,00 | 0,33 · 0,33 · 0,34 |
   | | B. Marco teórico de la investigación | 1,00 | 0,33 · 0,33 · 0,34 |
   | | C. Diagnóstico o estudio de campo | 3,00 | 1,00 · 1,00 · 1,00 |
   | II · Sustentación (50 %, 5 puntos) | D. Empoderamiento y defensa del trabajo realizado | 2,50 | 0,83 · 0,83 · 0,84 |
   | | E. Conclusiones y Propuesta | 2,50 | 0,83 · 0,83 · 0,84 |
   | | **Calificación final** | **10,00** | |

   Se cargará con un fixture SQL cuando se admitan etapas de 5 puntos. Los textos de los indicadores se copian literalmente del documento.

   **Ojo:** hay otra versión oficial, la del Plan de titulación PAT-04-F-001 (10 + 10 al 50 %, con «Producto»). Ver «Principio: todo adaptable» en el plan del núcleo. Antes de cargar una como predeterminada hay que confirmar cuál está vigente (sección 6, pregunta 8). La del Plan se podría cargar ya hoy, porque usa partes de 10 puntos.

### Configuración académica de escalas (lo más delicado)

Las ponderaciones cambian de un año a otro:
- unas veces cada parte vale 10 y la nota es sobre 10;
- otras, cada parte vale 5 (que equivale a 10) y la suma da 10;
- y puede darse 10 + 10 = 20.

Hoy el sistema:
- ya guarda en cada versión de rúbrica el porcentaje de cada etapa (por ejemplo, 50 % y 50 %);
- pero obliga a que cada etapa sume 10 al crearla;
- y tiene la nota final fija sobre 10 en el cálculo, las actas y los PDF.

Propuesta:
- que cada **versión de rúbrica**, que ya va por período, indique los puntos reales de cada etapa y la **escala de la nota final**;
- que una pantalla de **Configuración académica** muestre y permita ajustar esos valores por período;
- que todo se calcule desde ahí, sin números fijos en el código.

Así un cambio de año es solo una versión nueva de la rúbrica. Ver «Si la norma cambia» en [decisiones/2026-11-12-etapas-escrita-oral.md](decisiones/2026-11-12-etapas-escrita-oral.md).

**Aprobado por Josué el 16/11/2026:** la escala la define cada rúbrica.

**Condiciones para que no haya problemas** (comprobarlas antes de dar el cambio por terminado):
1. **Las versiones ya usadas no cambian.** Una evaluación queda ligada a su versión, y esa versión conserva sus máximos aunque al año siguiente se use otra. Las notas antiguas se siguen calculando igual.
2. **La rúbrica se valida al activarla:**
   - los indicadores suman lo que vale su categoría;
   - las categorías suman lo que vale su etapa;
   - los porcentajes de las etapas suman 100 %.

   Si no cuadra, no se puede activar.
3. **Nota mínima según la escala.** **Confirmado (17/11/2026): es 7 sobre 10.** Para que se adapte sola:
   - se guarda como **porcentaje de la escala (70 %)**, no como un 7 fijo;
   - así sale 7 sobre 10, 14 sobre 20 o 3,5 sobre 5 sin que nadie tenga que calcularlo;
   - en la configuración se puede cambiar si algún año la institución fija otro valor.
4. **Las actas deben mostrar la escala de la rúbrica.** Unos 12 archivos de S4, sin contar pruebas, tienen un 10 fijo. Ya se vieron tres casos:
   - el resumen del PDF de la rúbrica pone siempre «10.00»;
   - las actas escriben siempre «/10»;
   - la nota en letras solo sabe contar hasta «diez», así que una nota de 16 sobre 20 saldría mal.
5. **Las dos actas usan escalas distintas.** La PAT-04-F-017 trae de ejemplo 7/10 + 9/10 = **16/20**, y la PAT-01-F-019 trae XX/10 en las tres filas. Hay que confirmar cuál corresponde a cada período.
6. **Pruebas con las tres escalas** (10/10, 5 + 5 y 10 + 10 = 20) en el cálculo, las actas y los PDF.
7. **Informes que mezclan períodos:** si un listado compara notas de años con escalas diferentes, debe mostrar cada nota con su escala.

### Al terminar de calificar y nota final del tribunal

**Cómo funciona hoy** (comprobado en `evaluaciones/mer/borrador-oral.reglas.ts`):
- Cada miembro del tribunal califica en su propio equipo, y sus notas no se mezclan con las de los demás.
- La nota final **no es en tiempo real**. Se calcula cada vez que alguien consulta el resultado, con las evaluaciones **cerradas** que hay en ese momento.
- **Va por estudiante, no por todo el curso.** Un estudiante tiene nota final cuando **todos** los miembros del tribunal han cerrado:
  - la escrita del trabajo, que es compartida;
  - la oral de ese estudiante.

  No hay que esperar a que estén calificados todos los demás estudiantes.
- Cálculo:
  1. se promedian las notas de los miembros en cada etapa;
  2. cada etapa pesa según su porcentaje;
  3. el resultado se presenta redondeado a 2 decimales.
- Antes, al cerrar la oral solo aparecía el texto «Evaluación cerrada en PostgreSQL». Ahora se abre el resumen con la nota confirmada, el estado del tribunal y la rúbrica PDF.
- Todos los PDF se descargan con el nombre `documento.pdf`.

**Propuesta para agilizar** (aprobada por Josué el 16/11/2026, junto con el nombre de los PDF por cédula):
1. **Ventana al cerrar la oral**, con:
   - la nota que acaba de poner ese miembro;
   - el estado de los demás («Miembro 2: calificando…» o «Miembro 2: cerrado»);
   - los botones **Generar mi rúbrica PDF**, **Siguiente estudiante** y **Volver**.

   La rúbrica de cada miembro **ya se puede generar en cuanto él cierra**, porque no depende de los demás.
2. **Cuando el servidor confirma el resultado consolidado**, la ventana muestra la **nota final** y abre la sección de Documentos del estudiante. Allí se elige el formato y se genera o reimprime el acta con el permiso correspondiente.
3. **Actualización del tribunal.** El resumen consulta el expediente cada cinco segundos mientras está abierto y falta el resultado. El usuario puede seguir con el resto de la evaluación.
4. **Cerrar la escrita antes del día de la defensa.** Es la revisión del documento. Si ya está cerrada, el día de la sustentación solo queda la oral y la nota final sale en cuanto el último miembro termina.
5. **Lista de lo que falta** para el presidente del tribunal o Secretaría, por ejemplo «Falta: Miembro 2 · oral de Juan Pérez», con avisos dentro del sistema. Los avisos por correo están por confirmar (ver AGENTS.md).

**Nombre de los PDF:**
- **Ahora:** que el archivo se llame con la cédula del estudiante, por ejemplo `1312345678_rubrica_miembro-1.pdf` o `1312345678_acta_PAT-04-F-017.pdf`, aunque se genere en el momento.
- **Más adelante:** guardar los PDF definitivos con ese nombre.
- **Depende de otros:** la cédula viene de los datos de S2. Si falta, hoy sale «Por confirmar».

### PDF de la rúbrica y de las actas

**Plantillas oficiales** en [Plantillas-documentos/](Plantillas-documentos/), en Word y en PDF:
- la rúbrica de 5 puntos (2 páginas);
- el acta PAT-01-F-019 (1 página);
- el acta PAT-04-F-017 (1 página).

Los PDF están exportados desde Word y no tienen campos de formulario.

**Cómo funciona desde el 17/11/2026:** el backend **dibuja los tres documentos con `pdfkit`**, sin Word ni PowerShell. Funciona igual en Windows y en Linux. Archivos, en `backend/src/modules/s4-calificaciones/documentos/`:
- `pdf-dibujo.ts`: página A4, encabezado y pie oficiales, y tablas que continúan en la página siguiente.
- `pdf-rubrica.ts`: la rúbrica, dibujada desde la versión de rúbrica guardada. Una rúbrica nueva sale en PDF sin tocar plantillas ni código.
- `pdf-actas.ts`: el texto literal de PAT-01-F-019 y PAT-04-F-017. El sistema sustituye los mismos marcadores que antes («XX/10», «… (NOMBRES)»…) y, si falta alguno, avisa con un error.

Detalles:
- **No es idéntico píxel a píxel al Word:** la letra es Helvetica, no Calibri. Sí tiene la misma estructura, las mismas medidas de página y el mismo número de páginas.
- **El encabezado** sale de la plantilla de la rúbrica (Facultad de Ciencias de la Vida y Tecnologías). **El Word de las dos actas trae el logo de la «Facultad de Hotelería y Turismo»**, que es un error de la plantilla, así que no se usa. Conviene avisarlo.
- **El PDF se genera en el momento.** Las actas definitivas archivadas siguen su propio proceso.
- **Si cambia el texto oficial de un acta**, hay que copiarlo en `pdf-actas.ts`.

**Limpieza pendiente:**
- **La plantilla de rúbrica lleva datos reales** en el Word y en el PDF: el título de una tesis y los nombres de un estudiante y de un tutor. No salen en los PDF generados, porque se sustituyen, pero sí están en el repositorio. Hay que cambiarlos por textos de ejemplo.
- **No subir los archivos `~$….docx`.** Son temporales de Word mientras el documento está abierto.

### Corrección de una nota cerrada

Ya existe: Auditoría › Solicitudes de corrección.
- **Exige adjuntar un PDF justificativo** y que otra persona con permiso apruebe la solicitud.
- **Queda en el historial** con el motivo, la nota anterior y la nueva.
- Para probarlo hace falta una evaluación **cerrada**, sin acta archivada y con el trabajo sin finalizar.
- No se pudo comprobar en esta revisión; hay que probarlo con esas condiciones.

### Preguntas para las autoridades

1. **Corrección de notas:** cualquier miembro del tribunal puede solicitar la corrección de su nota y adjuntar evidencia en PDF, sin exigir un modelo documental. La persona con permiso de gestión tramita el caso en Solicitudes. Las firmas y el tratamiento posterior de un acta emitida corresponden al procedimiento externo.
2. **Datos de las actas.**
   - **Campos que hoy se quedan sin rellenar:**
     - fecha y hora en letras;
     - ciudad;
     - título académico;
     - nombres y títulos del tribunal, del decano y del secretario.

     ¿De dónde salen: de S1, S2 o S3, o se escriben a mano?
   - **Plantillas de referencia.** La PAT-04-F-017 suma sobre 20 (7/10 + 9/10 = 16/20) y la PAT-01-F-019 sobre 10. La parte técnica está en «PDF de la rúbrica y de las actas», más arriba.
3. **Redondeo y decimales.** Criterio actual: conservar 6,995 como valor original, publicar 7,00 y marcar aprobado sobre 10 con mínimo 7. El administrador debe poder versionar el umbral y el método. Las notas siguientes documentan la discusión anterior sobre los pasos de cálculo:
   - **Cómo funciona hoy el sistema:**
     - las notas de cada indicador se escriben con hasta 2 decimales;
     - los cálculos intermedios se hacen con **precisión exacta**, sin redondear;
     - solo al mostrar la nota se redondea a 2 decimales, subiendo cuando el siguiente decimal es **5 o más** (9,445 → 9,45; 9,444 → 9,44).
   - **Respuesta recibida (16/11/2026):** sí se redondea en varios pasos. Ejemplo del peor caso: 9,99451 → 9,9945 → 9,995 → **10,00**. Redondeado de una sola vez daría **9,99**.
   - **Esto cambia la regla aprobada.** La regla vigente es la de los AGENTS.md: precisión exacta y un solo redondeo a 2 decimales. Antes de programarlo hace falta **confirmarlo por escrito**:
     - ¿en qué momento se redondea a 4 decimales: al promediar a los evaluadores, al calcular cada etapa o al sumar la nota final?
     - ¿se pasa después por 3 decimales, como en el ejemplo, o directamente de 4 a 2?
   - **Respuesta (17/11/2026):** se trabaja con **hasta 4 decimales** y solo se redondea **la nota final**, en pasos:
     1. de 4 a 3 decimales, mirando el 4.º;
     2. de 3 a 2 decimales, mirando el 3.º.

     Nunca se redondean el 1.º ni el 2.º decimal. Ejemplo: 9,99451 → 9,9945 → 9,995 → **10,00**.
   - **Queda una duda:** cuando un cálculo intermedio tiene más de 4 decimales, ¿se **redondea** o se **corta** al 4.º? Con 8,12446:
     - si se redondea: 8,1245 → 8,125 → **8,13**;
     - si se corta: 8,1244 → 8,124 → **8,12**.

     Hasta que se confirme, el sistema debe permitir elegirlo en la configuración, con «redondear» como valor por defecto.
   - **Propuesta:**
     - guardar la regla en Configuración académica (cuántos decimales en cada paso), para no fijarla en el código;
     - calcular siempre las dos versiones;
     - **si el redondeo en pasos da una nota distinta del redondeo directo, mostrar una alerta** en el resultado y en el acta, por ejemplo «9,99 redondeado de una vez; 10,00 con la regla en pasos»;
     - guardar en el historial qué regla se aplicó.
4. **Sin conexión como en Drive:** hoy la APK guarda los borradores en el teléfono y los envía al volver la conexión, pero **solo de las evaluaciones que se abrieron antes con conexión**. Cerrar una evaluación exige servidor.

   **Decidido (16/11/2026):** la APK debe descargar todo lo que tiene asignado el docente.

   **Almacenamiento:**
   - **Cuánto ocupa** (estimación, sin medir): cada trabajo con su rúbrica, sus estudiantes y su tribunal son unos pocos kilobytes de texto. Un docente con 30 o 40 trabajos no llegaría a 1 MB, así que el espacio no es problema.
   - **Lo que sí pesa son los PDF** de las tesis (S3), de varios megas cada uno. Propuesta: no descargarlos todos de entrada; solo los que el docente marque o abra.
   - **Dónde guardarlo:**
     - hoy se usa el almacén sencillo de Capacitor (Preferences), que sirve para borradores;
     - para guardar todo lo asignado conviene una base local en el teléfono (SQLite) o archivos en el almacenamiento de la app;
     - hay que medir el tamaño real antes de decidir.

   **Reglas:**
   - **Descarga y actualización:** al iniciar sesión con conexión y cada cierto tiempo. Se muestra la fecha de la última actualización («Datos del 16/11, 08:30»).
   - **Seguridad:** son datos personales de estudiantes. Deben borrarse al cerrar sesión y, si es posible, guardarse cifrados por si se pierde el teléfono.
   - **Cambios mientras se estaba sin conexión:** si coordinación reprograma o cambia el tribunal, el servidor manda al sincronizar y se avisa al docente. Esto ya pasa hoy con los borradores, que rechazan la versión vieja.
   - **El cierre sigue exigiendo conexión.** Una nota no queda cerrada hasta que el servidor la confirma (AGENTS.md, perfil C).
5. **Documento técnico:** dejar escrito de forma clara y precisa:
   - cómo se promedian los evaluadores;
   - cómo pesa cada etapa;
   - cómo se calcula la nota final;
   - el redondeo: 5 o más sube, y la regla en pasos cuando las autoridades la confirmen (pregunta 3);
   - cómo funciona el modo sin conexión.

   Puede ser un documento nuevo en `docs/s4/`, con ejemplos numéricos.

## 5. Datos útiles

- **Base local:** además de los 2 trabajos DEV, tiene 200 trabajos «CARGA» de prueba. Se ocultan con `backend/fixtures/s4-carga-volumen-dev-ocultar.sql`.
- **Usuarios de prueba por rol:** están en la rama aparte `demo/accesos-por-rol`, con 9 usuarios de las fases 1 y 2. Sirven para demostrar qué ve cada rol. Las instrucciones están en `docs/s4/demo-usuarios.md` **de esa rama**, y antes hay que ejecutar `backend/fixtures/demo-usuarios-por-rol.sql`. Esa rama no se integra: el trabajo sigue en `feature/mer-unificado-pasos-3-4`.
- **PDF sin Word:** desde el 17/11/2026 los PDF no necesitan Word ni PowerShell. La línea `GENARES_POWERSHELL_EXE` del `backend/.env` ya no se usa y se puede borrar.
- **Rendimiento:** con 202 trabajos y 25 usuarios a la vez, el sistema responde rápido (ver [validacion-rnf-03-carga.md](validacion-rnf-03-carga.md)). La pantalla más lenta es Finalización.
- **Avisos ya conocidos:**
  - si un trabajo tuviera un proceso antiguo sin rúbrica, la evaluación muestra un mensaje genérico;
  - al copiar una versión de rúbrica y editarla en el mismo paso, los porcentajes se reparten por igual.

## 6. Otros puntos a tener en cuenta (16/11/2026)

Riesgos y preguntas registrados al repasar el plan del núcleo. La tabla inicial incorpora las comprobaciones y decisiones que siguen pendientes.

### Pueden bloquear el plan del núcleo

1. **Que no se asigne la rúbrica oficial.**
   - La asignación automática solo funciona si hay **exactamente una** versión activa para esa modalidad y período.
   - Si al cargar la oficial sigue activa la rúbrica DEV, habrá dos candidatas y no se asignará ninguna.
   - **Decidido (17/11/2026): la rúbrica DEV era solo un ejemplo y no se conserva.**
     - Como en S4 no se borra nada, se **archiva y se oculta** (`estado_registro = 0`) con un fixture SQL idempotente, que se ejecuta en pgAdmin.
     - Deja de verse y de asignarse, pero queda en el historial.
     - Hay que hacerlo **antes** de activar la oficial, para que haya una sola candidata.
2. **Los trabajos que ya tienen rúbrica asignada.** Los trabajos DEV, y los 200 «CARGA», ya están ligados a la versión DEV. Al ocultarla hay que decidir qué pasa con ellos:
   - **sin evaluaciones:** se reasignan a la rúbrica oficial;
   - **con evaluaciones:** se quedan con la versión DEV, porque una versión ya aplicada no se cambia. Esos trabajos de prueba se ocultan también, o se crean otros nuevos para probar con la rúbrica oficial.

   Hay que comprobar antes que ocultar la versión no rompa la consulta de esos trabajos.
3. **Pruebas que fallarán a propósito.** Hoy las pruebas comprueban que «cada etapa suma 10». Al cambiar la regla, esas pruebas fallarán. No es un error, es el cambio aprobado. Hay que actualizarlas y dejar constancia de que la regla cambió con permiso, porque las reglas del módulo prohíben cambiar resultados esperados por cuenta propia.
4. **Documentos oficiales del Paso 1 y del Paso 2.** Si cambian la escala o el redondeo, sus reglas de negocio (RN) dejarán de coincidir con el sistema. Hay que actualizar esos documentos, no solo el código.
   - **También los AGENTS.md** del módulo, en backend y frontend. Hoy dicen «un solo redondeo a 2 decimales», y la respuesta del 17/11/2026 es otra: 4 decimales y pasos 4 → 3 → 2.
   - Conviene escribir la nueva regla en `docs/s4/decisiones/`, con ejemplos, antes de programarla.

### Preguntas para las autoridades (además de las de la sección 4)

5. **Reemplazo en la defensa.** El miembro del tribunal o el administrador registra el reemplazo acordado, mediante selección del catálogo de S3 o ingreso del nombre. S4 conserva quién registró el cambio, cuándo, a quién reemplaza y desde qué etapa interviene. La escrita ya registrada conserva su autor. El acuerdo entre docentes es externo y registrar el cambio no depende del envío de correo.
6. **Presidencia.** Interviene presencialmente si hay desacuerdo. En S4 califican los dos miembros, cada uno con su propia nota. El cierre no requiere una tercera nota ni una acción del presidente.
7. **Reprobación y solicitudes.** Mostrar «Reprobado» y habilitar su gestión desde Solicitudes para quien tenga permiso. El administrador puede asignar el caso a un período posterior y retomarlo desde «Revisión escrita pendiente». Registrar el intento anterior y permitir definir plazo, tribunal, rúbrica y si se conserva o se repite la escrita.
8. **Configuración por ámbito y vigencia.** TI y Software son las carreras iniciales. El administrador asigna la versión de rúbrica por carrera, modalidad y período. Deben coexistir distribuciones como 5 + 5 y 2,50 + 2,50 + 5,00. Conservar la versión utilizada en cada evaluación.
9. **Programación y cierre.** Con las dos escritas completas se habilita programar. Configurar por separado si se admite programación excepcional con escritas pendientes y cuándo se bloquea el cierre. Registrar las excepciones aplicadas.

### Para la entrega y la demostración

8. **La rama demo se quedará atrás.** `demo/accesos-por-rol` se hizo a partir del estado del 16/11/2026. Cada mejora nueva habrá que llevarla también a esa rama, o la demostración mostrará la versión vieja.
9. **Manual corto para quien use el sistema.** Hay guías para desarrolladores (PRIMEROS-PASOS), pero no para docentes ni coordinación:
   - cómo calificar;
   - cómo cerrar;
   - qué hacer sin conexión;
   - cómo sacar los PDF.

   Una página con capturas basta.
10. **Datos personales en la APK.** Descargar todo lo asignado guarda datos de estudiantes en los teléfonos. Hay que confirmar con la institución que cumple la Ley Orgánica de Protección de Datos Personales de Ecuador. Ya está anotado que se borren al cerrar sesión y que se cifren (sección 4, pregunta 4).
11. **Actualizar la evaluación ISO/IEC 25010** ([calidad-iso-25010.md](calidad-iso-25010.md)) cuando cambien la seguridad y el modo sin conexión.

### Organización

12. **Poner una fecha límite.** El plan del núcleo tiene orden, pero no fechas. Con la fecha de entrega o de la primera sustentación real se sabe qué es obligatorio y qué queda para si hay tiempo. Por ahora, los pasos 1 y 2 del plan son los imprescindibles.

</details>
