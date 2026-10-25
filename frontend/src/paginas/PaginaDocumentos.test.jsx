import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PaginaDocumentos from './PaginaDocumentos';

vi.mock('../componentes/interfaz', () => ({ EncabezadoPagina: ({ title }) => <h1>{title}</h1> }));
vi.mock('../servicios/documentosApi', () => ({
  DOCUMENTOS_API_HABILITADA: false,
  consultarDocumentos: vi.fn(),
  guardarDocumento: vi.fn(),
  actualizarConfiguracionDocumental: vi.fn(),
  obtenerPdfDocumento: vi.fn(),
}));

describe('Documentos académicos', () => {
  it('no presenta documentos de sustitución cuando la API no está habilitada en la prueba', () => {
    const html = renderToStaticMarkup(<PaginaDocumentos />);
    expect(html).toContain('Documentos académicos');
    expect(html).toContain('La consulta de documentos de evaluación no está disponible');
    expect(html).not.toContain('Generar / reimprimir acta');
  });
});
