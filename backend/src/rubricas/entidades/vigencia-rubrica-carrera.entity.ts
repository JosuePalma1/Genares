import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vigencias_rubrica_carrera')
@Index('uq_vigencia_rubrica_actual_carrera_modalidad_periodo',
  ['carreraId', 'modalidadId', 'periodoAcademicoId'],
  { unique: true, where: '"vigente_hasta" IS NULL' },
)
@Index('idx_vigencias_rubrica_carrera_historial',
  ['carreraId', 'modalidadId', 'periodoAcademicoId', 'vigenteDesde'],
)
@Index('idx_vigencias_rubrica_version_historial', ['versionId', 'carreraId', 'vigenteDesde'])
export class VigenciaRubricaCarrera {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'id_version_rubrica', type: 'uuid' })
  versionId!: string;

  @Column({ name: 'id_carrera', type: 'uuid' })
  carreraId!: string;

  @Column({ name: 'id_rubrica', type: 'uuid' })
  rubricaId!: string;

  @Column({ name: 'id_modalidad', type: 'uuid' })
  modalidadId!: string;

  @Column({ name: 'periodo_academico_id', type: 'uuid' })
  periodoAcademicoId!: string;

  @Column({ name: 'vigente_desde', type: 'timestamptz', default: () => 'clock_timestamp()' })
  vigenteDesde!: Date;

  @Column({ name: 'vigente_hasta', type: 'timestamptz', nullable: true })
  vigenteHasta!: Date | null;
}
