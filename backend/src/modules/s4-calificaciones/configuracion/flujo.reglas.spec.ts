import { publicarRacional, racionalDesdeDecimal } from '../evaluaciones/reglas-consolidacion';
import { notaAprobada, notaMinimaEnEscala } from '../documentos/reglas-acta';
import { evaluarProgramacion, PasoDto, pasosIniciales, resolverPasos, validarFlujo } from './flujo.reglas';

const manual: PasoDto = {
  id: 'permiso',
  nombre: 'Permiso',
  tipo: 'MANUAL',
  ejecutores: ['TRIBUNAL'],
  aprobadores: ['COORDINACION'],
  condiciones: [],
  obligatorio: false,
};
const automatico: PasoDto = {
  ...pasosIniciales[0],
  id: 'habilitado',
  condiciones: ['DOS_ESCRITAS_CERRADAS', 'paso:permiso'],
};
describe('configuración académica por proceso', () => {
  it('distingue advertencias, bloqueos y excepciones que requieren una aprobación anterior', () => {
    const requisito = { ...pasosIniciales[3], cumplido:false };
    const autorizacion = {...manual,cumplido:false};
    const condicionado = {...requisito,rolesExcepcion:['COORDINACION'],pasoAprobacionExcepcion:manual.id};
    expect(evaluarProgramacion([{...requisito,modoProgramacion:'ADVERTIR'}], 'TRIBUNAL').advertencias).toEqual([requisito.nombre]);
    expect(evaluarProgramacion([{...requisito,modoProgramacion:'PERMITIR'}], 'TRIBUNAL').impedimentos).toEqual([]);
    expect(evaluarProgramacion([autorizacion,condicionado], 'COORDINACION').impedimentos).toEqual([requisito.nombre]);
    expect(evaluarProgramacion([{...autorizacion,cumplido:true},condicionado], 'TRIBUNAL').impedimentos).toEqual([requisito.nombre]);
    expect(evaluarProgramacion([{...autorizacion,cumplido:true},condicionado], 'COORDINACION').excepciones).toEqual([requisito.nombre]);
    expect(evaluarProgramacion([{...condicionado,cumplido:true}], 'COORDINACION').excepciones).toEqual([]);
    expect(()=>validarFlujo([condicionado,autorizacion])).toThrow();
  });
  it('conserva la nota exacta y aplica el redondeo elegido antes de comparar con el umbral', () => {
    const exacta = racionalDesdeDecimal('6.995');
    const umbral = notaMinimaEnEscala('70.00', 10);
    expect(notaAprobada(publicarRacional(exacta, 'HALF_UP'), umbral)).toBe(true);
    expect(notaAprobada(publicarRacional(exacta, 'TRUNCAR'), umbral)).toBe(false);
  });
  it('exige una segunda persona incluso si el solicitante es superusuario', () => {
    const historial = [{ paso: 'permiso', accion: 'SOLICITADO', actor: 'uno' }];
    const resolver = (rol: string, actor: string) =>
      resolverPasos([manual, automatico], new Set(['DOS_ESCRITAS_CERRADAS']), historial, rol, actor);
    expect(resolver('SUPERUSUARIO', 'uno')[0].acciones).toEqual([]);
    expect(resolver('TRIBUNAL', 'dos')[0].acciones).toEqual([]);
    expect(resolver('COORDINACION', 'dos')[0].acciones).toContain('APROBAR');
    expect(resolver('COORDINACION', 'dos')[1].cumplido).toBe(false);
    historial.push({ paso: 'permiso', accion: 'CUMPLIDO', actor: 'dos' });
    expect(resolver('COORDINACION', 'dos')[1].cumplido).toBe(true);
  });
  it('impide exigir para finalizar un paso que depende del cierre', () => {
    expect(() =>
      validarFlujo([...pasosIniciales, { ...manual, obligatorio: true, condiciones: ['paso:finalizado'] }]),
    ).toThrow();
    expect(() => validarFlujo([automatico, manual])).toThrow();
  });
});
