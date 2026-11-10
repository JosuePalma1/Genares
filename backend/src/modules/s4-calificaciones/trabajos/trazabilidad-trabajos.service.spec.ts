import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  codificarCursorTrazabilidad,
  decodificarCursorTrazabilidad,
  TrazabilidadTrabajosService,
} from './trazabilidad-trabajos.service';

const ID_TRABAJO = '11000000-0000-4000-8000-000000000001';
const ID_EVENTO = '22000000-0000-4000-8000-000000000001';

describe('TrazabilidadTrabajosService', () => {
  it('codifica y valida cursores sin perder la precisión temporal del servidor', () => {
    const original = { ocurridoEnEpoch: '1792861200.123456', id: ID_EVENTO };
    expect(decodificarCursorTrazabilidad(codificarCursorTrazabilidad(original))).toEqual(original);
    expect(() => decodificarCursorTrazabilidad('cursor-invalido')).toThrow('cursor de trazabilidad');
  });

  it('devuelve una página ordenada y marca la cobertura como parcial', async () => {
    const filas = Array.from({ length: 101 }, (_, indice) => ({
      id: indice === 99 ? ID_EVENTO : `33000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
      ocurridoEn: new Date('2026-10-24T10:00:00.000Z'),
      cursorEpoch: `1792861200.${String(999999 - indice).padStart(6, '0')}`,
      tipo: 'EVALUACION_CERRADA',
      actorId: indice === 0 ? 'cuenta-interna-123' : null,
      actorTipo: null,
      origen: 'EVALUACION',
      evidencia: 'DIRECTA',
      entidadTipo: 'evaluacion',
      entidadId: ID_EVENTO,
      detalles: {},
    }));
    const query = jest.fn().mockResolvedValueOnce([{ '?column?': 1 }]).mockResolvedValueOnce(filas);
    const servicio = new TrazabilidadTrabajosService({ query } as unknown as DataSource);

    const respuesta = await servicio.consultar(ID_TRABAJO);

    expect(respuesta.elementos).toHaveLength(100);
    expect(respuesta.siguienteCursor).toBe(codificarCursorTrazabilidad({
      ocurridoEnEpoch: filas[99].cursorEpoch,
      id: filas[99].id,
    }));
    expect(respuesta.metadatos.completa).toBe(false);
    expect(respuesta.elementos[0].actor).toEqual({ disponible: true });
    expect(respuesta.elementos[0].actor).not.toHaveProperty('id');
    expect(String(query.mock.calls[1][0])).toContain('EXTRACT(EPOCH FROM "ocurrido_en")');
  });

  it('responde 404 si el expediente no existe y no consulta eventos de otro trabajo', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const servicio = new TrazabilidadTrabajosService({ query } as unknown as DataSource);

    await expect(servicio.consultar(ID_TRABAJO)).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
