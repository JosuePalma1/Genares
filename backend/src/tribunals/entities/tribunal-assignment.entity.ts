import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TribunalAssignmentStatus } from '../../common/domain.enums';
import { UserAccount } from '../../people/entities/user-account.entity';
import { ThesisWork } from '../../works/entities/thesis-work.entity';

@Entity('tribunal_assignments')
@Index('uq_tribunal_assignments_current_work', ['work'], {
  unique: true,
  where: `"status" IN ('DRAFT', 'CONFIRMED')`,
})
export class TribunalAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ThesisWork, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @Column({
    type: 'enum',
    enum: TribunalAssignmentStatus,
    enumName: 'tribunal_assignment_status_enum',
    default: TribunalAssignmentStatus.DRAFT,
  })
  status!: TribunalAssignmentStatus;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_account_id' })
  assignedBy!: UserAccount;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;
}
