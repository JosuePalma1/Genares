import { MODULE_METADATA } from '@nestjs/common/constants';
import { TrabajosModule } from './trabajos.module';

describe('módulo de trabajos del MER', () => {
  it('registra únicamente consultas de trabajos y trazabilidad', () => {
    const controladores = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrabajosModule) as Function[];

    expect(controladores.map(({ name }) => name)).toEqual([
      'TrabajosController',
      'TrazabilidadTrabajosController',
    ]);
  });
});
