import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { EstadoVersionRubrica } from '../comun/enums-dominio';
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
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { VersionRubricaCarrera } from './entidades/version-rubrica-carrera.entity';
import { VigenciasRubricaCarreraService } from './vigencias-rubrica-carrera.service';
import { RubricasModule } from './rubricas.module';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

if (testDatabaseUrl) {
  const url = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== '55441' || !/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL debe identificar una base nueva de prueba en el clúster PostgreSQL 9D de loopback.');
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: testDatabaseUrl,
      autoLoadEntities: true,
      migrations: [
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
      ],
      migrationsTransactionMode: 'each',
      migrationsRun: true,
      synchronize: false,
    }),
    RubricasModule,
  ],
})
class ModuloPruebasVigencias {}

suite('Vigencia de versiones por carrera (PostgreSQL 9D real)', () => {
  let aplicacion: INestApplication;
  let dataSource: DataSource;
  let servicio: VigenciasRubricaCarreraService;
  let versionUno: VersionRubrica;
  let versionDos: VersionRubrica;
  let versionOtroPeriodo: VersionRubrica;
  let versionOtraModalidad: VersionRubrica;
  let carreraSoftware: Carrera;
  let carreraTi: Carrera;
  let modalidad: Modalidad;
  let periodo: PeriodoAcademico;
  let rubrica: Rubrica;

  beforeAll(async () => {
    const preflight = new DataSource({ type: 'postgres', url: testDatabaseUrl, synchronize: false });
    await preflight.initialize();
    try {
      const [identity] = await preflight.query(`
        SELECT current_database() AS database_name,
               host(inet_server_addr()) AS server_address,
               current_setting('port') AS server_port,
               shobj_description(d.oid, 'pg_database') AS database_marker,
               (SELECT count(*)::int FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables
        FROM pg_database d WHERE d.datname = current_database()
      `);
      if (identity.server_address !== '127.0.0.1' || identity.server_port !== '55441'
        || identity.database_marker !== 'GENARES:9D:DISPOSABLE' || identity.public_tables !== 0) {
        throw new Error('La suite requiere una base pública vacía, marcada como GENARES:9D:DISPOSABLE en 127.0.0.1:55441.');
      }
    } finally {
      await preflight.destroy();
    }

    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasVigencias] }).compile();
    aplicacion = modulo.createNestApplication();
    await aplicacion.init();
    dataSource = modulo.get(DataSource);
    servicio = modulo.get(VigenciasRubricaCarreraService);

    const modalidades = dataSource.getRepository(Modalidad);
    const carreras = dataSource.getRepository(Carrera);
    const periodos = dataSource.getRepository(PeriodoAcademico);
    const rubricas = dataSource.getRepository(Rubrica);
    const versiones = dataSource.getRepository(VersionRubrica);
    const suffix = `${Date.now()}`;

    modalidad = await modalidades.save(modalidades.create({
      codigo: `9H2-${suffix}`, nombre: 'Modalidad de prueba 9H2', estaActivo: true,
    }));
    const modalidadAlterna = await modalidades.save(modalidades.create({
      codigo: `9H2-ALT-${suffix}`, nombre: 'Modalidad alterna 9H2', estaActivo: true,
    }));
    carreraSoftware = await carreras.save(carreras.create({
      codigo: `9H2-SW-${suffix}`, nombre: 'Ingeniería de Software (prueba)', estaActivo: true,
    }));
    carreraTi = await carreras.save(carreras.create({
      codigo: `9H2-TI-${suffix}`, nombre: 'Tecnologías de la Información (prueba)', estaActivo: true,
    }));
    periodo = await periodos.save(periodos.create({ codigo: `2026-2-${suffix}`, estaActivo: true }));
    const periodoAlterno = await periodos.save(periodos.create({ codigo: `2027-1-${suffix}`, estaActivo: true }));
    rubrica = await rubricas.save(rubricas.create({ modalidad, nombre: 'Familia de prueba 9H2', descripcion: null }));
    const rubricaAlterna = await rubricas.save(rubricas.create({
      modalidad: modalidadAlterna, nombre: 'Familia alterna 9H2', descripcion: null,
    }));
    versionUno = await versiones.save(versiones.create({
      rubrica, academicPeriod: periodo, version: 'V1', estado: EstadoVersionRubrica.BORRADOR, activadoEn: null,
    }));
    versionDos = await versiones.save(versiones.create({
      rubrica, academicPeriod: periodo, version: 'V2', estado: EstadoVersionRubrica.BORRADOR, activadoEn: null,
    }));
    versionOtroPeriodo = await versiones.save(versiones.create({
      rubrica, academicPeriod: periodoAlterno, version: 'V1-2027', estado: EstadoVersionRubrica.BORRADOR, activadoEn: null,
    }));
    versionOtraModalidad = await versiones.save(versiones.create({
      rubrica: rubricaAlterna, academicPeriod: periodo, version: 'V1-OTRA', estado: EstadoVersionRubrica.BORRADOR, activadoEn: null,
    }));
  }, 30000);

  afterAll(async () => {
    await aplicacion?.close();
  });

  it('comparte versiones entre carreras, asigna vigencia independiente y protege el historial', async () => {
    const carreras = dataSource.getRepository(Carrera);
    const asociaciones = dataSource.getRepository(VersionRubricaCarrera);

    const estadosOriginales = await dataSource.query(
      'SELECT id, estado, revision, activada_en FROM versiones_rubrica ORDER BY id',
    );
    const evaluacionesOriginales = await dataSource.query('SELECT * FROM evaluaciones ORDER BY id');
    const calificacionesOriginales = await dataSource.query('SELECT * FROM calificaciones_evaluacion ORDER BY id');

    await servicio.asociarVersionCarrera(versionUno.id, carreraSoftware.id);
    await servicio.asociarVersionCarrera(versionDos.id, carreraSoftware.id);
    await servicio.asociarVersionCarrera(versionUno.id, carreraTi.id);
    await servicio.asociarVersionCarrera(versionDos.id, carreraTi.id);
    await expect(servicio.asociarVersionCarrera(versionUno.id, carreraSoftware.id)).rejects.toThrow();

    const desdeAmbasCarreras = await dataSource.query(
      `SELECT id_carrera, id_version_rubrica FROM versiones_rubrica_carreras
       WHERE id_carrera = ANY($1::uuid[]) ORDER BY id_carrera, id_version_rubrica`,
      [[carreraSoftware.id, carreraTi.id]],
    );
    expect(desdeAmbasCarreras).toHaveLength(4);
    expect(desdeAmbasCarreras.filter((row: { id_carrera: string }) => row.id_carrera === carreraSoftware.id)).toHaveLength(2);
    expect(desdeAmbasCarreras.filter((row: { id_carrera: string }) => row.id_carrera === carreraTi.id)).toHaveLength(2);

    await servicio.asignarVigencia(versionUno.id, carreraSoftware.id, 'actor-prueba-9h2', 'corr-9h2-software');
    await servicio.asignarVigencia(versionDos.id, carreraTi.id, 'actor-prueba-9h2', 'corr-9h2-ti');
    const vigenciasIniciales = await dataSource.query(
      `SELECT id_carrera, id_version_rubrica FROM vigencias_rubrica_carrera
       WHERE vigente_hasta IS NULL ORDER BY id_carrera`,
    );
    expect(vigenciasIniciales).toHaveLength(2);
    expect(vigenciasIniciales).toEqual(expect.arrayContaining([
      { id_carrera: carreraSoftware.id, id_version_rubrica: versionUno.id },
      { id_carrera: carreraTi.id, id_version_rubrica: versionDos.id },
    ]));

    await expect(dataSource.query(
      `INSERT INTO vigencias_rubrica_carrera
         (id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id)
       SELECT id_version_rubrica, $1, id_rubrica, id_modalidad, periodo_academico_id
       FROM versiones_rubrica_carreras WHERE id_version_rubrica = $2 AND id_carrera = $1`,
      [carreraSoftware.id, versionDos.id],
    )).rejects.toThrow();

    const sustitucion = await servicio.asignarVigencia(versionDos.id, carreraSoftware.id, 'actor-prueba-9h2', 'corr-sustitucion');
    expect(sustitucion).toMatchObject({ versionAnteriorId: versionUno.id, cambioRealizado: true });
    const historial = await dataSource.query(
      `SELECT id_version_rubrica, vigente_desde, vigente_hasta FROM vigencias_rubrica_carrera
       WHERE id_carrera = $1 AND id_modalidad = $2 AND periodo_academico_id = $3 ORDER BY vigente_desde`,
      [carreraSoftware.id, modalidad.id, periodo.id],
    );
    expect(historial).toHaveLength(2);
    expect(historial[0].id_version_rubrica).toBe(versionUno.id);
    expect(historial[0].vigente_hasta).not.toBeNull();
    expect(historial[1].id_version_rubrica).toBe(versionDos.id);
    expect(historial[1].vigente_hasta).toBeNull();

    await Promise.all([
      servicio.asignarVigencia(versionUno.id, carreraSoftware.id, 'actor-prueba-9h2', 'corr-concurrente-a'),
      servicio.asignarVigencia(versionDos.id, carreraSoftware.id, 'actor-prueba-9h2', 'corr-concurrente-b'),
    ]);
    expect(await dataSource.query(
      `SELECT count(*)::int AS total FROM vigencias_rubrica_carrera
       WHERE id_carrera = $1 AND id_modalidad = $2 AND periodo_academico_id = $3 AND vigente_hasta IS NULL`,
      [carreraSoftware.id, modalidad.id, periodo.id],
    )).toEqual([{ total: 1 }]);

    await servicio.asociarVersionCarrera(versionOtroPeriodo.id, carreraSoftware.id);
    await servicio.asignarVigencia(versionOtroPeriodo.id, carreraSoftware.id, 'actor-prueba-9h2');
    await servicio.asociarVersionCarrera(versionOtraModalidad.id, carreraSoftware.id);
    await servicio.asignarVigencia(versionOtraModalidad.id, carreraSoftware.id, 'actor-prueba-9h2');
    expect(await dataSource.query(
      'SELECT count(*)::int AS total FROM vigencias_rubrica_carrera WHERE id_carrera = $1 AND vigente_hasta IS NULL',
      [carreraSoftware.id],
    )).toEqual([{ total: 3 }]);

    await expect(servicio.asociarVersionCarrera('00000000-0000-4000-8000-000000000001', carreraSoftware.id)).rejects.toThrow();
    await expect(servicio.asignarVigencia(versionUno.id, '00000000-0000-4000-8000-000000000002', 'actor')).rejects.toThrow();
    await expect(servicio.asignarVigencia(versionUno.id, carreraSoftware.id, '')).rejects.toThrow();
    await expect(servicio.asignarVigencia(versionOtroPeriodo.id, carreraTi.id, 'actor')).rejects.toThrow(/asociada/);
    await expect(dataSource.query(
      `INSERT INTO versiones_rubrica_carreras
         (id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [versionOtroPeriodo.id, carreraTi.id, rubrica.id, modalidad.id, periodo.id],
    )).rejects.toThrow();
    await expect(dataSource.query(
      `INSERT INTO versiones_rubrica_carreras
         (id_version_rubrica, id_carrera, id_rubrica, id_modalidad, periodo_academico_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [versionOtraModalidad.id, carreraTi.id, rubrica.id, modalidad.id, periodo.id],
    )).rejects.toThrow();

    const eventoSustitucion = await dataSource.query(
      `SELECT actor_id, accion, rubrica_id, modalidad_id, version_id, version_anterior_id,
              carrera_id, periodo_academico_id, correlation_id
       FROM auditoria_rubricas WHERE carrera_id = $1 AND correlation_id = 'corr-sustitucion'`,
      [carreraSoftware.id],
    );
    expect(eventoSustitucion).toEqual([{
      actor_id: 'actor-prueba-9h2', accion: 'VIGENCIA_RUBRICA_SUSTITUIDA',
      rubrica_id: rubrica.id, modalidad_id: modalidad.id, version_id: versionDos.id,
      version_anterior_id: versionUno.id, carrera_id: carreraSoftware.id,
      periodo_academico_id: periodo.id, correlation_id: 'corr-sustitucion',
    }]);
    await expect(dataSource.query('DELETE FROM auditoria_rubricas WHERE correlation_id = $1', ['corr-sustitucion'])).rejects.toThrow();

    const historialAntesFalloAuditoria = await dataSource.query(
      `SELECT id, id_version_rubrica, vigente_desde, vigente_hasta FROM vigencias_rubrica_carrera
       WHERE id_carrera = $1 AND id_modalidad = $2 AND periodo_academico_id = $3 ORDER BY vigente_desde, id`,
      [carreraTi.id, modalidad.id, periodo.id],
    );
    await dataSource.query(`
      CREATE FUNCTION "test_rechazar_auditoria_vigencia_9h2"() RETURNS trigger AS $$
      BEGIN
        IF NEW."carrera_id" IS NOT NULL THEN RAISE EXCEPTION 'fallo de auditoria 9H2'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_rechazar_auditoria_vigencia_9h2"
      BEFORE INSERT ON "auditoria_rubricas"
      FOR EACH ROW EXECUTE FUNCTION "test_rechazar_auditoria_vigencia_9h2"();
    `);
    try {
      await expect(servicio.asignarVigencia(versionUno.id, carreraTi.id, 'actor-prueba-9h2')).rejects.toThrow();
      expect(await dataSource.query(
        `SELECT id, id_version_rubrica, vigente_desde, vigente_hasta FROM vigencias_rubrica_carrera
         WHERE id_carrera = $1 AND id_modalidad = $2 AND periodo_academico_id = $3 ORDER BY vigente_desde, id`,
        [carreraTi.id, modalidad.id, periodo.id],
      )).toEqual(historialAntesFalloAuditoria);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS "test_rechazar_auditoria_vigencia_9h2" ON "auditoria_rubricas"');
      await dataSource.query('DROP FUNCTION IF EXISTS "test_rechazar_auditoria_vigencia_9h2"()');
    }

    await carreras.update(carreraTi.id, { estaActivo: false, revision: 2 });
    expect(await asociaciones.count({ where: { carreraId: carreraTi.id } })).toBe(2);
    expect(await dataSource.query(
      'SELECT count(*)::int AS total FROM vigencias_rubrica_carrera WHERE id_carrera = $1 AND vigente_hasta IS NULL',
      [carreraTi.id],
    )).toEqual([{ total: 1 }]);
    await expect(servicio.asociarVersionCarrera(versionUno.id, carreraTi.id)).rejects.toThrow();

    const vigenciasAntesDesactivarModalidad = await dataSource.query(
      'SELECT id, id_version_rubrica, vigente_desde, vigente_hasta FROM vigencias_rubrica_carrera WHERE id_carrera = $1 AND id_modalidad = $2 ORDER BY vigente_desde, id',
      [carreraSoftware.id, modalidad.id],
    );
    await dataSource.getRepository(Modalidad).update(modalidad.id, { estaActivo: false, revision: 2 });
    expect(await asociaciones.count({ where: { carreraId: carreraSoftware.id } })).toBe(4);
    expect(await dataSource.query(
      'SELECT id, id_version_rubrica, vigente_desde, vigente_hasta FROM vigencias_rubrica_carrera WHERE id_carrera = $1 AND id_modalidad = $2 ORDER BY vigente_desde, id',
      [carreraSoftware.id, modalidad.id],
    )).toEqual(vigenciasAntesDesactivarModalidad);
    await expect(servicio.asignarVigencia(versionUno.id, carreraSoftware.id, 'actor')).rejects.toThrow();

    expect(await dataSource.query('SELECT id, estado, revision, activada_en FROM versiones_rubrica ORDER BY id')).toEqual(estadosOriginales);
    expect(await dataSource.query('SELECT * FROM evaluaciones ORDER BY id')).toEqual(evaluacionesOriginales);
    expect(await dataSource.query('SELECT * FROM calificaciones_evaluacion ORDER BY id')).toEqual(calificacionesOriginales);

    const migracion = new VigenciasRubricaCarrera1760000005000();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await expect(migracion.down(queryRunner)).rejects.toThrow(/asociaciones|historial/i);
    } finally {
      await queryRunner.release();
    }
    expect(await dataSource.query('SELECT to_regclass($1) AS table_name', ['vigencias_rubrica_carrera']))
      .toEqual([{ table_name: 'vigencias_rubrica_carrera' }]);
  }, 30000);
});
