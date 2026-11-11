# Genares · Subsistema S4

Genares contiene el subsistema S4 de calificaciones, rúbricas, evaluaciones, resultados, sustentaciones y documentos. Consulta los datos académicos administrados por S1, S2 y S3 en el MER compartido; no crea estudiantes, temas, tutores ni tribunales.

## Estructura

```text
backend/src/
  common/                    API, identidad y salud
  config/                    PostgreSQL y configuración segura
  modules/
    s1-requisitos/            espacio del subsistema S1
    s2-temas/                 espacio del subsistema S2
    s3-documentos/            espacio del subsistema S3
    s4-calificaciones/        funcionalidades de Genares

frontend/src/
  shared/                    contexto y estilos compartidos
  modules/
    s1-requisitos/
    s2-temas/
    s3-documentos/
    s4-calificaciones/        rutas, páginas y componentes de Genares

backend/fixtures/             SQL manual: permisos, retención/auditoría y datos de prueba
scripts/dev.mjs               arranque conjunto de backend y frontend
docs/s4/                      instalación, decisiones, planificación e historial
```

Los espacios S1–S3 reservan la estructura común. Sus funciones siguen siendo propiedad de esos subsistemas.

## Requisitos

- Node.js y npm.
- PostgreSQL local con la base unificada `genares_integrado_dev` preparada por el proyecto común.
- El rol de PostgreSQL `genares` con los permisos S4 correspondientes.

La aplicación no crea la base ni ejecuta migraciones al arrancar. No ejecutes migraciones del prototipo: S4 consume `s2.asignacion_tema`, `s3.asignacion_tribunal` y las tablas de `s4` existentes. Para crear desde cero una base local con datos ficticios, usa los scripts de [`docs/s4/base-datos-dev`](docs/s4/base-datos-dev/README.md).

## Instalación local en Windows

El procedimiento extendido, incluida la verificación de puertos y permisos, está en [Ejecutar Genares localmente](docs/s4/instalacion/local.md).

Desde PowerShell, en la carpeta raíz del repositorio:

```powershell
npm --prefix .\backend ci
npm --prefix .\frontend ci
Copy-Item .\backend\.env.example .\backend\.env
```

Edita `backend/.env` con las credenciales locales de PostgreSQL. Conserva `DB_NAME=genares_integrado_dev`, `NODE_ENV=development` y el puerto local `3001`. El archivo `.env` está excluido de Git; no publiques la contraseña.

Para las pruebas locales del MER, el ejemplo activa `LOCAL_DEV_OPEN_ACCESS=true` y `ENABLE_INTEGRACION_DEV=true`. Úsalos únicamente en este equipo: backend y frontend enlazan a loopback y rechazan conexiones remotas.

Inicia ambos servicios desde la raíz:

```powershell
npm run dev
```

Abre `http://127.0.0.1:5173/trabajos`. El API local usa `http://127.0.0.1:3001/api/v1`. Detén los servicios con `Ctrl+C`.

Para iniciar solo uno de los servicios con el mismo lanzador:

```powershell
npm run dev:api   # solo backend
npm run dev:web   # solo frontend
```

También puedes iniciarlos en dos ventanas de PowerShell:

```powershell
npm --prefix .\backend run start:dev
```

```powershell
npm --prefix .\frontend run dev
```

## Compilación y pruebas

```powershell
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\frontend run build
npm --prefix .\frontend test
```

## Scripts SQL de `backend/fixtures`

Son operaciones manuales para la base local: no son migraciones y no se ejecutan durante el arranque. Todos comprueban que la conexión sea `genares_integrado_dev` y se detienen si no lo es. Ejecútalos en pgAdmin (o `psql`) en este orden:

| Orden | Archivo | Conectado como | Qué hace |
| --- | --- | --- | --- |
| 1 | `permisos-consulta-mer.sql` | `postgres` | Concede a `genares` lectura sobre las tablas de `gen`, `s2` y `s4` que consulta S4. |
| 2 | `permisos-operacion-s4.sql` | `postgres` | Concede las escrituras que necesitan rúbricas, sustentaciones, actas y trazabilidad. |
| 3 | `s4-retencion-visibilidad-auditoria.sql` | `postgres` | Instala `estado_registro`, la bitácora `s4.eventos_cambio_registro` y los disparadores de protección (ver abajo). Es idempotente: puedes repetirlo. |
| 4 | `s4-correccion-calificaciones.sql` | `postgres` | Crea `s4.solicitudes_correccion_evaluacion` (corrección extraordinaria, RF-36) con su máquina de estados y permisos. Requiere el paso 3. Es idempotente. |
| 5 | `s4-sesion-evaluacion-oral.sql` | `postgres` | Liga cada evaluación oral a su sesión (`s4.evaluaciones.id_programacion_sustentacion`, RF-46/RN-26) y guarda el motivo de cada reprogramación en el historial (RN-27). Completa la sesión de las orales existentes solo cuando hay una única posible. Requiere el paso 3. Es idempotente. **El backend lo necesita para guardar evaluaciones orales.** |
| 6 | `verificar-retencion-visibilidad-auditoria.sql` | `postgres` | Comprueba las protecciones de los pasos 3 y 4 dentro de una transacción que termina en `ROLLBACK`; no deja cambios. |
| — | `s4-indices-rendimiento.sql` | `postgres` | Recomendado. Crea índices para las consultas paginadas de S4; no cambia datos ni restricciones. Es idempotente. |
| — | `etapa-5-rubrica-mer.sql` | `genares` o `postgres` | Opcional. Agrega la versión de rúbrica de prueba `DEV-ETAPA-5` a partir de `DEV-1`, sin sustituirla. |

El paso 3 revoca `DELETE`/`TRUNCATE` sobre `s4` al rol `genares`, pero `permisos-operacion-s4.sql` concede `DELETE` sobre las tablas de estructura de rúbrica. Si vuelves a ejecutar el paso 2, ejecuta también el paso 3 después. Los disparadores siguen bloqueando el borrado de todos modos, pero así el permiso se mantiene igual.

La verificación (paso 5) termina con dos avisos `VERIFICACIÓN S4` (comprobaciones generales y actores consecutivos). Si falta un dato que necesita, se detiene con un mensaje explícito (por ejemplo, *No hay una evaluación cerrada de prueba*); en ese caso crea o cierra una evaluación en la base local y vuelve a ejecutarla.

## Retención, visibilidad y auditoría

Una vez aplicado `s4-retencion-visibilidad-auditoria.sql`, las tablas de `s4` siguen estas reglas, tanto desde la API como desde SQL ordinario en pgAdmin:

- **Sin borrado físico.** `DELETE` y `TRUNCATE` fallan (SQLSTATE `55000`). Para retirar un registro de la interfaz usa `UPDATE ... SET estado_registro = 0`; `1` lo vuelve a mostrar. Solo se aceptan `0` y `1`.
- **Visibilidad separada del estado académico.** `estado_registro` (expuesto en la API como `estadoRegistro`) no cambia `BORRADOR`, `CERRADA`, `ACTIVA`, etc. Ocultar una evaluación cerrada no la reabre. Las consultas operativas solo devuelven filas con `estado_registro = 1`.
- **Datos académicos inmutables.** En una evaluación cerrada solo puede cambiar `estado_registro`. Una rúbrica cuya versión ya usa un proceso de evaluación no permite editar su ficha, contenido, etapas, categorías, indicadores ni vigencias. Retirar esa versión impide nuevas asignaciones y no toca los procesos existentes.
- **Bitácora append-only.** Cada alta o modificación confirmada se registra en `s4.eventos_cambio_registro` con actor, rol de base, tabla, clave del registro y valores antes/después. La bitácora no admite `UPDATE`, `DELETE` ni `TRUNCATE`.
- **Actor.** La API fija `s4.actor_id` en cada transacción (`GENARES:LOCAL_DEVELOPMENT` hasta que exista autenticación institucional). En pgAdmin, si no lo fijas, se guarda el rol de PostgreSQL. Para atribuir tus cambios manuales:

  ```sql
  BEGIN;
  SELECT set_config('s4.actor_id', 'TU-IDENTIFICADOR', true);
  SELECT set_config('s4.correlation_id', 'MOTIVO-DEL-CAMBIO', true);
  UPDATE s4.rubricas SET estado_registro = 0 WHERE id = '...';
  COMMIT;
  ```

La bitácora se consulta en la pantalla de historial o en `GET /api/v1/auditoria/cambios`, que requiere la capacidad `configuracion-academica:administrar`. Acepta los filtros `tabla` y `registro`, y pagina con `limite` (1–100, por defecto 50) y `cursor`.

Estas protecciones cubren la API y las sesiones SQL normales. Un superusuario o el propietario del esquema puede desactivar los disparadores, por lo que ese acceso debe seguir restringido. Los motivos y límites de cada regla están en [la decisión de diseño](docs/s4/decisiones/2026-11-10-retencion-visibilidad-auditoria.md).

## Documentación de S4

| Carpeta | Contenido |
| --- | --- |
| [`docs/s4/instalacion`](docs/s4/instalacion) | Instalación local paso a paso, con verificación de puertos y permisos. |
| [`docs/s4/base-datos-dev`](docs/s4/base-datos-dev/README.md) | Creación de la base local (MER completo) y datos de prueba ficticios, con su orden de ejecución. |
| [`docs/s4/apk-tribunal.md`](docs/s4/apk-tribunal.md) | APK de desarrollo para tablets del tribunal (S4-15): compilación, conexión por USB, verificaciones y pruebas pendientes en tablet. |
| [`docs/s4/decisiones`](docs/s4/decisiones) | Decisiones de diseño aprobadas (retención, visibilidad y auditoría). |
| [`docs/s4/planificacion-integracion-s4`](docs/s4/planificacion-integracion-s4) | Plan de integración con el MER unificado, por pasos. |
| [`docs/s4/procedimientos`](docs/s4/procedimientos) | Consultas SQL de comprobación manual. |
| [`docs/s4/historial-etapas`](docs/s4/historial-etapas) | Entregas de las etapas 2–4. Es histórico; puede no reflejar el código actual. |

El código vigente vive en `backend/src/modules/s4-calificaciones` y `frontend/src/modules/s4-calificaciones`.
