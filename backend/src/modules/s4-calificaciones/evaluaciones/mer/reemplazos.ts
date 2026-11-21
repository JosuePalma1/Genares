import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { IsBoolean, IsString, IsUUID, Length } from 'class-validator';
import { DataSource } from 'typeorm';
import { alcanceActual, conAlcance, filtroAlcance } from '../../../../common/api/contexto-alcance';

export class ReemplazarDto {
  @IsUUID('loose') etapa!: string;
  @IsUUID('loose') puesto!: string;
  @IsUUID('loose') docente!: string;
  @IsUUID('loose') anterior!: string;
  @IsString() @Length(1, 1000) motivo!: string;
  @IsBoolean() continuarBorrador!: boolean;
}

export async function registrarReemplazo(db: DataSource, asignacion: string, dto: ReemplazarDto, actor: string) {
  if (!dto.motivo.trim()) throw new BadRequestException('Indique el motivo del reemplazo.');
  return db.transaction(async m => {
    const [proceso] = await m.query(...conAlcance(`
      SELECT p.id FROM s4.procesos_evaluacion p JOIN s2.asignacion_tema a ON a.id=p.asignacion_tema_id
      JOIN gen.tema t ON t.id=a.tema_id JOIN gen.carrera c ON c.id=t.carrera_id
      JOIN s4.etapas_rubrica e ON e.id_version_rubrica=p.id_version_rubrica AND e.estado_registro=1
      WHERE a.id=$1 AND e.id=$2 AND p.estado_registro=1 AND p.estado <> 'FINALIZADO'
      ${filtroAlcance('a','c.codigo')} FOR UPDATE OF p`,[asignacion,dto.etapa]));
    if (!proceso) throw new ForbiddenException('No hay una etapa disponible para este reemplazo.');
    const puestos: Array<{puesto:string;docente:string;sujeto:string}> = await m.query(`
      SELECT a.asignacion_tribunal_id AS puesto,d.id AS docente,u.sujeto_autenticacion AS sujeto
      FROM s3.asignacion_tribunal a JOIN s3.miembros_tribunal mt USING(miembro_tribunal_id)
      JOIN s3.docente_carrera_periodo dc USING(docente_carrera_periodo_id)
      LEFT JOIN s4.reemplazos_etapa_actuales r ON r.proceso=$2 AND r.etapa=$3 AND r.puesto=a.asignacion_tribunal_id
      JOIN gen.docente d ON d.id=COALESCE(r.docente,dc.docente_id)
      LEFT JOIN gen.usuario u ON u.id=d.usuario_id AND u.activo WHERE a.asignacion_tema_id=$1`,[asignacion,proceso.id,dto.etapa]);
    const puesto=puestos.find(p=>p.puesto===dto.puesto);
    if (!puesto || puesto.docente!==dto.anterior) throw new ConflictException('El evaluador cambió. Recargue la etapa.');
    if (alcanceActual().tribunalDe && alcanceActual().tribunalDe!==puesto.sujeto) throw new ForbiddenException('Solo puede registrar su propio reemplazo.');
    if (puestos.some(p=>p.docente===dto.docente)) throw new ConflictException('El docente ya califica esta etapa.');
    const [candidato]=await m.query(`SELECT 1 FROM s3.miembros_tribunal mt JOIN s3.docente_carrera_periodo dc USING(docente_carrera_periodo_id)
      JOIN gen.docente d ON d.id=dc.docente_id AND d.activo JOIN gen.usuario u ON u.id=d.usuario_id AND u.activo WHERE d.id=$1`,[dto.docente]);
    if (!candidato) throw new BadRequestException('Seleccione un docente activo del tribunal de S3.');
    const actuales: Array<{estado:string}> = await m.query('SELECT estado FROM s4.evaluaciones WHERE id_proceso_evaluacion=$1 AND id_etapa_rubrica=$2 AND id_asignacion_tribunal=$3 AND estado_registro=1',[proceso.id,dto.etapa,dto.puesto]);
    if (actuales.some(e=>e.estado!=='BORRADOR')) throw new ConflictException('Esta etapa ya tiene una nota cerrada de ese evaluador.');
    if (actuales.length && !dto.continuarBorrador) throw new ConflictException('Confirme que el reemplazo continuará el borrador existente.');
    await m.query(`INSERT INTO s4.reemplazos_etapa(proceso,etapa,puesto,anterior,docente,motivo,actor)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,[proceso.id,dto.etapa,dto.puesto,dto.anterior,dto.docente,dto.motivo.trim(),actor]);
    return {registrado:true};
  });
}
