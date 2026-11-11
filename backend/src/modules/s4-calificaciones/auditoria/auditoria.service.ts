import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface FiltrosAuditoria {
  tabla?: string;
  registro?: string;
  limite?: number | string;
  cursor?: string;
}

interface CursorAuditoria {
  ocurridoEn: string;
  id: string;
}

const UUID_POSTGRES = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodificarCursor(cursor?: string): CursorAuditoria | null {
  if (!cursor) return null;
  try {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const valor = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorAuditoria>;
    if (typeof valor.ocurridoEn !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(valor.ocurridoEn)
      || !Number.isFinite(Date.parse(valor.ocurridoEn))
      || typeof valor.id !== 'string' || !UUID_POSTGRES.test(valor.id)) {
      throw new Error();
    }
    return { ocurridoEn: valor.ocurridoEn, id: valor.id };
  } catch {
    throw new BadRequestException('Cursor de auditoría inválido.');
  }
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(filtros: FiltrosAuditoria = {}): Promise<{
    elementos: Record<string, unknown>[];
    limite: number;
    siguienteCursor: string | null;
  }> {
    const limiteSolicitado = Number(filtros.limite ?? 50);
    const limite = Number.isFinite(limiteSolicitado)
      ? Math.min(100, Math.max(1, Math.trunc(limiteSolicitado)))
      : 50;
    const valores: unknown[] = [];
    const condiciones = ["esquema = 's4'"];
    const cursor = decodificarCursor(filtros.cursor);

    if (filtros.tabla?.trim()) {
      valores.push(filtros.tabla.trim());
      condiciones.push(`tabla = $${valores.length}`);
    }
    if (filtros.registro?.trim()) {
      valores.push(`%${filtros.registro.trim()}%`);
      condiciones.push(`clave_registro::text ILIKE $${valores.length}`);
    }
    if (cursor) {
      const fechaParametro = valores.push(cursor.ocurridoEn);
      const idParametro = valores.push(cursor.id);
      condiciones.push(`(ocurrido_en, id) < ($${fechaParametro}::timestamptz, $${idParametro}::uuid)`);
    }
    valores.push(limite + 1);

    const filas = await this.dataSource.query(
      `SELECT id, ocurrido_en AS "ocurridoEn", actor_id AS "actorId", rol_bd AS "rolBase",
        aplicacion, correlation_id AS "correlationId", tabla,
        clave_registro AS "claveRegistro", operacion, antes, despues,
        to_char(ocurrido_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "__cursorFecha"
       FROM s4.eventos_cambio_registro
       WHERE ${condiciones.join(' AND ')}
       ORDER BY ocurrido_en DESC, id DESC
       LIMIT $${valores.length}`,
      valores,
    ) as Array<Record<string, unknown> & { id: string; __cursorFecha: string }>;

    const hayMas = filas.length > limite;
    const pagina = filas.slice(0, limite);
    const ultima = pagina.at(-1);
    const siguienteCursor = hayMas && ultima
      ? Buffer.from(JSON.stringify({ ocurridoEn: ultima.__cursorFecha, id: ultima.id }), 'utf8').toString('base64url')
      : null;

    return {
      elementos: pagina.map(({ __cursorFecha: _cursorFecha, ...evento }) => evento),
      limite,
      siguienteCursor,
    };
  }
}
