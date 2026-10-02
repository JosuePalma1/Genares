import { Link } from 'react-router-dom';
import { PageHeader, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { fullName } from '../domain/workflow';

export default function NotFoundPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();

  // La página conserva el mismo contexto de sesión simulada sin alterar el estado.
  void state;
  void currentActor;
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow="Error 404"
        title="Página no encontrada"
        description={`La ruta solicitada no está disponible para ${fullName(currentPerson)}.`}
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Página no encontrada' }]}
      />
      <section className="card">
        <div className="card-body">
          <EmptyState
            title="No pudimos encontrar esta pantalla"
            description="Revise la dirección o vuelva al resumen operativo para continuar con el prototipo."
            action={<Link className="button button-primary" to="/dashboard">Volver al dashboard</Link>}
          />
        </div>
      </section>
    </>
  );
}
