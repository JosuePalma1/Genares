import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Person } from './person.entity';

@Entity('user_accounts')
@Unique('uq_user_accounts_person', ['person'])
@Unique('uq_user_accounts_auth_subject', ['authSubject'])
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  // Se deja nulo en el login simulado. DIT podrá asociar aquí la identidad real.
  @Column({ name: 'auth_subject', type: 'varchar', length: 255, nullable: true })
  authSubject!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
