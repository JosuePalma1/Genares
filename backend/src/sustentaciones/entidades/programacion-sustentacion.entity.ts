import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoSustentacion } from '../../comun/enums-dominio';
import { CuentaUsuario } from '../../personas/entidades/cuenta-usuario.entity';
import { TrabajoTitulacion } from '../../trabajos/entidades/trabajo-titulacion.entity';

@Entity('programaciones_sustentacion')
export class ProgramacionSustentacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @Column({ name: 'fecha_programada', type: 'date' })
  fechaProgramada!: string;

  @Column({ name: 'hora_programada', type: 'time without time zone' })
  horaProgramada!: string;

  @Column({ type: 'varchar', length: 160 })
  sala!: string;

  @Column({
    type: 'enum',
    enum: EstadoSustentacion,
    enumName: 'estado_sustentacion_enum',
    default: EstadoSustentacion.PROGRAMADA,
  })
  estado!: EstadoSustentacion;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scheduled_by_id_cuenta' })
  scheduledBy!: CuentaUsuario;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
