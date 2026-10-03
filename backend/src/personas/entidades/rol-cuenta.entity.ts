import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Rol } from './rol.entity';
import { CuentaUsuario } from './cuenta-usuario.entity';

@Entity('roles_cuenta')
@Unique('uq_roles_cuenta_account_role', ['cuenta', 'role'])
export class RolCuenta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cuenta' })
  cuenta!: CuentaUsuario;

  @ManyToOne(() => Rol, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rol' })
  role!: Rol;

  @CreateDateColumn({ name: 'asignada_en', type: 'timestamptz' })
  asignadoEn!: Date;
}
