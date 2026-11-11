import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { CONSULTA_PERIODOS, FILTRO_TRABAJOS_MER } from '../trabajos/trabajos.service';
import { periodoAplicado, TODOS_LOS_PERIODOS } from '../trabajos/paginacion-trabajos';

/** Consolidaciones simultáneas: cada una es una lectura documental completa del trabajo. */
const CONSOLIDACIONES_SIMULTANEAS = 4;

/**
 * Conteos del resumen sobre el mismo universo que la lista de Trabajos ($1 = código del periodo o NULL).
 * Las programaciones son las visibles de esos trabajos, en cualquier estado (como antes).
 */
export const CONSULTA_CONTEOS_SEGUIMIENTO = `
WITH universo AS (
  SELECT a.id, p.id AS proceso, COALESCE(p.estado, 'REGISTRADO') AS estado, c.codigo AS carrera
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
    WHERE ses.estado_registro = 1) AS programaciones
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

/**
 * Trabajos que pueden consolidarse: rúbrica visible, tribunal de dos miembros y estudiantes.
 * Es el mismo criterio que aplicaba el navegador antes de pedir cada consolidación.
 */
export const CONSULTA_TRABAJOS_CONSOLIDABLES = `
SELECT a.id
${FILTRO_TRABAJOS_MER}
  AND p.id IS NOT NULL AND vr.id IS NOT NULL
  AND (SELECT count(*) FROM s3.asignacion_tribunal at WHERE at.asignacion_tema_id = a.id) = 2
  AND (a.estudiante_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM s2.grupo_integrante gi WHERE gi.grupo_id = a.grupo_id AND gi.estado = 'ACTIVO'))
ORDER BY t.titulo, a.id
`;

interface ResultadoConsolidado { estado?: string; resultadoFinal?: unknown }

export interface ResumenSeguimiento {
  periodo: string;
  periodos: Array<{ codigo: string; nombre: string | null; activo: boolean }>;
  trabajos: { total: number; porCarrera: Array<{ codigo: string | null; cantidad: number }>; porEstado: Array<{ estado: string; cantidad: number }> };
  programaciones: number;
  actas: number;
  /** `parcial`: alguna consolidación falló; el conteo solo incluye las que respondieron. */
  resultados: { estado: 'listo' | 'parcial'; completos: number; trabajosConsultados: number; trabajosConError: number };
}

@Injectable()
export class SeguimientoService {
  constructor(private readonly db: DataSource, private readonly evaluaciones: EvaluacionesService) {}

  /** Resumen del periodo en una sola petición; las consolidaciones se calculan en el servidor. */
  async resumen(actor: string, accesoLocal: boolean, periodoSolicitado?: string): Promise<ResumenSeguimiento> {
    const periodos: ResumenSeguimiento['periodos'] = await this.db.query(CONSULTA_PERIODOS);
    const periodo = periodoAplicado(periodoSolicitado, periodos);
    const [[conteos], [{ actas }], consolidables] = await Promise.all([
      this.db.query(CONSULTA_CONTEOS_SEGUIMIENTO, [periodo]) as Promise<Array<ResumenSeguimiento['trabajos'] & { programaciones: number }>>,
      this.db.query(CONSULTA_ACTAS_SEGUIMIENTO, [periodo]) as Promise<Array<{ actas: number }>>,
      this.db.query(CONSULTA_TRABAJOS_CONSOLIDABLES, [periodo]) as Promise<Array<{ id: string }>>,
    ]);
    return {
      periodo: periodo ?? TODOS_LOS_PERIODOS,
      periodos,
      trabajos: { total: conteos.total, porCarrera: conteos.porCarrera, porEstado: conteos.porEstado },
      programaciones: conteos.programaciones,
      actas,
      resultados: await this.contarResultadosCompletos(consolidables.map(({ id }) => id), actor, accesoLocal),
    };
  }

  /**
   * Cuenta estudiantes con RESULTADO_COMPLETO y nota final, igual que el navegador. Una consolidación
   * no disponible (409) no cuenta; cualquier otro fallo marca el resumen como parcial.
   */
  private async contarResultadosCompletos(ids: string[], actor: string, accesoLocal: boolean): Promise<ResumenSeguimiento['resultados']> {
    let completos = 0;
    let trabajosConError = 0;
    let siguiente = 0;
    const trabajar = async () => {
      while (siguiente < ids.length) {
        const id = ids[siguiente++];
        try {
          const consolidacion = await this.evaluaciones.consolidarTrabajo(id, actor, accesoLocal);
          completos += ((consolidacion.estudiantes ?? []) as ResultadoConsolidado[])
            .filter((estudiante) => estudiante.estado === 'RESULTADO_COMPLETO' && estudiante.resultadoFinal).length;
        } catch (error) {
          if (!(error instanceof ConflictException)) trabajosConError += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONSOLIDACIONES_SIMULTANEAS, ids.length) }, trabajar));
    return { estado: trabajosConError ? 'parcial' : 'listo', completos, trabajosConsultados: ids.length, trabajosConError };
  }
}
