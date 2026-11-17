import { describe, expect, it, vi } from 'vitest';
import { abrirPdfEnDispositivo, nombreArchivoSeguro, nombreDeDisposition } from './pdfNativo';

describe('PDF en la APK', () => {
  it('lee el nombre con tildes del Content-Disposition y usa el simple si no hay otro', () => {
    expect(nombreDeDisposition(`inline; filename="Rubrica - Lainez Tomala.pdf"; filename*=UTF-8''R%C3%BAbrica%20-%20La%C3%ADnez%20Tomal%C3%A1.pdf`))
      .toBe('Rúbrica - Laínez Tomalá.pdf');
    expect(nombreDeDisposition('inline; filename="rubrica-vista-previa.pdf"')).toBe('rubrica-vista-previa.pdf');
    expect(nombreDeDisposition(null, 'justificativo.pdf')).toBe('justificativo.pdf');
  });

  it('limpia el nombre y asegura la extensión .pdf', () => {
    expect(nombreArchivoSeguro('Acta 1/2026: Peña')).toBe('Acta 1 2026 Peña.pdf');
    expect(nombreArchivoSeguro('Rúbrica.PDF')).toBe('Rúbrica.PDF');
    expect(nombreArchivoSeguro('')).toBe('documento.pdf');
  });

  it('guarda el PDF en la caché de la app y lo abre con el lector del teléfono', async () => {
    const sistemaArchivos = { writeFile: vi.fn(async () => ({ uri: 'file:///data/cache/pdf/Rúbrica.pdf' })) };
    const visor = { openDocumentFromLocalPath: vi.fn(async () => {}) };
    await abrirPdfEnDispositivo(new Blob(['%PDF-']), 'Rúbrica.pdf', { sistemaArchivos, visor, aBase64: async () => 'JVBERi0=' });
    expect(sistemaArchivos.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: 'pdf/Rúbrica.pdf', data: 'JVBERi0=', directory: 'CACHE', recursive: true,
    }));
    expect(visor.openDocumentFromLocalPath).toHaveBeenCalledWith({ path: 'file:///data/cache/pdf/Rúbrica.pdf' });
  });

  it('explica si el teléfono no tiene aplicación para abrir PDF', async () => {
    const sistemaArchivos = { writeFile: async () => ({ uri: 'file:///x.pdf' }) };
    const visor = { openDocumentFromLocalPath: async () => { throw Object.assign(new Error('no app'), { code: 'OS-PLUG-FLVW-0010' }); } };
    await expect(abrirPdfEnDispositivo(new Blob(['%PDF-']), 'x.pdf', { sistemaArchivos, visor, aBase64: async () => '' }))
      .rejects.toThrow('No hay ninguna aplicación para abrir PDF');
  });
});
