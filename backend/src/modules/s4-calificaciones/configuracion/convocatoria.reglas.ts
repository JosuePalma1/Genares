import { BadRequestException, ConflictException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { InstantaneaRubrica } from '../rubricas/instantanea-rubrica';
import { detallarConsolidacionMer, validarPuntajesCierre } from '../evaluaciones/mer/borrador-oral.reglas';

export class PoliticaConvocatoriaDto {
  @IsInt() @Min(1) revision!: number;
  @IsBoolean() mismoPeriodo!: boolean;
  @IsBoolean() otroPeriodo!: boolean;
  @IsBoolean() revisar!: boolean;
  @IsIn(['CONSERVAR','REPETIR','ELEGIR']) escrita!: string;
  @IsOptional() @IsInt() @Min(1) @Max(36500) dias?: number | null;
  @IsIn(['APERTURA','RESULTADO']) inicio!: string;
}
export class AbrirConvocatoriaDto {
  @IsUUID('loose') periodo!: string;
  @IsInt() @Min(2) numero!: number;
  @IsArray() @ArrayUnique() @IsUUID('loose',{each:true}) conservar!: string[];
}
export class RevisarConvocatoriaDto {
  @IsInt() @Min(2) numero!: number;
  @IsString() @Matches(/\S/) @MaxLength(1500) motivo!: string;
}
class ValorDto {
  @IsUUID('loose') id!: string;
  @Matches(/^(?:0|[1-9]\d{0,4})(?:\.\d{1,4})?$/) nota!: string;
}
export class CalificarConvocatoriaDto {
  @IsUUID('loose') etapa!: string;
  @IsUUID('loose') evaluador!: string;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>ValorDto) valores!: ValorDto[];
}
export function validarEtapasIntento(rubrica: InstantaneaRubrica, conservar: string[], escrita: string) {
  const etapas = rubrica.stages;
  if (conservar.some(id=>!etapas.some(e=>e.id===id)) || etapas.every(e=>conservar.includes(e.id)))
    throw new BadRequestException('Elige al menos una etapa de la rúbrica para repetir.');
  if (etapas.some(e=>e.kind==='ESCRITA' && (escrita==='CONSERVAR' && !conservar.includes(e.id) || escrita==='REPETIR' && conservar.includes(e.id))))
    throw new ConflictException('La selección de etapas contradice la política vigente para la escrita.');
}
export function totalIndicadores(rubrica:InstantaneaRubrica, dto:CalificarConvocatoriaDto) {
  const indicadores=rubrica.categories.filter(c=>c.stageId===dto.etapa).flatMap(c=>c.indicators);
  try {validarPuntajesCierre(indicadores,dto.valores.map(v=>({idIndicador:v.id,score:Number(v.nota)})));}
  catch(error) {throw new BadRequestException((error as Error).message);}
  const unidades=dto.valores.reduce((s,v)=>{const [i,d='']=v.nota.split('.');return s+BigInt(i)*10000n+BigInt(d.padEnd(4,'0'));},0n);
  return (unidades/10000n).toString()+'.'+(unidades%10000n).toString().padStart(4,'0');
}
export interface Convocatoria {
  id:string; numero:number; estudiante:string; periodo:string; estado:string; escala:string; minimo:string;
  nota:string|null; rubrica:InstantaneaRubrica; evaluadores:{id:string;nombres:string;apellidos:string}[];
  redondeo:'HALF_UP'|'TRUNCAR'; vence:string|null; conservar:string[]; cerrada_en:Date|null;
}
export interface NotaConvocatoria {etapa:string;evaluador:string;total:string;valores:ValorDto[];origen:string|null}
export function resultadoConvocatoria(c:Convocatoria, notas:NotaConvocatoria[]) {
  return detallarConsolidacionMer(c.rubrica.stages,c.evaluadores.map(e=>e.id),notas.map(n=>({
    idEtapaRubrica:n.etapa,idAsignacionTribunal:n.evaluador,total:n.total,estado:'CERRADA',
    idEstudiante:c.rubrica.stages.find(e=>e.id===n.etapa)?.scope==='TRABAJO_COMPARTIDO'?null:c.estudiante
  })),c.estudiante,Number(c.escala),c.redondeo).resultadoFinal;
}
