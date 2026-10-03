import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('roles')
@Unique('uq_roles_code', ['codigo'])
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  codigo!: string;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;
}
