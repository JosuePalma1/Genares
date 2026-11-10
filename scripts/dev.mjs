import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const soloFrontend = process.argv.includes('--frontend-only');
const soloBackend = process.argv.includes('--backend-only');
const combinados = !soloFrontend && !soloBackend;
const procesos = new Set();
let apagando = false;

const web = resolve(raiz, 'frontend');
const backend = resolve(raiz, 'backend');
const vite = resolve(web, 'node_modules/vite/bin/vite.js');
const nest = resolve(backend, 'node_modules/@nestjs/cli/bin/nest.js');

function terminarArbol(proceso) {
  if (!proceso.pid) return Promise.resolve();
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(proceso.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    if (proceso.exitCode === null) proceso.kill('SIGTERM');
    return Promise.resolve();
  }
  try { process.kill(-proceso.pid, 'SIGTERM'); } catch { proceso.kill('SIGTERM'); }
  return new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      try { process.kill(-proceso.pid, 'SIGKILL'); } catch { /* El árbol terminó. */ }
      resolvePromise();
    }, 2000);
    proceso.once('exit', () => { clearTimeout(timeout); resolvePromise(); });
  });
}

async function detener(codigo = 0) {
  if (apagando) return;
  apagando = true;
  await Promise.all([...procesos].map(terminarArbol));
  procesos.clear();
  process.exitCode = codigo;
}

process.on('SIGINT', () => { void detener(0); });
process.on('SIGTERM', () => { void detener(0); });

function iniciar(nombre, ejecutable, argumentos, cwd, env) {
  if (!existsSync(ejecutable)) {
    throw new Error(`Faltan dependencias de ${nombre}. Instálalas en ${cwd} antes de usar npm run dev.`);
  }
  const proceso = spawn(process.execPath, [ejecutable, ...argumentos], {
    cwd,
    env,
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  procesos.add(proceso);
  proceso.once('error', (error) => {
    console.error(`${nombre} no pudo iniciar: ${error.message}`);
    void detener(1, true);
  });
  proceso.once('exit', (codigo, senal) => {
    procesos.delete(proceso);
    if (!apagando) {
      if (codigo === null && senal === 'SIGINT') {
        void detener(0, false);
      } else {
        console.error(`${nombre} terminó antes de detener el entorno (código ${codigo ?? senal ?? 'desconocido'}).`);
        void detener(1, true);
      }
    }
  });
  return proceso;
}

async function esperarArchivo(ruta, nombre) {
  const limite = Date.now() + 60000;
  while (Date.now() < limite) {
    if (existsSync(ruta)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`${nombre} no generó ${ruta} dentro del tiempo esperado.`);
}

async function esperarDisponible(url, nombre, proceso) {
  const limite = Date.now() + 60000;
  let ultimoError = 'sin respuesta';
  while (Date.now() < limite) {
    if (apagando || proceso.exitCode !== null) {
      throw new Error(`${nombre} terminó antes de quedar disponible.`);
    }
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (respuesta.ok) return;
      ultimoError = `HTTP ${respuesta.status}`;
    } catch (error) {
      ultimoError = error.message;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }
  throw new Error(`${nombre} no respondió en ${url}: ${ultimoError}`);
}

async function main() {
  const entornoWeb = {
    ...process.env,
    VITE_API_BASE_URL: '/api/v1',
  };

  const procesoWeb = soloBackend ? null : iniciar('Vite', vite, ['--strictPort'], web, entornoWeb);
  const procesoApi = soloFrontend ? null : iniciar('NestJS', nest, ['start', '--watch'], backend, process.env);

  const comprobaciones = [];
  if (procesoApi) {
    comprobaciones.push(
      esperarArchivo(resolve(backend, 'dist', 'main.js'), 'NestJS')
        .then(() => esperarDisponible('http://127.0.0.1:3001/api/salud', 'NestJS', procesoApi)),
    );
  }
  if (procesoWeb) comprobaciones.push(esperarDisponible('http://127.0.0.1:5173/', 'Vite', procesoWeb));
  await Promise.all(comprobaciones);

  if (combinados) {
    console.log('Frontend: http://127.0.0.1:5173/');
    console.log('API: http://127.0.0.1:3001/api/v1');
  } else if (soloBackend) {
    console.log('API: http://127.0.0.1:3001/api/v1');
  } else {
    console.log('Frontend de demostración: http://127.0.0.1:5173/');
  }
  console.log('Detén los servicios con Ctrl+C.');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await detener(1);
});
