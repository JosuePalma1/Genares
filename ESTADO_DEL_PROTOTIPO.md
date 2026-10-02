# Estado actual del prototipo Genares

## Propósito de este documento

Este documento explica, con palabras sencillas, qué partes del prototipo ya están listas y cuáles todavía necesitan trabajo.

El sistema cubre únicamente la evaluación de trabajos de titulación, desde el registro del trabajo y la asignación del tribunal hasta el cierre e impresión de la rúbrica.

No cubre el proceso completo de titulación ni las actividades posteriores a la evaluación.

## Resumen general

Actualmente existe una demostración navegable del flujo principal.

Una persona puede entrar con un perfil simulado, registrar un trabajo, revisar el avance, evaluar y generar una rúbrica. Los cambios de la demostración se guardan en el navegador para que no se pierdan al recargar la página.

Sin embargo, la aplicación todavía no guarda esos cambios en PostgreSQL. La estructura de la base de datos está preparada, pero falta conectar las pantallas con el backend.

Por esta razón, el sistema actual sirve para revisar y demostrar el proceso, pero todavía no debe usarse con información real.

---

## Lo que ya está implementado

### 1. Diseño y navegación

- Se reutilizaron los colores, tarjetas, tablas, formularios y estilos del prototipo anterior.
- Las pantallas ahora funcionan con React.
- Existe un menú común para todas las pantallas.
- El diseño se adapta a computadoras, tablets y teléfonos.
- Las acciones importantes usan botones reales y no enlaces sin funcionamiento.

### 2. Acceso simulado

- Existe una pantalla de entrada al prototipo.
- Se puede seleccionar una persona ficticia para probar diferentes roles.
- No se solicitan usuarios ni contraseñas institucionales.
- No se ha inventado una conexión con Microsoft 365 o con otro proveedor de acceso.

### 3. Roles

El prototipo permite revisar el sistema desde los siguientes perfiles:

- Comisión Académica.
- Miembro del tribunal.
- Secretaría.
- Coordinación.
- Administrador.

Las acciones cambian según el perfil seleccionado. Por ejemplo, Secretaría y Coordinación pueden consultar información, pero no pueden modificar calificaciones.

### 4. Registro de trabajos

- Se puede registrar el título del trabajo.
- Se puede seleccionar la modalidad.
- Se puede seleccionar el período académico.
- Se puede seleccionar la carrera.
- Se puede asociar un tutor.
- Se puede registrar uno o varios estudiantes.
- Cada estudiante tiene cédula, nombres y apellidos.
- El trabajo inicia con el estado “Registrado”.

### 5. Asignación del tribunal

- La Comisión Académica puede seleccionar dos miembros del tribunal.
- No se permite seleccionar dos veces al mismo docente.
- Se muestra el nombre del docente.
- Se muestra su carrera.
- Se muestra la cantidad de tribunales que tiene asignados.
- La selección es manual; el sistema no decide automáticamente quién debe formar parte del tribunal.
- La asignación se bloquea cuando ya existe una revisión escrita cerrada, para no dañar la información registrada.

### 6. Notificaciones internas

- Existe una campana en la parte superior de la aplicación.
- Se muestra la cantidad de notificaciones sin leer.
- Se puede abrir el listado de notificaciones.
- Se puede marcar una notificación como leída.
- Se pueden marcar todas como leídas.
- Cada notificación puede llevar a la pantalla relacionada.
- Se generan notificaciones al asignar el tribunal.
- Se generan notificaciones al programar una sustentación.
- No se envían correos electrónicos.

### 7. Estados y avance del trabajo

El prototipo contempla estos estados:

1. Registrado.
2. Tribunal asignado.
3. Revisión escrita pendiente.
4. Revisión escrita completada.
5. Sustentación programada.
6. Sustentación pendiente.
7. Evaluación completada.
8. Finalizado.

También se muestra claramente qué miembro ya realizó la revisión escrita y cuál continúa pendiente.

### 8. Revisión escrita

- Cada miembro del tribunal realiza su propia revisión.
- La revisión puede guardarse como borrador.
- Guardar un borrador no cierra la evaluación.
- Se calculan automáticamente los valores por categoría.
- No se permite superar el máximo de cada indicador.
- Antes de cerrar la revisión se muestra una confirmación.
- Después del cierre, los campos quedan bloqueados.

La revisión escrita pertenece al trabajo. Si el trabajo tiene dos estudiantes, ambos comparten esta parte de la calificación.

### 9. Programación de la sustentación

- Se puede registrar la fecha.
- Se puede registrar la hora.
- Se puede registrar la sala.
- Se muestran el trabajo, los estudiantes y el tribunal relacionados.
- No se puede programar la sustentación si falta la revisión escrita de uno de los dos miembros.
- Al confirmar la programación se generan notificaciones internas.

### 10. Evaluación oral individual

- La evaluación oral se realiza por estudiante.
- Cuando un trabajo tiene dos estudiantes, aparecen separados en la pantalla.
- Se puede cambiar entre estudiantes sin perder ni reemplazar la información del otro.
- Cada estudiante tiene su propio borrador.
- Cada miembro del tribunal realiza una evaluación oral para cada estudiante.

### 11. Rúbrica y cálculos

La rúbrica del prototipo utiliza esta estructura:

- Categoría A: máximo 1 punto.
- Categoría B: máximo 1 punto.
- Categoría C: máximo 3 puntos.
- Total de la parte escrita: máximo 5 puntos.
- Categoría D: máximo 2,5 puntos.
- Categoría E: máximo 2,5 puntos.
- Total de la sustentación: máximo 5 puntos.
- Calificación final de cada miembro: máximo 10 puntos.

El sistema calcula automáticamente:

- El total de cada categoría.
- El total de la parte escrita.
- El total de la sustentación.
- La nota final entregada por cada miembro.
- El promedio final de los dos miembros del tribunal.

Cuando existen dos estudiantes, cada uno recibe su propio promedio final.

### 12. Cierre definitivo

- Se diferencia entre “Guardar borrador” y “Finalizar”.
- Antes del cierre definitivo aparece una alerta de confirmación.
- La alerta permite volver y revisar.
- La alerta permite confirmar la evaluación.
- Una evaluación cerrada ya no se puede modificar.
- Se muestra el estado “Evaluación finalizada”.
- La rúbrica cerrada puede consultarse e imprimirse nuevamente.

### 13. Documento para imprimir

La impresión contiene:

- Encabezado institucional provisional.
- Modalidad.
- Parte escrita y parte oral.
- Título del trabajo.
- Nombre del estudiante.
- Cédula del estudiante.
- Nombre del tutor.
- Nombre del miembro del tribunal.
- Indicadores.
- Valores máximos.
- Calificaciones.
- Totales por categoría.
- Resumen final.
- Calificación final sobre 10 puntos.
- Espacio para firma.

El documento se llama “Rúbrica de evaluación”. No se presenta como un acta oficial.

### 14. Dashboard y seguimiento

El dashboard muestra:

- Trabajos registrados.
- Tribunales sin asignar.
- Revisiones escritas pendientes.
- Revisiones escritas completadas.
- Sustentaciones programadas.
- Evaluaciones pendientes.
- Evaluaciones completadas.
- Trabajos finalizados.

También existe una sección que muestra el estado de cada miembro del tribunal.

### 15. Pantalla “Mis evaluaciones”

Un miembro del tribunal puede ver:

- Trabajo asignado.
- Estudiante o estudiantes.
- Modalidad.
- Carrera.
- Etapa actual.
- Fecha, hora y sala de la sustentación.
- Estado de cada estudiante.

La pantalla muestra únicamente las acciones disponibles en ese momento:

- Realizar revisión escrita.
- Continuar borrador.
- Evaluar sustentación.
- Ver rúbrica.
- Imprimir.

### 16. Consulta e historial

- Existe una pantalla para buscar por cédula, estudiante o trabajo.
- Se pueden consultar los resultados ya generados.
- No se realizó una carga masiva de estudiantes antiguos.
- El historial se construye con los registros creados en el sistema.

### 17. Preparación de la base de datos

Existe una estructura PostgreSQL preparada para guardar:

- Personas.
- Estudiantes.
- Docentes.
- Usuarios y roles.
- Carreras, períodos y modalidades.
- Trabajos con uno o varios estudiantes.
- Tutores.
- Tribunales de dos miembros.
- Programaciones de sustentación.
- Notificaciones internas.
- Rúbricas y sus versiones.
- Revisiones escritas.
- Evaluaciones orales por estudiante.
- Calificaciones y cierres.

La base también incluye reglas para evitar datos incorrectos, como una calificación mayor al máximo o una sustentación programada sin las dos revisiones escritas.

---

## Lo que está simulado actualmente

Las siguientes partes funcionan para demostrar el recorrido, pero todavía no están conectadas a un sistema real:

- El inicio de sesión.
- Los usuarios y roles.
- Los datos de estudiantes y docentes.
- Los trabajos de ejemplo.
- Las notificaciones.
- Las evaluaciones y sus borradores.
- El historial.

La información se guarda en el navegador mediante `localStorage`. Esto significa que los datos pertenecen únicamente a ese navegador y a ese equipo.

Si se limpia la información del navegador, se pueden perder los cambios del prototipo.

---

## Lo que quedó pendiente

### Prioridad alta: necesaria antes de usar datos reales

#### 1. Conectar las pantallas con el backend

Actualmente las pantallas trabajan con datos de demostración.

Falta hacer que React envíe y consulte la información mediante NestJS. Esto permitirá que varias personas trabajen con la misma información y que los datos no dependan de un solo navegador.

#### 2. Guardar el flujo en PostgreSQL

La estructura de la base ya existe, pero falta usarla desde las pantallas.

Se deben guardar realmente:

- Trabajos.
- Estudiantes asociados.
- Tutor.
- Tribunal.
- Notificaciones.
- Revisiones escritas.
- Programaciones.
- Evaluaciones orales.
- Cierres.
- Resultados.

#### 3. Crear las operaciones del backend

El backend solamente tiene una dirección sencilla para comprobar que está encendido.

Faltan las operaciones para registrar, consultar y actualizar los elementos del proceso.

#### 4. Aplicar permisos también en el backend

Las pantallas ocultan acciones según el rol, pero el backend también deberá comprobar los permisos.

Por ejemplo:

- Comisión Académica puede asignar tribunal.
- Tribunal puede calificar únicamente sus trabajos.
- Secretaría y Coordinación no pueden modificar notas.
- Administrador puede gestionar usuarios y roles.

#### 5. Completar la administración de rúbricas

Actualmente se pueden consultar las versiones y modificar visualmente un borrador, pero esos cambios no se guardan.

Falta implementar:

- Crear una rúbrica.
- Guardar cambios de un borrador.
- Crear una nueva versión.
- Activar una versión para una modalidad y período.
- Impedir cambios sobre versiones activas o históricas.

La protección histórica ya está considerada en el diseño de la base de datos.

#### 6. Completar la administración de usuarios y roles

La pantalla actual es de consulta.

Falta permitir al administrador:

- Crear o habilitar usuarios.
- Asignar uno o varios roles.
- Definir las carreras que puede consultar cada persona.
- Desactivar un acceso cuando corresponda.

### Prioridad media: completar el prototipo

#### 7. Registro manual de docentes

La base de datos permite diferenciar docentes registrados manualmente de docentes obtenidos en el futuro desde una fuente institucional.

Falta crear la pantalla y el formulario para el registro manual, si finalmente esta opción es aprobada.

#### 8. Completar los textos reales de los indicadores

El documento recibido en el requerimiento indica los valores de los indicadores, pero no contiene su descripción completa.

Por ahora se muestran como:

- Indicador 1.
- Indicador 2.
- Indicador 3.

Cuando se entregue la rúbrica física completa, deberán colocarse los textos oficiales sin cambiar los valores máximos ya configurados.

#### 9. Confirmar el diseño final de impresión

La impresión contiene toda la información solicitada, pero utiliza un encabezado institucional provisional.

Falta comparar el resultado con la rúbrica física original para ajustar:

- Logotipo autorizado.
- Tipografías.
- Espaciados.
- Bordes y distribución.
- Texto oficial de cada indicador.

#### 10. Retirar o redirigir las páginas HTML antiguas

Los archivos HTML del primer prototipo todavía están guardados como referencia.

La aplicación actual debe abrirse desde `prototipo-titulacion/index.html`. Si alguien abre directamente una página HTML antigua, verá información que ya no corresponde al flujo nuevo.

Antes de entregar una versión final, se deben mover esas páginas a una carpeta de respaldo o redirigirlas hacia React.

#### 11. Realizar pruebas completas de navegación

Ya existen pruebas para los cálculos y las reglas principales, y tanto el frontend como el backend compilan correctamente.

Todavía faltan pruebas automáticas que recorran las pantallas como lo haría una persona:

1. Registrar un trabajo.
2. Asignar el tribunal.
3. Completar las dos revisiones.
4. Programar la sustentación.
5. Evaluar a cada estudiante.
6. Cerrar la evaluación.
7. Imprimir la rúbrica.

#### 12. Revisar visualmente en tablets reales

El diseño incluye ajustes para tablets, pero todavía debe probarse en diferentes tamaños y orientaciones para confirmar que los botones, tablas y formularios sean cómodos de usar.

### Pendiente de decisiones institucionales

Estas tareas no deben desarrollarse hasta recibir una definición oficial:

- Método definitivo de inicio de sesión.
- Conexión con DIT.
- Disponibilidad y contenido exacto de la futura API institucional.
- Confirmación de si la API indica que un estudiante está apto para sustentar.
- Infraestructura y servidor institucional.
- Integración con Microsoft 365.
- Reglas técnicas adicionales solicitadas por DIT.

---

## Funciones que no deben agregarse

Las siguientes funciones están fuera del alcance de Genares:

- Ingreso de notas al SGA.
- Modificación de información dentro del SGA.
- Generación del acta oficial del SGA.
- Envío real de correos electrónicos.
- Gestión del repositorio institucional.
- Proceso posterior de graduación.
- Selección automática del tribunal mediante inteligencia artificial.

---

## Orden recomendado para la siguiente iteración

1. Crear las operaciones del backend para trabajos, tribunal, evaluaciones, sustentaciones y notificaciones.
2. Conectar las pantallas React con esas operaciones.
3. Guardar todo el recorrido en PostgreSQL.
4. Completar la creación, edición y activación de versiones de rúbricas.
5. Completar la administración de usuarios y roles.
6. Agregar pruebas automáticas del recorrido completo.
7. Probar y ajustar el diseño en tablets.
8. Comparar la impresión con la rúbrica física oficial.

Después de estos pasos, el prototipo dejará de depender de datos guardados en el navegador y estará listo para una validación funcional más cercana al uso real.

---

## Comprobaciones realizadas

- El frontend compila correctamente.
- El backend compila correctamente.
- Las pruebas de cálculo del frontend fueron aprobadas.
- Las pruebas de reglas y cálculos del backend fueron aprobadas.
- No se implementaron conexiones reales con DIT, SGA, Microsoft 365 o correo electrónico.

