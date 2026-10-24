$ErrorActionPreference = 'Stop'

$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
$localRoot = Join-Path $backendPath '.local-postgres-9d-desechable'
$adminPasswordPath = Join-Path $localRoot 'admin-password.txt'
$grantScript = Join-Path $PSScriptRoot 'migraciones-administrativas\1760000010000-permisos-lectura-catalogo-rubricas.sql'
$psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'

if (-not (Test-Path $dotenvPath)) { throw 'Falta .env.9d.local; no se aplicaron privilegios.' }
if (-not (Test-Path $adminPasswordPath)) { throw 'Falta la credencial administrativa local 9D; no se aplicaron privilegios.' }
if (-not (Test-Path $grantScript)) { throw 'Falta la migración administrativa versionada; no se aplicaron privilegios.' }
if (-not (Test-Path $psql)) { throw 'Falta psql de PostgreSQL 18; no se aplicaron privilegios.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config.DB_HOST -ne '127.0.0.1' -or $config.DB_PORT -ne '55441' -or $config.DB_NAME -ne 'genares_9d_disposable' -or $config.DB_USERNAME -ne 'genares_9d_app' -or $config.DB_DISPOSABLE -ne 'true') {
  throw 'La configuración no identifica exactamente PostgreSQL 9D; no se aplicaron privilegios.'
}

$adminPassword = (Get-Content -Raw $adminPasswordPath).Trim()
$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
  $env:PGPASSWORD = $adminPassword
  $adminIdentity = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d genares_9d_disposable -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database') || '|' || current_user;"
  if ($LASTEXITCODE -ne 0 -or $adminIdentity.Trim() -ne 'genares_9d_disposable|127.0.0.1|55441|GENARES:9D:DISPOSABLE|genares_9d_admin') {
    throw 'La conexión administrativa no coincide con la huella exacta 9D; no se aplicaron privilegios.'
  }
  Write-Output "ADMIN_IDENTITY=$($adminIdentity.Trim())"

  $preflight = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d genares_9d_disposable -w -Atc "SELECT (to_regrole('genares_9d_app') IS NOT NULL)::text || '|' || (to_regclass('public.versiones_rubrica_carreras') IS NOT NULL)::text || '|' || (to_regclass('public.vigencias_rubrica_carrera') IS NOT NULL)::text;"
  if ($LASTEXITCODE -ne 0 -or $preflight.Trim() -ne 'true|true|true') {
    throw 'Falta el rol o alguna tabla objetivo; ejecute primero las migraciones de esquema.'
  }

  $privilegiosAntes = @{}
  foreach ($table in @('versiones_rubrica_carreras', 'vigencias_rubrica_carrera')) {
    $rights = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d genares_9d_disposable -w -Atc "SELECT has_table_privilege('genares_9d_app', 'public.$table', 'SELECT')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'INSERT')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'UPDATE')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'DELETE')::text;"
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron consultar los privilegios previos de $table." }
    $privilegiosAntes[$table] = $rights.Trim()
    Write-Output "BEFORE_$($table.ToUpperInvariant())=$($rights.Trim())"
  }

  & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d genares_9d_disposable -w -v ON_ERROR_STOP=1 -f $grantScript
  if ($LASTEXITCODE -ne 0) { throw 'Falló la migración administrativa de permisos de lectura 9D.' }

  foreach ($table in @('versiones_rubrica_carreras', 'vigencias_rubrica_carrera')) {
    $rights = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d genares_9d_disposable -w -Atc "SELECT has_table_privilege('genares_9d_app', 'public.$table', 'SELECT')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'INSERT')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'UPDATE')::text || '|' || has_table_privilege('genares_9d_app', 'public.$table', 'DELETE')::text;"
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron verificar los privilegios de $table." }
    $rightsAfter = $rights.Trim().Split('|')
    $rightsBefore = $privilegiosAntes[$table].Split('|')
    if ($rightsAfter.Length -ne 4 -or $rightsAfter[0] -ne 'true' -or $rightsAfter[1] -ne $rightsBefore[1] -or $rightsAfter[2] -ne $rightsBefore[2] -or $rightsAfter[3] -ne $rightsBefore[3]) {
      throw "Los privilegios efectivos de $table no coinciden con SELECT agregado y escrituras preservadas."
    }
    Write-Output "AFTER_$($table.ToUpperInvariant())=$($rights -join '')"
  }

  $appPassword = $config.DB_PASSWORD
  $env:PGPASSWORD = $appPassword
  $appIdentity = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_app -d genares_9d_disposable -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database') || '|' || current_user;"
  if ($LASTEXITCODE -ne 0 -or $appIdentity.Trim() -ne 'genares_9d_disposable|127.0.0.1|55441|GENARES:9D:DISPOSABLE|genares_9d_app') {
    throw 'No se pudo verificar con el rol real de aplicación; la migración no se considera validada.'
  }
  foreach ($table in @('versiones_rubrica_carreras', 'vigencias_rubrica_carrera')) {
    & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_app -d genares_9d_disposable -w -v ON_ERROR_STOP=1 -c "SELECT 1 FROM public.`"$table`" LIMIT 0;"
    if ($LASTEXITCODE -ne 0) { throw "El rol real de aplicación no puede leer $table después de la migración." }
  }
  Write-Output "APP_IDENTITY=$($appIdentity.Trim())"
  Write-Output 'Lectura verificada para ambas tablas con genares_9d_app; las capacidades de escritura previas quedaron intactas.'
}
finally {
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPassword }
}
