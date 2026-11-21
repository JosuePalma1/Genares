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

describe('sin porcentajes guardados, cada parte pesa según lo que vale', () => {
  it('exige Producto y conserva su nota individual en una bina con partes de 2.5, 2.5 y 5', () => {
    const etapas = [
      { id: 'escrita', scope: 'TRABAJO_COMPARTIDO', calificacionMaxima: '2.5', porcentaje: '25' },
      { id: 'oral', scope: 'ESTUDIANTE_INDIVIDUAL', calificacionMaxima: '2.5', porcentaje: '25' },
      { id: 'producto', scope: 'ESTUDIANTE_INDIVIDUAL', calificacionMaxima: '5', porcentaje: '50' },
    ];
    const notas = ['a', 'b'].flatMap((idAsignacionTribunal) =>
      etapas.flatMap((etapa) => (etapa.id === 'escrita' ? [null] : ['ana', 'luis']).map((idEstudiante) => ({
        idEtapaRubrica: etapa.id, idAsignacionTribunal, idEstudiante, estado: 'CERRADA',
        total: etapa.id === 'producto' && idEstudiante === 'ana' ? '1' : etapa.calificacionMaxima,
      }))),
    );
    expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas, 'ana')).toBe('6.00');
    expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas, 'luis')).toBe('10.00');
    expect(calcularConsolidadoMer(etapas, ['a', 'b'], notas.slice(0, -1), 'luis')).toBeNull();
  });
  const cerradas = (escrita: [string, string], oral: [string, string]) => [
    { idEtapaRubrica: 'escrita', idAsignacionTribunal: 'a', idEstudiante: null, estado: 'CERRADA', total: escrita[0] },
    { idEtapaRubrica: 'escrita', idAsignacionTribunal: 'b', idEstudiante: null, estado: 'CERRADA', total: escrita[1] },
    { idEtapaRubrica: 'oral', idAsignacionTribunal: 'a', idEstudiante: 'juan', estado: 'CERRADA', total: oral[0] },
    { idEtapaRubrica: 'oral', idAsignacionTribunal: 'b', idEstudiante: 'juan', estado: 'CERRADA', total: oral[1] },
  ];
  const partes = (escrita: string, oral: string) => [
    { id: 'escrita', scope: 'TRABAJO_COMPARTIDO', porcentaje: null, calificacionMaxima: escrita },
    { id: 'oral', scope: 'ESTUDIANTE_INDIVIDUAL', porcentaje: null, calificacionMaxima: oral },
  ];

  it('rúbrica oficial 5 + 5: la nota final es la suma de las partes (4.5 + 4 = 8.50)', () => {
    expect(calcularConsolidadoMer(partes('5.00', '5.00'), ['a', 'b'], cerradas(['4.5', '4.5'], ['4', '4']), 'juan')).toBe('8.50');
  });

  it('partes de distinto valor 3 + 7: pesan 30 % y 70 %, no 50 % y 50 %', () => {
    // Suma de las partes: 3 + 3.5 = 6.50 sobre 10. Repartido por igual habría dado (3/3 + 3.5/7) × 5 = 7.50.
    expect(calcularConsolidadoMer(partes('3.00', '7.00'), ['a', 'b'], cerradas(['3', '3'], ['3.5', '3.5']), 'juan')).toBe('6.50');
  });

  it('partes de 10 + 10 sin porcentajes: 50 % y 50 %, sobre 10', () => {
    expect(calcularConsolidadoMer(partes('10.00', '10.00'), ['a', 'b'], cerradas(['8', '9'], ['7', '7']), 'juan')).toBe('7.75');
  });
});

it.each([[10, '7.00'], [20, '13.99'], [100, '69.96']])(
  'aplica la escala %i antes de redondear el resultado consolidado', (escala, esperado) => {
    const etapas = [
      { id: 'escrita', scope: 'TRABAJO_COMPARTIDO', porcentaje: '60', calificacionMaxima: '10' },
      { id: 'oral', scope: 'ESTUDIANTE_INDIVIDUAL', porcentaje: '40', calificacionMaxima: '10' },
    ];
    const notas = [
      { idEtapaRubrica: 'escrita', idAsignacionTribunal: 'a', idEstudiante: null, estado: 'CERRADA', total: '7.02' },
      { idEtapaRubrica: 'oral', idAsignacionTribunal: 'a', idEstudiante: 'juan', estado: 'CERRADA', total: '6.96' },
    ];
    expect(calcularConsolidadoMer(etapas, ['a'], notas, 'juan', escala)).toBe(esperado);
  },
);
