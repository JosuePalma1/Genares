const colacion = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export const FILTRO_SIN_ASOCIACION = 'SIN_ASOCIACION';
export const FILTRO_NO_INFORMADA = 'NO_INFORMADA';

function textoBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export function crearFilasCatalogoRubricas(versiones, fuente) {
  return versiones.flatMap((version) => {
    const carreras = fuente === 'api' && Array.isArray(version.carreras) ? version.carreras : [];
    const asociaciones = carreras.length ? carreras : [null];

    return asociaciones.map((carrera) => {
      const esApi = fuente === 'api';
      const vigenciaConocida = Boolean(carrera) && typeof carrera.vigente === 'boolean';
      const vigente = esApi && vigenciaConocida ? carrera.vigente : null;

      return {
        id: `${version.id}:${carrera?.id ?? 'sin-carrera'}`,
        versionId: version.id,
        rubricaId: version.idRubrica,
        nombreRubrica: version.titulo,
        modalidadId: version.modalidadId ?? '',
        modalidad: version.modalidad,
        periodoId: version.periodoId ?? version.periodo,
        periodo: version.periodo,
        version: version.version,
        creadaEn: version.creadaEn ?? null,
        carreraId: carrera?.id ?? (esApi ? FILTRO_SIN_ASOCIACION : FILTRO_NO_INFORMADA),
        carrera: carrera?.nombre ?? (esApi ? 'Sin carrera asociada' : 'No disponible'),
        carreraCodigo: carrera?.codigo ?? '',
        tieneAsociacion: Boolean(carrera),
        vigente,
        etiquetaVigencia: vigenciaConocida
          ? carrera.vigente ? 'Vigente' : 'No vigente'
          : esApi ? 'Sin asignación' : 'No informada',
        fuente,
      };
    });
  });
}

export function filtrarRubricasCatalogo(filas, filtros = {}) {
  const consulta = textoBusqueda(filtros.busqueda?.trim());
  return filas.filter((fila) => {
    const coincideTexto = !consulta || textoBusqueda([
      fila.nombreRubrica,
      fila.modalidad,
      fila.carrera,
      fila.carreraCodigo,
      fila.periodo,
      fila.version,
    ].join(' ')).includes(consulta);
    const coincideCarrera = !filtros.carreraId || filtros.carreraId === 'TODAS'
      || fila.carreraId === filtros.carreraId;
    const coincideModalidad = !filtros.modalidadId || filtros.modalidadId === 'TODAS'
      || fila.modalidadId === filtros.modalidadId;
    const coincidePeriodo = !filtros.periodoId || filtros.periodoId === 'TODOS'
      || fila.periodoId === filtros.periodoId;
    const coincideVigencia = !filtros.vigencia || filtros.vigencia === 'TODAS'
      || (filtros.vigencia === 'VIGENTE' && fila.vigente === true)
      || (filtros.vigencia === 'NO_VIGENTE' && fila.vigente === false)
      || (filtros.vigencia === FILTRO_SIN_ASOCIACION && fila.carreraId === FILTRO_SIN_ASOCIACION)
      || (filtros.vigencia === FILTRO_NO_INFORMADA && fila.vigente === null);

    return coincideTexto && coincideCarrera && coincideModalidad && coincidePeriodo && coincideVigencia;
  });
}

export function ordenarRubricasCatalogo(filas, campo, direccion = 'asc') {
  const factor = direccion === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => {
    const valorA = a[campo];
    const valorB = b[campo];
    if (valorA === valorB) return 0;
    if (valorA == null) return -factor;
    if (valorB == null) return factor;
    return colacion.compare(String(valorA), String(valorB)) * factor;
  });
}
