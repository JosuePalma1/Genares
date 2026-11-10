import { PATH_METADATA } from '@nestjs/common/constants';
import { EvaluacionesMerController } from './evaluaciones-mer.controller';

describe('rutas de evaluación MER', () => {
  it('publica las operaciones de evaluación bajo una única ruta S4', () => {
    const prefijo = Reflect.getMetadata(PATH_METADATA, EvaluacionesMerController);
    const prototipo = EvaluacionesMerController.prototype as unknown as Record<string, object>;
    const rutas = Object.getOwnPropertyNames(prototipo)
      .map((nombre) => Reflect.getMetadata(PATH_METADATA, prototipo[nombre]))
      .filter((ruta): ruta is string => typeof ruta === 'string');

    expect(prefijo).toBe('evaluaciones/mer');
    expect(rutas).toContain(':asignacionId');
    expect(rutas).toContain(':asignacionId/borrador-oral');
    expect(rutas).not.toContain('catalogo-rubricas');
    expect(rutas).not.toContain('rubricas/:versionId');
  });
});
