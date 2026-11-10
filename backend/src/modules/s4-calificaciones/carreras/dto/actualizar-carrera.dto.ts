import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class ActualizarCarreraDto {
  @IsInt()
  @Min(1)
  revision!: number;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 160)
  nombre!: string;
}
