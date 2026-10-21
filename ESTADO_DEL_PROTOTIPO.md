# Estado del prototipo Genares

## Propósito y alcance

Genares prototipa la evaluación de trabajos de titulación, desde el registro del trabajo y la asignación del tribunal hasta la calificación y consulta de la rúbrica. No cubre el proceso completo de titulación ni sustituye al SGA, un acta institucional o la autenticación de la universidad.

La rama actual reúne las etapas 9H.4, 9H.4.1, 9H.5A, 9H.5B y 9H.6: rúbricas completas con etapas dinámicas, evaluaciones y traspasos, consolidación individual y catálogos de Maestros. El producto sigue siendo un prototipo; el recorrido general de React aún utiliza datos de demostración.

## Resumen del estado

| Área | Estado actual |
| --- | --- |
| Demostración React | Flujo navegable con roles simulados y datos guardados en `localStorage`. |
| Backend | NestJS y PostgreSQL con API versionada para rúbricas, evaluaciones y catálogos de carreras y modalidades. |
| Rúbricas | Versiones completas de etapas dinámicas, con alcances compartidos o individuales y vigencia por carrera. |
| Evaluaciones | Captura por etapa, cierre, traspasos trazables y consolidación individual bajo demanda. |
| Maestros | Tablas reutilizables con búsqueda, filtro, orden y formularios para carreras y modalidades; conexión API opcional en desarrollo. |
| Identidad | Simulación local protegida para desarrollo; no existe autenticación institucional. |
| Uso con datos reales | No habilitado. La aplicación y la autorización institucional aún requieren integración y validación. |

## Funciones implementadas

### 1. Demostración React

- Navegación adaptable y pantallas para revisar el flujo de evaluación.
- Acceso con perfiles ficticios de Comisión Académica, tribunal, Secretaría, Coordinación y Administrador.
- Datos demostrativos guardados en el navegador; no se comparten entre equipos.
- Registro de trabajos y estudiantes, asignación manual de dos miembros del tribunal, notificaciones internas simuladas, revisión escrita, programación de sustentación y evaluación oral por estudiante.
- Borradores separados de evaluaciones cerradas, consulta e impresión de la rúbrica del prototipo.

El flujo simulado todavía no guarda trabajos, tribunal, notificaciones ni sus evaluaciones en PostgreSQL. Las pantallas de evaluación no calculan ni sustituyen la consolidación académica servida por el backend.

### 2. Rúbricas completas y dinámicas

- Una versión puede configurar una o más etapas, categorías e indicadores.
- Cada etapa declara su ámbito: `TRABAJO_COMPARTIDO` o `ESTUDIANTE_INDIVIDUAL`. El ámbito no se infiere del nombre.
- Una rúbrica puede combinar ámbitos en cualquier orden válido; el máximo de cada etapa se valida en `10.00`.
- Las versiones se crean completas o como borradores. Los borradores se pueden editar con control de revisión; una versión activa o histórica no se modifica.
- Clonar crea un borrador nuevo y conserva la estructura y el ámbito de cada etapa sin cambiar la versión original.
- La vigencia se registra por carrera, modalidad y período, con historial y protección frente a concurrencia.

### 3. Evaluaciones y consolidación

- Cada miembro del tribunal realiza su evaluación por etapa. Se conserva el requisito actual de dos evaluadores.
- Una etapa compartida se evalúa una vez por trabajo y miembro. Al cerrarla, la evaluación original se relaciona con cada estudiante del trabajo mediante registros de traspaso; los puntajes no se copian ni se vuelven editables por estudiante.
- Una etapa individual utiliza la evaluación del estudiante indicado. El servidor verifica que pertenezca al trabajo.
- Las evaluaciones guardan la versión y una instantánea de la rúbrica utilizada. Los cierres bloquean cambios y las operaciones de escritura registran auditoría.
- La consolidación se calcula bajo demanda en una lectura consistente; el resultado derivado no se persiste como una segunda calificación.

La fórmula implementada es:

1. Para cada estudiante y etapa, promediar las evaluaciones cerradas de los dos miembros del tribunal.
2. Promediar por igual los promedios exactos de todas las etapas de la versión fijada al trabajo.
3. Presentar el resultado final sobre 10 con dos decimales y redondeo decimal `HALF_UP`.

Los cálculos intermedios usan racionales exactos. No se redondean los promedios de etapa antes del promedio final. Si falta una evaluación cerrada, no se publica un resultado final definitivo: la respuesta identifica el estado y los miembros pendientes. Los estados distinguen ausencia de evaluaciones, borradores en progreso, cierres incompletos y resultado completo.

La consulta del resultado individual exige que la identidad corresponda al perfil de estudiante solicitado. La consulta de resultados de un trabajo requiere la capacidad de lectura del backend. La consolidación dinámica excluye las evaluaciones legacy.

### 4. Catálogos y pantallas de Maestros

- Carreras y modalidades tienen operaciones de consulta, creación, edición y activación o desactivación en la API.
- Las pantallas de Maestros usan una tabla común con búsqueda, filtro por estado, orden de columnas y formularios accesibles.
- En modo API muestran datos de PostgreSQL; los controles de escritura aparecen solo cuando la capacidad del backend y la opción de desarrollo correspondiente están activas.
- En el modo predeterminado del prototipo, modalidades son datos de demostración de solo lectura y no se simulan carreras.
- Las ediciones detectan conflictos de revisión para evitar sobrescribir cambios concurrentes.

### 5. API disponible

Las rutas NestJS usan `/api/v1` y capacidades del servidor:

- `GET /api/v1/rubricas`, `GET /api/v1/rubricas/:id/versiones`, creación completa de rúbricas/versiones, edición de borradores y activación.
- `POST /api/v1/evaluaciones/trabajos/:trabajoId`, guardado de puntajes y cierre de evaluaciones.
- `GET /api/v1/evaluaciones/trabajos/:trabajoId/consolidados` y `GET /api/v1/evaluaciones/estudiantes/:estudianteId/consolidado`.
- Rutas de consulta y administración para `/api/v1/carreras` y `/api/v1/modalidades`.
- `GET /api/salud` para comprobar disponibilidad.

Los métodos de la API de rúbricas también se usan desde sus pantallas cuando se selecciona el modo API. La conexión de la demostración de trabajos y evaluaciones con los endpoints nuevos aún está pendiente.

### 6. Datos históricos y migraciones

- Las evaluaciones históricas `ESCRITA`/`ORAL` conservan sus datos. La migración de etapas mantiene sus identificadores, versiones, estados y notas; no las convierte en resultados dinámicos.
- Los resultados antiguos no se mezclan con la consolidación dinámica ni se reescriben al consultar.
- Las migraciones 9H se agregaron en orden desde `1760000005000` hasta `1760000009000`: vigencias por carrera, catálogo de carreras, rúbricas completas, ámbitos de etapa y evaluaciones dinámicas con traspasos.
- `synchronize` permanece desactivado. No se deben reescribir migraciones que ya pudieron ejecutarse.

## Entorno de desarrollo y seguridad

- La fuente de datos del frontend predeterminada es `prototipo`; `VITE_RUBRICAS_SOURCE=api` habilita consultas API en Vite de desarrollo.
- Las escrituras desde el frontend requieren la opción correspondiente (`VITE_RUBRICAS_WRITE_API`, `VITE_MODALIDADES_WRITE_API` o `VITE_CARRERAS_WRITE_API`) y la capacidad habilitada en el servidor local.
- La identidad local es fija en el servidor y está desactivada por defecto. No se debe publicar, exponer por túnel o usar en equipos compartidos.
- Para pruebas PostgreSQL se debe usar el clúster desechable 9D, con su puerto, nombre y marca verificados por los scripts del backend. No usar el puerto 5432 ni la base persistente 8E y no borrar bases temporales anteriores.
- Los `.env` locales, credenciales y bases de desarrollo se excluyen de Git.
- No hay conexión con DIT, SGA, Microsoft 365 ni envío real de correos.

Los pasos detallados de instalación y ejecución segura están en [backend/README.md](backend/README.md).

## Pendiente

### Para una integración funcional compartida

- Conectar el registro y seguimiento de trabajos, tribunal, programación y notificaciones de React con operaciones persistentes del backend.
- Conectar las pantallas de evaluación de React con la captura, cierre y consulta de evaluaciones del servidor; mostrar la consolidación que devuelve la API en vez de recalcularla en la interfaz.
- Definir e implementar autenticación institucional y autorización de usuarios en servidor antes de manejar datos reales.
- Completar la administración de usuarios, roles y alcance por carrera.
- Acordar despliegue, infraestructura y operación con la universidad y DIT.

### Para cerrar contenidos del prototipo

- Sustituir los textos provisionales de indicadores cuando se confirme la rúbrica oficial completa.
- Comparar la impresión de la rúbrica con el formato institucional autorizado.
- Probar el diseño en tablets y ejecutar recorridos de extremo a extremo una vez conectados los flujos API.
- Decidir cómo retirar o redirigir los HTML de referencia antiguos.

No están aprobadas reglas nuevas de ausencias, suplentes, ponderaciones entre etapas, aprobación/reprobación ni cambios al requisito de dos evaluadores. El traspaso efectivo de calificaciones y el cálculo final ya descritos corresponden a la etapa 9H.5B; no se añaden funciones de actas en esta etapa.

## Validación

Hay pruebas unitarias de reglas y cliente, y pruebas PostgreSQL aisladas para migraciones, rúbricas, carreras, evaluaciones, consolidación, auditoría, concurrencia y compatibilidad histórica. Los comandos para ejecutarlas y compilar son:

```powershell
# Desde prototipo-titulacion
npm run test
npm run build

# Desde backend
npm test
npm run build
.\scripts\pruebas-postgres-9d.ps1
```

La suite PostgreSQL protegida verifica la identidad y el carácter desechable de la base antes de escribir. Para el estado más reciente de las pruebas, revisar la salida de cada ejecución; las pruebas usan bases y fixtures controlados, no representan una validación de calificaciones históricas reales.
