import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('modalidades')
@Unique('uq_modalidades_code', ['codigo'])
export class Modalidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'varchar', length: 160 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ name: 'esta_activo', type: 'boolean', default: true })
  estaActivo!: boolean;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;

}
