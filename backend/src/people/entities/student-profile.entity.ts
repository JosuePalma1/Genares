import {
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Career } from '../../catalog/entities/career.entity';
import { Person } from './person.entity';

@Entity('student_profiles')
@Unique('uq_student_profiles_person', ['person'])
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @ManyToOne(() => Career, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'career_id' })
  career!: Career;
}
