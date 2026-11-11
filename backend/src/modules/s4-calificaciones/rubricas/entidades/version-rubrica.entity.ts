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
import { EstadoVersionRubrica } from '../../../../common/domain/enums-dominio';
import { Rubrica } from './rubrica.entity';

@Entity({ schema: 's4', name: 'versiones_rubrica' })
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

  @ManyToOne(() => VersionRubrica, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_version_base' })
  versionBase!: VersionRubrica | null;

  @Column({ type: 'varchar', length: 30 })
  version!: string;

  @Column({
    type: 'enum',
    enum: EstadoVersionRubrica,
    enumName: 'estado_version_rubrica_enum',
    default: EstadoVersionRubrica.BORRADOR,
  })
  estado!: EstadoVersionRubrica;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @Column({ name: 'activada_en', type: 'timestamptz', nullable: true })
  activadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @Column({ name: 'estado_registro', type: 'smallint', default: 1 })
  estadoRegistro!: 0 | 1;

  @Column({ name: 'creado_por', type: 'varchar', length: 255, nullable: true })
  creadoPor!: string | null;

  @Column({ name: 'actualizado_por', type: 'varchar', length: 255, nullable: true })
  actualizadoPor!: string | null;

  @Column({ name: 'actualizado_en', type: 'timestamptz', nullable: true })
  actualizadoEn!: Date | null;
}
