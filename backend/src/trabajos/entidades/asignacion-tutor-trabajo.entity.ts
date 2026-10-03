import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PerfilDocente } from '../../personas/entidades/perfil-docente.entity';
import { CuentaUsuario } from '../../personas/entidades/cuenta-usuario.entity';
import { TrabajoTitulacion } from './trabajo-titulacion.entity';

@Entity('asignaciones_tutor_trabajo')
@Index('uq_asignaciones_tutor_trabajo_active_work', ['trabajo'], {
  unique: true,
  where: '"finalizada_en" IS NULL',
})
export class AsignacionTutorTrabajo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @ManyToOne(() => PerfilDocente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_docente' })
  docente!: PerfilDocente;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_id_cuenta' })
  assignedBy!: CuentaUsuario;

  @CreateDateColumn({ name: 'asignada_en', type: 'timestamptz' })
  asignadoEn!: Date;

  @Column({ name: 'finalizada_en', type: 'timestamptz', nullable: true })
  finalizadoEn!: Date | null;
}
