# Backend de Genares

Base NestJS + TypeORM + PostgreSQL para el flujo de evaluación. No implementa autenticación institucional, correo, SGA ni Microsoft 365.

## Inicio local

No se requiere Docker. El entorno de desarrollo usa PostgreSQL 18 local en `127.0.0.1:55442`; no uses el puerto 5432 ni la base persistente 8E.

Desde la raíz, ejecuta `npm run db:prepare` una vez. El comando prepara únicamente el clúster PostgreSQL local de 10.9B, aplica las migraciones actuales, carga el fixture sintético y detiene el clúster que inició. Después, `npm run dev` inicia PostgreSQL, NestJS y Vite juntos. Para recorrer solo la demo web sin base de datos, ejecuta `npm --prefix .\prototipo-titulacion run dev`; `npm run dev:api` inicia solo NestJS y la base local. Detén los servicios con `Ctrl+C`.

La base exclusiva es `127.0.0.1:55442/genares_dev_10_9`, con datos en `.local-postgres-10.9/`. `npm run db:prepare` genera una configuración separada `backend/.env.10.9` con claves aleatorias, la ignora Git y no sobrescribe `backend/.env`. Antes de cualquier conexión, los scripts comprueban el host, puerto, base, propietario y marcador del clúster. NestJS usa `synchronize: false` y `migrationsRun: false`; las migraciones se ejecutan explícitamente solo contra esa base aprobada. El arranque diario falla de forma cerrada si el puerto está ocupado por otro proceso o la identidad de PostgreSQL no coincide.

PostgreSQL 9D queda reservado para las pruebas de integración. No uses el puerto 5432 ni la base persistente 8E para el desarrollo cotidiano. `npm run dev` no requiere ni inicia el clúster 9D.

El endpoint de vida es `GET /api/salud`. Las restricciones del modelo viven en PostgreSQL y en las reglas puras de dominio. `fixtures/entorno-desarrollo-10.9b.sql` contiene solo datos ficticios; la preparación lo aplica de forma idempotente. El arranque de producción no crea datos.

## Pruebas unitarias y de integración

- `npm run build`
- `npm test` (pruebas unitarias sin base de datos; los casos PostgreSQL requieren `TEST_DATABASE_URL`)

Las pruebas unitarias no requieren una base de datos y cubren reglas de evaluación y dominio. La suite PostgreSQL 9D es exclusivamente de integración: `scripts/pruebas-postgres-9d.ps1 -PreservarBasesPrueba` verifica la huella 9D y conserva las bases temporales que crea; no se necesita para iniciar el prototipo.

## Identidad local de solo lectura desde React

El guard global permanece activo. Para habilitar una identidad local fija, configura en el `.env` ignorado por Git:

```dotenv
NODE_ENV=development
LOCAL_DEV_IDENTITY_ENABLED=true
LOCAL_DEV_IDENTITY_PROFILE=lector
```

## Identidades locales de API y PostgreSQL 9D

La identidad simulada del backend es independiente del selector de demostración de React. En 10.9B, `.env.10.9.example` usa `lector-academico-desarrollo`, una identidad fija asociada al primer evaluador sintético y validada exclusivamente contra la base marcada 10.9 en `127.0.0.1:55442`. Puede consultar carreras, rúbricas, trabajos, evaluaciones, consolidaciones y documentos autorizados para ese miembro del tribunal. El modo API deja las escrituras deshabilitadas por defecto; ningún header del navegador puede elegir identidad o capacidades. El selector de React solo cambia la perspectiva simulada del prototipo.

La lectura individual como estudiante requiere una identidad de estudiante correspondiente: con el perfil fijo de jurado, esos endpoints devuelven 403 por autorización. No se relajan las reglas de acceso para ocultar ese resultado. La identidad local no se habilita en producción. PostgreSQL 9D se reserva para integración y no se usa para iniciar la API cotidiana.

Preparación y ejecución de las pruebas protegidas en Windows, desde `backend`:

```powershell
.\scripts\preparar-postgres-9d-desechable.ps1
.\scripts\pruebas-postgres-9d.ps1 -PreservarBasesPrueba
```

El clúster 9D vive bajo `.local-postgres-9d-desechable`, usa el puerto 55441 y credenciales aleatorias ignoradas por Git. El script verifica host, puerto, marcador y usuario antes de ejecutar pruebas en bases temporales aisladas. Con `-PreservarBasesPrueba` conserva cada base temporal.

La concesión adicional de permisos del catálogo vive en `scripts/migraciones-administrativas/1760000010000-permisos-lectura-catalogo-rubricas.sql`. La suite protegida comprueba que los permisos se limitan a la cuenta de aplicación y no se otorgan a `PUBLIC`.

Las escrituras simuladas requieren `Origin` exacto de `LOCAL_DEV_WRITE_ORIGINS`, `Sec-Fetch-Site: same-origin`, `application/json` y `X-Genares-Write-Intent: local-development`. NestJS comprueba esas señales antes del guard global; el control no depende de CORS. Vite tampoco habilita CORS en su servidor de desarrollo. El marcador de intención no autentica ni concede capacidades. La identidad/capacidad permanece fija en NestJS. Esto confía en el usuario y procesos locales del equipo; no sirve para máquinas compartidas ni reemplaza autenticación institucional.

Se añade `GET /api/v1/rubricas/catalogos` (`rubricas:leer`) con modalidades y períodos activos, sus UUID y los campos mínimos requeridos para seleccionar referencias. No requiere migración ni semillas automáticas.

Las pantallas de rúbricas, catálogos, evaluaciones, programación y documentos se conectan a la API cuando su fuente está habilitada. Vite exige modo desarrollo y las variables de fuente/escritura correspondientes; esto no concede capacidades al servidor. Los métodos no envían credenciales, permisos ni identidades. Los cambios conservan UUID, revisión, transacciones y auditoría; los conflictos 409 se informan sin reintentar.

Reinicia NestJS al cambiar el perfil. `lector` solo recibe `rubricas:leer`; `sin-capacidades` sirve para comprobar 403 y `sin-identidad` conserva 401. El perfil administrador se limita al clúster 9D descrito abajo. El navegador no puede elegir perfil ni capacidades. El middleware comprueba la dirección loopback del socket (no confía en `X-Forwarded-For`) y NestJS en `development` enlaza a `127.0.0.1`. Si se intenta habilitar fuera de `development` o `test`, el proceso falla al iniciar.

Deja `LOCAL_DEV_IDENTITY_ENABLED=false` o sin configurar para mantener las rutas protegidas. No publiques este backend mediante t?neles o proxy inverso ni uses el perfil en m?quinas compartidas. Esta es una identidad simulada solo para desarrollo local, no autenticaci?n institucional.
