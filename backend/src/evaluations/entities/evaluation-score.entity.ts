import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RubricIndicator } from '../../rubrics/entities/rubric-indicator.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_scores')
@Unique('uq_evaluation_scores_evaluation_indicator', ['evaluation', 'indicator'])
@Check('chk_evaluation_scores_non_negative', `"score" >= 0`)
@Check('chk_evaluation_scores_maximum', `"score" <= "max_score_snapshot"`)
@Check('chk_evaluation_scores_snapshot_positive', `"max_score_snapshot" > 0`)
export class EvaluationScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Evaluation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation!: Evaluation;

  @ManyToOne(() => RubricIndicator, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'indicator_id' })
  indicator!: RubricIndicator;

  @Column({ type: 'numeric', precision: 4, scale: 2 })
  score!: string;

  @Column({ name: 'max_score_snapshot', type: 'numeric', precision: 4, scale: 2 })
  maxScoreSnapshot!: string;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;
}
