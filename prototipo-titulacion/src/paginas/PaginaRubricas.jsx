import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import {
  BookOpenCheck,
  CopyPlus,
  Eye,
  FileClock,
  Layers3,
  PencilLine,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ROL } from '../datos/datosPrototipo';
import { maximoEtapa, maximoRubrica, obtenerEtapasRubrica } from '../dominio/flujoTrabajo';
import { usarRubricasLectura } from '../hooks/usarRubricasLectura';
import { cargarCatalogosRubricasApi, cargarDefinicionesRubricasApi, clonarVersionRubricaApi, crearRubricaApi, crearVersionRubricaApi } from '../servicios/rubricasApi';
import { cargarModalidadesApi } from '../servicios/modalidadesApi';
import { mensajeErrorEscrituraRubrica } from '../dominio/rubricasApiEdicion';

const estadoRubrica = {
  ACTIVA: { etiqueta: 'Activa', tono: 'success', ayuda: 'Disponible para trabajos nuevos.' },
  BORRADOR: { etiqueta: 'Borrador', tono: 'progress', ayuda: 'Editable hasta que sea activada.' },
  ARCHIVADA: { etiqueta: 'Histórica', tono: 'neutral', ayuda: 'Conservada en modo de consulta.' },
};

const clonar = (value) => JSON.parse(JSON.stringify(value));

function versionSugerida(version) {
  const match = String(version ?? '').match(/^(?:v)?(\d+)(?:\.(\d+))?/i);
  if (!match) return 'v1.0';
  return `v${Number(match[1]) + 1}.0`;
}

function contarIndicadores(rubrica) {
  return rubrica.categorias.reduce((total, categoria) => total + (categoria.indicadores?.length ?? 0), 0);
}

export default function PaginaRubricas() {
  const { estado, actorActual, despachar } = usarPrototipo();
  const lectura = usarRubricasLectura(estado.versionesRubrica);
  const esApi = lectura.fuente === 'api';
  const versiones = lectura.versiones;
  const navegar = useNavigate();
  const [creandoVacio, setCreandoVacio] = useState(false);
  const [creandoFamilia, setCreandoFamilia] = useState(false);
  const puedeGestionar = actorActual?.roles.some(
    (role) => role === ROL.COMISION || role === ROL.ADMIN,
  );

  const crearVersion = async (origen, vacia = false) => {
    const base = origen ?? (esApi
      ? versiones.find((rubrica) => rubrica.estado === 'ACTIVA') ?? versiones[0]
      : estado.versionesRubrica.find((rubrica) => rubrica.estado === 'ACTIVA'));
    if (!base) {
      await Swal.fire({ icon: 'warning', title: 'No existe una versión base', text: 'Debe existir una rúbrica para poder crear una nueva versión.' });
      return;
    }

    const respuesta = await Swal.fire({
      title: 'Crear nueva versión',
      text: vacia ? `Se creará un borrador sin categorías ni indicadores para ${base.modalidad}.` : `Se copiará ${base.version} de ${base.modalidad} para el período ${base.periodo}.`,
      input: 'text',
      inputLabel: 'Nombre de la nueva versión',
      inputValue: versionSugerida(base.version),
      showCancelButton: true,
      confirmButtonText: 'Crear borrador',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => (!value?.trim() ? 'Ingrese un nombre de versión.' : undefined),
    });
    if (!respuesta.isConfirmed) return;

    const version = respuesta.value.trim();
    const duplicada = !esApi && estado.versionesRubrica.some((rubrica) => (
      rubrica.idRubrica === base.idRubrica && rubrica.periodo === base.periodo && rubrica.version.toLowerCase() === version.toLowerCase()
    ));
    if (duplicada) {
      await Swal.fire({ icon: 'warning', title: 'La versión ya existe', text: 'Utilice un nombre de versión diferente.' });
      return;
    }

    if (esApi) {
      try {
        const creada = await clonarVersionRubricaApi({ versionBase: base, version });
        if (!creada || typeof creada.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creada.id) || !Number.isInteger(creada.revision) || creada.estado !== 'BORRADOR') {
          throw new Error('La API devolvió una respuesta de clonación inválida.');
        }
        try {
          await lectura.reintentar();
        } catch {
          await Swal.fire({ icon: 'warning', title: 'Borrador creado', text: 'La API creó la versión, pero no fue posible recargar el catálogo. El detalle consultará el registro directamente.' });
        }
        navegar(`/rubricas/${encodeURIComponent(creada.id)}`);
      } catch (error) {
        await Swal.fire({ icon: 'error', title: 'No se creó el borrador', text: mensajeErrorEscrituraRubrica(error) });
      }
      return;
    }

    const id = `${base.idRubrica}-${base.periodo}-${version}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    despachar({
      tipo: 'CREAR_VERSION_RUBRICA',
      rubrica: {
        ...clonar(base),
        ...(vacia ? { etapas: [], categorias: [] } : {}),
        id,
        version,
        estado: 'BORRADOR',
        activadoEn: null,
        vigenteDesde: null,
        vigenteHasta: null,
      },
    });
    navegar(`/rubricas/${id}`);
  };

  const crearBorradorVacio = async () => {
    if (!esApi) return crearVersion(undefined, true);
    if (!lectura.puedeAdministrar || creandoVacio) return;
    setCreandoVacio(true);
    try {
      const [definiciones, catalogos] = await Promise.all([cargarDefinicionesRubricasApi(), cargarCatalogosRubricasApi()]);
      if (!definiciones.length || !catalogos.periodos.length) throw new Error('Debe existir una rúbrica y un período en el backend para crear el borrador.');
      const rubrica = await Swal.fire({ title: 'Rúbrica del borrador vacío', input: 'select', inputLabel: 'Rúbrica', inputOptions: Object.fromEntries(definiciones.map((r) => [r.id, `${r.nombre} · ${r.modalidad.nombre}`])), showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar' });
      if (!rubrica.isConfirmed) return;
      const periodo = await Swal.fire({ title: 'Período del borrador', input: 'select', inputLabel: 'Período', inputOptions: Object.fromEntries(catalogos.periodos.map((p) => [p.id, p.codigo])), showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar' });
      if (!periodo.isConfirmed) return;
      const nombre = await Swal.fire({ title: 'Crear borrador vacío', input: 'text', inputLabel: 'Nombre de la versión', inputAttributes: { maxlength: '30' }, inputValidator: (valor) => !valor?.trim() ? 'Ingrese un nombre de versión.' : undefined, showCancelButton: true, confirmButtonText: 'Crear borrador', cancelButtonText: 'Cancelar' });
      if (!nombre.isConfirmed) return;
      const creada = await crearVersionRubricaApi(rubrica.value, { periodoId: periodo.value, version: nombre.value });
      if (!creada || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creada.id) || !Number.isInteger(creada.revision) || creada.estado !== 'BORRADOR') throw new Error('La API devolvió una respuesta de creación inválida.');
      try {
        await lectura.reintentar();
      } catch {
        await Swal.fire({ icon: 'warning', title: 'Borrador creado', text: 'La API creó la versión, pero no fue posible recargar el catálogo. El detalle consultará el registro directamente.' });
      }
      navegar(`/rubricas/${encodeURIComponent(creada.id)}`);
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se creó el borrador', text: mensajeErrorEscrituraRubrica(error) });
    } finally { setCreandoVacio(false); }
  };

  const crearFamilia = async () => {
    if (!esApi || !lectura.puedeAdministrar || creandoFamilia) return;
    setCreandoFamilia(true);
    try {
      const disponibles = await cargarModalidadesApi({ disponiblesParaFamilia: true });
      if (!disponibles.length) {
        await Swal.fire({ icon: 'info', title: 'No hay modalidades disponibles', text: 'Todas las modalidades activas ya tienen una familia o no hay modalidades activas.' });
        return;
      }
      const seleccion = await Swal.fire({
        title: 'Nueva familia de rúbricas',
        input: 'select',
        inputLabel: 'Modalidad activa sin familia',
        inputOptions: Object.fromEntries(disponibles.map((modalidad) => [modalidad.id, `${modalidad.codigo} · ${modalidad.nombre}`])),
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
      });
      if (!seleccion.isConfirmed) return;
      const modalidad = disponibles.find((item) => item.id === seleccion.value);
      if (!modalidad) throw new Error('La modalidad elegida dejó de estar disponible; recargue el catálogo.');
      const nombre = await Swal.fire({
        title: 'Nombre de la familia',
        input: 'text',
        inputValue: `Rúbrica de ${modalidad.nombre}`,
        inputLabel: 'Nombre',
        inputAttributes: { maxlength: '220' },
        inputValidator: (valor) => !valor?.trim() ? 'Ingrese un nombre.' : undefined,
        showCancelButton: true,
        confirmButtonText: 'Crear familia',
        cancelButtonText: 'Cancelar',
      });
      if (!nombre.isConfirmed) return;
      const creada = await crearRubricaApi({ modalidadId: modalidad.id, nombre: nombre.value.trim(), descripcion: null });
      if (!creada || typeof creada.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creada.id)) {
        throw new Error('La API devolvió una respuesta de creación inválida.');
      }
      navegar(`/maestros/modalidades/${encodeURIComponent(modalidad.id)}`);
      lectura.reintentar().catch(() => {});
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se creó la familia', text: mensajeErrorEscrituraRubrica(error) });
    } finally {
      setCreandoFamilia(false);
    }
  };

  const resumen = {
    activas: versiones.filter((rubrica) => rubrica.estado === 'ACTIVA').length,
    borradores: versiones.filter((rubrica) => rubrica.estado === 'BORRADOR').length,
    historicas: versiones.filter((rubrica) => rubrica.estado === 'ARCHIVADA').length,
  };

  return (
    <div className="rubricas-page">
      <EncabezadoPagina
        eyebrow="Configuración académica"
        title="Gestión de rúbricas"
        description="Administre versiones y consulte la estructura de evaluación definida para cada modalidad y período."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas' }]}
        actions={<>{esApi && lectura.puedeAdministrar && <button className="button button-outline" type="button" disabled={creandoFamilia} onClick={crearFamilia}>Crear familia</button>}{(esApi ? lectura.puedeAdministrar : puedeGestionar) && <button className="button button-outline" type="button" disabled={creandoVacio} onClick={crearBorradorVacio}>Crear borrador vacío</button>}{esApi ? lectura.puedeAdministrar && versiones.length ? (
          <button className="button button-primary" type="button" onClick={() => crearVersion()}>
            <CopyPlus size={18} /> Clonar versión
          </button>
        ) : null : puedeGestionar ? (
          <button className="button button-primary" type="button" onClick={() => crearVersion()}>
            <CopyPlus size={18} /> Crear nueva versión
          </button>
        ) : null}</>}
      />

      <AlertaInstitucional tono="info" titulo={esApi ? `Origen: API PostgreSQL - ${lectura.puedeAdministrar ? 'administracion local' : 'solo lectura'}` : 'Origen: prototipo local'}>
        <p>{esApi ? 'Los datos provienen del backend local y no se mezclan con el prototipo. Las escrituras requieren autorizacion administrativa del servidor.' : 'Se muestran datos simulados conservados localmente. La lectura del backend se habilita solo mediante configuracion explicita de desarrollo.'}</p>
      </AlertaInstitucional>

      <section className="rubricas-overview" aria-label="Resumen de versiones">
        <article><BookOpenCheck size={20} /><div><strong>{versiones.length}</strong><span>Versiones registradas</span></div></article>
        <article><ShieldCheck size={20} /><div><strong>{resumen.activas}</strong><span>Versiones activas</span></div></article>
        <article><PencilLine size={20} /><div><strong>{resumen.borradores}</strong><span>{esApi ? 'Borradores consultables' : 'Borradores editables'}</span></div></article>
        <article><FileClock size={20} /><div><strong>{resumen.historicas}</strong><span>Versiones históricas</span></div></article>
      </section>

      <div className="rubricas-integrity-note" role="note">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <strong>Integridad de las evaluaciones históricas</strong>
          <p>Cada evaluación conserva una copia de la rúbrica que recibió. Editar un borrador o crear una versión nueva no modifica trabajos anteriores.</p>
        </div>
      </div>

      <section className="rubricas-catalog" aria-labelledby="rubricas-catalog-title">
        <header className="rubricas-catalog-heading">
          <div>
            <span className="section-kicker">Catálogo institucional</span>
            <h2 id="rubricas-catalog-title">Versiones disponibles</h2>
            <p>{esApi ? lectura.puedeAdministrar ? 'Los borradores pueden clonarse y editarse con la autorizacion local del servidor.' : 'Las versiones de PostgreSQL se consultan en modo solo lectura.' : 'La version y el estado determinan si la estructura puede editarse o solo consultarse.'}</p>
          </div>
          <InsigniaEstado estado={`${versiones.length} versiones`} tono="info" />
        </header>

        {lectura.cargando ? (
          <p className="rubricas-empty" role="status">Consultando rúbricas del backend…</p>
        ) : lectura.error ? (
          <AlertaInstitucional tono="danger" titulo="No fue posible cargar las rúbricas">
            <p>{lectura.error.message}</p>
            <button className="button button-outline" type="button" onClick={lectura.reintentar}>Reintentar</button>
          </AlertaInstitucional>
        ) : versiones.length === 0 ? (
          <div className="rubricas-empty">
            <EstadoVacio
              title="No hay rúbricas configuradas"
              description={esApi ? 'El servicio no devolvió rúbricas para esta consulta.' : 'Cree un borrador para definir la primera versión.'}
            />
          </div>
        ) : (
          <div className="rubricas-version-grid">
            {versiones.map((rubrica) => {
              const presentacion = esApi && rubrica.estado === 'BORRADOR'
                ? { etiqueta: 'Borrador', tono: 'progress', ayuda: lectura.puedeAdministrar ? 'Editable por la identidad administrativa local.' : 'Consulta de solo lectura desde PostgreSQL.' }
                : estadoRubrica[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral', ayuda: 'Estado de la version.' };

              const etapas = obtenerEtapasRubrica(rubrica);
              const indicadores = contarIndicadores(rubrica);
              const esEditable = rubrica.estado === 'BORRADOR' && (esApi ? lectura.puedeAdministrar : puedeGestionar);
              return (
                <article className={`rubrica-version-card is-${rubrica.estado.toLowerCase()}`} key={rubrica.id}>
                  <header className="rubrica-version-heading">
                    <div className="rubrica-version-icon" aria-hidden="true"><BookOpenCheck size={22} /></div>
                    <div>
                      <span className="rubrica-version-modality">{rubrica.modalidad}</span>
                      <h3>{rubrica.titulo}</h3>
                    </div>
                    <InsigniaEstado estado={presentacion.etiqueta} tono={presentacion.tono} />
                  </header>

                  <div className="rubrica-version-identity">
                    <div><span>Versión</span><strong>{rubrica.version}</strong></div>
                    <div><span>Período</span><strong>{rubrica.periodo}</strong></div>
                    <div><span>Puntaje máximo</span><strong>{maximoRubrica(rubrica).toFixed(2)} pts</strong></div>
                  </div>

                  <div className="rubrica-version-counts" aria-label="Estructura de la versión">
                    <span><Layers3 size={16} /> {rubrica.categorias.length} categorías</span>
                    <span><Scale size={16} /> {indicadores} indicadores</span>
                  </div>

                  <div className="rubrica-version-stages">
                    {etapas.map((etapa) => (
                      <div key={etapa.id}>
                        <span>{etapa.nombreCorto ?? etapa.nombre}</span>
                        <strong>{maximoEtapa(rubrica, etapa.id).toFixed(2)} pts</strong>
                      </div>
                    ))}
                  </div>

                  <p className="rubrica-version-help">{presentacion.ayuda}</p>

                  <footer className="rubrica-version-actions">
                    <Link className="button button-outline" to={`/rubricas/${rubrica.id}`}>
                      {esEditable ? <PencilLine size={17} /> : <Eye size={17} />}
                      {esEditable ? 'Editar borrador' : 'Ver estructura'}
                    </Link>
                    {esApi && lectura.puedeAdministrar ? (
                      <button className="button button-primary" type="button" onClick={() => crearVersion(rubrica)}>
                        <CopyPlus size={17} /> Clonar versión
                      </button>
                    ) : rubrica.estado === 'ACTIVA' && puedeGestionar && !esApi ? (
                      <button className="button button-primary" type="button" onClick={() => crearVersion(rubrica)}>
                        <CopyPlus size={17} /> Nueva versión
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
