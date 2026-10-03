import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoNotificacion } from '../../comun/enums-dominio';
import { CuentaUsuario } from '../../personas/entidades/cuenta-usuario.entity';
import { TrabajoTitulacion } from '../../trabajos/entidades/trabajo-titulacion.entity';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id_cuenta' })
  recipient!: CuentaUsuario;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @Column({
    type: 'enum',
    enum: TipoNotificacion,
    enumName: 'tipo_notificacion_enum',
  })
  type!: TipoNotificacion;

  @Column({ type: 'varchar', length: 180 })
  titulo!: string;

  @Column({ type: 'text' })
  mensaje!: string;

  // Ruta interna controlada por la aplicación; nunca es un canal de correo.
  @Column({ name: 'ruta_accion', type: 'varchar', length: 300 })
  rutaAccion!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @Column({ name: 'leida_en', type: 'timestamptz', nullable: true })
  leidoEn!: Date | null;
}
