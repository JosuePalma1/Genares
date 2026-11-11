import { describe, expect, it, vi } from 'vitest';
import { consolidarTrabajosApi } from './usarSeguimientoApi';

const trabajoTi = {
  id: '11111111-1111-4111-8111-111111111111',
  idVersionRubrica: '21111111-1111-4111-8111-111111111111',
  estadoTribunal: 'CONFIRMADO',
  miembrosTribunal: [{}, {}],
  estudiantes: [{ id: '31111111-1111-4111-8111-111111111111' }, { id: '41111111-1111-4111-8111-111111111111' }],
};

const opciones = (consolidarTrabajo) => ({ consolidarTrabajo, habilitada: true });

describe('consolidarTrabajosApi (solo la página visible)', () => {
  it('reutiliza la consolidación del servidor sin recalcular resultados', async () => {
    const consolidacion = {
      trabajoId: trabajoTi.id,
      estudiantes: [
        { estudiante: { id: trabajoTi.estudiantes[0].id }, estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '9.25' } },
        { estudiante: { id: trabajoTi.estudiantes[1].id }, estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null },
      ],
    };
    const consolidarTrabajo = vi.fn().mockResolvedValue(consolidacion);

    const resultado = await consolidarTrabajosApi([trabajoTi], opciones(consolidarTrabajo));

    expect(resultado).toMatchObject({ estado: 'listo', datos: { [trabajoTi.id]: { estado: 'listo', datos: consolidacion } } });
    expect(consolidarTrabajo).toHaveBeenCalledWith(trabajoTi.id, { signal: undefined });
  });

  it('no consulta consolidación cuando falta rúbrica o tribunal confirmado', async () => {
    const consolidarTrabajo = vi.fn();
    const resultado = await consolidarTrabajosApi([
      { ...trabajoTi, id: '61111111-1111-4111-8111-111111111111', idVersionRubrica: null },
      { ...trabajoTi, id: '71111111-1111-4111-8111-111111111111', estadoTribunal: 'BORRADOR', miembrosTribunal: [] },
    ], opciones(consolidarTrabajo));

    expect(consolidarTrabajo).not.toHaveBeenCalled();
    expect(Object.values(resultado.datos).every((r) => r.estado === 'no_disponible')).toBe(true);
    expect(resultado.estado).toBe('no_disponible');
  });

  it('una página vacía queda lista y la fuente deshabilitada no se presenta como datos', async () => {
    await expect(consolidarTrabajosApi([], opciones(vi.fn()))).resolves.toMatchObject({ estado: 'listo', datos: {} });
    await expect(consolidarTrabajosApi([trabajoTi], { consolidarTrabajo: vi.fn(), habilitada: false }))
      .resolves.toMatchObject({ estado: 'no_disponible' });
  });

  it('trata la consolidación no disponible como información faltante y otros fallos como error', async () => {
    const conflicto = await consolidarTrabajosApi([trabajoTi], opciones(vi.fn().mockRejectedValue({ status: 409 })));
    expect(conflicto.datos[trabajoTi.id]).toMatchObject({ estado: 'no_disponible', datos: null });

    const fallo = await consolidarTrabajosApi([trabajoTi], opciones(vi.fn().mockRejectedValue(new Error('Falló API'))));
    expect(fallo).toMatchObject({ estado: 'error', datos: { [trabajoTi.id]: { estado: 'error' } } });

    const otro = { ...trabajoTi, id: '81111111-1111-4111-8111-111111111111' };
    const parcial = await consolidarTrabajosApi([trabajoTi, otro], opciones(vi.fn((id) => (id === otro.id
      ? Promise.reject(new Error('Falló API'))
      : Promise.resolve({ trabajoId: trabajoTi.id, estudiantes: [] })))));
    expect(parcial.estado).toBe('parcial');
  });

  it('rechaza una consolidación de otro trabajo y limita las consultas simultáneas', async () => {
    const ajeno = await consolidarTrabajosApi([trabajoTi], opciones(vi.fn().mockResolvedValue({ trabajoId: 'otro', estudiantes: [] })));
    expect(ajeno.datos[trabajoTi.id].estado).toBe('error');

    let simultaneas = 0;
    let maximo = 0;
    const trabajos = Array.from({ length: 10 }, (_, i) => ({ ...trabajoTi, id: `t-${i}` }));
    await consolidarTrabajosApi(trabajos, opciones(async (id) => {
      simultaneas += 1; maximo = Math.max(maximo, simultaneas);
      await new Promise((resolver) => setTimeout(resolver, 2));
      simultaneas -= 1;
      return { trabajoId: id, estudiantes: [] };
    }));
    expect(maximo).toBeLessThanOrEqual(4);
  });
});
