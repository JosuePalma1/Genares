import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ActivarVersionRubricaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  revision!: number;
}
