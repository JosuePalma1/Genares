# Genares: visualización de integración con S2 y S3 (sin Docker)

Este paquete es **una copia del proyecto original** con una **pantalla adicional de solo lectura** para comprobar que el backend NestJS lee PostgreSQL usando las claves del MER unificado. El código existente de rúbricas, evaluaciones y cronograma se ha conservado sin sustituir sus entidades o migraciones antiguas.

## Qué muestra la nueva pantalla

- `gen.tema` y `s2.asignacion_tema`: el tema y si fue asignado a un grupo o estudiante.
- `s2.grupo_integrante` / `gen.estudiante` / `gen.persona`: los integrantes.
- `s3.asignacion_tribunal` y su relación con docentes: cantidad y nombres de evaluadores del trabajo.
- `s4.procesos_evaluacion` / `s4.versiones_rubrica`: rúbrica y estado de evaluación.
- `s4.evaluaciones`: evaluaciones escritas cerradas.
- `s4.programaciones_sustentacion` / `s4.programacion_estudiante`: sustentaciones y participantes.

Solo se leen los temas con título que comience por `DEV -`. **No se copian datos ni se modifican tablas.**

## Instalación Windows / PostgreSQL directo

1. Descomprime el ZIP en una carpeta propia (no encima del repositorio compartido).
2. Abre PowerShell en la carpeta donde están `backend` y `frontend`.
3. Copia `backend/.env.example` a `backend/.env` y edita los datos de tu PostgreSQL local:

   ```env
   NODE_ENV=development
   PORT=3001
   LOCAL_DEV_OPEN_ACCESS=false
   LOCAL_DEV_WRITE_ORIGINS=http://127.0.0.1:5173
   ENABLE_INTEGRACION_DEV=true
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=TU_CONTRASENA_LOCAL
   DB_NAME=genares_integrado_dev
   DB_SSL=false
   ```

   Sustituye `postgres` por el usuario con acceso a esa base de desarrollo si utilizas otro. No compartas el `.env` ni la contraseña.
4. Instala las dependencias del proyecto desde PowerShell:

   ```powershell
   npm --prefix .\backend ci
   npm --prefix .\frontend ci
   ```

5. Inicia el backend en una terminal:

   ```powershell
   npm --prefix .\backend run start:dev
   ```

6. Inicia el frontend en otra terminal:

   ```powershell
   npm --prefix .\frontend run dev
   ```

7. Abre **http://127.0.0.1:5173/integracion-dev**, o selecciona **Operación → Integración de prueba S2/S3**.

La API de lectura es `http://127.0.0.1:3001/api/v1/integracion-dev/resumen`.

## Importante

**NO ejecutar** `npm run db:migrate`, `npm run migration:run`, `typeorm migration:run` ni migraciones del backend original sobre `genares_integrado_dev`. Las entidades anteriores del prototipo (tablas sin esquemas explícitos) no coinciden todavía con el nuevo modelo de 80 tablas. Esta vista consulta las tablas del MER unificado mediante SQL `SELECT` y no usa migraciones.

El acceso abierto local se deja en `false`, porque la pantalla nueva solo necesita una consulta pública de desarrollo restringida por entorno y servidor loopback. **No habilites escrituras del prototipo antiguo para esta prueba.**

Solo la nueva página de integración está preparada para consultar la base unificada. Otras páginas de Genares siguen sujetas a la migración del código del prototipo; si muestran errores de tabla o columnas, **no los resuelvas creando tablas duplicadas**. La conexión y esta vista no prueban todavía creación/cierre de evaluaciones desde la UI.

Este prototipo debe permanecer en **tu máquina local**, con datos ficticios, y no habilitarse en producción ni publicarse en Internet.

## Verificación opcional

```powershell
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\frontend run build
npm --prefix .\frontend run test
```

El entorno actual de preparación no dispone del PostgreSQL instalado en tu computadora, por lo que la consulta contra tus seeders debe comprobarse localmente.
