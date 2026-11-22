import { flujoDelProceso, trabajoEn } from './flujo-proceso';
import { CAPACIDADES_POR_ROL } from '../../../common/api/capacidades-por-rol';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { notaAprobada, notaMinimaEnEscala } from '../documentos/reglas-acta';
import { racionalDesdeDecimal, publicarRacional } from '../evaluaciones/reglas-consolidacion';
import { DataSource } from 'typeorm';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { TrabajosService } from '../trabajos/trabajos.service';
import { exigirConsultaGeneralLocal } from '../trabajos/trabajos.controller';
import {
  condicionesFlujo,
  SimularFlujoDto, resolverPasos, evaluarProgramacion,
  DecisionPasoDto,
  PasoDto,
  PermisosRolDto,
  pasosIniciales,
  PublicarFlujoDto,
  rolesFlujo,
  validarFlujo,
} from './flujo.reglas';

@Controller({ path: 'configuracion-general', version: '1' })
export class ConfiguracionGeneralController {
  constructor(
    private db: DataSource,
    private trabajos: TrabajosService,
  ) {}
  @Get()
  @RequiereCapacidades('configuracion-academica:administrar')
  async consultar(@Req() r: SolicitudConIdentidad) {
    const versiones = await this.db.query<
      Array<{
        version: number;
        pasos: PasoDto[];
        carrera: string | null;
        modalidad: string | null;
        periodo: string | null;
        redondeo: string;
        umbral: string | null;
      }>
    >(
      'SELECT COALESCE((to_jsonb(f)->>\'oral_sin_sesion\')::boolean,false) AS "oralSinSesion",version,pasos,carrera,modalidad,periodo,redondeo,umbral::text,publicado_en,publicado_por,COALESCE((to_jsonb(f)->>\'evidencia_correccion\')::boolean,true) AS "evidenciaCorreccion",(to_jsonb(f)->>\'dias_correccion\')::int AS "diasCorreccion" FROM s4.version_flujo f ORDER BY version DESC',
    );
    const actual = versiones[0];
    const [carreras, modalidades, periodos] = await Promise.all([
      this.db.query('SELECT id,nombre FROM gen.carrera ORDER BY nombre'),
      this.db.query('SELECT id,nombre FROM gen.modalidad ORDER BY nombre'),
      this.db.query('SELECT id,codigo AS nombre FROM gen.periodo_academico ORDER BY fecha_inicio DESC'),
    ]);
    return {
      ...actual,
      versiones: versiones.map((v) => ({ ...v, pasos: v.version === 1 ? pasosIniciales : v.pasos })),
      carreras,
      modalidades,
      periodos,
      puedePublicar:
        r.identidadApi?.tipo === 'DESARROLLO_LOCAL' ||
        ['ADMINISTRACION', 'SUPERUSUARIO'].includes(r.identidadApi?.rol ?? ''),
      puedeCambiarRoles:
        r.identidadApi?.tipo === 'DESARROLLO_LOCAL' || r.identidadApi?.rol === 'SUPERUSUARIO',
      pasos: actual.version === 1 ? pasosIniciales : actual.pasos,
      roles: rolesFlujo,
      condiciones: condicionesFlujo,
    };
  }
  private exigirAdministrador(r: SolicitudConIdentidad) {
    if (r.identidadApi?.rol !== 'SUPERUSUARIO' && r.identidadApi?.tipo !== 'DESARROLLO_LOCAL')
      throw new ForbiddenException('Se requiere el administrador global para cambiar permisos de roles.');
  }
  @Get('roles')
  @RequiereCapacidades('configuracion-academica:administrar')
  async permisos(@Req() r: SolicitudConIdentidad) {
    this.exigirAdministrador(r);
    const filas: Array<{ rol: string; permisos: string[]; revision: number }> = await this.db.query(
      'SELECT DISTINCT ON (rol) rol,permisos,id::int AS revision FROM s4.permisos_rol_version ORDER BY rol,id DESC',
    );
    return {
      catalogo: CAPACIDADES_POR_ROL.SUPERUSUARIO,
      roles: Object.entries(CAPACIDADES_POR_ROL)
        .filter(([rol]) => rol !== 'SUPERUSUARIO')
        .map(([rol, base]) => filas.find((f) => f.rol === rol) ?? { rol, permisos: base, revision: 0 }),
    };
  }
  @Post('roles')
  @RequiereCapacidades('configuracion-academica:administrar')
  async guardarPermisos(@Body() dto: PermisosRolDto, @Req() r: SolicitudConIdentidad) {
    this.exigirAdministrador(r);
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(73940212)');
      const [anterior] = await m.query(
        'SELECT COALESCE(max(id),0)::int AS revision FROM s4.permisos_rol_version WHERE rol=$1',
        [dto.rol],
      );
      if (anterior.revision !== dto.revision)
        throw new ConflictException('Los permisos cambiaron. Recarga antes de editar.');
      const [fila] = await m.query(
        'INSERT INTO s4.permisos_rol_version(rol,permisos,actor) VALUES($1,$2,$3) RETURNING id::int AS revision',
        [dto.rol, dto.permisos, actorValidadoDe(r)],
      );
      return fila;
    });
  }
  @Post('vista-previa')
  @RequiereCapacidades('configuracion-academica:administrar')
  async simular(@Body() dto: SimularFlujoDto) {
    validarFlujo(dto.pasos);
    const movimientos = dto.manuales.map(paso => ({ paso, accion:'CUMPLIDO', actor:'simulacion' }));
    if (Number(dto.nota) > dto.escala) throw new BadRequestException('La nota supera la escala del ejemplo.');
    const [regla] = await this.db.query(`
      WITH candidatas AS (
        SELECT version,pasos,redondeo,umbral,carrera,modalidad,periodo,false AS borrador FROM s4.version_flujo
        UNION ALL SELECT (SELECT max(version)+1 FROM s4.version_flujo),$1::jsonb,$2,$3::numeric,$4::uuid,$5::uuid,$6::uuid,true
      )
      SELECT version,pasos,redondeo,borrador,COALESCE(umbral,(SELECT porcentaje FROM s4.configuracion_nota_minima WHERE id=1))::text AS minimo
      FROM candidatas WHERE (carrera IS NULL OR carrera=$7::uuid) AND (modalidad IS NULL OR modalidad=$8::uuid)
        AND (periodo IS NULL OR periodo=$9::uuid)
      ORDER BY num_nonnulls(carrera,modalidad,periodo) DESC,version DESC LIMIT 1
    `, [JSON.stringify(dto.pasos),dto.redondeo ?? 'HALF_UP',dto.umbral ?? null,dto.carrera ?? null,
      dto.modalidad ?? null,dto.periodo ?? null,dto.carreraEjemplo ?? null,dto.modalidadEjemplo ?? null,dto.periodoEjemplo ?? null]);
    if (!regla?.minimo) throw new BadRequestException('Configura primero el porcentaje mínimo general.');
    const pasos = resolverPasos(regla.version === 1 ? pasosIniciales : regla.pasos, new Set(dto.hechos), movimientos, dto.rol, 'simulacion');
    const nota = publicarRacional(racionalDesdeDecimal(dto.nota),regla.redondeo);
    const minimo = notaMinimaEnEscala(regla.minimo, dto.escala);
    const programacion = evaluarProgramacion(pasos, dto.rol);
    if (!dto.hechos.includes('TRIBUNAL_ASIGNADO')) programacion.impedimentos.unshift('Tribunal asignado');
    if (regla.version === 1 && !dto.hechos.includes('DOS_ESCRITAS_CERRADAS')) programacion.impedimentos.push('Dos escritas cerradas');
    const aprobado = notaAprobada(nota,minimo,dto.escala);
    const [convocatoria] = aprobado ? [] : await this.db.query('SELECT reglas FROM s4.politica_convocatoria ORDER BY revision DESC LIMIT 1');
    return { version:regla.version, borrador:regla.borrador, pasos, programacion, nota, minimo, aprobado, convocatoria:convocatoria?.reglas ?? null };
  }
  @Post()
  @RequiereCapacidades('configuracion-academica:administrar')
  async publicar(@Body() dto: PublicarFlujoDto, @Req() r: SolicitudConIdentidad) {
    if (
      r.identidadApi?.tipo !== 'DESARROLLO_LOCAL' &&
      !['ADMINISTRACION', 'SUPERUSUARIO'].includes(r.identidadApi?.rol ?? '')
    )
      throw new ForbiddenException('La publicación global requiere administración transversal.');
    validarFlujo(dto.pasos);
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(73940211)');
      const [actual] = await m.query('SELECT max(version) AS version FROM s4.version_flujo');
      if (actual.version !== dto.version)
        throw new ConflictException('Hay otra versión publicada. Vuelve a consultar antes de publicar.');
      await m.query(
        'INSERT INTO s4.version_flujo(version,pasos,publicado_por,carrera,modalidad,periodo,redondeo,umbral,evidencia_correccion,dias_correccion,oral_sin_sesion) VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          dto.version + 1,
          JSON.stringify(dto.pasos),
          actorValidadoDe(r),
          dto.carrera ?? null,
          dto.modalidad ?? null,
          dto.periodo ?? null,
          dto.redondeo ?? 'HALF_UP',
          dto.umbral ?? null,
          dto.evidenciaCorreccion ?? true, dto.diasCorreccion ?? null, dto.oralSinSesion ?? false,
        ],
      );
      return { version: dto.version + 1 };
    });
  }
  private async trabajo(id: string, r: SolicitudConIdentidad) {
    exigirConsultaGeneralLocal(r);
    return this.trabajos.detalleDesarrolloLocal(actorValidadoDe(r), id);
  }
  private rol(r: SolicitudConIdentidad) {
    return (
      r.identidadApi?.rol ??
      (r.identidadApi?.tipo === 'DESARROLLO_LOCAL' &&
      r.identidadApi.capacidades.includes('configuracion-academica:administrar')
        ? 'SUPERUSUARIO'
        : '')
    );
  }
  @Get('trabajos/:id')
  @RequiereCapacidades('trabajos:leer')
  async avance(@Param('id', ParseUUIDPipe) id: string, @Req() r: SolicitudConIdentidad) {
    return flujoDelProceso(this.db.manager, await this.trabajo(id, r), this.rol(r), actorValidadoDe(r));
  }
  @Post('trabajos/:id/pasos/:paso')
  @RequiereCapacidades('trabajos:leer')
  async cambiar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paso') paso: string,
    @Body() dto: DecisionPasoDto,
    @Req() r: SolicitudConIdentidad,
  ) {
    const trabajo = await this.trabajo(id, r);
    const actor = actorValidadoDe(r);
    return this.db.transaction(async (m) => {
      const [proceso] = await m.query('SELECT estado FROM s4.procesos_evaluacion WHERE id=$1 FOR UPDATE', [
        trabajo.procesoId,
      ]);
      if (!proceso || proceso.estado === 'FINALIZADO')
        throw new ConflictException('El proceso no admite cambios.');
      const flujo = await flujoDelProceso(m, await trabajoEn(m, id), this.rol(r), actor);
      const p = flujo.pasos.find((item) => item.id === paso);
      if (!p?.acciones.includes(dto.accion))
        throw new ForbiddenException('La regla, el estado o el rol no permiten esta acción.');
      const accion =
        dto.accion === 'RECHAZAR'
          ? 'RECHAZADO'
          : dto.accion === 'SOLICITAR' && p.aprobadores.length
            ? 'SOLICITADO'
            : 'CUMPLIDO';
      await m.query('INSERT INTO s4.historial_paso(proceso,paso,accion,actor) VALUES ($1,$2,$3,$4)', [
        trabajo.procesoId,
        paso,
        accion,
        actor,
      ]);
      return { accion };
    });
  }
}
