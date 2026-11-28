import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IdentidadApi } from '../../../common/api/identidad-api';
import { ConfiguracionGeneralController } from './configuracion.controller';

describe('Consulta de numeración de actas', () => {
  const carrera = '10101010-1010-1010-1010-101010101010';
  const periodo = '20202020-2020-2020-2020-202020202020';
  function preparar(filas: object[], alcance: NonNullable<IdentidadApi['alcance']> = { carreras: null, soloTribunal: false }) {
    const query = jest.fn().mockResolvedValue(filas);
    const transaction = jest.fn();
    const controlador = new ConfiguracionGeneralController({ query, transaction } as never, {} as never);
    const identidadApi: IdentidadApi = {
      tipo: 'VERIFICADA', sujeto: 'prueba', capacidades: ['configuracion-academica:administrar'], alcance,
    };
    const consultar = () => controlador.numeracionActas(carrera, periodo, { identidadApi });
    return { query, transaction, consultar };
  }

  it('devuelve el código archivado tal como se emitió y usa el contador para prever el siguiente', async () => {
    const { query, transaction, consultar } = preparar([{
      codigoCarrera: 'SOFT', codigoPeriodo: '2026-2', ultimo: 999, tieneContador: true,
      ultimoEmitido: 'SOFT-2026-2-998', consecutivoEmitido: 998,
    }]);
    const resultado = { ultimoEmitido: 'SOFT-2026-2-998', siguientePrevisto: '1000-2026-2-SOFT', motivoSinPrevision: null };
    await expect(consultar()).resolves.toEqual(resultado);
    await expect(consultar()).resolves.toEqual(resultado);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/^\s*SELECT/i), [carrera, periodo, null]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('prevé el 001 cuando todavía no hay actas ni contador para ese ámbito', async () => {
    const { consultar } = preparar([{
      codigoCarrera: 'TI', codigoPeriodo: '2026-1', ultimo: null, tieneContador: false,
      ultimoEmitido: null, consecutivoEmitido: null,
    }]);
    await expect(consultar()).resolves.toEqual({
      ultimoEmitido: null, siguientePrevisto: '001-2026-1-TI', motivoSinPrevision: null,
    });
  });

  it('conserva el código histórico pero no anticipa un número si el ámbito no tiene un código válido para emitir', async () => {
    const { consultar } = preparar([{
      codigoCarrera: 'DEV-SOFT', codigoPeriodo: '2026-2', ultimo: 7, tieneContador: true,
      ultimoEmitido: '007-2026-2-SOFT', consecutivoEmitido: 7,
    }]);
    await expect(consultar()).resolves.toEqual({
      ultimoEmitido: '007-2026-2-SOFT', siguientePrevisto: null, motivoSinPrevision: 'SIN_CORRESPONDENCIA',
    });
  });

  it('omite la previsión si el contador está detrás de un número emitido', async () => {
    const { consultar } = preparar([{
      codigoCarrera: 'TI', codigoPeriodo: '2026-2', ultimo: 5, tieneContador: true,
      ultimoEmitido: '006-2026-2-TI', consecutivoEmitido: 6,
    }]);
    await expect(consultar()).resolves.toEqual({
      ultimoEmitido: '006-2026-2-TI', siguientePrevisto: null, motivoSinPrevision: 'CONTADOR_NO_DISPONIBLE',
    });
  });

  it('limita la búsqueda por carrera y responde 404 si queda fuera del ámbito', async () => {
    const { query, consultar } = preparar([], { carreras: ['TI'], soloTribunal: false });
    await expect(consultar()).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('c.codigo = ANY($3::text[])'), [carrera, periodo, ['TI']]);
  });

  it.each([
    { carreras: null, soloTribunal: true },
    { carreras: [], soloTribunal: false },
  ])('impide la consulta general si el ámbito es %j', async (alcance) => {
    const { query, consultar } = preparar([], alcance);
    await expect(consultar()).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
