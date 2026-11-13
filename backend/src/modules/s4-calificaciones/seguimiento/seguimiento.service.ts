import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CONSULTA_PERIODOS, FILTRO_TRABAJOS_MER } from '../trabajos/trabajos.service';
import { periodoAplicado, TODOS_LOS_PERIODOS } from '../trabajos/paginacion-trabajos';

/**
 * Estados por estudiante que equivalen a «resultado completo»: todos los evaluadores cerraron todas
 * las etapas de la rúbrica (o el trabajo ya se finalizó). Se cuentan desde el estado calculado
 * (ESTADO_CALCULADO_TRABAJO) en vez de consolidar cada trabajo: con 202 trabajos la consolidación
 * por trabajo tardaba más de 1 s por petición y bloqueaba el servidor (RNF-03, prueba de carga
 * del 12/11/2026). Ese día ambos métodos dieron los mismos 40 estudiantes.
 */
export const ESTADOS_RESULTADO_COMPLETO = ['EVALUACION_COMPLETADA', 'FINALIZADO'] as const;

/** Conteos del resumen sobre el mismo universo que la lista de Trabajos ($1 = código del periodo o NULL). */
export const CONSULTA_CONTEOS_SEGUIMIENTO = `
WITH universo AS (
  SELECT a.id, p.id AS proceso, estado_calculado.estado AS estado, c.codigo AS carrera,
         estado_calculado.estudiantes AS estudiantes
  ${FILTRO_TRABAJOS_MER}
)
SELECT
  (SELECT count(*)::integer FROM universo) AS total,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('codigo', carrera, 'cantidad', cantidad) ORDER BY carrera)
    FROM (SELECT carrera, count(*)::integer AS cantidad FROM universo GROUP BY carrera) x), '[]'::jsonb) AS "porCarrera",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('estado', estado, 'cantidad', cantidad) ORDER BY estado)
    FROM (SELECT estado, count(*)::integer AS cantidad FROM universo GROUP BY estado) x), '[]'::jsonb) AS "porEstado",
  (SELECT count(*)::integer FROM s4.programaciones_sustentacion ses
    JOIN universo u ON u.proceso = ses.id_proceso_evaluacion
    WHERE ses.estado_registro = 1) AS programaciones,
  (SELECT count(*)::integer FROM universo u, jsonb_array_elements(u.estudiantes) e
    WHERE e->>'estado' IN (${ESTADOS_RESULTADO_COMPLETO.map((estado) => `'${estado}'`).join(', ')})) AS "resultadosCompletos"
`;

/** Actas archivadas visibles de procesos visibles, del periodo del tema ($1 = código o NULL). */
export const CONSULTA_ACTAS_SEGUIMIENTO = `
SELECT count(*)::integer AS actas
FROM s4.actas_archivadas ar
JOIN s4.procesos_evaluacion p ON p.id = ar.id_proceso_evaluacion AND p.estado_registro = 1
JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
JOIN gen.tema t ON t.id = a.tema_id
LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
WHERE ar.estado_registro = 1 AND ($1::text IS NULL OR pa.codigo = $1::text)
`;

export interface ResumenSeguimiento {
  periodo: string;
  periodos: Array<{ codigo: string; nombre: string | null; activo: boolean }>;
  trabajos: { total: number; porCarrera: Array<{ codigo: string | null; cantidad: number }>; porEstado: Array<{ estado: string; cantidad: number }> };
  programaciones: number;
  actas: number;
  /** Se conserva la forma anterior; al contarse en una sola consulta ya no hay consultas parciales. */
  resultados: { estado: 'listo' | 'parcial'; completos: number; trabajosConsultados: number; trabajosConError: number };
}

@Injectable()
export class SeguimientoService {
  constructor(private readonly db: DataSource) {}

  /** Resumen del periodo en una sola petición, calculado con dos consultas. */
  async resumen(periodoSolicitado?: string): Promise<ResumenSeguimiento> {
    const periodos: ResumenSeguimiento['periodos'] = await this.db.query(CONSULTA_PERIODOS);
    const periodo = periodoAplicado(periodoSolicitado, periodos);
    const [[conteos], [{ actas }]] = await Promise.all([
      this.db.query(CONSULTA_CONTEOS_SEGUIMIENTO, [periodo]) as Promise<Array<ResumenSeguimiento['trabajos']
        & { programaciones: number; resultadosCompletos: number }>>,
      this.db.query(CONSULTA_ACTAS_SEGUIMIENTO, [periodo]) as Promise<Array<{ actas: number }>>,
    ]);
    return {
      periodo: periodo ?? TODOS_LOS_PERIODOS,
      periodos,
      trabajos: { total: conteos.total, porCarrera: conteos.porCarrera, porEstado: conteos.porEstado },
      programaciones: conteos.programaciones,
      actas,
      resultados: { estado: 'listo', completos: conteos.resultadosCompletos, trabajosConsultados: conteos.total, trabajosConError: 0 },
    };
  }
}
