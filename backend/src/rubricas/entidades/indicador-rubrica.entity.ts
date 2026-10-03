import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CategoriaRubrica } from './categoria-rubrica.entity';

@Entity('indicadores_rubrica')
@Unique('uq_indicadores_rubrica_category_order', ['categoria', 'orden'])
export class IndicadorRubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CategoriaRubrica, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_categoria' })
  categoria!: CategoriaRubrica;

  @Column({ type: 'varchar', length: 40 })
  label!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ name: 'calificacion_maxima', type: 'numeric', precision: 4, scale: 2 })
  calificacionMaxima!: string;

  @Column({ type: 'smallint' })
  orden!: number;
}
