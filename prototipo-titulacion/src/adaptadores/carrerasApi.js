const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objeto(valor) { return valor !== null && typeof valor === 'object' && !Array.isArray(valor); }
function fecha(valor) { return typeof valor === 'string' && Number.isFinite(Date.parse(valor)); }

export function adaptarCarreraApi(valor) {
  if (!objeto(valor) || !UUID_V4.test(valor.id ?? '')
    || typeof valor.codigo !== 'string' || !valor.codigo.trim()
    || typeof valor.nombre !== 'string' || !valor.nombre.trim()
    || typeof valor.estaActivo !== 'boolean'
    || !Number.isInteger(valor.revision) || valor.revision < 1
    || !fecha(valor.creadoEn) || !fecha(valor.actualizadoEn)) {
    throw new Error('La API devolvió una carrera con formato inválido.');
  }
  return {
    id: valor.id, codigo: valor.codigo, nombre: valor.nombre,
    estaActivo: valor.estaActivo, revision: valor.revision,
    creadoEn: valor.creadoEn, actualizadoEn: valor.actualizadoEn, fuenteDatos: 'api',
  };
}

export function adaptarListadoCarrerasApi(valor) {
  if (!Array.isArray(valor)) throw new Error('La API devolvió un listado de carreras inválido.');
  return valor.map(adaptarCarreraApi);
}

export function mapearCrearCarrera(datos) {
  if (!objeto(datos) || typeof datos.codigo !== 'string' || typeof datos.nombre !== 'string'
    || typeof datos.estaActivo !== 'boolean') throw new TypeError('Los datos de carrera no son válidos.');
  return { codigo: datos.codigo.trim(), nombre: datos.nombre.trim(), estaActivo: datos.estaActivo };
}

export function mapearActualizarCarrera(datos) {
  if (!objeto(datos) || !UUID_V4.test(datos.id ?? '') || !Number.isInteger(datos.revision)
    || datos.revision < 1 || typeof datos.nombre !== 'string') {
    throw new TypeError('La revisión y el nombre de carrera son obligatorios.');
  }
  return { id: datos.id, dto: { revision: datos.revision, nombre: datos.nombre.trim() } };
}

export function mapearEstadoCarrera(datos) {
  if (!objeto(datos) || !UUID_V4.test(datos.id ?? '') || !Number.isInteger(datos.revision)
    || datos.revision < 1 || typeof datos.estaActivo !== 'boolean') {
    throw new TypeError('El estado esperado de carrera no es válido.');
  }
  return { id: datos.id, dto: { revision: datos.revision, estaActivo: datos.estaActivo } };
}
