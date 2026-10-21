import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('versiones_rubrica_carreras')
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
}
