import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Carrera } from '../../catalogo/entidades/carrera.entity';
import { CuentaUsuario } from './cuenta-usuario.entity';

@Entity('alcances_carrera_cuenta')
@Unique('uq_alcances_carrera_cuenta_account_career', ['cuenta', 'carrera'])
export class AlcanceCarreraCuenta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cuenta' })
  cuenta!: CuentaUsuario;

  @ManyToOne(() => Carrera, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_carrera' })
  carrera!: Carrera;
}
