import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(raiz, 'backend');
const directorioLocal = resolve(raiz, '.local-postgres-10.9');
const datos = resolve(directorioLocal, 'data');
const rutaEnv = resolve(backend, '.env.10.9');
const rutaClaveAdmin = resolve(directorioLocal, 'admin-password.txt');
const puerto = 55442;
const nombreBase = 'genares_dev_10_9';
const usuarioApp = 'genares_dev_app';
const usuarioAdmin = 'genares_dev_admin';
const marcaBase = 'GENARES:10.9B:DEVELOPMENT';
const { Client } = createRequire(resolve(backend, 'package.json'))('pg');
const binarios = join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL', '18', 'bin');
const initdb = join(binarios, 'initdb.exe');
const postgres = join(binarios, 'postgres.exe');
const pgCtl = join(binarios, 'pg_ctl.exe');

export function parsearEnv(texto = '') {
  return Object.fromEntries(texto.split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith('#'))
    .map((linea) => {
      const separador = linea.indexOf('=');
      if (separador < 1) return null;
      const clave = linea.slice(0, separador).trim();
      const valor = linea.slice(separador + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      return [clave, valor];
    })
    .filter(Boolean));
}

function ejecutar(ruta, argumentos, opciones = {}) {
  const resultado = spawnSync(ruta, argumentos, {
    cwd: opciones.cwd ?? raiz,
    env: opciones.env ?? process.env,
    encoding: 'utf8',
    input: opciones.input,
    stdio: opciones.inherit ? 'inherit' : 'pipe',
    windowsHide: true,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    const detalle = [resultado.stdout, resultado.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${opciones.nombre ?? ruta} falló${detalle ? `:\n${detalle}` : '.'}`);
  }
  return resultado.stdout ?? '';
}

function verificarBinarios() {
  for (const ruta of [initdb, postgres, pgCtl]) {
    if (!existsSync(ruta)) {
      throw new Error(`Falta PostgreSQL 18 (${ruta}). No se instaló ni se modificó software del equipo.`);
    }
  }
}

function leerEnvLocal({ crear = false } = {}) {
  if (!existsSync(rutaEnv)) {
    if (!crear) throw new Error('Falta backend/.env.10.9. Ejecuta npm run db:prepare para preparar el entorno local.');
    const yaHayCluster = existsSync(join(datos, 'PG_VERSION')) || existsSync(directorioLocal);
    if (yaHayCluster) {
      const elementos = existsSync(directorioLocal) ? readdirSync(directorioLocal) : [];
      if (elementos.length) throw new Error('Hay un clúster local previo sin backend/.env.10.9; se conserva y no se generan credenciales nuevas.');
    }
    const password = randomBytes(32).toString('hex');
    const contenido = [
      'NODE_ENV=development',
      'PORT=3001',
      'DB_HOST=127.0.0.1',
      `DB_PORT=${puerto}`,
      `DB_USERNAME=${usuarioApp}`,
      `DB_PASSWORD=${password}`,
      `DB_NAME=${nombreBase}`,
      'DB_SSL=false',
      'DB_DISPOSABLE=false',
      'LOCAL_DEV_OPEN_ACCESS=true',
      'LOCAL_DEV_WRITE_ORIGINS=http://127.0.0.1:5173',
      '',
    ].join('\n');
    mkdirSync(backend, { recursive: true });
    writeFileSync(rutaEnv, contenido, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  }

  const config = parsearEnv(readFileSync(rutaEnv, 'utf8'));
  const esperados = {
    NODE_ENV: 'development',
    PORT: '3001',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(puerto),
    DB_USERNAME: usuarioApp,
    DB_NAME: nombreBase,
    DB_SSL: 'false',
    DB_DISPOSABLE: 'false',
  };
  for (const [clave, esperado] of Object.entries(esperados)) {
    if (config[clave] !== esperado) {
      throw new Error(`backend/.env.10.9 debe apuntar al entorno seguro 10.9 (${clave}=${esperado}). No se sobrescribió el archivo.`);
    }
  }
  if (!config.DB_PASSWORD || ['CAMBIAR_LOCALMENTE', 'REEMPLAZAR_LOCALMENTE'].includes(config.DB_PASSWORD)) {
    throw new Error('DB_PASSWORD no está configurada en backend/.env.10.9. No se intentó conectar.');
  }
  return config;
}

export function entornoBackendDesarrollo() {
  const config = leerEnvLocal();
  const entorno = { ...process.env, ...config, NODE_ENV: 'development', LOCAL_DEV_OPEN_ACCESS: 'true' };
  delete entorno.LOCAL_DEV_IDENTITY_ENABLED;
  delete entorno.LOCAL_DEV_IDENTITY_PROFILE;
  delete entorno.LOCAL_DEV_WRITE_ENABLED;
  return entorno;
}

async function puertoLibre() {
  return new Promise((resolvePromise, rejectPromise) => {
    const servidor = net.createServer();
    servidor.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolvePromise(false);
      else rejectPromise(error);
    });
    servidor.listen(puerto, '127.0.0.1', () => servidor.close(() => resolvePromise(true)));
  });
}

function validarClusterInicializado() {
  if (!existsSync(join(datos, 'PG_VERSION'))) {
    throw new Error('No existe el clúster local de desarrollo. Ejecuta npm run db:prepare antes de iniciar la API.');
  }
  const version = readFileSync(join(datos, 'PG_VERSION'), 'utf8').trim();
  if (version !== '18') throw new Error(`El clúster local no es PostgreSQL 18 (versión encontrada: ${version}). No se modificó.`);
}

function leerPidCluster() {
  const rutaPid = join(datos, 'postmaster.pid');
  if (!existsSync(rutaPid)) return null;
  const lineas = readFileSync(rutaPid, 'utf8').split(/\r?\n/);
  const rutaDatosPid = resolve(lineas[1] ?? '');
  const puertoPid = Number(lineas[3]);
  const escuchaPid = (lineas[5] ?? '').split(',').map((valor) => valor.trim());
  if (rutaDatosPid.toLowerCase() !== datos.toLowerCase() || puertoPid !== puerto
    || escuchaPid.some((valor) => !['127.0.0.1', '::1'].includes(valor))) {
    throw new Error('El archivo postmaster.pid no corresponde a 127.0.0.1:55442; no se conectará ni lo modificará.');
  }
  const pid = Number(lineas[0]);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('El archivo de proceso PostgreSQL local no es válido; se conserva para revisión.');
  return { pid };
}

function procesoExiste(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

function escaparSql(valor) {
  return String(valor).replaceAll("'", "''");
}

async function conCliente(usuario, base, password, accion) {
  const cliente = new Client({
    host: '127.0.0.1',
    port: puerto,
    user: usuario,
    password,
    database: base,
    ssl: false,
    connectionTimeoutMillis: 3000,
    application_name: 'genares-local-10.9b',
  });
  await cliente.connect();
  try {
    return await accion(cliente);
  } finally {
    await cliente.end();
  }
}

function leerPasswordAdmin() {
  if (!existsSync(rutaClaveAdmin)) throw new Error('Falta la credencial administrativa local del clúster; no se regenerará.');
  return readFileSync(rutaClaveAdmin, 'utf8').trim();
}

async function verificarMetadataServidor(passwordAdmin) {
  const metadata = await conCliente(usuarioAdmin, 'postgres', passwordAdmin, async (cliente) => {
    const { rows: [fila] } = await cliente.query(`
      SELECT current_database() AS base, host(inet_server_addr()) AS host,
        inet_server_port() AS port, current_setting('data_directory') AS data_directory,
        current_setting('listen_addresses') AS listen_addresses;
    `);
    return fila;
  });
  const directorioEsperado = datos.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  const directorioRecibido = (metadata.data_directory ?? '').replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  if (metadata.base !== 'postgres' || metadata.host !== '127.0.0.1' || Number(metadata.port) !== puerto
    || directorioRecibido !== directorioEsperado || metadata.listen_addresses !== '127.0.0.1') {
    throw new Error('La identidad del clúster no coincide con la ruta local y el puerto autorizados; no se harán cambios.');
  }
}

async function verificarConexionApp(config) {
  const metadata = await conCliente(config.DB_USERNAME, config.DB_NAME, config.DB_PASSWORD, async (cliente) => {
    const { rows: [fila] } = await cliente.query(`
      SELECT current_database() AS base, current_user AS usuario,
        host(inet_server_addr()) AS host, inet_server_port() AS port,
        COALESCE(shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database'), '') AS marca;
    `);
    return fila;
  });
  if (metadata.base !== nombreBase || metadata.usuario !== usuarioApp || metadata.host !== '127.0.0.1'
    || Number(metadata.port) !== puerto || metadata.marca !== marcaBase) {
    throw new Error('La conexión no corresponde a la base marcada 10.9. No se inició NestJS.');
  }
}

async function comprobarBaseExiste() {
  return conCliente(usuarioAdmin, 'postgres', leerPasswordAdmin(), async (cliente) => {
    const { rows: [fila] } = await cliente.query(`
      SELECT
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS rol_existe,
        (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = $2) AS propietario,
        (SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = $2) AS marca;
    `, [usuarioApp, nombreBase]);
    return {
      rolExiste: fila.rol_existe,
      propietario: fila.propietario ?? '',
      marca: fila.marca ?? '',
    };
  });
}

function inicializarClusterNuevo(config) {
  const versionRuta = join(datos, 'PG_VERSION');
  if (existsSync(versionRuta)) return;
  if (existsSync(directorioLocal)) {
    const elementos = readdirSync(directorioLocal);
    if (elementos.length) throw new Error('El directorio PostgreSQL 10.9 ya contiene archivos, pero no un clúster completo; se conserva para revisión.');
  } else {
    mkdirSync(directorioLocal, { recursive: true });
  }
  const passwordAdmin = randomBytes(32).toString('hex');
  writeFileSync(rutaClaveAdmin, `${passwordAdmin}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  mkdirSync(datos, { recursive: true });
  const archivoTemporal = join(directorioLocal, 'initdb-password.tmp');
  writeFileSync(archivoTemporal, `${passwordAdmin}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    ejecutar(initdb, [
      '-D', datos, '-U', usuarioAdmin, '-A', 'scram-sha-256',
      '--encoding=UTF8', '--locale=C', `--pwfile=${archivoTemporal}`,
    ], { inherit: true, nombre: 'initdb PostgreSQL 18 local' });
  } finally {
    rmSync(archivoTemporal, { force: true });
  }
  if (!existsSync(versionRuta)) throw new Error('initdb terminó sin crear PG_VERSION; no se borró el directorio parcial.');
  if (!config.DB_PASSWORD) throw new Error('Falta DB_PASSWORD para el rol local de aplicación.');
}

async function esperarMetadata(passwordAdmin, proceso) {
  const limite = Date.now() + 30000;
  let ultimoError;
  while (Date.now() < limite) {
    if (proceso?.exitCode !== null && proceso?.exitCode !== undefined) {
      throw new Error(`PostgreSQL terminó al iniciar con código ${proceso.exitCode}; revisa el mensaje de error mostrado arriba.`);
    }
    try {
      const pid = leerPidCluster();
      if (pid && procesoExiste(pid.pid)) {
        await verificarMetadataServidor(passwordAdmin);
        return;
      }
    } catch (error) {
      ultimoError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }
  throw new Error(`PostgreSQL no quedó disponible en 127.0.0.1:${puerto}${ultimoError ? `: ${ultimoError.message}` : '.'}`);
}

export async function iniciarClusterDesarrollo(config = leerEnvLocal()) {
  verificarBinarios();
  validarClusterInicializado();
  const passwordAdmin = leerPasswordAdmin();
  const infoPid = leerPidCluster();
  const libre = await puertoLibre();
  if (infoPid && procesoExiste(infoPid.pid)) {
    if (libre) throw new Error('El proceso del clúster parece activo pero no escucha en 55442; no se conectó ni se modificó.');
    await verificarMetadataServidor(passwordAdmin);
    return { hijo: null, iniciadoPorEstaLlamada: false };
  }
  if (!libre) throw new Error('El puerto 55442 está ocupado por una instancia desconocida. No se conectó ni se modificó.');

  const hijo = spawn(postgres, [
    '-D', datos, '-h', '127.0.0.1', '-p', String(puerto), '-c', 'listen_addresses=127.0.0.1',
  ], {
    cwd: raiz,
    env: process.env,
    stdio: 'inherit',
    windowsHide: false,
  });
  try {
    await esperarMetadata(passwordAdmin, hijo);
    return { hijo, iniciadoPorEstaLlamada: true };
  } catch (error) {
    await detenerProcesoPostgres(hijo, true);
    throw error;
  }
}

export async function detenerProcesoPostgres(hijo, forzar = false) {
  if (!hijo || hijo.exitCode !== null) return;
  const pidCluster = leerPidCluster();
  const esProcesoPropio = !pidCluster || pidCluster.pid === hijo.pid;
  if (pidCluster && !esProcesoPropio) {
    throw new Error('El PID del clúster local cambió; no se enviará una señal a otro proceso.');
  }

  const esperarSalida = async (limiteMs) => {
    if (hijo.exitCode !== null) return true;
    return Promise.race([
      new Promise((resolvePromise) => hijo.once('exit', () => resolvePromise(true))),
      new Promise((resolvePromise) => setTimeout(() => resolvePromise(false), limiteMs)),
    ]);
  };

  if (!forzar && esProcesoPropio && pidCluster) {
    const resultado = spawnSync(pgCtl, ['-D', datos, '-m', 'fast', '-w', '-t', '10', 'stop'], {
      cwd: raiz,
      stdio: 'ignore',
      windowsHide: true,
    });
    if (resultado.status === 0 && await esperarSalida(10000)) return;
  }

  if (forzar && hijo.exitCode === null) {
    if (process.platform === 'win32' && hijo.pid) {
      spawnSync('taskkill.exe', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      hijo.kill('SIGTERM');
    }
  } else if (hijo.exitCode === null) {
    await esperarSalida(10000);
  }

  if (hijo.exitCode === null) {
    if (process.platform === 'win32' && hijo.pid) {
      spawnSync('taskkill.exe', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      hijo.kill('SIGTERM');
    }
    await esperarSalida(3000);
  }
}

export async function prepararClusterYBase() {
  verificarBinarios();
  const existeEnv = existsSync(rutaEnv);
  const config = leerEnvLocal({ crear: true });
  if (!existsSync(join(datos, 'PG_VERSION'))) {
    if (!(await puertoLibre())) throw new Error('El puerto 55442 está ocupado por una instancia desconocida. No se crearon archivos ni se conectó a ella.');
    inicializarClusterNuevo(config);
  }
  validarClusterInicializado();
  const { hijo, iniciadoPorEstaLlamada } = await iniciarClusterDesarrollo(config);
  try {
    const adminPassword = leerPasswordAdmin();
    const objetos = await comprobarBaseExiste();
    if (!objetos.rolExiste && !objetos.propietario && !objetos.marca) {
      const passwordEscapada = escaparSql(config.DB_PASSWORD);
      await conCliente(usuarioAdmin, 'postgres', adminPassword, async (cliente) => {
        await cliente.query(`CREATE ROLE ${usuarioApp} LOGIN PASSWORD '${passwordEscapada}';`);
        await cliente.query(`CREATE DATABASE ${nombreBase} OWNER ${usuarioApp};`);
        await cliente.query(`COMMENT ON DATABASE ${nombreBase} IS '${marcaBase}';`);
      });
    } else if (!objetos.rolExiste || objetos.propietario !== usuarioApp || objetos.marca !== marcaBase) {
      throw new Error('La base o el rol ya existen sin la marca y propiedad exactas de 10.9B; se preservaron sin cambios.');
    }
    await verificarConexionApp(config);
    return { config, hijo, iniciadoPorEstaLlamada, configuracionNueva: !existeEnv };
  } catch (error) {
    if (iniciadoPorEstaLlamada) await detenerProcesoPostgres(hijo, true);
    throw error;
  }
}

export async function verificarBaseLista(config = leerEnvLocal()) {
  validarClusterInicializado();
  await verificarConexionApp(config);
  const datosDemo = await conCliente(config.DB_USERNAME, config.DB_NAME, config.DB_PASSWORD, async (cliente) => {
    const { rows: [migraciones] } = await cliente.query(`
      SELECT count(*)::int AS total,
        EXISTS (SELECT 1 FROM migrations WHERE name = 'ActorTecnicoProgramacionesLocales1760000014000') AS actor_tecnico
      FROM migrations;
    `);
    const { rows: [fixture] } = await cliente.query(`
      SELECT (SELECT count(*) FROM trabajos_titulacion WHERE codigo IN ('DEV-TI-001', 'DEV-SOFT-001'))::int AS trabajos,
        (SELECT count(*) FROM evaluaciones WHERE instantanea_rubrica->>'fixture' = '10.9B' AND estado = 'CERRADA')::int AS evaluaciones,
        (SELECT count(*) FROM traspasos_evaluacion_estudiante trans
          JOIN evaluaciones eval ON eval.id = trans.id_evaluacion
          WHERE eval.instantanea_rubrica->>'fixture' = '10.9B')::int AS traspasos;
    `);
    return { migraciones: Number(migraciones.total), actorTecnico: migraciones.actor_tecnico, ...fixture };
  });
  const migraciones = datosDemo.migraciones;
  if (migraciones < 15 || !datosDemo.actorTecnico) {
    throw new Error('Falta la migración aditiva del actor técnico local. Ejecuta npm run migration:run en backend.');
  }
  if (Number(datosDemo.trabajos) !== 2 || Number(datosDemo.evaluaciones) !== 10 || Number(datosDemo.traspasos) !== 6) {
    throw new Error('Faltan los datos sintéticos esperados de 10.9B. Ejecuta npm run db:prepare.');
  }
}

export async function cargarFixtureDesarrollo(config, sql) {
  await verificarConexionApp(config);
  await conCliente(config.DB_USERNAME, config.DB_NAME, config.DB_PASSWORD, (cliente) => cliente.query(sql));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('Usa npm run db:prepare para la preparación inicial o npm run dev para el inicio diario.');
  process.exitCode = 1;
}
