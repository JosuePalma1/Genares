import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CrearCarreraDto {
  @Transform(recortar)
  @IsString()
  @Length(1, 30)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  codigo!: string;

  @Transform(recortar)
  @IsString()
  @Length(1, 160)
  nombre!: string;

  @IsBoolean()
  estaActivo!: boolean;
}
