import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../catalog/entities/academic-period.entity';
import { Career } from '../../catalog/entities/career.entity';
import { Modality } from '../../catalog/entities/modality.entity';
import { WorkStatus } from '../../common/domain.enums';
import { UserAccount } from '../../people/entities/user-account.entity';
import { RubricVersion } from '../../rubrics/entities/rubric-version.entity';

@Entity('thesis_works')
@Unique('uq_thesis_works_code', ['code'])
export class ThesisWork {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'text' })
  title!: string;

  @ManyToOne(() => Modality, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'modality_id' })
  modality!: Modality;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod!: AcademicPeriod;

  @ManyToOne(() => Career, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'career_id' })
  career!: Career;

  // Se fija antes de iniciar la primera evaluación y nunca se reemplaza en el historial.
  @ManyToOne(() => RubricVersion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubric_version_id' })
  rubricVersion!: RubricVersion | null;

  @Column({
    type: 'enum',
    enum: WorkStatus,
    enumName: 'work_status_enum',
    default: WorkStatus.REGISTERED,
  })
  status!: WorkStatus;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_account_id' })
  createdBy!: UserAccount;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
