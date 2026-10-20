$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
$localRoot = Join-Path $backendPath '.local-postgres-9d-desechable'
if (-not (Test-Path $dotenvPath)) { throw 'Ejecute primero scripts/preparar-postgres-9d-desechable.ps1.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config.DB_HOST -ne '127.0.0.1' -or $config.DB_PORT -ne '55441' -or $config.DB_NAME -ne 'genares_9d_disposable' -or $config.DB_DISPOSABLE -ne 'true') {
  throw 'La configuración no identifica exactamente el clúster desechable 9D; no se ejecutaron pruebas PostgreSQL.'
}

$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$adminPasswordPath = Join-Path $localRoot 'admin-password.txt'
$appPasswordPath = Join-Path $localRoot 'app-password.txt'
foreach ($path in @($psql, $createdb, $dropdb, $adminPasswordPath, $appPasswordPath)) {
  if (-not (Test-Path $path)) { throw "Falta el recurso local esperado para 9D: $path" }
}

$adminPassword = (Get-Content -Raw $adminPasswordPath).Trim()
$appPassword = (Get-Content -Raw $appPasswordPath).Trim()
$previousTestUrl = [Environment]::GetEnvironmentVariable('TEST_DATABASE_URL', 'Process')
$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
$env:PGPASSWORD = $adminPassword
$databaseMetadata = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d $config.DB_NAME -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database');"
if ($LASTEXITCODE -ne 0 -or $databaseMetadata.Trim() -ne 'genares_9d_disposable|127.0.0.1|55441|GENARES:9D:DISPOSABLE') {
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPassword }
  throw 'La instancia activa no tiene la huella del clúster 9D; las pruebas destructivas se cancelaron.'
}
$testDatabaseName = "genares_9d_test_$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$testDatabaseCreated = $false
$testPassed = $false
try {
  $env:PGPASSWORD = $adminPassword
  & $createdb -h 127.0.0.1 -p 55441 -U genares_9d_admin -w -O $config.DB_USERNAME $testDatabaseName
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base vacía de prueba.' }
  $testDatabaseCreated = $true
  & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d postgres -w -v ON_ERROR_STOP=1 -c "COMMENT ON DATABASE $testDatabaseName IS 'GENARES:9D:DISPOSABLE';"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo marcar la base de prueba como desechable.' }

  $escapedPassword = [Uri]::EscapeDataString($appPassword)
  $env:TEST_DATABASE_URL = "postgres://$($config.DB_USERNAME):$escapedPassword@127.0.0.1:55441/$testDatabaseName"
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Push-Location $backendPath
  try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Falló la suite backend/PostgreSQL 9D.' }
    $testPassed = $true
  }
  finally { Pop-Location }
}
finally {
  if ($testDatabaseCreated -and $testPassed) {
    $env:PGPASSWORD = $adminPassword
    $marker = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d postgres -w -Atc "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '$testDatabaseName';"
    if ($LASTEXITCODE -ne 0 -or $marker.Trim() -ne 'GENARES:9D:DISPOSABLE') {
      throw 'La base temporal no conserva la marca esperada; se deja intacta para revisión.'
    }
    & $dropdb -h 127.0.0.1 -p 55441 -U genares_9d_admin -w --force $testDatabaseName
    if ($LASTEXITCODE -ne 0) { throw 'La suite pasó, pero no se pudo retirar su base temporal 9D.' }
  }
  elseif ($testDatabaseCreated) {
    Write-Warning "Se preservó la base temporal aislada para diagnóstico: $testDatabaseName"
  }
  if ($null -eq $previousTestUrl) { Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue }
  else { $env:TEST_DATABASE_URL = $previousTestUrl }
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPassword }
}
