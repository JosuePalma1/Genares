# 10.11E — Verificación integral de navegación, contratos y consistencia

Fecha: 24 de octubre de 2026

## Resumen ejecutivo

Se recorrieron las pantallas integradas contra NestJS y PostgreSQL 10.9B, se contrastaron datos del navegador con respuestas GET y se ejecutaron las suites automatizadas existentes. Los módulos integrados muestran el mismo conjunto de expedientes y resultados; la impresión de rúbricas obtiene el PDF del servidor y no altera las evaluaciones. El modo API no sustituye errores con datos de `localStorage`. El modo prototipo permanece separado en `npm run dev:web`.

El recorrido reveló que el Cronograma no enlazaba con el expediente de la sustentación. Se corrigió esa navegación de forma localizada: el código ahora enlaza al expediente mediante el `idTrabajo` de la respuesta API. Se comprobó en navegador que el enlace abre el trabajo correcto.

Quedan dos asuntos relevantes antes de declarar terminado un ciclo integrado de punta a punta: las escrituras de trabajos y la asignación institucional del tribunal pertenecen al sistema proveedor y no tienen endpoints CRUD en GENARES; además, las rutas de escritura de evaluaciones validan algunos UUID como versión 4, aunque el contrato de PostgreSQL solo exige el formato UUID y el GET incluye IDs de evaluación válidos que no son UUIDv4. No se escribieron datos persistentes para probar este último caso; las evaluaciones del fixture que tienen esos IDs están cerradas.

## Alcance, entorno y seguridad

La revisión se hizo con `npm run dev`, usando la API local y únicamente lecturas GET en `127.0.0.1:55442/genares_dev_10_9`. El navegador fue abierto en un contexto aislado; no se manipularon las pestañas previas. No se enviaron solicitudes POST, PUT, PATCH ni DELETE a 10.9B, no se modificaron estados, evaluaciones, notas, relaciones, actas o auditoría, y no se aplicaron migraciones.

La suite PostgreSQL se ejecutó por medio del runner protegido 9D, contra `127.0.0.1:55441`, con `-PreservarBasesPrueba`. Se conservaron las bases temporales creadas por el runner. No se accedió a PostgreSQL 8E (55440) ni al puerto 5432. Los registros observados en 10.9B son fixtures sintéticos; no se verificaron expedientes históricos reales.

En el modo integrado el encabezado muestra “Sistema local · Sin cuentas de usuario”. La ruta de acceso y las cuentas/perfiles estudiantiles no forman parte del sistema. `/usuarios` y `/mis-resultados` terminan en la pantalla de ruta no encontrada; la navegación académica no exige seleccionar identidad. La revisión de configuración y las pruebas de seguridad existentes mantienen el acceso abierto condicionado al entorno local de desarrollo y a la base marcada 10.9B; la identidad técnica no debe aceptarse en producción. No se realizó un despliegue ni una prueba en un servidor de producción.

## Inventario de rutas, fuentes y contratos

Todas las rutas académicas listadas se montan bajo la estructura visual común. El origen depende de la configuración de desarrollo: `npm run dev` selecciona API y `npm run dev:web` conserva el prototipo local. En modo API, una respuesta fallida se presenta como error o recurso no disponible; los componentes integrados no rellenan relaciones con datos locales.

| Ruta/pantalla | Fuente y endpoints principales | Acciones y datos que enlaza |
|---|---|---|
| `/dashboard` | NestJS: `GET /api/v1/trabajos`, `GET /api/v1/programaciones-sustentacion`, `GET /api/v1/documentos/actas` y `GET /api/v1/evaluaciones/trabajos/:id/consolidados` por cada trabajo elegible. | Indicadores de TI/SOFT, estados, agenda, consolidaciones completas y archivo de actas; navega a expedientes con UUID PostgreSQL. Solo lectura. |
| `/trabajos` | NestJS: `GET /api/v1/trabajos`. | Lista expedientes y relaciones persistidas; enlaza a `/trabajos/:id`. No presenta registros locales como expedientes API. |
| `/trabajos/nuevo` | En modo API, pantalla informativa; no llama a un CRUD local ni finge persistencia. En `dev:web`, usa el prototipo. | En API explica que el alta corresponde al proveedor y vuelve a Trabajos. Sin alta API disponible. |
| `/trabajos/:id` | NestJS: `GET /api/v1/trabajos/:id`; para estado académico consulta evaluaciones/consolidado cuando se cumplen las condiciones del dominio. | Presenta trabajo, carrera, período, modalidad, estudiantes, tutoría, tribunal confirmado y versión fijada. Enlaza a tribunal, evaluación, resultado y documentos con IDs API. |
| `/trabajos/:id/tribunal` | En API reutiliza el expediente del servidor; en prototipo conserva la asignación local. | Muestra tribunal confirmado. La asignación institucional no se escribe desde GENARES; pertenece al sistema proveedor. |
| `/trabajos/:id/sustentacion` y `/cronograma` | En API, la primera redirige al Cronograma. Este consume `GET /api/v1/programaciones-sustentacion`, capacidades, trabajos disponibles e impresión. | Cronograma permite consultas y, según capacidades/flags locales, muestra formularios de programación y transiciones. El expediente relacionado ahora abre `/trabajos/:idTrabajo`. La auditoría solo leyó datos. |
| `/mis-evaluaciones` | NestJS: `GET /api/v1/evaluaciones/trabajos`. | Lista trabajos habilitados para evaluación y enlaza a sus evaluaciones. No representa un selector de usuario. |
| `/evaluaciones/:id/escrita`, `/evaluaciones/:id/oral/:estudiante` | NestJS: listado `GET /api/v1/evaluaciones/trabajos/:id`, contexto del tribunal y consolidación; las operaciones disponibles usan POST/PUT de evaluación, puntajes y cierre. | El selector contiene miembros del tribunal confirmado. Las etapas compartidas e individuales y los traslados se presentan desde datos del servidor. No se enviaron escrituras. |
| `/resultados/:trabajo/:estudiante` | NestJS: consolidación de `GET /api/v1/evaluaciones/trabajos/:id/consolidados`. | Muestra únicamente resultado completo, promedios y estados informados por la API; enlaza a Documentos por trabajo/estudiante/miembro. React no recalcula la nota. |
| `/rubrica/:trabajo/:estudiante/:miembro` | En API redirige a Documentos; en `dev:web` conserva el flujo local del prototipo. | La compatibilidad API delega en `/documentos` y mantiene los tres UUID. No usa `localStorage` como alternativa a un PDF API fallido. |
| `/documentos` | NestJS: trabajos/contexto, rúbrica PDF `GET /api/v1/documentos/trabajos/:trabajo/estudiantes/:estudiante/rubricas/:miembro/pdf`, actas archivadas y sus PDF. | Visualizar, abrir e imprimir/guardar PDF. La interfaz también muestra acciones de escritura documental disponibles en desarrollo, sujetas a capacidades y elegibilidad; no se ejecutaron. |
| `/rubricas`, `/rubricas/nueva`, `/rubricas/:id`, `/rubricas/:id/nueva-version/:version` | NestJS: catálogo, catálogo institucional, versiones y capacidades bajo `/api/v1/rubricas`; escrituras de creación, actualización, clonación y activación están sujetas al modo local y capacidades. | Catálogo, detalle, historial de versión y formulario de clonación. Se recorrieron el detalle, versiones y clonación sin guardar. |
| `/maestros/modalidades`, `/maestros/modalidades/:id` | NestJS: `GET /api/v1/modalidades`, capacidades y detalle; las acciones de catálogo están sujetas a flags/capacidades locales. | Consulta y detalle con identificadores API. Se recorrió catálogo → detalle. |
| `/maestros/carreras` | NestJS: `GET /api/v1/carreras` y capacidades; cambios de catálogo solo con autorización local del servidor. | TI y SOFT aparecen como registros activos. Desde la navegación común se llega a Consulta. |
| `/secretaria`, `/coordinacion`, `/consulta` | NestJS mediante `usarSeguimientoApi`, que centraliza trabajos, programaciones, consolidaciones y actas. | Lectura y filtros; Secretaría enlaza a expediente/Documentos, Coordinación filtra TI/SOFT, Consulta enlaza a expediente/resultado/Documentos. No hay escritura desde estas vistas. |
| `/`, ruta desconocida | React: redirige a Dashboard; comodín muestra ruta no encontrada. | No existen rutas activas `/login`, `/usuarios` o `/mis-resultados`. |

La integración API y el prototipo mantienen implementaciones paralelas para trabajos, evaluación, impresión y seguimiento. La selección de fuente separa ambos recorridos; no se detectó una mezcla silenciosa en las pantallas verificadas. El formulario de alta de trabajos API informa que no está disponible y no guarda datos locales. Las pantallas de prototipo siguen pudiendo cambiar su propio `localStorage` cuando se usa `dev:web`.

## Navegación comprobada en navegador

Se completaron los recorridos solicitados:

1. Dashboard → Trabajos; se abrió la lista API.
2. Trabajos → expediente; se abrió `DEV-SOFT-001` con su UUID PostgreSQL.
3. Expediente → tribunal confirmado.
4. Expediente → evaluaciones del trabajo.
5. Evaluación → resultado individual.
6. Evaluación cerrada → rúbrica PDF → Documentos.
7. Resultado individual → Documentos con trabajo y estudiante preseleccionados.
8. Secretaría → expediente y Documentos de la estudiante seleccionada.
9. Coordinación → filtro de TI y filtro de SOFT; cada uno devolvió el trabajo correspondiente.
10. Consulta → expediente y resultado individual.
11. Cronograma → expediente relacionado. Este salto no existía: se añadió un enlace al código del trabajo con `elemento.idTrabajo` y se comprobó que abre el expediente correspondiente.
12. Catálogo de rúbricas → detalle → versiones → formulario de nueva versión basada en la existente. No se envió el formulario.
13. Modalidades → detalle.
14. Carreras → Consulta mediante navegación común.

También se abrió la ruta de trabajo con UUID malformado: presenta un aviso de identificador inválido y no muestra datos locales. Un UUID válido pero inexistente presenta “No existe un trabajo con ese identificador en PostgreSQL”. Los enlaces del Cronograma, catálogos y seguimiento conservan IDs del servidor.

## Consistencia entre API y React

Se compararon respuestas GET con los datos visibles en Dashboard, Trabajos, Expediente, Tribunal, Evaluaciones, Resultados, Secretaría, Coordinación, Consulta, Cronograma, Documentos, Rúbricas, Modalidades y Carreras.

- PostgreSQL 10.9B devolvió dos trabajos sintéticos: `DEV-TI-001` (TI, dos estudiantes) y `DEV-SOFT-001` (SOFT, una estudiante). React mostró los mismos códigos, carrera, modalidad, período, personas relacionadas, tribunal y versión de rúbrica.
- Ambos trabajos usan la versión dinámica `10.9B-DEMO` y tribunal confirmado de dos miembros. Los nombres del selector de miembro de Evaluaciones coinciden con el tribunal; la opción corresponde a una asignación académica, no a una cuenta o perfil de acceso.
- La API devolvió una programación para `DEV-SOFT-001` (24 de octubre de 2026, 10:00, Sala 1) y ninguna para `DEV-TI-001`. Dashboard, Secretaría y Cronograma coincidieron.
- Las consolidaciones completas presentaron tres resultados individuales: Camila 9.00, Andrea 9.00 y Mateo 9.25. Consulta, Secretaría, Dashboard y Resultados no mostraron discrepancias. La respuesta TI contiene escrita compartida 9.30 y orales individuales 8.70/9.20; cada estudiante conserva su resultado individual.
- El archivo de actas respondió correctamente vacío (cero documentos); se mostró como ausencia y no como error.
- Las solicitudes de consolidación corresponden a trabajos con rúbrica fijada, tribunal confirmado de dos miembros y estudiantes. No se emite un cero para un caso no elegible.

La API de evaluaciones para TI respondió seis registros cerrados: dos evaluaciones compartidas, una por cada miembro; dos orales para Andrea y dos para Mateo. Los traslados compartidos apuntan a los estudiantes sin crear una segunda calificación editable. Los valores visibles coincidieron con el resultado del servidor.

## Evaluaciones, identificadores y estados

El hallazgo F-01 de 10.10B queda **resuelto para las lecturas observadas**: el adaptador acepta la forma UUID PostgreSQL, la lista, las evaluaciones y los consolidados cargaron, y React mostró etapas y calificaciones. La versión UUID no se exige al adaptar una evaluación de solo lectura.

Se detectó una diferencia pendiente en los contratos de escritura: las evaluaciones reales del fixture contienen IDs como `10000000-0000-0000-0000-000000000001`, que son UUID canónicos aceptados por la columna PostgreSQL pero no UUIDv4. En cambio, el servicio React valida con `esUuidV4`, el controlador usa `ParseUUIDPipe({ version: '4' })` en puntajes/cierre y el DTO de indicadores usa `@IsUUID('4')`. No se intentó modificar el fixture persistente. Los registros con IDs no versionados observados estaban `CERRADA`, por lo que esta auditoría no establece que una evaluación actualmente editable haya fallado; sí demuestra que lectura y escritura no aceptan el mismo universo de IDs. Antes de una validación de edición con datos reales, conviene alinear el contrato (o declarar UUIDv4 como requisito y asegurar que los datos editables lo cumplan).

En los fixtures 10.9B todas las evaluaciones observadas estaban cerradas y las consolidaciones completas. No se encontraron allí evaluaciones abiertas, consolidaciones pendientes ni registros legacy para inspección visual. Los estados abiertos, incompletos, pendientes, escenarios sin tribunal/programación, legacy, IDs inválidos y recursos inexistentes se consideran comprobados **solo por suites automatizadas y adaptadores/fixtures aislados**, no por los registros persistentes ni por este recorrido visual.

Los casos automatizados existentes cubren, entre otros, consolidación individual, etapas compartidas e individuales, transferencias sin duplicación, exactitud decimal, múltiples etapas, compatibilidad de registros ESCRITA/ORAL legacy, evaluaciones incompletas y evaluadores pendientes, inmutabilidad, programación y lectura documental concurrente. No se cambió la fórmula ni el redondeo `HALF_UP`.

## Documentos y no mutación

Se solicitó la rúbrica PDF para evaluador y estudiante seleccionados mediante el endpoint de Documentos. El servidor respondió HTTP 200 con `application/pdf`; el navegador mostró el PDF en el visor con controles de abrir/imprimir/guardar. Se comprobó la ruta compatible `/rubrica/...` y la navegación desde Evaluaciones y Resultados. Los ámbitos compartidos/individuales fueron consistentes con las evaluaciones del servidor.

Antes y después de solicitar el PDF se compararon por GET trabajos/relaciones, IDs y estados de evaluaciones, puntajes/consolidaciones y archivo de actas; los datos observados permanecieron iguales. No hubo POST de acta, cambio de estado ni modificación de auditoría en la inspección. La comprobación de legibilidad fue visual en el visor de tres páginas y controles disponibles; no se abrió el diálogo del sistema ni se guardó un archivo durante esta etapa.

## Dashboard, seguimiento, carga y errores

Dashboard, Secretaría, Coordinación y Consulta mostraron las mismas cifras subyacentes: dos trabajos, distribución de un TI y un SOFT, una programación, tres resultados completos y cero actas archivadas. El filtro de carrera de Coordinación presentó el trabajo correcto. Consulta presentó los tres estudiantes asociados a los mismos dos trabajos.

Durante cambios de ruta se observaron algunas solicitudes GET canceladas por la navegación; las solicitudes finales completaron con HTTP 200. No se observaron errores de consola en la revisión final. La pantalla de seguimiento consulta una consolidación por cada trabajo elegible; con cientos de trabajos crecerá el número de solicitudes y aún no existe paginación/resumen. No se introdujo una optimización estructural en esta verificación.

## Hallazgos y prioridades

| Prioridad | Hallazgo / siguiente acción | Estado |
|---|---|---|
| P1 | Alinear el contrato UUID de escritura de evaluaciones entre React, NestJS y datos PostgreSQL, y probarlo en 9D con una evaluación editable. | Diferencia demostrada en código y en IDs leídos; no se envió escritura a 10.9B. |
| P1 | Acordar con el proveedor el contrato de altas/actualizaciones de trabajos, estudiantes, tutores y tribunal; no atribuir a GENARES una persistencia que no existe. | Fuera de la API actual; la pantalla integrada informa que el alta no está disponible. No bloquea lectura, pero impide completar un ciclo nuevo de expediente. |
| P1 | Completar la cadena de extremo a extremo con casos abiertos/incompletos y un recurso con acta en un fixture aislado 9D. | Cubierto parcialmente por pruebas; 10.9B no tenía esos estados/datos para revisión visual. |
| P2 | Diseñar un endpoint de resumen/paginación para seguimiento antes de crecer a cientos de trabajos. | Riesgo de escalabilidad; actualmente hay una llamada de consolidación por trabajo elegible. |
| P2 | Mantener separados y etiquetados los recorridos API y `dev:web`; controlar divergencias de reglas y pantallas del prototipo. | La selección actual separa fuentes; persiste duplicación intencional entre prototipo y servidor. |
| P2 | Revisar validaciones UUIDv4 del servicio de programaciones frente al UUID PostgreSQL cuando se conecten fuentes con otros UUID válidos. | No se reprodujo fallo: los IDs de programación actuales son UUIDv4. |

La falta de usuarios, roles, login o acceso estudiantil no es un defecto. Tampoco se propone restaurar selector de perfiles ni cambiar autenticación.

## Cambio de 10.11E

- `prototipo-titulacion/src/paginas/PaginaCronograma.jsx`: el código del trabajo en cada fila enlaza al expediente API mediante el UUID `idTrabajo`.
- `prototipo-titulacion/src/paginas/cronograma.css`: estilo visible y foco de teclado para el enlace.
- `docs/integracion-10.11e-informe.md`: este informe.

No se cambiaron API, fórmulas, estados, formatos PAT, numeración de actas ni bases de datos. No se crearon migraciones.

## Validaciones ejecutadas y limitaciones

- Pruebas unitarias backend: **16 suites, 88 pruebas aprobadas**.
- PostgreSQL 9D protegido: **4 suites, 41 pruebas aprobadas** (Carreras 4, vigencia por carrera 1, Rúbricas 21, Evaluaciones/Documentos 15). El runner utilizó `-PreservarBasesPrueba`; no se borraron bases temporales.
- Bases temporales de esta ejecución preservadas: `genares_9d_test_25f11148`, `genares_9d_test_223ec753`, `genares_9d_test_b16e520a` y `genares_9d_test_ff9dbec8`.
- Pruebas frontend después del enlace del Cronograma: **47 archivos, 220 pruebas aprobadas**.
- Build NestJS: aprobado durante la validación de esta cadena de integración; el cambio de 10.11E no modifica backend.
- Build Vite después del cambio: aprobado, 1680 módulos transformados.
- Navegación de navegador: recorridos detallados arriba; PDF 200; Consulta/seguimiento sin errores de consola.
- `git diff --check`: aprobado (salida 0). Git mostró avisos habituales de normalización LF/CRLF en archivos preexistentes del árbol de trabajo.

La base 10.9B se usó solo para GET. Las suites 9D fueron automatizadas y no constituyen verificación de expedientes reales. Las verificaciones visuales de estados especiales que no existían en 10.9B se limitaron a fixtures/pruebas automatizadas. La revisión no valida decisiones institucionales pendientes ni carga con cientos de trabajos.

## Recomendación para 10.12

GENARES está en condiciones de comenzar 10.12 como etapa focalizada de cierre de integración, pero no de declarar listo el ciclo académico completo de extremo a extremo. Conviene iniciar por el contrato de UUID de escrituras y la definición con el proveedor de cómo entran los trabajos/relaciones nuevas; después, validar un recorrido completo con evaluaciones abiertas/incompletas y un caso con documentos archivados en PostgreSQL 9D. Las consultas actuales, consolidaciones completas y lectura/impresión de rúbricas sí quedaron contrastadas en navegador con la API.

Se detiene aquí la etapa 10.11E. No se hicieron commit ni push.
