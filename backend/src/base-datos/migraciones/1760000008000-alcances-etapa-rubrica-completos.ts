import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlcancesEtapaRubricaCompletos1760000008000 implements MigrationInterface {
  nombre = 'AlcancesEtapaRubricaCompletos1760000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.actualizarFuncion(queryRunner, (definicion) => {
      const alcanceIndividual = /OR etapa\."scope" <> 'ESTUDIANTE_INDIVIDUAL'/g;
      if (definicion.match(alcanceIndividual)?.length !== 1) {
        throw new Error('No se encontr\u00f3 exactamente la restricci\u00f3n de alcance individual de 9H.4.');
      }
      const mensajeAnterior = 'Cada etapa debe ser individual, completa y sumar exactamente 10.00 puntos.';
      if (definicion.split(mensajeAnterior).length !== 2) {
        throw new Error('No se encontr\u00f3 el mensaje esperado del trigger de 9H.4.');
      }
      return definicion
        .replace(alcanceIndividual, '')
        .replace(mensajeAnterior, 'Cada etapa debe estar completa y sumar exactamente 10.00 puntos.');
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.actualizarFuncion(queryRunner, (definicion) => {
      const sumaEtapa = /HAVING etapa\."calificacion_maxima" <> 10\.00/g;
      if (definicion.match(sumaEtapa)?.length !== 1) {
        throw new Error('No se encontr\u00f3 exactamente la validaci\u00f3n de suma de etapa para revertir 9H.4.1.');
      }
      const mensajeActual = 'Cada etapa debe estar completa y sumar exactamente 10.00 puntos.';
      if (definicion.split(mensajeActual).length !== 2) {
        throw new Error('No se encontr\u00f3 el mensaje esperado del trigger de 9H.4.1.');
      }
      return definicion
        .replace(sumaEtapa, `HAVING etapa."calificacion_maxima" <> 10.00\n              OR etapa."scope" <> 'ESTUDIANTE_INDIVIDUAL'`)
        .replace(mensajeActual, 'Cada etapa debe ser individual, completa y sumar exactamente 10.00 puntos.');
    });
  }

  private async actualizarFuncion(
    queryRunner: QueryRunner,
    transformar: (definicion: string) => string,
  ): Promise<void> {
    const filas = await queryRunner.query(`
      SELECT pg_get_functiondef('validar_activacion_version_rubrica()'::regprocedure) AS definicion
    `) as Array<{ definicion: string }>;
    if (!filas[0]?.definicion) throw new Error('No existe el trigger de validaci\u00f3n de versiones de r\u00fabricas.');
    await queryRunner.query(transformar(filas[0].definicion));
  }
}
