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

const entero = (valor, minimo) => Number.isInteger(valor) && valor >= minimo;

/** Ruta de la página pedida; omite los filtros vacíos. */
export function rutaPaginaFinalizacion({ pagina = 1, limite = 10, periodo, buscar, situacion } = {}) {
  const parametros = new URLSearchParams({ limite: String(limite), pagina: String(pagina) });
  if (periodo) parametros.set('periodo', periodo);
  if (buscar?.trim()) parametros.set('buscar', buscar.trim());
  if (situacion) parametros.set('situacion', situacion);
  return `${RUTA}?${parametros}`;
}

function validarPagina(respuesta) {
  if (!esObjeto(respuesta) || !Array.isArray(respuesta.elementos) || typeof respuesta.puedeFinalizar !== 'boolean'
    || !esObjeto(respuesta.paginacion) || !esObjeto(respuesta.filtros)) throw new ErrorRespuestaApi();
  const { pagina, limite, total, paginas } = respuesta.paginacion;
  const { periodo, periodos } = respuesta.filtros;
  if (!entero(pagina, 1) || !entero(limite, 1) || !entero(total, 0) || !entero(paginas, 1)
    || typeof periodo !== 'string' || !Array.isArray(periodos)
    || !periodos.every((p) => esObjeto(p) && typeof p.codigo === 'string' && typeof p.activo === 'boolean')) {
    throw new ErrorRespuestaApi();
  }
  return {
    elementos: respuesta.elementos.map(validarFinalizacion),
    puedeFinalizar: respuesta.puedeFinalizar,
    paginacion: { pagina, limite, total, paginas },
    filtros: { periodo, periodos: periodos.map(({ codigo, nombre, activo }) => ({ codigo, nombre: nombre ?? null, activo })) },
  };
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
    /** Una página filtrada; si la pedida ya no existe se devuelve la última. */
    async listarPagina(filtros = {}, opciones) {
      const resultado = validarPagina(await cliente.getJson(rutaPaginaFinalizacion(filtros), opciones));
      const { pagina, paginas, total } = resultado.paginacion;
      if (total > 0 && pagina > paginas) {
        return validarPagina(await cliente.getJson(rutaPaginaFinalizacion({ ...filtros, pagina: paginas }), opciones));
      }
      return resultado;
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
export const listarPaginaFinalizacionApi = (...argumentos) => servicio.listarPagina(...argumentos);
export const finalizarTrabajoApi = (...argumentos) => servicio.finalizar(...argumentos);
