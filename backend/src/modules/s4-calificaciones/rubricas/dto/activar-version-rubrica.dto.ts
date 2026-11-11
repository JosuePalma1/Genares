import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ActivarVersionRubricaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  revision!: number;
}

/** RF-15/RF-20/RN-09: retira una versión activa de futuros usos sin alterar su contenido. */
export class RetirarVersionRubricaDto extends ActivarVersionRubricaDto {}
