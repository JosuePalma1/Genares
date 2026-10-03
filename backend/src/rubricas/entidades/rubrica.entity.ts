import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Modalidad } from '../../catalogo/entidades/modalidad.entity';

@Entity('rubricas')
@Unique('uq_rubricas_modality', ['modalidad'])
export class Rubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Modalidad, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_modalidad' })
  modalidad!: Modalidad;

  @Column({ type: 'varchar', length: 220 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
