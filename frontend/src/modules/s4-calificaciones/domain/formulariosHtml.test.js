import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const formularios = [
  '../presentation/pages/PaginaEvaluacionesIntegradasDev.jsx',
  '../presentation/pages/PaginaCronograma.jsx',
];

describe('formularios HTML activos', () => {
  it('mantiene la rúbrica en modo de edición visual durante el guardado', () => {
    const contenido = readFileSync(new URL(formularios[0], import.meta.url), 'utf8');
    expect(contenido).not.toMatch(/readOnly=\{[^\n]*guardando/);
    expect(contenido).toContain('guardadoEnCurso={guardando}');
  });

  it.each(formularios)('%s utiliza la etiqueta nativa form', (ruta) => {
    const contenido = readFileSync(new URL(ruta, import.meta.url), 'utf8');

    expect(contenido).toContain('<form');
    expect(contenido).toContain('</form>');
    expect(contenido).not.toContain('<formulario');
  });

});
