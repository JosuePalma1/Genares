import { ErrorRespuestaApi } from '../../presentation/services/clienteHttp';
import { esUuidPostgres } from './uuidPostgres';
import { esEstadoRegistroValido, esRegistroVisible } from '../../domain/estadoRegistro';

const ESTADOS_TRABAJO = new Set([
  'REGISTRADO', 'TRIBUNAL_ASIGNADO', 'REVISION_ESCRITA_PENDIENTE', 'REVISION_ESCRITA_COMPLETADA',
  'SUSTENTACION_PROGRAMADA', 'SUSTENTACION_PENDIENTE', 'EVALUACION_COMPLETADA', 'FINALIZADO',
]);
const ESTADOS_VERSION = new Set(['BORRADOR', 'CONFIGURADA', 'ACTIVA', 'ARCHIVADA']);
const ESTADOS_TRIBUNAL = new Set(['BORRADOR', 'CONFIRMADO', 'REEMPLAZADO']);
const ESTADOS_SUSTENTACION = new Set(['PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA', 'CANCELADA']);

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function exigir(condicion) {
  if (!condicion) throw new ErrorRespuestaApi();
}

function esFechaOpcional(valor) {
  return valor === null || typeof valor === 'string';
}

export function adaptarTrabajoApi(trabajo) {
  if (!esEstadoRegistroValido(trabajo) || !esRegistroVisible(trabajo)) throw new ErrorRespuestaApi();
  if (!Array.isArray(trabajo?.sesiones)
    || trabajo.sesiones.some((sesion) => !esEstadoRegistroValido(sesion))) throw new ErrorRespuestaApi();
  if (!esEstadoRegistroValido(trabajo?.programacion)) throw new ErrorRespuestaApi();
  const visible = {
    ...trabajo,
    sesiones: trabajo.sesiones.filter(esRegistroVisible),
    programacion: trabajo.programacion && esRegistroVisible(trabajo.programacion) ? trabajo.programacion : null,
  };
  exigir(objeto(visible)
    && esUuidPostgres(visible.id)
    && typeof visible.codigo === 'string' && visible.codigo.length > 0
    && typeof visible.titulo === 'string' && visible.titulo.length > 0
    && ESTADOS_TRABAJO.has(visible.estado)
    && esUuidPostgres(visible.idCarrera) && typeof visible.codigoCarrera === 'string'
    && typeof visible.carrera === 'string'
    && esUuidPostgres(visible.idPeriodo) && typeof visible.periodo === 'string'
    && esUuidPostgres(visible.idModalidad) && typeof visible.codigoModalidad === 'string'
    && typeof visible.modalidad === 'string'
    && (visible.idVersionRubrica === null || esUuidPostgres(visible.idVersionRubrica))
    && (visible.versionRubrica === null || typeof visible.versionRubrica === 'string')
    && (visible.rubrica === null || typeof visible.rubrica === 'string')
    && (visible.estadoVersionRubrica === null || ESTADOS_VERSION.has(visible.estadoVersionRubrica))
    && Array.isArray(visible.estudiantes)
    && visible.estudiantes.every((estudiante) => objeto(estudiante)
      && esUuidPostgres(estudiante.id)
      && typeof estudiante.nombres === 'string' && typeof estudiante.apellidos === 'string'
      && Number.isInteger(estudiante.ordenAutoria) && estudiante.ordenAutoria > 0)
    && Array.isArray(visible.tutores)
    && visible.tutores.every((tutor) => objeto(tutor)
      && esUuidPostgres(tutor.idAsignacion) && esUuidPostgres(tutor.idDocente)
      && typeof tutor.nombres === 'string' && typeof tutor.apellidos === 'string'
      && (tutor.carrera === null || typeof tutor.carrera === 'string')
      && typeof tutor.asignadoEn === 'string' && esFechaOpcional(tutor.finalizadoEn))
    && (visible.estadoTribunal === null || ESTADOS_TRIBUNAL.has(visible.estadoTribunal))
    && esFechaOpcional(visible.tribunalConfirmadoEn)
    && Array.isArray(visible.miembrosTribunal)
    && visible.miembrosTribunal.every((miembro) => objeto(miembro)
      && esUuidPostgres(miembro.idMiembroTribunal) && Number.isInteger(miembro.posicion) && miembro.posicion > 0
      && typeof miembro.nombres === 'string' && typeof miembro.apellidos === 'string')
    && (visible.estadoTribunal === 'CONFIRMADO' || visible.miembrosTribunal.length === 0)
    && Number.isInteger(visible.escritasCerradas) && visible.escritasCerradas >= 0
    && visible.sesiones.every((sesion) => objeto(sesion)
      && esUuidPostgres(sesion.id)
      && typeof sesion.fecha === 'string' && typeof sesion.inicio === 'string' && typeof sesion.fin === 'string'
      && (sesion.sala === null || typeof sesion.sala === 'string')
      && Number.isInteger(sesion.duracionEstimadaMinutos)
      && typeof sesion.creadoEn === 'string' && typeof sesion.actualizadoEn === 'string'
      && esFechaOpcional(sesion.inicioRealEn) && esFechaOpcional(sesion.finalizacionRealEn)
      && Array.isArray(sesion.participantes) && sesion.participantes.every(esUuidPostgres)
      && (sesion.tipo === null || typeof sesion.tipo === 'string')
      && (sesion.estado === null || ESTADOS_SUSTENTACION.has(sesion.estado))
      && Number.isInteger(sesion.cantidadParticipantes) && sesion.cantidadParticipantes >= 0)
    && (visible.programacion === null || (objeto(visible.programacion)
      && esUuidPostgres(visible.programacion.id)
      && typeof visible.programacion.fechaProgramada === 'string'
      && typeof visible.programacion.horaProgramada === 'string'
      && typeof visible.programacion.sala === 'string'
      && Number.isInteger(visible.programacion.duracionEstimadaMinutos)
      && ESTADOS_SUSTENTACION.has(visible.programacion.estado))));
  return visible;
}

export function adaptarListaTrabajosApi(respuesta) {
  exigir(objeto(respuesta) && Array.isArray(respuesta.elementos));
  if (respuesta.elementos.some((trabajo) => !esEstadoRegistroValido(trabajo))) throw new ErrorRespuestaApi();
  return respuesta.elementos.filter(esRegistroVisible).map(adaptarTrabajoApi);
}

const entero = (valor, minimo) => Number.isInteger(valor) && valor >= minimo;

/**
 * Página de `GET /trabajos?limite=…`: valida paginación y filtros del servidor y adapta los
 * elementos con el adaptador de la pantalla (trabajos o evaluaciones).
 */
export function adaptarPaginaTrabajosApi(respuesta, adaptarLista = adaptarListaTrabajosApi) {
  exigir(objeto(respuesta) && objeto(respuesta.paginacion) && objeto(respuesta.filtros));
  const { pagina, limite, total, paginas } = respuesta.paginacion;
  exigir(entero(pagina, 1) && entero(limite, 1) && entero(total, 0) && entero(paginas, 1));
  const { periodo, periodos, estados, carreras = [], modalidades = [] } = respuesta.filtros;
  exigir(typeof periodo === 'string' && Array.isArray(periodos) && Array.isArray(estados)
    && periodos.every((p) => objeto(p) && typeof p.codigo === 'string' && typeof p.activo === 'boolean')
    && estados.every((estado) => typeof estado === 'string'));
  // RF-13: catálogos de los selectores; una respuesta anterior sin ellos deja las listas vacías.
  const catalogo = (lista) => {
    exigir(Array.isArray(lista) && lista.every((item) => objeto(item) && typeof item.codigo === 'string'
      && (item.nombre == null || typeof item.nombre === 'string')));
    return lista.map(({ codigo, nombre }) => ({ codigo, nombre: nombre ?? codigo }));
  };
  return {
    trabajos: adaptarLista({ elementos: respuesta.elementos }),
    paginacion: { pagina, limite, total, paginas },
    filtros: {
      periodo, periodos: periodos.map(({ codigo, nombre, activo }) => ({ codigo, nombre: nombre ?? null, activo })), estados,
      carreras: catalogo(carreras), modalidades: catalogo(modalidades),
    },
  };
}

/** Ruta de la página pedida; omite los filtros vacíos o «Todos». */
export function rutaPaginaTrabajos({
  pagina = 1, limite = 25, periodo, buscar, estado, tribunal, carrera, modalidad, estudiante, tema, tutor,
} = {}) {
  const parametros = new URLSearchParams({ limite: String(limite), pagina: String(pagina) });
  if (periodo) parametros.set('periodo', periodo);
  if (buscar?.trim()) parametros.set('buscar', buscar.trim());
  if (estado) parametros.set('estado', estado);
  if (tribunal) parametros.set('tribunal', tribunal);
  if (carrera) parametros.set('carrera', carrera);
  if (modalidad) parametros.set('modalidad', modalidad);
  if (estudiante?.trim()) parametros.set('estudiante', estudiante.trim());
  if (tema?.trim()) parametros.set('tema', tema.trim());
  if (tutor?.trim()) parametros.set('tutor', tutor.trim());
  return `/trabajos?${parametros}`;
}
