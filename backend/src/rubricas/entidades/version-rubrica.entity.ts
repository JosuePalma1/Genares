import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PeriodoAcademico } from '../../catalogo/entidades/periodo-academico.entity';
import { EstadoVersionRubrica } from '../../comun/enums-dominio';
import { Rubrica } from './rubrica.entity';

@Entity('versiones_rubrica')
@Unique('uq_versiones_rubrica_rubric_version', ['rubrica', 'version'])
@Index('uq_versiones_rubrica_active_period', ['rubrica', 'academicPeriod'], {
  unique: true,
  where: `"estado" = 'ACTIVA'`,
})
export class VersionRubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Rubrica, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rubrica' })
  rubrica!: Rubrica;

  @ManyToOne(() => PeriodoAcademico, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_academico_id' })
  academicPeriod!: PeriodoAcademico;

  @Column({ type: 'varchar', length: 30 })
  version!: string;

  @Column({
    type: 'enum',
    enum: EstadoVersionRubrica,
    enumName: 'estado_version_rubrica_enum',
    default: EstadoVersionRubrica.BORRADOR,
  })
  estado!: EstadoVersionRubrica;

  @Column({ name: 'activada_en', type: 'timestamptz', nullable: true })
  activadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
