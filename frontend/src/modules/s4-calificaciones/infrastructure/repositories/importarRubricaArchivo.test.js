import { describe, expect, it } from 'vitest';
import { filasDePaginaPdf, importarRubricaArchivo } from './importarRubricaArchivo';

const fragmento = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width });

describe('lectura de un archivo de rúbrica', () => {
  it('detecta las columnas próximas y conserva los indicadores envueltos sin sus calificaciones', () => {
    expect(filasDePaginaPdf([
      fragmento('Indicadores', 220, 95, 52),
      fragmento('Valoración', 395, 95, 54),
      fragmento('Calificación', 457, 95, 57),
      fragmento('1. Sustenta la propuesta', 90, 78, 180),
      fragmento('2,50', 413, 78, 18),
      fragmento('1,20', 484, 78, 18),
      fragmento('con ejemplos.', 105, 66, 90),
      fragmento('Sumatoria', 335, 43, 52),
      fragmento('2,50', 413, 43, 18),
    ])).toEqual([
      ['Indicadores', 'Valoración'],
      ['1. Sustenta la propuesta', '2,50'],
      ['con ejemplos.'],
      ['Sumatoria', '2,50'],
    ]);
  });

  it('rechaza archivos que excedan el tamaño permitido antes de leerlos', async () => {
    await expect(importarRubricaArchivo({ name: 'rubrica.pdf', size: 11 * 1024 * 1024 })).rejects.toThrow(/10 MB/);
    await expect(importarRubricaArchivo({ name: 'rubrica.doc', size: 100 })).rejects.toThrow(/\.docx/);
  });
});
