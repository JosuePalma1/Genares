# Backend de Genares

Base NestJS + TypeORM + PostgreSQL para el flujo de evaluación. No implementa autenticación institucional, correo, SGA ni Microsoft 365.

## Desarrollo

1. Copiar `.env.example` a `.env` y apuntar a una base PostgreSQL local.
2. Ejecutar `npm install`.
3. Ejecutar `npm run migration:run`.
4. Iniciar con `npm run start:dev`.

El endpoint de vida es `GET /api/salud`. Las migraciones nunca usan `synchronize`; las restricciones del modelo viven tanto en PostgreSQL como en las reglas puras de dominio.

### PostgreSQL local aislado para Rúbricas (Windows)

Para una base persistente local independiente del servicio PostgreSQL del equipo, ejecutar desde `backend`:

```powershell
.\scripts\preparar-postgres-desarrollo.ps1
npm run migration:run
```

El script inicializa una instancia local en `.local-postgres-dev`, enlazada exclusivamente a `127.0.0.1:55440`, y crea `.env` con credenciales aleatorias de desarrollo. No sobrescribe un `.env` existente ni toca la instancia PostgreSQL del sistema. La carpeta y `.env` están excluidos de Git. Para detenerla: `& "$env:ProgramFiles\PostgreSQL\18\bin\pg_ctl.exe" -D .\.local-postgres-dev\data stop -m fast`.

Antes de insertar el fixture manual, la suite PostgreSQL HTTP puede ejecutarse una vez en la base nueva y vacía:

```powershell
$config = @{}
foreach ($line in Get-Content .env) { if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] } }
$env:TEST_DATABASE_URL = "postgres://$($config.DB_USERNAME):$([Uri]::EscapeDataString($config.DB_PASSWORD))@$($config.DB_HOST):$($config.DB_PORT)/$($config.DB_NAME)"
npm test
Remove-Item Env:TEST_DATABASE_URL
```

La suite requiere que el nombre contenga `test`, aplica las migraciones faltantes y conserva filas ficticias para inspección; para repetirla, usar otra base `*_test` vacía. Después se puede cargar el fixture manual:

```powershell
$config = @{}
foreach ($line in Get-Content .env) { if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] } }
$env:PGPASSWORD = $config.DB_PASSWORD
& "$env:ProgramFiles\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 55440 -U genares_dev_app -d genares_dev_8e_test -f .\fixtures\rubricas-desarrollo.sql
Remove-Item Env:PGPASSWORD
```

`fixtures/rubricas-desarrollo.sql` es idempotente e inserta únicamente una modalidad, un período y una rúbrica ficticios. No se ejecuta al arrancar la aplicación ni en producción. Las identidades y cabeceras de prueba existen solo dentro de los tests.

## Validación

- `npm run build`
- `npm test`

Las pruebas unitarias no requieren una base de datos y cubren topes de indicadores, sumatorias, habilitación de sustentación, independencia de evaluaciones orales y promedio de los dos miembros.

## Identidad local de solo lectura desde React

El guard global permanece activo. Para habilitar una identidad local fija, configura en el `.env` ignorado por Git:

```dotenv
NODE_ENV=development
LOCAL_DEV_IDENTITY_ENABLED=true
LOCAL_DEV_IDENTITY_PROFILE=lector
```

## Preparación de escritura local 9D

La identidad `administrador-rubricas` solo se instala con `NODE_ENV=development`, `LOCAL_DEV_IDENTITY_ENABLED=true` y `LOCAL_DEV_WRITE_ENABLED=true`. `scripts/iniciar-api-9d.ps1 -HabilitarEscrituraAdministrativa` es el flujo preparado para activarla; sin el switch inicia como lector. NestJS exige conexión real a `127.0.0.1:55441/genares_9d_disposable`, `DB_DISPOSABLE=true` y el comentario PostgreSQL `GENARES:9D:DISPOSABLE`. Verifica esos valores antes de instalar la identidad. Producción y las demás bases fallan cerradas.

Preparación en Windows, desde `backend`:

```powershell
.\scripts\preparar-postgres-9d-desechable.ps1
.\scripts\migrar-base-9d.ps1
.\scripts\cargar-fixture-9d.ps1
.\scripts\iniciar-api-9d.ps1
# Solo para probar escrituras localmente:
.\scripts\iniciar-api-9d.ps1 -HabilitarEscrituraAdministrativa
```

El clúster 9D vive bajo `.local-postgres-9d-desechable`, usa el puerto 55441 y credenciales aleatorias ignoradas por Git; la base persistente 8E del puerto 55440 queda separada. El script PostgreSQL crea una base vacía con nombre único, ejecuta la suite real y la elimina solo si todas las pruebas pasan. Si falla, la conserva aislada para diagnóstico.

Las escrituras simuladas requieren `Origin` exacto de `LOCAL_DEV_WRITE_ORIGINS`, `Sec-Fetch-Site: same-origin`, `application/json` y `X-Genares-Write-Intent: local-development`. NestJS comprueba esas señales antes del guard global; el control no depende de CORS. Vite tampoco habilita CORS en su servidor de desarrollo. El marcador de intención no autentica ni concede capacidades. La identidad/capacidad permanece fija en NestJS. Esto confía en el usuario y procesos locales del equipo; no sirve para máquinas compartidas ni reemplaza autenticación institucional.

Se añade `GET /api/v1/rubricas/catalogos` (`rubricas:leer`) con modalidades y períodos activos, sus UUID y los campos mínimos requeridos para seleccionar referencias. No requiere migración ni semillas automáticas.

El cliente web tiene mapeadores puros y métodos HTTP opt-in, pero ninguna pantalla los invoca. Vite exige modo desarrollo, fuente `api` y `VITE_RUBRICAS_WRITE_API=true` para habilitar el cliente; esto no habilita controles ni autoriza al backend. Los métodos no envían credenciales, capacidades ni identidades. La actualización serializa la jerarquía completa, conserva UUID y revisión, y exige importes textuales. Los conflictos 409 se informan sin reintentar.

Reinicia NestJS al cambiar el perfil. `lector` solo recibe `rubricas:leer`; `sin-capacidades` sirve para comprobar 403 y `sin-identidad` conserva 401. El perfil administrador se limita al clúster 9D descrito abajo. El navegador no puede elegir perfil ni capacidades. El middleware comprueba la dirección loopback del socket (no confía en `X-Forwarded-For`) y NestJS en `development` enlaza a `127.0.0.1`. Si se intenta habilitar fuera de `development` o `test`, el proceso falla al iniciar.

Deja `LOCAL_DEV_IDENTITY_ENABLED=false` o sin configurar para mantener las rutas protegidas. No publiques este backend mediante t?neles o proxy inverso ni uses el perfil en m?quinas compartidas. Esta es una identidad simulada solo para desarrollo local, no autenticaci?n institucional.
