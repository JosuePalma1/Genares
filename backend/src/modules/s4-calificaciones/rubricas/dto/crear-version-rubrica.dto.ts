import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CrearVersionRubricaDto {
  @IsUUID('loose')
  periodoId!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  version!: string;

  @IsOptional()
  @IsUUID('loose')
  copiarDesdeVersionId?: string;
}
