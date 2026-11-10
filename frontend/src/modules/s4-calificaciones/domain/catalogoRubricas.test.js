import { describe, expect, it } from 'vitest';
import {
  crearFilasCatalogoRubricas,
  filtrarRubricasCatalogo,
  FILTRO_NO_INFORMADA,
  FILTRO_SIN_ASOCIACION,
  ordenarRubricasCatalogo,
} from './catalogoRubricas';

const versionesApi = [
  {
    id: 'v1', idRubrica: 'familia-1', titulo: 'Rúbrica de artículo', modalidadId: 'm1',
    modalidad: 'Artículo científico', periodoId: 'p1', periodo: '2026-2', version: 'V1',
    estado: 'ARCHIVADA', carreras: [
      { id: 'c1', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: false },
      { id: 'c2', codigo: 'TI', nombre: 'Tecnologías de la Información', vigente: true },
    ],
  },
  {
    id: 'v2', idRubrica: 'familia-1', titulo: 'Rúbrica de artículo', modalidadId: 'm1',
    modalidad: 'Artículo científico', periodoId: 'p1', periodo: '2026-2', version: 'V2',
    estado: 'BORRADOR', carreras: [],
  },
  {
    id: 'v3', idRubrica: 'familia-2', titulo: 'Proyecto integrador', modalidadId: 'm2',
    modalidad: 'Proyecto integrador', periodoId: 'p2', periodo: '2026-1', version: 'V1',
    estado: 'ACTIVA', carreras: [{ id: 'c1', codigo: 'SOF', nombre: 'Ingeniería de Software', vigente: true }],
  },
];

describe('catálogo de rúbricas', () => {
  it('expande una versión asociada a varias carreras y conserva su vigencia individual', () => {
    const filas = crearFilasCatalogoRubricas(versionesApi, 'api');
    expect(filas.filter((fila) => fila.versionId === 'v1').map(({ carreraId, vigente }) => ({ carreraId, vigente }))).toEqual([
      { carreraId: 'c1', vigente: false },
      { carreraId: 'c2', vigente: true },
    ]);
  });

  it('representa versiones sin asociación sin inferir vigencia desde el estado técnico', () => {
    const [sinCarrera] = crearFilasCatalogoRubricas([versionesApi[1]], 'api');
    expect(sinCarrera).toMatchObject({
      carreraId: FILTRO_SIN_ASOCIACION,
      carrera: 'Sin carrera asociada',
      vigente: null,
      etiquetaVigencia: 'Sin asignación',
    });

    const [prototipo] = crearFilasCatalogoRubricas([{ ...versionesApi[2], estado: 'ACTIVA' }], 'prototipo');
    expect(prototipo).toMatchObject({
      carreraId: FILTRO_NO_INFORMADA,
      carrera: 'No disponible',
      vigente: null,
      etiquetaVigencia: 'No informada',
    });
  });

  it('filtra por carrera, modalidad, período, vigencia y búsqueda sin acentos', () => {
    const filas = crearFilasCatalogoRubricas(versionesApi, 'api');
    expect(filtrarRubricasCatalogo(filas, { carreraId: 'c1' }).map(({ versionId }) => versionId)).toEqual(['v1', 'v3']);
    expect(filtrarRubricasCatalogo(filas, { modalidadId: 'm1', periodoId: 'p1' })).toHaveLength(3);
    expect(filtrarRubricasCatalogo(filas, { vigencia: 'VIGENTE' }).map(({ versionId }) => versionId)).toEqual(['v1', 'v3']);
    expect(filtrarRubricasCatalogo(filas, { busqueda: '2026-1' })).toHaveLength(1);
    expect(filtrarRubricasCatalogo(filas, { busqueda: '2026-2', carreraId: 'c1', vigencia: 'NO_VIGENTE' })).toHaveLength(1);
  });

  it('ordena por etiquetas legibles y respeta la dirección solicitada', () => {
    const filas = crearFilasCatalogoRubricas(versionesApi, 'api');
    expect(ordenarRubricasCatalogo(filas, 'periodo').map(({ periodo }) => periodo)).toEqual(['2026-1', '2026-2', '2026-2', '2026-2']);
    expect(ordenarRubricasCatalogo(filas, 'version', 'desc').slice(0, 2).map(({ version }) => version)).toEqual(['V2', 'V1']);
  });
});
