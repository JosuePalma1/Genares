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
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ROL } from '../datos/datosPrototipo';
import { maximoEtapa, maximoRubrica, obtenerEtapasRubrica } from '../dominio/flujoTrabajo';

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
  const navegar = useNavigate();
  const puedeGestionar = actorActual?.roles.some(
    (role) => role === ROL.COMISION || role === ROL.ADMIN,
  );

  const crearVersion = async (origen) => {
    const base = origen ?? estado.versionesRubrica.find((rubrica) => rubrica.estado === 'ACTIVA');
    if (!base) {
      await Swal.fire({ icon: 'warning', title: 'No existe una versión base', text: 'Debe existir una rúbrica para poder crear una nueva versión.' });
      return;
    }

    const respuesta = await Swal.fire({
      title: 'Crear nueva versión',
      text: `Se copiará ${base.version} de ${base.modalidad} para el período ${base.periodo}.`,
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
    const duplicada = estado.versionesRubrica.some((rubrica) => (
      rubrica.idRubrica === base.idRubrica && rubrica.periodo === base.periodo && rubrica.version.toLowerCase() === version.toLowerCase()
    ));
    if (duplicada) {
      await Swal.fire({ icon: 'warning', title: 'La versión ya existe', text: 'Utilice un nombre de versión diferente.' });
      return;
    }

    const id = `${base.idRubrica}-${base.periodo}-${version}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    despachar({
      tipo: 'CREAR_VERSION_RUBRICA',
      rubrica: {
        ...clonar(base),
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

  const resumen = {
    activas: estado.versionesRubrica.filter((rubrica) => rubrica.estado === 'ACTIVA').length,
    borradores: estado.versionesRubrica.filter((rubrica) => rubrica.estado === 'BORRADOR').length,
    historicas: estado.versionesRubrica.filter((rubrica) => rubrica.estado === 'ARCHIVADA').length,
  };

  return (
    <div className="rubricas-page">
      <EncabezadoPagina
        eyebrow="Configuración académica"
        title="Gestión de rúbricas"
        description="Administre versiones y consulte la estructura de evaluación definida para cada modalidad y período."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas' }]}
        actions={puedeGestionar ? (
          <button className="button button-primary" type="button" onClick={() => crearVersion()}>
            <CopyPlus size={18} /> Crear nueva versión
          </button>
        ) : null}
      />

      <section className="rubricas-overview" aria-label="Resumen de versiones">
        <article><BookOpenCheck size={20} /><div><strong>{estado.versionesRubrica.length}</strong><span>Versiones registradas</span></div></article>
        <article><ShieldCheck size={20} /><div><strong>{resumen.activas}</strong><span>Versiones activas</span></div></article>
        <article><PencilLine size={20} /><div><strong>{resumen.borradores}</strong><span>Borradores editables</span></div></article>
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
            <p>La versión y el estado determinan si la estructura puede editarse o únicamente consultarse.</p>
          </div>
          <InsigniaEstado estado={`${estado.versionesRubrica.length} versiones`} tono="info" />
        </header>

        {estado.versionesRubrica.length === 0 ? (
          <div className="rubricas-empty">
            <EstadoVacio title="No hay rúbricas configuradas" description="Cree un borrador para definir la primera versión." />
          </div>
        ) : (
          <div className="rubricas-version-grid">
            {estado.versionesRubrica.map((rubrica) => {
              const presentacion = estadoRubrica[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral', ayuda: 'Estado de la versión.' };
              const etapas = obtenerEtapasRubrica(rubrica);
              const indicadores = contarIndicadores(rubrica);
              const esEditable = rubrica.estado === 'BORRADOR' && puedeGestionar;
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
                    {rubrica.estado === 'ACTIVA' && puedeGestionar ? (
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
