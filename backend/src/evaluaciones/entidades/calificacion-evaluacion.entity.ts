import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IndicadorRubrica } from '../../rubricas/entidades/indicador-rubrica.entity';
import { Evaluacion } from './evaluacion.entity';

@Entity('calificaciones_evaluacion')
@Unique('uq_calificaciones_evaluacion_evaluation_indicator', ['evaluacion', 'indicador'])
@Check('chk_calificaciones_evaluacion_non_negative', `"score" >= 0`)
@Check('chk_calificaciones_evaluacion_maximum', `"score" <= "instantanea_calificacion_maxima"`)
@Check('chk_calificaciones_evaluacion_snapshot_positive', `"instantanea_calificacion_maxima" > 0`)
export class CalificacionEvaluacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Evaluacion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_evaluacion' })
  evaluacion!: Evaluacion;

  @ManyToOne(() => IndicadorRubrica, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_indicador' })
  indicador!: IndicadorRubrica;

  @Column({ type: 'numeric', precision: 4, scale: 2 })
  score!: string;

  @Column({ name: 'instantanea_calificacion_maxima', type: 'numeric', precision: 4, scale: 2 })
  instantaneaCalificacionMaxima!: string;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;
}
