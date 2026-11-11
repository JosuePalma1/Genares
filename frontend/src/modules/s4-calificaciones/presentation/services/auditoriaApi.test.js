import { describe, expect, it, vi } from 'vitest';
import { crearQueryAuditoria, crearServicioAuditoriaApi } from './auditoriaApi';

const evento = {
  id: '11111111-1111-4111-8111-111111111111',
  ocurridoEn: '2026-11-10T12:00:00.000Z',
  actorId: 'GENARES:LOCAL_DEVELOPMENT',
  rolBase: 'genares',
  tabla: 'rubricas',
  claveRegistro: { id: '22222222-2222-4222-8222-222222222222' },
  operacion: 'UPDATE',
  antes: { estado_registro: 1 },
  despues: { estado_registro: 0 },
};

describe('consulta API de auditoría S4', () => {
  it('serializa los filtros de forma segura', () => {
    expect(crearQueryAuditoria({ tabla: 'rubricas', registro: 'abc 123', limite: 25 }))
      .toBe('/auditoria/cambios?tabla=rubricas&registro=abc+123&limite=25');
    expect(crearQueryAuditoria({ limite: 25, cursor: 'eyJjdXJzb3IifQ' }))
      .toBe('/auditoria/cambios?limite=25&cursor=eyJjdXJzb3IifQ');
  });

  it('consulta y valida actor, fecha, clave y antes/después', async () => {
    const getJson = vi.fn().mockResolvedValue({ elementos: [evento], limite: 50, siguienteCursor: null });
    const servicio = crearServicioAuditoriaApi({ getJson });

    await expect(servicio.listar()).resolves.toEqual({ elementos: [evento], limite: 50, siguienteCursor: null });
    expect(getJson).toHaveBeenCalledWith('/auditoria/cambios?limite=50', { signal: undefined });
  });

  it('rechaza respuestas incompletas', async () => {
    const servicio = crearServicioAuditoriaApi({ getJson: vi.fn().mockResolvedValue({ elementos: [{}], limite: 50, siguienteCursor: null }) });
    await expect(servicio.listar()).rejects.toThrow(/información recibida no es válida/i);
  });

  it('rechaza cursores siguientes con formato no seguro', async () => {
    const servicio = crearServicioAuditoriaApi({
      getJson: vi.fn().mockResolvedValue({ elementos: [], limite: 50, siguienteCursor: 'cursor con espacios' }),
    });
    await expect(servicio.listar()).rejects.toThrow(/información recibida no es válida/i);
  });
});
