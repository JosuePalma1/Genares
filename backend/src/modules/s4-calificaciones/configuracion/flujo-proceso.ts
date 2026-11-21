import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { conAlcance } from '../../../common/api/contexto-alcance';
import { CONSULTA_TRABAJOS_MER, TrabajoMer } from '../trabajos/trabajos.service';
import { Movimiento, PasoDto, pasosIniciales, resolverPasos } from './flujo.reglas';

export async function trabajoEn(manager: EntityManager, id: string): Promise<TrabajoMer> {
  const [trabajo] = await manager.query(...conAlcance(CONSULTA_TRABAJOS_MER, [id, null]));
  if (!trabajo) throw new NotFoundException('Trabajo no disponible.');
  return trabajo;
}
export function hechosTrabajo(t: TrabajoMer) {
  const hechos = new Set(['REGISTRADO', String(t.estado)]);
  if (t.evaluadores.length) hechos.add('TRIBUNAL_ASIGNADO');
  if (t.escritasCerradas >= 2) hechos.add('DOS_ESCRITAS_CERRADAS');
  if (t.evaluadores.length && t.escritasCerradas === t.evaluadores.length)
    hechos.add('REVISION_ESCRITA_COMPLETADA');
  if (
    t.sesiones.some(
      (s) =>
        s.estadoRegistro === 1 && ['PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA'].includes(s.estado ?? ''),
    )
  )
    hechos.add('SUSTENTACION_PROGRAMADA');
  if (t.estado === 'FINALIZADO') hechos.add('EVALUACION_COMPLETADA');
  return hechos;
}
export async function flujoDelProceso(
  manager: EntityManager,
  trabajo: TrabajoMer,
  rol: string,
  actor: string,
) {
  const [config] = await manager.query(
    'SELECT f.version,f.pasos FROM s4.version_flujo f JOIN s4.procesos_evaluacion p ON p.version_flujo=f.version WHERE p.id=$1',
    [trabajo.procesoId],
  );
  if (!config) throw new NotFoundException('El trabajo aún no tiene un proceso de evaluación.');
  const historial: Array<Movimiento & { fecha: string }> = await manager.query(
    'SELECT paso,accion,actor,fecha FROM s4.historial_paso WHERE proceso=$1 ORDER BY id',
    [trabajo.procesoId],
  );
  const pasos: PasoDto[] = config.version === 1 ? pasosIniciales : config.pasos;
  const hechos = hechosTrabajo(trabajo);
  if (pasos.some((p) => p.condiciones.includes('SOLICITUD_CORRECCION_APROBADA'))) {
    const [solicitud] = await manager.query(
      `SELECT 1 FROM s4.solicitudes_correccion_evaluacion s
      JOIN s4.evaluaciones e ON e.id=s.id_evaluacion AND e.estado_registro=1
      WHERE e.id_proceso_evaluacion=$1 AND s.estado_registro=1 AND s.estado IN ('APROBADA','APLICADA') LIMIT 1`,
      [trabajo.procesoId],
    );
    if (solicitud) hechos.add('SOLICITUD_CORRECCION_APROBADA');
  }
  return { version: config.version, historial, pasos: resolverPasos(pasos, hechos, historial, rol, actor) };
}
export async function requisitosAccion(manager: EntityManager, trabajo: TrabajoMer, accion: string) {
  const flujo = await flujoDelProceso(manager, trabajo, '', '');
  return flujo.pasos.filter((p) => p.exigirPara?.includes(accion) && !p.cumplido).map((p) => p.nombre);
}
