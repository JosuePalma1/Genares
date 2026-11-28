import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { carreraValidaParaActa, numeroActa, periodoValidoParaActa } from './reglas-acta';

interface NumeracionRegistrada {
  codigoCarrera: string;
  codigoPeriodo: string;
  tieneContador: boolean;
  ultimo: number | null;
  ultimoEmitido: string | null;
  consecutivoEmitido: number | null;
}

/** Lee el archivo y el contador en una misma consulta, sin reservar un número. */
export async function consultarNumeracionActas(
  db: DataSource, carreraId: string, periodoId: string, carrerasPermitidas: string[] | null,
) {
  const [fila] = await db.query<NumeracionRegistrada[]>(`
    SELECT c.codigo AS "codigoCarrera", p.codigo AS "codigoPeriodo", contador.ultimo,
      (contador.periodo IS NOT NULL) AS "tieneContador",
      acta.numero AS "ultimoEmitido", acta.consecutivo AS "consecutivoEmitido"
    FROM gen.carrera c
    JOIN gen.periodo_academico p ON p.id = $2
    LEFT JOIN s4.consecutivos_acta contador ON contador.id_carrera = c.id AND contador.periodo = p.codigo
    LEFT JOIN LATERAL (
      SELECT a.numero, a.consecutivo
      FROM s4.actas_archivadas a
      WHERE a.id_carrera = c.id AND a.id_periodo = p.id AND a.numero IS NOT NULL
      ORDER BY a.consecutivo DESC NULLS LAST, a.generado_en DESC NULLS LAST, a.id DESC
      LIMIT 1
    ) acta ON true
    WHERE c.id = $1 AND ($3::text[] IS NULL OR c.codigo = ANY($3::text[]))
  `, [carreraId, periodoId, carrerasPermitidas]);
  if (!fila) throw new NotFoundException('No se encontró la combinación de carrera y período.');

  const { codigoCarrera, codigoPeriodo, ultimoEmitido, consecutivoEmitido } = fila;
  const ultimo = fila.tieneContador ? fila.ultimo : 0;
  if (!periodoValidoParaActa(codigoPeriodo) || !carreraValidaParaActa(codigoCarrera)) {
    return { ultimoEmitido, siguientePrevisto: null, motivoSinPrevision: 'SIN_CORRESPONDENCIA' };
  }
  if (ultimo === null || ultimo < (consecutivoEmitido ?? 0) || ultimo >= 2_147_483_647) {
    return { ultimoEmitido, siguientePrevisto: null, motivoSinPrevision: 'CONTADOR_NO_DISPONIBLE' };
  }
  return { ultimoEmitido, siguientePrevisto: numeroActa(ultimo + 1, codigoPeriodo, codigoCarrera), motivoSinPrevision: null };
}
