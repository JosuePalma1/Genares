import { CONSULTA_PAGINA_TRABAJOS_MER, CONSULTA_TRABAJOS_MER } from './trabajos.service';
import { leerPaginacion, normalizarBusqueda, periodoAplicado } from './paginacion-trabajos';

describe('paginación del listado de trabajos', () => {
  it('limita el tamaño de página y calcula el desplazamiento', () => {
    expect(leerPaginacion()).toEqual({ limite: 25, pagina: 1, desplazamiento: 0 });
    expect(leerPaginacion('10', '3')).toEqual({ limite: 10, pagina: 3, desplazamiento: 20 });
    expect(leerPaginacion('500', '0')).toEqual({ limite: 100, pagina: 1, desplazamiento: 0 });
    expect(leerPaginacion('0', '2')).toEqual({ limite: 1, pagina: 2, desplazamiento: 1 });
  });

  it('busca sin distinguir tildes ni mayúsculas, como el frontend', () => {
    expect(normalizarBusqueda('  Lucía   PÉREZ ')).toBe('lucia perez');
    expect(normalizarBusqueda('   ')).toBeNull();
    expect(normalizarBusqueda(undefined)).toBeNull();
  });

  it('usa el periodo activo por defecto y TODOS quita el filtro', () => {
    const periodos = [{ codigo: '2027A', activo: false }, { codigo: '2026B', activo: true }];
    expect(periodoAplicado(undefined, periodos)).toBe('2026B');
    expect(periodoAplicado('2027A', periodos)).toBe('2027A');
    expect(periodoAplicado('TODOS', periodos)).toBeNull();
    expect(periodoAplicado(undefined, [{ codigo: '2025A', activo: false }])).toBeNull();
  });

  it('pagina sobre el mismo universo visible que el listado completo', () => {
    for (const consulta of [CONSULTA_PAGINA_TRABAJOS_MER, CONSULTA_TRABAJOS_MER]) {
      expect(consulta).toContain("a.estado = 'VIGENTE'");
      expect(consulta).toContain('p.estado_registro = 1');
      expect(consulta).toContain('vr.estado_registro = 1');
      expect(consulta).toContain('r.estado_registro = 1');
    }
    expect(CONSULTA_PAGINA_TRABAJOS_MER).toContain('LIMIT $5 OFFSET $6');
    expect(CONSULTA_PAGINA_TRABAJOS_MER).toContain('c.codigo = $7::text');
    expect(CONSULTA_TRABAJOS_MER).toContain('a.id = ANY($2::uuid[])');
  });
});
