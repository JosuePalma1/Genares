import { describe, expect, it } from 'vitest';
import { CARRERAS_DEMOSTRACION, crearEstadoInicial } from './datosPrototipo';

describe('coherencia de los datos de demostración', () => {
  it('usa solamente TI y SOFT y relaciona estudiantes, tutores, tribunales, rúbricas y evaluaciones', () => {
    const estado = crearEstadoInicial();
    const personas = new Map(estado.personas.map((persona) => [persona.id, persona]));
    const carreras = new Map(CARRERAS_DEMOSTRACION.map((carrera) => [carrera.codigo, carrera.nombre]));
    const versiones = new Map(estado.versionesRubrica.map((version) => [version.id, version]));

    expect([...carreras.keys()].sort()).toEqual(['SOFT', 'TI']);
    expect(new Set(estado.trabajos.map(({ carreraCodigo }) => carreraCodigo))).toEqual(new Set(['TI', 'SOFT']));
    expect(estado).not.toHaveProperty('actores');
    expect(estado.personas.filter(({ tipoPersona }) => tipoPersona === 'ESTUDIANTE').length).toBeGreaterThan(0);

    for (const trabajo of estado.trabajos) {
      expect(trabajo.carrera).toBe(carreras.get(trabajo.carreraCodigo));
      expect(trabajo.idsEstudiantes.length).toBeGreaterThan(0);
      expect(trabajo.idsEstudiantes.map((id) => personas.get(id))).toEqual(
        expect.arrayContaining(trabajo.idsEstudiantes.map(() => expect.objectContaining({
          tipoPersona: 'ESTUDIANTE', carrera: trabajo.carrera, carreraCodigo: trabajo.carreraCodigo,
        }))),
      );
      expect(personas.get(trabajo.idTutor)).toMatchObject({ tipoPersona: 'DOCENTE', carrera: trabajo.carrera, carreraCodigo: trabajo.carreraCodigo });
      expect(trabajo.idsTribunal).toHaveLength(2);
      expect(trabajo.idsTribunal).not.toContain(trabajo.idTutor);
      for (const idMiembro of trabajo.idsTribunal) {
        expect(personas.get(idMiembro)).toMatchObject({ tipoPersona: 'DOCENTE' });
      }

      const evaluaciones = estado.evaluaciones.filter((evaluacion) => evaluacion.idTrabajo === trabajo.id);
      expect(evaluaciones.map(({ idMiembro }) => idMiembro).sort()).toEqual([...trabajo.idsTribunal].sort());
      for (const evaluacion of evaluaciones) {
        expect(evaluacion.idVersionRubrica).toBe(trabajo.idVersionRubrica);
        expect(evaluacion.instantaneaRubrica.id).toBe(versiones.get(trabajo.idVersionRubrica).id);
      }
    }
  });
});
