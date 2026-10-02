import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('careers')
@Unique('uq_careers_code', ['code'])
export class Career {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
