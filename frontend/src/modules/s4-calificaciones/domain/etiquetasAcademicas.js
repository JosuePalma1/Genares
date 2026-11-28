import { esUuidPostgres } from '../infrastructure/repositories/uuidPostgres';

export function codigoVisibleTrabajo(codigo) {
  return esUuidPostgres(codigo?.trim()) ? '' : codigo?.trim() ?? '';
}

export function referenciaTrabajo(trabajo) {
  return [codigoVisibleTrabajo(trabajo?.codigo), trabajo?.titulo].filter(Boolean).join(' · ') || 'Trabajo';
}

const ESTADOS_ACADEMICOS = {
  SIN_EVALUACION: 'Sin evaluación',
  SIN_EVALUACIONES: 'Sin evaluaciones',
  EVALUACION_NO_CERRADA: 'Evaluación sin cerrar',
  EVALUACION_COMPLETADA: 'Evaluación completada',
  SUSTENTACION_PROGRAMADA: 'Sustentación programada',
  SUSTENTACION_PENDIENTE: 'Sustentación pendiente',
  REVISION_ESCRITA_PENDIENTE: 'Revisión escrita pendiente',
  REVISION_ESCRITA_COMPLETADA: 'Revisión escrita completada',
  EN_SUSTENTACION: 'En sustentación',
  EN_CURSO_O_PENDIENTE: 'En curso o pendiente',
  COMPLETADA: 'Finalizada',
};

export function estadoAcademicoLegible(estado, ausencia = 'Sin estado registrado') {
  if (!estado) return ausencia;
  const texto = estado.replaceAll('_', ' ').toLocaleLowerCase('es');
  return ESTADOS_ACADEMICOS[estado] ?? texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}
