import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import {
  actorValidadoDe,
  puedeConsultarDemostracion,
  SolicitudConIdentidad,
} from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { ConsultarTrabajosDto } from '../trabajos/consultar-trabajos.dto';
import { TrabajoMer, TrabajosService } from '../trabajos/trabajos.service';
import { DocumentosService } from '../documentos/documentos.service';

class ContinuidadDto {
  @IsUUID('loose') periodo!: string;
}
@Controller({ path: 'solicitudes/reprobacion', version: '1' })
@RequiereCapacidades('evaluaciones:autorizar-correccion', 'trabajos:leer')
export class ReprobacionController {
  constructor(
    private db: DataSource,
    private trabajos: TrabajosService,
    private documentos: DocumentosService,
  ) {}
  private async casos(t: TrabajoMer, r: SolicitudConIdentidad) {
    const id = t.id;
    const actor = actorValidadoDe(r);
    const estados = t.estadosEstudiantes as Array<{ idEstudiante: string; estado: string }>;
    const completo = (estado: string) => ['EVALUACION_COMPLETADA', 'FINALIZADO'].includes(estado);
    if (!t.procesoId || !(completo(String(t.estado)) || estados?.some((e) => completo(e.estado)))) return [];
    const ctx = await this.documentos.contexto(id, actor, false, puedeConsultarDemostracion(r));
    const archivos = await this.db.query<
      Array<{
        id_estudiante: string;
        nota_final: string;
        nota_minima_aplicada: string;
        escala_final: string;
        aprobado: boolean;
      }>
    >(
      'SELECT DISTINCT ON (id_estudiante) id_estudiante,nota_final,nota_minima_aplicada,escala_final,aprobado FROM s4.actas_archivadas WHERE id_proceso_evaluacion=$1 AND estado_registro=1 AND aprobado IS NOT NULL ORDER BY id_estudiante,generado_en DESC,id DESC',
      [t.procesoId],
    );
    const continuidades = await this.db.query<Array<{ estudiante: string; periodo: string }>>(
      'SELECT c.estudiante,p.codigo AS periodo FROM s4.continuidad_estudiante c JOIN gen.periodo_academico p ON p.id=c.periodo_destino WHERE c.proceso=$1',
      [t.procesoId],
    );
    return ctx.actas.flatMap((a) => {
      const archivada = archivos.find((f) => f.id_estudiante === a.estudianteId);
      if ((archivada?.aprobado ?? a.aprobadoProvisional) !== false) return [];
      return [
        {
          trabajo: id,
          titulo: t.titulo,
          proceso: t.procesoId,
          periodoOrigen: t.idPeriodo,
          estudiante: a.estudianteId,
          nombre: t.estudiantes.find((e) => e.id === a.estudianteId)?.nombre,
          nota: archivada?.nota_final ?? a.calificacionFinal,
          minimo: archivada?.nota_minima_aplicada ?? a.notaMinimaProvisional,
          escala: archivada?.escala_final ?? a.escala,
          periodoDestino: continuidades.find((c) => c.estudiante === a.estudianteId)?.periodo ?? null,
        },
      ];
    });
  }
  @Get()
  async listar(@Query() filtro: ConsultarTrabajosDto, @Req() r: SolicitudConIdentidad) {
    const pagina = await this.trabajos.listarPaginaDesarrolloLocal(actorValidadoDe(r), {
      ...filtro,
      periodo: 'TODOS',
      limite: '10',
    });
    const elementos = [];
    for (const t of pagina.elementos) elementos.push(...(await this.casos(t, r)));
    const periodos = await this.db.query(
      'SELECT id,codigo,fecha_inicio::text AS inicio FROM gen.periodo_academico ORDER BY fecha_inicio DESC NULLS LAST',
    );
    return { elementos, paginacion: pagina.paginacion, periodos };
  }
  @Post(':id/:estudiante')
  async diferir(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('estudiante', ParseUUIDPipe) estudiante: string,
    @Body() dto: ContinuidadDto,
    @Req() r: SolicitudConIdentidad,
  ) {
    const t = await this.trabajos.detalleDesarrolloLocal(actorValidadoDe(r), id);
    return this.db.transaction(async (m) => {
      await m.query('SELECT id FROM s4.procesos_evaluacion WHERE id=$1 FOR UPDATE', [t.procesoId]);
      const caso = (await this.casos(t, r)).find((c) => c.estudiante === estudiante);
      if (!caso) throw new ConflictException('El estudiante no tiene un resultado reprobado confirmado.');
      const [periodo] = await m.query(
        'SELECT d.id,d.codigo FROM gen.periodo_academico d JOIN gen.periodo_academico o ON o.id=$2 WHERE d.id=$1 AND d.fecha_inicio>o.fecha_inicio',
        [dto.periodo, t.idPeriodo],
      );
      if (!periodo) throw new ConflictException('Selecciona un período posterior al de la evaluación.');
      if (caso.periodoDestino && caso.periodoDestino !== periodo.codigo)
        throw new ConflictException('Ya existe una decisión para este intento.');
      await m.query(
        'INSERT INTO s4.continuidad_estudiante(proceso,estudiante,periodo_destino,nota,minimo,escala,actor) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
        [t.procesoId, estudiante, periodo.id, caso.nota, caso.minimo, caso.escala, actorValidadoDe(r)],
      );
      return { periodoDestino: periodo.codigo };
    });
  }
}
