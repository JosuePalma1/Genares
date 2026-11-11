import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min,
} from 'class-validator';

export class CrearProgramacionDto {
  @IsUUID('loose')
  idTrabajo!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaProgramada!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/)
  horaProgramada!: string;

  @IsString()
  @MaxLength(160)
  sala!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  duracionEstimadaMinutos?: number;

  /**
   * Participantes de la sesión (RN-28). Si se omite, la sesión incluye a todos los estudiantes
   * del trabajo que aún no tienen programación; con uno solo se crea una sesión separada.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('loose', { each: true })
  idEstudiantes?: string[];
}
