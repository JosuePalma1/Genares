import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Aplicacion from './Aplicacion';
import { ProveedorPrototipo } from './estado/ContextoPrototipo';
import { modoDemostracionPermitido } from './configuracion/modoDemostracion';
import '../css/styles.css';
import '../css/responsive.css';
import './estilos/aplicacion.css';

const raiz = ReactDOM.createRoot(document.getElementById('root'));

if (modoDemostracionPermitido(import.meta.env.MODE)) {
  raiz.render(
    <React.StrictMode>
      <BrowserRouter>
        <ProveedorPrototipo>
          <Aplicacion />
        </ProveedorPrototipo>
      </BrowserRouter>
    </React.StrictMode>,
  );
} else {
  raiz.render(
    <main className="demo-produccion-bloqueada">
      <h1>Genares</h1>
      <p>La aplicación con datos académicos solo está disponible en el entorno local de desarrollo.</p>
    </main>,
  );
}
