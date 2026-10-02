import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Modality } from '../../catalog/entities/modality.entity';

@Entity('rubrics')
@Unique('uq_rubrics_modality', ['modality'])
export class Rubric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Modality, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'modality_id' })
  modality!: Modality;

  @Column({ type: 'varchar', length: 220 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
