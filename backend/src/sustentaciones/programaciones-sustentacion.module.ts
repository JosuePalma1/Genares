import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramacionSustentacion } from './entidades/programacion-sustentacion.entity';
import { ProgramacionesSustentacionController } from './programaciones-sustentacion.controller';
import { ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProgramacionSustentacion])],
  controllers: [ProgramacionesSustentacionController],
  providers: [ProgramacionesSustentacionService],
})
export class ProgramacionesSustentacionModule {}
