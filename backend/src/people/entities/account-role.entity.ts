import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';
import { UserAccount } from './user-account.entity';

@Entity('account_roles')
@Unique('uq_account_roles_account_role', ['account', 'role'])
export class AccountRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: UserAccount;

  @ManyToOne(() => Role, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;
}
