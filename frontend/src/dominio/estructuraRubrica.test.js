import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EditorEstructuraRubrica from '../componentes/EditorEstructuraRubrica';
import { mapearActualizarVersionRubricaDto } from '../adaptadores/rubricasEscritura';
import { prepararVersionApiParaGuardar } from './rubricasApiEdicion';
import { claveElemento, codigoIndicador, etapasParaEditor, moverElemento, nuevaCategoria, nuevoIndicador, ordenarEstructura, revisarEstructura, subtotalCategoria, subtotalEtapa } from './estructuraRubrica';

const version = { id: '22e5d7a9-2c3d-4c72-867b-cde5d0ceeb4e', revision: 4, estado: 'BORRADOR', fuenteDatos: 'api', etapas: [], categorias: [] };
function estructura() {
  const etapas = etapasParaEditor(version, true);
  const a = nuevaCategoria(etapas[0], [], true);
  const b = nuevaCategoria(etapas[0], [a], true);
  for (const [categoria, cantidad] of [[a, 2], [b, 5]]) {
    for (let indice = 0; indice < cantidad; indice += 1) {
      const indicador = nuevoIndicador(categoria.indicadores, true);
      categoria.indicadores.push({ ...indicador, descripcion: `Diseño ${indice}`, etiqueta: `Diseño ${indice}`, maximoDecimal: '0.10' });
    }
  }
  return { etapas, categorias: [a, b] };
}

describe('estructura variable del borrador', () => {
  it('admite A con 2 indicadores y B con 5 y obtiene subtotales exactos', () => {
    const { etapas, categorias } = estructura();
    expect(categorias.map((c) => c.indicadores.length)).toEqual([2, 5]);
    expect(categorias.map(subtotalCategoria)).toEqual(['0.20', '0.50']);
    expect(subtotalEtapa(etapas[0], categorias)).toBe('0.70');
    expect(revisarEstructura(etapas, categorias).errores).toEqual([]);
  });

  it('guarda grupos vacíos con subtotal cero y muestra la falta de indicadores para activar', () => {
    const etapas = etapasParaEditor(version, true);
    const categorias = [nuevaCategoria(etapas[0], [], true)];
    const revision = revisarEstructura(etapas, categorias);
    expect(revision.errores).toEqual([]);
    expect(revision.pendientes.join(' ')).toMatch(/indicador/);
    const ordenada = ordenarEstructura(etapas, categorias);
    const dto = mapearActualizarVersionRubricaDto(prepararVersionApiParaGuardar(version, ordenada.etapas, ordenada.categorias));
    expect(dto.etapas[0].calificacionMaxima).toBe('0.00');
    expect(dto.etapas[0].categorias[0]).toMatchObject({ calificacionMaxima: '0.00', indicadores: [] });
    expect(dto.etapas[1].categorias).toEqual([]);
    expect(dto.etapas[0]).not.toHaveProperty('id');
    expect(dto.etapas[0].categorias[0]).not.toHaveProperty('claveLocal');
  });

  it('reordena dentro del padre y genera órdenes globales de categoría y locales de indicador', () => {
    const { etapas, categorias } = estructura();
    const oral = nuevaCategoria(etapas[1], categorias, true);
    const copia = moverElemento([...categorias, oral], claveElemento(categorias[1]), -1, (c) => c.etapa === claveElemento(etapas[0]));
    const ordenada = ordenarEstructura(etapas, copia);
    expect(ordenada.categorias.map((c) => c.codigo)).toEqual(['B', 'A', 'C']);
    expect(ordenada.categorias.map((c) => c.orden)).toEqual([1, 2, 3]);
    expect(ordenada.categorias[0].indicadores.map((i) => i.orden)).toEqual([1, 2, 3, 4, 5]);
    expect(ordenada.categorias[2].etapa).toBe(claveElemento(etapas[1]));
    expect(categorias.map((c) => c.codigo)).toEqual(['A', 'B']);
  });

  it('no reutiliza claves eliminadas y no envía claves temporales como UUID', () => {
    const { etapas, categorias } = estructura();
    const eliminada = categorias[0].indicadores.shift();
    const nueva = nuevoIndicador(categorias[0].indicadores, true);
    expect(claveElemento(nueva)).not.toBe(claveElemento(eliminada));
    expect(nueva.id).toBeUndefined();
    const actual = ordenarEstructura(etapas, categorias);
    const dto = mapearActualizarVersionRubricaDto(prepararVersionApiParaGuardar(version, actual.etapas, actual.categorias));
    expect(JSON.stringify(dto)).not.toContain('nuevo-');
    expect(dto.revision).toBe(4);
  });

  it('rechaza códigos repetidos, descripciones vacías y decimales inválidos sin redondear', () => {
    const { etapas, categorias } = estructura();
    categorias[1].codigo = 'a';
    categorias[0].indicadores[0].etiqueta = '';
    categorias[0].indicadores[0].maximoDecimal = '0.333';
    const errores = revisarEstructura(etapas, categorias).errores.join(' ');
    expect(errores).toMatch(/repetido/);
    expect(errores).toMatch(/Descripción/);
    expect(errores).toMatch(/decimales/);
    expect(() => subtotalCategoria(categorias[0])).toThrow();
  });

  it('conserva las dos etapas y sus UUID y no asigna porcentajes nuevos', () => {
    const { etapas } = estructura();
    const existente = { ...etapas[0], id: 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50', claveLocal: undefined };
    const completadas = etapasParaEditor({ ...version, etapas: [existente] }, true);
    expect(completadas[0].id).toBe(existente.id);
    expect(completadas.map((e) => e.tipo)).toEqual(['ESCRITA', 'ORAL']);
    expect(completadas[1].porcentajeDecimal).toBeNull();
    expect(completadas[1].alcance).toBe('ESTUDIANTE_INDIVIDUAL');
  });

  it('mantiene el orden de etapas existente y no pierde códigos heredados del prototipo', () => {
    const oral = { id: 'uuid-oral', tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'PARTE_II', nombre: 'Oral', orden: 1 };
    const escrita = { id: 'uuid-escrita', tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'PARTE_I', nombre: 'Escrita', orden: 2 };
    const etapas = etapasParaEditor({ ...version, etapas: [oral, escrita] }, true);
    const categorias = [{
      id: 'A', codigo: 'A', nombre: 'Categoría A', etapa: 'uuid-escrita', maximo: 0.33,
      indicadores: [{ id: 'A1', etiqueta: 'Criterio heredado', maximo: 0.33 }],
    }];
    expect(etapas.map((etapa) => [etapa.tipo, etapa.id])).toEqual([['ORAL', oral.id], ['ESCRITA', escrita.id]]);
    expect(codigoIndicador(categorias[0].indicadores[0])).toBe('A1');
    expect(revisarEstructura(etapas, categorias).errores).toEqual([]);
    const html = renderEditorLegacy(etapas, categorias);
    expect(html).toContain('value="A1"');
  });
});

function renderEditorLegacy(etapas, categorias) {
  return renderToStaticMarkup(createElement(EditorEstructuraRubrica, { etapas, categorias, esApi: false, bloqueado: false, cambiarEtapa: () => {}, cambiarCategorias: () => {} }));
}
