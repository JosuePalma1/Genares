import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { roleLabels } from '../data/prototypeData';
import { usePrototype } from '../state/PrototypeContext';

export default function LoginPage() {
  const { state, currentActor, setCurrentActor } = usePrototype();
  const [actorId, setActorId] = useState(currentActor.id);
  const navigate = useNavigate();

  const enter = (event) => {
    event.preventDefault();
    setCurrentActor(actorId);
    navigate('/dashboard');
  };

  return (
    <main className="login-shell login-page">
      <section className="login-hero" aria-labelledby="system-name">
        <div className="login-brand">
          <img src="/assets/identidad-placeholder.svg" width="58" height="66" alt="Identidad visual provisional" />
          <div><strong>Universidad Laica Eloy Alfaro de Manabí</strong><br /><small>Facultad de Ciencias de la Vida y Tecnologías</small></div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Prototipo funcional</span>
          <h1 id="system-name">Gestión de evaluación de trabajos de titulación</h1>
          <p>Seguimiento desde la asignación del tribunal hasta el cierre e impresión de las rúbricas de evaluación.</p>
        </div>
        <p className="login-foot">No se conecta con DIT, SGA, Microsoft 365 ni servicios de correo.</p>
      </section>
      <section className="login-panel" aria-label="Acceso simulado">
        <form className="login-card" onSubmit={enter}>
          <span className="badge badge-info">Demostración navegable</span>
          <h2 className="mt-4">Ingresar al prototipo</h2>
          <p>Seleccione una identidad ficticia para comprobar las acciones disponibles según el rol.</p>
          <div className="field">
            <label htmlFor="demo-user">Perfil de demostración</label>
            <select className="select" id="demo-user" value={actorId} onChange={(event) => setActorId(event.target.value)}>
              {state.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.label} · {roleLabels[actor.activeRole]}</option>
              ))}
            </select>
          </div>
          <button className="button button-primary button-block institution-button mt-4" type="submit">
            <ShieldCheck size={19} aria-hidden="true" /> Entrar al prototipo
          </button>
          <div className="alert alert-info mt-4"><span>ⓘ</span><div><strong>Acceso simulado</strong>No solicita ni almacena credenciales institucionales.</div></div>
          <p className="login-note"><strong>Datos ficticios</strong><br />Uso exclusivo para validación del flujo.</p>
        </form>
      </section>
    </main>
  );
}

