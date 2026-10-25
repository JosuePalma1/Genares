import { ErrorRespuestaApi } from '../servicios/clienteHttp';
import { esUuidPostgres } from './uuidPostgres';

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
  exigir(objeto(trabajo)
    && esUuidPostgres(trabajo.id)
    && typeof trabajo.codigo === 'string' && trabajo.codigo.length > 0
    && typeof trabajo.titulo === 'string' && trabajo.titulo.length > 0
    && ESTADOS_TRABAJO.has(trabajo.estado)
    && esUuidPostgres(trabajo.idCarrera) && typeof trabajo.codigoCarrera === 'string'
    && typeof trabajo.carrera === 'string'
    && esUuidPostgres(trabajo.idPeriodo) && typeof trabajo.periodo === 'string'
    && esUuidPostgres(trabajo.idModalidad) && typeof trabajo.codigoModalidad === 'string'
    && typeof trabajo.modalidad === 'string'
    && (trabajo.idVersionRubrica === null || esUuidPostgres(trabajo.idVersionRubrica))
    && (trabajo.versionRubrica === null || typeof trabajo.versionRubrica === 'string')
    && (trabajo.rubrica === null || typeof trabajo.rubrica === 'string')
    && (trabajo.estadoVersionRubrica === null || ESTADOS_VERSION.has(trabajo.estadoVersionRubrica))
    && Array.isArray(trabajo.estudiantes)
    && trabajo.estudiantes.every((estudiante) => objeto(estudiante)
      && esUuidPostgres(estudiante.id)
      && typeof estudiante.nombres === 'string' && typeof estudiante.apellidos === 'string'
      && Number.isInteger(estudiante.ordenAutoria) && estudiante.ordenAutoria > 0)
    && Array.isArray(trabajo.tutores)
    && trabajo.tutores.every((tutor) => objeto(tutor)
      && esUuidPostgres(tutor.idAsignacion) && esUuidPostgres(tutor.idDocente)
      && typeof tutor.nombres === 'string' && typeof tutor.apellidos === 'string'
      && (tutor.carrera === null || typeof tutor.carrera === 'string')
      && typeof tutor.asignadoEn === 'string' && esFechaOpcional(tutor.finalizadoEn))
    && (trabajo.estadoTribunal === null || ESTADOS_TRIBUNAL.has(trabajo.estadoTribunal))
    && esFechaOpcional(trabajo.tribunalConfirmadoEn)
    && Array.isArray(trabajo.miembrosTribunal)
    && trabajo.miembrosTribunal.every((miembro) => objeto(miembro)
      && esUuidPostgres(miembro.idMiembroTribunal) && Number.isInteger(miembro.posicion) && miembro.posicion > 0
      && typeof miembro.nombres === 'string' && typeof miembro.apellidos === 'string')
    && (trabajo.estadoTribunal === 'CONFIRMADO' || trabajo.miembrosTribunal.length === 0)
    && (trabajo.programacion === null || (objeto(trabajo.programacion)
      && esUuidPostgres(trabajo.programacion.id)
      && typeof trabajo.programacion.fechaProgramada === 'string'
      && typeof trabajo.programacion.horaProgramada === 'string'
      && typeof trabajo.programacion.sala === 'string'
      && Number.isInteger(trabajo.programacion.duracionEstimadaMinutos)
      && ESTADOS_SUSTENTACION.has(trabajo.programacion.estado))));
  return trabajo;
}

export function adaptarListaTrabajosApi(respuesta) {
  exigir(objeto(respuesta) && Array.isArray(respuesta.elementos));
  return respuesta.elementos.map(adaptarTrabajoApi);
}
