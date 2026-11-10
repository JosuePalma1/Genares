import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 's4', name: 'consecutivos_acta' })
export class ConsecutivoActa {
  @PrimaryColumn({ name: 'id_carrera', type: 'uuid' }) carreraId!: string;
  @PrimaryColumn({ type: 'varchar', length: 6 }) periodo!: string;
  @Column({ type: 'integer' }) ultimo!: number;
}
