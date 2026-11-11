import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVALUACIONES_POR_PAGINA, PaginaMisEvaluacionesApi } from './PaginaEvaluacionesApi';
import { usarPaginaTrabajosApi } from '../hooks/usarTrabajosApi';
import { adaptarListaTrabajosEvaluacionApi } from '../../infrastructure/repositories/evaluacionesApi';

vi.mock('../hooks/usarTrabajosApi', () => ({ usarPaginaTrabajosApi: vi.fn() }));

const trabajo = {
  id: '11000000-0000-4000-8000-000000000001', codigo: 'DEV-TI-001', titulo: 'Sistema de prueba',
  codigoCarrera: 'TI', carrera: 'TI', periodo: '2026-2', modalidad: 'Proyecto', rubrica: 'Rúbrica TI', versionRubrica: '1',
  estadoRegistro: 1,
  estudiantes: [{ id: '22000000-0000-4000-8000-000000000001', nombres: 'Andrea', apellidos: 'Vera' }],
  miembrosTribunal: [{ idMiembroTribunal: '33000000-0000-4000-8000-000000000001', nombres: 'Jurado', apellidos: 'Uno' }],
};
const filtros = { periodo: '2026-2', periodos: [{ codigo: '2026-2', nombre: null, activo: true }], estados: [] };

const render = () => renderToStaticMarkup(<MemoryRouter><PaginaMisEvaluacionesApi /></MemoryRouter>);

describe('Mis evaluaciones paginadas en el servidor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide la primera página del período actual con el adaptador de evaluaciones', () => {
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', actualizando: false, trabajos: [trabajo], error: null, recargar: vi.fn(), filtros,
      paginacion: { pagina: 1, limite: EVALUACIONES_POR_PAGINA, total: 1, paginas: 1 },
    });
    const html = render();
    expect(usarPaginaTrabajosApi).toHaveBeenCalledWith({ pagina: 1, limite: EVALUACIONES_POR_PAGINA }, adaptarListaTrabajosEvaluacionApi);
    expect(html).toContain('Sistema de prueba');
    expect(html).toContain('Evaluar oral | Andrea Vera');
    expect(html).toContain('1 trabajo(s)');
    expect(html).toContain('2026-2 (actual)');
    expect(html).not.toContain('Páginas de evaluaciones');
  });

  it('muestra el paginador con varias páginas y el error recuperable sin estado vacío', () => {
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', actualizando: false, trabajos: [trabajo], error: null, recargar: vi.fn(), filtros,
      paginacion: { pagina: 1, limite: 20, total: 45, paginas: 3 },
    });
    expect(render()).toContain('1–20 de 45');

    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'error', actualizando: false, trabajos: [], error: { status: 500, message: 'Falla' }, recargar: vi.fn(), filtros: null, paginacion: null,
    });
    const html = render();
    expect(html).toContain('No se pudieron consultar las evaluaciones');
    expect(html).not.toContain('No hay trabajos registrados');
  });
});
