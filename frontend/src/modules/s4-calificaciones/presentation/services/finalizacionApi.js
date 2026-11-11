import { API_BASE_URL } from '../../infrastructure/config/rubricas';
import { FUENTE_EVALUACIONES } from '../../infrastructure/config/evaluaciones';
import { ErrorRespuestaApi, crearClienteHttp } from './clienteHttp';

// SE-03 · Finalización del trabajo. El servidor calcula las condiciones y decide.
const RUTA = '/finalizacion-trabajos';

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esListaTextos = (valor) => Array.isArray(valor) && valor.every((texto) => typeof texto === 'string');

function validarFinalizacion(elemento) {
  if (!esObjeto(elemento) || !esObjeto(elemento.trabajo)
    || typeof elemento.trabajo.id !== 'string' || typeof elemento.trabajo.estado !== 'string'
    || typeof elemento.finalizado !== 'boolean' || typeof elemento.puedeFinalizar !== 'boolean'
    || !esListaTextos(elemento.pendientesTrabajo)
    || !Array.isArray(elemento.estudiantes)
    || !elemento.estudiantes.every((estudiante) => esObjeto(estudiante)
      && typeof estudiante.idEstudiante === 'string' && typeof estudiante.nombre === 'string'
      && typeof estudiante.cumplida === 'boolean' && esListaTextos(estudiante.pendientes))) {
    throw new ErrorRespuestaApi();
  }
  return elemento;
}

export function crearServicioFinalizacionApi(cliente) {
  return {
    async listar(opciones) {
      const respuesta = await cliente.getJson(RUTA, opciones);
      if (!esObjeto(respuesta) || !Array.isArray(respuesta.elementos) || typeof respuesta.puedeFinalizar !== 'boolean') {
        throw new ErrorRespuestaApi();
      }
      return { elementos: respuesta.elementos.map(validarFinalizacion), puedeFinalizar: respuesta.puedeFinalizar };
    },
    async finalizar(trabajoId, opciones) {
      return validarFinalizacion(await cliente.postJson(`${RUTA}/${encodeURIComponent(trabajoId)}`, {}, opciones));
    },
  };
}

const cliente = crearClienteHttp({
  baseUrl: API_BASE_URL,
  habilitado: FUENTE_EVALUACIONES === 'api',
  escriturasHabilitadas: true,
});

const servicio = crearServicioFinalizacionApi(cliente);
export const listarFinalizacionTrabajosApi = (...argumentos) => servicio.listar(...argumentos);
export const finalizarTrabajoApi = (...argumentos) => servicio.finalizar(...argumentos);
