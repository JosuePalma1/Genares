import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AlcanceEtapaRubrica } from '../../comun/enums-dominio';

const decimalText = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.trim() : value;
};
const decimalRegex = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;
const codigoRegex = /^[A-Za-z][A-Za-z0-9_-]*$/;

export class IndicadorRubricaCompletaDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  descripcion!: string;

  @Transform(decimalText)
  @IsString()
  @Matches(decimalRegex)
  calificacionMaxima!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  orden!: number;
}

export class CategoriaRubricaCompletaDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(codigoRegex)
  codigo!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  nombre!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  orden!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IndicadorRubricaCompletaDto)
  indicadores!: IndicadorRubricaCompletaDto[];
}

export class EtapaRubricaCompletaDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(codigoRegex)
  codigo!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  nombre!: string;

  @IsEnum(AlcanceEtapaRubrica)
  alcance!: AlcanceEtapaRubrica;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  descripcion?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  orden!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoriaRubricaCompletaDto)
  categorias!: CategoriaRubricaCompletaDto[];
}

export class VigenciaEsperadaRubricaDto {
  @ValidateIf((dto: VigenciaEsperadaRubricaDto) => dto.versionId !== null)
  @IsUUID('4')
  versionId!: string | null;
}

export class AsociacionCarreraRubricaDto {
  @IsUUID('4')
  carreraId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @IsBoolean()
  vigente!: boolean;

  @IsDefined()
  @ValidateNested()
  @Type(() => VigenciaEsperadaRubricaDto)
  vigenciaEsperada!: VigenciaEsperadaRubricaDto;
}

export class CrearRubricaCompletaDto {
  @IsUUID('4')
  modalidadId!: string;

  @IsUUID('4')
  periodoId!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  nombre!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  descripcion?: string | null;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  version!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtapaRubricaCompletaDto)
  etapas!: EtapaRubricaCompletaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsociacionCarreraRubricaDto)
  carreras!: AsociacionCarreraRubricaDto[];
}

export class CrearVersionRubricaCompletaDto {
  @IsUUID('4')
  periodoId!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  version!: string;

  @IsOptional()
  @IsUUID('4')
  copiarDesdeVersionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revisionBase?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EtapaRubricaCompletaDto)
  etapas?: EtapaRubricaCompletaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsociacionCarreraRubricaDto)
  carreras!: AsociacionCarreraRubricaDto[];
}
