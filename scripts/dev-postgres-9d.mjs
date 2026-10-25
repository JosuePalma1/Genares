import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, 'backend');
const web = resolve(root, 'prototipo-titulacion');
const configPath = resolve(backend, '.env.9d.local');
const localSecrets = resolve(backend, '.local-postgres-9d-desechable');
const pgBin = resolve(process.env.ProgramFiles ?? 'C:/Program Files', 'PostgreSQL/18/bin');
const psql = resolve(pgBin, 'psql.exe');
const createdb = resolve(pgBin, 'createdb.exe');
const dropdb = resolve(pgBin, 'dropdb.exe');
const apiPort = 3005;
const webPort = 5180;

let dbName;
let dbMarked = false;
let api;
let vite;
let stopping = false;
let stopResolve;
let stopCode = 0;
const stopPromise = new Promise((resolveStop) => { stopResolve = resolveStop; });

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`Falta ${label}: ${path}`);
}

function readEnv(path) {
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) result[match[1].trim()] = match[2];
  }
  return result;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: 'utf8',
    windowsHide: true,
    shell: options.shell ?? false,
    maxBuffer: 8 * 1024 * 1024,
  });
  if ((!options.suppressOutput || result.status !== 0) && result.stdout) process.stdout.write(result.stdout);
  if ((!options.suppressOutput || result.status !== 0) && result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminó con código ${result.status ?? 'desconocido'}.`);
  return result.stdout.trim();
}

function psqlQuery(database, user, password, query) {
  return run(psql, [
    '-X', '-h', '127.0.0.1', '-p', '55441', '-U', user, '-d', database, '-w', '-v', 'ON_ERROR_STOP=1', '-Atc', query,
  ], { env: { ...process.env, PGPASSWORD: password } });
}

function comprobarPuertoLibre(port) {
  return new Promise((resolveCheck, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`El puerto local ${port} ya está ocupado; no se inició GENARES.`)));
    server.listen(port, '127.0.0.1', () => server.close((error) => error ? reject(error) : resolveCheck()));
  });
}

function entornoApi(config, appPassword) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(apiPort),
    DB_HOST: '127.0.0.1',
    DB_PORT: '55441',
    DB_USERNAME: 'genares_9d_app',
    DB_PASSWORD: appPassword,
    DB_NAME: dbName,
    DB_SSL: 'false',
    DB_DISPOSABLE: 'true',
    LOCAL_DEV_OPEN_ACCESS: 'false',
    LOCAL_DEV_IDENTITY_ENABLED: 'true',
    LOCAL_DEV_IDENTITY_PROFILE: 'consulta-integrada',
    LOCAL_DEV_9D_TEMPORAL: 'true',
    LOCAL_DEV_WRITE_ENABLED: 'false',
    LOCAL_DEV_WRITE_ORIGINS: 'http://127.0.0.1:5180',
    PGPASSWORD: appPassword,
  };
}

function lanzar(nombre, binario, args, cwd, env) {
  const child = spawn(binario, args, { cwd, env, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32' });
  child.once('error', (error) => {
    console.error(`${nombre} no pudo iniciar: ${error.message}`);
    void detener(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${nombre} terminó inesperadamente (${code ?? signal ?? 'sin código'}).`);
      void detener(1);
    }
  });
  return child;
}

async function esperarDisponible(url, nombre, child) {
  const deadline = Date.now() + 90000;
  let lastError = 'sin respuesta';
  while (Date.now() < deadline) {
    if (stopping || child.exitCode !== null) throw new Error(`${nombre} terminó antes de quedar disponible.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`${nombre} no respondió en ${url}: ${lastError}`);
}

async function detenerArbol(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { cwd: root, windowsHide: true, stdio: 'ignore' });
    await new Promise((resolveWait) => {
      if (child.exitCode !== null) return resolveWait();
      const timer = setTimeout(resolveWait, 2500);
      child.once('exit', () => { clearTimeout(timer); resolveWait(); });
    });
    if (child.exitCode === null) child.kill('SIGTERM');
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

async function retirarBaseTemporal(adminPassword) {
  if (!dbName || !dbMarked) return;
  const quoted = `"${dbName}"`;
  try {
    const identity = psqlQuery('postgres', 'genares_9d_admin', adminPassword,
      `SELECT datname || '|' || COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '${dbName}';`);
    if (identity !== `${dbName}|GENARES:9D:DISPOSABLE`) {
      console.warn(`Se conserva ${dbName}: la huella ya no coincide con la base temporal creada por este proceso.`);
      return;
    }
    run(dropdb, ['-h', '127.0.0.1', '-p', '55441', '-U', 'genares_9d_admin', '-w', '--force', dbName], {
      env: { ...process.env, PGPASSWORD: adminPassword },
    });
    console.log(`Base temporal retirada tras detener la aplicación: ${quoted}.`);
  } catch (error) {
    console.error(`No se pudo retirar la base temporal marcada ${quoted}: ${error.message}`);
  }
}

async function detener(code = 0) {
  if (stopping) return;
  stopping = true;
  stopCode = code;
  await Promise.all([detenerArbol(api), detenerArbol(vite)]);
  await retirarBaseTemporal(adminSecret);
  process.exitCode = stopCode;
  stopResolve();
}

let adminSecret;

async function main() {
  requireFile(configPath, 'la configuración local 9D');
  requireFile(psql, 'psql del clúster PostgreSQL 18');
  requireFile(createdb, 'createdb del clúster PostgreSQL 18');
  requireFile(dropdb, 'dropdb del clúster PostgreSQL 18');
  const config = readEnv(configPath);
  requireFile(resolve(localSecrets, 'admin-password.txt'), 'la clave del administrador local 9D');
  requireFile(resolve(localSecrets, 'app-password.txt'), 'la clave de aplicación local 9D');
  adminSecret = readFileSync(resolve(localSecrets, 'admin-password.txt'), 'utf8').trim();
  const appSecret = readFileSync(resolve(localSecrets, 'app-password.txt'), 'utf8').trim();
  if (!adminSecret || !appSecret
    || config.DB_HOST !== '127.0.0.1' || config.DB_PORT !== '55441'
    || config.DB_NAME !== 'genares_9d_disposable' || config.DB_DISPOSABLE !== 'true'
    || config.DB_USERNAME !== 'genares_9d_app') {
    throw new Error('La configuración no coincide con el clúster temporal PostgreSQL 9D autorizado.');
  }

  await Promise.all([comprobarPuertoLibre(apiPort), comprobarPuertoLibre(webPort)]);

  const clusterIdentity = psqlQuery('postgres', 'genares_9d_admin', adminSecret,
    "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text;");
  if (clusterIdentity !== 'postgres|127.0.0.1|55441') throw new Error('La huella activa no corresponde a PostgreSQL 9D loopback.');
  const authorizedMarker = psqlQuery('postgres', 'genares_9d_admin', adminSecret,
    "SELECT datname || '|' || COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = 'genares_9d_disposable';");
  if (authorizedMarker !== 'genares_9d_disposable|GENARES:9D:DISPOSABLE') {
    throw new Error('La marca de autorización del clúster 9D no coincide.');
  }

  dbName = `genares_9d_test_${randomBytes(4).toString('hex')}`;
  const exists = psqlQuery('postgres', 'genares_9d_admin', adminSecret,
    `SELECT count(*) FROM pg_database WHERE datname = '${dbName}';`);
  if (exists !== '0') throw new Error('El nombre de base temporal ya existe; se canceló el inicio.');

  console.log(`Creando base UUID temporal ${dbName} en 127.0.0.1:55441.`);
  run(createdb, ['-h', '127.0.0.1', '-p', '55441', '-U', 'genares_9d_admin', '-w', '-O', 'genares_9d_app', dbName], {
    env: { ...process.env, PGPASSWORD: adminSecret },
  });
  const mark = psqlQuery('postgres', 'genares_9d_admin', adminSecret,
    `COMMENT ON DATABASE "${dbName}" IS 'GENARES:9D:DISPOSABLE'; SELECT datname || '|' || COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '${dbName}';`);
  if (!mark.endsWith(`${dbName}|GENARES:9D:DISPOSABLE`)) throw new Error('No se pudo marcar y verificar la base temporal.');
  dbMarked = true;

  const appFingerprint = psqlQuery(dbName, 'genares_9d_app', appSecret,
    "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || current_user || '|' || COALESCE(shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database'), '');");
  if (appFingerprint !== `${dbName}|127.0.0.1|55441|genares_9d_app|GENARES:9D:DISPOSABLE`) {
    throw new Error('El usuario de aplicación no obtuvo la huella exacta de la base UUID marcada.');
  }

  const env = entornoApi(config, appSecret);
  console.log('Aplicando migraciones existentes a la base temporal vacía.');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['run', 'migration:run'], { cwd: backend, env, shell: process.platform === 'win32', suppressOutput: true });
  const migrationCount = psqlQuery(dbName, 'genares_9d_app', appSecret, 'SELECT count(*) FROM migrations;');
  if (migrationCount !== '16') throw new Error(`Migraciones esperadas: 16; registradas: ${migrationCount}.`);

  run(psql, ['-X', '-h', '127.0.0.1', '-p', '55441', '-U', 'genares_9d_app', '-d', dbName, '-w', '-v', 'ON_ERROR_STOP=1', '-f', resolve(backend, 'fixtures/integracion-navegador-9d.sql')], {
    cwd: root, env: { ...env, PGPASSWORD: appSecret },
  });
  const fixtureCounts = psqlQuery(dbName, 'genares_9d_app', appSecret, `
    SELECT (SELECT count(*) FROM trabajos_titulacion WHERE codigo = 'DEMO-9D-001') || '|' ||
      (SELECT count(*) FROM evaluaciones WHERE id_trabajo = '11000000-0000-4000-8000-000000000040') || '|' ||
      (SELECT count(*) FROM evaluaciones WHERE id_trabajo = '11000000-0000-4000-8000-000000000040' AND id_etapa_rubrica IS NOT NULL) || '|' ||
      (SELECT count(*) FROM eventos_trazabilidad_trabajo WHERE id_trabajo = '11000000-0000-4000-8000-000000000040');`);
  const [workCount, evaluationCount, dynamicEvaluationCount, traceCount] = fixtureCounts.split('|').map(Number);
  if (workCount !== 1 || evaluationCount !== 4 || dynamicEvaluationCount !== 4 || traceCount < 5) {
    throw new Error(`Fixture incompleto; validación trabajo/evaluaciones/trazabilidad=${fixtureCounts}.`);
  }

  const nestCli = resolve(backend, 'node_modules/@nestjs/cli/bin/nest.js');
  const viteCli = resolve(web, 'node_modules/vite/bin/vite.js');
  requireFile(nestCli, 'Nest CLI');
  requireFile(viteCli, 'Vite CLI');
  api = lanzar('NestJS', process.execPath, [nestCli, 'start', '--watch'], backend, env);
  const envWeb = {
    ...process.env,
    NODE_ENV: 'development',
    VITE_API_BASE_URL: '/api/v1',
    VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  };
  vite = lanzar('Vite', process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], web, envWeb);
  await Promise.all([
    esperarDisponible(`http://127.0.0.1:${apiPort}/api/salud`, 'NestJS', api),
    esperarDisponible(`http://127.0.0.1:${webPort}/`, 'Vite', vite),
  ]);

  const trabajos = await fetch(`http://127.0.0.1:${webPort}/api/v1/trabajos`);
  if (!trabajos.ok || !(await trabajos.text()).includes('DEMO-9D-001')) {
    throw new Error('La comprobación React → proxy Vite → NestJS → PostgreSQL no encontró el trabajo del fixture.');
  }
  const consolidacion = await fetch(`http://127.0.0.1:${webPort}/api/v1/evaluaciones/trabajos/11000000-0000-4000-8000-000000000040/consolidados`);
  const resultado = consolidacion.ok ? await consolidacion.json() : null;
  if (resultado?.estudiantes?.[0]?.estado !== 'RESULTADO_COMPLETO'
    || Number(resultado.estudiantes[0].resultadoFinal?.calificacion) !== 8.5) {
    throw new Error('La consolidación real del fixture no entregó el resultado completo esperado desde PostgreSQL.');
  }
  console.log('\nGENARES integrado está disponible:');
  console.log(`  React: http://127.0.0.1:${webPort}/`);
  console.log(`  API:   http://127.0.0.1:${apiPort}/api/v1`);
  console.log(`  Base:  ${dbName} (GENARES:9D:DISPOSABLE, perfil consulta-integrada, solo lectura)`);
  console.log('  Trabajo sintético: DEMO-9D-001');
  console.log('Detén con Ctrl+C; se cerrarán ambos servidores y se retirará solo esta base si conserva su marca.');
  await stopPromise;
}

process.on('SIGINT', () => { void detener(0); });
process.on('SIGTERM', () => { void detener(0); });

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await detener(1);
});
