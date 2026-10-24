import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { UUID_POSTGRES_PATTERN } from '../../comun/uuid-postgres';

export class CerrarEvaluacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @IsOptional()
  @Matches(UUID_POSTGRES_PATTERN)
  idMiembroTribunal?: string;
}
