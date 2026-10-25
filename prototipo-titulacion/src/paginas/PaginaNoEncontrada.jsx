import { Link } from 'react-router-dom';
import { EncabezadoPagina, EstadoVacio } from '../componentes/interfaz';

export default function PaginaNoEncontrada() {
  return (
    <>
      <EncabezadoPagina
        eyebrow="Error 404"
        title="Página no encontrada"
        description="La ruta solicitada no está disponible."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Página no encontrada' }]}
      />
      <section className="card">
        <div className="card-body">
          <EstadoVacio
            title="No pudimos encontrar esta pantalla"
            description="Revise la dirección o vuelva al resumen operativo para continuar."
            accion={<Link className="button button-primary" to="/dashboard">Volver al dashboard</Link>}
          />
        </div>
      </section>
    </>
  );
}
