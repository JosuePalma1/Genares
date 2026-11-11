import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ schema: 's4', name: 'versiones_rubrica_carreras' })
@Unique('uq_version_rubrica_carrera_contexto', [
  'versionId', 'carreraId', 'rubricaId', 'modalidadId', 'periodoAcademicoId',
])
@Index('idx_versiones_rubrica_carreras_carrera', ['carreraId', 'modalidadId', 'periodoAcademicoId'])
@Index('idx_versiones_rubrica_carreras_rubrica', ['rubricaId', 'versionId'])
export class VersionRubricaCarrera {
  @PrimaryColumn({ name: 'id_version_rubrica', type: 'uuid' })
  versionId!: string;

  @PrimaryColumn({ name: 'id_carrera', type: 'uuid' })
  carreraId!: string;

  @Column({ name: 'id_rubrica', type: 'uuid' })
  rubricaId!: string;

  @Column({ name: 'id_modalidad', type: 'uuid' })
  modalidadId!: string;

  @Column({ name: 'periodo_academico_id', type: 'uuid' })
  periodoAcademicoId!: string;

  @Column({ name: 'asociado_en', type: 'timestamptz', default: () => 'clock_timestamp()' })
  asociadoEn!: Date;

  @Column({ name: 'estado_registro', type: 'smallint', default: 1 })
  estadoRegistro!: 0 | 1;

  @Column({ name: 'creado_por', type: 'varchar', length: 255, nullable: true })
  creadoPor!: string | null;

  @Column({ name: 'actualizado_por', type: 'varchar', length: 255, nullable: true })
  actualizadoPor!: string | null;

  @Column({ name: 'actualizado_en', type: 'timestamptz', nullable: true })
  actualizadoEn!: Date | null;
}
