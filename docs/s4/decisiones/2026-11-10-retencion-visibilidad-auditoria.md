# Diseño: retención, visibilidad y auditoría de S4

**Estado:** implementada y aplicada en `genares_integrado_dev` local el 10/11/2026. El fixture se ejecutó dos veces y la verificación transaccional terminó correctamente con `ROLLBACK`.  
**Alcance:** datos propiedad de S4 en `genares_integrado_dev` y el módulo Genares de esta rama.

## Objetivo

Conservar los registros de S4, permitir ocultarlos sin borrarlos y poder reconstruir quién cambió qué y cuándo. La regla debe funcionar desde la API y desde operaciones SQL normales en pgAdmin. No modifica `gen`, `s1`, `s2` ni `s3`; S4 continúa consultando los datos académicos que administran esos esquemas.

## Decisiones aprobadas

### 1. Retener filas y separar visibilidad de estado

- Ninguna operación de Genares ejecutará `DELETE` físico sobre una tabla S4.
- Los registros operativos que puedan ocultarse tendrán `estado_registro SMALLINT NOT NULL DEFAULT 1 CHECK (estado_registro IN (0,1))`: `1` significa visible y `0` oculto. En las pantallas se mostrará **Estado: 1**; al cambiarlo a `0`, el registro desaparecerá de la interfaz operativa.
- `estado_registro` será independiente de estados de negocio como `BORRADOR`, `CERRADA`, `ACTIVA`, `PROGRAMADA` o `CANCELADA`. El backend lo expondrá como `estadoRegistro` para no confundirlo con el estado académico. Ocultar una fila no la reabre, no la cancela ni cambia su significado.
- Listas, selectores, detalles, cronograma y consultas regulares mostrarán solo `estado_registro=1`. La bitácora autorizada podrá conservar el ID y metadatos del cambio, pero no volverá a mostrar el registro oculto como elemento operativo.
- La marca se aplicará a rúbricas y su estructura/versiones, vigencias/asignaciones de versión, procesos, evaluaciones y puntajes, programaciones y participantes, notificaciones y actas archivadas. La implementación cotejó esta lista con las tablas reales de S4.
- Las vigencias con intervalo (`vigente_desde`/`vigente_hasta`) conservarán su historial con ese mecanismo; no se reescribirá una vigencia pasada para simular que nunca existió.

### 2. Bloquear borrado físico en la base

- Una función y disparadores de PostgreSQL rechazarán `DELETE` en las tablas de S4. Un disparador de sentencia también rechazará `TRUNCATE`.
- Disparadores de PostgreSQL aplicarán además dos protecciones académicas ante SQL directo: no permitir cambios ordinarios a los campos de evaluaciones cerradas ni alterar el contenido de versiones de rúbrica que ya tengan procesos/evaluaciones asociados. El único cambio permitido a una evaluación cerrada será `estado_registro` para ocultarla o restaurarla; sus notas y estado académico permanecen intactos. Las transiciones de ciclo de vida de una versión (por ejemplo, `ACTIVA` a `ARCHIVADA`) y su retiro por `estado_registro=0` seguirán permitidos; no cambian su estructura académica. El procedimiento extraordinario RF-36 será la única excepción futura para corregir notas cerradas y requerirá una operación privilegiada con aprobación y auditoría; hasta que exista, la base bloqueará también esos cambios desde la API.
- El rol de aplicación no recibirá permiso `DELETE` sobre S4. Los flujos S4 actuales no ofrecen borrado físico; el reemplazo de etapas de un borrador archivará filas con `estado_registro=0`. La marca puede cambiarse desde SQL autorizado mientras las operaciones futuras de administración de visibilidad se incorporan con los permisos académicos correspondientes.
- Las operaciones directas de `INSERT`/`UPDATE` en pgAdmin seguirán auditadas por disparadores. Un usuario de pgAdmin podrá ocultar filas con `UPDATE ... SET estado_registro = 0`; el intento de `DELETE` dará error y no eliminará datos.
- La regla cubre operaciones SQL ordinarias. El propietario o superusuario de PostgreSQL conserva capacidad técnica para deshabilitar disparadores o alterar el esquema; esa capacidad no se puede bloquear desde el propio esquema y debe permanecer restringida administrativamente.

### 3. Guardar responsable y fecha

- Los datos operativos tendrán `creado_por`, `actualizado_por` y `actualizado_en` cuando falten; las columnas de creación y actualización existentes se reutilizarán.
- Un disparador asignará actor e instante en cada inserción/actualización para que el dato quede registrado también si el cambio se hizo desde pgAdmin.
- La API establecerá el actor dentro de la misma transacción. Mientras no exista autenticación institucional, usará `GENARES:LOCAL_DEVELOPMENT`. Si una sesión SQL no establece un actor, el registro guardará el rol de PostgreSQL (`session_user`) y el nombre de aplicación, sin afirmar que identifican a una persona. Con el Paso 9 se sustituirá el actor provisional por la identidad institucional.
- Los registros anteriores a la instalación no tienen identidad histórica verificable: no se inventará un responsable retroactivo. Sus nuevos cambios sí quedarán auditados.

### 4. Mantener una bitácora append-only

- Se añadirá `s4.eventos_cambio_registro`, alimentada por disparadores en la misma transacción de cada alta o modificación aceptada. Cada fila incluirá fecha/hora, actor, rol de base, tabla, clave del registro, tipo de operación y valores anteriores/nuevos de los campos cambiados.
- Las entradas serán append-only: el rol de aplicación no podrá editarlas, borrarlas ni truncarlas; un disparador también rechazará esos cambios ordinarios.
- Los registros existentes `auditoria_rubricas`, `eventos_auditoria_evaluacion`, `eventos_trazabilidad_trabajo` e `historial_nota_minima` se conservarán para sus eventos de dominio. La bitácora nueva completará la auditoría de cambios de filas, incluso los hechos directamente en pgAdmin; no reemplazará el motivo, la aprobación o el contexto académico que registran los eventos especializados.
- Traspasos y eventos de auditoría/trazabilidad seguirán siendo registros históricos append-only, sin marca que permita ocultar la bitácora. Las actas archivadas podrán llevar `estado_registro` para retirarlas de la interfaz normal sin cambiar el PDF guardado. Los contadores/configuración de S4 no necesitan una marca de visibilidad, pero sus cambios sí se auditan.
- Un cambio que se revierta por fallo de transacción no generará un evento confirmado. Los intentos rechazados de `DELETE` tampoco se registran en esta bitácora transaccional; PostgreSQL devuelve el error y no cambia los datos.

### 5. Proteger las reglas académicas actuales

- El contenido y las relaciones de versiones de rúbrica ya utilizadas seguirán inmutables (RN-09/RF-20). Los cambios de estado de ciclo de vida existentes (por ejemplo, activar/archivar) y retirarlas de nuevos usos no alteran las evaluaciones que ya las referencian.
- Una evaluación cerrada no se podrá editar académicamente mediante operaciones ordinarias. Se podrá ocultar con `estado_registro=0` sin reabrirla ni borrar sus datos; la interfaz normal no mostrará esa fila. Solo el procedimiento extraordinario autorizado de RF-36 podrá corregir sus notas, conservando la versión anterior y el evento de aprobación; no se implementará una vía de re-apertura informal.
- La base impedirá cambiar etapas, categorías, indicadores y reglas de una versión que ya esté referenciada por un proceso de evaluación. Se podrá retirar la versión para impedir nuevas asignaciones (`estado_registro=0`), sin cambiar los procesos ni resultados existentes.
- Los borradores seguirán usando control de revisión y rechazo de escrituras obsoletas. Cuando se retire un indicador/etapa de una rúbrica no utilizada, se marcará con `estado_registro=0` y se actualizará el árbol vigente del borrador; no se borrará en cascada.
- Los resultados y documentos continuarán sujetos a sus reglas actuales: no se calcularán como definitivos hasta cerrar las evaluaciones requeridas y las actas archivadas no se sobrescribirán.

## Implementación aplicada y verificación

1. Se cotejaron las tablas y privilegios actuales de S4 y se conservaron las filas existentes.
2. Se creó y aplicó dos veces `backend/fixtures/s4-retencion-visibilidad-auditoria.sql`; la segunda ejecución fue idempotente. No se ejecutaron migraciones antiguas ni se modificaron tablas de S1–S3.
3. Las entidades, consultas y adaptadores S4 filtran `estado_registro=1`; las vistas operativas muestran el valor numérico **Estado: 1**.
4. Los servicios establecen el actor en la transacción, conservan registros al ocultarlos y mantienen los controles de versiones y cierres.
5. Se añadió una consulta paginada de auditoría protegida por permisos a la pantalla existente de historial.

`backend/fixtures/verificar-retencion-visibilidad-auditoria.sql` terminó con su aviso de comprobaciones exitosas y `ROLLBACK`. Compilaciones y pruebas quedan registradas en el plan de implementación y en el cierre de esta entrega. Esta aplicación local no ejecuta migraciones antiguas ni modifica datos de S1–S3.

### Correcciones posteriores a la revisión final

- Las consultas de evaluaciones, consolidados, detalle y PDF ocultan también los hijos de una etapa o categoría oculta. Las instantáneas guardadas no se reescriben: se presenta una copia filtrada. Los resultados cerrados siguen usando sus totales guardados.
- El fixture recrea los índices únicos que una base anterior tenga sin el filtro `estado_registro = 1`.
- La protección de puntajes cerrados revisa la evaluación de origen y la de destino de un `UPDATE`.

## Verificación de aceptación

- Ejecutar dos veces el script en una base de prueba y comprobar que la segunda ejecución no duplica objetos ni altera datos.
- Confirmar que `DELETE` y `TRUNCATE` fallan para tablas S4, desde la API y desde una sesión SQL ordinaria; comprobar que S1–S3 no fueron alteradas.
- Verificar desde pgAdmin y desde la API que una evaluación cerrada y el contenido de una rúbrica utilizada no se pueden modificar; confirmar que retirar esa versión solo evita nuevas asignaciones y conserva los procesos existentes.
- Crear, modificar y ocultar un registro: verificar `estado_registro` (1/0), actor, fecha y evento con antes/después. Repetir un `UPDATE` desde pgAdmin y comprobar la misma auditoría.
- Verificar que un `DELETE` rechazado conserva fila y relaciones; validar que la bitácora no admite `UPDATE`, `DELETE` ni `TRUNCATE` desde el rol de aplicación.
- Comprobar que las listas, detalles y cronograma omiten filas con `estado_registro=0`, las visibles muestran `Estado: 1`, las rúbricas usadas no cambian, los borradores siguen detectando revisiones obsoletas y una evaluación cerrada no se modifica por el flujo ordinario.
- Ejecutar compilaciones y pruebas existentes de backend y frontend. Las pruebas de PostgreSQL de disparadores, permisos y actores consecutivos están en `backend/fixtures/verificar-retencion-visibilidad-auditoria.sql`.

## Límites conocidos

- Antes del Paso 9, el actor de la API es un identificador técnico compartido, no la identidad de cada docente. pgAdmin registra el rol de base disponible. Para atribución personal en producción se necesita autenticación institucional y cuentas/roles de base con acceso restringido.
- Un superusuario/propietario puede saltarse protecciones de la base. La garantía cubre la API y las sesiones SQL normales de pgAdmin, no acciones administrativas que deshabiliten los controles.
- Los históricos previos a esta instalación no permiten reconstruir ediciones pasadas que nunca se auditaron.
