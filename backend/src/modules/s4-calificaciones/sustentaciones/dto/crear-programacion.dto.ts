import {
  IsBoolean, ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { HorarioSalaDto } from './horario-sala.dto';

export class CrearProgramacionDto extends HorarioSalaDto {
  @IsOptional() @IsBoolean() confirmarAdvertencia?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) motivoExcepcion?: string;

  @IsUUID('loose')
  idTrabajo!: string;

  /**
   * Participantes de la sesión (RN-28). Si se omite, la sesión incluye a todos los estudiantes
   * del trabajo que aún no tienen programación; con uno solo se crea una sesión separada.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('loose', { each: true })
  idEstudiantes?: string[];
}
