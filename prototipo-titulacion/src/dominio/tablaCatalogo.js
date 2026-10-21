const colacionEspanol = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function textoBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export function filtrarCatalogo(registros, { busqueda = '', estado = 'TODAS' } = {}) {
  const consulta = textoBusqueda(busqueda.trim());
  return registros.filter((registro) => {
    const texto = textoBusqueda(`${registro.codigo} ${registro.nombre}`);
    const coincideTexto = !consulta || texto.includes(consulta);
    const coincideEstado = estado === 'TODAS'
      || (estado === 'ACTIVAS' && registro.estaActivo)
      || (estado === 'INACTIVAS' && !registro.estaActivo);
    return coincideTexto && coincideEstado;
  });
}

export function ordenarCatalogo(registros, clave, direccion = 'asc', columna) {
  if (!clave) return [...registros];
  const factor = direccion === 'desc' ? -1 : 1;
  const valorDe = columna?.sortValue ?? ((registro) => registro[clave]);
  return [...registros].sort((a, b) => {
    const valorA = valorDe(a);
    const valorB = valorDe(b);
    if (valorA === valorB) return 0;
    if (valorA == null) return -1 * factor;
    if (valorB == null) return factor;
    if (typeof valorA === 'boolean' && typeof valorB === 'boolean') {
      return ((valorA ? 1 : 0) - (valorB ? 1 : 0)) * factor;
    }
    return colacionEspanol.compare(String(valorA), String(valorB)) * factor;
  });
}
