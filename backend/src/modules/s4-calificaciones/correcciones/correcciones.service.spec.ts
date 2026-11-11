import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLAVE_CAPACIDADES_REQUERIDAS } from '../../../common/api/metadatos-api';
import { AlmacenJustificativos } from './almacen-justificativos';
import { CAPACIDAD_AUTORIZAR, CAPACIDAD_SOLICITAR, CorreccionesController, exigirAccesoCorrecciones } from './correcciones.controller';
import { CorreccionesService } from './correcciones.service';

const EVALUACION = '00000000-0000-4000-8000-0000000000e1';
const SOLICITUD = '00000000-0000-4000-8000-0000000000s1'.replace('s', 'a');
const pdf = { originalname: 'acta.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n') };
const puntajes = [
  { idIndicador: 'i1', score: '0.33', observation: null, calificacionMaxima: '0.33', indicador: '1', descripcion: null, categoria: 'A' },
  { idIndicador: 'i2', score: '0.20', observation: null, calificacionMaxima: '0.34', indicador: '2', descripcion: null, categoria: 'A' },
];

interface Estado {
  revision: number; estadoEvaluacion: string; estadoProceso: string; actas: number; abierta: boolean;
  solicitud?: Record<string, unknown>; totalAplicado?: string;
}

function preparar(parcial: Partial<Estado> = {}) {
  const estado: Estado = { revision: 3, estadoEvaluacion: 'CERRADA', estadoProceso: 'REGISTRADO', actas: 0, abierta: false, ...parcial };
  const sqls: string[] = [];
  const query = jest.fn(async (sql: string, parametros: unknown[] = []) => {
    sqls.push(sql);
    if (sql.includes('FROM s4.evaluaciones e\n      JOIN s4.procesos_evaluacion')) {
      return [{ id: EVALUACION, estado: estado.estadoEvaluacion, estadoRegistro: 1, revision: estado.revision, total: '0.53',
        idEstudiante: null, idProceso: 'p1', tipoEtapa: 'ESCRITA', etapa: 'Escrita', maximoEtapa: '0.67',
        estadoProceso: estado.estadoProceso, idTrabajo: 't1', trabajo: 'Tema' }];
    }
    if (sql.includes('FROM s4.calificaciones_evaluacion ce\n      JOIN')) return puntajes;
    if (sql.includes('FROM s4.actas_archivadas')) return [{ actas: estado.actas }];
    if (sql.includes("estado IN ('PENDIENTE', 'APROBADA')")) return estado.abierta ? [{ id: SOLICITUD }] : [];
    if (sql.includes('FROM s4.solicitudes_correccion_evaluacion WHERE id = $1 AND estado_registro = 1 FOR UPDATE')) {
      return estado.solicitud ? [estado.solicitud] : [];
    }
    if (sql.includes('SELECT id, COALESCE(revision, 0) AS revision FROM s4.evaluaciones')) return [{ id: EVALUACION, revision: estado.revision }];
    if (sql.includes('INSERT INTO s4.solicitudes_correccion_evaluacion')) return [{ id: SOLICITUD }];
    if (sql.includes('UPDATE s4.evaluaciones e')) return [[{ revision: estado.revision + 1, total: estado.totalAplicado ?? '0.67' }]];
    if (sql.includes('FROM s4.solicitudes_correccion_evaluacion s')) return [{ id: SOLICITUD, estado: 'X', parametros }];
    return [];
  });
  const manager = { query };
  const db = { query, transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const almacen = {
    guardar: jest.fn().mockResolvedValue({ ruta: 'auditoria/justificativos/00000000-0000-4000-8000-000000000000.pdf', sha256: 'a'.repeat(64), bytes: 9 }),
    descartar: jest.fn().mockResolvedValue(undefined),
  };
  const servicio = new CorreccionesService(db as unknown as DataSource, almacen as unknown as AlmacenJustificativos);
  const escrituras = () => sqls.filter((sql) => /^\s*(INSERT|UPDATE)\b/.test(sql) || sql.includes('set_config(\'s4.correccion'))
    .map((sql) => sql.trim().split('\n')[0].trim());
  return { servicio, escrituras, almacen, sqls };
}

const solicitudValida = (revision = 3) => ({
  idEvaluacion: EVALUACION, motivo: 'Error de transcripción en el indicador 2.', revisionEsperada: String(revision),
  puntajes: JSON.stringify([{ idIndicador: 'i1', score: 0.33 }, { idIndicador: 'i2', score: 0.34 }]),
});

const pendiente = {
  id: SOLICITUD, idEvaluacion: EVALUACION, estado: 'PENDIENTE', motivo: 'Error de transcripción', revisionBase: 3,
  puntajesAnteriores: [{ idIndicador: 'i2', score: '0.20', observation: null }],
  puntajesPropuestos: [{ idIndicador: 'i1', score: '0.33', observation: null }, { idIndicador: 'i2', score: '0.34', observation: null }],
  totalAnterior: '0.53', totalPropuesto: '0.67', justificativoSha256: 'a'.repeat(64), solicitadoPor: 'docente',
};

describe('permisos de corrección extraordinaria', () => {
  const identidad = (capacidades: string[]) => ({ identidadApi: { capacidades } }) as never;

  it('consultar exige poder solicitar o autorizar', () => {
    expect(() => exigirAccesoCorrecciones(identidad(['evaluaciones:leer']))).toThrow(ForbiddenException);
    expect(exigirAccesoCorrecciones(identidad([CAPACIDAD_SOLICITAR]))).toEqual({ puedeSolicitar: true, puedeAutorizar: false });
    expect(exigirAccesoCorrecciones(identidad([CAPACIDAD_AUTORIZAR]))).toEqual({ puedeSolicitar: false, puedeAutorizar: true });
  });

  it('el servidor exige el permiso específico para solicitar, aprobar y rechazar', () => {
    const requeridas = (metodo: keyof CorreccionesController) =>
      Reflect.getMetadata(CLAVE_CAPACIDADES_REQUERIDAS, CorreccionesController.prototype[metodo]);
    expect(requeridas('solicitar')).toContain(CAPACIDAD_SOLICITAR);
    expect(requeridas('aprobar')).toContain(CAPACIDAD_AUTORIZAR);
    expect(requeridas('rechazar')).toContain(CAPACIDAD_AUTORIZAR);
    expect(requeridas('aprobar')).not.toContain(CAPACIDAD_SOLICITAR);
  });
});

describe('solicitud de corrección (AU-02)', () => {
  it('registra el cambio exacto, el PDF y el evento de auditoría sin tocar la evaluación', async () => {
    const { servicio, escrituras } = preparar();
    await servicio.solicitar(solicitudValida(), pdf, 'docente');
    const sql = escrituras();
    expect(sql).toEqual(['INSERT INTO s4.solicitudes_correccion_evaluacion', 'INSERT INTO s4.eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles, ocurrido_en)']);
  });

  it('rechaza sin PDF, con motivo corto o con puntajes inválidos, sin escribir nada', async () => {
    const { servicio, escrituras, almacen } = preparar();
    await expect(servicio.solicitar(solicitudValida(), undefined, 'docente')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.solicitar({ ...solicitudValida(), motivo: 'corto' }, pdf, 'docente')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.solicitar({ ...solicitudValida(), puntajes: JSON.stringify([{ idIndicador: 'i1', score: 9 }]) }, pdf, 'docente'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(escrituras()).toEqual([]);
    expect(almacen.descartar).toHaveBeenCalledTimes(1);
  });

  it('rechaza si la evaluación cambió desde que se consultó (conflicto de revisión)', async () => {
    const { servicio, escrituras, almacen } = preparar({ revision: 4 });
    await expect(servicio.solicitar(solicitudValida(3), pdf, 'docente')).rejects.toThrow(/cambió/);
    expect(escrituras()).toEqual([]);
    expect(almacen.descartar).toHaveBeenCalled();
  });

  it('no permite solicitar si hay acta archivada, trabajo finalizado u otra solicitud abierta', async () => {
    for (const estado of [{ actas: 1 }, { estadoProceso: 'FINALIZADO' }, { abierta: true }]) {
      const { servicio, escrituras } = preparar(estado);
      await expect(servicio.solicitar(solicitudValida(), pdf, 'docente')).rejects.toBeInstanceOf(ConflictException);
      expect(escrituras()).toEqual([]);
    }
  });
});

describe('autorización y aplicación (AU-03)', () => {
  it('aprueba y aplica solo lo autorizado, con la excepción de base acotada a la solicitud', async () => {
    const { servicio, escrituras, sqls } = preparar({ solicitud: { ...pendiente }, abierta: true });
    await servicio.aprobar(SOLICITUD, 'Verificado con el acta física.', 'coordinacion');
    expect(escrituras()).toEqual([
      'UPDATE s4.solicitudes_correccion_evaluacion',
      "SELECT set_config('s4.correccion_solicitud', $1, true)",
      'UPDATE s4.calificaciones_evaluacion SET score = $3::numeric, observation = $4',
      'UPDATE s4.calificaciones_evaluacion SET score = $3::numeric, observation = $4',
      'UPDATE s4.evaluaciones e',
      "SELECT set_config('s4.correccion_solicitud', '', true)",
      "UPDATE s4.solicitudes_correccion_evaluacion SET estado = 'APLICADA', aplicada_en = clock_timestamp()",
      'INSERT INTO s4.eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles, ocurrido_en)',
      'INSERT INTO s4.eventos_trazabilidad_trabajo',
    ]);
    // El historial conserva notas y totales anteriores y nuevos, motivo y responsables.
    const auditoria = sqls.findIndex((sql) => sql.includes('INSERT INTO s4.eventos_auditoria_evaluacion'));
    const detalles = JSON.parse((servicio as never as { db: { query: jest.Mock } }).db.query.mock.calls[auditoria][1][3]);
    expect(detalles).toMatchObject({
      totalAnterior: '0.53', totalNuevo: '0.67', revisionAnterior: 3, revisionNueva: 4,
      solicitadoPor: 'docente', aprobadoPor: 'coordinacion', motivo: 'Error de transcripción',
      puntajesAnteriores: pendiente.puntajesAnteriores, puntajesNuevos: pendiente.puntajesPropuestos,
    });
  });

  it('no aplica si la evaluación cambió después de la solicitud', async () => {
    const { servicio, escrituras } = preparar({ solicitud: { ...pendiente }, revision: 5 });
    await expect(servicio.aprobar(SOLICITUD, undefined, 'coordinacion')).rejects.toThrow(/cambió después/);
    expect(escrituras()).toEqual([]);
  });

  it('no aplica si entretanto se archivó el acta o se finalizó el trabajo', async () => {
    for (const estado of [{ actas: 1 }, { estadoProceso: 'FINALIZADO' }]) {
      const { servicio, escrituras } = preparar({ solicitud: { ...pendiente }, abierta: true, ...estado });
      await expect(servicio.aprobar(SOLICITUD, undefined, 'coordinacion')).rejects.toBeInstanceOf(ConflictException);
      expect(escrituras()).toEqual([]);
    }
  });

  it('revierte todo si el total resultante no coincide con el autorizado', async () => {
    const { servicio } = preparar({ solicitud: { ...pendiente }, abierta: true, totalAplicado: '0.60' });
    await expect(servicio.aprobar(SOLICITUD, undefined, 'coordinacion')).rejects.toThrow(/no coincide/);
  });

  it('una solicitud resuelta no se vuelve a aprobar ni rechazar', async () => {
    for (const estadoSolicitud of ['APLICADA', 'RECHAZADA']) {
      const { servicio, escrituras } = preparar({ solicitud: { ...pendiente, estado: estadoSolicitud } });
      await expect(servicio.aprobar(SOLICITUD, undefined, 'coordinacion')).rejects.toThrow(/ya fue resuelta/);
      await expect(servicio.rechazar(SOLICITUD, 'Motivo suficiente de rechazo', 'coordinacion')).rejects.toThrow(/ya fue resuelta/);
      expect(escrituras()).toEqual([]);
    }
  });

  it('rechaza con motivo y no modifica la evaluación', async () => {
    const { servicio, escrituras } = preparar({ solicitud: { ...pendiente } });
    await expect(servicio.rechazar(SOLICITUD, 'corto', 'coordinacion')).rejects.toBeInstanceOf(BadRequestException);
    await servicio.rechazar(SOLICITUD, 'El justificativo no corresponde al estudiante.', 'coordinacion');
    const sql = escrituras();
    expect(sql).toEqual(['UPDATE s4.solicitudes_correccion_evaluacion', 'INSERT INTO s4.eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles, ocurrido_en)']);
    expect(sql.some((s) => s.includes('calificaciones_evaluacion') || s.includes('s4.evaluaciones'))).toBe(false);
  });
});
