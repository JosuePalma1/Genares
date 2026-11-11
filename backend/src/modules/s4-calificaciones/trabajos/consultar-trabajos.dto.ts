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

  /** RF-13 · Código de la modalidad. */
  @IsOptional() @IsString() @MaxLength(30)
  modalidad?: string;

  /** RF-13 · Parte del nombre de un estudiante, sin distinguir tildes ni mayúsculas. */
  @IsOptional() @IsString() @MaxLength(160)
  estudiante?: string;

  /** RF-13 · Parte del título del tema. */
  @IsOptional() @IsString() @MaxLength(160)
  tema?: string;

  /** RF-13 · Parte del nombre de un tutor. */
  @IsOptional() @IsString() @MaxLength(160)
  tutor?: string;
}
