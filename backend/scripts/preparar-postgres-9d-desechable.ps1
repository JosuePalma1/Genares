$ErrorActionPreference = 'Stop'

$backendPath = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $backendPath '.local-postgres-9d-desechable'
$dataPath = Join-Path $localRoot 'data'
$adminPasswordPath = Join-Path $localRoot 'admin-password.txt'
$appPasswordPath = Join-Path $localRoot 'app-password.txt'
$dotenvPath = Join-Path $backendPath '.env.9d.local'
$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$initdb = Join-Path $postgresBin 'initdb.exe'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$port = 55441
$adminName = 'genares_9d_admin'
$appName = 'genares_9d_app'
$databaseName = 'genares_9d_disposable'
$databaseMarker = 'GENARES:9D:DISPOSABLE'

foreach ($binary in @($initdb, $pgCtl, $psql, $createdb)) {
  if (-not (Test-Path $binary)) { throw "No se encontró PostgreSQL 18: $binary" }
}

function Write-Utf8File([string] $Path, [string] $Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

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

New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
if (-not (Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  if (Test-Path $dataPath) {
    $existingContents = Get-ChildItem -Force $dataPath
    if ($existingContents.Count -gt 0) { throw "El directorio PostgreSQL 9D no está vacío y no se inicializará: $dataPath" }
  }
  if (Test-Path $adminPasswordPath) { throw 'Hay una clave 9D pero el clúster no está inicializado; se detiene para preservar el estado.' }
  New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
  $adminPassword = New-LocalPassword
  Write-Utf8File $adminPasswordPath $adminPassword
  & $initdb -D $dataPath -U $adminName -A scram-sha-256 "--pwfile=$adminPasswordPath" --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'initdb falló; el directorio no se borró.' }
}

if (-not (Test-Path $adminPasswordPath)) { throw 'Falta la clave del clúster PostgreSQL 9D.' }
$adminPassword = (Get-Content -Raw $adminPasswordPath).Trim()
$appPassword = if (Test-Path $appPasswordPath) { (Get-Content -Raw $appPasswordPath).Trim() } else { $null }
$statusOutput = & $pgCtl -D $dataPath status 2>&1
$isRunning = $LASTEXITCODE -eq 0
if (-not $isRunning) {
  $portListener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($portListener) { throw "El puerto 9D $port ya está en uso por otro servicio; no se conectará a él." }
  & $pgCtl -D $dataPath -l (Join-Path $localRoot 'postgres.log') -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el clúster PostgreSQL 9D.' }
}

$env:PGPASSWORD = $adminPassword
try {
  $bind = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT current_setting('listen_addresses') || ':' || current_setting('port');"
  if ($LASTEXITCODE -ne 0 -or $bind.Trim() -ne "127.0.0.1:$port") { throw 'El clúster 9D no está limitado a loopback y puerto 55441.' }

  $roleExists = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT 1 FROM pg_roles WHERE rolname = '$appName';"
  $dbExists = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT 1 FROM pg_database WHERE datname = '$databaseName';"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar los objetos del clúster 9D.' }

  if (-not $roleExists -and -not $dbExists) {
    if ($appPassword) { throw 'Existe una clave de aplicación sin sus bases; no se reparará automáticamente.' }
    $appPassword = New-LocalPassword
    Write-Utf8File $appPasswordPath $appPassword
    $sqlPath = Join-Path $localRoot 'create-role.sql'
    Write-Utf8File $sqlPath "CREATE ROLE $appName LOGIN PASSWORD '$appPassword';`n"
    try {
      & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -v ON_ERROR_STOP=1 -f $sqlPath
      if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el rol de aplicación 9D.' }
      & $createdb -h 127.0.0.1 -p $port -U $adminName -w -O $appName $databaseName
      if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de desarrollo desechable 9D.' }
      & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -v ON_ERROR_STOP=1 -c "COMMENT ON DATABASE $databaseName IS '$databaseMarker';"
      if ($LASTEXITCODE -ne 0) { throw 'No se pudieron marcar las bases locales como desechables.' }
    }
    finally {
      Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
    }
  }
  elseif ($roleExists -and $dbExists -and $appPassword) {
    $marks = & $psql -X -h 127.0.0.1 -p $port -U $adminName -d postgres -w -Atc "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '$databaseName';"
    if ($LASTEXITCODE -ne 0 -or $marks.Trim() -ne $databaseMarker) {
      throw 'Las bases existentes no tienen la marca desechable esperada; no se modificarán.'
    }
  }
  else {
    throw 'El clúster 9D tiene un conjunto parcial de rol/base; se detiene sin reparar ni eliminar datos.'
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
    "DB_NAME=$databaseName"
    'DB_SSL=false'
    'DB_DISPOSABLE=true'
    'LOCAL_DEV_IDENTITY_ENABLED=false'
    'LOCAL_DEV_IDENTITY_PROFILE=lector'
    'LOCAL_DEV_WRITE_ENABLED=false'
    'LOCAL_DEV_WRITE_ORIGINS=http://127.0.0.1:5173'
    ''
  ) -join "`n"
  Write-Utf8File $dotenvPath $dotenv
}

Write-Output "Clúster PostgreSQL 9D aislado en 127.0.0.1:$port."
Write-Output "Base desechable de desarrollo: $databaseName."
Write-Output 'El clúster persistente de 8E en el puerto 55440 no se abrió ni modificó.'
Write-Output 'La configuración .env.9d.local queda ignorada por Git y mantiene los perfiles apagados.'
