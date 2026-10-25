import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PaginaNuevaRubrica, { enfocarResumenErroresRubrica } from './PaginaNuevaRubrica';

const ruta = vi.hoisted(() => ({ params: {} }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ruta.params,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('../servicios/rubricasApi', () => ({
  cargarCapacidadesRubricasApi: vi.fn(),
  cargarCatalogosRubricasApi: vi.fn(),
  cargarRubricasApi: vi.fn(),
  crearRubricaCompletaApi: vi.fn(),
  crearVersionCompletaRubricaApi: vi.fn(),
}));
vi.mock('../servicios/carrerasApi', () => ({ cargarCarrerasApi: vi.fn() }));

describe('página Nueva rúbrica conectada a PostgreSQL', () => {
  it('enfoca el resumen accesible cuando el formulario bloquea el guardado', () => {
    const tituloErrores = { focus: vi.fn() };
    const documento = { getElementById: vi.fn(() => tituloErrores) };

    expect(enfocarResumenErroresRubrica(documento)).toBe(true);
    expect(documento.getElementById).toHaveBeenCalledWith('rubrica-completa-errors-title');
    expect(tituloErrores.focus).toHaveBeenCalledOnce();
    expect(enfocarResumenErroresRubrica({ getElementById: () => null })).toBe(false);
  });

  it('consulta la configuración persistida y no presenta el formulario antes de recibirla', () => {
    ruta.params = {};
    const html = renderToStaticMarkup(<PaginaNuevaRubrica />);
    expect(html).toContain('<h1>Nueva rúbrica</h1>');
    expect(html).toContain('Consultando modalidades, períodos, carreras y vigencias actuales');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Guardar rúbrica');
  });

  it('reconoce la ruta de nueva versión y espera la lectura API de la versión de origen', async () => {
    ruta.params = { idRubrica: 'familia-1', idVersion: 'version-v1' };
    const html = renderToStaticMarkup(<PaginaNuevaRubrica />);
    expect(html).toContain('<h1>Nueva versión de rúbrica</h1>');
    expect(html).toContain('Consultando modalidades, períodos, carreras y vigencias actuales');
    expect(html).not.toContain('<form');
    const api = await import('../servicios/rubricasApi');
    expect(api.crearVersionCompletaRubricaApi).not.toHaveBeenCalled();
    ruta.params = {};
  });
});
