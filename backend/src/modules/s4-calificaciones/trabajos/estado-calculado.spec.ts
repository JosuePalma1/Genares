import { CONSULTA_CONTEOS_SEGUIMIENTO } from '../seguimiento/seguimiento.service';
import { CONSULTA_PROCESO_EXPEDIENTE } from '../evaluaciones/mer/evaluaciones-mer.service';
import {
  CONSULTA_PAGINA_TRABAJOS_MER,
  CONSULTA_TRABAJOS_MER,
  ESTADO_CALCULADO_TRABAJO,
  ESTADOS_PROCESO_ORDENADOS,
} from './trabajos.service';

// Paso 1 §3.1 (RF-22, RF-24): el estado se calcula desde los datos; no se lee de procesos_evaluacion.estado.
// La comprobación contra PostgreSQL de cada caso se hizo con la base local; aquí se fija el contrato de la consulta.
describe('estado calculado del trabajo', () => {
  it('usa los ocho estados del Paso 1 en orden de avance', () => {
    expect(ESTADOS_PROCESO_ORDENADOS).toEqual([
      'REGISTRADO', 'TRIBUNAL_ASIGNADO', 'REVISION_ESCRITA_PENDIENTE', 'REVISION_ESCRITA_COMPLETADA',
      'SUSTENTACION_PROGRAMADA', 'SUSTENTACION_PENDIENTE', 'EVALUACION_COMPLETADA', 'FINALIZADO',
    ]);
  });

  it('aplica las reglas por estudiante en el orden de precedencia acordado', () => {
    const orden = [
      "WHEN p.estado = 'FINALIZADO' THEN 8",
      'WHEN tribunal.miembros = 0 THEN 1',
      'WHEN p.id IS NULL OR vr.id IS NULL THEN 2',
      'WHEN etapas.completo THEN 7',
      'WHEN NOT etapas.escrita_completa THEN 3',
      'WHEN sesion.inicio IS NULL THEN 4',
      'WHEN sesion.inicio <= LOCALTIMESTAMP THEN 6',
      'ELSE 5',
    ].map((regla) => ESTADO_CALCULADO_TRABAJO.indexOf(regla));
    expect(orden.every((posicion) => posicion >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it('toma el menor avance entre estudiantes y solo cuenta registros visibles y evaluaciones cerradas', () => {
    expect(ESTADO_CALCULADO_TRABAJO).toContain('[min(por_estudiante.rango)]');
    expect(ESTADO_CALCULADO_TRABAJO).toContain("ev.estado = 'CERRADA' AND ev.calificacion_total IS NOT NULL");
    expect(ESTADO_CALCULADO_TRABAJO).toContain('ev.estado_registro = 1');
    expect(ESTADO_CALCULADO_TRABAJO).toContain('er.estado_registro = 1');
    expect(ESTADO_CALCULADO_TRABAJO).toContain("ps.estado_registro = 1 AND ps.estado <> 'CANCELADA'");
    expect(ESTADO_CALCULADO_TRABAJO).toContain('pe.estado_registro = 1');
    // Una etapa sin escrita no genera pendientes artificiales (regla d).
    expect(ESTADO_CALCULADO_TRABAJO).toContain("FILTER (WHERE er.kind = 'ESCRITA'), true)");
  });

  it('se usa al listar, filtrar por estado y contar en el resumen', () => {
    expect(CONSULTA_TRABAJOS_MER).toContain('estado_calculado.estado AS estado');
    expect(CONSULTA_TRABAJOS_MER).toContain('"estadosEstudiantes"');
    expect(CONSULTA_PAGINA_TRABAJOS_MER).toContain('estado_calculado.estado = $2::text');
    expect(CONSULTA_CONTEOS_SEGUIMIENTO).toContain('estado_calculado.estado AS estado');
    // La ficha de la evaluación muestra el mismo estado calculado.
    expect(CONSULTA_PROCESO_EXPEDIENTE).toContain('estado_calculado.estado AS "estadoProceso"');
    for (const consulta of [CONSULTA_TRABAJOS_MER, CONSULTA_PAGINA_TRABAJOS_MER, CONSULTA_CONTEOS_SEGUIMIENTO, CONSULTA_PROCESO_EXPEDIENTE]) {
      expect(consulta).not.toContain("COALESCE(p.estado, 'REGISTRADO')");
    }
  });
});
