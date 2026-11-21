# Ejecutar Genares localmente

Este procedimiento inicia el backend y frontend del subsistema S4 contra la base unificada existente. No crea otra base ni ejecuta migraciones.

## Preparar el entorno

Desde PowerShell, abre la raíz del repositorio y ejecuta:

```powershell
npm --prefix .\backend ci
npm --prefix .\frontend ci
Copy-Item .\backend\.env.example .\backend\.env
```

Edita `backend/.env` y reemplaza `DB_PASSWORD=REEMPLAZAR_LOCALMENTE` por la contraseña local del rol `genares`. Conserva `DB_NAME=genares_integrado_dev`, `DB_HOST=127.0.0.1` y `DB_PORT=5432`, salvo que tu PostgreSQL local use otro host o puerto.

Los valores `LOCAL_DEV_OPEN_ACCESS=true` y `ENABLE_INTEGRACION_DEV=true` habilitan el flujo de pruebas local. Solo deben usarse en el equipo de desarrollo. El backend y Vite escuchan en loopback, y Vite limita también su proxy a un backend local.

Ejecuta primero `backend/fixtures/s4-escalas-calificacion.sql` en pgAdmin como propietario del esquema S4. Convierte el umbral anterior a porcentaje y conserva las rúbricas y actas existentes sobre 10.

Para habilitar **Configuración general** en una base existente, ejecuta como propietario [configuracion-flujo.sql](../../../backend/fixtures/configuracion-flujo.sql) después del script de escalas. Se puede repetir. En una instalación nueva, las tablas y el disparador también están en el script inicial. Entra como superusuario en **Control → Configuración general** para publicar reglas o administrar permisos.

En una base existente, ejecuta además estos scripts en pgAdmin como propietario, en este orden:

1. [convocatorias-individuales.sql](../../../backend/fixtures/convocatorias-individuales.sql)
2. [excepciones-programacion.sql](../../../backend/fixtures/excepciones-programacion.sql)
3. [reemplazos-correcciones.sql](../../../backend/fixtures/reemplazos-correcciones.sql)

Cada proceso conserva la versión de flujo, el umbral y el redondeo asignados. La publicación puede limitarse por carrera, modalidad y período. Los permisos por rol se aplican a las siguientes peticiones de la demo dentro del ámbito del usuario. En **Solicitudes**, quien puede autorizar correcciones puede consultar resultados reprobados y registrar la continuidad individual en un período posterior. El registro de continuidad conserva la nota y el umbral del intento.

Si el rol `genares` aún no tiene los permisos del MER, ejecuta manualmente `backend/fixtures/permisos-consulta-mer.sql` y `backend/fixtures/permisos-operacion-s4.sql` desde pgAdmin como `postgres`, conectado a `genares_integrado_dev`. Estos scripts aplican permisos e inicializan el valor local de nota mínima; no alteran las tablas académicas de S1, S2 o S3.

## Iniciar ambos servicios

Desde la raíz del repositorio:

```powershell
npm run dev
```

El proceso espera que ambos servicios respondan y luego muestra las direcciones. Usa `Ctrl+C` para detenerlos. Abre `http://127.0.0.1:5173/trabajos`.

Para iniciarlos por separado, usa dos ventanas de PowerShell:

```powershell
npm --prefix .\backend run start:dev
```

```powershell
npm --prefix .\frontend run dev
```

## Comprobar el inicio

- Backend: abre `http://127.0.0.1:3001/api/salud`; debe responder con estado `ok`.
- Frontend: abre `http://127.0.0.1:5173/trabajos`.
- Si aparece `ERR_CONNECTION_REFUSED`, revisa la terminal del servicio correspondiente. Un error de conexión a PostgreSQL o una variable vacía en `backend/.env` impide que el backend escuche.
- Si el puerto 5173 ya está ocupado, detén la instancia anterior de Vite antes de volver a iniciar.

## Límites

No ejecutes migraciones de TypeORM ni SQL del prototipo antiguo. La conexión usa `synchronize: false` y `migrationsRun: false`. S4 consulta asignaciones de S2, tribunales de S3 y los datos de evaluación de S4 en el MER compartido.

Las notas y expedientes ficticios existentes se conservan. `backend/fixtures/etapa-5-rubrica-mer.sql` es solo para la base local de pruebas y no se ejecuta al arrancar la aplicación.

Consulta la [guía de Configuración general](../configuracion-general.md) para conocer las opciones y los datos que administra.
