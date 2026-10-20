import { describe, expect, it } from 'vitest';
import { mensajeErrorEscrituraRubrica, prepararVersionApiParaGuardar, sumarMaximosRubrica } from './rubricasApiEdicion';

describe('preparación precisa de borradores API', () => {
  const version = {
    id: 'version-api', fuenteDatos: 'api', estado: 'BORRADOR', revision: 4,
    etapas: [{ id: 'etapa-1', maximoDecimal: '0.33' }],
    categorias: [{ id: 'categoria-1', etapa: 'etapa-1', maximoDecimal: '0.33', indicadores: [
      { id: 'indicador-1', maximoDecimal: '0.33', descripcion: 'texto' },
      { id: 'indicador-2', maximoDecimal: '0.33', descripcion: 'texto 2' },
    ] }],
  };

  it('suma decimales con centésimas exactas y conserva UUID y revisión', () => {
    const editadas = structuredClone(version);
    editadas.categorias[0].indicadores[0].maximoDecimal = '0.10';
    editadas.categorias[0].indicadores[1].maximoDecimal = '0.20';
    const preparada = prepararVersionApiParaGuardar(editadas, editadas.etapas, editadas.categorias);
    expect(preparada).toMatchObject({ id: 'version-api', revision: 4 });
    expect(preparada.etapas[0].maximoDecimal).toBe('0.30');
    expect(preparada.categorias[0].maximoDecimal).toBe('0.30');
    expect(preparada.categorias[0].indicadores.map(({ id }) => id)).toEqual(['indicador-1', 'indicador-2']);
    expect(sumarMaximosRubrica(['0.33', '0.33', '0.34'])).toBe('1.00');
  });

  it('rechaza texto decimal inválido sin normalizarlo ni redondearlo', () => {
    expect(() => sumarMaximosRubrica(['0.335'])).toThrow(/decimal válido/i);
    expect(() => sumarMaximosRubrica(['-0.10'])).toThrow(/decimal válido/i);
  });

  it('explica conflictos y conserva los cambios para recarga explícita', () => {
    expect(mensajeErrorEscrituraRubrica({ status: 409 })).toMatch(/cambió/i);
    expect(mensajeErrorEscrituraRubrica({ status: 403 })).toMatch(/autorizó/i);
    expect(mensajeErrorEscrituraRubrica({ name: 'ErrorConexionApi' })).toMatch(/cambios locales siguen disponibles/i);
  });
});
