import { Module } from '@nestjs/common';
import { TrabajosModule } from '../trabajos/trabajos.module';
import { ProgramacionesSustentacionController } from './programaciones-sustentacion.controller';
import { ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

@Module({
  imports: [TrabajosModule],
  controllers: [ProgramacionesSustentacionController],
  providers: [ProgramacionesSustentacionService],
})
export class ProgramacionesSustentacionModule {}
