import {
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Carrera } from '../../catalogo/entidades/carrera.entity';
import { Persona } from './persona.entity';

@Entity('perfiles_estudiante')
@Unique('uq_perfiles_estudiante_person', ['persona'])
export class PerfilEstudiante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona!: Persona;

  @ManyToOne(() => Carrera, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_carrera' })
  carrera!: Carrera;
}
