import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('consecutivos_acta')
export class ConsecutivoActa {
  @PrimaryColumn({ name: 'id_carrera', type: 'uuid' }) carreraId!: string;
  @PrimaryColumn({ type: 'varchar', length: 6 }) periodo!: string;
  @Column({ type: 'integer' }) ultimo!: number;
}
