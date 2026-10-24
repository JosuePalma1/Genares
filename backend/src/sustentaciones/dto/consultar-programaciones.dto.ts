import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EstadoSustentacion } from '../../comun/enums-dominio';

export class ConsultarProgramacionesDto {
  @IsOptional()
  @IsUUID('4')
  carreraId?: string;

  @IsOptional()
  @IsUUID('4')
  periodoId?: string;

  @IsOptional()
  @IsIn([...Object.values(EstadoSustentacion), 'COMPLETADA'])
  estado?: EstadoSustentacion | 'COMPLETADA';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  buscar?: string;
}
