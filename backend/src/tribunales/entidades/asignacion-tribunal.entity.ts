import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoAsignacionTribunal } from '../../comun/enums-dominio';
import { CuentaUsuario } from '../../personas/entidades/cuenta-usuario.entity';
import { TrabajoTitulacion } from '../../trabajos/entidades/trabajo-titulacion.entity';

@Entity('asignaciones_tribunal')
@Index('uq_asignaciones_tribunal_current_work', ['trabajo'], {
  unique: true,
  where: `"estado" IN ('BORRADOR', 'CONFIRMADO')`,
})
export class AsignacionTribunal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @Column({
    type: 'enum',
    enum: EstadoAsignacionTribunal,
    enumName: 'estado_asignacion_tribunal_enum',
    default: EstadoAsignacionTribunal.BORRADOR,
  })
  estado!: EstadoAsignacionTribunal;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_id_cuenta' })
  assignedBy!: CuentaUsuario;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @Column({ name: 'confirmada_en', type: 'timestamptz', nullable: true })
  confirmadoEn!: Date | null;
}
