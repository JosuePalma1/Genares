import { calcularConsolidadoMer, validarPuntajesBorrador, validarPuntajesCierre } from './borrador-oral.reglas';

describe('Validación borradores orales del MER unificado', () => {
  const indicadores = [{ id: 'a', calificacionMaxima: '5.00' }, { id: 'b', calificacionMaxima: '3.00' }];
  it('acepta indicadores incompletos y cero', () => {
    expect(() => validarPuntajesBorrador(indicadores, [
      { idIndicador: 'a', score: null }, { idIndicador: 'b', score: 0 },
    ])).not.toThrow();
  });
  it('impide superar el máximo definido en PostgreSQL', () => {
    expect(() => validarPuntajesBorrador(indicadores, [
      { idIndicador: 'a', score: 5.01 }, { idIndicador: 'b', score: 2 },
    ])).toThrow(/entre 0 y 5/);
  });
  it('impide indicadores duplicados', () => {
    expect(() => validarPuntajesBorrador(indicadores, [
      { idIndicador: 'a', score: 3 }, { idIndicador: 'a', score: 2 },
    ])).toThrow(/duplicados/);
  });
  it('exige todos los indicadores que pertenecen a la etapa', () => {
    expect(() => validarPuntajesBorrador(indicadores, [
      { idIndicador: 'a', score: 3 },
    ])).toThrow(/todos los indicadores/);
  });
  it('rechaza cerrar con pendientes y acepta el cero como nota', () => {
    expect(() => validarPuntajesCierre(indicadores, [
      { idIndicador: 'a', score: null }, { idIndicador: 'b', score: 0 },
    ])).toThrow(/completa/i);
    expect(() => validarPuntajesCierre(indicadores, [
      { idIndicador: 'a', score: 4.125 }, { idIndicador: 'b', score: 0 },
    ])).not.toThrow();
  });
});

it('consolida la escrita compartida y la oral propia solo cuando ambos evaluadores cierran', () => {
  const etapas = [
    { id: 'escrita', scope: 'TRABAJO_COMPARTIDO', porcentaje: '40', calificacionMaxima: '10' },
    { id: 'oral', scope: 'ESTUDIANTE_INDIVIDUAL', porcentaje: '60', calificacionMaxima: '10' },
  ];
  const notas = [
    { idEtapaRubrica: 'escrita', idAsignacionTribunal: 'a', idEstudiante: null, estado: 'CERRADA', total: '8.2' },
    { idEtapaRubrica: 'escrita', idAsignacionTribunal: 'b', idEstudiante: null, estado: 'CERRADA', total: '8.6' },
    { idEtapaRubrica: 'oral', idAsignacionTribunal: 'a', idEstudiante: 'juan', estado: 'CERRADA', total: '7.125' },
    { idEtapaRubrica: 'oral', idAsignacionTribunal: 'b', idEstudiante: 'juan', estado: 'BORRADOR', total: '9.125' },
    { idEtapaRubrica: 'oral', idAsignacionTribunal: 'b', idEstudiante: 'maria', estado: 'CERRADA', total: '10' },
  ];
  expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas, 'juan')).toBeNull();
  notas[3].estado = 'CERRADA';
  expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas, 'juan')).toBe('8.24');
  expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas, 'maria')).toBeNull();
});
