# Etapa 10.9B — Entorno local completo

## Resultado

Se preparó un entorno local separado para operar el frontend con NestJS y PostgreSQL. La base cotidiana es exclusivamente `127.0.0.1:55442/genares_dev_10_9`; el clúster de integración 9D sigue separado en `55441` y no se usa al iniciar el producto. No se conectó al puerto 5432 ni a la base persistente 8E.

La preparación inicial se hizo en el clúster local PostgreSQL 18 bajo `.local-postgres-10.9/`. Las migraciones se ejecutan explícitamente con `npm run db:prepare`, que verifica la identidad del clúster y de la base antes de aplicar cambios. No se añadió ninguna migración para 10.9B. TypeORM conserva `synchronize: false` y `migrationsRun: false`.

## Cambios realizados

- Se añadió `package.json` en la raíz con `dev`, `dev:web`, `dev:api` y `db:prepare`.
- `scripts/postgres-dev.mjs` crea o inicia únicamente el clúster 10.9 autorizado, fija la escucha en loopback, valida la ruta del directorio, puerto, usuario, nombre y marcador de la base, y detiene únicamente el proceso que inició.
- `scripts/db-dev.mjs` ejecuta en orden las migraciones existentes y carga el fixture sintético. Al terminar, detiene el clúster que inició; los datos persisten.
- `scripts/dev.mjs` levanta Vite y NestJS en el mismo comando, verifica que respondan y apaga sus procesos con `Ctrl+C`. También conserva los comandos separados.
- Se añadió `backend/fixtures/entorno-desarrollo-10.9b.sql`, con datos ficticios y carga idempotente. No elimina registros y no vuelve a modificar evaluaciones cerradas.
- `backend/.env.10.9.example` documenta el perfil local de solo lectura. La configuración efectiva `backend/.env.10.9` contiene claves aleatorias locales, queda ignorada por Git y no sustituye `backend/.env`.
- El perfil `lector-academico-desarrollo` está limitado por el servidor a la base marcada 10.9 en `127.0.0.1:55442`, tiene permisos de lectura y queda deshabilitado fuera de desarrollo/pruebas.
- Se actualizaron los README de raíz y backend. Esta etapa no mueve carpetas, implementa CORE ni cambia documentos institucionales.

## Comandos

Desde la raíz del repositorio, con dependencias de `backend` y `prototipo-titulacion` instaladas:

En Windows se requiere PostgreSQL 18 instalado en `C:\Program Files\PostgreSQL\18\bin`. Los scripts no instalan software ni dependen de PostgreSQL 9D para el uso diario.

```powershell
# Una vez, o después de incorporar una migración al esquema local
npm run db:prepare

# Uso diario: base local, API y frontend
npm run dev
```

`db:prepare` valida el destino, aplica todas las migraciones actuales, verifica la carga sintética y detiene PostgreSQL si lo inició. `npm run dev` inicia la base preparada, Vite en `http://127.0.0.1:5173/` y NestJS en `http://127.0.0.1:3001/api/v1`. `Ctrl+C` detiene los procesos de esa ejecución. La base local permanece guardada.

Comandos individuales:

- `npm run dev:web`: solo la demostración React, sin PostgreSQL.
- `npm run dev:api`: PostgreSQL local y NestJS, sin Vite.

PostgreSQL 9D sigue siendo exclusivo de integración. `backend/.env.10.9` y `.local-postgres-10.9/` no deben añadirse a Git ni compartirse; no contienen datos académicos reales.

## Datos de demostración

El fixture usa exclusivamente ejemplos sintéticos coherentes:

- Carreras activas: Tecnologías de la Información (`TI`) e Ingeniería en Software (`SOFT`).
- Una modalidad y una rúbrica dinámica de demostración asociadas a ambas carreras.
- Dos etapas de ejemplo: escrita `TRABAJO_COMPARTIDO` y sustentación oral `ESTUDIANTE_INDIVIDUAL`.
- Dos trabajos, tres estudiantes (dos coautores en TI y uno en SOFT), dos tutores y dos docentes evaluadores.
- Cada trabajo tiene su carrera, período, tutor, tribunal, miembros evaluadores y versión de rúbrica relacionados.
- Diez evaluaciones sintéticas cerradas con sus puntajes, eventos de auditoría y seis traspasos de la etapa compartida.

Se comprobó una segunda ejecución del fixture en la misma base: no había migraciones pendientes y se conservaron los conteos esperados de dos trabajos, diez evaluaciones y seis traspasos. No se copiaron filas desde bases protegidas ni se presentaron fixtures como calificaciones reales.

## Identidades y permisos

El selector de personas de React sigue siendo una simulación para recorrer la interfaz; cambia el perfil sin login y no envía permisos a NestJS. La API usa una identidad local fija de solo lectura correspondiente al primer evaluador sintético. Así se puede consultar la información que ese miembro tiene autorizada, incluidas evaluaciones, consolidaciones y documentos de sus trabajos. Las escrituras API permanecen deshabilitadas.

Las rutas de consulta individual de estudiante devolvieron `403` al usar el perfil de jurado. Se conserva esa autorización; el selector de React no suplanta a un estudiante ante el backend. Esto no afecta el recorrido de la demostración local con datos del navegador.

El modo demostración React se mantiene condicionado al modo de desarrollo y no se empaqueta como una identidad de producción. No se implementaron autenticación institucional ni administración real de usuarios.

## Comprobaciones de API

Con `npm run dev` en ejecución, las lecturas locales devolvieron `200` para carreras, rúbricas, lista de trabajos, detalle del trabajo, evaluaciones del trabajo, consolidación del trabajo, contexto del evaluador y actas archivadas. El detalle entrega estudiantes y evaluadores del tribunal para que la pantalla de documentos pueda seguir con sus consultas.

No se enviaron solicitudes de escritura durante estas comprobaciones. La pantalla de documentos conserva sus controles y flujos de sólo lectura cuando no dispone de capacidades de emisión.

La consolidación de `DEV-TI-001` fue completa: ambas personas recibieron `9.30` en la escrita compartida; Andrea obtuvo `8.70` oral y `9.00` final; Bruno obtuvo `9.20` oral y `9.25` final. La respuesta indicó `TRABAJO_COMPARTIDO`, `ESTUDIANTE_INDIVIDUAL` y `HALF_UP_A_DOS_DECIMALES`, sin mezclar resultados legacy.

## Pruebas y builds

- Preparación PostgreSQL 10.9B repetida: sin migraciones pendientes; fixture verificado e idempotente.
- Backend `npm test -- --runInBand`: **101 aprobadas**, **39 omitidas**, 15 suites aprobadas y 4 suites PostgreSQL omitidas en esta pasada sin `TEST_DATABASE_URL`.
- Frontend `npm run test`: **192 aprobadas**, 40 archivos de prueba.
- Build NestJS `npm run build`: aprobado.
- Build React `npm run build`: aprobado.
- Arranque conjunto `npm run dev`: Vite y NestJS iniciaron; NestJS compiló sin errores, respondió el endpoint de salud y se confirmaron las rutas API listadas arriba.
- Suite PostgreSQL protegida 9D: **39 aprobadas** (carreras 4, vigencias 1, rúbricas 21 y evaluaciones/documentos 13). Se conservaron las cuatro bases temporales creadas. El clúster 9D se detuvo al terminar, sin eliminar bases.
- Después de `Ctrl+C`, Vite, NestJS y PostgreSQL 10.9 dejaron de escuchar; PostgreSQL registró el cierre rápido y el checkpoint de apagado.
- `git diff --check`: aprobado, sin errores de espacios en blanco.

Vitest emitió advertencias de `useLayoutEffect` en pruebas renderizadas del lado servidor; no hubo fallos. El filtro global del backend registró errores intencionales en las pruebas que comprueban el manejo de excepciones; las suites pasaron.

## Acoplamientos pendientes para integrar cuatro sistemas

- `ContextoPrototipo` mantiene identidad simulada, roles UI y datos de demostración en el navegador; se debe separar el proveedor de identidad del dominio académico antes de integrar el CORE.
- El modo API de React usa servicios y el proxy Vite. Cada sistema requerirá adaptadores con IDs canónicos explícitos; no se deben inferir por nombres.
- NestJS conserva un perfil local fijo de desarrollo; la integración debe sustituirlo por una identidad verificada del CORE y mapear sus permisos a capacidades del dominio.
- Los fixtures de `TI`, `SOFT` y los UUID locales no son identificadores institucionales ni deben sincronizarse como tales.

No se creó CORE, no se centralizaron usuarios y no se trasladó el repositorio a `apps/`.

## Pendientes y límites

- Los perfiles del selector React no cambian el actor fijo de la API; una prueba de endpoints propios de estudiante requiere preparar la identidad correspondiente en un entorno local autorizado.
- El modo API de este entorno es de solo lectura. No se usó para editar catálogos, rúbricas, evaluaciones o programación.
- Los trabajos, notas, personas y auditorías del fixture son demostrativos. No se consultaron calificaciones históricas reales.
