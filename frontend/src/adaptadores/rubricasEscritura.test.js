import { describe, expect, it } from 'vitest';
import {
  ErrorMapeoEscrituraRubrica,
  mapearActivarVersionRubricaDto,
  mapearActualizarVersionRubricaDto,
  mapearClonarVersionRubrica,
  mapearCrearRubricaCompletaDto,
  mapearCrearVersionCompletaRubrica,
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
  carrera: '97e55f4b-5a04-48ec-b184-0d5830db38ab',
  carreraDos: 'a470e405-0508-4307-a8aa-2c6465e816d4',
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

  it('mapea una rúbrica completa con etapas dinámicas, ámbitos mixtos y vigencias independientes', () => {
    const etapa = (codigo, alcance, nombre = codigo) => ({
      codigo, nombre, alcance,
      categorias: [{ codigo: 'C1', nombre: 'Contenido', indicadores: [
        { label: 'I1', descripcion: 'Indicador uno', calificacionMaxima: '6.25' },
        { label: 'I2', descripcion: 'Indicador dos', calificacionMaxima: '3.75' },
      ] }],
    });
    const dto = mapearCrearRubricaCompletaDto({
      modalidadId: ids.modalidad,
      periodoId: ids.periodo,
      nombre: '  Rúbrica integral  ',
      version: ' 1.0 ',
      etapas: [
        etapa('ETAPA_1', 'TRABAJO_COMPARTIDO', 'Escrita'),
        etapa('ETAPA_2', 'ESTUDIANTE_INDIVIDUAL', 'Oral'),
        etapa('ETAPA_3', 'TRABAJO_COMPARTIDO', 'Análisis'),
      ],
      carreras: [
        { carreraId: ids.carrera, revision: 3, vigente: true, vigenciaEsperada: { versionId: ids.version } },
        { carreraId: ids.carreraDos, revision: 1, vigente: false, vigenciaEsperada: { versionId: null } },
      ],
    });
    expect(dto).toEqual({
      modalidadId: ids.modalidad,
      periodoId: ids.periodo,
      nombre: 'Rúbrica integral',
      version: '1.0',
      etapas: [
        { codigo: 'ETAPA_1', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', orden: 1, categorias: [{ codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
          { label: 'I1', descripcion: 'Indicador uno', calificacionMaxima: '6.25', orden: 1 },
          { label: 'I2', descripcion: 'Indicador dos', calificacionMaxima: '3.75', orden: 2 },
        ] }] },
        { codigo: 'ETAPA_2', nombre: 'Oral', alcance: 'ESTUDIANTE_INDIVIDUAL', orden: 2, categorias: [{ codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
          { label: 'I1', descripcion: 'Indicador uno', calificacionMaxima: '6.25', orden: 1 },
          { label: 'I2', descripcion: 'Indicador dos', calificacionMaxima: '3.75', orden: 2 },
        ] }] },
        { codigo: 'ETAPA_3', nombre: 'Análisis', alcance: 'TRABAJO_COMPARTIDO', orden: 3, categorias: [{ codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
          { label: 'I1', descripcion: 'Indicador uno', calificacionMaxima: '6.25', orden: 1 },
          { label: 'I2', descripcion: 'Indicador dos', calificacionMaxima: '3.75', orden: 2 },
        ] }] },
      ],
      carreras: [
        { carreraId: ids.carrera, revision: 3, vigente: true, vigenciaEsperada: { versionId: ids.version } },
        { carreraId: ids.carreraDos, revision: 1, vigente: false, vigenciaEsperada: { versionId: null } },
      ],
    });
    expect(JSON.stringify(dto)).not.toContain('claveLocal');
    expect(JSON.stringify(dto)).not.toContain('idIndicador');
  });

  it('usa copia directa si la estructura no cambió y omite identificadores internos y número de versión', () => {
    const base = {
      id: ids.version, idRubrica: ids.rubrica, fuenteDatos: 'api', revision: 7,
      modalidadId: ids.modalidad, periodoId: ids.periodo, titulo: 'Rúbrica académica',
      etapas: [{ id: ids.etapa, codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', descripcion: null, orden: 1 }],
      categorias: [{ id: ids.categoria, etapa: ids.etapa, codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
        { id: ids.indicador, label: 'I1', descripcion: 'Informe', maximoDecimal: '10.00', orden: 1 },
      ] }],
    };
    const editor = {
      codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO',
      categorias: [{ codigo: 'C1', nombre: 'Contenido', indicadores: [
        { label: 'I1', descripcion: 'Informe', calificacionMaxima: '10.00' },
      ] }],
    };
    const resultado = mapearCrearVersionCompletaRubrica({
      versionBase: base, periodoId: ids.periodo, etapas: [editor],
      carreras: [{ carreraId: ids.carrera, revision: 4, vigente: false, vigenciaEsperada: { versionId: null } }],
    });
    expect(resultado).toEqual({
      rubricaId: ids.rubrica,
      dto: {
        periodoId: ids.periodo, copiarDesdeVersionId: ids.version, revisionBase: 7,
        carreras: [{ carreraId: ids.carrera, revision: 4, vigente: false, vigenciaEsperada: { versionId: null } }],
      },
    });
  });

  it('envía la estructura completa al cambiar un indicador y nunca copia UUID de la versión anterior', () => {
    const base = {
      id: ids.version, idRubrica: ids.rubrica, fuenteDatos: 'api', revision: 3,
      modalidadId: ids.modalidad, periodoId: ids.periodo, titulo: 'Rúbrica académica',
      etapas: [{ id: ids.etapa, codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', descripcion: null, orden: 1 }],
      categorias: [{ id: ids.categoria, etapa: ids.etapa, codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
        { id: ids.indicador, label: 'I1', descripcion: 'Informe', maximoDecimal: '10.00', orden: 1 },
      ] }],
    };
    const resultado = mapearCrearVersionCompletaRubrica({
      versionBase: base, etapas: [{
        codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO',
        categorias: [{ codigo: 'C1', nombre: 'Contenido', indicadores: [
          { label: 'I1', descripcion: 'Informe', calificacionMaxima: '9.00' },
          { label: 'I2', descripcion: 'Nuevo indicador', calificacionMaxima: '1.00' },
        ] }],
      }],
      carreras: [{ carreraId: ids.carrera, revision: 4, vigente: false, vigenciaEsperada: { versionId: null } }],
    });
    expect(resultado.dto.etapas).toHaveLength(1);
    expect(resultado.dto.etapas[0].categorias[0].indicadores).toHaveLength(2);
    expect(JSON.stringify(resultado.dto)).not.toContain(ids.etapa);
    expect(JSON.stringify(resultado.dto)).not.toContain(ids.categoria);
    expect(JSON.stringify(resultado.dto)).not.toContain(ids.indicador);
    expect(resultado.dto).not.toHaveProperty('version');
  });

  it('rechaza un ámbito inválido y cualquier etapa que no sume 10.00', () => {
    const rubrica = {
      modalidadId: ids.modalidad, periodoId: ids.periodo, nombre: 'Rúbrica', version: '1',
      etapas: [{ codigo: 'E1', nombre: 'Etapa', alcance: 'ESTUDIANTE_INDIVIDUAL', categorias: [{
        codigo: 'C1', nombre: 'Contenido', indicadores: [{ label: 'I1', descripcion: 'Criterio', calificacionMaxima: '9.99' }],
      }] }],
      carreras: [{ carreraId: ids.carrera, revision: 1, vigente: false, vigenciaEsperada: { versionId: null } }],
    };
    expect(() => mapearCrearRubricaCompletaDto({ ...rubrica, etapas: [{ ...rubrica.etapas[0], alcance: 'TRABAJO' }] }))
      .toThrow(/etapa 1 requiere/i);
    expect(() => mapearCrearRubricaCompletaDto(rubrica)).toThrow(/exactamente 10\.00/i);
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
