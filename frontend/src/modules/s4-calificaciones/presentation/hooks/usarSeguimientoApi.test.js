import { describe, expect, it, vi } from 'vitest';
import { cargarSeguimientoApi } from './usarSeguimientoApi';

const trabajoTi = {
  id: '11111111-1111-4111-8111-111111111111',
  idVersionRubrica: '21111111-1111-4111-8111-111111111111',
  estadoTribunal: 'CONFIRMADO',
  miembrosTribunal: [{}, {}],
  estudiantes: [{ id: '31111111-1111-4111-8111-111111111111' }, { id: '41111111-1111-4111-8111-111111111111' }],
};

const acta = {
  id: '51111111-1111-4111-8111-111111111111',
  numero: '001-2026-2-TI',
  estudiante: 'Andrea Mendoza',
  carrera: 'Tecnologías de la Información',
  periodo: '2026-2',
  notaFinal: '9.00',
  generadoEn: '2026-10-24T12:00:00.000Z',
};

function servicios(overrides = {}) {
  return {
    listarTrabajos: vi.fn().mockResolvedValue([trabajoTi]),
    listarProgramaciones: vi.fn().mockResolvedValue({ elementos: [] }),
    consolidarTrabajo: vi.fn().mockResolvedValue({ trabajoId: trabajoTi.id, estudiantes: [] }),
    listarActas: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const fuentes = { programaciones: true, evaluaciones: true, documentos: true };

describe('cargarSeguimientoApi', () => {
  it('reutiliza trabajos, programaciones, consolidación y actas sin recalcular resultados', async () => {
    const consolidacion = {
      trabajoId: trabajoTi.id,
      estudiantes: [
        { estudiante: { id: trabajoTi.estudiantes[0].id }, estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '9.25' } },
        { estudiante: { id: trabajoTi.estudiantes[1].id }, estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null },
      ],
    };
    const api = servicios({
      consolidarTrabajo: vi.fn().mockResolvedValue(consolidacion),
      listarActas: vi.fn().mockResolvedValue([acta]),
    });

    const resultado = await cargarSeguimientoApi({ servicios: api, fuentes });

    expect(resultado.trabajos).toMatchObject({ estado: 'listo', datos: [trabajoTi] });
    expect(resultado.programaciones).toMatchObject({ estado: 'listo', datos: [] });
    expect(resultado.actas).toMatchObject({ estado: 'listo', datos: [acta] });
    expect(resultado.consolidaciones.datos[trabajoTi.id]).toMatchObject({ estado: 'listo', datos: consolidacion });
    expect(api.consolidarTrabajo).toHaveBeenCalledWith(trabajoTi.id, { signal: undefined });
  });

  it('no consulta consolidación cuando falta rúbrica o tribunal confirmado', async () => {
    const api = servicios({ listarTrabajos: vi.fn().mockResolvedValue([
      { ...trabajoTi, id: '61111111-1111-4111-8111-111111111111', idVersionRubrica: null },
      { ...trabajoTi, id: '71111111-1111-4111-8111-111111111111', estadoTribunal: 'BORRADOR', miembrosTribunal: [] },
    ]) });

    const resultado = await cargarSeguimientoApi({ servicios: api, fuentes });

    expect(api.consolidarTrabajo).not.toHaveBeenCalled();
    expect(Object.values(resultado.consolidaciones.datos).every((r) => r.estado === 'no_disponible')).toBe(true);
    expect(resultado.consolidaciones.estado).toBe('no_disponible');
  });

  it('distingue un resultado vacío de una consulta fallida y no presenta fallback local', async () => {
    const api = servicios({
      listarTrabajos: vi.fn().mockResolvedValue([]),
      listarProgramaciones: vi.fn().mockResolvedValue({ elementos: [] }),
      listarActas: vi.fn().mockResolvedValue([]),
    });
    const vacio = await cargarSeguimientoApi({ servicios: api, fuentes });
    expect(vacio.trabajos).toMatchObject({ estado: 'listo', datos: [] });
    expect(vacio.programaciones).toMatchObject({ estado: 'listo', datos: [] });
    expect(vacio.actas).toMatchObject({ estado: 'listo', datos: [] });

    const desconectado = await cargarSeguimientoApi({
      servicios: servicios({ listarTrabajos: vi.fn().mockRejectedValue(new Error('Sin conexión')) }),
      fuentes,
    });
    expect(desconectado.trabajos).toMatchObject({ estado: 'error', datos: [] });
    expect(desconectado.consolidaciones.estado).toBe('no_disponible');
  });

  it('señala un listado de actas con contrato inválido como error de API', async () => {
    const resultado = await cargarSeguimientoApi({
      servicios: servicios({ listarActas: vi.fn().mockResolvedValue([{ numero: 'sin-id' }]) }),
      fuentes,
    });
    expect(resultado.actas.estado).toBe('error');
    expect(resultado.actas.datos).toEqual([]);
  });

  it('trata la consolidación no disponible como información faltante y otros fallos como error', async () => {
    const conflicto = await cargarSeguimientoApi({
      servicios: servicios({ consolidarTrabajo: vi.fn().mockRejectedValue({ status: 409 }) }),
      fuentes,
    });
    expect(conflicto.consolidaciones.datos[trabajoTi.id]).toMatchObject({ estado: 'no_disponible', datos: null });

    const fallo = await cargarSeguimientoApi({
      servicios: servicios({ consolidarTrabajo: vi.fn().mockRejectedValue(new Error('Falló API')) }),
      fuentes,
    });
    expect(fallo.consolidaciones).toMatchObject({ estado: 'error', datos: { [trabajoTi.id]: { estado: 'error' } } });
  });
});
