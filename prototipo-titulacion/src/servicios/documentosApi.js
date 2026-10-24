import { crearClienteHttp, ErrorApiHttp } from './clienteHttp';
import { API_BASE_URL } from '../configuracion/rubricas';
import { ESCRITURA_EVALUACIONES_API_HABILITADA, FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';

export const DOCUMENTOS_API_HABILITADA = import.meta.env.DEV === true && FUENTE_EVALUACIONES === 'api';
export const ESCRITURA_DOCUMENTOS_API_HABILITADA = DOCUMENTOS_API_HABILITADA && ESCRITURA_EVALUACIONES_API_HABILITADA;
const cliente = crearClienteHttp({
  habilitado: DOCUMENTOS_API_HABILITADA,
  escriturasHabilitadas: ESCRITURA_DOCUMENTOS_API_HABILITADA,
});
export const consultarDocumentos = (ruta, signal) => cliente.getJson(`/documentos${ruta}`, { signal });
export const guardarDocumento = (ruta, body) => cliente.postJson(`/documentos${ruta}`, body);
export const actualizarConfiguracionDocumental = (ruta, body) => cliente.putJson(`/documentos${ruta}`, body);
export async function obtenerPdfDocumento(ruta, signal) {
  if (!DOCUMENTOS_API_HABILITADA) throw new Error('Active la consulta API de evaluaciones para utilizar documentos.');
  const respuesta = await fetch(`${API_BASE_URL}/documentos${ruta}`, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/pdf' },
  });
  if (!respuesta.ok) throw new ErrorApiHttp(respuesta.status);
  if (!respuesta.headers.get('content-type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un documento PDF.');
  return respuesta.blob();
}
