import { ErrorRespuestaApi, crearClienteHttp } from './clienteHttp';
import { FUENTE_EVALUACIONES } from '../../infrastructure/config/evaluaciones';
import { esUuidPostgres } from '../../infrastructure/repositories/uuidPostgres';

const RUTA = '/auditoria/cambios';
const cliente = crearClienteHttp({ habilitado: FUENTE_EVALUACIONES === 'api' });

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function validarRespuesta(respuesta) {
  if (!esObjeto(respuesta) || !Array.isArray(respuesta.elementos)
    || !Number.isInteger(respuesta.limite) || respuesta.limite < 1 || respuesta.limite > 100
    || !(respuesta.siguienteCursor === null
      || (typeof respuesta.siguienteCursor === 'string' && /^[A-Za-z0-9_-]+$/.test(respuesta.siguienteCursor)))
    || !respuesta.elementos.every((evento) => esObjeto(evento)
      && esUuidPostgres(evento.id)
      && typeof evento.ocurridoEn === 'string'
      && typeof evento.actorId === 'string'
      && typeof evento.rolBase === 'string'
      && typeof evento.tabla === 'string'
      && esObjeto(evento.claveRegistro)
      && ['INSERT', 'UPDATE'].includes(evento.operacion)
      && (evento.antes === null || esObjeto(evento.antes))
      && esObjeto(evento.despues))) {
    throw new ErrorRespuestaApi();
  }
  return respuesta;
}

export function crearQueryAuditoria({ tabla = '', registro = '', limite = 50, cursor } = {}) {
  const parametros = new URLSearchParams();
  if (typeof tabla === 'string' && tabla.trim()) parametros.set('tabla', tabla.trim());
  if (typeof registro === 'string' && registro.trim()) parametros.set('registro', registro.trim());
  parametros.set('limite', String(limite));
  if (typeof cursor === 'string' && cursor) parametros.set('cursor', cursor);
  return `${RUTA}?${parametros.toString()}`;
}

export function crearServicioAuditoriaApi({ getJson = cliente.getJson, habilitado = FUENTE_EVALUACIONES === 'api' } = {}) {
  return {
    async listar(filtros = {}, { signal } = {}) {
      if (!habilitado || typeof getJson !== 'function') throw new ErrorRespuestaApi();
      return validarRespuesta(await getJson(crearQueryAuditoria(filtros), { signal }));
    },
  };
}

const servicio = crearServicioAuditoriaApi();
export const listarCambiosAuditoriaApi = (...argumentos) => servicio.listar(...argumentos);
