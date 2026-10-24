import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PaginaDocumentos from './PaginaDocumentos';

vi.mock('../componentes/interfaz', () => ({ EncabezadoPagina: ({ title }) => <h1>{title}</h1> }));
vi.mock('../servicios/documentosApi', () => ({
  DOCUMENTOS_API_HABILITADA: false,
  ESCRITURA_DOCUMENTOS_API_HABILITADA: false,
  consultarDocumentos: vi.fn(),
  guardarDocumento: vi.fn(),
  actualizarConfiguracionDocumental: vi.fn(),
  obtenerPdfDocumento: vi.fn(),
}));

describe('Documentos académicos', () => {
  it('no presenta documentos simulados ni habilita emisiones en modo prototipo', () => {
    const html = renderToStaticMarkup(<PaginaDocumentos />);
    expect(html).toContain('Documentos académicos');
    expect(html).toContain('Active la consulta API');
    expect(html).not.toContain('Generar / reimprimir acta');
  });
});
