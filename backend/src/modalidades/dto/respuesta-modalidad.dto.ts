export interface VersionModalidadDto {
  id: string;
  version: string;
  estado: string;
  revision: number;
  periodo: { id: string; codigo: string };
  activadaEn: string | null;
}

export interface FamiliaModalidadDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidadVersiones: number;
  versiones?: VersionModalidadDto[];
}

export interface ModalidadDto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estaActivo: boolean;
  revision: number;
  creadoEn: string;
  actualizadoEn: string;
  familiaRubricas: FamiliaModalidadDto | null;
}
