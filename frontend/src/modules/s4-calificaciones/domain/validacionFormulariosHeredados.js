export function validarFormularioTrabajo(formulario, estudiantes) {
  const errores = {};

  if (!formulario.titulo.trim()) errores.titulo = 'Ingrese el título del trabajo.';
  if (!formulario.idTutor) errores.idTutor = 'Seleccione el docente tutor.';

  estudiantes.forEach((estudiante, indice) => {
    if (!estudiante.cedula.trim()) errores[`estudiantes.${indice}.cedula`] = `Ingrese la cédula del estudiante ${indice + 1}.`;
    if (!estudiante.nombres.trim()) errores[`estudiantes.${indice}.nombres`] = `Ingrese los nombres del estudiante ${indice + 1}.`;
    if (!estudiante.apellidos.trim()) errores[`estudiantes.${indice}.apellidos`] = `Ingrese los apellidos del estudiante ${indice + 1}.`;
  });

  const indicesPorCedula = estudiantes.reduce((resultado, estudiante, indice) => {
    const cedula = estudiante.cedula.trim();
    if (!cedula) return resultado;
    const indices = resultado.get(cedula) ?? [];
    indices.push(indice);
    resultado.set(cedula, indices);
    return resultado;
  }, new Map());

  indicesPorCedula.forEach((indices) => {
    if (indices.length < 2) return;
    indices.forEach((indice) => {
      errores[`estudiantes.${indice}.cedula`] = 'La cédula debe ser diferente para cada estudiante.';
    });
  });

  return errores;
}

export function validarAsignacionTribunal(idsMiembros) {
  const errores = {};

  idsMiembros.forEach((idMiembro, indice) => {
    if (!idMiembro) errores[`miembro.${indice}`] = `Seleccione el miembro ${indice + 1} del tribunal.`;
  });

  const miembrosSeleccionados = idsMiembros.filter(Boolean);
  if (miembrosSeleccionados.length === idsMiembros.length && new Set(miembrosSeleccionados).size !== idsMiembros.length) {
    idsMiembros.forEach((_, indice) => {
      errores[`miembro.${indice}`] = 'Seleccione dos docentes diferentes.';
    });
  }

  return errores;
}
