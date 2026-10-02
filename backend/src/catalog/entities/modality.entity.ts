import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('modalities')
@Unique('uq_modalities_code', ['code'])
export class Modality {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
