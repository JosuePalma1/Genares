import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EtapaEvaluacion, AlcanceEtapaRubrica } from '../../comun/enums-dominio';
import { VersionRubrica } from './version-rubrica.entity';

@Entity('etapas_rubrica')
@Unique('uq_etapas_rubrica_version_kind', ['rubricVersion', 'kind'])
@Unique('uq_etapas_rubrica_version_order', ['rubricVersion', 'orden'])
export class EtapaRubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VersionRubrica, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_version_rubrica' })
  rubricVersion!: VersionRubrica;

  // El tipo mantiene las dos reglas del flujo: trabajo escrito compartido y oral individual.
  @Column({ type: 'enum', enum: EtapaEvaluacion, enumName: 'etapa_evaluacion_enum' })
  kind!: EtapaEvaluacion;

  @Column({ type: 'enum', enum: AlcanceEtapaRubrica, enumName: 'alcance_etapa_rubrica_enum' })
  scope!: AlcanceEtapaRubrica;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'varchar', length: 220 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ name: 'calificacion_maxima', type: 'numeric', precision: 5, scale: 2 })
  calificacionMaxima!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  porcentaje!: string | null;

  @Column({ type: 'smallint' })
  orden!: number;
}
