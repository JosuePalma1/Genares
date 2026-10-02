import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RubricCategory } from './rubric-category.entity';

@Entity('rubric_indicators')
@Unique('uq_rubric_indicators_category_order', ['category', 'order'])
export class RubricIndicator {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => RubricCategory, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: RubricCategory;

  @Column({ type: 'varchar', length: 40 })
  label!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 4, scale: 2 })
  maxScore!: string;

  @Column({ type: 'smallint' })
  order!: number;
}
