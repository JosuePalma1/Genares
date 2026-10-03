import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('personas')
@Unique('uq_personas_identificacion_nacional', ['nationalId'])
export class Persona {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'identificacion_nacional', type: 'varchar', length: 20 })
  nationalId!: string;

  @Column({ name: 'nombres', type: 'varchar', length: 160 })
  givenNames!: string;

  @Column({ type: 'varchar', length: 160 })
  surnames!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
