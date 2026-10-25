import { API_BASE_URL } from '../configuracion/rubricas';
import {
  FUENTE_PROGRAMACIONES,
} from '../configuracion/programaciones';
import { ErrorRespuestaApi, crearClienteHttp } from './clienteHttp';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS = new Set(['PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA', 'COMPLETADA', 'CANCELADA']);
const RUTA = '/programaciones-sustentacion';

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function exigir(condicion) {
  if (!condicion) throw new ErrorRespuestaApi();
}

function validarPersona(persona) {
  exigir(esObjeto(persona)
    && UUID_V4.test(persona.id ?? '')
    && typeof persona.nombres === 'string'
    && typeof persona.apellidos === 'string');
  return persona;
}

function validarListas(carrera, periodo) {
  exigir(esObjeto(carrera) && UUID_V4.test(carrera.id ?? '')
    && typeof carrera.codigo === 'string' && typeof carrera.nombre === 'string');
  exigir(esObjeto(periodo) && UUID_V4.test(periodo.id ?? '') && typeof periodo.codigo === 'string');
}

export function adaptarProgramacionApi(valor) {
  exigir(esObjeto(valor)
    && UUID_V4.test(valor.id ?? '')
    && UUID_V4.test(valor.idTrabajo ?? '')
    && /^\d{4}-\d{2}-\d{2}$/.test(valor.fechaProgramada ?? '')
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor.horaProgramada ?? '')
    && typeof valor.sala === 'string' && valor.sala.trim().length > 0
    && ESTADOS.has(valor.estado)
    && esObjeto(valor.trabajo) && valor.trabajo.id === valor.idTrabajo
    && typeof valor.trabajo.codigo === 'string' && typeof valor.trabajo.titulo === 'string'
    && Array.isArray(valor.estudiantes) && Array.isArray(valor.tribunal));
  validarListas(valor.carrera, valor.periodo);
  valor.estudiantes.forEach(validarPersona);
  valor.tribunal.forEach((miembro) => {
    validarPersona(miembro);
    exigir(Number.isInteger(miembro.posicion) && miembro.posicion >= 1 && miembro.posicion <= 2);
  });
  const duracionEstimadaMinutos = valor.duracionEstimadaMinutos ?? 60;
  exigir(Number.isInteger(duracionEstimadaMinutos) && duracionEstimadaMinutos >= 1 && duracionEstimadaMinutos <= 240);
  exigir(valor.inicioRealEn == null || typeof valor.inicioRealEn === 'string');
  exigir(valor.finalizacionRealEn == null || typeof valor.finalizacionRealEn === 'string');
  return {
    ...valor,
    estado: valor.estado === 'COMPLETADA' ? 'FINALIZADA' : valor.estado,
    duracionEstimadaMinutos,
    inicioRealEn: valor.inicioRealEn ?? null,
    finalizacionRealEn: valor.finalizacionRealEn ?? null,
  };
}

function adaptarTrabajoDisponible(valor) {
  exigir(esObjeto(valor)
    && UUID_V4.test(valor.idTrabajo ?? '')
    && esObjeto(valor.trabajo) && valor.trabajo.id === valor.idTrabajo
    && typeof valor.trabajo.codigo === 'string' && typeof valor.trabajo.titulo === 'string'
    && Array.isArray(valor.estudiantes) && Array.isArray(valor.tribunal));
  validarListas(valor.carrera, valor.periodo);
  valor.estudiantes.forEach(validarPersona);
  valor.tribunal.forEach((miembro) => {
    validarPersona(miembro);
    exigir(Number.isInteger(miembro.posicion) && miembro.posicion >= 1 && miembro.posicion <= 2);
  });
  return valor;
}

function adaptarCatalogos(valor) {
  exigir(esObjeto(valor) && Array.isArray(valor.carreras) && Array.isArray(valor.periodos));
  valor.carreras.forEach((carrera) => exigir(esObjeto(carrera)
    && UUID_V4.test(carrera.id ?? '') && typeof carrera.codigo === 'string' && typeof carrera.nombre === 'string'));
  valor.periodos.forEach((periodo) => exigir(esObjeto(periodo)
    && UUID_V4.test(periodo.id ?? '') && typeof periodo.codigo === 'string'));
  return valor;
}

export function adaptarListadoProgramacionesApi(respuesta) {
  exigir(esObjeto(respuesta) && Array.isArray(respuesta.elementos));
  const filtros = adaptarCatalogos(respuesta.filtros);
  return { elementos: respuesta.elementos.map(adaptarProgramacionApi), filtros };
}

export function adaptarTrabajosDisponiblesApi(respuesta) {
  exigir(esObjeto(respuesta) && Array.isArray(respuesta.elementos));
  const filtros = adaptarCatalogos(respuesta.filtros);
  return { elementos: respuesta.elementos.map(adaptarTrabajoDisponible), filtros };
}

export function adaptarCapacidadesProgramacionesApi(respuesta) {
  exigir(esObjeto(respuesta) && typeof respuesta.puedeAdministrar === 'boolean');
  return respuesta;
}

export function mapearCrearProgramacion(datos) {
  exigir(esObjeto(datos)
    && UUID_V4.test(datos.idTrabajo ?? '')
    && typeof datos.fechaProgramada === 'string'
    && typeof datos.horaProgramada === 'string'
    && typeof datos.sala === 'string'
    && (datos.duracionEstimadaMinutos === undefined
      || (Number.isInteger(datos.duracionEstimadaMinutos)
        && datos.duracionEstimadaMinutos >= 1 && datos.duracionEstimadaMinutos <= 240)));
  return {
    idTrabajo: datos.idTrabajo,
    fechaProgramada: datos.fechaProgramada,
    horaProgramada: datos.horaProgramada,
    sala: datos.sala.trim(),
    ...(datos.duracionEstimadaMinutos === undefined ? {} : { duracionEstimadaMinutos: datos.duracionEstimadaMinutos }),
  };
}

export function mapearActualizacionProgramacion(datos) {
  exigir(esObjeto(datos)
    && UUID_V4.test(datos.id ?? '')
    && typeof datos.fechaProgramada === 'string'
    && typeof datos.horaProgramada === 'string'
    && typeof datos.sala === 'string'
    && (datos.duracionEstimadaMinutos === undefined
      || (Number.isInteger(datos.duracionEstimadaMinutos)
        && datos.duracionEstimadaMinutos >= 1 && datos.duracionEstimadaMinutos <= 240)));
  return {
    id: datos.id,
    dto: {
      fechaProgramada: datos.fechaProgramada,
      horaProgramada: datos.horaProgramada,
      sala: datos.sala.trim(),
      ...(datos.duracionEstimadaMinutos === undefined ? {} : { duracionEstimadaMinutos: datos.duracionEstimadaMinutos }),
    },
  };
}

export function crearQueryProgramacion(filtros = {}) {
  const parametros = new URLSearchParams();
  for (const campo of ['carreraId', 'periodoId', 'estado', 'buscar']) {
    const valor = filtros[campo];
    if (typeof valor === 'string' && valor.trim()) parametros.set(campo, valor.trim());
  }
  const consulta = parametros.toString();
  return consulta ? `?${consulta}` : '';
}

export function crearServicioProgramacionesApi(cliente) {
  return {
    async capacidades(options) {
      return adaptarCapacidadesProgramacionesApi(await cliente.getJson(`${RUTA}/capacidades`, options));
    },
    async listar(filtros, options) {
      return adaptarListadoProgramacionesApi(await cliente.getJson(`${RUTA}${crearQueryProgramacion(filtros)}`, options));
    },
    async trabajosDisponibles(filtros, options) {
      return adaptarTrabajosDisponiblesApi(await cliente.getJson(`${RUTA}/trabajos-disponibles${crearQueryProgramacion(filtros)}`, options));
    },
    async obtener(id, options) {
      return adaptarProgramacionApi(await cliente.getJson(`${RUTA}/${encodeURIComponent(id)}`, options));
    },
    async impresion(filtros, options) {
      const respuesta = await cliente.getJson(`${RUTA}/impresion${crearQueryProgramacion(filtros)}`, options);
      exigir(esObjeto(respuesta) && typeof respuesta.generadoEn === 'string' && Array.isArray(respuesta.elementos));
      return { ...respuesta, elementos: respuesta.elementos.map(adaptarProgramacionApi), filtros: adaptarCatalogos(respuesta.filtros) };
    },
    async crear(datos, options) {
      return adaptarProgramacionApi(await cliente.postJson(RUTA, mapearCrearProgramacion(datos), options));
    },
    async actualizar(datos, options) {
      const { id, dto } = mapearActualizacionProgramacion(datos);
      return adaptarProgramacionApi(await cliente.putJson(`${RUTA}/${encodeURIComponent(id)}`, dto, options));
    },
    async cambiarEstado({ id, estado }, options) {
      exigir(UUID_V4.test(id ?? '') && ['EN_SUSTENTACION', 'FINALIZADA', 'CANCELADA'].includes(estado));
      return adaptarProgramacionApi(await cliente.patchJson(`${RUTA}/${encodeURIComponent(id)}/estado`, { estado }, options));
    },
  };
}

const cliente = crearClienteHttp({
  baseUrl: API_BASE_URL,
  habilitado: FUENTE_PROGRAMACIONES === 'api',
  escriturasHabilitadas: true,
});

const programacionesApi = crearServicioProgramacionesApi(cliente);
export const capacidadesProgramacionesApi = (...args) => programacionesApi.capacidades(...args);
export const listarProgramacionesApi = (...args) => programacionesApi.listar(...args);
export const listarTrabajosDisponiblesApi = (...args) => programacionesApi.trabajosDisponibles(...args);
export const obtenerProgramacionApi = (...args) => programacionesApi.obtener(...args);
export const obtenerImpresionProgramacionesApi = (...args) => programacionesApi.impresion(...args);
export const crearProgramacionApi = (...args) => programacionesApi.crear(...args);
export const actualizarProgramacionApi = (...args) => programacionesApi.actualizar(...args);
export const cambiarEstadoProgramacionApi = (...args) => programacionesApi.cambiarEstado(...args);
