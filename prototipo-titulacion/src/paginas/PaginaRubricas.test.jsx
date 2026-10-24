import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalVersionesRubrica } from '../componentes/ModalVersionesRubrica';
import PaginaRubricas from './PaginaRubricas';

const escenario = vi.hoisted(() => ({}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('react-dom', () => ({ createPortal: (children) => children }));
vi.mock('../estado/ContextoPrototipo', () => ({
  usarPrototipo: () => escenario.contexto,
}));
vi.mock('../hooks/usarRubricasLectura', () => ({
  usarRubricasLectura: () => escenario.lectura,
}));

const version = {
  id: 'v1', idRubrica: 'familia-1', titulo: 'Rúbrica de artículo', modalidadId: 'm1',
  modalidad: 'Artículo científico', periodoId: 'p1', periodo: '2026-2', version: 'V1',
  estado: 'ARCHIVADA', creadaEn: '2026-08-20T08:00:00.000Z', fuenteDatos: 'api',
  carreras: [
    { id: 'c1', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: true },
    { id: 'c2', codigo: 'TI', nombre: 'Tecnologías de la Información', vigente: false },
  ],
};

function configurar({ fuente = 'api', versiones = [version], cargando = false, error = null, puedeAdministrar = true, puedeEscribir = puedeAdministrar } = {}) {
  escenario.contexto = {
    estado: { versionesRubrica: [] },
  };
  escenario.lectura = { fuente, versiones, cargando, error, puedeAdministrar: puedeEscribir, puedeAdministrarServidor: puedeAdministrar, reintentar: vi.fn() };
}

describe('catálogo de rúbricas', () => {
  beforeEach(() => configurar());

  it('presenta filtros, tabla y vigencia asociada a cada carrera', () => {
    const html = renderToStaticMarkup(<PaginaRubricas />);
    expect(html).toContain('<h1>Rúbricas</h1>');
    expect(html).toContain('id="rubricas-carrera"');
    expect(html).toContain('id="rubricas-modalidad"');
    expect(html).toContain('id="rubricas-periodo"');
    expect(html).toContain('id="rubricas-vigencia"');
    expect(html).toContain('Ingeniería de Software');
    expect(html).toContain('Tecnologías de la Información');
    expect(html).toContain('Vigente');
    expect(html).toContain('No vigente');
    expect(html).toContain('href="/rubricas/v1"');
    expect(html).not.toContain('Activa');
    expect(html).toContain('Nueva rúbrica');
    expect(html).toContain('href="/rubricas/nueva"');
  });

  it('mantiene solo lectura cuando no recibe capacidad administrativa del servidor', () => {
    configurar({ puedeAdministrar: false });
    const html = renderToStaticMarkup(<PaginaRubricas />);
    expect(html).not.toContain('Nueva rúbrica');
    expect(html).toContain('solo lectura');
    expect(html).toContain('sin habilitar la creaci');
  });

  it('distingue catálogo vacío, carga y error recuperable', () => {
    configurar({ versiones: [] });
    expect(renderToStaticMarkup(<PaginaRubricas />)).toContain('No hay rúbricas registradas');

    configurar({ cargando: true, versiones: [] });
    expect(renderToStaticMarkup(<PaginaRubricas />)).toContain('Cargando rúbricas');

    configurar({ error: new Error('API no disponible'), versiones: [] });
    const html = renderToStaticMarkup(<PaginaRubricas />);
    expect(html).toContain('No disponible');
    expect(html).not.toContain('0 resultados');
    expect(html.match(/<input\b[^>]*\bdisabled=""/g)).toHaveLength(1);
    expect(html.match(/<select\b[^>]*\bdisabled=""/g)).toHaveLength(4);
    expect(html).toContain('No fue posible cargar las rúbricas');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('href="/rubricas/nueva"');
  });

  it('mantiene separados los datos del prototipo y no inventa carreras o vigencias', () => {
    configurar({ fuente: 'prototipo', versiones: [{ ...version, fuenteDatos: undefined, carreras: undefined }] });
    const html = renderToStaticMarkup(<PaginaRubricas />);
    expect(html).toContain('Origen: prototipo local');
    expect(html).toContain('No disponible en prototipo');
    expect(html).toContain('No informada en prototipo');
  });

  it('muestra historial por carrera y conserva el acceso al detalle existente', () => {
    const html = renderToStaticMarkup(<ModalVersionesRubrica
      referencia={{ ...version, rubricaId: version.idRubrica, versionId: version.id, nombreRubrica: version.titulo }}
      versiones={[version]}
      fuente="api"
      puedeCrearEnApi
      onCerrar={() => {}}
    />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Versión V1');
    expect(html).toContain('Carrera y vigencia: Ingeniería de Software · vigente, Tecnologías de la Información · no vigente');
    expect(html).toContain('href="/rubricas/v1"');
    expect(html).toContain('Nueva versión');
    expect(html).toContain('href="/rubricas/familia-1/nueva-version/v1"');
    expect(html).toContain('permanecerán intactos');
  });
});
