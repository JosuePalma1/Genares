$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
if (-not (Test-Path $dotenvPath)) { throw 'Ejecute primero scripts/preparar-postgres-9d-desechable.ps1.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config.DB_HOST -ne '127.0.0.1' -or $config.DB_PORT -ne '55441' -or $config.DB_NAME -ne 'genares_9d_disposable' -or $config.DB_DISPOSABLE -ne 'true') {
  throw 'La configuración no identifica exactamente la base desechable 9D; no se ejecutaron migraciones.'
}

$psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path $psql) -or -not $config.DB_PASSWORD -or -not $config.DB_USERNAME) {
  throw 'Falta psql o la configuración de conexión local 9D; no se ejecutaron migraciones.'
}
$previousPgPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
  $env:PGPASSWORD = $config.DB_PASSWORD
  $metadata = & $psql -X -h 127.0.0.1 -p 55441 -U $config.DB_USERNAME -d $config.DB_NAME -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database');"
  if ($LASTEXITCODE -ne 0 -or $metadata.Trim() -ne 'genares_9d_disposable|127.0.0.1|55441|GENARES:9D:DISPOSABLE') {
    throw 'La conexión activa no coincide con la identidad exacta de PostgreSQL 9D; no se ejecutaron migraciones.'
  }
}
finally {
  if ($null -eq $previousPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPgPassword }
}

$keys = @('NODE_ENV', 'PORT', 'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL', 'DB_DISPOSABLE')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
  foreach ($key in $keys) { if ($config.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key, $config[$key], 'Process') } }
  $env:PGPASSWORD = $config.DB_PASSWORD
  Push-Location $backendPath
  try {
    npm run migration:run
    if ($LASTEXITCODE -ne 0) { throw 'Falló la aplicación de migraciones 9D.' }
    $migraciones = & $psql -X -h 127.0.0.1 -p 55441 -U $config.DB_USERNAME -d $config.DB_NAME -w -Atc 'SELECT name FROM migrations ORDER BY id;'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron verificar las migraciones aplicadas en PostgreSQL 9D.' }
    Write-Output "Migraciones presentes en $($config.DB_NAME) (127.0.0.1:55441):"
    $migraciones | ForEach-Object { Write-Output " - $_" }
    & (Join-Path $PSScriptRoot 'aplicar-permisos-catalogo-9d.ps1')
  }
  finally { Pop-Location }
}
finally {
  if ($null -eq $previousPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPgPassword }
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
