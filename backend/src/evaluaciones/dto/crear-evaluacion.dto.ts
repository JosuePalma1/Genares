import { IsOptional, IsUUID } from 'class-validator';

export class CrearEvaluacionDto {
  @IsUUID('4')
  idEtapaRubrica!: string;

  @IsOptional()
  @IsUUID('4')
  idEstudiante?: string;
}
