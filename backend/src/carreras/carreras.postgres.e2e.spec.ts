import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { EsquemaInicial1760000000000 } from '../base-datos/migraciones/1760000000000-esquema-inicial';
import { EtapasRubricaDinamicas1760000001000 } from '../base-datos/migraciones/1760000001000-etapas-rubrica-dinamicas';
import { BorradoresRubricaAuditoria1760000002000 } from '../base-datos/migraciones/1760000002000-borradores-rubrica-auditoria';
import { GruposVaciosBorrador1760000003000 } from '../base-datos/migraciones/1760000003000-grupos-vacios-borrador';
import { CatalogoModalidades1760000004000 } from '../base-datos/migraciones/1760000004000-catalogo-modalidades';
import { VigenciasRubricaCarrera1760000005000 } from '../base-datos/migraciones/1760000005000-vigencias-rubrica-carrera';
import { CatalogoCarreras1760000006000 } from '../base-datos/migraciones/1760000006000-catalogo-carreras';
import { RubricasCompletasEtapasDinamicas1760000007000 } from '../base-datos/migraciones/1760000007000-rubricas-completas-etapas-dinamicas';
import { AlcancesEtapaRubricaCompletos1760000008000 } from '../base-datos/migraciones/1760000008000-alcances-etapa-rubrica-completos';
import { EvaluacionesEtapasDinamicasTraspasos1760000009000 } from '../base-datos/migraciones/1760000009000-evaluaciones-etapas-dinamicas-traspasos';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { ModuloApi } from '../comun/api/modulo-api';
import { EstadoVersionRubrica } from '../comun/enums-dominio';
import { Rubrica } from '../rubricas/entidades/rubrica.entity';
import { VersionRubrica } from '../rubricas/entidades/version-rubrica.entity';
import { CarrerasModule } from './carreras.module';
import { CarrerasService } from './carreras.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;
if (testDatabaseUrl) {
  const url = new URL(testDatabaseUrl);
  const nombre = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== '55441' || !/(^|[_-])test([_-]|$)/i.test(nombre)) {
    throw new Error('TEST_DATABASE_URL debe identificar una base de prueba en PostgreSQL 9D de loopback.');
  }
}

@Module({
  imports: [
    ModuloApi,
    TypeOrmModule.forRoot({
      type: 'postgres', url: testDatabaseUrl,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [EsquemaInicial1760000000000, EtapasRubricaDinamicas1760000001000,
        BorradoresRubricaAuditoria1760000002000, GruposVaciosBorrador1760000003000,
        CatalogoModalidades1760000004000, VigenciasRubricaCarrera1760000005000, CatalogoCarreras1760000006000,
        RubricasCompletasEtapasDinamicas1760000007000, AlcancesEtapaRubricaCompletos1760000008000,
        EvaluacionesEtapasDinamicasTraspasos1760000009000],
      migrationsTransactionMode: 'each',
      migrationsRun: true, synchronize: false,
    }),
    CarrerasModule,
  ],
})
class ModuloPruebasCarreras {}

interface RespuestaCarrera { id: string; codigo: string; nombre: string; revision: number; estaActivo: boolean }

suite('Maestro de carreras (PostgreSQL 9D real y HTTP)', () => {
  let aplicacion: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let servicio: CarrerasService;

  beforeAll(async () => {
    const preflight = new DataSource({ type: 'postgres', url: testDatabaseUrl, synchronize: false });
    await preflight.initialize();
    try {
      const [identidad] = await preflight.query(`
        SELECT current_database() AS nombre, host(inet_server_addr()) AS direccion,
          current_setting('port') AS puerto,
          shobj_description(d.oid, 'pg_database') AS marca,
          (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tablas
        FROM pg_database d WHERE d.datname=current_database()
      `);
      if (identidad.direccion !== '127.0.0.1' || identidad.puerto !== '55441'
        || identidad.marca !== 'GENARES:9D:DISPOSABLE' || identidad.tablas !== 0) {
        throw new Error('La suite exige una base vacía y marcada del clúster 9D; no se escribieron datos.');
      }
    } finally { await preflight.destroy(); }

    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasCarreras] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((request: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _respuesta: object, siguiente: () => void) => {
      const perfil = request.headers['x-principal-prueba'];
      const identidades: Record<string, IdentidadApi> = {
        lector: { sujeto: 'prueba-lector', tipo: 'VERIFICADA', capacidades: ['carreras:leer'] },
        administrador: { sujeto: 'prueba-administrador', tipo: 'VERIFICADA', capacidades: ['carreras:leer', 'carreras:administrar'] },
        denegado: { sujeto: 'prueba-denegado', tipo: 'VERIFICADA', capacidades: [] },
      };
      (request as SolicitudConIdentidad).identidadApi = typeof perfil === 'string' ? identidades[perfil] : undefined;
      siguiente();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();
    dataSource = modulo.get(DataSource);
    servicio = modulo.get(CarrerasService);
  }, 30000);

  afterAll(async () => { await aplicacion?.close(); });

  async function solicitar(ruta: string, metodo = 'GET', cuerpo?: object, perfil?: string) {
    return fetch(`${baseUrl}${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...(perfil ? { 'x-principal-prueba': perfil } : {}) },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    });
  }

  it('ejecuta las diez migraciones, valida permisos y DTO estrictos', async () => {
    const migraciones = await dataSource.query('SELECT name FROM migrations ORDER BY id');
    expect(migraciones).toHaveLength(10);
    expect(await (await solicitar('/api/v1/carreras')).status).toBe(401);
    expect(await (await solicitar('/api/v1/carreras', 'GET', undefined, 'denegado')).status).toBe(403);
    expect(await (await solicitar('/api/v1/carreras', 'POST', { codigo: 'X', nombre: 'X', estaActivo: true }, 'lector')).status).toBe(403);
    expect((await (await solicitar('/api/v1/carreras/capacidades', 'GET', undefined, 'lector')).json())).toEqual({ puedeAdministrar: false });
    expect((await (await solicitar('/api/v1/carreras/capacidades', 'GET', undefined, 'administrador')).json())).toEqual({ puedeAdministrar: true });
    expect(await (await solicitar('/api/v1/carreras', 'POST', { codigo: 'X', nombre: ' ', estaActivo: true }, 'administrador')).status).toBe(400);
    expect(await (await solicitar('/api/v1/carreras', 'POST', { codigo: 'X', nombre: 'X', estaActivo: true, actorId: 'falso' }, 'administrador')).status).toBe(400);
    expect(await (await solicitar('/api/v1/carreras/invalida', 'GET', undefined, 'lector')).status).toBe(400);
  });

  it('crea, consulta y edita con código estable, revisión y auditoría en la misma transacción', async () => {
    const creada = await solicitar('/api/v1/carreras', 'POST', { codigo: 'PRUEBA_9H3', nombre: '  Carrera de prueba  ', estaActivo: true }, 'administrador');
    expect(creada.status).toBe(201);
    const carrera = await creada.json() as RespuestaCarrera;
    expect(carrera).toMatchObject({ codigo: 'PRUEBA_9H3', nombre: 'Carrera de prueba', revision: 1, estaActivo: true });
    expect(await (await solicitar('/api/v1/carreras', 'POST', { codigo: 'prueba_9h3', nombre: 'Duplicada', estaActivo: true }, 'administrador')).status).toBe(409);
    expect(await (await solicitar(`/api/v1/carreras/${carrera.id}`, 'GET', undefined, 'lector')).status).toBe(200);
    expect(await (await solicitar('/api/v1/carreras', 'GET', undefined, 'lector')).json()).toEqual([expect.objectContaining({ id: carrera.id })]);

    const editada = await solicitar(`/api/v1/carreras/${carrera.id}`, 'PUT', { revision: 1, nombre: 'Carrera actualizada' }, 'administrador');
    expect(editada.status).toBe(200);
    expect(await editada.json()).toMatchObject({ codigo: 'PRUEBA_9H3', nombre: 'Carrera actualizada', revision: 2 });
    expect(await (await solicitar(`/api/v1/carreras/${carrera.id}`, 'PUT', { revision: 1, nombre: 'Obsoleta' }, 'administrador')).status).toBe(409);
    expect(await (await solicitar(`/api/v1/carreras/${carrera.id}`, 'PUT', { revision: 2, nombre: 'Otra', codigo: 'CAMBIO' }, 'administrador')).status).toBe(400);
    expect(await (await solicitar('/api/v1/carreras/00000000-0000-4000-8000-000000000001', 'GET', undefined, 'lector')).status).toBe(404);
    const auditoria = await dataSource.query('SELECT accion, actor_id FROM auditoria_rubricas WHERE carrera_id=$1 ORDER BY ocurrido_en', [carrera.id]);
    expect(auditoria).toEqual([
      { accion: 'CARRERA_CREADA', actor_id: 'prueba-administrador' },
      { accion: 'CARRERA_MODIFICADA', actor_id: 'prueba-administrador' },
    ]);
    await expect(dataSource.query('UPDATE carreras SET codigo=$1, revision=revision+1 WHERE id=$2', ['CAMBIO', carrera.id])).rejects.toThrow();
  });

  it('serializa dos cambios concurrentes y conserva relaciones al desactivar y reactivar', async () => {
    const carrera = (await dataSource.getRepository(Carrera).findOneByOrFail({ codigo: 'PRUEBA_9H3' }));
    const modalidad = await dataSource.getRepository(Modalidad).save({ codigo: 'MOD_9H3', nombre: 'Modalidad ficticia', estaActivo: true });
    const periodo = await dataSource.getRepository(PeriodoAcademico).save({ codigo: '2099-1', estaActivo: true });
    const rubrica = await dataSource.getRepository(Rubrica).save({ modalidad, nombre: 'Rúbrica ficticia', descripcion: null });
    const version = await dataSource.getRepository(VersionRubrica).save({ rubrica, academicPeriod: periodo, version: '1', estado: EstadoVersionRubrica.BORRADOR });
    await dataSource.query(`INSERT INTO versiones_rubrica_carreras
      (id_version_rubrica,id_carrera,id_rubrica,id_modalidad,periodo_academico_id) VALUES ($1,$2,$3,$4,$5)`,
    [version.id, carrera.id, rubrica.id, modalidad.id, periodo.id]);
    await dataSource.query(`INSERT INTO vigencias_rubrica_carrera
      (id_version_rubrica,id_carrera,id_rubrica,id_modalidad,periodo_academico_id) VALUES ($1,$2,$3,$4,$5)`,
    [version.id, carrera.id, rubrica.id, modalidad.id, periodo.id]);
    const antes = await dataSource.query(`SELECT
      (SELECT count(*)::int FROM versiones_rubrica_carreras) AS asociaciones,
      (SELECT count(*)::int FROM vigencias_rubrica_carrera) AS vigencias,
      (SELECT count(*)::int FROM evaluaciones) AS evaluaciones,
      (SELECT count(*)::int FROM calificaciones_evaluacion) AS calificaciones`);
    const [primera, segunda] = await Promise.all([
      solicitar(`/api/v1/carreras/${carrera.id}`, 'PUT', { revision: carrera.revision, nombre: 'Concurrencia A' }, 'administrador'),
      solicitar(`/api/v1/carreras/${carrera.id}`, 'PUT', { revision: carrera.revision, nombre: 'Concurrencia B' }, 'administrador'),
    ]);
    expect([primera.status, segunda.status].sort()).toEqual([200, 409]);
    const actual = await dataSource.getRepository(Carrera).findOneByOrFail({ id: carrera.id });
    expect((await solicitar(`/api/v1/carreras/${carrera.id}/estado`, 'PATCH', { revision: actual.revision, estaActivo: false }, 'administrador')).status).toBe(200);
    const inactiva = await dataSource.getRepository(Carrera).findOneByOrFail({ id: carrera.id });
    expect(inactiva.estaActivo).toBe(false);
    expect((await solicitar(`/api/v1/carreras/${carrera.id}/estado`, 'PATCH', { revision: inactiva.revision, estaActivo: true }, 'administrador')).status).toBe(200);
    expect(await dataSource.query(`SELECT
      (SELECT count(*)::int FROM versiones_rubrica_carreras) AS asociaciones,
      (SELECT count(*)::int FROM vigencias_rubrica_carrera) AS vigencias,
      (SELECT count(*)::int FROM evaluaciones) AS evaluaciones,
      (SELECT count(*)::int FROM calificaciones_evaluacion) AS calificaciones`)).toEqual(antes);
    const eventos = await dataSource.query('SELECT accion FROM auditoria_rubricas WHERE carrera_id=$1 AND rubrica_id IS NULL ORDER BY ocurrido_en', [carrera.id]);
    expect(eventos.map((fila: { accion: string }) => fila.accion)).toEqual(expect.arrayContaining(['CARRERA_DESACTIVADA', 'CARRERA_ACTIVADA']));
  });

  it('revierte el registro si falla su auditoría y protege el historial append-only', async () => {
    const antes = await dataSource.getRepository(Carrera).count();
    await expect(servicio.crear({ codigo: 'ROLLBACK_9H3', nombre: 'Debe revertirse', estaActivo: true }, 'x'.repeat(300), null)).rejects.toThrow();
    expect(await dataSource.getRepository(Carrera).count()).toBe(antes);
    await expect(dataSource.query("UPDATE auditoria_rubricas SET accion='ALTERADA' WHERE accion='CARRERA_CREADA'")).rejects.toThrow();
    const migracion = new CatalogoCarreras1760000006000();
    const runner = dataSource.createQueryRunner();
    await expect(migracion.down(runner)).rejects.toThrow('auditoría histórica');
    await runner.release();
  });
});
