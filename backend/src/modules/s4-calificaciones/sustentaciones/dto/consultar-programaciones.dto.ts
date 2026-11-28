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
  @IsIn([...Object.values(EstadoSustentacion), 'COMPLETADA', 'PROXIMA', 'EN_CURSO_O_PENDIENTE'])
  estado?: EstadoSustentacion | 'COMPLETADA' | 'PROXIMA' | 'EN_CURSO_O_PENDIENTE';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  buscar?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orden?: 'ASC' | 'DESC';

  /** Con `limite` el listado se pagina; sin él se devuelve completo, como antes. */
  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limite?: string;

  @IsOptional()
  @Matches(/^\d{1,6}$/)
  pagina?: string;
}
