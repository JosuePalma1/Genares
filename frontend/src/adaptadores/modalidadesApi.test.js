import { describe, expect, it } from 'vitest';
import {
  adaptarListadoModalidadesApi,
  adaptarModalidadApi,
  mapearActualizarModalidad,
  mapearCrearModalidad,
  mapearEstadoModalidad,
} from './modalidadesApi';

const id = 'b9946db9-05ea-4592-9966-1e53f0d9cb69';
const familia = '7926b9ab-a1d2-4a3e-91ce-697fc746f12e';
const base = {
  id,
  codigo: 'SISTEMATIZACION',
  nombre: 'Sistematización de experiencias',
  descripcion: null,
  estaActivo: true,
  revision: 2,
  creadoEn: '2026-10-15T10:00:00.000Z',
  actualizadoEn: '2026-10-15T11:00:00.000Z',
  familiaRubricas: { id: familia, nombre: 'Rúbrica oficial', descripcion: null, cantidadVersiones: 1 },
};

describe('adaptador de modalidades API', () => {
  it('preserva UUID, revisión, estado y resumen de asociación', () => {
    expect(adaptarModalidadApi(base)).toMatchObject({
      id, revision: 2, codigo: 'SISTEMATIZACION', estaActivo: true,
      familiaRubricas: { id: familia, cantidadVersiones: 1 }, fuenteDatos: 'api',
    });
    expect(adaptarListadoModalidadesApi([base])).toHaveLength(1);
  });

  it('rechaza respuestas incompletas o jerarquías corruptas y mantiene modalidades sin familia', () => {
    expect(adaptarModalidadApi({ ...base, familiaRubricas: null }).familiaRubricas).toBeNull();
    expect(() => adaptarModalidadApi({ ...base, revision: 0 })).toThrow(/información recibida para esta modalidad está incompleta/i);
    expect(() => adaptarModalidadApi({ ...base, familiaRubricas: { ...base.familiaRubricas, versiones: [{}] } })).toThrow(/versión/i);
    expect(() => adaptarListadoModalidadesApi({})).toThrow(/listado/i);
  });

  it('mapea cuerpos de escritura sin actor y conserva la revisión optimista', () => {
    expect(mapearCrearModalidad({ codigo: ' PI ', nombre: ' Proyecto ', descripcion: '', estaActivo: false }))
      .toEqual({ codigo: 'PI', nombre: 'Proyecto', descripcion: null, estaActivo: false });
    expect(mapearActualizarModalidad({ id, revision: 3, codigo: 'PI', nombre: 'Proyecto', descripcion: ' X ' }))
      .toEqual({ id, dto: { revision: 3, codigo: 'PI', nombre: 'Proyecto', descripcion: 'X' } });
    expect(mapearEstadoModalidad({ id, revision: 4, estaActivo: false })).toEqual({ id, dto: { revision: 4, estaActivo: false } });
    expect(mapearActualizarModalidad({ id, revision: 2, codigo: 'PI', nombre: 'X', actorId: 'fake' }).dto)
      .not.toHaveProperty('actorId');
  });
});
