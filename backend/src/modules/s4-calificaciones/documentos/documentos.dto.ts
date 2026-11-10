import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class FormatoActaDto {
  @IsIn(['PAT-01-F-019', 'PAT-04-F-017'])
  formato!: 'PAT-01-F-019' | 'PAT-04-F-017';
}

export class BuscarActasDto {
  @IsOptional() @IsString() @MaxLength(160)
  estudiante?: string;
  @IsOptional() @IsString() @MaxLength(30)
  carrera?: string;
  @IsOptional() @IsString() @MaxLength(20)
  periodo?: string;
}

export class ActualizarNotaMinimaDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/)
  notaMinima!: string;
}
