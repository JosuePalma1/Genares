import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PerfilEstudiante } from '../../personas/entidades/perfil-estudiante.entity';
import { TrabajoTitulacion } from '../../trabajos/entidades/trabajo-titulacion.entity';
import { Evaluacion } from './evaluacion.entity';

@Entity('traspasos_evaluacion_estudiante')
@Unique('uq_traspasos_evaluacion_estudiante_origen_estudiante', ['evaluacion', 'estudiante'])
export class TraspasoEvaluacionEstudiante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Evaluacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_evaluacion' })
  evaluacion!: Evaluacion;

  @ManyToOne(() => TrabajoTitulacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_trabajo' })
  trabajo!: TrabajoTitulacion;

  @ManyToOne(() => PerfilEstudiante, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: PerfilEstudiante;

  @CreateDateColumn({ name: 'traspasado_en', type: 'timestamptz' })
  traspasadoEn!: Date;
}
