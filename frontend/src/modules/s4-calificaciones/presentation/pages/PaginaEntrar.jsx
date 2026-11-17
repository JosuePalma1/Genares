import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { AlertaInstitucional } from '../components/interfaz';
import { consultarDemo, entrarDemo } from '../services/sesionDemo';
import { rutaInicialPorRol } from '../../domain/navegacionDemo';
import './entrar.css';

// Solo rama demo/accesos-por-rol: entrada con usuarios de prueba. No es el inicio de sesión institucional.
export const CONTRASENA_DEMO_VISIBLE = 'Demo2026!';

function carrerasDe(usuario) {
  if (usuario.carreras === null) return usuario.rol === 'TRIBUNAL' ? 'Sus trabajos' : 'Todas';
  if (!usuario.carreras.length) return 'Ninguna';
  return usuario.carreras.map((codigo) => codigo.replace('DEV-', '')).join(', ');
}

export function ListaUsuariosDemo({ usuarios, alElegir }) {
  return (
    <table className="data-table entrar-usuarios">
      <caption className="sr-only">Usuarios de demostración</caption>
      <thead><tr><th>Usuario</th><th>Rol</th><th>Ve</th></tr></thead>
      <tbody>
        {usuarios.map((usuario) => (
          <tr key={usuario.usuario}>
            <td><button type="button" className="entrar-usuario" onClick={() => alElegir(usuario.usuario)}>{usuario.usuario}</button>
              <small>{usuario.nombre}</small></td>
            <td>{usuario.nombreRol}</td>
            <td>{carrerasDe(usuario)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PaginaEntrar() {
  const [usuarios, establecerUsuarios] = useState(null);
  const [usuario, establecerUsuario] = useState('');
  const [contrasena, establecerContrasena] = useState('');
  const [error, establecerError] = useState('');
  const [enviando, establecerEnviando] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    consultarDemo({ signal: controlador.signal }).then((demo) => {
      if (!controlador.signal.aborted) establecerUsuarios(demo?.usuarios ?? []);
    });
    return () => controlador.abort();
  }, []);

  async function entrar(evento) {
    evento.preventDefault();
    if (!usuario.trim() || !contrasena) return establecerError('Escriba el usuario y la contraseña.');
    establecerEnviando(true);
    establecerError('');
    try {
      const usuarioDemo = await entrarDemo(usuario.trim(), contrasena);
      // Recarga completa: el menú y los permisos se vuelven a pedir con la nueva identidad.
      window.location.assign(rutaInicialPorRol(usuarioDemo?.rol));
    } catch (fallo) {
      establecerError(fallo.message);
      establecerEnviando(false);
    }
  }

  return (
    <main className="entrar-pagina" id="main-content">
      <section className="card entrar-tarjeta" aria-labelledby="entrar-titulo">
        <div className="entrar-marca"><span className="brand-mark" aria-hidden="true">GT</span>
          <div><strong>Gestión de Titulación</strong><small>Facultad de Ciencias de la Vida y Tecnologías</small></div></div>
        <h1 id="entrar-titulo">Entrar · demostración por roles</h1>
        <AlertaInstitucional titulo="Usuarios de prueba">
          No es el inicio de sesión institucional. Sirve para mostrar qué ve y qué puede hacer cada actor.
          Contraseña común: <strong>{CONTRASENA_DEMO_VISIBLE}</strong>
        </AlertaInstitucional>
        <form className="entrar-formulario" onSubmit={entrar} noValidate>
          <div className="field"><label htmlFor="entrar-usuario">Usuario</label>
            <input id="entrar-usuario" className="input" autoComplete="username" value={usuario}
              onChange={(e) => establecerUsuario(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'entrar-error' : undefined} /></div>
          <div className="field"><label htmlFor="entrar-contrasena">Contraseña</label>
            <input id="entrar-contrasena" className="input" type="password" autoComplete="current-password" value={contrasena}
              onChange={(e) => establecerContrasena(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'entrar-error' : undefined} /></div>
          {error && <p className="entrar-error" id="entrar-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={enviando}><LogIn size={17} aria-hidden="true" />{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <h2>Usuarios disponibles</h2>
        {usuarios === null && <p role="status">Consultando usuarios…</p>}
        {usuarios?.length === 0 && <p role="status">El servidor no tiene usuarios de demostración. Arranque el backend de la rama demo/accesos-por-rol.</p>}
        {usuarios?.length > 0 && <ListaUsuariosDemo usuarios={usuarios} alElegir={(nombre) => { establecerUsuario(nombre); establecerError(''); }} />}
      </section>
    </main>
  );
}
