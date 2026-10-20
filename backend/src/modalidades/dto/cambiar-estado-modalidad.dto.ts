import { IsBoolean, IsInt, Min } from 'class-validator';

export class CambiarEstadoModalidadDto {
  @IsInt()
  @Min(1)
  revision!: number;

  @IsBoolean()
  estaActivo!: boolean;
}
