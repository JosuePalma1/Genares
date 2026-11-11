import { crearClienteHttp, ErrorApiHttp, ErrorRespuestaApi } from './clienteHttp';
import { API_BASE_URL } from '../../infrastructure/config/rubricas';
import { FUENTE_EVALUACIONES } from '../../infrastructure/config/evaluaciones';
import { esEstadoRegistroValido, esRegistroVisible } from '../../domain/estadoRegistro';

export const DOCUMENTOS_API_HABILITADA = FUENTE_EVALUACIONES === 'api';
const cliente = crearClienteHttp({
  habilitado: DOCUMENTOS_API_HABILITADA,
  escriturasHabilitadas: true,
});
export async function consultarDocumentos(ruta, signal) {
  const respuesta = await cliente.getJson(`/documentos${ruta}`, { signal });
  if (ruta.split('?')[0] === '/actas') {
    if (!Array.isArray(respuesta) || !respuesta.every(esEstadoRegistroValido)) throw new ErrorRespuestaApi();
    return respuesta.filter(esRegistroVisible);
  }
  return respuesta;
}
export const guardarDocumento = (ruta, body) => cliente.postJson(`/documentos${ruta}`, body);
export const actualizarConfiguracionDocumental = (ruta, body) => cliente.putJson(`/documentos${ruta}`, body);
export async function obtenerPdfDocumento(ruta, signal) {
  if (!DOCUMENTOS_API_HABILITADA) throw new Error('La consulta de evaluaciones no está disponible actualmente.');
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
