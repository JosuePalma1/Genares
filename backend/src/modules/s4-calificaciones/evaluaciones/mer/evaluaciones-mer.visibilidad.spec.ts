import { DataSource } from 'typeorm';
import { EvaluacionesMerService } from './evaluaciones-mer.service';

/**
 * Orden de consultas de obtenerExpediente: proceso, etapas, categorías, indicadores,
 * estudiantes, evaluadores y evaluaciones.
 */
function baseSimulada() {
  const etapa = { id: 'e1', kind: 'ESCRITA', scope: 'TRABAJO_COMPARTIDO', codigo: 'E', nombre: 'Escrita',
    descripcion: null, orden: 1, porcentaje: '100.00', calificacionMaxima: '10.00', estadoRegistro: 1 };
  const categorias = [
    { id: 'c-visible', idEtapaRubrica: 'e1', estadoRegistro: 1 },
    { id: 'c-oculta', idEtapaRubrica: 'e1', estadoRegistro: 0 },
  ];
  const indicadores = [
    { id: 'i-visible', idCategoria: 'c-visible', estadoRegistro: 1 },
    // Indicador visible dentro de una categoría oculta: su rama ya no es visible.
    { id: 'i-hijo-de-oculta', idCategoria: 'c-oculta', estadoRegistro: 1 },
  ];
  const evaluacion = {
    id: 'ev1', idEtapaRubrica: 'e1', idAsignacionTribunal: 'm1', idEstudiante: null,
    estado: 'CERRADA', estadoRegistro: 1, revision: 1, total: '8.00', cerradaEn: null,
    puntajes: [
      { idIndicador: 'i-visible', score: '5.00', estadoRegistro: 1, estadoIndicador: 1 },
      { idIndicador: 'i-hijo-de-oculta', score: '3.00', estadoRegistro: 1, estadoIndicador: 1 },
    ],
  };
  const query = jest.fn()
    .mockResolvedValueOnce([{ procesoId: 'p1', asignacionId: 'a1', idVersionRubrica: 'v1', permisoCierre: false }])
    .mockResolvedValueOnce([etapa])
    .mockResolvedValueOnce(categorias)
    .mockResolvedValueOnce(indicadores)
    .mockResolvedValueOnce([{ id: 'est1', nombre: 'Estudiante' }])
    .mockResolvedValueOnce([{ id: 'm1', nombre: 'Evaluador' }])
    .mockResolvedValueOnce([evaluacion]);
  return { query } as unknown as Pick<DataSource, 'query'>;
}

describe('obtenerExpediente: estructura oculta', () => {
  it('omite categorías ocultas y los puntajes de su rama sin alterar el total consolidado', async () => {
    const servicio = new EvaluacionesMerService({} as DataSource);

    const expediente = await servicio.obtenerExpediente('a1', baseSimulada());

    expect(expediente.etapas[0].categorias.map((c: Record<string, unknown>) => c.id)).toEqual(['c-visible']);
    expect(expediente.evaluaciones[0].puntajes.map((p: Record<string, unknown>) => p.idIndicador))
      .toEqual(['i-visible']);
    const consolidado = expediente.consolidados[0];
    expect(consolidado.etapas[0].categorias.map((c: Record<string, unknown>) => c.id)).toEqual(['c-visible']);
    // El resultado usa el total guardado de la evaluación cerrada (8.00 de 10, peso 100 %).
    expect(consolidado.total).toBe('8.00');
  });
});
