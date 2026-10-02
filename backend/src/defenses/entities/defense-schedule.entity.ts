import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DefenseStatus } from '../../common/domain.enums';
import { UserAccount } from '../../people/entities/user-account.entity';
import { ThesisWork } from '../../works/entities/thesis-work.entity';

@Entity('defense_schedules')
export class DefenseSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => ThesisWork, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate!: string;

  @Column({ name: 'scheduled_time', type: 'time without time zone' })
  scheduledTime!: string;

  @Column({ type: 'varchar', length: 160 })
  room!: string;

  @Column({
    type: 'enum',
    enum: DefenseStatus,
    enumName: 'defense_status_enum',
    default: DefenseStatus.SCHEDULED,
  })
  status!: DefenseStatus;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scheduled_by_account_id' })
  scheduledBy!: UserAccount;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
