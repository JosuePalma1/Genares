import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeacherProfile } from '../../people/entities/teacher-profile.entity';
import { UserAccount } from '../../people/entities/user-account.entity';
import { ThesisWork } from './thesis-work.entity';

@Entity('work_tutor_assignments')
@Index('uq_work_tutor_assignments_active_work', ['work'], {
  unique: true,
  where: '"ended_at" IS NULL',
})
export class WorkTutorAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ThesisWork, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @ManyToOne(() => TeacherProfile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: TeacherProfile;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_account_id' })
  assignedBy!: UserAccount;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
