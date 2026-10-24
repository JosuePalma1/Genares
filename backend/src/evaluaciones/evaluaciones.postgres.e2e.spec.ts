import { ArchivoActas1760000012000 } from '../base-datos/migraciones/1760000012000-archivo-actas';
import { NotaMinimaActas1760000013000 } from '../base-datos/migraciones/1760000013000-nota-minima-actas';
import { ActorTecnicoProgramacionesLocales1760000014000 } from '../base-datos/migraciones/1760000014000-actor-tecnico-programaciones-locales';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { DocumentosModule } from '../documentos/documentos.module';
import { archivarActaEn } from '../documentos/archivo-actas';
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
import { ConflictoExactoSalaProgramacion1760000010000 } from '../base-datos/migraciones/1760000010000-conflicto-exacto-sala-programacion';
import { DuracionYEstadosOperativosSustentaciones1760000011000 } from '../base-datos/migraciones/1760000011000-duracion-y-estados-operativos-sustentaciones';
import { ModuloApi } from '../comun/api/modulo-api';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { ModalidadesModule } from '../modalidades/modalidades.module';
import { RubricasModule } from '../rubricas/rubricas.module';
import { EvaluacionesModule } from './evaluaciones.module';
import { ProgramacionesSustentacionModule } from '../sustentaciones/programaciones-sustentacion.module';

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
        ConflictoExactoSalaProgramacion1760000010000,
        DuracionYEstadosOperativosSustentaciones1760000011000,
        ArchivoActas1760000012000,
        NotaMinimaActas1760000013000,
        ActorTecnicoProgramacionesLocales1760000014000,
      ],
      migrationsTransactionMode: 'each',
      migrationsRun: true,
      synchronize: false,
    }),
    ModalidadesModule,
    RubricasModule,
    EvaluacionesModule,
    ProgramacionesSustentacionModule,
    DocumentosModule,
  ],
})
class ModuloPruebasEvaluaciones {}

type EtapaApi = { id: string; codigo: string; nombre: string; alcance: string; calificacionMaxima: string; orden: number };
type IndicadorApi = { id: string; calificacionMaxima: string };
type EvaluacionApi = {
  id: string;
  idTrabajo: string;
  idMiembroTribunal: string;
  idEstudiante: string | null;
  idVersionRubrica: string;
  idEtapaRubrica: string | null;
  etapa: string;
  estado: string;
  revision: number;
  alcance: string;
  calificacionTotal: string;
  instantaneaRubrica: {
    rubricVersionId: string;
    stages: Array<{ id: string }>;
    categories: Array<{ indicators: unknown[] }>;
  };
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
  let juradoAjenoId: string;
  let estudianteUnoId: string;
  let estudianteDosId: string;
  let estudianteTresId: string;
  let estudianteCuatroId: string;
  let estudianteNavegadorUnoId: string;
  let estudianteNavegadorDosId: string;
  let estudianteReferenciaUnoId: string;
  let estudianteReferenciaDosId: string;
  let trabajoIndividualId: string;
  let trabajoCompartidoId: string;
  let trabajoRedondeoId: string;
  let trabajoSoloIndividualId: string;
  let trabajoCeroId: string;
  let trabajoOtroTribunalId: string;
  let trabajoIntegracionNavegadorId: string;
  let trabajoIntegracionReferenciaId: string;
  let trabajoTribunalNoConfirmadoId: string;
  let trabajoCronogramaId: string;
  let trabajoCiclo12bId: string;
  let trabajoCronogramaConflictoId: string;
  let trabajoCronogramaConcurrenteId: string;
  let trabajoCronogramaCancelacionId: string;
  let trabajoCronogramaTrasCancelacionId: string;
  let trabajoCronogramaCarreraId: string;
  let periodoCronogramaId: string;
  let etapaCronogramaEscrita: EtapaApi;
  let etapaCronogramaOral: EtapaApi;
  let indicadoresCronogramaEscrita: IndicadorApi[];
  let indicadoresCronogramaOral: IndicadorApi[];
  let miembrosCiclo12bIds: string[];
  let versionCronogramaId: string;
  let trabajoHistoricoId: string;
  let sujetoJuradoHistoricoUno: string;
  let evaluacionesHistoricasIds: string[];
  let evaluacionesHistoricasAntes: Array<Record<string, unknown>>;
  let versionId: string;
  let etapas: EtapaApi[];
  let indicadoresPorEtapa: IndicadorApi[][];
  let etapaSoloIndividual: EtapaApi;
  let indicadoresSoloIndividual: IndicadorApi[];
  let versionSoloIndividualId: string;
  let versionIntegracionNavegadorId: string;
  let etapasIntegracionNavegador: EtapaApi[];

  beforeAll(async () => {
    const preflight = new DataSource({ type: 'postgres', url: testDatabaseUrl, synchronize: false });
    await preflight.initialize();
    try {
      const [identity] = await preflight.query(`
        SELECT current_database() AS database_name,
               host(inet_server_addr()) AS server_address,
               current_setting('port') AS server_port,
               shobj_description(d.oid, 'pg_database') AS database_marker,
               (SELECT count(*)::int FROM pg_catalog.pg_tables
                WHERE schemaname = 'public') AS public_tables
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
      sujetoJuradoHistoricoUno = fixture.sujetoJuradoUno;
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
          capacidades: ['rubricas:leer', 'rubricas:administrar', 'modalidades:leer', 'modalidades:administrar', 'evaluaciones:leer', 'evaluaciones:calificar', 'programaciones:leer', 'programaciones:administrar', 'configuracion-academica:administrar'],
        },
        'jurado-uno': { sujeto: 'prueba-jurado-uno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'emisor-documentos': { sujeto: 'prueba-jurado-uno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'documentos:emitir'] },
        'jurado-uno-lector': { sujeto: 'prueba-jurado-uno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
        'jurado-dos': { sujeto: 'prueba-jurado-dos', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'jurado-ajeno': { sujeto: 'prueba-jurado-ajeno', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer', 'evaluaciones:calificar'] },
        'jurado-historico-uno': { sujeto: sujetoJuradoHistoricoUno, tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
        'desarrollo-local': {
          sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL',
          capacidades: ['evaluaciones:leer', 'evaluaciones:calificar', 'evaluaciones:leer-demostracion',
            'programaciones:leer', 'programaciones:administrar', 'documentos:emitir', 'configuracion-academica:administrar'],
        },
        'lector-sin-perfil': { sujeto: 'prueba-lector-sin-perfil', tipo: 'VERIFICADA', capacidades: ['evaluaciones:leer'] },
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
      codigo: 'SOFT', nombre: 'Ingeniería en Software', estaActivo: true,
    });
    carreraId = carrera.id;
    const periodo = await dataSource.getRepository(PeriodoAcademico).save({ codigo: `9H5A-${suffix}`, estaActivo: true });
    periodoId = periodo.id;

    const persona = async (identificacion: string, subject: string, crearCuenta = true): Promise<string> => {
      const [{ id }] = await dataSource.query(`
        INSERT INTO "personas" ("identificacion_nacional", "nombres", "surnames")
        VALUES ($1, $2, 'Prueba 9H5A') RETURNING "id"
      `, [identificacion, subject]);
      if (crearCuenta) await dataSource.query(`
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
      const personaId = await persona(identificacion, subject, false);
      const [{ id }] = await dataSource.query(
        'INSERT INTO perfiles_estudiante (id_persona, id_carrera) VALUES ($1, $2) RETURNING id', [personaId, carreraId],
      );
      return id;
    };
    const admin = await perfilDocente(`AD-${suffix}`, 'prueba-admin-evaluaciones');
    cuentaAdminId = admin.cuentaId;
    const uno = await perfilDocente(`JU1-${suffix}`, 'prueba-jurado-uno');
    const dos = await perfilDocente(`JU2-${suffix}`, 'prueba-jurado-dos');
    const ajeno = await perfilDocente(`JUA-${suffix}`, 'prueba-jurado-ajeno');
    juradoAjenoId = ajeno.docenteId;
    juradoUnoId = uno.docenteId;
    juradoDosId = dos.docenteId;
    estudianteUnoId = await perfilEstudiante(`ES1-${suffix}`, 'prueba-estudiante-uno');
    estudianteDosId = await perfilEstudiante(`ES2-${suffix}`, 'prueba-estudiante-dos');
    estudianteTresId = await perfilEstudiante(`ES3-${suffix}`, 'prueba-estudiante-tres');
    estudianteCuatroId = await perfilEstudiante(`ES4-${suffix}`, 'prueba-estudiante-cuatro');
    estudianteNavegadorUnoId = await perfilEstudiante(`ESW1-${suffix}`, `prueba-estudiante-navegador-uno-${suffix}`);
    estudianteNavegadorDosId = await perfilEstudiante(`ESW2-${suffix}`, `prueba-estudiante-navegador-dos-${suffix}`);
    estudianteReferenciaUnoId = await perfilEstudiante(`ESR1-${suffix}`, `prueba-estudiante-referencia-uno-${suffix}`);
    estudianteReferenciaDosId = await perfilEstudiante(`ESR2-${suffix}`, `prueba-estudiante-referencia-dos-${suffix}`);

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

    // El cronograma exige dos evaluaciones históricas ESCRITA cerradas. Se crea
    // una versión tipada con el contrato legacy para probar esa compatibilidad;
    // las etapas PERSONALIZADA no se clasifican por nombre ni por ámbito.
    const periodoCronograma = await dataSource.getRepository(PeriodoAcademico).save({
      codigo: '2026-2', estaActivo: true,
    });
    periodoCronogramaId = periodoCronograma.id;
    const [{ id: rubricaId }] = await dataSource.query(
      'SELECT id_rubrica AS id FROM versiones_rubrica WHERE id = $1', [versionId],
    ) as Array<{ id: string }>;
    const versionCronogramaResponse = await requestApi(`/api/v1/rubricas/${rubricaId}/versiones`, 'administrador', 'POST', {
      periodoId: periodoCronogramaId,
      version: `10H7-COMPAT-${suffix}`,
    });
    if (versionCronogramaResponse.status !== 201) {
      throw new Error(`No se creó la versión de compatibilidad del cronograma: ${versionCronogramaResponse.status} ${JSON.stringify(await versionCronogramaResponse.json())}`);
    }
    const versionCronograma = await versionCronogramaResponse.json() as { id: string; revision: number };
    versionCronogramaId = versionCronograma.id;
    const estructuraCronograma = await requestApi(`/api/v1/versiones-rubrica/${versionCronograma.id}`, 'administrador', 'PUT', {
      revision: versionCronograma.revision,
      etapas: [
        {
          tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESCRITA', nombre: 'Evaluación escrita',
          calificacionMaxima: '10.00', porcentaje: '50.00', orden: 1,
          categorias: [{
            codigo: 'ESC', nombre: 'Componente escrito', calificacionMaxima: '10.00', orden: 1,
            indicadores: [
              { label: 'ESC-1', descripcion: 'Primer indicador escrito de compatibilidad', calificacionMaxima: '5.00', orden: 1 },
              { label: 'ESC-2', descripcion: 'Segundo indicador escrito de compatibilidad', calificacionMaxima: '5.00', orden: 2 },
            ],
          }],
        },
        {
          tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'ORAL', nombre: 'Sustentación oral',
          calificacionMaxima: '10.00', porcentaje: '50.00', orden: 2,
          categorias: [{
            codigo: 'ORA', nombre: 'Componente oral', calificacionMaxima: '10.00', orden: 2,
            indicadores: [
              { label: 'ORA-1', descripcion: 'Primer indicador oral de compatibilidad', calificacionMaxima: '5.00', orden: 1 },
              { label: 'ORA-2', descripcion: 'Segundo indicador oral de compatibilidad', calificacionMaxima: '5.00', orden: 2 },
            ],
          }],
        },
      ],
    });
    if (estructuraCronograma.status !== 200) {
      throw new Error(`No se configuró la versión de compatibilidad del cronograma: ${estructuraCronograma.status} ${JSON.stringify(await estructuraCronograma.json())}`);
    }
    const versionCronogramaConfigurada = await estructuraCronograma.json() as { revision: number; etapas: EtapaApi[] };
    const activacionCronograma = await requestApi(`/api/v1/versiones-rubrica/${versionCronograma.id}/activar`, 'administrador', 'POST', {
      revision: versionCronogramaConfigurada.revision,
    });
    if (activacionCronograma.status !== 200) {
      throw new Error(`No se activó la versión de compatibilidad del cronograma: ${activacionCronograma.status} ${JSON.stringify(await activacionCronograma.json())}`);
    }
    [etapaCronogramaEscrita, etapaCronogramaOral] = versionCronogramaConfigurada.etapas;
    indicadoresCronogramaEscrita = await dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapaCronogramaEscrita.id]);
    indicadoresCronogramaOral = await dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapaCronogramaOral.id]);

    const periodoIntegracionNavegador = await dataSource.getRepository(PeriodoAcademico).save({
      codigo: `10H5-${suffix}`, estaActivo: true,
    });
    const carreraIntegracionNavegador = await dataSource.getRepository(Carrera).findOneByOrFail({ id: carreraId });
    const respuestaRubricaIntegracionNavegador = await requestApi('/api/v1/rubricas/completas', 'administrador', 'POST', {
      modalidadId,
      periodoId: periodoIntegracionNavegador.id,
      nombre: 'RÃºbrica integral de navegador 10H5',
      version: `10H5-${suffix}`,
      etapas: [
        etapaDto('INFORME', 'Escrita', 1, 'TRABAJO_COMPARTIDO'),
        etapaDto('DEFENSA', 'Oral', 2, 'ESTUDIANTE_INDIVIDUAL'),
        etapaDto('ANEXOS', 'Anexos', 3, 'TRABAJO_COMPARTIDO'),
      ],
      carreras: [{
        carreraId, revision: carreraIntegracionNavegador.revision, vigente: true,
        vigenciaEsperada: { versionId: null },
      }],
    });
    if (respuestaRubricaIntegracionNavegador.status !== 201) {
      throw new Error(`No se creÃ³ la rÃºbrica 10.5: ${respuestaRubricaIntegracionNavegador.status} ${JSON.stringify(await respuestaRubricaIntegracionNavegador.json())}`);
    }
    const rubricaIntegracionNavegador = await respuestaRubricaIntegracionNavegador.json() as {
      id: string; etapas: EtapaApi[];
    };
    versionIntegracionNavegadorId = rubricaIntegracionNavegador.id;
    etapasIntegracionNavegador = rubricaIntegracionNavegador.etapas;
    if (etapasIntegracionNavegador.length !== 3
      || etapasIntegracionNavegador.some(({ calificacionMaxima }) => calificacionMaxima !== '10.00')
      || etapasIntegracionNavegador.map(({ alcance }) => alcance).join(',')
        !== 'TRABAJO_COMPARTIDO,ESTUDIANTE_INDIVIDUAL,TRABAJO_COMPARTIDO') {
      throw new Error('La rÃºbrica 10.5 debe conservar los tres Ã¡mbitos y mÃ¡ximos esperados.');
    }

    trabajoCompartidoId = await crearTrabajo(`9H5A-P-${suffix}`, versionId, [estudianteUnoId, estudianteDosId]);
    trabajoIndividualId = await crearTrabajo(`9H5A-I-${suffix}`, versionId, [estudianteTresId]);
    trabajoRedondeoId = await crearTrabajo(`9H5A-R-${suffix}`, versionId, [estudianteTresId]);
    await confirmarTribunal(trabajoCompartidoId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoIndividualId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoRedondeoId, [uno.docenteId, dos.docenteId]);
    trabajoIntegracionNavegadorId = await crearTrabajo(
      `10H5-W-${suffix}`, versionIntegracionNavegadorId,
      [estudianteNavegadorUnoId, estudianteNavegadorDosId], periodoIntegracionNavegador.id,
    );
    await confirmarTribunal(trabajoIntegracionNavegadorId, [uno.docenteId, dos.docenteId]);
    trabajoIntegracionReferenciaId = await crearTrabajo(
      `10H5-AUTO-${suffix}`, versionIntegracionNavegadorId,
      [estudianteReferenciaUnoId, estudianteReferenciaDosId], periodoIntegracionNavegador.id,
    );
    await confirmarTribunal(trabajoIntegracionReferenciaId, [uno.docenteId, dos.docenteId]);

    trabajoOtroTribunalId = await crearTrabajo(`10H1-A-${suffix}`, versionId, [estudianteCuatroId]);
    await confirmarTribunal(trabajoOtroTribunalId, [uno.docenteId, ajeno.docenteId]);
    trabajoTribunalNoConfirmadoId = await crearTrabajo(`10H1-B-${suffix}`, versionId, [estudianteCuatroId]);
    const [{ id: asignacionBorradorId }] = await dataSource.query(`
      INSERT INTO asignaciones_tribunal (id_trabajo, assigned_by_id_cuenta)
      VALUES ($1, $2) RETURNING id
    `, [trabajoTribunalNoConfirmadoId, cuentaAdminId]);
    for (const [index, docente] of [uno.docenteId, ajeno.docenteId].entries()) {
      await dataSource.query(`
        INSERT INTO miembros_tribunal (id_asignacion, id_docente, position) VALUES ($1, $2, $3)
      `, [asignacionBorradorId, docente, index + 1]);
    }

    trabajoCronogramaId = await crearTrabajo(`10H7B-${suffix}`, versionCronograma.id, [estudianteTresId], periodoCronogramaId);
    trabajoCiclo12bId = await crearTrabajo(
      `10H12B-${suffix}`, versionCronograma.id,
      [estudianteNavegadorUnoId, estudianteNavegadorDosId], periodoCronogramaId,
    );
    await dataSource.query(`
      INSERT INTO asignaciones_tutor_trabajo (id_trabajo, id_docente, assigned_by_id_cuenta)
      VALUES ($1, $2, $3)
    `, [trabajoCiclo12bId, juradoAjenoId, cuentaAdminId]);
    trabajoCronogramaConflictoId = await crearTrabajo(`10H7BC-${suffix}`, versionCronograma.id, [estudianteCuatroId], periodoCronogramaId);
    trabajoCronogramaConcurrenteId = await crearTrabajo(`10H7BR-${suffix}`, versionCronograma.id, [estudianteReferenciaUnoId], periodoCronogramaId);
    trabajoCronogramaCancelacionId = await crearTrabajo(`10H7BX-${suffix}`, versionCronograma.id, [estudianteReferenciaDosId], periodoCronogramaId);
    trabajoCronogramaTrasCancelacionId = await crearTrabajo(`10H7BY-${suffix}`, versionCronograma.id, [estudianteUnoId], periodoCronogramaId);
    trabajoCronogramaCarreraId = await crearTrabajo(`10H7BZ-${suffix}`, versionCronograma.id, [estudianteDosId], periodoCronogramaId);
    await confirmarTribunal(trabajoCronogramaId, [uno.docenteId, dos.docenteId]);
    miembrosCiclo12bIds = await confirmarTribunal(trabajoCiclo12bId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCronogramaConflictoId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCronogramaConcurrenteId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCronogramaCancelacionId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCronogramaTrasCancelacionId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCronogramaCarreraId, [uno.docenteId, dos.docenteId]);

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
    versionSoloIndividualId = rubricaSoloIndividual.id;
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
    trabajoCeroId = await crearTrabajo(
      `10H3-Z-${suffix}`, rubricaSoloIndividual.id, [estudianteTresId], periodoSoloIndividual.id,
    );
    await confirmarTribunal(trabajoSoloIndividualId, [uno.docenteId, dos.docenteId]);
    await confirmarTribunal(trabajoCeroId, [uno.docenteId, dos.docenteId]);
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

  async function crearTrabajo(codigo: string, rubricaVersionId: string, estudiantes: string[], periodoTrabajoId = periodoId, carreraTrabajoId = carreraId): Promise<string> {
    const [{ id }] = await dataSource.query(`
      INSERT INTO trabajos_titulacion
        (codigo, titulo, id_modalidad, periodo_academico_id, id_carrera, id_version_rubrica, created_by_id_cuenta)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [codigo, `Trabajo ${codigo}`, modalidadId, periodoTrabajoId, carreraTrabajoId, rubricaVersionId, cuentaAdminId]);
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
    sujetoJuradoUno: string;
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
    return { trabajoId, sujetoJuradoUno: `legacy-jurado-J1-${suffix}`, evaluacionIds, filasAntes };
  }

  it('prepara el caso de navegador 10.5 inicialmente vacío y fijado a tres etapas', async () => {
    const [trabajo] = await dataSource.query(`
      SELECT id_version_rubrica AS "versionRubricaId" FROM trabajos_titulacion WHERE id = $1
    `, [trabajoIntegracionNavegadorId]);
    expect(trabajo.versionRubricaId).toBe(versionIntegracionNavegadorId);
    const [conteo] = await dataSource.query(
      'SELECT count(*)::int AS total FROM evaluaciones WHERE id_trabajo = $1', [trabajoIntegracionNavegadorId],
    );
    expect(conteo.total).toBe(0);

    const response = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}/consolidados`, 'jurado-uno',
    );
    expect(response.status).toBe(200);
    const consolidacion = await response.json() as {
      versionRubrica: { id: string };
      estudiantes: Array<{ estado: string; resultadoFinal: unknown; etapas: Array<{ alcance: string }> }>;
    };
    expect(consolidacion.versionRubrica.id).toBe(versionIntegracionNavegadorId);
    expect(consolidacion.estudiantes).toHaveLength(2);
    expect(consolidacion.estudiantes.map(({ estado }) => estado)).toEqual(['SIN_EVALUACIONES', 'SIN_EVALUACIONES']);
    expect(consolidacion.estudiantes.every(({ resultadoFinal }) => resultadoFinal === null)).toBe(true);
    expect(consolidacion.estudiantes[0].etapas.map(({ alcance }) => alcance)).toEqual([
      'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL', 'TRABAJO_COMPARTIDO',
    ]);
  });

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

  it('lee, puntúa y cierra una evaluación cuyo UUID PostgreSQL no es UUIDv4', async () => {
    const etapaIndividual = etapasIntegracionNavegador.find(({ alcance }) => alcance === 'ESTUDIANTE_INDIVIDUAL')!;
    const indicadores: IndicadorApi[] = await dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapaIndividual.id]);
    const idNoVersionado = `10000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
    const idNoVersionadoInexistente = `20000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;

    const evaluacionOriginal = await crearEvaluacion(
      trabajoIntegracionNavegadorId, 'jurado-uno', etapaIndividual, estudianteNavegadorUnoId,
    );
    expect(evaluacionOriginal.status).toBe(201);

    // La fila adicional representa un registro PostgreSQL existente de otra instalación;
    // se limita a esta base efímera 9D y mantiene una asignación válida del fixture.
    await dataSource.query(`
      INSERT INTO evaluaciones (
        id, id_trabajo, id_miembro_tribunal, id_estudiante, id_version_rubrica,
        id_etapa_rubrica, etapa, estado, instantanea_rubrica, calificacion_total,
        instantanea_calificacion_maxima, revision, cerrada_en
      )
      SELECT $2, id_trabajo, id_miembro_tribunal, $3, id_version_rubrica,
             id_etapa_rubrica, etapa, estado, instantanea_rubrica, calificacion_total,
             instantanea_calificacion_maxima, revision, cerrada_en
      FROM evaluaciones WHERE id = $1
    `, [evaluacionOriginal.body.id, idNoVersionado, estudianteNavegadorDosId]);
    await dataSource.query(`
      INSERT INTO eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles)
      VALUES ($1, 'prueba-jurado-uno', 'EVALUACION_CREADA', $2::jsonb)
    `, [idNoVersionado, JSON.stringify({ idTrabajo: trabajoIntegracionNavegadorId, origen: 'fixture-uuid-postgres' })]);

    const lecturaInicial = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}`, 'jurado-uno',
    );
    expect(lecturaInicial.status).toBe(200);
    expect((await lecturaInicial.json() as EvaluacionApi[]).some(({ id, estado }) =>
      id === idNoVersionado && estado === 'BORRADOR')).toBe(true);

    const rutaTrabajoNoExistente = await requestApi(
      `/api/v1/evaluaciones/trabajos/${idNoVersionadoInexistente}`, 'desarrollo-local',
    );
    expect(rutaTrabajoNoExistente.status).toBe(404);
    expect((await requestApi('/api/v1/evaluaciones/trabajos/no-es-uuid', 'jurado-uno')).status).toBe(400);
    expect((await requestApi(`/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: [{ idIndicador: 'no-es-uuid', puntaje: '1.00' }],
    })).status).toBe(400);

    const contextoLocalResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}/contexto-evaluador`, 'desarrollo-local',
    );
    const contextoLocal = await contextoLocalResponse.json() as { idMiembroTribunal: string };
    const etapaInexistente = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}`, 'desarrollo-local', 'POST', {
      idEtapaRubrica: idNoVersionadoInexistente,
      idMiembroTribunal: contextoLocal.idMiembroTribunal,
    });
    expect(etapaInexistente.status).toBe(404);

    const estudianteAjenoNoVersionado = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}`, 'desarrollo-local', 'POST', {
        idEtapaRubrica: etapaIndividual.id,
        idEstudiante: idNoVersionadoInexistente,
        idMiembroTribunal: contextoLocal.idMiembroTribunal,
      },
    );
    expect(estudianteAjenoNoVersionado.status).toBe(400);

    const miembroAjenoNoVersionado = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}`, 'desarrollo-local', 'POST', {
        idEtapaRubrica: etapaIndividual.id,
        idEstudiante: estudianteNavegadorDosId,
        idMiembroTribunal: idNoVersionadoInexistente,
      },
    );
    expect(miembroAjenoNoVersionado.status).toBe(403);

    const miembroConsultadoAjenoNoVersionado = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}/contexto-evaluador?idMiembroTribunal=${idNoVersionadoInexistente}`,
      'desarrollo-local',
    );
    expect(miembroConsultadoAjenoNoVersionado.status).toBe(400);

    const miembroPuntajeAjenoNoVersionado = await requestApi(
      `/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'desarrollo-local', 'PUT', {
        revision: 1, idMiembroTribunal: idNoVersionadoInexistente,
        puntajes: indicadores.map(({ id }) => ({ idIndicador: id, puntaje: '1.00' })),
      },
    );
    expect(miembroPuntajeAjenoNoVersionado.status).toBe(403);
    const miembroCierreAjenoNoVersionado = await requestApi(
      `/api/v1/evaluaciones/${idNoVersionado}/cierre`, 'desarrollo-local', 'POST', {
        revision: 1, idMiembroTribunal: idNoVersionadoInexistente,
      },
    );
    expect(miembroCierreAjenoNoVersionado.status).toBe(403);

    const puntajeConIndicadorInexistente = await requestApi(`/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: [{ idIndicador: idNoVersionadoInexistente, puntaje: '1.00' }],
    });
    expect(puntajeConIndicadorInexistente.status).toBe(400);

    const [primera, ...resto] = await Promise.all([
      requestApi(`/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'jurado-uno', 'PUT', {
        revision: 1, puntajes: indicadores.map(({ id }, index) => ({ idIndicador: id, puntaje: index ? '4.00' : '4.25' })),
      }),
      requestApi(`/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'jurado-uno', 'PUT', {
        revision: 1, puntajes: indicadores.map(({ id }) => ({ idIndicador: id, puntaje: '3.00' })),
      }),
    ]);
    const concurrentes = [primera, ...resto];
    expect(concurrentes.map(({ status }) => status).sort()).toEqual([200, 409]);
    const guardada = await concurrentes.find(({ status }) => status === 200)!.json() as EvaluacionApi;
    expect(guardada.id).toBe(idNoVersionado);
    expect(guardada.revision).toBe(2);

    const lecturaPosterior = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionNavegadorId}`, 'jurado-uno',
    );
    const recuperada = (await lecturaPosterior.json() as EvaluacionApi[]).find(({ id }) => id === idNoVersionado)!;
    expect(recuperada).toMatchObject({ id: idNoVersionado, revision: 2, estado: 'BORRADOR' });

    const cierre = await requestApi(`/api/v1/evaluaciones/${idNoVersionado}/cierre`, 'jurado-uno', 'POST', {
      revision: recuperada.revision,
    });
    expect(cierre.status).toBe(201);
    expect(await cierre.json()).toMatchObject({ id: idNoVersionado, estado: 'CERRADA', revision: 3 });

    const puntajePosteriorAlCierre = await requestApi(`/api/v1/evaluaciones/${idNoVersionado}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 3, puntajes: indicadores.map(({ id }) => ({ idIndicador: id, puntaje: '4.00' })),
    });
    expect(puntajePosteriorAlCierre.status).toBe(409);
    expect(await dataSource.query(`
      SELECT accion, actor_id AS "actorId" FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion = $1 ORDER BY ocurrido_en, id
    `, [idNoVersionado])).toEqual([
      { accion: 'EVALUACION_CREADA', actorId: 'prueba-jurado-uno' },
      { accion: 'PUNTAJES_EVALUACION_REGISTRADOS', actorId: 'prueba-jurado-uno' },
      { accion: 'EVALUACION_CERRADA', actorId: 'prueba-jurado-uno' },
    ]);
  }, 60000);

  it('permite que el entorno local seleccione y valida a un miembro real del tribunal, con actor técnico auditable', async () => {
    const contextoResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/contexto-evaluador`, 'desarrollo-local',
    );
    expect(contextoResponse.status).toBe(200);
    const contexto = await contextoResponse.json() as {
      idMiembroTribunal: string;
      miembrosTribunal: Array<{ idMiembroTribunal: string }>;
    };
    expect(contexto.miembrosTribunal).toHaveLength(2);
    const idMiembroTribunal = contexto.miembrosTribunal[1].idMiembroTribunal;

    const creada = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`, 'desarrollo-local', 'POST', {
      idEtapaRubrica: etapas[2].id,
      idMiembroTribunal,
    });
    expect(creada.status).toBe(201);
    const evaluacion = await creada.json() as EvaluacionApi;
    expect(evaluacion.idMiembroTribunal).toBe(idMiembroTribunal);
    expect(evaluacion.idEstudiante).toBeNull();

    const puntajes = indicadoresPorEtapa[2].map(({ id }) => ({ idIndicador: id, puntaje: '1.00' }));
    const guardadaResponse = await requestApi(`/api/v1/evaluaciones/${evaluacion.id}/puntajes`, 'desarrollo-local', 'PUT', {
      revision: evaluacion.revision, puntajes, idMiembroTribunal,
    });
    expect(guardadaResponse.status).toBe(200);
    const guardada = await guardadaResponse.json() as EvaluacionApi;
    const cerradaResponse = await requestApi(`/api/v1/evaluaciones/${evaluacion.id}/cierre`, 'desarrollo-local', 'POST', {
      revision: guardada.revision, idMiembroTribunal,
    });
    expect(cerradaResponse.status).toBe(201);
    expect((await cerradaResponse.json() as EvaluacionApi).estado).toBe('CERRADA');

    const [auditoria] = await dataSource.query(`
      SELECT actor_id AS "actorId", accion, detalles->>'idMiembroTribunal' AS "idMiembroTribunal"
      FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion = $1 AND accion = 'EVALUACION_CERRADA'
    `, [evaluacion.id]);
    expect(auditoria).toEqual({ actorId: 'GENARES:LOCAL_DEVELOPMENT', accion: 'EVALUACION_CERRADA', idMiembroTribunal });

    const miembroAjeno = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`, 'desarrollo-local', 'POST', {
      idEtapaRubrica: etapas[1].id,
      idEstudiante: estudianteCuatroId,
      idMiembroTribunal: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    });
    expect(miembroAjeno.status).toBe(403);
  });

  it('autoriza listados y consolidados por membresía del tribunal confirmado del trabajo', async () => {
    const creada = await crearEvaluacion(trabajoOtroTribunalId, 'jurado-ajeno', etapas[0]);
    expect(creada.status).toBe(201);

    const contextoConPermiso = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/contexto-evaluador`, 'jurado-ajeno',
    );
    expect(contextoConPermiso.status).toBe(200);
    expect(await contextoConPermiso.json()).toMatchObject({ puedeCalificar: true, posicion: 2 });
    const contextoSoloLectura = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/contexto-evaluador`, 'jurado-uno-lector',
    );
    expect(contextoSoloLectura.status).toBe(200);
    expect(await contextoSoloLectura.json()).toMatchObject({ puedeCalificar: false, posicion: 1 });
    expect((await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/contexto-evaluador`, 'jurado-ajeno',
    )).status).toBe(404);
    expect((await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/contexto-evaluador`, 'denegado',
    )).status).toBe(403);
    expect((await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`, 'jurado-uno-lector', 'POST',
      { idEtapaRubrica: etapas[1].id, idEstudiante: estudianteCuatroId },
    )).status).toBe(403);

    await dataSource.query(`
      CREATE FUNCTION test_retrasar_creacion_evaluacion_10_2() RETURNS trigger AS $$
      BEGIN
        IF NEW.id_trabajo = '${trabajoOtroTribunalId}'::uuid
          AND NEW.id_etapa_rubrica = '${etapas[1].id}'::uuid THEN
          PERFORM pg_sleep(0.2);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_retrasar_creacion_evaluacion_10_2
      BEFORE INSERT ON evaluaciones
      FOR EACH ROW EXECUTE FUNCTION test_retrasar_creacion_evaluacion_10_2();
    `);
    let creacionesConcurrentes: Array<{ status: number; body: EvaluacionApi }>;
    try {
      creacionesConcurrentes = await Promise.all([
        crearEvaluacion(trabajoOtroTribunalId, 'jurado-ajeno', etapas[1], estudianteCuatroId),
        crearEvaluacion(trabajoOtroTribunalId, 'jurado-ajeno', etapas[1], estudianteCuatroId),
      ]);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS test_retrasar_creacion_evaluacion_10_2 ON evaluaciones');
      await dataSource.query('DROP FUNCTION IF EXISTS test_retrasar_creacion_evaluacion_10_2()');
    }
    expect(creacionesConcurrentes.map(({ status }) => status)).toEqual([201, 201]);
    expect(creacionesConcurrentes[0].body.id).toBe(creacionesConcurrentes[1].body.id);
    expect(await dataSource.query(`
      SELECT count(*)::int AS total FROM evaluaciones
      WHERE id_trabajo = $1 AND id_etapa_rubrica = $2 AND id_estudiante = $3
    `, [trabajoOtroTribunalId, etapas[1].id, estudianteCuatroId])).toEqual([{ total: 1 }]);
    expect(await dataSource.query(`
      SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion = $1 AND accion = 'EVALUACION_CREADA'
    `, [creacionesConcurrentes[0].body.id])).toEqual([{ total: 1 }]);

    const notaPrivada = 'OBSERVACION PRIVADA 10.1';
    const puntajePrivado = '3.25';
    const guardado = await requestApi(`/api/v1/evaluaciones/${creada.body.id}/puntajes`, 'jurado-ajeno', 'PUT', {
      revision: creada.body.revision,
      puntajes: [{
        idIndicador: indicadoresPorEtapa[0][0].id,
        puntaje: puntajePrivado,
        observacion: notaPrivada,
      }],
    });
    expect(guardado.status).toBe(200);

    // Simula una fila antigua de desarrollo cuyo JSON solo conserva la referencia de versi\u00f3n.
    // El GET debe presentar la estructura inmutable fijada sin escribir una reparaci\u00f3n en la fila.
    const instantaneaMinima = { rubricVersionId: creada.body.idVersionRubrica, fixture: '10.9B' };
    await dataSource.query(
      'UPDATE evaluaciones SET instantanea_rubrica = $1::jsonb WHERE id = $2',
      [JSON.stringify(instantaneaMinima), creada.body.id],
    );
    const estadoYRevisionAntesLectura = await dataSource.query(
      'SELECT estado, revision, calificacion_total::text AS total FROM evaluaciones WHERE id = $1',
      [creada.body.id],
    );
    const auditoriaAntesLectura = await dataSource.query(
      'SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion WHERE id_evaluacion = $1',
      [creada.body.id],
    );

    const lecturaPropia = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`, 'jurado-ajeno');
    expect(lecturaPropia.status).toBe(200);
    const evaluacionesPropias = await lecturaPropia.json() as Array<{
      id: string; estado: string; puntajes: Array<{ puntaje: string; observacion: string | null }>;
    }>;
    expect(evaluacionesPropias).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: creada.body.id,
        estado: 'BORRADOR',
        instantaneaRubrica: expect.objectContaining({
          rubricVersionId: creada.body.idVersionRubrica,
          stages: expect.arrayContaining([expect.objectContaining({ id: etapas[0].id })]),
          categories: expect.arrayContaining([expect.objectContaining({ indicators: expect.arrayContaining([expect.any(Object)]) })]),
        }),
        puntajes: expect.arrayContaining([expect.objectContaining({ puntaje: puntajePrivado, observacion: notaPrivada })]),
      }),
    ]));
    expect(await dataSource.query(
      'SELECT instantanea_rubrica FROM evaluaciones WHERE id = $1', [creada.body.id],
    )).toEqual([{ instantanea_rubrica: instantaneaMinima }]);
    expect(await dataSource.query(
      'SELECT estado, revision, calificacion_total::text AS total FROM evaluaciones WHERE id = $1', [creada.body.id],
    )).toEqual(estadoYRevisionAntesLectura);
    expect(await dataSource.query(
      'SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion WHERE id_evaluacion = $1', [creada.body.id],
    )).toEqual(auditoriaAntesLectura);

    const consolidadoPropio = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/consolidados`, 'jurado-ajeno',
    );
    expect(consolidadoPropio.status).toBe(200);
    const consolidadoPropioBody = await consolidadoPropio.json() as {
      estudiantes: Array<{ estado: string; resultadoFinal: unknown }>;
    };
    expect(consolidadoPropioBody.estudiantes[0]).toMatchObject({ estado: 'EN_PROGRESO', resultadoFinal: null });

    // Un miembro compartido entre tribunales conserva acceso a cada trabajo asignado.
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}`, 'jurado-uno')).status).toBe(200);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`, 'jurado-uno')).status).toBe(200);

    const rutasProtegidas = [
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}`,
      `/api/v1/evaluaciones/trabajos/${trabajoOtroTribunalId}/consolidados`,
    ];
    const [datosTrabajoPrivado] = await dataSource.query(
      'SELECT codigo, titulo FROM trabajos_titulacion WHERE id = $1', [trabajoOtroTribunalId],
    );
    for (const ruta of rutasProtegidas) {
      const ajeno = await requestApi(ruta, 'jurado-dos');
      const cuerpoAjeno = await ajeno.text();
      expect(ajeno.status).toBe(404);
      expect(cuerpoAjeno).not.toContain(notaPrivada);
      expect(cuerpoAjeno).not.toContain(puntajePrivado);
      expect(cuerpoAjeno).not.toContain(juradoAjenoId);
      expect(cuerpoAjeno).not.toContain(datosTrabajoPrivado.codigo);
      expect(cuerpoAjeno).not.toContain(datosTrabajoPrivado.titulo);

      const sinIdentidad = await requestApi(ruta, undefined);
      expect(sinIdentidad.status).toBe(401);
      expect(await sinIdentidad.text()).not.toContain(notaPrivada);

      const sinPerfil = await requestApi(ruta, 'lector-sin-perfil');
      expect(sinPerfil.status).toBe(404);
      expect(await sinPerfil.text()).not.toContain(notaPrivada);
    }

    const miembroAjenoEnTrabajoPrincipal = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}`, 'jurado-ajeno',
    );
    expect(miembroAjenoEnTrabajoPrincipal.status).toBe(404);
    const cuerpoMiembroAjeno = await miembroAjenoEnTrabajoPrincipal.text();
    expect(cuerpoMiembroAjeno).not.toContain(notaPrivada);
    const consolidacionMiembroAjeno = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, 'jurado-ajeno',
    );
    expect(consolidacionMiembroAjeno.status).toBe(404);
    expect(await consolidacionMiembroAjeno.text()).not.toContain(notaPrivada);

    const tribunalNoConfirmado = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoTribunalNoConfirmadoId}/consolidados`, 'jurado-ajeno',
    );
    expect(tribunalNoConfirmado.status).toBe(404);

    const trabajoInexistente = await requestApi(
      '/api/v1/evaluaciones/trabajos/ffffffff-ffff-4fff-8fff-ffffffffffff/consolidados', 'jurado-ajeno',
    );
    expect(trabajoInexistente.status).toBe(404);
    const errorNoAutorizado = JSON.parse(cuerpoMiembroAjeno) as Record<string, unknown>;
    const errorInexistente = await trabajoInexistente.json() as Record<string, unknown>;
    expect(errorNoAutorizado).toMatchObject({ code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
    expect(errorInexistente).toMatchObject({ code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
    expect(errorNoAutorizado.message).toBe(errorInexistente.message);

    expect((await requestApi(rutasProtegidas[0], undefined)).status).toBe(401);
    const sinCapacidad = await requestApi(rutasProtegidas[1], 'denegado');
    expect(sinCapacidad.status).toBe(403);
    expect(await sinCapacidad.text()).not.toContain(notaPrivada);
  }, 30000);

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

    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoHistoricoId}`, 'jurado-historico-uno');
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
    const legacyConsolidadoResponse = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoHistoricoId}/consolidados`, 'jurado-historico-uno');
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
      versionRubrica: { id: string };
      estudiantes: Array<{
        estado: string;
        etapas: Array<{ alcance: string; promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string } }>;
        resultadoFinal: { calificacion: string };
      }>;
    };
    expect(resultado.versionRubrica.id).toBe(versionSoloIndividualId);
    expect(resultado.versionRubrica.id).not.toBe(versionId);
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

  it('trata 0.00 como una calificación válida cuando todas las etapas están cerradas', async () => {
    for (const principal of ['jurado-uno', 'jurado-dos']) {
      const creada = await crearEvaluacion(trabajoCeroId, principal, etapaSoloIndividual, estudianteTresId);
      expect(creada.status).toBe(201);
      const cerrada = await puntuarYcerrar(creada.body, indicadoresSoloIndividual, principal, ['0.00', '0.00']);
      expect(cerrada.estado).toBe('CERRADA');
      expect(cerrada.calificacionTotal).toBe('0.00');
    }

    const response = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCeroId}/consolidados`, 'jurado-uno');
    expect(response.status).toBe(200);
    const resultado = await response.json() as {
      estudiantes: Array<{
        estado: string;
        etapas: Array<{ estado: string; promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string } }>;
        resultadoFinal: { exacto: { numerador: string; denominador: string }; calificacion: string } | null;
      }>;
    };
    expect(resultado.estudiantes).toHaveLength(1);
    expect(resultado.estudiantes[0]).toMatchObject({
      estado: 'RESULTADO_COMPLETO',
      etapas: [{
        estado: 'COMPLETA',
        promedioEtapa: { exacto: { numerador: '0', denominador: '1' }, presentado: '0.00' },
      }],
      resultadoFinal: { exacto: { numerador: '0', denominador: '1' }, calificacion: '0.00' },
    });
  }, 30000);

  it('expone listado y expediente desde PostgreSQL con relaciones coherentes y lectura protegida', async () => {
    await dataSource.query(`
      INSERT INTO asignaciones_tutor_trabajo (id_trabajo, id_docente, assigned_by_id_cuenta)
      VALUES ($1, $2, $3)
    `, [trabajoCompartidoId, juradoAjenoId, cuentaAdminId]);

    const listado = await requestApi('/api/v1/trabajos', 'desarrollo-local');
    expect(listado.status).toBe(200);
    const respuestaListado = await listado.json() as { elementos: Array<Record<string, unknown> & { id: string }> };
    const expedienteListado = respuestaListado.elementos.find(({ id }) => id === trabajoCompartidoId);
    expect(expedienteListado).toMatchObject({
      id: trabajoCompartidoId,
      codigo: expect.stringMatching(/^9H5A-P-/),
      carrera: expect.any(String),
      modalidad: expect.any(String),
      estadoTribunal: 'CONFIRMADO',
      idVersionRubrica: versionId,
      estadoVersionRubrica: 'CONFIGURADA',
    });
    expect(expedienteListado?.estudiantes).toEqual([
      expect.objectContaining({ id: estudianteUnoId, ordenAutoria: 1 }),
      expect.objectContaining({ id: estudianteDosId, ordenAutoria: 2 }),
    ]);
    expect(expedienteListado?.miembrosTribunal).toHaveLength(2);
    expect(expedienteListado?.tutores).toEqual([
      expect.objectContaining({ idDocente: juradoAjenoId, finalizadoEn: null }),
    ]);
    expect(expedienteListado?.programacion).toBeNull();

    const detalleResponse = await requestApi(`/api/v1/trabajos/${trabajoCompartidoId}`, 'desarrollo-local');
    expect(detalleResponse.status).toBe(200);
    expect(await detalleResponse.json()).toEqual(expedienteListado);

    const tribunalPendienteResponse = await requestApi(`/api/v1/trabajos/${trabajoTribunalNoConfirmadoId}`, 'desarrollo-local');
    expect(tribunalPendienteResponse.status).toBe(200);
    expect(await tribunalPendienteResponse.json()).toMatchObject({
      estadoTribunal: 'BORRADOR', miembrosTribunal: [], tutores: [], programacion: null,
    });

    const aliasCompatibilidad = await requestApi('/api/v1/evaluaciones/trabajos', 'desarrollo-local');
    expect(aliasCompatibilidad.status).toBe(200);
    expect(await aliasCompatibilidad.json()).toEqual(respuestaListado);

    expect((await requestApi('/api/v1/trabajos/no-es-uuid', 'desarrollo-local')).status).toBe(400);
    expect((await requestApi('/api/v1/trabajos/ffffffff-ffff-4fff-8fff-ffffffffffff', 'desarrollo-local')).status).toBe(404);
    expect((await requestApi('/api/v1/trabajos', undefined)).status).toBe(401);
    expect((await requestApi('/api/v1/trabajos', 'jurado-uno')).status).toBe(403);
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
      carreras: [{ carreraId, revision: (await dataSource.getRepository(Carrera).findOneByOrFail({ id: carreraId })).revision, vigente: true, vigenciaEsperada: { versionId } }],
    });
    expect(clon.status).toBe(201);
    const versionClonada = await clon.json() as { id: string; etapas: EtapaApi[] };
    expect(versionClonada.etapas.map(({ alcance }) => alcance)).toEqual(etapas.map(({ alcance }) => alcance));
    expect(await dataSource.query(`
      SELECT id_version_rubrica AS "versionVigente" FROM vigencias_rubrica_carrera
      WHERE id_carrera = $1 AND id_modalidad = $2 AND periodo_academico_id = $3 AND vigente_hasta IS NULL
    `, [carreraId, modalidadId, periodoId])).toEqual([{ versionVigente: versionClonada.id }]);
    expect(await dataSource.query(`
      SELECT bool_and(id_version_rubrica = $2) AS fijada, count(*)::int AS trabajos
      FROM trabajos_titulacion WHERE id = ANY($1::uuid[])
    `, [[trabajoCompartidoId, trabajoIndividualId, trabajoRedondeoId], versionId]))
      .toEqual([{ fijada: true, trabajos: 3 }]);
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

    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, undefined)).status).toBe(401);
    expect((await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, 'denegado')).status).toBe(403);
    const auditoriaAntesDeLectura = await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion');
    const evaluacionesAntesDeLectura = await dataSource.query(`
      SELECT id, estado, calificacion_total AS "calificacionTotal" FROM evaluaciones
      WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCompartidoId]);
    const consolidadoTrabajoResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCompartidoId}/consolidados`, 'jurado-uno',
    );
    expect(consolidadoTrabajoResponse.status).toBe(200);
    const listaLocal = await requestApi('/api/v1/evaluaciones/trabajos', 'desarrollo-local');
    expect(listaLocal.status).toBe(200);
    const trabajosLocales = await listaLocal.json() as { elementos: Array<{ id: string; estudiantes: unknown[]; miembrosTribunal: unknown[] }> };
    const [trabajoCompartidoLocal] = trabajosLocales.elementos.filter(({ id }) => id === trabajoCompartidoId);
    expect(trabajoCompartidoLocal.estudiantes).toHaveLength(2);
    expect(trabajoCompartidoLocal.miembrosTribunal).toHaveLength(2);
    const consolidadoTrabajo = await consolidadoTrabajoResponse.json() as {
      tipo: string;
      trabajo: { id: string; codigo: string; titulo: string };
      estudiantes: Array<{
        estudiante: { id: string };
        trabajo: { id: string; codigo: string; titulo: string };
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
    const [trabajoEsperado] = await dataSource.query(
      'SELECT id, codigo, titulo FROM trabajos_titulacion WHERE id = $1', [trabajoCompartidoId],
    );
    expect(consolidadoTrabajo.trabajo).toEqual(trabajoEsperado);
    expect(consolidadoTrabajo.estudiantes).toHaveLength(2);
    const consolidadoA = consolidadoTrabajo.estudiantes.find(({ estudiante }) => estudiante.id === estudianteUnoId)!;
    const consolidadoB = consolidadoTrabajo.estudiantes.find(({ estudiante }) => estudiante.id === estudianteDosId)!;
    expect(consolidadoA).toMatchObject({
      trabajo: trabajoEsperado,
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

    expect(await dataSource.query('SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion'))
      .toEqual(auditoriaAntesDeLectura);
    expect(await dataSource.query(`
      SELECT id, estado, calificacion_total AS "calificacionTotal" FROM evaluaciones
      WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCompartidoId])).toEqual(evaluacionesAntesDeLectura);
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

  it('consolida tres etapas compartidas e individuales y contrasta con una referencia racional independiente', async () => {
    const indicadoresPorEtapaIntegracion = await Promise.all(etapasIntegracionNavegador.map(async (etapa) => dataSource.query(`
      SELECT indicador.id, indicador.calificacion_maxima AS "calificacionMaxima"
      FROM indicadores_rubrica indicador
      JOIN categorias_rubrica categoria ON categoria.id = indicador.id_categoria
      WHERE categoria.id_etapa_rubrica = $1 ORDER BY indicador.orden
    `, [etapa.id]) as Promise<IndicadorApi[]>));
    const operaciones: Array<{
      orden: number; principal: 'jurado-uno' | 'jurado-dos'; estudianteId?: string; puntajes: string[];
    }> = [
      { orden: 0, principal: 'jurado-uno', puntajes: ['4.05', '4.06'] },
      { orden: 0, principal: 'jurado-dos', puntajes: ['4.10', '4.11'] },
      { orden: 1, principal: 'jurado-uno', estudianteId: estudianteReferenciaUnoId, puntajes: ['4.25', '4.25'] },
      { orden: 1, principal: 'jurado-dos', estudianteId: estudianteReferenciaUnoId, puntajes: ['4.45', '4.45'] },
      { orden: 1, principal: 'jurado-uno', estudianteId: estudianteReferenciaDosId, puntajes: ['4.55', '4.55'] },
      { orden: 1, principal: 'jurado-dos', estudianteId: estudianteReferenciaDosId, puntajes: ['4.65', '4.65'] },
      { orden: 2, principal: 'jurado-uno', puntajes: ['4.65', '4.65'] },
      { orden: 2, principal: 'jurado-dos', puntajes: ['4.70', '4.70'] },
    ];
    const evaluacionesCerradas: EvaluacionApi[] = [];
    for (const operacion of operaciones) {
      const creada = await crearEvaluacion(
        trabajoIntegracionReferenciaId, operacion.principal,
        etapasIntegracionNavegador[operacion.orden], operacion.estudianteId,
      );
      expect(creada.status).toBe(201);
      expect(creada.body.idEstudiante).toBe(operacion.estudianteId ?? null);
      evaluacionesCerradas.push(await puntuarYcerrar(
        creada.body, indicadoresPorEtapaIntegracion[operacion.orden], operacion.principal, operacion.puntajes,
      ));
    }
    expect(evaluacionesCerradas).toHaveLength(8);
    expect(evaluacionesCerradas.every(({ estado }) => estado === 'CERRADA')).toBe(true);
    const evaluacionCerrada = evaluacionesCerradas[0];
    const auditoriaAntesDeReintentarCierre = await dataSource.query(
      'SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion WHERE id_evaluacion = $1',
      [evaluacionCerrada.id],
    );
    const cierreRepetido = await requestApi(`/api/v1/evaluaciones/${evaluacionCerrada.id}/cierre`, 'jurado-uno', 'POST', {
      revision: evaluacionCerrada.revision,
    });
    expect(cierreRepetido.status).toBe(201);
    expect(await dataSource.query(
      'SELECT count(*)::int AS total FROM eventos_auditoria_evaluacion WHERE id_evaluacion = $1',
      [evaluacionCerrada.id],
    )).toEqual(auditoriaAntesDeReintentarCierre);

    const respuesta = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoIntegracionReferenciaId}/consolidados`, 'jurado-uno',
    );
    expect(respuesta.status).toBe(200);
    const consolidacion = await respuesta.json() as {
      versionRubrica: { id: string };
      estudiantes: Array<{
        estudiante: { id: string };
        estado: string;
        etapas: Array<{
          alcance: string;
          promedioEtapa: { exacto: { numerador: string; denominador: string; unidad: string }; presentado: string };
        }>;
        resultadoFinal: {
          exacto: { numerador: string; denominador: string; unidad: string };
          calificacion: string;
        };
      }>;
    };
    expect(consolidacion.versionRubrica.id).toBe(versionIntegracionNavegadorId);
    expect(consolidacion.estudiantes).toHaveLength(2);
    const referencia = new Map([
      [estudianteReferenciaUnoId, referenciaFinalDesdeEtapas([['8.11', '8.21'], ['8.50', '8.90'], ['9.30', '9.40']])],
      [estudianteReferenciaDosId, referenciaFinalDesdeEtapas([['8.11', '8.21'], ['9.10', '9.30'], ['9.30', '9.40']])],
    ]);
    const estudianteUno = consolidacion.estudiantes.find(({ estudiante }) => estudiante.id === estudianteReferenciaUnoId)!;
    const estudianteDos = consolidacion.estudiantes.find(({ estudiante }) => estudiante.id === estudianteReferenciaDosId)!;
    expect(estudianteUno.estado).toBe('RESULTADO_COMPLETO');
    expect(estudianteDos.estado).toBe('RESULTADO_COMPLETO');
    expect(estudianteUno.etapas.map(({ alcance }) => alcance)).toEqual([
      'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL', 'TRABAJO_COMPARTIDO',
    ]);
    expect(estudianteUno.etapas.map(({ promedioEtapa }) => promedioEtapa.presentado)).toEqual(['8.16', '8.70', '9.35']);
    expect(estudianteDos.etapas.map(({ promedioEtapa }) => promedioEtapa.presentado)).toEqual(['8.16', '9.20', '9.35']);
    expect(estudianteUno.etapas.map(({ promedioEtapa }) => promedioEtapa.exacto)).toEqual([
      { numerador: '204', denominador: '25', unidad: 'PUNTOS' },
      { numerador: '87', denominador: '10', unidad: 'PUNTOS' },
      { numerador: '187', denominador: '20', unidad: 'PUNTOS' },
    ]);
    expect(estudianteDos.etapas[0].promedioEtapa).toEqual(estudianteUno.etapas[0].promedioEtapa);
    expect(estudianteDos.etapas[2].promedioEtapa).toEqual(estudianteUno.etapas[2].promedioEtapa);
    expect(estudianteUno.etapas[1].promedioEtapa).not.toEqual(estudianteDos.etapas[1].promedioEtapa);
    expect(estudianteUno.resultadoFinal).toMatchObject({
      exacto: { numerador: referencia.get(estudianteReferenciaUnoId)!.numerador, denominador: referencia.get(estudianteReferenciaUnoId)!.denominador, unidad: 'PUNTOS' },
      calificacion: referencia.get(estudianteReferenciaUnoId)!.calificacion,
      calificacionMaxima: '10.00', escala: '0.00-10.00',
    });
    expect(estudianteDos.resultadoFinal).toMatchObject({
      exacto: { numerador: referencia.get(estudianteReferenciaDosId)!.numerador, denominador: referencia.get(estudianteReferenciaDosId)!.denominador, unidad: 'PUNTOS' },
      calificacion: referencia.get(estudianteReferenciaDosId)!.calificacion,
      calificacionMaxima: '10.00', escala: '0.00-10.00',
    });
    expect(estudianteUno.resultadoFinal.calificacion).toBe('8.74');
    expect(estudianteDos.resultadoFinal.calificacion).toBe('8.90');

    const [integridad] = await dataSource.query(`
      SELECT count(*)::int AS evaluaciones,
             count(*) FILTER (WHERE estado = 'CERRADA')::int AS cerradas
      FROM evaluaciones WHERE id_trabajo = $1 AND id_etapa_rubrica = ANY($2::uuid[])
    `, [trabajoIntegracionReferenciaId, etapasIntegracionNavegador.map(({ id }) => id)]);
    expect(integridad).toEqual({ evaluaciones: 8, cerradas: 8 });
    const [traspasos] = await dataSource.query(`
      SELECT count(*)::int AS total,
             count(DISTINCT id_evaluacion || ':' || id_estudiante)::int AS origen_estudiante_unico
      FROM traspasos_evaluacion_estudiante
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1 AND id_estudiante IS NULL)
    `, [trabajoIntegracionReferenciaId]);
    expect(traspasos).toEqual({ total: 8, origen_estudiante_unico: 8 });
  }, 60000);

  it('integra expediente, programación, evaluaciones mixtas, consolidación y rúbricas PDF en un ciclo 9D', async () => {
    const expedienteResponse = await requestApi(`/api/v1/trabajos/${trabajoCiclo12bId}`, 'desarrollo-local');
    expect(expedienteResponse.status).toBe(200);
    const expediente = await expedienteResponse.json() as {
      id: string; codigo: string; codigoCarrera: string; idVersionRubrica: string;
      estudiantes: Array<{ id: string }>; tutores: Array<{ idDocente: string }>;
      miembrosTribunal: Array<{ idMiembroTribunal: string }>;
      estado: string;
    };
    expect(expediente).toMatchObject({
      id: trabajoCiclo12bId,
      codigoCarrera: 'SOFT',
      idVersionRubrica: versionCronogramaId,
      estudiantes: [{ id: estudianteNavegadorUnoId }, { id: estudianteNavegadorDosId }],
      tutores: [expect.objectContaining({ idDocente: juradoAjenoId })],
      miembrosTribunal: expect.arrayContaining([
        expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[0] }),
        expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[1] }),
      ]),
    });
    expect(expediente.miembrosTribunal).toHaveLength(2);

    const evaluacionesIniciales = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}`, 'jurado-uno',
    );
    expect(evaluacionesIniciales.status).toBe(200);
    expect(await evaluacionesIniciales.json()).toEqual([]);
    const actaSinEvaluaciones = await requestApi(
      `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteNavegadorUnoId}/actas`,
      'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' },
    );
    expect(actaSinEvaluaciones.status).toBe(409);
    const [estadoTrabajoInicial] = await dataSource.query(
      'SELECT estado::text AS estado FROM trabajos_titulacion WHERE id = $1', [trabajoCiclo12bId],
    );

    const escritaUno = await crearEvaluacion(trabajoCiclo12bId, 'jurado-uno', etapaCronogramaEscrita);
    const escritaDos = await crearEvaluacion(trabajoCiclo12bId, 'jurado-dos', etapaCronogramaEscrita);
    expect([escritaUno.status, escritaDos.status]).toEqual([201, 201]);
    expect([escritaUno.body.idEstudiante, escritaDos.body.idEstudiante]).toEqual([null, null]);
    expect([escritaUno.body.idVersionRubrica, escritaDos.body.idVersionRubrica])
      .toEqual([versionCronogramaId, versionCronogramaId]);
    expect((await requestApi(`/api/v1/evaluaciones/${escritaUno.body.id}/cierre`, 'jurado-uno', 'POST', {
      revision: escritaUno.body.revision,
    })).status).toBe(400);
    expect((await requestApi(`/api/v1/evaluaciones/${escritaUno.body.id}/puntajes`, 'jurado-uno', 'PUT', {
      revision: escritaUno.body.revision,
      puntajes: indicadoresCronogramaEscrita.map(({ id }, index) => ({
        idIndicador: id, puntaje: index === 0 ? '5.01' : '4.00',
      })),
    })).status).toBe(400);

    await puntuarYcerrar(escritaUno.body, indicadoresCronogramaEscrita, 'jurado-uno', ['4.60', '4.60']);
    await puntuarYcerrar(escritaDos.body, indicadoresCronogramaEscrita, 'jurado-dos', ['4.70', '4.70']);
    const evaluacionesEscritas = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}`, 'jurado-uno',
    );
    expect((await evaluacionesEscritas.json() as EvaluacionApi[]).map(({ idMiembroTribunal, estado, alcance }) => ({
      idMiembroTribunal, estado, alcance,
    }))).toEqual([
      expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[0], estado: 'CERRADA', alcance: 'TRABAJO_COMPARTIDO' }),
      expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[1], estado: 'CERRADA', alcance: 'TRABAJO_COMPARTIDO' }),
    ]);

    const programables = await requestApi('/api/v1/programaciones-sustentacion/trabajos-disponibles', 'administrador');
    expect(programables.status).toBe(200);
    expect((await programables.json() as { elementos: Array<{ idTrabajo: string }> }).elementos)
      .toEqual(expect.arrayContaining([expect.objectContaining({ idTrabajo: trabajoCiclo12bId })]));
    const fechaProgramada = '2026-10-28';
    const programacionDto = { idTrabajo: trabajoCiclo12bId, fechaProgramada, horaProgramada: '10:30', sala: 'Sala Ciclo 10.12B' };
    expect((await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST', {
      ...programacionDto, fechaProgramada: '2026-02-30',
    })).status).toBe(400);
    const programacionCreada = await requestApi(
      '/api/v1/programaciones-sustentacion', 'administrador', 'POST', programacionDto,
    );
    expect(programacionCreada.status).toBe(201);
    const programacion = await programacionCreada.json() as { id: string; idTrabajo: string; estado: string };
    expect(programacion).toMatchObject({ idTrabajo: trabajoCiclo12bId, estado: 'PROGRAMADA' });
    expect((await requestApi('/api/v1/programaciones-sustentacion', 'administrador')).status).toBe(200);
    const listadoProgramaciones = await (await requestApi(
      '/api/v1/programaciones-sustentacion', 'administrador',
    )).json() as { elementos: Array<{ id: string; idTrabajo: string }> };
    expect(listadoProgramaciones.elementos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: programacion.id, idTrabajo: trabajoCiclo12bId }),
    ]));
    const detalleProgramacion = await requestApi(
      `/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador',
    );
    expect(detalleProgramacion.status).toBe(200);
    expect(await detalleProgramacion.json()).toMatchObject({ id: programacion.id, idTrabajo: trabajoCiclo12bId });
    expect((await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST', programacionDto)).status)
      .toBe(409);

    const consolidadoEscrito = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}/consolidados`, 'jurado-uno',
    );
    expect(consolidadoEscrito.status).toBe(200);
    const resultadoEscrito = await consolidadoEscrito.json() as {
      estudiantes: Array<{ estado: string; resultadoFinal: unknown; etapas: Array<{ alcance: string }> }>;
    };
    expect(resultadoEscrito.estudiantes).toHaveLength(2);
    expect(resultadoEscrito.estudiantes.every(({ estado, resultadoFinal }) =>
      estado === 'EVALUACIONES_CERRADAS_INCOMPLETAS' && resultadoFinal === null)).toBe(true);
    expect(resultadoEscrito.estudiantes[0].etapas.map(({ alcance }) => alcance))
      .toEqual(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);

    const oralUnoA = await crearEvaluacion(
      trabajoCiclo12bId, 'jurado-uno', etapaCronogramaOral, estudianteNavegadorUnoId,
    );
    const oralDosA = await crearEvaluacion(
      trabajoCiclo12bId, 'jurado-dos', etapaCronogramaOral, estudianteNavegadorUnoId,
    );
    const oralDosB = await crearEvaluacion(
      trabajoCiclo12bId, 'jurado-dos', etapaCronogramaOral, estudianteNavegadorDosId,
    );
    expect([oralUnoA.status, oralDosA.status, oralDosB.status]).toEqual([201, 201, 201]);
    const idOralUnoBNoV4 = `10000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
    await dataSource.query(`
      INSERT INTO evaluaciones (
        id, id_trabajo, id_miembro_tribunal, id_estudiante, id_version_rubrica,
        id_etapa_rubrica, etapa, estado, instantanea_rubrica, calificacion_total,
        instantanea_calificacion_maxima, revision, cerrada_en
      )
      SELECT $2, id_trabajo, id_miembro_tribunal, $3, id_version_rubrica,
             id_etapa_rubrica, etapa, estado, instantanea_rubrica, calificacion_total,
             instantanea_calificacion_maxima, revision, cerrada_en
      FROM evaluaciones WHERE id = $1
    `, [oralUnoA.body.id, idOralUnoBNoV4, estudianteNavegadorDosId]);
    await dataSource.query(`
      INSERT INTO eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles)
      VALUES ($1, 'prueba-jurado-uno', 'EVALUACION_CREADA', $2::jsonb)
    `, [idOralUnoBNoV4, JSON.stringify({ idTrabajo: trabajoCiclo12bId, origen: 'fixture-uuid-postgres-no-v4' })]);

    const evaluacionesAbiertasResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}`, 'jurado-uno',
    );
    expect(evaluacionesAbiertasResponse.status).toBe(200);
    const evaluacionesAbiertas = await evaluacionesAbiertasResponse.json() as EvaluacionApi[];
    const oralUnoB = evaluacionesAbiertas.find(({ id }) => id === idOralUnoBNoV4)!;
    expect(oralUnoB).toMatchObject({
      id: idOralUnoBNoV4,
      idTrabajo: trabajoCiclo12bId,
      idMiembroTribunal: miembrosCiclo12bIds[0],
      idEstudiante: estudianteNavegadorDosId,
      idVersionRubrica: versionCronogramaId,
      idEtapaRubrica: etapaCronogramaOral.id,
      estado: 'BORRADOR',
    });
    expect(evaluacionesAbiertas).toHaveLength(6);
    expect((await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador', 'PUT', {
      fechaProgramada: '2026-10-29', horaProgramada: '11:00', sala: 'Sala Ciclo 10.12B',
    })).status).toBe(409);

    const puntajesOralUnoB = indicadoresCronogramaOral.map(({ id }, index) => ({
      idIndicador: id, puntaje: index === 0 ? '4.55' : '4.55',
    }));
    expect((await requestApi(`/api/v1/evaluaciones/${idOralUnoBNoV4}/puntajes`, 'jurado-uno', 'PUT', {
      revision: 1, puntajes: indicadoresCronogramaOral.map(({ id }) => ({ idIndicador: id, puntaje: '5.01' })),
    })).status).toBe(400);
    expect((await requestApi(`/api/v1/evaluaciones/${oralUnoA.body.id}/cierre`, 'jurado-uno', 'POST', {
      revision: oralUnoA.body.revision,
    })).status).toBe(400);

    const concurrenciaPuntajes = await Promise.all([
      requestApi(`/api/v1/evaluaciones/${idOralUnoBNoV4}/puntajes`, 'jurado-uno', 'PUT', {
        revision: 1, puntajes: puntajesOralUnoB,
      }, `12b-concurrente-a-${idOralUnoBNoV4}`),
      requestApi(`/api/v1/evaluaciones/${idOralUnoBNoV4}/puntajes`, 'jurado-uno', 'PUT', {
        revision: 1, puntajes: puntajesOralUnoB,
      }, `12b-concurrente-b-${idOralUnoBNoV4}`),
    ]);
    expect(concurrenciaPuntajes.map(({ status }) => status).sort()).toEqual([200, 409]);
    const evaluacionesTrasConflicto = await (await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}`, 'jurado-uno',
    )).json() as EvaluacionApi[];
    const oralUnoBRecuperada = evaluacionesTrasConflicto.find(({ id }) => id === idOralUnoBNoV4)!;
    expect(oralUnoBRecuperada).toMatchObject({ id: idOralUnoBNoV4, estado: 'BORRADOR', revision: 2 });
    expect(oralUnoBRecuperada.puntajes.map(({ puntaje }) => puntaje)).toEqual(['4.55', '4.55']);
    await puntuarYcerrar(oralUnoA.body, indicadoresCronogramaOral, 'jurado-uno', ['4.25', '4.25']);
    const cierreNoV4 = await requestApi(`/api/v1/evaluaciones/${idOralUnoBNoV4}/cierre`, 'jurado-uno', 'POST', {
      revision: oralUnoBRecuperada.revision,
    });
    expect(cierreNoV4.status).toBe(201);
    expect(await cierreNoV4.json()).toMatchObject({ id: idOralUnoBNoV4, estado: 'CERRADA', revision: 3 });

    const consolidadoParcialResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}/consolidados`, 'jurado-uno',
    );
    expect(consolidadoParcialResponse.status).toBe(200);
    const consolidadoParcial = await consolidadoParcialResponse.json() as {
      estudiantes: Array<{
        estudiante: { id: string }; estado: string; resultadoFinal: unknown;
        etapas: Array<{ estado: string; evaluaciones: Array<{ estado: string }>; evaluadoresPendientes: Array<{ causa: string }> }>;
      }>;
    };
    expect(consolidadoParcial.estudiantes).toHaveLength(2);
    for (const estudiante of consolidadoParcial.estudiantes) {
      expect(estudiante).toMatchObject({ estado: 'EN_PROGRESO', resultadoFinal: null });
      expect(estudiante.etapas[1].evaluadoresPendientes).toEqual(expect.arrayContaining([
        expect.objectContaining({ causa: 'EVALUACION_NO_CERRADA' }),
      ]));
    }
    expect(consolidadoParcial.estudiantes.every(({ etapas }) => etapas[0].evaluadoresPendientes.length === 0)).toBe(true);
    expect((await requestApi(
      `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteNavegadorUnoId}/actas`,
      'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' },
    )).status).toBe(409);

    for (const [evaluacion, valores] of [
      [oralDosA.body, ['4.45', '4.45']],
      [oralDosB.body, ['4.65', '4.65']],
    ] as Array<[EvaluacionApi, string[]]>) {
      await puntuarYcerrar(evaluacion, indicadoresCronogramaOral, 'jurado-dos', valores);
    }
    const inicioSustentacion = await requestApi(
      `/api/v1/programaciones-sustentacion/${programacion.id}/estado`, 'administrador', 'PATCH',
      { estado: 'EN_SUSTENTACION' },
    );
    expect(inicioSustentacion.status).toBe(200);
    expect(await inicioSustentacion.json()).toMatchObject({ id: programacion.id, estado: 'EN_SUSTENTACION' });
    const finalizacionSustentacion = await requestApi(
      `/api/v1/programaciones-sustentacion/${programacion.id}/estado`, 'administrador', 'PATCH',
      { estado: 'FINALIZADA' },
    );
    expect(finalizacionSustentacion.status).toBe(200);
    expect(await finalizacionSustentacion.json()).toMatchObject({ id: programacion.id, estado: 'FINALIZADA' });

    const consolidadoFinalResponse = await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoCiclo12bId}/consolidados`, 'jurado-uno',
    );
    expect(consolidadoFinalResponse.status).toBe(200);
    const consolidadoFinal = await consolidadoFinalResponse.json() as {
      versionRubrica: { id: string };
      estudiantes: Array<{
        estudiante: { id: string }; estado: string;
        resultadoFinal: { exacto: { numerador: string; denominador: string }; calificacion: string };
        etapas: Array<{
          alcance: string; estado: string;
          promedioEtapa: { exacto: { numerador: string; denominador: string }; presentado: string };
          evaluaciones: Array<{ id: string; calificacionUtilizada: string; procedencia: string; traspaso: { id: string } | null }>;
          evaluadoresPendientes: unknown[];
        }>;
      }>;
    };
    expect(consolidadoFinal.versionRubrica.id).toBe(versionCronogramaId);
    const consolidadoA = consolidadoFinal.estudiantes.find(({ estudiante }) => estudiante.id === estudianteNavegadorUnoId)!;
    const consolidadoB = consolidadoFinal.estudiantes.find(({ estudiante }) => estudiante.id === estudianteNavegadorDosId)!;
    expect(consolidadoA).toMatchObject({
      estado: 'RESULTADO_COMPLETO',
      resultadoFinal: { exacto: { numerador: '9', denominador: '1' }, calificacion: '9.00' },
    });
    expect(consolidadoB).toMatchObject({
      estado: 'RESULTADO_COMPLETO',
      resultadoFinal: { exacto: { numerador: '37', denominador: '4' }, calificacion: '9.25' },
    });
    for (const etapa of [consolidadoA.etapas[0], consolidadoB.etapas[0]]) {
      expect(etapa).toMatchObject({
        alcance: 'TRABAJO_COMPARTIDO', estado: 'COMPLETA',
        promedioEtapa: { exacto: { numerador: '93', denominador: '10' }, presentado: '9.30' },
      });
      expect(etapa.evaluaciones).toHaveLength(2);
      expect(etapa.evaluaciones.map(({ calificacionUtilizada }) => calificacionUtilizada)).toEqual(['9.20', '9.40']);
      expect(etapa.evaluaciones.every(({ procedencia, traspaso }) =>
        procedencia === 'EVALUACION_COMPARTIDA_TRASPASADA' && Boolean(traspaso?.id))).toBe(true);
      expect(new Set(etapa.evaluaciones.map(({ id }) => id)).size).toBe(2);
    }
    expect(consolidadoA.etapas[1]).toMatchObject({
      alcance: 'ESTUDIANTE_INDIVIDUAL', promedioEtapa: { exacto: { numerador: '87', denominador: '10' }, presentado: '8.70' },
    });
    expect(consolidadoB.etapas[1]).toMatchObject({
      alcance: 'ESTUDIANTE_INDIVIDUAL', promedioEtapa: { exacto: { numerador: '46', denominador: '5' }, presentado: '9.20' },
    });
    expect(consolidadoA.etapas[1].evaluaciones.map(({ calificacionUtilizada }) => calificacionUtilizada)).toEqual(['8.50', '8.90']);
    expect(consolidadoB.etapas[1].evaluaciones.map(({ calificacionUtilizada }) => calificacionUtilizada)).toEqual(['9.10', '9.30']);

    const listadoTrabajo = await requestApi('/api/v1/trabajos', 'desarrollo-local');
    expect(listadoTrabajo.status).toBe(200);
    const trabajoEnLista = ((await listadoTrabajo.json()) as { elementos: Array<Record<string, any>> }).elementos
      .find(({ id }) => id === trabajoCiclo12bId);
    expect(trabajoEnLista).toMatchObject({
      id: trabajoCiclo12bId,
      codigo: expediente.codigo,
      idVersionRubrica: versionCronogramaId,
      estudiantes: [{ id: estudianteNavegadorUnoId }, { id: estudianteNavegadorDosId }],
      tutores: [expect.objectContaining({ idDocente: juradoAjenoId })],
      miembrosTribunal: expect.arrayContaining([
        expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[0] }),
        expect.objectContaining({ idMiembroTribunal: miembrosCiclo12bIds[1] }),
      ]),
      programacion: expect.objectContaining({ id: programacion.id, estado: 'FINALIZADA' }),
    });

    const evaluacionesAntesDeDocumentos = await dataSource.query(`
      SELECT id, estado, calificacion_total::text AS "calificacionTotal", revision
      FROM evaluaciones WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCiclo12bId]);
    const puntajesAntesDeDocumentos = await dataSource.query(`
      SELECT puntaje.id_evaluacion AS "idEvaluacion", puntaje.id_indicador AS "idIndicador", puntaje.score::text AS "puntaje"
      FROM calificaciones_evaluacion puntaje
      JOIN evaluaciones evaluacion ON evaluacion.id = puntaje.id_evaluacion
      WHERE evaluacion.id_trabajo = $1 ORDER BY puntaje.id_evaluacion, puntaje.id_indicador
    `, [trabajoCiclo12bId]);
    const auditoriaAntesDeDocumentos = await dataSource.query(`
      SELECT accion, count(*)::int AS total FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1)
      GROUP BY accion ORDER BY accion
    `, [trabajoCiclo12bId]);
    const [traspasosAntesDeDocumentos] = await dataSource.query(`
      SELECT count(*)::int AS total,
             count(DISTINCT id_evaluacion || ':' || id_estudiante)::int AS "origenEstudianteUnico"
      FROM traspasos_evaluacion_estudiante
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1 AND id_estudiante IS NULL)
    `, [trabajoCiclo12bId]);
    expect(traspasosAntesDeDocumentos).toEqual({ total: 4, origenEstudianteUnico: 4 });
    const [conteoCiclo] = await dataSource.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE id_etapa_rubrica = $2)::int AS compartidas,
             count(*) FILTER (WHERE id_etapa_rubrica = $3)::int AS individuales,
             count(*) FILTER (WHERE estado = 'CERRADA')::int AS cerradas
      FROM evaluaciones WHERE id_trabajo = $1
    `, [trabajoCiclo12bId, etapaCronogramaEscrita.id, etapaCronogramaOral.id]);
    expect(conteoCiclo).toEqual({ total: 6, compartidas: 2, individuales: 4, cerradas: 6 });

    for (const [estudianteId, notaEscrita, notaOral] of [
      [estudianteNavegadorUnoId, '9.20', '8.50'],
      [estudianteNavegadorDosId, '9.20', '9.10'],
    ] as Array<[string, string, string]>) {
      for (const [indiceMiembro, miembroId] of miembrosCiclo12bIds.entries()) {
        const base = `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteId}/rubricas/${miembroId}`;
        const detalleRubrica = await requestApi(base, 'jurado-uno');
        expect(detalleRubrica.status).toBe(200);
        const modelo = await detalleRubrica.json() as {
          trabajo: { id: string }; estudiante: { id: string }; evaluador: { id: string };
          rubrica: { rubricVersionId: string; stages: Array<{ id: string; scope: string }> };
          etapas: Array<{ id: string; alcance: string; estado: string; total: string; traspaso: boolean }>;
        };
        expect(modelo).toMatchObject({
          trabajo: { id: trabajoCiclo12bId }, estudiante: { id: estudianteId }, evaluador: { id: miembroId },
          rubrica: { rubricVersionId: versionCronogramaId },
        });
        expect(modelo.rubrica.stages.map(({ scope }) => scope)).toEqual(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);
        expect(modelo.etapas).toMatchObject([
          { id: etapaCronogramaEscrita.id, alcance: 'TRABAJO_COMPARTIDO', estado: 'CERRADA', total: indiceMiembro === 0 ? notaEscrita : '9.40', traspaso: true },
          { id: etapaCronogramaOral.id, alcance: 'ESTUDIANTE_INDIVIDUAL', estado: 'CERRADA', total: indiceMiembro === 0 ? notaOral : estudianteId === estudianteNavegadorUnoId ? '8.90' : '9.30', traspaso: false },
        ]);
        const pdf = await requestApi(`${base}/pdf`, 'jurado-uno');
        const bytes = Buffer.from(await pdf.arrayBuffer());
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get('content-type')).toContain('application/pdf');
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      }
    }

    expect(await dataSource.query(`
      SELECT id, estado, calificacion_total::text AS "calificacionTotal", revision
      FROM evaluaciones WHERE id_trabajo = $1 ORDER BY id
    `, [trabajoCiclo12bId])).toEqual(evaluacionesAntesDeDocumentos);
    expect(await dataSource.query(`
      SELECT puntaje.id_evaluacion AS "idEvaluacion", puntaje.id_indicador AS "idIndicador", puntaje.score::text AS "puntaje"
      FROM calificaciones_evaluacion puntaje
      JOIN evaluaciones evaluacion ON evaluacion.id = puntaje.id_evaluacion
      WHERE evaluacion.id_trabajo = $1 ORDER BY puntaje.id_evaluacion, puntaje.id_indicador
    `, [trabajoCiclo12bId])).toEqual(puntajesAntesDeDocumentos);
    expect(await dataSource.query(`
      SELECT accion, count(*)::int AS total FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1)
      GROUP BY accion ORDER BY accion
    `, [trabajoCiclo12bId])).toEqual(auditoriaAntesDeDocumentos);
    expect(await dataSource.query(`
      SELECT count(*)::int AS total,
             count(DISTINCT id_evaluacion || ':' || id_estudiante)::int AS "origenEstudianteUnico"
      FROM traspasos_evaluacion_estudiante
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1 AND id_estudiante IS NULL)
    `, [trabajoCiclo12bId])).toEqual([traspasosAntesDeDocumentos]);
    expect(await dataSource.query(
      'SELECT estado::text AS estado FROM trabajos_titulacion WHERE id = $1', [trabajoCiclo12bId],
    )).toEqual([estadoTrabajoInicial]);

    const [eventos] = await dataSource.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE accion = 'EVALUACION_CREADA')::int AS creadas,
             count(*) FILTER (WHERE accion = 'PUNTAJES_EVALUACION_REGISTRADOS')::int AS puntajes,
             count(*) FILTER (WHERE accion = 'EVALUACION_CERRADA')::int AS cierres
      FROM eventos_auditoria_evaluacion
      WHERE id_evaluacion IN (SELECT id FROM evaluaciones WHERE id_trabajo = $1)
    `, [trabajoCiclo12bId]);
    expect(eventos).toEqual({ total: 18, creadas: 6, puntajes: 6, cierres: 6 });
    expect(await dataSource.query(`
      SELECT eval.id, eval.id_miembro_tribunal AS "idMiembroTribunal", auditoria.actor_id AS "actorId", auditoria.accion
      FROM eventos_auditoria_evaluacion auditoria
      JOIN evaluaciones eval ON eval.id = auditoria.id_evaluacion
      WHERE eval.id_trabajo = $1 AND auditoria.accion IN ('PUNTAJES_EVALUACION_REGISTRADOS', 'EVALUACION_CERRADA')
        AND ((eval.id_miembro_tribunal = $2 AND auditoria.actor_id <> 'prueba-jurado-uno')
          OR (eval.id_miembro_tribunal = $3 AND auditoria.actor_id <> 'prueba-jurado-dos'))
    `, [trabajoCiclo12bId, miembrosCiclo12bIds[0], miembrosCiclo12bIds[1]])).toEqual([]);

    // Segundo expediente completo, sin programación: la regla actual de emisión
    // no condiciona el acta a una programación de sustentación.
    const trabajoActaSinProgramacionId = await crearTrabajo(
      `10H12C-AUX-${Date.now()}`, versionCronogramaId, [estudianteCuatroId], periodoCronogramaId,
    );
    await dataSource.query(`
      INSERT INTO asignaciones_tutor_trabajo (id_trabajo, id_docente, assigned_by_id_cuenta)
      VALUES ($1, $2, $3)
    `, [trabajoActaSinProgramacionId, juradoAjenoId, cuentaAdminId]);
    const miembrosAuxiliares = await confirmarTribunal(trabajoActaSinProgramacionId, [juradoUnoId, juradoDosId]);
    for (const [indice, principal] of ['jurado-uno', 'jurado-dos'].entries()) {
      const escrita = await crearEvaluacion(trabajoActaSinProgramacionId, principal, etapaCronogramaEscrita);
      expect(escrita.status).toBe(201);
      await puntuarYcerrar(escrita.body, indicadoresCronogramaEscrita, principal,
        indice === 0 ? ['4.50', '4.50'] : ['4.50', '4.50']);
      const oral = await crearEvaluacion(
        trabajoActaSinProgramacionId, principal, etapaCronogramaOral, estudianteCuatroId,
      );
      expect(oral.status).toBe(201);
      await puntuarYcerrar(oral.body, indicadoresCronogramaOral, principal, ['4.50', '4.50']);
    }
    expect(miembrosAuxiliares).toHaveLength(2);
    expect(await dataSource.query(
      'SELECT id FROM programaciones_sustentacion WHERE id_trabajo = $1', [trabajoActaSinProgramacionId],
    )).toEqual([]);
    expect((await requestApi(
      `/api/v1/evaluaciones/trabajos/${trabajoActaSinProgramacionId}/consolidados`, 'jurado-uno',
    )).status).toBe(200);

    const rutaActaCiclo = `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteNavegadorUnoId}/actas`;
    expect((await requestApi('/api/v1/documentos/trabajos/no-es-uuid/estudiantes/no-es-uuid/actas',
      'desarrollo-local', 'POST', { formato: 'PAT-01-F-019' })).status).toBe(400);
    expect((await requestApi(
      '/api/v1/documentos/trabajos/ffffffff-ffff-4fff-8fff-ffffffffffff/estudiantes/22000000-0000-4000-8000-000000000001/actas',
      'desarrollo-local', 'POST', { formato: 'PAT-01-F-019' },
    )).status).toBe(404);
    expect((await requestApi(
      `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteTresId}/actas`,
      'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' },
    )).status).toBe(404);
    expect((await requestApi(rutaActaCiclo, 'emisor-documentos', 'POST', { formato: 'FORMATO-NO-ADMITIDO' })).status)
      .toBe(400);
    expect((await requestApi(
      `/api/v1/documentos/trabajos/${trabajoTribunalNoConfirmadoId}/estudiantes/${estudianteCuatroId}/actas`,
      'desarrollo-local', 'POST', { formato: 'PAT-01-F-019' },
    )).status).toBe(409);

    const [trabajoSinVersionId] = await dataSource.query(`
      INSERT INTO trabajos_titulacion
        (codigo, titulo, id_modalidad, periodo_academico_id, id_carrera, id_version_rubrica, created_by_id_cuenta)
      VALUES ($1, 'Trabajo sin versión de rúbrica', $2, $3, $4, NULL, $5) RETURNING id
    `, [`10H12C-SIN-RUBRICA-${Date.now()}`, modalidadId, periodoCronogramaId, carreraId, cuentaAdminId]);
    await dataSource.query(
      'INSERT INTO estudiantes_trabajo (id_trabajo, id_estudiante, orden_autoria) VALUES ($1, $2, 1)',
      [trabajoSinVersionId.id, estudianteCuatroId],
    );
    await confirmarTribunal(trabajoSinVersionId.id, [juradoUnoId, juradoDosId]);
    expect((await requestApi(
      `/api/v1/documentos/trabajos/${trabajoSinVersionId.id}/estudiantes/${estudianteCuatroId}/actas`,
      'desarrollo-local', 'POST', { formato: 'PAT-01-F-019' },
    )).status).toBe(409);
    expect(await dataSource.query(
      'SELECT * FROM consecutivos_acta WHERE id_carrera = $1 AND periodo = $2', [carreraId, '2026-2'],
    )).toEqual([]);

    const trabajosConActa = [trabajoCiclo12bId, trabajoActaSinProgramacionId];
    const identidadActasAntes = await dataSource.query(`
      SELECT t.id, t.id_version_rubrica AS "idVersionRubrica", t.estado,
             a.id AS "idAsignacion", a.estado AS "estadoTribunal", m.id AS "idMiembro", m.id_docente AS "idDocente", m.position
      FROM trabajos_titulacion t
      JOIN asignaciones_tribunal a ON a.id_trabajo = t.id
      JOIN miembros_tribunal m ON m.id_asignacion = a.id
      WHERE t.id = ANY($1::uuid[]) ORDER BY t.id, m.position
    `, [trabajosConActa]);
    const programacionesAntesDeActas = await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", fecha_programada AS fecha, hora_programada AS hora, sala, estado
      FROM programaciones_sustentacion WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo
    `, [trabajosConActa]);
    const evaluacionesAntesDeActas = await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", estado, calificacion_total::text AS nota, revision
      FROM evaluaciones WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo, id
    `, [trabajosConActa]);
    const puntajesAntesDeActas = await dataSource.query(`
      SELECT p.id_evaluacion AS "idEvaluacion", p.id_indicador AS "idIndicador", p.score::text AS puntaje
      FROM calificaciones_evaluacion p JOIN evaluaciones e ON e.id = p.id_evaluacion
      WHERE e.id_trabajo = ANY($1::uuid[]) ORDER BY e.id_trabajo, p.id_evaluacion, p.id_indicador
    `, [trabajosConActa]);
    const traspasosAntesDeActas = await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", id_evaluacion AS "idEvaluacion", id_estudiante AS "idEstudiante"
      FROM traspasos_evaluacion_estudiante WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo, id_evaluacion, id_estudiante
    `, [trabajosConActa]);
    const auditoriaAntesDeActas = await dataSource.query(`
      SELECT e.id_trabajo AS "idTrabajo", a.id_evaluacion AS "idEvaluacion", a.actor_id AS actor,
             a.accion, a.detalles, a.correlation_id AS "correlationId"
      FROM eventos_auditoria_evaluacion a JOIN evaluaciones e ON e.id = a.id_evaluacion
      WHERE e.id_trabajo = ANY($1::uuid[]) ORDER BY e.id_trabajo, a.id
    `, [trabajosConActa]);
    const consolidadosAntesDeActas = await Promise.all(trabajosConActa.map(async (idTrabajo) => {
      const respuesta = await requestApi(`/api/v1/evaluaciones/trabajos/${idTrabajo}/consolidados`, 'jurado-uno');
      expect(respuesta.status).toBe(200);
      return respuesta.json();
    }));
    const [trabajoCompaneroSinAgenda] = await dataSource.query(`
      SELECT t.codigo, t.titulo, c.nombre AS carrera, m.nombre AS modalidad, p.codigo AS periodo,
             estudiante.nombres AS "nombresEstudiante", estudiante.surnames AS "apellidosEstudiante",
             estudiante.identificacion_nacional AS identificacion, tutor.nombres AS "nombresTutor", tutor.surnames AS "apellidosTutor",
             (SELECT array_agg(persona.nombres || ' ' || persona.surnames ORDER BY miembro.position)
              FROM miembros_tribunal miembro
              JOIN perfiles_docente docente ON docente.id = miembro.id_docente
              JOIN personas persona ON persona.id = docente.id_persona
              JOIN asignaciones_tribunal asignacion ON asignacion.id = miembro.id_asignacion
              WHERE asignacion.id_trabajo = t.id AND asignacion.estado = 'CONFIRMADO') AS "nombresTribunal"
      FROM trabajos_titulacion t
      JOIN carreras c ON c.id = t.id_carrera
      JOIN modalidades m ON m.id = t.id_modalidad
      JOIN periodos_academicos p ON p.id = t.periodo_academico_id
      JOIN estudiantes_trabajo et ON et.id_trabajo = t.id
      JOIN perfiles_estudiante pe ON pe.id = et.id_estudiante
      JOIN personas estudiante ON estudiante.id = pe.id_persona
      JOIN asignaciones_tutor_trabajo at ON at.id_trabajo = t.id AND at.finalizada_en IS NULL
      JOIN perfiles_docente pd ON pd.id = at.id_docente
      JOIN personas tutor ON tutor.id = pd.id_persona
      WHERE t.id = $1
    `, [trabajoActaSinProgramacionId]);

    const solicitudesActa = [
      { trabajoId: trabajoCiclo12bId, estudianteId: estudianteNavegadorUnoId, formato: 'PAT-01-F-019', nota: '9.00' },
      { trabajoId: trabajoCiclo12bId, estudianteId: estudianteNavegadorDosId, formato: 'PAT-04-F-017', nota: '9.25' },
      { trabajoId: trabajoActaSinProgramacionId, estudianteId: estudianteCuatroId, formato: 'PAT-01-F-019', nota: '9.00' },
    ] as const;
    const respuestasActa = await Promise.all(solicitudesActa.map(({ trabajoId, estudianteId, formato }) =>
      requestApi(`/api/v1/documentos/trabajos/${trabajoId}/estudiantes/${estudianteId}/actas`,
        'emisor-documentos', 'POST', { formato })));
    expect(respuestasActa.map(({ status }) => status)).toEqual([201, 201, 201]);
    const actasEmitidas = await Promise.all(respuestasActa.map((respuesta) => respuesta.json() as Promise<any>));
    expect(actasEmitidas.every((acta) => acta.reimpresa === false && acta.notaMinimaAplicada === '7.00' && acta.aprobado === true)).toBe(true);
    expect(actasEmitidas.map(({ numero }) => numero).sort()).toEqual([
      '001-2026-2-SOFT', '002-2026-2-SOFT', '003-2026-2-SOFT',
    ]);

    const actasArchivadasAntesDeReintentar = await dataSource.query(`
      SELECT id, numero, id_trabajo AS "idTrabajo", id_estudiante AS "idEstudiante", formato, revision,
             generado_en AS "generadoEn", generado_por AS "generadoPor", periodo,
             nota_final::text AS "notaFinal", nota_minima_aplicada::text AS "notaMinimaAplicada", aprobado, sha256
      FROM actas_archivadas WHERE id = ANY($1::uuid[]) ORDER BY numero
    `, [actasEmitidas.map(({ id }) => id)]);
    expect(actasArchivadasAntesDeReintentar).toHaveLength(3);
    const pdfsArchivadosPorId = new Map<string, Buffer>();
    for (const [index, solicitud] of solicitudesActa.entries()) {
      const acta = actasEmitidas[index];
      const archivada = actasArchivadasAntesDeReintentar.find((fila: any) => fila.id === acta.id);
      expect(archivada).toMatchObject({
        numero: acta.numero,
        idTrabajo: solicitud.trabajoId,
        idEstudiante: solicitud.estudianteId,
        formato: solicitud.formato,
        periodo: '2026-2',
        notaFinal: solicitud.nota,
        notaMinimaAplicada: '7.00',
        aprobado: true,
        generadoPor: 'prueba-jurado-uno',
      });
      expect(archivada.generadoEn).toBeTruthy();
      expect(archivada.sha256).toMatch(/^[0-9a-f]{64}$/);

      const respuestaDetalle = await requestApi(`/api/v1/documentos/actas/${acta.id}`, 'jurado-uno');
      expect(respuestaDetalle.status).toBe(200);
      expect(await respuestaDetalle.json()).toMatchObject({
        id: acta.id, numero: acta.numero, revision: solicitud.formato === 'PAT-01-F-019' ? 1 : 2,
        sha256: archivada.sha256, notaFinal: solicitud.nota, notaMinimaAplicada: '7.00', aprobado: true,
      });
      const respuestaPdf = await requestApi(`/api/v1/documentos/actas/${acta.id}/pdf`, 'jurado-uno');
      expect(respuestaPdf.status).toBe(200);
      expect(respuestaPdf.headers.get('content-type')).toContain('application/pdf');
      expect(respuestaPdf.headers.get('cache-control')).toContain('no-store');
      const bytesPdf = Buffer.from(await respuestaPdf.arrayBuffer());
      expect(bytesPdf.subarray(0, 5).toString()).toBe('%PDF-');
      pdfsArchivadosPorId.set(acta.id, bytesPdf);
      const [bytesArchivados] = await dataSource.query(
        'SELECT pdf, sha256 FROM actas_archivadas WHERE id = $1', [acta.id],
      );
      expect(bytesPdf).toEqual(bytesArchivados.pdf);
      expect(createHash('sha256').update(bytesPdf).digest('hex')).toBe(archivada.sha256);

      const textoPdf = extraerTextoPdf(bytesPdf);
      const identidadEsperada = solicitud.trabajoId === trabajoActaSinProgramacionId
        ? trabajoCompaneroSinAgenda : null;
      if (identidadEsperada) {
        expect(textoPdf).toContain(identidadEsperada.codigo);
        expect(textoPdf).toContain(identidadEsperada.titulo);
        expect(textoPdf).toContain(identidadEsperada.carrera);
        expect(textoPdf).toContain(identidadEsperada.modalidad);
        expect(textoPdf).toContain(identidadEsperada.nombresEstudiante);
        expect(textoPdf).toContain(identidadEsperada.apellidosEstudiante);
        expect(textoPdf).toContain(identidadEsperada.identificacion);
        expect(textoPdf).toContain(identidadEsperada.nombresTutor);
        expect(textoPdf).toContain(identidadEsperada.apellidosTutor);
        for (const nombreTribunal of identidadEsperada.nombresTribunal as string[]) {
          const normalizarIdentidadPdf = (valor: string) => valor.replace(/[\s·]/g, '');
          expect(normalizarIdentidadPdf(textoPdf)).toContain(normalizarIdentidadPdf(nombreTribunal));
        }
      } else {
        const respuestaContexto = await requestApi(`/api/v1/documentos/trabajos/${trabajoCiclo12bId}`, 'jurado-uno');
        expect(respuestaContexto.status).toBe(200);
        const datosTrabajo = await respuestaContexto.json() as any;
        const estudiante = datosTrabajo.estudiantes.find(({ id }: { id: string }) => id === solicitud.estudianteId);
        expect(textoPdf).toContain(datosTrabajo.trabajo.codigo);
        expect(textoPdf).toContain(datosTrabajo.trabajo.titulo);
        expect(textoPdf).toContain(estudiante.nombres);
        expect(textoPdf).toContain(estudiante.apellidos);
        expect(textoPdf).toContain(estudiante.identificacion);
      }
      expect(textoPdf).toContain(acta.numero);
      expect(textoPdf).toContain(solicitud.nota);
      expect(textoPdf).toContain('ACTA DE CALIFICACI');
      expect(textoPdf).toContain('RESULTADO ACADÉMICO INDIVIDUAL');
      expect(textoPdf).toContain('Etapas de la versión de rúbrica utilizada');
      expect(textoPdf).toContain('espacios de firma');
    }

    const reintentosActa = await Promise.all([0, 1].map(() => requestApi(
      `/api/v1/documentos/trabajos/${trabajoCiclo12bId}/estudiantes/${estudianteNavegadorUnoId}/actas`,
      'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' },
    )));
    expect(reintentosActa.map(({ status }) => status)).toEqual([201, 201]);
    const respuestasReintento = await Promise.all(reintentosActa.map((respuesta) => respuesta.json() as Promise<any>));
    expect(new Set(respuestasReintento.map(({ id }) => id)).size).toBe(1);
    expect(respuestasReintento.every(({ id, numero, reimpresa }) =>
      id === actasEmitidas[0].id && numero === actasEmitidas[0].numero && reimpresa === true)).toBe(true);
    expect(await dataSource.query(
      'SELECT count(*)::int AS total FROM actas_archivadas WHERE id_trabajo = ANY($1::uuid[])', [trabajosConActa],
    )).toEqual([{ total: 3 }]);
    expect(await dataSource.query(`
      SELECT id, numero, id_trabajo AS "idTrabajo", id_estudiante AS "idEstudiante", formato, revision,
             generado_en AS "generadoEn", generado_por AS "generadoPor", periodo,
             nota_final::text AS "notaFinal", nota_minima_aplicada::text AS "notaMinimaAplicada", aprobado, sha256
      FROM actas_archivadas WHERE id = ANY($1::uuid[]) ORDER BY numero
    `, [actasEmitidas.map(({ id }) => id)])).toEqual(actasArchivadasAntesDeReintentar);
    expect(await dataSource.query(
      'SELECT ultimo FROM consecutivos_acta WHERE id_carrera = $1 AND periodo = $2', [carreraId, '2026-2'],
    )).toEqual([{ ultimo: 3 }]);
    const pdfTrasReintento = await requestApi(`/api/v1/documentos/actas/${actasEmitidas[0].id}/pdf`, 'jurado-uno');
    expect(Buffer.from(await pdfTrasReintento.arrayBuffer())).toEqual(pdfsArchivadosPorId.get(actasEmitidas[0].id));
    const listaActas = await requestApi('/api/v1/documentos/actas?carrera=SOFT&periodo=2026-2', 'jurado-uno');
    expect(listaActas.status).toBe(200);
    expect(await listaActas.json()).toEqual(expect.arrayContaining(actasEmitidas.map((acta) =>
      expect.objectContaining({ id: acta.id, numero: acta.numero, carrera: 'Ingeniería en Software', periodo: '2026-2' }))));

    expect(await dataSource.query(`
      SELECT t.id, t.id_version_rubrica AS "idVersionRubrica", t.estado,
             a.id AS "idAsignacion", a.estado AS "estadoTribunal", m.id AS "idMiembro", m.id_docente AS "idDocente", m.position
      FROM trabajos_titulacion t
      JOIN asignaciones_tribunal a ON a.id_trabajo = t.id
      JOIN miembros_tribunal m ON m.id_asignacion = a.id
      WHERE t.id = ANY($1::uuid[]) ORDER BY t.id, m.position
    `, [trabajosConActa])).toEqual(identidadActasAntes);
    expect(await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", fecha_programada AS fecha, hora_programada AS hora, sala, estado
      FROM programaciones_sustentacion WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo
    `, [trabajosConActa])).toEqual(programacionesAntesDeActas);
    expect(await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", estado, calificacion_total::text AS nota, revision
      FROM evaluaciones WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo, id
    `, [trabajosConActa])).toEqual(evaluacionesAntesDeActas);
    expect(await dataSource.query(`
      SELECT p.id_evaluacion AS "idEvaluacion", p.id_indicador AS "idIndicador", p.score::text AS puntaje
      FROM calificaciones_evaluacion p JOIN evaluaciones e ON e.id = p.id_evaluacion
      WHERE e.id_trabajo = ANY($1::uuid[]) ORDER BY e.id_trabajo, p.id_evaluacion, p.id_indicador
    `, [trabajosConActa])).toEqual(puntajesAntesDeActas);
    expect(await dataSource.query(`
      SELECT id, id_trabajo AS "idTrabajo", id_evaluacion AS "idEvaluacion", id_estudiante AS "idEstudiante"
      FROM traspasos_evaluacion_estudiante WHERE id_trabajo = ANY($1::uuid[]) ORDER BY id_trabajo, id_evaluacion, id_estudiante
    `, [trabajosConActa])).toEqual(traspasosAntesDeActas);
    expect(await dataSource.query(`
      SELECT e.id_trabajo AS "idTrabajo", a.id_evaluacion AS "idEvaluacion", a.actor_id AS actor,
             a.accion, a.detalles, a.correlation_id AS "correlationId"
      FROM eventos_auditoria_evaluacion a JOIN evaluaciones e ON e.id = a.id_evaluacion
      WHERE e.id_trabajo = ANY($1::uuid[]) ORDER BY e.id_trabajo, a.id
    `, [trabajosConActa])).toEqual(auditoriaAntesDeActas);
    const consolidadosDespuesDeActas = await Promise.all(trabajosConActa.map(async (idTrabajo) => {
      const respuesta = await requestApi(`/api/v1/evaluaciones/trabajos/${idTrabajo}/consolidados`, 'jurado-uno');
      expect(respuesta.status).toBe(200);
      return respuesta.json();
    }));
    expect(consolidadosDespuesDeActas).toEqual(consolidadosAntesDeActas);
  }, 90000);

  it('crea, consulta, actualiza e imprime programaciones sin alterar evaluaciones y protege conflictos concurrentes', async () => {
    for (const trabajoId of [
      trabajoCronogramaId, trabajoCronogramaConflictoId, trabajoCronogramaConcurrenteId,
      trabajoCronogramaCancelacionId, trabajoCronogramaTrasCancelacionId, trabajoCronogramaCarreraId,
    ]) {
      for (const principal of ['jurado-uno', 'jurado-dos']) {
        const creada = await crearEvaluacion(trabajoId, principal, etapaCronogramaEscrita);
        expect(creada.status).toBe(201);
        await puntuarYcerrar(creada.body, indicadoresCronogramaEscrita, principal);
      }
    }

    const [evaluacionesAntes] = await dataSource.query(`
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'estado', estado, 'calificacion', calificacion_total::text
      ) ORDER BY id) AS filas
      FROM evaluaciones WHERE id_trabajo = $1 AND etapa = 'ESCRITA'
    `, [trabajoCronogramaId]);
    const [estadoTrabajoAntes] = await dataSource.query(
      'SELECT estado FROM trabajos_titulacion WHERE id = $1', [trabajoCronogramaId],
    );

    const trabajosDisponibles = await requestApi('/api/v1/programaciones-sustentacion/trabajos-disponibles', 'administrador');
    expect(trabajosDisponibles.status).toBe(200);
    expect((await trabajosDisponibles.json() as { elementos: Array<{ idTrabajo: string }> }).elementos)
      .toEqual(expect.arrayContaining([expect.objectContaining({ idTrabajo: trabajoCronogramaId })]));

    const fecha = '2026-10-25';
    const crear = (idTrabajo: string, horaProgramada: string, sala: string, fechaProgramada = fecha, duracionEstimadaMinutos?: number) => ({
      idTrabajo, fechaProgramada, horaProgramada, sala,
      ...(duracionEstimadaMinutos === undefined ? {} : { duracionEstimadaMinutos }),
    });
    const fechaCalendarioInvalida = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaId, '10:00', 'Sala 10.7B', '2026-02-30'));
    expect(fechaCalendarioInvalida.status).toBe(400);
    expect((await requestApi('/api/v1/programaciones-sustentacion', 'jurado-uno', 'POST',
      crear(trabajoCronogramaId, '10:00', 'Sala 10.7B'))).status).toBe(403);

    const creada = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaId, '10:00', 'Sala 10.7B'));
    expect(creada.status).toBe(201);
    const programacion = await creada.json() as { id: string; idTrabajo: string; estado: string; duracionEstimadaMinutos: number };
    expect(programacion).toMatchObject({ idTrabajo: trabajoCronogramaId, estado: 'PROGRAMADA', duracionEstimadaMinutos: 60 });

    const duracionInvalida = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaConflictoId, '10:00', 'Sala duración', fecha, 241));
    expect(duracionInvalida.status).toBe(400);

    const duplicada = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaId, '10:00', 'Sala duplicada'));
    expect(duplicada.status).toBe(409);

    const detalle = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador');
    expect(detalle.status).toBe(200);
    expect(await detalle.json()).toMatchObject({ id: programacion.id, estudiantes: [{ id: estudianteTresId }], tribunal: expect.arrayContaining([
      expect.objectContaining({ posicion: 1 }), expect.objectContaining({ posicion: 2 }),
    ]) });

    const filtros = `?carreraId=${carreraId}&periodoId=${periodoCronogramaId}&estado=PROGRAMADA`;
    const listado = await requestApi(`/api/v1/programaciones-sustentacion${filtros}`, 'administrador');
    expect(listado.status).toBe(200);
    expect((await listado.json() as { elementos: Array<{ id: string }> }).elementos)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: programacion.id })]));

    const actualizada = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador', 'PUT', {
      fechaProgramada: '2026-10-26', horaProgramada: '11:00', sala: 'Sala 11', duracionEstimadaMinutos: 90,
    });
    expect(actualizada.status).toBe(200);
    expect(await actualizada.json()).toMatchObject({
      id: programacion.id, fechaProgramada: '2026-10-26', horaProgramada: '11:00', sala: 'Sala 11', duracionEstimadaMinutos: 90,
    });

    const impresion = await requestApi(
      `/api/v1/programaciones-sustentacion/impresion?carreraId=${carreraId}&periodoId=${periodoCronogramaId}&estado=PROGRAMADA`,
      'administrador',
    );
    expect(impresion.status).toBe(200);
    const documento = await impresion.json() as {
      generadoEn: string;
      criterios: { carreraId: string; periodoId: string; estado: string };
      filtros: { carreras: Array<{ id: string }>; periodos: Array<{ id: string }> };
      elementos: Array<{ id: string; fechaProgramada: string; horaProgramada: string; sala: string; duracionEstimadaMinutos: number; trabajo: { titulo: string } }>;
    };
    expect(documento.criterios).toEqual({ carreraId, periodoId: periodoCronogramaId, estado: 'PROGRAMADA', buscar: null });
    expect(documento.filtros.carreras).toEqual(expect.arrayContaining([expect.objectContaining({ id: carreraId })]));
    expect(documento.elementos).toEqual(expect.arrayContaining([expect.objectContaining({
      id: programacion.id, fechaProgramada: '2026-10-26', horaProgramada: '11:00', sala: 'Sala 11',
      duracionEstimadaMinutos: 90,
      trabajo: expect.objectContaining({ titulo: expect.any(String) }),
    })]));

    const evaluacionOral = await crearEvaluacion(trabajoCronogramaId, 'jurado-uno', etapaCronogramaOral, estudianteTresId);
    expect(evaluacionOral.status).toBe(201);
    const cambioTrasInicioOral = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador', 'PUT', {
      fechaProgramada: '2026-10-27', horaProgramada: '11:00', sala: 'Sala 12',
    });
    expect(cambioTrasInicioOral.status).toBe(409);

    const conflictoSala = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaConflictoId, '11:00', ' sala 11 ', '2026-10-26'));
    expect(conflictoSala.status).toBe(409);
    expect(await dataSource.query(
      'SELECT id FROM programaciones_sustentacion WHERE id_trabajo = $1', [trabajoCronogramaConflictoId],
    )).toEqual([]);

    const solapamientoParcial = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaConflictoId, '11:30', 'Sala 11', '2026-10-26'));
    expect(solapamientoParcial.status).toBe(409);

    const mismoEspacioOtroHorario = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaConflictoId, '12:30', 'Sala 11', '2026-10-26', 40));
    expect(mismoEspacioOtroHorario.status).toBe(201);
    expect(await mismoEspacioOtroHorario.json()).toMatchObject({ duracionEstimadaMinutos: 40 });

    const otroEspacio = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaConcurrenteId, '11:30', 'Sala 12', '2026-10-26', 40));
    expect(otroEspacio.status).toBe(201);
    const detalleOtraSala = await otroEspacio.json() as { id: string };
    const actualizacionEnConflicto = await requestApi(`/api/v1/programaciones-sustentacion/${detalleOtraSala.id}`, 'administrador', 'PUT', {
      fechaProgramada: '2026-10-26', horaProgramada: '11:30', sala: ' sala 11 ', duracionEstimadaMinutos: 40,
    });
    expect(actualizacionEnConflicto.status).toBe(409);

    const horarioConsecutivo = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaCancelacionId, '13:10', 'Sala 11', '2026-10-26'));
    expect(horarioConsecutivo.status).toBe(201);

    const cancelar = await requestApi(`/api/v1/programaciones-sustentacion/${(await horarioConsecutivo.json() as { id: string }).id}/estado`, 'administrador', 'PATCH', {
      estado: 'CANCELADA',
    });
    expect(cancelar.status).toBe(200);
    expect(await cancelar.json()).toMatchObject({ estado: 'CANCELADA' });
    const salaLiberada = await requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
      crear(trabajoCronogramaTrasCancelacionId, '13:30', 'Sala 11', '2026-10-26'));
    expect(salaLiberada.status).toBe(201);

    const estadosSinPermiso = await requestApi(`/api/v1/programaciones-sustentacion/${detalleOtraSala.id}/estado`, 'jurado-uno', 'PATCH', {
      estado: 'CANCELADA',
    });
    expect(estadosSinPermiso.status).toBe(403);

    const inicioNoPermitido = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}/estado`, 'administrador', 'PATCH', {
      estado: 'FINALIZADA',
    });
    expect(inicioNoPermitido.status).toBe(409);
    const iniciada = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}/estado`, 'administrador', 'PATCH', {
      estado: 'EN_SUSTENTACION',
    });
    expect(iniciada.status).toBe(200);
    const datosInicio = await iniciada.json() as { estado: string; inicioRealEn: string; finalizacionRealEn: string | null; duracionEstimadaMinutos: number };
    expect(datosInicio).toMatchObject({ estado: 'EN_SUSTENTACION', duracionEstimadaMinutos: 90, finalizacionRealEn: null });
    expect(typeof datosInicio.inicioRealEn).toBe('string');

    const cambioDuranteSustentacion = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}`, 'administrador', 'PUT', {
      fechaProgramada: '2026-10-27', horaProgramada: '11:00', sala: 'Sala 12',
    });
    expect(cambioDuranteSustentacion.status).toBe(409);

    const finalizada = await requestApi(`/api/v1/programaciones-sustentacion/${programacion.id}/estado`, 'administrador', 'PATCH', {
      estado: 'FINALIZADA',
    });
    expect(finalizada.status).toBe(200);
    const datosFinales = await finalizada.json() as { estado: string; inicioRealEn: string; finalizacionRealEn: string; duracionEstimadaMinutos: number };
    expect(datosFinales).toMatchObject({ estado: 'FINALIZADA', duracionEstimadaMinutos: 90 });
    expect(datosFinales.finalizacionRealEn).toBeTruthy();

    const impresionFinalizada = await requestApi('/api/v1/programaciones-sustentacion/impresion?estado=COMPLETADA', 'administrador');
    expect(impresionFinalizada.status).toBe(200);
    const cronogramaImpreso = await impresionFinalizada.json() as {
      criterios: { estado: string };
      elementos: Array<{ id: string; duracionEstimadaMinutos: number; inicioRealEn: string; finalizacionRealEn: string }>;
    };
    expect(cronogramaImpreso.criterios.estado).toBe('FINALIZADA');
    expect(cronogramaImpreso.elementos).toEqual(expect.arrayContaining([expect.objectContaining({
      id: programacion.id,
      duracionEstimadaMinutos: 90,
      inicioRealEn: expect.any(String),
      finalizacionRealEn: expect.any(String),
    })]));

    const carreraEnParalelo = await Promise.all([
      requestApi(`/api/v1/programaciones-sustentacion/${detalleOtraSala.id}`, 'administrador', 'PUT', {
        fechaProgramada: '2026-10-26', horaProgramada: '16:00', sala: 'Sala carrera', duracionEstimadaMinutos: 60,
      }),
      requestApi('/api/v1/programaciones-sustentacion', 'administrador', 'POST',
        crear(trabajoCronogramaCarreraId, '16:00', 'Sala carrera', '2026-10-26')),
    ]);
    expect(carreraEnParalelo.map(({ status }) => status).sort()).toContain(409);
    expect(carreraEnParalelo.filter(({ status }) => status === 200 || status === 201)).toHaveLength(1);

    const [evaluacionesDespues] = await dataSource.query(`
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'estado', estado, 'calificacion', calificacion_total::text
      ) ORDER BY id) AS filas
      FROM evaluaciones WHERE id_trabajo = $1 AND etapa = 'ESCRITA'
    `, [trabajoCronogramaId]);
    const [estadoTrabajoDespues] = await dataSource.query(
      'SELECT estado FROM trabajos_titulacion WHERE id = $1', [trabajoCronogramaId],
    );
    expect(evaluacionesDespues.filas).toEqual(evaluacionesAntes.filas);
    expect(estadoTrabajoDespues.estado).toBe(estadoTrabajoAntes.estado);
  }, 60000);
  it('configura el umbral y genera actas internas con resultados /10, reimpresión e inmutabilidad', async () => {
    const carreraActas = await dataSource.getRepository(Carrera).save({ codigo: 'TI', nombre: 'Carrera fixture de documentos', estaActivo: true });
    const periodoActas2026 = await dataSource.getRepository(PeriodoAcademico).findOneByOrFail({ codigo: '2026-2' });
    const periodoActas2027 = await dataSource.getRepository(PeriodoAcademico).save({ codigo: '2027-1', estaActivo: true });
    const versionMixtaResponse = await requestApi('/api/v1/rubricas/completas', 'administrador', 'POST', {
      modalidadId, periodoId: periodoActas2026.id, nombre: 'Rúbrica interna de actas 10.8B', version: `10.8B-MIX-${Date.now()}`,
      etapas: [
        etapaDto('INFORME', 'Etapa compartida de informe', 1, 'TRABAJO_COMPARTIDO'),
        etapaDto('DEFENSA', 'Etapa individual personalizada', 2, 'ESTUDIANTE_INDIVIDUAL'),
        etapaDto('ANEXOS', 'Etapa compartida de anexos', 3, 'TRABAJO_COMPARTIDO'),
      ],
      carreras: [{ carreraId: carreraActas.id, revision: carreraActas.revision, vigente: true, vigenciaEsperada: { versionId: null } }],
    });
    expect(versionMixtaResponse.status).toBe(201);
    const versionMixta = await versionMixtaResponse.json() as { id: string; etapas: EtapaApi[] };
    const indicadoresMixtos: IndicadorApi[][] = [];
    for (const etapa of versionMixta.etapas) {
      indicadoresMixtos.push(await dataSource.query(`
        SELECT i.id, i.calificacion_maxima AS "calificacionMaxima" FROM indicadores_rubrica i
        JOIN categorias_rubrica c ON c.id=i.id_categoria WHERE c.id_etapa_rubrica=$1 ORDER BY i.orden
      `, [etapa.id]));
    }
    const estudiantesActas = [estudianteReferenciaUnoId, estudianteReferenciaDosId];
    const trabajoActas = await crearTrabajo('DOC-10H8B-MIXTA', versionMixta.id, estudiantesActas, periodoActas2026.id, carreraActas.id);
    await confirmarTribunal(trabajoActas, [juradoUnoId, juradoDosId]);
    const contextoIncompleto = await requestApi(`/api/v1/documentos/trabajos/${trabajoActas}`, 'emisor-documentos');
    expect(contextoIncompleto.status).toBe(200);
    expect((await contextoIncompleto.json() as any).actas.every((a: any) => a.puedeEmitir === false
      && a.estadoConsolidacion === 'SIN_EVALUACIONES' && a.pendientes.length > 0)).toBe(true);
    const actaIncompleta = await requestApi(`/api/v1/documentos/trabajos/${trabajoActas}/estudiantes/${estudiantesActas[0]}/actas`,
      'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' });
    expect(actaIncompleta.status).toBe(409);
    expect((await actaIncompleta.json() as any).details.join(' ')).toContain('No hay evaluaciones dinámicas');
    const notasCompartidas = [
      [['4.05', '4.06'], ['4.10', '4.11']],
      [['4.65', '4.65'], ['4.70', '4.70']],
    ];
    for (const [indiceEtapa, etapa] of [versionMixta.etapas[0], versionMixta.etapas[2]].entries()) {
      for (const [indiceEvaluador, principal] of ['jurado-uno', 'jurado-dos'].entries()) {
        const creada = await crearEvaluacion(trabajoActas, principal, etapa);
        expect(creada.status).toBe(201);
        const cerrada = await puntuarYcerrar(creada.body, indicadoresMixtos[indiceEtapa * 2], principal, notasCompartidas[indiceEtapa][indiceEvaluador]);
        expect(cerrada.estado).toBe('CERRADA');
        expect(cerrada.estudiantesTraspasados).toHaveLength(2);
      }
    }
    for (const [indiceEstudiante, estudianteId] of estudiantesActas.entries()) {
      for (const [indiceEvaluador, principal] of ['jurado-uno', 'jurado-dos'].entries()) {
        const creada = await crearEvaluacion(trabajoActas, principal, versionMixta.etapas[1], estudianteId);
        expect(creada.status).toBe(201);
        const notas = indiceEstudiante === 0
          ? indiceEvaluador === 0 ? ['4.25', '4.25'] : ['4.45', '4.45']
          : indiceEvaluador === 0 ? ['4.55', '4.55'] : ['4.65', '4.65'];
        expect((await puntuarYcerrar(creada.body, indicadoresMixtos[1], principal, notas)).estado).toBe('CERRADA');
      }
    }
    const resultadoActas = await requestApi(`/api/v1/evaluaciones/trabajos/${trabajoActas}/consolidados`, 'jurado-uno');
    expect(resultadoActas.status).toBe(200);
    const consolidadoActas = await resultadoActas.json() as any;
    expect(consolidadoActas.estudiantes.map((e: any) => e.resultadoFinal.calificacion)).toEqual(['8.74', '8.90']);
    expect(consolidadoActas.estudiantes[0].etapas.map((e: any) => e.alcance)).toEqual([
      'TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL', 'TRABAJO_COMPARTIDO',
    ]);

    const versionIndividualResponse = await requestApi('/api/v1/rubricas/completas', 'administrador', 'POST', {
      modalidadId, periodoId: periodoActas2027.id, nombre: 'Rúbrica de umbral de actas 10.8B', version: `10.8B-IND-${Date.now()}`,
      etapas: [etapaDto('UNICA', 'Etapa única personalizada', 1, 'ESTUDIANTE_INDIVIDUAL')],
      carreras: [{ carreraId: carreraActas.id, revision: carreraActas.revision, vigente: true, vigenciaEsperada: { versionId: null } }],
    });
    expect(versionIndividualResponse.status).toBe(201);
    const versionIndividualActa = await versionIndividualResponse.json() as { id: string; etapas: EtapaApi[] };
    const indicadoresIndividualesActa = await dataSource.query(`
      SELECT i.id, i.calificacion_maxima AS "calificacionMaxima" FROM indicadores_rubrica i
      JOIN categorias_rubrica c ON c.id=i.id_categoria WHERE c.id_etapa_rubrica=$1 ORDER BY i.orden
    `, [versionIndividualActa.etapas[0].id]) as IndicadorApi[];
    const trabajoNota699 = await crearTrabajo('DOC-NOTA-699', versionIndividualActa.id, [estudianteUnoId], periodoActas2027.id, carreraActas.id);
    await confirmarTribunal(trabajoNota699, [juradoUnoId, juradoDosId]);
    for (const principal of ['jurado-uno', 'jurado-dos'] as const) {
      const creada = await crearEvaluacion(trabajoNota699, principal, versionIndividualActa.etapas[0], estudianteUnoId);
      expect(creada.status).toBe(201);
      expect((await puntuarYcerrar(creada.body, indicadoresIndividualesActa, principal, ['3.49', '3.50'])).calificacionTotal).toBe('6.99');
    }
    const trabajoNota700 = await crearTrabajo('DOC-NOTA-700', versionIndividualActa.id, [estudianteDosId], periodoActas2027.id, carreraActas.id);
    await confirmarTribunal(trabajoNota700, [juradoUnoId, juradoDosId]);
    for (const principal of ['jurado-uno', 'jurado-dos'] as const) {
      const creada = await crearEvaluacion(trabajoNota700, principal, versionIndividualActa.etapas[0], estudianteDosId);
      expect(creada.status).toBe(201);
      expect((await puntuarYcerrar(creada.body, indicadoresIndividualesActa, principal, ['3.50', '3.50'])).calificacionTotal).toBe('7.00');
    }
    const [actasAntesDeEstaPrueba] = await dataSource.query('SELECT count(*)::int AS total FROM actas_archivadas');
    const auditoriaAntes = await dataSource.query('SELECT * FROM eventos_auditoria_evaluacion ORDER BY id');
    const evaluacionesAntes = await dataSource.query('SELECT * FROM evaluaciones ORDER BY id');
    const trabajosAntes = await dataSource.query('SELECT id,estado FROM trabajos_titulacion ORDER BY id');
    expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', undefined)).status).toBe(401);
    expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', 'denegado')).status).toBe(403);
    const configInicial = await requestApi('/api/v1/documentos/configuracion/nota-minima', 'jurado-uno');
    expect(configInicial.status).toBe(200);
    expect(await configInicial.json()).toMatchObject({ notaMinima: '7.00', provisional: true, puedeEditar: false });
    expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', 'jurado-uno', 'PUT', { notaMinima: '8.75' })).status).toBe(403);
    expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '10.01' })).status).toBe(400);
    expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '8.75', notaFinal: '10.00' })).status).toBe(400);
    const configurada = await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '8.75' });
    expect(configurada.status).toBe(200);
    expect(await configurada.json()).toMatchObject({ notaMinima: '8.75', provisional: true, cambio: true });
    expect(await dataSource.query('SELECT valor::text AS valor, actualizado_por FROM configuracion_nota_minima WHERE id=1'))
      .toEqual([{ valor: '8.75', actualizado_por: 'prueba-admin-evaluaciones' }]);
    expect(await dataSource.query('SELECT valor_anterior::text AS anterior,valor_nuevo::text AS nuevo,cambiado_por FROM historial_nota_minima ORDER BY id'))
      .toEqual([
        { anterior: null, nuevo: '7.00', cambiado_por: 'sistema:valor-inicial' },
        { anterior: '7.00', nuevo: '8.75', cambiado_por: 'prueba-admin-evaluaciones' },
      ]);
    await expect(dataSource.query('UPDATE historial_nota_minima SET valor_nuevo=9 WHERE id=1')).rejects.toThrow();
    await dataSource.query(`CREATE FUNCTION probar_fallo_historial_umbral() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fallo transaccional sintético'; END $$`);
    await dataSource.query(`CREATE TRIGGER probar_fallo_historial_umbral BEFORE INSERT ON historial_nota_minima
      FOR EACH ROW EXECUTE FUNCTION probar_fallo_historial_umbral()`);
    try {
      expect((await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '8.80' })).status).toBe(500);
      expect(await dataSource.query('SELECT valor::text FROM configuracion_nota_minima WHERE id=1')).toEqual([{ valor: '8.75' }]);
      expect(await dataSource.query('SELECT count(*)::int AS total FROM historial_nota_minima')).toEqual([{ total: 2 }]);
    } finally {
      await dataSource.query('DROP TRIGGER probar_fallo_historial_umbral ON historial_nota_minima');
      await dataSource.query('DROP FUNCTION probar_fallo_historial_umbral()');
    }

    const rutaTrabajo = `/api/v1/documentos/trabajos/${trabajoActas}`;
    expect((await requestApi(rutaTrabajo, undefined)).status).toBe(401);
    expect((await requestApi(rutaTrabajo, 'jurado-ajeno')).status).toBe(404);
    const contextoEmisor = await requestApi(rutaTrabajo, 'emisor-documentos');
    expect(contextoEmisor.status).toBe(200);
    const contexto = await contextoEmisor.json() as any;
    expect(contexto.notaMinimaProvisional).toBe('8.75');
    expect(contexto.actas.map((a: any) => [a.calificacionFinal, a.aprobadoProvisional, a.puedeEmitir])).toEqual([
      ['8.74', false, true], ['8.90', true, true],
    ]);
    expect((await requestApi(rutaTrabajo, 'jurado-uno')).status).toBe(200);
    for (const e of contexto.estudiantes) for (const m of contexto.evaluadores) {
      const base = `${rutaTrabajo}/estudiantes/${e.id}/rubricas/${m.id}`;
      const respuesta = await requestApi(base, 'jurado-uno');
      expect(respuesta.status).toBe(200);
      const modelo = await respuesta.json() as any;
      expect(modelo.estudiante.id).toBe(e.id);
      expect(modelo.evaluador.id).toBe(m.id);
      for (const etapa of modelo.etapas) {
        if (etapa.estado === 'CERRADA') {
          const [origen] = await dataSource.query('SELECT calificacion_total::text AS nota FROM evaluaciones WHERE id=$1', [etapa.evaluacionId]);
          expect(etapa.total).toBe(origen.nota);
          if (etapa.alcance === 'TRABAJO_COMPARTIDO') expect(etapa.traspaso).toBe(true);
        }
      }
      const pdfRubrica = await requestApi(`${base}/pdf`, 'jurado-uno');
      expect(pdfRubrica.status).toBe(200);
      expect(Buffer.from(await pdfRubrica.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    }

    const rutaEstudianteUno = `${rutaTrabajo}/estudiantes/${estudiantesActas[0]}/actas`;
    const rutaEstudianteDos = `${rutaTrabajo}/estudiantes/${estudiantesActas[1]}/actas`;
    expect((await requestApi(rutaEstudianteUno, 'jurado-uno', 'POST', { formato: 'PAT-01-F-019' })).status).toBe(403);
    expect((await requestApi(rutaEstudianteUno, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019', notaFinal: '10.00' })).status).toBe(400);
    const concurrenciaMismaActa = await Promise.all([
      requestApi(rutaEstudianteUno, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' }),
      requestApi(rutaEstudianteUno, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' }),
    ]);
    expect(concurrenciaMismaActa.map(({ status }) => status)).toEqual([201, 201]);
    const actasRepetidas = await Promise.all(concurrenciaMismaActa.map((respuesta) => respuesta.json() as Promise<any>));
    expect(new Set(actasRepetidas.map(({ id }) => id)).size).toBe(1);
    expect(actasRepetidas.map(({ reimpresa }) => reimpresa).sort()).toEqual([false, true]);
    expect(actasRepetidas.every((a) => a.numero === '001-2026-2-TI' && a.notaFinal === '8.74' && a.notaMinimaAplicada === '8.75' && a.aprobado === false)).toBe(true);
    const actaEscrita = actasRepetidas[0];
    const respuestaActaOral = await requestApi(rutaEstudianteUno, 'emisor-documentos', 'POST', { formato: 'PAT-04-F-017' });
    expect(respuestaActaOral.status).toBe(201);
    const actaOral = await respuestaActaOral.json() as any;
    expect(actaOral).toMatchObject({ numero: '002-2026-2-TI', notaFinal: '8.74', notaMinimaAplicada: '8.75', aprobado: false });
    const actaEstudianteDos = await requestApi(rutaEstudianteDos, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' });
    expect(actaEstudianteDos.status).toBe(201);
    expect(await actaEstudianteDos.json()).toMatchObject({ numero: '003-2026-2-TI', notaFinal: '8.90', notaMinimaAplicada: '8.75', aprobado: true });

    const actaLocal = await requestApi(rutaEstudianteUno, 'desarrollo-local', 'POST', { formato: 'PAT-01-F-019' });
    expect(actaLocal.status).toBe(201);
    expect(await actaLocal.json()).toMatchObject({ id: actasRepetidas[0].id, numero: '001-2026-2-TI', reimpresa: true });

    const umbralRestaurado = await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '7.00' });
    expect(umbralRestaurado.status).toBe(200);
    const nota699 = await requestApi(`/api/v1/documentos/trabajos/${trabajoNota699}/estudiantes/${estudianteUnoId}/actas`, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' });
    expect(nota699.status).toBe(201);
    expect(await nota699.json()).toMatchObject({ numero: '001-2027-1-TI', notaFinal: '6.99', notaMinimaAplicada: '7.00', aprobado: false });
    const nota700 = await requestApi(`/api/v1/documentos/trabajos/${trabajoNota700}/estudiantes/${estudianteDosId}/actas`, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' });
    expect(nota700.status).toBe(201);
    expect(await nota700.json()).toMatchObject({ numero: '002-2027-1-TI', notaFinal: '7.00', notaMinimaAplicada: '7.00', aprobado: true });
    const umbralFuturo = await requestApi('/api/v1/documentos/configuracion/nota-minima', 'administrador', 'PUT', { notaMinima: '10.00' });
    expect(umbralFuturo.status).toBe(200);

    for (const acta of [actaEscrita, actaOral]) {
      const detalle = await requestApi(`/api/v1/documentos/actas/${acta.id}`, 'jurado-uno');
      expect(await detalle.json()).toMatchObject({ numero: acta.numero, notaFinal: '8.74', notaMinimaAplicada: '8.75', aprobado: false });
      const pdfAntes = await requestApi(`/api/v1/documentos/actas/${acta.id}/pdf`, 'jurado-uno');
      const bytesAntes = Buffer.from(await pdfAntes.arrayBuffer());
      expect(pdfAntes.status).toBe(200); expect(bytesAntes.subarray(0, 5).toString()).toBe('%PDF-');
      const repetir = await requestApi(rutaEstudianteUno, 'emisor-documentos', 'POST', { formato: acta.formato });
      expect(await repetir.json()).toMatchObject({ id: acta.id, numero: acta.numero, reimpresa: true, notaMinimaAplicada: '8.75' });
      const pdfDespues = await requestApi(`/api/v1/documentos/actas/${acta.id}/pdf`, 'jurado-uno');
      expect(Buffer.from(await pdfDespues.arrayBuffer())).toEqual(bytesAntes);
    }
    expect((await requestApi(`/api/v1/documentos/trabajos/${trabajoCronogramaId}/estudiantes/${estudianteTresId}/actas`, 'emisor-documentos', 'POST', { formato: 'PAT-04-F-017' })).status).toBe(409);
    expect((await requestApi(`/api/v1/documentos/trabajos/${trabajoActas}/estudiantes/${estudianteTresId}/actas`, 'emisor-documentos', 'POST', { formato: 'PAT-01-F-019' })).status).toBe(404);

    expect(await dataSource.query('SELECT * FROM evaluaciones ORDER BY id')).toEqual(evaluacionesAntes);
    expect(await dataSource.query('SELECT id,estado FROM trabajos_titulacion ORDER BY id')).toEqual(trabajosAntes);
    expect(await dataSource.query('SELECT * FROM eventos_auditoria_evaluacion ORDER BY id')).toEqual(auditoriaAntes);
    expect(await dataSource.query('SELECT count(*)::int AS total FROM actas_archivadas')).toEqual([
      { total: actasAntesDeEstaPrueba.total + 5 },
    ]);
    expect(await dataSource.query('SELECT nota_final::text AS nota,nota_minima_aplicada::text AS umbral,aprobado FROM actas_archivadas WHERE id=$1', [actaEscrita.id]))
      .toEqual([{ nota: '8.74', umbral: '8.75', aprobado: false }]);
    await expect(dataSource.query('UPDATE actas_archivadas SET nota_minima_aplicada=1 WHERE id=$1', [actaEscrita.id])).rejects.toThrow();
    await expect(dataSource.query('DELETE FROM actas_archivadas WHERE id=$1', [actaEscrita.id])).rejects.toThrow();
  }, 90000);
  it('lectura documental concurrente con cierre mantiene una instantánea coherente', async () => {
    const [vigente] = await dataSource.query('SELECT id_version_rubrica AS id FROM trabajos_titulacion WHERE id=$1', [trabajoCronogramaId]);
    const id = await crearTrabajo('DOC-LECTURA-CONCURRENTE', vigente.id, [estudianteUnoId], periodoCronogramaId);
    const miembros = await confirmarTribunal(id, [juradoUnoId, juradoDosId]);
    const etapa = etapaCronogramaEscrita;
    const evaluacion = await crearEvaluacion(id, 'jurado-uno', etapa,
      etapa.alcance === 'ESTUDIANTE_INDIVIDUAL' ? estudianteUnoId : undefined);
    expect(evaluacion.status).toBe(201);
    const ruta = `/api/v1/documentos/trabajos/${id}/estudiantes/${estudianteUnoId}/rubricas/${miembros[0]}`;
    const [lectura, evaluacionCerrada] = await Promise.all([
      requestApi(ruta, 'jurado-uno'),
      puntuarYcerrar(evaluacion.body, indicadoresCronogramaEscrita, 'jurado-uno'),
    ]);
    expect(lectura.status).toBe(200);
    const documento = await lectura.json() as any;
    const componente = documento.etapas.find((e: any) => e.id === etapa.id);
    if (componente.estado === 'CERRADA') expect(componente.total).toBe(evaluacionCerrada.calificacionTotal);
    else expect(componente.total).toBeNull();
    const despues = await (await requestApi(ruta, 'jurado-uno')).json() as any;
    expect(despues.etapas.find((e: any) => e.id === etapa.id)).toMatchObject({
      estado: 'CERRADA', total: evaluacionCerrada.calificacionTotal,
    });
  }, 60000);

  it('archivo sintético: consecutivos concurrentes, idempotencia, snapshots y restricciones de inmutabilidad', async () => {
    const [{ id: carreraTi }] = await dataSource.query(`SELECT id FROM carreras WHERE codigo='TI'`);
    const [{ id: carreraSoft }] = await dataSource.query(`SELECT id FROM carreras WHERE codigo='SOFT'`);
    const periodos = await dataSource.query(`INSERT INTO periodos_academicos(codigo) VALUES ('2028-2'),('2029-1') RETURNING id,codigo`);
    const pdfFixture = Buffer.from('%PDF-1.4\nFixture técnico de archivo, no acta académica real\n%%EOF');
    const preparar = async (carrera: any, periodo: any, indice: number) => {
      const [t] = await dataSource.query(`INSERT INTO trabajos_titulacion(codigo,titulo,id_modalidad,periodo_academico_id,id_carrera,created_by_id_cuenta)
        VALUES ($1,'Fixture documental sin evaluaciones',$2,$3,$4,$5) RETURNING id`, [`DOC-${indice}`,modalidadId,periodo.id,carrera.id,cuentaAdminId]);
      await dataSource.query('INSERT INTO estudiantes_trabajo(id_trabajo,id_estudiante,orden_autoria) VALUES ($1,$2,1)',[t.id,estudianteUnoId]);
      await confirmarTribunal(t.id,[juradoUnoId,juradoDosId]);
      return { trabajoId:t.id,estudianteId:estudianteUnoId,carreraId:carrera.id,periodoId:periodo.id,periodo:periodo.codigo,
        carreraCodigo:carrera.codigo,actor:'fixture-documental',formato:'PAT-01-F-019' as const,
        notaFinal:'9.00',notaMinimaAplicada:'7.00',aprobado:true };
    };
    const ti = { id: carreraTi, codigo: 'TI' };
    const soft = { id: carreraSoft, codigo: 'SOFT' };
    const p1 = periodos.find((p: any) => p.codigo==='2028-2');
    const p2 = periodos.find((p: any) => p.codigo==='2029-1');
    const datos = await preparar(ti,p1,1);
    const datosFallidos = await preparar(ti,p1,99);
    const contadorAntesFalloRender = await dataSource.query('SELECT * FROM consecutivos_acta ORDER BY id_carrera,periodo');
    await expect(dataSource.transaction((m) => archivarActaEn(m,datosFallidos,async () => { throw new Error('fallo sintético de render'); })))
      .rejects.toThrow('fallo sintético de render');
    expect(await dataSource.query('SELECT * FROM consecutivos_acta ORDER BY id_carrera,periodo')).toEqual(contadorAntesFalloRender);
    expect(await dataSource.query('SELECT id FROM actas_archivadas WHERE id_trabajo=$1', [datosFallidos.trabajoId])).toEqual([]);
    const resultados = await Promise.all([
      dataSource.transaction((m) => archivarActaEn(m,datos,async () => pdfFixture)),
      dataSource.transaction((m) => archivarActaEn(m,{...datos,formato:'PAT-04-F-017'},async () => pdfFixture)),
    ]);
    expect(resultados.map((r) => r.numero).sort()).toEqual(['001-2028-2-TI','002-2028-2-TI']);
    expect(resultados.every((r) => r.notaFinal === '9.00' && r.notaMinimaAplicada === '7.00' && r.aprobado)).toBe(true);
    const nuevoPeriodo = await preparar(ti,p2,2);
    const nuevaCarrera = await preparar(soft,p1,3);
    expect((await dataSource.transaction((m) => archivarActaEn(m,nuevoPeriodo,async () => pdfFixture))).numero).toBe('001-2029-1-TI');
    expect((await dataSource.transaction((m) => archivarActaEn(m,nuevaCarrera,async () => pdfFixture))).numero).toBe('001-2028-2-SOFT');
    const renderRepetido = jest.fn(async () => pdfFixture);
    const reimpresa = await dataSource.transaction((m) => archivarActaEn(m,datos,renderRepetido));
    expect(reimpresa).toMatchObject({ id: resultados[0].id, numero: resultados[0].numero, reimpresa: true });
    expect(renderRepetido).not.toHaveBeenCalled();
    const contadorAntes = await dataSource.query('SELECT * FROM consecutivos_acta ORDER BY id_carrera,periodo');
    for (let vez=0;vez<2;vez++) {
      const pdf = await requestApi(`/api/v1/documentos/actas/${resultados[0].id}/pdf`,'jurado-uno');
      expect(pdf.status).toBe(200); expect(Buffer.from(await pdf.arrayBuffer())).toEqual(pdfFixture);
      const detalle = await requestApi(`/api/v1/documentos/actas/${resultados[0].id}`,'jurado-uno');
      expect(await detalle.json()).toMatchObject({ numero: resultados[0].numero, notaFinal: '9.00', notaMinimaAplicada: '7.00', aprobado: true });
    }
    expect((await requestApi(`/api/v1/documentos/actas/${resultados[0].id}/pdf`,'jurado-ajeno')).status).toBe(404);
    expect(await dataSource.query('SELECT * FROM consecutivos_acta ORDER BY id_carrera,periodo')).toEqual(contadorAntes);
    await expect(dataSource.query('UPDATE actas_archivadas SET numero=$1 WHERE id=$2',['999-2028-2-TI',resultados[0].id])).rejects.toThrow();
    await expect(dataSource.query('DELETE FROM actas_archivadas WHERE id=$1',[resultados[0].id])).rejects.toThrow();
    await expect(dataSource.query('TRUNCATE actas_archivadas')).rejects.toThrow();
    await expect(dataSource.transaction((m) => archivarActaEn(m,{...datos,notaFinal:'10.01'},async () => pdfFixture))).rejects.toThrow();
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

function referenciaFinalDesdeEtapas(etapas: string[][]): { numerador: string; denominador: string; calificacion: string } {
  const participantesPorEtapa = BigInt(etapas[0]?.length ?? 0);
  if (!participantesPorEtapa || etapas.some(({ length }) => BigInt(length) !== participantesPorEtapa)) {
    throw new Error('La referencia requiere la misma cantidad de evaluadores en cada etapa.');
  }
  const totalCentimos = etapas.flat().reduce((suma, valor) => {
    const [entero, fraccion] = valor.split('.');
    return suma + BigInt(entero) * 100n + BigInt((fraccion ?? '').padEnd(2, '0'));
  }, 0n);
  const divisorEtapasEvaluadores = BigInt(etapas.length) * participantesPorEtapa;
  const divisorEnPuntos = divisorEtapasEvaluadores * 100n;
  const maximoComunDivisor = (a: bigint, b: bigint): bigint => b === 0n ? a : maximoComunDivisor(b, a % b);
  const divisorReducido = maximoComunDivisor(totalCentimos, divisorEnPuntos);
  const numerador = totalCentimos / divisorReducido;
  const denominador = divisorEnPuntos / divisorReducido;
  let calificacionCentimos = totalCentimos / divisorEtapasEvaluadores;
  if ((totalCentimos % divisorEtapasEvaluadores) * 2n >= divisorEtapasEvaluadores) calificacionCentimos += 1n;
  return {
    numerador: numerador.toString(),
    denominador: denominador.toString(),
    calificacion: `${calificacionCentimos / 100n}.${(calificacionCentimos % 100n).toString().padStart(2, '0')}`,
  };
}

function extraerTextoPdf(pdf: Buffer): string {
  const textos: string[] = [];
  const tokenStream = Buffer.from('stream');
  const tokenFin = Buffer.from('endstream');
  let cursor = 0;
  while (cursor < pdf.length) {
    const indiceStream = pdf.indexOf(tokenStream, cursor);
    if (indiceStream < 0) break;
    let inicio = indiceStream + tokenStream.length;
    if (pdf[inicio] === 13) inicio++;
    if (pdf[inicio] === 10) inicio++;
    const fin = pdf.indexOf(tokenFin, inicio);
    if (fin < 0) break;
    const inicioDiccionario = pdf.lastIndexOf(Buffer.from('<<'), indiceStream);
    const diccionario = pdf.subarray(Math.max(0, inicioDiccionario), indiceStream).toString('latin1');
    if (diccionario.includes('/FlateDecode')) {
      let finComprimido = fin;
      while (finComprimido > inicio && (pdf[finComprimido - 1] === 10 || pdf[finComprimido - 1] === 13)) finComprimido--;
      const contenido = inflateSync(pdf.subarray(inicio, finComprimido)).toString('latin1');
      const cadenasDeArreglo = [...contenido.matchAll(/\[((?:.|\n)*?)\]\s*TJ/g)];
      for (const [arreglo] of cadenasDeArreglo) {
        const grupos = [...arreglo.matchAll(/<([0-9a-f]+)>/gi)].map(([, hexadecimal]) =>
          Buffer.from(hexadecimal, 'hex').toString('latin1'));
        if (grupos.length) textos.push(grupos.join(''));
      }
      const fueraDeArreglos = contenido.replace(/\[((?:.|\n)*?)\]\s*TJ/g, '');
      for (const [, hexadecimal] of fueraDeArreglos.matchAll(/<([0-9a-f]+)>\s*Tj/gi)) {
        textos.push(Buffer.from(hexadecimal, 'hex').toString('latin1'));
      }
    }
    cursor = fin + tokenFin.length;
  }
  return textos.join('\n');
}
