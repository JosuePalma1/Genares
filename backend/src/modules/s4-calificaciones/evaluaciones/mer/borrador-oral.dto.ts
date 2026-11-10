import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class PuntajeBorradorDto {
  // Los UUID del MER incluyen identificadores deterministas de los seeders.
  @IsUUID('loose')
  idIndicador!: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  score?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}

export class GuardarBorradorOralDto {
  @IsUUID('loose')
  idEtapaRubrica!: string;

  @IsUUID('loose')
  idAsignacionTribunal!: string;

  @IsOptional()
  @IsUUID('loose')
  idEstudiante?: string | null;

  @IsInt()
  @Min(0)
  revisionEsperada!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PuntajeBorradorDto)
  puntajes!: PuntajeBorradorDto[];
}
