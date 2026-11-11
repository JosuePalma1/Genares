import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { EstadoSustentacion } from '../../../../common/domain/enums-dominio';

export const TODOS_LOS_PERIODOS_PROGRAMACION = 'TODOS';

export class ConsultarProgramacionesDto {
  @IsOptional()
  @IsUUID('loose')
  carreraId?: string;

  /**
   * UUID del periodo o `TODOS`. Si se omite: en el listado paginado se usa el periodo activo;
   * en las demás consultas, todos los periodos (comportamiento anterior).
   */
  @IsOptional()
  @Matches(/^(?:TODOS|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  periodoId?: string;

  @IsOptional()
  @IsIn([...Object.values(EstadoSustentacion), 'COMPLETADA'])
  estado?: EstadoSustentacion | 'COMPLETADA';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  buscar?: string;

  /** Con `limite` el listado se pagina; sin él se devuelve completo, como antes. */
  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limite?: string;

  @IsOptional()
  @Matches(/^\d{1,6}$/)
  pagina?: string;
}
