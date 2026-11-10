import { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { PLANTILLAS } from './plantillas-institucionales';

/** Archiva una copia interna y su resultado; notas y umbral proceden siempre del servidor. */
export async function archivarActaEn(manager: EntityManager, datos: {
  trabajoId: string; estudianteId: string; carreraId: string; periodoId: string;
  periodo: string; carreraCodigo: string; formato: keyof typeof PLANTILLAS; actor: string;
  notaFinal: string; notaMinimaAplicada: string; aprobado: boolean;
}, render: (numero: string) => Promise<Buffer>) {
  if (!/^\d{4}-[12]$/.test(datos.periodo) || !['TI', 'SOFT'].includes(datos.carreraCodigo)) {
    throw new Error('Carrera o período sin correspondencia institucional validada.');
  }
  if (!/^(?:0|[1-9]\d?)\.\d{2}$/.test(datos.notaFinal) || !/^(?:0|[1-9]\d?)\.\d{2}$/.test(datos.notaMinimaAplicada)
    || BigInt(datos.notaFinal.replace('.', '')) > 1000n || BigInt(datos.notaMinimaAplicada.replace('.', '')) > 1000n
    || datos.aprobado !== (BigInt(datos.notaFinal.replace('.', '')) >= BigInt(datos.notaMinimaAplicada.replace('.', '')))) {
    throw new Error('El resultado del documento no coincide con la regla académica sobre 10.00.');
  }
  // Bloquea la asociación del estudiante. También serializa dos intentos concurrentes
  // del mismo documento para que ambos devuelvan el mismo número y los mismos bytes.
  const [origen] = await manager.query(`SELECT proceso.id
    FROM s4.procesos_evaluacion proceso
    JOIN s2.asignacion_tema a ON a.id = proceso.asignacion_tema_id
    JOIN gen.tema t ON t.id = a.tema_id
    JOIN gen.carrera c ON c.id = t.carrera_id
    JOIN gen.periodo_academico p ON p.id = t.periodo_academico_id
    WHERE a.id=$1 AND s4.estudiante_pertenece_asignacion(a.id, $2)
      AND c.id=$3 AND p.id=$4 AND c.codigo=$5 AND p.codigo=$6 FOR UPDATE OF proceso`,
  [datos.trabajoId, datos.estudianteId, datos.carreraId, datos.periodoId, datos.carreraCodigo, datos.periodo]);
  if (!origen) throw new Error('La identidad documental no coincide con el trabajo y su estudiante.');

  const [existente] = await manager.query(`SELECT id,numero,formato,consecutivo,generado_en AS "generadoEn",sha256,
    nota_final::text AS "notaFinal",nota_minima_aplicada::text AS "notaMinimaAplicada",aprobado
    FROM s4.actas_archivadas WHERE id_proceso_evaluacion=$1 AND id_estudiante=$2 AND formato=$3`,
  [origen.id, datos.estudianteId, datos.formato]);
  if (existente) return { ...existente, reimpresa: true };

  // Una sola secuencia por carrera y período, compartida por ambos formatos.
  const [contador] = await manager.query(`INSERT INTO s4.consecutivos_acta(id_carrera,periodo,ultimo)
    VALUES ($1,$2,1) ON CONFLICT(id_carrera,periodo)
    DO UPDATE SET ultimo=consecutivos_acta.ultimo+1 RETURNING ultimo`, [datos.carreraId, datos.periodo]);
  const numero = `${String(contador.ultimo).padStart(3, '0')}-${datos.periodo}-${datos.carreraCodigo}`;
  const pdf = await render(numero);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const [acta] = await manager.query(`INSERT INTO s4.actas_archivadas
    (numero,id_carrera,id_periodo,periodo,consecutivo,id_proceso_evaluacion,id_estudiante,formato,revision,generado_por,pdf,sha256,
     generado_en,
     nota_final,nota_minima_aplicada,aprobado)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14,$15)
    RETURNING id,numero,formato,consecutivo,generado_en AS "generadoEn",sha256,
      nota_final::text AS "notaFinal",nota_minima_aplicada::text AS "notaMinimaAplicada",aprobado`,
  [numero, datos.carreraId, datos.periodoId, datos.periodo, contador.ultimo, origen.id,
    datos.estudianteId, datos.formato, PLANTILLAS[datos.formato].revision, datos.actor, pdf, sha256,
    datos.notaFinal, datos.notaMinimaAplicada, datos.aprobado]);
  return { ...acta, reimpresa: false };
}
