import { esPlataformaNativa } from '../../infrastructure/dispositivo/respaldoNativo';
import { abrirPdfEnDispositivo } from '../../infrastructure/dispositivo/pdfNativo';

/**
 * Abre un PDF en una pestaña nueva, en el visor del propio navegador (que ya trae descargar e imprimir).
 *
 * La pestaña se abre en el mismo clic, antes de pedir el PDF: si se abriera después de esperar al
 * servidor, el navegador la bloquearía como ventana emergente. Si el PDF falla, la pestaña se cierra
 * y el error vuelve a quien llamó para mostrarlo en la pantalla de origen.
 *
 * En la APK no hay pestañas ni visor: el PDF se guarda en el teléfono y se abre con su aplicación de PDF.
 */
export async function abrirPdfEnPestanaNueva(obtenerPdf, {
  nativo = esPlataformaNativa(),
  abrirEnDispositivo = abrirPdfEnDispositivo,
  abrir = (url, destino) => window.open(url, destino),
  crearUrl = (blob) => URL.createObjectURL(blob),
  revocar = (url) => URL.revokeObjectURL(url),
  // El visor ya cargó el PDF mucho antes; se libera la memoria pasado un rato.
  liberarTras = 5 * 60_000,
} = {}) {
  if (nativo) {
    const pdf = await obtenerPdf();
    // Los servicios devuelven un File con el nombre que propone el servidor (el del estudiante).
    await abrirEnDispositivo(pdf, pdf?.name || 'documento.pdf');
    return;
  }
  const pestana = abrir('', '_blank');
  if (!pestana) {
    throw new Error('El navegador bloqueó la pestaña nueva. Permita las ventanas emergentes de este sitio e inténtelo de nuevo.');
  }
  try {
    pestana.opener = null;
    pestana.document.title = 'Generando PDF…';
    pestana.document.body.textContent = 'Generando el PDF…';
  } catch { /* Solo es un aviso mientras carga; no impide abrir el PDF. */ }
  try {
    const url = crearUrl(await obtenerPdf());
    pestana.location.replace(url);
    setTimeout(() => revocar(url), liberarTras);
  } catch (error) {
    pestana.close();
    throw error;
  }
}
