import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvaluationStage, EvaluationStatus } from '../../common/domain.enums';
import { StudentProfile } from '../../people/entities/student-profile.entity';
import { RubricVersion } from '../../rubrics/entities/rubric-version.entity';
import { RubricSnapshot } from '../../rubrics/rubric-snapshot';
import { TribunalMember } from '../../tribunals/entities/tribunal-member.entity';
import { ThesisWork } from '../../works/entities/thesis-work.entity';

@Entity('evaluations')
@Check(
  'chk_evaluations_stage_student',
  `("stage" = 'WRITTEN' AND "student_id" IS NULL) OR ("stage" = 'ORAL' AND "student_id" IS NOT NULL)`,
)
@Check(
  'chk_evaluations_closed_timestamp',
  `("status" = 'DRAFT' AND "closed_at" IS NULL) OR ("status" = 'CLOSED' AND "closed_at" IS NOT NULL)`,
)
@Check('chk_evaluations_score_range', `"total_score" >= 0 AND "total_score" <= "max_score_snapshot"`)
@Check(
  'chk_evaluations_snapshot_version',
  `"rubric_snapshot" ? 'rubricVersionId' AND "rubric_snapshot" ->> 'rubricVersionId' = "rubric_version_id"::text`,
)
@Index('uq_evaluations_written_member_work', ['work', 'tribunalMember'], {
  unique: true,
  where: `"stage" = 'WRITTEN'`,
})
@Index('uq_evaluations_oral_member_work_student', ['work', 'tribunalMember', 'student'], {
  unique: true,
  where: `"stage" = 'ORAL'`,
})
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ThesisWork, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @ManyToOne(() => TribunalMember, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tribunal_member_id' })
  tribunalMember!: TribunalMember;

  @ManyToOne(() => StudentProfile, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile | null;

  @ManyToOne(() => RubricVersion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubric_version_id' })
  rubricVersion!: RubricVersion;

  @Column({ type: 'enum', enum: EvaluationStage, enumName: 'evaluation_stage_enum' })
  stage!: EvaluationStage;

  @Column({
    type: 'enum',
    enum: EvaluationStatus,
    enumName: 'evaluation_status_enum',
    default: EvaluationStatus.DRAFT,
  })
  status!: EvaluationStatus;

  @Column({ name: 'rubric_snapshot', type: 'jsonb' })
  rubricSnapshot!: RubricSnapshot;

  @Column({ name: 'total_score', type: 'numeric', precision: 4, scale: 2, default: 0 })
  totalScore!: string;

  @Column({ name: 'max_score_snapshot', type: 'numeric', precision: 4, scale: 2 })
  maxScoreSnapshot!: string;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
