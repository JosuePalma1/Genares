import { crearClienteHttp, ErrorRespuestaApi } from './clienteHttp';
import { FUENTE_TRABAJOS } from '../../infrastructure/config/trabajos';

const entero = (valor) => Number.isInteger(valor) && valor >= 0;
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const conteos = (lista, clave) => Array.isArray(lista)
  && lista.every((elemento) => esObjeto(elemento) && entero(elemento.cantidad) && (elemento[clave] === null || typeof elemento[clave] === 'string'));

/** Valida el resumen del periodo calculado en el servidor (conteos y resultados completos). */
export function adaptarResumenSeguimientoApi(respuesta) {
  const resultados = respuesta?.resultados;
  if (!esObjeto(respuesta) || typeof respuesta.periodo !== 'string' || !Array.isArray(respuesta.periodos)
    || !respuesta.periodos.every((p) => esObjeto(p) && typeof p.codigo === 'string' && typeof p.activo === 'boolean')
    || !esObjeto(respuesta.trabajos) || !entero(respuesta.trabajos.total)
    || !conteos(respuesta.trabajos.porCarrera, 'codigo') || !conteos(respuesta.trabajos.porEstado, 'estado')
    || !entero(respuesta.programaciones) || !entero(respuesta.actas)
    || !esObjeto(resultados) || !['listo', 'parcial'].includes(resultados.estado)
    || !entero(resultados.completos) || !entero(resultados.trabajosConsultados) || !entero(resultados.trabajosConError)) {
    throw new ErrorRespuestaApi();
  }
  return respuesta;
}

export function crearServicioSeguimientoApi({ getJson, habilitado = true } = {}) {
  return {
    async resumen(periodo, { signal } = {}) {
      if (!habilitado || typeof getJson !== 'function') throw new ErrorRespuestaApi();
      const consulta = periodo ? `?${new URLSearchParams({ periodo })}` : '';
      return adaptarResumenSeguimientoApi(await getJson(`/seguimiento/resumen${consulta}`, { signal }));
    },
  };
}

const cliente = crearClienteHttp({ habilitado: true });
const servicio = crearServicioSeguimientoApi({ habilitado: FUENTE_TRABAJOS === 'api', getJson: cliente.getJson });
export const obtenerResumenSeguimientoApi = (...argumentos) => servicio.resumen(...argumentos);
