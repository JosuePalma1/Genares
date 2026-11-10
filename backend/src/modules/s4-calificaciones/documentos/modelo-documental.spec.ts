import { DatosDocumentales, pendientesActa, resultadoFinalActa, rubricaDocumental } from './modelo-documental';
import { pdfActaInterna, pdfActaPreliminar, pdfRubrica } from './pdf-documental';
import { DocumentosService } from './documentos.service';

function fixture(): DatosDocumentales {
  return {
    trabajo: { id: 't', codigo: 'T1', titulo: 'Proyecto sintético', carreraId: 'c', carreraCodigo: 'TI', carrera: 'Tecnologías', periodoId: 'p', periodo: '2026-2', modalidad: 'Proyecto Integrador' },
    estudiantes: [{ id: 'a', nombres: 'Ana', apellidos: 'Prueba', identificacion: 'FICTICIA' }, { id: 'b', nombres: 'Beto', apellidos: 'Prueba', identificacion: 'FICTICIO' }],
    evaluadores: [{ id: 'm1', nombres: 'Uno', apellidos: 'Prueba' }, { id: 'm2', nombres: 'Dos', apellidos: 'Prueba' }], tutor: null,
    rubrica: { rubricVersionId: 'v', rubricName: 'Prueba', version: '1', stages: [
      { id: 's1', kind: 'PERSONALIZADA', nombre: 'Etapa compartida', scope: 'TRABAJO_COMPARTIDO', calificacionMaxima: '10.00' },
      { id: 's2', kind: 'PERSONALIZADA', nombre: 'Etapa propia', scope: 'ESTUDIANTE_INDIVIDUAL', calificacionMaxima: '10.00' },
    ], categories: ['s1', 's2'].map((id) => ({ id: `c${id}`, stageId: id, nombre: 'Criterio íntegro', calificacionMaxima: '10.00', indicators: [{ id: `i${id}`, label: 'Indicador ñ y tildes', descripcion: 'Texto original', calificacionMaxima: '10.00' }] })) },
    evaluaciones: ['m1', 'm2'].flatMap((m, pos) => [
      { id: `comp-${m}`, idVersionRubrica: 'v', idEtapaRubrica: 's1', idMiembroTribunal: m, idEstudiante: null, estado: 'CERRADA', calificacionTotal: pos ? '9.40' : '9.20', estudiantesTraspasados: [{ idEstudiante: 'a' }, { idEstudiante: 'b' }], puntajes: [{ idIndicador: 'is1', puntaje: pos ? '9.40' : '9.20' }] },
      ...['a', 'b'].map((e) => ({ id: `oral-${m}-${e}`, idVersionRubrica: 'v', idEtapaRubrica: 's2', idMiembroTribunal: m, idEstudiante: e, estado: 'CERRADA', calificacionTotal: e === 'a' ? '8.50' : '9.10', estudiantesTraspasados: [], puntajes: [{ idIndicador: 'is2', puntaje: e === 'a' ? '8.50' : '9.10' }] })),
    ]),
    consolidacion: { estudiantes: [{ estudiante: { id: 'a' }, estado: 'RESULTADO_COMPLETO', etapas: [
      { nombre: 'Etapa compartida', alcance: 'TRABAJO_COMPARTIDO', estado: 'COMPLETA', promedioEtapa: { exacto: { numerador: '93', denominador: '10' }, presentado: '9.30' } },
      { nombre: 'Etapa propia', alcance: 'ESTUDIANTE_INDIVIDUAL', estado: 'COMPLETA', promedioEtapa: { exacto: { numerador: '87', denominador: '10' }, presentado: '8.70' } },
    ], resultadoFinal: { exacto: { numerador: '9', denominador: '1' }, calificacion: '9.00', calificacionMaxima: '10.00' } }] },
  } as unknown as DatosDocumentales;
}

describe('Documentos de rúbricas y actas internas', () => {
  it('conserva evaluador, estudiante, orden, texto, máximos y traspasos sin duplicar notas', () => {
    const datos = fixture(); const antes = JSON.stringify(datos);
    const a = rubricaDocumental(datos, 'a', 'm1'); const b = rubricaDocumental(datos, 'b', 'm1');
    expect(a.etapas.map((e) => e.total)).toEqual(['9.20', '8.50']);
    expect(b.etapas.map((e) => e.total)).toEqual(['9.20', '9.10']);
    expect(rubricaDocumental(datos, 'a', 'm2').etapas[0].total).toBe('9.40');
    expect(a.etapas[0]).toMatchObject({ traspaso: true, evaluacionId: 'comp-m1', maximo: '10.00' });
    expect(a.etapas[0].categorias[0]).toMatchObject({ subtotal: '9.20', filas: [{ indicador: 'Indicador ñ y tildes', descripcion: 'Texto original', nota: '9.20' }] });
    expect(JSON.stringify(datos)).toBe(antes);
  });
  it('no asigna una evaluación compartida cerrada sin asociación de traspaso', () => {
    const datos = fixture(); datos.evaluaciones[0].estudiantesTraspasados = [];
    expect(rubricaDocumental(datos, 'a', 'm1').etapas[0]).toMatchObject({ estado: 'INCOMPLETA', total: null });
  });
  it('no presenta borradores ni notas faltantes como rúbricas cerradas', () => {
    const datos = fixture(); datos.evaluaciones[0].estado = 'BORRADOR';
    expect(rubricaDocumental(datos, 'a', 'm1')).toMatchObject({ estado: 'INCOMPLETA', etapas: [expect.objectContaining({ total: null }), expect.anything()] });
    datos.evaluaciones[0].estado = 'CERRADA'; datos.evaluaciones[0].puntajes = [];
    expect(rubricaDocumental(datos, 'a', 'm1').estado).toBe('INCOMPLETA');
  });
  it('rechaza destinatarios ajenos y fuentes duplicadas', () => {
    const datos = fixture();
    expect(() => rubricaDocumental(datos, 'ajeno', 'm1')).toThrow();
    expect(() => rubricaDocumental(datos, 'a', 'ajeno')).toThrow();
    datos.evaluaciones.push(datos.evaluaciones[0]);
    expect(() => rubricaDocumental(datos, 'a', 'm1')).toThrow();
  });
  it('admite etapas personalizadas y ámbitos combinados sin inferir escrita u oral', () => {
    const datos = fixture();
    datos.rubrica.stages.push({ id: 's3', kind: 'PERSONALIZADA', nombre: 'Etapa de síntesis', scope: 'TRABAJO_COMPARTIDO', calificacionMaxima: '10.00' } as never);
    (datos.consolidacion.estudiantes as Array<Record<string, any>>)[0].etapas.push({ nombre: 'Etapa de síntesis', alcance: 'TRABAJO_COMPARTIDO', estado: 'COMPLETA', promedioEtapa: { exacto: { numerador: '9', denominador: '1' }, presentado: '9.00' } });
    expect(pendientesActa(datos, 'a')).toEqual([]);
    expect(resultadoFinalActa(datos, 'a').calificacion).toBe('9.00');
  });
  it('informa evaluaciones ausentes, en progreso, cierres pendientes y evaluadores pendientes', () => {
    const datos = fixture();
    const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)[0];
    consolidacion.estado = 'EVALUACIONES_CERRADAS_INCOMPLETAS';
    consolidacion.resultadoFinal = null;
    consolidacion.etapas[0] = { nombre: 'Etapa compartida', estado: 'CERRADA_INCOMPLETA', evaluadoresPendientes: [{ posicion: 2 }] };
    expect(pendientesActa(datos, 'a').join(' ')).toContain('Etapa «Etapa compartida»: evaluador 2 pendientes.');
    consolidacion.estado = 'EN_PROGRESO';
    expect(pendientesActa(datos, 'a').join(' ')).toContain('evaluaciones en progreso');
    consolidacion.estado = 'SIN_EVALUACIONES';
    expect(pendientesActa(datos, 'a').join(' ')).toContain('No hay evaluaciones dinámicas');
  });
  it('separa fuentes legacy sin reinterpretarlas', () => {
    const datos = fixture(); datos.evaluaciones[0].idEtapaRubrica = null;
    expect(rubricaDocumental(datos, 'a', 'm1')).toMatchObject({ legacyExcluidas: 1, estado: 'INCOMPLETA' });
  });
  it('genera previsualizaciones y actas numeradas en ambos formatos con el resultado sobre 10', async () => {
    const datos = fixture();
    const pdfs = await Promise.all([
      pdfRubrica(rubricaDocumental(datos, 'a', 'm1')),
      pdfActaPreliminar(datos, 'a', 'PAT-01-F-019', pendientesActa(datos, 'a')),
      pdfActaPreliminar(datos, 'a', 'PAT-04-F-017', pendientesActa(datos, 'a')),
      pdfActaInterna(datos, 'a', 'PAT-01-F-019', '001-2026-2-TI', '9.00', '7.00', true),
      pdfActaInterna(datos, 'a', 'PAT-04-F-017', '002-2026-2-TI', '9.00', '7.00', true),
    ]);
    for (const pdf of pdfs) { expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(pdf.length).toBeGreaterThan(2000); }
  });
  it('no archiva cuando faltan evaluaciones obligatorias', async () => {
    const datos = fixture();
    (datos.consolidacion.estudiantes as Array<Record<string, any>>)[0].estado = 'EN_PROGRESO';
    (datos.consolidacion.estudiantes as Array<Record<string, any>>)[0].resultadoFinal = null;
    const db = { query: jest.fn(), transaction: jest.fn() };
    const evaluaciones = { datosDocumentales: jest.fn().mockResolvedValue(datos) };
    const servicio = new DocumentosService(db as never, evaluaciones as never);
    await expect(servicio.emitir('t', 'a', { formato: 'PAT-04-F-017' }, 'actor')).rejects.toThrow('No se puede generar todavía');
    expect(db.query).not.toHaveBeenCalled(); expect(db.transaction).not.toHaveBeenCalled();
  });
});