import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const puntajeDecimal = /^(?:0|[1-9]\d{0,1})(?:\.\d{1,2})?$/;

export class PuntajeIndicadorDto {
  @IsUUID('4')
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
}
