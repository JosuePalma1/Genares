import { IsString, Matches, MaxLength } from 'class-validator';
import { HorarioSalaDto } from './horario-sala.dto';

export class ActualizarProgramacionDto extends HorarioSalaDto {
  /** Motivo de la reprogramación (RN-27); queda en s4.eventos_trazabilidad_trabajo. */
  @IsString()
  @Matches(/\S/, { message: 'Indique el motivo de la reprogramación.' })
  @MaxLength(500)
  motivo!: string;
}
