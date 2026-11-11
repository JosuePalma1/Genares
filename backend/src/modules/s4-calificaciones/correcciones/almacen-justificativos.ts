import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

/** Carpeta relativa fijada por RF-36 y el Paso 4. */
export const CARPETA_JUSTIFICATIVOS = 'auditoria/justificativos';
const RUTA_VALIDA = /^auditoria\/justificativos\/[0-9a-f-]{36}\.pdf$/;

/**
 * Raíz de `storage/`. Por defecto, la carpeta `storage` de la raíz del repositorio
 * (el backend se ejecuta desde `backend/`). Puede fijarse con GENARES_STORAGE_DIR.
 */
export function raizAlmacenamiento(entorno: NodeJS.ProcessEnv = process.env, directorio = process.cwd()): string {
  if (entorno.GENARES_STORAGE_DIR?.trim()) return resolve(entorno.GENARES_STORAGE_DIR.trim());
  return resolve(directorio, basename(directorio) === 'backend' ? '..' : '.', 'storage');
}

export const sha256 = (contenido: Buffer) => createHash('sha256').update(contenido).digest('hex');

export interface JustificativoGuardado { ruta: string; sha256: string; bytes: number }

export class AlmacenJustificativos {
  constructor(private readonly raiz = raizAlmacenamiento()) {}

  private absoluta(ruta: string): string {
    if (!RUTA_VALIDA.test(ruta)) throw new Error('Ruta de justificativo no válida.');
    const destino = resolve(this.raiz, ...ruta.split('/'));
    if (!destino.startsWith(resolve(this.raiz) + sep)) throw new Error('Ruta de justificativo fuera del almacenamiento.');
    return destino;
  }

  /** Guarda el PDF con un nombre generado; nunca usa el nombre original del archivo. */
  async guardar(contenido: Buffer): Promise<JustificativoGuardado> {
    const ruta = `${CARPETA_JUSTIFICATIVOS}/${randomUUID()}.pdf`;
    const destino = this.absoluta(ruta);
    await mkdir(join(destino, '..'), { recursive: true });
    await writeFile(destino, contenido, { flag: 'wx' });
    return { ruta, sha256: sha256(contenido), bytes: contenido.length };
  }

  /** Lee el PDF y comprueba que no fue alterado desde que se registró. */
  async leer(ruta: string, hashEsperado: string): Promise<Buffer> {
    const contenido = await readFile(this.absoluta(ruta));
    if (sha256(contenido) !== hashEsperado) throw new Error('El PDF justificativo no coincide con su hash registrado.');
    return contenido;
  }

  /** Solo para deshacer un archivo recién escrito cuya solicitud no llegó a registrarse. */
  async descartar(ruta: string): Promise<void> {
    await unlink(this.absoluta(ruta)).catch(() => undefined);
  }
}
