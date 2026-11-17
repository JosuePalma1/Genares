// PDF en la APK del tribunal. El WebView de Android no trae visor de PDF ni abre pestañas: el PDF
// se guarda en la caché de la app y se abre con la aplicación de PDF del teléfono, que ya permite
// guardarlo, compartirlo o imprimirlo. En el navegador no se usa.
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';

const SIN_APLICACION = 'OS-PLUG-FLVW-0010';

/** Nombre del archivo que propone el servidor (Content-Disposition), con tildes y ñ. */
export function nombreDeDisposition(cabecera, porDefecto = 'documento.pdf') {
  if (!cabecera) return porDefecto;
  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera);
  if (extendido) {
    try { return decodeURIComponent(extendido[1].trim()); } catch { /* se usa el nombre simple */ }
  }
  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(cabecera);
  return (simple?.[1] ?? simple?.[2] ?? '').trim() || porDefecto;
}

/** Quita lo que no admite un nombre de archivo y asegura la extensión .pdf. */
export function nombreArchivoSeguro(nombre) {
  const limpio = String(nombre ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'documento';
  return /\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`;
}

function blobABase64(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).slice(String(lector.result).indexOf(',') + 1));
    lector.onerror = () => rechazar(lector.error ?? new Error('No se pudo leer el PDF.'));
    lector.readAsDataURL(blob);
  });
}

/** Guarda el PDF en la caché de la app (se sustituye si ya existía) y lo abre con el lector del teléfono. */
export async function abrirPdfEnDispositivo(pdf, nombre, {
  sistemaArchivos = Filesystem, visor = FileViewer, aBase64 = blobABase64,
} = {}) {
  const { uri } = await sistemaArchivos.writeFile({
    path: `pdf/${nombreArchivoSeguro(nombre)}`,
    data: await aBase64(pdf),
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await visor.openDocumentFromLocalPath({ path: uri });
  } catch (error) {
    if (error?.code === SIN_APLICACION) {
      throw new Error('No hay ninguna aplicación para abrir PDF en este dispositivo. Instale un lector de PDF e inténtelo de nuevo.');
    }
    throw new Error('No se pudo abrir el PDF en este dispositivo.');
  }
}
