import { Link } from 'react-router-dom';
import { EncabezadoPagina, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { nombreCompleto } from '../dominio/flujoTrabajo';

export default function PaginaNoEncontrada() {
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();

  // La página conserva el mismo contexto de sesión simulada sin alterar el estado.
  void estado;
  void actorActual;
  void despachar;

  return (
    <>
      <EncabezadoPagina
        eyebrow="Error 404"
        title="Página no encontrada"
        description={`La ruta solicitada no está disponible para ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Página no encontrada' }]}
      />
      <section className="card">
        <div className="card-body">
          <EstadoVacio
            title="No pudimos encontrar esta pantalla"
            description="Revise la dirección o vuelva al resumen operativo para continuar con el prototipo."
            accion={<Link className="button button-primary" to="/dashboard">Volver al dashboard</Link>}
          />
        </div>
      </section>
    </>
  );
}
