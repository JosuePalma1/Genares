import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StudentProfile } from '../../people/entities/student-profile.entity';
import { ThesisWork } from './thesis-work.entity';

@Entity('work_students')
@Unique('uq_work_students_work_student', ['work', 'student'])
@Unique('uq_work_students_work_order', ['work', 'authorOrder'])
export class WorkStudent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ThesisWork, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work!: ThesisWork;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column({ name: 'author_order', type: 'smallint' })
  authorOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
