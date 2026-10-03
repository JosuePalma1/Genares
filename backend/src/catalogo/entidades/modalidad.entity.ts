import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('modalidades')
@Unique('uq_modalidades_code', ['codigo'])
export class Modalidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'varchar', length: 160 })
  nombre!: string;

  @Column({ name: 'esta_activo', type: 'boolean', default: true })
  estaActivo!: boolean;
}
