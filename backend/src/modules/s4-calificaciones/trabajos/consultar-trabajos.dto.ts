import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Filtros y paginación de `GET /trabajos`. Sin `limite` el listado conserva la respuesta
 * completa que usan cronograma, seguimiento y documentos.
 */
export class ConsultarTrabajosDto {
  @IsOptional() @Matches(/^\d{1,3}$/)
  limite?: string;

  @IsOptional() @Matches(/^\d{1,6}$/)
  pagina?: string;

  /** Código del periodo académico, o `TODOS`. Si se omite se usa el periodo activo. */
  @IsOptional() @IsString() @MaxLength(20)
  periodo?: string;

  @IsOptional() @IsString() @MaxLength(160)
  buscar?: string;

  @IsOptional() @IsString() @MaxLength(40)
  estado?: string;

  @IsOptional() @IsIn(['con', 'sin'])
  tribunal?: 'con' | 'sin';

  /** Código de la carrera (p. ej. TI). */
  @IsOptional() @IsString() @MaxLength(30)
  carrera?: string;
}
