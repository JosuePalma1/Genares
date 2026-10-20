import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Modalidad } from '../../catalogo/entidades/modalidad.entity';

@Entity('rubricas')
export class Rubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Modalidad, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_modalidad' })
  modalidad!: Modalidad;

  @Column({ type: 'varchar', length: 220 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

}
