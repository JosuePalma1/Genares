import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PeriodoAcademico } from '../../catalogo/entidades/periodo-academico.entity';
import { Carrera } from '../../catalogo/entidades/carrera.entity';
import { Modalidad } from '../../catalogo/entidades/modalidad.entity';
import { EstadoTrabajo } from '../../comun/enums-dominio';
import { CuentaUsuario } from '../../personas/entidades/cuenta-usuario.entity';
import { VersionRubrica } from '../../rubricas/entidades/version-rubrica.entity';

@Entity('trabajos_titulacion')
@Unique('uq_trabajos_titulacion_code', ['codigo'])
export class TrabajoTitulacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'text' })
  titulo!: string;

  @ManyToOne(() => Modalidad, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_modalidad' })
  modalidad!: Modalidad;

  @ManyToOne(() => PeriodoAcademico, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_academico_id' })
  academicPeriod!: PeriodoAcademico;

  @ManyToOne(() => Carrera, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_carrera' })
  carrera!: Carrera;

  // Se fija antes de iniciar la primera evaluación y nunca se reemplaza en el historial.
  @ManyToOne(() => VersionRubrica, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_version_rubrica' })
  rubricVersion!: VersionRubrica | null;

  @Column({
    type: 'enum',
    enum: EstadoTrabajo,
    enumName: 'estado_trabajo_enum',
    default: EstadoTrabajo.REGISTRADO,
  })
  estado!: EstadoTrabajo;

  @ManyToOne(() => CuentaUsuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id_cuenta' })
  createdBy!: CuentaUsuario;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
