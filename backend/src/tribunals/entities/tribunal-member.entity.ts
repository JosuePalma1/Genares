import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TeacherProfile } from '../../people/entities/teacher-profile.entity';
import { TribunalAssignment } from './tribunal-assignment.entity';

@Entity('tribunal_members')
@Unique('uq_tribunal_members_assignment_position', ['assignment', 'position'])
@Unique('uq_tribunal_members_assignment_teacher', ['assignment', 'teacher'])
export class TribunalMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TribunalAssignment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: TribunalAssignment;

  @ManyToOne(() => TeacherProfile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: TeacherProfile;

  @Column({ type: 'smallint' })
  position!: 1 | 2;
}
