import { IsBoolean, IsInt, Min } from 'class-validator';

export class CambiarEstadoCarreraDto {
  @IsInt()
  @Min(1)
  revision!: number;

  @IsBoolean()
  estaActivo!: boolean;
}
