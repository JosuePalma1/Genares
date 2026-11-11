import { establecerActorAuditoria } from './contexto-auditoria';

describe('establecerActorAuditoria', () => {
  it('fija actor técnico, actor de dominio y correlación dentro de la transacción', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    const correlationId = await establecerActorAuditoria(manager, 'docente-local', 'req-123');

    expect(correlationId).toBe('req-123');
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining("set_config('s4.actor_id', $1, true)"), [
      'GENARES:LOCAL_DEVELOPMENT', 'req-123', 'Genares S4', 'docente-local',
    ]);
  });

  it('genera una correlación cuando la solicitud no la trae', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    const correlationId = await establecerActorAuditoria(manager);

    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(manager.query.mock.calls[0][1][1]).toBe(correlationId);
  });
});
