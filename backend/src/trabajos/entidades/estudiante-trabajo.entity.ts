import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PerfilEstudiante } from '../../personas/entidades/perfil-estudiante.entity';
import { TrabajoTitulacion } from './trabajo-titulacion.entity';

@Entity('estudiantes_trabajo')
@Unique('uq_estudiantes_trabajo_work_student', ['trabajo', 'estudiante'])
@Unique('uq_estudiantes_trabajo_work_order', ['trabajo', 'ordenAutoria'])
export class EstudianteTrabajo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @ManyToOne(() => PerfilEstudiante, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: PerfilEstudiante;

  @Column({ name: 'orden_autoria', type: 'smallint' })
  ordenAutoria!: number;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
