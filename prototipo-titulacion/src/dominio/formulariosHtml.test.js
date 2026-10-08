import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const formularios = [
  '../paginas/LoginPage.jsx',
  '../paginas/PaginaFormularioTrabajo.jsx',
  '../paginas/PaginaProgramacionSustentacion.jsx',
];

describe('formularios HTML', () => {
  it.each(formularios)('%s utiliza la etiqueta nativa form', (ruta) => {
    const contenido = readFileSync(new URL(ruta, import.meta.url), 'utf8');

    expect(contenido).toContain('<form');
    expect(contenido).toContain('</form>');
    expect(contenido).not.toContain('<formulario');
  });

  it('no utiliza una etiqueta label para el resumen informativo de la rúbrica', () => {
    const contenido = readFileSync(new URL('../paginas/PaginaFormularioTrabajo.jsx', import.meta.url), 'utf8');

    expect(contenido).toContain('<span className="field-label">Rúbrica que se asociará</span>');
    expect(contenido).not.toContain('<label>Rúbrica que se asociará</label>');
  });
});
