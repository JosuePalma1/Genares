$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
if (-not (Test-Path $dotenvPath)) { throw 'Ejecute primero scripts/preparar-postgres-9d-desechable.ps1.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config.DB_HOST -ne '127.0.0.1' -or $config.DB_PORT -ne '55441' -or $config.DB_NAME -ne 'genares_9d_disposable' -or $config.DB_DISPOSABLE -ne 'true') {
  throw 'La configuración no identifica exactamente la base desechable 9D; no se cargó el fixture.'
}
$passwordPath = Join-Path $backendPath '.local-postgres-9d-desechable\app-password.txt'
if (-not (Test-Path $passwordPath)) { throw 'No se encontró la clave local de aplicación.' }
$previousPgPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
$env:PGPASSWORD = (Get-Content -Raw $passwordPath).Trim()
try {
  $psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'
  $metadata = & $psql -X -h 127.0.0.1 -p 55441 -U $config.DB_USERNAME -d $config.DB_NAME -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database');"
  if ($LASTEXITCODE -ne 0 -or $metadata.Trim() -ne 'genares_9d_disposable|127.0.0.1|55441|GENARES:9D:DISPOSABLE') {
    throw 'La conexión activa no coincide con la identidad exacta de PostgreSQL 9D; no se cargó el fixture.'
  }
  & $psql -X -h 127.0.0.1 -p 55441 -U $config.DB_USERNAME -d $config.DB_NAME -v ON_ERROR_STOP=1 -f (Join-Path $backendPath 'fixtures\rubricas-desarrollo.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Falló la carga explícita del fixture ficticio 9D.' }
}
finally {
  if ($null -eq $previousPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPgPassword }
}
