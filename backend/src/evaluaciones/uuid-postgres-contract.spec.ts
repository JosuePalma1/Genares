import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CerrarEvaluacionDto } from './dto/cerrar-evaluacion.dto';
import { CrearEvaluacionDto } from './dto/crear-evaluacion.dto';
import { GuardarPuntajesEvaluacionDto } from './dto/guardar-puntajes-evaluacion.dto';
import { esUuidPostgres } from '../comun/uuid-postgres';

const uuidPostgres = '10000000-0000-0000-0000-000000000001';
const uuidV4 = '11000000-0000-4000-8000-000000000001';
const metadata = { type: 'param' as const, metatype: String, data: 'id' };

describe('contrato UUID PostgreSQL de evaluaciones', () => {
  it('acepta UUID canónicos con cualquier versión y conserva UUIDv4', () => {
    expect(esUuidPostgres(uuidPostgres)).toBe(true);
    expect(esUuidPostgres(uuidV4)).toBe(true);
    expect(esUuidPostgres('11000000-0000-4000-8000-not-uuid')).toBe(false);
    expect(esUuidPostgres(null)).toBe(false);
  });

  it('valida creación, puntajes y cierre con la forma PostgreSQL en cada identificador', async () => {
    const crear = plainToInstance(CrearEvaluacionDto, {
      idEtapaRubrica: uuidPostgres,
      idEstudiante: uuidPostgres,
      idMiembroTribunal: uuidPostgres,
    });
    const guardar = plainToInstance(GuardarPuntajesEvaluacionDto, {
      revision: 1,
      idMiembroTribunal: uuidPostgres,
      puntajes: [{ idIndicador: uuidPostgres, puntaje: '4.25' }],
    });
    const cerrar = plainToInstance(CerrarEvaluacionDto, { revision: 2, idMiembroTribunal: uuidPostgres });

    await expect(validate(crear)).resolves.toHaveLength(0);
    await expect(validate(guardar)).resolves.toHaveLength(0);
    await expect(validate(cerrar)).resolves.toHaveLength(0);
  });

  it('rechaza identificadores malformados en DTO y parámetros de ruta', async () => {
    const crear = plainToInstance(CrearEvaluacionDto, {
      idEtapaRubrica: 'etapa-invalida', idEstudiante: uuidPostgres, idMiembroTribunal: uuidPostgres,
    });
    const guardar = plainToInstance(GuardarPuntajesEvaluacionDto, {
      revision: 1, idMiembroTribunal: uuidPostgres,
      puntajes: [{ idIndicador: 'indicador-invalido', puntaje: '4.25' }],
    });
    const cerrar = plainToInstance(CerrarEvaluacionDto, { revision: 2, idMiembroTribunal: 'miembro-invalido' });
    const pipe = new ParseUUIDPipe();

    expect(await validate(crear)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'idEtapaRubrica' }),
    ]));
    expect(await validate(guardar)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'puntajes' }),
    ]));
    expect(await validate(cerrar)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'idMiembroTribunal' }),
    ]));
    await expect(pipe.transform(uuidPostgres, metadata)).resolves.toBe(uuidPostgres);
    await expect(pipe.transform('no-es-uuid', metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
