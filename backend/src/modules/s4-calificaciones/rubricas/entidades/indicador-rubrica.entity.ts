import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CategoriaRubrica } from './categoria-rubrica.entity';

@Entity({ schema: 's4', name: 'indicadores_rubrica' })
@Index('uq_indicadores_rubrica_category_order', ['categoria', 'orden'], { unique: true, where: '"estado_registro" = 1' })
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

  @Column({ name: 'estado_registro', type: 'smallint', default: 1 })
  estadoRegistro!: 0 | 1;

  @Column({ name: 'creado_por', type: 'varchar', length: 255, nullable: true })
  creadoPor!: string | null;

  @Column({ name: 'actualizado_por', type: 'varchar', length: 255, nullable: true })
  actualizadoPor!: string | null;

  @Column({ name: 'actualizado_en', type: 'timestamptz', nullable: true })
  actualizadoEn!: Date | null;
}
