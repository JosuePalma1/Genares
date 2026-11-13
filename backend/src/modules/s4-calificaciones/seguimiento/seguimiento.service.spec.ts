import { DataSource } from 'typeorm';
import {
  CONSULTA_ACTAS_SEGUIMIENTO,
  CONSULTA_CONTEOS_SEGUIMIENTO,
  ESTADOS_RESULTADO_COMPLETO,
  SeguimientoService,
} from './seguimiento.service';

function preparar() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
    if (sql.includes('FROM gen.periodo_academico')) return [{ codigo: '2026-2', nombre: null, activo: true }];
    if (sql === CONSULTA_CONTEOS_SEGUIMIENTO) {
      return [{ total: 3, porCarrera: [{ codigo: 'TI', cantidad: 3 }], porEstado: [{ estado: 'REGISTRADO', cantidad: 3 }], programaciones: 2, resultadosCompletos: 4 }];
    }
    if (sql === CONSULTA_ACTAS_SEGUIMIENTO) return [{ actas: 1 }];
    return [];
  });
  return { servicio: new SeguimientoService({ query } as unknown as DataSource), query };
}

describe('SeguimientoService.resumen', () => {
  it('cuenta los resultados completos en la misma consulta del resumen, sin consolidar trabajo por trabajo', async () => {
    const { servicio, query } = preparar();
    const resumen = await servicio.resumen();
    expect(resumen).toMatchObject({
      periodo: '2026-2', trabajos: { total: 3 }, programaciones: 2, actas: 1,
      resultados: { estado: 'listo', completos: 4, trabajosConsultados: 3, trabajosConError: 0 },
    });
    // Solo periodos, conteos y actas: ninguna consulta por trabajo.
    expect(query).toHaveBeenCalledTimes(3);
    for (const sql of [CONSULTA_CONTEOS_SEGUIMIENTO, CONSULTA_ACTAS_SEGUIMIENTO]) {
      expect(query.mock.calls.find(([texto]) => texto === sql)?.[1]).toEqual(['2026-2']);
    }
  });

  it('acepta TODOS los periodos', async () => {
    const { servicio, query } = preparar();
    const resumen = await servicio.resumen('TODOS');
    expect(resumen.periodo).toBe('TODOS');
    expect(query.mock.calls.find(([texto]) => texto === CONSULTA_CONTEOS_SEGUIMIENTO)?.[1]).toEqual([null]);
  });

  it('usa el universo visible de Trabajos y cuenta estudiantes con evaluación completada o finalizados', () => {
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain("a.estado = 'VIGENTE'");
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain('ses.estado_registro = 1');
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain('estado_calculado.estudiantes AS estudiantes');
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain("e->>'estado' IN ('EVALUACION_COMPLETADA', 'FINALIZADO')");
    expect(ESTADOS_RESULTADO_COMPLETO).toEqual(['EVALUACION_COMPLETADA', 'FINALIZADO']);
    expect(CONSULTA_ACTAS_SEGUIMIENTO).toContain('ar.estado_registro = 1');
    expect(CONSULTA_ACTAS_SEGUIMIENTO).toContain('p.estado_registro = 1');
  });
});
