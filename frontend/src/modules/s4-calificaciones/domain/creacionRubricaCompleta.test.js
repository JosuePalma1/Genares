import { describe, expect, it } from 'vitest';
import {
  agregarCategoriaRubrica,
  agregarEtapaRubrica,
  agregarIndicadorRubrica,
  cambiarEtapaRubrica,
  centesimasPonderacion,
  crearEstructuraInicialRubrica,
  eliminarCategoriaRubrica,
  eliminarEtapaRubrica,
  eliminarIndicadorRubrica,
  formatearCentesimas,
  aplicarAtajoEsquemaRubrica,
  cambiarModoEsquemaRubrica,
  moverElementoRubrica,
  pesosEtapasPorValor,
  resumenEsquemaRubrica,
  resumenPonderacionEtapa,
  subtotalCategoriaCompleta,
  subtotalEtapaCompleta,
  validarRubricaCompleta,
} from './creacionRubricaCompleta';

function etapaCompleta(alcance = 'TRABAJO_COMPARTIDO') {
  const etapas = crearEstructuraInicialRubrica();
  const etapa = etapas[0];
  const conCategoria = agregarCategoriaRubrica(etapas, etapa.claveLocal);
  const categoria = conCategoria[0].categorias[0];
  const conIndicadores = agregarIndicadorRubrica(conCategoria, etapa.claveLocal, categoria.claveLocal);
  const lista = conIndicadores[0].categorias[0].indicadores;
  return cambiarEtapaRubrica(conIndicadores, etapa.claveLocal, {
    alcance,
    categorias: [{
      ...conIndicadores[0].categorias[0],
      indicadores: lista.map((indicador, indice) => ({
        ...indicador,
        descripcion: `Criterio ${indice + 1}`,
        calificacionMaxima: indice === 0 ? '6.25' : '3.75',
      })),
    }],
  })[0];
}

describe('editor integral de rúbrica', () => {
  it('inicia con Escrita compartida y Oral individual sin fijar sus nombres ni ámbitos después', () => {
    const etapas = crearEstructuraInicialRubrica();
    expect(etapas.map(({ nombre, alcance }) => [nombre, alcance])).toEqual([
      ['Escrita', 'TRABAJO_COMPARTIDO'],
      ['Oral', 'ESTUDIANTE_INDIVIDUAL'],
    ]);
    const editada = cambiarEtapaRubrica(etapas, etapas[0].claveLocal, { nombre: 'Análisis', alcance: 'ESTUDIANTE_INDIVIDUAL' });
    expect(editada[0]).toMatchObject({ nombre: 'Análisis', alcance: 'ESTUDIANTE_INDIVIDUAL' });
  });

  it('agrega, elimina y reordena etapas, categorías e indicadores con claves sin colisión', () => {
    const iniciales = crearEstructuraInicialRubrica();
    const conEtapa = agregarEtapaRubrica(iniciales);
    expect(conEtapa).toHaveLength(3);
    expect(new Set(conEtapa.map(({ claveLocal }) => claveLocal)).size).toBe(3);
    expect(moverElementoRubrica(conEtapa, 2, -1)[1].claveLocal).toBe(conEtapa[2].claveLocal);
    expect(eliminarEtapaRubrica(conEtapa, conEtapa[2].claveLocal)).toHaveLength(2);

    let estructura = agregarCategoriaRubrica(iniciales, iniciales[0].claveLocal);
    const categoria = estructura[0].categorias[0];
    estructura = agregarCategoriaRubrica(estructura, iniciales[0].claveLocal);
    expect(estructura[0].categorias).toHaveLength(2);
    expect(eliminarCategoriaRubrica(estructura, iniciales[0].claveLocal, categoria.claveLocal)[0].categorias).toHaveLength(1);

    const segunda = estructura[0].categorias[1];
    estructura = agregarIndicadorRubrica(estructura, iniciales[0].claveLocal, segunda.claveLocal);
    const indicadores = estructura[0].categorias[1].indicadores;
    expect(indicadores).toHaveLength(2);
    expect(moverElementoRubrica(indicadores, 1, -1)[0].claveLocal).toBe(indicadores[1].claveLocal);
    expect(eliminarIndicadorRubrica(estructura, iniciales[0].claveLocal, segunda.claveLocal, indicadores[0].claveLocal)[0].categorias[1].indicadores).toHaveLength(1);
  });

  it('suma importes decimales exactos en centésimas y presenta subtotal y total', () => {
    expect(centesimasPonderacion('0.10')).toBe(10n);
    expect(formatearCentesimas(1000n)).toBe('10.00');
    const etapa = etapaCompleta();
    expect(subtotalCategoriaCompleta(etapa.categorias[0])).toBe(1000n);
    expect(subtotalEtapaCompleta(etapa)).toBe(1000n);
    expect(resumenPonderacionEtapa(etapa)).toMatchObject({ total: 1000n, estado: 'completa' });
    expect(resumenPonderacionEtapa({ ...etapa, categorias: [] }).estado).toBe('incompleta');
  });

  it('valida ámbito editable y acepta que cada etapa valga lo que suman sus indicadores', () => {
    const completa = etapaCompleta();
    const formulario = {
      nombre: 'Rúbrica de prueba', version: '1.0', modalidadId: 'modalidad', periodoId: 'periodo',
      carreras: [{ carreraId: 'carrera', revision: 1, vigente: false, vigenciaEsperada: { versionId: null } }],
      etapas: [completa],
    };
    expect(validarRubricaCompleta(formulario)).toEqual([]);
    const peso = (total) => ({ ...completa, categorias: completa.categorias.map((categoria) => ({
      ...categoria,
      indicadores: categoria.indicadores.map((indicador, indice) => ({ ...indicador, calificacionMaxima: indice ? '3.75' : total })),
    })) });
    // Escalas configurables (16/11/2026): con porcentajes, 9.99 o 10.01 son válidos; solo se rechaza pasar de 100.00.
    const conPesos = (etapa) => ({ ...formulario, esquema: { modo: 'PORCENTAJES' }, etapas: [{ ...etapa, porcentaje: '100' }] });
    expect(validarRubricaCompleta(conPesos(peso('6.24')))).toEqual([]);
    expect(validarRubricaCompleta(conPesos(peso('6.26')))).toEqual([]);
    // «Sumar puntos»: la única parte debe dar la nota final 10.00.
    expect(validarRubricaCompleta({ ...formulario, etapas: [peso('6.24')] }).map(({ campo }) => campo)).toEqual(['esquema']);
    expect(resumenPonderacionEtapa(peso('1.25'))).toMatchObject({ estado: 'completa', mensaje: 'La etapa vale 5.00 puntos.' });
    expect(validarRubricaCompleta({ ...formulario, etapas: [peso('99.00')] }).some(({ campo }) => campo.endsWith('.total'))).toBe(true);
    expect(validarRubricaCompleta({ ...formulario, etapas: [{ ...completa, alcance: 'OTRO' }] }).some(({ campo }) => campo.endsWith('.alcance'))).toBe(true);
  });
});

describe('códigos de categoría en toda la versión (decisión 2026-11-12)', () => {
  it('no repite el código entre la etapa escrita y la oral, porque la activación lo exige', () => {
    const [escrita, oral] = crearEstructuraInicialRubrica();
    let estructura = agregarCategoriaRubrica([escrita, oral], escrita.claveLocal);
    estructura = agregarCategoriaRubrica(estructura, escrita.claveLocal);
    estructura = agregarCategoriaRubrica(estructura, oral.claveLocal);
    expect(estructura.map((etapa) => etapa.categorias.map(({ codigo }) => codigo))).toEqual([['C1', 'C2'], ['C3']]);
  });
});

describe('peso de cada etapa en la nota final (igual que el servidor)', () => {
  it('reparte según lo que vale cada etapa', () => {
    expect(pesosEtapasPorValor([500n, 500n])).toEqual([50, 50]);
    expect(pesosEtapasPorValor([300n, 700n])).toEqual([30, 70]);
    expect(pesosEtapasPorValor([250n, 250n, 500n])).toEqual([25, 25, 50]);
  });

  it('no calcula nada mientras falte un total válido', () => {
    expect(pesosEtapasPorValor([500n, null])).toBeNull();
    expect(pesosEtapasPorValor([])).toBeNull();
  });
});

describe('esquema de calificación (primer paso de «Nueva rúbrica»)', () => {
  const parte = (valor, maximos) => ({
    claveLocal: valor, codigo: `E${valor}`, nombre: 'Parte', alcance: 'TRABAJO_COMPARTIDO', valor, porcentaje: '',
    categorias: [{ claveLocal: 'c', codigo: 'C1', nombre: 'Categoría', indicadores: maximos.map((maximo, i) => ({ claveLocal: `i${i}`, label: `I${i}`, descripcion: 'x', calificacionMaxima: maximo })) }],
  });

  it('la oficial 5 + 5 suma la nota final y cada parte llega a su valor', () => {
    const datos = aplicarAtajoEsquemaRubrica({ etapas: [parte('', ['1.00', '1.00', '3.00']), parte('', ['2.50', '2.50'])] }, 'OFICIAL_5_5');
    expect(datos.esquema).toEqual({ modo: 'SUMA' });
    expect(datos.etapas.map(({ valor }) => valor)).toEqual(['5.00', '5.00']);
    expect(resumenEsquemaRubrica(datos)).toMatchObject({ estado: 'completa' });
    expect(resumenPonderacionEtapa(datos.etapas[0])).toMatchObject({ estado: 'completa', mensaje: 'Completa: 5.00 de 5.00 puntos.' });
  });

  it('avisa cuánto falta o sobra respecto al valor declarado de la parte', () => {
    expect(resumenPonderacionEtapa(parte('5.00', ['1.00', '1.00']))).toMatchObject({ estado: 'faltante', mensaje: 'Faltan 3.00 de 5.00 puntos.' });
    expect(resumenPonderacionEtapa(parte('5.00', ['3.00', '3.00']))).toMatchObject({ estado: 'excedida' });
  });

  it('«sumar puntos» exige que las partes sumen 10.00', () => {
    expect(resumenEsquemaRubrica({ esquema: { modo: 'SUMA' }, etapas: [parte('4.00', ['4.00']), parte('4.00', ['4.00'])] }))
      .toMatchObject({ estado: 'faltante', mensaje: 'Las partes deben sumar 10.00 (suman 8.00). Ajuste los puntos o use porcentajes.' });
  });

  it('«porcentajes»: 10 + 10 al 50 %, y los pesos deben sumar 100', () => {
    const datos = aplicarAtajoEsquemaRubrica({ etapas: [parte('', ['10.00']), parte('', ['10.00'])] }, 'DIEZ_DIEZ_50');
    expect(datos.esquema).toEqual({ modo: 'PORCENTAJES' });
    expect(resumenEsquemaRubrica(datos)).toMatchObject({ estado: 'completa', mensaje: 'Los pesos suman 100 %.' });
    const mal = { ...datos, etapas: datos.etapas.map((etapa, i) => ({ ...etapa, porcentaje: i ? '40' : '50' })) };
    expect(resumenEsquemaRubrica(mal)).toMatchObject({ estado: 'faltante', mensaje: 'Los pesos deben sumar 100 % (suman 90.00 %).' });
  });

  it('al volver a «sumar puntos» se vacían los pesos para no guardarlos', () => {
    const datos = aplicarAtajoEsquemaRubrica({ etapas: [parte('', ['10.00']), parte('', ['10.00'])] }, 'DIEZ_DIEZ_50');
    expect(cambiarModoEsquemaRubrica(datos, 'SUMA').etapas.map(({ porcentaje }) => porcentaje)).toEqual(['', '']);
  });
});
