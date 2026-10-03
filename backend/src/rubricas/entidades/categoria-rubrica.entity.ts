import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { VersionRubrica } from './version-rubrica.entity';
import { EtapaRubrica } from './etapa-rubrica.entity';

@Entity('categorias_rubrica')
@Unique('uq_categorias_rubrica_version_code', ['rubricVersion', 'codigo'])
@Unique('uq_categorias_rubrica_version_order', ['rubricVersion', 'orden'])
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
}
