import { ArgumentsHost, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { FiltroErroresApi } from './filtro-errores-api';

function crearHost() {
  let cuerpo: unknown;
  const status = jest.fn(() => ({ json: (valor: unknown) => { cuerpo = valor; } }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ path: '/api/v1/evaluaciones/trabajos/trabajo-secreto' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, obtenerCuerpo: () => cuerpo };
}

describe('FiltroErroresApi', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registra una traza interna sin registrar el mensaje sensible y devuelve un error genérico', () => {
    const registro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const excepcion = new Error('observación privada y SQL sensible');
    excepcion.stack = 'Error: observación privada y SQL sensible\n    at service (evaluaciones.service.ts:1:1)';
    const { host, status, obtenerCuerpo } = crearHost();

    new FiltroErroresApi().catch(excepcion, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(obtenerCuerpo()).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor.',
    });
    expect(JSON.stringify(obtenerCuerpo())).not.toContain('observación privada');
    expect(JSON.stringify(obtenerCuerpo())).not.toContain('SQL sensible');
    expect(registro).toHaveBeenCalledWith(
      'Error interno no controlado (Error).',
      '    at service (evaluaciones.service.ts:1:1)',
    );
  });

  it('mantiene genéricos los errores de autorización y no los registra como fallos internos', () => {
    const registro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, obtenerCuerpo } = crearHost();

    new FiltroErroresApi().catch(new ForbiddenException('calificación de otro tribunal'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(obtenerCuerpo()).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Acceso denegado.',
    });
    expect(JSON.stringify(obtenerCuerpo())).not.toContain('calificación');
    expect(registro).not.toHaveBeenCalled();
  });

  it('expone motivos concretos y seguros de un conflicto documental', () => {
    const { host, status, obtenerCuerpo } = crearHost();
    new FiltroErroresApi().catch(new ConflictException({
      message: 'No se puede emitir.',
      details: ['Etapa Escrita: evaluador 2 pendiente.'],
    }), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(obtenerCuerpo()).toMatchObject({ statusCode: 409, code: 'CONFLICT',
      details: ['Etapa Escrita: evaluador 2 pendiente.'] });
  });
});
