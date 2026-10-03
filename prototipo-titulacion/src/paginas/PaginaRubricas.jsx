import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ROL } from '../datos/datosPrototipo';
import { nombreCompleto, obtenerEtapasRubrica, maximoEtapa } from '../dominio/flujoTrabajo';

const estadoRubrica = {
  ACTIVA: { etiqueta: 'Activa', tono: 'success' },
  BORRADOR: { etiqueta: 'Borrador', tono: 'progress' },
  ARCHIVADA: { etiqueta: 'Histórica', tono: 'neutral' },
};

const clonar = (value) => JSON.parse(JSON.stringify(value));

function versionSugerida(version) {
  const match = String(version ?? '').match(/^(?:v)?(\d+)(?:\.(\d+))?/i);
  if (!match) return 'v1.0';
  return `v${Number(match[1]) + 1}.0`;
}

export default function PaginaRubricas() {
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();
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
      confirmButtonColor: '#123f68',
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

  return (
    <>
      <EncabezadoPagina
        eyebrow="Configuración académica"
        title="Rúbricas de evaluación"
        description={`Versiones por modalidad y período. Usuario actual: ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas' }]}
        actions={puedeGestionar ? (
          <button className="button button-primary" type="button" onClick={() => crearVersion()}>
            Crear nueva versión
          </button>
        ) : null}
      />

      <div className="alert alert-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Cada versión conserva su estructura completa</strong>
          Las etapas, categorías, indicadores y valoraciones pueden variar por modalidad y período. Las evaluaciones iniciadas conservan su propia copia.
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Versiones disponibles</h2>
            <p className="text-muted mb-0">Solo una versión puede estar vigente para cada modalidad y período.</p>
          </div>
          <InsigniaEstado estado={`${estado.versionesRubrica.length} versiones`} tono="info" />
        </div>

        {estado.versionesRubrica.length === 0 ? (
          <div className="card-body">
            <EstadoVacio title="No hay rúbricas configuradas" description="Cree un borrador para definir la primera versión." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead><tr><th>Rúbrica</th><th>Modalidad</th><th>Período</th><th>Versión</th><th>Etapas</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {estado.versionesRubrica.map((rubrica) => {
                  const estado = estadoRubrica[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral' };
                  const etapas = obtenerEtapasRubrica(rubrica);
                  return (
                    <tr key={rubrica.id}>
                      <td data-label="Rúbrica"><span className="cell-title">{rubrica.titulo}</span><span className="cell-subtitle">{rubrica.categorias.length} categorías configuradas</span></td>
                      <td data-label="Modalidad">{rubrica.modalidad}</td>
                      <td data-label="Período">{rubrica.periodo}</td>
                      <td data-label="Versión">{rubrica.version}</td>
                      <td data-label="Etapas">{etapas.map((etapa) => <span className="cell-subtitle" key={etapa.id}>{etapa.nombre}: {maximoEtapa(rubrica, etapa.id).toFixed(2)}</span>)}</td>
                      <td data-label="Estado"><InsigniaEstado estado={estado.etiqueta} tono={estado.tono} /></td>
                      <td data-label="Acciones"><div className="table-actions"><Link className="button button-sm button-outline" to={`/rubricas/${rubrica.id}`}>{rubrica.estado === 'BORRADOR' && puedeGestionar ? 'Editar borrador' : 'Ver estructura'}</Link>{rubrica.estado === 'ACTIVA' && puedeGestionar ? <button className="button button-sm button-primary" type="button" onClick={() => crearVersion(rubrica)}>Crear nueva versión</button> : null}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
