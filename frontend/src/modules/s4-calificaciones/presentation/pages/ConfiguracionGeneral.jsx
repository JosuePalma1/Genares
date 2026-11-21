import './configuracionGeneral.css';
import VistaPreviaFlujo from '../components/VistaPreviaFlujo';
import PoliticaConvocatorias from '../components/PoliticaConvocatorias';
import { useEffect, useState } from 'react';
import { getJsonApi, postJsonApi, putJsonApi } from '../services/clienteHttp';
import { EncabezadoPagina } from '../components/interfaz';

const legible = (v) => v.replaceAll('_', ' ').toLowerCase();
function Seleccion({ opciones, valor, cambiar, titulo }) {
  return (
    <details>
      <summary>
        {titulo} ({valor.length})
      </summary>
      {[...new Set([...opciones, ...valor])].map((o) => (
        <label key={o} className="config-opcion">
          <input
            type="checkbox"
            checked={valor.includes(o)}
            onChange={(e) => cambiar(e.target.checked ? [...valor, o] : valor.filter((x) => x !== o))}
          />{' '}
          {legible(o)}
        </label>
      ))}
    </details>
  );
}
function PermisosRoles() {
  const [matriz, setMatriz] = useState(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    getJsonApi('/configuracion-general/roles')
      .then(setMatriz)
      .catch((e) => setAviso(e.message));
  }, []);
  async function guardar(rol) {
    setOcupado(true);
    try {
      const { revision } = await postJsonApi('/configuracion-general/roles', rol);
      setMatriz((m) => ({ ...m, roles: m.roles.map((r) => (r.rol === rol.rol ? { ...r, revision } : r)) }));
      setAviso('Permisos guardados. Se aplican desde la siguiente operación.');
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="card">
      <h2>Permisos por rol</h2>
      {aviso && <p role="status">{aviso}</p>}
      {matriz?.roles.map((r) => (
        <details key={r.rol}>
          <summary>{legible(r.rol)}</summary>
          <fieldset disabled={ocupado}>
            <Seleccion
              titulo="Operaciones permitidas"
              opciones={matriz.catalogo}
              valor={r.permisos}
              cambiar={(permisos) =>
                setMatriz((m) => ({
                  ...m,
                  roles: m.roles.map((item) => (item.rol === r.rol ? { ...item, permisos } : item)),
                }))
              }
            />
            <button type="button" onClick={() => guardar(r)}>
              Guardar permisos de {legible(r.rol)}
            </button>
          </fieldset>
        </details>
      ))}
    </section>
  );
}

function Umbral() {
  const [valor, setValor] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    getJsonApi('/documentos/configuracion/umbral-general')
      .then((c) => setValor(c.notaMinima))
      .catch((e) => setAviso(e.message));
  }, []);
  async function guardar(e) {
    e.preventDefault();
    setOcupado(true);
    try {
      const c = await putJsonApi('/documentos/configuracion/umbral-general', { notaMinima: valor });
      setValor(c.notaMinima);
      setAviso('Umbral guardado para nuevos procesos.');
    } catch (err) {
      setAviso(err.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="card" onSubmit={guardar}>
      <h2>Aprobación</h2>
      <label>
        Porcentaje mínimo de la escala final{' '}
        <input
          required
          type="number"
          min="0"
          max="100"
          step=".01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      <button disabled={ocupado || valor === ''}>Guardar umbral</button>
      {aviso && <p role="status">{aviso}</p>}
    </form>
  );
}

export default function ConfiguracionGeneral() {
  const [config, setConfig] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [ambito, setAmbito] = useState({});
  const [base, setBase] = useState(1);
  function usarVersion(v) {
    setPasos(v.pasos);
    setBase(v.version);
    setAmbito({
      carrera: v.carrera,
      modalidad: v.modalidad,
      periodo: v.periodo,
      redondeo: v.redondeo,
      umbral: v.umbral,
      diasCorreccion: v.diasCorreccion ?? null,
      evidenciaCorreccion: v.evidenciaCorreccion ?? true,
    });
  }
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function cargar() {
    const c = await getJsonApi('/configuracion-general');
    setConfig(c);
    usarVersion(c);
  }
  useEffect(() => {
    cargar().catch((e) => setAviso(e.message));
  }, []);
  const editar = (i, campos) =>
    setPasos((actual) => actual.map((p, n) => (n === i ? { ...p, ...campos } : p)));
  const mover = (i, d) =>
    setPasos((actual) => {
      const copia = [...actual];
      [copia[i], copia[i + d]] = [copia[i + d], copia[i]];
      return copia;
    });
  async function publicar(e) {
    e.preventDefault();
    setOcupado(true);
    try {
      await postJsonApi('/configuracion-general', { version: config.version, pasos, ...ambito });
      await cargar();
      setAviso('Versión publicada para procesos nuevos.');
    } catch (err) {
      setAviso(err.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="configuracion-general">
      <EncabezadoPagina
        title="Configuración general"
        description="Define el flujo que recibirán los nuevos procesos de evaluación."
      />
      {aviso && <p role="status">{aviso}</p>}
      {config?.puedePublicar && <Umbral />}
      {config?.puedePublicar && <PoliticaConvocatorias />}
      {config?.puedeCambiarRoles && <PermisosRoles />}
      {config && (
        <form className="card" onSubmit={publicar}>
          <fieldset disabled={ocupado || !config.puedePublicar}>
            <legend>Flujo académico · versión {config.version}</legend>
            <label>
              Tomar como base{' '}
              <select
                value={base}
                onChange={(e) =>
                  usarVersion(config.versiones.find((v) => v.version === Number(e.target.value)))
                }
              >
                {config.versiones.map((v) => (
                  <option value={v.version} key={v.version}>
                    Versión {v.version}
                  </option>
                ))}
              </select>
            </label>
            <p>
              En los procesos nuevos se aplica la versión con más coincidencias específicas. En caso de empate
              se usa la más reciente.
            </p>
            <div className="config-ambito">
            {Object.entries({
              carrera: config.carreras,
              modalidad: config.modalidades,
              periodo: config.periodos,
            }).map(([campo, opciones]) => (
              <label key={campo}>
                {campo}{' '}
                <select
                  value={ambito[campo] ?? ''}
                  onChange={(e) => setAmbito({ ...ambito, [campo]: e.target.value || null })}
                >
                  <option value="">Cualquiera</option>
                  {opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Redondeo de la nota publicada{' '}
              <select
                value={ambito.redondeo ?? 'HALF_UP'}
                onChange={(e) => setAmbito({ ...ambito, redondeo: e.target.value })}
              >
                <option value="HALF_UP">Redondear al segundo decimal (6,995 → 7,00)</option>
                <option value="TRUNCAR">Truncar al segundo decimal (6,995 → 6,99)</option>
              </select>
            </label>
            <label>
              Umbral específico (%){' '}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Usar el umbral general"
                value={ambito.umbral ?? ''}
                onChange={(e) => setAmbito({ ...ambito, umbral: e.target.value || null })}
              />
            </label>
            </div>
            <fieldset>
              <legend>Solicitudes de corrección</legend>
              <label><input type="checkbox" checked={ambito.evidenciaCorreccion ?? true} onChange={e => setAmbito({...ambito,evidenciaCorreccion:e.target.checked})}/> Requerir evidencia adjunta</label>
              <label>Plazo desde el cierre (días)<input type="number" min="0" max="36500" step="1" value={ambito.diasCorreccion ?? ''} placeholder="Sin límite" onChange={e=>setAmbito({...ambito,diasCorreccion:e.target.value === '' ? null : Number(e.target.value)})}/></label>
            </fieldset>
            {pasos.map((p, i) => (
              <details className="config-paso" key={p.id}>
                <summary>
                  {i + 1}. {p.nombre}
                </summary>
                <label>
                  Nombre{' '}
                  <input
                    required
                    maxLength={100}
                    value={p.nombre}
                    onChange={(e) => editar(i, { nombre: e.target.value })}
                  />
                </label>
                <label>
                  Tipo{' '}
                  <select
                    value={p.tipo}
                    onChange={(e) =>
                      editar(i, {
                        tipo: e.target.value,
                        ejecutores: e.target.value === 'MANUAL' ? ['COORDINACION'] : [],
                        aprobadores: [],
                      })
                    }
                  >
                    <option value="AUTOMATICO">Automático</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </label>
                <Seleccion
                  titulo="Condiciones que deben cumplirse"
                  opciones={[...config.condiciones, ...pasos.slice(0, i).map((x) => 'paso:' + x.id)]}
                  valor={p.condiciones}
                  cambiar={(condiciones) => editar(i, { condiciones })}
                />
                {p.tipo === 'MANUAL' && (
                  <>
                    <Seleccion
                      titulo="Roles que registran el paso"
                      opciones={config.roles}
                      valor={p.ejecutores}
                      cambiar={(ejecutores) => editar(i, { ejecutores })}
                    />
                    <Seleccion
                      titulo="Roles que pueden dar aprobación previa (opcional)"
                      opciones={config.roles}
                      valor={p.aprobadores}
                      cambiar={(aprobadores) => editar(i, { aprobadores })}
                    />
                  </>
                )}
                <Seleccion
                  titulo="Exigir antes de estas acciones"
                  opciones={['PROGRAMAR', 'CERRAR_ESCRITA', 'CERRAR_ORAL']}
                  valor={p.exigirPara ?? []}
                  cambiar={(exigirPara) => editar(i, { exigirPara })}
                />
                {p.exigirPara?.includes('PROGRAMAR') && (
                  <fieldset>
                    <legend>Si se intenta programar con este paso pendiente</legend>
                    <label>Respuesta del sistema
                      <select value={p.modoProgramacion ?? 'BLOQUEAR'} onChange={e=>editar(i,{modoProgramacion:e.target.value})}>
                        <option value="BLOQUEAR">Bloquear</option><option value="ADVERTIR">Advertir y pedir confirmación</option><option value="PERMITIR">Permitir</option>
                      </select>
                    </label>
                    {(p.modoProgramacion ?? 'BLOQUEAR') === 'BLOQUEAR' && <>
                      <Seleccion titulo="Roles que pueden registrar una excepción justificada" opciones={config.roles} valor={p.rolesExcepcion ?? []} cambiar={rolesExcepcion=>editar(i,{rolesExcepcion,pasoAprobacionExcepcion:rolesExcepcion.length ? p.pasoAprobacionExcepcion : undefined})} />
                      {!!p.rolesExcepcion?.length && <label>Aprobación previa para la excepción
                        <select value={p.pasoAprobacionExcepcion ?? ''} onChange={e=>editar(i,{pasoAprobacionExcepcion:e.target.value || undefined})}>
                          <option value="">Sin aprobación previa</option>
                          {pasos.slice(0,i).filter(s=>s.tipo==='MANUAL' && s.aprobadores.length).map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <small>Puedes elegir un paso manual anterior que tenga aprobadores.</small>
                      </label>}
                    </>}
                  </fieldset>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={p.obligatorio}
                    onChange={(e) => editar(i, { obligatorio: e.target.checked })}
                  />{' '}
                  Exigir para finalizar el trabajo
                </label>
                <div className="config-acciones">
                  <button type="button" disabled={!i} onClick={() => mover(i, -1)}>
                    Subir
                  </button>{' '}
                  <button type="button" disabled={i === pasos.length - 1} onClick={() => mover(i, 1)}>
                    Bajar
                  </button>
                  <button type="button" onClick={() => setPasos(pasos.filter((x) => x.id !== p.id))}>
                    Quitar de la nueva versión
                  </button>
                </div>
              </details>
            ))}
            <VistaPreviaFlujo config={config} pasos={pasos} ambito={ambito} />
            <div className="config-acciones">
            <button
              type="button"
              onClick={() =>
                setPasos([
                  ...pasos,
                  {
                    id: 'h_' + crypto.randomUUID(),
                    nombre: 'Nuevo paso',
                    tipo: 'MANUAL',
                    ejecutores: ['COORDINACION'],
                    aprobadores: [],
                    condiciones: [],
                    obligatorio: false,
                  },
                ])
              }
            >
              Añadir paso
            </button>
            <button type="submit" className="button button-primary">
              Publicar nueva versión
            </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
