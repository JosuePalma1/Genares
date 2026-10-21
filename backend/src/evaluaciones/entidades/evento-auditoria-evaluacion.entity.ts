import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Evaluacion } from './evaluacion.entity';

@Entity('eventos_auditoria_evaluacion')
@Index('idx_eventos_auditoria_evaluacion_origen_fecha', ['evaluacion', 'ocurridoEn'])
export class EventoAuditoriaEvaluacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Evaluacion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_evaluacion' })
  evaluacion!: Evaluacion;

  @Column({ name: 'actor_id', type: 'varchar', length: 255 })
  actorId!: string;

  @Column({ name: 'accion', type: 'varchar', length: 64 })
  accion!: string;

  @Column({ name: 'detalles', type: 'jsonb', default: () => "'{}'::jsonb" })
  detalles!: Record<string, unknown>;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ name: 'ocurrido_en', type: 'timestamptz' })
  ocurridoEn!: Date;
}
