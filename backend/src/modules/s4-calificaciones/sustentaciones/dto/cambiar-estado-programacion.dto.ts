import { IsIn } from 'class-validator';
import { EstadoSustentacion } from '../../../../common/domain/enums-dominio';

export class CambiarEstadoProgramacionDto {
  // Sin inicio ni fin real de la defensa: el único cambio de estado es cancelar.
  @IsIn([EstadoSustentacion.CANCELADA])
  estado!: EstadoSustentacion;
}
