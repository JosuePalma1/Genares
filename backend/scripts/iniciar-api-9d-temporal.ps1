param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^genares_9d_test_[a-f0-9]{8}$')]
  [string] $BaseTemporal,
  [ValidateSet('administrador-rubricas', 'jurado-evaluaciones', 'jurado-evaluaciones-escritura', 'jurado-evaluaciones-escritura-dos')]
  [string] $Perfil = 'administrador-rubricas'
)

$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
$localRoot = Join-Path $backendPath '.local-postgres-9d-desechable'
if (-not (Test-Path $dotenvPath)) { throw 'Falta la configuración local de PostgreSQL 9D.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
$configuracionValida = $config.DB_HOST -eq '127.0.0.1' -and $config.DB_PORT -eq '55441' `
  -and $config.DB_NAME -eq 'genares_9d_disposable' -and $config.DB_DISPOSABLE -eq 'true' `
  -and $config.DB_USERNAME -eq 'genares_9d_app'
if (-not $configuracionValida) {
  throw 'La configuración base no identifica exactamente el entorno local 9D esperado.'
}

$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$psql = Join-Path $postgresBin 'psql.exe'
$adminPasswordPath = Join-Path $localRoot 'admin-password.txt'
$appPasswordPath = Join-Path $localRoot 'app-password.txt'
foreach ($path in @($psql, $adminPasswordPath, $appPasswordPath)) {
  if (-not (Test-Path $path)) { throw "Falta el recurso local esperado para 9D: $path" }
}

$adminPassword = (Get-Content -Raw $adminPasswordPath).Trim()
$appPassword = (Get-Content -Raw $appPasswordPath).Trim()
$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
  $env:PGPASSWORD = $adminPassword
  $databaseIdentity = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_admin -d postgres -w -Atc "SELECT datname || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '$BaseTemporal';"
  if ($LASTEXITCODE -ne 0 -or $databaseIdentity.Trim() -ne "$BaseTemporal|127.0.0.1|55441|GENARES:9D:DISPOSABLE") {
    throw 'La base temporal no existe o no coincide con el marcador PostgreSQL 9D.'
  }

  $env:PGPASSWORD = $appPassword
  $appIdentity = & $psql -X -h 127.0.0.1 -p 55441 -U genares_9d_app -d $BaseTemporal -w -Atc "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || current_user;"
  if ($LASTEXITCODE -ne 0 -or $appIdentity.Trim() -ne "$BaseTemporal|127.0.0.1|55441|genares_9d_app") {
    throw 'La conexión de aplicación no coincide con la base temporal 9D verificada.'
  }

  if (Get-NetTCPConnection -State Listen -LocalPort 3005 -ErrorAction SilentlyContinue) {
    throw 'El puerto local 3005 ya está en uso; se canceló el inicio.'
  }

  $keys = @(
    'NODE_ENV', 'PORT', 'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL', 'DB_DISPOSABLE',
    'LOCAL_DEV_IDENTITY_ENABLED', 'LOCAL_DEV_IDENTITY_PROFILE', 'LOCAL_DEV_WRITE_ENABLED', 'LOCAL_DEV_WRITE_ORIGINS'
  )
  $previous = @{}
  foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
  try {
    foreach ($key in $keys) { if ($config.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key, $config[$key], 'Process') } }
    $env:NODE_ENV = 'development'
    $env:PORT = '3005'
    $env:DB_NAME = $BaseTemporal
    $env:DB_DISPOSABLE = 'true'
    $env:LOCAL_DEV_IDENTITY_ENABLED = 'true'
    $env:LOCAL_DEV_IDENTITY_PROFILE = $Perfil
    $env:LOCAL_DEV_WRITE_ENABLED = if ($Perfil -in @('administrador-rubricas', 'jurado-evaluaciones-escritura', 'jurado-evaluaciones-escritura-dos')) { 'true' } else { 'false' }
    $env:LOCAL_DEV_WRITE_ORIGINS = 'http://127.0.0.1:5180'
    $env:PGPASSWORD = $appPassword
    if ($Perfil -eq 'administrador-rubricas') {
      Write-Output "Iniciando API de desarrollo con permisos administrativos locales en la base temporal 9D verificada $BaseTemporal, puerto local 3005."
    } elseif ($Perfil -eq 'jurado-evaluaciones-escritura') {
      Write-Output "Iniciando API de desarrollo con permisos locales de evaluaciÃ³n solo para la identidad fija prueba-jurado-uno en la base temporal 9D verificada $BaseTemporal, puerto local 3005."
    } elseif ($Perfil -eq 'jurado-evaluaciones-escritura-dos') {
      Write-Output "Iniciando API de desarrollo con permisos locales solo para la identidad fija prueba-jurado-dos en la base temporal 9D verificada $BaseTemporal, puerto local 3005."
    } else {
      Write-Output "Iniciando API de desarrollo con perfil de evaluaciones de solo lectura en la base temporal 9D verificada $BaseTemporal, puerto local 3005."
    }
    Push-Location $backendPath
    try { npm run start:dev; if ($LASTEXITCODE -ne 0) { throw 'NestJS terminó con error.' } }
    finally { Pop-Location }
  }
  finally {
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
  }
}
finally {
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $previousPassword }
}
