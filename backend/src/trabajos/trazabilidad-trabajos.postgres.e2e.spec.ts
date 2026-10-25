import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, MigrationInterface } from 'typeorm';
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
import { ConflictoExactoSalaProgramacion1760000010000 } from '../base-datos/migraciones/1760000010000-conflicto-exacto-sala-programacion';
import { DuracionYEstadosOperativosSustentaciones1760000011000 } from '../base-datos/migraciones/1760000011000-duracion-y-estados-operativos-sustentaciones';
import { ArchivoActas1760000012000 } from '../base-datos/migraciones/1760000012000-archivo-actas';
import { NotaMinimaActas1760000013000 } from '../base-datos/migraciones/1760000013000-nota-minima-actas';
import { ActorTecnicoProgramacionesLocales1760000014000 } from '../base-datos/migraciones/1760000014000-actor-tecnico-programaciones-locales';
import { TrazabilidadTrabajos1760000015000 } from '../base-datos/migraciones/1760000015000-trazabilidad-trabajos';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { ModuloApi } from '../comun/api/modulo-api';
import { TrabajosModule } from './trabajos.module';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;
const TRABAJO_ID = '11000000-0000-4000-8000-000000000001';
const CARRERA_ID = '22000000-0000-4000-8000-000000000001';
const MODALIDAD_ID = '33000000-0000-4000-8000-000000000001';
const PERIODO_ID = '44000000-0000-4000-8000-000000000001';
const PERSONA_ID = '55000000-0000-4000-8000-000000000001';
const CUENTA_ID = '66000000-0000-4000-8000-000000000001';

const migracionesPrevias: Array<new () => MigrationInterface> = [
  EsquemaInicial1760000000000,
  EtapasRubricaDinamicas1760000001000,
  BorradoresRubricaAuditoria1760000002000,
  GruposVaciosBorrador1760000003000,
  CatalogoModalidades1760000004000,
  VigenciasRubricaCarrera1760000005000,
  CatalogoCarreras1760000006000,
  RubricasCompletasEtapasDinamicas1760000007000,
  AlcancesEtapaRubricaCompletos1760000008000,
  EvaluacionesEtapasDinamicasTraspasos1760000009000,
  ConflictoExactoSalaProgramacion1760000010000,
  DuracionYEstadosOperativosSustentaciones1760000011000,
  ArchivoActas1760000012000,
  NotaMinimaActas1760000013000,
  ActorTecnicoProgramacionesLocales1760000014000,
];
const migracionesCompletas = [...migracionesPrevias, TrazabilidadTrabajos1760000015000];

if (testDatabaseUrl) {
  const url = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== 'postgres:' || url.hostname !== '127.0.0.1' || url.port !== '55441'
    || !/^genares_9d_test_[a-f0-9]{8}$/.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL debe identificar una base temporal del clúster PostgreSQL 9D.');
  }
}

@Module({
  imports: [
    ModuloApi,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: testDatabaseUrl,
      migrations: migracionesCompletas,
      migrationsTransactionMode: 'each',
      migrationsRun: true,
      synchronize: false,
    }),
    TrabajosModule,
  ],
})
class ModuloPruebasTrazabilidad {}

suite('Trazabilidad de trabajos (PostgreSQL 9D temporal y HTTP)', () => {
  let aplicacion: INestApplication | undefined;
  let baseUrl: string;
  let dataSource: DataSource;
  const nodeEnvOriginal = process.env.NODE_ENV;

  beforeAll(async () => {
    const preflight = new DataSource({ type: 'postgres', url: testDatabaseUrl, synchronize: false });
    await preflight.initialize();
    try {
      const [identidad] = await preflight.query(`
        SELECT current_database() AS nombre,
          host(inet_server_addr()) AS direccion,
          current_setting('port') AS puerto,
          shobj_description(d.oid, 'pg_database') AS marca,
          (SELECT count(*)::int FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tablas
        FROM pg_database d WHERE d.datname = current_database()
      `);
      if (identidad.direccion !== '127.0.0.1' || identidad.puerto !== '55441'
        || identidad.marca !== 'GENARES:9D:DISPOSABLE' || identidad.tablas !== 0) {
        throw new Error('La suite exige una base temporal vacia y marcada en PostgreSQL 9D.');
      }
    } finally {
      await preflight.destroy();
    }

    const esquemaPrevio = new DataSource({
      type: 'postgres', url: testDatabaseUrl, migrations: migracionesPrevias,
      migrationsTransactionMode: 'each', synchronize: false,
    });
    await esquemaPrevio.initialize();
    try {
      await esquemaPrevio.runMigrations({ transaction: 'each' });
      await esquemaPrevio.query(
        `INSERT INTO "carreras" ("id", "codigo", "nombre") VALUES ($1, 'TRAZABILIDAD_9D', 'Carrera temporal de prueba')`,
        [CARRERA_ID],
      );
      await esquemaPrevio.query(
        `INSERT INTO "modalidades" ("id", "codigo", "nombre") VALUES ($1, 'TRAZABILIDAD_9D', 'Modalidad temporal de prueba')`,
        [MODALIDAD_ID],
      );
      await esquemaPrevio.query(
        `INSERT INTO "periodos_academicos" ("id", "codigo") VALUES ($1, '2099-9D')`,
        [PERIODO_ID],
      );
      await esquemaPrevio.query(
        `INSERT INTO "personas" ("id", "identificacion_nacional", "nombres", "surnames")
         VALUES ($1, 'TRAZABILIDAD-9D-001', 'Cuenta', 'Temporal')`,
        [PERSONA_ID],
      );
      await esquemaPrevio.query(
        `INSERT INTO "cuentas_usuario" ("id", "id_persona", "sujeto_autenticacion")
         VALUES ($1, $2, 'prueba-trazabilidad-9d')`,
        [CUENTA_ID, PERSONA_ID],
      );
      await esquemaPrevio.query(`
        INSERT INTO "trabajos_titulacion" (
          "id", "codigo", "titulo", "id_modalidad", "periodo_academico_id", "id_carrera",
          "created_by_id_cuenta", "creado_en"
        ) VALUES (
          $5, 'TRAZABILIDAD-9D-001', 'Trabajo temporal de trazabilidad', $2, $3, $1, $4,
          '2025-01-02T03:04:05.000Z'
        );
      `, [CARRERA_ID, MODALIDAD_ID, PERIODO_ID, CUENTA_ID, TRABAJO_ID]);
    } finally {
      await esquemaPrevio.destroy();
    }

    process.env.NODE_ENV = 'test';
    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasTrazabilidad] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((solicitud: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _respuesta: object, siguiente: () => void) => {
      const perfil = solicitud.headers['x-principal-prueba'];
      const tipo = Array.isArray(perfil) ? perfil[0] : perfil;
      if (tipo === 'lector') {
        (solicitud as SolicitudConIdentidad).identidadApi = {
          sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL', capacidades: ['evaluaciones:leer'],
        };
      } else if (tipo === 'sin-capacidad') {
        (solicitud as SolicitudConIdentidad).identidadApi = {
          sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL', capacidades: [],
        };
      }
      siguiente();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();
    dataSource = modulo.get(DataSource);

    await dataSource.query(
      `UPDATE "trabajos_titulacion" SET "estado" = 'FINALIZADO' WHERE "id" = $1::uuid`,
      [TRABAJO_ID],
    );
  }, 30000);

  afterAll(async () => {
    await aplicacion?.close();
    if (nodeEnvOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnvOriginal;
  });

  async function solicitar(ruta: string, perfil?: string): Promise<Response> {
    const headers = new Headers();
    if (perfil) headers.set('x-principal-prueba', perfil);
    return fetch(`${baseUrl}${ruta}`, { headers });
  }

  it('aplica la migracion, conserva evidencia previa y captura transiciones nuevas', async () => {
    const migraciones = await dataSource.query('SELECT name FROM migrations ORDER BY id');
    expect(migraciones).toHaveLength(16);
    expect(migraciones.at(-1).name).toContain('TrazabilidadTrabajos1760000015000');

    const eventosEnPostgres = await dataSource.query(
      `SELECT "tipo_evento" AS tipo, "evidencia", "fuente_tipo" AS fuente
       FROM "eventos_trazabilidad_trabajo" WHERE "id_trabajo" = $1::uuid
       ORDER BY "ocurrido_en" DESC, "id" DESC`,
      [TRABAJO_ID],
    );
    expect(eventosEnPostgres.map((evento: { tipo: string }) => evento.tipo)).toEqual([
      'TRABAJO_ESTADO_CAMBIADO', 'TRABAJO_REGISTRADO',
    ]);
    expect(eventosEnPostgres[1]).toMatchObject({ evidencia: 'DIRECTA', fuente: 'trabajo' });

    await expect(dataSource.query(
      `UPDATE "eventos_trazabilidad_trabajo" SET "tipo_evento" = 'ALTERADO' WHERE "id_trabajo" = $1::uuid`,
      [TRABAJO_ID],
    )).rejects.toThrow();
  });

  it('sirve listado, detalle e historial desde PostgreSQL y exige capacidad de lectura', async () => {
    expect((await solicitar('/api/v1/trabajos')).status).toBe(401);
    expect((await solicitar(`/api/v1/trabajos/${TRABAJO_ID}/trazabilidad`, 'sin-capacidad')).status).toBe(403);

    const listado = await solicitar('/api/v1/trabajos', 'lector');
    expect(listado.status).toBe(200);
    expect(await listado.json()).toMatchObject({
      elementos: [expect.objectContaining({ id: TRABAJO_ID, codigo: 'TRAZABILIDAD-9D-001' })],
    });

    const detalle = await solicitar(`/api/v1/trabajos/${TRABAJO_ID}`, 'lector');
    expect(detalle.status).toBe(200);
    expect(await detalle.json()).toMatchObject({ id: TRABAJO_ID, estado: 'FINALIZADO' });

    const historial = await solicitar(`/api/v1/trabajos/${TRABAJO_ID}/trazabilidad`, 'lector');
    expect(historial.status).toBe(200);
    const cuerpo = await historial.json();
    const idsEnRespuesta = cuerpo.elementos.map((evento: { id: string }) => evento.id);
    const idsEnPostgres = await dataSource.query(
      `SELECT "id" FROM "eventos_trazabilidad_trabajo" WHERE "id_trabajo" = $1::uuid
       ORDER BY "ocurrido_en" DESC, "id" DESC`,
      [TRABAJO_ID],
    );
    expect(idsEnRespuesta).toEqual(idsEnPostgres.map((evento: { id: string }) => evento.id));
    expect(cuerpo.elementos.map((evento: { tipo: string }) => evento.tipo)).toEqual([
      'TRABAJO_ESTADO_CAMBIADO', 'TRABAJO_REGISTRADO',
    ]);
    expect(cuerpo.metadatos.completa).toBe(false);
    expect(cuerpo.elementos[1].actor).toEqual({ disponible: true });
    expect(cuerpo.elementos[1]).not.toHaveProperty('detalles');
  });
});
