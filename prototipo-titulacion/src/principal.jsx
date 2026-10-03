import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Aplicacion from './Aplicacion';
import { ProveedorPrototipo } from './estado/ContextoPrototipo';
import '../css/styles.css';
import '../css/responsive.css';
import './estilos/aplicacion.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorPrototipo>
        <Aplicacion />
      </ProveedorPrototipo>
    </BrowserRouter>
  </React.StrictMode>,
);
