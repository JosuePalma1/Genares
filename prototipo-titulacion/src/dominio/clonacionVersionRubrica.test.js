import { describe, expect, it } from 'vitest';
import {
  crearEstructuraEditorDesdeVersion,
  estructuraEditorCoincideConVersion,
  prepararClonVersionRubrica,
} from './clonacionVersionRubrica';

const base = () => ({
  id: 'version-v1',
  idRubrica: 'familia-1',
  fuenteDatos: 'api',
  modalidadId: 'modalidad-1',
  periodoId: 'periodo-1',
  titulo: 'Rúbrica institucional',
  etapas: [
    { id: 'etapa-oral', codigo: 'ORA', nombre: 'Oral', alcance: 'ESTUDIANTE_INDIVIDUAL', descripcion: null, orden: 2 },
    { id: 'etapa-esc', codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', descripcion: 'Informe', orden: 1 },
  ],
  categorias: [
    { id: 'cat-esc', etapa: 'etapa-esc', codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
      { id: 'ind-esc', label: 'I1', descripcion: 'Indicador escrito', maximoDecimal: '10.00', orden: 1 },
    ] },
    { id: 'cat-oral', etapa: 'etapa-oral', codigo: 'C2', nombre: 'Defensa', orden: 1, indicadores: [
      { id: 'ind-oral', label: 'I2', descripcion: 'Indicador oral', maximoDecimal: '10.00', orden: 1 },
    ] },
  ],
  carreras: [{ id: 'carrera-1', vigente: true }],
});

describe('clonación de versiones de rúbrica', () => {
  it('precarga etapas ordenadas, ámbitos y ponderaciones exactas en objetos independientes', () => {
    const origen = base();
    const antes = structuredClone(origen);
    const clon = prepararClonVersionRubrica(origen);

    expect(clon.datos.etapas.map(({ nombre, alcance }) => [nombre, alcance])).toEqual([
      ['Escrita', 'TRABAJO_COMPARTIDO'],
      ['Oral', 'ESTUDIANTE_INDIVIDUAL'],
    ]);
    expect(clon.datos.etapas[0].categorias[0].indicadores[0].calificacionMaxima).toBe('10.00');
    expect(clon.datos.etapas[0].claveLocal).not.toBe(origen.etapas[1].id);
    expect(clon.datos.etapas[0].categorias[0].claveLocal).not.toBe(origen.categorias[0].id);
    expect(clon.datos.etapas[0].categorias[0].indicadores[0].claveLocal).not.toBe(origen.categorias[0].indicadores[0].id);
    expect(origen).toEqual(antes);
    expect(clon.seleccionCarreras).toEqual({ 'carrera-1': { vigente: false } });
  });

  it('detecta copia directa sin cambios y envío integral al editar ponderación u orden', () => {
    const version = base();
    const etapas = crearEstructuraEditorDesdeVersion(version);
    expect(estructuraEditorCoincideConVersion(etapas, version)).toBe(true);
    expect(estructuraEditorCoincideConVersion([
      { ...etapas[0], categorias: [{ ...etapas[0].categorias[0], indicadores: [{ ...etapas[0].categorias[0].indicadores[0], calificacionMaxima: '9.99' }] }] },
      etapas[1],
    ], version)).toBe(false);
    expect(estructuraEditorCoincideConVersion([...etapas].reverse(), version)).toBe(false);
  });
});
