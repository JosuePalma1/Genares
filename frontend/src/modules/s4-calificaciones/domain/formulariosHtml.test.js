import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const formularios = [
  '../presentation/pages/PaginaEvaluacionesIntegradasDev.jsx',
  '../presentation/pages/PaginaProgramacionSustentacion.jsx',
];

describe('formularios HTML', () => {
  it.each(formularios)('%s utiliza la etiqueta nativa form', (ruta) => {
    const contenido = readFileSync(new URL(ruta, import.meta.url), 'utf8');

    expect(contenido).toContain('<form');
    expect(contenido).toContain('</form>');
    expect(contenido).not.toContain('<formulario');
  });

});
