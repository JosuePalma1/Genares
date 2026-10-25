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
  moverElementoRubrica,
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

  it('valida ámbito editable y exige exactamente 10.00 por etapa', () => {
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
    expect(validarRubricaCompleta({ ...formulario, etapas: [peso('6.24')] }).some(({ campo }) => campo.endsWith('.total'))).toBe(true);
    expect(validarRubricaCompleta({ ...formulario, etapas: [peso('6.26')] }).some(({ campo }) => campo.endsWith('.total'))).toBe(true);
    expect(validarRubricaCompleta({ ...formulario, etapas: [{ ...completa, alcance: 'OTRO' }] }).some(({ campo }) => campo.endsWith('.alcance'))).toBe(true);
  });
});
