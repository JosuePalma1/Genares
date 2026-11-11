import { DataSource } from 'typeorm';
import {
  CONSULTA_CATALOGOS_TRABAJOS_MER, CONSULTA_PAGINA_TRABAJOS_MER, CONSULTA_PERIODOS, TrabajosService,
} from './trabajos.service';

/** RF-13: filtros por carrera, período, modalidad, estudiante, tema, tutor y estado, combinables. */
describe('filtros del listado de trabajos (RF-13)', () => {
  function preparar() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
      if (sql === CONSULTA_PERIODOS) return [{ codigo: '2026B', nombre: null, activo: true }];
      if (sql === CONSULTA_PAGINA_TRABAJOS_MER) return [{ total: 0, ids: [] }];
      if (sql === CONSULTA_CATALOGOS_TRABAJOS_MER) {
        return [{ carreras: [{ codigo: 'TI', nombre: 'TI' }], modalidades: [{ codigo: 'PI', nombre: 'Proyecto' }] }];
      }
      return [];
    });
    const servicio = new TrabajosService({ query } as unknown as DataSource);
    const parametros = () => query.mock.calls.find(([sql]) => sql === CONSULTA_PAGINA_TRABAJOS_MER)![1] as unknown[];
    return { servicio, parametros };
  }

  it('cada filtro específico tiene su condición y todas se combinan con AND', () => {
    expect(CONSULTA_PAGINA_TRABAJOS_MER).toContain('m.codigo = $8::text');
    for (const parametro of ['$9', '$10', '$11']) {
      expect(CONSULTA_PAGINA_TRABAJOS_MER).toContain(`AND (${parametro}::text IS NULL OR strpos(`);
    }
    // Estudiante: S2 individual o integrantes activos de la bina. Tutor: s2.asignacion_tutor.
    const estudiante = CONSULTA_PAGINA_TRABAJOS_MER.slice(CONSULTA_PAGINA_TRABAJOS_MER.indexOf('$9::text IS NULL'));
    expect(estudiante.slice(0, estudiante.indexOf('$9::text) > 0'))).toContain("gi.estado = 'ACTIVO'");
    const tutor = CONSULTA_PAGINA_TRABAJOS_MER.slice(CONSULTA_PAGINA_TRABAJOS_MER.indexOf('$11::text IS NULL'));
    expect(tutor.slice(0, tutor.indexOf('$11::text) > 0'))).toContain('s2.asignacion_tutor');
  });

  it('envía los filtros normalizados sin tildes ni mayúsculas y vacíos como NULL', async () => {
    const { servicio, parametros } = preparar();
    await servicio.listarPaginaDesarrolloLocal('GENARES:LOCAL_DEVELOPMENT', {
      limite: '10', carrera: 'TI', modalidad: 'PI', estudiante: '  Lucía ', tema: 'SISTEMA  Académico', tutor: '   ',
    });
    expect(parametros().slice(6)).toEqual(['TI', 'PI', 'lucia', 'sistema academico', null]);
  });

  it('devuelve los catálogos de carreras y modalidades para los selectores', async () => {
    const { servicio } = preparar();
    const pagina = await servicio.listarPaginaDesarrolloLocal('GENARES:LOCAL_DEVELOPMENT', { limite: '10' });
    expect(pagina.filtros).toMatchObject({
      carreras: [{ codigo: 'TI' }], modalidades: [{ codigo: 'PI', nombre: 'Proyecto' }],
    });
    expect(CONSULTA_CATALOGOS_TRABAJOS_MER).toContain("a.estado = 'VIGENTE'");
    expect(CONSULTA_CATALOGOS_TRABAJOS_MER).toContain('p.estado_registro = 1');
  });
});
