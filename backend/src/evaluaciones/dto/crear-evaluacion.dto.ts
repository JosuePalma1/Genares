import { IsOptional, Matches } from 'class-validator';
import { UUID_POSTGRES_PATTERN } from '../../comun/uuid-postgres';

export class CrearEvaluacionDto {
  @Matches(UUID_POSTGRES_PATTERN)
  idEtapaRubrica!: string;

  @IsOptional()
  @Matches(UUID_POSTGRES_PATTERN)
  idEstudiante?: string;

  /** Selección local temporal; el servidor comprueba su pertenencia al tribunal confirmado. */
  @IsOptional()
  @Matches(UUID_POSTGRES_PATTERN)
  idMiembroTribunal?: string;
}
