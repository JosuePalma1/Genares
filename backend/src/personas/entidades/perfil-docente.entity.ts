import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Carrera } from '../../catalogo/entidades/carrera.entity';
import { FuenteDirectorio } from '../../comun/enums-dominio';
import { Persona } from './persona.entity';

@Entity('perfiles_docente')
@Unique('uq_perfiles_docente_person', ['persona'])
export class PerfilDocente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona!: Persona;

  @ManyToOne(() => Carrera, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_carrera' })
  carrera!: Carrera;

  @Column({
    type: 'enum',
    enum: FuenteDirectorio,
    enumName: 'fuente_directorio_enum',
    default: FuenteDirectorio.MANUAL,
  })
  fuente!: FuenteDirectorio;

  @Column({ name: 'referencia_externa', type: 'varchar', length: 120, nullable: true })
  referenciaExterna!: string | null;

  @Column({ name: 'esta_activo', type: 'boolean', default: true })
  estaActivo!: boolean;
}
