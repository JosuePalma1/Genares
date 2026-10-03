import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PerfilDocente } from '../../personas/entidades/perfil-docente.entity';
import { AsignacionTribunal } from './asignacion-tribunal.entity';

@Entity('miembros_tribunal')
@Unique('uq_miembros_tribunal_assignment_position', ['asignacion', 'position'])
@Unique('uq_miembros_tribunal_assignment_teacher', ['asignacion', 'docente'])
export class MiembroTribunal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => AsignacionTribunal, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_asignacion' })
  asignacion!: AsignacionTribunal;

  @ManyToOne(() => PerfilDocente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_docente' })
  docente!: PerfilDocente;

  @Column({ type: 'smallint' })
  position!: 1 | 2;
}
