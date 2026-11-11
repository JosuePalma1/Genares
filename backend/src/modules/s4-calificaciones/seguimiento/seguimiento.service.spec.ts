import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import {
  CONSULTA_ACTAS_SEGUIMIENTO,
  CONSULTA_CONTEOS_SEGUIMIENTO,
  CONSULTA_TRABAJOS_CONSOLIDABLES,
  SeguimientoService,
} from './seguimiento.service';

const completo = { estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '9.00' } };
const incompleto = { estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null };

function preparar(consolidar: (id: string) => Promise<unknown>, ids = ['t1', 't2', 't3']) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
    if (sql.includes('FROM gen.periodo_academico')) return [{ codigo: '2026-2', nombre: null, activo: true }];
    if (sql === CONSULTA_CONTEOS_SEGUIMIENTO) return [{ total: 3, porCarrera: [{ codigo: 'TI', cantidad: 3 }], porEstado: [{ estado: 'REGISTRADO', cantidad: 3 }], programaciones: 2 }];
    if (sql === CONSULTA_ACTAS_SEGUIMIENTO) return [{ actas: 1 }];
    if (sql === CONSULTA_TRABAJOS_CONSOLIDABLES) return ids.map((id) => ({ id }));
    return [];
  });
  let simultaneas = 0;
  let maximo = 0;
  const consolidarTrabajo = jest.fn(async (id: string) => {
    simultaneas += 1; maximo = Math.max(maximo, simultaneas);
    await new Promise((resolver) => setTimeout(resolver, 2));
    simultaneas -= 1;
    return consolidar(id);
  });
  const servicio = new SeguimientoService({ query } as unknown as DataSource, { consolidarTrabajo } as unknown as EvaluacionesService);
  return { servicio, query, consolidarTrabajo, maximo: () => maximo };
}

describe('SeguimientoService.resumen', () => {
  it('cuenta en el servidor los resultados completos del periodo activo, como el navegador', async () => {
    const { servicio, query, consolidarTrabajo } = preparar(async (id) => ({
      estudiantes: id === 't1' ? [completo, incompleto] : [completo],
    }));
    const resumen = await servicio.resumen('actor', true);
    expect(resumen).toMatchObject({
      periodo: '2026-2', trabajos: { total: 3 }, programaciones: 2, actas: 1,
      resultados: { estado: 'listo', completos: 3, trabajosConsultados: 3, trabajosConError: 0 },
    });
    expect(consolidarTrabajo).toHaveBeenCalledWith('t1', 'actor', true);
    for (const sql of [CONSULTA_CONTEOS_SEGUIMIENTO, CONSULTA_ACTAS_SEGUIMIENTO, CONSULTA_TRABAJOS_CONSOLIDABLES]) {
      expect(query.mock.calls.find(([texto]) => texto === sql)?.[1]).toEqual(['2026-2']);
    }
  });

  it('no cuenta una consolidación no disponible y marca parcial ante otros fallos', async () => {
    const { servicio } = preparar(async (id) => {
      if (id === 't2') throw new ConflictException('Sin consolidación');
      if (id === 't3') throw new InternalServerErrorException('Falla');
      return { estudiantes: [completo] };
    });
    const resumen = await servicio.resumen('actor', true, 'TODOS');
    expect(resumen.periodo).toBe('TODOS');
    expect(resumen.resultados).toEqual({ estado: 'parcial', completos: 1, trabajosConsultados: 3, trabajosConError: 1 });
  });

  it('limita las consolidaciones simultáneas', async () => {
    const { servicio, maximo } = preparar(async () => ({ estudiantes: [] }), Array.from({ length: 12 }, (_, i) => `t${i}`));
    await servicio.resumen('actor', true);
    expect(maximo()).toBeLessThanOrEqual(4);
  });

  it('usa el universo visible de Trabajos y el criterio de consolidación del navegador', () => {
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain("a.estado = 'VIGENTE'");
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain('ses.estado_registro = 1');
    expect(CONSULTA_ACTAS_SEGUIMIENTO).toContain('ar.estado_registro = 1');
    expect(CONSULTA_ACTAS_SEGUIMIENTO).toContain('p.estado_registro = 1');
    expect(CONSULTA_TRABAJOS_CONSOLIDABLES).toContain('vr.id IS NOT NULL');
    expect(CONSULTA_TRABAJOS_CONSOLIDABLES).toContain('= 2');
  });
});
