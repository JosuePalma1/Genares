function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function crearEvaluacionPendiente(trabajo, idMiembro, rubrica) {
  return {
    id: `${trabajo.id}-${idMiembro}`,
    idTrabajo: trabajo.id,
    idMiembro,
    idVersionRubrica: rubrica.id,
    instantaneaRubrica: clonar(rubrica),
    escrita: { estado: 'PENDIENTE', calificaciones: {}, observaciones: {} },
    oralPorEstudiante: {},
  };
}

// Actualiza exclusivamente las filas estables del fixture local; conserva notas,
// auditoría, asignaciones y registros añadidos por quien usa la demostración.
export function migrarDatosDemostracion(estadoGuardado, estadoInicial) {
  const { actores: _actoresAntiguos, idActorActual: _idActorActualAntiguo, ...estadoSinIdentidades } = estadoGuardado;
  const personasBase = new Map(estadoInicial.personas.map((persona) => [persona.id, persona]));
  const trabajosBase = new Map(estadoInicial.trabajos.map((trabajo) => [trabajo.id, trabajo]));
  const personas = (estadoGuardado.personas ?? estadoInicial.personas).map((persona) => {
    const base = personasBase.get(persona.id);
    if (!base || !base.carreraCodigo) return persona;
    return { ...persona, carrera: base.carrera, carreraCodigo: base.carreraCodigo };
  });
  const trabajos = (estadoGuardado.trabajos ?? estadoInicial.trabajos).map((trabajo) => {
    const base = trabajosBase.get(trabajo.id);
    if (!base) return trabajo;
    const actualizado = {
      ...trabajo,
      carrera: base.carrera,
      carreraCodigo: base.carreraCodigo,
      titulo: base.titulo,
    };
    if (trabajo.id === 'trabajo-326' && !trabajo.idsTribunal?.length) {
      actualizado.idsTribunal = [...base.idsTribunal];
    }
    return actualizado;
  });
  const evaluaciones = [...(estadoGuardado.evaluaciones ?? estadoInicial.evaluaciones)];
  const idsEvaluacion = new Set(evaluaciones.map((evaluacion) => evaluacion.id));
  for (const trabajo of trabajos.filter((elemento) => elemento.id === 'trabajo-326')) {
    const rubrica = (estadoGuardado.versionesRubrica ?? estadoInicial.versionesRubrica)
      .find((version) => version.id === trabajo.idVersionRubrica);
    if (!rubrica) continue;
    for (const idMiembro of trabajo.idsTribunal ?? []) {
      const idEvaluacion = `${trabajo.id}-${idMiembro}`;
      if (idsEvaluacion.has(idEvaluacion)) continue;
      evaluaciones.push(crearEvaluacionPendiente(trabajo, idMiembro, rubrica));
      idsEvaluacion.add(idEvaluacion);
    }
  }
  return {
    ...estadoSinIdentidades,
    schemaVersion: estadoInicial.schemaVersion,
    personas,
    trabajos,
    evaluaciones,
    notificaciones: (estadoGuardado.notificaciones ?? estadoInicial.notificaciones)
      .map((notificacion) => ({ ...notificacion, idDestinatario: null })),
  };
}
