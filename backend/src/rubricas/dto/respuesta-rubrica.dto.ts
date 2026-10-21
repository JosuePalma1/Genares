import {
  AlcanceEtapaRubrica,
  EstadoVersionRubrica,
  EtapaEvaluacion,
} from '../../comun/enums-dominio';

export interface ModalidadRubricaDto {
  id: string;
  codigo: string;
  nombre: string;
}

export interface PeriodoRubricaCatalogoDto {
  id: string;
  codigo: string;
}

export interface CatalogosRubricaDto {
  modalidades: ModalidadRubricaDto[];
  periodos: PeriodoRubricaCatalogoDto[];
}

export interface PeriodoRubricaDto {
  id: string;
  codigo: string;
}

export interface VersionRubricaResumenDto {
  id: string;
  version: string;
  revision: number;
  estado: EstadoVersionRubrica;
  periodo: PeriodoRubricaDto;
  activadaEn: string | null;
  creadaEn: string;
}

export interface RubricaListadoDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  modalidad: ModalidadRubricaDto;
  versiones: VersionRubricaResumenDto[];
}

export interface IndicadorRubricaDto {
  id: string;
  label: string;
  descripcion: string;
  calificacionMaxima: string;
  orden: number;
}

export interface CategoriaRubricaDto {
  id: string;
  codigo: string;
  nombre: string;
  calificacionMaxima: string;
  orden: number;
  indicadores: IndicadorRubricaDto[];
}

export interface EtapaRubricaDto {
  id: string;
  tipo: EtapaEvaluacion;
  alcance: AlcanceEtapaRubrica;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  calificacionMaxima: string;
  porcentaje: string | null;
  orden: number;
  categorias: CategoriaRubricaDto[];
}

export interface VersionRubricaDetalleDto extends VersionRubricaResumenDto {
  etapas: EtapaRubricaDto[];
}

export interface CarreraVersionRubricaDto {
  id: string;
  codigo: string;
  nombre: string;
  vigente: boolean;
}

export interface VersionRubricaCompletaDto extends VersionRubricaDetalleDto {
  rubrica: {
    id: string;
    nombre: string;
    descripcion: string | null;
    modalidad: ModalidadRubricaDto;
  };
  carreras: CarreraVersionRubricaDto[];
}

export interface VersionesRubricaDto {
  rubricaId: string;
  versiones: VersionRubricaDetalleDto[];
}

export interface ActivacionVersionRubricaDto {
  activada: VersionRubricaResumenDto;
  archivada: VersionRubricaResumenDto | null;
}
