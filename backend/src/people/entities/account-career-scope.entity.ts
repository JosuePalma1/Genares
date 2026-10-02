import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Career } from '../../catalog/entities/career.entity';
import { UserAccount } from './user-account.entity';

@Entity('account_career_scopes')
@Unique('uq_account_career_scopes_account_career', ['account', 'career'])
export class AccountCareerScope {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: UserAccount;

  @ManyToOne(() => Career, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'career_id' })
  career!: Career;
}
