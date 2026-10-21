import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CerrarEvaluacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;
}
