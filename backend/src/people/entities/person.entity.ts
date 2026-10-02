import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('persons')
@Unique('uq_persons_national_id', ['nationalId'])
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'national_id', type: 'varchar', length: 20 })
  nationalId!: string;

  @Column({ name: 'given_names', type: 'varchar', length: 160 })
  givenNames!: string;

  @Column({ type: 'varchar', length: 160 })
  surnames!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
