param([switch] $HabilitarEscrituraAdministrativa)
$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$dotenvPath = Join-Path $backendPath '.env.9d.local'
if (-not (Test-Path $dotenvPath)) { throw 'Ejecute primero scripts/preparar-postgres-9d-desechable.ps1.' }

$config = @{}
foreach ($line in Get-Content $dotenvPath) {
  if ($line -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config.DB_HOST -ne '127.0.0.1' -or $config.DB_PORT -ne '55441' -or $config.DB_NAME -ne 'genares_9d_disposable' -or $config.DB_DISPOSABLE -ne 'true') {
  throw 'La configuración no identifica exactamente la base desechable 9D; NestJS no se inició.'
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
  $env:LOCAL_DEV_IDENTITY_ENABLED = 'true'
  $env:LOCAL_DEV_WRITE_ORIGINS = 'http://127.0.0.1:5173'
  if ($HabilitarEscrituraAdministrativa) {
    $env:LOCAL_DEV_IDENTITY_PROFILE = 'administrador-rubricas'
    $env:LOCAL_DEV_WRITE_ENABLED = 'true'
    Write-Output 'Perfil administrativo local opt-in; NestJS verificará base, marca, puerto y origen antes de iniciar.'
  }
  else {
    $env:LOCAL_DEV_IDENTITY_PROFILE = 'lector'
    $env:LOCAL_DEV_WRITE_ENABLED = 'false'
    Write-Output 'Perfil local de solo lectura.'
  }
  Push-Location $backendPath
  try { npm run start:dev; if ($LASTEXITCODE -ne 0) { throw 'NestJS terminó con error.' } }
  finally { Pop-Location }
}
finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
