import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsUUID,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { CAPACIDADES_POR_ROL } from '../../../common/api/capacidades-por-rol';

export class PermisosRolDto {
  @IsIn(Object.keys(CAPACIDADES_POR_ROL).filter((r) => r !== 'SUPERUSUARIO')) rol!: Exclude<
    keyof typeof CAPACIDADES_POR_ROL,
    'SUPERUSUARIO'
  >;
  @IsArray() @ArrayUnique() @IsIn(CAPACIDADES_POR_ROL.SUPERUSUARIO, { each: true }) permisos!: string[];
  @IsInt() @Min(0) revision!: number;
}
export const rolesFlujo = [
  'SUPERUSUARIO',
  'COORDINACION',
  'PRESIDENCIA',
  'SECRETARIA',
  'COMISION',
  'TRIBUNAL',
];
export const condicionesFlujo = [
  'REGISTRADO',
  'TRIBUNAL_ASIGNADO',
  'REVISION_ESCRITA_PENDIENTE',
  'REVISION_ESCRITA_COMPLETADA',
  'SUSTENTACION_PROGRAMADA',
  'SUSTENTACION_PENDIENTE',
  'EVALUACION_COMPLETADA',
  'FINALIZADO',
  'DOS_ESCRITAS_CERRADAS',
  'SOLICITUD_CORRECCION_APROBADA',
];
const nombres = [
  'Registrado',
  'Tribunal asignado',
  'Revisión escrita pendiente',
  'Revisión escrita completada',
  'Sustentación programada',
  'Sustentación pendiente',
  'Evaluación completada',
  'Finalizado',
];

export class PasoDto {
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/) id!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) nombre!: string;
  @IsIn(['AUTOMATICO', 'MANUAL']) tipo!: string;
  @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsString({ each: true }) condiciones!: string[];
  @IsArray() @ArrayMaxSize(6) @ArrayUnique() @IsIn(rolesFlujo, { each: true }) ejecutores!: string[];
  @IsArray() @ArrayMaxSize(6) @ArrayUnique() @IsIn(rolesFlujo, { each: true }) aprobadores!: string[];
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(['PROGRAMAR', 'CERRAR_ORAL', 'CERRAR_ESCRITA'], { each: true })
  exigirPara?: string[];
  @IsOptional() @IsIn(['BLOQUEAR','ADVERTIR','PERMITIR']) modoProgramacion?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(rolesFlujo, { each:true }) rolesExcepcion?: string[];
  @IsOptional() @IsString() pasoAprobacionExcepcion?: string;
  @IsBoolean() obligatorio!: boolean;
}
export class PublicarFlujoDto {
  @IsOptional() @IsIn(['HALF_UP', 'TRUNCAR']) redondeo?: string;
  @IsOptional() @Matches(/^(?:100(?:\.0{1,2})?|[1-9]?\d(?:\.\d{1,2})?)$/) umbral?: string;
  @IsOptional() @IsBoolean() evidenciaCorreccion?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(36500) diasCorreccion?: number;
  @IsOptional() @IsUUID('loose') carrera?: string;
  @IsOptional() @IsUUID('loose') modalidad?: string;
  @IsOptional() @IsUUID('loose') periodo?: string;
  @IsInt() @Min(1) @Max(2147483646) version!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PasoDto)
  pasos!: PasoDto[];
}
export class SimularFlujoDto extends PublicarFlujoDto {
  @IsArray() @ArrayUnique() @IsIn(condicionesFlujo, { each:true }) hechos!: string[];
  @IsArray() @ArrayUnique() @IsString({each:true}) manuales!: string[];
  @IsOptional() @IsUUID('loose') carreraEjemplo?: string;
  @IsOptional() @IsUUID('loose') modalidadEjemplo?: string;
  @IsOptional() @IsUUID('loose') periodoEjemplo?: string;
  @Matches(/^(?:0|[1-9]\d{0,2})(?:\.\d{1,8})?$/) nota!: string;
  @IsInt() @Min(1) @Max(100) escala!: number;
  @IsIn(rolesFlujo) rol!: string;
}
export class DecisionPasoDto {
  @IsIn(['SOLICITAR', 'APROBAR', 'RECHAZAR']) accion!: string;
}
export const pasosIniciales: PasoDto[] = nombres.map((nombre, i) => ({
  id: condicionesFlujo[i].toLowerCase(),
  nombre,
  tipo: 'AUTOMATICO',
  condiciones: [condicionesFlujo[i]],
  ejecutores: [],
  aprobadores: [],
  obligatorio: false,
  exigirPara: i === 3 ? ['PROGRAMAR'] : [],
}));
export function validarFlujo(pasos: PasoDto[]) {
  const previos = new Set<string>();
  const causas = new Map<string, string[]>();
  const posteriores: Record<string, string[]> = {
    PROGRAMAR: ['SUSTENTACION_PROGRAMADA', 'SUSTENTACION_PENDIENTE', 'EVALUACION_COMPLETADA', 'FINALIZADO'],
    CERRAR_ESCRITA: [
      'REVISION_ESCRITA_COMPLETADA',
      'DOS_ESCRITAS_CERRADAS',
      'EVALUACION_COMPLETADA',
      'FINALIZADO',
    ],
    CERRAR_ORAL: ['EVALUACION_COMPLETADA', 'FINALIZADO'],
    FINALIZAR: ['FINALIZADO'],
  };
  for (const p of pasos) {
    if (
      previos.has('paso:' + p.id) ||
      p.condiciones.some((c) => !condicionesFlujo.includes(c) && !previos.has(c))
    )
      throw new BadRequestException(
        'Cada paso necesita un identificador único y solo puede depender de hechos conocidos o de pasos anteriores.',
      );
    if (
      p.tipo === 'MANUAL'
        ? !p.ejecutores.length
        : !p.condiciones.length || p.ejecutores.length || p.aprobadores.length
    )
      throw new BadRequestException(
        'Un paso manual requiere ejecutores. Un paso automático requiere condiciones y se cumple sin intervención.',
      );
    if (p.pasoAprobacionExcepcion) {
      const aprobacion = pasos.find(s => s.id === p.pasoAprobacionExcepcion);
      if (aprobacion?.tipo !== 'MANUAL' || !aprobacion.aprobadores.length ||
          !previos.has('paso:' + aprobacion.id) || !p.rolesExcepcion?.length) {
        throw new BadRequestException('La excepción requiere un paso manual anterior con aprobadores y un rol que la registre.');
      }
    }
    const hechos = p.condiciones.flatMap((c) => causas.get(c) ?? [c]);
    causas.set('paso:' + p.id, hechos);
    for (const accion of [...(p.exigirPara ?? []), ...(p.obligatorio ? ['FINALIZAR'] : [])]) {
      if (hechos.some((h) => posteriores[accion].includes(h)))
        throw new BadRequestException('El paso ' + p.nombre + ' depende de la acción que intenta autorizar.');
    }
    previos.add('paso:' + p.id);
  }
}
export function evaluarProgramacion(pasos: Array<PasoDto & { cumplido: boolean }>, rol: string) {
  const impedimentos: string[] = [];
  const advertencias: string[] = [];
  const excepciones: string[] = [];
  for (const p of pasos) {
    if (p.cumplido || !p.exigirPara?.includes('PROGRAMAR') || p.modoProgramacion === 'PERMITIR') continue;
    if (p.modoProgramacion === 'ADVERTIR') {
      advertencias.push(p.nombre);
      continue;
    }
    const aprobado = !p.pasoAprobacionExcepcion || pasos.some(s => s.id === p.pasoAprobacionExcepcion && s.cumplido);
    if (p.rolesExcepcion?.includes(rol) && aprobado) excepciones.push(p.nombre);
    else impedimentos.push(p.nombre);
  }
  return { impedimentos, advertencias, excepciones };
}
export interface Movimiento {
  paso: string;
  accion: string;
  actor: string;
}
export function resolverPasos(
  pasos: PasoDto[],
  hechos: Set<string>,
  movimientos: Movimiento[],
  rol: string,
  actor: string,
) {
  const confirmados = new Set(hechos);
  const ultimo = new Map(movimientos.map((m) => [m.paso, m]));
  return pasos.map((p) => {
    const anterior = ultimo.get(p.id);
    const habilitado = p.condiciones.every((c) => confirmados.has(c));
    const cumplido = p.tipo === 'MANUAL' ? anterior?.accion === 'CUMPLIDO' : habilitado;
    if (cumplido) confirmados.add('paso:' + p.id);
    const pendiente = anterior?.accion === 'SOLICITADO';
    const acciones: string[] = [];
    if (p.tipo === 'MANUAL' && habilitado && !cumplido) {
      if (!pendiente && (rol === 'SUPERUSUARIO' || p.ejecutores.includes(rol))) acciones.push('SOLICITAR');
      if (pendiente && anterior.actor !== actor && (rol === 'SUPERUSUARIO' || p.aprobadores.includes(rol)))
        acciones.push('APROBAR', 'RECHAZAR');
    }
    return { ...p, cumplido, estado: cumplido ? 'CUMPLIDO' : (anterior?.accion ?? 'PENDIENTE'), acciones };
  });
}
