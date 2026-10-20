import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { AlcanceEtapaRubrica, EtapaEvaluacion } from '../../comun/enums-dominio';

const decimalText = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return value;
};
const decimalRegex = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;

export class ActualizarVersionRubricaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  revision!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EtapaBorradorRubricaDto)
  etapas: EtapaBorradorRubricaDto[] = [];
}

export class EtapaBorradorRubricaDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsEnum(EtapaEvaluacion)
  tipo!: EtapaEvaluacion;

  @IsEnum(AlcanceEtapaRubrica)
  alcance!: AlcanceEtapaRubrica;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  nombre!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  descripcion?: string | null;

  @Transform(decimalText)
  @IsString()
  @Matches(decimalRegex)
  calificacionMaxima!: string;

  @IsOptional()
  @Transform(decimalText)
  @IsString()
  @Matches(decimalRegex)
  porcentaje?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  orden!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoriaBorradorRubricaDto)
  categorias: CategoriaBorradorRubricaDto[] = [];
}

export class CategoriaBorradorRubricaDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  codigo!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  nombre!: string;

  @Transform(decimalText)
  @IsString()
  @Matches(decimalRegex)
  calificacionMaxima!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  orden!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicadorBorradorRubricaDto)
  indicadores: IndicadorBorradorRubricaDto[] = [];
}

export class IndicadorBorradorRubricaDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

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
