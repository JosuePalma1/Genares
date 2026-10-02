import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EvaluationStage } from '../../common/domain.enums';
import { RubricVersion } from './rubric-version.entity';

@Entity('rubric_categories')
@Unique('uq_rubric_categories_version_code', ['rubricVersion', 'code'])
@Unique('uq_rubric_categories_version_order', ['rubricVersion', 'order'])
export class RubricCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => RubricVersion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rubric_version_id' })
  rubricVersion!: RubricVersion;

  @Column({ type: 'enum', enum: EvaluationStage, enumName: 'evaluation_stage_enum' })
  stage!: EvaluationStage;

  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ type: 'varchar', length: 240 })
  name!: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 4, scale: 2 })
  maxScore!: string;

  @Column({ type: 'smallint' })
  order!: number;
}
