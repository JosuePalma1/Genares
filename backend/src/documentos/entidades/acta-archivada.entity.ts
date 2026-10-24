import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Registro inmutable; las restricciones y triggers se definen en la migración 12000. */
@Entity('actas_archivadas')
@Unique(['numero'])
@Unique(['carreraId', 'periodo', 'consecutivo'])
@Unique(['trabajoId', 'estudianteId', 'formato'])
export class ActaArchivada {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 80 }) numero!: string;
  @Column({ name: 'id_carrera', type: 'uuid' }) carreraId!: string;
  @Column({ name: 'id_periodo', type: 'uuid' }) periodoId!: string;
  @Column({ type: 'varchar', length: 6 }) periodo!: string;
  @Column({ type: 'integer' }) consecutivo!: number;
  @Column({ name: 'id_trabajo', type: 'uuid' }) trabajoId!: string;
  @Column({ name: 'id_estudiante', type: 'uuid' }) estudianteId!: string;
  @Column({ type: 'varchar', length: 20 }) formato!: string;
  @Column({ type: 'smallint' }) revision!: number;
  @CreateDateColumn({ name: 'generado_en', type: 'timestamptz' }) generadoEn!: Date;
  @Column({ name: 'generado_por', type: 'varchar', length: 255 }) generadoPor!: string;
  @Column({ type: 'bytea', select: false }) pdf!: Buffer;
  @Column({ type: 'varchar', length: 64 }) sha256!: string;
  @Column({ name: 'nota_final', type: 'numeric', precision: 4, scale: 2, nullable: true }) notaFinal!: string | null;
  @Column({ name: 'nota_minima_aplicada', type: 'numeric', precision: 4, scale: 2, nullable: true }) notaMinimaAplicada!: string | null;
  @Column({ type: 'boolean', nullable: true }) aprobado!: boolean | null;
}
