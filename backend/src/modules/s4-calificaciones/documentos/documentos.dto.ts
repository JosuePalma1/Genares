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
  /** Con `limite` la respuesta es una página `{ elementos, paginacion }`; sin él, la lista completa. */
  @IsOptional() @Matches(/^\d{1,3}$/)
  limite?: string;
  @IsOptional() @Matches(/^\d{1,6}$/)
  pagina?: string;
}

export class BuscarTrabajosDocumentosDto {
  /**
   * Código del periodo, `TODOS` o `ACTIVO`. Si se envía, la respuesta incluye los periodos disponibles
   * (`{ elementos, periodo, periodos }`); si se omite, se conserva la lista completa anterior.
   */
  @IsOptional() @IsString() @MaxLength(20)
  periodo?: string;
}

export class ActualizarNotaMinimaDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/)
  notaMinima!: string;
}
