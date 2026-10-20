import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Rubrica } from './rubrica.entity';
import { VersionRubrica } from './version-rubrica.entity';
import { Modalidad } from '../../catalogo/entidades/modalidad.entity';

@Entity('auditoria_rubricas')
@Index('idx_auditoria_rubricas_rubrica_fecha', ['rubrica', 'ocurridoEn'])
@Index('idx_auditoria_modalidad_fecha', ['modalidad', 'ocurridoEn'])
export class EventoAuditoriaRubrica {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'varchar', length: 255 })
  actorId!: string;

  @Column({ type: 'varchar', length: 64 })
  accion!: string;

  @ManyToOne(() => Rubrica, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubrica_id' })
  rubrica!: Rubrica | null;

  @ManyToOne(() => Modalidad, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'modalidad_id' })
  modalidad!: Modalidad | null;

  @ManyToOne(() => VersionRubrica, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  version!: VersionRubrica | null;

  @CreateDateColumn({ name: 'ocurrido_en', type: 'timestamptz' })
  ocurridoEn!: Date;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId!: string | null;
}
