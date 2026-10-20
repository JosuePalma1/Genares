$ErrorActionPreference = 'Stop'

$backendPath = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $backendPath '.local-postgres-dev'
$dataPath = Join-Path $localRoot 'data'
$adminPasswordPath = Join-Path $localRoot 'admin-password.txt'
$appPasswordPath = Join-Path $localRoot 'app-password.txt'
$dotenvPath = Join-Path $backendPath '.env'
$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$initdb = Join-Path $postgresBin 'initdb.exe'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$dbName = 'genares_dev_8e_test'
$adminName = 'genares_dev_admin'
$appName = 'genares_dev_app'
$port = 55440

foreach ($binary in @($initdb, $pgCtl, $psql, $createdb)) {
  if (-not (Test-Path $binary)) { throw "No se encontró PostgreSQL 18: $binary" }
}

New-Item -ItemType Directory -Force -Path $localRoot | Out-Null

function New-LocalPassword {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 64
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $rng.GetBytes($bytes)
  $password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
  [Array]::Clear($bytes, 0, $bytes.Length)
  $rng.Dispose()
  return $password
}

function Write-Utf8File([string] $Path, [string] $Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  if (Test-Path $dataPath) {
    $existingContents = Get-ChildItem -Force $dataPath
    if ($existingContents.Count -gt 0) { throw "El directorio de datos no está vacío y no parece una instancia preparada: $dataPath" }
  }
  if (Test-Path $adminPasswordPath) { throw 'Hay una clave local pero el clúster no está inicializado; se detiene para preservar el estado.' }

  New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
  $adminPassword = New-LocalPassword
  Write-Utf8File $adminPasswordPath $adminPassword
  & $initdb -D $dataPath -U $adminName -A scram-sha-256 --pwfile=$adminPasswordPath --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'initdb falló; no se borró el directorio para preservar cualquier evidencia.' }
}

if (-not (Test-Path $adminPasswordPath)) {
  throw 'No se encontró la clave del administrador local. No se intentará recuperar ni modificar el clúster.'
}
$adminPassword = (Get-Content -Raw $adminPasswordPath).Trim()

$statusOutput = & $pgCtl -D $dataPath status 2>&1
$isRunning = $LASTEXITCODE -eq 0
if (-not $isRunning) {
  $portListener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($portListener) { throw "El puerto $port ya está en uso; no se iniciará PostgreSQL allí." }
  $logPath = Join-Path $localRoot 'postgres.log'
  & $pgCtl -D $dataPath -l $logPath -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el PostgreSQL local.' }
}

$env:PGPASSWORD = $adminPassword
try {
  $actualBind = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT current_setting('listen_addresses') || ':' || current_setting('port');"
  if ($LASTEXITCODE -ne 0 -or $actualBind.Trim() -ne "127.0.0.1:$port") {
    throw "La instancia no quedó enlazada solo a loopback (valor leído: $($actualBind.Trim()))."
  }

  $roleExists = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT 1 FROM pg_roles WHERE rolname = '$appName';"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el catálogo de roles local.' }
  $databaseExists = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el catálogo de bases local.' }

  if (-not $roleExists -and -not $databaseExists) {
    $appPassword = New-LocalPassword
    Write-Utf8File $appPasswordPath $appPassword
    $sqlPath = Join-Path $localRoot 'create-app.sql'
    Write-Utf8File $sqlPath "CREATE ROLE $appName LOGIN PASSWORD '$appPassword';`n"
    try {
      & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -v ON_ERROR_STOP=1 -f $sqlPath
      if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el rol local de aplicación.' }
      & $createdb -h 127.0.0.1 -p $port -U $adminName -w -O $appName $dbName
      if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base local de desarrollo.' }
    }
    finally {
      Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
    }
  }
  elseif ($roleExists -and $databaseExists) {
    if (-not (Test-Path $appPasswordPath)) {
      throw 'La base y el rol ya existen, pero falta la clave local guardada; no se cambiarán credenciales.'
    }
  }
  else {
    throw 'El clúster contiene solo parte del rol/base esperados; se detiene sin reparar ni eliminar datos.'
  }
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (-not (Test-Path $dotenvPath)) {
  $appPassword = (Get-Content -Raw $appPasswordPath).Trim()
  $dotenv = @(
    'NODE_ENV=development'
    'PORT=3001'
    'DB_HOST=127.0.0.1'
    "DB_PORT=$port"
    "DB_USERNAME=$appName"
    "DB_PASSWORD=$appPassword"
    "DB_NAME=$dbName"
    'DB_SSL=false'
    ''
  ) -join "`n"
  Write-Utf8File $dotenvPath $dotenv
}

Write-Output "PostgreSQL local listo en 127.0.0.1:$port, base $dbName."
Write-Output 'La base existente del sistema no fue modificada.'
if (Test-Path $dotenvPath) { Write-Output 'Configuración local en backend/.env (ignorada por Git).' }
