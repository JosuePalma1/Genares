import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { UUID_POSTGRES_PATTERN } from '../../comun/uuid-postgres';

const puntajeDecimal = /^(?:0|[1-9]\d{0,1})(?:\.\d{1,2})?$/;

export class PuntajeIndicadorDto {
  @Matches(UUID_POSTGRES_PATTERN)
  idIndicador!: string;

  @IsString()
  @Matches(puntajeDecimal)
  puntaje!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string | null;
}

export class GuardarPuntajesEvaluacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PuntajeIndicadorDto)
  puntajes!: PuntajeIndicadorDto[];

  @IsOptional()
  @Matches(UUID_POSTGRES_PATTERN)
  idMiembroTribunal?: string;
}
