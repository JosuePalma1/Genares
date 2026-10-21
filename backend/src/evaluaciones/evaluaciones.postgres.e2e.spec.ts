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
import { ModuloApi } from '../comun/api/modulo-api';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { ModalidadesModule } from '../modalidades/modalidades.module';
import { RubricasModule } from '../rubricas/rubricas.module';
import { EvaluacionesModule } from './evaluaciones.module';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

if (testDatabaseUrl) {
  const url = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== '55441' || !/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL debe identificar una base de prueba del clúster PostgreSQL 9D.');
  }
}

@Module({
  imports: [
    ModuloApi,
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
    ModalidadesModule,
    RubricasModule,
    EvaluacionesModule,
  ],
})
class ModuloPruebasEvaluaciones {}

type EtapaApi = { id: string; codigo: string; nombre: string; alcance: string; calificacionMaxima: string; orden: number };
type IndicadorApi = { id: string; calificacionMaxima: string };
type EvaluacionApi = {
  id: string;
  idTrabajo: string;
  idEstudiante: string | null;
  idEtapaRubrica: string | null;
  etapa: string;
  estado: string;
  revision: number;
  alcance: string;
  calificacionTotal: string;
  puntajes: Array<{ idIndicador: string; puntaje: string }>;
  estudiantesTraspasados: Array<{ idEstudiante: string }>;
};

suite('Evaluaciones de etapas dinámicas (PostgreSQL 9D aislado)', () => {
  let aplicacion: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  let carreraId: string;
  let modalidadId: string;
  let periodoId: string;
  let cuentaAdminId: string;
  let juradoUnoId: string;
  let juradoDosId: string;
  let estudianteUnoId: string;
  let estudianteDosId: string;
  let estudianteTresId: string;
  let trabajoIndividualId: string;
  let trabajoCompartidoId: string;
  let trabajoRedondeoId: string;
  let trabajoSoloIndividualId: string;
  let trabajoHistoricoId: string;
  let evaluacionesHistoricasIds: string[];
  let evaluacionesHistoricasAntes: Array<Record<string, unknown>>;
  let versionId: string;
  let etapas: EtapaApi[];
  let indicadoresPorEtapa: IndicadorApi[][];
  let etapaSoloIndividual: EtapaApi;
  let indicadoresSoloIndividual: IndicadorApi[];

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
        throw new Error('La suite solo puede migrar una base vacía, efímera y marcada por el runner 9D en 127.0.0.1:55441.');
      }
    } finally {
      await preflight.destroy();
    }

    // La fixture legacy se inserta con el esquema previo a 9H.5A para verificar
    // la migración con filas ESCRITA/ORAL que existían antes de agregar la identidad dinámica.
    const migracionesHasta9H4 = [
      EsquemaInicial1760000000000,
      EtapasRubricaDinamicas1760000001000,
      BorradoresRubricaAuditoria1760000002000,
      GruposVaciosBorrador1760000003000,
      CatalogoModalidades1760000004000,
      VigenciasRubricaCarrera1760000005000,
      CatalogoCarreras1760000006000,
      RubricasCompletasEtapasDinamicas1760000007000,
      AlcancesEtapaRubricaCompletos1760000008000,
    ];
    const esquemaPrevio = new DataSource({
      type: 'postgres', url: testDatabaseUrl, migrations: migracionesHasta9H4,
      migrationsTransactionMode: 'each', synchronize: false,
    });
    await esquemaPrevio.initialize();
    try {
      await esquemaPrevio.runMigrations({ transaction: 'each' });
      const fixture = await sembrarEvaluacionesHistoricas(esquemaPrevio);
      trabajoHistoricoId = fixture.trabajoId;
      evaluacionesHistoricasIds = fixture.evaluacionIds;
      evaluacionesHistoricasAntes = fixture.filasAntes;
    } finally {
      await esquemaPrevio.destroy();
    }

    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasEvaluaciones] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((request: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _response: object, next: () => void) => {
      const principalHeader = request.headers['x-principal-prueba'];
      const principal = Array.isArray(principalHeader) ? principalHeader[0] : principalHeader;
      const evaluador = ['jurado-uno', 'jurado-dos', 'jurado-ajeno'].includes(principal ?? '');
      const identidades: Record<string, IdentidadApi> = {
        administrador: {
          sujeto: 'prueba-admin-evaluaciones', tipo: 'VERIFICADA',
          capacidades: ['rubricas:leer', 'rubricas:administrar', 'modalidades:leer', 'modalidades:administrar', 'evaluaciones:leer', 'evaluaciones:calificar'],
        },
        'jurado-uno': { sujeto: 'prueba-jurado-uno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'jurado-dos': { sujeto: 'prueba-jurado-dos', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'jurado-ajeno': { sujeto: 'prueba-jurado-ajeno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'estudiante-uno': { sujeto: 'prueba-estudiante-uno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
        'estudiante-dos': { sujeto: 'prueba-estudiante-dos', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
        'estudiante-tres': { sujeto: 'prueba-estudiante-tres', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
        denegado: { sujeto: 'prueba-denegado', tipo: 'VERIFICADA', capacidades: [] },
      };
      request.identidadApi = principal ? identidades[principal] : undefined;
      if (evaluador && request.identidadApi) request.identidadApi = identidades[principal!];
      next();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();
    dataSource = modulo.get(DataSource);

    const suffix = `${Date.now()}`.slice(-7);
    const modalidad = await dataSource.getRepository(Modalidad).save({
      codigo: `9H5A-M-${suffix}`, nombre: 'Modalidad de pruebas evaluación', estaActivo: true,
    });
    modalidadId = modalidad.id;
    const carrera = await dataSource.getRepository(Carrera).save({
      codigo: `9H5A-C-${suffix}`, nombre: 'Carrera de pruebas evaluación', estaActivo: true,
    });
    carreraId = carrera.id;
    const periodo = await dataSource.getRepository(PeriodoAcademico).save({ codigo: `9H5A-${suffix}`, estaActivo: true });
    periodoId = periodo.id;

    const persona = async (identificacion: string, subject: string): Promise<string> => {
      const [{ id }] = await dataSource.query(`
        INSERT INTO "personas" ("identificacion_nacional", "nombres", "surnames")
        VALUES ($1, $2, 'Prueba 9H5A') RETURNING "id"
      `, [identificacion, subject]);
      await dataSource.query(`
        INSERT INTO "cuentas_usuario" ("id_persona", "sujeto_autenticacion") VALUES ($1, $2)
      `, [id, subject]);
      return id;
    };
    const perfilDocente = async (identificacion: string, subject: string): Promise<{ personaId: string; cuentaId: string; docenteId: string }> => {
      const personaId = await persona(identificacion, subject);
      const [{ id: cuentaId }] = await dataSource.query('SELECT id FROM cuentas_usuario WHERE id_persona = $1', [personaId]);
      const [{ id: docenteId }] = await dataSource.query(
        'INSERT INTO perfiles_docente (id_persona, id_carrera) VALUES ($1, $2) RETURNING id', [personaId, carreraId],
      );
      return { personaId, cuentaId, docenteId };
    };
    const perfilEstudiante = async (identificacion: string, subject: string): Promise<string> => {
      const personaId = await persona(identificacion, subject);
      const [{ id }] = await dataSource.query(
        'INSERT INTO perfiles_estudiante (id_persona, id_carrera) VALUES ($1, $2) RETURNING id', [personaId, carreraId],
      );
      return id;
    };
    const admin = await perfilDocente(`AD-${suffix}`, 'prueba-admin-evaluaciones');
    cuentaAdminId = admin.cuentaId;
    const uno = await perfilDocente(`JU1-${suffix}`, 'prueba-jurado-uno');
    const dos = await perfilDocente(`JU2-${suffix}`, 'prueba-jurado-dos');
    await perfilDocente(`JUA-${suffix}`, 'prueba-jurado-ajeno');
    juradoUnoId = uno.docenteId;
    juradoDosId = dos.docenteId;
    estudianteUnoId = await perfilEstudiante(`ES1-${suffix}`, 'prueba-estudiante-uno');
    estudianteDosId = await perfilEstudiante(`ES2-${suffix}`, 'prueba-estudiante-dos');
    estudianteTresId = await perfilEstudiante(`ES3-${suffix}`, 'prueba-estudiante-tres');

    const etapasDto = [
      etapaDto('INFORME', 'Informe escrito', 1, 'TRABAJO_COMPARTIDO'),
      etapaDto('DEFENSA', 'Defensa oral', 2, 'ESTUDIANTE_INDIVIDUAL'),
      etapaDto('ANEXOS', 'Revisión de anexos', 3, 'TRABAJO_COMPARTIDO'),
      etapaDto('PRESENTACION', 'Presentación individual', 4, 'ESTUDIANTE_INDIVIDUAL'),
    ];
    const respuestaRubrica = await requestApi('/api/v1/rubricas/completas', 'administrador', 'POST', {
      modalidadId, periodoId, nombre: 'Rúbrica integral 9H5A', version: '9H5A-1', etapas: etapasDto,
      carreras: [{ carreraId, revision: carrera.revision, vigente: true, vigenciaEsperada: { versionId: null } }],
    });
    if (respuestaRubrica.status !== 201) throw new Error(`No se creó la rúbrica del fixture: ${respuestaRubrica.status} ${JSON.stringify(await respuestaRubrica.json())}`);
    const rubrica = await respuestaRubrica.json() as { id: string; revision: number; etapas: EtapaApi[] };
    versionId = rubrica.id;
    etapas = rubrica.etapas;
    if (etapas.length !== 4 || etapas.some(({ calificacionMaxima }) => calificacionMaxima !== '10.00')) {
      throw new Error('La rúbrica fixture no conserva cuatro etapas exactas de 10.00.');
    }
    indicadoresPorEtapa = await Promise.all(etapas.map(async (etapa) => dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapa.id])));

    trabajoCompartidoId = await crearTrabajo(`9H5A-P-${suffix}`, versionId, [estudianteUnoId, estudianteDosId]);
    trabajoIndividualId = await crearTrabajo(`9H5A-I-${suffix}`, versionId, [estudianteTresId]);
    trabajoRedondeoId = await crearTrabajo(`9H5A-R-${suffix}`, versionId, [estudianteTresId]);
    await confirmarTribunal(trabajoCompartidoId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoIndividualId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoRedondeoId, [uno.docenteId, dos.docenteId]);

    const periodoSoloIndividual = await dataSource.getRepository(PeriodoAcademico).save({ codigo: `9H5B-${suffix}`, estaActivo: true });
    const carreraActual = await dataSource.getRepository(Carrera).findOneByOrFail({ id: carreraId });
    const respuestaRubricaSoloIndividual = await requestApi('/api/v1/rubricas/completas', 'administrador', 'POST', {
      modalidadId, periodoId: periodoSoloIndividual.id, nombre: 'Rúbrica de etapa individual única',
      version: `9H5B-IND-${suffix}`,
      etapas: [etapaDto('UNICA', 'Etapa individual única', 1, 'ESTUDIANTE_INDIVIDUAL')],
      carreras: [{
        carreraId, revision: carreraActual.revision, vigente: true, vigenciaEsperada: { versionId: null },
      }],
    });
    if (respuestaRubricaSoloIndividual.status !== 201) {
      throw new Error(`No se creó la rúbrica individual de una etapa: ${respuestaRubricaSoloIndividual.status} ${JSON.stringify(await respuestaRubricaSoloIndividual.json())}`);
    }
    const rubricaSoloIndividual = await respuestaRubricaSoloIndividual.json() as { id: string; etapas: EtapaApi[] };
    [etapaSoloIndividual] = rubricaSoloIndividual.etapas;
    indicadoresSoloIndividual = await dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapaSoloIndividual.id]);
    trabajoSoloIndividualId = await crearTrabajo(
      `9H5B-I-${suffix}`, rubricaSoloIndividual.id, [estudianteTresId], periodoSoloIndividual.id,
    );
    await confirmarTribunal(trabajoSoloIndividualId, [uno.docenteId, dos.docenteId]);
  }, 60000);

  afterAll(async () => {
    await aplicacion?.close();
  });

  async function requestApi(path: string, principal: string | undefined, method = 'GET', body?: unknown, correlationId?: string) {
    const headers: Record<string, string> = {};
    if (principal) headers['x-principal-prueba'] = principal;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (correlationId) headers['x-correlation-id'] = correlationId;
    return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  function etapaDto(codigo: string, nombre: string, orden: number, alcance: string) {
    return {
      codigo, nombre, orden, alcance,
      categorias: [{
        codigo: 'CRIT', nombre: `Criterio ${nombre}`, orden: 1,
        indicadores: [
          { label: `${codigo}-A`, descripcion: `Indicador A de ${nombre}`, calificacionMaxima: '5.00', orden: 1 },
          { label: `${codigo}-B`, descripcion: `Indicador B de ${nombre}`, calificacionMaxima: '5.00', orden: 2 },
        ],
      }],
    };
  }

  async function crearTrabajo(codigo: string, rubricaVersionId: string, estudiantes: string[], periodoTrabajoId = periodoId): Promise<string> {
    const [{ id }] = await dataSource.query(`
      INSERT INTO trabajos_titulacion
        (codigo, titulo, id_modalidad, periodo_academico_id, id_carrera, id_version_rubrica, created_by_id_cuenta)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [codigo, `Trabajo ${codigo}`, modalidadId, periodoTrabajoId, carreraId, rubricaVersionId, cuentaAdminId]);
    for (const [index, estudiante] of estudiantes.entries()) {
      await dataSource.query(
        'INSERT INTO estudiantes_trabajo (id_trabajo, id_estudiante, orden_autoria) VALUES ($1, $2, $3)',
        [id, estudiante, index + 1],
      );
    }
    return id;
  }

  async function confirmarTribunal(trabajoId: string, docentes: string[]): Promise<string[]> {
    const [{ id: asignacionId }] = await dataSource.query(`
      INSERT INTO asignaciones_tribunal (id_trabajo, assigned_by_id_cuenta)
      VALUES ($1, $2) RETURNING id
    `, [trabajoId, cuentaAdminId]);
    const miembros: string[] = [];
    for (const [index, docente] of docentes.entries()) {
      const [{ id }] = await dataSource.query(`
        INSERT INTO miembros_tribunal (id_asignacion, id_docente, position) VALUES ($1, $2, $3) RETURNING id
      `, [asignacionId, docente, index + 1]);
      miembros.push(id);
    }
    await dataSource.query(`
      UPDATE asignaciones_tribunal SET estado = 'CONFIRMADO', confirmada_en = now() WHERE id = $1
    `, [asignacionId]);
    return miembros;
  }

  async function sembrarEvaluacionesHistoricas(esquema: DataSource): Promise<{
    trabajoId: string;
    evaluacionIds: string[];
    filasAntes: Array<Record<string, unknown>>;
  }> {
    const suffix = `${Date.now()}`.slice(-7);
    const [{ id: modalidad }] = await esquema.query(
      'INSERT INTO modalidades (codigo, nombre) VALUES ($1, $2) RETURNING id',
      [`LEGACY-M-${suffix}`, 'Modalidad fixture legacy'],
    );
    const [{ id: carrera }] = await esquema.query(
      'INSERT INTO carreras (codigo, nombre) VALUES ($1, $2) RETURNING id',
      [`LEGACY-C-${suffix}`, 'Carrera fixture legacy'],
    );
    const [{ id: periodo }] = await esquema.query(
      'INSERT INTO periodos_academicos (codigo) VALUES ($1) RETURNING id', [`LEGACY-P-${suffix}`],
    );
    const [{ id: personaAdmin }] = await esquema.query(`
      INSERT INTO personas (identificacion_nacional, nombres, surnames)
      VALUES ($1, 'Admin fixture', 'Legacy') RETURNING id
    `, [`LEGACY-AD-${suffix}`]);
    const [{ id: cuentaAdmin }] = await esquema.query(
      'INSERT INTO cuentas_usuario (id_persona, sujeto_autenticacion) VALUES ($1, $2) RETURNING id',
      [personaAdmin, `legacy-admin-${suffix}`],
    );
    const docentes: string[] = [];
    for (const [index, code] of ['J1', 'J2'].entries()) {
      const [{ id: personaDocente }] = await esquema.query(`
        INSERT INTO personas (identificacion_nacional, nombres, surnames)
        VALUES ($1, 'Jurado fixture', $2) RETURNING id
      `, [`LEGACY-${code}-${suffix}`, code]);
      await esquema.query(
        'INSERT INTO cuentas_usuario (id_persona, sujeto_autenticacion) VALUES ($1, $2)',
        [personaDocente, `legacy-jurado-${code}-${suffix}`],
      );
      const [{ id: docente }] = await esquema.query(
        'INSERT INTO perfiles_docente (id_persona, id_carrera) VALUES ($1, $2) RETURNING id', [personaDocente, carrera],
      );
      docentes.push(docente);
      expect(index).toBeLessThan(2);
    }
    const [{ id: personaEstudiante }] = await esquema.query(`
      INSERT INTO personas (identificacion_nacional, nombres, surnames)
      VALUES ($1, 'Estudiante fixture', 'Legacy') RETURNING id
    `, [`LEGACY-ES-${suffix}`]);
    const [{ id: estudiante }] = await esquema.query(
      'INSERT INTO perfiles_estudiante (id_persona, id_carrera) VALUES ($1, $2) RETURNING id', [personaEstudiante, carrera],
    );
    const [{ id: rubrica }] = await esquema.query(
      'INSERT INTO rubricas (id_modalidad, nombre) VALUES ($1, $2) RETURNING id', [modalidad, 'Rúbrica legacy fixture'],
    );
    const [{ id: version }] = await esquema.query(`
      INSERT INTO versiones_rubrica (id_rubrica, periodo_academico_id, version)
      VALUES ($1, $2, 'HISTORICA-1') RETURNING id
    `, [rubrica, periodo]);
    const [{ id: escrita }] = await esquema.query(`
      INSERT INTO etapas_rubrica (id_version_rubrica, kind, scope, codigo, nombre, calificacion_maxima, orden)
      VALUES ($1, 'ESCRITA', 'TRABAJO_COMPARTIDO', 'ESCRITA', 'Escrita histórica', 10.00, 1) RETURNING id
    `, [version]);
    const [{ id: oral }] = await esquema.query(`
      INSERT INTO etapas_rubrica (id_version_rubrica, kind, scope, codigo, nombre, calificacion_maxima, orden)
      VALUES ($1, 'ORAL', 'ESTUDIANTE_INDIVIDUAL', 'ORAL', 'Oral histórica', 10.00, 2) RETURNING id
    `, [version]);
    const categorias: string[] = [];
    for (const [index, [etapa, code]] of [[escrita, 'E'], [oral, 'O']].entries()) {
      const [{ id: categoria }] = await esquema.query(`
        INSERT INTO categorias_rubrica (id_version_rubrica, id_etapa_rubrica, codigo, nombre, calificacion_maxima, orden)
        VALUES ($1, $2, $3, $4, 10.00, 1) RETURNING id
      `, [version, etapa, `LEG-${code}`, `Categoría ${code}`,]);
      categorias.push(categoria);
      expect(index).toBeLessThan(2);
    }
    const [{ id: indicadorEscrita }] = await esquema.query(`
      INSERT INTO indicadores_rubrica (id_categoria, label, descripcion, calificacion_maxima, orden)
      VALUES ($1, 'LEG-E-1', 'Indicador escrito histórico', 10.00, 1) RETURNING id
    `, [categorias[0]]);
    const [{ id: indicadorOral }] = await esquema.query(`
      INSERT INTO indicadores_rubrica (id_categoria, label, descripcion, calificacion_maxima, orden)
      VALUES ($1, 'LEG-O-1', 'Indicador oral histórico', 10.00, 1) RETURNING id
    `, [categorias[1]]);
    await esquema.query("UPDATE versiones_rubrica SET estado = 'ACTIVA' WHERE id = $1", [version]);
    const [{ id: trabajoId }] = await esquema.query(`
      INSERT INTO trabajos_titulacion (codigo, titulo, id_modalidad, periodo_academico_id, id_carrera, id_version_rubrica, created_by_id_cuenta)
      VALUES ($1, 'Trabajo histórico de prueba', $2, $3, $4, $5, $6) RETURNING id
    `, [`LEGACY-W-${suffix}`, modalidad, periodo, carrera, version, cuentaAdmin]);
    await esquema.query(
      'INSERT INTO estudiantes_trabajo (id_trabajo, id_estudiante, orden_autoria) VALUES ($1, $2, 1)', [trabajoId, estudiante],
    );
    const [{ id: asignacion }] = await esquema.query(
      'INSERT INTO asignaciones_tribunal (id_trabajo, assigned_by_id_cuenta) VALUES ($1, $2) RETURNING id', [trabajoId, cuentaAdmin],
    );
    const miembros: string[] = [];
    for (const [index, docente] of docentes.entries()) {
      const [{ id }] = await esquema.query(
        'INSERT INTO miembros_tribunal (id_asignacion, id_docente, position) VALUES ($1, $2, $3) RETURNING id',
        [asignacion, docente, index + 1],
      );
      miembros.push(id);
    }
    await esquema.query("UPDATE asignaciones_tribunal SET estado = 'CONFIRMADO', confirmada_en = now() WHERE id = $1", [asignacion]);
    const crearEvaluacionHistorica = async (member: string, stage: 'ESCRITA' | 'ORAL', student: string | null, indicator: string, score: string) => {
      const [{ id }] = await esquema.query(`
        INSERT INTO evaluaciones (
          id_trabajo, id_miembro_tribunal, id_estudiante, id_version_rubrica, etapa, estado,
          instantanea_rubrica, instantanea_calificacion_maxima
        ) VALUES ($1, $2, $3, $4, $5, 'BORRADOR', $6::jsonb, 10.00) RETURNING id
      `, [trabajoId, member, student, version, stage, JSON.stringify({ rubricVersionId: version, legacyFixture: true })]);
      await esquema.query(`
        INSERT INTO calificaciones_evaluacion (id_evaluacion, id_indicador, score, instantanea_calificacion_maxima)
        VALUES ($1, $2, $3, 10.00)
      `, [id, indicator, score]);
      await esquema.query(`
        UPDATE evaluaciones SET calificacion_total = $2, estado = 'CERRADA', cerrada_en = now() WHERE id = $1
      `, [id, score]);
      return id as string;
    };
    const evaluacionEscritaUno = await crearEvaluacionHistorica(miembros[0], 'ESCRITA', null, indicadorEscrita, '8.50');
    const evaluacionEscritaDos = await crearEvaluacionHistorica(miembros[1], 'ESCRITA', null, indicadorEscrita, '8.75');
    await esquema.query(`
      INSERT INTO programaciones_sustentacion (id_trabajo, fecha_programada, hora_programada, sala, scheduled_by_id_cuenta)
      VALUES ($1, CURRENT_DATE, '10:00', 'Sala fixture', $2)
    `, [trabajoId, cuentaAdmin]);
    const evaluacionOral = await crearEvaluacionHistorica(miembros[0], 'ORAL', estudiante, indicadorOral, '7.25');
    const evaluacionIds = [evaluacionEscritaUno, evaluacionEscritaDos, evaluacionOral];
    const filasAntes = await esquema.query(`
      SELECT evaluacion.id, evaluacion.etapa, evaluacion.id_estudiante AS "idEstudiante",
             evaluacion.id_version_rubrica AS "idVersionRubrica", evaluacion.calificacion_total AS "total",
             evaluacion.estado, evaluacion.cerrada_en AS "cerradaEn",
             puntaje.id_indicador AS "idIndicador", puntaje.score AS "puntaje",
             etapa.id AS "etapaResuelta"
      FROM evaluaciones evaluacion
      JOIN calificaciones_evaluacion puntaje ON puntaje.id_evaluacion = evaluacion.id
      JOIN categorias_rubrica categoria ON categoria.id = (
        SELECT indicador.id_categoria FROM indicadores_rubrica indicador WHERE indicador.id = puntaje.id_indicador
      )
      JOIN etapas_rubrica etapa ON etapa.id = categoria.id_etapa_rubrica
      WHERE evaluacion.id = ANY($1::uuid[])
      ORDER BY evaluacion.id
    `, [evaluacionIds]);
    if (filasAntes.length !== 3) throw new Error('No se pudo crear el fixture de evaluaciones históricas.');
    return { trabajoId, evaluacionIds, filasAntes };
  }

  async function crearEvaluacion(trabajoId: string, principal: string, etapa: EtapaApi, estudianteId?: string): Promise<{ status: number; body: EvaluacionApi }> {
    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoId}`, principal, 'POST', {
      idEtapaRubrica: etapa.id,
      ...(estudianteId ? { idEstudiante: estudianteId } : {}),
    });
    return { status: response.status, body: await response.json() as EvaluacionApi };
  }

  async function puntuarYcerrar(evaluacion: EvaluacionApi, indicadores: IndicadorApi[], principal: string, valores = ['4.00', '4.00']): Promise<EvaluacionApi> {
    const puntajes = indicadores.map(({ id }, index) => ({ idIndicador: id, puntaje: valores[index] }));
    const save = await requestApi(`/api/v1/evaluaciones/${evaluacion.id}/puntajes`, principal, 'PUT', {
      revision: evaluacion.revision, puntajes,
    }, `corr-save-${evaluacion.id}`);
    expect(save.status).toBe(200);
    const guardada = await save.json() as EvaluacionApi;
    const close = await requestApi(`/api/v1/evaluaciones/${evaluacion.id}/cierre`, principal, 'POST', { revision: guardada.revision }, `corr-close-${evaluacion.id}`);
    expect(close.status).toBe(201);
    return close.json() as Promise<EvaluacionApi>;
  }

  it('migra filas históricas ESCRITA/ORAL conservando UUID, versión, estado, notas y etapa legacy nula', async () => {
    const filasDespues = await dataSource.query(`
      SELECT evaluacion.id, evaluacion.etapa, evaluacion.id_estudiante AS "idEstudiante",
             evaluacion.id_version_rubrica AS "idVersionRubrica", evaluacion.calificacion_total AS "total",
             evaluacion.estado, evaluacion.cerrada_en AS "cerradaEn", puntaje.id_indicador AS "idIndicador",
             puntaje.score AS "puntaje", etapa.id AS "etapaResuelta"
      FROM evaluaciones evaluacion
      JOIN calificaciones_evaluacion puntaje ON puntaje.id_evaluacion = evaluacion.id
      JOIN categorias_rubrica categoria ON categoria.id = (
        SELECT indicador.id_categoria FROM indicadores_rubrica indicador WHERE indicador.id = puntaje.id_indicador
      )
      JOIN etapas_rubrica etapa ON etapa.id = categoria.id_etapa_rubrica
      WHERE evaluacion.id = ANY($1::uuid[])
      ORDER BY evaluacion.id
    `, [evaluacionesHistoricasIds]);
    expect(filasDespues).toEqual(evaluacionesHistoricasAntes);
    const identidadesEtapaHistorica = await dataSource.query(`
      SELECT id, id_etapa_rubrica AS "idEtapaRubrica" FROM evaluaciones
      WHERE id = ANY($1::uuid[]) ORDER BY id
    `, [evaluacionesHistoricasIds]);
    expect(identidadesEtapaHistorica)
      .toEqual([...evaluacionesHistoricasIds].sort().map((id) => ({ id, idEtapaRubrica: null })));
    expect(await dataSource.query('SELECT estado FROM versiones_rubrica WHERE id_version_base IS NULL AND version = $1', ['HISTORICA-1']))
      .toEqual([{ estado: 'ACTIVA' }]);

    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoHistoricoId}`, 'jurado-uno');
    expect(response.status).toBe(200);
    const detalleHistorico = await response.json() as EvaluacionApi[];
    expect(detalleHistorico.map(({ id }) => id).sort()).toEqual([...evaluacionesHistoricasIds].sort());
    expect(detalleHistorico.every(({ idEtapaRubrica }) => idEtapaRubrica === null)).toBe(true);
    const escritasHistoricas = detalleHistorico.filter(({ etapa }) => etapa === 'ESCRITA');
    const oralHistorica = detalleHistorico.find(({ etapa }) => etapa === 'ORAL');
    expect(escritasHistoricas).toHaveLength(2);
    expect(escritasHistoricas.map(({ alcance }) => alcance)).toEqual(['TRABAJO_COMPARTIDO', 'TRABAJO_COMPARTIDO']);
    expect(escritasHistoricas.map(({ calificacionTotal }) => calificacionTotal).sort()).toEqual(['8.50', '8.75']);
    expect(oralHistorica).toMatchObject({
      alcance: 'ESTUDIANTE_INDIVIDUAL', estado: 'CERRADA', idEstudiante: expect.any(String), calificacionTotal: '7.25',
    });
    expect(await dataSource.query('SELECT count(*)::int AS total FROM traspasos_evaluacion_estudiante WHERE id_evaluacion = ANY($1::uuid[])', [evaluacionesHistoricasIds]))
      .toEqual([{ total: 0 }]);
    const legacyConsolidadoResponse = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoHistoricoId}/consolidados`, 'jurado-uno');
    expect(legacyConsolidadoResponse.status).toBe(200);
    const legacyConsolidado = await legacyConsolidadoResponse.json() as {
      estudiantes: Array<{ estado: string; resultadoFinal: unknown; evaluacionesLegacyExcluidas: number; modo: string }>;
    };
    expect(legacyConsolidado.estudiantes).toHaveLength(1);
    expect(legacyConsolidado.estudiantes[0]).toMatchObject({
      estado: 'LEGACY_NO_CONSOLIDADA', resultadoFinal: null,
      evaluacionesLegacyExcluidas: 3, modo: 'LEGACY_NO_CONSOLIDADA',
    });
  }, 30000);

  it('consolida una rúbrica compuesta únicamente por una etapa individual', async () => {
    expect(etapaSoloIndividual.alcance).toBe('ESTUDIANTE_INDIVIDUAL');
    const notas = [
      ['jurado-uno', ['4.60', '4.60']],
      ['jurado-dos', ['4.70', '4.70']],
    ] as const;
    for (const [principal, puntajes] of notas) {
      const creada = await crearEvaluacion(trabajoSoloIndividualId, principal, etapaSoloIndividual, estudianteTresId);
      expect(creada.status).toBe(201);
      const cerrada = await puntuarYcerrar(creada.body, indicadoresSoloIndividual, principal, [...puntajes]);
      expect(cerrada.calificacionTotal).toBe(principal === 'jurado-uno' ? '9.20' : '9.40');
    }

    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoSoloIndividualId}/consolidados`, 'jurado-uno');
    expect(response.status).toBe(200);
    const resultado = await response.json() as {
      estudiantes: Array<{
        estado: string;
        etapas: Array<{ alcance: string; promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string } }>;
        resultadoFinal: { calificacion: string };
      }>;
    };
    expect(resultado.estudiantes).toHaveLength(1);
    expect(resultado.estudiantes[0]).toMatchObject({
      estado: 'RESULTADO_COMPLETO',
      etapas: [{
        alcance: 'ESTUDIANTE_INDIVIDUAL',
        promedioEtapa: { exacto: { numerador: '93', denominador: '10' }, presentado: '9.30' },
      }],
      resultadoFinal: { calificacion: '9.30' },
    });
    expect(await dataSource.query(`
      SELECT count(*)::int AS total FROM traspasos_evaluacion_estudiante
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1)
    `, [trabajoSoloIndividualId])).toEqual([{ total: 0 }]);
  }, 30000);

  it('conserva versionado y ámbito de etapas, traspasa la evaluación compartida sin copiar puntajes y evalúa a cada estudiante', async () => {
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}`, undefined)).status).toBe(401);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}`, 'denegado')).status).toBe(403);
    expect(etapas.map(({ alcance }) => alcance)).toEqual([
      'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL', 'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL',
    ]);
    expect(await dataSource.query('SELECT id, estado FROM versiones_rubrica WHERE id = $1', [versionId]))
      .toEqual([{ id: versionId, estado: 'CONFIGURADA' }]);

    const clon = await requestApi(`/api/v1/rubricas/${(await dataSource.query('SELECT id_rubrica FROM versiones_rubrica WHERE id = $1', [versionId]))[0].id_rubrica}/versiones/completas`, 'administrador', 'POST', {
      periodoId, version: '9H5A-CLON', copiarDesdeVersionId: versionId, revisionBase: 1,
      carreras: [{ carreraId, revision: (await dataSource.getRepository(Carrera).findOneByOrFail({ id: carreraId })).revision, vigente: false, vigenciaEsperada: { versionId } }],
    });
    expect(clon.status).toBe(201);
    const versionClonada = await clon.json() as { id: string; etapas: EtapaApi[] };
    expect(versionClonada.etapas.map(({ alcance }) => alcance)).toEqual(etapas.map(({ alcance }) => alcance));
    expect((await dataSource.query('SELECT id, scope FROM etapas_rubrica WHERE id_version_rubrica = $1 ORDER BY orden', [versionId])))
      .toEqual(etapas.map(({ id, alcance }) => ({ id, scope: alcance })));

    const miembrosPares = await dataSource.query(`
      SELECT miembro.id FROM miembros_tribunal miembro
      JOIN asignaciones_tribunal asignacion ON asignacion.id = miembro.id_asignacion
      WHERE asignacion.id_trabajo = $1 ORDER BY miembro.position
    `, [trabajoCompartidoId]) as Array<{ id: string }>;
    const idsMiembro = miembrosPares.map(({ id }) => id);

    for (const etapaCompartida of [etapas[0], etapas[2]]) {
      const origenes: EvaluacionApi[] = [];
      for (const principal of ['jurado-uno', 'jurado-dos']) {
        const creada = await crearEvaluacion(trabajoCompartidoId, principal, etapaCompartida);
        expect(creada.status).toBe(201);
        expect(creada.body.idEstudiante).toBeNull();
        expect(creada.body.alcance).toBe('TRABAJO_COMPARTIDO');
        const repetida = await crearEvaluacion(trabajoCompartidoId, principal, etapaCompartida);
        expect(repetida.status).toBe(201);
        expect(repetida.body.id).toBe(creada.body.id);
        const valores = etapas.indexOf(etapaCompartida) === 0
          ? principal === 'jurado-uno' ? ['4.60', '4.60'] : ['4.70', '4.70']
          : ['4.65', '4.65'];
        origenes.push(await puntuarYcerrar(creada.body, indicadoresPorEtapa[etapas.indexOf(etapaCompartida)], principal, valores));
      }
      for (const origen of origenes) expect(origen.estudiantesTraspasados).toHaveLength(2);
      const traspasosDeEtapa = await dataSource.query(`
        SELECT count(*)::int AS total FROM traspasos_evaluacion_estudiante
        WHERE id_evaluacion = ANY($1::uuid[])
      `, [origenes.map(({ id }) => id)]);
      expect(traspasosDeEtapa).toEqual([{ total: 4 }]);
      const puntajesDeEtapa = await dataSource.query(`
        SELECT count(*)::int AS total FROM calificaciones_evaluacion WHERE id_evaluacion = ANY($1::uuid[])
      `, [origenes.map(({ id }) => id)]);
      expect(puntajesDeEtapa).toEqual([{ total: 4 }]);
    }

    const individuales: EvaluacionApi[] = [];
    for (const etapaIndividual of [etapas[1], etapas[3]]) {
      for (const [student, principal] of [[estudianteUnoId, 'jurado-uno'], [estudianteDosId, 'jurado-uno'],
        [estudianteUnoId, 'jurado-dos'], [estudianteDosId, 'jurado-dos']] as const) {
        const creada = await crearEvaluacion(trabajoCompartidoId, principal, etapaIndividual, student);
        expect(creada.status).toBe(201);
        expect(creada.body.idEstudiante).toBe(student);
        expect(creada.body.alcance).toBe('ESTUDIANTE_INDIVIDUAL');
        const ordenEtapa = etapas.indexOf(etapaIndividual);
        const valores = ordenEtapa === 1
          ? student === estudianteUnoId
            ? principal === 'jurado-uno' ? ['4.25', '4.25'] : ['4.45', '4.45']
            : principal === 'jurado-uno' ? ['4.55', '4.55'] : ['4.65', '4.65']
          : student === estudianteUnoId
            ? principal === 'jurado-uno' ? ['4.50', '4.50'] : ['4.60', '4.60']
            : principal === 'jurado-uno' ? ['4.40', '4.40'] : ['4.50', '4.50'];
        const cerrada = await puntuarYcerrar(creada.body, indicadoresPorEtapa[ordenEtapa], principal, valores);
        individuales.push(cerrada);
      }
    }
    expect(individuales).toHaveLength(8);

    const listados = await Promise.all(['estudiante-uno', 'estudiante-dos'].map(async (principal) => {
      const response = await requestApi(`/api/v1/evaluaciones/estudiantes/${principal === 'estudiante-uno' ? estudianteUnoId : estudianteDosId}`, principal);
      expect(response.status).toBe(200);
      return response.json() as Promise<Array<{ idEvaluacionOrigen: string; relacion: string; evaluacion: EvaluacionApi }>>;
    }));
    for (const [index, listado] of listados.entries()) {
      const expectedStudent = index === 0 ? estudianteUnoId : estudianteDosId;
      expect(listado.filter(({ relacion }) => relacion === 'TRASPASO_COMPARTIDO')).toHaveLength(4);
      expect(listado.filter(({ relacion }) => relacion === 'INDIVIDUAL')).toHaveLength(4);
      expect(listado.every(({ evaluacion }) => evaluacion.estado === 'CERRADA')).toBe(true);
      expect(listado.filter(({ relacion }) => relacion === 'INDIVIDUAL').every(({ evaluacion }) => evaluacion.idEstudiante === expectedStudent)).toBe(true);
      expect(new Set(listado.map(({ idEvaluacionOrigen }) => idEvaluacionOrigen)).size).toBe(listado.length);
    }

    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, undefined)).status).toBe(401);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, 'denegado')).status).toBe(403);
    expect((await requestApi(`/api/v1/evaluaciones/estudiantes/${estudianteDosId}/consolidado`, 'estudiante-uno')).status).toBe(403);
    const auditoriaAntesDeLectura = await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion');
    const evaluacionesAntesDeLectura = await dataSource.query(`
      SELECT id, estado, calificacion_total AS "calificacionTotal" FROM evaluaciones
      WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCompartidoId]);
    const consolidadoTrabajoResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, 'jurado-uno',
    );
    expect(consolidadoTrabajoResponse.status).toBe(200);
    const consolidadoTrabajo = await consolidadoTrabajoResponse.json() as {
      tipo: string;
      estudiantes: Array<{
        estudiante: { id: string };
        estado: string;
        resultadoFinal: { exacto: { numerador: string; denominador: string }; calificacion: string } | null;
        etapas: Array<{
          id: string; alcance: string; estado: string;
          promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string } | null;
          evaluaciones: Array<{ id: string; estado: string; calificacionUtilizada: string | null; procedencia: string; traspaso: { id: string } | null }>;
          evaluadoresPendientes: unknown[];
        }>;
      }>;
    };
    expect(consolidadoTrabajo.tipo).toBe('CONSOLIDACION_INDIVIDUAL_DINAMICA');
    expect(consolidadoTrabajo.estudiantes).toHaveLength(2);
    const consolidadoA = consolidadoTrabajo.estudiantes.find(({ estudiante }) => estudiante.id === estudianteUnoId)!;
    const consolidadoB = consolidadoTrabajo.estudiantes.find(({ estudiante }) => estudiante.id === estudianteDosId)!;
    expect(consolidadoA).toMatchObject({
      estado: 'RESULTADO_COMPLETO', resultadoFinal: {
        exacto: { numerador: '91', denominador: '10' }, calificacion: '9.10',
      },
    });
    expect(consolidadoB).toMatchObject({
      estado: 'RESULTADO_COMPLETO', resultadoFinal: {
        exacto: { numerador: '367', denominador: '40' }, calificacion: '9.18',
      },
    });
    expect(consolidadoA.etapas.map(({ alcance }) => alcance)).toEqual([
      'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL', 'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL',
    ]);
    expect(consolidadoA.etapas.map(({ promedioEtapa }) => promedioEtapa?.presentado))
      .toEqual(['9.30', '8.70', '9.30', '9.10']);
    expect(consolidadoB.etapas.map(({ promedioEtapa }) => promedioEtapa?.presentado))
      .toEqual(['9.30', '9.20', '9.30', '8.90']);
    const etapaEscritaA = consolidadoA.etapas[0];
    expect(etapaEscritaA.evaluaciones).toHaveLength(2);
    expect(etapaEscritaA.evaluaciones.map(({ calificacionUtilizada }) => calificacionUtilizada))
      .toEqual(['9.20', '9.40']);
    expect(etapaEscritaA.evaluaciones.every(({ procedencia, traspaso }) => (
      procedencia === 'EVALUACION_COMPARTIDA_TRASPASADA' && Boolean(traspaso?.id)
    ))).toBe(true);
    expect(new Set(etapaEscritaA.evaluaciones.map(({ id }) => id)).size).toBe(2);
    expect(consolidadoA.etapas.every(({ evaluadoresPendientes }) => evaluadoresPendientes.length === 0)).toBe(true);

    const consolidadoEstudianteResponse = await requestApi(
      `/api/v1/evaluaciones/estudiantes/${estudianteUnoId}/consolidado`, 'estudiante-uno',
    );
    expect(consolidadoEstudianteResponse.status).toBe(200);
    const consolidadoEstudiante = await consolidadoEstudianteResponse.json() as {
      estudiante: { id: string }; trabajos: Array<{ trabajoId: string; resultadoFinal: { calificacion: string } }>;
    };
    expect(consolidadoEstudiante.estudiante.id).toBe(estudianteUnoId);
    expect(consolidadoEstudiante.trabajos).toHaveLength(1);
    expect(consolidadoEstudiante.trabajos[0]).toMatchObject({ trabajoId: trabajoCompartidoId, resultadoFinal: { calificacion: '9.10' } });
    expect(await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion'))
      .toEqual(auditoriaAntesDeLectura);
    expect(await dataSource.query(`
      SELECT id, estado, calificacion_total AS "calificacionTotal" FROM evaluaciones
      WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCompartidoId])).toEqual(evaluacionesAntesDeLectura);
    expect((await requestApi(`/api/v1/evaluaciones/estudiantes/${estudianteDosId}`, 'estudiante-uno')).status).toBe(403);
    expect(await dataSource.query(`
      SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion
      WHERE accion = 'EVALUACION_CERRADA' AND id_evaluacion IN (
        SELECT id FROM evaluaciones WHERE id_trabajo = $1
      )
    `, [trabajoCompartidoId])).toEqual([{ total: 12 }]);

    const [primerOrigen] = await dataSource.query(`
      SELECT id FROM evaluaciones WHERE id_trabajo = $1 AND id_etapa_rubrica = $2 ORDER BY id LIMIT 1
    `, [trabajoCompartidoId, etapas[0].id]);
    await expect(dataSource.query('UPDATE traspasos_evaluacion_estudiante SET id_estudiante = $1 WHERE id_evaluacion = $2', [estudianteUnoId, primerOrigen.id]))
      .rejects.toThrow();
    await expect(dataSource.query('UPDATE eventos_auditoria_evaluacion SET accion = accion WHERE id_evaluacion = $1', [primerOrigen.id]))
      .rejects.toThrow();
    await expect(dataSource.query(`
      INSERT INTO traspasos_evaluacion_estudiante (id_evaluacion, id_trabajo, id_estudiante)
      VALUES ($1, $2, $3)
    `, [primerOrigen.id, trabajoCompartidoId, estudianteTresId])).rejects.toThrow();
    expect(idsMiembro).toHaveLength(2);
  }, 60000);

  it('rechaza cruces de ámbito, captura exacta, edición cerrada y mantiene toda operación de puntaje atómica', async () => {
    const sinEvaluaciones = await requestApi(
      `/api/v1/evaluaciones/estudiantes/${estudianteTresId}/consolidado`, 'estudiante-tres',
    );
    expect(sinEvaluaciones.status).toBe(200);
    const sinEvaluacionesBody = await sinEvaluaciones.json() as { trabajos: Array<{ estado: string; resultadoFinal: unknown }> };
    expect(sinEvaluacionesBody.trabajos.find(({ estado }) => estado === 'SIN_EVALUACIONES')?.resultadoFinal).toBeNull();

    const shared = await crearEvaluacion(trabajoIndividualId, 'jurado-uno', etapas[0]);
    expect(shared.status).toBe(201);
    expect((await crearEvaluacion(trabajoIndividualId, 'jurado-uno', etapas[0], estudianteTresId)).status).toBe(400);
    expect((await crearEvaluacion(trabajoIndividualId, 'jurado-uno', etapas[1])).status).toBe(400);
    expect((await crearEvaluacion(trabajoIndividualId, 'jurado-uno', etapas[1], estudianteUnoId)).status).toBe(400);
    expect((await crearEvaluacion(trabajoIndividualId, 'jurado-ajeno', etapas[0])).status).toBe(403);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoIndividualId}`, 'jurado-uno', 'POST', {
      idEtapaRubrica: etapas[0].id, idEstudiante: estudianteTresId, scope: 'ESTUDIANTE_INDIVIDUAL',
    })).status).toBe(400);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoIndividualId}`, 'jurado-uno', 'POST', {
      idEtapaRubrica: etapas[0].id, idEstudiante: estudianteTresId,
    })).status).toBe(400);

    const wrongIndicator = await requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: [{ idIndicador: indicadoresPorEtapa[1][0].id, puntaje: '3.00' }],
    });
    expect(wrongIndicator.status).toBe(400);
    const tooPrecise = await requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: [{ idIndicador: indicadoresPorEtapa[0][0].id, puntaje: '3.001' }],
    });
    expect(tooPrecise.status).toBe(400);
    const tooHigh = await requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: [{ idIndicador: indicadoresPorEtapa[0][0].id, puntaje: '5.01' }],
    });
    expect(tooHigh.status).toBe(400);
    expect((await requestApi(`/api/v1/evaluaciones/${shared.body.id}/cierre`, 'jurado-uno', 'POST', { revision: 1 })).status).toBe(400);

    const enProgreso = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIndividualId}/consolidados`, 'jurado-uno',
    );
    const enProgresoBody = await enProgreso.json() as {
      estudiantes: Array<{ estado: string; resultadoFinal: unknown; etapas: Array<{ estado: string; evaluaciones: Array<{ estado: string; calificacionUtilizada: string | null }>; evaluadoresPendientes: Array<{ causa: string }> }> }>;
    };
    expect(enProgresoBody.estudiantes[0].estado).toBe('EN_PROGRESO');
    expect(enProgresoBody.estudiantes[0].resultadoFinal).toBeNull();
    expect(enProgresoBody.estudiantes[0].etapas[0]).toMatchObject({
      estado: 'EN_PROGRESO',
      evaluaciones: [expect.objectContaining({ estado: 'BORRADOR', calificacionUtilizada: null })],
      evaluadoresPendientes: expect.arrayContaining([
        expect.objectContaining({ causa: 'EVALUACION_NO_CERRADA' }),
        expect.objectContaining({ causa: 'SIN_EVALUACION' }),
      ]),
    });

    const auditBefore = await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion');
    await dataSource.query(`
      CREATE FUNCTION test_rechazar_auditoria_evaluacion_9h5a() RETURNS trigger AS $$
      BEGIN
        IF NEW.accion = 'PUNTAJES_EVALUACION_REGISTRADOS' THEN RAISE EXCEPTION 'rechazo de auditoría de prueba'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_rechazar_auditoria_evaluacion_9h5a
      BEFORE INSERT ON eventos_auditoria_evaluacion
      FOR EACH ROW EXECUTE FUNCTION test_rechazar_auditoria_evaluacion_9h5a();
    `);
    try {
      const rollback = await requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', {
        revision: 1,
        puntajes: indicadoresPorEtapa[0].map(({ id }, index) => ({ idIndicador: id, puntaje: index ? '4.00' : '3.00' })),
      });
      expect(rollback.status).toBe(500);
      expect(await dataSource.query('SELECT count(*)::int AS total FROM calificaciones_evaluacion WHERE id_evaluacion = $1', [shared.body.id]))
        .toEqual([{ total: 0 }]);
      expect(await dataSource.query('SELECT revision FROM evaluaciones WHERE id = $1', [shared.body.id]))
        .toEqual([{ revision: 1 }]);
      expect(await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion'))
        .toEqual(auditBefore);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS test_rechazar_auditoria_evaluacion_9h5a ON eventos_auditoria_evaluacion');
      await dataSource.query('DROP FUNCTION IF EXISTS test_rechazar_auditoria_evaluacion_9h5a()');
    }

    const puntos = indicadoresPorEtapa[0].map(({ id }, index) => ({ idIndicador: id, puntaje: index ? '4.00' : '4.25' }));
    const [lecturaConcurrente, ...concurrentes] = await Promise.all([
      requestApi(`/api/v1/evaluaciones/trabajos/${trabajoIndividualId}/consolidados`, 'jurado-uno'),
      requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', { revision: 1, puntajes: puntos }),
      requestApi(`/api/v1/evaluaciones/${shared.body.id}/puntajes`, 'jurado-uno', 'PUT', { revision: 1, puntajes: puntos.map((p) => ({ ...p, puntaje: '4.00' })) }),
    ]);
    expect(lecturaConcurrente.status).toBe(200);
    const estadoConcurrente = await lecturaConcurrente.json() as { estudiantes: Array<{ estado: string; resultadoFinal: unknown }> };
    expect(estadoConcurrente.estudiantes[0].estado).toBe('EN_PROGRESO');
    expect(estadoConcurrente.estudiantes[0].resultadoFinal).toBeNull();
    expect(concurrentes.map(({ status }) => status).sort()).toEqual([200, 409]);
    const actual = await (await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoIndividualId}`, 'jurado-uno')).json() as EvaluacionApi[];
    const borrador = actual.find(({ id }) => id === shared.body.id)!;
    const repetido = await requestApi(`/api/v1/evaluaciones/${borrador.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: borrador.revision,
      puntajes: borrador.puntajes.map(({ idIndicador, puntaje }) => ({ idIndicador, puntaje })),
    });
    expect(repetido.status).toBe(200);
    expect((await repetido.json() as EvaluacionApi).revision).toBe(borrador.revision);
    const cerrada = await puntuarYcerrar(borrador, indicadoresPorEtapa[0], 'jurado-uno', ['4.25', '4.00']);
    expect(cerrada.estado).toBe('CERRADA');
    expect((await requestApi(`/api/v1/evaluaciones/${cerrada.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: cerrada.revision, puntajes: puntos,
    })).status).toBe(409);
    const incompletoCerrado = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIndividualId}/consolidados`, 'jurado-uno',
    );
    const incompletoCerradoBody = await incompletoCerrado.json() as {
      estudiantes: Array<{ estado: string; resultadoFinal: unknown; etapas: Array<{ estado: string; evaluadoresPendientes: Array<{ causa: string }> }> }>;
    };
    expect(incompletoCerradoBody.estudiantes[0]).toMatchObject({
      estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null,
    });
    expect(incompletoCerradoBody.estudiantes[0].etapas[0]).toMatchObject({
      estado: 'CERRADA_INCOMPLETA', evaluadoresPendientes: [expect.objectContaining({ causa: 'SIN_EVALUACION' })],
    });
  }, 60000);

  it('mantiene los promedios periódicos exactos hasta el promedio final', async () => {
    for (const etapa of etapas) {
      for (const principal of ['jurado-uno', 'jurado-dos']) {
        const creada = await crearEvaluacion(trabajoRedondeoId, principal, etapa,
          etapa.alcance === 'ESTUDIANTE_INDIVIDUAL' ? estudianteTresId : undefined);
        expect(creada.status).toBe(201);
        const valores = etapa.orden === 4 || principal === 'jurado-uno'
          ? ['4.50', '4.50']
          : ['4.50', '4.51'];
        const cerrada = await puntuarYcerrar(creada.body, indicadoresPorEtapa[etapas.indexOf(etapa)], principal, valores);
        expect(cerrada.calificacionTotal).toBe(etapa.orden === 4 || principal === 'jurado-uno' ? '9.00' : '9.01');
      }
    }
    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoRedondeoId}/consolidados`, 'jurado-uno');
    expect(response.status).toBe(200);
    const resultado = await response.json() as {
      estudiantes: Array<{
        estado: string;
        etapas: Array<{ promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string } }>;
        resultadoFinal: { exacto: { numerador: string; denominador: string }; calificacion: string };
      }>;
    };
    expect(resultado.estudiantes[0].estado).toBe('RESULTADO_COMPLETO');
    expect(resultado.estudiantes[0].etapas.map(({ promedioEtapa }) => promedioEtapa.presentado))
      .toEqual(['9.01', '9.01', '9.01', '9.00']);
    expect(resultado.estudiantes[0].resultadoFinal).toMatchObject({
      exacto: { numerador: '7203', denominador: '800', unidad: 'PUNTOS' }, calificacion: '9.00',
    });
    expect(redondearPromediosDeEtapaSoloComoComparacion(resultado.estudiantes[0].etapas.map(({ promedioEtapa }) => promedioEtapa.presentado)))
      .toBe('9.01');
  }, 60000);
});

function redondearPromediosDeEtapaSoloComoComparacion(valores: string[]): string {
  const centesimas = valores.map((valor) => {
    const [entero, decimal] = valor.split('.');
    return BigInt(entero) * 100n + BigInt(decimal);
  });
  const suma = centesimas.reduce((total, valor) => total + valor, 0n);
  let promedio = suma / BigInt(centesimas.length);
  if ((suma % BigInt(centesimas.length)) * 2n >= BigInt(centesimas.length)) promedio += 1n;
  return `${promedio / 100n}.${(promedio % 100n).toString().padStart(2, '0')}`;
}
