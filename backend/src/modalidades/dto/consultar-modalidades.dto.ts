import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConsultarModalidadesDto {
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsOptional()
  @IsBoolean()
  disponiblesParaFamilia?: boolean;
}
