import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Career } from '../../catalog/entities/career.entity';
import { DirectorySource } from '../../common/domain.enums';
import { Person } from './person.entity';

@Entity('teacher_profiles')
@Unique('uq_teacher_profiles_person', ['person'])
export class TeacherProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @ManyToOne(() => Career, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'career_id' })
  career!: Career;

  @Column({
    type: 'enum',
    enum: DirectorySource,
    enumName: 'directory_source_enum',
    default: DirectorySource.MANUAL,
  })
  source!: DirectorySource;

  @Column({ name: 'external_reference', type: 'varchar', length: 120, nullable: true })
  externalReference!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
