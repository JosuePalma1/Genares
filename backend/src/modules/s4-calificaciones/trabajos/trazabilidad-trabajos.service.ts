import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { esUuidPostgres } from '../../../common/utils/uuid-postgres';

const LIMITE_PAGINA = 100;

export interface CursorTrazabilidad {
  ocurridoEnEpoch: string;
  id: string;
}

export function codificarCursorTrazabilidad(cursor: CursorTrazabilidad): string {
  return Buffer.from(`${cursor.ocurridoEnEpoch}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodificarCursorTrazabilidad(cursor: string): CursorTrazabilidad {
  try {
    const valor = Buffer.from(cursor, 'base64url').toString('utf8');
    const separador = valor.lastIndexOf('|');
    const ocurridoEnEpoch = valor.slice(0, separador);
    const id = valor.slice(separador + 1);
    if (separador < 0 || !/^\d+(?:\.\d+)?$/.test(ocurridoEnEpoch) || !esUuidPostgres(id)) throw new Error();
    return { ocurridoEnEpoch, id };
  } catch {
    throw new TypeError('El cursor de trazabilidad no es válido.');
  }
}

@Injectable()
export class TrazabilidadTrabajosService {
  constructor(private readonly dataSource: DataSource) {}

  async consultar(trabajoId: string, cursor?: string) {
    const trabajoExiste = await this.dataSource.query(
      `SELECT 1 FROM s2.asignacion_tema a
       JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
       WHERE a.id = $1::uuid`,
      [trabajoId],
    );
    if (!trabajoExiste.length) throw new NotFoundException('No existe el trabajo solicitado.');

    let posicion: CursorTrazabilidad | null = null;
    if (cursor) posicion = decodificarCursorTrazabilidad(cursor);
    const filas: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT "id", "ocurrido_en" AS "ocurridoEn",
        EXTRACT(EPOCH FROM "ocurrido_en")::text AS "cursorEpoch", "tipo_evento" AS "tipo",
        "actor_id" AS "actorId", "origen", "evidencia"
      FROM s4.eventos_trazabilidad_trabajo
      WHERE id_proceso_evaluacion = (
        SELECT id FROM s4.procesos_evaluacion WHERE asignacion_tema_id = $1::uuid
      )
        AND ($2::numeric IS NULL OR (EXTRACT(EPOCH FROM "ocurrido_en"), "id") < ($2::numeric, $3::uuid))
      ORDER BY "ocurrido_en" DESC, "id" DESC
      LIMIT $4
    `, [trabajoId, posicion?.ocurridoEnEpoch ?? null, posicion?.id ?? null, LIMITE_PAGINA + 1]);

    const hayMas = filas.length > LIMITE_PAGINA;
    const visibles = hayMas ? filas.slice(0, LIMITE_PAGINA) : filas;
    const ultimo = visibles[visibles.length - 1];
    return {
      trabajoId,
      elementos: visibles.map((fila) => ({
        id: fila.id,
        ocurridoEn: fila.ocurridoEn,
        tipo: fila.tipo,
        actor: { disponible: Boolean(fila.actorId) },
        origen: fila.origen,
        evidencia: fila.evidencia,
      })),
      siguienteCursor: hayMas && ultimo
        ? codificarCursorTrazabilidad({ ocurridoEnEpoch: String(ultimo.cursorEpoch), id: String(ultimo.id) })
        : null,
      metadatos: {
        completa: false,
        nota: 'Historial parcial: se muestran solo eventos respaldados por evidencia persistida; no se reconstruyen transiciones ausentes.',
      },
    };
  }
}
