# Lo que falta en Genares S4

**Actualizado:** 16/11/2026, con el plan del núcleo y la revisión de pantallas (sección 4).
Para poner el proyecto en marcha, ver [PRIMEROS-PASOS.md](PRIMEROS-PASOS.md). El detalle de cada requisito está en [estado-paso-1.md](estado-paso-1.md). Los Pasos 3, 4 y 5 se actualizaron a la versión 1.1, con los nombres reales de las tablas y el estado de la estructura y de las tareas.

## En pocas palabras

Las funciones de S4 están hechas y probadas en local:

- rúbricas y sus versiones;
- cronograma de sustentaciones;
- evaluaciones escrita y oral, con borradores que se guardan aunque se corte la conexión;
- cálculo de notas y redondeo;
- estados de cada trabajo y de cada estudiante;
- seguimiento, documentos PDF y auditoría;
- la app del tribunal para Android.

Lo que falta:

- probar todo de principio a fin;
- mejorar la experiencia de uso;
- llevar S4 al repositorio común;
- conectarlo con los usuarios reales de la institución.

## Plan del núcleo: rúbricas y calificación (decidido el 16/11/2026)

El núcleo de S4 es **crear la rúbrica, asignarla y calificar con ella**. Lo demás depende de eso. Se separan dos cosas:
- **La rúbrica como datos:** etapas, categorías, indicadores, puntos y porcentajes. Con ellos se califica y se calcula la nota.
- **La rúbrica como documento:** su aspecto en PDF. Se dibuja a partir de esos datos.

Así, una rúbrica nueva funciona sin diseñar ningún PDF.

Orden de trabajo:

1. **La rúbrica admite sus puntos reales y una escala configurable.**
   - Cada etapa con sus puntos (5 + 5), sin el 10 fijo.
   - La escala final y la nota mínima, en la versión de rúbrica y en la configuración académica.
   - Después se carga la **rúbrica oficial** de Proyecto Integrador con un fixture y se deja activa.

   Detalle en la sección 4, «Configuración académica de escalas».
2. **Calificar rápido.**
   - Una ventana al cerrar la oral, con la nota, el estado del otro miembro, «Generar mi rúbrica PDF», «Siguiente estudiante» y «Volver».
   - La nota final aparece en cuanto cierra el último miembro.
   - Cerrar la escrita antes del día de la defensa.

   Detalle en la sección 4, «Al terminar de calificar».
3. **El PDF de la rúbrica se dibuja desde los datos.**
   - Usa el formato oficial: encabezado y logo, tablas «Indicadores · Valoración · Calificación», sumatorias, resumen y firma.
   - Se hace con `pdfkit`, que ya está instalado.
   - Los textos largos bajan solos y se añaden páginas si hace falta.
   - El archivo lleva la cédula en el nombre.
   - La primera versión se compara con el PDF oficial para ajustar márgenes y letra.
4. **Importar una rúbrica desde el Word oficial** (si da tiempo):
   1. se sube el Word;
   2. el sistema lee las categorías, los indicadores y los valores de sus tablas;
   3. muestra el formulario ya relleno para revisarlo;
   4. se guarda como borrador.

   Mientras tanto, para un año nuevo se usa **«Nueva versión basada en…»**, que ya existe: se copia la versión anterior y se cambian solo los números.
5. **Actas PAT-01 y PAT-04, al final.** Hoy ya se generan desde el Word. La idea de usar el PDF con casillas (`pdf-lib`) queda aparcada hasta entonces.

**Descartado:** subir el PDF de la rúbrica y dibujar encima los campos a mano. Exigiría construir un editor visual de PDF dentro del sistema, sería engorroso para coordinación y se rompería con cualquier cambio de formato.

## 1. Se puede hacer ya

| Tarea | Qué hay que hacer |
| --- | --- |
| **App solo para el tribunal** (Paso 4, tarea S4-15) | Hoy la APK es la web completa: en el teléfono se ven Rúbricas, Auditoría, Seguimiento… El Paso 4 pide una entrada propia (`frontend/src/apps/tribunal/`) con solo lo del tribunal: su agenda, sus evaluaciones y la recuperación de borradores. Debe reutilizar las pantallas y reglas del módulo S4, no copiarlas. |
| **Corregir el estado y los filtros del Cronograma** | Desde que se quitaron «Iniciar» y «Finalizar» sustentación, una sesión solo puede estar «Programada» o «Cancelada», y el Cronograma muestra ese estado guardado. Por eso una sesión que ya empezó sigue diciendo «Programada», mientras que en Trabajos el mismo trabajo sí aparece como «Sustentación pendiente». Hay que corregir tres cosas: <br>1. Mostrar y filtrar por el estado según la hora: «Programada» antes de empezar, «En curso o pendiente» después, y «Cancelada». <br>2. Quitar del filtro «En sustentación» y «Finalizadas», que hoy nunca dan resultados, y el texto «Sin inicio real registrado». <br>3. Que el buscador encuentre también por sala. <br>Son cambios pequeños, dentro del módulo S4. |
| **Mejorar la experiencia y la interfaz** | Ver las secciones 3 y 4. Es lo más visible para quien use el sistema. |
| **Errores de la revisión del 16/11** | El detalle de Modalidad falla con los datos de prueba, la rúbrica oficial 5 + 5 no se puede crear y el Cronograma acepta fechas pasadas. Ver la sección 4. |
| **Escalas configurables** | Que los puntos de cada etapa y la escala final salgan de la versión de rúbrica y de la configuración académica, no de un 10 fijo en el código. Ver la sección 4. |
| **Organizar el trabajo en GitHub** (Paso 5) | Todavía no hay issues, tablero ni solicitudes de integración (PR). Todo está en una sola rama. Hay que crear las tarjetas S4-01 a S4-17 (su estado está en el Paso 5, sección 4.1) y trabajar con una rama por cambio y PR revisado por otra persona. |
| **Comprobación automática en GitHub** (CI) | Que cada PR compile y pase las pruebas solo, sin depender de que alguien lo haga a mano. |
| **Calidad según ISO/IEC 25010** | Ver [calidad-iso-25010.md](calidad-iso-25010.md). La más débil es la seguridad; faltan además las pruebas con usuarios reales y las mediciones en el ambiente de aceptación. Hay que actualizar el estado de cada característica cuando cambie algo. |
| **Pruebas completas de aceptación** (RNF-17, tarea S4-17) | Automatizar los escenarios PA-02 a PA-18 del Paso 1 (sección 9) contra el sistema funcionando de verdad. Hoy hay unas 560 pruebas automáticas, pero cada una prueba una pieza suelta. Sugerencia: usar datos de prueba propios (por ejemplo, con el prefijo «E2E») y ocultarlos al terminar. |
| **Revisión de seguridad** | Revisar el servidor de S4: permisos, datos que se aceptan y mensajes de error. |
| **Completar el README** | Añadir `s4-asignacion-rubrica-proceso.sql` a la tabla de scripts del `README.md` principal. El orden completo ya está en PRIMEROS-PASOS.md. |

## 2. Depende de otras personas

| Tarea | Qué falta | Con quién |
| --- | --- | --- |
| **Usuarios reales y permisos** | Hoy se entra con una identidad de prueba que lo ve todo. Falta el inicio de sesión institucional, los roles y que cada persona vea solo su carrera. Mientras no exista, el guardado y el cierre de evaluaciones solo funcionan en el modo de pruebas, y no se comprueba quién firma. | Institución y responsable del repositorio común (la carpeta `auth/` es compartida). |
| **Llevar S4 al repositorio común** | Hoy esta rama es una aplicación independiente. Hay que pasar solo las carpetas de S4, sin reemplazar archivos compartidos, mediante solicitudes de integración revisadas (Paso 5). | Responsable de integración. |
| **Actas oficiales** | Las actas en PDF se generan, pero sin los códigos académicos reales. | Institución. |
| **Nota mínima** | El 7,00 está puesto como provisional. | Institución. |
| **Trabajos terminados** | Confirmar si S2 cambia el estado de una asignación cuando el trabajo termina, para la consulta del historial. | Equipo de S2. |
| **Correos automáticos** | No están en los requisitos aprobados. Hay que confirmar si se piden. | Coordinación. |
| **Acuerdos con otros equipos** (Paso 2, D-05 a D-08) | Cerrar por escrito: <br>· cómo llega la identidad; <br>· quién crea los trabajos y sus estudiantes; <br>· qué parte del historial lee S3; <br>· si S3 consultará los resultados de S4; <br>· qué se hace con la tabla antigua `s3.defensa`. <br>Conviene guardarlos en `docs/contracts/`. | Equipos de S2 y S3, e identidad. |
| **Respuestas de las autoridades** | Quién autoriza las correcciones y con qué documento, de dónde salen los datos de las actas, qué acta va con cada período, la regla de redondeo en pasos y el modo sin conexión. Ver la sección 4, «Preguntas para las autoridades». | Coordinación y autoridades de la facultad. |
| **Ambiente de aceptación** | Publicar el sistema con HTTPS, repetir ahí la prueba de rendimiento y probar en tablet Android e iPad. | Responsable de despliegue. |

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
   - en Resultados, las etiquetas redondas de estado («Completa») son muy grandes.

### Antes de cambiar

- **La insignia «Estado: 1 · visible»** de cada tarjeta se puso por una decisión aprobada sobre registros visibles y ocultos ([decisiones/2026-11-10-retencion-visibilidad-auditoria.md](decisiones/2026-11-10-retencion-visibilidad-auditoria.md)). Si confunde, hay que acordar el cambio antes de quitarla.
- **Revisar a 360, 768 y 1440 px.** Probar cada cambio en móvil, tablet y escritorio, como piden las reglas del módulo.
- **No crear un formulario de rúbrica nuevo:** las reglas piden mejorar el que ya existe (`FormularioRubrica`).

## 4. Revisión de pantallas (16/11/2026)

Observaciones de Josué al probar el sistema, revisadas contra el código. Ninguna está hecha todavía.

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
9. Lo ya anotado en la sección 1: el estado según la hora, quitar las opciones de estado que no dan resultados y buscar por sala.

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

### Resultados, Documentos y PDF

1. **«Ver rúbrica PDF · miembro 1 y 2» debe abrir el PDF en otra pestaña**, no llevar a Documentos. Lo mismo en Coordinación y Secretaría con «Documentos de Estudiante…»: generar y mostrar el PDF directamente.
2. **La rúbrica en PDF debe poder verse siempre:** vacía si aún no hay notas, y con las notas que existan cuando las haya. Hoy, sin evaluaciones, solo aparece «Sin evaluaciones · SIN_EVALUACION».
3. **Ver la rúbrica de cada estudiante es lo más importante** y hoy cuesta llegar a ella. Debe estar a un clic desde el expediente y desde Mis evaluaciones.
4. **Diferencia entre Resultados y Documentos.** Propuesta, por confirmar:
   - Resultados = notas;
   - Documentos = consulta de los PDF de **un estudiante concreto**.
5. **Quitar de Resultados (pantalla Consulta) los bloques «Auditoría de cambios» y «Documentos archivados».** Se repiten con Auditoría › Historial de cambios y con Documentos.
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
3. **Nota mínima según la escala:** 7 sobre 10 equivale a 14 sobre 20. La nota mínima debe guardarse junto con la escala, no como un 7 fijo.
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
- Al cerrar la oral, hoy solo aparece el texto «Evaluación cerrada en PostgreSQL». No se muestra la nota ni se ofrece el PDF.
- Todos los PDF se descargan con el nombre `documento.pdf`.

**Propuesta para agilizar** (aprobada por Josué el 16/11/2026, junto con el nombre de los PDF por cédula):
1. **Ventana al cerrar la oral**, con:
   - la nota que acaba de poner ese miembro;
   - el estado de los demás («Miembro 2: calificando…» o «Miembro 2: cerrado»);
   - los botones **Generar mi rúbrica PDF**, **Siguiente estudiante** y **Volver**.

   La rúbrica de cada miembro **ya se puede generar en cuanto él cierra**, porque no depende de los demás.
2. **Cuando cierra el último miembro**, la misma ventana muestra la **nota final** del estudiante y el botón **Generar acta PDF**.
3. **Estado casi en tiempo real** del otro miembro: la pantalla consulta cada pocos segundos mientras se espera, igual que ya hace la sincronización de borradores cada 20 s. No hace falta tecnología nueva.
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

**Cómo funciona hoy:**
- el sistema abre el Word original con **Microsoft Word instalado en Windows**;
- sustituye los textos de ejemplo («XX/10», «… (NOMBRES)»…);
- lo exporta a PDF.

En un servidor Linux no funcionaría. Además, si alguien cambia la redacción del Word, el sistema deja de encontrar esos textos.

**Lo decidido (plan del núcleo, arriba):**
- **Rúbrica:**
  - el sistema **dibuja el PDF a partir de la versión de rúbrica** guardada, con el formato oficial: encabezado y logo, títulos, tablas «Indicadores · Valoración · Calificación», sumatorias, resumen y firma;
  - se hace con `pdfkit`, que ya está instalado;
  - una rúbrica nueva sale en PDF sin tocar plantillas ni código;
  - los textos largos bajan solos y se añaden páginas si hace falta.

  Contrapartida: tendrá el mismo formato, pero no será idéntica píxel a píxel al original. Hay que comparar la primera versión con el PDF oficial y ajustar márgenes y tipos de letra.
- **Actas, al final:** hasta entonces siguen saliendo del Word. Cuando se aborden:
  1. se usa el PDF oficial con **casillas con nombre** (estudiante, notas, nota en letras…);
  2. el sistema las rellena y las convierte en texto fijo;
  3. su forma casi nunca cambia, y si sale una revisión nueva del acta, se le ponen las casillas una vez.

  Para eso:
  - **`pdf-lib` en el backend.** Cambia `backend/package.json`, que es compartido, así que hay que avisar a integración.
  - **Crear las casillas con un script de una sola vez**, que genera un PDF de muestra con las casillas marcadas para revisar que están en su sitio. También se pueden crear a mano con Acrobat Pro, en «Preparar formulario».
  - **Textos largos:** dentro de una casilla el texto pasa a la línea siguiente y, si aun así no cabe, se reduce la letra. Lo que hay debajo no baja, porque un PDF no recoloca el contenido. La casilla debe reservar varias líneas, y hay que probarla con el título más largo que exista.
- **El PDF se genera en el momento**, con la cédula en el nombre del archivo. Las actas definitivas archivadas siguen su propio proceso.

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

1. **Corrección de notas:** ¿quién autoriza (qué cargo) y qué documento debe adjuntarse? El sistema ya pide un PDF, pero no sabe qué documento es válido ni quién puede aprobar.
2. **Datos de las actas.**
   - **Campos que hoy se quedan sin rellenar:**
     - fecha y hora en letras;
     - ciudad;
     - título académico;
     - nombres y títulos del tribunal, del decano y del secretario.

     ¿De dónde salen: de S1, S2 o S3, o se escriben a mano?
   - **¿Qué acta corresponde a cada período?** La PAT-04-F-017 suma sobre 20 (7/10 + 9/10 = 16/20) y la PAT-01-F-019 sobre 10. La parte técnica está en «PDF de la rúbrica y de las actas», más arriba.
3. **Redondeo y decimales.** Hay que confirmar por escrito:
   - **Cómo funciona hoy el sistema:**
     - las notas de cada indicador se escriben con hasta 2 decimales;
     - los cálculos intermedios se hacen con **precisión exacta**, sin redondear;
     - solo al mostrar la nota se redondea a 2 decimales, subiendo cuando el siguiente decimal es **5 o más** (9,445 → 9,45; 9,444 → 9,44).
   - **Respuesta recibida (16/11/2026):** sí se redondea en varios pasos. Ejemplo del peor caso: 9,99451 → 9,9945 → 9,995 → **10,00**. Redondeado de una sola vez daría **9,99**.
   - **Esto cambia la regla aprobada.** La regla vigente es la de los AGENTS.md: precisión exacta y un solo redondeo a 2 decimales. Antes de programarlo hace falta **confirmarlo por escrito**:
     - ¿en qué momento se redondea a 4 decimales: al promediar a los evaluadores, al calcular cada etapa o al sumar la nota final?
     - ¿se pasa después por 3 decimales, como en el ejemplo, o directamente de 4 a 2?
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
- **Rendimiento:** con 202 trabajos y 25 usuarios a la vez, el sistema responde rápido (ver [validacion-rnf-03-carga.md](validacion-rnf-03-carga.md)). La pantalla más lenta es Finalización.
- **Avisos ya conocidos:**
  - si un trabajo tuviera un proceso antiguo sin rúbrica, la evaluación muestra un mensaje genérico;
  - al copiar una versión de rúbrica y editarla en el mismo paso, los porcentajes se reparten por igual.

## 6. Otros puntos a tener en cuenta (16/11/2026)

Riesgos y preguntas que salieron al repasar el plan del núcleo. No están resueltos.

### Pueden bloquear el plan del núcleo

1. **Que no se asigne la rúbrica oficial.**
   - La asignación automática solo funciona si hay **exactamente una** versión activa para esa modalidad y período.
   - Si al cargar la oficial sigue activa la rúbrica DEV, habrá dos candidatas y no se asignará ninguna.
   - Hay que archivar la DEV o activar la oficial en otro período.
2. **Los trabajos que ya tienen rúbrica asignada.** Los trabajos DEV ya están ligados a la versión antigua. Para pasarlos a la oficial hay que reasignarlos, y eso solo se puede si aún no tienen evaluaciones. Lo hace una persona autorizada.
3. **Pruebas que fallarán a propósito.** Hoy las pruebas comprueban que «cada etapa suma 10». Al cambiar la regla, esas pruebas fallarán. No es un error, es el cambio aprobado. Hay que actualizarlas y dejar constancia de que la regla cambió con permiso, porque las reglas del módulo prohíben cambiar resultados esperados por cuenta propia.
4. **Documentos oficiales del Paso 1 y del Paso 2.** Si cambian la escala o el redondeo, sus reglas de negocio (RN) dejarán de coincidir con el sistema. Hay que actualizar esos documentos, no solo el código.

### Preguntas para las autoridades (además de las de la sección 4)

5. **¿Qué pasa si un miembro del tribunal no califica?** Por enfermedad, ausencia u olvido.
   - Hoy la nota final exige que **todos** cierren, así que ese estudiante se queda bloqueado.
   - ¿Se reemplaza al miembro? El tribunal lo gestiona S3.
   - ¿Qué pasa con lo que ya calificó?
6. **¿Hay un límite de diferencia entre los dos miembros?** Algunas facultades piden un tercer evaluador si las notas se separan mucho, por ejemplo 3 puntos. Si existe esa regla, hay que programarla.
7. **¿Hay segunda oportunidad si el estudiante reprueba?** ¿Existe una nueva sustentación? ¿Va con una rúbrica nueva o con la misma?

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
