import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { DocumentosService } from './documentos.service';

function preparar(respuestas: unknown[][]) {
  const query = jest.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const servicio = new DocumentosService({ query } as unknown as DataSource, {} as EvaluacionesService);
  return { servicio, query };
}

describe('listado de actas archivadas', () => {
  it('sin límite conserva la lista completa anterior', async () => {
    const { servicio, query } = preparar([[{ id: 'a1' }]]);
    await expect(servicio.listar('actor', {}, true)).resolves.toEqual([{ id: 'a1' }]);
    expect(query.mock.calls[0][0]).not.toContain('OVER()');
    expect(query.mock.calls[0][1].slice(5)).toEqual([null, 0]);
  });

  it('con límite devuelve una página con el total filtrado', async () => {
    const { servicio, query } = preparar([[{ id: 'a3', total: 23 }]]);
    await expect(servicio.listar('actor', { limite: '10', pagina: '3', periodo: '2026-2' }, false)).resolves.toEqual({
      elementos: [{ id: 'a3' }], paginacion: { pagina: 3, limite: 10, total: 23, paginas: 3 },
    });
    expect(query.mock.calls[0][0]).toContain('count(*) OVER()');
    expect(query.mock.calls[0][0]).toContain('ar.estado_registro = 1');
    expect(query.mock.calls[0][1]).toEqual(['actor', null, null, '2026-2', false, 10, 20]);
  });

  it('informa el total real aunque la página pedida quede vacía', async () => {
    const { servicio, query } = preparar([[], [{ id: 'a1', total: 4 }]]);
    await expect(servicio.listar('actor', { limite: '10', pagina: '5' }, true)).resolves.toMatchObject({
      elementos: [], paginacion: { pagina: 5, total: 4, paginas: 1 },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
