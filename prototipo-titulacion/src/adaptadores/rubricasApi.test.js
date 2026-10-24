import { describe, expect, it } from 'vitest';
import { adaptarRubricaApi } from './rubricasApi';

const rubricId = '7926b9ab-a1d2-4a3e-91ce-697fc746f12e';
const versionId = '22e5d7a9-2c3d-4c72-867b-cde5d0ceeb4e';
const stageId = 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50';
const categoryId = '748f7401-0714-430f-a36c-b25d43c9c6df';
const indicatorId = '5a72f971-20f8-4d7b-9f83-7c75cc68e2bc';
const periodId = 'ed405a53-7836-4e48-84f3-9c11150e7e42';
const modalityId = 'b9946db9-05ea-4592-9966-1e53f0d9cb69';

const resumen = {
  id: versionId,
  version: 'v1.2',
  revision: 7,
  estado: 'ARCHIVADA',
  periodo: { id: periodId, codigo: '2026-2' },
  activadaEn: '2026-09-01T12:30:00.000Z',
  creadaEn: '2026-08-20T08:00:00.000Z',
    carreras: [{ id: 'a62fa78b-296c-4b03-b38a-03af50eb9864', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: true }],
};

const listado = {
  id: rubricId,
  nombre: 'Rúbrica de integración curricular',
  descripcion: null,
  modalidad: { id: modalityId, codigo: 'PI', nombre: 'Proyecto integrador' },
  versiones: [resumen],
};

const detalle = {
  rubricaId: rubricId,
  versiones: [{
    ...resumen,
    etapas: [{
      id: stageId,
      tipo: 'ESCRITA',
      alcance: 'TRABAJO_COMPARTIDO',
      codigo: 'PARTE_I',
      nombre: 'Revisión escrita',
      descripcion: 'Evaluación común del documento.',
      calificacionMaxima: '5.00',
      porcentaje: '50.00',
      orden: 1,
      categorias: [{
        id: categoryId,
        codigo: 'A',
        nombre: 'Introducción',
        calificacionMaxima: '0.33',
        orden: 1,
        indicadores: [{
          id: indicatorId,
          label: 'A1',
          descripcion: 'Presenta el problema de investigación.',
          calificacionMaxima: '0.33',
          orden: 1,
        }],
      }],
    }],
  }],
};

describe('adaptador de DTO de rúbricas', () => {
  it('aplana la jerarquía para el prototipo y preserva UUID, revisión y decimales', () => {
    const [result] = adaptarRubricaApi(listado, detalle);
    expect(result).toMatchObject({
      id: versionId,
      idRubrica: rubricId,
      modalidadId: modalityId,
      periodoId: periodId,
      revision: 7,
      estado: 'ARCHIVADA',
      fuenteDatos: 'api',
      etapas: [{ id: stageId, maximoDecimal: '5.00', porcentajeDecimal: '50.00' }],
      carreras: [{ id: 'a62fa78b-296c-4b03-b38a-03af50eb9864', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: true }],
      categorias: [{
        id: categoryId,
        etapa: stageId,
        maximoDecimal: '0.33',
        indicadores: [{ id: indicatorId, codigo: 'A1', etiqueta: 'Presenta el problema de investigación.', maximoDecimal: '0.33' }],
      }],
    });
    expect(result).not.toHaveProperty('vigenteDesde');
    expect(result).not.toHaveProperty('vigenteHasta');
  });

  it('rechaza versiones, IDs de rúbrica o revisiones inconsistentes', () => {
    expect(() => adaptarRubricaApi(listado, { ...detalle, rubricaId: modalityId })).toThrow(/contrato/i);
    expect(() => adaptarRubricaApi(listado, { ...detalle, versiones: [{ ...detalle.versiones[0], revision: 8 }] })).toThrow(/contrato/i);
    expect(() => adaptarRubricaApi(listado, { ...detalle, versiones: [] })).toThrow(/contrato/i);
  });

  it('rechaza valores decimales mal formados y estados desconocidos', () => {
    const etapa = detalle.versiones[0].etapas[0];
    const malaNota = structuredClone(detalle);
    malaNota.versiones[0].etapas[0].calificacionMaxima = '5,00';
    expect(() => adaptarRubricaApi(listado, malaNota)).toThrow(/contrato/i);
    const malEstado = { ...listado, versiones: [{ ...resumen, estado: 'PUBLICADA' }] };
    expect(() => adaptarRubricaApi(malEstado, detalle)).toThrow(/contrato/i);
    expect(etapa.tipo).toBe('ESCRITA');
  });

  it('conserva el estado CONFIGURADA válido de las rúbricas completas', () => {
    const configurada = { ...resumen, estado: 'CONFIGURADA' };
    const listadoConfigurado = { ...listado, versiones: [configurada] };
    const detalleConfigurado = {
      ...detalle,
      versiones: [{ ...detalle.versiones[0], estado: 'CONFIGURADA' }],
    };
    expect(adaptarRubricaApi(listadoConfigurado, detalleConfigurado)[0].estado).toBe('CONFIGURADA');
  });

  it('acepta etapas personalizadas de versiones completas con etapas dinámicas', () => {
    const detallePersonalizado = structuredClone(detalle);
    detallePersonalizado.versiones[0].etapas[0].tipo = 'PERSONALIZADA';
    expect(adaptarRubricaApi(listado, detallePersonalizado)[0].etapas[0].tipo).toBe('PERSONALIZADA');
  });

  it('requiere asociaciones reales de carrera y conserva su vigencia independiente', () => {
    const conVigencias = structuredClone(detalle);
    conVigencias.versiones[0].carreras = [
      { id: 'a62fa78b-296c-4b03-b38a-03af50eb9864', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: true },
      { id: '2f47a4f0-95e3-469d-aec9-e00f84ae8a3d', codigo: 'TI', nombre: 'Tecnologías de la Información', vigente: false },
    ];
    const [version] = adaptarRubricaApi(listado, conVigencias);
    expect(version.carreras.map(({ nombre, vigente }) => ({ nombre, vigente }))).toEqual([
      { nombre: 'Ingeniería de Software', vigente: true },
      { nombre: 'Tecnologías de la Información', vigente: false },
    ]);

    const incompleta = structuredClone(detalle);
    delete incompleta.versiones[0].carreras;
    expect(() => adaptarRubricaApi(listado, incompleta)).toThrow(/contrato/i);
  });
});
