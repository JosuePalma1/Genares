import { estructuraEditorCoincideConVersion } from '../dominio/clonacionVersionRubrica';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_CANONICO = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;
const TIPOS_ETAPA = new Set(['ESCRITA', 'ORAL']);
const ALCANCES = new Set(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);

export class ErrorMapeoEscrituraRubrica extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorMapeoEscrituraRubrica';
  }
}

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function uuid(valor, campo, opcional = false) {
  if (opcional && valor === undefined) return undefined;
  if (typeof valor !== 'string' || !UUID_V4.test(valor)) {
    throw new ErrorMapeoEscrituraRubrica(`${campo} debe conservar un UUID v4 válido.`);
  }
  return valor;
}

function texto(valor, campo, maximo) {
  if (typeof valor !== 'string') throw new ErrorMapeoEscrituraRubrica(`${campo} debe ser texto.`);
  const normalizado = valor.trim();
  if (!normalizado || normalizado.length > maximo) {
    throw new ErrorMapeoEscrituraRubrica(`${campo} debe tener entre 1 y ${maximo} caracteres.`);
  }
  return normalizado;
}

function descripcion(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new ErrorMapeoEscrituraRubrica(`${campo} debe ser texto no vacío.`);
  }
  return valor.trim();
}

function descripcionOpcional(valor, campo) {
  if (valor === null) return null;
  if (typeof valor !== 'string') throw new ErrorMapeoEscrituraRubrica(`${campo} debe ser texto o null.`);
  return valor.trim();
}

function enteroPositivo(valor, campo) {
  if (!Number.isInteger(valor) || valor < 1 || valor > 32767) {
    throw new ErrorMapeoEscrituraRubrica(`${campo} debe ser un entero positivo válido.`);
  }
  return valor;
}

function decimal(valor, campo, nullable = false, maxDigitosEnteros = 3) {
  if (nullable && valor === null) return null;
  if (typeof valor !== 'string' || !DECIMAL_CANONICO.test(valor.trim())
    || valor.trim().split('.')[0].length > maxDigitosEnteros) {
    throw new ErrorMapeoEscrituraRubrica(`${campo} debe conservarse como texto decimal con hasta dos decimales.`);
  }
  return valor.trim();
}

function soloBorrador(version) {
  if (!objeto(version) || version.fuenteDatos !== 'api') {
    throw new ErrorMapeoEscrituraRubrica('Solo se pueden modificar rúbricas disponibles para su perfil.');
  }
  if (version.estado !== 'BORRADOR') {
    throw new ErrorMapeoEscrituraRubrica('Solo se pueden preparar escrituras para versiones BORRADOR.');
  }
}

export function mapearCrearRubricaDto(datos) {
  if (!objeto(datos)) throw new ErrorMapeoEscrituraRubrica('Los datos de la rúbrica no son válidos.');
  const dto = {
    modalidadId: uuid(datos.modalidadId, 'modalidadId'),
    nombre: texto(datos.nombre, 'nombre', 220),
  };
  if (datos.descripcion !== undefined) {
    if (datos.descripcion !== null && typeof datos.descripcion !== 'string') {
      throw new ErrorMapeoEscrituraRubrica('descripcion debe ser texto o null.');
    }
    dto.descripcion = datos.descripcion?.trim() || null;
  }
  return dto;
}

export function mapearCrearVersionRubricaDto(datos) {
  if (!objeto(datos)) throw new ErrorMapeoEscrituraRubrica('Los datos de la versión no son válidos.');
  return {
    periodoId: uuid(datos.periodoId, 'periodoId'),
    version: texto(datos.version, 'version', 30),
  };
}

/** Construye el único cuerpo integral admitido por POST /rubricas/completas. */
export function mapearCrearRubricaCompletaDto(datos) {
  if (!objeto(datos)) throw new ErrorMapeoEscrituraRubrica('Los datos de la rúbrica completa no son válidos.');
  if (!Array.isArray(datos.etapas) || datos.etapas.length === 0) {
    throw new ErrorMapeoEscrituraRubrica('La rúbrica debe contener al menos una etapa.');
  }
  if (!Array.isArray(datos.carreras) || datos.carreras.length === 0) {
    throw new ErrorMapeoEscrituraRubrica('Seleccione al menos una carrera.');
  }

  const codigosEtapa = new Set();
  const etapas = datos.etapas.map((etapa, indiceEtapa) => {
    if (!objeto(etapa) || !ALCANCES.has(etapa.alcance) || !Array.isArray(etapa.categorias) || etapa.categorias.length === 0) {
      throw new ErrorMapeoEscrituraRubrica(`La etapa ${indiceEtapa + 1} requiere nombre, ámbito y categorías.`);
    }
    const codigo = texto(etapa.codigo, `etapas[${indiceEtapa}].codigo`, 40);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(codigo) || codigosEtapa.has(codigo.toUpperCase())) {
      throw new ErrorMapeoEscrituraRubrica(`El código de la etapa ${indiceEtapa + 1} no es válido o está repetido.`);
    }
    codigosEtapa.add(codigo.toUpperCase());

    const codigosCategoria = new Set();
    const categorias = etapa.categorias.map((categoria, indiceCategoria) => {
      if (!objeto(categoria) || !Array.isArray(categoria.indicadores) || categoria.indicadores.length === 0) {
        throw new ErrorMapeoEscrituraRubrica(`La etapa ${indiceEtapa + 1}, categoría ${indiceCategoria + 1}, requiere indicadores.`);
      }
      const codigoCategoria = texto(categoria.codigo, `categorías[${indiceCategoria}].codigo`, 10);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(codigoCategoria) || codigosCategoria.has(codigoCategoria.toUpperCase())) {
        throw new ErrorMapeoEscrituraRubrica(`El código de la categoría ${indiceCategoria + 1} no es válido o está repetido.`);
      }
      codigosCategoria.add(codigoCategoria.toUpperCase());

      const indicadores = categoria.indicadores.map((indicador, indiceIndicador) => ({
        label: texto(indicador?.label, `indicadores[${indiceIndicador}].label`, 40),
        descripcion: descripcion(indicador?.descripcion, `indicadores[${indiceIndicador}].descripcion`),
        calificacionMaxima: decimal(indicador?.calificacionMaxima, `indicadores[${indiceIndicador}].calificacionMaxima`),
        orden: indiceIndicador + 1,
      }));
      const centesimas = indicadores.reduce((total, indicador) => {
        const [entero, fraccion = ''] = indicador.calificacionMaxima.split('.');
        return total + BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0') || '0');
      }, 0n);
      return {
        codigo: codigoCategoria,
        nombre: texto(categoria.nombre, `categorías[${indiceCategoria}].nombre`, 240),
        orden: indiceCategoria + 1,
        indicadores,
        centesimas,
      };
    });
    const centesimasEtapa = categorias.reduce((total, categoria) => total + categoria.centesimas, 0n);
    if (centesimasEtapa !== 1000n) {
      throw new ErrorMapeoEscrituraRubrica(`La etapa ${indiceEtapa + 1} debe sumar exactamente 10.00 puntos.`);
    }
    return {
      codigo,
      nombre: texto(etapa.nombre, `etapas[${indiceEtapa}].nombre`, 220),
      alcance: etapa.alcance,
      ...(etapa.descripcion === undefined ? {} : { descripcion: descripcionOpcional(etapa.descripcion, `etapas[${indiceEtapa}].descripcion`) }),
      orden: indiceEtapa + 1,
      categorias: categorias.map(({ centesimas: _centesimas, ...categoria }) => categoria),
    };
  });

  const idsCarrera = new Set();
  const carreras = datos.carreras.map((carrera, indice) => {
    const carreraId = uuid(carrera?.carreraId, `carreras[${indice}].carreraId`);
    if (idsCarrera.has(carreraId.toLowerCase())) throw new ErrorMapeoEscrituraRubrica('Una carrera está seleccionada más de una vez.');
    idsCarrera.add(carreraId.toLowerCase());
    if (!Number.isInteger(carrera.revision) || carrera.revision < 1 || carrera.revision > 2147483647) {
      throw new ErrorMapeoEscrituraRubrica(`La revisión de la carrera ${indice + 1} no es válida.`);
    }
    if (typeof carrera.vigente !== 'boolean' || !objeto(carrera.vigenciaEsperada)) {
      throw new ErrorMapeoEscrituraRubrica(`La elección de vigencia de la carrera ${indice + 1} no es válida.`);
    }
    const versionId = carrera.vigenciaEsperada.versionId;
    if (versionId !== null) uuid(versionId, `carreras[${indice}].vigenciaEsperada.versionId`);
    return {
      carreraId,
      revision: carrera.revision,
      vigente: carrera.vigente,
      vigenciaEsperada: { versionId },
    };
  });

  return {
    modalidadId: uuid(datos.modalidadId, 'modalidadId'),
    periodoId: uuid(datos.periodoId, 'periodoId'),
    nombre: texto(datos.nombre, 'nombre', 220),
    ...(datos.descripcion === undefined ? {} : { descripcion: datos.descripcion === null ? null : texto(datos.descripcion, 'descripcion', 1000) }),
    version: texto(datos.version, 'version', 30),
    etapas,
    carreras,
  };
}

/** Prepara copia directa o estructura nueva en el endpoint de versión completa. */
export function mapearCrearVersionCompletaRubrica(datos) {
  const versionBase = datos?.versionBase;
  if (!objeto(datos) || !objeto(versionBase) || versionBase.fuenteDatos !== 'api') {
    throw new ErrorMapeoEscrituraRubrica('Seleccione una versión disponible como base para la nueva rúbrica.');
  }
  const rubricaId = uuid(versionBase.idRubrica, 'versionBase.idRubrica');
  const versionBaseId = uuid(versionBase.id, 'versionBase.id');
  if (!Number.isInteger(versionBase.revision) || versionBase.revision < 1 || versionBase.revision > 2147483647) {
    throw new ErrorMapeoEscrituraRubrica('La revisión de la versión base no es válida. Recargue el catálogo.');
  }

  const estructura = mapearCrearRubricaCompletaDto({
    modalidadId: versionBase.modalidadId,
    periodoId: datos.periodoId ?? versionBase.periodoId,
    nombre: versionBase.titulo,
    version: 'ASIGNADA-POR-SERVIDOR',
    etapas: datos.etapas,
    carreras: datos.carreras,
  });
  const dto = {
    periodoId: estructura.periodoId,
    copiarDesdeVersionId: versionBaseId,
    revisionBase: versionBase.revision,
    carreras: estructura.carreras,
  };
  if (!estructuraEditorCoincideConVersion(datos.etapas, versionBase)) dto.etapas = estructura.etapas;
  return { rubricaId, dto };
}

export function mapearClonarVersionRubrica(datos) {
  if (!objeto(datos) || !objeto(datos.versionBase) || datos.versionBase.fuenteDatos !== 'api') {
    throw new ErrorMapeoEscrituraRubrica('Seleccione una versión disponible para clonar.');
  }
  const versionBaseId = uuid(datos.versionBase.id, 'versionBase.id');
  return {
    rubricaId: uuid(datos.versionBase.idRubrica, 'versionBase.idRubrica'),
    dto: {
      periodoId: uuid(datos.periodoId ?? datos.versionBase.periodoId, 'periodoId'),
      version: texto(datos.version, 'version', 30),
      copiarDesdeVersionId: versionBaseId,
    },
  };
}

function mapearIndicador(indicador, ids) {
  if (!objeto(indicador)) throw new ErrorMapeoEscrituraRubrica('La estructura contiene un indicador inválido.');
  const id = uuid(indicador.id, 'indicador.id', true);
  if (id && ids.has(id)) throw new ErrorMapeoEscrituraRubrica('La estructura repite un UUID.');
  if (id) ids.add(id);
  return {
    ...(id ? { id } : {}),
    label: texto(indicador.label, 'indicador.label', 40),
    descripcion: descripcion(indicador.descripcion, 'indicador.descripcion'),
    calificacionMaxima: decimal(indicador.maximoDecimal, 'indicador.calificacionMaxima', false, 2),
    orden: enteroPositivo(indicador.orden, 'indicador.orden'),
  };
}

function mapearCategoria(categoria, ids) {
  if (!objeto(categoria) || !Array.isArray(categoria.indicadores)) {
    throw new ErrorMapeoEscrituraRubrica('La estructura contiene una categoría incompleta.');
  }
  const id = uuid(categoria.id, 'categoria.id', true);
  if (id && ids.has(id)) throw new ErrorMapeoEscrituraRubrica('La estructura repite un UUID.');
  if (id) ids.add(id);
  return {
    ...(id ? { id } : {}),
    codigo: texto(categoria.codigo, 'categoria.codigo', 10),
    nombre: texto(categoria.nombre, 'categoria.nombre', 240),
    calificacionMaxima: decimal(categoria.maximoDecimal, 'categoria.calificacionMaxima', false, 2),
    orden: enteroPositivo(categoria.orden, 'categoria.orden'),
    indicadores: categoria.indicadores.map((indicador) => mapearIndicador(indicador, ids)),
  };
}

/** Convierte el modelo API completo del editor a un reemplazo integral del DTO backend. */
export function mapearActualizarVersionRubricaDto(version) {
  soloBorrador(version);
  uuid(version.id, 'version.id');
  if (!Number.isInteger(version.revision) || version.revision < 1 || version.revision > 32767) {
    throw new ErrorMapeoEscrituraRubrica('La revisión de servidor no es válida.');
  }
  if (!Array.isArray(version.etapas) || !Array.isArray(version.categorias)) {
    throw new ErrorMapeoEscrituraRubrica('La actualización debe incluir la jerarquía completa de etapas y categorías.');
  }
  if (version.categorias.some((categoria) => !objeto(categoria))) {
    throw new ErrorMapeoEscrituraRubrica('La estructura contiene una categoría inválida.');
  }

  const ids = new Set([version.id]);
  const referenciasEtapas = new Set();
  const etapas = version.etapas.map((etapa) => {
    if (!objeto(etapa) || !TIPOS_ETAPA.has(etapa.tipo) || !ALCANCES.has(etapa.alcance)) {
      throw new ErrorMapeoEscrituraRubrica('La estructura contiene una etapa inválida.');
    }
    const id = uuid(etapa.id, 'etapa.id', true);
    if (id && ids.has(id)) throw new ErrorMapeoEscrituraRubrica('La estructura repite un UUID.');
    const referencia = id ?? etapa.claveLocal;
    if (typeof referencia !== 'string' || !referencia.trim() || referenciasEtapas.has(referencia)) {
      throw new ErrorMapeoEscrituraRubrica('Cada etapa nueva necesita una clave local de agrupación única.');
    }
    if (id) ids.add(id);
    referenciasEtapas.add(referencia);
    const categorias = version.categorias
      .filter((categoria) => categoria.etapa === referencia)
      .map((categoria) => mapearCategoria(categoria, ids));
    return {
      ...(id ? { id } : {}),
      tipo: etapa.tipo,
      alcance: etapa.alcance,
      codigo: texto(etapa.codigo, 'etapa.codigo', 40),
      nombre: texto(etapa.nombre, 'etapa.nombre', 220),
      ...(etapa.descripcion === undefined ? {} : { descripcion: descripcionOpcional(etapa.descripcion, 'etapa.descripcion') }),
      calificacionMaxima: decimal(etapa.maximoDecimal, 'etapa.calificacionMaxima'),
      ...(etapa.porcentajeDecimal === undefined ? {} : {
        porcentaje: decimal(etapa.porcentajeDecimal, 'etapa.porcentaje', true),
      }),
      orden: enteroPositivo(etapa.orden, 'etapa.orden'),
      categorias,
    };
  });

  if (version.categorias.some((categoria) => !referenciasEtapas.has(categoria.etapa))) {
    throw new ErrorMapeoEscrituraRubrica('Una categoría no pertenece a una etapa de esta versión.');
  }
  return { revision: version.revision, etapas };
}

export function mapearActivarVersionRubricaDto(version) {
  soloBorrador(version);
  uuid(version.id, 'version.id');
  if (!Number.isInteger(version.revision) || version.revision < 1 || version.revision > 32767) {
    throw new ErrorMapeoEscrituraRubrica('La revisión de servidor no es válida.');
  }
  return { revision: version.revision };
}
