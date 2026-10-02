import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('academic_periods')
@Unique('uq_academic_periods_code', ['code'])
export class AcademicPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'starts_on', type: 'date', nullable: true })
  startsOn!: string | null;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
