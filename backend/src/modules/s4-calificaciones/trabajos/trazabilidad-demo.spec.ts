import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ejecutarConIdentidad } from '../../../common/api/contexto-alcance';
import { IdentidadApi, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { EvaluacionesMerController } from '../evaluaciones/mer/evaluaciones-mer.controller';
import { TrazabilidadTrabajosController } from './trazabilidad-trabajos.controller';
import { TrazabilidadTrabajosService } from './trazabilidad-trabajos.service';

const TRABAJO = '11111111-1111-4111-8111-111111111111';
const demo = (alcance: IdentidadApi['alcance']): IdentidadApi => ({
  sujeto: 'dev-ti-a', tipo: 'DEMOSTRACION', capacidades: ['trabajos:leer'], alcance,
});
const solicitud = (identidadApi: IdentidadApi): SolicitudConIdentidad => ({ identidadApi } as SolicitudConIdentidad);

describe('usuarios de demostración (rama demo/accesos-por-rol)', () => {
  it('consultan la trazabilidad; otras identidades no locales siguen rechazadas', () => {
    const servicio = { consultar: jest.fn().mockReturnValue('historial') };
    const controlador = new TrazabilidadTrabajosController(servicio as unknown as TrazabilidadTrabajosService);
    expect(controlador.consultar(TRABAJO, undefined, solicitud(demo({ carreras: ['DEV-TI'], soloTribunal: false })))).toBe('historial');
    expect(() => controlador.consultar(TRABAJO, undefined,
      solicitud({ sujeto: 'otro', tipo: 'VERIFICADA', capacidades: ['trabajos:leer'] }))).toThrow(ForbiddenException);
  });

  it('no ven la trazabilidad de un trabajo fuera de su ámbito', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ '?column?': 1 }]) // el trabajo existe
      .mockResolvedValueOnce([]); // pero no es de su tribunal
    const servicio = new TrazabilidadTrabajosService({ query } as never);
    await expect(ejecutarConIdentidad(demo({ carreras: null, soloTribunal: true }), () => servicio.consultar(TRABAJO)))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls[1][1]).toEqual([TRABAJO, null, 'dev-ti-a']);
  });

  it('pueden guardar borradores de la evaluación de prueba (el servicio exige RN-24)', async () => {
    const anterior = { ...process.env };
    Object.assign(process.env, { NODE_ENV: 'development', ENABLE_INTEGRACION_DEV: 'true', DB_NAME: 'genares_integrado_dev' });
    try {
      const guardarBorradorOral = jest.fn().mockResolvedValue('guardado');
      const controlador = new EvaluacionesMerController({ guardarBorradorOral } as never);
      await expect(controlador.guardarEscrita(TRABAJO, {} as never, solicitud(demo({ carreras: null, soloTribunal: true }))))
        .resolves.toBe('guardado');
      expect(() => controlador.guardarEscrita(TRABAJO, {} as never,
        solicitud({ sujeto: 'otro', tipo: 'VERIFICADA', capacidades: [] }))).toThrow(ForbiddenException);
    } finally {
      process.env = anterior;
    }
  });
});
