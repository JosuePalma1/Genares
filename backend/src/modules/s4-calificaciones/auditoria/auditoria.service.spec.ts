import { DataSource } from 'typeorm';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService', () => {
  it('pagina los cambios y aplica los filtros sin interpolar valores SQL', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'evento-1' }]);
    const dataSource = { query } as unknown as DataSource;
    const service = new AuditoriaService(dataSource);

    const resultado = await service.listar({ tabla: 'rubricas', registro: 'abc', limite: 300 });

    expect(resultado).toEqual({ elementos: [{ id: 'evento-1' }], limite: 100, siguienteCursor: null });
    const [sql, parametros] = query.mock.calls[0];
    expect(sql).toContain("esquema = 's4'");
    expect(sql).toContain('tabla = $1');
    expect(sql).toContain('clave_registro::text ILIKE $2');
    expect(sql).toContain('LIMIT $3');
    expect(parametros).toEqual(['rubricas', '%abc%', 101]);
  });

  it('usa un límite por defecto cuando el parámetro no es numérico', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = { query } as unknown as DataSource;
    const service = new AuditoriaService(dataSource);

    await expect(service.listar({ limite: 'muchos' })).resolves.toEqual({ elementos: [], limite: 50, siguienteCursor: null });
    expect(query.mock.calls[0][1]).toEqual([51]);
  });

  it('devuelve un cursor estable cuando existe otra página', async () => {
    const filas = [
      { id: '11111111-1111-4111-8111-111111111111', ocurridoEn: new Date('2026-11-10T12:00:00.000Z'), __cursorFecha: '2026-11-10T12:00:00.123456Z' },
      { id: '22222222-2222-4222-8222-222222222222', ocurridoEn: new Date('2026-11-10T11:59:59.000Z'), __cursorFecha: '2026-11-10T11:59:59.000000Z' },
    ];
    const query = jest.fn().mockResolvedValue(filas);
    const service = new AuditoriaService({ query } as unknown as DataSource);

    const resultado = await service.listar({ limite: 1 });

    expect(resultado.elementos).toEqual([{ id: filas[0].id, ocurridoEn: filas[0].ocurridoEn }]);
    expect(resultado.siguienteCursor).toBeTruthy();
    expect(JSON.parse(Buffer.from(resultado.siguienteCursor!, 'base64url').toString('utf8'))).toEqual({
      ocurridoEn: filas[0].__cursorFecha,
      id: filas[0].id,
    });
    expect(query.mock.calls[0][1]).toEqual([2]);
  });

  it('rechaza un cursor malformado antes de consultar la base', async () => {
    const query = jest.fn();
    const service = new AuditoriaService({ query } as unknown as DataSource);

    await expect(service.listar({ cursor: 'no-es-un-cursor' })).rejects.toThrow('Cursor de auditoría inválido.');
    expect(query).not.toHaveBeenCalled();
  });

  it('continúa desde fecha y UUID sin perder precisión del timestamp', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new AuditoriaService({ query } as unknown as DataSource);
    const cursor = Buffer.from(JSON.stringify({
      ocurridoEn: '2026-11-10T12:00:00.123456Z',
      id: '11111111-1111-4111-8111-111111111111',
    }), 'utf8').toString('base64url');

    const resultado = await service.listar({ limite: 10, cursor });

    expect(resultado.siguienteCursor).toBeNull();
    expect(query.mock.calls[0][0]).toContain('(ocurrido_en, id) < ($1::timestamptz, $2::uuid)');
    expect(query.mock.calls[0][1]).toEqual([
      '2026-11-10T12:00:00.123456Z', '11111111-1111-4111-8111-111111111111', 11,
    ]);
    expect(query.mock.calls[0][0]).toContain('ORDER BY ocurrido_en DESC, id DESC');
  });
});
