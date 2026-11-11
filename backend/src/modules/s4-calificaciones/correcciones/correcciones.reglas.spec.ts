import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenJustificativos, raizAlmacenamiento } from './almacen-justificativos';
import {
  bloqueosCorreccion, JUSTIFICATIVO_MAXIMO_BYTES, prepararCorreccion, PuntajeActual, validarJustificativo, validarMotivo,
} from './correcciones.reglas';

const actuales: PuntajeActual[] = [
  { idIndicador: 'i1', score: '0.33', observation: null, calificacionMaxima: '0.33' },
  { idIndicador: 'i2', score: '0.20', observation: 'Original', calificacionMaxima: '0.34' },
];
const pdf = Buffer.from('%PDF-1.7\n%prueba\n');

describe('reglas de corrección extraordinaria (RF-36)', () => {
  it('exige un motivo de 10 a 2000 caracteres', () => {
    expect(() => validarMotivo('corto')).toThrow();
    expect(() => validarMotivo('x'.repeat(2001))).toThrow();
    expect(validarMotivo('  Error de transcripción en el acta.  ')).toBe('Error de transcripción en el acta.');
  });

  it('acepta una corrección completa dentro de los máximos congelados en la evaluación', () => {
    const corregidos = prepararCorreccion(actuales, [
      { idIndicador: 'i1', score: 0.33 }, { idIndicador: 'i2', score: 0.34, observation: 'Corregido' },
    ]);
    expect(corregidos).toEqual([
      { idIndicador: 'i1', score: '0.33', observation: null },
      { idIndicador: 'i2', score: '0.34', observation: 'Corregido' },
    ]);
  });

  it('rechaza superar el máximo, omitir indicadores o no cambiar nada', () => {
    expect(() => prepararCorreccion(actuales, [{ idIndicador: 'i1', score: 0.33 }, { idIndicador: 'i2', score: 0.5 }])).toThrow(/entre 0 y 0.34/);
    expect(() => prepararCorreccion(actuales, [{ idIndicador: 'i1', score: 0.3 }])).toThrow(/todos los indicadores/);
    expect(() => prepararCorreccion(actuales, [{ idIndicador: 'i1', score: 0.33 }, { idIndicador: 'i2', score: 0.2, observation: 'Original' }]))
      .toThrow(/no modifica/);
  });

  it('no permite corregir borradores, trabajos finalizados ni evaluaciones con acta archivada', () => {
    const base = { estadoEvaluacion: 'CERRADA', estadoRegistro: 1, estadoProceso: 'REGISTRADO', actasArchivadas: 0 };
    expect(bloqueosCorreccion(base)).toEqual([]);
    expect(bloqueosCorreccion({ ...base, estadoEvaluacion: 'BORRADOR' })[0]).toMatch(/Solo se corrigen evaluaciones cerradas/);
    expect(bloqueosCorreccion({ ...base, estadoProceso: 'FINALIZADO' })[0]).toMatch(/finalizado/);
    expect(bloqueosCorreccion({ ...base, actasArchivadas: 1 })[0]).toMatch(/acta archivada/);
  });

  it('exige un PDF justificativo real de hasta 5 MB', () => {
    expect(() => validarJustificativo(undefined)).toThrow(/obligatorio/);
    expect(() => validarJustificativo({ buffer: Buffer.from('hola'), mimetype: 'application/pdf' })).toThrow(/PDF/);
    expect(() => validarJustificativo({ buffer: pdf, mimetype: 'image/png' })).toThrow(/PDF/);
    expect(() => validarJustificativo({ buffer: Buffer.alloc(JUSTIFICATIVO_MAXIMO_BYTES + 1), mimetype: 'application/pdf' })).toThrow(/5 MB/);
    expect(validarJustificativo({ buffer: pdf, mimetype: 'application/pdf' })).toBe(pdf);
  });
});

describe('almacén de justificativos', () => {
  it('guarda en storage/auditoria/justificativos con nombre generado y verifica el hash al leer', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'genares-storage-'));
    const almacen = new AlmacenJustificativos(raiz);
    const guardado = await almacen.guardar(pdf);
    expect(guardado.ruta).toMatch(/^auditoria\/justificativos\/[0-9a-f-]{36}\.pdf$/);
    expect(guardado.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(almacen.leer(guardado.ruta, guardado.sha256)).resolves.toEqual(pdf);

    // Un archivo alterado en disco se detecta.
    const absoluta = join(raiz, ...guardado.ruta.split('/'));
    writeFileSync(absoluta, Buffer.concat([readFileSync(absoluta), Buffer.from('x')]));
    await expect(almacen.leer(guardado.ruta, guardado.sha256)).rejects.toThrow(/hash/);
  });

  it('rechaza rutas fuera de la carpeta de justificativos', async () => {
    const almacen = new AlmacenJustificativos(mkdtempSync(join(tmpdir(), 'genares-storage-')));
    await expect(almacen.leer('../../etc/passwd', 'x')).rejects.toThrow(/no válida/);
  });

  it('usa la carpeta storage de la raíz del repositorio o GENARES_STORAGE_DIR', () => {
    expect(raizAlmacenamiento({}, join('repo', 'backend'))).toBe(join(process.cwd(), 'repo', 'storage'));
    expect(raizAlmacenamiento({ GENARES_STORAGE_DIR: join('x', 'datos') }, 'cualquiera')).toBe(join(process.cwd(), 'x', 'datos'));
  });
});
