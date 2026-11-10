import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { ActaArchivada } from './entidades/acta-archivada.entity';
import { ConsecutivoActa } from './entidades/consecutivo-acta.entity';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
@Module({ imports: [EvaluacionesModule, TypeOrmModule.forFeature([ActaArchivada, ConsecutivoActa])], controllers: [DocumentosController], providers: [DocumentosService] })
export class DocumentosModule {}
