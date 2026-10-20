import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoVersionRubrica } from '../../comun/enums-dominio';

export class ConsultarRubricasDto {
  @IsOptional()
  @IsUUID('4')
  modalidadId?: string;

  @IsOptional()
  @IsUUID('4')
  periodoId?: string;

  @IsOptional()
  @IsEnum(EstadoVersionRubrica)
  estado?: EstadoVersionRubrica;
}
