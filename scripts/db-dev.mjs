import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detenerProcesoPostgres,
  cargarFixtureDesarrollo,
  entornoBackendDesarrollo,
  prepararClusterYBase,
  verificarBaseLista,
} from './postgres-dev.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(raiz, 'backend');
const archivoDatos = resolve(backend, 'fixtures', 'entorno-desarrollo-10.9b.sql');

function ejecutarMigraciones(entorno) {
  const comando = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const resultado = spawnSync(comando, ['run', 'migration:run'], {
    cwd: backend,
    env: entorno,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) throw new Error('Falló la aplicación ordenada de las migraciones TypeORM. La base y el clúster se conservaron.');
}

async function cargarFixture(entorno) {
  if (!existsSync(archivoDatos)) throw new Error('Falta el fixture sintético backend/fixtures/entorno-desarrollo-10.9b.sql.');
  await cargarFixtureDesarrollo(entorno, readFileSync(archivoDatos, 'utf8'));
}

async function main() {
  const preparado = await prepararClusterYBase();
  const entorno = entornoBackendDesarrollo();
  try {
    ejecutarMigraciones(entorno);
    await cargarFixture(entorno);
    await verificarBaseLista(entorno);
    console.log('Migraciones y datos sintéticos de TI/SOFT verificados en la base local 10.9B.');
    if (preparado.hijo) {
      await detenerProcesoPostgres(preparado.hijo);
      console.log('La preparación terminó y PostgreSQL quedó detenido. La base local se conserva para npm run dev.');
    } else {
      console.log('El clúster ya estaba activo y pertenece a otro proceso; se dejó en ejecución.');
    }
  } catch (error) {
    if (preparado.iniciadoPorEstaLlamada) await detenerProcesoPostgres(preparado.hijo, true);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
