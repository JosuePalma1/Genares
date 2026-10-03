import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EtapaEvaluacion, EstadoEvaluacion } from '../../comun/enums-dominio';
import { PerfilEstudiante } from '../../personas/entidades/perfil-estudiante.entity';
import { VersionRubrica } from '../../rubricas/entidades/version-rubrica.entity';
import { InstantaneaRubrica } from '../../rubricas/instantanea-rubrica';
import { MiembroTribunal } from '../../tribunales/entidades/miembro-tribunal.entity';
import { TrabajoTitulacion } from '../../trabajos/entidades/trabajo-titulacion.entity';

@Entity('evaluaciones')
@Check(
  'chk_evaluaciones_stage_student',
  `("etapa" = 'ESCRITA' AND "id_estudiante" IS NULL) OR ("etapa" = 'ORAL' AND "id_estudiante" IS NOT NULL)`,
)
@Check(
  'chk_evaluaciones_closed_timestamp',
  `("estado" = 'BORRADOR' AND "cerrada_en" IS NULL) OR ("estado" = 'CERRADA' AND "cerrada_en" IS NOT NULL)`,
)
@Check('chk_evaluaciones_score_range', `"calificacion_total" >= 0 AND "calificacion_total" <= "instantanea_calificacion_maxima"`)
@Check(
  'chk_evaluaciones_snapshot_version',
  `"instantanea_rubrica" ? 'rubricVersionId' AND "instantanea_rubrica" ->> 'rubricVersionId' = "id_version_rubrica"::text`,
)
@Index('uq_evaluaciones_written_member_work', ['trabajo', 'tribunalMember'], {
  unique: true,
  where: `"etapa" = 'ESCRITA'`,
})
@Index('uq_evaluaciones_oral_member_work_student', ['trabajo', 'tribunalMember', 'estudiante'], {
  unique: true,
  where: `"etapa" = 'ORAL'`,
})
export class Evaluacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @ManyToOne(() => MiembroTribunal, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_miembro_tribunal' })
  tribunalMember!: MiembroTribunal;

  @ManyToOne(() => PerfilEstudiante, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: PerfilEstudiante | null;

  @ManyToOne(() => VersionRubrica, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_version_rubrica' })
  rubricVersion!: VersionRubrica;

  @Column({ type: 'enum', enum: EtapaEvaluacion, enumName: 'etapa_evaluacion_enum' })
  etapa!: EtapaEvaluacion;

  @Column({
    type: 'enum',
    enum: EstadoEvaluacion,
    enumName: 'estado_evaluacion_enum',
    default: EstadoEvaluacion.BORRADOR,
  })
  estado!: EstadoEvaluacion;

  @Column({ name: 'instantanea_rubrica', type: 'jsonb' })
  instantaneaRubrica!: InstantaneaRubrica;

  @Column({ name: 'calificacion_total', type: 'numeric', precision: 4, scale: 2, default: 0 })
  calificacionTotal!: string;

  @Column({ name: 'instantanea_calificacion_maxima', type: 'numeric', precision: 4, scale: 2 })
  instantaneaCalificacionMaxima!: string;

  @Column({ name: 'cerrada_en', type: 'timestamptz', nullable: true })
  cerradoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
