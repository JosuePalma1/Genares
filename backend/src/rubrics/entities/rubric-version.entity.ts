import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AcademicPeriod } from '../../catalog/entities/academic-period.entity';
import { RubricVersionStatus } from '../../common/domain.enums';
import { Rubric } from './rubric.entity';

@Entity('rubric_versions')
@Unique('uq_rubric_versions_rubric_version', ['rubric', 'version'])
@Index('uq_rubric_versions_active_period', ['rubric', 'academicPeriod'], {
  unique: true,
  where: `"status" = 'ACTIVE'`,
})
export class RubricVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Rubric, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubric_id' })
  rubric!: Rubric;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod!: AcademicPeriod;

  @Column({ type: 'varchar', length: 30 })
  version!: string;

  @Column({
    type: 'enum',
    enum: RubricVersionStatus,
    enumName: 'rubric_version_status_enum',
    default: RubricVersionStatus.DRAFT,
  })
  status!: RubricVersionStatus;

  @Column({ name: 'written_max_score', type: 'numeric', precision: 4, scale: 2, default: 5 })
  writtenMaxScore!: string;

  @Column({ name: 'oral_max_score', type: 'numeric', precision: 4, scale: 2, default: 5 })
  oralMaxScore!: string;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
