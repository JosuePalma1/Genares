function normalizar(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

export function filtrarTrabajosApi(trabajos, filtros = {}) {
  const busqueda = normalizar(filtros.busqueda).trim();
  const estado = filtros.estado ?? 'Todos';
  const periodo = filtros.periodo ?? 'Todos';
  const tribunal = filtros.tribunal ?? 'Todos';

  return trabajos.filter((trabajo) => {
    const personas = [
      ...(trabajo.estudiantes ?? []),
      ...(trabajo.tutores ?? []),
      ...(trabajo.miembrosTribunal ?? []),
    ].map(({ nombres, apellidos }) => `${nombres ?? ''} ${apellidos ?? ''}`);
    const texto = normalizar([
      trabajo.codigo,
      trabajo.titulo,
      trabajo.carrera,
      trabajo.modalidad,
      trabajo.periodo,
      ...personas,
    ].join(' '));
    const tieneTribunal = (trabajo.miembrosTribunal?.length ?? 0) > 0;

    return texto.includes(busqueda)
      && (estado === 'Todos' || trabajo.estado === estado)
      && (periodo === 'Todos' || trabajo.periodo === periodo)
      && (tribunal === 'Todos'
        || (tribunal === 'con-tribunal' && tieneTribunal)
        || (tribunal === 'sin-tribunal' && !tieneTribunal));
  });
}
