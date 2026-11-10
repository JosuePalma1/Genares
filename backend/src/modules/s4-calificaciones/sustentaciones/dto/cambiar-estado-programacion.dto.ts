import { IsIn } from 'class-validator';
import { EstadoSustentacion } from '../../../../common/domain/enums-dominio';

export class CambiarEstadoProgramacionDto {
  @IsIn([
    EstadoSustentacion.EN_SUSTENTACION,
    EstadoSustentacion.FINALIZADA,
    EstadoSustentacion.CANCELADA,
  ])
  estado!: EstadoSustentacion;
}
