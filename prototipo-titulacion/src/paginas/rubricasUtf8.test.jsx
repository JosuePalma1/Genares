import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaRubricas from './PaginaRubricas';
import PaginaDetalleRubrica from './PaginaDetalleRubrica';

const escenario = vi.hoisted(() => ({}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ idRubrica: 'version-utf8' }),
}));
vi.mock('../estado/ContextoPrototipo', () => ({
  usarPrototipo: () => escenario.contexto,
}));
vi.mock('../hooks/usarRubricasLectura', () => ({
  usarRubricasLectura: () => escenario.lectura,
}));

function configurar(fuente, estado = 'BORRADOR') {
  const version = {
    id: 'version-utf8', idRubrica: 'rubrica-utf8', fuenteDatos: fuente,
    titulo: 'Rúbrica de Diseño · año 2026', modalidad: 'Proyecto integrador',
    periodo: '2026-2', version: 'v1.0', estado,
    ...(fuente === 'api' ? {
      revision: 1,
      carreras: [
        { id: 'carrera-software', nombre: 'Ingeniería de Software', vigente: true },
        { id: 'carrera-ti', nombre: 'Tecnologías de Información', vigente: false },
      ],
    } : {}),
    etapas: [{
      id: 'ESCRITA', codigo: 'PARTE_I', nombre: 'Revisión escrita',
      descripcion: 'Evaluación común del diseño.', orden: 1, maximo: 1.25,
    }],
    categorias: [{
      id: 'categoria-utf8', etapa: 'ESCRITA', codigo: 'A', nombre: 'Introducción', maximo: 1.25,
      indicadores: [{ id: 'indicador-utf8', etiqueta: 'Diseño con ñ · revisión', maximo: 1.25 }],
    }],
  };
  escenario.contexto = {
    estado: { versionesRubrica: [version] },
    despachar: vi.fn(),
  };
  escenario.lectura = {
    fuente, versiones: [version], puedeAdministrar: true,
    cargando: false, error: null, reintentar: vi.fn(),
  };
}

function comprobarTexto(html, textos) {
  for (const texto of textos) expect(html.includes(texto), `Texto esperado: ${texto}`).toBe(true);
  expect(html).not.toMatch(/[\u00c3\u00c2\ufffd]|\u00e2[\u20ac\u0080]/u);
}

describe('texto UTF-8 renderizado en Rúbricas', () => {
  beforeEach(() => configurar('prototipo'));

  it.each(['prototipo', 'api'])('conserva etiquetas y datos del listado en modo %s', (fuente) => {
    configurar(fuente);
    comprobarTexto(renderToStaticMarkup(<PaginaRubricas />), [
      'Rúbricas', 'Versión', 'Período', 'Rúbrica de Diseño · año 2026',
    ]);
  });

  it.each(['prototipo', 'api'])('renderiza el detalle editable sin recodificar texto en modo %s', (fuente) => {
    configurar(fuente);
    const html = renderToStaticMarkup(<PaginaDetalleRubrica />);
    comprobarTexto(html, [
      'Rúbricas', 'Versión', 'Edición', 'Período', 'Diseño', '·',
    ]);
    expect(html).not.toContain('Revisión undefined');
    if (fuente === 'api') expect(html).toContain('Revisión 1');
    else expect(html).toContain('No hay cambios pendientes.');
  });

  it.each(['prototipo', 'api'])('conserva el texto histórico y los caracteres de los datos en modo %s', (fuente) => {
    configurar(fuente, 'ARCHIVADA');
    const html = renderToStaticMarkup(<PaginaDetalleRubrica />);
    comprobarTexto(html, [
      'Histórica e inmutable', 'Introducción', 'Diseño con ñ · revisión',
      'Máximo del indicador', 'Categoría',
    ]);
    expect(html).not.toContain('Añadir categoría');
    expect(html).not.toContain('Eliminar indicador');
  });

  it('muestra la vigencia por carrera y vuelve al catálogo desde una versión API guardada', () => {
    configurar('api', 'CONFIGURADA');
    const html = renderToStaticMarkup(<PaginaDetalleRubrica />);
    comprobarTexto(html, [
      'Vigencia por carrera',
      'Ingeniería de Software: Vigente · Tecnologías de Información: No vigente',
      'Máximos por etapa',
      'Suma de máximos por etapa',
      'no es la calificación final de un estudiante',
    ]);
    expect(html).not.toContain('Puntaje total');
    expect(html).toContain('<a href="/rubricas" class="button button-outline back-button">');
  });

  it.each(['prototipo', 'api'])('conserva las tildes en los mensajes de versión inexistente en modo %s', (fuente) => {
    configurar(fuente);
    escenario.lectura.versiones = [];
    comprobarTexto(renderToStaticMarkup(<PaginaDetalleRubrica />), [
      'Rúbrica no encontrada', 'No se encontró esta versión', 'Volver a rúbricas',
    ]);
  });

  it.each([
    { cargando: true, error: null, texto: 'Cargando rúbrica' },
    { cargando: false, error: { message: 'Error de conexión' }, texto: 'No fue posible cargar la rúbrica' },
  ])('conserva las etiquetas de consulta API: $texto', ({ cargando, error, texto }) => {
    configurar('api');
    Object.assign(escenario.lectura, { versiones: [], cargando, error });
    comprobarTexto(renderToStaticMarkup(<PaginaDetalleRubrica />), ['Rúbricas', texto]);
  });
});
