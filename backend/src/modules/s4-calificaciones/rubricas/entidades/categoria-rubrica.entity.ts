import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VersionRubrica } from './version-rubrica.entity';
import { EtapaRubrica } from './etapa-rubrica.entity';

@Entity({ schema: 's4', name: 'categorias_rubrica' })
@Index('uq_categorias_rubrica_stage_code', ['etapa', 'codigo'], { unique: true, where: '"estado_registro" = 1' })
@Index('uq_categorias_rubrica_stage_order', ['etapa', 'orden'], { unique: true, where: '"estado_registro" = 1' })
export class CategoriaRubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VersionRubrica, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_version_rubrica' })
  rubricVersion!: VersionRubrica;

  @ManyToOne(() => EtapaRubrica, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_etapa_rubrica' })
  etapa!: EtapaRubrica;

  @Column({ type: 'varchar', length: 10 })
  codigo!: string;

  @Column({ type: 'varchar', length: 240 })
  nombre!: string;

  @Column({ name: 'calificacion_maxima', type: 'numeric', precision: 4, scale: 2 })
  calificacionMaxima!: string;

  @Column({ type: 'smallint' })
  orden!: number;

  @Column({ name: 'estado_registro', type: 'smallint', default: 1 })
  estadoRegistro!: 0 | 1;

  @Column({ name: 'creado_por', type: 'varchar', length: 255, nullable: true })
  creadoPor!: string | null;

  @Column({ name: 'actualizado_por', type: 'varchar', length: 255, nullable: true })
  actualizadoPor!: string | null;

  @Column({ name: 'actualizado_en', type: 'timestamptz', nullable: true })
  actualizadoEn!: Date | null;
}
