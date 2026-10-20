const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;
const ESTADOS = new Set(['BORRADOR', 'ACTIVA', 'ARCHIVADA']);
const ETAPAS = new Set(['ESCRITA', 'ORAL']);
const ALCANCES = new Set(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);

export class ErrorDtoRubricas extends Error {
  constructor() {
    super('La respuesta de rúbricas no coincide con el contrato esperado.');
    this.name = 'ErrorDtoRubricas';
  }
}

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function texto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function validarUuid(valor) {
  if (!texto(valor) || !UUID.test(valor)) throw new ErrorDtoRubricas();
  return valor;
}

function validarDecimal(valor, nullable = false) {
  if (nullable && valor === null) return null;
  if (typeof valor !== 'string' || !DECIMAL.test(valor) || !Number.isFinite(Number(valor))) {
    throw new ErrorDtoRubricas();
  }
  return { numero: Number(valor), texto: valor };
}

function validarFecha(valor, nullable = false) {
  if (nullable && valor === null) return null;
  if (!texto(valor) || Number.isNaN(Date.parse(valor))) throw new ErrorDtoRubricas();
  return valor;
}

function validarResumen(resumen) {
  if (!objeto(resumen)) throw new ErrorDtoRubricas();
  validarUuid(resumen.id);
  if (!texto(resumen.version) || !ESTADOS.has(resumen.estado)) throw new ErrorDtoRubricas();
  if (!Number.isInteger(resumen.revision) || resumen.revision < 1) throw new ErrorDtoRubricas();
  if (!objeto(resumen.periodo)) throw new ErrorDtoRubricas();
  validarUuid(resumen.periodo.id);
  if (!texto(resumen.periodo.codigo)) throw new ErrorDtoRubricas();
  validarFecha(resumen.activadaEn, true);
  validarFecha(resumen.creadaEn);
}

function validarListado(rubrica) {
  if (!objeto(rubrica)) throw new ErrorDtoRubricas();
  validarUuid(rubrica.id);
  if (!texto(rubrica.nombre) || !(rubrica.descripcion === null || typeof rubrica.descripcion === 'string')) {
    throw new ErrorDtoRubricas();
  }
  if (!objeto(rubrica.modalidad)) throw new ErrorDtoRubricas();
  validarUuid(rubrica.modalidad.id);
  if (!texto(rubrica.modalidad.codigo) || !texto(rubrica.modalidad.nombre) || !Array.isArray(rubrica.versiones)) {
    throw new ErrorDtoRubricas();
  }
  rubrica.versiones.forEach(validarResumen);
}

function validarDetalle(etapa) {
  if (!objeto(etapa) || !ETAPAS.has(etapa.tipo) || !ALCANCES.has(etapa.alcance)) throw new ErrorDtoRubricas();
  validarUuid(etapa.id);
  if (!texto(etapa.codigo) || !texto(etapa.nombre) || !(etapa.descripcion === null || typeof etapa.descripcion === 'string')) {
    throw new ErrorDtoRubricas();
  }
  if (!Number.isInteger(etapa.orden) || etapa.orden < 1 || !Array.isArray(etapa.categorias)) throw new ErrorDtoRubricas();
  const maximo = validarDecimal(etapa.calificacionMaxima);
  const porcentaje = validarDecimal(etapa.porcentaje, true);

  const categorias = etapa.categorias.map((categoria) => {
    if (!objeto(categoria)) throw new ErrorDtoRubricas();
    validarUuid(categoria.id);
    if (!texto(categoria.codigo) || !texto(categoria.nombre) || !Number.isInteger(categoria.orden) || categoria.orden < 1) {
      throw new ErrorDtoRubricas();
    }
    if (!Array.isArray(categoria.indicadores)) throw new ErrorDtoRubricas();
    const maximoCategoria = validarDecimal(categoria.calificacionMaxima);
    const indicadores = categoria.indicadores.map((indicador) => {
      if (!objeto(indicador)) throw new ErrorDtoRubricas();
      validarUuid(indicador.id);
      if (!texto(indicador.label) || !texto(indicador.descripcion) || !Number.isInteger(indicador.orden) || indicador.orden < 1) {
        throw new ErrorDtoRubricas();
      }
      const maximoIndicador = validarDecimal(indicador.calificacionMaxima);
      return {
        id: indicador.id,
        codigo: indicador.label,
        label: indicador.label,
        etiqueta: indicador.descripcion,
        descripcion: indicador.descripcion,
        maximo: maximoIndicador.numero,
        maximoDecimal: maximoIndicador.texto,
        orden: indicador.orden,
      };
    });
    return {
      id: categoria.id,
      codigo: categoria.codigo,
      nombre: categoria.nombre,
      etapa: etapa.id,
      maximo: maximoCategoria.numero,
      maximoDecimal: maximoCategoria.texto,
      orden: categoria.orden,
      indicadores,
    };
  });

  return {
    etapa: {
      id: etapa.id,
      tipo: etapa.tipo,
      alcance: etapa.alcance,
      codigo: etapa.codigo,
      nombre: etapa.nombre,
      nombreCorto: etapa.nombre,
      descripcion: etapa.descripcion,
      maximo: maximo.numero,
      maximoDecimal: maximo.texto,
      porcentaje: porcentaje?.numero ?? null,
      porcentajeDecimal: porcentaje?.texto ?? null,
      orden: etapa.orden,
    },
    categorias,
  };
}

function validarVersionDetalle(version) {
  validarResumen(version);
  if (!Array.isArray(version.etapas)) throw new ErrorDtoRubricas();
  const etapasValidadas = version.etapas.map(validarDetalle);
  return {
    etapas: etapasValidadas.map(({ etapa }) => etapa),
    categorias: etapasValidadas.flatMap(({ categorias }) => categorias),
  };
}

export function adaptarRubricaApi(rubricaDto, versionesDto) {
  validarListado(rubricaDto);
  if (!objeto(versionesDto) || versionesDto.rubricaId !== rubricaDto.id || !Array.isArray(versionesDto.versiones)) {
    throw new ErrorDtoRubricas();
  }
  if (versionesDto.versiones.length !== rubricaDto.versiones.length) throw new ErrorDtoRubricas();

  const resumenes = new Map(rubricaDto.versiones.map((version) => [version.id, version]));
  const idsVistos = new Set();
  return versionesDto.versiones.map((versionDto) => {
    const resumen = resumenes.get(versionDto.id);
    if (!resumen || idsVistos.has(versionDto.id)) throw new ErrorDtoRubricas();
    idsVistos.add(versionDto.id);
    if (
      resumen.version !== versionDto.version
      || resumen.revision !== versionDto.revision
      || resumen.estado !== versionDto.estado
      || resumen.periodo.id !== versionDto.periodo.id
      || resumen.periodo.codigo !== versionDto.periodo.codigo
    ) throw new ErrorDtoRubricas();

    const estructura = validarVersionDetalle(versionDto);
    return {
      id: versionDto.id,
      idRubrica: rubricaDto.id,
      modalidadId: rubricaDto.modalidad.id,
      titulo: rubricaDto.nombre,
      descripcion: rubricaDto.descripcion,
      modalidad: rubricaDto.modalidad.nombre,
      version: versionDto.version,
      periodo: versionDto.periodo.codigo,
      periodoId: versionDto.periodo.id,
      estado: versionDto.estado,
      revision: versionDto.revision,
      activadaEn: versionDto.activadaEn,
      creadaEn: versionDto.creadaEn,
      etapas: estructura.etapas,
      categorias: estructura.categorias,
      fuenteDatos: 'api',
    };
  });
}

export function adaptarListadoRubricasApi(listado) {
  if (!Array.isArray(listado)) throw new ErrorDtoRubricas();
  listado.forEach(validarListado);
  const ids = listado.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new ErrorDtoRubricas();
  return listado;
}

export function adaptarCatalogosRubricaApi(catalogos) {
  if (!objeto(catalogos) || !Array.isArray(catalogos.modalidades) || !Array.isArray(catalogos.periodos)) {
    throw new ErrorDtoRubricas();
  }
  const modalidades = catalogos.modalidades.map((modalidad) => {
    if (!objeto(modalidad) || !texto(modalidad.codigo) || !texto(modalidad.nombre)) throw new ErrorDtoRubricas();
    return { id: validarUuid(modalidad.id), codigo: modalidad.codigo, nombre: modalidad.nombre };
  });
  const periodos = catalogos.periodos.map((periodo) => {
    if (!objeto(periodo) || !texto(periodo.codigo)) throw new ErrorDtoRubricas();
    return { id: validarUuid(periodo.id), codigo: periodo.codigo };
  });
  if (
    new Set(modalidades.map(({ id }) => id)).size !== modalidades.length
    || new Set(periodos.map(({ id }) => id)).size !== periodos.length
  ) throw new ErrorDtoRubricas();
  return { modalidades, periodos };
}
