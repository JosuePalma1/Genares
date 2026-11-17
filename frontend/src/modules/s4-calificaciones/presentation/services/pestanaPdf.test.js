import { describe, expect, it, vi } from 'vitest';
import { abrirPdfEnPestanaNueva } from './pestanaPdf';

function pestanaFalsa() {
  return { opener: {}, document: { title: '', body: { textContent: '' } }, location: { replace: vi.fn() }, close: vi.fn() };
}

describe('abrir un PDF en una pestaña nueva', () => {
  it('abre la pestaña antes de pedir el PDF y luego lo muestra en el visor del navegador', async () => {
    const pestana = pestanaFalsa();
    const orden = [];
    const abrir = vi.fn(() => { orden.push('abrir'); return pestana; });
    const obtenerPdf = vi.fn(async () => { orden.push('pedir'); return new Blob(['%PDF-']); });
    await abrirPdfEnPestanaNueva(obtenerPdf, { abrir, crearUrl: () => 'blob:pdf', revocar: vi.fn(), liberarTras: 0 });
    expect(orden).toEqual(['abrir', 'pedir']);
    expect(abrir).toHaveBeenCalledWith('', '_blank');
    expect(pestana.opener).toBeNull();
    expect(pestana.location.replace).toHaveBeenCalledWith('blob:pdf');
    expect(pestana.close).not.toHaveBeenCalled();
  });

  it('cierra la pestaña y devuelve el error si el PDF falla', async () => {
    const pestana = pestanaFalsa();
    const fallo = Object.assign(new Error('sin rúbrica'), { status: 409 });
    await expect(abrirPdfEnPestanaNueva(() => Promise.reject(fallo), { abrir: () => pestana })).rejects.toBe(fallo);
    expect(pestana.close).toHaveBeenCalled();
    expect(pestana.location.replace).not.toHaveBeenCalled();
  });

  it('avisa si el navegador bloquea la pestaña y no pide el PDF', async () => {
    const obtenerPdf = vi.fn();
    await expect(abrirPdfEnPestanaNueva(obtenerPdf, { abrir: () => null })).rejects.toThrow('bloqueó la pestaña nueva');
    expect(obtenerPdf).not.toHaveBeenCalled();
  });
});
