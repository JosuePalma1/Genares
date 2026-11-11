import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Filtros y paginación de `GET /finalizacion-trabajos`. Sin `limite` se conserva la respuesta
 * completa anterior; con `limite` solo se calculan las condiciones de la página pedida.
 */
export class ConsultarFinalizacionDto {
  @IsOptional() @Matches(/^\d{1,3}$/)
  limite?: string;

  @IsOptional() @Matches(/^\d{1,6}$/)
  pagina?: string;

  /** Código del periodo académico, o `TODOS`. Si se omite se usa el periodo activo. */
  @IsOptional() @IsString() @MaxLength(20)
  periodo?: string;

  @IsOptional() @IsString() @MaxLength(160)
  buscar?: string;

  /** `pendientes`: aún sin finalizar; `finalizados`: ya cerrados administrativamente. */
  @IsOptional() @IsIn(['pendientes', 'finalizados'])
  situacion?: 'pendientes' | 'finalizados';
}
