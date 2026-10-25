import { describe, expect, it } from 'vitest';
import { crearEstadoInicial } from './datosPrototipo';
import { migrarDatosDemostracion } from './migracionesDemostracion';

describe('migración de los datos locales de demostración', () => {
  it('corrige solo el fixture conocido y conserva sus puntuaciones ya registradas', () => {
    const inicial = crearEstadoInicial();
    const antiguo = structuredClone(inicial);
    antiguo.schemaVersion = inicial.schemaVersion - 1;
    antiguo.actores = [{ id: 'actor-daniela', rolActivo: 'COMISION' }];
    antiguo.idActorActual = 'actor-daniela';
    antiguo.personas.find(({ id }) => id === 'docente-jose').carrera = 'Software';
    antiguo.personas.find(({ id }) => id === 'estudiante-luis').carrera = 'Agropecuaria';
    antiguo.trabajos.find(({ id }) => id === 'trabajo-326').idsTribunal = [];
    antiguo.trabajos.find(({ id }) => id === 'trabajo-241').titulo = 'Texto local anterior';
    antiguo.evaluaciones = antiguo.evaluaciones.filter(({ idTrabajo }) => idTrabajo !== 'trabajo-326');

    const migrado = migrarDatosDemostracion(antiguo, inicial);

    expect(migrado).not.toHaveProperty('actores');
    expect(migrado).not.toHaveProperty('idActorActual');
    expect(migrado.personas.find(({ id }) => id === 'docente-jose')).toMatchObject({ carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT' });
    expect(migrado.personas.find(({ id }) => id === 'estudiante-luis')).toMatchObject({ carrera: 'Tecnologías de la Información', carreraCodigo: 'TI' });
    expect(migrado.trabajos.find(({ id }) => id === 'trabajo-241').titulo).not.toBe('Texto local anterior');
    expect(migrado.trabajos.find(({ id }) => id === 'trabajo-326').idsTribunal).toEqual(['docente-jose', 'docente-jorge']);
    expect(migrado.evaluaciones.filter(({ idTrabajo }) => idTrabajo === 'trabajo-326')).toHaveLength(2);
    expect(migrado.evaluaciones.find(({ id }) => id === 'trabajo-184-docente-maria').escrita.calificaciones).toEqual(
      antiguo.evaluaciones.find(({ id }) => id === 'trabajo-184-docente-maria').escrita.calificaciones,
    );
  });

  it('no reemplaza el tribunal que ya fue asignado al fixture', () => {
    const inicial = crearEstadoInicial();
    const estado = structuredClone(inicial);
    estado.trabajos.find(({ id }) => id === 'trabajo-326').idsTribunal = ['docente-maria', 'docente-jose'];
    estado.evaluaciones = estado.evaluaciones.filter(({ idTrabajo }) => idTrabajo !== 'trabajo-326');

    const migrado = migrarDatosDemostracion(estado, inicial);
    expect(migrado.trabajos.find(({ id }) => id === 'trabajo-326').idsTribunal).toEqual(['docente-maria', 'docente-jose']);
    expect(migrado.evaluaciones.filter(({ idTrabajo }) => idTrabajo === 'trabajo-326').map(({ idMiembro }) => idMiembro).sort()).toEqual(['docente-jose', 'docente-maria']);
  });

  it('no conserva el catálogo de identidades antiguas al migrar datos guardados', () => {
    const inicial = crearEstadoInicial();
    const anterior = { ...structuredClone(inicial), schemaVersion: inicial.schemaVersion - 1,
      actores: [{ id: 'actor-estudiante', rolActivo: 'ESTUDIANTE' }], idActorActual: 'actor-estudiante' };
    const migrado = migrarDatosDemostracion(anterior, inicial);

    expect(migrado).not.toHaveProperty('actores');
    expect(migrado).not.toHaveProperty('idActorActual');
    expect(migrado.personas.some(({ id }) => id.startsWith('estudiante-'))).toBe(true);
  });
});
