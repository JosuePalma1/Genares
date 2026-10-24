import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowDownUp, ArrowUp, FolderOpen, Search, X } from 'lucide-react';
import { EstadoVacio } from './interfaz';
import { filtrarCatalogo, ordenarCatalogo } from '../dominio/tablaCatalogo';
import './maestros.css';

export function TablaCatalogo({
  caption,
  registros,
  columnas,
  cargando = false,
  error = '',
  onReintentar,
  placeholderBusqueda = 'Buscar por código o nombre',
  etiquetaRegistro = 'registros',
}) {
  const id = useId();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('ACTIVAS');
  const [mensajeVacioCerrado, setMensajeVacioCerrado] = useState(false);
  const [orden, setOrden] = useState({ clave: 'codigo', direccion: 'asc' });
  const filtrados = useMemo(
    () => filtrarCatalogo(registros, { busqueda, estado }),
    [registros, busqueda, estado],
  );
  const columnaOrdenada = columnas.find(({ key }) => key === orden.clave);
  const ordenados = useMemo(
    () => ordenarCatalogo(filtrados, orden.clave, orden.direccion, columnaOrdenada),
    [filtrados, orden, columnaOrdenada],
  );

  function ordenar(clave) {
    setOrden((actual) => ({
      clave,
      direccion: actual.clave === clave && actual.direccion === 'asc' ? 'desc' : 'asc',
    }));
  }

  function contenidoVacio() {
    if (mensajeVacioCerrado) return null;
    const estadoVacio = registros.length === 0
      ? <EstadoVacio
        className="tabla-catalogo-vacio"
        icon={FolderOpen}
        title={`Todavía no hay ${etiquetaRegistro} registradas`}
        description="Este catálogo aún no tiene registros para mostrar."
      />
      : <EstadoVacio
        className="tabla-catalogo-vacio"
        icon={Search}
        title="Sin resultados con estos filtros"
        description="Prueba otra búsqueda o selecciona otro estado."
      />;

    return <div className="tabla-catalogo-vacio-contenedor">
      <button
        className="tabla-catalogo-vacio-cerrar"
        type="button"
        aria-label="Cerrar mensaje"
        title="Cerrar mensaje"
        onClick={() => setMensajeVacioCerrado(true)}
      ><X size={18} aria-hidden="true" /></button>
      {estadoVacio}
    </div>;
  }

  return (
    <div className="tabla-catalogo">
      <div className="tabla-catalogo-filtros">
        <label className="tabla-catalogo-busqueda" htmlFor={`${id}-buscar`}>
          <span>{placeholderBusqueda}</span>
          <input
            id={`${id}-buscar`}
            type="search"
            value={busqueda}
            onChange={(evento) => { setBusqueda(evento.target.value); setMensajeVacioCerrado(false); }}
            autoComplete="off"
          />
        </label>
        <label htmlFor={`${id}-estado`}>
          <span>Estado</span>
          <select id={`${id}-estado`} value={estado} onChange={(evento) => { setEstado(evento.target.value); setMensajeVacioCerrado(false); }}>
            <option value="TODAS">Todas</option>
            <option value="ACTIVAS">Activas</option>
            <option value="INACTIVAS">Inactivas</option>
          </select>
        </label>
      </div>

      {error ? <div className="tabla-catalogo-error" role="alert">
        <p>{error}</p>
        {onReintentar && <button className="button button-outline" type="button" onClick={onReintentar}>Reintentar lectura</button>}
      </div> : cargando ? <p className="tabla-catalogo-cargando" role="status">Actualizando {etiquetaRegistro}…</p> : null}

      {!error && !cargando && (ordenados.length === 0 ? contenidoVacio() : <div className="tabla-catalogo-scroll" tabIndex="0" aria-label={`${caption}; desplazamiento horizontal disponible`}>
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columnas.map((columna) => {
                const activa = columna.key === orden.clave;
                const ariaSort = !columna.sortable ? undefined : activa
                  ? orden.direccion === 'asc' ? 'ascending' : 'descending'
                  : 'none';
                return <th key={columna.key} scope="col" aria-sort={ariaSort} className={columna.alineacion === 'derecha' ? 'tabla-catalogo-derecha' : undefined}>
                  {columna.sortable ? <button className="tabla-catalogo-orden" type="button" onClick={() => ordenar(columna.key)}>
                    {columna.label}
                    {activa && orden.direccion === 'asc' ? <ArrowUp size={14} aria-hidden="true" />
                      : activa ? <ArrowDown size={14} aria-hidden="true" />
                        : <ArrowDownUp size={14} aria-hidden="true" />}
                  </button> : columna.label}
                </th>;
              })}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((registro) => <tr key={registro.id}>
              {columnas.map((columna) => <td key={columna.key} className={columna.alineacion === 'derecha' ? 'tabla-catalogo-derecha' : undefined}>
                {columna.render ? columna.render(registro) : registro[columna.key]}
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>)}
    </div>
  );
}
