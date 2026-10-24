const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function fechaIso(valor) {
  return typeof valor === 'string' && Number.isFinite(Date.parse(valor));
}

function adaptarVersion(valor) {
  if (!esObjeto(valor) || !UUID_V4.test(valor.id ?? '') || typeof valor.version !== 'string'
    || !['BORRADOR', 'CONFIGURADA', 'ACTIVA', 'ARCHIVADA'].includes(valor.estado)
    || !Number.isInteger(valor.revision) || valor.revision < 1
    || !esObjeto(valor.periodo) || !UUID_V4.test(valor.periodo.id ?? '')
    || typeof valor.periodo.codigo !== 'string'
    || (valor.activadaEn !== null && !fechaIso(valor.activadaEn))) {
    throw new Error('La API devolvió una versión de rúbrica con formato inválido.');
  }
  return {
    id: valor.id,
    version: valor.version,
    estado: valor.estado,
    revision: valor.revision,
    periodo: { id: valor.periodo.id, codigo: valor.periodo.codigo },
    activadaEn: valor.activadaEn,
  };
}

export function adaptarModalidadApi(valor) {
  if (!esObjeto(valor) || !UUID_V4.test(valor.id ?? '')
    || typeof valor.codigo !== 'string' || !valor.codigo.trim()
    || typeof valor.nombre !== 'string' || !valor.nombre.trim()
    || (valor.descripcion !== null && typeof valor.descripcion !== 'string')
    || typeof valor.estaActivo !== 'boolean'
    || !Number.isInteger(valor.revision) || valor.revision < 1
    || !fechaIso(valor.creadoEn) || !fechaIso(valor.actualizadoEn)) {
    throw new Error('La API devolvió una modalidad con formato inválido.');
  }
  let familiaRubricas = null;
  if (valor.familiaRubricas !== null) {
    const familia = valor.familiaRubricas;
    if (!esObjeto(familia) || !UUID_V4.test(familia.id ?? '')
      || typeof familia.nombre !== 'string'
      || (familia.descripcion !== null && typeof familia.descripcion !== 'string')
      || !Number.isInteger(familia.cantidadVersiones) || familia.cantidadVersiones < 0
      || (familia.versiones !== undefined && !Array.isArray(familia.versiones))) {
      throw new Error('La API devolvió una familia de rúbricas con formato inválido.');
    }
    familiaRubricas = {
      id: familia.id,
      nombre: familia.nombre,
      descripcion: familia.descripcion,
      cantidadVersiones: familia.cantidadVersiones,
      ...(familia.versiones === undefined ? {} : { versiones: familia.versiones.map(adaptarVersion) }),
    };
  }
  return {
    id: valor.id,
    codigo: valor.codigo,
    nombre: valor.nombre,
    descripcion: valor.descripcion,
    estaActivo: valor.estaActivo,
    revision: valor.revision,
    creadoEn: valor.creadoEn,
    actualizadoEn: valor.actualizadoEn,
    familiaRubricas,
    fuenteDatos: 'api',
  };
}

export function adaptarListadoModalidadesApi(valor) {
  if (!Array.isArray(valor)) throw new Error('La API devolvió un listado de modalidades inválido.');
  return valor.map(adaptarModalidadApi);
}

export function mapearCrearModalidad(datos) {
  if (!esObjeto(datos) || typeof datos.codigo !== 'string' || typeof datos.nombre !== 'string'
    || typeof datos.estaActivo !== 'boolean') throw new TypeError('Los datos de creación de modalidad no son válidos.');
  return {
    codigo: datos.codigo.trim(),
    nombre: datos.nombre.trim(),
    descripcion: typeof datos.descripcion === 'string' && datos.descripcion.trim() ? datos.descripcion.trim() : null,
    estaActivo: datos.estaActivo,
  };
}

export function mapearActualizarModalidad(datos) {
  if (!esObjeto(datos) || !UUID_V4.test(datos.id ?? '') || !Number.isInteger(datos.revision) || datos.revision < 1
    || typeof datos.codigo !== 'string' || typeof datos.nombre !== 'string') {
    throw new TypeError('La revisión y los datos completos de modalidad son obligatorios.');
  }
  return {
    id: datos.id,
    dto: {
      revision: datos.revision,
      codigo: datos.codigo,
      nombre: datos.nombre.trim(),
      descripcion: typeof datos.descripcion === 'string' && datos.descripcion.trim() ? datos.descripcion.trim() : null,
    },
  };
}

export function mapearEstadoModalidad(datos) {
  if (!esObjeto(datos) || !UUID_V4.test(datos.id ?? '') || !Number.isInteger(datos.revision) || datos.revision < 1
    || typeof datos.estaActivo !== 'boolean') throw new TypeError('El estado esperado de modalidad no es válido.');
  return { id: datos.id, dto: { revision: datos.revision, estaActivo: datos.estaActivo } };
}
