import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('carreras')
@Unique('uq_carreras_code', ['codigo'])
export class Carrera {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  codigo!: string;

  @Column({ type: 'varchar', length: 160 })
  nombre!: string;

  @Column({ name: 'esta_activo', type: 'boolean', default: true })
  estaActivo!: boolean;
}
