import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { AlertaInstitucional } from '../componentes/interfaz';
import { etiquetasRol } from '../datos/datosPrototipo';
import { usarPrototipo } from '../estado/ContextoPrototipo';

export default function LoginPage() {
  const { estado, actorActual, establecerActorActual } = usarPrototipo();
  const [idActor, setActorId] = useState(actorActual.id);
  const navegar = useNavigate();

  const enter = (evento) => {
    evento.preventDefault();
    establecerActorActual(idActor);
    navegar('/dashboard');
  };

  return (
    <main className="login-shell login-page">
      <section className="login-hero" aria-labelledby="system-name">
        <div className="login-brand">
          <span className="login-brand-logo">
            <img src="/assets/ULEAM.png" alt="Logotipo de la Universidad Laica Eloy Alfaro de Manabí" />
          </span>
          <div><strong>Universidad Laica Eloy Alfaro de Manabí</strong><br /><small>Facultad de Ciencias de la Vida y Tecnologías</small></div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Prototipo</span>
          <h1 id="system-name">Gestión de evaluación de trabajos de titulación</h1>
          <p>Seguimiento desde la asignación del tribunal hasta el cierre e impresión de las rúbricas de evaluación.</p>
        </div>
        <p className="login-foot"></p>
      </section>
      <section className="login-panel" aria-label="Acceso simulado">
        <form className="login-card" onSubmit={enter}>
          <span className="badge badge-info">Modo Demostración · Simulación</span>
          <h2 className="mt-4">Acceso a la simulación</h2>
          <p>Seleccione una identidad ficticia para comprobar las acciones y permisos disponibles según el rol.</p>
          <div className="field">
            <label htmlFor="demo-user">Perfil simulado para pruebas</label>
            <select className="select" id="demo-user" value={idActor} onChange={(evento) => setActorId(evento.target.value)}>
              {estado.actores.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.etiqueta} · {etiquetasRol[actor.rolActivo]}</option>
              ))}
            </select>
          </div>
          <button className="button button-primary button-block institution-button mt-4" type="submit">
            <ShieldCheck size={19} aria-hidden="true" /> Entrar al prototipo
          </button>
        </form>
      </section>
    </main>
  );
}
