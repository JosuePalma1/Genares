import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'gen', name: 'periodo_academico' })
@Unique('uq_periodos_academicos_code', ['codigo'])
export class PeriodoAcademico {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio!: string | null;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin!: string | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  estaActivo!: boolean;
}
