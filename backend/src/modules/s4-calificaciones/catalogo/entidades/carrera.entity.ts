import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'gen', name: 'carrera' })
@Unique('uq_carreras_code', ['codigo'])
export class Carrera {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  codigo!: string;

  @Column({ type: 'varchar', length: 160 })
  nombre!: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  estaActivo!: boolean;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
