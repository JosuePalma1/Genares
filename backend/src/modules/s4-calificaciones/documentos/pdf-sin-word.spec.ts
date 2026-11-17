import { DatosDocumentales } from './modelo-documental';
import { camposPat01, camposPat04, pdfPat01, pdfPat04 } from './pdf-pat-04';
import { dibujarActaPdf, rellenarActa } from './pdf-actas';
import { fechaSustentacionActa, numeroEnLetras } from './reglas-acta';
import { dibujarRubricaPdf } from './pdf-rubrica';
import { camposRubricaEnBlanco } from './pdf-documental';

function datos(): DatosDocumentales {
  return {
    trabajo: { id: 't', codigo: 'T1', titulo: 'Proyecto sintético con un título bastante largo para comprobar el ajuste de línea', carrera: 'Tecnologías de la Información', modalidad: 'Proyecto Integrador' },
    estudiantes: [{ id: 'a', nombres: 'Ana María', apellidos: 'Prueba Ñáñez', identificacion: 'FICTICIA' }],
    consolidacion: { estudiantes: [{ estudiante: { id: 'a' }, etapas: [
      { kind: 'ESCRITA', scope: 'TRABAJO_COMPARTIDO', calificacionMaxima: '10.00', promedioEtapa: { exacto: { numerador: '93', denominador: '10' } } },
      { kind: 'ORAL', scope: 'ESTUDIANTE_INDIVIDUAL', calificacionMaxima: '10.00', promedioEtapa: { exacto: { numerador: '87', denominador: '10' } } },
    ] }] },
  } as unknown as DatosDocumentales;
}

const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('PDF generados con pdfkit, sin Word', () => {
  it('rellena el acta PAT-04-F-017 con los datos y la nota en letras al lado de cada nota', () => {
    const bloques = rellenarActa('PAT-04-F-017', camposPat04(datos(), 'a', 'No. 002-2026-2-TI', '9.00', true));
    const texto = JSON.stringify(bloques);
    expect(texto).toContain('COMPLEXIVO No. 002-2026-2-TI');
    expect(texto).toContain('Ana María Prueba Ñáñez con número de identificación FICTICIA');
    expect(texto).toContain('“Proyecto sintético con un título bastante largo');
    expect(texto).toContain('declara APROBADO');
    expect(texto).toContain('CARRERA:       Tecnologías de la Información');
    const tabla = bloques.find((b) => b.tipo === 'tabla') as { filas: string[][] };
    expect(tabla.filas.slice(1)).toEqual([
      ['Trabajo de Integración curricular/Trabajo escrito', '9.30/10', 'nueve coma tres cero'],
      ['Sustentación/Componente oral', '8.70/10', 'ocho coma siete cero'],
      ['Calificación final de titulación', '9.00/10', 'nueve coma cero cero'],
    ]);
  });

  it('rellena las tres notas XX/10 del acta PAT-01-F-019 en su orden', () => {
    const bloques = rellenarActa('PAT-01-F-019', camposPat01(datos(), 'a', 'No. 001-2026-2-TI', '9.00', false));
    const tabla = bloques.find((b) => b.tipo === 'tabla') as { filas: string[][] };
    expect(tabla.filas.slice(1).map((f) => f[1])).toEqual(['9.30/10', '8.70/10', '9.00/10']);
    expect(JSON.stringify(bloques)).toContain('declara REPROBADO');
    expect(JSON.stringify(bloques)).toContain('denominado «Proyecto sintético');
  });

  it('imprime la escala final configurada y conserva la presentación de los componentes', () => {
    const modelo = datos();
    modelo.consolidacion.estudiantes[0].resultadoFinal = {
      calificacion: '100.00', calificacionMaxima: '100.00',
      exacto: { numerador: '100', denominador: '1', unidad: 'PUNTOS' }, redondeo: 'HALF_UP_A_DOS_DECIMALES',
    };
    for (const campos of [camposPat04, camposPat01]) {
      const notas = campos(modelo, 'a', 'No. 003', '100.00', true).filter((campo): campo is { original: string; valor: string; letras: string } => 'letras' in campo);
      expect(notas.map((campo) => campo.valor)).toEqual(['9.30/10', '8.70/10', '100.00/100']);
      expect(notas[2].letras).toBe('cien coma cero cero');
    }
  });

  it('marca la nota como pendiente si aún no hay resultado final', () => {
    const bloques = rellenarActa('PAT-04-F-017', camposPat04(datos(), 'a', 'No. (sin número)'));
    expect(JSON.stringify(bloques)).toContain('RESULTADO PENDIENTE');
    expect((bloques.find((b) => b.tipo === 'tabla') as { filas: string[][] }).filas[3]).toEqual(['Calificación final de titulación', 'Pendiente', 'Pendiente']);
  });

  it('avisa si la plantilla no tiene un marcador y no modifica la plantilla original', () => {
    expect(() => rellenarActa('PAT-04-F-017', [{ original: 'NO EXISTE', valor: 'x' }])).toThrow('Falta un marcador en la plantilla: NO EXISTE');
    rellenarActa('PAT-04-F-017', camposPat04(datos(), 'a', 'No. 1', '9.00', true));
    expect(JSON.stringify(rellenarActa('PAT-04-F-017', []))).toContain('16/20');
  });

  it('genera las dos actas como PDF de una página', async () => {
    for (const pdf of [await pdfPat04(datos(), 'a', 'No. 002', '9.00', true), await pdfPat01(datos(), 'a', 'No. 001', '9.00', true)]) {
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(paginas(pdf)).toBe(1);
    }
    await expect(dibujarActaPdf('PAT-04-F-017', [])).resolves.toBeInstanceOf(Buffer);
  });

  it('prepara la vista previa de una versión en blanco, con los textos de la plantilla y sin notas', async () => {
    const indicador = (descripcion: string, maximo: string) => ({ label: 'I1', descripcion, calificacionMaxima: maximo });
    const campos = camposRubricaEnBlanco({
      modalidad: 'Proyecto Integrador',
      etapas: [
        { nombre: 'Revisión proyecto escrito', calificacionMaxima: '5.00', porcentaje: '50.00', categorias: [
          { nombre: 'Resumen e introducción', calificacionMaxima: '1.00', indicadores: [indicador('El resumen', '0.33'), indicador('El problema', '0.33'), indicador('La introducción', '0.34')] },
        ] },
        { nombre: 'Sustentación del proyecto', calificacionMaxima: '5.00', porcentaje: '50.00', categorias: [
          { nombre: 'Conclusiones y Propuesta', calificacionMaxima: '2.50', indicadores: [indicador('', '2.50')] },
        ] },
      ],
    });
    expect(campos.modalidad).toBe('PROYECTO INTEGRADOR');
    expect(campos.partes.map((p) => `PARTE ${p.numero} · ${p.titulo}`)).toEqual([
      'PARTE I · REVISIÓN PROYECTO ESCRITO (50%) 5 PUNTOS', 'PARTE II · SUSTENTACIÓN DEL PROYECTO (50%) 5 PUNTOS',
    ]);
    expect(campos.partes[0].categorias[0].titulo).toBe('A. Resumen e introducción (1 punto)');
    expect(campos.partes[1].categorias[0].titulo).toBe('B. Conclusiones y Propuesta (2.5 puntos)');
    expect(campos.partes[0].categorias[0].filas[0]).toEqual({ texto: 'El resumen', valor: '0.33', nota: '' });
    // Sin descripción se usa el código del indicador para no dejar la fila vacía.
    expect(campos.partes[1].categorias[0].filas[0].texto).toBe('I1');
    expect(campos.estudiante).toBe('');
    expect(campos.resumen.filas).toEqual([{ texto: 'A. Resumen e introducción', valor: '1.00', nota: '' }, { texto: 'B. Conclusiones y Propuesta', valor: '2.50', nota: '' }]);
    expect(paginas(await dibujarRubricaPdf(campos))).toBe(2);
  });

  it('genera la rúbrica con una página por parte y añade páginas si no cabe', async () => {
    const fila = { texto: 'Indicador con descripción larga que ocupa varias líneas en la tabla de la rúbrica oficial de la facultad', valor: '1.00', nota: '' };
    const categoria = (n: number) => ({ titulo: `${String.fromCharCode(64 + n)}. Categoría (3 puntos)`, filas: [fila, fila, fila], sumatoria: { valor: '3.00', nota: '' } });
    const campos = (categorias: number) => ({
      modalidad: 'PROYECTO INTEGRADOR', trabajo: 'Proyecto', estudiante: 'Ana', tutor: '',
      partes: ['I', 'II'].map((numero) => ({ numero, titulo: 'ETAPA (50%) 5 PUNTOS', categorias: Array.from({ length: categorias }, (_, i) => categoria(i + 1)) })),
      resumen: { filas: [{ texto: 'A. Categoría', valor: '3.00', nota: '' }], final: { valor: '10.00', nota: '' } },
    });
    const corta = await dibujarRubricaPdf(campos(2));
    expect(corta.subarray(0, 5).toString()).toBe('%PDF-');
    expect(paginas(corta)).toBe(2);
    expect(paginas(await dibujarRubricaPdf(campos(8)))).toBeGreaterThan(2);
  });
});

describe('actas: fecha de la sustentación; las firmas quedan para la facultad', () => {
  const conSesion = () => ({
    ...datos(),
    sesiones: [{ estudianteId: 'a', fecha: '2026-12-01', hora: '08:00' }, { estudianteId: 'a', fecha: '2026-12-15', hora: '09:30' }],
    evaluadores: [{ id: 'm1', nombres: 'Uno', apellidos: 'Docente', posicion: 1 }, { id: 'm2', nombres: 'Dos', apellidos: 'Docente', posicion: 2 }],
    tutor: { nombres: 'Tutora', apellidos: 'Ficticia' },
  } as unknown as DatosDocumentales);

  it('escribe la fecha y la hora en letras como en las actas', () => {
    expect(fechaSustentacionActa('2026-12-15', '09:30')).toEqual({
      enLetras: 'a los quince días del mes de diciembre del dos mil veintiséis, siendo las 09h30',
      numerica: '15 de diciembre del 2026',
    });
    expect(fechaSustentacionActa('2027-01-01', '08:00').enLetras).toBe('al primer día del mes de enero del dos mil veintisiete, siendo las 08h00');
    expect(numeroEnLetras(31)).toBe('treinta y uno');
    expect(() => fechaSustentacionActa('15/12/2026', '09:30')).toThrow();
  });

  it('usa la última sesión programada del estudiante en las dos actas', () => {
    const pat04 = JSON.stringify(rellenarActa('PAT-04-F-017', camposPat04(conSesion(), 'a', 'No. 1', '9.00', true)));
    expect(pat04).toContain('a los quince días del mes de diciembre del dos mil veintiséis, siendo las 09h30');
    expect(pat04).toContain('Lugar, 15 de diciembre del 2026.');
    const pat01 = JSON.stringify(rellenarActa('PAT-01-F-019', camposPat01(conSesion(), 'a', 'No. 1', '9.00', true)));
    expect(pat01).toContain('En la ciudad de Manta, a los quince días del mes de diciembre');
    expect(pat01).toContain('Manta, 15 de diciembre del 2026.');
  });

  it('sin sesión programada conserva los huecos del formato', () => {
    const texto = JSON.stringify(rellenarActa('PAT-04-F-017', camposPat04(datos(), 'a', 'No. 1')));
    expect(texto).toContain('a los xx días del mes xxxx');
    expect(texto).toContain('Lugar, xx de xxxx del 20xx.');
  });

  it('no rellena las firmas: títulos y nombres los completa la facultad a mano', () => {
    const bloques = rellenarActa('PAT-04-F-017', camposPat04(conSesion(), 'a', 'No. 1', '9.00', true));
    const firmas = JSON.stringify(bloques.filter((bloque) => bloque.tipo === 'firmas'));
    expect(firmas).toContain('… (Título académico) …(Nombres)');
    expect(firmas).toContain('Sr/Señora/Señorita …(Nombres)');
    expect(firmas).not.toContain('Uno Docente');
  });

  it('las dos actas con fecha y firmantes siguen ocupando una página', async () => {
    for (const pdf of [await pdfPat04(conSesion(), 'a', 'No. 2', '9.00', true), await pdfPat01(conSesion(), 'a', 'No. 1', '9.00', true)]) {
      expect(paginas(pdf)).toBe(1);
    }
  });
});
