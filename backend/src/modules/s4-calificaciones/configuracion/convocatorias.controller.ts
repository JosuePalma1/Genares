import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { DocumentosService } from '../documentos/documentos.service';
import { AbrirConvocatoriaDto, CalificarConvocatoriaDto, Convocatoria, NotaConvocatoria, PoliticaConvocatoriaDto, resultadoConvocatoria, RevisarConvocatoriaDto, totalIndicadores, validarEtapasIntento } from './convocatoria.reglas';

type Peticion = SolicitudConIdentidad;
const politicaSql = 'SELECT revision,reglas FROM s4.politica_convocatoria ORDER BY revision DESC LIMIT 1';
const consultaIntentos = `SELECT i.*,i.vence::text AS vence,p.codigo AS "codigoPeriodo",per.nombres||' '||per.apellidos AS nombre
 FROM s4.convocatoria_individual i JOIN gen.periodo_academico p ON p.id=i.periodo
 JOIN gen.estudiante e ON e.id=i.estudiante JOIN gen.persona per ON per.id=e.persona_id`;
function administracion(r:Peticion) {
  return r.identidadApi?.tipo==='DESARROLLO_LOCAL' || r.identidadApi?.rol==='SUPERUSUARIO' || r.identidadApi?.rol==='ADMINISTRACION';
}
@Controller({path:'convocatorias',version:'1'})
export class ConvocatoriasController {
  constructor(private db:DataSource,private evaluaciones:EvaluacionesService,private documentos:DocumentosService){}
  @Get('politica')
  @RequiereCapacidades('configuracion-academica:administrar')
  async politica() {
    const [p]=await this.db.query(politicaSql);
    return {...p.reglas,revision:p.revision};
  }
  @Post('politica')
  @RequiereCapacidades('configuracion-academica:administrar')
  async configurar(@Body() dto:PoliticaConvocatoriaDto,@Req() r:Peticion) {
    if(!administracion(r))throw new ForbiddenException('Se requiere administración global.');
    const {revision,...reglas}=dto;
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(73940308)');
      const [p]=await m.query(politicaSql);
      if(p.revision!==revision)throw new ConflictException('La política cambió. Actualiza la página.');
      await m.query('INSERT INTO s4.politica_convocatoria(revision,reglas,actor) VALUES($1,$2,$3)',[revision+1,JSON.stringify(reglas),actorValidadoDe(r)]);
      return {...reglas,revision:revision+1};
    });
  }
  private datos(id:string,r:Peticion) {
    return this.evaluaciones.datosDocumentales(id,actorValidadoDe(r),puedeConsultarDemostracion(r));
  }
  private async propio(m:EntityManager,trabajo:string,actor:string) {
    const filas:Array<{id:string}>=await m.query(`SELECT a.asignacion_tribunal_id AS id FROM s3.asignacion_tribunal a
      JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id=a.miembro_tribunal_id
      JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id=mt.docente_carrera_periodo_id
      JOIN gen.docente d ON d.id=dc.docente_id AND d.activo JOIN gen.usuario u ON u.id=d.usuario_id AND u.activo
      WHERE a.asignacion_tema_id=$1 AND u.sujeto_autenticacion=$2`,[trabajo,actor]);
    return filas.map(e=>e.id);
  }
  @Get('trabajos/:id')
  @RequiereCapacidades('evaluaciones:leer')
  async historial(@Param('id',ParseUUIDPipe) id:string,@Req() r:Peticion) {
    const datos=await this.datos(id,r);
    const intentos:Convocatoria[]=await this.db.query(consultaIntentos+' WHERE i.proceso=$1 ORDER BY i.estudiante,i.numero DESC',[datos.trabajo.procesoId]);
    const notas:Array<NotaConvocatoria & {convocatoria:string}>=intentos.length?await this.db.query('SELECT * FROM s4.nota_convocatoria WHERE convocatoria=ANY($1::uuid[])',[intentos.map(i=>i.id)]):[];
    const permitidos=administracion(r)?datos.evaluadores.map(e=>e.id):await this.propio(this.db.manager,id,actorValidadoDe(r));
    const puedeCalificar=r.identidadApi!.capacidades.includes('integracion:cerrar-evaluacion');
    return intentos.map(i=>({...i,notas:notas.filter(n=>n.convocatoria===i.id),editables:puedeCalificar?permitidos:[]}));
  }
  @Get('trabajos/:id/:estudiante/opciones')
  @RequiereCapacidades('evaluaciones:autorizar-correccion','trabajos:leer')
  async opciones(@Param('id',ParseUUIDPipe) id:string,@Param('estudiante',ParseUUIDPipe) estudiante:string,@Req() r:Peticion) {
    const d=await this.datos(id,r);
    if(!d.estudiantes.some(e=>e.id===estudiante))throw new NotFoundException();
    const [politica]=await this.db.query(politicaSql);
    const [ultimo]=await this.db.query(consultaIntentos+' WHERE i.proceso=$1 AND i.estudiante=$2 ORDER BY i.numero DESC LIMIT 1',[d.trabajo.procesoId,estudiante]);
    const [revision]=await this.db.query('SELECT motivo FROM s4.revision_convocatoria WHERE proceso=$1 AND estudiante=$2 AND numero=$3',[d.trabajo.procesoId,estudiante,(ultimo?.numero??1)+1]);
    const [continuidad]=await this.db.query('SELECT periodo_destino FROM s4.continuidad_estudiante WHERE proceso=$1 AND estudiante=$2',[d.trabajo.procesoId,estudiante]);
    return {politica:politica.reglas,etapas:(ultimo?.rubrica??d.rubrica).stages,ultimo:ultimo?{numero:ultimo.numero,estado:ultimo.estado,nota:ultimo.nota,periodo:ultimo.periodo}:null,revision:revision?.motivo,periodo:ultimo?.periodo??d.trabajo.periodoId,periodoReservado:!ultimo?continuidad?.periodo_destino:null};
  }
  private async origen(m:EntityManager,id:string,estudiante:string,r:Peticion,numero:number){
    const [proceso]=await m.query('SELECT id,redondeo_final FROM s4.procesos_evaluacion WHERE asignacion_tema_id=$1 AND estado_registro=1 FOR UPDATE',[id]);
    if(!proceso)throw new NotFoundException();
    const d=await this.datos(id,r);
    const [anterior]:Convocatoria[]=await m.query(consultaIntentos+' WHERE i.proceso=$1 AND i.estudiante=$2 ORDER BY i.numero DESC LIMIT 1',[proceso.id,estudiante]);
    if((anterior?.numero??1)+1!==numero || (anterior && anterior.estado!=='REPROBADA'))throw new ConflictException('El intento anterior debe estar reprobado. Actualiza el caso.');
    const actas=await this.documentos.contexto(id,actorValidadoDe(r),false,puedeConsultarDemostracion(r));
    const acta=actas.actas.find(e=>e.estudianteId===estudiante);
    const [archivo]=await m.query('SELECT aprobado,nota_minima_aplicada AS minimo,escala_final AS escala FROM s4.actas_archivadas WHERE id_proceso_evaluacion=$1 AND id_estudiante=$2 AND estado_registro=1 AND aprobado IS NOT NULL ORDER BY generado_en DESC,id DESC LIMIT 1',[proceso.id,estudiante]);
    if(!acta || (!anterior && (archivo?.aprobado??acta.aprobadoProvisional)!==false))throw new ConflictException('Se requiere un resultado reprobado confirmado.');
    const [politica]=await m.query(politicaSql);
    return {proceso,d,anterior,politica,escala:anterior?.escala??archivo?.escala??acta.escala,minimo:anterior?.minimo??archivo?.minimo??acta.notaMinimaProvisional};
  }
  @Post('trabajos/:id/:estudiante/revision')
  @RequiereCapacidades('evaluaciones:autorizar-correccion','trabajos:leer')
  async revisar(@Param('id',ParseUUIDPipe) id:string,@Param('estudiante',ParseUUIDPipe) estudiante:string,@Body() dto:RevisarConvocatoriaDto,@Req() r:Peticion) {
    return this.db.transaction(async m=>{
      const {proceso,politica}=await this.origen(m,id,estudiante,r,dto.numero);
      if(!politica.reglas.revisar)throw new ConflictException('La revisión individual está deshabilitada.');
      const filas=await m.query('INSERT INTO s4.revision_convocatoria(proceso,estudiante,numero,motivo,actor) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING numero',[proceso.id,estudiante,dto.numero,dto.motivo.trim(),actorValidadoDe(r)]);
      if(!filas.length)throw new ConflictException('El caso ya está en revisión.');
      return {numero:dto.numero};
    });
  }
  @Post('trabajos/:id/:estudiante')
  @RequiereCapacidades('evaluaciones:autorizar-correccion','trabajos:leer')
  async abrir(@Param('id',ParseUUIDPipe) id:string,@Param('estudiante',ParseUUIDPipe) estudiante:string,@Body() dto:AbrirConvocatoriaDto,@Req() r:Peticion) {
    return this.db.transaction(async m=>{
      const {proceso,d,anterior,politica,minimo,escala}=await this.origen(m,id,estudiante,r,dto.numero);
      const [p]=await m.query(`SELECT dest.id=orig.id AS mismo,dest.fecha_inicio>orig.fecha_inicio AS posterior
      FROM gen.periodo_academico orig,gen.periodo_academico dest WHERE orig.id=$1 AND dest.id=$2`,[anterior?.periodo??d.trabajo.periodoId,dto.periodo]);
      if(!p || !(p.mismo?politica.reglas.mismoPeriodo:politica.reglas.otroPeriodo && p.posterior))throw new ConflictException('El período seleccionado no está permitido.');
      const [previsto]=await m.query('SELECT periodo_destino FROM s4.continuidad_estudiante WHERE proceso=$1 AND estudiante=$2',[proceso.id,estudiante]);
      if(!anterior && previsto && previsto.periodo_destino!==dto.periodo)throw new ConflictException('Elige el período registrado en la decisión de continuidad.');
      const rubrica=anterior?.rubrica??d.rubrica;
      const evaluadores=anterior?.evaluadores??d.evaluadores;
      validarEtapasIntento(rubrica,dto.conservar,politica.reglas.escrita);
      const fechas=d.evaluaciones.filter(e=>e.idEstudiante===estudiante || (e.estudiantesTraspasados as Array<{idEstudiante:string}>).some(t=>t.idEstudiante===estudiante)).map(e=>new Date(e.cerradaEn as string).getTime()).filter(Number.isFinite);
      const resultado=anterior?.cerrada_en??(fechas.length?new Date(Math.max(...fechas)):null);
      if(politica.reglas.dias && politica.reglas.inicio==='RESULTADO' && !resultado)throw new ConflictException('Falta la fecha del resultado para determinar el plazo.');
      const [fecha]=await m.query(`SELECT vencimiento::text AS vence,vencimiento < CURRENT_DATE AS vencido FROM
       (SELECT CASE WHEN $1::int IS NULL THEN NULL ELSE (CASE WHEN $2='RESULTADO' THEN $3::timestamptz::date ELSE CURRENT_DATE END)+$1::int END AS vencimiento) f`,[politica.reglas.dias??null,politica.reglas.inicio,resultado]);
      if(fecha.vencido)throw new ConflictException('El plazo configurado para la nueva convocatoria venció.');
      const [intento]=await m.query(`INSERT INTO s4.convocatoria_individual(proceso,estudiante,periodo,numero,politica,estado,rubrica,evaluadores,conservar,minimo,escala,redondeo,abierta_por,vence)
       VALUES($1,$2,$3,$4,$5,'ABIERTA',$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,numero`,[proceso.id,estudiante,dto.periodo,dto.numero,politica.revision,JSON.stringify(rubrica),JSON.stringify(evaluadores),dto.conservar,minimo,escala,proceso.redondeo_final,actorValidadoDe(r),fecha.vence]);
      for(const etapa of dto.conservar)for(const ev of evaluadores){
        let fuente;
        if(anterior){
          [fuente]=await m.query('SELECT valores,total,COALESCE(origen,convocatoria) AS origen FROM s4.nota_convocatoria WHERE convocatoria=$1 AND etapa=$2 AND evaluador=$3',[anterior.id,etapa,ev.id]);
        }else{
          const esCompartida = rubrica.stages.some((s) => s.id === etapa && s.scope === 'TRABAJO_COMPARTIDO');
          const original=d.evaluaciones.find(e=>e.idEtapaRubrica===etapa && e.idMiembroTribunal===ev.id && e.estado==='CERRADA' && (esCompartida ? e.idEstudiante == null : e.idEstudiante===estudiante));
          if(original)fuente={origen:original.id,total:original.calificacionTotal,valores:(original.puntajes as Array<{idIndicador:string;puntaje:string}>).map(v=>({id:v.idIndicador,nota:v.puntaje}))};
        }
        if(!fuente || fuente.total==null)throw new ConflictException('La etapa seleccionada carece de un cierre previo para este estudiante.');
        await m.query('INSERT INTO s4.nota_convocatoria(convocatoria,etapa,evaluador,valores,total,origen,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[intento.id,etapa,ev.id,JSON.stringify(fuente.valores),fuente.total,fuente.origen,actorValidadoDe(r)]);
      }
      return intento;
    });
  }
  @Post('trabajos/:id/intentos/:intento/notas')
  @RequiereCapacidades('integracion:cerrar-evaluacion')
  async calificar(@Param('id',ParseUUIDPipe) id:string,@Param('intento',ParseUUIDPipe) intento:string,@Body() dto:CalificarConvocatoriaDto,@Req() r:Peticion){
    await this.datos(id,r);
    return this.db.transaction(async m=>{
      const [c]:Array<Convocatoria & {vencido:boolean}>=await m.query(`SELECT i.*,i.vence<CURRENT_DATE AS vencido FROM s4.convocatoria_individual i JOIN s4.procesos_evaluacion p ON p.id=i.proceso WHERE i.id=$1 AND p.asignacion_tema_id=$2 FOR UPDATE OF i`,[intento,id]);
      if(!c)throw new NotFoundException();
      if(c.estado!=='ABIERTA'||c.vencido)throw new ConflictException('La convocatoria ya no admite calificaciones.');
      if(!c.evaluadores.some(e=>e.id===dto.evaluador) || (!administracion(r) && !(await this.propio(m,id,actorValidadoDe(r))).includes(dto.evaluador)))throw new ForbiddenException('Solo puede calificar como evaluador asignado.');
      if(c.conservar.includes(dto.etapa))throw new ConflictException('Esta etapa conserva la nota anterior.');
      const total=totalIndicadores(c.rubrica,dto);
      const nueva=await m.query('INSERT INTO s4.nota_convocatoria(convocatoria,etapa,evaluador,valores,total,actor) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING etapa',[intento,dto.etapa,dto.evaluador,JSON.stringify(dto.valores),total,actorValidadoDe(r)]);
      if(!nueva.length)throw new ConflictException('Esta calificación ya se cerró.');
      const notas=await m.query('SELECT * FROM s4.nota_convocatoria WHERE convocatoria=$1',[intento]);
      const resultado=resultadoConvocatoria(c,notas);
      if(resultado)await m.query('UPDATE s4.convocatoria_individual SET estado=CASE WHEN $2::numeric>=minimo THEN \'APROBADA\' ELSE \'REPROBADA\' END,nota=$2,cerrada_en=clock_timestamp() WHERE id=$1',[intento,resultado.calificacion]);
      return {resultado};
    });
  }
}
