import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EditorEstructuraRubrica from './EditorEstructuraRubrica';

const etapas = [
  { id: 'ESCRITA', tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Escrita' },
  { id: 'ORAL', tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'ORA', nombre: 'Oral' },
];
const categoria = (codigo, cantidad) => ({
  id: codigo, codigo, nombre: `Categoría ${codigo}`, etapa: 'ESCRITA',
  indicadores: Array.from({ length: cantidad }, (_, i) => ({ id: `${codigo}${i}`, label: `${codigo}${i}`, etiqueta: `Descripción ${codigo}${i}`, maximoDecimal: '0.10' })),
});
const renderizar = (categorias, bloqueado = false) => renderToStaticMarkup(<EditorEstructuraRubrica etapas={etapas} categorias={categorias} esApi bloqueado={bloqueado} cambiarEtapa={vi.fn()} cambiarCategorias={vi.fn()} />);

describe('controles del editor estructural', () => {
  it('renderiza dos y cinco indicadores y ofrece controles nativos con nombres accesibles', () => {
    const html = renderizar([categoria('A', 2), categoria('B', 5)]);
    expect(html.match(/data-indicador=/g)).toHaveLength(7);
    expect(html).toContain('aria-label="Subir indicador B.5"');
    expect(html).toContain('aria-label="Bajar categoría A"');
    expect(html).toContain('Añadir indicador a B');
    expect(html).not.toContain('draggable=');
  });

  it('permite representar categorías vacías sin inventar indicadores ni máximos', () => {
    const html = renderizar([categoria('A', 0)]);
    expect(html).toContain('Categoría vacía: puede guardarse como borrador.');
    expect(html).not.toContain('data-indicador=');
    expect(html).toContain('0.00');
    expect(html).not.toContain('Añadir etapa');
  });

  it('bloquea todas las mutaciones mientras se guarda la jerarquía completa', () => {
    const html = renderizar([categoria('A', 2)], true);
    const controles = html.match(/<(?:input|textarea|button)\b[^>]*>/g);
    expect(controles.length).toBeGreaterThan(10);
    expect(controles.every((control) => /disabled=""/.test(control))).toBe(true);
  });
});
