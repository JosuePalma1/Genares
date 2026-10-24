# Etapa 10.9 — Informe de entorno y datos de demostración

## Auditoría inicial

- El repositorio no tenía `package.json` en la raíz, aunque el README indicaba `npm run dev`. Vite y NestJS tenían comandos separados.
- El frontend usa demostración local por defecto y guarda el estado en `localStorage`; el selector de identidades era simulado. La entrada `/` enviaba primero a una pantalla de “acceso” también simulado, y cambiar de identidad podía quedar bloqueado por la confirmación de cambios sin guardar.
- El actor inicial de Daniela ya tenía el rol `ADMIN`, pero el rol activo era Comisión Académica. Por eso el perfil mostraba una perspectiva distinta de la administrativa que el actor podía recorrer.
- Los fixtures usaban nombres heterogéneos para Software y también incluían Agropecuaria e Ingeniería Ambiental. El trabajo `TT-2026-0326` no tenía tribunal ni registros de evaluación, a diferencia del resto.
- La configuración anterior del backend tenía valores de conexión por defecto hacia PostgreSQL 5432. También existían instrucciones antiguas para desarrollo en 55440, que no corresponden al entorno cotidiano aprobado para esta etapa.
- La configuración local `backend/.env` no coincide con el destino exclusivo 10.9. Se conservó sin leer ni sobrescribir sus credenciales. El clúster PostgreSQL 9D estaba apagado al iniciar.

## Cambios realizados

- Se añadió el `package.json` raíz con `npm run dev`, `npm run dev:web` y `npm run dev:api`, además del lanzador `scripts/dev.mjs`.
- `npm run dev` inicia Vite siempre. NestJS solo se inicia si la configuración apunta exactamente a `127.0.0.1:55442/genares_dev_10_9`; si no, el script muestra que omitió el backend y no intenta abrir una conexión.
- NestJS y el origen de datos TypeORM fallan antes de conectar si el proceso apunta a los puertos 5432, 55440 u 55441. En desarrollo, solo se admite el destino exclusivo 10.9.
- Se preparó `backend/.env.10.9.example`. Una copia local llamada `backend/.env.10.9` está ignorada por Git y permite configurar el futuro entorno sin sustituir el `.env` existente. No se crea una base ni se ejecutan migraciones automáticamente.
- La entrada raíz ahora lleva directamente al dashboard; `/login` redirige ahí para conservar enlaces antiguos. Las identidades siguen disponibles en el selector de la cabecera y el cambio ya no exige iniciar sesión ni confirmar cambios sin guardar. Daniela inicia con el rol activo “Administración de demostración”; conserva también Comisión Académica.
- La demo se permite únicamente con modo Vite `development`. En el build `production` no se monta el proveedor ni la aplicación simulada; se muestra un mensaje de disponibilidad. La identidad simulada del backend mantiene sus controles de desarrollo.
- Se normalizaron los ejemplos a **Tecnologías de la Información (TI)** e **Ingeniería en Software (SOFT)**. Tutores, estudiantes y trabajos tienen código y denominación compatibles; el formulario nuevo ya no ofrece carreras fuera de alcance.
- El trabajo `TT-2026-0326` ahora tiene un tribunal de dos miembros que no incluye a su tutora y dos evaluaciones pendientes, sin inventar calificaciones. Los demás trabajos también mantienen dos evaluaciones asociadas a sus tribunales, aunque algunos continúan incompletos como parte del flujo de ejemplo.
- El almacenamiento local sube de esquema 3 a 4. La migración afecta solo IDs estables del fixture conocido, conserva puntuaciones y evaluaciones guardadas, respeta un tribunal ya asignado y agrega evaluaciones pendientes que falten para el fixture sin tribunal. No actualiza datos de bases PostgreSQL ni calificaciones históricas reales.
- No se añadió una migración PostgreSQL para esta etapa.

## Inicio y detención

Instala las dependencias una vez si aún no están presentes:

```powershell
npm --prefix .\prototipo-titulacion install
npm --prefix .\backend install
```

Desde la raíz:

```powershell
npm run dev
```

Con la configuración actual, Vite inicia en `http://127.0.0.1:5173/` y NestJS se omite porque todavía no existe la configuración local segura 10.9. Para trabajar solo con la demo, también puedes usar `npm run dev:web`. Detén los procesos con `Ctrl+C`.

`npm run dev:api` inicia únicamente NestJS si encuentra la base permitida; si no, termina sin conectar. Para habilitarla más adelante, copia `backend/.env.10.9.example` a `backend/.env.10.9`, reemplaza el marcador de contraseña y completa el paso institucional/autorizado de preparación de PostgreSQL en `127.0.0.1:55442`, base `genares_dev_10_9`. Después verifica el destino antes de aplicar migraciones manualmente. No sobrescribas `backend/.env` para este propósito.

La demo cotidiana no requiere PostgreSQL. PostgreSQL 9D queda solo para integración. No se accedió al puerto 5432 ni a 8E/55440.

## Pruebas y builds

- Frontend: `npm --prefix prototipo-titulacion run test` — 40 archivos, **192 pruebas aprobadas**.
- Fixture de tribunales: prueba focal `datosPrototipo.test.js` — aprobada tras la comprobación final de roles de tutor y tribunal.
- Build frontend de producción: `npm --prefix prototipo-titulacion run build` — aprobado; genera la pantalla de disponibilidad de producción.
- Backend: pruebas unitarias — **100 pruebas aprobadas**; las cuatro suites PostgreSQL quedan condicionadas a `TEST_DATABASE_URL` en esa ejecución.
- Build NestJS: `npm run build` desde `backend` — aprobado.
- PostgreSQL 9D: `scripts/pruebas-postgres-9d.ps1 -PreservarBasesPrueba` — cuatro suites y **39 pruebas aprobadas**: carreras (4), vigencias (1), rúbricas (21) y evaluaciones/documentos (13). Se conservaron las cuatro bases temporales creadas. El clúster 9D se detuvo al terminar, como estaba antes de la validación.
- También se probaron la consolidación de notas, las rúbricas/documentos y la numeración concurrente de actas; no hubo cambios en sus reglas ni en los consecutivos.
- `git diff --check` — aprobado.
- El comando raíz `npm run dev` inició correctamente Vite y confirmó que omitía el backend sin conexión a PostgreSQL.

## Datos y compatibilidad

Los cambios de carrera y título son correcciones de fixtures de demostración. Las notas preexistentes de esos fixtures se conservan durante la migración local. No se modificaron estados académicos al consultar, imprimir o cambiar de perfil. No se alteraron evaluaciones históricas ni numeraciones de actas.

El cálculo académico, las rúbricas, las evaluaciones y la generación de documentos no se rediseñaron. La identidad de demostración no concede permisos al backend: las capacidades de la API continúan definidas y verificadas en el servidor.

## Puntos de acoplamiento para la integración futura

- `ContextoPrototipo` combina datos académicos de demostración, el ID del actor y roles en el estado `localStorage`. Conviene separar el proveedor de identidad del repositorio/servicio académico.
- Las pantallas consumen servicios API mediante variables Vite y el proxy `/api`; una plataforma CORE requerirá una interfaz estable de servicios y adaptadores para los cuatro sistemas, sin compartir estado del navegador.
- Los fixtures identifican personas y trabajos con IDs locales y conservan códigos de carrera como texto y clave sintética. La integración necesitará mapeos explícitos a IDs canónicos externos, sin inferir identidad por nombre.
- El middleware de identidad local de NestJS es solo una herramienta de desarrollo. En integración debe sustituirse por la identidad validada por el CORE y convertir sus permisos a capacidades del dominio, manteniendo separadas las reglas académicas.

No se construyó CORE, no se centralizaron usuarios y no se movió el proyecto a `apps/`.

## Pendientes

- Acordar y preparar de manera autorizada una base persistente local exclusiva si se necesita operar la API en desarrollo. Hasta entonces, el uso cotidiano disponible es el prototipo React con datos locales.
- Definir los contratos de identidad e IDs canónicos de los cuatro sistemas antes de iniciar su integración.
