import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { ModuloApi } from '../comun/api/modulo-api';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { EstadoVersionRubrica, EtapaEvaluacion, AlcanceEtapaRubrica } from '../comun/enums-dominio';
import { EsquemaInicial1760000000000 } from '../base-datos/migraciones/1760000000000-esquema-inicial';
import { EtapasRubricaDinamicas1760000001000 } from '../base-datos/migraciones/1760000001000-etapas-rubrica-dinamicas';
import { BorradoresRubricaAuditoria1760000002000 } from '../base-datos/migraciones/1760000002000-borradores-rubrica-auditoria';
import { GruposVaciosBorrador1760000003000 } from '../base-datos/migraciones/1760000003000-grupos-vacios-borrador';
import { CatalogoModalidades1760000004000 } from '../base-datos/migraciones/1760000004000-catalogo-modalidades';
import { ModalidadesModule } from '../modalidades/modalidades.module';
import { CategoriaRubrica } from './entidades/categoria-rubrica.entity';
import { EtapaRubrica } from './entidades/etapa-rubrica.entity';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { IndicadorRubrica } from './entidades/indicador-rubrica.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { RubricasModule } from './rubricas.module';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

if (testDatabaseUrl) {
  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
  if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL debe apuntar a una base aislada cuyo nombre incluya "test".');
  }
}

@Module({
  imports: [
    ModuloApi,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: testDatabaseUrl,
      autoLoadEntities: true,
      migrations: [EsquemaInicial1760000000000, EtapasRubricaDinamicas1760000001000, BorradoresRubricaAuditoria1760000002000, GruposVaciosBorrador1760000003000, CatalogoModalidades1760000004000],
      migrationsRun: true,
      synchronize: false,
    }),
    RubricasModule,
    ModalidadesModule,
  ],
})
class ModuloPruebasRubricas {}

suite('API de rúbricas (PostgreSQL real)', () => {
  let aplicacion: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let rubricaRepository: Repository<Rubrica>;
  let versionRepository: Repository<VersionRubrica>;
  let etapaRepository: Repository<EtapaRubrica>;
  let categoriaRepository: Repository<CategoriaRubrica>;
  let indicadorRepository: Repository<IndicadorRubrica>;
  let modalidadPrincipal: Modalidad;
  let modalidadSinVersiones: Modalidad;
  let periodoPrincipal: PeriodoAcademico;
  let rubricaPrincipal: Rubrica;
  let rubricaSinVersiones: Rubrica;
  let rubricaCreada: Rubrica;
  let versionBorrador: VersionRubrica;
  let versionConcurrente: VersionRubrica;
  let versionClonada: VersionRubrica;
  let modalidadAdministrada: { id: string; codigo: string; revision: number; estaActivo: boolean };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasRubricas] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((request: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _response: object, next: () => void) => {
      const principal = request.headers['x-principal-prueba'];
      const tipo = Array.isArray(principal) ? principal[0] : principal;
      const identidades: Record<string, IdentidadApi> = {
        autorizado: { sujeto: 'prueba-rubricas', tipo: 'VERIFICADA', capacidades: ['rubricas:leer', 'modalidades:leer'] },
        administrador: { sujeto: 'prueba-admin', tipo: 'VERIFICADA', capacidades: ['rubricas:leer', 'rubricas:administrar', 'modalidades:leer', 'modalidades:administrar'] },
        denegado: { sujeto: 'prueba-sin-capacidad', tipo: 'VERIFICADA', capacidades: [] },
      };
      (request as SolicitudConIdentidad).identidadApi = tipo ? identidades[tipo] : undefined;
      next();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();

    dataSource = modulo.get(DataSource);
    rubricaRepository = dataSource.getRepository(Rubrica);
    versionRepository = dataSource.getRepository(VersionRubrica);
    etapaRepository = dataSource.getRepository(EtapaRubrica);
    categoriaRepository = dataSource.getRepository(CategoriaRubrica);
    indicadorRepository = dataSource.getRepository(IndicadorRubrica);

    const modalityRepository = dataSource.getRepository(Modalidad);
    const periodRepository = dataSource.getRepository(PeriodoAcademico);
    const conteosPrevios = await Promise.all([
      modalityRepository.count(), periodRepository.count(), rubricaRepository.count(),
      versionRepository.count(), etapaRepository.count(), categoriaRepository.count(), indicadorRepository.count(),
      dataSource.getRepository(EventoAuditoriaRubrica).count(),
    ]);
    if (conteosPrevios.some((conteo) => conteo !== 0)) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base desechable y vacía; use una base nueva para cada ejecución.');
    }
    modalidadPrincipal = await modalityRepository.save(modalityRepository.create({
      codigo: `8B-${Date.now()}-PRES`,
      nombre: 'Modalidad de pruebas',
      estaActivo: true,
    }));
    modalidadSinVersiones = await modalityRepository.save(modalityRepository.create({
      codigo: `8B-${Date.now()}-VIRT`,
      nombre: 'Modalidad sin versiones',
      estaActivo: true,
    }));
    periodoPrincipal = await periodRepository.save(periodRepository.create({
      codigo: `8B-${Date.now()}`,
      estaActivo: true,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
    }));
    rubricaPrincipal = await rubricaRepository.save(rubricaRepository.create({
      modalidad: modalidadPrincipal,
      nombre: 'Rúbrica de pruebas',
      descripcion: 'Fixture exclusivo para pruebas HTTP.',
    }));
    rubricaSinVersiones = await rubricaRepository.save(rubricaRepository.create({
      modalidad: modalidadSinVersiones,
      nombre: 'Rúbrica sin versiones',
      descripcion: null,
    }));

    const historica = await crearVersionConCriterios('0.9', EstadoVersionRubrica.BORRADOR);
    const activa = await crearVersionConCriterios('1.0', EstadoVersionRubrica.BORRADOR);
    activa.estado = EstadoVersionRubrica.ACTIVA;
    activa.activadoEn = new Date('2026-02-01T12:00:00.000Z');
    await versionRepository.save(activa);
    historica.estado = EstadoVersionRubrica.ARCHIVADA;
    historica.activadoEn = new Date('2026-01-01T12:00:00.000Z');
    await versionRepository.save(historica);
  }, 30000);

  async function crearVersionConCriterios(versionTexto: string, estado: EstadoVersionRubrica): Promise<VersionRubrica> {
    const version = await versionRepository.save(versionRepository.create({
      rubrica: rubricaPrincipal,
      academicPeriod: periodoPrincipal,
      version: versionTexto,
      estado,
      activadoEn: null,
    }));
    for (const [orden, tipo] of [EtapaEvaluacion.ESCRITA, EtapaEvaluacion.ORAL].entries()) {
      const etapa = await etapaRepository.save(etapaRepository.create({
        rubricVersion: version,
        kind: tipo,
        scope: tipo === EtapaEvaluacion.ESCRITA
          ? AlcanceEtapaRubrica.TRABAJO_COMPARTIDO
          : AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL,
        codigo: tipo,
        nombre: tipo === EtapaEvaluacion.ESCRITA ? 'Evaluación escrita' : 'Sustentación oral',
        descripcion: null,
        calificacionMaxima: '5.00',
        porcentaje: tipo === EtapaEvaluacion.ESCRITA ? '50.00' : '50.00',
        orden: orden + 1,
      }));
      const categoria = await categoriaRepository.save(categoriaRepository.create({
        rubricVersion: version,
        etapa,
        codigo: tipo === EtapaEvaluacion.ESCRITA ? 'ESC' : 'ORA',
        nombre: `Categoría ${tipo}`,
        calificacionMaxima: '5.00',
        orden: orden + 1,
      }));
      await indicadorRepository.save(indicadorRepository.create({
        categoria,
        label: `IND-${tipo}`,
        descripcion: `Indicador histórico ${tipo}`,
        calificacionMaxima: '5.00',
        orden: 1,
      }));
    }
    return version;
  }

  afterAll(async () => {
    await aplicacion?.close();
  });

  async function request(
    path: string,
    principal?: 'autorizado' | 'administrador' | 'denegado',
    method = 'GET',
    body?: unknown,
    correlationId?: string,
  ): Promise<Response> {
    const headers = new Headers();
    if (principal) headers.set('x-principal-prueba', principal);
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (correlationId) headers.set('x-correlation-id', correlationId);
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async function capturarEstadoPersistido(): Promise<string> {
    const filas = await dataSource.query(`
      SELECT tabla, id, xmin, datos FROM (
        SELECT 'modalidades' AS tabla, id::text AS id, xmin::text AS xmin, to_jsonb(t) AS datos FROM modalidades t
        UNION ALL SELECT 'periodos_academicos', id::text, xmin::text, to_jsonb(t) FROM periodos_academicos t
        UNION ALL SELECT 'rubricas', id::text, xmin::text, to_jsonb(t) FROM rubricas t
        UNION ALL SELECT 'versiones_rubrica', id::text, xmin::text, to_jsonb(t) FROM versiones_rubrica t
        UNION ALL SELECT 'etapas_rubrica', id::text, xmin::text, to_jsonb(t) FROM etapas_rubrica t
        UNION ALL SELECT 'categorias_rubrica', id::text, xmin::text, to_jsonb(t) FROM categorias_rubrica t
        UNION ALL SELECT 'indicadores_rubrica', id::text, xmin::text, to_jsonb(t) FROM indicadores_rubrica t
        UNION ALL SELECT 'auditoria_rubricas', id::text, xmin::text, to_jsonb(t) FROM auditoria_rubricas t
      ) AS filas
      ORDER BY tabla, id
    `);
    return JSON.stringify(filas);
  }

  it('aplica autorización por capacidad a ambos endpoints', async () => {
    expect((await request('/api/v1/rubricas')).status).toBe(401);
    expect((await request('/api/v1/rubricas', 'denegado')).status).toBe(403);
    expect((await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`)).status).toBe(401);
    expect((await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'denegado')).status).toBe(403);
  });

  it('expone solo el permiso administrativo efectivo de la identidad autenticada', async () => {
    const soloLectura = await request('/api/v1/rubricas/capacidades', 'autorizado');
    expect(soloLectura.status).toBe(200);
    expect(await soloLectura.json()).toEqual({ puedeAdministrar: false });

    const administrador = await request('/api/v1/rubricas/capacidades', 'administrador');
    expect(administrador.status).toBe(200);
    expect(await administrador.json()).toEqual({ puedeAdministrar: true });

    expect((await request('/api/v1/rubricas/capacidades')).status).toBe(401);
    expect((await request('/api/v1/rubricas/capacidades', 'denegado')).status).toBe(403);
  });

  it('expone solo modalidades y períodos activos como catálogos de escritura', async () => {
    const beforeSnapshot = await capturarEstadoPersistido();
    const respuesta = await request('/api/v1/rubricas/catalogos', 'autorizado');
    expect(respuesta.status).toBe(200);
    const catalogos = await respuesta.json();
    expect(catalogos.modalidades).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: modalidadPrincipal.id, codigo: modalidadPrincipal.codigo, nombre: modalidadPrincipal.nombre }),
    ]));
    expect(catalogos.periodos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: periodoPrincipal.id, codigo: periodoPrincipal.codigo }),
    ]));
    expect(catalogos.modalidades.every((modalidad: { estaActivo?: boolean }) => modalidad.estaActivo === undefined)).toBe(true);
    expect(await capturarEstadoPersistido()).toBe(beforeSnapshot);
    expect((await request('/api/v1/rubricas/catalogos')).status).toBe(401);
    expect((await request('/api/v1/rubricas/catalogos', 'denegado')).status).toBe(403);
  });

  it('lista rúbricas con y sin versiones, y filtra por modalidad, período y estado', async () => {
    const before = await Promise.all([
      rubricaRepository.count(), versionRepository.count(), etapaRepository.count(),
      categoriaRepository.count(), indicadorRepository.count(),
    ]);
    const beforeSnapshot = await capturarEstadoPersistido();
    const response = await request('/api/v1/rubricas', 'autorizado');
    expect(response.status).toBe(200);
    const results = await response.json();
    const rubric = results.find((entry: { id: string }) => entry.id === rubricaPrincipal.id);
    const emptyRubric = results.find((entry: { id: string }) => entry.id === rubricaSinVersiones.id);
    expect(rubric.versiones).toHaveLength(2);
    expect(emptyRubric.versiones).toEqual([]);
    expect(rubric).not.toHaveProperty('creadoEn');

    const byModality = await request(`/api/v1/rubricas?modalidadId=${modalidadPrincipal.id}`, 'autorizado');
    expect((await byModality.json()).map((entry: { id: string }) => entry.id)).toEqual([rubricaPrincipal.id]);
    const byPeriod = await request(`/api/v1/rubricas?periodoId=${periodoPrincipal.id}`, 'autorizado');
    expect((await byPeriod.json()).map((entry: { id: string }) => entry.id)).toEqual([rubricaPrincipal.id]);
    const byState = await request('/api/v1/rubricas?estado=ACTIVA', 'autorizado');
    const activeResult = (await byState.json())[0];
    expect(activeResult.id).toBe(rubricaPrincipal.id);
    expect(activeResult.versiones).toHaveLength(1);
    expect(activeResult.versiones[0].estado).toBe('ACTIVA');

    const after = await Promise.all([
      rubricaRepository.count(), versionRepository.count(), etapaRepository.count(),
      categoriaRepository.count(), indicadorRepository.count(),
    ]);
    expect(after).toEqual(before);
    expect(await capturarEstadoPersistido()).toBe(beforeSnapshot);
  });

  it('rechaza filtros inválidos, parámetros desconocidos e identificadores mal formados', async () => {
    expect((await request('/api/v1/rubricas?estado=INVALIDO', 'autorizado')).status).toBe(400);
    expect((await request('/api/v1/rubricas?modalidadId=no-es-uuid', 'autorizado')).status).toBe(400);
    expect((await request('/api/v1/rubricas?campoExtra=true', 'autorizado')).status).toBe(400);
    expect((await request('/api/v1/rubricas/no-es-uuid/versiones', 'autorizado')).status).toBe(400);
  });

  it('devuelve versiones históricas con etapas, categorías e indicadores en orden y sin redondear decimales', async () => {
    const before = await Promise.all([
      rubricaRepository.count(), versionRepository.count(), etapaRepository.count(),
      categoriaRepository.count(), indicadorRepository.count(),
    ]);
    const beforeSnapshot = await capturarEstadoPersistido();
    const response = await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'autorizado');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rubricaId).toBe(rubricaPrincipal.id);
    expect(body.versiones.map((version: { estado: string }) => version.estado)).toEqual(['ARCHIVADA', 'ACTIVA']);
    expect(body.versiones[1].revision).toBe(1);
    const escrita = body.versiones[1].etapas[0];
    expect(escrita).toMatchObject({ tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', calificacionMaxima: '5.00' });
    expect(escrita.categorias[0]).toMatchObject({ calificacionMaxima: '5.00', orden: 1 });
    expect(escrita.categorias[0].indicadores[0]).toMatchObject({
      label: 'IND-ESCRITA', descripcion: 'Indicador histórico ESCRITA', calificacionMaxima: '5.00',
    });
    expect(escrita.id).toBeTruthy();
    expect(escrita.categorias[0].id).toBeTruthy();
    expect(escrita.categorias[0].indicadores[0].id).toBeTruthy();
    expect(body.versiones[0].etapas[1]).toMatchObject({ tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL' });

    const withoutVersions = await request(`/api/v1/rubricas/${rubricaSinVersiones.id}/versiones`, 'autorizado');
    expect(await withoutVersions.json()).toEqual({ rubricaId: rubricaSinVersiones.id, versiones: [] });
    const missing = await request('/api/v1/rubricas/33333333-3333-4333-8333-333333333333/versiones', 'autorizado');
    expect(missing.status).toBe(404);
    const after = await Promise.all([
      rubricaRepository.count(), versionRepository.count(), etapaRepository.count(),
      categoriaRepository.count(), indicadorRepository.count(),
    ]);
    expect(after).toEqual(before);
    expect(await capturarEstadoPersistido()).toBe(beforeSnapshot);
  });

  it('crea rúbricas con identidad de la solicitud y registra auditoría transaccional', async () => {
    const modalidad = await dataSource.getRepository(Modalidad).save({
      codigo: `8C-${Date.now()}-NEW`, nombre: 'Modalidad nueva', estaActivo: true,
    });
    const dto = { modalidadId: modalidad.id, nombre: 'Rúbrica nueva', descripcion: null };
    expect((await request('/api/v1/rubricas', 'administrador', 'POST', {
      modalidadId: '33333333-3333-4333-8333-333333333333', nombre: 'Sin modalidad',
    })).status).toBe(404);
    expect((await request('/api/v1/rubricas', undefined, 'POST', dto)).status).toBe(401);
    expect((await request('/api/v1/rubricas', 'autorizado', 'POST', dto)).status).toBe(403);
    const response = await request('/api/v1/rubricas', 'administrador', 'POST', dto, 'req-8c-create');
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ nombre: 'Rúbrica nueva', modalidad: { id: modalidad.id } });
    rubricaCreada = await rubricaRepository.findOneByOrFail({ id: body.id });
    const eventos = await dataSource.query(
      'SELECT actor_id, accion, rubrica_id, version_id, correlation_id FROM auditoria_rubricas WHERE rubrica_id = $1',
      [body.id],
    );
    expect(eventos).toEqual([expect.objectContaining({
      actor_id: 'prueba-admin', accion: 'RUBRICA_CREADA', rubrica_id: body.id,
      version_id: null, correlation_id: 'req-8c-create',
    })]);
    expect((await request('/api/v1/rubricas', 'administrador', 'POST', { ...dto, actorId: 'spoofed' })).status).toBe(400);
    expect((await request('/api/v1/rubricas', 'administrador', 'POST', dto)).status).toBe(409);
  });

  it('crea borradores incompletos y clona estructuras con identificadores nuevos', async () => {
    const response = await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'administrador', 'POST', {
      periodoId: periodoPrincipal.id, version: ' 1.0 ',
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ version: '1.0', estado: 'BORRADOR', revision: 1 });
    versionBorrador = await versionRepository.findOneByOrFail({ id: body.id });
    expect(await dataSource.getRepository(EtapaRubrica).countBy({ rubricVersion: { id: body.id } })).toBe(0);

    expect((await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'administrador', 'POST', {
      periodoId: periodoPrincipal.id, version: '1.0', estado: 'ACTIVA',
    })).status).toBe(400);
    expect((await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'administrador', 'POST', {
      periodoId: periodoPrincipal.id, version: '1.0',
    })).status).toBe(409);
    expect((await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'administrador', 'POST', {
      periodoId: '33333333-3333-4333-8333-333333333333', version: 'sin-periodo',
    })).status).toBe(404);

    const sourceVersion = await versionRepository.findOneByOrFail({ version: '1.0', rubrica: { id: rubricaPrincipal.id } });
    const cloneResponse = await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'administrador', 'POST', {
      periodoId: periodoPrincipal.id,
      version: '2.0',
      copiarDesdeVersionId: sourceVersion.id,
    });
    expect(cloneResponse.status).toBe(201);
    const clone = await cloneResponse.json();
    versionClonada = await versionRepository.findOneByOrFail({ id: clone.id });
    const oldStructure = await dataSource.getRepository(EtapaRubrica).find({
      where: { rubricVersion: { id: sourceVersion.id } },
    });
    const copiedStructure = await dataSource.getRepository(EtapaRubrica).find({
      where: { rubricVersion: { id: clone.id } },
    });
    expect(copiedStructure).toHaveLength(2);
    expect(copiedStructure.map(({ id }) => id)).not.toEqual(oldStructure.map(({ id }) => id));
    const oldCategories = await dataSource.getRepository(CategoriaRubrica).find({
      where: { rubricVersion: { id: sourceVersion.id } },
    });
    const copiedCategories = await dataSource.getRepository(CategoriaRubrica).find({
      where: { rubricVersion: { id: clone.id } },
    });
    expect(copiedCategories).toHaveLength(oldCategories.length);
    expect(copiedCategories.map(({ id }) => id)).not.toEqual(oldCategories.map(({ id }) => id));
    const oldIndicators = await dataSource.getRepository(IndicadorRubrica).find({
      where: { categoria: { rubricVersion: { id: sourceVersion.id } } },
    });
    const copiedIndicators = await dataSource.getRepository(IndicadorRubrica).find({
      where: { categoria: { rubricVersion: { id: clone.id } } },
    });
    expect(copiedIndicators).toHaveLength(oldIndicators.length);
    expect(copiedIndicators.map(({ id }) => id)).not.toEqual(oldIndicators.map(({ id }) => id));
  });

  it('guarda estructuras válidas e incompletas y aplica concurrencia optimista', async () => {
    const unaEtapa = {
      tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Revisión escrita',
      calificacionMaxima: 5, porcentaje: 50, orden: 1, categorias: [],
    };
    const incomplete = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 1, etapas: [unaEtapa],
    });
    expect(incomplete.status).toBe(200);
    expect(await incomplete.json()).toMatchObject({ estado: 'BORRADOR', revision: 2, etapas: [{ categorias: [] }] });

    const estructuraCompleta = [
      { ...unaEtapa, calificacionMaxima: 5.25, porcentaje: null, categorias: [{ codigo: 'ESC-CAT', nombre: 'Criterio escrito', calificacionMaxima: 5.25, orden: 1, indicadores: [{ label: 'IND-E', descripcion: 'Indicador escrito', calificacionMaxima: 5.25, orden: 1 }] }] },
      { tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'ORA', nombre: 'Sustentación oral', calificacionMaxima: 4.7, porcentaje: null, orden: 2, categorias: [{ codigo: 'ORA-CAT', nombre: 'Criterio oral', calificacionMaxima: 4.7, orden: 2, indicadores: [{ label: 'IND-O', descripcion: 'Indicador oral', calificacionMaxima: 4.7, orden: 1 }] }] },
    ];
    const updated = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 2, etapas: estructuraCompleta,
    });
    expect(updated.status).toBe(200);
    const result = await updated.json();
    expect(result).toMatchObject({ revision: 3, estado: 'BORRADOR' });
    expect(result.etapas[0].calificacionMaxima).toBe('5.25');
    expect(result.etapas[1].calificacionMaxima).toBe('4.70');

    const idsDuplicados = structuredClone(result.etapas);
    idsDuplicados[1].categorias[0].id = idsDuplicados[0].categorias[0].id;
    expect((await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 3, etapas: idsDuplicados,
    })).status).toBe(400);
    const versionFuente = await versionRepository.findOneByOrFail({ version: '1.0', rubrica: { id: rubricaPrincipal.id } });
    const idHistorico = (await dataSource.getRepository(EtapaRubrica).findOneByOrFail({
      rubricVersion: { id: versionFuente.id },
    })).id;
    expect((await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 3,
      etapas: [{ ...unaEtapa, id: idHistorico }],
    })).status).toBe(400);

    const sameIds = structuredClone(result.etapas);
    sameIds[0].categorias[0].indicadores[0].descripcion = 'Texto actualizado';
    const savedSameIds = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 3, etapas: sameIds,
    });
    expect(savedSameIds.status).toBe(200);
    expect((await savedSameIds.json()).revision).toBe(4);
    const recargada = await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'autorizado');
    expect(recargada.status).toBe(200);
    const versionesRecargadas = await recargada.json();
    const versionRecargada = versionesRecargadas.versiones.find((version: { id: string }) => version.id === versionBorrador.id);
    expect(versionRecargada?.revision).toBe(4);
    expect(versionRecargada?.etapas[0].categorias[0].indicadores[0].descripcion).toBe('Texto actualizado');
    const eventosActualizacion = await dataSource.query(
      'SELECT actor_id, accion, version_id FROM auditoria_rubricas WHERE version_id = $1 ORDER BY ocurrido_en',
      [versionBorrador.id],
    );
    expect(eventosActualizacion.some((evento: { actor_id: string; accion: string }) =>
      evento.actor_id === 'prueba-admin' && evento.accion === 'VERSION_BORRADOR_ACTUALIZADA')).toBe(true);

    const stale = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 2, etapas: [],
    });
    expect(stale.status).toBe(409);
    const invalidSum = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 4,
      etapas: estructuraCompleta.map((etapa, index) => index === 0
        ? { ...etapa, categorias: [{ ...etapa.categorias[0], calificacionMaxima: 5 }] }
        : etapa),
    });
    expect(invalidSum.status).toBe(400);
    const invalidDecimal = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 4, etapas: [{ ...unaEtapa, calificacionMaxima: -1 }],
    });
    expect(invalidDecimal.status).toBe(400);
    const excessiveDecimals = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
      revision: 4, etapas: [{ ...unaEtapa, calificacionMaxima: '1.234' }],
    });
    expect(excessiveDecimals.status).toBe(400);

    const newDraftResponse = await request(`/api/v1/rubricas/${rubricaCreada.id}/versiones`, 'administrador', 'POST', {
      periodoId: periodoPrincipal.id, version: 'concurrente',
    });
    versionConcurrente = await versionRepository.findOneByOrFail({ id: (await newDraftResponse.json()).id });
    const concurrentResponses = await Promise.all([
      request(`/api/v1/versiones-rubrica/${versionConcurrente.id}`, 'administrador', 'PUT', { revision: 1, etapas: [] }),
      request(`/api/v1/versiones-rubrica/${versionConcurrente.id}`, 'administrador', 'PUT', { revision: 1, etapas: [unaEtapa] }),
    ]);
    expect(concurrentResponses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect((await versionRepository.findOneByOrFail({ id: versionConcurrente.id })).revision).toBe(2);
  });

  it('rechaza cambios a versiones activas o archivadas y protege la auditoría append-only', async () => {
    for (const version of await versionRepository.find({ where: { rubrica: { id: rubricaPrincipal.id } } })) {
      if (version.estado === EstadoVersionRubrica.BORRADOR) continue;
      const response = await request(`/api/v1/versiones-rubrica/${version.id}`, 'administrador', 'PUT', {
        revision: 1, etapas: [],
      });
      expect(response.status).toBe(409);
    }
    const auditoriaAntes = await dataSource.query('SELECT count(*)::int AS total FROM auditoria_rubricas');
    const auditoriaId = (await dataSource.query('SELECT id FROM auditoria_rubricas ORDER BY ocurrido_en LIMIT 1'))[0].id;
    await expect(dataSource.query('UPDATE auditoria_rubricas SET accion = accion WHERE id = $1', [auditoriaId])).rejects.toThrow();
    await expect(dataSource.query('DELETE FROM auditoria_rubricas WHERE id = $1', [auditoriaId])).rejects.toThrow();
    await expect(dataSource.query('TRUNCATE auditoria_rubricas')).rejects.toThrow();
    const auditoriaDespues = await dataSource.query('SELECT count(*)::int AS total FROM auditoria_rubricas');
    expect(auditoriaDespues[0].total).toBe(auditoriaAntes[0].total);
  });

  it('activa una versión válida, archiva la anterior y preserva el historial', async () => {
    const activaInicial = await versionRepository.findOneByOrFail({
      version: '1.0', rubrica: { id: rubricaPrincipal.id },
    });
    const historica = await versionRepository.findOneByOrFail({
      version: '0.9', rubrica: { id: rubricaPrincipal.id },
    });
    const historicaAntes = { ...historica };
    const estructurasAntes = await Promise.all([
      etapaRepository.count(), categoriaRepository.count(), indicadorRepository.count(),
      dataSource.query('SELECT count(*)::int AS total FROM evaluaciones').then((rows) => rows[0].total),
      dataSource.query('SELECT count(*)::int AS total FROM calificaciones_evaluacion').then((rows) => rows[0].total),
    ]);

    expect((await request(`/api/v1/versiones-rubrica/${versionClonada.id}/activar`, undefined, 'POST', { revision: 1 })).status).toBe(401);
    expect((await request(`/api/v1/versiones-rubrica/${versionClonada.id}/activar`, 'autorizado', 'POST', { revision: 1 })).status).toBe(403);
    expect((await request('/api/v1/versiones-rubrica/33333333-3333-4333-8333-333333333333/activar', 'administrador', 'POST', { revision: 1 })).status).toBe(404);
    expect((await request(`/api/v1/versiones-rubrica/${versionClonada.id}/activar`, 'administrador', 'POST', { revision: 2 })).status).toBe(409);
    expect((await request(`/api/v1/versiones-rubrica/${versionConcurrente.id}/activar`, 'administrador', 'POST', { revision: 2 })).status).toBe(400);

    const categoriaAjustada = await categoriaRepository.findOneByOrFail({
      rubricVersion: { id: versionBorrador.id }, codigo: 'ESC-CAT',
    });
    await categoriaRepository.update(categoriaAjustada.id, { calificacionMaxima: '5.24' });
    await expect(dataSource.query(
      "UPDATE versiones_rubrica SET estado = 'ACTIVA' WHERE id = $1",
      [versionBorrador.id],
    )).rejects.toThrow();
    expect((await request(`/api/v1/versiones-rubrica/${versionBorrador.id}/activar`, 'administrador', 'POST', { revision: 4 })).status).toBe(400);
    await categoriaRepository.update(categoriaAjustada.id, { calificacionMaxima: '5.25' });

    const response = await request(
      `/api/v1/versiones-rubrica/${versionClonada.id}/activar`,
      'administrador',
      'POST',
      { revision: 1 },
      'req-8d-activate',
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activada).toMatchObject({ id: versionClonada.id, estado: 'ACTIVA', revision: 1 });
    expect(body.archivada).toMatchObject({ id: activaInicial.id, estado: 'ARCHIVADA' });
    expect((await versionRepository.findOneByOrFail({ id: activaInicial.id })).activadoEn?.toISOString())
      .toBe(activaInicial.activadoEn?.toISOString());
    expect(await versionRepository.findOneByOrFail({ id: historica.id })).toEqual(historicaAntes);
    expect(await versionRepository.countBy({ rubrica: { id: rubricaPrincipal.id }, academicPeriod: { id: periodoPrincipal.id }, estado: EstadoVersionRubrica.ACTIVA })).toBe(1);
    expect(await Promise.all([
      etapaRepository.count(), categoriaRepository.count(), indicadorRepository.count(),
      dataSource.query('SELECT count(*)::int AS total FROM evaluaciones').then((rows) => rows[0].total),
      dataSource.query('SELECT count(*)::int AS total FROM calificaciones_evaluacion').then((rows) => rows[0].total),
    ])).toEqual(estructurasAntes);

    const eventos = await dataSource.query(
      'SELECT actor_id, accion, version_id, correlation_id FROM auditoria_rubricas WHERE version_id = ANY($1::uuid[]) ORDER BY accion',
      [[versionClonada.id, activaInicial.id]],
    );
    expect(eventos).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor_id: 'prueba-admin', accion: 'VERSION_RUBRICA_ACTIVADA', version_id: versionClonada.id, correlation_id: 'req-8d-activate' }),
      expect.objectContaining({ actor_id: 'prueba-admin', accion: 'VERSION_RUBRICA_ARCHIVADA_POR_ACTIVACION', version_id: activaInicial.id, correlation_id: 'req-8d-activate' }),
    ]));

    expect((await request(`/api/v1/versiones-rubrica/${versionClonada.id}/activar`, 'administrador', 'POST', { revision: 1 })).status).toBe(409);
    expect((await request(`/api/v1/versiones-rubrica/${activaInicial.id}/activar`, 'administrador', 'POST', { revision: 1 })).status).toBe(409);
  });

  it('serializa activaciones concurrentes y revierte archivo, activación y auditoría si falla la transacción', async () => {
    const activar = async (version: string) => {
      const creada = await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'administrador', 'POST', {
        periodoId: periodoPrincipal.id,
        version,
        copiarDesdeVersionId: versionClonada.id,
      });
      expect(creada.status).toBe(201);
      return await creada.json() as { id: string; revision: number };
    };
    const [candidataA, candidataB] = await Promise.all([activar('3.0'), activar('4.0')]);
    const respuestas = await Promise.all([
      request(`/api/v1/versiones-rubrica/${candidataA.id}/activar`, 'administrador', 'POST', { revision: candidataA.revision }),
      request(`/api/v1/versiones-rubrica/${candidataB.id}/activar`, 'administrador', 'POST', { revision: candidataB.revision }),
    ]);
    expect(respuestas.map(({ status }) => status)).toEqual([200, 200]);
    expect(await versionRepository.countBy({ rubrica: { id: rubricaPrincipal.id }, academicPeriod: { id: periodoPrincipal.id }, estado: EstadoVersionRubrica.ACTIVA })).toBe(1);
    const estadoA = (await versionRepository.findOneByOrFail({ id: candidataA.id })).estado;
    const estadoB = (await versionRepository.findOneByOrFail({ id: candidataB.id })).estado;
    expect([estadoA, estadoB].filter((estado) => estado === EstadoVersionRubrica.ACTIVA)).toHaveLength(1);
    expect([estadoA, estadoB].filter((estado) => estado === EstadoVersionRubrica.ARCHIVADA)).toHaveLength(1);

    const dobleCandidata = await activar('4.5');
    const dobleRespuestas = await Promise.all([
      request(`/api/v1/versiones-rubrica/${dobleCandidata.id}/activar`, 'administrador', 'POST', { revision: 1 }),
      request(`/api/v1/versiones-rubrica/${dobleCandidata.id}/activar`, 'administrador', 'POST', { revision: 1 }),
    ]);
    expect(dobleRespuestas.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(await dataSource.query(
      "SELECT count(*)::int AS total FROM auditoria_rubricas WHERE version_id = $1 AND accion = 'VERSION_RUBRICA_ACTIVADA'",
      [dobleCandidata.id],
    ).then((rows) => rows[0].total)).toBe(1);

    const activaAntes = await versionRepository.findOneByOrFail({
      rubrica: { id: rubricaPrincipal.id }, academicPeriod: { id: periodoPrincipal.id }, estado: EstadoVersionRubrica.ACTIVA,
    });
    const candidataRollback = await activar('5.0');
    const auditoriaAntes = await dataSource.query('SELECT count(*)::int AS total FROM auditoria_rubricas');
    await dataSource.query(`
      CREATE FUNCTION "test_rechazar_auditoria_activacion"() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo de auditoría de activación simulado'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_rechazar_auditoria_activacion"
      BEFORE INSERT ON "auditoria_rubricas"
      FOR EACH ROW EXECUTE FUNCTION "test_rechazar_auditoria_activacion"();
    `);
    try {
      const response = await request(`/api/v1/versiones-rubrica/${candidataRollback.id}/activar`, 'administrador', 'POST', {
        revision: candidataRollback.revision,
      });
      expect(response.status).toBe(500);
      expect((await versionRepository.findOneByOrFail({ id: activaAntes.id })).estado).toBe(EstadoVersionRubrica.ACTIVA);
      expect((await versionRepository.findOneByOrFail({ id: candidataRollback.id })).estado).toBe(EstadoVersionRubrica.BORRADOR);
      expect((await dataSource.query('SELECT count(*)::int AS total FROM auditoria_rubricas'))[0].total).toBe(auditoriaAntes[0].total);
      expect(await versionRepository.countBy({ rubrica: { id: rubricaPrincipal.id }, academicPeriod: { id: periodoPrincipal.id }, estado: EstadoVersionRubrica.ACTIVA })).toBe(1);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS "test_rechazar_auditoria_activacion" ON "auditoria_rubricas"');
      await dataSource.query('DROP FUNCTION IF EXISTS "test_rechazar_auditoria_activacion"()');
    }
  });

  it('persiste A=2, B=5 y grupos vacíos, reordena y elimina sin reutilizar UUID ni alterar historia', async () => {
    const consultar = async () => (await (await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'autorizado')).json()).versiones;
    const historiaAntes = JSON.stringify((await consultar()).filter((v: { estado: string }) => v.estado !== 'BORRADOR'));
    const creada = await request(`/api/v1/rubricas/${rubricaPrincipal.id}/versiones`, 'administrador', 'POST', { periodoId: periodoPrincipal.id, version: '9F-variable' });
    expect(creada.status).toBe(201);
    const version = await creada.json();
    const categoria = (codigo: string, cantidad: number, orden: number) => ({
      codigo, nombre: `Categoría ${codigo}`, calificacionMaxima: `0.${String(cantidad * 10).padStart(2, '0')}`, orden,
      indicadores: Array.from({ length: cantidad }, (_, i) => ({ label: `${codigo}${i + 1}`, descripcion: `Diseño ${codigo}${i + 1}`, calificacionMaxima: '0.10', orden: i + 1 })),
    });
    const etapas = [
      { tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Escrita', calificacionMaxima: '0.70', orden: 1, categorias: [categoria('A', 2, 1), categoria('B', 5, 2), categoria('C', 0, 3)] },
      { tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'ORA', nombre: 'Oral', calificacionMaxima: '0.00', orden: 2, categorias: [] },
    ];
    const guardada = await request(`/api/v1/versiones-rubrica/${version.id}`, 'administrador', 'PUT', { revision: 1, etapas });
    expect(guardada.status).toBe(200);
    const cuerpo = await guardada.json();
    expect(cuerpo.revision).toBe(2);
    expect(cuerpo.etapas[0].categorias.map((c: { indicadores: unknown[] }) => c.indicadores.length)).toEqual([2, 5, 0]);
    expect(cuerpo.etapas[0].categorias[2].calificacionMaxima).toBe('0.00');
    expect(cuerpo.etapas[1].calificacionMaxima).toBe('0.00');
    expect((await consultar()).find((v: { id: string }) => v.id === version.id).etapas).toEqual(cuerpo.etapas);
    expect((await request(`/api/v1/versiones-rubrica/${version.id}/activar`, 'administrador', 'POST', { revision: 2 })).status).toBe(400);
    await expect(dataSource.query("UPDATE versiones_rubrica SET estado='ACTIVA', activada_en=now() WHERE id=$1", [version.id])).rejects.toThrow();
    const runner = dataSource.createQueryRunner();
    try { await expect(new GruposVaciosBorrador1760000003000().down(runner)).rejects.toThrow(/grupos vacíos/); }
    finally { await runner.release(); }

    const editadas = structuredClone(cuerpo.etapas);
    const [a, b, c] = editadas[0].categorias;
    const eliminado = b.indicadores.shift();
    b.indicadores.reverse();
    b.indicadores.push({ label: 'B-NUEVO', descripcion: 'Nuevo indicador', calificacionMaxima: '0.25', orden: 5 });
    b.indicadores.forEach((i: { orden: number }, indice: number) => { i.orden = indice + 1; });
    b.calificacionMaxima = '0.65'; b.orden = 1; a.orden = 2;
    editadas[0].categorias = [b, a]; editadas[0].calificacionMaxima = '0.85';
    const reemplazo = await request(`/api/v1/versiones-rubrica/${version.id}`, 'administrador', 'PUT', { revision: 2, etapas: editadas });
    expect(reemplazo.status).toBe(200);
    const final = await reemplazo.json();
    expect(final.revision).toBe(3);
    expect(final.etapas[0].categorias.map((c: { id: string }) => c.id)).toEqual([b.id, a.id]);
    expect(final.etapas[0].categorias[0].indicadores.slice(0, 4).map((i: { id: string }) => i.id)).toEqual(b.indicadores.slice(0, 4).map((i: { id: string }) => i.id));
    expect(final.etapas[0].categorias[0].indicadores[4].id).not.toBe(eliminado.id);
    expect(final.etapas[0].calificacionMaxima).toBe('0.85');
    expect(await categoriaRepository.findOneBy({ id: c.id })).toBeNull();
    expect(await indicadorRepository.findOneBy({ id: eliminado.id })).toBeNull();
    expect((await request(`/api/v1/versiones-rubrica/${version.id}`, 'administrador', 'PUT', { revision: 2, etapas: editadas })).status).toBe(409);
    const reutilizar = structuredClone(final.etapas);
    reutilizar[0].categorias[0].indicadores[4].id = eliminado.id;
    expect((await request(`/api/v1/versiones-rubrica/${version.id}`, 'administrador', 'PUT', { revision: 3, etapas: reutilizar })).status).toBe(400);
    expect((await consultar()).find((v: { id: string }) => v.id === version.id)).toMatchObject({ revision: 3, etapas: final.etapas });
    expect(JSON.stringify((await consultar()).filter((v: { estado: string }) => v.estado !== 'BORRADOR'))).toBe(historiaAntes);
    const auditoria = await dataSource.query("SELECT actor_id FROM auditoria_rubricas WHERE version_id=$1 AND accion='VERSION_BORRADOR_ACTUALIZADA'", [version.id]);
    expect(auditoria).toEqual([{ actor_id: 'prueba-admin' }, { actor_id: 'prueba-admin' }]);
  });

  it('revierte toda la operación si no puede insertar el evento de auditoría', async () => {
    const beforeRevision = (await versionRepository.findOneByOrFail({ id: versionBorrador.id })).revision;
    const beforeSnapshot = await capturarEstadoPersistido();
    await dataSource.query(`
      CREATE FUNCTION "test_rechazar_auditoria_rubrica"() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo de auditoría simulado'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_rechazar_auditoria_rubrica"
      BEFORE INSERT ON "auditoria_rubricas"
      FOR EACH ROW EXECUTE FUNCTION "test_rechazar_auditoria_rubrica"();
    `);
    try {
      const response = await request(`/api/v1/versiones-rubrica/${versionBorrador.id}`, 'administrador', 'PUT', {
        revision: beforeRevision, etapas: [],
      });
      expect(response.status).toBe(500);
      expect((await versionRepository.findOneByOrFail({ id: versionBorrador.id })).revision).toBe(beforeRevision);
      expect(await capturarEstadoPersistido()).toBe(beforeSnapshot);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS "test_rechazar_auditoria_rubrica" ON "auditoria_rubricas"');
      await dataSource.query('DROP FUNCTION IF EXISTS "test_rechazar_auditoria_rubrica"()');
    }
  });

  it('protege lectura administrativa, DTO y filtro de modalidades disponibles', async () => {
    expect((await request('/api/v1/modalidades')).status).toBe(401);
    expect((await request('/api/v1/modalidades', 'denegado')).status).toBe(403);
    expect((await request('/api/v1/modalidades/capacidades', 'autorizado')).status).toBe(200);
    expect(await (await request('/api/v1/modalidades/capacidades', 'autorizado')).json()).toEqual({ puedeAdministrar: false });
    expect((await request('/api/v1/modalidades/no-es-uuid', 'autorizado')).status).toBe(400);
    expect((await request('/api/v1/modalidades?disponiblesParaFamilia=si', 'autorizado')).status).toBe(400);

    const listar = await request('/api/v1/modalidades', 'autorizado');
    expect(listar.status).toBe(200);
    expect(await listar.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: modalidadPrincipal.id, familiaRubricas: expect.objectContaining({ id: rubricaPrincipal.id }) }),
    ]));
  });

  it('crea una modalidad con actor del servidor, normaliza el código y rechaza duplicados', async () => {
    const body = {
      codigo: `  etapa9g-${Date.now()}  `,
      nombre: 'Modalidad ficticia de pruebas',
      descripcion: 'Registro exclusivo de base desechable',
      estaActivo: true,
    };
    expect((await request('/api/v1/modalidades', undefined, 'POST', body)).status).toBe(401);
    expect((await request('/api/v1/modalidades', 'autorizado', 'POST', body)).status).toBe(403);

    const response = await request('/api/v1/modalidades', 'administrador', 'POST', body, 'correlacion-9g');
    expect(response.status).toBe(201);
    const creada = await response.json();
    expect(creada).toMatchObject({ codigo: body.codigo.trim().toUpperCase(), nombre: body.nombre, estaActivo: true, revision: 1, familiaRubricas: null });
    expect(creada.id).toMatch(/^[0-9a-f-]{36}$/i);
    modalidadAdministrada = creada;

    const auditoria = await dataSource.query(
      'SELECT actor_id, accion, modalidad_id, correlation_id FROM auditoria_rubricas WHERE modalidad_id = $1',
      [creada.id],
    );
    expect(auditoria).toEqual([{
      actor_id: 'prueba-admin', accion: 'MODALIDAD_CREADA', modalidad_id: creada.id, correlation_id: 'correlacion-9g',
    }]);
    expect((await request('/api/v1/modalidades', 'administrador', 'POST', { ...body, codigo: creada.codigo.toLowerCase() })).status).toBe(409);
    expect((await request('/api/v1/modalidades', 'administrador', 'POST', { ...body, actorId: 'administrador-falso' })).status).toBe(400);
    expect((await request('/api/v1/modalidades', 'administrador', 'POST', { ...body, nombre: ' ' })).status).toBe(400);
  });

  it('actualiza con revisión optimista, impide cambiar el código y conserva conflictos concurrentes', async () => {
    const before = modalidadAdministrada.revision;
    const updated = await request(`/api/v1/modalidades/${modalidadAdministrada.id}`, 'administrador', 'PUT', {
      revision: before,
      codigo: modalidadAdministrada.codigo,
      nombre: 'Modalidad ficticia editada',
      descripcion: 'Descripción actualizada',
    });
    expect(updated.status).toBe(200);
    const editada = await updated.json();
    expect(editada).toMatchObject({ nombre: 'Modalidad ficticia editada', revision: before + 1 });
    modalidadAdministrada.revision = editada.revision;

    const stale = await request(`/api/v1/modalidades/${modalidadAdministrada.id}`, 'administrador', 'PUT', {
      revision: before, codigo: modalidadAdministrada.codigo, nombre: 'Obsoleta', descripcion: null,
    });
    expect(stale.status).toBe(409);
    const cambioCodigo = await request(`/api/v1/modalidades/${modalidadAdministrada.id}`, 'administrador', 'PUT', {
      revision: modalidadAdministrada.revision, codigo: 'CAMBIADO', nombre: editada.nombre, descripcion: editada.descripcion,
    });
    expect(cambioCodigo.status).toBe(409);

    const revisionConcurrente = modalidadAdministrada.revision;
    const resultados = await Promise.all(['Edición A', 'Edición B'].map((nombre) => request(
      `/api/v1/modalidades/${modalidadAdministrada.id}`, 'administrador', 'PUT', {
        revision: revisionConcurrente, codigo: modalidadAdministrada.codigo, nombre, descripcion: editada.descripcion,
      },
    )));
    expect(resultados.map((resultado) => resultado.status).sort()).toEqual([200, 409]);
    modalidadAdministrada.revision = revisionConcurrente + 1;
    expect((await request(`/api/v1/modalidades/${modalidadAdministrada.id}`, 'administrador')).status).toBe(200);
    expect((await request(`/api/v1/modalidades/${'00000000-0000-4000-8000-000000000001'}`, 'administrador')).status).toBe(404);
  });

  it('activa y desactiva modalidades sin mutar familias, versiones, notas ni evaluaciones', async () => {
    const estadosRubricaAntes = await versionRepository.find({
      where: { rubrica: { id: rubricaPrincipal.id } }, order: { id: 'ASC' },
    });
    const notasAntes = await dataSource.query('SELECT id, id_evaluacion, id_indicador, score FROM calificaciones_evaluacion ORDER BY id');
    const evaluacionesAntes = await dataSource.query('SELECT id, estado, cerrada_en FROM evaluaciones ORDER BY id');

    const baja = await request(`/api/v1/modalidades/${modalidadAdministrada.id}/estado`, 'administrador', 'PATCH', {
      revision: modalidadAdministrada.revision, estaActivo: false,
    });
    expect(baja.status).toBe(200);
    const modalidadInactiva = await baja.json();
    expect(modalidadInactiva).toMatchObject({ estaActivo: false, familiaRubricas: null });
    modalidadAdministrada.revision = modalidadInactiva.revision;
    expect((await request('/api/v1/modalidades?disponiblesParaFamilia=true', 'autorizado')).status).toBe(200);
    expect(await (await request('/api/v1/modalidades?disponiblesParaFamilia=true', 'autorizado')).json())
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: modalidadAdministrada.id })]));
    expect((await request('/api/v1/rubricas', 'administrador', 'POST', {
      modalidadId: modalidadAdministrada.id, nombre: 'No se debe crear',
    })).status).toBe(409);

    const alta = await request(`/api/v1/modalidades/${modalidadAdministrada.id}/estado`, 'administrador', 'PATCH', {
      revision: modalidadAdministrada.revision, estaActivo: true,
    });
    expect(alta.status).toBe(200);
    modalidadAdministrada.revision = (await alta.json()).revision;

    const antesBajaConFamilia = JSON.stringify(estadosRubricaAntes.map(({ id, estado, revision }) => ({ id, estado, revision })));
    const respuestaBaja = await request(`/api/v1/modalidades/${modalidadPrincipal.id}/estado`, 'administrador', 'PATCH', {
      revision: modalidadPrincipal.revision, estaActivo: false,
    });
    expect(respuestaBaja.status).toBe(200);
    const detalleInactivo = await (await request(`/api/v1/modalidades/${modalidadPrincipal.id}`, 'autorizado')).json();
    expect(detalleInactivo).toMatchObject({ estaActivo: false, familiaRubricas: { id: rubricaPrincipal.id } });
    expect(JSON.stringify((await versionRepository.find({
      where: { rubrica: { id: rubricaPrincipal.id } }, order: { id: 'ASC' },
    })).map(({ id, estado, revision }) => ({ id, estado, revision })))).toBe(antesBajaConFamilia);
    expect(await dataSource.query('SELECT id, id_evaluacion, id_indicador, score FROM calificaciones_evaluacion ORDER BY id')).toEqual(notasAntes);
    expect(await dataSource.query('SELECT id, estado, cerrada_en FROM evaluaciones ORDER BY id')).toEqual(evaluacionesAntes);
    const restaurada = await request(`/api/v1/modalidades/${modalidadPrincipal.id}/estado`, 'administrador', 'PATCH', {
      revision: detalleInactivo.revision, estaActivo: true,
    });
    expect(restaurada.status).toBe(200);
  });

  it('mantiene la relación de una sola familia por modalidad y bloquea reasignar familias históricas', async () => {
    const respuestaDuplicada = await request('/api/v1/rubricas', 'administrador', 'POST', {
      modalidadId: modalidadPrincipal.id, nombre: 'Familia duplicada',
    });
    expect(respuestaDuplicada.status).toBe(409);
    const constraint = await dataSource.query(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'rubricas'::regclass AND conname = 'uq_rubricas_modality'",
    );
    expect(constraint).toEqual([{ conname: 'uq_rubricas_modality' }]);

    await expect(dataSource.query('UPDATE rubricas SET id_modalidad = $1 WHERE id = $2', [modalidadAdministrada.id, rubricaPrincipal.id]))
      .rejects.toThrow();
    const familiaActual = await dataSource.query('SELECT id_modalidad FROM rubricas WHERE id = $1', [rubricaPrincipal.id]);
    expect(familiaActual).toEqual([{ id_modalidad: modalidadPrincipal.id }]);
    const detalle = await (await request(`/api/v1/modalidades/${modalidadPrincipal.id}`, 'autorizado')).json();
    const versionesPersistidas = await versionRepository.find({ where: { rubrica: { id: rubricaPrincipal.id } } });
    expect(detalle.familiaRubricas.versiones.map((version: { id: string }) => version.id).sort())
      .toEqual(versionesPersistidas.map(({ id }) => id).sort());
  });

  it('revierte creación y auditoría cuando falla el registro append-only', async () => {
    const auditoriaAntes = await dataSource.getRepository(EventoAuditoriaRubrica).count();
    await dataSource.query(`
      CREATE FUNCTION "test_rechazar_auditoria_modalidad"() RETURNS trigger AS $$
      BEGIN
        IF NEW."modalidad_id" IS NOT NULL THEN RAISE EXCEPTION 'fallo de auditoría de modalidad simulado'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_rechazar_auditoria_modalidad"
      BEFORE INSERT ON "auditoria_rubricas"
      FOR EACH ROW EXECUTE FUNCTION "test_rechazar_auditoria_modalidad"();
    `);
    const codigo = `ROLLBACK-${Date.now()}`;
    try {
      const response = await request('/api/v1/modalidades', 'administrador', 'POST', {
        codigo, nombre: 'Rollback de prueba', descripcion: null, estaActivo: true,
      });
      expect(response.status).toBe(500);
      expect(await dataSource.getRepository(Modalidad).findOneBy({ codigo })).toBeNull();
      expect(await dataSource.getRepository(EventoAuditoriaRubrica).count()).toBe(auditoriaAntes);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS "test_rechazar_auditoria_modalidad" ON "auditoria_rubricas"');
      await dataSource.query('DROP FUNCTION IF EXISTS "test_rechazar_auditoria_modalidad"()');
    }
  });
});
