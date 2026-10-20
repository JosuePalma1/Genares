import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';

const textoRecortado = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ActualizarModalidadDto {
  @IsInt()
  @Min(1)
  revision!: number;

  @Transform(textoRecortado)
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  codigo!: string;

  @Transform(textoRecortado)
  @IsString()
  @Length(1, 160)
  nombre!: string;

  @Transform(textoRecortado)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descripcion!: string | null;
}
