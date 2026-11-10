import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoVersionRubrica } from '../../../../common/domain/enums-dominio';

export class ConsultarRubricasDto {
  @IsOptional()
  @IsUUID('loose')
  modalidadId?: string;

  @IsOptional()
  @IsUUID('loose')
  periodoId?: string;

  @IsOptional()
  @IsEnum(EstadoVersionRubrica)
  estado?: EstadoVersionRubrica;
}
