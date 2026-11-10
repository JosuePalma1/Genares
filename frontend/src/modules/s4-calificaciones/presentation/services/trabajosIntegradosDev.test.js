import { describe, expect, it } from 'vitest';
import { filtrarTrabajosIntegrados, validarResumenTrabajosIntegrados } from './trabajosIntegradosDev';

const DATOS = [
  { asignacionId: 'asig-ti', tema: 'DEV - Tema de bina TI', tipoTrabajo: 'Bina o grupo', estadoAsignacion: 'VIGENTE', evaluadoresAsignados: 2, escritasCerradas: 2,
    estudiantes: [{ id: 'juan', nombre: 'Juan' }, { id: 'maria', nombre: 'María' }],
    evaluadores: [{ id: 'carlos', nombre: 'Carlos' }], sesiones: [] },
  { asignacionId: 'asig-soft', tema: 'DEV - Tema individual Software', tipoTrabajo: 'Individual', estadoAsignacion: 'VIGENTE', evaluadoresAsignados: 0, escritasCerradas: 0,
    estudiantes: [{ id: 'pedro', nombre: 'Pedro' }], evaluadores: [], sesiones: [] },
];

describe('trabajos integrados: S2/S3/S4 (modo local)', () => {
  it('acepta una respuesta válida de solo lectura', () => {
    expect(validarResumenTrabajosIntegrados({ soloLectura: true, escenarios: DATOS })).toHaveLength(2);
  });
  it('no acepta respuestas sin indicador de solo lectura', () => {
    expect(() => validarResumenTrabajosIntegrados({ soloLectura: false, escenarios: DATOS })).toThrow();
  });
  it('rechaza expedientes con relaciones ausentes', () => {
    expect(() => validarResumenTrabajosIntegrados({ soloLectura: true, escenarios: [{ asignacionId: 'a' }] })).toThrow();
  });
  it('filtra por estudiantes sin depender de tildes', () => {
    expect(filtrarTrabajosIntegrados(DATOS, 'maria').map((i) => i.asignacionId)).toEqual(['asig-ti']);
  });
  it('filtra según las asignaciones de tribunal de S3', () => {
    expect(filtrarTrabajosIntegrados(DATOS, '', 'con-tribunal')).toHaveLength(1);
    expect(filtrarTrabajosIntegrados(DATOS, '', 'sin-tribunal').map((i) => i.asignacionId)).toEqual(['asig-soft']);
  });
});
