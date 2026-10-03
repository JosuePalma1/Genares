import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Persona } from './persona.entity';

@Entity('cuentas_usuario')
@Unique('uq_cuentas_usuario_person', ['persona'])
@Unique('uq_cuentas_usuario_sujeto_autenticacion', ['sujetoAutenticacion'])
export class CuentaUsuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona!: Persona;

  // Se deja nulo en el login simulado. DIT podrá asociar aquí la identidad real.
  @Column({ name: 'sujeto_autenticacion', type: 'varchar', length: 255, nullable: true })
  sujetoAutenticacion!: string | null;

  @Column({ name: 'esta_activo', type: 'boolean', default: true })
  estaActivo!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
