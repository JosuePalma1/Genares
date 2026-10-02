import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('roles')
@Unique('uq_roles_code', ['code'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;
}
