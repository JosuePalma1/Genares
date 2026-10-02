import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../common/domain.enums';
import { UserAccount } from '../../people/entities/user-account.entity';
import { ThesisWork } from '../../works/entities/thesis-work.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_account_id' })
  recipient!: UserAccount;

  @ManyToOne(() => ThesisWork, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  // Ruta interna controlada por la aplicación; nunca es un canal de correo.
  @Column({ name: 'action_path', type: 'varchar', length: 300 })
  actionPath!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
