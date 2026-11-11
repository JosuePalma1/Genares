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

const entero = (valor, minimo) => Number.isInteger(valor) && valor >= minimo;
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

function validarPaginacion(paginacion) {
  if (!esObjeto(paginacion)) throw new ErrorRespuestaApi();
  const { pagina, limite, total, paginas } = paginacion;
  if (!entero(pagina, 1) || !entero(limite, 1) || !entero(total, 0) || !entero(paginas, 1)) throw new ErrorRespuestaApi();
  return { pagina, limite, total, paginas };
}

/** Ruta de una página de actas; omite filtros vacíos. */
export function rutaPaginaActas({ pagina = 1, limite = 25, estudiante, carrera, periodo } = {}) {
  const parametros = new URLSearchParams({ limite: String(limite), pagina: String(pagina) });
  for (const [clave, valor] of Object.entries({ estudiante, carrera, periodo })) {
    if (typeof valor === 'string' && valor.trim()) parametros.set(clave, valor.trim());
  }
  return `/actas?${parametros}`;
}

/** Una página de actas archivadas; si la pedida ya no existe se devuelve la última. */
export async function listarPaginaActasApi(filtros = {}, { signal, getJson = cliente.getJson } = {}) {
  const pedir = async (consulta) => {
    const respuesta = await getJson(`/documentos${rutaPaginaActas(consulta)}`, { signal });
    if (!esObjeto(respuesta) || !Array.isArray(respuesta.elementos) || !respuesta.elementos.every(esEstadoRegistroValido)) {
      throw new ErrorRespuestaApi();
    }
    return { elementos: respuesta.elementos.filter(esRegistroVisible), paginacion: validarPaginacion(respuesta.paginacion) };
  };
  const resultado = await pedir(filtros);
  const { pagina, paginas, total } = resultado.paginacion;
  return total > 0 && pagina > paginas ? pedir({ ...filtros, pagina: paginas }) : resultado;
}

/** Trabajos para el selector de Documentos, filtrados por periodo (`ACTIVO`, `TODOS` o un código). */
export async function listarTrabajosDocumentosApi(periodo = 'ACTIVO', { signal, getJson = cliente.getJson } = {}) {
  const respuesta = await getJson(`/documentos/trabajos?${new URLSearchParams({ periodo })}`, { signal });
  if (!esObjeto(respuesta) || !Array.isArray(respuesta.elementos) || typeof respuesta.periodo !== 'string'
    || !Array.isArray(respuesta.periodos)
    || !respuesta.periodos.every((p) => esObjeto(p) && typeof p.codigo === 'string' && typeof p.activo === 'boolean')) {
    throw new ErrorRespuestaApi();
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
