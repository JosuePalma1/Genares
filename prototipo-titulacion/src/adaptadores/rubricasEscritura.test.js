import { describe, expect, it } from 'vitest';
import {
  ErrorMapeoEscrituraRubrica,
  mapearActivarVersionRubricaDto,
  mapearActualizarVersionRubricaDto,
  mapearClonarVersionRubrica,
  mapearCrearRubricaDto,
  mapearCrearVersionRubricaDto,
} from './rubricasEscritura';

const ids = {
  rubrica: '7926b9ab-a1d2-4a3e-91ce-697fc746f12e',
  version: '22e5d7a9-2c3d-4c72-867b-cde5d0ceeb4e',
  periodo: 'ed405a53-7836-4e48-84f3-9c11150e7e42',
  modalidad: 'b9946db9-05ea-4592-9966-1e53f0d9cb69',
  etapa: 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50',
  categoria: '748f7401-0714-430f-a36c-b25d43c9c6df',
  indicador: '5a72f971-20f8-4d7b-9f83-7c75cc68e2bc',
};

const versionApi = () => ({
  id: ids.version,
  idRubrica: ids.rubrica,
  fuenteDatos: 'api',
  estado: 'BORRADOR',
  revision: 7,
  etapas: [{
    id: ids.etapa,
    tipo: 'ESCRITA',
    alcance: 'TRABAJO_COMPARTIDO',
    codigo: 'ESC',
    nombre: 'Revisión escrita',
    descripcion: null,
    maximoDecimal: '0.33',
    porcentajeDecimal: '50.00',
    orden: 1,
  }],
  categorias: [{
    id: ids.categoria,
    etapa: ids.etapa,
    codigo: 'A',
    nombre: 'Introducción',
    maximoDecimal: '0.33',
    orden: 1,
    indicadores: [{
      id: ids.indicador,
      label: 'A1',
      descripcion: 'Describe el problema.',
      maximoDecimal: '0.33',
      orden: 1,
    }],
  }],
});

describe('mapeadores puros de escritura de rúbricas', () => {
  it('mapea la creación y clonación sin reemplazar UUID por identificadores locales', () => {
    expect(mapearCrearRubricaDto({ modalidadId: ids.modalidad, nombre: '  Rúbrica  ', descripcion: null }))
      .toEqual({ modalidadId: ids.modalidad, nombre: 'Rúbrica', descripcion: null });
    expect(mapearCrearVersionRubricaDto({ periodoId: ids.periodo, version: ' 2.0 ' }))
      .toEqual({ periodoId: ids.periodo, version: '2.0' });
    expect(mapearClonarVersionRubrica({
      versionBase: { ...versionApi(), periodoId: ids.periodo },
      version: '2.1',
    })).toEqual({
      rubricaId: ids.rubrica,
      dto: { periodoId: ids.periodo, version: '2.1', copiarDesdeVersionId: ids.version },
    });
  });

  it('serializa el reemplazo completo y conserva revisión, UUID y precisión textual', () => {
    const dto = mapearActualizarVersionRubricaDto(versionApi());
    expect(dto).toEqual({
      revision: 7,
      etapas: [{
        id: ids.etapa,
        tipo: 'ESCRITA',
        alcance: 'TRABAJO_COMPARTIDO',
        codigo: 'ESC',
        nombre: 'Revisión escrita',
        descripcion: null,
        calificacionMaxima: '0.33',
        porcentaje: '50.00',
        orden: 1,
        categorias: [{
          id: ids.categoria,
          codigo: 'A',
          nombre: 'Introducción',
          calificacionMaxima: '0.33',
          orden: 1,
          indicadores: [{
            id: ids.indicador,
            label: 'A1',
            descripcion: 'Describe el problema.',
            calificacionMaxima: '0.33',
            orden: 1,
          }],
        }],
      }],
    });
    expect(dto).not.toHaveProperty('estado');
  });

  it('admite hijos nuevos sin UUID y no incluye claves locales en el cuerpo', () => {
    const version = versionApi();
    version.etapas[0].id = undefined;
    version.etapas[0].claveLocal = 'etapa-editor-1';
    version.categorias[0].id = undefined;
    version.categorias[0].etapa = 'etapa-editor-1';
    version.categorias[0].indicadores[0].id = undefined;
    const dto = mapearActualizarVersionRubricaDto(version);
    expect(dto.etapas[0]).not.toHaveProperty('claveLocal');
    expect(dto.etapas[0].categorias[0]).not.toHaveProperty('id');
    expect(dto.etapas[0].categorias[0].indicadores[0]).not.toHaveProperty('id');
  });

  it('rechaza fuente local, cuerpos incompletos, revisión inválida e importes numéricos', () => {
    expect(() => mapearActualizarVersionRubricaDto({ ...versionApi(), fuenteDatos: 'prototipo' }))
      .toThrow(ErrorMapeoEscrituraRubrica);
    expect(() => mapearActualizarVersionRubricaDto({ ...versionApi(), categorias: undefined }))
      .toThrow(/jerarquía completa/i);
    expect(mapearActualizarVersionRubricaDto({ ...versionApi(), revision: 6 }).revision).toBe(6);
    const conNumero = versionApi();
    conNumero.categorias[0].indicadores[0].maximoDecimal = 0.33;
    expect(() => mapearActualizarVersionRubricaDto(conNumero)).toThrow(/texto decimal/i);
  });

  it('prepara activación solo con revisión de servidor vigente y estado borrador', () => {
    expect(mapearActivarVersionRubricaDto(versionApi())).toEqual({ revision: 7 });
    expect(() => mapearActivarVersionRubricaDto({ ...versionApi(), estado: 'ARCHIVADA' })).toThrow(/borrador/i);
    expect(() => mapearActivarVersionRubricaDto({ ...versionApi(), revision: 0 })).toThrow(/revisión/i);
  });
});
